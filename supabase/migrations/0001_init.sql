-- CareerHub AI: initial schema (Phase 1 + 2 MUST scope).
-- Every table is owned by a user (user_id) and protected by RLS.
-- Child-table policies also require that referenced parents are visible to the caller;
-- since parents are themselves RLS-protected, that means "owned by the caller".

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  target_roles text[] not null default '{}',
  ai_notice_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- companies / postings
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  industry text,
  website text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  source_url text,
  snapshot_text text not null check (char_length(snapshot_text) <= 60000),
  title text,
  company_name text,
  location text,
  work_mode text check (work_mode in ('remote', 'hybrid', 'on_site')),
  employment_type text,
  salary_text text,          -- only what the posting states; never estimated
  deadline date,
  extraction jsonb,          -- raw structured extraction incl. per-field uncertainty
  extraction_state text not null default 'manual'
    check (extraction_state in ('manual', 'extracted', 'needs_review', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_posting_id uuid not null references public.job_postings (id) on delete cascade,
  text text not null,
  kind text not null check (kind in ('must_have', 'preferred')),
  source_snippet text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('resume', 'cover_letter', 'transcript', 'portfolio', 'other')),
  title text not null check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  version int not null check (version > 0),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  extracted_text text,
  extraction_state text not null default 'pending'
    check (extraction_state in ('pending', 'ok', 'empty', 'failed')),
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

-- ---------------------------------------------------------------- applications
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  job_posting_id uuid references public.job_postings (id) on delete set null,
  company_name text not null check (char_length(company_name) between 1 and 200),
  title text not null check (char_length(title) between 1 and 200),
  stage text not null default 'saved'
    check (stage in ('saved', 'preparing', 'applied', 'assessment', 'interview', 'offer',
                     'accepted', 'rejected', 'withdrawn')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  location text,
  work_mode text check (work_mode in ('remote', 'hybrid', 'on_site')),
  employment_type text,
  posting_url text,
  source text,
  salary_text text,
  applied_on date,
  deadline date,
  notes text,
  board_position double precision not null default 0,
  submitted_resume_version_id uuid references public.document_versions (id) on delete set null,
  submitted_cover_letter_version_id uuid references public.document_versions (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applications_user_stage_idx on public.applications (user_id, stage) where archived_at is null;
create index applications_user_deadline_idx on public.applications (user_id, deadline);

-- Append-only activity log. Users can insert and read; no update/delete policies exist.
create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  type text not null,
  summary text not null,
  from_value text,
  to_value text,
  actor text not null default 'user' check (actor in ('user', 'ai_proposal', 'system')),
  data jsonb,
  created_at timestamptz not null default now()
);
create index application_events_app_idx on public.application_events (application_id, created_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  notes text,
  due_at timestamptz,        -- canonical UTC
  completed_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_due_idx on public.tasks (user_id, due_at) where completed_at is null;

-- ---------------------------------------------------------------- contacts / referrals
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  company text,
  position text,
  email text,
  linkedin_url text,
  relationship text,
  where_met text,
  notes text,
  last_contacted_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.application_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  role text not null default 'other'
    check (role in ('recruiter', 'hiring_manager', 'alumni', 'referrer', 'other')),
  created_at timestamptz not null default now(),
  unique (application_id, contact_id)
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  status text not null default 'not_requested'
    check (status in ('not_requested', 'requested', 'agreed', 'submitted', 'declined', 'unknown')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- AI analysis
create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  job_posting_id uuid references public.job_postings (id) on delete set null,
  document_version_id uuid references public.document_versions (id) on delete set null,
  kind text not null check (kind in ('resume', 'cover_letter')),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  model text,
  prompt_version text,
  rubric_version text,
  score int check (score between 0 and 100),
  score_breakdown jsonb,
  summary text,
  suggestions jsonb,
  error text,
  created_at timestamptz not null default now()
);

create table public.analysis_findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  analysis_run_id uuid not null references public.analysis_runs (id) on delete cascade,
  job_requirement_id uuid references public.job_requirements (id) on delete set null,
  requirement text not null,
  evidence text,                       -- verbatim quote from the document, or null
  evidence_source text,
  assessment text not null check (assessment in ('supported', 'unclear', 'not_evidenced')),
  explanation text not null,
  created_at timestamptz not null default now()
);

create table public.ai_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete cascade,
  kind text not null,                  -- e.g. next_action
  payload jsonb not null,
  rationale text,
  sources jsonb,                       -- record fields the suggestion was based on
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  model text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action text not null,
  subject_type text,
  subject_id uuid,
  data jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['profiles','companies','job_postings','documents','applications',
                           'tasks','contacts','referrals']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Plain owner-only tables (full CRUD).
do $$
declare t text;
begin
  foreach t in array array['companies','job_postings','documents','applications','contacts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated
                    with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
                   t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated
                    using (user_id = (select auth.uid()))', t || '_delete', t);
  end loop;
end $$;

-- Parent-ownership checks. Subselects run under the caller's RLS, so they only see the caller's rows.
-- applications: optional links must also be the caller's.
drop policy applications_insert on public.applications;
drop policy applications_update on public.applications;
create policy applications_insert on public.applications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (company_id is null or exists (select 1 from public.companies c where c.id = company_id))
    and (job_posting_id is null or exists (select 1 from public.job_postings j where j.id = job_posting_id))
    and (submitted_resume_version_id is null
         or exists (select 1 from public.document_versions v where v.id = submitted_resume_version_id))
    and (submitted_cover_letter_version_id is null
         or exists (select 1 from public.document_versions v where v.id = submitted_cover_letter_version_id))
  );
create policy applications_update on public.applications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (company_id is null or exists (select 1 from public.companies c where c.id = company_id))
    and (job_posting_id is null or exists (select 1 from public.job_postings j where j.id = job_posting_id))
    and (submitted_resume_version_id is null
         or exists (select 1 from public.document_versions v where v.id = submitted_resume_version_id))
    and (submitted_cover_letter_version_id is null
         or exists (select 1 from public.document_versions v where v.id = submitted_cover_letter_version_id))
  );

-- job_postings: company link must be the caller's.
drop policy job_postings_insert on public.job_postings;
drop policy job_postings_update on public.job_postings;
create policy job_postings_insert on public.job_postings for insert to authenticated
  with check (user_id = (select auth.uid())
    and (company_id is null or exists (select 1 from public.companies c where c.id = company_id)));
create policy job_postings_update on public.job_postings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and (company_id is null or exists (select 1 from public.companies c where c.id = company_id)));

