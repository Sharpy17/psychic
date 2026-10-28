// The square board. Positions are { x, y } from 0 to 100:
// x runs from the left label to the right label, y from the top label to the bottom label.
// createBoard(container, { onInput }) returns { update(opts), position() }.
// Used by both index.html (the game) and landing.html (the demo).

// [radius, points], largest first. The server's scoring must use the same radii.
const BOARD_RINGS = [[18, 2], [11, 3], [5, 4]];

function scoreForDistance(d) {
  for (const [r, pts] of [...BOARD_RINGS].reverse()) if (d <= r) return pts;
  return 0;
}

let boardCount = 0;
const boardEsc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function createBoard(container, { onInput = () => {} } = {}) {
  const clipId = `board-clip-${++boardCount}`;
  const clamp = v => Math.max(0, Math.min(100, v));

  const rings = BOARD_RINGS.map(([r, pts]) => `<circle class="ring r${pts}" r="${r}"/>`).join('');
  const ringLabels = BOARD_RINGS.map(([r, pts], i) => {
    const inner = BOARD_RINGS[i + 1]?.[0] ?? 0;
    return `<text y="${-(r + inner) / 2 + 1.3}">${pts}</text>`;
  }).join('');

  container.innerHTML = `
    <svg class="board" viewBox="0 0 100 100" role="application" aria-label="Board: drag the dot">
      <defs><clipPath id="${clipId}"><rect width="100" height="100" rx="6"/></clipPath></defs>
      <g clip-path="url(#${clipId})">
        <rect class="board-face" width="100" height="100"/>
        <rect class="q q-tl" width="50" height="50"/>
        <rect class="q q-tr" x="50" width="50" height="50"/>
        <rect class="q q-bl" y="50" width="50" height="50"/>
        <rect class="q q-br" x="50" y="50" width="50" height="50"/>
        <line class="axis-line" x1="50" y1="3" x2="50" y2="97"/>
        <line class="axis-line" x1="3" y1="50" x2="97" y2="50"/>
        <g class="target"><g class="rings">${rings}${ringLabels}</g></g>
      </g>
      <line class="miss-line"/>
      <g class="shield">
        <rect width="100" height="100" rx="6"/>
        <text x="50" y="60">?</text>
      </g>
      <g class="others"></g>
      <g class="marker">
        <circle class="marker-halo" r="5.5"/>
        <circle class="marker-dot" r="3.2"/>
      </g>
    </svg>`;

  const svg = container.querySelector('svg');
  const marker = svg.querySelector('.marker');
  const othersEl = svg.querySelector('.others');
  let othersKey = '';
  const target = svg.querySelector('.target');
  const ringsEl = svg.querySelector('.rings');
  const missLine = svg.querySelector('.miss-line');

  let current = { x: 50, y: 50 };
  let interactive = false;
  let dragging = false;

  function setMarker(pos) {
    current = { x: clamp(pos.x), y: clamp(pos.y) };
    marker.style.transform = `translate(${current.x}px, ${current.y}px)`;
    svg.setAttribute('aria-valuetext', `${Math.round(current.x)} across, ${Math.round(current.y)} down`);
  }

  function posFromEvent(e) {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const s = p.matrixTransform(svg.getScreenCTM().inverse());
    return { x: s.x, y: s.y };
  }

  function input(pos) {
    setMarker(pos);
    onInput({ ...current });
  }

  svg.addEventListener('pointerdown', e => {
    if (!interactive) return;
    dragging = true;
    svg.classList.add('dragging');
    svg.setPointerCapture(e.pointerId);
    input(posFromEvent(e)); // tapping anywhere jumps the dot there
  });
  svg.addEventListener('pointermove', e => {
    if (dragging) input(posFromEvent(e));
  });
  const endDrag = () => {
    dragging = false;
    svg.classList.remove('dragging');
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  svg.addEventListener('keydown', e => {
    if (!interactive) return;
    const step = e.shiftKey ? 10 : 2;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!moves[e.key]) return;
    e.preventDefault();
    input({ x: current.x + moves[e.key][0], y: current.y + moves[e.key][1] });
  });

  return {
    position: () => ({ ...current }),
    // others: extra labelled dots, e.g. every player's guess on reveal: [{ x, y, color, label }]
    update({ marker: pos, target: t, interactive: canMove, showMarker = true, shielded = false,
      revealed = false, markerColor = null, others = [] }) {
      interactive = canMove;
      marker.style.setProperty('--marker', markerColor || 'var(--needle)');
      const key = JSON.stringify(others);
      if (key !== othersKey) {
        othersKey = key;
        othersEl.innerHTML = others.map((o, i) => `
          <g class="other" style="transform: translate(${clamp(o.x)}px, ${clamp(o.y)}px)">
            <g class="other-pop" style="animation-delay:${i * 90}ms">
              <circle r="2.8" fill="${o.color}"/>
              <text y="${o.y < 9 ? 7.4 : -4.2}">${boardEsc(o.label)}</text>
            </g>
          </g>`).join('');
      }
      svg.classList.toggle('interactive', canMove);
      svg.setAttribute('tabindex', canMove ? '0' : '-1');
      if (!dragging) setMarker(pos); // while dragging, local input wins over server echoes
      marker.classList.toggle('hidden', !showMarker);
      svg.classList.toggle('shielded', shielded);
      if (t) target.style.transform = `translate(${t.x}px, ${t.y}px)`;
      ringsEl.classList.toggle('show', !!t);
      const showMiss = revealed && !!t;
      if (showMiss) {
        missLine.setAttribute('x1', current.x);
        missLine.setAttribute('y1', current.y);
        missLine.setAttribute('x2', t.x);
        missLine.setAttribute('y2', t.y);
      }
      missLine.classList.toggle('show', showMiss);
    },
  };
}
