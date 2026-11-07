// The game rules, with no networking, so they can be tested directly.
//
// Coordinates are the game's chart: -100 to +100 on each axis, y up.
//
// A round is one or more "sheets". A sheet is one board with one target:
//   Free for All: one sheet, one writer, everyone else guesses.
//   Team:         one sheet, one writer per team, everyone else guesses. Both clues are shown.
//   Head to Head: two sheets, each player writes on one and guesses on the other.
//
// SECRECY: viewFor() is the only thing that leaves the server. Targets go only to a sheet's
// writers, marks only to the player who made them, and clues only once every writer is done.
// The reply, with everything in it, exists only after the last round.

import { randomBytes, randomUUID } from 'node:crypto';
import { CARDS } from './cards.js';

export const MODES = {
  duel: { name: 'Head to Head', min: 2, max: 2 },
  free: { name: 'Free for All', min: 3, max: 8 },
  // The rules set no team limit. This only stops one room from exhausting the server.
  teams: { name: 'Team Against Team', min: 4, max: 100 },
};
export const TEAMS = { lions: 'The Lions', tigers: 'The Tigers' };
export const ROUNDS = 4;
export const WRITE_MS = 90_000;
export const MARK_MS = 60_000;
export const GRACE_MS = 2_000; // Lets a mark sent at the final second arrive.
export const TARGET_BOUND = 85;
export const MAX_CLUE = 60;
export const MAX_NAME = 16;

const TIERS = [
  { name: 'Bullseye', limit: 15, points: 1000 },
  { name: 'Excellent', limit: 35, points: 750 },
  { name: 'Great', limit: 60, points: 500 },
  { name: 'Close', limit: 90, points: 250 },
  { name: 'Miss', limit: Infinity, points: 50 },
];
const MAX_DISTANCE = Math.hypot(200, 200); // Counted for a missing mark when breaking ties.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class GameError extends Error {}
const refuse = (message) => { throw new GameError(message); };
const round1 = (n) => Math.round(n * 10) / 10;
const average = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);

export function scoreFor(mark, target) {
  const distance = Math.hypot(mark.x - target.x, mark.y - target.y);
  const tier = TIERS.find((t) => distance <= t.limit);
  return { distance, tier: tier.name, points: tier.points };
}

export function makeCode(taken = () => false, random = Math.random) {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]).join('');
  } while (taken(code));
  return code;
}

export function cleanName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  if (!name) refuse('Enter your name first.');
  return name;
}

function addPlayer(room, name) {
  const player = {
    id: randomUUID(),
    token: randomBytes(24).toString('hex'),
    name: cleanName(name),
    connected: true,
    team: null,
  };
  room.players.push(player);
  placeOnTeam(room, player);
  return player;
}

function placeOnTeam(room, player) {
  if (room.mode !== 'teams') { player.team = null; return; }
  const count = (team) => room.players.filter((p) => p.team === team).length;
  player.team = count('lions') <= count('tigers') ? 'lions' : 'tigers';
}

export function createRoom({ code, name, mode = 'free', random = Math.random }) {
  if (!MODES[mode]) refuse('Pick a game mode.');
  const room = {
    code, mode, random,
    phase: 'LOBBY',
    hostId: null,
    players: [],
    roundIndex: -1,
    rounds: [],
    deck: [],
    bags: {},
    deadline: null,
    reply: null,
  };
  const host = addPlayer(room, name);
  room.hostId = host.id;
  return { room, player: host };
}

export function joinRoom(room, name) {
  if (room.phase !== 'LOBBY') refuse('That game has already started. Wait for the next one.');
  const clean = cleanName(name);
  if (room.players.length >= MODES[room.mode].max) refuse(`That room is full. ${MODES[room.mode].name} takes ${MODES[room.mode].max} players.`);
  if (room.players.some((p) => p.name.toLowerCase() === clean.toLowerCase())) refuse('Someone in that room already has that name. Pick another.');
  return addPlayer(room, clean);
}

function assertHost(room, playerId) {
  if (room.hostId !== playerId) refuse('Only the host can do that.');
}

export function setMode(room, playerId, mode) {
  assertHost(room, playerId);
  if (room.phase !== 'LOBBY') refuse('The mode can only change in the lobby.');
  if (!MODES[mode]) refuse('Pick a game mode.');
  room.mode = mode;
  room.players.forEach((p) => { p.team = null; });
  room.players.forEach((p) => placeOnTeam(room, p));
}

