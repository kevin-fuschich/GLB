-- Season-long fantasy is independent of weekly teams and weekly pack rewards.
begin;
create table glb_private.season_fantasy_competitions(
 id text primary key check(id ~ '^season-[0-9]{4}$'),season integer not null unique check(season between 2026 and 2200),
 title text not null check(char_length(title) between 3 and 80),opens_at timestamptz not null default now(),
 lock_at timestamptz not null,ends_at timestamptz not null,settled_at timestamptz,updated_at timestamptz not null default now(),
 pool jsonb not null check(jsonb_typeof(pool)='array' and jsonb_array_length(pool)between 2 and 500),
 games jsonb not null check(jsonb_typeof(games)='array' and jsonb_array_length(games)between 1 and 2000),check(opens_at<lock_at and lock_at<ends_at)
);
create table glb_private.season_fantasy_entries(
 competition_id text not null references glb_private.season_fantasy_competitions(id),owner_id uuid not null references public.glb_profiles(id),
 lineup text[] not null check(cardinality(lineup)=2),points integer not null default 0,entered_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(competition_id,owner_id)
);
create table glb_private.season_fantasy_results(
 competition_id text not null references glb_private.season_fantasy_competitions(id),game_id text not null,points jsonb not null,source text not null,recorded_at timestamptz not null default now(),primary key(competition_id,game_id)
);
alter table glb_private.season_fantasy_competitions enable row level security;
alter table glb_private.season_fantasy_entries enable row level security;
alter table glb_private.season_fantasy_results enable row level security;
revoke all on glb_private.season_fantasy_competitions,glb_private.season_fantasy_entries,glb_private.season_fantasy_results from public,anon,authenticated;
create index season_fantasy_owner on glb_private.season_fantasy_entries(owner_id);
create function glb_private.season_fantasy_catalog()returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'season',season,'title',title,'lock_at',lock_at,'ends_at',ends_at,'settled_at',settled_at)order by season desc),'[]')from glb_private.season_fantasy_competitions where opens_at<=now();
$$;
create function glb_private.season_fantasy_view(p_season text)returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',w.id,'season',w.season,'title',w.title,'lock_at',w.lock_at,'ends_at',w.ends_at,'settled_at',w.settled_at,'updated_at',w.updated_at,'server_now',now(),'pool',w.pool,'games',w.games,
 'games_expected',jsonb_array_length(w.games),'games_recorded',(select count(*)from glb_private.season_fantasy_results where competition_id=w.id),
 'my_lineup',(select to_jsonb(lineup)from glb_private.season_fantasy_entries where competition_id=w.id and owner_id=auth.uid()),
 'leaderboard',(select coalesce(jsonb_agg(to_jsonb(x)order by x.rank,x.user_id),'[]')from(
 select rank()over(order by e.points desc)as rank,p.user_id,e.points,case when now()>=w.lock_at then to_jsonb(e.lineup)else null end as lineup,
 case when now()>=w.lock_at then (select jsonb_object_agg(pid,coalesce((select sum((r.points->>pid)::integer)from glb_private.season_fantasy_results r where r.competition_id=w.id),0))from unnest(e.lineup)pid)else null end as player_points,
 w.settled_at is not null and e.points=(select max(points)from glb_private.season_fantasy_entries where competition_id=w.id)as winner
 from glb_private.season_fantasy_entries e join public.glb_profiles p on p.id=e.owner_id where e.competition_id=w.id)x))from glb_private.season_fantasy_competitions w where w.id=p_season and w.opens_at<=now();
$$;
create function glb_private.season_fantasy_enter(p_season text,p_players text[])returns void language plpgsql security definer set search_path='' as $$
declare w glb_private.season_fantasy_competitions;n integer;pitchers integer;batters integer;
begin
 perform glb_private.require_session();if not exists(select 1 from public.glb_profiles where id=auth.uid())then raise exception 'Choose your User ID on the account page first';end if;
 select * into w from glb_private.season_fantasy_competitions where id=p_season for update;
 if not found or now()<w.opens_at or now()>=w.lock_at or w.settled_at is not null then raise exception 'Season entries are closed';end if;
 if p_players is null or cardinality(p_players)<>2 or(select count(distinct x)from unnest(p_players)x)<>2 then raise exception 'Pick two different players';end if;
 select count(*),count(*)filter(where x->>'role'='pitcher'),count(*)filter(where x->>'role'='batter')into n,pitchers,batters from jsonb_array_elements(w.pool)x where x->>'id'=any(p_players);
 if n<>2 or pitchers<>1 or batters<>1 then raise exception 'Pick one pitcher and one batter';end if;
 insert into glb_private.season_fantasy_entries(competition_id,owner_id,lineup)values(w.id,auth.uid(),p_players)on conflict(competition_id,owner_id)do update set lineup=excluded.lineup,updated_at=now();
