// Shared behaviour for every landing page variant: the demo board, sounds, toasts and the
// create/join room pop-ups. It's the script from landing.html, made configurable.
//
// Each variant page supplies the look (CSS + markup) and must contain:
//   #board-slot, #demo-top, #demo-bottom, #demo-left, #demo-right, #demo-clue,
//   #reveal-btn, #demo-result, #modal-root, #toast,
//   and buttons with data-action="create | join | reveal | shuffle | sound | soon".
// It can tweak wording, sounds and hooks by setting window.LANDING before loading this file.

const CFG = Object.assign({
  wave: 'triangle',                 // oscillator type for clicks and chimes
  chime: [523, 659, 784],           // notes played on a scoring reveal
  results: { 4: 'Bullseye! You two share a brain.', 3: 'So close!', 2: 'In the zone.', 0: 'Way off. Awkward.' },
  revealLabel: 'Reveal target',
  againLabel: 'Play again',
  soundLabels: ['🔊', '🔇'],        // [on, off]
  lobbyMsg: "The lobby isn't built yet",
  onMove: null,                     // (pos) => {}           marker moved
  onCard: null,                     // (card) => {}          new card dealt
  onReveal: null,                   // (pts, dist, target) => {}
}, window.LANDING || {});

// ---------- Board ----------
// Positions are { x, y } from 0 to 100:
// x runs from the left label to the right label, y from the top label to the bottom label.

// [radius, points], largest first. The server's scoring must use the same radii.
const BOARD_RINGS = [[18, 2], [11, 3], [5, 4]];

function scoreForDistance(d) {
  for (const [r, pts] of [...BOARD_RINGS].reverse()) if (d <= r) return pts;
  return 0;
}

function createBoard(container, { onInput = () => {} } = {}) {
  const clamp = v => Math.max(0, Math.min(100, v));

  const rings = BOARD_RINGS.map(([r, pts]) => `<circle class="ring r${pts}" r="${r}"/>`).join('');
  const ringLabels = BOARD_RINGS.map(([r, pts], i) => {
    const inner = BOARD_RINGS[i + 1]?.[0] ?? 0;
    return `<text y="${-(r + inner) / 2 + 1.3}">${pts}</text>`;
  }).join('');

  container.innerHTML = `
    <svg class="board" viewBox="0 0 100 100" role="application" aria-label="Board: drag the dot">
      <defs><clipPath id="board-clip"><rect width="100" height="100" rx="6"/></clipPath></defs>
      <g clip-path="url(#board-clip)">
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
      <g class="marker">
        <circle class="marker-halo" r="5.5"/>
        <circle class="marker-dot" r="3.2"/>
      </g>
    </svg>`;

  const svg = container.querySelector('svg');
  const marker = svg.querySelector('.marker');
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
    update({ marker: pos, target: t, interactive: canMove, revealed = false }) {
      interactive = canMove;
      svg.classList.toggle('interactive', canMove);
      svg.setAttribute('tabindex', canMove ? '0' : '-1');
      if (!dragging) setMarker(pos);
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

// ---------- Helpers ----------
const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rand = (min, max) => Math.random() * (max - min) + min;

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ---------- Sound (tiny Web Audio blips, no files needed) ----------
let soundOn = true;
let audio = null;
function blip(freq = 520, dur = 0.07, type = CFG.wave, vol = 0.08) {
  if (!soundOn) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + dur);
  } catch (e) { /* audio unavailable; stay silent */ }
}

// Ripple + click sound on every .btn
document.addEventListener('pointerdown', e => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  const size = Math.max(r.width, r.height);
  const dot = document.createElement('span');
  dot.className = 'ripple';
  dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  btn.appendChild(dot);
  setTimeout(() => dot.remove(), 600);
  blip(btn.classList.contains('primary') ? 660 : 480);
});

// ---------- Demo board ----------
const CARDS = CFG.cards || [
  { top: 'Funny', bottom: 'Unfunny', left: 'Ugly', right: 'Cute', clue: 'A pug in a hot dog costume' },
  { top: 'Expensive', bottom: 'Cheap', left: 'Gross', right: 'Delicious', clue: 'Airport sushi' },
  { top: 'Scary', bottom: 'Not scary', left: 'Tiny', right: 'Huge', clue: 'A goose' },
  { top: 'Cool', bottom: 'Cringe', left: 'Useless', right: 'Useful', clue: 'A fanny pack' },
  { top: 'Exciting', bottom: 'Boring', left: 'Easy', right: 'Hard', clue: 'Learning to juggle' },
  { top: 'Healthy', bottom: 'Unhealthy', left: 'Bland', right: 'Tasty', clue: 'Kale chips' },
];
let marker = { x: 50, y: 50 }, lastTick = marker, target = null, revealed = false, cardIndex = 0;

const board = createBoard($('#board-slot'), {
  onInput(pos) {
    marker = pos;
    CFG.onMove?.(pos);
    if (Math.hypot(pos.x - lastTick.x, pos.y - lastTick.y) >= 6) { lastTick = pos; blip(900, 0.02, 'square', 0.02); }
  },
});
const draw = () => board.update({ marker, target: revealed ? target : null, interactive: !revealed, revealed });

$('#board-slot').addEventListener('keydown', e => { if (e.key === 'Enter') reveal(); });
$('#board-slot').addEventListener('pointerdown', () => {
  if (revealed) toast(`Press "${CFG.againLabel}" to try another card`);
});

