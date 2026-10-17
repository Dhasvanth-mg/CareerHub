-- Interview rounds per application, used by the calendar and (later) interview prep.
create table public.interview_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  round_type text not null default 'other'
    check (round_type in ('recruiter_screen', 'technical', 'behavioral', 'case', 'onsite', 'assessment', 'other')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  scheduled_at timestamptz,          -- canonical UTC
  duration_minutes int check (duration_minutes is null or duration_minutes between 5 and 600),
  location text,                     -- address or video link, as given
  interviewers text,
  prep_notes text,
  questions_asked text,
  debrief text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index interview_rounds_user_time_idx on public.interview_rounds (user_id, scheduled_at);
create index interview_rounds_app_idx on public.interview_rounds (application_id);

create trigger set_updated_at before update on public.interview_rounds
  for each row execute function public.set_updated_at();

alter table public.interview_rounds enable row level security;

create policy interview_rounds_select on public.interview_rounds for select to authenticated
  using (user_id = (select auth.uid()));
create policy interview_rounds_insert on public.interview_rounds for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.applications a where a.id = application_id));
create policy interview_rounds_update on public.interview_rounds for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.applications a where a.id = application_id));
create policy interview_rounds_delete on public.interview_rounds for delete to authenticated
  using (user_id = (select auth.uid()));