end;$$;
create function glb_private.season_fantasy_publish(p_year integer,p_title text,p_pool jsonb,p_games jsonb)returns text language plpgsql security definer set search_path='' as $$
declare sid text:='season-'||p_year::text;first_day date;last_day date;
begin
 perform glb_private.require_session();if not glb_private.is_board()then raise exception 'Board access required';end if;
 if p_year is null or p_year not between 2026 and 2200 or jsonb_typeof(p_games)is distinct from 'array' or jsonb_array_length(p_games)not between 1 and 2000 then raise exception 'Use the official regular-season schedule';end if;
 if exists(select 1 from jsonb_array_elements(p_games)g where g->>'id' is null or g->>'date' is null or extract(year from(g->>'date')::date)<>p_year)or(select count(distinct g->>'id')from jsonb_array_elements(p_games)g)<>jsonb_array_length(p_games)then raise exception 'Use unique scheduled games from this year';end if;
 select min((g->>'date')::date),max((g->>'date')::date)into first_day,last_day from jsonb_array_elements(p_games)g;
 if first_day::timestamp at time zone 'America/New_York'<=now()then raise exception 'Publish the season before Opening Day';end if;
 if jsonb_typeof(p_pool)is distinct from 'array' or jsonb_array_length(p_pool)not between 2 and 500 then raise exception 'Invalid season player pool';end if;
 if exists(select 1 from jsonb_array_elements(p_pool)x where x->>'id'is null or x->>'name'is null or x->>'role'is null or x->>'role'not in('pitcher','batter'))or(select count(distinct x->>'id')from jsonb_array_elements(p_pool)x)<>jsonb_array_length(p_pool)then raise exception 'Invalid or repeated player';end if;
 if not exists(select 1 from jsonb_array_elements(p_pool)x where x->>'role'='pitcher')or not exists(select 1 from jsonb_array_elements(p_pool)x where x->>'role'='batter')then raise exception 'Include pitchers and batters';end if;
 insert into glb_private.season_fantasy_competitions(id,season,title,lock_at,ends_at,pool,games)values(sid,p_year,p_title,first_day::timestamp at time zone 'America/New_York',(last_day+1)::timestamp at time zone 'America/New_York',p_pool,p_games);return sid;
end;$$;
create function glb_private.season_fantasy_import(p_season text,p_results jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare w glb_private.season_fantasy_competitions;g jsonb;pl jsonb;line jsonb;role text;pts integer;values_json jsonb;total integer:=0;source text; game_date date;
begin
 perform glb_private.require_session();if not glb_private.is_board()then raise exception 'Board access required';end if;
 select * into w from glb_private.season_fantasy_competitions where id=p_season for update;
 if not found or now()<w.lock_at or w.settled_at is not null then raise exception 'This season cannot accept results';end if;
 if jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)>200 then raise exception 'Invalid results';end if;
 for g in select * from jsonb_array_elements(p_results)loop
  select (x->>'date')::date into game_date from jsonb_array_elements(w.games)x where x->>'id'=g->>'id';
  if game_date is null or game_date>(now()at time zone 'America/New_York')::date or g->>'status' is distinct from 'final' then raise exception 'Result is not a scheduled completed game';end if;
  source:=g->>'source';if source is null or source !~ '^data/games/[0-9]{4}-[0-9]{2}-[0-9]{2}/[a-z0-9-]+@[a-z0-9-]+\.json$' then raise exception 'Missing official box-score source';end if;
  if jsonb_typeof(g->'players')<>'array' or jsonb_array_length(g->'players')not between 1 and 100 or (select count(distinct x->>'id')from jsonb_array_elements(g->'players')x)<>jsonb_array_length(g->'players')then raise exception 'Invalid game appearances';end if;
  values_json:='{}';
  for pl in select * from jsonb_array_elements(g->'players')loop
   select x->>'role' into role from jsonb_array_elements(w.pool)x where x->>'id'=pl->>'id';
   if role is null then raise exception 'Result contains a player outside this season';end if;line:=pl->'line';
   if jsonb_typeof(line) is distinct from 'object' or exists(select 1 from jsonb_each_text(line)x where x.value !~ '^[0-9]{1,3}$')then raise exception 'Use nonnegative integer box-score counts';end if;
   if role='pitcher'then pts:=coalesce((line->>'IP_outs')::int,0)+coalesce((line->>'K')::int,0)-2*coalesce((line->>'ER')::int,0)+5*coalesce((line->>'W')::int,0)+3*coalesce((line->>'SV')::int,0);
   else pts:=coalesce((line->>'H')::int,0)+coalesce((line->>'2B')::int,0)+2*coalesce((line->>'3B')::int,0)+3*coalesce((line->>'HR')::int,0)+coalesce((line->>'R')::int,0)+coalesce((line->>'RBI')::int,0)+coalesce((line->>'BB')::int,0)+2*coalesce((line->>'SB')::int,0);end if;
   values_json:=values_json||jsonb_build_object(pl->>'id',pts);
  end loop;
  insert into glb_private.season_fantasy_results(competition_id,game_id,points,source)values(w.id,g->>'id',values_json,source)on conflict(competition_id,game_id)do update set points=excluded.points,source=excluded.source,recorded_at=now();total:=total+1;
 end loop;
 update glb_private.season_fantasy_entries e set points=coalesce((select sum((r.points->>pid)::int)from glb_private.season_fantasy_results r cross join unnest(e.lineup)pid where r.competition_id=w.id),0)where e.competition_id=w.id;
 update glb_private.season_fantasy_competitions set updated_at=now()where id=w.id;return total;
