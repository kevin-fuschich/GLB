-- GLB accounts and moderated collaboration. Run this complete file in Supabase SQL Editor.
-- Additive setup: no existing submissions, claims, users or artwork are deleted.
begin;
create schema if not exists glb_private;
revoke all on schema glb_private from public;

create table if not exists public.glb_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id text not null unique check (user_id ~ '^[a-z0-9_]{3,24}$'),
  created_at timestamptz not null default now(),
  check (user_id not in ('admin','administrator','board','glb','commissioner','support','moderator'))
);
create table if not exists glb_private.board_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.glb_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  user_id text not null,
  kind text not null check (kind in ('claim','note','pitch')),
  artifact_id text,
  artifact_name text not null check (length(artifact_name) between 1 and 160),
  club_slug text not null default 'league-wide',
  artifact_type text not null default 'other',
  body text not null check (length(body) between 20 and 10000),
  supporting_link text not null default '',
  collaboration_requested boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (kind = 'pitch' or (artifact_id is not null and length(artifact_id) between 1 and 120)),
  check (supporting_link = '' or (supporting_link ~ '^https?://' and length(supporting_link) <= 2048))
);
create index if not exists glb_submissions_owner on public.glb_submissions(owner_id,created_at desc);
create unique index if not exists glb_pending_claim on public.glb_submissions(owner_id,artifact_id) where kind='claim' and status='pending';
create table if not exists public.glb_claims (
  artifact_id text primary key,
  submission_id uuid not null unique references public.glb_submissions(id),
  owner_id uuid not null references auth.users(id),
  user_id text not null,
  artifact_name text not null,
  club_slug text not null,
  artifact_type text not null,
  body text not null,
  collaboration_open boolean not null default false,
  approved_at timestamptz not null default now()
);
create index if not exists glb_claims_owner on public.glb_claims(owner_id);
create table if not exists public.glb_notes (
  id uuid primary key default gen_random_uuid(),
  artifact_id text not null references public.glb_claims(artifact_id),
  submission_id uuid not null unique references public.glb_submissions(id),
  contributor_id uuid not null references auth.users(id),
  user_id text not null,
  body text not null,
  approved_at timestamptz not null default now()
);
create index if not exists glb_notes_artifact on public.glb_notes(artifact_id,approved_at);
create table if not exists public.glb_claim_receipts (
  submission_id uuid primary key references public.glb_submissions(id),
  owner_id uuid not null references auth.users(id),
  claim_code text not null unique check (claim_code ~ '^[A-F0-9]{16}$')
);

alter table public.glb_profiles enable row level security;
alter table glb_private.board_members enable row level security;
alter table public.glb_submissions enable row level security;
alter table public.glb_claims enable row level security;
alter table public.glb_notes enable row level security;
alter table public.glb_claim_receipts enable row level security;
revoke all on public.glb_profiles,public.glb_submissions,public.glb_claims,public.glb_notes,public.glb_claim_receipts from anon,authenticated;
revoke all on glb_private.board_members from anon,authenticated;
grant select,insert on public.glb_profiles to authenticated;
grant select on public.glb_submissions,public.glb_claim_receipts to authenticated;
grant select on public.glb_claims,public.glb_notes to anon,authenticated;
grant all on public.glb_profiles,public.glb_submissions,public.glb_claims,public.glb_notes,public.glb_claim_receipts to service_role;

create or replace function glb_private.is_board() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from glb_private.board_members where user_id=(select auth.uid()));
$$;
revoke all on function glb_private.is_board() from public;
grant usage on schema glb_private to authenticated;
grant execute on function glb_private.is_board() to authenticated;

drop policy if exists glb_profile_self_read on public.glb_profiles;
create policy glb_profile_self_read on public.glb_profiles for select to authenticated using(id=(select auth.uid()));
drop policy if exists glb_profile_self_create on public.glb_profiles;
create policy glb_profile_self_create on public.glb_profiles for insert to authenticated with check(id=(select auth.uid()));
drop policy if exists glb_submission_read on public.glb_submissions;
create policy glb_submission_read on public.glb_submissions for select to authenticated using(owner_id=(select auth.uid()) or (select glb_private.is_board()));
drop policy if exists glb_public_claims on public.glb_claims;
create policy glb_public_claims on public.glb_claims for select to anon,authenticated using(true);
drop policy if exists glb_public_notes on public.glb_notes;
create policy glb_public_notes on public.glb_notes for select to anon,authenticated using(true);
drop policy if exists glb_private_receipts on public.glb_claim_receipts;
create policy glb_private_receipts on public.glb_claim_receipts for select to authenticated using(owner_id=(select auth.uid()));

