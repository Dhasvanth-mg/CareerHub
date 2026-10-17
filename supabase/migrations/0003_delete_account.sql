-- Lets a signed-in user delete their own account. Every user-owned table references auth.users
-- with ON DELETE CASCADE, so this removes all of their rows. Storage files must be removed through
-- the Storage API first (deleting storage.objects rows in SQL would orphan the underlying files).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
