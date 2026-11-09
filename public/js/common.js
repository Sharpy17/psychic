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
  onMove: null,                     // (pos) => {}           marker moved
  onCard: null,                     // (card) => {}          new card dealt
  onReveal: null,                   // (pts, dist, target) => {}
}, window.LANDING || {});

// ---------- Board ----------
// Positions are { x, y } from 0 to 100:
// x runs from the left label to the right label, y from the top label to the bottom label.

// The entry form never shows an answer; the reply draws the scoring rings itself.
const BOARD_RINGS = [];

// The printed board, shared by the entry form and the reply: a sunburst and grid in ink,
// with the playbill's marquee band around the frame. Positions stay 0-100 inside it.
function boardArt(clipId, band = true) {
  const n = v => +v.toFixed(2);
  let minor = '', major = '', ticks = '', rays = '';
  for (let i = 5; i < 100; i += 5) {
    const line = `M${i} 0V100M0 ${i}H100`;
    if (i % 10) minor += line;
    else if (i !== 50) { major += line; ticks += `M${i} 48.8V51.2M48.8 ${i}H51.2`; }
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, b = a + Math.PI / 16;
    rays += `M50 50L${n(50 + Math.cos(a) * 80)} ${n(50 + Math.sin(a) * 80)}L${n(50 + Math.cos(b) * 80)} ${n(50 + Math.sin(b) * 80)}Z`;
  }
  const star = (x, y, r) => {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r * 0.42 : r;
      d += (i ? 'L' : 'M') + n(x + Math.cos(a) * k) + ' ' + n(y + Math.sin(a) * k);
    }
    return d + 'Z';
  };
  let frame = '<rect class="art-frame" width="100" height="100"/>';
  if (band) {
    let bulbs = '';
    const step = 106 / 14;
    for (let i = 1; i < 14; i++) {
      const p = n(-3 + i * step), lit = i % 2 ? 'art-bulb' : 'art-bulb lit';
      bulbs += `<circle class="${lit}" cx="${p}" cy="-3" r="0.95"/><circle class="${lit}" cx="${p}" cy="103" r="0.95"/><circle class="${lit}" cx="-3" cy="${p}" r="0.95"/><circle class="${lit}" cx="103" cy="${p}" r="0.95"/>`;
    }
    frame += `<rect class="art-frame" x="-6" y="-6" width="112" height="112"/>${bulbs}<path class="art-star" d="${star(-3, -3, 2.3)}${star(103, -3, 2.3)}${star(-3, 103, 2.3)}${star(103, 103, 2.3)}"/>`;
  }
  return {
    viewBox: band ? '-6.5 -6.5 113 113' : '-1 -1 102 102',
    back: `<g clip-path="url(#${clipId})"><path class="art-rays" d="${rays}"/><path class="art-minor" d="${minor}"/><path class="art-major" d="${major}"/></g><path class="art-axes" d="M50 0V100M0 50H100"/><path class="art-ticks" d="${ticks}"/><path class="art-star" d="${star(50, 50, 2.6)}"/>${frame}`,
  };
}

