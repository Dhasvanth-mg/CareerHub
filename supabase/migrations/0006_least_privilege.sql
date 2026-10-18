-- Least privilege. Supabase grants every table privilege to anon and authenticated by default and relies
-- on row level security. Keep RLS, but also remove what the app never needs, so a policy mistake or a
-- bypass (TRUNCATE ignores RLS) has less to work with.

-- Signed-out visitors never read or write tables. They only call rate_limit_hit().
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Signed-in users get plain row access, governed by the policies, and nothing else.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Same defaults for tables created later by migrations.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- Trigger functions run as part of the trigger; nobody needs to call them directly.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
