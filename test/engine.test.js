const test = require('node:test');
const assert = require('node:assert');
const { mapWinProb, bo3WinProb, seedGroup, pairGroup, simulateStage, pairKey, mulberry32, runMonteCarlo, nextRoundPairings, blendH2H } = require('../engine.js');

const teams16 = Array.from({ length: 16 }, (_, i) => ({ id: i + 1, seed: i + 1, strength: 1600 - i * 40 }));

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

test('blendH2H: sem histórico (0,0) => mantém a base', () => {
  assert.equal(blendH2H(0.7, 0, 0, 4), 0.7);
});

test('blendH2H: 4x0 a favor de A com k=4 => peso 50% (0.5*base + 0.5*1)', () => {
  assert.equal(blendH2H(0.5, 4, 0, 4), 0.75);
});

test('blendH2H: mais confrontos => mais peso no H2H', () => {
  const pouco = blendH2H(0.5, 2, 0, 4); // w=2/6
  const muito = blendH2H(0.5, 8, 0, 4); // w=8/12
  assert.ok(muito > pouco);
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

test('seedGroup: ordena pela seed inicial crescente (1 = melhor)', () => {
  const state = mkState({
    7: { seed: 7 }, 2: { seed: 2 }, 11: { seed: 11 }, 4: { seed: 4 },
  });
  assert.deepEqual(seedGroup([7, 2, 11, 4], state), [2, 4, 7, 11]);
});

test('pairGroup split (rodada 1): 16 por seed => 1x9..8x16', () => {
  const ids1to16 = Array.from({ length: 16 }, (_, i) => i + 1);
  const pairs = pairGroup(ids1to16, () => false, 'split');
  assert.deepEqual(pairs, [[1, 9], [2, 10], [3, 11], [4, 12], [5, 13], [6, 14], [7, 15], [8, 16]]);
});

test('pairGroup fold (rodadas 2+): grupo de 8 => melhor x pior (1x8,2x7,3x6,4x5)', () => {
  assert.deepEqual(pairGroup([1, 2, 3, 4, 5, 6, 7, 8], () => false), [[1, 8], [2, 7], [3, 6], [4, 5]]);
});

test('pairGroup fold: grupo de 4 => 1x4, 2x3', () => {
  assert.deepEqual(pairGroup([10, 20, 30, 40], () => false), [[10, 40], [20, 30]]);
});

test('pairGroup fold: evita revanche deslocando o par', () => {
  // fold pareia 10x40; se já jogaram, desloca p/ o vizinho mais próximo sem revanche
  const hp = (a, b) => (a === 10 && b === 40) || (a === 40 && b === 10);
  const pairs = pairGroup([10, 20, 30, 40], hp);
  assert.ok(!pairs.some(([a, b]) => (a === 10 && b === 40) || (a === 40 && b === 10)));
});

// --- Task 3: simulação de stage ---

test('simulateStage: resolve determinístico (sempre vence o de menor id) => 8 avançam, 8 eliminam', () => {
  const r = simulateStage(teams16, { resolve: (a, b) => Math.min(a, b), locked: new Map() });
  const adv = [...r.standings.values()].filter((s) => s.result === 'advance');
  const elim = [...r.standings.values()].filter((s) => s.result === 'eliminate');
  assert.equal(adv.length, 8);
  assert.equal(elim.length, 8);
});

test('simulateStage: ninguém joga duas vezes com o mesmo', () => {
  const r = simulateStage(teams16, { resolve: (a, b) => Math.min(a, b), locked: new Map() });
  const seen = new Set();
  for (const [a, b] of r.matchups) {
    const key = pairKey(a, b);
    assert.ok(!seen.has(key), `par repetido: ${key}`);
    seen.add(key);
  }
});

test('simulateStage: resultado travado é respeitado', () => {
  const locked = new Map([[pairKey(1, 9), 9]]); // zebra fixada
  const r = simulateStage(teams16, { resolve: (a, b) => Math.min(a, b), locked });
  assert.ok(r.standings.get(9).wins >= 1);
});

test('simulateStage: todo time termina em 3 vitórias ou 3 derrotas', () => {
  const r = simulateStage(teams16, { resolve: (a, b) => Math.min(a, b), locked: new Map() });
  for (const s of r.standings.values()) {
    assert.ok(s.wins === 3 || s.losses === 3, `record inesperado ${s.wins}-${s.losses}`);
  }
});

// --- Task 4: Monte Carlo ---

const idx = (id) => teams16.findIndex((t) => t.id === id);

test('runMonteCarlo: mesma seed => resultado idêntico', () => {
  const a = runMonteCarlo(teams16, { N: 2000, upset: 400, locked: new Map(), seed: 1 });
  const b = runMonteCarlo(teams16, { N: 2000, upset: 400, locked: new Map(), seed: 1 });
  assert.deepEqual(a.meetProb, b.meetProb);
});

test('runMonteCarlo: meetProb simétrica e diagonal zero', () => {
  const r = runMonteCarlo(teams16, { N: 1000, upset: 400, locked: new Map(), seed: 3 });
  for (let i = 0; i < 16; i++) {
    assert.equal(r.meetProb[i][i], 0);
    for (let j = 0; j < 16; j++) assert.equal(r.meetProb[i][j], r.meetProb[j][i]);
  }
});

test('runMonteCarlo: R1 fixa por seed => P(1 enfrenta 9) == 1', () => {
  const r = runMonteCarlo(teams16, { N: 1000, upset: 400, locked: new Map(), seed: 7 });
  assert.equal(r.meetProb[idx(1)][idx(9)], 1);
});

test('runMonteCarlo: probabilidades em [0,1] e advanceProb soma ~8', () => {
  const r = runMonteCarlo(teams16, { N: 2000, upset: 400, locked: new Map(), seed: 5 });
  for (const p of r.advanceProb.values()) assert.ok(p >= 0 && p <= 1);
  const sum = [...r.advanceProb.values()].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 8) < 1e-9, `soma avançar = ${sum}`);
});

// --- Task 6: pareamento da rodada atual (p/ painel ao vivo) ---

test('nextRoundPairings: sem resultados => rodada 1 por seed (1x9..8x16)', () => {
  assert.deepEqual(nextRoundPairings(teams16, []), [[1, 9], [2, 10], [3, 11], [4, 12], [5, 13], [6, 14], [7, 15], [8, 16]]);
});

test('nextRoundPairings: após rodada 1 => grupos 1-0 e 0-1 em dobra (melhor x pior)', () => {
  const r1 = [1, 2, 3, 4, 5, 6, 7, 8].map((w) => ({ a: w, b: w + 8, winner: w }));
  assert.deepEqual(nextRoundPairings(teams16, r1), [[1, 8], [2, 7], [3, 6], [4, 5], [9, 16], [10, 15], [11, 14], [12, 13]]);
});

test('nextRoundPairings: stage encerrado => []', () => {
  const r = simulateStage(teams16, { resolve: (a, b) => Math.min(a, b), locked: new Map() });
  const allResults = r.matchups.map(([a, b]) => ({ a, b, winner: Math.min(a, b) }));
  assert.deepEqual(nextRoundPairings(teams16, allResults), []);
});
