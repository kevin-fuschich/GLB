-- Additive, Board-only editorial catalog. It never releases a set or creates copies.
begin;
create table if not exists public.glb_checklist_cards (
 id text primary key,
 set_id text not null references public.glb_sets(id),
 card_number integer not null check(card_number>0),
 subject_key text not null,
 subject_type text not null,
 subject_name text not null check(length(subject_name) between 1 and 160),
 team_slug text, team_name text,
 claim_artifact_id text,
 inclusion text not null default 'candidate' check(inclusion in ('planned','candidate','excluded')),
 bio text not null default '',
 facts jsonb not null default '{}' check(jsonb_typeof(facts)='object'),
 statistics jsonb not null default '{}' check(jsonb_typeof(statistics)='object'),
 source_image text,
 source_details jsonb not null default '{}' check(jsonb_typeof(source_details)='object'),
 content_status text not null default 'needs_review' check(content_status in ('missing','needs_review','approved')),
 notes text not null default '',
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 unique(set_id,subject_key),unique(set_id,card_number)
);
create table if not exists public.glb_checklist_variants (
 id text primary key,
 card_id text not null references public.glb_checklist_cards(id),
 variant text not null check(length(variant) between 1 and 60),
 print_quantity integer check(print_quantity between 1 and 1000),
 front_image text,back_image text,
 artwork_status text not null default 'missing' check(artwork_status in ('missing','in_progress','needs_review','approved')),
 notes text not null default '',
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 unique(card_id,variant)
);
create index if not exists glb_checklist_set on public.glb_checklist_cards(set_id);
create index if not exists glb_checklist_team on public.glb_checklist_cards(team_slug);
create index if not exists glb_checklist_variant_card on public.glb_checklist_variants(card_id);
alter table public.glb_checklist_cards enable row level security;
alter table public.glb_checklist_variants enable row level security;
revoke all on public.glb_checklist_cards,public.glb_checklist_variants from public,anon,authenticated;
grant select on public.glb_checklist_cards,public.glb_checklist_variants to authenticated;
create policy checklist_board_read on public.glb_checklist_cards for select to authenticated using((select glb_private.is_board()));
create policy checklist_variants_board_read on public.glb_checklist_variants for select to authenticated using((select glb_private.is_board()));
-- Keep working set metadata private with the rest of the unreleased checklist.
create or replace function public.glb_checklist_sets() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform glb_private.require_session();
 if not glb_private.is_board() then raise exception 'Board access required';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'season',season,'release_at',release_at) order by season desc,id),'[]') from public.glb_sets);
end; $$;
create or replace function glb_private.checklist_guard() returns trigger language plpgsql set search_path='' as $$
declare sid text;
begin
 if TG_TABLE_NAME='glb_checklist_cards' then sid:=old.set_id;
 else select set_id into sid from public.glb_checklist_cards where id=old.card_id;end if;
 if exists(select 1 from public.glb_sets where id=sid and release_at is not null) then raise exception 'This set is frozen. Create a new edition for future changes.';end if;
 if TG_OP='DELETE' then raise exception 'Keep the checklist history; exclude the entry instead';end if;
 new.revision:=old.revision+1;new.updated_at:=now();return new;
end; $$;
create trigger checklist_card_guard before update or delete on public.glb_checklist_cards for each row execute function glb_private.checklist_guard();
create trigger checklist_variant_guard before update or delete on public.glb_checklist_variants for each row execute function glb_private.checklist_guard();
create or replace function public.glb_update_checklist_card(p_id text,p_revision integer,p_bio text,p_inclusion text,p_content_status text,p_notes text) returns integer language plpgsql security definer set search_path='' as $$
declare updated integer;
begin
 perform glb_private.require_session();if not glb_private.is_board() then raise exception 'Board access required';end if;
 if length(p_bio)>12000 or length(p_notes)>5000 then raise exception 'Entry is too long';end if;
 if p_content_status='approved' and (length(trim(p_bio))=0 or exists(select 1 from public.glb_checklist_cards where id=p_id and subject_type='player' and statistics='{}'::jsonb)) then raise exception 'A biography and player statistics are required before content approval';end if;
 update public.glb_checklist_cards set bio=p_bio,inclusion=p_inclusion,content_status=p_content_status,notes=p_notes where id=p_id and revision=p_revision returning revision into updated;
 if not found then raise exception 'This entry changed. Reload before saving.';end if;return updated;
end; $$;
create or replace function public.glb_save_checklist_variant(p_card_id text,p_variant text,p_revision integer,p_quantity integer,p_front text,p_back text,p_status text,p_notes text) returns text language plpgsql security definer set search_path='' as $$
declare cid text; sid text; row_id text;
begin
 perform glb_private.require_session();if not glb_private.is_board() then raise exception 'Board access required';end if;
 select id,set_id into cid,sid from public.glb_checklist_cards where id=p_card_id for update;
 if cid is null then raise exception 'Card not found';end if;
 if exists(select 1 from public.glb_sets where id=sid and release_at is not null) then raise exception 'This set is frozen';end if;
 if length(p_notes)>5000 then raise exception 'Notes are too long';end if;
 if coalesce(p_front,'')<>'' and (p_front !~ '^[A-Za-z0-9][A-Za-z0-9_./-]*$' or p_front like '%..%') then raise exception 'Use a project artwork path';end if;
 if coalesce(p_back,'')<>'' and (p_back !~ '^[A-Za-z0-9][A-Za-z0-9_./-]*$' or p_back like '%..%') then raise exception 'Use a project artwork path';end if;
 if p_status='approved' and (nullif(p_front,'') is null or nullif(p_back,'') is null) then raise exception 'Both physical card images are required for artwork approval';end if;
 if p_revision=0 then
  row_id:=gen_random_uuid()::text;
  insert into public.glb_checklist_variants(id,card_id,variant,print_quantity,front_image,back_image,artwork_status,notes) values(row_id,cid,trim(p_variant),p_quantity,nullif(p_front,''),nullif(p_back,''),p_status,p_notes);
 else
  update public.glb_checklist_variants set print_quantity=p_quantity,front_image=nullif(p_front,''),back_image=nullif(p_back,''),artwork_status=p_status,notes=p_notes where card_id=cid and variant=p_variant and revision=p_revision returning id into row_id;
  if not found then raise exception 'This variant changed. Reload before saving.';end if;
 end if;return row_id;
end; $$;
revoke all on function glb_private.checklist_guard() from public,anon,authenticated;
revoke all on function public.glb_checklist_sets(),public.glb_update_checklist_card(text,integer,text,text,text,text),public.glb_save_checklist_variant(text,text,integer,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.glb_checklist_sets(),public.glb_update_checklist_card(text,integer,text,text,text,text),public.glb_save_checklist_variant(text,text,integer,integer,text,text,text,text) to authenticated;
commit;
