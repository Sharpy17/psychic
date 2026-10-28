// UI layer. Talks to the server only through MockServer.send / onState / onError,
// so swapping in the real socket server later shouldn't touch this file.

const app = document.getElementById('app');
const devPanel = document.getElementById('dev');
const toastEl = document.getElementById('toast');

const RESULT_TEXT = { 4: 'Bullseye!', 3: 'So close!', 2: 'Not bad', 0: 'Way off' };
const ACTIONS = { start: 'start_game', next: 'next_round', again: 'play_again', leave: 'leave' };

let view = null;
let lastKey = null;
let seatsKey = null;
let board = null;
let shownScores = {}; // last score drawn per player, so changes can count up

const send = (type, payload = {}) => MockServer.send(type, payload);
// Marker moves are throttled. Over a real network you don't want 60 messages a second.
const sendMarker = throttle(pos => send('move_marker', pos), 50);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nameOf = (v, id) => v.players.find(p => p.id === id)?.name ?? '?';
const val = sel => (app.querySelector(sel)?.value ?? '').trim();
const isPsychic = v => v.me.id === v.psychicId;
const myGuess = v => v.guesses?.[v.me.id];

function throttle(fn, ms) {
  let last = 0, timer = null, args;
  return (...a) => {
    args = a;
    const wait = ms - (Date.now() - last);
    if (wait <= 0) {
      last = Date.now();
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn(...args);
      }, wait);
    }
  };
}

// ---------- Rendering ----------

// The screen only rebuilds when something structural changes. The side panels
// re-render on their own (locks, scores) so a rebuild never interrupts a drag.
function structuralKey(v) {
  if (!v) return 'home';
  return [v.phase, v.me.id, v.round, v.clue, myGuess(v)?.locked, v.players.map(p => p.id).join()].join('|');
}
function seatsKeyOf(v) {
  if (!v || !v.guesses) return '';
  return JSON.stringify([v.phase, v.me.id, v.psychicId, v.roundPoints,
    v.players.map(p => [p.id, p.score, v.guesses[p.id]?.locked])]);
}

function render() {
  if (!view || view.phase === 'LOBBY') shownScores = {};
  const key = structuralKey(view);
  const rebuilt = key !== lastKey;
  if (rebuilt) {
    lastKey = key;
    app.innerHTML = screenFor(view);
    const slot = document.getElementById('board-slot');
    board = slot ? createBoard(slot, { onInput: sendMarker }) : null;
    renderDev(view);
  }
  const sk = seatsKeyOf(view);
  if (rebuilt || sk !== seatsKey) {
    seatsKey = sk;
    renderSeats(view);
  }
  updateBoard(view);
}

function screenFor(v) {
  if (!v) return homeScreen();
  if (v.phase === 'LOBBY') return lobbyScreen(v);
  if (v.phase === 'GAME_OVER') return gameOverScreen(v);
  return gameScreen(v);
}

function updateBoard(v) {
  if (!board || !v) return;
  const mine = myGuess(v);
  // On reveal every dot is shown, labelled with who placed it and what they scored.
  const others = v.phase === 'REVEAL'
    ? v.players.filter(p => v.guesses[p.id]).map(p => ({
      x: v.guesses[p.id].x,
      y: v.guesses[p.id].y,
      color: p.color,
      label: `${p.id === v.me.id ? 'You' : p.name} +${v.roundPoints[p.id]}`,
    }))
    : [];
  board.update({
    marker: mine ? { x: mine.x, y: mine.y } : { x: 50, y: 50 },
    markerColor: v.me.color,
    others,
    target: v.target,
    interactive: v.phase === 'GUESSING' && !!mine && !mine.locked,
    showMarker: v.phase === 'GUESSING' && !!mine,
    shielded: v.target == null && v.phase === 'CLUE',
  });
}

function avatar(p) {
  return `<span class="avatar" style="--c:${p.color}">${esc(p.name[0]?.toUpperCase())}</span>`;
}

