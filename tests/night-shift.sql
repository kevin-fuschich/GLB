begin;
select set_config('glb.test.fa',gen_random_uuid()::text,true),set_config('glb.test.fb',gen_random_uuid()::text,true),set_config('glb.test.fsid',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('glb.test.fa')::uuid,'fantasy-a@example.invalid'),(current_setting('glb.test.fb')::uuid,'fantasy-b@example.invalid');
insert into public.glb_profiles(id,user_id) values(current_setting('glb.test.fa')::uuid,'fantasya_'||substr(md5(current_setting('glb.test.fa')),1,12)),(current_setting('glb.test.fb')::uuid,'fantasyb_'||substr(md5(current_setting('glb.test.fb')),1,12));
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('glb.test.fsid')::uuid,current_setting('glb.test.fa')::uuid,now(),now());
select set_config('request.jwt.claim.sub',current_setting('glb.test.fa'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.fa'),'session_id',current_setting('glb.test.fsid'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare league uuid;points integer;view jsonb;begin
 league:=public.glb_fantasy_create('Transaction-only Night Shift');perform set_config('glb.test.league',league::text,true);
 view:=public.glb_fantasy_league(league);perform set_config('glb.test.invite',view->>'invite_code',true);
 points:=public.glb_fantasy_save(league,'nightshift-2026-04-09',array['louisville-naturals/evan-sutter','fresno-yield/hiroshi-kawabata','louisville-naturals/blake-harrison','spokane-alloys/luis-quinones','mayaguez-sultans/jae-min-seok']);
 if points<>15 then raise exception 'Server fantasy score differs from canonical box scores';end if;
 perform public.glb_fantasy_save(league,'nightshift-2026-04-09',array['louisville-naturals/evan-sutter','fresno-yield/hiroshi-kawabata','louisville-naturals/blake-harrison','spokane-alloys/luis-quinones','mayaguez-sultans/jae-min-seok']);
 view:=public.glb_fantasy_league(league);if jsonb_array_length(view->'my_entries')<>1 then raise exception 'Saving a lineup twice duplicated the entry';end if;
 if (view->'leaderboard'->0->>'points')::integer<>15 then raise exception 'Leaderboard doubled an edited entry';end if;
 begin perform public.glb_fantasy_save(league,'nightshift-2026-04-09',array['unknown','unknown','unknown','unknown','unknown']);raise exception 'Duplicate lineup accepted';exception when raise_exception then if sqlerrm<>'Choose five different players' then raise;end if;end;
 begin perform 1 from glb_private.fantasy_entries;raise exception 'Private fantasy table exposed';exception when insufficient_privilege then null;end;
end$$;
reset role;
update auth.sessions set user_id=current_setting('glb.test.fb')::uuid where id=current_setting('glb.test.fsid')::uuid;
select set_config('request.jwt.claim.sub',current_setting('glb.test.fb'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.fb'),'session_id',current_setting('glb.test.fsid'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare league uuid;view jsonb;begin
 begin perform public.glb_fantasy_league(current_setting('glb.test.league')::uuid);raise exception 'Nonmember read league';exception when raise_exception then if sqlerrm<>'Join this league before opening its room' then raise;end if;end;
 if public.glb_fantasy_join('NOTANINVITE') is not null then raise exception 'Unknown invitation succeeded';end if;
 league:=public.glb_fantasy_join(current_setting('glb.test.invite'));if league<>current_setting('glb.test.league')::uuid then raise exception 'Invitation joined wrong room';end if;
 view:=public.glb_fantasy_league(league);if jsonb_array_length(view->'leaderboard')<>2 then raise exception 'Membership did not appear';end if;
 perform public.glb_fantasy_save(league,'nightshift-2026-04-09',array['louisville-naturals/evan-sutter','fresno-yield/hiroshi-kawabata','louisville-naturals/blake-harrison','spokane-alloys/luis-quinones','mayaguez-sultans/jae-min-seok']);
end$$;
reset role;
do $$begin
 if (select count(*) from glb_private.fantasy_entries where league_id=current_setting('glb.test.league')::uuid)<>2 then raise exception 'Player entries crossed ownership';end if;
 if (select count(*) from glb_private.fantasy_join_attempts where user_id=current_setting('glb.test.fb')::uuid)<>2 then raise exception 'Failed invitation was not rate limited';end if;
end$$;
set local role anon;
do $$begin
 if (select count(*) from public.glb_fantasy_rounds)<>3 then raise exception 'Replay catalog inaccessible';end if;
 begin perform public.glb_fantasy_home();raise exception 'Anonymous league access succeeded';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
select 'PASS: canonical scoring, owner-bound entries, edit idempotency, member-only leagues, invitation joining, failed-attempt counting and anonymous isolation. Test users and rooms rolled back.' as result;
