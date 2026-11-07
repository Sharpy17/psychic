// The real game: rooms, the lobby and the play screens, talking to the server. The server sends
// each player only what they may see (see server/engine.js), and this file just draws it.
(() => {
  const SESSION = 'pp-session';
  const NAME = 'pp-name';
  const X_PATH = 'M-3.4-3.6 3.6 3.6M3.4-3.6-3.6 3.6';
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const screen = document.getElementById('game');

  // The server's chart runs -100 to +100 with y up; the board draws 0 to 100 with y down.
  const toBoard = (p) => ({ x: (p.x + 100) / 2, y: (100 - p.y) / 2 });
  const toChart = (p) => ({ x: p.x * 2 - 100, y: 100 - p.y * 2 });

  const store = {
    get(key, area = sessionStorage) { try { return JSON.parse(area.getItem(key)); } catch { return null; } },
    set(key, value, area = sessionStorage) { try { area.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } },
    clear(key) { try { sessionStorage.removeItem(key); } catch { /* storage blocked */ } },
  };

  let socket = null;
  let view = null;
  let stageKey = null;
  let board = null;
  let endAt = null;
  let sentAtZero = false;
  let tickTimer = null;
  let replyHandled = false;
  let mailing = false;

  /* Connecting ------------------------------------------------------------ */

  function connect() {
    if (socket) return socket;
    if (!window.io) return null;
    socket = window.io({ reconnectionDelayMax: 4000 });
    socket.on('state', (next) => { view = next; render(); });
    socket.on('connect', () => {
      setOffline(false);
      const session = store.get(SESSION);
      if (session) socket.emit('room:resume', session, (res) => { if (!res.ok) leaveToFront(); });
    });
    socket.on('disconnect', () => setOffline(true));
    return socket;
  }

  function setOffline(off) {
    document.getElementById('game-offline')?.toggleAttribute('hidden', !off);
  }

  const send = (event, payload = {}) => new Promise((resolve) => {
    if (!socket) { resolve({ ok: false, error: 'Not connected.' }); return; }
    socket.timeout(8000).emit(event, payload, (err, res) => {
      resolve(err ? { ok: false, error: 'The server did not answer. Check your connection and try again.' } : res);
    });
  });
  const act = async (event, payload) => {
    const res = await send(event, payload);
    if (!res.ok) { toast(res.error); blip(180, 0.18, 'sawtooth', 0.05); }
    return res;
  };

  async function enter(event, payload) {
    if (!connect()) return { ok: false, error: 'The game server is not running on this copy of the page. Run npm start.' };
    if (!socket.connected) {
      await new Promise((resolve) => { socket.once('connect', resolve); setTimeout(resolve, 5000); });
      if (!socket.connected) return { ok: false, error: 'Could not reach the game server. Try again in a moment.' };
    }
    const res = await send(event, payload);
    if (res.ok) {
      store.set(SESSION, { code: res.code, token: res.token });
      store.set(NAME, payload.name, localStorage);
      history.replaceState(null, '', location.pathname);
    }
    return res;
  }

  function leaveToFront() {
    store.clear(SESSION);
    location.href = location.pathname;
  }

  window.PPGame = {
    create: (name, mode) => enter('room:create', { name, mode }),
    join: (code, name) => enter('room:join', { code, name }),
    rememberedName: () => store.get(NAME, localStorage) ?? '',
  };

  /* Drawing --------------------------------------------------------------- */

  function render() {
    root.classList.add('in-game');
    if (view.phase === 'LOBBY') {
      replyHandled = false;
      PPReply.close();
      setStage('lobby', lobbyHtml, bindLobby);
      refreshLobby();
    } else if (view.phase === 'REPLY') {
      renderReply();
    } else {
      replyHandled = false;
      const key = `play:${view.roundNumber}:${view.phase}:${view.task.kind}`;
      setStage(key, playHtml, bindPlay);
      refreshPlay();
    }
    syncTimer();
  }

  function setStage(key, html, bind) {
    if (key === stageKey) return false;
    const fresh = !stageKey;
    stageKey = key;
    screen.innerHTML = html();
    if (fresh) scrollTo({ top: 0, behavior: 'instant' });
    bind();
    return true;
  }

  const barHtml = () => `<div class="game-bar">
      <span><b>${esc(view.modeName)}</b> · Room ${esc(view.code)}</span>
      <span>${view.phase === 'LOBBY' ? 'In the lobby' : `Clue ${view.roundNumber} of ${view.totalRounds}`}</span>
      <span class="game-timer" id="game-timer" role="timer"></span>
    </div>
    <p class="game-offline" id="game-offline" hidden>Reconnecting to the Big Top…</p>`;

  /* The lobby -------------------------------------------------------------- */

  const lobbyHtml = () => `${barHtml()}
    <div class="lobby">
      <div class="lobby-side">
        <p class="lobby-kicker">★ Your room code ★</p>
        <div class="ticket alt lobby-code"><small>Admit your friends</small><b id="lobby-code">${esc(view.code)}</b><i>Share it, or send the link</i></div>
        <div class="lobby-share">
          <button class="btn" type="button" id="copy-code">Copy code</button>
          <button class="btn" type="button" id="copy-link">Copy invite link</button>
        </div>
        <p class="lobby-link" id="lobby-link"></p>
      </div>
      <div class="lobby-main">
        <h2 class="lobby-title" id="lobby-title"></h2>
        <fieldset class="mode-pick" id="lobby-modes"><legend>The ring</legend></fieldset>
        <div id="lobby-players"></div>
        <p class="lobby-problem" id="lobby-problem" role="status"></p>
        <div class="lobby-actions">
          <button class="btn primary big" type="button" id="start-game">Raise the curtain</button>
          <button class="btn" type="button" id="leave-room">Leave the room</button>
        </div>
      </div>
    </div>`;

  async function copy(text, done) {
    try {
      await navigator.clipboard.writeText(text);
      toast(done);
    } catch {
      toast('Copy that by hand. Your browser blocked it.');
    }
  }
  const inviteLink = () => `${location.origin}${location.pathname}?room=${view.code}`;

  function bindLobby() {
    document.getElementById('lobby-link').textContent = inviteLink();
    document.getElementById('copy-code').addEventListener('click', () => copy(view.code, 'Code copied'));
    document.getElementById('copy-link').addEventListener('click', () => copy(inviteLink(), 'Invite link copied'));
    document.getElementById('start-game').addEventListener('click', () => act('game:start'));
    document.getElementById('leave-room').addEventListener('click', leaveRoom);
    document.getElementById('lobby-modes').addEventListener('change', (e) => act('room:mode', { mode: e.target.value }));
  }
  screen.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-team-join]');
    if (btn) act('room:team', { team: btn.dataset.teamJoin });
  });

  async function leaveRoom() {
    await send('room:leave');
    leaveToFront();
  }

  const nameTag = (p) => `<li class="lobby-player${p.id === view.you.id ? ' is-you' : ''}${p.connected ? '' : ' is-away'}"><span>${esc(p.name)}</span>${p.id === view.you.id ? '<small>you</small>' : ''}${p.isHost ? '<small>host</small>' : ''}${p.connected ? '' : '<small>away</small>'}</li>`;

  function refreshLobby() {
    const isHost = view.you.isHost;
    document.getElementById('lobby-title').textContent = isHost ? 'Gather your people' : `Waiting for ${view.players.find((p) => p.isHost)?.name ?? 'the host'} to start`;
    const modes = document.getElementById('lobby-modes');
    // Updated in place, so a keyboard user keeps their spot when anyone joins.
    if (!modes.querySelector('input')) {
      modes.innerHTML = '<legend>The ring</legend>' + Object.entries(GAME_MODES).map(([id, m]) =>
        `<label><input type="radio" name="room-mode" value="${id}"><span><b>${esc(m.name)}</b><small>${esc(m.who)}</small></span></label>`).join('');
    }
    modes.querySelectorAll('input').forEach((input) => {
      input.checked = input.value === view.mode;
      input.disabled = !isHost;
    });
    modes.classList.toggle('is-locked', !isHost);

    const list = document.getElementById('lobby-players');
    if (view.mode === 'teams') {
      const team = (id, name) => {
        const members = view.players.filter((p) => p.team === id);
        const mine = view.you.team === id;
        return `<div class="lobby-team team-${id}"><h3>${name}</h3><ul>${members.map(nameTag).join('') || '<li class="lobby-empty">Nobody yet</li>'}</ul>${mine ? '' : `<button class="btn" type="button" data-team-join="${id}">Join ${name}</button>`}</div>`;
      };
      list.innerHTML = `<div class="lobby-teams">${team('lions', 'The Lions')}${team('tigers', 'The Tigers')}</div>`;
    } else {
      list.innerHTML = `<ul class="lobby-list">${view.players.map(nameTag).join('')}</ul>`;
    }
    const start = document.getElementById('start-game');
    start.hidden = !isHost;
    start.disabled = !!view.startProblem;
    document.getElementById('lobby-problem').textContent = view.startProblem ?? (isHost ? 'Everyone is here. Raise the curtain when you are ready.' : 'Everyone is here. The curtain rises soon.');
  }

  /* Playing ---------------------------------------------------------------- */

  const prompts = {
    write() {
      if (view.mode === 'teams') return 'You and the rival psychic see the same star, and both clues will be in plain view. Write something only your team will get.';
      if (view.mode === 'duel') {
        const other = view.players.find((p) => p.id !== view.you.id)?.name ?? 'Your rival';
        return `You are the psychic for this star. ${other} is writing a clue of their own at the same moment.`;
      }
      return 'You are the psychic. Write one clue that belongs right on the star.';
    },
    wrote: () => 'Your clue is sealed. Waiting for the other clues to come in.',
    'await-clue': () => {
      const names = view.task.psychics.map((p) => p.name).join(' and ');
      return view.task.psychics.length > 1 ? `${names} are writing. Both clues appear together, so nobody can copy.` : `${names} is writing the clue. You mark the board as soon as it comes in.`;
    },
    mark() {
      if (view.mode === 'teams') return 'Both clues point to the same secret spot. Drag the X or tap the board, then seal your mark.';
      return 'Drag the X or tap the board, then seal your mark. No answers until your reply comes by mail.';
    },
    marked: () => 'Your mark is sealed. Waiting for everyone else.',
    'await-marks': () => 'Your clue is out. Nobody learns a thing until the mail comes.',
  };

  function clueHtml() {
    const { task } = view;
    if (task.kind === 'write') {
      return `<form class="clue-write" id="clue-form" autocomplete="off">
          <label for="clue-input">Your clue</label>
          <input id="clue-input" maxlength="60" placeholder="One clue. Keep it short." autocomplete="off" enterkeyhint="send">
        </form>`;
    }
    if (task.kind === 'wrote') return `<div class="demo-clue">${esc(task.clue)}</div>`;
    if (task.kind === 'await-clue') return '<div class="clue-pending">The psychic is thinking…</div>';
    if (task.clues.length === 1) return `<div class="demo-clue">${esc(task.clues[0].text ?? 'No clue came in time.')}</div>`;
    return `<div class="clue-pair">${task.clues.map((c) => {
      const ours = c.team === view.you.team;
      return `<p class="${ours ? 'is-ours' : ''}"><small>${ours ? 'Your psychic' : 'Rival psychic'}, ${esc(c.name)}</small><b>${esc(c.text ?? 'No clue came in time.')}</b></p>`;
    }).join('')}</div>`;
  }

  function subHtml() {
    const { task } = view;
    if (task.kind === 'write' || task.kind === 'wrote') return `Clue ${view.roundNumber} of ${view.totalRounds}. Your turn as psychic.`;
    if (task.kind === 'await-clue') return `Clue ${view.roundNumber} of ${view.totalRounds}.`;
    if (task.kind === 'await-marks') return `Clue ${view.roundNumber} of ${view.totalRounds}. You are the psychic.`;
    if (task.clues.length > 1) return `Clue ${view.roundNumber} of ${view.totalRounds}. Two clues, one target:`;
    return `Clue ${view.roundNumber} of ${view.totalRounds}. ${esc(task.clues[0].name)} offers:`;
  }

  function buttonHtml() {
    const kind = view.task.kind;
    if (kind === 'write') return '<button class="btn primary" type="submit" form="clue-form" id="game-action">Seal my clue</button>';
    if (kind === 'mark') return `<button class="btn primary" type="button" id="game-action">${view.roundNumber === view.totalRounds ? 'Seal my last mark' : 'Seal my mark'}</button>`;
    return '';
  }

  const playHtml = () => {
    const { card } = view.task;
    return `${barHtml()}
    <div class="front game-front">
      <div class="slot" id="game-slot">
        <aside class="coupon" id="game-entry" aria-label="Your contest entry">
          <span class="scissors" aria-hidden="true">✂</span>
          <p class="coupon-kicker">★ Win a ticket to the circus ★</p>
          <h2>Contest Entry Form</h2>
          <p class="sub">${subHtml()}</p>
          ${clueHtml()}
          <div class="board-wrap">
            <span class="axis-label top">${esc(card.top)}</span>
            <span class="axis-label left">${esc(card.left)}</span>
            <div class="board-slot" id="game-board"></div>
            <span class="axis-label right">${esc(card.right)}</span>
            <span class="axis-label bottom">${esc(card.bottom)}</span>
          </div>
          <p class="hint" id="game-hint">${esc(prompts[view.task.kind]())}</p>
          <div class="demo-foot">${buttonHtml()}</div>
          <div class="entry-row">
            <span class="entry-label">Your marks</span>
            <div class="thumbs" id="game-thumbs" aria-hidden="true"></div>
          </div>
          <p class="coupon-fine">No refunds. Void where prohibited by geese.</p>
        </aside>
        <div class="hole" id="game-hole"></div>
        <p class="visually-hidden" id="game-status" role="status" aria-live="polite"></p>
      </div>
    </div>
    <div class="contestants" id="contestants"></div>
    <div class="game-leave"><button class="btn ghost" type="button" id="leave-room">Leave the game</button></div>`;
  };

  function bindPlay() {
    const { task } = view;
    sentAtZero = false;
    let pos = task.mark ? toBoard(task.mark) : { x: 50, y: 50 };
    let lastTick = pos;
    board = createBoard(document.getElementById('game-board'), {
      onInput(p) {
        pos = p;
        if (Math.hypot(p.x - lastTick.x, p.y - lastTick.y) >= 6) { lastTick = p; blip(900, 0.02, 'square', 0.02); }
      },
    });
    const svg = document.querySelector('#game-board svg');
    const canMark = task.kind === 'mark';
    board.update({ marker: pos, target: null, interactive: canMark, revealed: false });
    svg.setAttribute('aria-label', `Top is ${task.card.top}, bottom is ${task.card.bottom}, left is ${task.card.left}, right is ${task.card.right}.${canMark ? ' Arrow keys move your mark, Enter seals it.' : ''}`);
    if (task.target) showTarget(svg, toBoard(task.target));
    if (task.kind !== 'mark' && task.kind !== 'marked') svg.querySelector('.marker').classList.add('hidden');

    const status = document.getElementById('game-status');
    if (canMark) {
      const seal = () => act('mark:submit', toChart(board.position())).then((r) => { if (r.ok) PPMail.paperSound(0.1, 0.16); });
      document.getElementById('game-action').addEventListener('click', seal);
      document.getElementById('game-board').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); seal(); }
      });
      status.textContent = `New clue: ${task.clues.map((c) => c.text ?? 'none').join(' and ')}.`;
      blip(660, 0.08);
    }
    if (task.kind === 'write') {
      const input = document.getElementById('clue-input');
      document.getElementById('clue-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) { toast('Write a clue first.'); input.focus(); return; }
        act('clue:submit', { text }).then((r) => { if (r.ok) PPMail.paperSound(0.1, 0.16); });
      });
      status.textContent = 'It is your turn as psychic. Write a clue for the star on the board.';
      blip(660, 0.08);
      input.focus({ preventScroll: true });
    }
    document.getElementById('leave-room').addEventListener('click', leaveRoom);
    document.getElementById('game-slot').scrollIntoView({ block: 'nearest', behavior: still.matches ? 'auto' : 'smooth' });
  }

  function showTarget(svg, t) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'psychic-target');
    g.setAttribute('transform', `translate(${t.x} ${t.y})`);
    let star = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 1.7 : 4;
      star += `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
    }
    g.innerHTML = `<circle class="target-glow" r="7.5"/><path class="target-star" d="${star}Z"/>`;
    svg.appendChild(g);
  }

  function refreshPlay() {
    document.getElementById('game-thumbs').innerHTML = Array.from({ length: view.totalRounds }, (_, i) => {
      const m = view.yourMarks[i];
      return PPMail.thumb(m ? toBoard(m) : null, i === view.roundNumber - 1);
    }).join('');
    const box = document.getElementById('contestants');
    const chip = (p) => {
      const label = !p.connected ? 'Away' : p.status === 'sealed' ? 'Sealed' : p.status === 'writing' ? 'Writing…' : p.status === 'marking' ? 'Marking…' : view.phase === 'MARKING' ? 'Psychic' : 'Waiting';
      return `<li class="contestant${p.id === view.you.id ? ' is-you' : ''}${p.status === 'sealed' ? ' is-sealed' : ''}${p.connected ? '' : ' is-away'}${p.team ? ` team-${p.team}` : ''}"><b>${esc(p.name)}</b><small>${label}</small></li>`;
    };
    if (view.mode === 'teams') {
      const group = (id, name) => `<div><h3 class="team-${id}">${name}</h3><ul>${view.players.filter((p) => p.team === id).map(chip).join('')}</ul></div>`;
      box.innerHTML = `<div class="contestant-teams">${group('lions', 'The Lions')}${group('tigers', 'The Tigers')}</div>`;
    } else {
      box.innerHTML = `<ul>${view.players.map(chip).join('')}</ul>`;
    }
  }

  // The timer. At zero, whatever is on the board or in the box goes in by itself.
  function syncTimer() {
    endAt = view.msLeft === null ? null : Date.now() + view.msLeft;
    clearInterval(tickTimer);
    tickTimer = null;
    drawTimer();
    if (endAt) tickTimer = setInterval(drawTimer, 250);
  }
  function drawTimer() {
    const el = document.getElementById('game-timer');
    if (!el) return;
    if (!endAt) { el.textContent = ''; return; }
    const left = Math.max(0, endAt - Date.now());
    const secs = Math.ceil(left / 1000);
    el.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    el.classList.toggle('is-short', secs <= 10);
    if (left === 0 && !sentAtZero && view.task) {
      sentAtZero = true;
      if (view.task.kind === 'mark') send('mark:submit', toChart(board.position()));
      if (view.task.kind === 'write') {
        const text = document.getElementById('clue-input')?.value.trim();
        if (text) send('clue:submit', { text });
      }
    }
  }

  /* The reply --------------------------------------------------------------- */

  function renderReply() {
    if (replyHandled) { refreshHole(); return; }
    replyHandled = true;
    clearInterval(tickTimer);
    document.getElementById('contestants')?.remove();
    document.querySelector('.game-bar span:nth-child(2)')?.replaceChildren('The reply is in');
    const reply = shapeReply(view.reply);
    const coupon = document.getElementById('game-entry');
    const slot = document.getElementById('game-slot');
    const open = () => {
      mailing = false;
      if (view.phase !== 'REPLY') return; // The host already started another show.
      slot?.classList.add('is-cut');
      stageKey = stageKey ?? 'results';
      showResultsStage();
      PPReply.open(reply, replyOptions());
    };
    if (coupon && slot && coupon.querySelector('clipPath') && !still.matches && !document.hidden) {
      mailing = true;
      const form = document.getElementById('game-action');
      if (form) form.textContent = 'Clip it and mail it';
      PPMail.runMailroom({ coupon, slot, statusEl: document.getElementById('game-status'), done: open });
    } else {
      open();
    }
  }

  // After a reload there is no form left to cut, so draw just the hole.
  function showResultsStage() {
    if (!document.getElementById('game-slot')) {
      screen.innerHTML = `${barHtml()}<div class="front game-front"><div class="slot is-cut results-slot" id="game-slot"><div class="hole" id="game-hole"></div></div></div>`;
      document.querySelector('.game-bar span:nth-child(2)')?.replaceChildren('The reply is in');
    }
    refreshHole();
  }

  function replyOptions() {
    return view.you.isHost
      ? { againLabel: 'Play again', onAgain: () => act('game:again'), onClose: () => document.getElementById('read-game-reply')?.focus({ preventScroll: true }) }
      : { onClose: () => document.getElementById('read-game-reply')?.focus({ preventScroll: true }) };
  }

  function refreshHole() {
    if (mailing) return;
    const hole = document.getElementById('game-hole');
    if (!hole) return;
    const isHost = view.you.isHost;
    hole.innerHTML = `<div class="hole-note">
        <b>Mailed!</b>
        <p>${isHost ? 'A hole in the paper, and your reply in hand.' : 'Your reply is in hand. The host can start another show.'}</p>
        <div class="hole-actions">
          <button class="btn primary" type="button" id="read-game-reply">Read your reply</button>
          ${isHost ? '<button class="btn" type="button" id="play-again">Play again</button>' : ''}
          <button class="btn" type="button" id="leave-game-end">Leave</button>
        </div>
      </div>`;
    document.getElementById('read-game-reply').addEventListener('click', () => PPReply.reopen(replyOptions()));
    document.getElementById('play-again')?.addEventListener('click', () => act('game:again'));
    document.getElementById('leave-game-end').addEventListener('click', leaveRoom);
  }

  // Turns the server's reply into what the letter draws, from this player's point of view.
  function shapeReply(raw) {
    const me = view.you.id;
    const teamName = { lions: 'The Lions', tigers: 'The Tigers' };
    const sheets = raw.sheets.map((sheet) => ({
      heading: raw.mode === 'duel'
        ? `Round ${sheet.round + 1} of ${raw.rounds}, ${sheet.clues[0].playerId === me ? 'your clue' : `${sheet.clues[0].name}’s clue`}`
        : `Clue ${sheet.round + 1} of ${raw.rounds}`,
      clues: sheet.clues.map((c) => ({ label: raw.mode === 'duel' ? null : c.team ? `${c.name} of ${teamName[c.team]}` : c.name, text: c.text })),
      card: sheet.card,
      target: toBoard(sheet.target),
      marks: sheet.marks.map((m) => {
        const at = m.x === null ? { x: null, y: null } : toBoard(m);
        return { name: m.name, ...at, tier: m.tier, points: m.points, distance: m.distance, isYou: m.playerId === me, team: m.team };
      }),
      psychics: sheet.clues.map((c) => ({ name: c.name, points: c.points, isYou: c.playerId === me })),
    }));

    const isTeams = raw.mode === 'teams';
    const standings = raw.standings.map((s) => ({
      name: !isTeams && s.id === me ? 'You' : s.name,
      perRound: s.perRound,
      total: s.total,
      isYou: isTeams ? s.members.some((m) => m.id === me) : s.id === me,
      isWinner: raw.winners.includes(s.id),
      members: isTeams ? s.members.map((m) => m.name) : null,
    }));
    const winners = standings.filter((s) => s.isWinner);
    const you = standings.find((s) => s.isYou);
    const place = standings.indexOf(you) + 1;
    const ordinal = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][place - 1] ?? `number ${place}`;
    const namesOf = (list) => list.map((w) => w.name).join(' and ');

    let prizeLine, prizeName;
    if (isTeams) {
      const win = winners[0];
      prizeLine = winners.length > 1 ? 'A dead heat! Everyone gets a ticket to the circus.' : `${win.name} win tickets to the circus!`;
      prizeName = winners.length > 1 ? 'Awarded to both teams · No. 000419' : `One each for ${win.members.join(', ')} · No. 000419`;
    } else if (winners.length > 1) {
      prizeLine = `A tie! ${namesOf(winners)} share the circus.`;
      prizeName = `Awarded to ${namesOf(winners)} · No. 000419`;
    } else if (winners[0].isYou) {
      prizeLine = 'You win the ticket to the circus!';
      prizeName = 'Awarded to you · No. 000419';
    } else {
      prizeLine = `${winners[0].name} wins the ticket to the circus.`;
      prizeName = `Awarded to ${winners[0].name} · No. 000419`;
    }

    const score = you ? you.total.toLocaleString('en-US') : '0';
    let youLine;
    if (isTeams) youLine = you ? `Your team, ${you.name}, finished ${ordinal} with ${score} points. Here is every answer again.` : 'Here is every answer again.';
    else youLine = you ? `You finished ${ordinal} with ${score} points. Here is every answer again.` : 'Here is every answer again.';

    return {
      sheets,
      columns: Array.from({ length: raw.rounds }, (_, i) => (raw.mode === 'duel' ? `Round ${i + 1}` : `Clue ${i + 1}`)),
      columnsLabel: isTeams ? 'Team' : 'Player',
      standings,
      prizeLine,
      prizeName,
      youLine,
      tieNote: raw.decidedOnDistance ? 'Level on points, so the win goes to the lower total distance from the targets.' : null,
      note: 'The circus ticket is make-believe. The bragging rights are real.',
    };
  }

  /* Start ------------------------------------------------------------------- */

  // A reload during a game goes straight back to it.
  if (store.get(SESSION)) {
    if (!connect()) store.clear(SESSION);
  }
})();