let boardCount = 0;
// `art` draws the printed background (see boardArt); the Daily Poll passes its own chart.
function createBoard(container, { onInput = () => {}, art: makeArt = boardArt } = {}) {
  const clamp = v => Math.max(0, Math.min(100, v));

  const rings = BOARD_RINGS.map(([r, pts]) => `<circle class="ring r${pts}" r="${r}"/>`).join('');
  const ringLabels = BOARD_RINGS.map(([r, pts], i) => {
    const inner = BOARD_RINGS[i + 1]?.[0] ?? 0;
    return `<text y="${-(r + inner) / 2 + 1.3}">${pts}</text>`;
  }).join('');

  const clipId = `board-clip-${++boardCount}`;
  const art = makeArt(clipId);
  container.innerHTML = `
    <svg class="board" viewBox="${art.viewBox}" role="application" aria-label="Board: drag the dot">
      <defs><clipPath id="${clipId}"><rect width="100" height="100"/></clipPath></defs>
      ${art.back}
      <g clip-path="url(#${clipId})">
        <rect class="board-face" width="100" height="100"/>
        <rect class="q q-tl" width="50" height="50"/>
        <rect class="q q-tr" x="50" width="50" height="50"/>
        <rect class="q q-bl" y="50" width="50" height="50"/>
        <rect class="q q-br" x="50" y="50" width="50" height="50"/>
        <g class="target"><g class="rings">${rings}${ringLabels}</g></g>
      </g>
      <line class="miss-line"/>
      <g class="marker">
        <circle class="marker-halo" r="5.5"/>
        <path class="marker-x" d="M-3.4-3.6 3.6 3.6M3.4-3.6-3.6 3.6"/>
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

const GAME_MODES = {
  duel: { name: 'Head to Head', who: '2 players' },
  free: { name: 'Free for All', who: '3 to 8 players' },
  teams: { name: 'Team Against Team', who: '4 or more, at least 2 on each team' },
};

// Runs a room request from a pop-up, keeping it open with the reason if the request fails.
async function submitRoomForm(modal, request) {
  const button = modal.querySelector('[type="submit"]');
  const error = modal.querySelector('.modal-error');
  button.disabled = true;
  error.textContent = '';
  const res = await request();
  button.disabled = false;
  if (res.ok) {
    closeModal();
    [523, 784].forEach((f, i) => setTimeout(() => blip(f, 0.12), i * 100));
    return;
  }
  error.textContent = res.error;
  shake(modal, res.error);
}

function createModal(preset = 'free') {
  openModal(`
    <h2>Create a room</h2>
    <p>Pick a name your friends will recognise.</p>
    <form id="create-form" class="field" style="gap:16px">
      <label class="field"><span>Your name</span>
        <input id="create-name" maxlength="16" placeholder="e.g. Sam" autocomplete="nickname" value="${esc(PPGame.rememberedName())}"></label>
      <fieldset class="mode-pick">
        <legend>Pick your ring</legend>
        ${Object.entries(GAME_MODES).map(([id, m]) => `<label><input type="radio" name="game-mode" value="${id}"${id === preset ? ' checked' : ''}><span><b>${m.name}</b><small>${m.who}</small></span></label>`).join('')}
      </fieldset>
      <p class="modal-error" role="alert"></p>
      <div class="modal-actions">
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn primary">Create room</button>
      </div>
    </form>`, modal => {
    modal.querySelector('#create-form').addEventListener('submit', e => {
      e.preventDefault();
      const name = modal.querySelector('#create-name').value.trim();
      if (!name) return shake(modal, 'Enter your name first');
      const mode = modal.querySelector('input[name="game-mode"]:checked').value;
      submitRoomForm(modal, () => PPGame.create(name, mode));
    });
  });
}

function joinModal(code = '') {
  openModal(`
    <h2>Join a room</h2>
    <p>Enter the 4-character code from your host.</p>
    <form id="join-form" class="field" style="gap:16px">
      <label class="field"><span>Your name</span>
        <input id="join-name" maxlength="16" placeholder="e.g. Sam" autocomplete="nickname" value="${esc(PPGame.rememberedName())}"></label>
      <label class="field"><span>Room code</span>
        <input id="join-code" class="field-code" maxlength="4" autocapitalize="characters" autocomplete="off" spellcheck="false" value="${esc(code)}"></label>
      <p class="modal-error" role="alert"></p>
      <div class="modal-actions">
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn primary">Join</button>
      </div>
    </form>`, modal => {
    const nameBox = modal.querySelector('#join-name');
    const codeBox = modal.querySelector('#join-code');
    codeBox.addEventListener('input', () => { codeBox.value = codeBox.value.replace(/[^a-z0-9]/gi, '').toUpperCase(); });
    modal.querySelector('#join-form').addEventListener('submit', e => {
      e.preventDefault();
      const name = nameBox.value.trim();
      if (!name) return shake(modal, 'Enter your name first');
      if (codeBox.value.length !== 4) return shake(modal, 'Room codes are 4 characters');
      submitRoomForm(modal, () => PPGame.join(codeBox.value, name));
    });
  });
  // openModal focuses the first box; move on if that one is already filled in.
  const first = modalRoot.querySelector('#join-name');
  if (first.value) modalRoot.querySelector(code ? '[type="submit"]' : '#join-code').focus();
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
  if (action === 'create') createModal(el.dataset.mode);
  else if (action === 'join') joinModal();
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
