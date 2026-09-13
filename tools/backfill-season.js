const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  ROOT,
  GAMES_DIR,
  loadTeams,
  simulateSlate,
  readJson,
  writeJson
} = require('./simulate-day');

const SEASON_LENGTH = 162;
const PLAN_PATH = path.join(ROOT, 'data', 'season', 'generated-schedule.json');

function parseArgs() {
  const args = process.argv.slice(2);
  let percent = 75;
  let targetGames = null;
  let startDate = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--percent') percent = Number(args[++i]);
    else if (arg === '--target-games') targetGames = Number(args[++i]);
    else if (arg === '--start-date') startDate = args[++i];
    else if (arg === '--dry-run') dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (targetGames == null) targetGames = Math.round(SEASON_LENGTH * (percent / 100));
  if (!Number.isInteger(targetGames) || targetGames < 1 || targetGames > SEASON_LENGTH) {
    throw new Error(`Target games must be an integer from 1 to ${SEASON_LENGTH}.`);
  }
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new Error('Start date must use YYYY-MM-DD.');
  }

  return { percent, targetGames, startDate, dryRun };
}

function dateString(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateString(date);
}

function directGameFiles() {
  if (!fs.existsSync(GAMES_DIR)) return [];
  const files = [];
  for (const dateEntry of fs.readdirSync(GAMES_DIR, { withFileTypes: true })) {
    if (!dateEntry.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(dateEntry.name)) continue;
    const dir = path.join(GAMES_DIR, dateEntry.name);
    for (const gameEntry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!gameEntry.isFile() || !gameEntry.name.endsWith('.json') || !gameEntry.name.includes('@')) continue;
      files.push(path.join(dir, gameEntry.name));
    }
  }
  return files.sort();
}

function normalizeExisting(raw, filePath) {
  const date = raw.date || path.basename(path.dirname(filePath));
  const away = raw.away?.slug || raw.away_team?.slug || raw.away;
  const home = raw.home?.slug || raw.home_team?.slug || raw.home;
  const status = String(raw.status || '').toLowerCase();
  const awayScore = Number(raw.final?.away ?? raw.awayScore ?? raw.away_score);
  const homeScore = Number(raw.final?.home ?? raw.homeScore ?? raw.home_score);
  if (status !== 'final' || !away || !home || !Number.isInteger(awayScore) || !Number.isInteger(homeScore)) return null;
  return { date, away, home };
}

