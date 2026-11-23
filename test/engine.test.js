const test = require('node:test');
const assert = require('node:assert');
const { mapWinProb, bo3WinProb, buchholz, seedGroup, pairGroup } = require('../engine.js');

test('mapWinProb: força igual => 0.5', () => {
  assert.equal(mapWinProb(1000, 1000, 400), 0.5);
});

test('mapWinProb: favorito > 0.5 e cresce com a vantagem', () => {
  assert.ok(mapWinProb(1200, 1000, 400) > 0.5);
  assert.ok(mapWinProb(1400, 1000, 400) > mapWinProb(1200, 1000, 400));
});

test('mapWinProb: upset maior aproxima de 0.5', () => {
  assert.ok(Math.abs(mapWinProb(1400, 1000, 800) - 0.5) < Math.abs(mapWinProb(1400, 1000, 200) - 0.5));
});

test('bo3WinProb: favorito de mapa fica mais favorito em Bo3', () => {
  assert.ok(bo3WinProb(0.6) > 0.6);
  assert.equal(bo3WinProb(0.5), 0.5);
});

// --- Task 2: pareamento ---

function mkState(spec) {
  // spec: { id: {seed, wins, losses, opponents:[ids]} }
  const state = {};
  for (const id of Object.keys(spec)) {
    const s = spec[id];
    state[id] = { seed: s.seed, wins: s.wins || 0, losses: s.losses || 0, opponents: s.opponents || [] };
  }
  return state;
}

test('buchholz: soma (wins-losses) dos adversários enfrentados', () => {
  const state = mkState({
    1: { seed: 1, opponents: [5, 6] },
    5: { seed: 5, wins: 2, losses: 0 },
    6: { seed: 6, wins: 0, losses: 1 },
  });
  assert.equal(buchholz(1, state), (2 - 0) + (0 - 1));
});

test('seedGroup: ordena por Buchholz desc, depois seed asc', () => {
  const state = mkState({
    1: { seed: 1, opponents: [5] }, 5: { seed: 5, wins: 2, losses: 0 },   // buch +2
    2: { seed: 2, opponents: [6] }, 6: { seed: 6, wins: 0, losses: 2 },   // buch -2
    3: { seed: 3, opponents: [7] }, 7: { seed: 7, wins: 2, losses: 0 },   // buch +2 (tie c/ 1 -> seed menor antes)
    4: { seed: 4, opponents: [8] }, 8: { seed: 8, wins: 1, losses: 1 },   // buch 0
  });
  assert.deepEqual(seedGroup([1, 2, 3, 4], state), [1, 3, 4, 2]);
});

test('pairGroup R1-like: 16 ordenados por seed => 1x9..8x16', () => {
  const ids1to16 = Array.from({ length: 16 }, (_, i) => i + 1);
  const pairs = pairGroup(ids1to16, () => false);
  assert.deepEqual(pairs, [[1, 9], [2, 10], [3, 11], [4, 12], [5, 13], [6, 14], [7, 15], [8, 16]]);
});

test('pairGroup: metade-vs-metade em grupo de 4 => rank1x3, rank2x4', () => {
  assert.deepEqual(pairGroup([10, 20, 30, 40], () => false), [[10, 30], [20, 40]]);
});

test('pairGroup: evita revanche deslocando o par', () => {
  const hp = (a, b) => (a === 10 && b === 30) || (a === 30 && b === 10);
  const pairs = pairGroup([10, 20, 30, 40], hp);
  assert.ok(!pairs.some(([a, b]) => (a === 10 && b === 30) || (a === 30 && b === 10)));
});