function homeScreen() {
  return `
  <main class="screen narrow home">
    <div class="brand">
      <svg viewBox="0 0 64 64" class="brand-mark" aria-hidden="true">
        <rect x="2" y="2" width="60" height="60" rx="12" fill="var(--face)"/>
        <path d="M32 7 V57 M7 32 H57" stroke="#b9aa8a" stroke-width="2" stroke-dasharray="4 3"/>
        <circle cx="42" cy="22" r="12" fill="var(--zone-2)"/>
        <circle cx="42" cy="22" r="7.5" fill="var(--zone-3)"/>
        <circle cx="42" cy="22" r="3.5" fill="var(--zone-4)"/>
        <circle cx="21" cy="41" r="5" fill="var(--needle)" stroke="#fff" stroke-width="2"/>
      </svg>
      <h1>Mind Meter</h1>
      <p class="tagline">Read your friends' minds, one clue at a time.</p>
    </div>

    <div class="card stack">
      <label class="field">
        <span>Your name</span>
        <input id="name" maxlength="16" placeholder="e.g. Sam" autocomplete="nickname">
      </label>
      <button class="btn primary big" data-action="create">Create a room</button>
      <div class="divider"><span>or join one</span></div>
      <form class="join-row" id="join-form">
        <input id="code" maxlength="4" placeholder="CODE" autocapitalize="characters" aria-label="Room code">
        <button class="btn" type="submit">Join</button>
      </form>
    </div>

    <details class="card how">
      <summary>How to play</summary>
      <ol>
        <li>Every round, one player is the <b>psychic</b>. Everyone gets a turn.</li>
        <li>The board has four labels, like <b>Funny / Unfunny</b> and <b>Ugly / Cute</b>. Only the psychic sees where the hidden target is.</li>
        <li>They give a one-line clue. Everyone else secretly places their own dot.</li>
        <li>The reveal shows every dot. Closer scores more (4, 3 or 2), and the psychic gets 1 point for each player who scores.</li>
        <li>Highest score after everyone has been the psychic wins.</li>
      </ol>
    </details>
  </main>`;
}

function lobbyScreen(v) {
  return `
  <main class="screen narrow lobby">
    <div class="card room-code">
      <small>Room code</small>
      <button class="code" data-action="copy-code" title="Copy">${esc(v.code)}</button>
      <small>Tap to copy and share with friends</small>
    </div>
    <div class="card">
      <h3>Players <span class="muted">(${v.players.length})</span></h3>
      <ul class="player-list">
        ${v.players.map(p => `
          <li>${avatar(p)}<span class="pname">${esc(p.name)}</span>
            ${p.id === v.me.id ? '<span class="tag">you</span>' : ''}
            ${p.isHost ? '<span class="tag host">host</span>' : ''}
          </li>`).join('')}
      </ul>
      <p class="muted small">You need at least 3 players. Everyone gets a turn as the psychic.</p>
    </div>
    ${v.me.isHost
      ? '<button class="btn primary big" data-action="start">Start game</button>'
      : '<p class="muted center">Waiting for the host to start...</p>'}
    <button class="btn link" data-action="leave">Leave room</button>
  </main>`;
}

function statusText(v) {
  const psychic = `<b>${esc(nameOf(v, v.psychicId))}</b>`;
  if (v.phase === 'CLUE') {
    return isPsychic(v)
      ? "<b>You're the psychic.</b> Only you can see the target. Give a clue that points everyone to it."
      : `${psychic} is thinking of a clue...`;
  }
  if (v.phase === 'GUESSING') {
    const count = ' <span class="lock-count" id="lock-count"></span>';
    if (isPsychic(v)) return `Everyone is placing their dot. <b>No hints!</b>${count}`;
    if (myGuess(v)?.locked) return `<b>Locked in!</b> Waiting for the others...${count}`;
    return `Place your dot where ${psychic}'s clue points. Nobody else can see it.${count}`;
  }
  return "Here's where everyone landed.";
}

