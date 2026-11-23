// Coleta força (ranking HLTV) + H2H entre os times do major -> data.json.
// Passo de preparação: rode `node fetch.js` e depois `node build.js`.
// Depende do pacote não-oficial `hltv`; uso pesado pode levar a ban de IP (Cloudflare).
const { HLTV } = require('hltv');
const fs = require('node:fs');
const path = require('node:path');

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const MONTHS = 12;

async function main() {
  const names = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'teams.json'), 'utf8'));
  const wanted = new Set(names.map(norm));

  console.log('Buscando ranking mundial...');
  const ranking = await HLTV.getTeamRanking();
  const byNorm = new Map(ranking.map((r) => [norm(r.team.name), r]));
  const teams = names.map((n) => {
    const r = byNorm.get(norm(n));
    if (!r) console.warn('  ! sem ranking para:', n, '(ajuste o nome em teams.json)');
    return { name: n, hltvId: r ? r.team.id : null, force: r ? r.points : 0 };
  });

  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - MONTHS);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const teamIds = teams.filter((t) => t.hltvId).map((t) => t.hltvId);

  console.log(`Buscando resultados ${fmt(start)} -> ${fmt(end)} ...`);
  const results = await HLTV.getResults({ startDate: fmt(start), endDate: fmt(end), teamIds });

  const h2h = new Map();
  for (const m of results) {
    const a = norm(m.team1.name);
    const b = norm(m.team2.name);
    if (!wanted.has(a) || !wanted.has(b)) continue;
    const [lowN, highN] = a < b ? [a, b] : [b, a];
    const key = lowN + '|' + highN;
    if (!h2h.has(key)) h2h.set(key, { a: '', b: '', winsA: 0, winsB: 0 });
    const rec = h2h.get(key);
    if (a === lowN) { rec.a = m.team1.name; rec.b = m.team2.name; } else { rec.a = m.team2.name; rec.b = m.team1.name; }
    const winnerNorm = m.result.team1 > m.result.team2 ? a : b;
    if (winnerNorm === lowN) rec.winsA++; else rec.winsB++;
  }

  const out = { generatedAt: new Date().toISOString(), teams, h2h: [...h2h.values()] };
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'data.json'), JSON.stringify(out, null, 2));
  console.log(`data.json: ${teams.length} times, ${out.h2h.length} confrontos H2H. Agora rode: node src/build.js`);
}

main().catch((e) => { console.error('Falhou:', e.message); process.exit(1); });
