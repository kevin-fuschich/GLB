-- Hosted, transaction-isolated authorization and editing test. Everything rolls back.
begin;
select set_config('glb.test.board',gen_random_uuid()::text,true),set_config('glb.test.member',gen_random_uuid()::text,true),set_config('glb.test.sid',gen_random_uuid()::text,true),set_config('glb.test.checklist','checklist-test-'||gen_random_uuid()::text,true);
insert into auth.users(id,email) select current_setting('glb.test.board')::uuid,'checklist-test-board@example.invalid' union all select current_setting('glb.test.member')::uuid,'checklist-test-member@example.invalid';
insert into auth.sessions(id,user_id,created_at) values(current_setting('glb.test.sid')::uuid,current_setting('glb.test.board')::uuid,now());
insert into glb_private.board_members values(current_setting('glb.test.board')::uuid);
insert into public.glb_sets(id,title,season) values(current_setting('glb.test.checklist'),'Temporary checklist test',1999);
insert into public.glb_checklist_cards(id,set_id,card_number,subject_key,subject_type,subject_name) values(current_setting('glb.test.checklist'),current_setting('glb.test.checklist'),1,'test-subject','mascot','Temporary test subject');
insert into public.glb_checklist_variants(id,card_id,variant) values(current_setting('glb.test.checklist'),current_setting('glb.test.checklist'),'Base');
select set_config('request.jwt.claim.sub',current_setting('glb.test.member'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.member'),'session_id',current_setting('glb.test.sid'),'role','authenticated')::text,true);
update auth.sessions set user_id=current_setting('glb.test.member')::uuid where id=current_setting('glb.test.sid')::uuid;
set local role authenticated;
do $$begin
 if exists(select 1 from public.glb_checklist_cards) then raise exception 'Ordinary account read the private catalog';end if;
 begin
  perform public.glb_update_checklist_card(current_setting('glb.test.checklist'),1,'Unauthorized','planned','needs_review','');
  raise exception 'Ordinary account edited the catalog';
 exception when raise_exception then if sqlerrm<>'Board access required' then raise;end if;end;
end$$;
reset role;
update auth.sessions set user_id=current_setting('glb.test.board')::uuid where id=current_setting('glb.test.sid')::uuid;
select set_config('request.jwt.claim.sub',current_setting('glb.test.board'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('glb.test.board'),'session_id',current_setting('glb.test.sid'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if public.glb_update_checklist_card(current_setting('glb.test.checklist'),1,'Draft biography','planned','needs_review','Edit test')<>2 then raise exception 'Board edit failed';end if;
 begin
  perform public.glb_update_checklist_card(current_setting('glb.test.checklist'),1,'Stale edit','planned','approved','');raise exception 'Stale edit accepted';
 exception when raise_exception then if sqlerrm<>'This entry changed. Reload before saving.' then raise;end if;end;
 perform public.glb_save_checklist_variant(current_setting('glb.test.checklist'),'Base',1,1000,'front.webp','back.webp','approved','Test variant');
 if not exists(select 1 from public.glb_checklist_variants where id=current_setting('glb.test.checklist') and print_quantity=1000 and revision=2) then raise exception 'Variant edit failed';end if;
end$$;
reset role;
rollback;
select 'PASS: non-Board isolation, Board edits, revision conflict protection and variant persistence; test records rolled back.' as checklist_test;
