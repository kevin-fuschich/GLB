#!/usr/bin/env node
// Run only after editorial approval. Deliver the output privately; never commit it.
const { randomBytes } = require('node:crypto');

const [cardId, userId] = process.argv.slice(2);
if (!/^[A-Z]{3}-[A-Z0-9-]+$/.test(cardId || '') ||
    !/^[A-Za-z0-9_-]{3,24}$/.test(userId || '')) {
  console.error('Usage: node scripts/issue-card-claim-key.js SPK-01 user_id');
  process.exit(1);
}

const token = randomBytes(20).toString('hex').toUpperCase().match(/.{8}/g).join('-');
console.log(`FST-${cardId}-${userId.toUpperCase()}-${token}`);