function clueArea(v) {
  if (v.phase === 'CLUE') {
    return isPsychic(v)
      ? `<form class="clue-form" id="clue-form">
           <input id="clue-input" maxlength="60" placeholder="Type your clue..." autocomplete="off">
           <button class="btn primary" type="submit">Give clue</button>
         </form>`
      : '<div class="clue waiting"><span class="dots"><i></i><i></i><i></i></span></div>';
  }
  let result = '';
  if (v.phase === 'REVEAL') {
    const pts = v.roundPoints[v.me.id];
    const text = isPsychic(v)
      ? `for your clue. ${pts} player${pts === 1 ? '' : 's'} scored.`
      : RESULT_TEXT[pts];
    result = `<div class="result pts-${isPsychic(v) ? 'psychic' : pts}"><b>+${pts}</b><span>${text}</span></div>`;
  }
  return `
    <div class="clue">
      <small>${esc(nameOf(v, v.psychicId))}'s clue</small>
      <q>${esc(v.clue)}</q>
    </div>${result}`;
}

function actions(v) {
  const mine = myGuess(v);
  if (v.phase === 'GUESSING' && mine && !mine.locked) {
    return '<button class="btn primary big" data-action="lock">Lock in my guess</button>';
  }
  if (v.phase === 'REVEAL') {
    const last = v.round >= v.totalRounds;
    return `<button class="btn primary big" data-action="next">${last ? 'See final scores' : 'Next round'}</button>`;
  }
  return '';
}

function gameScreen(v) {
  return `
  <main class="screen game">
    <header class="game-top">
      <span class="round-pill">Round <b>${v.round}</b> of ${v.totalRounds}</span>
      <p class="status">${statusText(v)}</p>
    </header>
    <div class="table">
      <aside class="seats seats-left" id="seats-left" aria-label="Players"></aside>
      <section class="board-card">
        <div class="board-wrap">
          <span class="axis-label top">${esc(v.card.top)}</span>
          <span class="axis-label left">${esc(v.card.left)}</span>
          <div class="board-slot" id="board-slot"></div>
          <span class="axis-label right">${esc(v.card.right)}</span>
          <span class="axis-label bottom">${esc(v.card.bottom)}</span>
        </div>
      </section>
      <aside class="seats seats-right" id="seats-right" aria-label="Players"></aside>
    </div>
    <div class="below">
      ${clueArea(v)}
      ${actions(v)}
    </div>
  </main>`;
}

// Player cards down both sides of the board: name, live score and what they're doing.
function renderSeats(v) {
  const left = document.getElementById('seats-left');
  const right = document.getElementById('seats-right');
  if (!left || !right) return;
  const top = Math.max(...v.players.map(p => p.score));
  const half = Math.ceil(v.players.length / 2);
  left.innerHTML = v.players.slice(0, half).map(p => seat(v, p, top)).join('');
  right.innerHTML = v.players.slice(half).map(p => seat(v, p, top)).join('');

  const lockCount = document.getElementById('lock-count');
  if (lockCount) {
    const all = Object.values(v.guesses);
    lockCount.textContent = `(${all.filter(g => g.locked).length}/${all.length} locked in)`;
  }
  animateScores();
}

function seat(v, p, top) {
  const g = v.guesses[p.id];
  const pts = v.roundPoints?.[p.id];
  let status = '';
  if (p.id === v.psychicId) status = '<span class="chip psychic">🔮 Psychic</span>';
  else if (v.phase === 'CLUE') status = '<span class="chip">Waiting</span>';
  else if (v.phase === 'GUESSING') {
    status = g?.locked ? '<span class="chip locked">✓ Locked in</span>' : '<span class="chip thinking">Thinking...</span>';
  }
  const delta = v.phase === 'REVEAL' && pts != null ? `<span class="delta ${pts ? '' : 'zero'}">+${pts}</span>` : '';
  const leader = top > 0 && p.score === top ? '<span class="crown" title="In the lead">👑</span>' : '';
  return `
    <div class="seat ${p.id === v.me.id ? 'me' : ''}" style="--c:${p.color}">
      ${avatar(p)}
      <div class="seat-info">
        <span class="seat-name">${esc(p.name)}${p.id === v.me.id ? ' <small>(you)</small>' : ''}${leader}</span>
        ${status}
      </div>
      <div class="seat-score"><b data-score="${p.id}">${p.score}</b>${delta}</div>
    </div>`;
}

