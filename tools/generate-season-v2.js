const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEAMS_PATH = path.join(ROOT, 'data/teams/teams.json');
const PREVIEW_DIR = path.join(ROOT, 'data/generated-preview');
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};
const SEED = Number(argValue('seed', 2026));
const GAMES_PER_TEAM = Number(argValue('games-per-team', 48));
const VALIDATE_ONLY = args.includes('--validate-only');

function mulberry32(seed) {
  return function rng() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
const rand = (a, b) => a + (b - a) * rng();
const chance = p => rng() < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
};
const outsToIP = outs => `${Math.floor(outs / 3)}.${outs % 3}`;

function loadLeague() {
  const raw = readJson(TEAMS_PATH);
  const teams = [];
  for (const [division, clubs] of Object.entries(raw.divisions || {})) {
    for (const club of clubs) teams.push({ ...club, division });
  }
  return teams;
}

function playerKey(teamSlug, playerSlug) { return `${teamSlug}::${playerSlug}`; }

function validateLeague(teams) {
  const errors = [], warnings = [], rosterMap = new Map();
  const seenTeamSlugs = new Set();
  const slugOwners = new Map();
  for (const team of teams) {
    if (seenTeamSlugs.has(team.slug)) errors.push(`Duplicate team slug: ${team.slug}`);
    seenTeamSlugs.add(team.slug);
    const file = path.join(ROOT, team.roster_path);
    if (!fs.existsSync(file)) { errors.push(`Missing roster: ${team.roster_path}`); continue; }
    const roster = readJson(file);
    const players = roster.players || [];
    const starters = players.filter(p => p.position === 'SP');
    const relievers = players.filter(p => ['RP','CL'].includes(p.position));
    const positionPlayers = players.filter(p => !['SP','RP','CL','P'].includes(p.position));
    if (positionPlayers.length < 8) errors.push(`${team.slug}: fewer than 8 position players.`);
    if (starters.length < 4) errors.push(`${team.slug}: fewer than 4 starting pitchers.`);
    if (relievers.length < 2) warnings.push(`${team.slug}: fewer than 2 relievers; starter fallback may be used.`);
    for (const p of players) {
      if (!p.slug) errors.push(`${team.slug}: player missing slug.`);
      if (!slugOwners.has(p.slug)) slugOwners.set(p.slug, []);
      slugOwners.get(p.slug).push(team.slug);
    }
    rosterMap.set(team.slug, { ...roster, players, starters, relievers, positionPlayers });
  }
  for (const [slug, owners] of slugOwners) if (owners.length > 1) warnings.push(`Shared player slug isolated by team scope: ${slug} (${owners.join(', ')})`);
  return { errors, warnings, rosterMap };
}

