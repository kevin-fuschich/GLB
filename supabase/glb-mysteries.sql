create table glb_private.mystery_rounds (
  round_no integer primary key, opens_at timestamptz
);
insert into glb_private.mystery_rounds values (1,now()), (2,null);
create table glb_private.mystery_slots (
  id text primary key, round_no integer not null references glb_private.mystery_rounds,
  team_slug text not null, team_name text not null, type text not null, prompt text not null
);
insert into glb_private.mystery_slots
select 'MYS-'||r||'-'||slug||'-player', r,slug,club,'player',
  'Give your player a name, position, look and playing style. Tell us their story and describe the photograph on their FIELDSTOCK card.'
from (values ('albuquerque-aeros','Albuquerque Aeros'),('birmingham-vulcans','Birmingham Vulcans'),('triangle-gold','Triangle Gold'),('fresno-yield','Fresno Yield'),('louisville-naturals','Louisville Naturals'),('mayaguez-sultans','Mayagüez Sultans'),('monterrey-cementeros','Monterrey Cementeros'),('osaka-spirits','Osaka Spirits'),('san-pedro-cocolos','San Pedro Cocolos'),('santiago-caballeros','Santiago Caballeros'),('spokane-alloys','Spokane Alloys'),('st-paul-frost','St. Paul Frost'),('taipei-neon','Taipei Neon'),('tijuana-tecnicos','Tijuana Técnicos'),('toledo-assembly','Toledo Assembly'),('vancouver-current','Vancouver Current')) teams(slug,club)
cross join generate_series(1,2) r;
insert into glb_private.mystery_slots
select 'MYS-1-'||s.team_slug||'-'||x.type,1,s.team_slug,s.team_name,x.type,x.prompt
from (values ('vancouver-current','donk','The WAP MOP SHOPPE Nova has company. Who drives the second car, and what is under the cover?'),('louisville-naturals','mascot','Sprig has the grandstand covered. Who works the berm, and what do fans know them for?'),('spokane-alloys','sponsor','An outfield sign at OGWA Stadium is blank. Who buys it, what do they sell, and what goes on the sign?'),('taipei-neon','tradition','Benny Lo steps away from the mic. What does one section start doing that catches on around the park?'),('mayaguez-sultans','giveaway','Magixo has a giveaway for the first 2,000 fans. What is it, and why do fans keep bringing it back?')) x(slug,type,prompt)
join glb_private.mystery_slots s on s.team_slug=x.slug and s.round_no=1 and s.type='player';

create function public.glb_mysteries() returns table(id text,round_no integer,team_slug text,team_name text,type text,prompt text,state text,creator text,creation_name text)
language sql stable security definer set search_path='' as $$
select s.id,s.round_no,s.team_slug,s.team_name,s.type,s.prompt,
case when c.artifact_id is not null then 'revealed'
when r.opens_at is null or now()<r.opens_at then 'upcoming'
when exists(select 1 from public.glb_submissions q where q.artifact_id=s.id and q.kind='claim' and q.status='pending') then 'pending'
when now()<r.opens_at+interval '7 days' then 'newcomers' else 'open' end,
c.user_id,c.artifact_name
from glb_private.mystery_slots s join glb_private.mystery_rounds r using(round_no)
left join public.glb_claims c on c.artifact_id=s.id order by s.team_name,s.round_no,s.type;
$$;
revoke all on function public.glb_mysteries() from public;
grant execute on function public.glb_mysteries() to anon,authenticated;

create unique index glb_mystery_pending_owner on public.glb_submissions(owner_id)
where artifact_id like 'MYS-%' and kind='claim' and status='pending';
create unique index glb_mystery_pending_slot on public.glb_submissions(artifact_id)
where artifact_id like 'MYS-%' and kind='claim' and status='pending';
create unique index glb_mystery_owner_round on public.glb_submissions(owner_id,split_part(artifact_id,'-',2))
where artifact_id like 'MYS-%' and kind='claim' and status in ('pending','approved');

create function glb_private.check_mystery() returns trigger language plpgsql security definer set search_path='' as $$
declare slot glb_private.mystery_slots; opens timestamptz;
begin
  select * into strict slot from glb_private.mystery_slots where id=new.artifact_id;
  select opens_at into opens from glb_private.mystery_rounds where round_no=slot.round_no;
  if opens is null or now()<opens then raise exception 'Mystery round has not opened.'; end if;
  if now()<opens+interval '7 days' and exists(select 1 from public.glb_submissions where owner_id=new.owner_id and artifact_id like 'MYS-%' and kind='claim' and status='approved') then
    raise exception 'Mystery openings are reserved for first-time creators for the first seven days.';
  end if;
  new.club_slug:=slot.team_slug;
  new.artifact_type:=slot.type;
  return new;
end;
$$;
create trigger glb_check_mystery before insert on public.glb_submissions for each row
when (new.kind='claim' and new.artifact_id like 'MYS-%') execute function glb_private.check_mystery();

create function public.glb_withdraw_mystery(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.glb_submissions where id=p_id and owner_id=auth.uid() and kind='claim' and artifact_id like 'MYS-%' and status='pending';
  if not found then raise exception 'This mystery is no longer pending.'; end if;
end;
$$;
revoke all on function public.glb_withdraw_mystery(uuid) from public;
grant execute on function public.glb_withdraw_mystery(uuid) to authenticated;
