-- The Night Shift: private, replay-only fantasy leagues. No prizes or collecting credits.
begin;
create table public.glb_fantasy_rounds(
 id text primary key, title text not null, game_date date not null,
 mode text not null default 'replay' check(mode='replay'),
 budget integer not null default 100 check(budget>0),
 max_per_club integer not null default 2 check(max_per_club between 1 and 5),
 pool jsonb not null check(jsonb_typeof(pool)='array' and jsonb_array_length(pool) between 5 and 500)
);
alter table public.glb_fantasy_rounds enable row level security;
revoke all on public.glb_fantasy_rounds from public,anon,authenticated;
grant select on public.glb_fantasy_rounds to anon,authenticated;
create policy fantasy_rounds_read on public.glb_fantasy_rounds for select to anon,authenticated using(true);
create table glb_private.fantasy_leagues(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),title text not null check(char_length(title) between 3 and 60),invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),created_at timestamptz not null default now());
create table glb_private.fantasy_members(league_id uuid not null references glb_private.fantasy_leagues(id) on delete cascade,user_id uuid not null references public.glb_profiles(id),joined_at timestamptz not null default now(),primary key(league_id,user_id));
create table glb_private.fantasy_entries(league_id uuid not null,round_id text not null references public.glb_fantasy_rounds(id),user_id uuid not null,lineup text[] not null check(cardinality(lineup)=5),points integer not null,updated_at timestamptz not null default now(),primary key(league_id,round_id,user_id),foreign key(league_id,user_id) references glb_private.fantasy_members(league_id,user_id) on delete cascade);
create table glb_private.fantasy_join_attempts(user_id uuid not null references auth.users(id),created_at timestamptz not null default now());
create index fantasy_league_owner on glb_private.fantasy_leagues(owner_id);
create index fantasy_member_user on glb_private.fantasy_members(user_id);
create index fantasy_entry_user on glb_private.fantasy_entries(user_id);
create index fantasy_join_user_time on glb_private.fantasy_join_attempts(user_id,created_at);
alter table glb_private.fantasy_leagues enable row level security;
alter table glb_private.fantasy_members enable row level security;
alter table glb_private.fantasy_entries enable row level security;
alter table glb_private.fantasy_join_attempts enable row level security;
revoke all on glb_private.fantasy_leagues,glb_private.fantasy_members,glb_private.fantasy_entries,glb_private.fantasy_join_attempts from public,anon,authenticated;
create function glb_private.fantasy_create(p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform glb_private.require_session();
 if char_length(trim(coalesce(p_name,''))) not between 3 and 60 then raise exception 'Use a league name between 3 and 60 characters';end if;
 if not exists(select 1 from public.glb_profiles where id=auth.uid()) then raise exception 'Choose your User ID on the account page first';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,7));
 if (select count(*) from glb_private.fantasy_leagues where owner_id=auth.uid())>=5 then raise exception 'You can create up to five leagues';end if;
 insert into glb_private.fantasy_leagues(owner_id,title) values(auth.uid(),trim(p_name)) returning id into result;
 insert into glb_private.fantasy_members(league_id,user_id) values(result,auth.uid());return result;
end;$$;
create function glb_private.fantasy_join(p_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare league uuid;
begin
 perform glb_private.require_session();
 if not exists(select 1 from public.glb_profiles where id=auth.uid()) then raise exception 'Choose your User ID on the account page first';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,7));
 if (select count(*) from glb_private.fantasy_join_attempts where user_id=auth.uid() and created_at>now()-interval '10 minutes')>=10 then return null;end if;
 insert into glb_private.fantasy_join_attempts(user_id) values(auth.uid());
 select id into league from glb_private.fantasy_leagues where invite_code=upper(trim(p_code));
 if league is null then return null;end if;
 insert into glb_private.fantasy_members(league_id,user_id) values(league,auth.uid()) on conflict do nothing;return league;
end;$$;
create function glb_private.fantasy_home() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform glb_private.require_session();
 return (select coalesce(jsonb_agg(x),'[]') from (select jsonb_build_object('id',l.id,'title',l.title,'members',(select count(*) from glb_private.fantasy_members x where x.league_id=l.id)) x from glb_private.fantasy_members m join glb_private.fantasy_leagues l on l.id=m.league_id where m.user_id=auth.uid() order by m.joined_at desc limit 30) t);
