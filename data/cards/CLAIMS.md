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
