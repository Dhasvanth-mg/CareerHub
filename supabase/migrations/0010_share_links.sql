-- Read-only share links: a person can give a mentor or advisor a private link to a summary of their search.
-- Only a hash of the link's secret is stored. The public page reads through one security-definer function, so
-- signed-out visitors never get table access.

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null unique,
  label text not null check (char_length(label) between 1 and 80),
  include_interviews boolean not null default false,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  view_count int not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '91 days')
);
create index share_links_user_idx on public.share_links (user_id);

create trigger cap_share_links before insert on public.share_links for each row execute function public.enforce_row_cap('20');

alter table public.share_links enable row level security;
create policy share_links_select on public.share_links for select to authenticated using (user_id = (select auth.uid()));
create policy share_links_insert on public.share_links for insert to authenticated with check (user_id = (select auth.uid()));
create policy share_links_update on public.share_links for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy share_links_delete on public.share_links for delete to authenticated using (user_id = (select auth.uid()));

-- Least privilege: nothing for signed-out visitors; owners can't edit the counters or the secret's hash.
revoke all on public.share_links from anon;
revoke truncate, references, trigger on public.share_links from authenticated;
revoke update on public.share_links from authenticated;
grant update (revoked_at, label) on public.share_links to authenticated;

create or replace function public.get_shared_progress(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.share_links;
  result jsonb;
begin
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 100 then
    return null;
  end if;

  select * into l from public.share_links
   where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
     and revoked_at is null
     and expires_at > now();
  if not found then
    return null;
  end if;

  update public.share_links set view_count = view_count + 1, last_viewed_at = now() where id = l.id;

  select jsonb_build_object(
    'label', l.label,
    'owner', (select display_name from public.profiles where id = l.user_id),
    'expires_at', l.expires_at,
    'include_interviews', l.include_interviews,
    'applications', coalesce((
      select jsonb_agg(x order by x.updated_at desc) from (
        select a.company_name as company, a.title, a.stage, a.location, a.applied_on, a.deadline, a.updated_at
          from public.applications a
         where a.user_id = l.user_id and a.archived_at is null
         order by a.updated_at desc
         limit 300
      ) x
    ), '[]'::jsonb),
    'interviews', case when l.include_interviews then coalesce((
      select jsonb_agg(y order by y.scheduled_at) from (
        select a.company_name as company, r.round_type, r.scheduled_at, r.status
          from public.interview_rounds r
          join public.applications a on a.id = r.application_id
         where r.user_id = l.user_id and r.scheduled_at is not null and r.status <> 'cancelled'
           and r.scheduled_at > now() - interval '1 day'
         order by r.scheduled_at
         limit 100
      ) y
    ), '[]'::jsonb) else '[]'::jsonb end
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_shared_progress(text) from public;
grant execute on function public.get_shared_progress(text) to anon, authenticated;