function newCard(first) {
  if (!first) cardIndex = (cardIndex + 1) % CARDS.length;
  const c = CARDS[cardIndex];
  for (const side of ['top', 'bottom', 'left', 'right']) $('#demo-' + side).textContent = c[side];
  $('#demo-clue').textContent = c.clue;
  target = { x: Math.round(rand(14, 86)), y: Math.round(rand(14, 86)) };
  marker = lastTick = { x: 50, y: 50 };
  revealed = false;
  $('#reveal-btn').textContent = CFG.revealLabel;
  $('#demo-result').textContent = '';
  $('#demo-result').className = 'demo-result';
  draw();
  CFG.onMove?.(marker);
  CFG.onCard?.(c);
}
function reveal() {
  if (revealed) return newCard();
  marker = board.position();
  revealed = true;
  draw();
  const dist = Math.hypot(marker.x - target.x, marker.y - target.y);
  const pts = scoreForDistance(dist);
  const res = $('#demo-result');
  res.className = `demo-result pts-${pts}`;
  res.innerHTML = `<b>+${pts}</b> ${esc(CFG.results[pts])}`;
  $('#reveal-btn').textContent = CFG.againLabel;
  if (pts) CFG.chime.forEach((f, i) => setTimeout(() => blip(f, 0.12), i * 90));
  else blip(200, 0.25, 'sawtooth', 0.05);
  CFG.onReveal?.(pts, dist, target);
}

newCard(true);

// ---------- Modals ----------
const modalRoot = $('#modal-root');
let lastFocus = null;

function openModal(html, onMount) {
  lastFocus = document.activeElement;
  modalRoot.innerHTML = `<div class="modal-backdrop" data-close><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  onMount?.(modalRoot.querySelector('.modal'));
  modalRoot.querySelector('input, .btn')?.focus();
}
function closeModal() {
  modalRoot.innerHTML = '';
  lastFocus?.focus();
}
modalRoot.addEventListener('click', e => {
  if (e.target.matches('[data-close]')) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalRoot.innerHTML) closeModal();
});

function createModal() {
  openModal(`
    <h2>Create a room</h2>
    <p>Pick a name your friends will recognise.</p>
    <form id="create-form" class="field" style="gap:16px">
      <label class="field"><span>Your name</span>
        <input id="create-name" maxlength="16" placeholder="e.g. Sam" autocomplete="nickname"></label>
      <div class="modal-actions">
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn primary">Create room</button>
      </div>
    </form>`, modal => {
    modal.querySelector('#create-form').addEventListener('submit', e => {
      e.preventDefault();
      const name = modal.querySelector('#create-name').value.trim();
      if (!name) return shake(modal, 'Enter your name first');
      const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
      modal.innerHTML = `
        <h2>You're in, ${esc(name)}!</h2>
        <p>Share this code with your friends:</p>
        <div class="room-code">${code}</div>
        <div class="modal-actions">
          <button class="btn" data-copy="${code}">Copy code</button>
          <button class="btn primary" data-lobby>Go to lobby</button>
        </div>`;
      modal.querySelector('[data-lobby]').addEventListener('click', () => {
        closeModal();
        toast(CFG.lobbyMsg);
      });
      modal.querySelector('[data-copy]').addEventListener('click', ev => {
        navigator.clipboard?.writeText(ev.currentTarget.dataset.copy)
          .then(() => toast('Code copied'), () => toast('Copy not available here'));
      });
      [523, 784].forEach((f, i) => setTimeout(() => blip(f, 0.12), i * 100));
    });
  });
}

function joinModal() {
  openModal(`
    <h2>Join a room</h2>
    <p>Enter the 4-letter code from your host.</p>
    <form id="join-form" style="display:flex;flex-direction:column;gap:16px">
      <div class="code-boxes">
        ${[0, 1, 2, 3].map(i => `<input maxlength="1" inputmode="text" autocapitalize="characters" aria-label="Letter ${i + 1}">`).join('')}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn primary">Join</button>
      </div>
    </form>`, modal => {
    const boxes = [...modal.querySelectorAll('.code-boxes input')];
    boxes.forEach((box, i) => {
      box.addEventListener('input', () => {
        box.value = box.value.replace(/[^a-z]/gi, '').toUpperCase();
        if (box.value && boxes[i + 1]) boxes[i + 1].focus();
      });
      box.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !box.value && boxes[i - 1]) boxes[i - 1].focus();
      });
      box.addEventListener('paste', e => {
        e.preventDefault();
        const text = (e.clipboardData.getData('text') || '').replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4);
        [...text].forEach((ch, j) => { if (boxes[j]) boxes[j].value = ch; });
        boxes[Math.min(text.length, 3)].focus();
      });
    });
    modal.querySelector('#join-form').addEventListener('submit', e => {
      e.preventDefault();
      const code = boxes.map(b => b.value).join('');
      if (code.length < 4) return shake(modal, 'Room codes are 4 letters');
      closeModal();
      toast(`Room ${code}: ${CFG.lobbyMsg}`);
    });
  });
}

function shake(el, msg) {
  el.classList.remove('shake');
  void el.offsetWidth; // restart the animation
  el.classList.add('shake');
  blip(180, 0.18, 'sawtooth', 0.05);
  toast(msg);
}

// ---------- Button actions ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'create') createModal();
  else if (action === 'join') joinModal();
  else if (action === 'reveal') reveal();
  else if (action === 'shuffle') newCard();
  else if (action === 'sound') {
    soundOn = !soundOn;
    el.textContent = CFG.soundLabels[soundOn ? 0 : 1];
    el.setAttribute('aria-pressed', soundOn);
    toast(soundOn ? 'Sound on' : 'Sound off');
  } else if (action === 'soon') {
    e.preventDefault();
    toast('Coming soon');
  }
});