function existingState(teams) {
  const counts = new Map(teams.map(team => [team.slug, 0]));
  const homeCounts = new Map(teams.map(team => [team.slug, 0]));
  const matchupCounts = new Map();
  const games = [];
  let latestDate = null;

  for (const filePath of directGameFiles()) {
    let raw;
    try {
      raw = readJson(filePath);
    } catch (_) {
      continue;
    }
    const game = normalizeExisting(raw, filePath);
    if (!game || !counts.has(game.away) || !counts.has(game.home)) continue;
    games.push(game);
    counts.set(game.away, counts.get(game.away) + 1);
    counts.set(game.home, counts.get(game.home) + 1);
    homeCounts.set(game.home, homeCounts.get(game.home) + 1);
    const key = pairKey(game.away, game.home);
    matchupCounts.set(key, (matchupCounts.get(key) || 0) + 1);
    if (!latestDate || game.date > latestDate) latestDate = game.date;
  }

  return { counts, homeCounts, matchupCounts, games, latestDate };
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function chooseOpponent(a, candidates, counts, matchupCounts) {
  return [...candidates].sort((b, c) => {
    const bMatchups = matchupCounts.get(pairKey(a, b)) || 0;
    const cMatchups = matchupCounts.get(pairKey(a, c)) || 0;
    return bMatchups - cMatchups || counts.get(b) - counts.get(c) || b.localeCompare(c);
  })[0];
}

function orientGame(a, b, homeCounts, matchupCounts) {
  const aHome = homeCounts.get(a) || 0;
  const bHome = homeCounts.get(b) || 0;
  if (aHome < bHome) return { away: b, home: a };
  if (bHome < aHome) return { away: a, home: b };

  const prior = matchupCounts.get(pairKey(a, b)) || 0;
  return prior % 2 === 0 ? { away: a, home: b } : { away: b, home: a };
}

function buildDay(counts, homeCounts, matchupCounts, targetGames) {
  const eligible = [...counts.keys()].filter(slug => counts.get(slug) < targetGames);
  const unpaired = new Set(eligible);
  const games = [];

  while (unpaired.size >= 2) {
    const ordered = [...unpaired].sort((a, b) => counts.get(a) - counts.get(b) || a.localeCompare(b));
    const a = ordered[0];
    unpaired.delete(a);
    const b = chooseOpponent(a, unpaired, counts, matchupCounts);
    if (!b) break;
    unpaired.delete(b);

    const game = orientGame(a, b, homeCounts, matchupCounts);
    games.push(game);

    counts.set(a, counts.get(a) + 1);
    counts.set(b, counts.get(b) + 1);
    homeCounts.set(game.home, homeCounts.get(game.home) + 1);
    const key = pairKey(a, b);
    matchupCounts.set(key, (matchupCounts.get(key) || 0) + 1);
  }

  return games;
}

function planBackfill(teams, state, targetGames, requestedStartDate) {
  const counts = new Map(state.counts);
  const homeCounts = new Map(state.homeCounts);
  const matchupCounts = new Map(state.matchupCounts);
  const plan = [];
  let date = requestedStartDate || (state.latestDate ? addDays(state.latestDate, 1) : '2026-04-08');
  let gameDayIndex = 0;
  let guard = 0;

  while ([...counts.values()].some(value => value < targetGames)) {
    guard += 1;
    if (guard > 1000) throw new Error('Backfill planner exceeded safety limit.');

    // Six game days, then one league-wide recovery/travel day.
    if (gameDayIndex > 0 && gameDayIndex % 6 === 0) {
      date = addDays(date, 1);
      gameDayIndex = 0;
    }

    const games = buildDay(counts, homeCounts, matchupCounts, targetGames);
    if (!games.length) throw new Error('Unable to complete schedule with remaining team game counts.');
    plan.push({ date, games });
    date = addDays(date, 1);
    gameDayIndex += 1;
  }

  return { plan, counts, homeCounts, matchupCounts };
}

function validatePlan(teams, planResult, targetGames) {
  const errors = [];
  for (const team of teams) {
    const count = planResult.counts.get(team.slug);
    if (count !== targetGames) errors.push(`${team.slug}: planned ${count}, expected ${targetGames}`);
  }
  if (errors.length) throw new Error(`Backfill validation failed:\n${errors.join('\n')}`);
}

function main() {
  const options = parseArgs();
  const teams = loadTeams();
  const state = existingState(teams);

  for (const team of teams) {
    const current = state.counts.get(team.slug) || 0;
    if (current > options.targetGames) {
      throw new Error(`${team.slug} already has ${current} games, above target ${options.targetGames}.`);
    }
  }

  const result = planBackfill(teams, state, options.targetGames, options.startDate);
  validatePlan(teams, result, options.targetGames);

  const existingGames = state.games.length;
  const plannedGames = result.plan.reduce((sum, day) => sum + day.games.length, 0);
  const scheduleDoc = {
    schema: 'glb.generated-schedule.v1',
    season: 2026,
    target_games_per_team: options.targetGames,
    target_percent: Number(((options.targetGames / SEASON_LENGTH) * 100).toFixed(1)),
    existing_official_games: existingGames,
    generated_games: plannedGames,
    generated_at: new Date().toISOString(),
    days: result.plan
  };

  console.log(`GLB backfill target: ${options.targetGames}/${SEASON_LENGTH} games per club (${scheduleDoc.target_percent}%).`);
  console.log(`Existing official games: ${existingGames}. New games planned: ${plannedGames}.`);
  console.log(`Game dates to generate: ${result.plan.length}.`);

  if (options.dryRun) {
    console.log('Dry run only; no files written.');
    return;
  }

  writeJson(PLAN_PATH, scheduleDoc);
  for (const day of result.plan) {
    const results = simulateSlate(day.date, day.games);
    console.log(`${day.date}: generated ${results.length} game(s)`);
  }

  execFileSync(process.execPath, [path.join(__dirname, 'rebuild-derived.js')], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  console.log('Backfill complete. Official box scores and all derived records are synchronized.');
}

if (require.main === module) main();

module.exports = {
  existingState,
  planBackfill,
  buildDay,
  validatePlan
};
