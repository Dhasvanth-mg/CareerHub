-- Abuse and cost protection for an open-signup app.
--
-- 1. rate_limit_hit(): fixed-window counters for auth endpoints (signup, login, reset, resend).
--    Callable by anon because those requests happen before sign-in, so it only accepts keys with a
--    known prefix and sane limits. It cannot be used to touch anything else.
-- 2. consume_ai_quota(): the only way AI usage is recorded. It identifies the caller from the JWT, so a
--    user can't spend or reset anyone else's allowance, and it enforces a global daily cap on AI spend.
-- 3. Row caps enforced in the database, so they also hold for requests that bypass the app.

-- ---------------------------------------------------------------- auth rate limits
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);
alter table public.rate_limits enable row level security; -- no policies: only the function below can touch it
revoke all on table public.rate_limits from anon, authenticated;

create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits int;
begin
  if p_key !~ '^(signup|login|reset|resend):[a-z]{1,16}:[0-9a-f]{16,64}$' then
    raise exception 'invalid rate limit key';
  end if;
  if p_limit < 1 or p_limit > 1000 or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end,
        hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end
  returning hits into v_hits;

  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;
  return v_hits <= p_limit;
end;
$$;
revoke all on function public.rate_limit_hit(text, int, int) from public;
grant execute on function public.rate_limit_hit(text, int, int) to anon, authenticated;

-- ---------------------------------------------------------------- AI quota
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create index ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);
create index ai_usage_time_idx on public.ai_usage (created_at desc);
alter table public.ai_usage enable row level security; -- no policies: users can't read or write it directly
revoke all on table public.ai_usage from anon, authenticated;

create or replace function public.consume_ai_quota(p_kind text, p_user_hourly int, p_global_daily int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_user int;
  v_global int;
begin
  if uid is null then
    return 'unauthenticated';
  end if;
  if p_user_hourly < 1 or p_user_hourly > 1000 or p_global_daily < 1 or p_global_daily > 1000000 then
    raise exception 'invalid quota parameters';
  end if;

  select count(*) into v_user from public.ai_usage where user_id = uid and created_at > now() - interval '1 hour';
  if v_user >= p_user_hourly then
    return 'user_limit';
  end if;

  select count(*) into v_global from public.ai_usage where created_at > now() - interval '1 day';
  if v_global >= p_global_daily then
    return 'global_limit';
  end if;

  insert into public.ai_usage (user_id, kind) values (uid, left(p_kind, 40));
  if random() < 0.02 then
    delete from public.ai_usage where created_at < now() - interval '3 days';
  end if;
  return 'ok';
end;
$$;
revoke all on function public.consume_ai_quota(text, int, int) from public, anon;
grant execute on function public.consume_ai_quota(text, int, int) to authenticated;

-- ---------------------------------------------------------------- row caps
create index if not exists applications_user_idx on public.applications (user_id);
create index if not exists contacts_user_idx on public.contacts (user_id);
create index if not exists tasks_user_idx on public.tasks (user_id);
create index if not exists documents_user_idx on public.documents (user_id);
create index if not exists document_versions_user_idx on public.document_versions (user_id);
create index if not exists job_postings_user_idx on public.job_postings (user_id);
create index if not exists analysis_runs_user_idx on public.analysis_runs (user_id);
create index if not exists interview_rounds_user_idx on public.interview_rounds (user_id);

create or replace function public.enforce_row_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cap int := tg_argv[0]::int;
  n int;
begin
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= cap then
    raise exception 'limit reached: at most % rows allowed in %', cap, tg_table_name using errcode = '54000';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_row_cap() from public, anon, authenticated;

create trigger cap_applications before insert on public.applications for each row execute function public.enforce_row_cap('2000');
create trigger cap_contacts before insert on public.contacts for each row execute function public.enforce_row_cap('2000');
create trigger cap_tasks before insert on public.tasks for each row execute function public.enforce_row_cap('5000');
create trigger cap_documents before insert on public.documents for each row execute function public.enforce_row_cap('200');
create trigger cap_document_versions before insert on public.document_versions for each row execute function public.enforce_row_cap('1000');
create trigger cap_job_postings before insert on public.job_postings for each row execute function public.enforce_row_cap('1000');
create trigger cap_analysis_runs before insert on public.analysis_runs for each row execute function public.enforce_row_cap('2000');
create trigger cap_interview_rounds before insert on public.interview_rounds for each row execute function public.enforce_row_cap('1000');

-- Total stored file size per user.
create or replace function public.enforce_storage_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  total bigint;
begin
  select coalesce(sum(size_bytes), 0) into total from public.document_versions where user_id = new.user_id;
  if total + new.size_bytes > 104857600 then -- 100 MB
    raise exception 'storage limit reached: 100 MB of documents per account' using errcode = '54000';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_storage_cap() from public, anon, authenticated;
create trigger cap_storage before insert on public.document_versions for each row execute function public.enforce_storage_cap();
