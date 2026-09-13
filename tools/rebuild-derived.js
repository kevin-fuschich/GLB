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
    for (const team of entries) teams.push({ ...team, division });
  }

  return { league, teams, divisions };
}

function loadPlayerIndex(teams) {
  const players = new Map();
  for (const team of teams) {
    const roster = readJson(path.join(ROOT, team.roster_path));
    for (const player of roster.players || []) {
      players.set(player.slug, {
        player: player.slug,
        name: player.name,
        team: team.team,
        team_slug: team.slug,
        position: player.position
      });
    }
  }
  return players;
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
    source: path.relative(ROOT, filePath).replace(/\\/g, '/'),
    batting: raw.batting || null,
    pitching: raw.pitching || null,
    decisions: raw.decisions || null
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

function ipToOuts(row) {
  if (Number.isInteger(row.IP_outs)) return row.IP_outs;
  const value = String(row.IP ?? '0');
  const [whole, frac = '0'] = value.split('.');
  return Number(whole || 0) * 3 + Math.min(2, Number(frac || 0));
}

function getOrCreate(map, slug, playerIndex) {
  if (!map.has(slug)) {
    const meta = playerIndex.get(slug) || {
      player: slug,
      name: slug,
      team: 'Unknown',
      team_slug: 'unknown',
      position: null
    };
    map.set(slug, {
      ...meta,
      batting: { G: 0, AB: 0, R: 0, H: 0, '2B': 0, '3B': 0, HR: 0, RBI: 0, BB: 0, K: 0, SB: 0 },
      pitching: { G: 0, OUTS: 0, H: 0, R: 0, ER: 0, BB: 0, K: 0, HR: 0, W: 0, L: 0, SV: 0 }
    });
  }
  return map.get(slug);
}

function addBattingLine(target, row) {
  target.G += 1;
  for (const key of ['AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'K', 'SB']) {
    target[key] += Number(row[key] || 0);
  }
}

function addPitchingLine(target, row) {
  target.G += 1;
  target.OUTS += ipToOuts(row);
  for (const key of ['H', 'R', 'ER', 'BB', 'K', 'HR']) target[key] += Number(row[key] || 0);
}

function aggregatePlayers(games, playerIndex, warnings) {
  const totals = new Map();

  for (const game of games) {
    if (!game.batting || !game.pitching) continue;
    for (const side of ['away', 'home']) {
      for (const row of game.batting[side] || []) {
        if (!row.player) {
          warnings.push(`${game.source}: batting row missing player slug`);
          continue;
        }
        addBattingLine(getOrCreate(totals, row.player, playerIndex).batting, row);
      }
      for (const row of game.pitching[side] || []) {
        if (!row.player) {
          warnings.push(`${game.source}: pitching row missing player slug`);
          continue;
        }
        addPitchingLine(getOrCreate(totals, row.player, playerIndex).pitching, row);
      }
    }

    if (game.decisions) {
      if (game.decisions.W) getOrCreate(totals, game.decisions.W, playerIndex).pitching.W += 1;
      if (game.decisions.L) getOrCreate(totals, game.decisions.L, playerIndex).pitching.L += 1;
      if (game.decisions.SV) getOrCreate(totals, game.decisions.SV, playerIndex).pitching.SV += 1;
    }
  }

  return [...totals.values()].sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
}

function battingMetrics(row) {
  const b = row.batting;
  const avg = b.AB ? b.H / b.AB : 0;
  const obp = b.AB + b.BB ? (b.H + b.BB) / (b.AB + b.BB) : 0;
  const singles = Math.max(0, b.H - b['2B'] - b['3B'] - b.HR);
  const tb = singles + 2 * b['2B'] + 3 * b['3B'] + 4 * b.HR;
  const slg = b.AB ? tb / b.AB : 0;
  return { AVG: avg, OPS: obp + slg };
}

function pitchingMetrics(row) {
  const p = row.pitching;
  const innings = p.OUTS / 3;
  return {
    ERA: innings ? 9 * p.ER / innings : Infinity,
    WHIP: innings ? (p.BB + p.H) / innings : Infinity
  };
}

function rate3(value) {
  return value.toFixed(3).replace(/^0/, '');
}

function leaderEntry(row, value) {
  return {
    player: row.name,
    player_slug: row.player,
    team: row.team,
    team_slug: row.team_slug,
    value
  };
}

function top(rows, getter, formatter, filter = () => true, ascending = false) {
  return rows
    .filter(filter)
    .map(row => ({ row, metric: getter(row) }))
    .filter(item => Number.isFinite(item.metric))
    .sort((a, b) => ascending ? a.metric - b.metric : b.metric - a.metric || a.row.name.localeCompare(b.row.name))
    .slice(0, 10)
    .map(item => leaderEntry(item.row, formatter(item.metric)));
}

function buildLeaders(playerTotals, asOf) {
  const hitters = playerTotals.filter(row => row.batting.AB > 0);
  const pitchers = playerTotals.filter(row => row.pitching.OUTS > 0);
  const batting = {
    AVG: top(hitters, row => battingMetrics(row).AVG, rate3),
    HR: top(hitters, row => row.batting.HR, value => String(value)),
    RBI: top(hitters, row => row.batting.RBI, value => String(value)),
    OPS: top(hitters, row => battingMetrics(row).OPS, value => value.toFixed(3)),
    R: top(hitters, row => row.batting.R, value => String(value)),
    SB: top(hitters, row => row.batting.SB, value => String(value))
  };
  const pitching = {
    ERA: top(pitchers, row => pitchingMetrics(row).ERA, value => value.toFixed(2), () => true, true),
    WHIP: top(pitchers, row => pitchingMetrics(row).WHIP, value => value.toFixed(2), () => true, true),
    K: top(pitchers, row => row.pitching.K, value => String(value)),
    SO: top(pitchers, row => row.pitching.K, value => String(value)),
    SV: top(pitchers, row => row.pitching.SV, value => String(value)),
    W: top(pitchers, row => row.pitching.W, value => String(value))
  };
  return { as_of: asOf, batting, pitching };
}

function serializablePlayerTotals(rows) {
  return rows.map(row => ({
    player: row.player,
    name: row.name,
    team: row.team,
    team_slug: row.team_slug,
    position: row.position,
    batting: {
      ...row.batting,
      AVG: row.batting.AB ? rate3(row.batting.H / row.batting.AB) : '.000',
      OPS: row.batting.AB ? battingMetrics(row).OPS.toFixed(3) : '.000'
    },
    pitching: {
      ...row.pitching,
      IP: `${Math.floor(row.pitching.OUTS / 3)}.${row.pitching.OUTS % 3}`,
      ERA: row.pitching.OUTS ? pitchingMetrics(row).ERA.toFixed(2) : null,
      WHIP: row.pitching.OUTS ? pitchingMetrics(row).WHIP.toFixed(2) : null
    }
  }));
}

function main() {
  const { teams } = loadLeague();
  const playerIndex = loadPlayerIndex(teams);
  const validSlugs = new Set(teams.map(team => team.slug));
  const { games, warnings } = loadOfficialGames(validSlugs);
  const asOf = games.length ? games[games.length - 1].date : null;

  writeJson(path.join(CURRENT_DIR, 'standings.json'), {
    as_of: asOf,
    divisions: buildStandings(teams, games)
  });
  writeJson(path.join(SEASON_DIR, 'games.json'), buildSeasonLedger(games));

  const playerTotals = aggregatePlayers(games, playerIndex, warnings);
  writeJson(path.join(SEASON_DIR, 'player-stats.json'), serializablePlayerTotals(playerTotals));
  writeJson(path.join(CURRENT_DIR, 'leaders.json'), buildLeaders(playerTotals, asOf));

  const richGames = games.filter(game => game.batting && game.pitching).length;
  console.log(`Rebuilt GLB data from ${games.length} official box score(s); ${richGames} include player lines.`);
  console.log('Derived: current/standings.json');
  console.log('Derived: data/season/games.json');
  console.log('Derived: data/season/player-stats.json');
  console.log('Derived: current/leaders.json');

  if (warnings.length) {
    console.log('\nWarnings:');
    warnings.forEach(warning => console.log(`- ${warning}`));
  }
}

main();
