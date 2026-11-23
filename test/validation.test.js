const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { simulateStage, pairKey } = require('../engine.js');

// Normaliza uma lista de pares para comparação independente de ordem/direção.
function normalize(pairs) {
  return pairs.map(([a, b]) => (a < b ? [a, b] : [b, a])).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}

const fixturePath = path.join(__dirname, 'fixtures', 'real-stage.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test('engine reproduz os pareamentos reais do stage dado os resultados reais', (t) => {
  if (!fixture.matches || fixture.matches.length === 0) {
    t.skip('fixture real vazio — aguardando dados de um stage suíço concluído (seeds + confrontos + vencedores)');
    return;
  }

  const teams = fixture.teams.map((x) => ({ id: x.id, seed: x.seed, strength: 0 }));
  const locked = new Map(fixture.matches.map((m) => [pairKey(m.a, m.b), m.winner]));
  const realPairings = fixture.matches.map((m) => [m.a, m.b]);

  const r = simulateStage(teams, {
    resolve: (a, b) => {
      throw new Error(`engine pareou ${a}x${b}, que não ocorreu na realidade (divergência de pareamento)`);
    },
    locked,
  });

  assert.deepEqual(normalize(r.matchups), normalize(realPairings));
});
