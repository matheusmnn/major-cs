const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// 16 times do Stage 2 (por seed). Os 8 que vieram do Stage 1 têm stats; os 8 seeds diretos ainda não.
const APP_TEAMS = [
  'FUT', 'Nemiga', 'G2', '1win', 'NAVI', 'Astralis', 'The MongolZ', 'MIBR',
  'FlyQuest', 'Ninjas in Pyjamas', 'Team Liquid', 'Eternal Fire', 'PARIVISION', 'Imperial', 'LVG', '100 Thieves',
].map(norm);

const stats = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'stats.json'), 'utf8'));

test('stats.json: cobre exatamente os 16 times do app (por norm)', () => {
  const keys = Object.keys(stats.teams).map(norm);
  for (const n of APP_TEAMS) assert.ok(keys.includes(n), `faltou time: ${n}`);
  assert.equal(keys.length, 16);
});

test('stats.json: cada time tem campos válidos', () => {
  for (const [name, s] of Object.entries(stats.teams)) {
    assert.ok(typeof s.avgOppRank === 'number' && s.avgOppRank > 0, `${name}: avgOppRank`);
    assert.ok(Number.isInteger(s.oppCount) && s.oppCount >= 0, `${name}: oppCount`);
    assert.ok(Number.isInteger(s.unrankedOpps) && s.unrankedOpps >= 0, `${name}: unrankedOpps`);
    for (const k of ['S', 'A', 'B', 'C']) {
      assert.ok(Number.isInteger(s.tiers[k]) && s.tiers[k] >= 0, `${name}: tiers.${k}`);
    }
    assert.ok(Array.isArray(s.players) && s.players.length > 0, `${name}: players`);
    for (const p of s.players) {
      assert.ok(typeof p.name === 'string' && p.name, `${name}: player name`);
      assert.ok(p.rating === null || typeof p.rating === 'number', `${name}: player rating`);
    }
  }
});
