-- Exercises the real API with temporary users and inventory; nothing persists.
begin;
select set_config('glb.test.a',gen_random_uuid()::text,true),set_config('glb.test.b',gen_random_uuid()::text,true),set_config('glb.test.session',gen_random_uuid()::text,true),set_config('glb.test.set','test-'||gen_random_uuid()::text,true),set_config('glb.test.request',gen_random_uuid()::text,true);
insert into auth.users(id,email) select current_setting('glb.test.a')::uuid,'pack-test-a@example.invalid' union all select current_setting('glb.test.b')::uuid,'pack-test-b@example.invalid';
insert into public.glb_profiles(id,user_id) select current_setting('glb.test.a')::uuid,'testa_'||substr(md5(current_setting('glb.test.a')),1,12) union all select current_setting('glb.test.b')::uuid,'testb_'||substr(md5(current_setting('glb.test.b')),1,12);
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('glb.test.session')::uuid,current_setting('glb.test.a')::uuid,now(),now());
insert into public.glb_sets(id,title,season,cards_per_pack) values(current_setting('glb.test.set'),'Transaction-only pack test',2026,5);
insert into public.glb_editions(id,set_id,subject_id,name,variant,quantity,front_image)
 select current_setting('glb.test.set')||'-'||variant,current_setting('glb.test.set'),'test-player','Test player',variant,5,'test.webp' from unnest(array['Base','Refractor','Gold','Black']) v(variant);
insert into glb_private.copies(edition_id,serial) select e.id,n from public.glb_editions e cross join generate_series(1,5) n where e.set_id=current_setting('glb.test.set');
insert into glb_private.credit_ledger(owner_id,reward_key,amount,reason) values(current_setting('glb.test.a')::uuid,'test-credit',100,'Temporary test credits');
update public.glb_sets set release_at=now() where id=current_setting('glb.test.set');
select set_config('request.jwt.claim.sub',current_setting('glb.test.a'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.a'),'role','authenticated','session_id',current_setting('glb.test.session'))::text,true);
set local role authenticated;
do $$ declare pack uuid; opened jsonb; again jsonb;
begin
 pack:=public.glb_buy_pack(current_setting('glb.test.set'),current_setting('glb.test.request')::uuid);
 if pack<>public.glb_buy_pack(current_setting('glb.test.set'),current_setting('glb.test.request')::uuid) then raise exception 'Purchase retry duplicated pack';end if;
 if (public.glb_collection_hub()->>'balance')::integer<>0 then raise exception 'Purchase did not charge exactly once';end if;
 begin
  perform public.glb_buy_pack(current_setting('glb.test.set'),gen_random_uuid());raise exception 'Overspending succeeded';
 exception when raise_exception then if sqlerrm<>'You need 100 credits for this pack' then raise;end if;end;
 opened:=public.glb_open_pack(pack);again:=public.glb_open_pack(pack);
 if jsonb_array_length(opened)<>5 then raise exception 'Wrong card count';end if;
 if opened<>again then raise exception 'Opening retry changed cards';end if;
 if (select count(distinct c->>'copy_id') from jsonb_array_elements(opened)c)<>5 then raise exception 'Repeated physical copy';end if;
 if jsonb_array_length(public.glb_my_album())<>5 then raise exception 'Cards not in collection';end if;
 perform set_config('glb.test.pack',pack::text,true);
 perform set_config('glb.test.copy',opened->0->>'copy_id',true);
 begin perform 1 from glb_private.copies;raise exception 'Hidden inventory exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if (select count(*) from glb_private.credit_ledger where owner_id=current_setting('glb.test.a')::uuid and amount=-100)<>1 then raise exception 'Duplicate credit debit';end if;
 if (select count(*) from glb_private.copies c join public.glb_editions e on e.id=c.edition_id where e.set_id=current_setting('glb.test.set') and c.owner_id is null)<>15 then raise exception 'Wrong inventory balance';end if;
end $$;
update auth.sessions set user_id=current_setting('glb.test.b')::uuid where id=current_setting('glb.test.session')::uuid;
select set_config('request.jwt.claim.sub',current_setting('glb.test.b'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.b'),'role','authenticated','session_id',current_setting('glb.test.session'))::text,true);
set local role authenticated;
do $$ begin
 begin perform public.glb_open_pack(current_setting('glb.test.pack')::uuid);raise exception 'Another account opened pack';exception when raise_exception then if sqlerrm<>'Pack unavailable' then raise;end if;end;
 if jsonb_array_length(public.glb_my_album())<>0 then raise exception 'Another account sees cards';end if;
end $$;
reset role;
rollback;
select 'PASS: one credit charge, purchase retry, five unique copies, opening retry, saved collection, finite inventory, cross-account isolation. All fixtures rolled back.' as test_result;
