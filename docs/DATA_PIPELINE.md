# GLB Data Pipeline

## Purpose
This document defines the canonical data flow for Global League Baseball.

GLB records games first. Every league-wide statistic is derived from official box scores.

## Canonical Inputs

### League structure
`data/teams/teams.json`

This file defines the 16 active clubs, division membership, team slugs, abbreviations, and roster paths.

### Rosters
`data/rosters/<team-slug>.json`

These files are the active roster source. Files under `data/teams/roster/` are legacy material and must not be used by new engine code.

### Official games
`data/games/YYYY-MM-DD/*.json`

Only JSON files directly inside a date folder are candidates for official games. Nested folders, probes, fixtures, and test files are not authoritative.

A game is official when:
- its status is `Final` (case-insensitive)
- both team slugs resolve to active GLB teams
- final runs exist for both teams
- the game is not tied

The preferred schema is `glb.boxscore.v1`.

## Derived Outputs

Derived files may be rebuilt at any time from official game files.

### Current standings
`current/standings.json`

Derived from all official box scores in the active season.

### Season game ledger
`data/season/games.json`

Derived index of official games. This is a convenience layer, not a source of truth.

### Future derived outputs
The engine should eventually also rebuild:
- `current/leaders.json`
- season player totals
- team record summaries
- player record summaries
- daily score indexes

## Legacy / Non-Canonical Files
The following existing paths may remain for compatibility while the engine is migrated, but new code must not treat them as authoritative:
- `data/teams/roster/`
- root `Schedule.json`
- root `standings.json`
- root `stats.json`
- `data/standings.json`
- `data/player-game-stats.json`

## Rule
If derived data conflicts with an official box score, the box score wins.

Corrections are made at the box-score level and all downstream data is rebuilt.
