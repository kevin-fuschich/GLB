const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const teamsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/teams/teams.json'), 'utf8'));
const teams = Object.values(teamsData.divisions || {}).flat();

const normalizeName = name => String(name || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const names = new Map();
const slugs = new Map();
const errors = [];
let playerCount = 0;

for (const team of teams) {
  const rosterPath = path.join(ROOT, team.roster_path);
  if (!fs.existsSync(rosterPath)) {
    errors.push(`Missing roster: ${team.roster_path}`);
    continue;
  }
  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  for (const player of roster.players || []) {
    playerCount++;
    if (!player.name) errors.push(`${team.slug}: player missing name`);
    if (!player.slug) errors.push(`${team.slug}: ${player.name || 'unnamed player'} missing slug`);

    const normalized = normalizeName(player.name);
    if (normalized) {
      if (!names.has(normalized)) names.set(normalized, []);
      names.get(normalized).push({ team: team.slug, name: player.name, slug: player.slug });
    }
    if (player.slug) {
      if (!slugs.has(player.slug)) slugs.set(player.slug, []);
      slugs.get(player.slug).push({ team: team.slug, name: player.name });
    }
  }
}

for (const entries of names.values()) {
  if (entries.length > 1) {
    errors.push(`Duplicate player name: ${entries.map(x => `${x.name} (${x.team})`).join(' / ')}`);
  }
}
for (const [slug, entries] of slugs) {
  if (entries.length > 1) {
    errors.push(`Duplicate player slug: ${slug} -> ${entries.map(x => `${x.name} (${x.team})`).join(' / ')}`);
  }
}

if (errors.length) {
  console.error('GLB ROSTER UNIQUENESS CHECK FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`GLB roster uniqueness check passed: ${playerCount} players across ${teams.length} clubs; all full names and slugs are unique.`);