export function setTeam(room, playerId, team) {
  if (room.phase !== 'LOBBY' || room.mode !== 'teams') refuse('You can only switch teams in a team lobby.');
  if (!TEAMS[team]) refuse('Pick a team.');
  room.players.find((p) => p.id === playerId).team = team;
}

// Why the game can't start yet, or null if it can.
export function startProblem(room) {
  const { min, max, name } = MODES[room.mode];
  const n = room.players.filter((p) => p.connected).length;
  if (room.mode === 'duel' && n !== 2) return `${name} needs exactly 2 players.`;
  if (n > max) return `${name} takes up to ${max} players.`;
  if (n < min) return `${name} needs at least ${min} players. ${min - n} more to go.`;
  if (room.mode === 'teams') {
    const online = room.players.filter((p) => p.connected);
    for (const team of Object.keys(TEAMS)) {
      if (online.filter((p) => p.team === team).length < 2) return `${TEAMS[team]} need at least 2 players.`;
    }
  }
  return null;
}

// Random, with no repeats until everyone in the group has had a turn.
function drawPsychic(room, bagKey, group) {
  const online = group.filter((p) => p.connected);
  const pool = online.length ? online : group;
  let bag = (room.bags[bagKey] ?? []).filter((id) => pool.some((p) => p.id === id));
  if (!bag.length) bag = pool.map((p) => p.id);
  const id = bag[Math.floor(room.random() * bag.length)];
  room.bags[bagKey] = bag.filter((x) => x !== id);
  return pool.find((p) => p.id === id);
}

function dealCard(room) {
  if (!room.deck.length) room.deck = CARDS.slice();
  return room.deck.splice(Math.floor(room.random() * room.deck.length), 1)[0];
}

function randomTarget(room) {
  const axis = () => Math.round((room.random() * 2 - 1) * TARGET_BOUND);
  return { x: axis(), y: axis() };
}

function makeSheet(room, writers, guessers) {
  return { card: dealCard(room), target: randomTarget(room), writers: writers.map((p) => p.id), guessers: guessers.map((p) => p.id), clues: {}, marks: {} };
}

function makeRound(room) {
  const { players } = room;
  if (room.mode === 'duel') {
    const [a, b] = players;
    return { sheets: [makeSheet(room, [a], [b]), makeSheet(room, [b], [a])] };
  }
  if (room.mode === 'teams') {
    const writers = Object.keys(TEAMS).map((team) => drawPsychic(room, team, players.filter((p) => p.team === team)));
    return { sheets: [makeSheet(room, writers, players.filter((p) => !writers.includes(p)))] };
  }
  const psychic = drawPsychic(room, 'all', players);
  return { sheets: [makeSheet(room, [psychic], players.filter((p) => p !== psychic))] };
}

function beginRound(room, now) {
  room.roundIndex += 1;
  room.rounds.push(makeRound(room));
  room.phase = 'WRITING';
  room.deadline = now + WRITE_MS;
}

export function startGame(room, playerId, now = Date.now()) {
  assertHost(room, playerId);
  if (room.phase !== 'LOBBY') refuse('The game has already started.');
  const problem = startProblem(room);
  if (problem) refuse(problem);
  room.players = room.players.filter((p) => p.connected);
  room.roundIndex = -1;
  room.rounds = [];
  room.deck = [];
  room.bags = {};
  room.reply = null;
  beginRound(room, now);
}

const currentRound = (room) => room.rounds[room.roundIndex];
const isOnline = (room, id) => room.players.find((p) => p.id === id)?.connected;

export function submitClue(room, playerId, rawText, now = Date.now()) {
  if (room.phase !== 'WRITING') refuse('It is not time to write a clue.');
  const sheet = currentRound(room).sheets.find((s) => s.writers.includes(playerId));
  if (!sheet) refuse('You are not the psychic this round.');
  if (sheet.clues[playerId] !== undefined) refuse('Your clue is already in.');
  const text = String(rawText ?? '').replace(/\s+/g, ' ').trim();
  if (!text) refuse('Write a clue first.');
  if (text.length > MAX_CLUE) refuse(`Keep your clue to ${MAX_CLUE} characters.`);
  sheet.clues[playerId] = text;
  advance(room, now);
}

