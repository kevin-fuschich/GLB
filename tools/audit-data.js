#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const findings = [];
const issue = (kind, detail) => findings.push({kind, detail});
const teams = Object.values(read('data/teams/teams.json').divisions).flat();
const slugs = new Set(teams.map(t => t.slug));
const rosterPlayers = new Map();
for (const team of teams) {
  const roster = read(team.roster_path);
  if (roster.team !== team.team) issue('roster team mismatch', team.slug);
  for (const player of roster.players) {
    if (!player.slug) issue('player missing slug', `${team.slug}: ${player.name}`);
    const key = `${team.slug}/${player.slug}`;
    if (rosterPlayers.has(key)) issue('duplicate player', key);
    rosterPlayers.set(key, player);
  }
  const legacy = path.join(root, 'data/teams/roster', `${team.slug}.json`);
  if (fs.existsSync(legacy)) {
    try {
      const old = JSON.parse(fs.readFileSync(legacy, 'utf8'));
      const currentNames = new Set(roster.players.map(p => p.name));
      const shared = old.players.filter(p => currentNames.has(p.name)).length;
      if (shared !== roster.players.length || shared !== old.players.length)
        issue('divergent roster copies', `${team.slug}: canonical ${roster.players.length}, older ${old.players.length}, shared names ${shared}`);
    } catch (err) { issue('invalid older roster', `${team.slug}: ${err.message}`); }
  }
}
const day = read('data/days/locked/2026-04-08.json');
const canonical = new Map(day.games.map(g => [`${day.date}/${g.away_slug}@${g.home_slug}`, g]));
const season = read('data/season/games.json');
const seen = new Set();
for (const game of season) {
  const key = `${game.date}/${game.away}@${game.home}`;
  if (seen.has(key)) issue('duplicate season game', key);
  seen.add(key);
  for (const slug of [game.away, game.home]) if (!slugs.has(slug)) issue('unknown game team', `${key}: ${slug}`);
  if (game.away === game.home) issue('self matchup', key);
  if (game.date === day.date && game.status.toLowerCase() === 'final') {
    const locked = canonical.get(key);
    if (!locked) issue('final game absent from locked day', key);
    else if (locked.away_score !== game.awayScore || locked.home_score !== game.homeScore)
      issue('conflicting final score', key);
  }
}
for (const key of canonical.keys()) if (!seen.has(key)) issue('locked game absent from season', key);
const stats = read('data/season/player-game-stats.json');
for (const stat of stats) {
  if (!season.some(g => g.id === stat.gameId)) issue('orphan player stat', stat.gameId);
  if (!rosterPlayers.has(`${stat.team}/${stat.player}`)) issue('unknown stat player', `${stat.team}/${stat.player}`);
}
console.log(JSON.stringify({teams: teams.length, canonicalRosterPlayers: rosterPlayers.size,
  lockedGames: canonical.size, seasonGames: season.length, playerGameStatLines: stats.length,
  findings}, null, 2));
if (findings.length) process.exitCode = 1;
