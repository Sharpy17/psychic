// Mock server: stands in for the real backend so the UI can be built now.
// It speaks the same contract the real server will:
//   MockServer.send(type, payload)  -> client-to-server events
//   MockServer.onState(callback)    -> server-to-client `room_state`
//   MockServer.onError(callback)    -> server-to-client `error`
// Replace this file with a Socket.IO wrapper exposing the same three
// functions and app.js shouldn't need to change.

const MockServer = (() => {
  // Game tuning. Free-for-all: everyone scores for themselves.
  const MIN_PLAYERS = 3;
  const ROUNDS_PER_PLAYER = 1; // how many times each player is the psychic
  const PSYCHIC_POINTS_PER_HIT = 1; // psychic earns this for every player who lands in a ring
  const RINGS = [[5, 4], [11, 3], [18, 2]]; // [radius, points] on a 0-100 board (must match board.js)

  const COLORS = ['#3fd8c7', '#ff7b8c', '#9b7bff', '#ffd35c', '#5bb8ff', '#ff9e45', '#7be07b', '#ff6bd6'];

  // Each card is two axes: top/bottom and left/right.
  const CARDS = [
    { top: 'Funny', bottom: 'Unfunny', left: 'Ugly', right: 'Cute' },
    { top: 'Expensive', bottom: 'Cheap', left: 'Gross', right: 'Delicious' },
    { top: 'Scary', bottom: 'Not scary', left: 'Tiny', right: 'Huge' },
    { top: 'Cool', bottom: 'Cringe', left: 'Useless', right: 'Useful' },
    { top: 'Exciting', bottom: 'Boring', left: 'Easy', right: 'Hard' },
    { top: 'Healthy', bottom: 'Unhealthy', left: 'Bland', right: 'Tasty' },
    { top: 'Popular', bottom: 'Niche', left: 'Overrated', right: 'Underrated' },
    { top: 'Loud', bottom: 'Quiet', left: 'Annoying', right: 'Charming' },
  ];
  const BOT_CLUES = ['A pug in a hot dog costume', 'Airport sushi', 'A goose', 'A fanny pack',
    'Learning to juggle', 'Kale chips', 'Elevator music', 'Your uncle at a wedding', 'A pigeon'];
  const BOT_NAMES = ['Ari', 'Bo', 'Cy', 'Dee'];

  let room = null;
  let viewerId = null; // whose eyes the UI is looking through
  let stateListeners = [];
  let errorListeners = [];
  let botTimers = [];
  let botKey = null;

  const rand = (min, max) => Math.random() * (max - min) + min;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = v => Math.max(0, Math.min(100, Number(v) || 0));
  const player = id => room.players.find(p => p.id === id);
  const guessers = () => room.players.filter(p => p.id !== room.psychicId);
  const makeCode = () => Array.from({ length: 4 },
    () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

  function scoreFor(a, b) {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const ring = RINGS.find(([r]) => d <= r);
    return ring ? ring[1] : 0;
  }

  function createRoom(name, code) {
    room = {
      code: code || makeCode(),
      phase: 'LOBBY',
      players: [name, ...BOT_NAMES].map((n, i) => ({
        id: i === 0 ? 'p1' : 'bot' + i, name: n, color: COLORS[i % COLORS.length], score: 0, isHost: i === 0,
      })),
      round: 0,
      totalRounds: 0,
      psychicId: null,
      card: null,
      clue: null,
      target: null,
      guesses: {}, // playerId -> { x, y, locked }
      roundPoints: null, // playerId -> points earned this round (set on reveal)
    };
    viewerId = 'p1';
  }

  function resetScores() {
    room.players.forEach(p => { p.score = 0; });
    room.round = 0;
    room.psychicId = null;
    room.guesses = {};
    room.roundPoints = null;
  }

  function startRound() {
    room.round += 1;
    room.psychicId = room.players[(room.round - 1) % room.players.length].id;
    const prev = room.card;
    do { room.card = pick(CARDS); } while (room.card === prev);
    room.target = { x: Math.round(rand(12, 88)), y: Math.round(rand(12, 88)) };
    room.clue = null;
    room.guesses = Object.fromEntries(guessers().map(p => [p.id, { x: 50, y: 50, locked: false }]));
    room.roundPoints = null;
    room.phase = 'CLUE';
  }

  function reveal() {
    const points = {};
    let hits = 0;
    for (const p of guessers()) {
      points[p.id] = scoreFor(room.guesses[p.id], room.target);
      p.score += points[p.id];
      if (points[p.id] > 0) hits += 1;
    }
    const psychic = player(room.psychicId);
    points[psychic.id] = hits * PSYCHIC_POINTS_PER_HIT;
    psychic.score += points[psychic.id];
    room.roundPoints = points;
    room.phase = 'REVEAL';
  }

  // Each handler validates the action. The server is the authority, never the client.
  const handlers = {
    create_room({ name }) {
      createRoom(String(name || 'You').slice(0, 16));
    },
    join_room({ name, roomCode }) {
      // A real server would look the room up; the mock just makes one with that code.
      createRoom(String(name || 'You').slice(0, 16), String(roomCode).toUpperCase());
    },
    leave() {
      room = null;
    },
    start_game(_, actorId) {
      if (!player(actorId).isHost) throw new Error('Only the host can start');
      if (room.players.length < MIN_PLAYERS) throw new Error(`You need at least ${MIN_PLAYERS} players`);
      resetScores();
      room.totalRounds = room.players.length * ROUNDS_PER_PLAYER;
      startRound();
    },
    submit_clue({ clue }, actorId) {
      if (room.phase !== 'CLUE' || actorId !== room.psychicId) throw new Error("It's not your turn to give a clue");
      const text = String(clue || '').trim().slice(0, 60);
      if (!text) throw new Error('Clue cannot be empty');
      room.clue = text;
      room.phase = 'GUESSING';
    },
    move_marker({ x, y }, actorId) {
      const guess = room.guesses[actorId];
      if (room.phase !== 'GUESSING' || !guess || guess.locked) return; // ignore silently, this fires a lot
      guess.x = clamp(x);
      guess.y = clamp(y);
    },
    lock_guess(_, actorId) {
      const guess = room.guesses[actorId];
      if (room.phase !== 'GUESSING' || !guess || guess.locked) throw new Error("You can't lock in right now");
      guess.locked = true;
      if (Object.values(room.guesses).every(g => g.locked)) reveal();
    },
    next_round() {
      if (room.phase !== 'REVEAL') return;
      if (room.round >= room.totalRounds) room.phase = 'GAME_OVER';
      else startRound();
    },
    play_again(_, actorId) {
      if (!player(actorId).isHost) throw new Error('Only the host can restart');
      resetScores();
      room.phase = 'LOBBY';
    },
    // Dev-only: look at the game through another player's eyes.
    dev_view_as({ playerId }) {
      if (player(playerId)) viewerId = playerId;
    },
  };

  // The real server must build this per socket. Before the reveal, nobody receives the
  // target (except the psychic) or anyone else's dot, only whether they've locked in.
  function viewFor(id) {
    if (!room) return null;
    const open = room.phase === 'REVEAL' || room.phase === 'GAME_OVER';
    const guesses = {};
    for (const [pid, g] of Object.entries(room.guesses)) {
      guesses[pid] = open || pid === id ? { ...g } : { locked: g.locked };
    }
    const { target, ...shared } = room;
    const canSeeTarget = open || id === room.psychicId;
    return JSON.parse(JSON.stringify({ ...shared, guesses, me: player(id), target: canSeeTarget ? target : null }));
  }

  function handle(type, payload, actorId) {
    const fn = handlers[type];
    if (!fn) return emitError(`Unknown event: ${type}`);
    if (!room && type !== 'create_room' && type !== 'join_room') return emitError('Not in a room');
    try {
      fn(payload || {}, actorId);
    } catch (err) {
      return emitError(err.message);
    }
    broadcast();
    scheduleBots();
  }

  function broadcast() {
    const view = viewFor(viewerId);
    stateListeners.forEach(fn => fn(view));
  }
  function emitError(msg) {
    errorListeners.forEach(fn => fn(msg));
  }

  // Every player except the one you're viewing as is played by a bot, so one person can test everything.
  function scheduleBots() {
    const key = room ? `${room.phase}|${room.round}|${viewerId}` : null;
    if (key === botKey) return; // don't restart bot timers on every marker tick
    botKey = key;
    botTimers.forEach(clearTimeout);
    botTimers = [];
    if (!room) return;
    const later = (ms, fn) => botTimers.push(setTimeout(fn, ms));

    if (room.phase === 'CLUE' && room.psychicId !== viewerId) {
      later(2200, () => handle('submit_clue', { clue: pick(BOT_CLUES) }, room.psychicId));
    }
    if (room.phase === 'GUESSING') {
      for (const p of guessers()) {
        if (p.id === viewerId || room.guesses[p.id].locked) continue;
        later(rand(1500, 7000), () => {
          if (room?.phase !== 'GUESSING' || room.guesses[p.id]?.locked) return;
          const spread = rand(4, 22);
          handle('move_marker', {
            x: room.target.x + rand(-spread, spread),
            y: room.target.y + rand(-spread, spread),
          }, p.id);
          handle('lock_guess', {}, p.id);
        });
      }
    }
  }

  return {
    send(type, payload) {
      handle(type, payload, viewerId);
    },
    onState(fn) {
      stateListeners.push(fn);
      fn(viewFor(viewerId));
    },
    onError(fn) {
      errorListeners.push(fn);
    },
  };
})();
