(function (root) {
  'use strict';

  function mapWinProb(strengthA, strengthB, upset) {
    return 1 / (1 + Math.exp(-(strengthA - strengthB) / upset));
  }

  function bo3WinProb(p) {
    return p * p * (3 - 2 * p);
  }

  function buchholz(teamId, state) {
    return state[teamId].opponents.reduce((sum, opp) => sum + (state[opp].wins - state[opp].losses), 0);
  }

  function seedGroup(groupIds, state) {
    return groupIds.slice().sort((a, b) => {
      const db = buchholz(b, state) - buchholz(a, state);
      if (db !== 0) return db;
      return state[a].seed - state[b].seed;
    });
  }

  function pairGroup(sorted, hasPlayed) {
    const half = sorted.length / 2;
    const top = sorted.slice(0, half);
    const bottom = sorted.slice(half);
    const used = new Array(bottom.length).fill(false);
    const result = [];

    // Busca em profundidade por um pareamento sem revanche (metade de cima x metade de baixo).
    function dfs(k) {
      if (k === half) return true;
      const a = top[k];
      for (let bi = 0; bi < bottom.length; bi++) {
        if (used[bi] || hasPlayed(a, bottom[bi])) continue;
        used[bi] = true;
        result.push([a, bottom[bi]]);
        if (dfs(k + 1)) return true;
        used[bi] = false;
        result.pop();
      }
      return false;
    }
    if (dfs(0)) return result;

    // Último recurso: nenhum pareamento sem revanche existe -> permite revanche (exceção extrema).
    const fallback = [];
    const pool = bottom.slice();
    for (let k = 0; k < half; k++) fallback.push([top[k], pool.shift()]);
    return fallback;
  }

  function pairKey(a, b) {
    return a < b ? a + '-' + b : b + '-' + a;
  }

  function initState(teams) {
    const state = {};
    for (const t of teams) state[t.id] = { seed: t.seed, wins: 0, losses: 0, opponents: [] };
    return state;
  }

  function applyResult(state, played, a, b, winner) {
    const loser = winner === a ? b : a;
    state[winner].wins++;
    state[loser].losses++;
    state[a].opponents.push(b);
    state[b].opponents.push(a);
    played.add(pairKey(a, b));
  }

  // Pareamentos da rodada atual: todos os grupos ativos do estado dado.
  function pairActive(teams, state, played) {
    const hasPlayed = (a, b) => played.has(pairKey(a, b));
    const active = teams.map((t) => t.id).filter((id) => state[id].wins < 3 && state[id].losses < 3);
    const groups = new Map();
    for (const id of active) {
      const k = state[id].wins + '-' + state[id].losses;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(id);
    }
    // Ordena os grupos por record (mais vitórias primeiro) para ordem de rodada estável.
    const keys = [...groups.keys()].sort((x, y) => Number(y.split('-')[0]) - Number(x.split('-')[0]));
    const pairs = [];
    for (const k of keys) {
      for (const [a, b] of pairGroup(seedGroup(groups.get(k), state), hasPlayed)) pairs.push([a, b]);
    }
    return pairs;
  }

  // Pareamentos da próxima rodada dado os resultados já conhecidos (usado pelo painel ao vivo).
  function nextRoundPairings(teams, results) {
    const state = initState(teams);
    const played = new Set();
    for (const m of results) applyResult(state, played, m.a, m.b, m.winner);
    return pairActive(teams, state, played);
  }

  function simulateStage(teams, opts) {
    const resolve = opts.resolve;
    const locked = opts.locked || new Map();
    const state = initState(teams);
    const played = new Set();
    const matchups = [];

    let pairs = pairActive(teams, state, played);
    while (pairs.length > 0) {
      for (const [a, b] of pairs) {
        const isBo3 = state[a].wins === 2 || state[a].losses === 2 || state[b].wins === 2 || state[b].losses === 2;
        const forced = locked.get(pairKey(a, b));
        const winner = forced !== undefined ? forced : resolve(a, b, isBo3);
        applyResult(state, played, a, b, winner);
        matchups.push([a, b]);
      }
      pairs = pairActive(teams, state, played);
    }

    const standings = new Map();
    for (const t of teams) {
      const s = state[t.id];
      standings.set(t.id, { wins: s.wins, losses: s.losses, result: s.wins === 3 ? 'advance' : 'eliminate' });
    }
    return { matchups, standings };
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function runMonteCarlo(teams, opts) {
    const N = opts.N;
    const upset = opts.upset;
    const locked = opts.locked || new Map();
    const probOverride = opts.probOverride || new Map();
    const rng = mulberry32(opts.seed >>> 0);
    const n = teams.length;
    const index = new Map(teams.map((t, i) => [t.id, i]));
    const strength = new Map(teams.map((t) => [t.id, t.strength]));

    const meet = Array.from({ length: n }, () => new Array(n).fill(0));
    const adv = new Map(teams.map((t) => [t.id, 0]));
    const z30 = new Map(teams.map((t) => [t.id, 0]));
    const z03 = new Map(teams.map((t) => [t.id, 0]));

    const resolve = (a, b, isBo3) => {
      let pA;
      const ov = probOverride.get(pairKey(a, b));
      if (ov !== undefined) pA = a < b ? ov : 1 - ov;
      else pA = mapWinProb(strength.get(a), strength.get(b), upset);
      if (isBo3) pA = bo3WinProb(pA);
      return rng() < pA ? a : b;
    };

    for (let s = 0; s < N; s++) {
      const { matchups, standings } = simulateStage(teams, { resolve, locked });
      const seen = new Set();
      for (const [a, b] of matchups) {
        const key = pairKey(a, b);
        if (seen.has(key)) continue; // conta "se enfrentaram" uma vez por simulação
        seen.add(key);
        const i = index.get(a);
        const j = index.get(b);
        meet[i][j]++;
        meet[j][i]++;
      }
      for (const [id, st] of standings) {
        if (st.result === 'advance') adv.set(id, adv.get(id) + 1);
        if (st.wins === 3 && st.losses === 0) z30.set(id, z30.get(id) + 1);
        if (st.losses === 3 && st.wins === 0) z03.set(id, z03.get(id) + 1);
      }
    }

    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) meet[i][j] /= N;
    const div = (m) => new Map([...m].map(([k, v]) => [k, v / N]));
    return { meetProb: meet, advanceProb: div(adv), threeZero: div(z30), zeroThree: div(z03), n: N };
  }

  const api = { mapWinProb, bo3WinProb, buchholz, seedGroup, pairGroup, pairKey, simulateStage, nextRoundPairings, mulberry32, runMonteCarlo };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SwissEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
