const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEAMS_PATH = path.join(ROOT, 'data', 'teams', 'teams.json');
const GAMES_DIR = path.join(ROOT, 'data', 'games');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function hashString(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function rng() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function weightedIndex(rng, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return weights.length - 1;
}

function loadTeams() {
  const data = readJson(TEAMS_PATH);
  const teams = [];
  for (const [division, entries] of Object.entries(data.divisions || {})) {
    for (const team of entries) teams.push({ ...team, division });
  }
  return teams;
}

function loadRoster(team) {
  const filePath = path.join(ROOT, team.roster_path);
  const roster = readJson(filePath);
  const hitters = roster.players.filter(p => !['SP', 'RP'].includes(p.position));
  const starters = roster.players.filter(p => p.position === 'SP');
  const relievers = roster.players.filter(p => p.position === 'RP');

  if (hitters.length < 8 || starters.length < 1 || relievers.length < 1) {
    throw new Error(`${team.slug}: roster is not simulation-ready`);
  }

  return { ...roster, hitters, starters, relievers };
}

function simulateRuns(rng) {
  const roll = rng();
  if (roll < 0.08) return 0;
  if (roll < 0.20) return 1;
  if (roll < 0.36) return 2;
  if (roll < 0.54) return 3;
  if (roll < 0.70) return 4;
  if (roll < 0.82) return 5;
  if (roll < 0.90) return 6;
  if (roll < 0.95) return 7;
  if (roll < 0.98) return 8;
  return randInt(rng, 9, 12);
}

function distributeTotal(rng, total, count, maxEach = Infinity) {
  const values = Array(count).fill(0);
  for (let i = 0; i < total; i += 1) {
    const eligible = [];
    for (let j = 0; j < count; j += 1) {
      if (values[j] < maxEach) eligible.push(j);
    }
    if (!eligible.length) break;
    values[eligible[randInt(rng, 0, eligible.length - 1)]] += 1;
  }
  return values;
}

function buildLineScore(rng, awayRuns, homeRuns) {
  const away = distributeTotal(rng, awayRuns, 9);
  const home = distributeTotal(rng, homeRuns, 9);
  return Array.from({ length: 9 }, (_, i) => ({ inning: i + 1, away: away[i], home: home[i] }));
}

function buildBatting(rng, hitters, runs) {
  const n = hitters.length;
  const totalHits = Math.max(runs, randInt(rng, 4, 11));
  const totalWalks = randInt(rng, 1, 5);
  const totalKs = randInt(rng, 4, 12);
  const totalHR = Math.min(totalHits, runs, randInt(rng, 0, Math.min(3, runs)));
  const totalSB = randInt(rng, 0, 2);

  const hits = distributeTotal(rng, totalHits, n, 4);
  const walks = distributeTotal(rng, totalWalks, n, 3);
  const strikeouts = distributeTotal(rng, totalKs, n, 3);
  const homers = distributeTotal(rng, totalHR, n, 2);
  const runVals = distributeTotal(rng, runs, n, 4);
  const rbiVals = distributeTotal(rng, runs, n, 5);
  const steals = distributeTotal(rng, totalSB, n, 2);

  return hitters.map((player, i) => {
    const ab = Math.max(hits[i], 3 + randInt(rng, 0, 2));
    return {
      player: player.slug,
      name: player.name,
      position: player.position,
      AB: ab,
      R: runVals[i],
      H: Math.min(hits[i], ab),
      RBI: rbiVals[i],
      BB: walks[i],
      K: Math.min(strikeouts[i], ab),
      HR: Math.min(homers[i], hits[i], ab),
      SB: steals[i]
    };
  });
}

function sumBatting(lines, key) {
  return lines.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function buildPitching(rng, roster, opponentBatting, opponentRuns, starterIndex) {
  const starter = roster.starters[starterIndex % roster.starters.length];
  const reliever = roster.relievers[randInt(rng, 0, roster.relievers.length - 1)];
  const starterOuts = randInt(rng, 15, 21);
  const relieverOuts = 27 - starterOuts;
  const hits = sumBatting(opponentBatting, 'H');
  const walks = sumBatting(opponentBatting, 'BB');
  const homers = sumBatting(opponentBatting, 'HR');
  const ks = sumBatting(opponentBatting, 'K');

  const starterRunShare = opponentRuns === 0 ? 0 : randInt(rng, 0, opponentRuns);
  const starterHits = hits === 0 ? 0 : randInt(rng, 0, hits);
  const starterWalks = walks === 0 ? 0 : randInt(rng, 0, walks);
  const starterHR = homers === 0 ? 0 : randInt(rng, 0, homers);
  const starterKs = ks === 0 ? 0 : randInt(rng, Math.floor(ks * 0.45), ks);

  return [
    {
      player: starter.slug,
      name: starter.name,
      IP_outs: starterOuts,
      H: starterHits,
      R: starterRunShare,
      ER: starterRunShare,
      BB: starterWalks,
      K: starterKs,
      HR: starterHR
    },
    {
      player: reliever.slug,
      name: reliever.name,
      IP_outs: relieverOuts,
      H: hits - starterHits,
      R: opponentRuns - starterRunShare,
      ER: opponentRuns - starterRunShare,
      BB: walks - starterWalks,
      K: ks - starterKs,
      HR: homers - starterHR
    }
  ];
}

function formatIP(outs) {
  return Number(`${Math.floor(outs / 3)}.${outs % 3}`);
}

function finalizePitching(lines) {
  return lines.map(row => ({ ...row, IP: formatIP(row.IP_outs) }));
}

function chooseDecisions(homeWon, awayPitching, homePitching, rng) {
  const winnerLines = homeWon ? homePitching : awayPitching;
  const loserLines = homeWon ? awayPitching : homePitching;
  const winner = winnerLines[0].player;
  const loser = loserLines[0].player;
  const saveEligible = Math.abs(
    (homeWon ? sumRuns(homePitching) : sumRuns(awayPitching)) -
    (homeWon ? sumRuns(awayPitching) : sumRuns(homePitching))
  ) <= 3;
  const save = saveEligible && rng() < 0.75 ? winnerLines[winnerLines.length - 1].player : null;
  return { W: winner, L: loser, SV: save };
}

function sumRuns(lines) {
  return lines.reduce((sum, row) => sum + Number(row.R || 0), 0);
}

function simulateGame(date, awayTeam, homeTeam, awayRoster, homeRoster, gameIndex) {
  const rng = mulberry32(hashString(`${date}|${awayTeam.slug}|${homeTeam.slug}`));
  let awayRuns = simulateRuns(rng);
  let homeRuns = simulateRuns(rng);
  if (awayRuns === homeRuns) {
    if (rng() < 0.5) awayRuns += 1;
    else homeRuns += 1;
  }

  const awayBatting = buildBatting(rng, awayRoster.hitters, awayRuns);
  const homeBatting = buildBatting(rng, homeRoster.hitters, homeRuns);
  const awayPitching = finalizePitching(buildPitching(rng, awayRoster, homeBatting, homeRuns, gameIndex));
  const homePitching = finalizePitching(buildPitching(rng, homeRoster, awayBatting, awayRuns, gameIndex));
  const homeWon = homeRuns > awayRuns;
  const decisions = chooseDecisions(homeWon, awayPitching, homePitching, rng);
  const innings = buildLineScore(rng, awayRuns, homeRuns);

  return {
    schema: 'glb.boxscore.v1',
    game_id: `${date}_${awayTeam.slug}@${homeTeam.slug}`,
    date,
    away: { slug: awayTeam.slug, name: awayTeam.team },
    home: { slug: homeTeam.slug, name: homeTeam.team },
    status: 'Final',
    attendance: randInt(rng, 12000, 34000),
    linescore: {
      innings,
      totals: {
        away: { R: awayRuns, H: sumBatting(awayBatting, 'H'), E: randInt(rng, 0, 2) },
        home: { R: homeRuns, H: sumBatting(homeBatting, 'H'), E: randInt(rng, 0, 2) }
      }
    },
    final: { away: awayRuns, home: homeRuns },
    batting: { away: awayBatting, home: homeBatting },
    pitching: { away: awayPitching, home: homePitching },
    decisions,
    notes: []
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const date = args[0];
  const slatePath = args[1];
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !slatePath) {
    console.error('Usage: node tools/simulate-day.js YYYY-MM-DD path/to/slate.json');
    process.exit(1);
  }
  return { date, slatePath: path.resolve(process.cwd(), slatePath) };
}

function main() {
  const { date, slatePath } = parseArgs();
  const slate = readJson(slatePath);
  const teams = loadTeams();
  const bySlug = new Map(teams.map(team => [team.slug, team]));
  const used = new Set();

  if (!Array.isArray(slate.games) || slate.games.length === 0) {
    throw new Error('Slate must contain a non-empty games array.');
  }

  slate.games.forEach((game, index) => {
    const away = bySlug.get(game.away);
    const home = bySlug.get(game.home);
    if (!away || !home) throw new Error(`Unknown team in game ${index + 1}.`);
    if (away.slug === home.slug) throw new Error(`Game ${index + 1} has the same team twice.`);
    if (used.has(away.slug) || used.has(home.slug)) throw new Error(`A team appears twice in the slate.`);
    used.add(away.slug);
    used.add(home.slug);

    const awayRoster = loadRoster(away);
    const homeRoster = loadRoster(home);
    const box = simulateGame(date, away, home, awayRoster, homeRoster, index);
    const out = path.join(GAMES_DIR, date, `${away.slug}@${home.slug}.json`);
    if (fs.existsSync(out)) throw new Error(`Refusing to overwrite existing official game: ${out}`);
    writeJson(out, box);
    console.log(`${away.team} ${box.final.away}, ${home.team} ${box.final.home}`);
  });
}

main();
