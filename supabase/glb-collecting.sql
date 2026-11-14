-- Apply after glb-accounts.sql. Private collectible ownership is separate from creative claims.
begin;
create table if not exists public.glb_sets (
 id text primary key, title text not null, season integer not null check(season between 1800 and 2200),
 release_at timestamptz, cards_per_pack integer not null default 5 check(cards_per_pack between 1 and 12)
);
create table if not exists public.glb_editions (
 id text primary key, set_id text not null references public.glb_sets(id), subject_id text not null,
 name text not null, variant text not null, quantity integer not null check(quantity between 1 and 1000),
 front_image text not null, back_image text, facts jsonb not null default '{}'
);
create table if not exists glb_private.copies (
 id uuid primary key default gen_random_uuid(), edition_id text not null references public.glb_editions(id),
 serial integer not null check(serial>0), owner_id uuid references auth.users(id), code text unique,
 opened_at timestamptz, unique(edition_id,serial),
 check(code is null or code ~ '^[0-9]{16}$'),
 check((owner_id is null and code is null and opened_at is null) or (owner_id is not null and code is not null and opened_at is not null))
);
create table if not exists public.glb_packs (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 set_id text not null references public.glb_sets(id), earned_for text not null,
 reward_key text not null, earned_at timestamptz not null default now(), opened_at timestamptz,
 unique(owner_id,reward_key)
);
create table if not exists glb_private.pack_cards (
 pack_id uuid not null references public.glb_packs(id), copy_id uuid not null unique references glb_private.copies(id),
 primary key(pack_id,copy_id)
);
create table if not exists glb_private.transfers (
 id uuid primary key default gen_random_uuid(), copy_id uuid not null references glb_private.copies(id),
 sender uuid not null references auth.users(id), recipient uuid not null references auth.users(id),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '48 hours',
 status text not null default 'pending' check(status in ('pending','accepted','cancelled')),
 completed_at timestamptz, check(sender<>recipient)
);
create unique index if not exists glb_one_pending_transfer on glb_private.transfers(copy_id) where status='pending';
create table if not exists glb_private.ownership_history (
 event_id uuid primary key default gen_random_uuid(), copy_id uuid not null references glb_private.copies(id),
 from_owner uuid references auth.users(id), to_owner uuid not null references auth.users(id),
 transfer_id uuid unique references glb_private.transfers(id), occurred_at timestamptz not null default now()
);
create table if not exists glb_private.visits (
 owner_id uuid not null references auth.users(id), day date not null, primary key(owner_id,day)
);
-- Users cannot write inventory, grant rewards, change rarity or read anyone else's secrets.
alter table public.glb_sets enable row level security;
alter table public.glb_editions enable row level security;
alter table public.glb_packs enable row level security;
alter table glb_private.copies enable row level security;
alter table glb_private.pack_cards enable row level security;
alter table glb_private.transfers enable row level security;
alter table glb_private.ownership_history enable row level security;
alter table glb_private.visits enable row level security;
revoke all on public.glb_sets,public.glb_editions,public.glb_packs from anon,authenticated;
revoke all on glb_private.copies,glb_private.pack_cards,glb_private.transfers,glb_private.ownership_history,glb_private.visits from public,anon,authenticated;
grant select on public.glb_sets,public.glb_editions to anon,authenticated;
grant select on public.glb_packs to authenticated;
drop policy if exists released_sets on public.glb_sets;
create policy released_sets on public.glb_sets for select using(release_at<=now());
drop policy if exists released_editions on public.glb_editions;
create policy released_editions on public.glb_editions for select using(exists(select 1 from public.glb_sets s where s.id=set_id and s.release_at<=now()));
drop policy if exists own_packs on public.glb_packs;
create policy own_packs on public.glb_packs for select to authenticated using(owner_id=(select auth.uid()));

create or replace function glb_private.guard_editions() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_TABLE_NAME='glb_sets' then
  if new.release_at is not null then raise exception 'Create a draft first, prepare inventory, then release'; end if;
 elsif TG_TABLE_NAME='glb_editions' then
  if exists(select 1 from public.glb_sets where id=new.set_id and release_at is not null) then raise exception 'Edition list is frozen'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists draft_set on public.glb_sets;
