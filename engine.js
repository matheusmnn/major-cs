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

  const api = { mapWinProb, bo3WinProb, buchholz, seedGroup, pairGroup };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SwissEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
