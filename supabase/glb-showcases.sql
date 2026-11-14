
create table public.glb_showcases (
 owner_id uuid primary key references public.glb_profiles(id) on delete cascade,
 display_name text not null default '' check (char_length(display_name)<=60),
 bio text not null default '' check (char_length(bio)<=500),
 favorite_club text not null default '' check(favorite_club ~ '^[a-z0-9-]{0,60}$'),
 theme text not null default 'navy' check(theme in ('navy','forest','oxblood','sand')),
 avatar text not null default '' check (avatar='' or (char_length(avatar)<=180000 and avatar ~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$')),
 published boolean not null default false,
 featured_copies uuid[] not null default '{}' check(cardinality(featured_copies)<=9),
 featured_claims text[] not null default '{}' check(cardinality(featured_claims)<=9),
 featured_notes uuid[] not null default '{}' check(cardinality(featured_notes)<=9)
);
alter table public.glb_showcases enable row level security;
revoke all on public.glb_showcases from anon,authenticated;
grant select,insert,update on public.glb_showcases to authenticated;
create policy showcase_read on public.glb_showcases for select to authenticated using(owner_id=(select auth.uid()));
create policy showcase_insert on public.glb_showcases for insert to authenticated with check(owner_id=(select auth.uid()));
create policy showcase_update on public.glb_showcases for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create function glb_private.showcase(p_user text,p_preview boolean default false)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'user_id',p.user_id,'display_name',s.display_name,'bio',s.bio,'favorite_club',s.favorite_club,
 'theme',s.theme,'avatar',s.avatar,'published',s.published,
 'cards',(select coalesce(jsonb_agg(jsonb_build_object('name',e.name,'variant',e.variant,'serial',c.serial,'quantity',e.quantity,'front_image',e.front_image) order by array_position(s.featured_copies,c.id)),'[]'::jsonb)
 from glb_private.copies c join public.glb_editions e on e.id=c.edition_id join public.glb_sets st on st.id=e.set_id
 where c.owner_id=s.owner_id and c.id=any(s.featured_copies) and c.opened_at is not null and st.release_at<=now()),
 'claims',(select coalesce(jsonb_agg(jsonb_build_object('artifact_id',c.artifact_id,'artifact_name',c.artifact_name,'body',c.body) order by array_position(s.featured_claims,c.artifact_id)),'[]'::jsonb) from public.glb_claims c where c.owner_id=s.owner_id and c.artifact_id=any(s.featured_claims)),
 'notes',(select coalesce(jsonb_agg(jsonb_build_object('artifact_id',n.artifact_id,'body',n.body) order by array_position(s.featured_notes,n.id)),'[]'::jsonb) from public.glb_notes n where n.contributor_id=s.owner_id and n.id=any(s.featured_notes))
 ) from public.glb_showcases s join public.glb_profiles p on p.id=s.owner_id
 where p.user_id=p_user and (s.published or (p_preview and s.owner_id=(select auth.uid())));
$$;
revoke all on function glb_private.showcase(text,boolean) from public;
grant usage on schema glb_private to anon,authenticated;
grant execute on function glb_private.showcase(text,boolean) to anon,authenticated;
create function public.glb_public_showcase(p_user text,p_preview boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$
 select glb_private.showcase(p_user,p_preview);
$$;
revoke all on function public.glb_public_showcase(text,boolean) from public;
grant execute on function public.glb_public_showcase(text,boolean) to anon,authenticated;
