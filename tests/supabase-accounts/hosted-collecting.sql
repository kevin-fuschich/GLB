-- Transaction-isolated integration test. No test users, sets, copies or ownership survive.
begin;
select set_config('glb.test.a',gen_random_uuid()::text,true),set_config('glb.test.b',gen_random_uuid()::text,true),set_config('glb.test.session',gen_random_uuid()::text,true),set_config('glb.test.set','test-'||gen_random_uuid()::text,true);
insert into auth.users(id,email) select current_setting('glb.test.a')::uuid,'collecting-test-a@example.invalid' union all select current_setting('glb.test.b')::uuid,'collecting-test-b@example.invalid';
insert into public.glb_profiles(id,user_id) select current_setting('glb.test.a')::uuid,'testa_'||substr(md5(current_setting('glb.test.a')),1,12) union all select current_setting('glb.test.b')::uuid,'testb_'||substr(md5(current_setting('glb.test.b')),1,12);
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('glb.test.session')::uuid,current_setting('glb.test.a')::uuid,now(),now());
insert into public.glb_sets(id,title,season,cards_per_pack) values(current_setting('glb.test.set'),'Transaction-only test set',1999,2);
insert into public.glb_editions(id,set_id,subject_id,name,variant,quantity,front_image) values(current_setting('glb.test.set')||'-base',current_setting('glb.test.set'),'unknown-historical-player','Historical test subject','Base',4,'test.webp');
insert into glb_private.copies(edition_id,serial) select current_setting('glb.test.set')||'-base',generate_series(1,4);
update public.glb_sets set release_at=now() where id=current_setting('glb.test.set');
select set_config('request.jwt.claim.sub',current_setting('glb.test.a'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.a'),'role','authenticated','session_id',current_setting('glb.test.session'))::text,true);
set local role authenticated;
select public.glb_collect_visit();select public.glb_collect_visit();
do $$ declare pack uuid; opened jsonb; secret text; tid uuid; recipient text;
begin
 if (select count(*) from public.glb_packs)<>1 then raise exception 'Repeated visit duplicated reward'; end if;
 select id into pack from public.glb_packs;
 opened:=public.glb_open_pack(pack);
 if jsonb_array_length(opened)<>2 then raise exception 'Wrong pack size'; end if;
 if opened<>public.glb_open_pack(pack) then raise exception 'Pack replay changed contents'; end if;
 if opened->0->>'copy_id'=opened->1->>'copy_id' then raise exception 'Duplicate physical copy'; end if;
 perform set_config('glb.test.pack',pack::text,true);
 perform set_config('glb.test.copy',opened->0->>'copy_id',true);
 secret:=public.glb_card_secret((opened->0->>'copy_id')::uuid);
 if secret !~ '^[0-9]{16}$' then raise exception 'Invalid code format'; end if;
 perform set_config('glb.test.secret',secret,true);
 begin
  perform 1 from glb_private.copies;
  raise exception 'Private inventory exposed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('glb.test.recipient',(select user_id from public.glb_profiles where id=current_setting('glb.test.b')::uuid),true);
set local role authenticated;
select set_config('glb.test.transfer',public.glb_request_transfer(current_setting('glb.test.copy')::uuid,current_setting('glb.test.recipient'),current_setting('glb.test.secret'))::text,true);
reset role;
update auth.sessions set user_id=current_setting('glb.test.b')::uuid where id=current_setting('glb.test.session')::uuid;
select set_config('request.jwt.claim.sub',current_setting('glb.test.b'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.b'),'role','authenticated','session_id',current_setting('glb.test.session'))::text,true);
set local role authenticated;
do $$ begin
 if public.glb_card_secret(current_setting('glb.test.copy')::uuid) is not null then raise exception 'Non-owner read secret'; end if;
 begin perform public.glb_open_pack(current_setting('glb.test.pack')::uuid);raise exception 'Non-owner opened pack';exception when raise_exception then if sqlerrm<>'Pack unavailable' then raise;end if;end;
 if not public.glb_accept_transfer(current_setting('glb.test.transfer')::uuid) then raise exception 'Transfer failed';end if;
 if public.glb_card_secret(current_setting('glb.test.copy')::uuid)=current_setting('glb.test.secret') then raise exception 'Code did not rotate';end if;
 if public.glb_accept_transfer(current_setting('glb.test.transfer')::uuid) then raise exception 'Transfer replay succeeded';end if;
 if jsonb_array_length(public.glb_my_album())<>1 then raise exception 'Recipient album incorrect';end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from glb_private.copies c join public.glb_editions e on e.id=c.edition_id where e.set_id=current_setting('glb.test.set') and c.opened_at is not null)<>2 then raise exception 'Discovery count changed after transfer';end if;
 if (select count(*) from glb_private.ownership_history h join glb_private.copies c on c.id=h.copy_id join public.glb_editions e on e.id=c.edition_id where e.set_id=current_setting('glb.test.set'))<>3 then raise exception 'Ownership history incorrect';end if;
end $$;
rollback;
select 'PASS: finite pack opening, duplicate-safe retries, private ownership, receiver acceptance, code rotation, discovery conservation; all test rows rolled back.' as test_result;
