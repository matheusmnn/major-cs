(function (root) {
  'use strict';

  function mapWinProb(strengthA, strengthB, upset) {
    return 1 / (1 + Math.exp(-(strengthA - strengthB) / upset));
  }

  function bo3WinProb(p) {
    return p * p * (3 - 2 * p);
  }

  // Mistura a prob. base com o retrospecto direto (H2H). winsA/winsB = jogos vencidos
  // por cada lado; k controla quantos confrontos são precisos p/ o H2H pesar.
  function blendH2H(pBase, winsA, winsB, k) {
    const n = winsA + winsB;
    if (n === 0) return pBase;
    const w = n / (n + k);
    return (1 - w) * pBase + w * (winsA / n);
  }

  // Ordena um grupo pela seed inicial (1 = melhor). Dentro do grupo o pareamento é melhor x pior.
  function seedGroup(groupIds, state) {
    return groupIds.slice().sort((a, b) => state[a].seed - state[b].seed);
  }

  // Ordem de candidatos para o rank i: o parceiro desejado primeiro, depois os mais próximos dele.
  function candidateOrder(i, pref, n) {
    const cand = [];
    for (let j = 0; j < n; j++) if (j !== i) cand.push(j);
    cand.sort((x, y) => Math.abs(x - pref) - Math.abs(y - pref) || x - y);
    return cand;
  }

  function matchPairs(sorted, want, blocked) {
    const n = sorted.length;
    const used = new Array(n).fill(false);
    const result = [];
    function dfs() {
      const i = used.indexOf(false);
      if (i === -1) return true;
      used[i] = true;
      for (const j of candidateOrder(i, want(i), n)) {
        if (used[j] || blocked(sorted[i], sorted[j])) continue;
        used[j] = true;
        result.push([sorted[i], sorted[j]]);
        if (dfs()) return true;
        used[j] = false;
        result.pop();
      }
      used[i] = false;
      return false;
    }
    return dfs() ? result : null;
  }

  // Pareamento de um grupo. mode 'split' = rodada 1 (rank k x rank k+n/2, ex. 1x9).
  // mode 'fold' (padrão) = rodadas seguintes, melhor x pior (1x8, 2x7, 3x6, 4x5).
  // Evita revanche via backtracking; só permite revanche se nenhum pareamento sem ela existir.
  function pairGroup(sorted, hasPlayed, mode) {
    const n = sorted.length;
    const want = (mode === 'split')
      ? (i) => (i < n / 2 ? i + n / 2 : i - n / 2)
      : (i) => n - 1 - i;
    return matchPairs(sorted, want, hasPlayed) || matchPairs(sorted, want, () => false);
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
    const mode = played.size === 0 ? 'split' : 'fold'; // rodada 1 = seed N x N+8; demais = melhor x pior
    const pairs = [];
    for (const k of keys) {
      for (const [a, b] of pairGroup(seedGroup(groups.get(k), state), hasPlayed, mode)) pairs.push([a, b]);
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
    const h2h = opts.h2h || new Map();
    const k = opts.k == null ? 4 : opts.k;
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
      const key = pairKey(a, b);
      const ov = probOverride.get(key);
      if (ov !== undefined) pA = a < b ? ov : 1 - ov;
      else pA = mapWinProb(strength.get(a), strength.get(b), upset);
      const h = h2h.get(key);
      if (h) pA = blendH2H(pA, a < b ? h.low : h.high, a < b ? h.high : h.low, k);
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

  const api = { mapWinProb, bo3WinProb, blendH2H, seedGroup, pairGroup, pairKey, simulateStage, nextRoundPairings, mulberry32, runMonteCarlo };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SwissEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
