const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname,'..','data','generated-preview');
const read = name => JSON.parse(fs.readFileSync(path.join(DIR,name),'utf8'));
const fail = msg => { console.error(`POPULATION ERROR: ${msg}`); process.exitCode=1; };

function mean(xs){ return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0; }
function inRange(v,a,b){ return v>=a && v<=b; }

function main(){
  const players=read('player-population.json');
  const summary=read('population-summary.json');
  const batting=read('batting-public.json');
  const pitching=read('pitching-public.json');

  if(!players.length) fail('No population records generated.');
  if(!batting.length) fail('No public batting records generated.');
  if(!pitching.length) fail('No public pitching records generated.');

  const avg=mean(players.map(p=>p.completeness));
  if(!inRange(avg,.70,.80)) fail(`Overall completeness ${(avg*100).toFixed(1)}% is outside 70-80% guardrail.`);

  const targets={
    star:[.90,.98], everyday:[.80,.92], bench:[.52,.68], rotation:[.78,.90],
    'depth-starter':[.58,.74], closer:[.84,.96], 'high-leverage':[.64,.80], 'fringe-reliever':[.40,.53]
  };
  for(const [tier,range] of Object.entries(targets)){
    const rows=players.filter(p=>p.talent_tier===tier);
    if(!rows.length) continue;
    const m=mean(rows.map(p=>p.completeness));
    if(!inRange(m,range[0],range[1])) fail(`${tier} average completeness ${(m*100).toFixed(1)}% outside ${(range[0]*100).toFixed(0)}-${(range[1]*100).toFixed(0)}%.`);
  }

  const dup=new Set();
  for(const p of players){
    const k=`${p.role}:${p.team}:${p.player}`;
    if(dup.has(k)) fail(`Duplicate population role record ${k}`);
    dup.add(k);
  }

  const stars=players.filter(p=>p.talent_tier==='star').length;
  if(stars<8) fail(`Too few stars (${stars}); expected a meaningful league-wide star class.`);
  if(summary.player_records!==players.length) fail('Population summary record count does not match population file.');

  if(!process.exitCode){
    console.log(`Population validation passed: ${players.length} records, ${(avg*100).toFixed(1)}% average completeness, ${stars} stars.`);
  }
}
main();