end;$$;
create function glb_private.fantasy_league(p_league uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform glb_private.require_session();
 if not exists(select 1 from glb_private.fantasy_members where league_id=p_league and user_id=auth.uid()) then raise exception 'Join this league before opening its room';end if;
 return(select jsonb_build_object('id',l.id,'title',l.title,'invite_code',l.invite_code,
 'leaderboard',(select coalesce(jsonb_agg(x),'[]')from(select jsonb_build_object('user_id',p.user_id,'points',coalesce(sum(e.points),0),'rounds',count(e.round_id)) x from glb_private.fantasy_members m join public.glb_profiles p on p.id=m.user_id left join glb_private.fantasy_entries e on e.league_id=m.league_id and e.user_id=m.user_id where m.league_id=l.id group by p.user_id order by coalesce(sum(e.points),0) desc,p.user_id)q),
 'my_entries',(select coalesce(jsonb_agg(jsonb_build_object('round_id',e.round_id,'lineup',e.lineup,'points',e.points)),'[]')from glb_private.fantasy_entries e where e.league_id=l.id and e.user_id=auth.uid()))from glb_private.fantasy_leagues l where l.id=p_league);
end;$$;
create function glb_private.fantasy_save(p_league uuid,p_round text,p_players text[]) returns integer language plpgsql security definer set search_path='' as $$
declare round public.glb_fantasy_rounds;cost integer;pitchers integer;total integer;matched integer;
begin
 perform glb_private.require_session();
 if not exists(select 1 from glb_private.fantasy_members where league_id=p_league and user_id=auth.uid()) then raise exception 'Join this league before entering a lineup';end if;
 if p_players is null or cardinality(p_players)<>5 or (select count(distinct x)from unnest(p_players)x)<>5 then raise exception 'Choose five different players';end if;
 select * into round from public.glb_fantasy_rounds where id=p_round;
 if not found then raise exception 'This replay round is unavailable';end if;
 select count(*),sum((p->>'cost')::integer),count(*)filter(where p->>'role'='pitcher'),sum((p->>'points')::integer) into matched,cost,pitchers,total from jsonb_array_elements(round.pool)p where p->>'id'=any(p_players);
 if matched<>5 then raise exception 'Choose players from this round';end if;
 if pitchers<>1 then raise exception 'Choose one pitcher and four hitters';end if;
 if cost>round.budget then raise exception 'Your lineup exceeds the draft budget';end if;
 if exists(select 1 from jsonb_array_elements(round.pool)p where p->>'id'=any(p_players) group by p->>'team_slug' having count(*)>round.max_per_club) then raise exception 'Choose no more than two players from one club';end if;
 insert into glb_private.fantasy_entries(league_id,round_id,user_id,lineup,points) values(p_league,p_round,auth.uid(),p_players,total) on conflict(league_id,round_id,user_id) do update set lineup=excluded.lineup,points=excluded.points,updated_at=now();
 return total;
end;$$;
create function public.glb_fantasy_create(p_name text) returns uuid language sql security invoker set search_path='' as $$select glb_private.fantasy_create(p_name);$$;
create function public.glb_fantasy_join(p_code text) returns uuid language sql security invoker set search_path='' as $$select glb_private.fantasy_join(p_code);$$;
create function public.glb_fantasy_home() returns jsonb language sql stable security invoker set search_path='' as $$select glb_private.fantasy_home();$$;
create function public.glb_fantasy_league(p_league uuid) returns jsonb language sql stable security invoker set search_path='' as $$select glb_private.fantasy_league(p_league);$$;
create function public.glb_fantasy_save(p_league uuid,p_round text,p_players text[]) returns integer language sql security invoker set search_path='' as $$select glb_private.fantasy_save(p_league,p_round,p_players);$$;
revoke all on function glb_private.fantasy_create(text),glb_private.fantasy_join(text),glb_private.fantasy_home(),glb_private.fantasy_league(uuid),glb_private.fantasy_save(uuid,text,text[]),public.glb_fantasy_create(text),public.glb_fantasy_join(text),public.glb_fantasy_home(),public.glb_fantasy_league(uuid),public.glb_fantasy_save(uuid,text,text[]) from public,anon,authenticated;
grant execute on function glb_private.fantasy_create(text),glb_private.fantasy_join(text),glb_private.fantasy_home(),glb_private.fantasy_league(uuid),glb_private.fantasy_save(uuid,text,text[]),public.glb_fantasy_create(text),public.glb_fantasy_join(text),public.glb_fantasy_home(),public.glb_fantasy_league(uuid),public.glb_fantasy_save(uuid,text,text[]) to authenticated;
commit;
