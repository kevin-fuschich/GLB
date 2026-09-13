# GLB Statistical Backbone

## Goal
Populate the GLB statistical universe broadly and coherently without creating competing realities in hand-edited HTML or duplicate JSON files.

## Source of truth
Official box scores remain authoritative for wins, losses, runs, appearances, and player statistics. Derived outputs should be rebuilt from box scores rather than edited independently.

## Canonical identity layer
- `data/teams/teams.json` — league registry and division membership
- `data/rosters/*.json` — canonical current rosters

Do not use `data/teams/roster/` as the primary roster source. It is a legacy duplicate tree and contains inconsistent filenames.

## Official competitive layer
- `data/games/YYYY-MM-DD/*.json` — official box scores

These files should eventually contain full batting and pitching lines using the box score schema.

## Derived layer
Generated from official box scores:
- standings
- player season batting totals
- player season pitching totals
- league leaders
- team records and run differential

The long-term target is for `current/` to contain only derived current-season outputs.

## Preview generator
`tools/generate-season.js` now creates deterministic PREVIEW data only.

Default:

```bash
node tools/generate-season.js
```

Custom preview:

```bash
node tools/generate-season.js --games-per-team=48 --seed=2026
```

Validation only:

```bash
node tools/generate-season.js --validate-only
```

Preview output is written to:

`data/generated-preview/`

The generator does **not** modify `data/games/` or `current/`.

## Current roster interpretation
The existing full rosters generally contain:
- 5 SP
- 3 RP
- 8 position players

For preview simulation, the starting pitcher bats ninth. This preserves a nine-player lineup without inventing a DH or silently adding roster members.

## 75% population target
"75% complete" should mean the statistical experience feels broadly populated, not that every player or every field is equally complete.

Recommended coverage:
- 100%: club identity, standings, core team record, league leaders
- ~90%: regular hitters and rotation starters
- ~70%: relievers and secondary batting/pitching fields
- ~50% or less: advanced splits, historical records, fringe details

The final production system should remain uneven in depth while staying mathematically coherent.

## Next production step
After preview review:
1. finalize box score stat fields
2. generate/record official game-level player lines
3. derive season totals
4. replace hard-coded standings/stat displays with data-driven outputs
5. retire or ignore duplicate legacy stat files
