# FIELDSTOCK claim review

Spokane card requests arrive in the Formspree `mzezpeap` inbox. A successful submission gives the visitor a private receipt key; it does not reserve the card.

To approve a request, compare its card ID, user ID, email, factoid, and receipt key against other requests for that card. Add only the approved user ID to `approved-claims.json`:

```json
"SPK-01": { "user_id": "example_user" }
```

Publish the updated JSON with the site. The team and player pages then show the approved user ID and close that card's request form. Keep emails and receipt keys in the private review inbox; never put them in the public JSON. Edit the card's player note separately after approving the submitted factoid.

This is editorial approval on a static site, not automatic ownership enforcement. Requests submitted before the published registry updates may overlap; review them in arrival order.
