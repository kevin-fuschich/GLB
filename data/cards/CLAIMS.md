# GLB Board claim review

GLB invites visitors to claim, curate and craft player cards and other artifacts: mascots, entertainers, DONK drivers and vehicles, ballparks, fan traditions and giveaways. Submissions go to the existing Formspree `mzezpeap` inbox for GLB Board review. A request does not reserve an artifact, generate a code or publish content.

## Availability

`data/artifacts/collections.json` points to the existing player-card registries and rosters. `data/artifacts/creative-artifacts.json` defines non-card artifacts, their current club-page records and prompts. `scripts/artifact-catalog.js` resolves these sources for both the public Claim & Create browser and the approval command.

The Board can open additional artifacts by adding a record with a stable artifact ID, a real existing-record link and `claim_open: true`. Preserve the existing identities and artwork when accepting new writing. Do not reopen an already attributed artifact without a separate editorial decision.

## Accept a claim

1. Check the submitted artifact ID, public User ID, private email and proposed content. Compare competing requests for the same artifact and confirm that the content fits the existing record. Keep baseball rules intact.
2. Edit the accepted content into its artifact's canonical record. For a player, this may include the biography and a shorter field note for the printed card back. For a mascot, entertainer, DONK entry, ballpark or tradition, update the corresponding club-page section. Add the accepted author's User ID beside the content.
3. Run the approval helper locally, outside public CI:

   ```sh
   node scripts/issue-card-claim-key.js OSA-OKEO example_user
   ```

   Substitute the actual artifact ID and approved User ID. Examples include `SPD-01`, `MTY-POLVO`, `TIJ-LUTIS` and `SPD-BEMBA-C10`. The command rejects unknown, closed and already claimed artifacts. It records the public User ID and approval timestamp, and prints a cryptographically random private **16-character alphanumeric claim code**. Existing codes remain valid; do not reissue them just to change their format.

4. Publish the accepted content and updated `data/cards/approved-claims.json` together. The browser removes the accepted artifact from the open list, and claim forms and club-page links show its public attribution.
5. Record the code securely outside this public repository and send it privately to the claimant's submitted email address. Never put emails or codes in the public JSON, site, commits, pull requests or CI logs.

The public registry contains attribution only:

```json
"OSA-OKEO": {
  "user_id": "example_user",
  "approved_at": "2026-11-07T15:30:00.000Z"
}
```

This remains a reviewed static-site workflow. The helper records acceptance; it does not send email or publish submitted copy automatically. Requests can overlap until the accepted registry is published. General contributions to an existing record remain welcome even when its artifact is claimed; a contribution does not automatically create a second claim.
