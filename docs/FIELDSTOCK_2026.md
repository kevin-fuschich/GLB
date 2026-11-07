# FIELDSTOCK 2026

All GLB cards use `scripts/player-cards.js` and `player-cards.css` on club pages, player files and the league directory.

- Finished size is 2½ × 3½ inches, a 5:7 width-to-height ratio. Digital displays preserve that ratio. Corners are square.
- The shared brand assets are `assets/fieldstock/symbol.svg` and `assets/fieldstock/wordmark.svg`. Both use outlined lettering.
- Every front uses the same narrow ivory border, large photograph, small gold brand marks and navy nameplate. Only the secondary accent color changes by club.
- Photography varies among action, dugout and candid scenes. Team-specific card templates require a new approved release.
- Every back uses the same brand header, card ID, name, club, biographical grid, 2026 statistics table, player record and field note.
- Statistics come from the season index. Missing biographical information displays an em dash. Existing printed biographies and notes are preserved in `data/cards/fieldstock-2026.json`; canonical roster details take precedence.
- Existing card IDs and claim availability persist. Claim forms sit outside the card faces.

Older printed images remain source artwork. The shared renderer crops their photographs at display time where an unframed photograph is unavailable.
