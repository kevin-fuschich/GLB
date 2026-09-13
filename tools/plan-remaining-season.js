#!/usr/bin/env node
const { loadTeams, writeJson } = require('./simulate-day');
const { existingState, planBackfill, validatePlan } = require('./backfill-season');
const path = require('node:path');
const teams = loadTeams();
const state = existingState(teams);
const target = 162;
if (teams.length !== 16) throw new Error('Expected 16 active clubs.');
if ([...state.counts.values()].some(n => n !== 122)) throw new Error('Plan the remaining season from the validated 122-game snapshot.');
const result = planBackfill(teams, state, target);
validatePlan(teams, result, target);
const schedule = {
  schema: 'glb.remaining-schedule.v1', season: 2026,
  starting_games_per_club: 122, target_games_per_club: target,
  generated_from_through: state.latestDate, days: result.plan
};
writeJson(path.join(__dirname, '..', 'data/season/remaining-schedule.json'), schedule);
console.log(`Planned ${schedule.days.reduce((n, d) => n + d.games.length, 0)} games over ${schedule.days.length} dates through ${schedule.days.at(-1).date}.`);
