begin;
create table glb_private.weekly_tournaments(
 id text primary key check(id ~ '^weekly-[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
 week_start date not null unique check(extract(isodow from week_start)=1),
 title text not null check(char_length(title) between 3 and 80),
 opens_at timestamptz not null default now(), lock_at timestamptz not null, ends_at timestamptz not null,
 pool jsonb not null check(jsonb_typeof(pool)='array' and jsonb_array_length(pool) between 4 and 500),
 games jsonb not null check(jsonb_typeof(games)='array' and jsonb_array_length(games) between 1 and 200),
 settled_at timestamptz, updated_at timestamptz not null default now(),
 check(opens_at<lock_at and lock_at<ends_at)
);
create table glb_private.weekly_entries(
 tournament_id text not null references glb_private.weekly_tournaments(id),owner_id uuid not null references public.glb_profiles(id),
 lineup text[] not null check(cardinality(lineup)=4),points integer not null default 0,entered_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(tournament_id,owner_id)
);
create table glb_private.weekly_results(
 tournament_id text not null references glb_private.weekly_tournaments(id),game_id text not null,points jsonb not null,source text not null,recorded_at timestamptz not null default now(),primary key(tournament_id,game_id)
);
create table glb_private.weekly_rewards(
 tournament_id text not null,owner_id uuid not null,pack_id uuid references public.glb_packs(id),won_at timestamptz not null default now(),
 primary key(tournament_id,owner_id),foreign key(tournament_id,owner_id) references glb_private.weekly_entries(tournament_id,owner_id)
);
alter table glb_private.weekly_tournaments enable row level security;
alter table glb_private.weekly_entries enable row level security;
alter table glb_private.weekly_results enable row level security;
alter table glb_private.weekly_rewards enable row level security;
revoke all on glb_private.weekly_tournaments,glb_private.weekly_entries,glb_private.weekly_results,glb_private.weekly_rewards from public,anon,authenticated;
create index weekly_owner on glb_private.weekly_entries(owner_id);

create function glb_private.weekly_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'title',w.title,'week_start',w.week_start,'lock_at',w.lock_at,'ends_at',w.ends_at,'settled_at',w.settled_at,
 'winners',case when w.settled_at is not null then (select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'points',e.points)order by p.user_id),'[]')from glb_private.weekly_rewards r join glb_private.weekly_entries e on e.tournament_id=r.tournament_id and e.owner_id=r.owner_id join public.glb_profiles p on p.id=r.owner_id where r.tournament_id=w.id)else '[]'::jsonb end)order by w.week_start desc),'[]')from glb_private.weekly_tournaments w where w.opens_at<=now();
$$;
create function glb_private.weekly_view(p_week text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',w.id,'title',w.title,'week_start',w.week_start,'lock_at',w.lock_at,'ends_at',w.ends_at,'settled_at',w.settled_at,'updated_at',w.updated_at,'server_now',now(),'pool',w.pool,'games',w.games,
 'games_expected',jsonb_array_length(w.games),'games_recorded',(select count(*) from glb_private.weekly_results r where r.tournament_id=w.id),
 'my_lineup',(select to_jsonb(e.lineup) from glb_private.weekly_entries e where e.tournament_id=w.id and e.owner_id=auth.uid()),
 'leaderboard',(select coalesce(jsonb_agg(to_jsonb(x) order by x.rank,x.user_id),'[]') from (
 select rank()over(order by e.points desc) as rank,p.user_id,e.points,case when now()>=w.lock_at then to_jsonb(e.lineup) else null end as lineup,
 exists(select 1 from glb_private.weekly_rewards r where r.tournament_id=w.id and r.owner_id=e.owner_id) as winner,
 exists(select 1 from glb_private.weekly_rewards r where r.tournament_id=w.id and r.owner_id=e.owner_id and r.pack_id is not null) as pack_delivered
 from glb_private.weekly_entries e join public.glb_profiles p on p.id=e.owner_id where e.tournament_id=w.id)x))
 from glb_private.weekly_tournaments w where w.id=p_week and w.opens_at<=now();