-- User IDs are chosen once. There is no client UPDATE privilege on profiles.
create or replace function public.glb_submit(
  p_kind text,p_artifact_id text,p_artifact_name text,p_club_slug text,
  p_artifact_type text,p_body text,p_supporting_link text default '',p_collaboration boolean default false
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_user_id text; v_id uuid; v_claim public.glb_claims;
begin
  if v_user is null then raise exception 'Sign in to contribute'; end if;
  select user_id into v_user_id from public.glb_profiles where id=v_user;
  if v_user_id is null then raise exception 'Choose your public User ID first'; end if;
  if p_kind not in ('claim','note','pitch') then raise exception 'Invalid contribution type'; end if;
  if length(trim(p_body)) not between 20 and 10000 then raise exception 'Write between 20 and 10000 characters'; end if;
  if length(trim(p_artifact_name)) not between 1 and 160 then raise exception 'An artifact name is required'; end if;
  if length(coalesce(p_club_slug,''))>100 or length(coalesce(p_artifact_type,''))>60 then raise exception 'Invalid artifact details'; end if;
  -- Serializes the per-user rate check without blocking other contributors.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  if exists(select 1 from public.glb_submissions where owner_id=v_user and created_at>now()-interval '15 seconds') then raise exception 'Please wait a moment before submitting again'; end if;
  if (select count(*) from public.glb_submissions where owner_id=v_user and created_at>now()-interval '24 hours')>=10 then raise exception 'Daily contribution limit reached'; end if;
  if p_kind='claim' and exists(select 1 from public.glb_claims where artifact_id=p_artifact_id) then raise exception 'This artifact is already claimed'; end if;
  if p_kind='note' then
    select * into v_claim from public.glb_claims where artifact_id=p_artifact_id for share;
    if not found or not v_claim.collaboration_open then raise exception 'This artifact is closed to collaboration'; end if;
  end if;
  insert into public.glb_submissions(owner_id,user_id,kind,artifact_id,artifact_name,club_slug,artifact_type,body,supporting_link,collaboration_requested)
  values(v_user,v_user_id,p_kind,nullif(trim(p_artifact_id),''),trim(p_artifact_name),coalesce(nullif(p_club_slug,''),'league-wide'),coalesce(nullif(p_artifact_type,''),'other'),trim(p_body),coalesce(trim(p_supporting_link),''),p_kind='claim' and coalesce(p_collaboration,false)) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.glb_submit(text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.glb_submit(text,text,text,text,text,text,text,boolean) to authenticated;

create or replace function public.glb_set_collaboration(p_artifact_id text,p_open boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_open is null then raise exception 'Choose open or closed'; end if;
  update public.glb_claims set collaboration_open=p_open where artifact_id=p_artifact_id and owner_id=auth.uid();
  if not found then raise exception 'Only the original claimant can change collaboration'; end if;
  return p_open;
end;
$$;
revoke all on function public.glb_set_collaboration(text,boolean) from public;
grant execute on function public.glb_set_collaboration(text,boolean) to authenticated;

-- Approval is available only to explicitly assigned Board accounts, service_role,
-- or the database owner in the SQL Editor. No profile field can grant Board access.
create or replace function public.glb_review_submission(p_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare s public.glb_submissions; c public.glb_claims;
begin
  if not (glb_private.is_board() or coalesce(auth.role(),'')='service_role' or
    (auth.uid() is null and session_user in ('postgres','supabase_admin') and current_setting('role',true) in ('none','postgres'))) then
    raise exception 'Board access required';
  end if;
  if p_accept is null then raise exception 'Choose accept or decline'; end if;
  select * into s from public.glb_submissions where id=p_id for update;
  if not found or s.status<>'pending' then raise exception 'Submission is not pending review'; end if;
  if p_accept and s.kind='claim' then
    insert into public.glb_claims(artifact_id,submission_id,owner_id,user_id,artifact_name,club_slug,artifact_type,body,collaboration_open)
    values(s.artifact_id,s.id,s.owner_id,s.user_id,s.artifact_name,s.club_slug,s.artifact_type,s.body,s.collaboration_requested);
    insert into public.glb_claim_receipts(submission_id,owner_id,claim_code)
    values(s.id,s.owner_id,upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)));
  elsif p_accept and s.kind='note' then
    select * into c from public.glb_claims where artifact_id=s.artifact_id for update;
    if not found or not c.collaboration_open then raise exception 'Collaboration is closed; this note cannot be approved'; end if;
    insert into public.glb_notes(artifact_id,submission_id,contributor_id,user_id,body) values(s.artifact_id,s.id,s.owner_id,s.user_id,s.body);
  end if;
  update public.glb_submissions set status=case when p_accept then 'approved' else 'declined' end,reviewed_at=now() where id=p_id;
end;
$$;
revoke all on function public.glb_review_submission(uuid,boolean) from public;
grant execute on function public.glb_review_submission(uuid,boolean) to authenticated,service_role;

create or replace function public.glb_account_ready() returns integer
language sql stable set search_path='' as $$ select 1; $$;
revoke all on function public.glb_account_ready() from public;
grant execute on function public.glb_account_ready() to anon,authenticated;
create or replace function public.glb_is_board() returns boolean
language sql stable security definer set search_path='' as $$ select glb_private.is_board(); $$;
revoke all on function public.glb_is_board() from public;
grant execute on function public.glb_is_board() to authenticated;
commit;
-- Setup is complete. No Board account is assigned until the owner signs in.
