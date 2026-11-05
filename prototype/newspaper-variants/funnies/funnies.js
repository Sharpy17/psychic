// Sunday funnies: the word search (answers already circled in red pencil),
// and a patch so the intro's snapshot of the comic includes the shared SVG drawings.
(() => {
  // [word, row, col, direction]: a = across, v = down
  const WORDS = [['PSYCHIC', 0, 1, 'a'], ['GUESS', 2, 3, 'a'], ['GOOSE', 1, 0, 'v'], ['CLUE', 4, 4, 'a'], ['DOT', 3, 8, 'v'], ['PLANE', 7, 2, 'a']];
  const N = 9;

  function wordSearch() {
    const box = document.getElementById('ws-grid');
    if (!box) return;
    const R = window.PP.rng(2026);
    const grid = Array.from({ length: N }, () => Array.from({ length: N }, () => 'ABCDEFGHIJKLMNOPRSTUVWY'[Math.floor(R() * 23)]));
    for (const [w, r, c, d] of WORDS) [...w].forEach((ch, i) => { grid[d === 'v' ? r + i : r][d === 'v' ? c : c + i] = ch; });
    box.style.setProperty('--n', N);
    box.innerHTML = grid.flat().map(ch => `<span>${ch}</span>`).join('') +
      WORDS.map(([w, r, c, d], i) =>
        `<i class="loop" style="--r:${r};--c:${c};--len:${w.length};--tilt:${(i % 3) - 1}deg" data-dir="${d}"></i>`).join('');
  }

  // html2canvas draws each <svg> on its own, so give every panel its own copy of the shared defs.
  window.PP = window.PP || {};
  window.PP.patchClone = doc => {
    const defs = doc.querySelector('svg.defs defs');
    if (defs) doc.querySelectorAll('.panel svg').forEach(svg => svg.prepend(defs.cloneNode(true)));
  };

  document.addEventListener('DOMContentLoaded', wordSearch);
})();