$$;
create function glb_private.weekly_enter(p_week text,p_players text[]) returns void language plpgsql security definer set search_path='' as $$
declare w glb_private.weekly_tournaments; n integer;p integer;i integer;o integer;
begin
 perform glb_private.require_session();
 if not exists(select 1 from public.glb_profiles where id=auth.uid())then raise exception 'Choose your User ID on the account page first';end if;
 select * into w from glb_private.weekly_tournaments where id=p_week for update;
 if not found or now()<w.opens_at or now()>=w.lock_at or w.settled_at is not null then raise exception 'Entries for this week are closed';end if;
 if p_players is null or cardinality(p_players)<>4 or (select count(distinct x)from unnest(p_players)x)<>4 then raise exception 'Pick four different players';end if;
 select count(*),count(*)filter(where x->>'role'='pitcher'),count(*)filter(where x->>'role'='infield'),count(*)filter(where x->>'role'='outfield') into n,p,i,o from jsonb_array_elements(w.pool)x where x->>'id'=any(p_players);
 if n<>4 or p<>2 or i<>1 or o<>1 then raise exception 'Pick two pitchers, one infielder and one outfielder';end if;
 insert into glb_private.weekly_entries(tournament_id,owner_id,lineup)values(w.id,auth.uid(),p_players)on conflict(tournament_id,owner_id)do update set lineup=excluded.lineup,updated_at=now();
end;$$;
create function glb_private.weekly_publish(p_week date,p_title text,p_pool jsonb,p_games jsonb) returns text language plpgsql security definer set search_path='' as $$
declare wid text:='weekly-'||p_week::text;start_time timestamptz:=p_week::timestamp at time zone 'America/New_York';
begin
 perform glb_private.require_session();if not glb_private.is_board()then raise exception 'Board access required';end if;
 if extract(isodow from p_week)<>1 or start_time<=now() then raise exception 'Choose a future Monday';end if;
 if jsonb_typeof(p_pool)<>'array' or jsonb_array_length(p_pool)<4 or jsonb_array_length(p_pool)>500 then raise exception 'Invalid player pool';end if;
 if exists(select 1 from jsonb_array_elements(p_pool)x where x->>'id' is null or x->>'role' not in('pitcher','infield','outfield') or x->>'role' is null or x->>'name' is null)or (select count(distinct x->>'id')from jsonb_array_elements(p_pool)x)<>jsonb_array_length(p_pool)then raise exception 'Invalid or repeated player';end if;
 if (select count(*)from jsonb_array_elements(p_pool)x where x->>'role'='pitcher')<2 or not exists(select 1 from jsonb_array_elements(p_pool)x where x->>'role'='infield')or not exists(select 1 from jsonb_array_elements(p_pool)x where x->>'role'='outfield')then raise exception 'Player pool needs all four slots';end if;
 if jsonb_typeof(p_games)<>'array' or jsonb_array_length(p_games)not between 1 and 200 or exists(select 1 from jsonb_array_elements(p_games)g where (g->>'date')::date<p_week or (g->>'date')::date>=p_week+7 or g->>'id' is null or g->>'date' is null) or (select count(distinct g->>'id')from jsonb_array_elements(p_games)g)<>jsonb_array_length(p_games)then raise exception 'Use unique scheduled games from this week';end if;
 insert into glb_private.weekly_tournaments(id,week_start,title,lock_at,ends_at,pool,games)values(wid,p_week,p_title,start_time,(p_week+7)::timestamp at time zone 'America/New_York',p_pool,p_games);return wid;
