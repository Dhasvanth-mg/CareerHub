-- Tables for: interview prep, action center dismissals, copilot chat, evidence library,
-- offer comparison, and the career planner. Every table is owned by a user and protected by RLS.
-- Child tables also require their parents to be visible to the caller (i.e. owned by them).

-- ---------------------------------------------------------------- applications: user ratings for the planner
alter table public.applications
  add column ratings jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------- interview prep
create table public.interview_prep_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  round_id uuid references public.interview_rounds (id) on delete cascade,
  question text not null check (char_length(question) between 1 and 600),
  category text not null default 'other' check (category in ('behavioral', 'technical', 'role', 'company', 'other')),
  why text,
  requirement_text text,
  resume_evidence text,
  evidence_source text,
  answer_draft text check (answer_draft is null or char_length(answer_draft) <= 8000),
  feedback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interview_prep_items_app_idx on public.interview_prep_items (application_id);
create index interview_prep_items_user_idx on public.interview_prep_items (user_id);

-- ---------------------------------------------------------------- action center dismissals
create table public.action_dismissals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 200),
  until timestamptz,                      -- null = dismissed until the underlying situation changes
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ---------------------------------------------------------------- copilot chat
create table public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  sources jsonb,
  draft text check (draft is null or char_length(draft) <= 8000),
  created_at timestamptz not null default now()
);
create index copilot_messages_app_idx on public.copilot_messages (application_id, created_at);
create index copilot_messages_user_idx on public.copilot_messages (user_id);

-- ---------------------------------------------------------------- evidence library
create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'project'
    check (kind in ('project', 'achievement', 'role', 'skill', 'certification', 'coursework', 'volunteering', 'other')),
  title text not null check (char_length(title) between 1 and 200),
  details text check (details is null or char_length(details) <= 4000),
  outcome text check (outcome is null or char_length(outcome) <= 1000),
  link text check (link is null or char_length(link) <= 2000),
  when_text text check (when_text is null or char_length(when_text) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index evidence_items_user_idx on public.evidence_items (user_id);

-- ---------------------------------------------------------------- offers
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  base_amount numeric check (base_amount is null or base_amount >= 0),
  pay_period text not null default 'year' check (pay_period in ('year', 'month', 'hour')),
  bonus_amount numeric check (bonus_amount is null or bonus_amount >= 0),
  equity_text text check (equity_text is null or char_length(equity_text) <= 500),
  benefits_text text check (benefits_text is null or char_length(benefits_text) <= 2000),
  location text,
  work_mode text check (work_mode in ('remote', 'hybrid', 'on_site')),
  start_date date,
  decision_deadline date,
  notes text check (notes is null or char_length(notes) <= 5000),
  ratings jsonb not null default '{}'::jsonb,   -- the user's own 1-5 scores per criterion
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id)
);
create index offers_user_idx on public.offers (user_id);

-- ---------------------------------------------------------------- career planner
create table public.career_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  target_roles text[] not null default '{}',
  target_industries text[] not null default '{}',
  target_locations text[] not null default '{}',
  min_salary numeric check (min_salary is null or min_salary >= 0),
  salary_currency text not null default 'USD' check (salary_currency ~ '^[A-Z]{3}$'),
  constraints_note text check (constraints_note is null or char_length(constraints_note) <= 2000),
  weights jsonb not null default '{}'::jsonb,   -- user-adjustable importance of each ranking criterion
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  skill text check (skill is null or char_length(skill) <= 100),
  notes text check (notes is null or char_length(notes) <= 2000),
  due_on date,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index milestones_user_idx on public.milestones (user_id);

-- ---------------------------------------------------------------- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['interview_prep_items', 'evidence_items', 'offers', 'career_profiles']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- row caps
create trigger cap_interview_prep before insert on public.interview_prep_items for each row execute function public.enforce_row_cap('3000');
create trigger cap_copilot before insert on public.copilot_messages for each row execute function public.enforce_row_cap('5000');
create trigger cap_evidence before insert on public.evidence_items for each row execute function public.enforce_row_cap('500');
create trigger cap_offers before insert on public.offers for each row execute function public.enforce_row_cap('200');
create trigger cap_milestones before insert on public.milestones for each row execute function public.enforce_row_cap('500');
create trigger cap_dismissals before insert on public.action_dismissals for each row execute function public.enforce_row_cap('5000');

-- ---------------------------------------------------------------- RLS
alter table public.interview_prep_items enable row level security;
create policy interview_prep_select on public.interview_prep_items for select to authenticated using (user_id = (select auth.uid()));
create policy interview_prep_insert on public.interview_prep_items for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.applications a where a.id = application_id)
    and (round_id is null or exists (select 1 from public.interview_rounds r where r.id = round_id)));
create policy interview_prep_update on public.interview_prep_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.applications a where a.id = application_id)
    and (round_id is null or exists (select 1 from public.interview_rounds r where r.id = round_id)));
create policy interview_prep_delete on public.interview_prep_items for delete to authenticated using (user_id = (select auth.uid()));

alter table public.action_dismissals enable row level security;
create policy action_dismissals_select on public.action_dismissals for select to authenticated using (user_id = (select auth.uid()));
create policy action_dismissals_insert on public.action_dismissals for insert to authenticated with check (user_id = (select auth.uid()));
create policy action_dismissals_update on public.action_dismissals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy action_dismissals_delete on public.action_dismissals for delete to authenticated using (user_id = (select auth.uid()));

alter table public.copilot_messages enable row level security;
create policy copilot_messages_select on public.copilot_messages for select to authenticated using (user_id = (select auth.uid()));
create policy copilot_messages_insert on public.copilot_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.applications a where a.id = application_id));
create policy copilot_messages_delete on public.copilot_messages for delete to authenticated using (user_id = (select auth.uid()));

alter table public.evidence_items enable row level security;
create policy evidence_items_select on public.evidence_items for select to authenticated using (user_id = (select auth.uid()));
create policy evidence_items_insert on public.evidence_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy evidence_items_update on public.evidence_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy evidence_items_delete on public.evidence_items for delete to authenticated using (user_id = (select auth.uid()));

alter table public.offers enable row level security;
create policy offers_select on public.offers for select to authenticated using (user_id = (select auth.uid()));
create policy offers_insert on public.offers for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.applications a where a.id = application_id));
create policy offers_update on public.offers for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.applications a where a.id = application_id));
create policy offers_delete on public.offers for delete to authenticated using (user_id = (select auth.uid()));

alter table public.career_profiles enable row level security;
create policy career_profiles_select on public.career_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy career_profiles_insert on public.career_profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy career_profiles_update on public.career_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy career_profiles_delete on public.career_profiles for delete to authenticated using (user_id = (select auth.uid()));

alter table public.milestones enable row level security;
create policy milestones_select on public.milestones for select to authenticated using (user_id = (select auth.uid()));
create policy milestones_insert on public.milestones for insert to authenticated with check (user_id = (select auth.uid()));
create policy milestones_update on public.milestones for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy milestones_delete on public.milestones for delete to authenticated using (user_id = (select auth.uid()));

-- Same least-privilege stance as migration 0006 for the new tables.
revoke all on public.interview_prep_items, public.action_dismissals, public.copilot_messages, public.evidence_items,
  public.offers, public.career_profiles, public.milestones from anon;
revoke truncate, references, trigger on public.interview_prep_items, public.action_dismissals, public.copilot_messages,
  public.evidence_items, public.offers, public.career_profiles, public.milestones from authenticated;
