(function (root) {
  'use strict';

  function mapWinProb(strengthA, strengthB, upset) {
    return 1 / (1 + Math.exp(-(strengthA - strengthB) / upset));
  }

  function bo3WinProb(p) {
    return p * p * (3 - 2 * p);
  }

  const api = { mapWinProb, bo3WinProb };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SwissEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
