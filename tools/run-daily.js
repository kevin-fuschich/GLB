#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { ROOT, loadTeams, simulateSlate, readJson } = require('./simulate-day');
const { existingState } = require('./backfill-season');
const schedule = readJson(path.join(ROOT, 'data/season/remaining-schedule.json'));
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const throughArg = args.indexOf('--through');
const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
}).formatToParts(new Date()).map(p => [p.type, p.value]));
const today = `${parts.year}-${parts.month}-${parts.day}`;
const through = throughArg >= 0 ? args[throughArg + 1] : today;
if (args.some((arg, i) => !['--dry-run', '--through'].includes(arg) && i !== throughArg + 1)) throw new Error('Usage: node tools/run-daily.js [--through YYYY-MM-DD] [--dry-run]');
if (!/^2026-\d\d-\d\d$/.test(through || '')) throw new Error('Through date must be YYYY-MM-DD in the 2026 season.');
if (throughArg < 0 && Number(parts.hour) < 6) {
  console.log(`It is before 6 a.m. New York time on ${today}; no game is due.`);
  process.exit(0);
}
const teams = loadTeams();
const slugs = new Set(teams.map(t => t.slug));
if (schedule.schema !== 'glb.remaining-schedule.v1' || schedule.target_games_per_club !== 162) throw new Error('Unrecognized season plan.');
let previous = schedule.generated_from_through;
for (const day of schedule.days) {
  if (day.date <= previous) throw new Error(`Unordered date ${day.date}`);
  previous = day.date;
  const used = new Set();
  for (const g of day.games) {
    if (!slugs.has(g.away) || !slugs.has(g.home) || g.away === g.home || used.has(g.away) || used.has(g.home))
      throw new Error(`Invalid matchup on ${day.date}`);
    used.add(g.away); used.add(g.home);
  }
}
const due = schedule.days.filter(day => day.date <= through);
const state = existingState(teams);
if ([...state.counts.values()].some(n => n > 162)) throw new Error('Season exceeds 162 games per club.');
let generated = 0;
let processedDays = 0;
for (const day of due) {
  const dir = path.join(ROOT, 'data/games', day.date);
  const existing = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json') && f.includes('@')) : [];
  const reserved = new Set();
  for (const filename of existing) {
    const [away, home] = filename.slice(0, -5).split('@');
    if (reserved.has(away) || reserved.has(home)) throw new Error(`Club plays twice on ${day.date}`);
    reserved.add(away); reserved.add(home);
  }
  const pending = day.games.filter(g => {
    const key = `${g.away}@${g.home}.json`;
    if (existing.includes(key)) return false;
    if (reserved.has(g.away) || reserved.has(g.home)) throw new Error(`Existing game conflicts with planned slate on ${day.date}`);
    return true;
  });
  if (!pending.length) continue;
  if (processedDays >= 20) break;
  processedDays += 1;
  console.log(`${day.date}: ${pending.length} game(s) ${dryRun ? 'planned' : 'generating'}`);
  if (!dryRun) simulateSlate(day.date, pending);
  generated += pending.length;
}
if (generated && !dryRun) {
  execFileSync(process.execPath, [path.join(__dirname, 'rebuild-derived.js')], {cwd: ROOT, stdio: 'inherit'});
  execFileSync(process.execPath, [path.join(__dirname, 'validate-season-snapshot.js')], {cwd: ROOT, stdio: 'inherit'});
}
console.log(`${dryRun ? 'Would generate' : 'Generated'} ${generated} games through ${through}.`);