create trigger draft_set before insert on public.glb_sets for each row execute function glb_private.guard_editions();
drop trigger if exists draft_editions on public.glb_editions;
create trigger draft_editions before insert on public.glb_editions for each row execute function glb_private.guard_editions();
create or replace function glb_private.card_code() returns text language sql volatile set search_path='' as $$
 select lpad(((('x'||substr(md5(gen_random_uuid()::text),1,15))::bit(60)::bigint)%10000000000000000)::text,16,'0');
$$;
-- Any release/edition change is rejected once released. Additional releases require a new set.
create or replace function glb_private.freeze_release() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_TABLE_NAME='glb_sets' then
  if old.release_at is not null then raise exception 'Released set is immutable'; end if;
 else
  if exists(select 1 from public.glb_sets where id=old.set_id and release_at is not null) then raise exception 'Released edition is immutable'; end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end; $$;
drop trigger if exists freeze_set on public.glb_sets;
create trigger freeze_set before update or delete on public.glb_sets for each row execute function glb_private.freeze_release();
drop trigger if exists freeze_edition on public.glb_editions;
create trigger freeze_edition before update or delete on public.glb_editions for each row execute function glb_private.freeze_release();
create or replace function glb_private.check_inventory() returns trigger language plpgsql set search_path='' as $$
begin
 if new.release_at is not null then
  if not exists(select 1 from public.glb_editions where set_id=new.id) or exists(
   select 1 from public.glb_editions e where e.set_id=new.id and
   ((select count(*) from glb_private.copies c where c.edition_id=e.id)<>e.quantity or (select max(serial) from glb_private.copies c where c.edition_id=e.id)>e.quantity)
  ) then raise exception 'Prepare the complete finite inventory before releasing a set'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists check_inventory on public.glb_sets;
create trigger check_inventory before update on public.glb_sets for each row execute function glb_private.check_inventory();

create table if not exists glb_private.reward_credits(owner_id uuid not null references auth.users(id), reward_key text not null, reason text not null, created_at timestamptz not null default now(), primary key(owner_id,reward_key));
alter table glb_private.reward_credits enable row level security;
revoke all on glb_private.reward_credits from public,anon,authenticated;
create or replace function glb_private.award(p_owner uuid,p_key text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare sid text; slots integer; sz integer;
begin
 -- Reward release selection never reads a user's profile, preferences or claim subject.
 insert into glb_private.reward_credits values(p_owner,p_key,p_reason,now()) on conflict do nothing;
 if exists(select 1 from public.glb_packs where owner_id=p_owner and reward_key=p_key) then return; end if;
 select id,cards_per_pack into sid,sz from public.glb_sets where release_at<=now() order by release_at desc,id limit 1 for update;
 if sid is not null then
  select count(*) into slots from glb_private.copies c join public.glb_editions e on e.id=c.edition_id where e.set_id=sid and c.owner_id is null;
  slots:=slots-(select count(*)*sz from public.glb_packs where set_id=sid and opened_at is null);
  if slots<sz then return; end if;
  insert into public.glb_packs(owner_id,set_id,reward_key,earned_for) values(p_owner,sid,p_key,p_reason) on conflict(owner_id,reward_key) do nothing;
 end if;
end; $$;
create or replace function public.glb_collect_visit() returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); n integer; credit record;
begin
 if uid is null or not exists(select 1 from public.glb_profiles where id=uid) then raise exception 'Sign in and choose a User ID'; end if;
 -- Serialize milestones for one account; repeated calls on one UTC date count once.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 insert into glb_private.visits values(uid,(now() at time zone 'UTC')::date) on conflict do nothing;
 select count(*) into n from glb_private.visits where owner_id=uid;
 perform glb_private.award(uid,'welcome','Welcome pack');
 if n>=3 then perform glb_private.award(uid,'visits-3','Visited on three different days'); end if;
 if n>=7 then perform glb_private.award(uid,'visits-7','Visited on seven different days'); end if;
 if n>=30 then perform glb_private.award(uid,'visits-30','Visited on thirty different days'); end if;
 for credit in select * from glb_private.reward_credits r where r.owner_id=uid and not exists(select 1 from public.glb_packs p where p.owner_id=uid and p.reward_key=r.reward_key) loop
 perform glb_private.award(uid,credit.reward_key,credit.reason); end loop;
