#!/usr/bin/env node
// Run only after GLB Board acceptance. Deliver the code privately; never commit it.
const { randomInt } = require('node:crypto');
const { readFileSync, writeFileSync, renameSync } = require('node:fs');
const { resolve } = require('node:path');
const { collectionArtifacts, creativeArtifacts } = require('./artifact-catalog.js');
const [artifactId, userId] = process.argv.slice(2);
if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(artifactId || '') || !/^[A-Za-z0-9_-]{3,24}$/.test(userId || '')) {
  console.error('Usage: node scripts/issue-card-claim-key.js OSA-OKEO user_id');
  process.exit(1);
}
const read = path => JSON.parse(readFileSync(resolve(path), 'utf8'));
const manifest = read('data/artifacts/collections.json');
if (manifest.schema !== 'glb.artifact-collections.v1') throw Error('Unexpected artifact manifest.');
const artifacts = manifest.collections.flatMap(collection => {
  const source = read(collection.source);
  return collectionArtifacts(collection, source, collection.roster ? read(collection.roster) : source);
}).concat(creativeArtifacts(read(manifest.creative_source)));
const artifact = artifacts.find(row => row.id === artifactId);
if (!artifact?.claim_open) throw Error(`${artifactId} is not an open GLB artifact.`);
const claimsPath = resolve(process.env.GLB_APPROVED_CLAIMS_PATH || 'data/cards/approved-claims.json');
const registry = read(claimsPath);
if (registry.schema !== 'glb.approved-card-claims.v1' || !registry.claims) throw Error('Unexpected approved-claims registry.');
if (registry.claims[artifactId]) throw Error(`${artifactId} is already claimed by ${registry.claims[artifactId].user_id}.`);
// 16 cryptographically random characters; avoid ambiguous I, O, 0 and 1.
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = Array.from({length:16}, () => alphabet[randomInt(alphabet.length)]).join('');
registry.claims[artifactId] = {user_id:userId, approved_at:new Date().toISOString()};
const temporaryPath = `${claimsPath}.tmp`;
writeFileSync(temporaryPath, `${JSON.stringify(registry, null, 2)}\n`, {mode:0o600});
renameSync(temporaryPath, claimsPath);
console.log(`Approved ${artifactId} for ${userId}.`);
console.log('Publish the accepted content and data/cards/approved-claims.json together.');
console.log('Send this private 16-character claim code to the claimant by email:');
console.log(code);
