-- Run in your project's SQL Editor after signing in as kusama.
begin;
create or replace function public.glb_is_board() returns boolean
language sql stable security definer set search_path='' as $$ select glb_private.is_board(); $$;
revoke all on function public.glb_is_board() from public;
grant execute on function public.glb_is_board() to authenticated;
insert into glb_private.board_members(user_id)
select id from public.glb_profiles where user_id='kusama'
on conflict do nothing;
commit;
select p.user_id from public.glb_profiles p join glb_private.board_members b on b.user_id=p.id;
