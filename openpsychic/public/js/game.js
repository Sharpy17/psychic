// The real game: rooms, the lobby and the play screens, talking to the server. The server sends
// each player only what they may see (see server/engine.js), and this file just draws it.
(() => {
  const SESSION = 'pp-session';
  const NAME = 'pp-name';
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
  let rerolling = false; // True while your own reroll is on its way, so you aren't told about it.
  let lastDeal = null; // Which deal of the board is on screen, so a reroll can be announced.
  let niceSeen = 0;
  let movedAt = 0; // When you last moved your team's dot, so a teammate's echo doesn't yank it from under you.
  let moveTimer = null, pendingMove = null, lastSent = 0; // Nods on your own clue this round, so a new one can be announced.
  let entering = false; // True from a create or join until the first scene is drawn, so the whole paper fades over.
  let shownScene = null; // The scene on screen, so a new one fades in instead of snapping.
  let fading = false; // True while the old scene fades out; the newest state is drawn once it has.
  const seenPlayers = new Set(); // Who has already taken a bow in the lobby, so only newcomers pop in.
  const lastStatus = new Map(); // Each contestant's last status, so a fresh seal can be stamped.

  /* Connecting ------------------------------------------------------------ */

  function connect() {
    if (socket) return socket;
    if (!window.io) return null;
    socket = window.io({ reconnectionDelayMax: 4000 });
    socket.on('state', (next) => { view = next; render(); });
    // Team games: a teammate moved the shared dot.
    socket.on('team:pos', (pos) => {
      if (!view?.task?.team || pos.by === view.you.id) return;
      view.task.mark = { x: pos.x, y: pos.y };
      view.task.team.x = pos.x; view.task.team.y = pos.y;
      placeTeamDot();
    });
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
    socket.timeout(20000).emit(event, payload, (err, res) => {
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
      // Generous wait: over a relayed link (e.g. Tailscale DERP) the handshake can take many seconds.
      await new Promise((resolve) => { socket.once('connect', resolve); setTimeout(resolve, 20000); });
      if (!socket.connected) return { ok: false, error: 'Could not reach the game server. Try again in a moment.' };
    }
    entering = true;
    const res = await send(event, payload);
    if (!res.ok) entering = false;
    if (res.ok) {
      store.set(SESSION, { code: res.code, token: res.token });
      store.set(NAME, payload.name, localStorage);
      history.replaceState(null, '', location.pathname);
    }
    return res;
  }

  function leaveToFront(fade = false) {
    store.clear(SESSION);
    if (fade) PPFade.leave(location.pathname);
    else location.href = location.pathname;
  }

  window.PPGame = {
    create: (name, mode) => enter('room:create', { name, mode }),
    join: (code, name) => enter('room:join', { code, name }),
    rememberedName: () => store.get(NAME, localStorage) ?? '',
  };

  /* Drawing --------------------------------------------------------------- */

  // Which screen this state draws: the lobby, or one form per round, phase, task and deal.
  // The reply has its own mailroom animation, so it never fades.
  function sceneOf(v) {
    if (v.phase === 'LOBBY') return 'lobby';
    if (v.phase === 'REPLY') return null;
    return `play:${v.roundNumber}:${v.phase}:${v.task.kind}:${v.task.deal ?? 0}`;
  }

  function render() {
    if (fading) return; // The old scene is fading out; the newest state is drawn once it has.
    const scene = sceneOf(view);
    const target = entering ? document.querySelector('.sheet') : shownScene !== null && scene && scene !== shownScene ? screen : null;
    entering = false;
    if (target) {
      fading = true;
      PPFade.swap(target, () => { fading = false; draw(); });
      return;
    }
    draw();
  }

  function draw() {
    shownScene = sceneOf(view) ?? 'reply';
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
      // A reroll deals a new board, so it counts as a new screen.
      const key = `play:${view.roundNumber}:${view.phase}:${view.task.kind}:${view.task.deal ?? 0}`;
      const deal = `${view.roundNumber}:${view.task.deal ?? 0}`;
      if (lastDeal && lastDeal.split(':')[0] === deal.split(':')[0] && lastDeal !== deal && view.phase === 'WRITING' && !rerolling) {
        toast('The psychic rerolled: new board and topic.');
        PPMail.paperSound(0.12, 0.16);
      }
      lastDeal = deal;
      setStage(key, playHtml, bindPlay);
      refreshPlay();
    }
    syncTimer();
  }

  function setStage(key, html, bind) {
    if (key === stageKey) return false;
    const fresh = !stageKey;
    stageKey = key;
    const typed = document.getElementById('clue-input')?.value ?? '';
    screen.innerHTML = html();
    const input = document.getElementById('clue-input');
    if (input && typed) input.value = typed;
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
        <fieldset class="mode-pick topic-pick" id="lobby-topics"><legend>The topics</legend></fieldset>
      </div>
      <div class="lobby-main">
        <h2 class="lobby-title" id="lobby-title"></h2>
        <fieldset class="mode-pick" id="lobby-modes"><legend>The ring</legend></fieldset>
        <fieldset class="rounds-pick" id="lobby-rounds">
          <legend>The length of the show</legend>
          <div class="rounds-per" id="rounds-per">
            <label><input type="radio" name="rounds-per" value="game"><span>Rounds in all</span></label>
            <label><input type="radio" name="rounds-per" value="player"><span>Turns as psychic, each</span></label>
          </div>
          <div class="rounds-row">
            <button class="btn step" type="button" data-step="-1" aria-label="One fewer">−</button>
            <output id="rounds-n" aria-live="polite"></output>
            <button class="btn step" type="button" data-step="1" aria-label="One more">+</button>
            <span id="rounds-unit"></span>
          </div>
          <p class="rounds-total" id="rounds-total"></p>
        </fieldset>
        <div id="lobby-players"></div>
        <p class="lobby-problem" id="lobby-problem" role="status"></p>
        <div class="lobby-actions">
          <button class="btn primary big" type="button" id="start-game">Raise the curtain</button>
          <button class="btn" type="button" id="leave-room">Leave the room</button>
        </div>
      </div>
    </div>`;

  async function copy(text, done, button) {
    try {
      await navigator.clipboard.writeText(text);
      toast(done);
      // The button itself gets a red "Copied!" stamp for a moment.
      if (button) {
        button.classList.remove('is-copied');
        void button.offsetWidth;
        button.classList.add('is-copied');
        clearTimeout(button.copiedTimer);
        button.copiedTimer = setTimeout(() => button.classList.remove('is-copied'), 1600);
      }
    } catch {
      toast('Copy that by hand. Your browser blocked it.');
    }
  }
  const inviteLink = () => `${location.origin}${location.pathname}?room=${view.code}`;

  function bindLobby() {
    document.getElementById('lobby-link').textContent = inviteLink();
    document.getElementById('copy-code').addEventListener('click', (e) => copy(view.code, 'Code copied', e.currentTarget));
    document.getElementById('copy-link').addEventListener('click', (e) => copy(inviteLink(), 'Invite link copied', e.currentTarget));
    document.getElementById('start-game').addEventListener('click', () => act('game:start'));
    document.getElementById('leave-room').addEventListener('click', leaveRoom);
    document.getElementById('lobby-modes').addEventListener('change', (e) => act('room:mode', { mode: e.target.value }));
    document.getElementById('lobby-topics').addEventListener('change', (e) => act('room:settings', { topicSet: e.target.value }));
    const rounds = document.getElementById('lobby-rounds');
    rounds.addEventListener('change', (e) => {
      if (e.target.name !== 'rounds-per') return;
      const per = e.target.value;
      act('room:settings', { rounds: { per, n: per === 'player' ? 1 : 4 } });
    });
    rounds.addEventListener('click', (e) => {
      const step = e.target.closest('[data-step]');
      if (!step) return;
      const { per, n } = view.settings.rounds;
      const max = per === 'player' ? view.limits.laps : view.limits.rounds;
      const next = Math.max(1, Math.min(max, n + Number(step.dataset.step)));
      if (next !== n) { blip(next > n ? 700 : 520, 0.04, 'square', 0.03); act('room:settings', { rounds: { per, n: next } }); }
    });
  }
  screen.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-team-join]');
    if (btn) act('room:team', { team: btn.dataset.teamJoin });
    const addBot = e.target.closest('[data-bot-add]');
    if (addBot) { blip(700, 0.05); act('room:bot:add', { team: addBot.dataset.botAdd || undefined }); }
    const dropBot = e.target.closest('[data-bot-remove]');
    if (dropBot) act('room:bot:remove', { botId: dropBot.dataset.botRemove });
    if (e.target.closest('#reroll')) {
      const btn = e.target.closest('#reroll');
      btn.disabled = true;
      rerolling = true;
      blip(330, 0.05, 'square', 0.04);
      act('psychic:reroll').then((r) => {
        rerolling = false;
        if (r.ok) PPMail.paperSound(0.16, 0.2);
        else btn.disabled = false;
      });
    }
    const nice = e.target.closest('[data-nice]');
    if (nice && !nice.dataset.pending) {
      // Flips at once, so it feels instant on a slow link; the server's answer settles it.
      const on = nice.getAttribute('aria-pressed') !== 'true';
      nice.setAttribute('aria-pressed', String(on));
      nice.classList.toggle('is-on', on);
      if (on) { nice.classList.remove('pop'); void nice.offsetWidth; nice.classList.add('pop'); blip(880, 0.06); PPMail.thud?.(); }
      nice.dataset.pending = '1';
      act('clue:nice', { psychicId: nice.dataset.nice }).finally(() => { delete nice.dataset.pending; if (view?.task) refreshNice(); });
    }
  });

  async function leaveRoom() {
    await send('room:leave');
    leaveToFront(true);
  }

  const nameTag = (p) => `<li data-pid="${esc(p.id)}" class="lobby-player${p.id === view.you.id ? ' is-you' : ''}${p.connected ? '' : ' is-away'}${p.isBot ? ' is-bot' : ''}"><span>${esc(p.name)}</span>${p.id === view.you.id ? '<small>you</small>' : ''}${p.isHost ? '<small>host</small>' : ''}${p.connected ? '' : '<small>away</small>'}${p.isBot && view.you.isHost ? `<button class="bot-remove" type="button" data-bot-remove="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">×</button>` : ''}</li>`;
  const botButton = (team = '', label = 'Add a bot') => (view.you.isHost ? `<button class="btn bot-add" type="button" data-bot-add="${team}">+ ${label}</button>` : '');

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

    refreshSettings(isHost);

    const list = document.getElementById('lobby-players');
    const head = playersHead();
    if (view.mode === 'teams') {
      const team = (id, name) => {
        const members = view.players.filter((p) => p.team === id);
        const mine = view.you.team === id;
        // Join and bot buttons sit in the team's heading, apart from the names.
        const join = mine ? '<span class="team-yours">Your team</span>' : `<button class="btn team-join" type="button" data-team-join="${id}">Join</button>`;
        return `<div class="lobby-team team-${id}"><div class="lobby-team-head"><h3>${name}</h3><span class="lobby-team-actions">${join}${botButton(id, 'bot')}</span></div><ul>${members.map(nameTag).join('') || '<li class="lobby-empty">Nobody yet</li>'}</ul></div>`;
      };
      list.innerHTML = `${head}<div class="lobby-teams">${team('lions', 'The Lions')}${team('tigers', 'The Tigers')}</div>`;
    } else {
      list.innerHTML = `${head}<ul class="lobby-list">${view.players.map(nameTag).join('')}</ul>${view.mode === 'duel' && view.players.length >= 2 ? '' : botButton()}`;
    }
    // Newcomers take a bow: their name stamps onto the list.
    const first = seenPlayers.size === 0;
    list.querySelectorAll('.lobby-player[data-pid]').forEach((li) => {
      if (!seenPlayers.has(li.dataset.pid)) {
        seenPlayers.add(li.dataset.pid);
        if (!first) { li.classList.add('is-new'); blip(740, 0.06, 'triangle', 0.05); }
      }
    });
    const start = document.getElementById('start-game');
    start.hidden = !isHost;
    start.disabled = !!view.startProblem;
    document.getElementById('lobby-problem').textContent = view.startProblem ?? (isHost ? 'Everyone is here. Raise the curtain when you are ready.' : 'Everyone is here. The curtain rises soon.');
  }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // "Players · 3 of 8". The seat limits mirror the server's (server/engine.js); team games have none.
  const SEATS = { duel: 2, free: 8 };
  function playersHead() {
    const n = view.players.length, max = SEATS[view.mode];
    return `<h3 class="lobby-players-head">Players <small>${max ? `${n} of ${max}` : plural(n, 'player', 'players')}</small></h3>`;
  }

  function refreshSettings(isHost) {
    const topics = document.getElementById('lobby-topics');
    if (!topics.querySelector('input')) {
      topics.innerHTML = '<legend>The topics</legend>' + view.topicSets.map((t) =>
        `<label><input type="radio" name="room-topics" value="${esc(t.id)}"><span><b>${esc(t.name)}</b><small>${esc(t.blurb)}</small></span></label>`).join('');
    }
    topics.querySelectorAll('input').forEach((input) => {
      input.checked = input.value === view.settings.topicSet;
      input.disabled = !isHost;
    });
    topics.classList.toggle('is-locked', !isHost);

    const { per, n } = view.settings.rounds;
    const isFree = view.mode === 'free';
    const box = document.getElementById('lobby-rounds');
    box.classList.toggle('is-locked', !isHost);
    document.getElementById('rounds-per').hidden = !isFree;
    box.querySelectorAll('input[name="rounds-per"]').forEach((input) => {
      input.checked = input.value === per;
      input.disabled = !isHost;
    });
    const max = per === 'player' ? view.limits.laps : view.limits.rounds;
    box.querySelectorAll('[data-step]').forEach((b) => {
      b.hidden = !isHost;
      b.disabled = Number(b.dataset.step) < 0 ? n <= 1 : n >= max;
    });
    document.getElementById('rounds-n').textContent = n;
    document.getElementById('rounds-unit').textContent = per === 'player' ? (n === 1 ? 'turn each' : 'turns each') : (n === 1 ? 'round' : 'rounds');
    const here = view.players.filter((p) => p.connected).length;
    document.getElementById('rounds-total').textContent = per === 'player'
      ? `Everyone is psychic ${n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`}: ${plural(view.totalRounds, 'round', 'rounds')} with ${plural(here, 'player', 'players')}.`
      : (view.mode === 'duel' ? 'Each round, you both write a clue and guess the other one.' : '');
  }

  /* Playing ---------------------------------------------------------------- */

  const prompts = {
    write() {
      if (view.mode === 'teams') return 'You and the rival psychic see the same star, and both clues will be in plain view. Write something only your team will get.';
      if (view.mode === 'duel') {
        const other = view.players.find((p) => p.id !== view.you.id)?.name ?? 'Your rival';
        return `You are the psychic for this star. ${other} is writing a clue of their own at the same moment.`;
      }
      return view.task.topic ? `You are the psychic. Name ${view.task.topic.toLowerCase()} that belongs right on the star.` : 'You are the psychic. Write one clue that belongs right on the star.';
    },
    wrote: () => 'Your clue is sealed. Waiting for the other clues to come in.',
    'await-clue': () => {
      const names = view.task.psychics.map((p) => p.name).join(' and ');
      return view.task.psychics.length > 1 ? `${names} are writing. Both clues appear together, so nobody can copy.` : `${names} is writing the clue. You mark the board as soon as it comes in.`;
    },
    mark() {
      if (view.mode === 'teams') return 'Your team shares one mark. Anyone can drag it, and everyone sees it move. Lock in when you all agree.';
      return 'Drag your mark or tap the board, then seal it. No answers until your reply comes by mail.';
    },
    marked: () => (view.task.team ? 'Your team has locked in its guess. Waiting for the other team.' : 'Your mark is sealed. Waiting for everyone else.'),
    'await-marks': () => (view.task.team ? 'Your clue is out. Watch your team move its mark, and keep your poker face.' : 'Your clue is out. Nobody learns a thing until the mail comes.'),
  };

  function clueHtml() {
    const { task } = view;
    if (task.kind === 'write') {
      return `<form class="clue-write" id="clue-form" autocomplete="off">
          <label for="clue-input">Your clue</label>
          <input id="clue-input" maxlength="60" placeholder="${task.topic ? esc(`Name ${task.topic.toLowerCase()}`) : 'One clue. Keep it short.'}" autocomplete="off" enterkeyhint="send">
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

  const topicHtml = () => (view.task.topic ? `<span class="topic-tag"><small>Topic</small> ${esc(view.task.topic)}</span>` : '');

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
    if (kind === 'write') {
      const left = view.task.rerollsLeft;
      const reroll = left
        ? '<button class="btn reroll" type="button" id="reroll"><span class="nice-star" aria-hidden="true">⟳</span> Reroll board &amp; topic <small>1 left</small></button>'
        : '<button class="btn reroll" type="button" disabled>Reroll used <small>0 left</small></button>';
      return `<button class="btn primary" type="submit" form="clue-form" id="game-action">Seal my clue</button>${reroll}`;
    }
    if (kind === 'mark' && view.task.team) return `<button class="btn primary" type="button" id="game-action" aria-pressed="false">Lock in our guess</button>${niceHtml()}<p class="team-agree" id="team-agree" aria-live="polite"></p>`;
    if (kind === 'mark') return `<button class="btn primary" type="button" id="game-action">${view.roundNumber === view.totalRounds ? 'Seal my last mark' : 'Seal my mark'}</button>${niceHtml()}`;
    return niceHtml();
  }

  // "Nice clue!" buttons for every clue on your board that isn't yours, and a tally for your own.
  function niceHtml() {
    const { clues } = view.task;
    if (!clues) return '';
    const others = clues.filter((c) => !c.own && c.text);
    const buttons = others.map((c) => `<button class="btn nice" type="button" data-nice="${esc(c.id)}" aria-pressed="false"><span class="nice-star" aria-hidden="true">★</span> Nice clue${others.length > 1 ? `<small>${esc(c.name)}</small>` : ''}</button>`).join('');
    const tally = clues.some((c) => c.own) ? '<p class="nice-count" id="nice-count" aria-live="polite"></p>' : '';
    return buttons + tally;
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
          <p class="sub">${subHtml()}${topicHtml()}</p>
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
    niceSeen = view.task.clues?.find((c) => c.own)?.nice ?? 0;
    let pos = task.mark ? toBoard(task.mark) : task.team ? toBoard(task.team) : { x: 50, y: 50 };
    let lastTick = pos;
    board = createBoard(document.getElementById('game-board'), {
      onInput(p) {
        pos = p;
        if (Math.hypot(p.x - lastTick.x, p.y - lastTick.y) >= 6) { lastTick = p; blip(900, 0.02, 'square', 0.02); }
        if (view.task.team) sendTeamMove(p);
      },
    });
    const svg = document.querySelector('#game-board svg');
    const canMark = task.kind === 'mark';
    board.update({ marker: pos, target: null, interactive: canMark, revealed: false });
    svg.setAttribute('aria-label', `Top is ${task.card.top}, bottom is ${task.card.bottom}, left is ${task.card.left}, right is ${task.card.right}.${canMark ? ' Arrow keys move your mark, Enter seals it.' : ''}`);
    if (task.target) showTarget(svg, toBoard(task.target));
    // A team's psychic watches the team's mark; otherwise only guessers see one.
    if (task.kind !== 'mark' && task.kind !== 'marked' && !task.team) svg.querySelector('.marker').classList.add('hidden');

    const status = document.getElementById('game-status');
    if (canMark && task.team) {
      const lock = () => {
        flushTeamMove();
        act('team:agree').then((r) => { if (r.ok) PPMail.paperSound(0.08, 0.14); });
      };
      document.getElementById('game-action').addEventListener('click', lock);
      document.getElementById('game-board').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); lock(); }
      });
      status.textContent = `New clues: ${task.clues.map((c) => c.text ?? 'none').join(' and ')}. Your team moves one mark together.`;
      blip(660, 0.08);
    } else if (canMark) {
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

  // The team's dot: sent at most every 70ms while dragging, with the last spot always sent.
  function sendTeamMove(p) {
    movedAt = Date.now();
    pendingMove = toChart(p);
    const wait = 70 - (Date.now() - lastSent);
    if (wait <= 0) flushTeamMove();
    else if (!moveTimer) moveTimer = setTimeout(flushTeamMove, wait);
  }
  function flushTeamMove() {
    clearTimeout(moveTimer);
    moveTimer = null;
    if (!pendingMove || !socket) return;
    lastSent = Date.now();
    socket.emit('team:move', pendingMove);
    pendingMove = null;
  }
  function placeTeamDot() {
    const { task } = view;
    if (!board || !task?.team || Date.now() - movedAt < 400) return; // Your own drag wins.
    board.update({ marker: toBoard(task.team), target: null, interactive: task.kind === 'mark', revealed: false });
  }

  function refreshTeam() {
    const { team } = view.task;
    if (!team) return;
    placeTeamDot();
    const btn = document.getElementById('game-action');
    if (btn && view.task.kind === 'mark') {
      btn.textContent = team.youAgreed ? 'Unlock' : 'Lock in our guess';
      btn.setAttribute('aria-pressed', String(team.youAgreed));
      btn.classList.toggle('is-locked', team.youAgreed);
    }
    const line = document.getElementById('team-agree');
    if (line) {
      const here = team.mates.filter((m) => m.online);
      const waiting = here.filter((m) => !m.agreed).map((m) => (m.you ? 'you' : m.name));
      const done = here.length - waiting.length;
      line.innerHTML = `<b>${done} of ${here.length} locked in</b>${waiting.length ? ` · waiting for ${esc(waiting.join(', '))}` : ''}`;
    }
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

  function refreshNice() {
    const { clues } = view.task;
    if (!clues) return;
    clues.forEach((c) => {
      const btn = screen.querySelector(`[data-nice="${CSS.escape(c.id)}"]`);
      if (btn && !btn.dataset.pending) { btn.setAttribute('aria-pressed', String(c.nicedByYou)); btn.classList.toggle('is-on', c.nicedByYou); }
    });
    const own = clues.find((c) => c.own);
    const tally = document.getElementById('nice-count');
    if (own && tally) {
      const n = own.nice ?? 0;
      tally.textContent = n ? `★ ${n === 1 ? 'One player' : `${n} players`} said nice clue` : '';
      tally.classList.toggle('is-on', n > 0);
      if (n > niceSeen) {
        toast('Someone thinks that’s a nice clue!');
        CFG.chime.slice(0, 2).forEach((f, i) => setTimeout(() => blip(f, 0.08), i * 80));
        tally.classList.remove('pop'); void tally.offsetWidth; tally.classList.add('pop');
      }
      niceSeen = n;
    }
  }

  function refreshPlay() {
    refreshNice();
    refreshTeam();
    document.getElementById('game-thumbs').innerHTML = Array.from({ length: view.totalRounds }, (_, i) => {
      const m = view.yourMarks[i];
      return PPMail.thumb(m ? toBoard(m) : null, i === view.roundNumber - 1);
    }).join('');
    const box = document.getElementById('contestants');
    const chip = (p) => {
      const label = !p.connected ? 'Away' : p.status === 'sealed' ? 'Sealed' : p.status === 'writing' ? 'Writing…' : p.status === 'marking' ? 'Marking…' : p.status === 'agreed' ? 'Locked in' : view.phase === 'MARKING' ? 'Psychic' : 'Waiting';
      const fresh = p.status === 'sealed' && lastStatus.has(p.id) && lastStatus.get(p.id) !== 'sealed';
      lastStatus.set(p.id, p.status);
      return `<li class="contestant${fresh ? ' just-sealed' : ''}${p.id === view.you.id ? ' is-you' : ''}${p.status === 'sealed' ? ' is-sealed' : ''}${p.connected ? '' : ' is-away'}${p.team ? ` team-${p.team}` : ''}"><b>${esc(p.name)}</b><small>${label}</small></li>`;
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
      if (view.task.kind === 'mark' && !view.task.team) send('mark:submit', toChart(board.position()));
      if (view.task.kind === 'mark' && view.task.team) flushTeamMove(); // The server seals the team's mark where it stands.
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
      clues: sheet.clues.map((c) => ({ label: raw.mode === 'duel' ? null : c.team ? `${c.name} of ${teamName[c.team]}` : c.name, text: c.text, nice: c.nice ?? [], team: c.team ?? null, by: c.name })),
      card: sheet.card,
      topic: sheet.topic ?? null,
      target: toBoard(sheet.target),
      marks: sheet.marks.map((m) => {
        const at = m.x === null ? { x: null, y: null } : toBoard(m);
        // Team games list one guess per team; yours is drawn as your mark.
        if (raw.mode === 'teams') {
          const j = m.journey;
          const journey = j && { ...j, trail: j.trail.map(([x, y]) => { const p = toBoard({ x, y }); return [p.x, p.y]; }) };
          return { name: m.name.replace(/^The /, ''), ...at, tier: m.tier, points: m.points, distance: m.distance, isYou: m.team === view.you.team, youLabel: 'Your team', team: m.team, journey };
        }
        return { name: m.name, ...at, tier: m.tier, points: m.points, distance: m.distance, isYou: m.playerId === me, team: m.team };
      }),
      psychics: sheet.clues.map((c) => ({ name: c.name, points: c.points, isYou: c.playerId === me, resonance: !!c.resonance })),
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

    // The clue with the most nods across the whole game. Level tops share it.
    const all = raw.sheets.flatMap((sh) => sh.clues.filter((c) => c.text && c.nice?.length));
    const best = Math.max(0, ...all.map((c) => c.nice.length));
    const nicest = best ? all.filter((c) => c.nice.length === best).map((c) => ({ text: c.text, name: c.playerId === me ? 'you' : c.name, count: best })) : [];

    return {
      sheets,
      nicest,
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
