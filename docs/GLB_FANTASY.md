# GLB Fantasy: weekly tournament

Four picks per account per week: one pitcher (SP/RP/CL) and three position players in any mix of infielders (C/1B/2B/3B/SS/IF) and outfielders (LF/CF/RF/OF). DH-only players are excluded. No budget and no club quota. The role pool is frozen when the Board publishes a week.

Each tournament covers Monday through Sunday, New York time. Entries lock Monday at 00:00; the server rejects edits at or after that instant. Only the public User ID and score appear before lock; lineups become public after lock. Registration explicitly explains this public display. Draft picks saved on a device are not an entry. There is one public leaderboard per week, with fresh points each week.

Batters: H + 2B + 2×3B + 3×HR + R + RBI + BB + 2×SB. Pitchers: IP_outs + K − 2×ER + 5×W + 3×SV. The server independently computes these from raw official counts. DNP is zero, negative scores are permitted, and imported games replace their prior values rather than adding duplicates.

## Running a week

There are no active tournaments in the 2026 offseason. Do not fabricate a future schedule or use historical games for a prize tournament. Once the next official schedule exists:

1. Update `data/fantasy/players.json` for that season's rosters. Every player must have a stable `club/player` ID and role. Confirm all included player identities and photos.
2. Sign in with a Board account and open `fantasy.html`. Its tournament desk is only shown to the Board; all write RPCs independently check Board membership.
3. Choose a future Monday and publish its scheduled week. The browser reads official `data/season/games.json` and `data/season/remaining-schedule.json` and freezes that week's game IDs, dates and box-score sources. No tournament can be published without scheduled games.
4. During the week, select it and click **Record completed games**. The Board browser fetches official box-score paths; missing/unplayed games are skipped. It sends raw integer stat lines to `glb_weekly_import`. The database calculates points and replaces results by game ID. Run again for corrected box scores.
5. After the week ends and every included game has a result, click **Confirm final winners**. Every team tied for first receives one pack entitlement. A postponed game keeps settlement pending. No entry fee is charged.
6. Winners click **Collect your winning pack**. The transaction reserves an unopened FIELDSTOCK pack using the same inventory locks as pack purchases. If no released inventory is available, the entitlement stays pending; it is not converted into credits. Repeated claims return the same pack. The pack appears on the collector's book shelf.

This release uses Board publication, result imports and final confirmation. These operations are not scheduled jobs; daily simulation does not automatically import fantasy results. Do not describe scores or prize delivery as fully automatic.

The earlier private replay tables and RPCs are retained for existing records, and the fantasy page presents weekly and season-long competitions.

## Verification

`node --test tests/weekly-fantasy.test.cjs` checks role composition and official result conversion. `tests/weekly-fantasy.sql` uses rolled-back database fixtures to check ownership, one entry per account, pre-lock privacy, edit deadlines, score imports, tied winners, incomplete-week protection and duplicate pack claims. No test users, tournaments or packs survive.

## Winners and the weekly archive

Confirmed weeks show every first-place winner above their final leaderboard, including the public User ID, four-player lineup, final points and earned/collected pack status. Past weeks remain in a dedicated archive; its week cards list winners and link to the full final standings. Weeks awaiting confirmation show provisional status without naming winners. The latest completed week opens by default when no tournament is active. A `?week=weekly-YYYY-MM-DD` URL opens that week's record directly.

The public catalog exposes only winner User IDs and final points; private owner IDs and emails are never included. Ties and archived public metadata are covered by the transaction-only SQL checks.

## One-pitcher balance check (November 16, 2026)

`node tools/check-fantasy-balance.cjs` checks the official regular-season index and its player box scores with the same scoring functions used by the importer. It excludes weeks without a complete calendar span or player lines. Across 26 complete weeks, including zero-appearance weeks, the 77 starting pitchers averaged 27.5 points per player-week and the 133 eligible position players averaged 17.7. Three position players therefore contribute about 53 points on average, compared with 27.5 from one starting pitcher (about 34% of the combined mean). A fixed-seed sample of 1,000 distinct three-player groups per week produced a combined median of 52. This is a historical baseline, not a prediction of optimized entries; relief pitchers remain eligible. No point weights changed with the roster update.

## The Long Game · season-long team

The Long Game is the season-long competition, with the headline “Pick your pair. Play the Long Game.” It is independent of weekly entries: one pitcher and one batter for the regular season, one entry per account. Pitchers are SP/RP/CL/P. All non-pitchers are eligible batters, including catchers and DH-only players. The season roster is `data/fantasy/season-players.json`; refresh it alongside the weekly roster when the next season is confirmed.

Users can adjust their pair before Opening Day at 00:00 New York time. After that, no player swaps are allowed, including for injuries. DNP earns zero. Only games frozen in the official regular-season schedule count; postseason is excluded. The server calculates cumulative points and each player's contribution. Before lock, only an entrant's own pair is visible to them; after lock, both picks and their points appear on the public season leaderboard. Final tied first-place teams are highlighted and previous seasons remain available in the selector. No season pack prize is configured; weekly pack rewards are unchanged.

The signed-in Board's season desk publishes the chosen year's confirmed official schedule before its first game day. It reads the same regular-season game index and remaining schedule as the weekly desk. During the season, **Record completed season games** imports official raw box-score lines in batches of 100; retries and corrections replace existing games without duplicate points. Some batches can be recorded before a later fetch fails, so rerunning the action is safe. **Confirm final season standings** only succeeds after the final scheduled date and a result for every included game. Operations remain Board-run, not scheduled jobs. No future schedule is invented during the offseason.

`tests/season-fantasy.test.cjs` covers two-slot eligibility, DH/catcher inclusion and full roster coverage. `tests/season-fantasy.sql` uses rolled-back fixtures to check owner isolation, deadline enforcement, pre-lock privacy, server totals, per-player breakdowns, corrected results, incomplete-season protection, tied winners and final-result freezing.
