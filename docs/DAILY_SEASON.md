# Daily GLB season

The published 75% snapshot ends August 28, 2026. `data/season/remaining-schedule.json` fixes the remaining 320 matchups: eight games per active date, with a rest day after each six game dates. The final scheduled date is October 13. The plan uses active team slugs and brings each club from 122 to 162 games.

At approximately 6 a.m. New York time, `.github/workflows/glb-daily-season.yml` runs `node tools/run-daily.js`. GitHub cron uses both 10:00 and 11:00 UTC; the runner skips a tick before 6 a.m. local time and a second tick is harmless. Delayed or missed runs catch up due dates, at most 20 unplayed dates per run. The job commits new official box scores, standings, season game ledger, player totals, and leaders to `main`. GitHub Pages then deploys the new site data.

Read-only preview: `node tools/run-daily.js --through 2026-09-12 --dry-run`. To test generation, run the command in an isolated copy of the repository; it writes game files and rebuilds derived records. The runner refuses to overwrite an existing planned matchup and stops on a conflicting game on that date. Repeating it after a successful run writes nothing.

If a game needs correction, edit its `data/games/YYYY-MM-DD/away@home.json`, then run `node tools/rebuild-derived.js` and `node tools/validate-season-snapshot.js`; commit the corrected box score and derived outputs together. Do not edit `current/standings.json` or `data/season/player-stats.json` directly. After October 13, the daily workflow no-ops unless a new season plan is deliberately prepared.
