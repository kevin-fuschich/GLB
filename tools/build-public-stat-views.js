const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'data/generated-preview');
const read = name => JSON.parse(fs.readFileSync(path.join(DIR,name),'utf8'));
const write = (name,data) => fs.writeFileSync(path.join(DIR,name),JSON.stringify(data,null,2)+'\n');

function key(row){ return `${row.team}::${row.player}`; }
function visibleValue(field, row, pop, advanced){
  if (pop.visibility && pop.visibility[field] === false) return null;
  if (Object.prototype.hasOwnProperty.call(row, field)) return row[field];
  if (advanced && Object.prototype.hasOwnProperty.call(advanced, field)) return advanced[field];
  return null;
}

function main(){
  const batting = read('batting.json');
  const pitching = read('pitching.json');
  const population = read('player-population.json');
  const popMap = new Map(population.map(p=>[`${p.team}::${p.player}`,p]));

  const publicBatting = batting.map(row=>{
    const pop=popMap.get(key(row));
    if(!pop) return null;
    const fields=['G','AB','R','H','2B','3B','HR','RBI','BB','K','SB','TB','AVG','OBP','SLG','OPS','PA','ISO','BABIP','OPS_PLUS','WRC_PLUS'];
    const stats={}; for(const f of fields) stats[f]=visibleValue(f,row,pop,pop.advanced);
    return {player:row.player,name:pop.name,team:row.team,position:pop.position,talent_tier:pop.talent_tier,completeness:pop.completeness,stats};
  }).filter(Boolean);

  const publicPitching = pitching.map(row=>{
    const pop=popMap.get(key(row));
    if(!pop) return null;
    const fields=['G','GS','IP','W','L','SV','H','R','ER','BB','K','HR','ERA','WHIP','K9','BB9','HR9','FIP'];
    const stats={}; for(const f of fields) stats[f]=visibleValue(f,row,pop,pop.advanced);
    return {player:row.player,name:pop.name,team:row.team,position:pop.position,talent_tier:pop.talent_tier,completeness:pop.completeness,stats};
  }).filter(Boolean);

  write('batting-public.json',publicBatting);
  write('pitching-public.json',publicPitching);

  const nullCount = rows => rows.reduce((n,r)=>n+Object.values(r.stats).filter(v=>v===null).length,0);
  console.log(`Public batting view: ${publicBatting.length} players; ${nullCount(publicBatting)} intentionally unexposed secondary fields.`);
  console.log(`Public pitching view: ${publicPitching.length} players; ${nullCount(publicPitching)} intentionally unexposed secondary fields.`);
  console.log('Underlying batting.json and pitching.json remain complete and authoritative for generated totals.');
}
main();