function roundRobinRounds(teams) {
  const list = teams.map(t => t.slug);
  const fixed = list[0];
  let rotating = list.slice(1);
  const rounds = [];
  for (let r = 0; r < list.length - 1; r++) {
    const row = [fixed, ...rotating], pairings = [];
    for (let i = 0; i < row.length / 2; i++) {
      const a = row[i], b = row[row.length - 1 - i];
      const flip = (r + i) % 2 === 1;
      pairings.push({ away: flip ? b : a, home: flip ? a : b });
    }
    rounds.push(pairings);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  return rounds;
}

function buildSchedule(teams, gamesPerTeam) {
  const rounds = roundRobinRounds(teams);
  const counts = Object.fromEntries(teams.map(t => [t.slug, 0]));
  const games = [];
  let cycle = 0;
  while (Object.values(counts).some(v => v < gamesPerTeam)) {
    for (const round of rounds) for (const base of round) {
      if (counts[base.away] >= gamesPerTeam || counts[base.home] >= gamesPerTeam) continue;
      const reverse = cycle % 2 === 1;
      const g = reverse ? { away: base.home, home: base.away } : { ...base };
      games.push({ ...g, round: games.length + 1 });
      counts[g.away]++; counts[g.home]++;
    }
    cycle++;
    if (cycle > 100) throw new Error('Schedule generation did not converge.');
  }
  return games;
}

function playerProfile(player, isPitcher) {
  const age = player.age || 28;
  const ageAdj = clamp((28 - age) * 0.0015, -0.012, 0.012);
  return {
    batting: {
      bb: clamp(rand(0.055, 0.105), 0.04, 0.13),
      k: isPitcher ? rand(0.29, 0.38) : rand(0.17, 0.27),
      hr: isPitcher ? rand(0.003, 0.012) : rand(0.018, 0.045),
      hit: isPitcher ? rand(0.08, 0.13) : clamp(rand(0.165, 0.225) + ageAdj, 0.14, 0.24),
      speed: isPitcher ? 0.005 : rand(0.015, 0.10)
    },
    pitching: {
      bbMod: rand(-0.015, 0.015),
      kMod: rand(-0.025, 0.025),
      hitMod: rand(-0.020, 0.020),
      hrMod: rand(-0.008, 0.008)
    }
  };
}

function buildProfiles(rosterMap) {
  const profiles = new Map();
  for (const [teamSlug, roster] of rosterMap) {
    for (const p of roster.players) {
      const isPitcher = ['SP','RP','CL','P'].includes(p.position);
      profiles.set(playerKey(teamSlug, p.slug), playerProfile(p, isPitcher));
    }
  }
  return profiles;
}

function starterFor(roster, gameNo) { return roster.starters[gameNo % roster.starters.length]; }
function battingOrder(roster, starter) {
  if (roster.positionPlayers.length >= 9) return roster.positionPlayers.slice(0, 9);
  return [...roster.positionPlayers.slice(0, 8), starter];
}
function pitcherForInning(roster, starter, inning) {
  if (inning <= 6 || roster.relievers.length === 0) return starter;
  return roster.relievers[(inning - 7) % roster.relievers.length];
}

function simulateHalfInning(teamSlug, order, pitcherTeamSlug, pitcher, profiles, startIndex) {
  let outs = 0, runs = 0, idx = startIndex;
  const bases = [null, null, null], batterLines = {};
  const pitcherLine = { player: pitcher.slug, outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0 };
  const lineFor = p => batterLines[p.slug] ||= { player: p.slug, AB: 0, R: 0, H: 0, RBI: 0, BB: 0, K: 0, HR: 0, SB: 0 };
  const score = (runner, batter) => {
    if (!runner) return;
    runs++; lineFor(runner).R++; if (batter) lineFor(batter).RBI++;
    pitcherLine.r++; pitcherLine.er++;
  };
  while (outs < 3) {
    const batter = order[idx % order.length]; idx++;
    const bp = profiles.get(playerKey(teamSlug, batter.slug)).batting;
    const pp = profiles.get(playerKey(pitcherTeamSlug, pitcher.slug)).pitching;
    const line = lineFor(batter), roll = rng();
    const bbP = clamp(bp.bb + pp.bbMod, 0.035, 0.13);
    const kP = clamp(bp.k + pp.kMod, 0.12, 0.40);
    const hrP = clamp(bp.hr + pp.hrMod, 0.003, 0.055);
    const hitP = clamp(bp.hit + pp.hitMod, 0.10, 0.25);
    if (roll < bbP) {
      line.BB++; pitcherLine.bb++;
      if (bases[0] && bases[1] && bases[2]) score(bases[2], batter);
      if (bases[0] && bases[1]) bases[2] = bases[1];
      if (bases[0]) bases[1] = bases[0];
      bases[0] = batter;
    } else if (roll < bbP + kP) {
      line.AB++; line.K++; pitcherLine.k++; outs++; pitcherLine.outs++;
    } else if (roll < bbP + kP + hrP) {
      line.AB++; line.H++; line.HR++; pitcherLine.h++; pitcherLine.hr++;
      for (let b = 2; b >= 0; b--) score(bases[b], batter);
      bases.fill(null); score(batter, batter);
    } else if (roll < bbP + kP + hrP + hitP) {
      line.AB++; line.H++; pitcherLine.h++;
      const dbl = chance(0.18), trp = !dbl && chance(0.018), advance = trp ? 3 : dbl ? 2 : 1;
      for (let b = 2; b >= 0; b--) {
        const runner = bases[b]; if (!runner) continue; bases[b] = null;
        if (b + advance >= 3 || chance(0.24)) score(runner, batter);
        else bases[Math.min(2, b + advance)] = runner;
      }
      if (advance === 3) score(batter, batter); else bases[advance - 1] = batter;
      if (bases[0] && chance(bp.speed) && !bases[1]) { const r = bases[0]; bases[0] = null; bases[1] = r; lineFor(r).SB++; }
    } else {
      line.AB++; outs++; pitcherLine.outs++;
      if (bases[2] && outs < 3 && chance(0.12)) { score(bases[2], batter); bases[2] = null; }
    }
  }
  return { runs, nextIndex: idx % order.length, batterLines, pitcherLine };
}

function addBat(target, source) {
  for (const [slug, line] of Object.entries(source)) {
    target[slug] ||= { ...line };
    if (target[slug] === line) continue;
    for (const k of ['AB','R','H','RBI','BB','K','HR','SB']) target[slug][k] += line[k];
  }
}
function addPitch(target, line) {
  const k = line.player;
  target[k] ||= { player: k, outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0 };
  for (const f of ['outs','h','r','er','bb','k','hr']) target[k][f] += line[f];
}

function simulateGame(game, rosters, profiles, teamGameNos) {
  const ar = rosters.get(game.away), hr = rosters.get(game.home);
  const aStarter = starterFor(ar, teamGameNos[game.away]), hStarter = starterFor(hr, teamGameNos[game.home]);
  const aOrder = battingOrder(ar, aStarter), hOrder = battingOrder(hr, hStarter);
  let aIdx=0,hIdx=0,aRuns=0,hRuns=0,inning=1;
  const innings=[], aBat={}, hBat={}, aPitch={}, hPitch={};
  while (inning <= 9 || aRuns === hRuns) {
    const hP = pitcherForInning(hr, hStarter, inning);
    const top = simulateHalfInning(game.away, aOrder, game.home, hP, profiles, aIdx);
    aIdx = top.nextIndex; aRuns += top.runs; addBat(aBat, top.batterLines); addPitch(hPitch, top.pitcherLine);
    let br=0;
    if (!(inning >= 9 && hRuns > aRuns)) {
      const aP = pitcherForInning(ar, aStarter, inning);
      const bot = simulateHalfInning(game.home, hOrder, game.away, aP, profiles, hIdx);
      hIdx = bot.nextIndex; br = bot.runs; hRuns += br; addBat(hBat, bot.batterLines); addPitch(aPitch, bot.pitcherLine);
    }
    innings.push({ inning, away: top.runs, home: br }); inning++;
    if (inning > 15 && aRuns === hRuns) hRuns++;
  }
  const winner = aRuns > hRuns ? game.away : game.home;
  const loser = winner === game.away ? game.home : game.away;
  const wStarter = winner === game.away ? aStarter : hStarter;
  const lStarter = loser === game.away ? aStarter : hStarter;
  const margin = Math.abs(aRuns-hRuns);
  const winnerRoster = rosters.get(winner);
  const savePitcher = margin <= 3 && winnerRoster.relievers.length ? winnerRoster.relievers[(8-7)%winnerRoster.relievers.length].slug : null;
  teamGameNos[game.away]++; teamGameNos[game.home]++;
  const pitchArray = p => Object.values(p).map(x => ({ ...x, IP: outsToIP(x.outs) }));
  return {
    schema:'glb.boxscore.v2-preview', game_id:`preview-${String(game.round).padStart(4,'0')}_${game.away}@${game.home}`, status:'Final',
    away:{slug:game.away}, home:{slug:game.home},
    linescore:{ innings, totals:{ away:{R:aRuns,H:Object.values(aBat).reduce((s,x)=>s+x.H,0),E:0}, home:{R:hRuns,H:Object.values(hBat).reduce((s,x)=>s+x.H,0),E:0} } },
    batting:{away:Object.values(aBat),home:Object.values(hBat)}, pitching:{away:pitchArray(aPitch),home:pitchArray(hPitch)},
    decisions:{W:wStarter.slug,L:lStarter.slug,SV:savePitcher}, notes:['Generated preview; not an official GLB result.']
  };
}

function derive(boxscores, teams) {
  const standings = Object.fromEntries(teams.map(t=>[t.slug,{team:t.team,slug:t.slug,division:t.division,W:0,L:0,RS:0,RA:0}]));
  const batting = {}, pitching = {};
  for (const g of boxscores) {
    const ar=g.linescore.totals.away.R, hr=g.linescore.totals.home.R;
    Object.assign(standings[g.away.slug],{RS:standings[g.away.slug].RS+ar,RA:standings[g.away.slug].RA+hr});
    Object.assign(standings[g.home.slug],{RS:standings[g.home.slug].RS+hr,RA:standings[g.home.slug].RA+ar});
    if(ar>hr){standings[g.away.slug].W++;standings[g.home.slug].L++;}else{standings[g.home.slug].W++;standings[g.away.slug].L++;}
    for(const side of ['away','home']){
      const team=g[side].slug;
      for(const line of g.batting[side]){
        const key=playerKey(team,line.player); batting[key]||={player:line.player,team,G:0,AB:0,R:0,H:0,RBI:0,BB:0,K:0,HR:0,SB:0};
        const b=batting[key]; b.G++; for(const f of ['AB','R','H','RBI','BB','K','HR','SB']) b[f]+=line[f];
      }
      for(const line of g.pitching[side]){
        const key=playerKey(team,line.player); pitching[key]||={player:line.player,team,G:0,GS:0,outs:0,H:0,R:0,ER:0,BB:0,K:0,HR:0,W:0,L:0,SV:0};
        const p=pitching[key]; p.G++; if(line.player===g.decisions.W||line.player===g.decisions.L) p.GS++; p.outs+=line.outs;p.H+=line.h;p.R+=line.r;p.ER+=line.er;p.BB+=line.bb;p.K+=line.k;p.HR+=line.hr;
      }
    }
    for(const [field,stat] of [['W','W'],['L','L'],['SV','SV']]) if(g.decisions[field]){
      for(const team of [g.away.slug,g.home.slug]){const key=playerKey(team,g.decisions[field]);if(pitching[key]){pitching[key][stat]++;break;}}
    }
  }
  const standingsOut=Object.values(standings).map(s=>({...s,PCT:Number((s.W/(s.W+s.L)).toFixed(3)),Diff:s.RS-s.RA}));
  const battingOut=Object.values(batting).map(b=>{const avg=b.AB?b.H/b.AB:0,obp=(b.AB+b.BB)?(b.H+b.BB)/(b.AB+b.BB):0,slg=b.AB?(b.H+b.HR*2)/b.AB:0;return{...b,AVG:Number(avg.toFixed(3)),OBP:Number(obp.toFixed(3)),SLG:Number(slg.toFixed(3)),OPS:Number((obp+slg).toFixed(3))};});
  const pitchingOut=Object.values(pitching).map(p=>{const ip=p.outs/3;return{...p,IP:outsToIP(p.outs),ERA:ip?Number((p.ER*9/ip).toFixed(2)):0,WHIP:ip?Number(((p.H+p.BB)/ip).toFixed(2)):0};});
  const top=(arr,f,asc=false,n=10)=>[...arr].filter(x=>Number.isFinite(x[f])).sort((a,b)=>asc?a[f]-b[f]:b[f]-a[f]).slice(0,n).map(x=>({player:x.player,team:x.team,value:x[f]}));
  const qh=battingOut.filter(x=>x.AB>=GAMES_PER_TEAM*2.5), qp=pitchingOut.filter(x=>x.outs>=GAMES_PER_TEAM*1.5);
  return {standings:standingsOut,batting:battingOut,pitching:pitchingOut,leaders:{batting:{AVG:top(qh,'AVG'),HR:top(battingOut,'HR'),RBI:top(battingOut,'RBI'),OPS:top(qh,'OPS'),R:top(battingOut,'R'),SB:top(battingOut,'SB')},pitching:{ERA:top(qp,'ERA',true),WHIP:top(qp,'WHIP',true),K:top(pitchingOut,'K'),SV:top(pitchingOut,'SV'),W:top(pitchingOut,'W')}}};
}

function main(){
  console.log(`GLB stat backbone v2 | seed=${SEED} | preview games/team=${GAMES_PER_TEAM}`);
  const teams=loadLeague(), validation=validateLeague(teams);
  console.log(`Clubs: ${teams.length}`); validation.warnings.forEach(x=>console.log(`WARN: ${x}`)); validation.errors.forEach(x=>console.log(`ERROR: ${x}`));
  if(validation.errors.length){process.exitCode=1;return;} if(VALIDATE_ONLY){console.log('Validation complete.');return;}
  const profiles=buildProfiles(validation.rosterMap), schedule=buildSchedule(teams,GAMES_PER_TEAM), teamGameNos=Object.fromEntries(teams.map(t=>[t.slug,0]));
  const boxscores=schedule.map(g=>simulateGame(g,validation.rosterMap,profiles,teamGameNos)), derived=derive(boxscores,teams);
  fs.rmSync(PREVIEW_DIR,{recursive:true,force:true}); fs.mkdirSync(PREVIEW_DIR,{recursive:true});
  writeJson(path.join(PREVIEW_DIR,'manifest.json'),{generated:true,official:false,generator:'v2',seed:SEED,games_per_team:GAMES_PER_TEAM,clubs:teams.length,games:boxscores.length,warning:'Preview data only. Official GLB history remains untouched.'});
  writeJson(path.join(PREVIEW_DIR,'schedule.json'),schedule);writeJson(path.join(PREVIEW_DIR,'boxscores.json'),boxscores);writeJson(path.join(PREVIEW_DIR,'standings.json'),derived.standings);writeJson(path.join(PREVIEW_DIR,'batting.json'),derived.batting);writeJson(path.join(PREVIEW_DIR,'pitching.json'),derived.pitching);writeJson(path.join(PREVIEW_DIR,'leaders.json'),derived.leaders);
  console.log(`Generated ${boxscores.length} preview games with bullpen usage.`); console.log('No official GLB files were changed.');
}
main();