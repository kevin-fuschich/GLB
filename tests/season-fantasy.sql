-- Transaction-only users, entries and season fixtures. Nothing survives rollback.
begin;
select set_config('glb.test.sa',gen_random_uuid()::text,true),set_config('glb.test.sb',gen_random_uuid()::text,true),set_config('glb.test.ss',gen_random_uuid()::text,true),set_config('glb.test.sy',(extract(year from now())::integer+2)::text,true);
insert into auth.users(id,email)values(current_setting('glb.test.sa')::uuid,'season-a@example.invalid'),(current_setting('glb.test.sb')::uuid,'season-b@example.invalid');
insert into public.glb_profiles(id,user_id)values(current_setting('glb.test.sa')::uuid,'sa_'||substr(md5(current_setting('glb.test.sa')),1,12)),(current_setting('glb.test.sb')::uuid,'sb_'||substr(md5(current_setting('glb.test.sb')),1,12));
insert into auth.sessions(id,user_id,created_at,updated_at)values(current_setting('glb.test.ss')::uuid,current_setting('glb.test.sa')::uuid,now(),now());
insert into glb_private.board_members(user_id)values(current_setting('glb.test.sa')::uuid);
select set_config('request.jwt.claim.sub',current_setting('glb.test.sa'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.sa'),'session_id',current_setting('glb.test.ss'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare sid text;v jsonb;begin
 sid:=public.glb_season_fantasy_publish(current_setting('glb.test.sy')::integer,'Rollback season','[{"id":"p1","name":"P1","role":"pitcher"},{"id":"p2","name":"P2","role":"pitcher"},{"id":"b1","name":"B1","role":"batter"},{"id":"b2","name":"B2","role":"batter"}]',jsonb_build_array(jsonb_build_object('id','g1','date',current_setting('glb.test.sy')||'-04-01'),jsonb_build_object('id','g2','date',current_setting('glb.test.sy')||'-09-01')));perform set_config('glb.test.sc',sid,true);
 perform public.glb_season_fantasy_enter(sid,array['p1','b1']);perform public.glb_season_fantasy_enter(sid,array['p1','b1']);v:=public.glb_season_fantasy_view(sid);
 if jsonb_array_length(v->'leaderboard')<>1 or jsonb_array_length(v->'my_lineup')<>2 then raise exception 'Entry missing or duplicated';end if;
 begin perform public.glb_season_fantasy_enter(sid,array['p1','p2']);raise exception 'Two pitchers accepted';exception when raise_exception then if sqlerrm<>'Pick one pitcher and one batter'then raise;end if;end;
 begin perform public.glb_season_fantasy_enter(sid,array['b1','b2']);raise exception 'Two batters accepted';exception when raise_exception then if sqlerrm<>'Pick one pitcher and one batter'then raise;end if;end;
 begin perform public.glb_season_fantasy_enter(sid,array['p1','p1']);raise exception 'Duplicate picks accepted';exception when raise_exception then if sqlerrm<>'Pick two different players'then raise;end if;end;
 begin perform 1 from glb_private.season_fantasy_entries;raise exception 'Private table exposed';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role anon;
do $$declare v jsonb;begin
 v:=public.glb_season_fantasy_view(current_setting('glb.test.sc'));if v->'my_lineup'<>'null'::jsonb or v->'leaderboard'->0->'lineup'<>'null'::jsonb or v->'leaderboard'->0->'player_points'<>'null'::jsonb then raise exception 'Picks leaked before Opening Day';end if;
 if v::text like '%@example.invalid%'or v::text like '%'||current_setting('glb.test.sa')||'%'then raise exception 'Private identity exposed';end if;
 if not exists(select 1 from jsonb_array_elements(public.glb_season_fantasy_catalog())x where x->>'id'=current_setting('glb.test.sc'))then raise exception 'Season catalog unavailable';end if;
end$$;
reset role;
update auth.sessions set user_id=current_setting('glb.test.sb')::uuid where id=current_setting('glb.test.ss')::uuid;
select set_config('request.jwt.claim.sub',current_setting('glb.test.sb'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.sb'),'session_id',current_setting('glb.test.ss'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare v jsonb;begin v:=public.glb_season_fantasy_view(current_setting('glb.test.sc'));if v->'my_lineup'<>'null'::jsonb then raise exception 'Another owner entry appeared as mine';end if;perform public.glb_season_fantasy_enter(current_setting('glb.test.sc'),array['p2','b2']);v:=public.glb_season_fantasy_view(current_setting('glb.test.sc'));if v->'my_lineup'<>'["p2","b2"]'::jsonb then raise exception 'Own entry not returned';end if;perform public.glb_season_fantasy_enter(current_setting('glb.test.sc'),array['p1','b1']);end$$;
do $$begin
 begin perform public.glb_season_fantasy_settle(current_setting('glb.test.sc'));raise exception 'Nonboard confirmed season';exception when raise_exception then if sqlerrm<>'Board access required'then raise;end if;end;
end$$;
reset role;
update glb_private.season_fantasy_competitions set opens_at=now()-interval'3 days',lock_at=now()-interval'2 days',ends_at=now()+interval'1 day',games='[{"id":"g1","date":"2026-01-05"},{"id":"g2","date":"2026-01-06"}]'where id=current_setting('glb.test.sc');
set local role authenticated;
do $$begin
 begin perform public.glb_season_fantasy_enter(current_setting('glb.test.sc'),array['p2','b2']);raise exception 'Late swap accepted';exception when raise_exception then if sqlerrm<>'Season entries are closed'then raise;end if;end;
end$$;
reset role;
update auth.sessions set user_id=current_setting('glb.test.sa')::uuid where id=current_setting('glb.test.ss')::uuid;
select set_config('request.jwt.claim.sub',current_setting('glb.test.sa'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.sa'),'session_id',current_setting('glb.test.ss'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare v jsonb;r jsonb:='[{"id":"g1","status":"final","source":"data/games/2026-01-05/a@b.json","players":[{"id":"p1","line":{"IP_outs":6,"K":2,"ER":1,"W":1}},{"id":"b1","line":{"H":2,"HR":1,"R":1,"RBI":2,"BB":1}}]}]';begin
 perform public.glb_season_fantasy_import(current_setting('glb.test.sc'),r);perform public.glb_season_fantasy_import(current_setting('glb.test.sc'),r);v:=public.glb_season_fantasy_view(current_setting('glb.test.sc'));if(v->'leaderboard'->0->>'points')::integer<>20 or(v->>'games_recorded')::integer<>1 then raise exception 'Game retry doubled points';end if;
 begin perform public.glb_season_fantasy_settle(current_setting('glb.test.sc'));raise exception 'Early season confirmation accepted';exception when raise_exception then if sqlerrm<>'The regular season is still running'then raise;end if;end;
end$$;
reset role;
update glb_private.season_fantasy_competitions set ends_at=now()-interval'1 hour'where id=current_setting('glb.test.sc');
set local role authenticated;
do $$declare v jsonb;begin
 begin perform public.glb_season_fantasy_settle(current_setting('glb.test.sc'));raise exception 'Incomplete season confirmed';exception when raise_exception then if sqlerrm<>'Record every included game before confirming the season'then raise;end if;end;
 perform public.glb_season_fantasy_import(current_setting('glb.test.sc'),'[{"id":"g2","status":"final","source":"data/games/2026-01-06/a@b.json","players":[{"id":"p1","line":{"IP_outs":3,"K":1,"ER":4}},{"id":"b1","line":{"H":1,"SB":1}}]}]');
 v:=public.glb_season_fantasy_view(current_setting('glb.test.sc'));if(v->'leaderboard'->0->>'points')::integer<>19 or(v->'leaderboard'->0->'player_points'->>'p1')::integer<>7 or(v->'leaderboard'->0->'player_points'->>'b1')::integer<>12 then raise exception 'Season totals or player breakdown incorrect';end if;
 perform public.glb_season_fantasy_import(current_setting('glb.test.sc'),'[{"id":"g1","status":"final","source":"data/games/2026-01-05/a@b.json","players":[{"id":"p1","line":{"IP_outs":6,"K":3,"ER":1,"W":1}},{"id":"b1","line":{"H":2,"HR":1,"R":1,"RBI":2,"BB":1}}]}]');
 v:=public.glb_season_fantasy_view(current_setting('glb.test.sc'));if(v->'leaderboard'->0->>'points')::integer<>20 then raise exception 'Correction did not replace old score';end if;
 if public.glb_season_fantasy_settle(current_setting('glb.test.sc'))<>2 or public.glb_season_fantasy_settle(current_setting('glb.test.sc'))<>2 then raise exception 'Ties or repeat finalization failed';end if;
 v:=public.glb_season_fantasy_view(current_setting('glb.test.sc'));if(v->'leaderboard'->0->>'winner')::boolean is not true then raise exception 'Winner missing';end if;
 begin perform public.glb_season_fantasy_import(current_setting('glb.test.sc'),'[]');raise exception 'Final season changed';exception when raise_exception then if sqlerrm<>'This season cannot accept results'then raise;end if;end;
end$$;
reset role;
do $$begin if exists(select 1 from public.glb_packs where owner_id in(current_setting('glb.test.sa')::uuid,current_setting('glb.test.sb')::uuid))then raise exception 'Unapproved season pack prize issued';end if;end$$;
rollback;
select 'PASS: one pitcher and batter, own-entry isolation, Opening Day locks, private picks, cumulative server scoring, corrected results, player breakdowns, tied season winners and final-result freeze. Fixtures rolled back.'as result;
