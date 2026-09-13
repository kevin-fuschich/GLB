const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'data/generated-preview');
const read = name => JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
const errors = [];
const manifest = read('manifest.json');
const schedule = read('schedule.json');
const boxscores = read('boxscores.json');
const standings = read('standings.json');
const batting = read('batting.json');
const pitching = read('pitching.json');

if (boxscores.length !== schedule.length) errors.push(`boxscores ${boxscores.length} != schedule ${schedule.length}`);
if (boxscores.length !== manifest.games) errors.push(`boxscores ${boxscores.length} != manifest.games ${manifest.games}`);

const teamGames = Object.fromEntries(standings.map(s => [s.slug, 0]));
let leagueRS = 0, leagueRA = 0;
for (const g of boxscores) {
  teamGames[g.away.slug] = (teamGames[g.away.slug] || 0) + 1;
  teamGames[g.home.slug] = (teamGames[g.home.slug] || 0) + 1;
  const ar = g.linescore.totals.away.R;
  const hr = g.linescore.totals.home.R;
  leagueRS += ar + hr;
  leagueRA += hr + ar;
  for (const side of ['away','home']) {
    const hitSum = g.batting[side].reduce((s,x)=>s+x.H,0);
    if (hitSum !== g.linescore.totals[side].H) errors.push(`${g.game_id} ${side} hit total mismatch`);
    for (const b of g.batting[side]) {
      if (b['2B'] + b['3B'] + b.HR > b.H) errors.push(`${g.game_id} ${b.player}: XBH exceeds H`);
    }
    const outs = g.pitching[side].reduce((s,x)=>s+x.outs,0);
    const inningsPlayed = g.linescore.innings.length;
    const expectedMinOuts = side === 'away' ? Math.min(27, inningsPlayed * 3 - 3) : Math.min(27, inningsPlayed * 3 - 3);
    if (outs < expectedMinOuts) errors.push(`${g.game_id} ${side}: suspiciously low pitching outs ${outs}`);
  }
  if (ar === hr) errors.push(`${g.game_id}: final score tied`);
}

for (const [team,g] of Object.entries(teamGames)) if (g !== manifest.games_per_team) errors.push(`${team}: ${g} games, expected ${manifest.games_per_team}`);
if (leagueRS !== leagueRA) errors.push(`league RS ${leagueRS} != league RA ${leagueRA}`);

const standingsRS = standings.reduce((s,x)=>s+x.RS,0);
const standingsRA = standings.reduce((s,x)=>s+x.RA,0);
if (standingsRS !== standingsRA) errors.push(`standings RS ${standingsRS} != RA ${standingsRA}`);
for (const s of standings) if (s.W + s.L !== manifest.games_per_team) errors.push(`${s.slug}: W+L=${s.W+s.L}`);
if (standings.reduce((s,x)=>s+x.W,0) !== standings.reduce((s,x)=>s+x.L,0)) errors.push('league wins != league losses');

for (const b of batting) {
  const singles = b.H - b['2B'] - b['3B'] - b.HR;
  const tb = singles + 2*b['2B'] + 3*b['3B'] + 4*b.HR;
  if (tb !== b.TB) errors.push(`${b.team}/${b.player}: TB mismatch ${b.TB} vs ${tb}`);
  if (b.AB && Math.abs(b.AVG - b.H/b.AB) > 0.00051) errors.push(`${b.team}/${b.player}: AVG mismatch`);
}

for (const p of pitching) {
  const ip = p.outs / 3;
  if (ip && Math.abs(p.ERA - p.ER*9/ip) > 0.011) errors.push(`${p.team}/${p.player}: ERA mismatch`);
  if (ip && Math.abs(p.WHIP - (p.H+p.BB)/ip) > 0.011) errors.push(`${p.team}/${p.player}: WHIP mismatch`);
}

if (errors.length) {
  console.error('GLB preview reconciliation FAILED');
  errors.slice(0,50).forEach(e => console.error('- ' + e));
  if (errors.length > 50) console.error(`...and ${errors.length-50} more`);
  process.exit(1);
}
console.log(`GLB preview reconciliation passed: ${boxscores.length} games, ${batting.length} batting lines, ${pitching.length} pitching lines.`);
