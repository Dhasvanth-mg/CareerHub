-- Calendar import: remember which calendar event a task came from, so importing the same file twice
-- doesn't create duplicates. NULLs (tasks made by hand) never collide.
alter table public.tasks add column if not exists source_uid text
  check (source_uid is null or char_length(source_uid) between 1 and 300);

create unique index if not exists tasks_user_source_uid_key on public.tasks (user_id, source_uid);