end; $$;
-- Submitting alone is not proof of legitimacy. Board approval verifies the work;
-- a claim earns a submission-quality pack plus an approval pack, exactly once each.
create or replace function glb_private.collect_contribution() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='approved' and old.status='pending' then
  if new.kind='claim' then
   perform glb_private.award(new.owner_id,'valid-claim:'||new.id,'Verified claim submission');
   perform glb_private.award(new.owner_id,'approved-claim:'||new.id,'Approved claim');
  elsif new.kind='note' then
   perform glb_private.award(new.owner_id,'collaboration:'||new.id,'Approved collaboration');
  end if;
 end if;
 return new;
end; $$;
drop trigger if exists collect_contribution on public.glb_submissions;
create trigger collect_contribution after update on public.glb_submissions for each row execute function glb_private.collect_contribution();

create or replace function public.glb_open_pack(p_pack uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.glb_packs; s public.glb_sets; draw record; n integer; code_value text;
begin
 select * into p from public.glb_packs where id=p_pack and owner_id=auth.uid() for update;
 if not found then raise exception 'Pack unavailable'; end if;
 select * into s from public.glb_sets where id=p.set_id for update;
 if s.release_at is null or s.release_at>now() then raise exception 'Set not released'; end if;
 if p.opened_at is null then
  select count(*) into n from glb_private.copies c join public.glb_editions e on e.id=c.edition_id where e.set_id=s.id and c.owner_id is null;
  if n<s.cards_per_pack then raise exception 'This set has insufficient unopened inventory. Your pack remains unopened.'; end if;
  for draw in select c.id from glb_private.copies c join public.glb_editions e on e.id=c.edition_id
   where e.set_id=s.id and c.owner_id is null order by gen_random_uuid() limit s.cards_per_pack
  loop
   loop
    code_value:=glb_private.card_code();
    begin
     update glb_private.copies set owner_id=auth.uid(),code=code_value,opened_at=now() where id=draw.id;
     exit;
    exception when unique_violation then null;
    end;
   end loop;
   insert into glb_private.pack_cards values(p.id,draw.id);
   insert into glb_private.ownership_history(copy_id,to_owner) values(draw.id,auth.uid());
  end loop;
  update public.glb_packs set opened_at=now() where id=p.id;
 end if;
 -- Retry returns this pack's original copy IDs; it never draws again, including after transfer.
 return (select coalesce(jsonb_agg(jsonb_build_object('copy_id',c.id,'edition_id',c.edition_id,'serial',c.serial)), '[]')
 from glb_private.pack_cards pc join glb_private.copies c on c.id=pc.copy_id where pc.pack_id=p.id);
end; $$;
create or replace function public.glb_my_album() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('copy_id',c.id,'edition_id',c.edition_id,'serial',c.serial,'opened_at',c.opened_at)),'[]') from glb_private.copies c where c.owner_id=auth.uid();
$$;
create or replace function public.glb_card_secret(p_copy uuid) returns text language sql stable security definer set search_path='' as $$
 select code from glb_private.copies where id=p_copy and owner_id=auth.uid();
$$;
create or replace function public.glb_discovery() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('edition_id',e.id,'quantity',e.quantity,'discovered',(select count(*) from glb_private.copies c where c.edition_id=e.id and c.opened_at is not null))),'[]')
 from public.glb_editions e join public.glb_sets s on s.id=e.set_id where s.release_at<=now();
$$;
-- Transfers require a recently authenticated session, ownership AND the private code.
create or replace function glb_private.recent_auth() returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 sid:=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid;
 if not exists(select 1 from auth.sessions where id=sid and user_id=auth.uid() and created_at>=now()-interval '10 minutes') then raise exception 'Sign in again before transferring a card'; end if;
