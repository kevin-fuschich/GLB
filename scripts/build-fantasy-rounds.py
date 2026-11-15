"""Build replay pools from existing GLB box scores. Never synthesize a result."""
import json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
catalog=json.loads((ROOT/'data/cards/production-2026.json').read_text())['players']
players={c['subject_key'].removeprefix('player/'):c for c in catalog}
def points(b,role):
 if role=='pitcher':return int(b.get('IP_outs',0))+int(b.get('K',0))-2*int(b.get('ER',0))+5*int(b.get('W',0))+3*int(b.get('SV',0))
 return int(b.get('H',0))+int(b.get('2B',0))+2*int(b.get('3B',0))+3*int(b.get('HR',0))+int(b.get('R',0))+int(b.get('RBI',0))+int(b.get('BB',0))+2*int(b.get('SB',0))
rounds=[]
for date in ['2026-04-09','2026-04-10','2026-04-11']:
 pool=[];games=[]
 for path in sorted((ROOT/'data/games'/date).glob('*.json')):
  game=json.loads(path.read_text())
  if game.get('schema')!='glb.boxscore.v1' or game.get('status','').lower()!='final':continue
  games.append({'game_id':game['game_id'],'away':game['away']['name'],'home':game['home']['name'],'source':str(path.relative_to(ROOT))})
  for side in ['away','home']:
   team=game[side]['slug']
   for kind,role in [('batting','hitter'),('pitching','pitcher')]:
    for line in game[kind][side]:
     key=team+'/'+line['player'];record=players.get(key)
     if not record:continue
     f=record['facts'];is_pitcher=f.get('position') in ['SP','RP','CL','P']
     if is_pitcher!=(role=='pitcher'):continue
     stats=dict(line)
     if role=='pitcher':stats['W']=int(game.get('decisions',{}).get('W')==line['player']);stats['SV']=int(game.get('decisions',{}).get('SV')==line['player'])
     price=(24 if role=='pitcher' else 12)+(int(hashlib.sha256(key.encode()).hexdigest()[:8],16)%13)
     pool.append({'id':key,'card_id':record['id'],'name':record['subject_name'],'team_slug':team,'team_name':record['team_name'],'position':f.get('position',''),'role':role,'cost':price,'photo':record['source_image'],'photo_crop':record['photo_crop'],'note':f.get('field_note',f.get('factoid','')),'points':points(stats,role),'line':{k:v for k,v in stats.items()if k not in ['player','name','position']},'source':str(path.relative_to(ROOT))})
 assert len({p['id']for p in pool})==len(pool),'Duplicate player in round'
 if not pool:continue
 data={'id':'nightshift-'+date,'title':'A night around the world','game_date':date,'mode':'replay','budget':100,'max_per_club':2,'pool':pool,'games':games,'scoring':{'hitter':'Total bases + runs + RBI + walks + 2×steals','pitcher':'Outs + strikeouts − 2×earned runs + 5×wins + 3×saves'}}
 (ROOT/'data/fantasy'/(date+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');rounds.append({k:data[k]for k in ['id','title','game_date','mode']})
(ROOT/'data/fantasy/rounds.json').write_text(json.dumps(rounds,indent=2)+'\n')
print(json.dumps({'rounds':len(rounds),'players_per_round':[len(json.loads((ROOT/'data/fantasy'/(r['game_date']+'.json')).read_text())['pool'])for r in rounds]}))
