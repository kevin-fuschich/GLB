/* One-time reproducible postseason, seeded from the final regular-season record. */
const fs=require('fs');
const {hashString,mulberry32}=require('./season-model');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,data)=>{fs.mkdirSync(require('path').dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n');};
const standings=read('current/standings.json'),regular=read('data/season/games.json');
const rank=(a,b)=>b.w-a.w||(b.rs-b.ra)-(a.rs-a.ra)||a.slug.localeCompare(b.slug);
const leaders=Object.values(standings.divisions).map(rows=>rows[0]).sort(rank);
const wild=Object.values(standings.divisions).flat().filter(t=>!leaders.some(l=>l.slug===t.slug)).sort(rank).slice(0,4);
const seeds=[...leaders,...wild].map((t,i)=>({...t,seed:i+1}));
const games=[],series=[];
const rng=mulberry32(hashString('GLB-2026-postseason-v1'));
function poisson(mean){let n=0,p=1;const limit=Math.exp(-mean);do{n++;p*=rng();}while(p>limit);return n-1;}
function playSeries(id,round,a,b,bestOf,dates){
 const higher=a.seed<b.seed?a:b,lower=a.seed<b.seed?b:a,need=Math.ceil(bestOf/2),wins={[a.slug]:0,[b.slug]:0};const ids=[];
 for(let n=0;n<bestOf&&Math.max(...Object.values(wins))<need;n++){
  const higherHome=bestOf===3|| (bestOf===5?[0,1,4]:[0,1,5,6]).includes(n);
  const home=higherHome?higher:lower,away=higherHome?lower:higher,date=dates[n];
  const mean=t=>Math.max(1.8,((t.rs/162)+(t.slug===home.slug?away:home).ra/162)/2);
  const innings=[];let ar=0,hr=0;
  for(let i=1;i<=9||ar===hr;i++){
   const av=poisson(mean(away)/9);ar+=av;
   let hv='';if(i<9||ar>=hr){hv=poisson(mean(home)*1.04/9);if(i>=9&&hr+hv>ar)hv=ar-hr+1;hr+=hv;}
   innings.push({inning:i,away:av,home:hv});
  }
  const winner=ar>hr?away:home;wins[winner.slug]++;
  const game={id:date+'_'+away.slug+'@'+home.slug,date,home:home.slug,away:away.slug,homeScore:hr,awayScore:ar,status:'final',phase:'postseason',round,series:id,gameNumber:n+1,source:`data/games/${date}/${away.slug}@${home.slug}.json`};
  games.push(game);ids.push(game.id);
  write(game.source,{schema:'glb.boxscore.v1',game_id:game.id,date,phase:'postseason',round,series:id,game_number:n+1,away:{slug:away.slug,name:away.team},home:{slug:home.slug,name:home.team},status:'Final',linescore:{innings,totals:{away:{R:ar},home:{R:hr}}},final:{away:ar,home:hr},notes:['Official postseason score and inning record. Individual player lines were not recorded.']});
 }
 const winner=wins[a.slug]>wins[b.slug]?a:b,loser=winner===a?b:a;
 const record={id,round,bestOf,higherSeed:higher.slug,lowerSeed:lower.slug,winner:winner.slug,loser:loser.slug,winnerWins:wins[winner.slug],loserWins:wins[loser.slug],games:ids};series.push(record);return winner;
}
const wcDates=['2026-09-15','2026-09-16','2026-09-17'];
const w1=playSeries('WC1','Wild Card',seeds[2],seeds[5],3,wcDates),w2=playSeries('WC2','Wild Card',seeds[3],seeds[4],3,wcDates);
const advancing=[w1,w2].sort((a,b)=>a.seed-b.seed),dsDates=['2026-09-20','2026-09-21','2026-09-23','2026-09-24','2026-09-26'];
const d1=playSeries('DS1','Division Series',seeds[0],advancing[1],5,dsDates),d2=playSeries('DS2','Division Series',seeds[1],advancing[0],5,dsDates);
const champion=playSeries('FINAL','GLB Championship Series',d1,d2,7,['2026-09-29','2026-09-30','2026-10-02','2026-10-03','2026-10-04','2026-10-06','2026-10-07']);
games.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
const final=series.at(-1),last=games.at(-1).date;
write('data/season/postseason-2026.json',{schema:'glb.postseason.v1',year:2026,status:'complete',format:'Six teams: two division winners with byes and four wild cards. Wild Card best of three, Division Series best of five, GLB Championship Series best of seven. Division winners seed 1–2 by record; wild cards seed 3–6 by record. Ties break on run differential, then club slug. After the Wild Card round, seed 1 faces the lowest remaining seed. Higher seed hosts all Wild Card games, Division Series games 1, 2 and 5, and Championship games 1, 2, 6 and 7.',seeds,series,games,champion:champion.slug,runnerUp:final.loser,completedOn:last});
write('data/season/status.json',{year:2026,phase:'offseason',regularSeasonEnded:'2026-09-12',postseasonEnded:last,champion:champion.slug,championName:champion.team,runnerUp:final.loser,championshipSeries:`${final.winnerWins}–${final.loserWins}`,nextSeason:2027,nextOpeningDay:null,offseasonBegan:'2026-10-07'});
console.log(JSON.stringify({seeds:seeds.map(t=>[t.seed,t.team,t.w]),series,champion:champion.team,last,games:games.length},null,2));
