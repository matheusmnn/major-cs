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
    const pool = sorted.slice(half);
    const pairs = [];
    for (let k = 0; k < half; k++) {
      const a = sorted[k];
      let idx = pool.findIndex((b) => !hasPlayed(a, b));
      if (idx === -1) idx = 0; // último recurso: permite revanche se não há par livre
      pairs.push([a, pool.splice(idx, 1)[0]]);
    }
    return pairs;
  }

  function pairKey(a, b) {
    return a < b ? a + '-' + b : b + '-' + a;
  }

  function simulateStage(teams, opts) {
    const resolve = opts.resolve;
    const locked = opts.locked || new Map();
    const state = {};
    for (const t of teams) state[t.id] = { seed: t.seed, wins: 0, losses: 0, opponents: [] };

    const played = new Set();
    const hasPlayed = (a, b) => played.has(pairKey(a, b));
    const matchups = [];

    const active = () => teams.map((t) => t.id).filter((id) => state[id].wins < 3 && state[id].losses < 3);

    let act = active();
    while (act.length > 0) {
      const groups = new Map();
      for (const id of act) {
        const k = state[id].wins + '-' + state[id].losses;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(id);
      }
      const roundPairs = [];
      for (const ids of groups.values()) {
        for (const [a, b] of pairGroup(seedGroup(ids, state), hasPlayed)) roundPairs.push([a, b]);
      }
      for (const [a, b] of roundPairs) {
        const isBo3 = state[a].wins === 2 || state[a].losses === 2 || state[b].wins === 2 || state[b].losses === 2;
        const forced = locked.get(pairKey(a, b));
        const winner = forced !== undefined ? forced : resolve(a, b, isBo3);
        const loser = winner === a ? b : a;
        state[winner].wins++;
        state[loser].losses++;
        state[a].opponents.push(b);
        state[b].opponents.push(a);
        played.add(pairKey(a, b));
        matchups.push([a, b]);
      }
      act = active();
    }

    const standings = new Map();
    for (const t of teams) {
      const s = state[t.id];
      standings.set(t.id, { wins: s.wins, losses: s.losses, result: s.wins === 3 ? 'advance' : 'eliminate' });
    }
    return { matchups, standings };
  }

  const api = { mapWinProb, bo3WinProb, buchholz, seedGroup, pairGroup, pairKey, simulateStage };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SwissEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
