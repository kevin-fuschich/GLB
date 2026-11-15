-- Collection hub: credits, chosen packs and opt-in trade listings.
create table glb_private.credit_ledger (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 reward_key text not null, amount integer not null check(amount<>0), reason text not null,
 pack_id uuid references public.glb_packs(id), created_at timestamptz not null default now(),
 unique(owner_id,reward_key)
);
alter table glb_private.credit_ledger enable row level security;
create table glb_private.trade_listings (
 copy_id uuid primary key references glb_private.copies(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade, updated_at timestamptz not null default now()
);
create index trade_listing_owner on glb_private.trade_listings(owner_id);
alter table glb_private.trade_listings enable row level security;
revoke all on glb_private.credit_ledger,glb_private.trade_listings from public,anon,authenticated;
-- Previously delivered reward packs stay delivered. Only unspent rewards become credits.
insert into glb_private.credit_ledger(owner_id,reward_key,amount,reason)
select r.owner_id,r.reward_key,100,r.reason from glb_private.reward_credits r
where not exists(select 1 from public.glb_packs p where p.owner_id=r.owner_id and p.reward_key=r.reward_key)
on conflict do nothing;
create or replace function glb_private.award(p_owner uuid,p_key text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into glb_private.reward_credits values(p_owner,p_key,p_reason,now()) on conflict do nothing;
 if not exists(select 1 from public.glb_packs where owner_id=p_owner and reward_key=p_key) then
 insert into glb_private.credit_ledger(owner_id,reward_key,amount,reason) values(p_owner,p_key,100,p_reason) on conflict do nothing;
 end if;
end;$$;
-- Set rows are placeholders until their finite inventory is prepared and released.
insert into public.glb_sets(id,title,season,cards_per_pack) values
 ('donk-base-2026','DONK Base',2026,5),('road-to-tijuana-2026','ROAD TO TIJUANA',2026,5),('around-glb-2026','Around GLB',2026,5) on conflict do nothing;

create function glb_private.collection_hub() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform glb_private.require_session();
 return jsonb_build_object(
 'balance',(select coalesce(sum(amount),0) from glb_private.credit_ledger where owner_id=auth.uid()),
 'ledger',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]') from (select amount,reason,created_at from glb_private.credit_ledger where owner_id=auth.uid() order by created_at desc,id desc limit 50)t),
 'catalog',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'season',s.season,'cards_per_pack',s.cards_per_pack,'cost',100,'released',coalesce(s.release_at<=now(),false),
 'available_packs',case when s.release_at<=now() then greatest(0,((select count(*) from glb_private.copies c join public.glb_editions e on e.id=c.edition_id where e.set_id=s.id and c.owner_id is null)/s.cards_per_pack)-(select count(*) from public.glb_packs p where p.set_id=s.id and p.opened_at is null)) else 0 end,
 'odds',(select coalesce(jsonb_agg(to_jsonb(v)),'[]') from (select e.variant,count(*) as remaining from glb_private.copies c join public.glb_editions e on e.id=c.edition_id where e.set_id=s.id and c.owner_id is null group by e.variant order by e.variant)v)
 ) order by s.id),'[]') from public.glb_sets s),
 'trade_copies',(select coalesce(jsonb_agg(l.copy_id),'[]') from glb_private.trade_listings l join glb_private.copies c on c.id=l.copy_id where l.owner_id=auth.uid() and c.owner_id=auth.uid()));
end;$$;
create function glb_private.buy_pack(p_set text,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); s public.glb_sets; balance bigint; slots bigint; pid uuid; key text:='pack:'||p_request::text;
begin
 perform glb_private.require_session();
 if uid is null or p_request is null or not exists(select 1 from public.glb_profiles where id=uid) then raise exception 'Sign in and choose a User ID';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select pack_id into pid from glb_private.credit_ledger where owner_id=uid and reward_key=key;
 if pid is not null then
 if not exists(select 1 from public.glb_packs where id=pid and set_id=p_set) then raise exception 'Request already used for a different pack';end if;return pid;end if;
 select * into s from public.glb_sets where id=p_set for update;
 if not found or s.release_at is null or s.release_at>now() then raise exception 'This pack has not been released';end if;
 select coalesce(sum(amount),0) into balance from glb_private.credit_ledger where owner_id=uid;
 if balance<100 then raise exception 'You need 100 credits for this pack';end if;
 select count(*) into slots from glb_private.copies c join public.glb_editions e on e.id=c.edition_id where e.set_id=s.id and c.owner_id is null;
 slots:=slots-(select count(*)*s.cards_per_pack from public.glb_packs where set_id=s.id and opened_at is null);
 if slots<s.cards_per_pack then raise exception 'This pack is sold out';end if;
 insert into public.glb_packs(owner_id,set_id,reward_key,earned_for) values(uid,s.id,key,'100 collection credits') returning id into pid;
 insert into glb_private.credit_ledger(owner_id,reward_key,amount,reason,pack_id) values(uid,key,-100,s.title||' pack',pid);
 return pid;
