-- A harmless function for uptime checks. Signed-out visitors have no table access (see migration 0006),
-- so the health endpoint proves the database is reachable by calling this instead of reading a table.
create or replace function public.health_check()
returns boolean
language sql
stable
set search_path = ''
as $$ select true $$;

revoke all on function public.health_check() from public;
grant execute on function public.health_check() to anon, authenticated;