export function submitMark(room, playerId, mark, now = Date.now()) {
  if (room.phase !== 'MARKING') refuse('It is not time to mark the board.');
  const sheet = currentRound(room).sheets.find((s) => s.guessers.includes(playerId));
  if (!sheet) refuse('You are not guessing this round.');
  if (sheet.marks[playerId]) refuse('Your mark is already sealed.');
  const x = Number(mark?.x), y = Number(mark?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) refuse('That mark is not on the board.');
  const clamp = (v) => Math.max(-100, Math.min(100, Math.round(v)));
  sheet.marks[playerId] = { x: clamp(x), y: clamp(y) };
  advance(room, now);
}

// Moves on once everyone still connected is done. Absent players never hold up the room.
export function advance(room, now = Date.now()) {
  if (room.phase === 'WRITING') {
    const done = currentRound(room).sheets.every((s) => s.writers.every((id) => s.clues[id] !== undefined || !isOnline(room, id)));
    if (done) beginMarking(room, now);
  } else if (room.phase === 'MARKING') {
    const done = currentRound(room).sheets.every((s) => s.guessers.every((id) => s.marks[id] || !isOnline(room, id)));
    if (done) endRound(room, now);
  }
}

function beginMarking(room, now) {
  room.phase = 'MARKING';
  room.deadline = now + MARK_MS;
}

function endRound(room, now) {
  if (room.roundIndex + 1 < ROUNDS) beginRound(room, now);
  else finish(room);
}

// Called when the timer runs out.
export function expire(room, now = Date.now()) {
  if (room.phase === 'WRITING') beginMarking(room, now);
  else if (room.phase === 'MARKING') endRound(room, now);
}

function finish(room) {
  room.phase = 'REPLY';
  room.deadline = null;
  room.reply = buildReply(room);
}

export function playAgain(room, playerId) {
  assertHost(room, playerId);
  if (room.phase !== 'REPLY') refuse('The game is not over yet.');
  room.phase = 'LOBBY';
  room.players = room.players.filter((p) => p.connected);
  room.rounds = [];
  room.roundIndex = -1;
  room.reply = null;
}

/* The reply: everything, once it's all over ------------------------------ */

function buildReply(room) {
  const person = (id) => room.players.find((p) => p.id === id) ?? { id, name: 'A departed player', team: null };
  const earned = new Map(); // id -> { perRound, distance }
  const entry = (id) => {
    if (!earned.has(id)) earned.set(id, { perRound: Array(room.rounds.length).fill(0), distance: 0 });
    return earned.get(id);
  };

  const sheets = room.rounds.flatMap((round, r) => round.sheets.map((sheet) => {
    const marks = sheet.guessers.map((id) => {
      const who = person(id), mark = sheet.marks[id];
      const base = { playerId: id, name: who.name, team: who.team };
      if (!mark) return { ...base, x: null, y: null, tier: 'No mark', points: 0, distance: null };
      const score = scoreFor(mark, sheet.target);
      return { ...base, ...mark, tier: score.tier, points: score.points, distance: round1(score.distance) };
    });
    const psychicPoints = room.mode === 'free' ? Math.round(average(marks.map((m) => m.points))) : null;
    return {
      round: r,
      card: sheet.card,
      target: sheet.target,
      clues: sheet.writers.map((id) => ({ playerId: id, name: person(id).name, team: person(id).team, text: sheet.clues[id] ?? null, points: psychicPoints })),
      marks,
    };
  }));

  let standings;
  if (room.mode === 'teams') {
    standings = Object.keys(TEAMS).map((team) => {
      const perRound = [], distances = [];
      sheets.forEach((sheet) => {
        const own = sheet.marks.filter((m) => m.team === team);
        perRound[sheet.round] = Math.round(average(own.map((m) => m.points)));
        distances.push(average(own.map((m) => m.distance ?? MAX_DISTANCE)));
      });
      return {
        id: team, name: TEAMS[team], team,
        members: room.players.filter((p) => p.team === team).map((p) => ({ id: p.id, name: p.name })),
        perRound, total: perRound.reduce((a, b) => a + b, 0), distance: distances.reduce((a, b) => a + b, 0),
      };
    });
  } else {
    sheets.forEach((sheet) => {
      sheet.marks.forEach((m) => {
        const e = entry(m.playerId);
        e.perRound[sheet.round] += m.points;
        e.distance += m.distance ?? MAX_DISTANCE;
      });
      sheet.clues.forEach((c) => { if (c.points !== null) entry(c.playerId).perRound[sheet.round] += c.points; });
    });
    standings = room.players.map((p) => {
      const e = entry(p.id);
      return { id: p.id, name: p.name, team: null, members: null, perRound: e.perRound, total: e.perRound.reduce((a, b) => a + b, 0), distance: e.distance };
    });
  }

  // Head to Head and teams break ties on total distance. Free for All shares the win.
  const useDistance = room.mode !== 'free';
  standings.sort((a, b) => b.total - a.total || (useDistance ? a.distance - b.distance : 0));
  const top = standings[0];
  const winners = standings.filter((s) => s.total === top.total && (!useDistance || s.distance === top.distance)).map((s) => s.id);
  return {
    mode: room.mode,
    rounds: room.rounds.length,
    sheets,
    standings: standings.map((s) => ({ ...s, distance: round1(s.distance) })),
    winners,
    decidedOnDistance: useDistance && standings.length > 1 && standings[1].total === top.total && winners.length === 1,
  };
}

