# GLB account rollout

The account page is `account.html`. The owner-only walkthrough is `account-setup.html`; it contains no privileged key. The public Supabase URL and publishable key are in `scripts/glb-auth.js`. The browser SDK is pinned to 2.119.0 and served locally from `vendor/`.

## Owner setup

1. Authentication → URL Configuration: Site URL `https://globalleaguebaseball.com/`; exact allowed redirect `https://globalleaguebaseball.com/account.html`.
2. Open `account-setup.html`, copy the complete `supabase/glb-accounts.sql`, paste into a new Supabase SQL Editor query and Run. This is additive and repeatable.
3. Use Check account setup, then open `account.html` and request one sign-in link using the project owner's email. Follow the email, choose a public User ID, and check sign-out/sign-in.
4. Supabase's default email sender is intended for testing and may limit recipient addresses and request rate. Before opening accounts to the public, configure a production SMTP sender in Supabase Authentication → Emails. Verify delivery and sender-domain records, then test with an ordinary external email address. Do not place SMTP credentials in GLB source.
5. After the owner has signed in, assign Board access in Supabase SQL Editor using the owner's real sign-in email in place of the placeholder below. Do not commit that email.

```sql
insert into glb_private.board_members(user_id)
select id from auth.users where email = 'YOUR_SIGN_IN_EMAIL'
on conflict do nothing;
```

## Release boundary

The existing contribution form continues to submit to Formspree. This change does not silently migrate it or attach earlier email submissions to accounts. No account navigation link is promoted across the site until the schema and real email round trip pass. Account-linked contribution submission, public rendering of database-approved records, and Board review UI must be connected in the next rollout stage; the database already supplies their permission-checked operations. Never infer original claim ownership from a typed email/User ID or from an old claim code.

## Database contract

- `glb_profiles`: a signed-in user may read and create only their own profile. The lowercase public User ID is unique and chosen once. No email is copied into a public table.
- `glb_submissions`: own submissions and explicitly assigned Board reviewers only. All inserts go through `glb_submit`; contributor identity and credit come from the authenticated session/profile. New submissions are pending. The authenticated client cannot approve, edit or delete them.
- `glb_claims`: approved original claims, public to read. Original text, original credit and original submission stay unchanged. Only `glb_set_collaboration` allows a claimant to change the collaboration flag.
- `glb_notes`: separate, approved additions. Public to read, no client mutation grants. Closing collaboration retains existing notes and prevents new notes from being submitted or pending notes from being approved.
- `glb_claim_receipts`: private 16-character approval receipts, read only by the owner. They do not authenticate a user.
- `glb_private.board_members`: no client table privileges. A user cannot promote themselves through metadata or profile fields.
- `glb_review_submission`: Board/service role or database owner only. Approval of a claim inserts the immutable original and its private receipt. Approval of a note inserts a separate addition and rechecks collaboration under a row lock. A unique artifact primary key prevents two approved original claimants.

The SQL was exercised in a local PostgreSQL-compatible engine with two accounts and an anonymous role: idempotent setup, ownership policies, forbidden direct writes/self-approval, private receipts, original preservation, owner-only collaboration, approved notes retained after closure, and closure rechecked at approval. Hosted Supabase setup and the real emailed-link flow still require the owner steps above.

## Repeat the permission checks

From `tests/supabase-accounts`, run `npm install` and `npm test`. The test creates an isolated in-memory PostgreSQL-compatible database. It does not connect to hosted Supabase or create real accounts, claims or email messages.