end;$$;
create function glb_private.season_fantasy_settle(p_season text)returns integer language plpgsql security definer set search_path='' as $$
declare w glb_private.season_fantasy_competitions;winners integer;
begin
 perform glb_private.require_session();if not glb_private.is_board()then raise exception 'Board access required';end if;
 select * into w from glb_private.season_fantasy_competitions where id=p_season for update;
 if not found then raise exception 'Unknown season';end if;
 if w.settled_at is null then
 if now()<w.ends_at then raise exception 'The regular season is still running';end if;
 if(select count(*)from glb_private.season_fantasy_results where competition_id=w.id)<>jsonb_array_length(w.games)then raise exception 'Record every included game before confirming the season';end if;
 update glb_private.season_fantasy_competitions set settled_at=now(),updated_at=now()where id=w.id;
 end if;
 select count(*)into winners from glb_private.season_fantasy_entries e where competition_id=w.id and points=(select max(points)from glb_private.season_fantasy_entries where competition_id=w.id);return winners;
end;$$;
create function public.glb_season_fantasy_catalog()returns jsonb language sql security invoker set search_path='' as $$select glb_private.season_fantasy_catalog();$$;
revoke all on function glb_private.season_fantasy_catalog(),public.glb_season_fantasy_catalog()from public,anon,authenticated;
grant execute on function glb_private.season_fantasy_catalog(),public.glb_season_fantasy_catalog()to anon,authenticated;
create function public.glb_season_fantasy_view(p_season text)returns jsonb language sql security invoker set search_path='' as $$select glb_private.season_fantasy_view(p_season);$$;
revoke all on function glb_private.season_fantasy_view(text),public.glb_season_fantasy_view(text)from public,anon,authenticated;
grant execute on function glb_private.season_fantasy_view(text),public.glb_season_fantasy_view(text)to anon,authenticated;
create function public.glb_season_fantasy_enter(p_season text,p_players text[])returns void language sql security invoker set search_path='' as $$select glb_private.season_fantasy_enter(p_season,p_players);$$;
revoke all on function glb_private.season_fantasy_enter(text,text[]),public.glb_season_fantasy_enter(text,text[])from public,anon,authenticated;
grant execute on function glb_private.season_fantasy_enter(text,text[]),public.glb_season_fantasy_enter(text,text[])to authenticated;
create function public.glb_season_fantasy_publish(p_year integer,p_title text,p_pool jsonb,p_games jsonb)returns text language sql security invoker set search_path='' as $$select glb_private.season_fantasy_publish(p_year,p_title,p_pool,p_games);$$;
revoke all on function glb_private.season_fantasy_publish(integer,text,jsonb,jsonb),public.glb_season_fantasy_publish(integer,text,jsonb,jsonb)from public,anon,authenticated;
grant execute on function glb_private.season_fantasy_publish(integer,text,jsonb,jsonb),public.glb_season_fantasy_publish(integer,text,jsonb,jsonb)to authenticated;
create function public.glb_season_fantasy_import(p_season text,p_results jsonb)returns integer language sql security invoker set search_path='' as $$select glb_private.season_fantasy_import(p_season,p_results);$$;
revoke all on function glb_private.season_fantasy_import(text,jsonb),public.glb_season_fantasy_import(text,jsonb)from public,anon,authenticated;
grant execute on function glb_private.season_fantasy_import(text,jsonb),public.glb_season_fantasy_import(text,jsonb)to authenticated;
create function public.glb_season_fantasy_settle(p_season text)returns integer language sql security invoker set search_path='' as $$select glb_private.season_fantasy_settle(p_season);$$;
revoke all on function glb_private.season_fantasy_settle(text),public.glb_season_fantasy_settle(text)from public,anon,authenticated;
grant execute on function glb_private.season_fantasy_settle(text),public.glb_season_fantasy_settle(text)to authenticated;
commit;