/* What one player is allowed to know ------------------------------------- */

export function viewFor(room, playerId, now = Date.now()) {
  const round = room.rounds[room.roundIndex];
  const me = room.players.find((p) => p.id === playerId);
  const view = {
    code: room.code,
    mode: room.mode,
    modeName: MODES[room.mode].name,
    phase: room.phase,
    you: { id: playerId, isHost: room.hostId === playerId, team: me?.team ?? null },
    hostId: room.hostId,
    roundNumber: room.roundIndex + 1,
    totalRounds: ROUNDS,
    msLeft: room.deadline ? Math.max(0, room.deadline - now) : null,
    startProblem: room.phase === 'LOBBY' ? startProblem(room) : null,
    players: room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected, team: p.team, isHost: p.id === room.hostId, status: statusOf(room, p.id) })),
    task: null,
    yourMarks: room.rounds.map((r) => {
      const sheet = r.sheets.find((s) => s.marks[playerId]);
      return sheet ? sheet.marks[playerId] : null;
    }),
    reply: room.phase === 'REPLY' ? room.reply : null,
  };
  if (round && (room.phase === 'WRITING' || room.phase === 'MARKING')) view.task = taskFor(room, round, playerId);
  return view;
}

function statusOf(room, id) {
  if (room.phase !== 'WRITING' && room.phase !== 'MARKING') return null;
  const round = room.rounds[room.roundIndex];
  if (room.phase === 'WRITING') {
    const sheet = round.sheets.find((s) => s.writers.includes(id));
    if (!sheet) return null;
    return sheet.clues[id] !== undefined ? 'sealed' : 'writing';
  }
  const sheet = round.sheets.find((s) => s.guessers.includes(id));
  if (!sheet) return null;
  return sheet.marks[id] ? 'sealed' : 'marking';
}

function taskFor(room, round, id) {
  const name = (pid) => room.players.find((p) => p.id === pid)?.name ?? 'A departed player';
  const team = (pid) => room.players.find((p) => p.id === pid)?.team ?? null;
  const writing = round.sheets.find((s) => s.writers.includes(id));
  const guessing = round.sheets.find((s) => s.guessers.includes(id));
  const writerNames = (s) => s.writers.map((w) => ({ name: name(w), team: team(w), own: w === id }));

  if (room.phase === 'WRITING') {
    if (writing) {
      const clue = writing.clues[id];
      return { kind: clue === undefined ? 'write' : 'wrote', card: writing.card, target: writing.target, clue: clue ?? null };
    }
    return { kind: 'await-clue', card: guessing.card, psychics: writerNames(guessing) };
  }
  // MARKING: every clue on the sheet is now public to the players of that sheet.
  const clueList = (s) => s.writers.map((w) => ({ name: name(w), team: team(w), own: w === id, text: s.clues[w] ?? null }));
  if (guessing) {
    const mark = guessing.marks[id] ?? null;
    return { kind: mark ? 'marked' : 'mark', card: guessing.card, clues: clueList(guessing), mark };
  }
  return { kind: 'await-marks', card: writing.card, target: writing.target, clues: clueList(writing) };
}

/* Connections ------------------------------------------------------------ */

export function setConnected(room, playerId, connected, now = Date.now()) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return;
  player.connected = connected;
  if (!connected && room.hostId === playerId) {
    const next = room.players.find((p) => p.connected);
    if (next) room.hostId = next.id;
  }
  if (!connected) advance(room, now);
}

export function removePlayer(room, playerId, now = Date.now()) {
  if (room.phase === 'LOBBY') {
    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.hostId === playerId && room.players.length) room.hostId = (room.players.find((p) => p.connected) ?? room.players[0]).id;
    return;
  }
  setConnected(room, playerId, false, now);
}

export const isEmpty = (room) => !room.players.some((p) => p.connected);
