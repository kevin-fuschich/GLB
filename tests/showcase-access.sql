-- Read-only deployment checks. Do not create accounts or publish member data.
begin read only;
do $$ begin
 if not (select relrowsecurity from pg_class where oid='public.glb_showcases'::regclass) then raise exception 'RLS disabled';end if;
 if has_table_privilege('anon','public.glb_showcases','select') then raise exception 'anonymous table access';end if;
 if (select count(*) from pg_policies where schemaname='public' and tablename='glb_showcases')<>3 then raise exception 'missing owner policies';end if;
end $$;
set local role anon;
do $$ begin
 if public.glb_public_showcase('nonexistent_qa_user',true) is not null then raise exception 'invalid preview';end if;
end $$;
rollback;
