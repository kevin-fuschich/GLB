const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'data/generated-preview');
const read = name => JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
const mean = (rows, key) => rows.length ? rows.reduce((n, r) => n + Number(r[key] || 0), 0) / rows.length : 0;

const standings = read('standings.json');
const batting = read('batting.json');
const pitching = read('pitching.json');
const manifest = read('manifest.json');

const teamGames = standings.reduce((n, r) => n + r.W + r.L, 0);
const runsPerTeamGame = standings.reduce((n, r) => n + r.RS, 0) / teamGames;
const batQual = batting.filter(r => r.AB >= Math.max(100, manifest.games_per_team * 2.5));
const pitQual = pitching.filter(r => r.outs >= Math.max(90, manifest.games_per_team * 2));

const report = {
  seed: manifest.seed,
  games_per_team: manifest.games_per_team,
  runs_per_team_game: +runsPerTeamGame.toFixed(2),
  qualified_avg: +mean(batQual, 'AVG').toFixed(3),
  qualified_ops: +mean(batQual, 'OPS').toFixed(3),
  qualified_era: +mean(pitQual, 'ERA').toFixed(2),
  qualified_whip: +mean(pitQual, 'WHIP').toFixed(2),
  max_hr: Math.max(...batting.map(r => r.HR || 0)),
  max_sb: Math.max(...batting.map(r => r.SB || 0)),
  best_pct: Math.max(...standings.map(r => r.PCT || 0)),
  worst_pct: Math.min(...standings.map(r => r.PCT || 0))
};

const targets = {
  runs_per_team_game: [3.8, 5.2],
  qualified_avg: [0.235, 0.275],
  qualified_ops: [0.68, 0.80],
  qualified_era: [3.4, 5.2],
  qualified_whip: [1.15, 1.50]
};

const flags = [];
for (const [key, [lo, hi]] of Object.entries(targets)) {
  const value = report[key];
  if (value < lo || value > hi) flags.push(`${key}=${value} outside target ${lo}-${hi}`);
}

console.log('GLB PREVIEW QUALITY REPORT');
console.log(JSON.stringify(report, null, 2));
if (flags.length) {
  console.log('\nTUNING FLAGS');
  flags.forEach(f => console.log(`- ${f}`));
} else {
  console.log('\nAll core statistical environment checks are inside target bands.');
}

fs.writeFileSync(path.join(DIR, 'quality-report.json'), JSON.stringify({ report, targets, flags }, null, 2) + '\n');
