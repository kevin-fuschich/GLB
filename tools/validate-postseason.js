const fs=require('fs'),assert=require('assert');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const p=read('data/season/postseason-2026.json'),state=read('data/season/status.json');
const names=new Set(Object.values(read('data/teams/teams.json').divisions).flat().map(t=>t.slug));
const seen=new Set(),perDay=new Set();
for(const g of p.games){
 assert(names.has(g.home)&&names.has(g.away)&&g.home!==g.away);
 assert(!seen.has(g.id));seen.add(g.id);
 for(const t of [g.home,g.away]){assert(!perDay.has(g.date+t));perDay.add(g.date+t);}
 const box=read(g.source),innings=box.linescore.innings;
 assert(innings.length>=9);assert.notEqual(g.awayScore,g.homeScore);
 for(const side of ['home','away']){
  const runs=innings.reduce((n,i)=>n+Number(i[side]||0),0);
  assert.equal(runs,g[side+'Score']);assert.equal(runs,box.final[side]);
 }
 assert.equal(g.phase,'postseason');assert(g.date>'2026-09-12'&&g.date<='2026-10-07');
}
for(const s of p.series){
 const gs=s.games.map(id=>p.games.find(g=>g.id===id));assert(gs.every(Boolean));
 const wins=gs.filter(g=>(g.homeScore>g.awayScore?g.home:g.away)===s.winner).length;
 assert.equal(wins,Math.ceil(s.bestOf/2));assert.equal(wins,s.winnerWins);assert.equal(gs.length-wins,s.loserWins);
 assert.equal((gs.at(-1).homeScore>gs.at(-1).awayScore?gs.at(-1).home:gs.at(-1).away),s.winner);
}
assert.deepEqual(p.seeds.map(t=>t.seed),[1,2,3,4,5,6]);
const wc=p.series.filter(s=>s.round==='Wild Card');const ds=p.series.filter(s=>s.round==='Division Series');
assert.deepEqual(new Set(ds.flatMap(s=>[s.higherSeed,s.lowerSeed])),new Set([p.seeds[0].slug,p.seeds[1].slug,...wc.map(s=>s.winner)]));
assert.deepEqual(new Set([p.series.at(-1).higherSeed,p.series.at(-1).lowerSeed]),new Set(ds.map(s=>s.winner)));
assert.equal(state.phase,'offseason');assert.equal(state.champion,p.series.at(-1).winner);assert.equal(p.champion,state.champion);
assert.equal(read('data/season/games.json').length,1296);
console.log(`PASS: ${p.games.length} postseason games, 5 series, legal advancement, innings and scores, champion, offseason, regular season preserved`);