// Scores count up to their new value after the dots have popped in on the board.
function animateScores() {
  for (const el of app.querySelectorAll('[data-score]')) {
    const id = el.dataset.score;
    const to = Number(el.textContent);
    const from = shownScores[id] ?? to;
    shownScores[id] = to;
    if (from === to) continue;
    el.textContent = from;
    setTimeout(() => {
      el.classList.add('bump');
      const start = performance.now();
      const tick = now => {
        const t = Math.min(1, (now - start) / 700);
        el.textContent = Math.round(from + (to - from) * t);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, 600);
  }
}

function gameOverScreen(v) {
  const ranked = [...v.players].sort((a, b) => b.score - a.score);
  const winners = ranked.filter(p => p.score === ranked[0].score);
  const title = winners.length === 1
    ? `${esc(winners[0].name)} wins!`
    : `${winners.map(p => esc(p.name)).join(' & ')} tie!`;
  return `
  <main class="screen narrow over">
    <div class="trophy" aria-hidden="true">🏆</div>
    <h1>${title}</h1>
    <ol class="ranking">
      ${ranked.map((p, i) => `
        <li class="${winners.includes(p) ? 'top' : ''} ${p.id === v.me.id ? 'me' : ''}" style="--c:${p.color}; animation-delay:${i * 90}ms">
          <span class="rank">${i + 1}</span>${avatar(p)}
          <span class="pname">${esc(p.name)}${p.id === v.me.id ? ' <small>(you)</small>' : ''}</span>
          <b>${p.score}</b>
        </li>`).join('')}
    </ol>
    ${v.me.isHost
      ? '<button class="btn primary big" data-action="again">Play again</button>'
      : '<p class="muted">Waiting for the host...</p>'}
    <button class="btn link" data-action="leave">Leave room</button>
  </main>`;
}

function renderDev(v) {
  devPanel.hidden = !v;
  if (!v) return;
  const inRound = v.phase === 'CLUE' || v.phase === 'GUESSING' || v.phase === 'REVEAL';
  const label = p => `${esc(p.name)}${inRound ? (p.id === v.psychicId ? ' (psychic)' : ' (guesser)') : ''}`;
  devPanel.innerHTML = `
    <strong>Mock server</strong>
    <label>View as
      <select id="view-as">
        ${v.players.map(p => `<option value="${p.id}" ${p.id === v.me.id ? 'selected' : ''}>${label(p)}</option>`).join('')}
      </select>
    </label>`;
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

// ---------- Events ----------

app.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  if (action === 'create') {
    const name = val('#name');
    if (!name) return toast('Enter your name first');
    send('create_room', { name });
  } else if (action === 'copy-code') {
    navigator.clipboard?.writeText(view.code).then(() => toast('Room code copied'), () => {});
  } else if (action === 'lock') {
    send('move_marker', board.position()); // make sure the server has the final position
    send('lock_guess');
  } else if (ACTIONS[action]) {
    send(ACTIONS[action]);
  }
});

app.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'join-form') {
    const name = val('#name');
    const roomCode = val('#code').toUpperCase();
    if (!name) return toast('Enter your name first');
    if (roomCode.length !== 4) return toast('Room codes are 4 letters');
    send('join_room', { name, roomCode });
  } else if (e.target.id === 'clue-form') {
    const clue = val('#clue-input');
    if (!clue) return toast('Type a clue first');
    send('submit_clue', { clue });
  }
});

devPanel.addEventListener('change', e => {
  if (e.target.id === 'view-as') send('dev_view_as', { playerId: e.target.value });
});

MockServer.onError(toast);
MockServer.onState(v => {
  view = v;
  render();
});
