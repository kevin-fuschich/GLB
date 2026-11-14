"""Build the initial draft checklist from canonical local GLB records; never invent facts.
Existing numbers are retained on reruns. Import inserts only, preserving Board edits.
"""
from pathlib import Path
import json, subprocess
ROOT=Path(__file__).resolve().parent.parent
read=lambda p: json.loads((ROOT/p).read_text())
out=ROOT/'data/collecting/checklist-2026.seed.json'
old= json.loads(out.read_text())['cards'] if out.exists() else []
team_names={p.stem:json.loads(p.read_text())['team'] for p in (ROOT/'data/rosters').glob('*.json')}
numbers={c['subject_key']:c['card_number'] for c in old};next_number=max(numbers.values(),default=0)+1
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
design=read('data/cards/fieldstock-2026.json')['players'];stats={(x['team_slug'],x['player']):x for x in read('data/season/player-stats.json')}
manifest=read('data/artifacts/collections.json');claims={}
for collection in manifest['collections']:
 d=read(collection['source'])
 for r in d.get('cards',d.get('players',[])):
  slug=r.get('player_slug',r.get('slug'));code=r.get('card_id',collection.get('card_ids',{}).get(slug))
  if code:claims[(collection['team_slug'],slug)]=code.removesuffix('-CURRENT')
resolved_images=json.loads(subprocess.check_output(['node','scripts/checklist-artwork.cjs'],cwd=ROOT,text=True))
artwork=read('data/artifacts/artwork.json');events=read('data/events/donk-2026.json')['entrants']
event_index={r['artifact_id']:(i,r) for i,r in enumerate(events)}
approved_path=ROOT/'data/collecting/approved-source-records.json'
approved={r['artifact_id']:r for r in (json.loads(approved_path.read_text()) if approved_path.exists() else [])}
draft_path=ROOT/'data/collecting/draft-content-2026.json'
drafts=json.loads(draft_path.read_text()) if draft_path.exists() else {}
rows=[];variants=[]
def add(subject_key,name,kind,team,team_name,claim_id,bio,facts,statistics,source_image,source_details,inclusion,front=None):
 global next_number
 team_name=team_names.get(team,team_name)
 if subject_key not in numbers:numbers[subject_key]=next_number;next_number+=1
 n=numbers[subject_key];cid=f'FS26-{n:04d}'
 draft=drafts.get(subject_key)
 if not bio and draft:
  bio=draft['bio'];source_details={**source_details,'editorial_draft':draft}
 contribution=approved.get(claim_id)
 if contribution:
  bio=(bio+'\n\n' if bio else '')+contribution['body']
  source_details={**source_details,'approved_contribution':contribution}
 rows.append(dict(id=cid,set_id='fieldstock-2026',card_number=n,subject_key=subject_key,subject_type=kind,subject_name=name,team_slug=team,team_name=team_name,claim_artifact_id=claim_id,inclusion=inclusion,bio=bio,facts=facts,statistics=statistics,source_image=source_image,source_details={**source_details,'source_commit':commit},content_status='needs_review' if bio else 'missing',notes=''))
 variants.append(dict(id=cid+'-base',card_id=cid,variant='Base',print_quantity=1000,front_image=front,back_image=None,artwork_status='needs_review' if front else 'missing',notes='Draft proposal: Base /1000. Requires editorial sign-off before release. Source photographs are not finished card artwork.'))
for p in sorted((ROOT/'data/rosters').glob('*.json')):
 roster=json.loads(p.read_text());team=p.stem
 for r in roster['players']:
  slug=r['slug'];d={**design.get(team+'/'+slug,{}),**r};record=stats.get((team,slug),{})
  bio=d.get('bio') or d.get('biography') or d.get('scouting_report') or d.get('factoid') or d.get('field_note') or ''
  facts={k:d[k] for k in ['position','dob','birthplace','height','weight','bats','throws','age','factoid','field_note'] if k in d}
  resolved=resolved_images.get(team+'/'+slug,{})
  photo=resolved.get('path') or d.get('photo_source')
  # Only accept explicit existing paths. Bare filenames need artwork mapping review.
  if photo and not (ROOT/photo).is_file():photo=None
  add('player/'+team+'/'+slug,d['name'],'player',team,roster['team'],claims.get((team,slug)) or d.get('card_id'),bio,facts,{k:record[k] for k in ['batting','pitching'] if k in record},photo,dict(roster=str(p.relative_to(ROOT)),player_slug=slug,photo_reference=d.get('photo'),photo_crop=d.get('photo_crop'),source_image_kind=resolved.get('kind'),statistics_source='data/season/player-stats.json'), 'planned')
for r in read('data/artifacts/creative-artifacts.json')['artifacts']:
 aid=r['artifact_id'];a=artwork.get(aid,{});source=a.get('src');front=None;bio='';facts={};details=dict(registry='data/artifacts/creative-artifacts.json',record_path=r.get('record_path'),section=r.get('section'),editorial_prompt=r.get('prompt'))
 if aid in event_index:
  i,e=event_index[aid];front=f'assets/events/driver-cards/d26-{i+1:03d}-tabletop.webp';bio=e.get('caption','');facts={k:e[k] for k in ['car','city','signature','win_type'] if k in e};details['event_source']='data/events/donk-2026.json'
 if front and not(ROOT/front).is_file():front=None
 if source and not(ROOT/source).is_file():source=None
 # Creative subjects are candidates until the 2026 checklist scope is selected.
 add('artifact/'+aid,r['name'],r['type'],r.get('team_slug'),r.get('team_name'),aid,bio,facts,{},source,details,'candidate',front)
assert len({r['subject_key'] for r in rows})==len(rows),'Duplicate subject'
assert len({r['id'] for r in rows})==len(rows),'Duplicate number'
seed=dict(schema='glb.checklist-seed.v1',set=dict(id='fieldstock-2026',title='FIELDSTOCK 2026',season=2026,cards_per_pack=5),cards=rows,variants=variants)
out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(seed,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(cards=len(rows),players=sum(r['subject_type']=='player' for r in rows),candidates=sum(r['inclusion']=='candidate' for r in rows),stats_available=sum(bool(r['statistics'])for r in rows if r['subject_type']=='player'),biographies_available=sum(bool(r['bio'])for r in rows),finished_front_candidates=sum(bool(v['front_image'])for v in variants),quantities_set=len(variants))))
