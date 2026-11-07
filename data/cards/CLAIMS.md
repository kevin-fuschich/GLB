# FIELDSTOCK claim review

Spokane card requests arrive in the Formspree `mzezpeap` inbox. Submission creates a review request only. No key is generated or shown to the visitor at this stage.

To approve a request, compare its card ID, user ID, email, and factoid against other requests for that card. Once approved, run:

```sh
node scripts/issue-card-claim-key.js SPK-01 example_user
```

The approval command performs three actions together:

1. Confirms that the card exists and is not already claimed.
2. Adds the public user ID and approval time to `approved-claims.json`.
3. Generates the private ownership key for delivery by email.

Record the key securely outside this public repository and send it to the approved claimant's submitted email address. The public record will look like this:

```json
"SPK-01": {
  "user_id": "example_user",
  "approved_at": "2026-09-23T15:30:00.000Z"
}
```

Publish the updated JSON with the site. The team and player pages then show the approved user ID and close that card's request form. Never put email addresses or ownership keys in the public JSON. Edit the card's player note separately after approving the submitted factoid.

This is editorial approval on a static site, not automatic ownership enforcement. Requests submitted before the published registry updates may overlap; review them in arrival order.

## Monterrey launch

Only MTY-01 (Emilio Zendejas), MTY-02 (Masato Yanagisawa), and MTY-POLVO are open. Other entries remain opening soon. Requests use the same Formspree inbox and public approved registry. Run `node scripts/issue-card-claim-key.js MTY-01 example_user` or `node scripts/issue-card-claim-key.js MTY-POLVO example_user` only after review. Monterrey approval generates a private 16-digit numeric FIELDSTOCK code; deliver it privately after acceptance. Public user ID attribution remains separate from the secret code. Do not commit the code or claimant email.

## San Pedro 2026 collection

Cards SPD-01 through SPD-16 are open for reviewed contributions. Club and player pages use the same card IDs, pending-request state and public approved registry. Requests arrive in the existing Formspree inbox.

After editorial review, run `node scripts/issue-card-claim-key.js SPD-01 contributor_id` with the approved card and user ID. The command generates a private 16-digit numeric code and records public attribution. Deliver the code privately and publish the approved registry. Accept the factoid into the roster’s `field_note` separately so it appears on the shared card back. Never commit the code or claimant email.
