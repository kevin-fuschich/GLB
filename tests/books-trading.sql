-- Transaction-only fixtures. No users, cards, releases or offers survive this test.
begin;
select set_config('glb.test.a',gen_random_uuid()::text,true),set_config('glb.test.b',gen_random_uuid()::text,true),set_config('glb.test.c',gen_random_uuid()::text,true),set_config('glb.test.sid',gen_random_uuid()::text,true),set_config('glb.test.set','book-test-'||gen_random_uuid()::text,true);
insert into auth.users(id,email) select current_setting('glb.test.a')::uuid,'book-a@example.invalid' union all select current_setting('glb.test.b')::uuid,'book-b@example.invalid' union all select current_setting('glb.test.c')::uuid,'book-c@example.invalid';
insert into public.glb_profiles(id,user_id) select current_setting('glb.test.a')::uuid,'booka_'||substr(md5(current_setting('glb.test.a')),1,12) union all select current_setting('glb.test.b')::uuid,'bookb_'||substr(md5(current_setting('glb.test.b')),1,12) union all select current_setting('glb.test.c')::uuid,'bookc_'||substr(md5(current_setting('glb.test.c')),1,12);
insert into public.glb_showcases(owner_id,book_published) values(current_setting('glb.test.a')::uuid,false),(current_setting('glb.test.b')::uuid,false),(current_setting('glb.test.c')::uuid,false);
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('glb.test.sid')::uuid,current_setting('glb.test.a')::uuid,now(),now());
insert into public.glb_sets(id,title,season,cards_per_pack) values(current_setting('glb.test.set'),'Rollback-only book tests',2026,1);
insert into public.glb_editions(id,set_id,subject_id,name,variant,quantity,front_image,back_image) select current_setting('glb.test.set')||suffix,current_setting('glb.test.set'),suffix,'Fixture '||suffix,'Black',1,'front.webp','back.webp' from unnest(array['a','b']) x(suffix);
insert into glb_private.copies(edition_id,serial,owner_id,code,opened_at) values(current_setting('glb.test.set')||'a',1,current_setting('glb.test.a')::uuid,'1111111111111111',now()),(current_setting('glb.test.set')||'b',1,current_setting('glb.test.b')::uuid,'2222222222222222',now());
update public.glb_sets set release_at=now() where id=current_setting('glb.test.set');
select set_config('glb.test.copya',(select id::text from glb_private.copies where edition_id=current_setting('glb.test.set')||'a'),true),set_config('glb.test.copyb',(select id::text from glb_private.copies where edition_id=current_setting('glb.test.set')||'b'),true);
select set_config('request.jwt.claim.sub',current_setting('glb.test.a'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.a'),'session_id',current_setting('glb.test.sid'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare result jsonb;begin
 perform public.glb_set_trade_listing(current_setting('glb.test.copya')::uuid,true,'Looking for a pitcher');
 if jsonb_array_length(public.glb_my_trade_listings())<>1 then raise exception 'Own listing not saved';end if;
 begin perform public.glb_set_trade_listing(current_setting('glb.test.copyb')::uuid,true,'');raise exception 'Wrong owner listed card';exception when raise_exception then if sqlerrm<>'You no longer own this copy' then raise;end if;end;
 result:=public.glb_collector_book('bookb_'||substr(md5(current_setting('glb.test.b')),1,12));if result is not null then raise exception 'Private book exposed';end if;
 begin perform 1 from glb_private.trade_offers;raise exception 'Private offers table exposed';exception when insufficient_privilege then null;end;
end$$;
reset role;
update public.glb_showcases set book_published=true where owner_id=current_setting('glb.test.b')::uuid;
insert into glb_private.trade_listings(copy_id,owner_id) values(current_setting('glb.test.copyb')::uuid,current_setting('glb.test.b')::uuid);
set local role authenticated;
do $$declare offer uuid;book jsonb;begin
 book:=public.glb_collector_book('bookb_'||substr(md5(current_setting('glb.test.b')),1,12));
 if jsonb_array_length(book->'cards')<>1 or book::text like '%2222222222222222%' then raise exception 'Public book shape or secrecy failed';end if;
 offer:=public.glb_propose_trade(current_setting('glb.test.copya')::uuid,current_setting('glb.test.copyb')::uuid);perform set_config('glb.test.offer',offer::text,true);
 if offer<>public.glb_propose_trade(current_setting('glb.test.copya')::uuid,current_setting('glb.test.copyb')::uuid) then raise exception 'Offer retry duplicated exchange';end if;
end$$;
reset role;
update auth.sessions set user_id=current_setting('glb.test.c')::uuid where id=current_setting('glb.test.sid')::uuid;
select set_config('request.jwt.claim.sub',current_setting('glb.test.c'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.c'),'session_id',current_setting('glb.test.sid'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin if public.glb_respond_trade(current_setting('glb.test.offer')::uuid,'accept') then raise exception 'Outsider accepted trade';end if;end$$;
reset role;
update auth.sessions set user_id=current_setting('glb.test.b')::uuid where id=current_setting('glb.test.sid')::uuid;
select set_config('request.jwt.claim.sub',current_setting('glb.test.b'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.b'),'session_id',current_setting('glb.test.sid'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if not public.glb_respond_trade(current_setting('glb.test.offer')::uuid,'accept') then raise exception 'Recipient could not accept';end if;
 if public.glb_respond_trade(current_setting('glb.test.offer')::uuid,'accept') then raise exception 'Trade applied twice';end if;
 if jsonb_array_length(public.glb_my_trade_listings())<>0 then raise exception 'Old listing survived transfer';end if;
end$$;
reset role;
do $$begin
 if not exists(select 1 from glb_private.copies where id=current_setting('glb.test.copya')::uuid and owner_id=current_setting('glb.test.b')::uuid and code<>'1111111111111111') then raise exception 'First copy or code did not change';end if;
 if not exists(select 1 from glb_private.copies where id=current_setting('glb.test.copyb')::uuid and owner_id=current_setting('glb.test.a')::uuid and code<>'2222222222222222') then raise exception 'Second copy or code did not change';end if;
 if (select count(*) from glb_private.ownership_history where copy_id in(current_setting('glb.test.copya')::uuid,current_setting('glb.test.copyb')::uuid))<>2 then raise exception 'Trade history incomplete';end if;
end$$;
rollback;
select 'PASS: private books, owner-only listings, public-book consent, idempotent offers, outsider rejection, atomic swap, rotated codes and listing cleanup. Fixtures rolled back.' as result;
