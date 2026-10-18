-- Admin overview: aggregate usage numbers for the people who run the app. Nobody is an admin by default.
-- Admins are rows in public.admins, which only the database owner can edit (see docs/OPERATIONS.md). The overview returns
-- counts and sums only, never anyone's emails, documents, notes or AI output.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security; -- no policies: not readable or writable through the API
revoke all on table public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = (select auth.uid())) $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'users', jsonb_build_object(
      'total', (select count(*) from auth.users),
      'new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
      'new_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
      'active_1d', (select count(*) from auth.users where last_sign_in_at > now() - interval '1 day'),
      'active_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
      'ai_enabled', (select count(*) from public.profiles where ai_notice_accepted_at is not null)
    ),
    'signups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
      from (select created_at::date as d, count(*) as n from auth.users
             where created_at > now() - interval '30 days' group by 1) s
    ),
    'providers', (
      select coalesce(jsonb_object_agg(provider, n), '{}'::jsonb)
      from (select provider, count(distinct user_id) as n from auth.identities group by provider) p
    ),
    'rows', jsonb_build_object(
      'applications', (select count(*) from public.applications),
      'tasks', (select count(*) from public.tasks),
      'contacts', (select count(*) from public.contacts),
      'interview_rounds', (select count(*) from public.interview_rounds),
      'documents', (select count(*) from public.documents),
      'document_versions', (select count(*) from public.document_versions),
      'analysis_runs', (select count(*) from public.analysis_runs),
      'evidence_items', (select count(*) from public.evidence_items),
      'offers', (select count(*) from public.offers),
      'share_links_active', (select count(*) from public.share_links where revoked_at is null and expires_at > now())
    ),
    'storage_bytes', (select coalesce(sum(size_bytes), 0) from public.document_versions),
    'ai', jsonb_build_object(
      'calls_24h', (select count(*) from public.ai_usage where created_at > now() - interval '1 day'),
      'calls_72h', (select count(*) from public.ai_usage where created_at > now() - interval '3 days'),
      'users_24h', (select count(distinct user_id) from public.ai_usage where created_at > now() - interval '1 day'),
      'by_kind_24h', (
        select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb)
        from (select kind, count(*) as n from public.ai_usage where created_at > now() - interval '1 day' group by kind) k
      )
    )
  );
end;
$$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
