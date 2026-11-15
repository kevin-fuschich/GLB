-- Collector books and consent-based one-for-one trades. No inventory is released here.
begin;
alter table public.glb_showcases add column if not exists book_published boolean not null default false;
create table if not exists glb_private.trade_listings(
 copy_id uuid primary key references glb_private.copies(id),
 owner_id uuid not null references auth.users(id),
 wanted text not null default '' check(char_length(wanted)<=250),
 updated_at timestamptz not null default now()
);
alter table glb_private.trade_listings add column if not exists wanted text not null default '' check(char_length(wanted)<=250);
create table glb_private.trade_offers(
 id uuid primary key default gen_random_uuid(),
 offered_copy uuid not null references glb_private.copies(id),
 wanted_copy uuid not null references glb_private.copies(id),
 sender uuid not null references auth.users(id),
 recipient uuid not null references auth.users(id),
 status text not null default 'pending' check(status in('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '48 hours',
 completed_at timestamptz,
 check(offered_copy<>wanted_copy and sender<>recipient)
);
alter table glb_private.trade_listings enable row level security;
alter table glb_private.trade_offers enable row level security;
revoke all on glb_private.trade_listings,glb_private.trade_offers from public,anon,authenticated;
create index if not exists trade_listing_owner on glb_private.trade_listings(owner_id);
create index if not exists trade_offer_sender on glb_private.trade_offers(sender,created_at desc);
create index if not exists trade_offer_recipient on glb_private.trade_offers(recipient,created_at desc);
create index if not exists trade_offer_copies on glb_private.trade_offers(offered_copy,wanted_copy) where status='pending';
create function glb_private.clear_book_trade_listing() returns trigger language plpgsql set search_path='' as $$ begin if new.owner_id is distinct from old.owner_id then delete from glb_private.trade_listings where copy_id=new.id;end if;return new;end;$$;
revoke all on function glb_private.clear_book_trade_listing() from public,anon,authenticated;
create trigger copies_clear_book_listing after update of owner_id on glb_private.copies for each row execute function glb_private.clear_book_trade_listing();
create function glb_private.set_trade_listing(p_copy uuid,p_available boolean,p_wanted text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform glb_private.require_session();
 if p_available is null then raise exception 'Choose a trade status';end if;
 if char_length(coalesce(p_wanted,''))>250 then raise exception 'Trade note is too long';end if;
 perform 1 from glb_private.copies where id=p_copy and owner_id=auth.uid() and opened_at is not null for update;
 if not found then raise exception 'You no longer own this copy';end if;
 if p_available then
  insert into glb_private.trade_listings(copy_id,owner_id,wanted) values(p_copy,auth.uid(),trim(coalesce(p_wanted,''))) on conflict(copy_id) do update set owner_id=excluded.owner_id,wanted=excluded.wanted,updated_at=now();
 else delete from glb_private.trade_listings where copy_id=p_copy and owner_id=auth.uid();end if;
 return true;
end;$$;
create function glb_private.my_trade_listings() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform glb_private.require_session();
 return (select coalesce(jsonb_agg(jsonb_build_object('copy_id',l.copy_id,'wanted',l.wanted)),'[]') from glb_private.trade_listings l join glb_private.copies c on c.id=l.copy_id and c.owner_id=l.owner_id where l.owner_id=auth.uid());
end;$$;
create function glb_private.collector_book(p_user text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',p.user_id,'display_name',s.display_name,'bio',s.bio,'theme',s.theme,'published',s.book_published,
 'cards',(select coalesce(jsonb_agg(jsonb_build_object('copy_id',c.id,'edition_id',e.id,'set_id',e.set_id,'name',e.name,'variant',e.variant,'serial',c.serial,'quantity',e.quantity,'front_image',e.front_image,'back_image',e.back_image,'facts',e.facts,'available',l.copy_id is not null,'wanted',coalesce(l.wanted,'')) order by e.set_id,e.id,c.serial),'[]') from glb_private.copies c join public.glb_editions e on e.id=c.edition_id join public.glb_sets st on st.id=e.set_id left join glb_private.trade_listings l on l.copy_id=c.id and l.owner_id=c.owner_id where c.owner_id=p.id and c.opened_at is not null and st.release_at<=now()))
 from public.glb_profiles p join public.glb_showcases s on s.owner_id=p.id
 where p.user_id=p_user and (s.book_published or p.id=auth.uid());
$$;
create function glb_private.book_trade_board() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]') from(
 select jsonb_build_object('copy_id',c.id,'user_id',p.user_id,'display_name',s.display_name,'name',e.name,'variant',e.variant,'serial',c.serial,'quantity',e.quantity,'front_image',e.front_image,'back_image',e.back_image,'facts',e.facts,'wanted',l.wanted) x
 from glb_private.trade_listings l join glb_private.copies c on c.id=l.copy_id and c.owner_id=l.owner_id join public.glb_profiles p on p.id=l.owner_id join public.glb_showcases s on s.owner_id=l.owner_id and s.book_published join public.glb_editions e on e.id=c.edition_id join public.glb_sets st on st.id=e.set_id and st.release_at<=now()
 where c.opened_at is not null order by l.updated_at desc limit 100) q;
$$;
create function glb_private.propose_trade(p_offered uuid,p_wanted uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare offered glb_private.copies; wanted glb_private.copies; result uuid;
begin
 perform glb_private.recent_auth();
 if p_offered=p_wanted then raise exception 'Choose two different copies';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 if (select count(*) from glb_private.transfer_attempts where owner_id=auth.uid() and attempted_at>now()-interval '10 minutes')>=10 then raise exception 'Please wait before making more offers';end if;
 insert into glb_private.transfer_attempts(owner_id) values(auth.uid());
 perform 1 from glb_private.copies where id in(p_offered,p_wanted) order by id for update;
 select * into offered from glb_private.copies where id=p_offered;
 select * into wanted from glb_private.copies where id=p_wanted;
 if offered.id is null or wanted.id is null or offered.owner_id is distinct from auth.uid() or wanted.owner_id is null or wanted.owner_id=auth.uid() then raise exception 'These copies are not available for this trade';end if;
 if not exists(select 1 from glb_private.trade_listings l join public.glb_showcases s on s.owner_id=l.owner_id and s.book_published where l.copy_id=wanted.id and l.owner_id=wanted.owner_id) then raise exception 'This copy is no longer listed for trade';end if;
 if exists(select 1 from glb_private.transfers where copy_id in(p_offered,p_wanted) and status='pending' and expires_at>now()) then raise exception 'A copy already has a pending transfer';end if;
 select id into result from glb_private.trade_offers where offered_copy=p_offered and wanted_copy=p_wanted and sender=auth.uid() and recipient=wanted.owner_id and status='pending' and expires_at>now();
 if result is not null then return result;end if;
 insert into glb_private.trade_offers(offered_copy,wanted_copy,sender,recipient) values(p_offered,p_wanted,auth.uid(),wanted.owner_id) returning id into result;
 return result;
end;$$;
create function glb_private.respond_trade(p_offer uuid,p_action text) returns boolean language plpgsql security definer set search_path='' as $$
declare offer glb_private.trade_offers; offered glb_private.copies; wanted glb_private.copies; fresh text;
begin
 perform glb_private.require_session();
 select * into offer from glb_private.trade_offers where id=p_offer and auth.uid() in(sender,recipient);
 if not found then return false;end if;
 if p_action not in('accept','decline','cancel') then raise exception 'Unknown response';end if;
 if p_action='accept' then perform glb_private.recent_auth();end if;
 perform 1 from glb_private.copies where id in(offer.offered_copy,offer.wanted_copy) order by id for update;
 select * into offer from glb_private.trade_offers where id=p_offer for update;
 if offer.status<>'pending' or offer.expires_at<=now() then return false;end if;
 if p_action='cancel' and offer.sender=auth.uid() then update glb_private.trade_offers set status='cancelled',completed_at=now() where id=p_offer;return true;end if;
 if p_action='decline' and offer.recipient=auth.uid() then update glb_private.trade_offers set status='declined',completed_at=now() where id=p_offer;return true;end if;
 if p_action<>'accept' or offer.recipient<>auth.uid() then return false;end if;
 select * into offered from glb_private.copies where id=offer.offered_copy;
 select * into wanted from glb_private.copies where id=offer.wanted_copy;
 if offered.owner_id is distinct from offer.sender or wanted.owner_id is distinct from offer.recipient then return false;end if;
 if not exists(select 1 from glb_private.trade_listings where copy_id=wanted.id and owner_id=offer.recipient) then return false;end if;
 if exists(select 1 from glb_private.transfers where copy_id in(offered.id,wanted.id) and status='pending' and expires_at>now()) then return false;end if;
 loop
  fresh:=glb_private.card_code();if fresh=offered.code then continue;end if;
  begin update glb_private.copies set owner_id=offer.recipient,code=fresh where id=offered.id;exit;exception when unique_violation then null;end;
 end loop;
 loop
  fresh:=glb_private.card_code();if fresh=wanted.code then continue;end if;
  begin update glb_private.copies set owner_id=offer.sender,code=fresh where id=wanted.id;exit;exception when unique_violation then null;end;
 end loop;
 insert into glb_private.ownership_history(copy_id,from_owner,to_owner) values(offered.id,offer.sender,offer.recipient),(wanted.id,offer.recipient,offer.sender);
 update glb_private.trade_offers set status='accepted',completed_at=now() where id=p_offer;
 return true;
end;$$;
create function glb_private.my_trade_offers() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform glb_private.require_session();
 return (select coalesce(jsonb_agg(x),'[]') from(
 select jsonb_build_object('id',o.id,'sender',a.user_id,'recipient',b.user_id,'incoming',o.recipient=auth.uid(),'status',case when o.status='pending' and o.expires_at<=now() then 'expired' when o.status='pending' and (c.owner_id is distinct from o.sender or d.owner_id is distinct from o.recipient) then 'unavailable' else o.status end,'expires_at',o.expires_at,'offered',jsonb_build_object('name',e.name,'variant',e.variant,'serial',c.serial,'quantity',e.quantity),'wanted',jsonb_build_object('name',f.name,'variant',f.variant,'serial',d.serial,'quantity',f.quantity)) x
 from glb_private.trade_offers o join public.glb_profiles a on a.id=o.sender join public.glb_profiles b on b.id=o.recipient join glb_private.copies c on c.id=o.offered_copy join glb_private.copies d on d.id=o.wanted_copy join public.glb_editions e on e.id=c.edition_id join public.glb_editions f on f.id=d.edition_id
 where auth.uid() in(o.sender,o.recipient) order by o.created_at desc limit 100) q);
end;$$;
create or replace function glb_private.trade_board(p_user text default null) returns jsonb language sql stable security definer set search_path='' as $$ select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(glb_private.book_trade_board()) x where p_user is null or x->>'user_id'=p_user; $$;
-- Only narrow invoker wrappers are exposed through the Data API.
create function public.glb_set_trade_listing(p_copy uuid,p_available boolean,p_wanted text default '') returns boolean language sql security invoker set search_path='' as $$select glb_private.set_trade_listing(p_copy,p_available,p_wanted);$$;
create function public.glb_my_trade_listings() returns jsonb language sql stable security invoker set search_path='' as $$select glb_private.my_trade_listings();$$;
create function public.glb_collector_book(p_user text) returns jsonb language sql stable security invoker set search_path='' as $$select glb_private.collector_book(p_user);$$;
create function public.glb_book_trade_board() returns jsonb language sql stable security invoker set search_path='' as $$select glb_private.book_trade_board();$$;
create function public.glb_propose_trade(p_offered uuid,p_wanted uuid) returns uuid language sql security invoker set search_path='' as $$select glb_private.propose_trade(p_offered,p_wanted);$$;
create function public.glb_respond_trade(p_offer uuid,p_action text) returns boolean language sql security invoker set search_path='' as $$select glb_private.respond_trade(p_offer,p_action);$$;
create function public.glb_my_trade_offers() returns jsonb language sql stable security invoker set search_path='' as $$select glb_private.my_trade_offers();$$;
revoke all on function glb_private.set_trade_listing(uuid,boolean,text),glb_private.my_trade_listings(),glb_private.collector_book(text),glb_private.book_trade_board(),glb_private.propose_trade(uuid,uuid),glb_private.respond_trade(uuid,text),glb_private.my_trade_offers() from public,anon,authenticated;
revoke all on function public.glb_set_trade_listing(uuid,boolean,text),public.glb_my_trade_listings(),public.glb_collector_book(text),public.glb_book_trade_board(),public.glb_propose_trade(uuid,uuid),public.glb_respond_trade(uuid,text),public.glb_my_trade_offers() from public,anon,authenticated;
grant execute on function glb_private.collector_book(text),glb_private.book_trade_board(),public.glb_collector_book(text),public.glb_book_trade_board() to anon,authenticated;
grant execute on function glb_private.set_trade_listing(uuid,boolean,text),glb_private.my_trade_listings(),glb_private.propose_trade(uuid,uuid),glb_private.respond_trade(uuid,text),glb_private.my_trade_offers(),public.glb_set_trade_listing(uuid,boolean,text),public.glb_my_trade_listings(),public.glb_propose_trade(uuid,uuid),public.glb_respond_trade(uuid,text),public.glb_my_trade_offers() to authenticated;
commit;
