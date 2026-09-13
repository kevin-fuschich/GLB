const fs = require('fs');
const path = require('path');

/*
  GLB deterministic season generator

  IMPORTANT:
  - Default mode is PREVIEW. It writes only to data/generated-preview/.
  - Official data/games and current/ are never touched by this tool.
  - Existing official box scores remain authoritative.
  - Use --seed to reproduce the exact same output.

  Examples:
    node tools/generate-season.js
    node tools/generate-season.js --games-per-team=48 --seed=2026
    node tools/generate-season.js --validate-only
*/

const ROOT = path.join(__dirname, '..');
const TEAMS_PATH = path.join(ROOT, 'data/teams/teams.json');
const PREVIEW_DIR = path.join(ROOT, 'data/generated-preview');

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

const VALIDATE_ONLY = args.includes('--validate-only');
const SEED = Number(argValue('seed', 2026));
const GAMES_PER_TEAM = Number(argValue('games-per-team', 48));

if (!Number.isInteger(GAMES_PER_TEAM) || GAMES_PER_TEAM < 2 || GAMES_PER_TEAM > 162) {
  throw new Error('--games-per-team must be an integer from 2 to 162');
}

// ---------- deterministic random ----------
function mulberry32(seed) {
  return function rng() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
const rand = (min, max) => min + (max - min) * rng();
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const chance = p => rng() < p;
const pick = arr => arr[Math.floor(rng() * arr.length)];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

// ---------- league + rosters ----------
function loadLeague() {
  const raw = readJson(TEAMS_PATH);
  const teams = [];
  for (const [division, clubs] of Object.entries(raw.divisions || {})) {
    for (const club of clubs) teams.push({ ...club, division });
  }
  return { raw, teams };
}

function loadRoster(team) {
  const rosterPath = path.join(ROOT, team.roster_path);
  if (!fs.existsSync(rosterPath)) return null;
  return readJson(rosterPath);
}

function validateLeague(teams) {
  const errors = [];
  const warnings = [];
  const seenTeamSlugs = new Set();
  const seenPlayerSlugs = new Set();
  const rosterMap = new Map();

  if (teams.length !== 16) warnings.push(`Expected 16 clubs; found ${teams.length}.`);

  for (const team of teams) {
    if (seenTeamSlugs.has(team.slug)) errors.push(`Duplicate team slug: ${team.slug}`);
    seenTeamSlugs.add(team.slug);

    const roster = loadRoster(team);
    if (!roster) {
      errors.push(`Missing roster: ${team.roster_path}`);
      continue;
    }

    const players = roster.players || [];
    const pitchers = players.filter(p => ['SP', 'RP', 'P'].includes(p.position));
    const starters = players.filter(p => p.position === 'SP');
    const relievers = players.filter(p => p.position === 'RP');
    const positionPlayers = players.filter(p => !['SP', 'RP', 'P'].includes(p.position));

    if (positionPlayers.length < 8) errors.push(`${team.slug}: fewer than 8 position players.`);
    if (starters.length < 4) errors.push(`${team.slug}: fewer than 4 starting pitchers.`);
    if (relievers.length < 2) warnings.push(`${team.slug}: fewer than 2 relievers.`);

    for (const p of players) {
      if (!p.slug) errors.push(`${team.slug}: player missing slug.`);
      if (seenPlayerSlugs.has(p.slug)) warnings.push(`Player slug reused across league: ${p.slug}`);
      seenPlayerSlugs.add(p.slug);
    }

    rosterMap.set(team.slug, { ...roster, players, pitchers, starters, relievers, positionPlayers });
  }

  return { errors, warnings, rosterMap };
}

// ---------- schedule ----------
function roundRobinRounds(teams) {
  const list = teams.map(t => t.slug);
  if (list.length % 2) list.push(null);
  const rounds = [];
  const fixed = list[0];
  let rotating = list.slice(1);

  for (let r = 0; r < list.length - 1; r++) {
    const row = [fixed, ...rotating];
    const pairings = [];
    for (let i = 0; i < row.length / 2; i++) {
      const a = row[i];
      const b = row[row.length - 1 - i];
      if (!a || !b) continue;
      const flip = (r + i) % 2 === 1;
      pairings.push({ away: flip ? b : a, home: flip ? a : b });
    }
    rounds.push(pairings);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  return rounds;
}

function buildSchedule(teams, gamesPerTeam) {
  const baseRounds = roundRobinRounds(teams);
  const counts = Object.fromEntries(teams.map(t => [t.slug, 0]));
  const games = [];
  let cycle = 0;

  while (Object.values(counts).some(v => v < gamesPerTeam)) {
    for (let r = 0; r < baseRounds.length; r++) {
      for (const base of baseRounds[r]) {
        if (counts[base.away] >= gamesPerTeam || counts[base.home] >= gamesPerTeam) continue;
        const reverse = cycle % 2 === 1;
        const game = reverse
          ? { away: base.home, home: base.away }
          : { away: base.away, home: base.home };
        games.push({ ...game, round: games.length + 1 });
        counts[game.away]++;
        counts[game.home]++;
      }
    }
    cycle++;
    if (cycle > 100) throw new Error('Schedule generation did not converge.');
  }

  return games;
}

// ---------- player profiles ----------
function playerProfile(player) {
  const ageAdj = player.age ? Math.max(-0.03, Math.min(0.03, (29 - player.age) * 0.003)) : 0;
  const batting = {
    contact: rand(0.205, 0.305) + ageAdj,
    walk: rand(0.055, 0.115),
    power: rand(0.025, 0.075),
    speed: rand(0.02, 0.16)
  };
  const pitching = {
    kRate: rand(0.17, 0.31),
    bbRate: rand(0.055, 0.105),
    hitRate: rand(0.205, 0.285),
    hrRate: rand(0.018, 0.045)
  };
  return { batting, pitching };
}

function buildProfiles(rosterMap) {
  const profiles = new Map();
  for (const roster of rosterMap.values()) {
    for (const p of roster.players) profiles.set(p.slug, playerProfile(p));
  }
  return profiles;
}

function startingPitcher(roster, teamGameNo) {
  return roster.starters[teamGameNo % roster.starters.length];
}

function battingOrder(roster, starter) {
  // GLB currently carries eight position players per club. The starting pitcher bats ninth.
  // This preserves nine-player baseball without silently inventing a DH or extra roster member.
  return [...roster.positionPlayers.slice(0, 8), starter];
}

// ---------- simulation primitives ----------
function simulateHalfInning(order, pitcher, profiles, startIndex) {
  let outs = 0;
  let runs = 0;
  let idx = startIndex;
  const bases = [null, null, null];
  const batterLines = {};
  const pitcherLine = { outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0 };

  const lineFor = p => batterLines[p.slug] ||= { player: p.slug, AB: 0, R: 0, H: 0, RBI: 0, BB: 0, K: 0, HR: 0, SB: 0 };

  function scoreRunner(runner, rbiBatter) {
    if (!runner) return;
    runs++;
    lineFor(runner).R++;
    if (rbiBatter) lineFor(rbiBatter).RBI++;
    pitcherLine.r++;
    pitcherLine.er++;
  }

  while (outs < 3) {
    const batter = order[idx % order.length];
    idx++;
    const b = profiles.get(batter.slug).batting;
    const p = profiles.get(pitcher.slug).pitching;
    const line = lineFor(batter);
    const roll = rng();
    const bbP = Math.max(0.03, (b.walk + p.bbRate) / 2);
    const kP = Math.max(0.08, p.kRate * (batter.position === 'SP' ? 1.22 : 1));
    const hrP = Math.max(0.008, (b.power + p.hrRate) / 2);
    const hitP = Math.max(0.12, (b.contact + p.hitRate) / 2);

    if (roll < bbP) {
      line.BB++;
      pitcherLine.bb++;
      if (bases[0] && bases[1] && bases[2]) scoreRunner(bases[2], batter);
      if (bases[0] && bases[1]) bases[2] = bases[1];
      if (bases[0]) bases[1] = bases[0];
      bases[0] = batter;
    } else if (roll < bbP + kP) {
      line.AB++;
      line.K++;
      pitcherLine.k++;
      outs++;
      pitcherLine.outs++;
    } else if (roll < bbP + kP + hrP) {
      line.AB++;
      line.H++;
      line.HR++;
      pitcherLine.h++;
      pitcherLine.hr++;
      for (let base = 2; base >= 0; base--) scoreRunner(bases[base], batter);
      bases.fill(null);
      scoreRunner(batter, batter);
    } else if (roll < bbP + kP + hrP + hitP) {
      line.AB++;
      line.H++;
      pitcherLine.h++;
      const double = chance(0.19);
      const triple = !double && chance(0.025);
      const advance = triple ? 3 : double ? 2 : 1;
      for (let base = 2; base >= 0; base--) {
        const runner = bases[base];
        if (!runner) continue;
        bases[base] = null;
        if (base + advance >= 3 || chance(0.35)) scoreRunner(runner, batter);
        else bases[Math.min(2, base + advance)] = runner;
      }
      if (advance >= 3) {
        scoreRunner(batter, batter);
      } else {
        bases[advance - 1] = batter;
      }
      if (bases[0] && chance(b.speed)) {
        const runner = bases[0];
        bases[0] = null;
        if (!bases[1]) {
          bases[1] = runner;
          lineFor(runner).SB++;
        } else {
          bases[0] = runner;
        }
      }
    } else {
      line.AB++;
      outs++;
      pitcherLine.outs++;
      // Small chance a productive out scores a runner from third.
      if (bases[2] && outs < 3 && chance(0.22)) {
        scoreRunner(bases[2], batter);
        bases[2] = null;
      }
    }
  }

  return { runs, nextIndex: idx % order.length, batterLines, pitcherLine };
}

function mergeBatting(target, source) {
  for (const [slug, line] of Object.entries(source)) {
    target[slug] ||= { ...line };
    if (target[slug] === line) continue;
    for (const k of ['AB', 'R', 'H', 'RBI', 'BB', 'K', 'HR', 'SB']) target[slug][k] += line[k];
  }
}

function outsToIP(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

function simulateGame(game, rosters, profiles, teamGameNos) {
  const awayRoster = rosters.get(game.away);
  const homeRoster = rosters.get(game.home);
  const awayStarter = startingPitcher(awayRoster, teamGameNos[game.away]);
  const homeStarter = startingPitcher(homeRoster, teamGameNos[game.home]);
  const awayOrder = battingOrder(awayRoster, awayStarter);
  const homeOrder = battingOrder(homeRoster, homeStarter);

  let awayIdx = 0;
  let homeIdx = 0;
  let awayRuns = 0;
  let homeRuns = 0;
  let inning = 1;
  const innings = [];
  const awayBat = {};
  const homeBat = {};
  const awayPitch = { player: awayStarter.slug, outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0 };
  const homePitch = { player: homeStarter.slug, outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0 };

  while (inning <= 9 || awayRuns === homeRuns) {
    const top = simulateHalfInning(awayOrder, homeStarter, profiles, awayIdx);
    awayIdx = top.nextIndex;
    awayRuns += top.runs;
    mergeBatting(awayBat, top.batterLines);
    for (const k of ['outs', 'h', 'r', 'er', 'bb', 'k', 'hr']) homePitch[k] += top.pitcherLine[k];

    let bottomRuns = 0;
    if (!(inning >= 9 && homeRuns > awayRuns)) {
      const bottom = simulateHalfInning(homeOrder, awayStarter, profiles, homeIdx);
      homeIdx = bottom.nextIndex;
      bottomRuns = bottom.runs;
      homeRuns += bottom.runs;
      mergeBatting(homeBat, bottom.batterLines);
      for (const k of ['outs', 'h', 'r', 'er', 'bb', 'k', 'hr']) awayPitch[k] += bottom.pitcherLine[k];
    }

    innings.push({ inning, away: top.runs, home: bottomRuns });
    inning++;
    if (inning > 15 && awayRuns === homeRuns) homeRuns++;
  }

  const winner = awayRuns > homeRuns ? game.away : game.home;
  const loser = winner === game.away ? game.home : game.away;
  const winningPitcher = winner === game.away ? awayStarter.slug : homeStarter.slug;
  const losingPitcher = loser === game.away ? awayStarter.slug : homeStarter.slug;

  teamGameNos[game.away]++;
  teamGameNos[game.home]++;

  return {
    schema: 'glb.boxscore.v1-preview',
    game_id: `preview-${String(game.round).padStart(4, '0')}_${game.away}@${game.home}`,
    status: 'Final',
    away: { slug: game.away },
    home: { slug: game.home },
    linescore: {
      innings,
      totals: {
        away: { R: awayRuns, H: Object.values(awayBat).reduce((s, x) => s + x.H, 0), E: 0 },
        home: { R: homeRuns, H: Object.values(homeBat).reduce((s, x) => s + x.H, 0), E: 0 }
      }
    },
    batting: { away: Object.values(awayBat), home: Object.values(homeBat) },
    pitching: {
      away: [{ ...awayPitch, IP: outsToIP(awayPitch.outs) }],
      home: [{ ...homePitch, IP: outsToIP(homePitch.outs) }]
    },
    decisions: { W: winningPitcher, L: losingPitcher, SV: null },
    notes: ['Generated preview; not an official GLB result.']
  };
}

// ---------- derive standings + player totals ----------
function derive(boxscores, teams) {
  const standings = Object.fromEntries(teams.map(t => [t.slug, {
    team: t.team, slug: t.slug, division: t.division, W: 0, L: 0, RS: 0, RA: 0
  }]));
  const batting = {};
  const pitching = {};

  for (const g of boxscores) {
    const ar = g.linescore.totals.away.R;
    const hr = g.linescore.totals.home.R;
    standings[g.away.slug].RS += ar;
    standings[g.away.slug].RA += hr;
    standings[g.home.slug].RS += hr;
    standings[g.home.slug].RA += ar;
    if (ar > hr) {
      standings[g.away.slug].W++;
      standings[g.home.slug].L++;
    } else {
      standings[g.home.slug].W++;
      standings[g.away.slug].L++;
    }

    for (const side of ['away', 'home']) {
      const team = g[side].slug;
      for (const line of g.batting[side]) {
        const key = line.player;
        batting[key] ||= { player: key, team, G: 0, AB: 0, R: 0, H: 0, RBI: 0, BB: 0, K: 0, HR: 0, SB: 0 };
        batting[key].G++;
        for (const k of ['AB', 'R', 'H', 'RBI', 'BB', 'K', 'HR', 'SB']) batting[key][k] += line[k];
      }
      for (const line of g.pitching[side]) {
        const key = line.player;
        pitching[key] ||= { player: key, team, G: 0, GS: 0, outs: 0, H: 0, R: 0, ER: 0, BB: 0, K: 0, HR: 0, W: 0, L: 0, SV: 0 };
        const p = pitching[key];
        p.G++;
        p.GS++;
        p.outs += line.outs;
        p.H += line.h;
        p.R += line.r;
        p.ER += line.er;
        p.BB += line.bb;
        p.K += line.k;
        p.HR += line.hr;
      }
    }
    if (g.decisions.W && pitching[g.decisions.W]) pitching[g.decisions.W].W++;
    if (g.decisions.L && pitching[g.decisions.L]) pitching[g.decisions.L].L++;
  }

  const standingsOut = Object.values(standings).map(s => {
    const gp = s.W + s.L;
    return { ...s, PCT: gp ? Number((s.W / gp).toFixed(3)) : 0, Diff: s.RS - s.RA };
  });

  const battingOut = Object.values(batting).map(b => {
    const avg = b.AB ? b.H / b.AB : 0;
    const obp = (b.AB + b.BB) ? (b.H + b.BB) / (b.AB + b.BB) : 0;
    // Preview SLG uses a conservative estimate because boxscore v1 does not yet store 2B/3B.
    const estTB = b.H + b.HR * 2;
    const slg = b.AB ? estTB / b.AB : 0;
    return { ...b, AVG: Number(avg.toFixed(3)), OBP: Number(obp.toFixed(3)), SLG: Number(slg.toFixed(3)), OPS: Number((obp + slg).toFixed(3)) };
  });

  const pitchingOut = Object.values(pitching).map(p => {
    const ip = p.outs / 3;
    return {
      ...p,
      IP: outsToIP(p.outs),
      ERA: ip ? Number(((p.ER * 9) / ip).toFixed(2)) : 0,
      WHIP: ip ? Number(((p.H + p.BB) / ip).toFixed(2)) : 0
    };
  });

  const top = (arr, field, asc = false, n = 10) => [...arr]
    .filter(x => Number.isFinite(x[field]))
    .sort((a, b) => asc ? a[field] - b[field] : b[field] - a[field])
    .slice(0, n)
    .map(x => ({ player: x.player, team: x.team, value: x[field] }));

  const qualifiedHitters = battingOut.filter(x => x.AB >= GAMES_PER_TEAM * 2.5);
  const qualifiedPitchers = pitchingOut.filter(x => Number.parseFloat(x.IP) >= GAMES_PER_TEAM * 0.5);

  const leaders = {
    batting: {
      AVG: top(qualifiedHitters, 'AVG'), HR: top(battingOut, 'HR'), RBI: top(battingOut, 'RBI'),
      OPS: top(qualifiedHitters, 'OPS'), R: top(battingOut, 'R'), SB: top(battingOut, 'SB')
    },
    pitching: {
      ERA: top(qualifiedPitchers, 'ERA', true), WHIP: top(qualifiedPitchers, 'WHIP', true),
      K: top(pitchingOut, 'K'), SV: top(pitchingOut, 'SV'), W: top(pitchingOut, 'W')
    }
  };

  return { standings: standingsOut, batting: battingOut, pitching: pitchingOut, leaders };
}

function main() {
  console.log(`GLB stat backbone | seed=${SEED} | preview games/team=${GAMES_PER_TEAM}`);
  const { teams } = loadLeague();
  const validation = validateLeague(teams);

  console.log(`Clubs: ${teams.length}`);
  for (const w of validation.warnings) console.log(`WARN: ${w}`);
  for (const e of validation.errors) console.log(`ERROR: ${e}`);

  if (validation.errors.length) {
    process.exitCode = 1;
    return;
  }
  if (VALIDATE_ONLY) {
    console.log('Validation complete. No files written.');
    return;
  }

  const profiles = buildProfiles(validation.rosterMap);
  const schedule = buildSchedule(teams, GAMES_PER_TEAM);
  const teamGameNos = Object.fromEntries(teams.map(t => [t.slug, 0]));
  const boxscores = schedule.map(g => simulateGame(g, validation.rosterMap, profiles, teamGameNos));
  const derived = derive(boxscores, teams);

  fs.rmSync(PREVIEW_DIR, { recursive: true, force: true });
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  writeJson(path.join(PREVIEW_DIR, 'manifest.json'), {
    generated: true,
    official: false,
    seed: SEED,
    games_per_team: GAMES_PER_TEAM,
    clubs: teams.length,
    games: boxscores.length,
    warning: 'Preview data only. Official GLB history remains data/games and must not be overwritten from preview output.'
  });
  writeJson(path.join(PREVIEW_DIR, 'schedule.json'), schedule);
  writeJson(path.join(PREVIEW_DIR, 'boxscores.json'), boxscores);
  writeJson(path.join(PREVIEW_DIR, 'standings.json'), derived.standings);
  writeJson(path.join(PREVIEW_DIR, 'batting.json'), derived.batting);
  writeJson(path.join(PREVIEW_DIR, 'pitching.json'), derived.pitching);
  writeJson(path.join(PREVIEW_DIR, 'leaders.json'), derived.leaders);

  console.log(`Generated ${boxscores.length} preview games.`);
  console.log(`Preview output: ${path.relative(ROOT, PREVIEW_DIR)}/`);
  console.log('No official GLB files were changed.');
}

main();