-- Child tables: (name, parent checks as SQL). Generated explicitly for clarity.
alter table public.job_requirements enable row level security;
create policy job_requirements_select on public.job_requirements for select to authenticated
  using (user_id = (select auth.uid()));
create policy job_requirements_insert on public.job_requirements for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.job_postings j where j.id = job_posting_id));
create policy job_requirements_update on public.job_requirements for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.job_postings j where j.id = job_posting_id));
create policy job_requirements_delete on public.job_requirements for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.document_versions enable row level security;
create policy document_versions_select on public.document_versions for select to authenticated
  using (user_id = (select auth.uid()));
create policy document_versions_insert on public.document_versions for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.documents d where d.id = document_id)
    and storage_path like (select auth.uid())::text || '/%');
create policy document_versions_update on public.document_versions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.documents d where d.id = document_id)
    and storage_path like (select auth.uid())::text || '/%');
create policy document_versions_delete on public.document_versions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Append-only: select + insert only.
alter table public.application_events enable row level security;
create policy application_events_select on public.application_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy application_events_insert on public.application_events for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.applications a where a.id = application_id));

alter table public.audit_events enable row level security;
create policy audit_events_select on public.audit_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy audit_events_insert on public.audit_events for insert to authenticated
  with check (user_id = (select auth.uid()));

alter table public.tasks enable row level security;
create policy tasks_select on public.tasks for select to authenticated
  using (user_id = (select auth.uid()));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (user_id = (select auth.uid())
    and (application_id is null or exists (select 1 from public.applications a where a.id = application_id)));
create policy tasks_update on public.tasks for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and (application_id is null or exists (select 1 from public.applications a where a.id = application_id)));
create policy tasks_delete on public.tasks for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.application_contacts enable row level security;
create policy application_contacts_select on public.application_contacts for select to authenticated
  using (user_id = (select auth.uid()));
create policy application_contacts_insert on public.application_contacts for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.applications a where a.id = application_id)
    and exists (select 1 from public.contacts c where c.id = contact_id));
create policy application_contacts_update on public.application_contacts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.applications a where a.id = application_id)
    and exists (select 1 from public.contacts c where c.id = contact_id));
create policy application_contacts_delete on public.application_contacts for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.referrals enable row level security;
create policy referrals_select on public.referrals for select to authenticated
  using (user_id = (select auth.uid()));
create policy referrals_insert on public.referrals for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.applications a where a.id = application_id)
    and exists (select 1 from public.contacts c where c.id = contact_id));
create policy referrals_update on public.referrals for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.applications a where a.id = application_id)
    and exists (select 1 from public.contacts c where c.id = contact_id));
create policy referrals_delete on public.referrals for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.analysis_runs enable row level security;
create policy analysis_runs_select on public.analysis_runs for select to authenticated
  using (user_id = (select auth.uid()));
create policy analysis_runs_insert on public.analysis_runs for insert to authenticated
  with check (user_id = (select auth.uid())
    and (application_id is null or exists (select 1 from public.applications a where a.id = application_id))
    and (job_posting_id is null or exists (select 1 from public.job_postings j where j.id = job_posting_id))
    and (document_version_id is null
         or exists (select 1 from public.document_versions v where v.id = document_version_id)));
create policy analysis_runs_update on public.analysis_runs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy analysis_runs_delete on public.analysis_runs for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.analysis_findings enable row level security;
create policy analysis_findings_select on public.analysis_findings for select to authenticated
  using (user_id = (select auth.uid()));
create policy analysis_findings_insert on public.analysis_findings for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.analysis_runs r where r.id = analysis_run_id)
    and (job_requirement_id is null
         or exists (select 1 from public.job_requirements q where q.id = job_requirement_id)));
create policy analysis_findings_delete on public.analysis_findings for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.ai_proposals enable row level security;
create policy ai_proposals_select on public.ai_proposals for select to authenticated
  using (user_id = (select auth.uid()));
create policy ai_proposals_insert on public.ai_proposals for insert to authenticated
  with check (user_id = (select auth.uid())
    and (application_id is null or exists (select 1 from public.applications a where a.id = application_id)));
create policy ai_proposals_update on public.ai_proposals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ai_proposals_delete on public.ai_proposals for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['application/pdf', 'text/plain'])
on conflict (id) do nothing;

-- Objects live at {user_id}/{document_id}/{file}; only the owner may touch their prefix.
create policy documents_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