end; $$;
create table if not exists glb_private.transfer_attempts(owner_id uuid not null, attempted_at timestamptz not null default now());
alter table glb_private.transfer_attempts enable row level security;
revoke all on glb_private.transfer_attempts from public,anon,authenticated;
create or replace function public.glb_request_transfer(p_copy uuid,p_recipient text,p_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare c glb_private.copies; target uuid; tid uuid;
begin
 perform glb_private.recent_auth();
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 if (select count(*) from glb_private.transfer_attempts where owner_id=auth.uid() and attempted_at>now()-interval '10 minutes')>=10 then return null; end if;
 insert into glb_private.transfer_attempts(owner_id) values(auth.uid());
 select * into c from glb_private.copies where id=p_copy and owner_id=auth.uid() for update;
 if not found or c.code<>p_code or p_code is null then return null; end if;
 select id into target from public.glb_profiles where user_id=p_recipient;
 if target is null or target=auth.uid() then return null; end if;
 update glb_private.transfers set status='cancelled',completed_at=now() where copy_id=c.id and status='pending' and expires_at<=now();
 if exists(select 1 from glb_private.transfers where copy_id=c.id and status='pending') then return null; end if;
 insert into glb_private.transfers(copy_id,sender,recipient) values(c.id,auth.uid(),target) returning id into tid;
 return tid;
end; $$;
create or replace function public.glb_accept_transfer(p_transfer uuid) returns boolean language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare t glb_private.transfers; c glb_private.copies; fresh_code text;
begin
 perform glb_private.recent_auth();
 -- Always lock copy before transfer: same order as request/cancel.
 select c.* into c from glb_private.copies c join glb_private.transfers t on t.copy_id=c.id where t.id=p_transfer and t.recipient=auth.uid() for update of c;
 if not found then return false; end if;
 select * into t from glb_private.transfers where id=p_transfer for update;
 if t.status<>'pending' or t.expires_at<=now() or c.owner_id<>t.sender then return false; end if;
 loop
  fresh_code:=glb_private.card_code();
  if fresh_code=c.code then continue; end if;
  begin update glb_private.copies set owner_id=t.recipient,code=fresh_code where id=c.id; exit;
  exception when unique_violation then null; end;
 end loop;
 update glb_private.transfers set status='accepted',completed_at=now() where id=t.id;
 insert into glb_private.ownership_history(copy_id,from_owner,to_owner,transfer_id) values(c.id,t.sender,t.recipient,t.id);
 return true;
end; $$;
create or replace function public.glb_cancel_transfer(p_transfer uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform 1 from glb_private.copies c join glb_private.transfers t on t.copy_id=c.id where t.id=p_transfer and t.sender=auth.uid() for update of c;
 update glb_private.transfers set status='cancelled',completed_at=now() where id=p_transfer and sender=auth.uid() and status='pending';
 return found;
end; $$;
create or replace function public.glb_my_transfers() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'copy_id',t.copy_id,'sender',a.user_id,'recipient',b.user_id,'incoming',t.recipient=auth.uid(),'status',t.status,'expires_at',t.expires_at)),'[]')
 from glb_private.transfers t join public.glb_profiles a on a.id=t.sender join public.glb_profiles b on b.id=t.recipient where t.sender=auth.uid() or t.recipient=auth.uid();
$$;
create or replace function public.glb_collecting_ready() returns integer language sql stable set search_path='' as $$ select 1; $$;
revoke all on function glb_private.card_code(),glb_private.freeze_release(),glb_private.guard_editions(),glb_private.check_inventory(),glb_private.award(uuid,text,text),glb_private.collect_contribution(),glb_private.recent_auth() from public,anon,authenticated;
revoke all on function public.glb_open_pack(uuid),public.glb_collect_visit(),public.glb_my_album(),public.glb_card_secret(uuid),public.glb_discovery(),public.glb_request_transfer(uuid,text,text),public.glb_collecting_ready() from public;
grant execute on function public.glb_open_pack(uuid),public.glb_collect_visit(),public.glb_my_album(),public.glb_card_secret(uuid),public.glb_request_transfer(uuid,text,text) to authenticated;
revoke all on function public.glb_accept_transfer(uuid),public.glb_cancel_transfer(uuid),public.glb_my_transfers() from public;
grant execute on function public.glb_accept_transfer(uuid),public.glb_cancel_transfer(uuid),public.glb_my_transfers() to authenticated;
grant execute on function public.glb_discovery(),public.glb_collecting_ready() to anon,authenticated;
-- Restore pre-existing account function permissions after the private-schema revoke.
grant execute on function glb_private.is_board() to authenticated;
commit;
