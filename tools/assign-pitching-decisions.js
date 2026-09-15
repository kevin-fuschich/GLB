const fs=require('fs');
const path=require('path');
const ROOT=path.join(__dirname,'..');
const DIR=path.join(ROOT,'data/generated-preview');
const read=n=>JSON.parse(fs.readFileSync(path.join(DIR,n),'utf8'));
const write=(n,d)=>fs.writeFileSync(path.join(DIR,n),JSON.stringify(d,null,2)+'\n');
const key=(team,player)=>`${team}::${player}`;

const boxscores=read('boxscores.json');
const pitching=read('pitching.json');
const leaders=read('leaders.json');
const pmap=new Map(pitching.map(p=>[key(p.team,p.player),p]));
for(const p of pitching){p.W=0;p.L=0;p.SV=0;}

function ledAndNeverLost(g,team,through){
  let a=0,h=0;
  for(let i=0;i<g.linescore.innings.length;i++){
    const inn=g.linescore.innings[i]; a+=inn.away; h+=inn.home;
    if(i+1===through){
      const lead=team===g.away.slug?a-h:h-a;
      if(lead<=0)return false;
    }
    if(i+1>through){
      const lead=team===g.away.slug?a-h:h-a;
      if(lead<=0)return false;
    }
  }
  return true;
}

for(const g of boxscores){
  const awayRuns=g.linescore.totals.away.R, homeRuns=g.linescore.totals.home.R;
  const winner=awayRuns>homeRuns?g.away.slug:g.home.slug;
  const loser=winner===g.away.slug?g.home.slug:g.away.slug;
  const wSide=winner===g.away.slug?'away':'home', lSide=loser===g.away.slug?'away':'home';
  const wPitchers=g.pitching[wSide], lPitchers=g.pitching[lSide];
  const wStarter=wPitchers[0]?.player, lStarter=lPitchers[0]?.player;
  const wLast=wPitchers[wPitchers.length-1]?.player||wStarter, lLast=lPitchers[lPitchers.length-1]?.player||lStarter;
  const wDecision=ledAndNeverLost(g,winner,6)?wStarter:wLast;
  const lDecision=ledAndNeverLost(g,winner,6)?lStarter:lLast;
  const margin=Math.abs(awayRuns-homeRuns);
  const save=(wLast&&wLast!==wDecision&&margin<=3)?wLast:null;
  g.decisions={W:wDecision,L:lDecision,SV:save};
  if(wDecision&&pmap.has(key(winner,wDecision)))pmap.get(key(winner,wDecision)).W++;
  if(lDecision&&pmap.has(key(loser,lDecision)))pmap.get(key(loser,lDecision)).L++;
  if(save&&pmap.has(key(winner,save)))pmap.get(key(winner,save)).SV++;
}

const top=(arr,f,asc=false,n=10)=>[...arr].filter(x=>Number.isFinite(x[f])).sort((a,b)=>asc?a[f]-b[f]:b[f]-a[f]).slice(0,n).map(x=>({player:x.player,team:x.team,value:x[f]}));
leaders.pitching.W=top(pitching,'W');
leaders.pitching.SV=top(pitching,'SV');
write('boxscores.json',boxscores);
write('pitching.json',pitching);
write('leaders.json',leaders);
console.log('Pitching decisions recalculated from game state; starter wins/losses and saves redistributed.');
