#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const gamesRoot = path.join(root, 'data', 'games');
const rosterPath = path.join(root, 'data', 'rosters', 'spokane-alloys.json');
const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
const playerBySlug = new Map(roster.players.map(player => [player.slug, player]));

const starters = {
  C: 'nikolai-dobrynin',
  '1B': 'evan-carroll-iv',
  '2B': 'marco-delvecchio',
  SS: 'tomasz-kubas',
  '3B': 'andres-mireles',
  CF: 'wyatt-hollander',
  LF: 'luis-quinones',
  RF: 'pieter-van-wyk'
};

const bullpen = [
  'caleb-reidman',
  'sergio-ibarra-lugo',
  'yaw-mensah',
  'benoit-leduc',
  'hamza-qureshi',
  'ellis-wren',
  'miguel-angel-serrano'
];
const closer = 'branislav-vukovic';
const relieverSlugs = new Set([...bullpen, closer]);

function listSpokaneGames() {
  const files = [];
  for (const date of fs.readdirSync(gamesRoot).sort()) {
    const directory = path.join(gamesRoot, date);
    if (!fs.statSync(directory).isDirectory()) continue;
    for (const filename of fs.readdirSync(directory).sort()) {
      if (filename.includes('spokane-alloys') && filename.endsWith('.json')) {
        files.push(path.join(directory, filename));
      }
    }
  }
  return files;
}

function setBatter(row, slug) {
  const player = playerBySlug.get(slug);
  row.player = player.slug;
  row.name = player.name;
}

function assignBatters(rows, gameIndex) {
  for (const row of rows) setBatter(row, starters[row.position]);

  const catcher = rows.find(row => row.position === 'C');
  if (catcher && gameIndex % 4 === 0) setBatter(catcher, 'jonah-sato');

  if (gameIndex % 3 === 0) {
    const positions = ['2B', 'SS', '3B'];
    const position = positions[Math.floor(gameIndex / 3) % positions.length];
    const row = rows.find(candidate => candidate.position === position);
    if (row) setBatter(row, 'malachi-boone');
  }

  if (gameIndex % 3 === 1) {
    const positions = ['1B', '3B'];
    const position = positions[Math.floor(gameIndex / 3) % positions.length];
    const row = rows.find(candidate => candidate.position === position);
    if (row) setBatter(row, 'rene-bouchard');
  }

  const outfieldMode = gameIndex % 5;
  if (outfieldMode < 4) {
    const positions = ['CF', 'LF', 'RF'];
    const position = positions[Math.floor(gameIndex / 5 + outfieldMode) % positions.length];
    const row = rows.find(candidate => candidate.position === position);
    if (row) setBatter(row, outfieldMode < 2 ? 'dae-hyun-park' : 'tesfaye-mebrahtu');
  }
}

