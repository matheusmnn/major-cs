const test = require('node:test');
const assert = require('node:assert');
const { mapWinProb, bo3WinProb } = require('../engine.js');

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
