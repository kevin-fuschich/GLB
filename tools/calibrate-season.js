#!/usr/bin/env node
// Reconstruct simulated player lines while preserving official game results,
// innings, team hit totals, roster identities, and locked score-only games.
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, GAMES_DIR, loadTeams, readJson, writeJson } = require('./simulate-day');
const { hashString, mulberry32, distributeWeighted } = require('./season-model');

const CALIBRATION = 'glb.stats-calibrated.v2';

function talent(player, low, high, salt) {
  const raw = hashString(`${salt}|${player}`) / 4294967295;
  return low + (high - low) * raw;
}

function assureHomerRuns(lines, key) {
  for (const row of lines) {
    while (row[key] < row.HR) {
      const donor = lines
        .filter(other => other !== row && other[key] > other.HR)
        .sort((a, b) => (b[key] - b.HR) - (a[key] - a.HR))[0];
      if (!donor) throw new Error(`Cannot give ${row.player} a ${key} for a home run.`);
      donor[key] -= 1;
      row[key] += 1;
    }
  }
}

function targetTeamHomers(rng, runs, totalHits) {
  if (runs <= 0 || totalHits <= 0) return 0;
  let homers = rng() < 0.66 ? 1 : 0;
  if (runs >= 3 && totalHits >= 2 && rng() < 0.18) homers += 1;
  if (runs >= 6 && totalHits >= 3 && rng() < 0.035) homers += 1;
  return Math.min(homers, runs, totalHits, 3);
}

function calibrateBatting(rng, lines, runs) {
  const sum = key => lines.reduce((total, row) => total + Number(row[key] || 0), 0);
  const totalHits = sum('H');
  const totalKs = sum('K');

  // Preserve doubles/triples but reconstruct singles and homers.
  lines.forEach(row => { row.HR = 0; });
  const floors = lines.map(row => Number(row['2B'] || 0) + Number(row['3B'] || 0));
  const floorTotal = floors.reduce((a, b) => a + b, 0);
  if (floorTotal > totalHits) throw new Error('Extra-base-hit floor exceeds team hits.');

  const capacities = lines.map((row, i) => Math.max(0, Number(row.AB || 0) - floors[i]));
  const hitWeights = lines.map(row => talent(row.player, 0.74, 1.42, 'hit-v2'));
  const addedHits = distributeWeighted(rng, totalHits - floorTotal, capacities, hitWeights);
  lines.forEach((row, i) => { row.H = floors[i] + addedHits[i]; });

  // Roughly 0.8 HR per team-game, with stable player power differences.
  const targetHR = targetTeamHomers(rng, runs, totalHits);
  if (targetHR > 0) {
    const singleCaps = lines.map(row => Math.max(0, row.H - Number(row['2B'] || 0) - Number(row['3B'] || 0)));
    const powerWeights = lines.map(row => talent(row.player, 0.45, 2.45, 'power-v2'));
    const homers = distributeWeighted(rng, Math.min(targetHR, singleCaps.reduce((a, b) => a + b, 0)), singleCaps, powerWeights);
    lines.forEach((row, i) => { row.HR = homers[i]; });
  }

  const adjustedKs = Math.max(4, totalKs - (rng() < 0.55 ? 1 : 2));
  const kCaps = lines.map(row => Math.max(0, Number(row.AB || 0) - Number(row.H || 0)));
  const possibleKs = kCaps.reduce((a, b) => a + b, 0);
  const ks = distributeWeighted(rng, Math.min(adjustedKs, possibleKs), kCaps, lines.map(() => 1));
  lines.forEach((row, i) => { row.K = ks[i]; });

  assureHomerRuns(lines, 'R');
  assureHomerRuns(lines, 'RBI');
}

function calibratePitching(rng, box, side, roster, startIndex, previousStarter) {
  const starterLine = box.pitching[side][0];
  const replacement = roster.starters[startIndex % roster.starters.length];
  starterLine.player = replacement.slug;
  starterLine.name = replacement.name;

  for (const decision of ['W', 'L']) {
    if (box.decisions?.[decision] === previousStarter) box.decisions[decision] = replacement.slug;
  }

  const relieverLine = box.pitching[side][1];
  const previousReliever = relieverLine.player;
  const nextReliever = roster.relievers[startIndex % roster.relievers.length];
  relieverLine.player = nextReliever.slug;
  relieverLine.name = nextReliever.name;
  if (box.decisions?.SV === previousReliever) box.decisions.SV = nextReliever.slug;

  const opponent = side === 'away' ? 'home' : 'away';
  const totalK = box.batting[opponent].reduce((n, p) => n + Number(p.K || 0), 0);

  // A three-man canonical rotation otherwise produces 250-300 K leaders by volume.
  // Keep starter game lines believable while preserving every team strikeout.
  const starterCap = roster.starters.length <= 3 ? 5 : 7;
  const starterShare = 0.50 + rng() * 0.12;
  starterLine.K = Math.min(totalK, starterCap, Math.max(2, Math.round(totalK * starterShare)));
  relieverLine.K = totalK - starterLine.K;

  const totalHR = box.batting[opponent].reduce((n, p) => n + Number(p.HR || 0), 0);
  starterLine.HR = Math.min(totalHR, Math.floor(totalHR * (starterLine.IP_outs / 27) + rng()));
  relieverLine.HR = totalHR - starterLine.HR;
}

function main() {
  const rosters = new Map(loadTeams().map(team => [team.slug, readJson(path.join(ROOT, team.roster_path))]));
  const counts = new Map([...rosters.keys()].map(slug => [slug, 0]));
  let calibrated = 0;

  const dates = fs.readdirSync(GAMES_DIR)
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();

  for (const date of dates) {
    for (const file of fs.readdirSync(path.join(GAMES_DIR, date)).filter(f => f.includes('@') && f.endsWith('.json')).sort()) {
      const location = path.join(GAMES_DIR, date, file);
      const box = readJson(location);
      const away = box.away?.slug || box.away;
      const home = box.home?.slug || box.home;
      if (!counts.has(away) || !counts.has(home)) continue;

      const awayIndex = counts.get(away);
      const homeIndex = counts.get(home);
      counts.set(away, awayIndex + 1);
      counts.set(home, homeIndex + 1);

      if (!box.batting || !box.pitching || box.calibration === CALIBRATION) continue;

      const rng = mulberry32(hashString(`calibration-v2|${date}|${away}|${home}`));
      calibrateBatting(rng, box.batting.away, box.final.away);
      calibrateBatting(rng, box.batting.home, box.final.home);

      const oldAway = box.pitching.away[0].player;
      const oldHome = box.pitching.home[0].player;
      const awayRoster = {
        starters: rosters.get(away).players.filter(p => p.position === 'SP'),
        relievers: rosters.get(away).players.filter(p => ['RP', 'CL'].includes(p.position))
      };
      const homeRoster = {
        starters: rosters.get(home).players.filter(p => p.position === 'SP'),
        relievers: rosters.get(home).players.filter(p => ['RP', 'CL'].includes(p.position))
      };

      calibratePitching(rng, box, 'away', awayRoster, awayIndex, oldAway);
      calibratePitching(rng, box, 'home', homeRoster, homeIndex, oldHome);
      box.calibration = CALIBRATION;
      writeJson(location, box);
      calibrated += 1;
    }
  }

  console.log(`Calibrated ${calibrated} existing box scores without changing game results.`);
}

if (require.main === module) main();

module.exports = { calibrateBatting, targetTeamHomers };
