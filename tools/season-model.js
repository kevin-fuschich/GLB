const fs = require('node:fs');
const path = require('node:path');

const RATINGS_PATH = path.join(__dirname, '..', 'data', 'season', 'player-ratings.json');

function hashString(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function rng() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distributeWeighted(rng, total, capacities, weights) {
  const values = capacities.map(() => 0);
  for (let i = 0; i < total; i += 1) {
    let sum = 0;
    for (let j = 0; j < values.length; j += 1) {
      if (values[j] < capacities[j]) sum += Math.max(0, weights[j] || 0) * (capacities[j] - values[j]);
    }
    if (!sum) throw new Error(`Cannot distribute ${total} events within player capacities.`);
    let roll = rng() * sum;
    let chosen = -1;
    for (let j = 0; j < values.length; j += 1) {
      if (values[j] >= capacities[j]) continue;
      if (weights[j] <= 0) continue;
      chosen = j;
      roll -= Math.max(0, weights[j] || 0) * (capacities[j] - values[j]);
      if (roll < 0) break;
    }
    values[chosen] += 1;
  }
  return values;
}

function loadRatings() {
  return fs.existsSync(RATINGS_PATH) ? JSON.parse(fs.readFileSync(RATINGS_PATH, 'utf8')) : {};
}

module.exports = { RATINGS_PATH, hashString, mulberry32, distributeWeighted, loadRatings };
