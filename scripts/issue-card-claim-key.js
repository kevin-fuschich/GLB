#!/usr/bin/env node
// Run only after editorial approval. Deliver the key privately; never commit it.
const { randomBytes } = require('node:crypto');
const { readFileSync, writeFileSync, renameSync } = require('node:fs');
const { resolve } = require('node:path');

const [cardId, userId] = process.argv.slice(2);
if (!/^[A-Z]{3}-[A-Z0-9-]+$/.test(cardId || '') ||
    !/^[A-Za-z0-9_-]{3,24}$/.test(userId || '')) {
  console.error('Usage: node scripts/issue-card-claim-key.js SPK-01 user_id');
  process.exit(1);
}

const claimsPath = resolve(process.env.GLB_APPROVED_CLAIMS_PATH || 'data/cards/approved-claims.json');
const cardsPath = resolve(process.env.GLB_CARD_REGISTRY_PATH || 'data/cards/spokane-alloys.json');
const registry = JSON.parse(readFileSync(claimsPath, 'utf8'));
const cards = JSON.parse(readFileSync(cardsPath, 'utf8'));

if (registry.schema !== 'glb.approved-card-claims.v1' || !registry.claims) {
  throw new Error('Approved-claims registry has an unexpected schema.');
}

const validCardIds = new Set(cards.cards.map(card => card.card_id.replace(/-CURRENT$/, '')));
if (!validCardIds.has(cardId)) {
  throw new Error(`${cardId} is not a current Spokane FIELDSTOCK card.`);
}

if (registry.claims[cardId]) {
  throw new Error(`${cardId} is already claimed by ${registry.claims[cardId].user_id}.`);
}

const token = randomBytes(20).toString('hex').toUpperCase().match(/.{8}/g).join('-');
const key = `FST-${cardId}-${userId.toUpperCase()}-${token}`;

registry.claims[cardId] = {
  user_id: userId,
  approved_at: new Date().toISOString()
};

const temporaryPath = `${claimsPath}.tmp`;
writeFileSync(temporaryPath, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
renameSync(temporaryPath, claimsPath);

console.log(`Approved ${cardId} for ${userId}.`);
console.log('Publish data/cards/approved-claims.json to close the public claim form.');
console.log('Send this private ownership key to the claimant by email:');
console.log(key);
