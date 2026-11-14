"""Recover published GLB copy, then create clearly marked editorial drafts for gaps."""
from pathlib import Path
import json,re,html
root=Path(__file__).resolve().parent.parent
seed=json.loads((root/'data/collecting/checklist-2026.seed.json').read_text());cache=root/'data/collecting/draft-content-2026.json';drafts=json.loads(cache.read_text()) if cache.exists() else {}
positions={'SP':'starting pitcher','RP':'relief pitcher','CL':'closer','P':'pitcher','C':'catcher','1B':'first baseman','2B':'second baseman','3B':'third baseman','SS':'shortstop','LF':'left fielder','CF':'center fielder','RF':'right fielder','OF':'outfielder','DH':'designated hitter','UTIL':'utility player'}
role_drafts={
 'broadcaster':['{name} is the broadcast voice of {team}, following the club from the first pitch through the final out. The role pairs play-by-play with the everyday stories that make a season worth following.','On the broadcast for {team}, {name} gives the game room to breathe: the count, the field and the moment before the next pitch.'],
 'announcer':['{name} is the in-park announcer for {team}. Lineups, substitutions and the rhythm between innings are part of a voice built to carry across the ballpark.','From pregame introductions to the last lineup change, {name} is part of how a home game sounds for {team}.'],
 'mascot':['{name} belongs to the public life of {team}: the concourse encounters, the section visits and the moments fans remember between plays.','The {team} game-day record includes {name}, a character whose place in the club is built one encounter with the crowd at a time.'],
 'ballpark':['{name} is part of the home-ground identity of {team}. Its entrances, stands and gathering places give the club a setting that continues beyond the game itself.'],
 'entertainer':['{name} is part of the live entertainment surrounding {team}. The performance belongs to the ballpark’s wider world, alongside the game and the crowd.'],
 'donk_driver':['{name} represents {team} in GLB’s DONK world. The driver’s record brings the person behind the wheel into focus alongside the build, presentation and competition.'],
 'donk_vehicle':['{name} is a vehicle in the DONK record associated with {team}. Its appearance and build are recorded separately from the person who drives it.'],
 'tradition':['{name} is part of how supporters experience {team}. The ritual belongs to the club’s living record, with room for accounts from the people who take part.'],
 'brand':['{name} is a brand within the world surrounding {team}. Its presence is part of the club’s sponsorship and ballpark record.'],
 'giveaway':['{name} is a collectible giveaway associated with {team}, preserving a small part of the experience of being at the park.'],
 'other':['{name} is an artifact in the wider record of {team}. It connects the club’s baseball story with the people, objects and events around it.']}
for index,c in enumerate(seed['cards']):
 if c['bio'].strip():continue
 name=c['subject_name'];team=c['team_name'] or 'Global League Baseball';subject=c['subject_type'];bio=None;source=None
 candidates=[root/('team-'+str(c['team_slug'])+'.html'),root/('club-'+str(c['team_slug'])+'.html')]
 explicit=c['source_details'].get('record_path')
 if explicit and not explicit.startswith(('http','/')):candidates.insert(0,root/explicit)
 for file in candidates:
  if not file.is_file():continue
  paras=[]
  for p in re.findall(r'<p\b[^>]*>(.*?)</p>',file.read_text(),re.S|re.I):
   text=html.unescape(re.sub('<[^>]+>',' ',p));text=re.sub(r'\s+',' ',text).strip()
   if name.casefold() in text.casefold() and 45<len(text)<1100 and not re.search(r'claim|submit|16.character|flip|unclaimed|approved|click',text,re.I):paras.append(text)
  if paras:bio=max(paras,key=len);source=str(file.relative_to(root));break
 if not bio and subject=='player':
  f=c['facts'];position=positions.get(f.get('position'),f.get('position','player'));bat=c['statistics'].get('batting',{});pitch=c['statistics'].get('pitching',{})
  if f.get('position') in ('SP','RP','CL','P'):
   bio=f"{name} is a {position} for {team}. The 2026 record shows {pitch.get('G',0)} appearances and {pitch.get('IP','0.0')} innings, with {pitch.get('K',0)} strikeouts."
   if pitch.get('ERA') is not None:bio+=f" The season ERA was {float(pitch['ERA']):.2f}."
  else:
   bio=f"{name} plays {position} for {team}. His 2026 season included {bat.get('G',0)} games, {bat.get('H',0)} hits and {bat.get('HR',0)} home runs, with {bat.get('RBI',0)} runs batted in."
   if bat.get('AVG')is not None:bio+=f" The final line includes a {bat['AVG']} batting average."
  source='data/season/player-stats.json'
 if not bio:
  templates=role_drafts.get(subject,role_drafts['other']);bio=templates[index%len(templates)].format(name=name,team=team);source='editorial role draft'
 drafts[c['subject_key']]={'bio':bio,'provenance':source,'review_required':True,'draft_kind':'recovered_copy' if source.endswith('.html')else 'statistics_based_draft' if subject=='player' else 'role_description_draft'}
(root/'data/collecting/draft-content-2026.json').write_text(json.dumps(drafts,ensure_ascii=False,indent=2)+'\n')
print('Gap entries filled:',len(drafts));print('Recovered published copy:',sum(d['draft_kind']=='recovered_copy'for d in drafts.values()))
