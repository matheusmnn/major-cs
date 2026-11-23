const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const APP_TEAMS = [
  'Ninjas in Pyjamas', 'PARIVISION', 'Heroic', 'FaZe', 'Team Liquid', 'Eternal Fire',
  '100 Thieves', '9z', 'M80', 'DENDELE', 'Imperial', 'Wildcard', 'BC.Game', 'FlyQuest', 'CW', 'LVG',
].map(norm);

const stats = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'stats.json'), 'utf8'));

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
  }
});
