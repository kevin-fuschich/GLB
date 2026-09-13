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

## Simulation

### Daily slate input
A slate is a small JSON file containing canonical team slugs:

```json
{
  "games": [
    { "away": "spokane-alloys", "home": "albuquerque-aeros" }
  ]
}
```

A team may appear only once in a slate.

### Simulate a day

```bash
node tools/simulate-day.js YYYY-MM-DD path/to/slate.json
```

The simulator:
- loads official team metadata and canonical rosters
- uses a deterministic seed based on date + matchup
- generates a final score and inning linescore
- generates player batting lines
- generates pitcher lines and W/L/SV decisions
- writes one `glb.boxscore.v1` file per game under `data/games/YYYY-MM-DD/`
- refuses to overwrite an existing official game

Simulation produces box scores, not standings or leaderboards.

## Derived Outputs

Run:

```bash
node tools/rebuild-derived.js
```

The rebuild scans official box scores and regenerates all supported downstream records.

### Current standings
`current/standings.json`

Derived from every official box score in the active season.

### Season game ledger
`data/season/games.json`

Derived index of official games. This is a convenience layer, not a source of truth.

### Season player totals
`data/season/player-stats.json`

Aggregated only from batting and pitching lines contained in official box scores.

### Current league leaders
`current/leaders.json`

Derived from season player totals. Supported categories:

Batting:
- AVG
- HR
- RBI
- OPS
- R
- SB

Pitching:
- ERA
- WHIP
- K / SO compatibility alias
- SV
- W

Older score-only box scores remain valid for standings but cannot create player statistics. This is intentional: the engine does not invent missing player lines after the fact.

## Migration Rule

The April 8 legacy official files are currently score-only. Their W/L and run totals remain authoritative, but the old manually entered league-leader values were removed because they could not be traced to official player lines.

As richer simulated box scores accumulate, player totals and leaders will populate automatically.

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
