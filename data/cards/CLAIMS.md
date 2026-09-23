# FIELDSTOCK claim review

Spokane card requests arrive in the Formspree `mzezpeap` inbox. Submission creates a review request only. No key is generated or shown to the visitor at this stage.

To approve a request, compare its card ID, user ID, email, and factoid against other requests for that card. Once approved, generate the private ownership key locally:

```sh
node scripts/issue-card-claim-key.js SPK-01 example_user
```

Record the key securely outside this public repository and send it to the approved claimant's submitted email address. Then add only the approved user ID to `approved-claims.json`:

```json
"SPK-01": { "user_id": "example_user" }
```

Publish the updated JSON with the site. The team and player pages then show the approved user ID and close that card's request form. Never put email addresses or ownership keys in the public JSON. Edit the card's player note separately after approving the submitted factoid.

This is editorial approval on a static site, not automatic ownership enforcement. Requests submitted before the published registry updates may overlap; review them in arrival order.
