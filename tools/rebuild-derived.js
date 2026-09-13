const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEAMS_PATH = path.join(ROOT, 'data', 'teams', 'teams.json');
const GAMES_DIR = path.join(ROOT, 'data', 'games');
const CURRENT_DIR = path.join(ROOT, 'current');
const SEASON_DIR = path.join(ROOT, 'data', 'season');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function loadLeague() {
  const league = readJson(TEAMS_PATH);
  const divisions = league.divisions || {};
  const teams = [];

  for (const [division, entries] of Object.entries(divisions)) {
    for (const team of entries) {
      teams.push({ ...team, division });
    }
  }

  return { league, teams, divisions };
}

function normalizeGame(raw, filePath) {
  const awaySlug = raw.away?.slug || raw.away_team?.slug || raw.away;
  const homeSlug = raw.home?.slug || raw.home_team?.slug || raw.home;
  const status = String(raw.status || '').toLowerCase();
  const finalAway = raw.final?.away ?? raw.awayScore ?? raw.away_score;
  const finalHome = raw.final?.home ?? raw.homeScore ?? raw.home_score;
  const date = raw.date || path.basename(path.dirname(filePath));

  return {
    id: raw.game_id || raw.id || `${date}_${awaySlug}@${homeSlug}`,
    date,
    away: awaySlug,
    home: homeSlug,
    awayScore: Number(finalAway),
    homeScore: Number(finalHome),
    status,
    source: path.relative(ROOT, filePath).replace(/\\/g, '/')
  };
}

function loadOfficialGames(validSlugs) {
  if (!fs.existsSync(GAMES_DIR)) return { games: [], warnings: [] };

  const games = [];
  const warnings = [];
  const dateDirs = fs.readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map(entry => entry.name)
    .sort();

  for (const date of dateDirs) {
    const dir = path.join(GAMES_DIR, date);
    const files = fs.readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.json') && entry.name.includes('@'));

    for (const entry of files) {
      const filePath = path.join(dir, entry.name);
      let raw;
      try {
        raw = readJson(filePath);
      } catch (error) {
        warnings.push(`${path.relative(ROOT, filePath)}: invalid JSON (${error.message})`);
        continue;
      }

      const game = normalizeGame(raw, filePath);

      if (game.status !== 'final') {
        warnings.push(`${game.source}: skipped because status is not Final`);
        continue;
      }
      if (!validSlugs.has(game.away) || !validSlugs.has(game.home)) {
        warnings.push(`${game.source}: skipped because a team slug is not active`);
        continue;
      }
      if (!Number.isInteger(game.awayScore) || !Number.isInteger(game.homeScore)) {
        warnings.push(`${game.source}: skipped because final runs are missing or invalid`);
        continue;
      }
      if (game.awayScore < 0 || game.homeScore < 0 || game.awayScore === game.homeScore) {
        warnings.push(`${game.source}: skipped because final score is invalid`);
        continue;
      }

      games.push(game);
    }
  }

  games.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { games, warnings };
}

function pctString(w, l) {
  const gp = w + l;
  return gp ? (w / gp).toFixed(3).replace(/^0/, '') : '.000';
}

function gbString(leader, team) {
  if (leader.slug === team.slug) return '-';
  const gb = ((leader.w - team.w) + (team.l - leader.l)) / 2;
  return Number.isInteger(gb) ? String(gb) : gb.toFixed(1);
}

function diffString(value) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function buildStandings(teams, games) {
  const bySlug = new Map();

  for (const team of teams) {
    bySlug.set(team.slug, {
      team: team.team,
      slug: team.slug,
      division: team.division,
      w: 0,
      l: 0,
      rs: 0,
      ra: 0
    });
  }

  for (const game of games) {
    const away = bySlug.get(game.away);
    const home = bySlug.get(game.home);

    away.rs += game.awayScore;
    away.ra += game.homeScore;
    home.rs += game.homeScore;
    home.ra += game.awayScore;

    if (game.awayScore > game.homeScore) {
      away.w += 1;
      home.l += 1;
    } else {
      home.w += 1;
      away.l += 1;
    }
  }

  const divisions = {};
  const divisionNames = [...new Set(teams.map(team => team.division))];

  for (const division of divisionNames) {
    const rows = [...bySlug.values()]
      .filter(team => team.division === division)
      .sort((a, b) => {
        const aPct = a.w + a.l ? a.w / (a.w + a.l) : 0;
        const bPct = b.w + b.l ? b.w / (b.w + b.l) : 0;
        return bPct - aPct || (b.rs - b.ra) - (a.rs - a.ra) || a.team.localeCompare(b.team);
      });

    const leader = rows[0];
    divisions[division] = rows.map(row => ({
      team: row.team,
      slug: row.slug,
      w: row.w,
      l: row.l,
      pct: pctString(row.w, row.l),
      gb: gbString(leader, row),
      rs: row.rs,
      ra: row.ra,
      diff: diffString(row.rs - row.ra)
    }));
  }

  return divisions;
}

function buildSeasonLedger(games) {
  return games.map(game => ({
    id: game.id,
    date: game.date,
    home: game.home,
    away: game.away,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    status: 'final',
    source: game.source
  }));
}

function main() {
  const { teams } = loadLeague();
  const validSlugs = new Set(teams.map(team => team.slug));
  const { games, warnings } = loadOfficialGames(validSlugs);
  const asOf = games.length ? games[games.length - 1].date : null;

  const standings = {
    as_of: asOf,
    divisions: buildStandings(teams, games)
  };

  writeJson(path.join(CURRENT_DIR, 'standings.json'), standings);
  writeJson(path.join(SEASON_DIR, 'games.json'), buildSeasonLedger(games));

  console.log(`Rebuilt derived GLB data from ${games.length} official box score(s).`);
  console.log(`Standings: ${path.relative(ROOT, path.join(CURRENT_DIR, 'standings.json'))}`);
  console.log(`Game ledger: ${path.relative(ROOT, path.join(SEASON_DIR, 'games.json'))}`);

  if (warnings.length) {
    console.log('\nWarnings:');
    warnings.forEach(warning => console.log(`- ${warning}`));
  }
}

main();