end;$$;
create function glb_private.weekly_import(p_week text,p_results jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare w glb_private.weekly_tournaments;g jsonb;pl jsonb;line jsonb;role text;pts integer;values_json jsonb;total integer:=0;source text; game_date date;
begin
 perform glb_private.require_session();if not glb_private.is_board()then raise exception 'Board access required';end if;
 select * into w from glb_private.weekly_tournaments where id=p_week for update;
 if not found or now()<w.lock_at or w.settled_at is not null then raise exception 'This week cannot accept results';end if;
 if jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)>200 then raise exception 'Invalid results';end if;
 for g in select * from jsonb_array_elements(p_results)loop
  select (x->>'date')::date into game_date from jsonb_array_elements(w.games)x where x->>'id'=g->>'id';
  if game_date is null or game_date>(now()at time zone 'America/New_York')::date or g->>'status' is distinct from 'final' then raise exception 'Result is not a scheduled completed game';end if;
  source:=g->>'source';if source is null or source !~ '^data/games/[0-9]{4}-[0-9]{2}-[0-9]{2}/[a-z0-9-]+@[a-z0-9-]+\.json$' then raise exception 'Missing official box-score source';end if;
  if jsonb_typeof(g->'players')<>'array' or jsonb_array_length(g->'players')not between 1 and 100 or (select count(distinct x->>'id')from jsonb_array_elements(g->'players')x)<>jsonb_array_length(g->'players')then raise exception 'Invalid game appearances';end if;
  values_json:='{}';
  for pl in select * from jsonb_array_elements(g->'players')loop
   select x->>'role' into role from jsonb_array_elements(w.pool)x where x->>'id'=pl->>'id';
   if role is null then raise exception 'Result contains a player outside this week';end if;line:=pl->'line';
   if jsonb_typeof(line) is distinct from 'object' or exists(select 1 from jsonb_each_text(line)x where x.value !~ '^[0-9]{1,3}$')then raise exception 'Use nonnegative integer box-score counts';end if;
   if role='pitcher'then pts:=coalesce((line->>'IP_outs')::int,0)+coalesce((line->>'K')::int,0)-2*coalesce((line->>'ER')::int,0)+5*coalesce((line->>'W')::int,0)+3*coalesce((line->>'SV')::int,0);
   else pts:=coalesce((line->>'H')::int,0)+coalesce((line->>'2B')::int,0)+2*coalesce((line->>'3B')::int,0)+3*coalesce((line->>'HR')::int,0)+coalesce((line->>'R')::int,0)+coalesce((line->>'RBI')::int,0)+coalesce((line->>'BB')::int,0)+2*coalesce((line->>'SB')::int,0);end if;
   values_json:=values_json||jsonb_build_object(pl->>'id',pts);
  end loop;
  insert into glb_private.weekly_results(tournament_id,game_id,points,source)values(w.id,g->>'id',values_json,source)on conflict(tournament_id,game_id)do update set points=excluded.points,source=excluded.source,recorded_at=now();total:=total+1;
 end loop;
 update glb_private.weekly_entries e set points=coalesce((select sum((r.points->>pid)::int)from glb_private.weekly_results r cross join unnest(e.lineup)pid where r.tournament_id=w.id),0)where e.tournament_id=w.id;
 update glb_private.weekly_tournaments set updated_at=now()where id=w.id;return total;
end;$$;
create function glb_private.weekly_settle(p_week text)returns integer language plpgsql security definer set search_path='' as $$
declare w glb_private.weekly_tournaments; winners integer;
begin
 perform glb_private.require_session();if not glb_private.is_board()then raise exception 'Board access required';end if;
 select * into w from glb_private.weekly_tournaments where id=p_week for update;
 if not found then raise exception 'Unknown tournament';end if;
 if w.settled_at is not null then return (select count(*)from glb_private.weekly_rewards where tournament_id=w.id);end if;
 if now()<w.ends_at then raise exception 'This week is still running';end if;
 if (select count(*)from glb_private.weekly_results where tournament_id=w.id)<>jsonb_array_length(w.games)then raise exception 'Record every scheduled game before awarding packs';end if;
 insert into glb_private.weekly_rewards(tournament_id,owner_id)select w.id,e.owner_id from glb_private.weekly_entries e where e.tournament_id=w.id and e.points=(select max(points)from glb_private.weekly_entries where tournament_id=w.id)on conflict do nothing;
 get diagnostics winners=row_count;
 update glb_private.weekly_tournaments set settled_at=now(),updated_at=now()where id=w.id;return winners;