function sumRows(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function distribute(total, buckets, offset = 0, baseline = null) {
  const values = baseline ? [...baseline] : Array(buckets).fill(0);
  let remaining = total - values.reduce((sum, value) => sum + value, 0);
  let cursor = offset % buckets;
  while (remaining > 0) {
    values[cursor] += 1;
    remaining -= 1;
    cursor = (cursor + 1) % buckets;
  }
  return values;
}

function distributeWithin(total, capacity, offset = 0) {
  const values = Array(capacity.length).fill(0);
  let remaining = total;
  let cursor = offset % capacity.length;
  while (remaining > 0) {
    if (values[cursor] < capacity[cursor]) {
      values[cursor] += 1;
      remaining -= 1;
    }
    cursor = (cursor + 1) % capacity.length;
  }
  return values;
}

function reliefChunks(rows, gameIndex, useCloser) {
  const totalOuts = sumRows(rows, 'IP_outs');
  const remainder = totalOuts % 3;
  const outs = [
    ...(remainder ? [remainder] : []),
    ...Array(Math.floor(totalOuts / 3)).fill(3)
  ];

  const count = outs.length;
  const hr = distribute(sumRows(rows, 'HR'), count, gameIndex);
  const hits = distribute(sumRows(rows, 'H'), count, gameIndex + 1, hr);
  const runs = distribute(sumRows(rows, 'R'), count, gameIndex + 2, hr);
  const earnedRuns = distributeWithin(sumRows(rows, 'ER'), runs, gameIndex + 3);
  const walks = distribute(sumRows(rows, 'BB'), count, gameIndex + 4);
  const strikeouts = distribute(sumRows(rows, 'K'), count, gameIndex + 5);

  // A save situation ends with the closer's one-inning segment. Two times in
  // three, give him the cleanest existing segment rather than inventing better
  // team totals; this keeps his season plausible while preserving every event.
  if (useCloser && gameIndex % 3 !== 0 && count > 1) {
    let cleanest = 0;
    for (let index = 1; index < count; index += 1) {
      const a = [earnedRuns[index], runs[index], hits[index], walks[index]];
      const b = [earnedRuns[cleanest], runs[cleanest], hits[cleanest], walks[cleanest]];
      if (a.join('').localeCompare(b.join('')) < 0) cleanest = index;
    }
    const last = count - 1;
    for (const values of [hr, hits, runs, earnedRuns, walks, strikeouts]) {
      [values[cleanest], values[last]] = [values[last], values[cleanest]];
    }
  }

  return outs.map((outCount, index) => ({
    IP_outs: outCount,
    H: hits[index],
    R: runs[index],
    ER: earnedRuns[index],
    BB: walks[index],
    K: strikeouts[index],
    HR: hr[index],
    IP: Math.floor(outCount / 3) + (outCount % 3) / 10
  }));
}

let bullpenCursor = 0;
let nonSaveCloserAppearances = 0;

function assignRelievers(chunks, useCloser, hasSave) {
  const assigned = Array(chunks.length).fill(null);
  if (useCloser) {
    assigned[assigned.length - 1] = closer;
    if (!hasSave) nonSaveCloserAppearances += 1;
  }

  const used = new Set(assigned.filter(Boolean));
  for (let index = 0; index < assigned.length; index += 1) {
    if (assigned[index]) continue;
    let slug;
    do {
      slug = bullpen[bullpenCursor % bullpen.length];
      bullpenCursor += 1;
    } while (used.has(slug));
    assigned[index] = slug;
    used.add(slug);
  }
  return assigned;
}

function setPitcher(row, slug) {
  const player = playerBySlug.get(slug);
  return { player: player.slug, name: player.name, ...row };
}

let richGameIndex = 0;
let changed = 0;

for (const filePath of listSpokaneGames()) {
  const game = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!game.batting || !game.pitching) continue;

  const side = game.away.slug === 'spokane-alloys' ? 'away' : 'home';
  assignBatters(game.batting[side], richGameIndex);

  const pitching = game.pitching[side];
  const originalRelievers = pitching.slice(1);
  const previousRelieverSlugs = new Set(originalRelievers.map(row => row.player));
  const hasSave = Boolean(game.decisions?.SV && previousRelieverSlugs.has(game.decisions.SV));
  const useCloser = hasSave || (richGameIndex % 9 === 0 && nonSaveCloserAppearances < 12);
  const chunks = reliefChunks(originalRelievers, richGameIndex, useCloser);
  const assignments = assignRelievers(chunks, useCloser, hasSave);
  game.pitching[side] = [pitching[0], ...chunks.map((row, index) => setPitcher(row, assignments[index]))];

  if (game.decisions) {
    for (const decision of ['W', 'L']) {
      if (previousRelieverSlugs.has(game.decisions[decision])) game.decisions[decision] = assignments[0];
    }
    if (hasSave) game.decisions.SV = closer;
  }

  fs.writeFileSync(filePath, `${JSON.stringify(game, null, 2)}\n`);
  richGameIndex += 1;
  changed += 1;
}

console.log(`Expanded Spokane usage across ${changed} detailed box scores.`);
console.log(`Assigned ${nonSaveCloserAppearances} non-save appearances to the closer.`);
