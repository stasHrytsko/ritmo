-- Lets a signed-in person delete their own account (App Store 5.1.1(v), GDPR).
-- Only ever touches the caller: auth.uid() is the signed-in user's id. The
-- backup row goes first, then the auth user.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  delete from public.user_backups where user_id = me;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