end;$$;
create function glb_private.weekly_claim(p_week text)returns uuid language plpgsql security definer set search_path='' as $$
declare reward glb_private.weekly_rewards;s public.glb_sets;pid uuid;slots bigint;key text:='weekly-winner:'||p_week;
begin
 perform glb_private.require_session();select * into reward from glb_private.weekly_rewards where tournament_id=p_week and owner_id=auth.uid()for update;
 if not found then raise exception 'No winning pack for this week';end if;if reward.pack_id is not null then return reward.pack_id;end if;
 select * into s from public.glb_sets where release_at<=now()order by release_at desc,id limit 1 for update;
 if not found then return null;end if;
 select count(*) into slots from glb_private.copies c join public.glb_editions e on e.id=c.edition_id where e.set_id=s.id and c.owner_id is null;
 slots:=slots-(select count(*)*s.cards_per_pack from public.glb_packs where set_id=s.id and opened_at is null);
 if slots<s.cards_per_pack then return null;end if;
 insert into public.glb_packs(owner_id,set_id,reward_key,earned_for)values(auth.uid(),s.id,key,'GLB Fantasy weekly winner')on conflict(owner_id,reward_key)do update set earned_for=excluded.earned_for returning id into pid;
 update glb_private.weekly_rewards set pack_id=pid where tournament_id=p_week and owner_id=auth.uid();return pid;
end;$$;

create function public.glb_weekly_catalog()returns jsonb language sql security invoker set search_path='' as $$select glb_private.weekly_catalog();$$;
revoke all on function glb_private.weekly_catalog(),public.glb_weekly_catalog()from public,anon,authenticated;
grant execute on function glb_private.weekly_catalog(),public.glb_weekly_catalog()to anon,authenticated;

create function public.glb_weekly_view(p_week text)returns jsonb language sql security invoker set search_path='' as $$select glb_private.weekly_view(p_week);$$;
revoke all on function glb_private.weekly_view(text),public.glb_weekly_view(text)from public,anon,authenticated;
grant execute on function glb_private.weekly_view(text),public.glb_weekly_view(text)to anon,authenticated;

create function public.glb_weekly_enter(p_week text,p_players text[])returns void language sql security invoker set search_path='' as $$select glb_private.weekly_enter(p_week,p_players);$$;
revoke all on function glb_private.weekly_enter(text,text[]),public.glb_weekly_enter(text,text[])from public,anon,authenticated;
grant execute on function glb_private.weekly_enter(text,text[]),public.glb_weekly_enter(text,text[])to authenticated;

create function public.glb_weekly_publish(p_week date,p_title text,p_pool jsonb,p_games jsonb)returns text language sql security invoker set search_path='' as $$select glb_private.weekly_publish(p_week,p_title,p_pool,p_games);$$;
revoke all on function glb_private.weekly_publish(date,text,jsonb,jsonb),public.glb_weekly_publish(date,text,jsonb,jsonb)from public,anon,authenticated;
grant execute on function glb_private.weekly_publish(date,text,jsonb,jsonb),public.glb_weekly_publish(date,text,jsonb,jsonb)to authenticated;

create function public.glb_weekly_import(p_week text,p_results jsonb)returns integer language sql security invoker set search_path='' as $$select glb_private.weekly_import(p_week,p_results);$$;
revoke all on function glb_private.weekly_import(text,jsonb),public.glb_weekly_import(text,jsonb)from public,anon,authenticated;
grant execute on function glb_private.weekly_import(text,jsonb),public.glb_weekly_import(text,jsonb)to authenticated;

create function public.glb_weekly_settle(p_week text)returns integer language sql security invoker set search_path='' as $$select glb_private.weekly_settle(p_week);$$;
revoke all on function glb_private.weekly_settle(text),public.glb_weekly_settle(text)from public,anon,authenticated;
grant execute on function glb_private.weekly_settle(text),public.glb_weekly_settle(text)to authenticated;

create function public.glb_weekly_claim(p_week text)returns uuid language sql security invoker set search_path='' as $$select glb_private.weekly_claim(p_week);$$;
revoke all on function glb_private.weekly_claim(text),public.glb_weekly_claim(text)from public,anon,authenticated;
grant execute on function glb_private.weekly_claim(text),public.glb_weekly_claim(text)to authenticated;
commit;
