#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const teams = Object.values(read('data/teams/teams.json').divisions).flat();
const names = new Map(teams.map(t => [t.slug, t.team]));
const rosters = new Map(teams.map(t => [t.slug, new Set(read(t.roster_path).players.map(p => p.slug))]));
const games = read('data/season/games.json');
const standings = read('current/standings.json');
const stats = read('data/season/player-stats.json');
const locked = read('data/days/locked/2026-04-08.json');
const errors = [];
const gameKeys = new Set();
const dailyTeams = new Map();
const records = new Map(teams.map(t => [t.slug, {w: 0, l: 0, rs: 0, ra: 0}]));
for (const game of games) {
  const key = `${game.date}/${game.away}@${game.home}`;
  if (gameKeys.has(key)) errors.push(`Repeated game: ${key}`);
  gameKeys.add(key);
  const day = dailyTeams.get(game.date) || new Set();
  if (day.has(game.away) || day.has(game.home)) errors.push(`Club plays twice: ${key}`);
  day.add(game.away); day.add(game.home); dailyTeams.set(game.date, day);
  if (!names.has(game.away) || !names.has(game.home)) { errors.push(`Unknown club: ${key}`); continue; }
  const file = `data/games/${key}.json`;
  if (!fs.existsSync(path.join(root, file))) { errors.push(`No box score: ${key}`); continue; }
  const box = read(file);
  if (box.final?.away !== game.awayScore || box.final?.home !== game.homeScore)
    errors.push(`Score disagrees with box score: ${key}`);
  const away = records.get(game.away), home = records.get(game.home);
  away.rs += game.awayScore; away.ra += game.homeScore;
  home.rs += game.homeScore; home.ra += game.awayScore;
  if (game.awayScore > game.homeScore) { away.w++; home.l++; }
  else if (game.homeScore > game.awayScore) { home.w++; away.l++; }
  else errors.push(`Tied final: ${key}`);
  if (!box.batting || !box.pitching) continue; // Older official score-only games.
  for (const side of ['away', 'home']) {
    const team = game[side];
    const sum = k => box.batting[side].reduce((n, row) => n + Number(row[k] || 0), 0);
    if (sum('R') !== game[`${side}Score`]) errors.push(`Batting runs mismatch: ${key} ${side}`);
    if (sum('H') !== box.linescore.totals[side].H) errors.push(`Batting hits mismatch: ${key} ${side}`);
    const opponent = side === 'away' ? 'home' : 'away';
    for (const stat of ['K', 'HR']) {
      const allowed = box.pitching[opponent].reduce((n, row) => n + Number(row[stat] || 0), 0);
      if (sum(stat) !== allowed) errors.push(`Batting/pitching ${stat} mismatch: ${key} ${side}`);
    }
    for (const row of [...box.batting[side], ...box.pitching[side]])
      if (!rosters.get(team).has(row.player)) errors.push(`Unknown player: ${key} ${row.player}`);
    for (const row of box.batting[side]) {
      if (row.H < (row.HR || 0) + (row['2B'] || 0) + (row['3B'] || 0))
        errors.push(`Extra-base hits exceed hits: ${key} ${row.player}`);
      if (row.H + row.K > row.AB || row.R < row.HR || row.RBI < row.HR)
        errors.push(`Impossible batting line: ${key} ${row.player}`);
    }
  }
}
for (const game of locked.games) {
  const key = `${locked.date}/${game.away_slug}@${game.home_slug}`;
  const found = games.find(g => `${g.date}/${g.away}@${g.home}` === key);
  if (!found || found.awayScore !== game.away_score || found.homeScore !== game.home_score)
    errors.push(`Locked Opening Day mismatch: ${key}`);
}
for (const row of Object.values(standings.divisions).flat()) {
  const record = records.get(row.slug);
  if (!record || ['w', 'l', 'rs', 'ra'].some(k => row[k] !== record[k]))
    errors.push(`Standings mismatch: ${row.slug}`);
}
for (const row of stats)
  if (!rosters.get(row.team_slug)?.has(row.player)) errors.push(`Unknown season stat player: ${row.team_slug}/${row.player}`);
console.log(JSON.stringify({games: games.length, richGames: games.filter(g => {
  const b = read(`data/games/${g.date}/${g.away}@${g.home}.json`);
  return Boolean(b.batting && b.pitching);
}).length, teams: teams.length, playerStatRecords: stats.length, errors}, null, 2));
if (errors.length) process.exitCode = 1;
