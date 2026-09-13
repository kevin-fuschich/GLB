#!/usr/bin/env node
// One-time reconstruction of simulated player lines. Final scores, innings,
// team hits, roster identities, and the locked score-only games stay fixed.
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, GAMES_DIR, loadTeams, readJson, writeJson } = require('./simulate-day');
const { RATINGS_PATH, hashString, mulberry32, distributeWeighted, loadRatings } = require('./season-model');

function buildRatings() {
  const players = readJson(path.join(ROOT, 'data/season/player-stats.json'));
  const ratings = {};
  for (const row of players) {
    const b = row.batting;
    if (!b || b.AB < 100) continue;
    const avg = b.H / b.AB;
    const hrRate = b.HR / b.AB;
    ratings[row.player] = {
      hit: Number(Math.exp((avg - 0.236) * 6.5).toFixed(4)),
      power: Number(Math.exp((hrRate - 0.021) * 55).toFixed(4))
    };
  }
  writeJson(RATINGS_PATH, ratings);
  return ratings;
}

function assureHomerRuns(lines, key) {
  for (const row of lines) {
    while (row[key] < row.HR) {
      const donor = lines.filter(other => other !== row && other[key] > other.HR)
        .sort((a, b) => (b[key] - b.HR) - (a[key] - a.HR))[0];
      if (!donor) throw new Error(`Cannot give ${row.player} a run and RBI for a home run.`);
      donor[key] -= 1;
      row[key] += 1;
    }
  }
}

function calibrateBatting(rng, lines, runs, ratings) {
  const sum = key => lines.reduce((total, row) => total + Number(row[key] || 0), 0);
  const totalHits = sum('H');
  const totalKs = sum('K');
  const floors = lines.map(row => row.HR + row['2B'] + row['3B']);
  const capacities = lines.map((row, i) => row.AB - floors[i]);
  const hitWeights = lines.map(row => ratings[row.player]?.hit || 1);
  const added = distributeWeighted(rng, totalHits - floors.reduce((a, b) => a + b, 0), capacities, hitWeights);
  lines.forEach((row, i) => { row.H = floors[i] + added[i]; });

  const existingHR = sum('HR');
  if (runs > existingHR && rng() < 0.52) {
    const singles = lines.map(row => row.H - row.HR - row['2B'] - row['3B']);
    if (singles.some(n => n > 0)) {
      const powerWeights = lines.map(row => ratings[row.player]?.power || 1);
      const chosen = distributeWeighted(rng, 1, singles, powerWeights);
      lines.forEach((row, i) => { row.HR += chosen[i]; });
    }
  }

  const adjustedKs = Math.max(4, totalKs - (rng() < 0.5 ? 1 : 2));
  const ks = distributeWeighted(rng, adjustedKs, lines.map(row => row.AB - row.H), lines.map(() => 1));
  lines.forEach((row, i) => { row.K = ks[i]; });
  assureHomerRuns(lines, 'R');
  assureHomerRuns(lines, 'RBI');
}

function calibratePitching(rng, box, side, roster, startIndex, previousStarter) {
  const row = box.pitching[side][0];
  const replacement = roster.starters[startIndex % roster.starters.length];
  row.player = replacement.slug;
  row.name = replacement.name;
  for (const decision of ['W', 'L']) {
    if (box.decisions?.[decision] === previousStarter) box.decisions[decision] = replacement.slug;
  }
  const reliever = box.pitching[side][1];
  const previousReliever = reliever.player;
  const nextReliever = roster.relievers[startIndex % roster.relievers.length];
  reliever.player = nextReliever.slug;
  reliever.name = nextReliever.name;
  if (box.decisions?.SV === previousReliever) box.decisions.SV = nextReliever.slug;
  const opponent = side === 'away' ? 'home' : 'away';
  const totalK = box.batting[opponent].reduce((n, p) => n + p.K, 0);
  const share = (startIndex % roster.starters.length === 0 ? 0.74 : 0.68) + (rng() < 0.12 ? 0.20 : 0);
  row.K = Math.min(totalK, Math.floor(totalK * share + rng()));
  reliever.K = totalK - row.K;
  const totalHR = box.batting[opponent].reduce((n, p) => n + p.HR, 0);
  row.HR = Math.min(totalHR, Math.floor(totalHR * (row.IP_outs / 27) + rng()));
  reliever.HR = totalHR - row.HR;
}

function main() {
  const ratings = fs.existsSync(RATINGS_PATH) ? loadRatings() : buildRatings();
  const rosters = new Map(loadTeams().map(team => [team.slug, readJson(path.join(ROOT, team.roster_path))]));
  const counts = new Map([...rosters.keys()].map(slug => [slug, 0]));
  let calibrated = 0;
  const dates = fs.readdirSync(GAMES_DIR).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  for (const date of dates) {
    for (const file of fs.readdirSync(path.join(GAMES_DIR, date)).filter(f => f.includes('@') && f.endsWith('.json')).sort()) {
      const location = path.join(GAMES_DIR, date, file);
      const box = readJson(location);
      const away = box.away?.slug || box.away;
      const home = box.home?.slug || box.home;
      if (!counts.has(away) || !counts.has(home)) continue;
      const awayIndex = counts.get(away), homeIndex = counts.get(home);
      counts.set(away, awayIndex + 1); counts.set(home, homeIndex + 1);
      if (!box.batting || !box.pitching || box.calibration) continue;
      const rng = mulberry32(hashString(`calibration-v1|${date}|${away}|${home}`));
      calibrateBatting(rng, box.batting.away, box.final.away, ratings);
      calibrateBatting(rng, box.batting.home, box.final.home, ratings);
      const oldAway = box.pitching.away[0].player, oldHome = box.pitching.home[0].player;
      const awayRoster = { starters: rosters.get(away).players.filter(p => p.position === 'SP'), relievers: rosters.get(away).players.filter(p => p.position === 'RP') };
      const homeRoster = { starters: rosters.get(home).players.filter(p => p.position === 'SP'), relievers: rosters.get(home).players.filter(p => p.position === 'RP') };
      calibratePitching(rng, box, 'away', awayRoster, awayIndex, oldAway);
      calibratePitching(rng, box, 'home', homeRoster, homeIndex, oldHome);
      box.calibration = 'glb.stats-calibrated.v1';
      writeJson(location, box);
      calibrated += 1;
    }
  }
  console.log(`Calibrated ${calibrated} existing box scores without changing game results.`);
}

if (require.main === module) main();

module.exports = { calibrateBatting, buildRatings };
