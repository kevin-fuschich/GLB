# FIELDSTOCK collection system

## Release contract

Prepare a complete set in advance: set year, subjects, biographies, era-specific statistics, card fronts/backs, parallels, edition quantities and cards per pack. Historical sets have their own previously unknown rosters; they do not alter the current season index. The release year and the depicted season can differ.

Start a draft in `glb_sets` with `release_at = null`. Insert editions and exactly one inventory row for each serial number before setting a release time. Released/scheduled definitions are frozen. No production set or rarity cap is seeded by this migration: the 2026 checklist and artwork must be complete before release. Existing artistic claim IDs and receipts remain unchanged.

All copies exist in a finite hidden pool. Each opening draws uniformly from remaining copies across that set, including parallels. Consequently rarity probabilities reflect remaining quantities and can change as inventory is discovered. Cards within a pack can be doubles; a particular physical copy cannot repeat. Print quantities must be explicit per edition. Complete packs are reserved against available stock when earned; insufficient stock retains the reward as a pending credit for a later release.

Public discovery counts are opened copies per edition. Individual serials identify prebuilt copies; the first discovery might be copy 418/1000. Transfers never change discovery counts. This prevents confusing discovery count with serial number. No user preferences or subject of a claim influence pack contents.

## Rewards: initial rules

- Welcome: one pack for an account with a public User ID.
- Return visits: one pack at 3, 7 and 30 distinct UTC dates. Page refreshes and token refreshes cannot inflate the count.
- Legitimate claim + approved claim: two separately labeled rewards after Board approval verifies legitimacy. Pending or declined submissions do not earn packs. Approved rewards are reconciled on album visits without adding triggers to the existing review workflow.
- Collaboration: one reward per approved note.
- Unique reward keys prevent reissuance; additional rules can use the same ledger.

A distinct Board validation state can later award the legitimate-submission pack before final approval. Do not pay for raw submissions. Before broader launch, review account farming, same-subject resubmissions and collusive Board-approved notes; existing moderation is the first control, not a guarantee against abuse.

## Ownership

Every copy has a permanent UUID, edition, serial, current account owner, opening date and private 16-digit numeric code. Codes stay server-side until an owner explicitly reveals one. Private tables are unavailable through public/client reads. The album never stores secrets in localStorage or URLs.

Transfers require the registered owner's authenticated session, a session created by a sign-in within 10 minutes, the current code and an exact existing recipient User ID. Requests expire after 48 hours. Recipients accept in a recent session; senders can cancel pending requests. Acceptance atomically changes the owner, rotates the code and appends ownership history. Replaying acceptance does nothing. Failed code attempts are rate-limited per owner. Token refresh time is not accepted as evidence of a fresh sign-in.

The registry establishes the recognized collectible owner within GLB. Copyright/license terms, operator continuity/backups, recovery/disputes and eventual public provenance exports remain launch requirements; this is not a blockchain or a claim that software is invulnerable.

## Installation and validation

1. Apply existing `supabase/glb-accounts.sql` if not already active.
2. Apply `supabase/glb-collecting.sql` with database-owner migration access.
3. Run `npm ci --prefix tests/supabase-accounts --ignore-scripts`, then `node tests/supabase-accounts/permissions.mjs` and `node tests/supabase-accounts/collecting.mjs`.
4. Check the target Supabase project's `auth.sessions` fields/privileges in staging. Test email reauthentication, multiple simultaneous browsers, opening retries after network loss and competing transfer acceptance/cancellation against hosted PostgreSQL.
5. Prepare the complete draft 2026 catalog and artwork. Validate every file and fact before setting release time.
6. Deploy `album.html`, `album.css`, `scripts/album.js` and the account link together. Signed-out users are directed to sign in; unavailable backend never invents inventory or ownership.

Local PGlite tests validate SQL permissions and sequential transactional behavior. They do not substitute for hosted concurrent-connection, session-provider or recovery testing. The additive schema is installed in the existing GLB Supabase project. Transaction-isolated hosted tests passed for opening, ownership privacy, transfer acceptance and rotation; all fixture rows were rolled back. Email reauthentication UX and simultaneous-connection load testing remain pre-release checks. Existing account functions and review triggers were preserved. No set is released by the setup.

## Player records and collectible snapshots

Team and player pages display photographs, biographies and player claims, not collectible fronts. The shared profile renderer reads the canonical roster, season records and Board-approved claim contributions. Collectible editions live in the account album. Copy approved facts and artwork into a draft edition when producing a set; freeze that snapshot at release. Later player edits inform later releases and never rewrite an existing edition.

Live setup: migration `fieldstock_additive_collections_v1`. Collection RPCs explicitly revoke inherited anonymous grants. Ownership mutations and secret reads verify that the server-issued session exists and has not expired. Approved contribution rewards reconcile when visiting the account or album; no trigger is added to the existing submissions table.