end;$$;
create function glb_private.set_trade(p_copy uuid,p_available boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform glb_private.require_session();
 if p_available is null then raise exception 'Choose a trade status';end if;
 perform 1 from glb_private.copies where id=p_copy and owner_id=auth.uid() for update;
 if not found then raise exception 'You do not own this copy';end if;
 if p_available then insert into glb_private.trade_listings(copy_id,owner_id) values(p_copy,auth.uid()) on conflict(copy_id) do update set owner_id=excluded.owner_id,updated_at=now();
 else delete from glb_private.trade_listings where copy_id=p_copy and owner_id=auth.uid();end if;return p_available;
end;$$;
create function glb_private.clear_trade() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.owner_id is distinct from old.owner_id then delete from glb_private.trade_listings where copy_id=new.id;end if;return new;end;$$;
create trigger clear_trade_listing after update of owner_id on glb_private.copies for each row execute function glb_private.clear_trade();
create function glb_private.trade_board(p_user text default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
 select p.user_id,c.id as copy_id,c.edition_id,c.serial,e.quantity,e.name,e.variant,e.front_image,e.set_id
 from glb_private.trade_listings l join glb_private.copies c on c.id=l.copy_id and c.owner_id=l.owner_id
 join public.glb_profiles p on p.id=l.owner_id join public.glb_showcases sh on sh.owner_id=l.owner_id and sh.published
 join public.glb_editions e on e.id=c.edition_id join public.glb_sets s on s.id=e.set_id and s.release_at<=now()
 where (p_user is null or p.user_id=p_user) and c.opened_at is not null
 and not exists(select 1 from glb_private.transfers tr where tr.copy_id=c.id and tr.status='pending' and tr.expires_at>now())
 order by l.updated_at desc,c.id limit 100)t;
$$;
create function glb_private.feature_card(p_copy uuid,p_feature boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare selected uuid[];
begin
 perform glb_private.require_session();
 if p_feature is null then raise exception 'Choose a showcase status';end if;
 perform 1 from glb_private.copies where id=p_copy and owner_id=auth.uid() for update;if not found then raise exception 'You do not own this copy';end if;
 insert into public.glb_showcases(owner_id) values(auth.uid()) on conflict do nothing;
 select featured_copies into selected from public.glb_showcases where owner_id=auth.uid() for update;
 selected:=array_remove(coalesce(selected,'{}'),p_copy);
 if p_feature then if cardinality(selected)>=9 then raise exception 'Your showcase holds up to nine cards';end if;selected:=array_append(selected,p_copy);end if;
 update public.glb_showcases set featured_copies=selected where owner_id=auth.uid();return p_feature;
end;$$;
-- Public entry points are invokers; privilege and ownership checks live in a private schema.
create function public.glb_collection_hub() returns jsonb language sql set search_path='' as $$select glb_private.collection_hub();$$;
create function public.glb_buy_pack(p_set text,p_request uuid) returns uuid language sql set search_path='' as $$select glb_private.buy_pack(p_set,p_request);$$;
create function public.glb_set_trade(p_copy uuid,p_available boolean) returns boolean language sql set search_path='' as $$select glb_private.set_trade(p_copy,p_available);$$;
create function public.glb_trade_board(p_user text default null) returns jsonb language sql stable set search_path='' as $$select glb_private.trade_board(p_user);$$;
create function public.glb_feature_card(p_copy uuid,p_feature boolean) returns boolean language sql set search_path='' as $$select glb_private.feature_card(p_copy,p_feature);$$;
revoke all on function glb_private.collection_hub(),glb_private.buy_pack(text,uuid),glb_private.set_trade(uuid,boolean),glb_private.feature_card(uuid,boolean),glb_private.trade_board(text),glb_private.clear_trade() from public,anon,authenticated;
revoke all on function public.glb_collection_hub(),public.glb_buy_pack(text,uuid),public.glb_set_trade(uuid,boolean),public.glb_feature_card(uuid,boolean),public.glb_trade_board(text) from public,anon,authenticated;
grant execute on function glb_private.collection_hub(),glb_private.buy_pack(text,uuid),glb_private.set_trade(uuid,boolean),glb_private.feature_card(uuid,boolean),public.glb_collection_hub(),public.glb_buy_pack(text,uuid),public.glb_set_trade(uuid,boolean),public.glb_feature_card(uuid,boolean) to authenticated;
grant execute on function glb_private.trade_board(text),public.glb_trade_board(text) to anon,authenticated;
notify pgrst,'reload schema';
