# Taipei FIELDSTOCK approvals

1. Review the Formspree submission for the card ID, contributor ID, email and proposed fact. The form is a request; it does not reserve the card or generate a code.
2. After approving a request, run `node scripts/issue-card-claim-key.js TPE-01 contributor_id` from the current GLB checkout, substituting the approved card and handle. Run locally, outside public CI. TPE-01 and TPE-02 are the only open Taipei player cards at launch. The script rejects a closed or already claimed card.
3. Review the change to `data/cards/approved-claims.json` and publish it. Only the public contributor ID and approval timestamp are recorded there. The club and player pages read this registry to close the form and show the credit.
4. Reply privately to the approved submission with the card ID and the 16-digit code printed by the script. Keep the code and email out of the repo, commits, pull requests and public logs. Keep any issuance record privately. This code is an approval record; there is no public redemption form.
5. If the proposed fact is accepted into canon, edit the player fact and release record separately and update the printed back when appropriate. The approval command does not publish submitted copy.

On iPad, provide the approved card ID and public contributor ID to the person handling the repository; they can run the command and publish the credit. The recipient's email stays in the original submission.
