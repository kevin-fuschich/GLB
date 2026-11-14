import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const seedPath=new URL('../../data/collecting/checklist-2026.seed.json',import.meta.url);
if(!existsSync(seedPath))execFileSync('python',['scripts/build-checklist.py'],{cwd:new URL('../../',import.meta.url)});
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
alter default privileges in schema public grant execute on functions to anon,authenticated;
create table auth.users(id uuid primary key,email text);create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;grant usage on schema auth to authenticated,anon;`);
for(const f of ['glb-accounts.sql','glb-collecting.sql','glb-checklist.sql'])await db.exec(await readFile(new URL('../../supabase/'+f,import.meta.url),'utf8'));
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',sid='00000000-0000-4000-8000-000000000003';
await db.query(`insert into auth.users values($1,'a@example.invalid'),($2,'b@example.invalid')`,[a,b]);
await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid,a]);
await db.query('insert into glb_private.board_members values($1)',[a]);
const seed=JSON.parse(await readFile(new URL('../../data/collecting/checklist-2026.seed.json',import.meta.url),'utf8'));
await db.query('insert into public.glb_sets(id,title,season,cards_per_pack) values($1,$2,$3,$4)',Object.values(seed.set));
for(const [table,rows]of [['glb_checklist_cards',seed.cards],['glb_checklist_variants',seed.variants]]){
 const fields=Object.keys(rows[0]).join(',');await db.query(`insert into public.${table} (${fields}) select ${fields} from jsonb_populate_recordset(null::public.${table},$1::jsonb) on conflict do nothing`,[JSON.stringify(rows)]);
}
assert.equal((await db.query('select count(*) as n from public.glb_checklist_cards')).rows[0].n,376);
async function as(uid,role='authenticated'){await db.exec('reset role');await db.query('update auth.sessions set user_id=$1',[uid||a]);await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[uid||'',JSON.stringify({session_id:sid})]);await db.exec('set role '+role);}
await as(null,'anon');await assert.rejects(()=>db.query('select * from public.glb_checklist_cards'));await assert.rejects(()=>db.query('select public.glb_checklist_sets()'));
await as(b);assert.equal((await db.query('select * from public.glb_checklist_cards')).rows.length,0);await assert.rejects(()=>db.query("select public.glb_update_checklist_card('FS26-0001',1,'forged','planned','approved','')"));
await as(a);assert.equal((await db.query('select * from public.glb_checklist_cards')).rows.length,376);
assert.equal((await db.query("select public.glb_update_checklist_card('FS26-0001',1,'Updated bio','planned','needs_review','Review birth date') as v")).rows[0].v,2);
await assert.rejects(()=>db.query("select public.glb_update_checklist_card('FS26-0001',1,'Stale edit','planned','approved','')"));
await assert.rejects(()=>db.query("select public.glb_save_checklist_variant('FS26-0001','Base',1,1001,'front.webp','back.webp','approved','')"));
await assert.rejects(()=>db.query("select public.glb_save_checklist_variant('FS26-0001','Base',1,1000,'front.webp','','approved','')"));
await db.query("select public.glb_save_checklist_variant('FS26-0001','Base',1,1000,'front.webp','back.webp','approved','')");
assert.equal((await db.query('select count(*) as n from public.glb_editions')).rows[0].n,0);assert.equal((await db.query('select count(*) as n from public.glb_packs')).rows[0].n,0);
console.log('PASS: 376 seeded records, draft privacy, Board-only edits, revision conflicts, quantity bounds, artwork approval requirements, no editions or inventory minted.');await db.close();
