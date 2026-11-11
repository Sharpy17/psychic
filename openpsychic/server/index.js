// The web server: serves public/ and runs rooms over Socket.IO. Rooms live in memory, so a
// restart ends the games in progress. The rules themselves are all in engine.js.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import * as G from './engine.js';
import * as Bots from './bots.js';
import * as Daily from './daily.js';

const PORT = Number(process.env.PORT) || 4100;
const DAILY_TZ = process.env.DAILY_TZ || Daily.DEFAULT_TZ; // When the Daily Poll changes over.
const daily = Daily.createStore(process.env.DAILY_DATA || fileURLToPath(new URL('../data/daily', import.meta.url))); // Where guesses are saved.
const ROOT = fileURLToPath(new URL('../public', import.meta.url));
const MAX_ROOMS = 2000;
const EMPTY_ROOM_MS = 10 * 60_000; // How long an empty room waits for people to reconnect.

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const http = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://local');
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
    return;
  }
  if (pathname.startsWith('/api/daily')) { await dailyRoute(req, res, pathname); return; }
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { res.writeHead(400); res.end(); return; }
  const path = normalize(join(ROOT, decoded === '/' ? 'index.html' : decoded));
  if (path !== ROOT && !path.startsWith(ROOT + sep)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

/* The Daily Poll: plain JSON over HTTP, since it needs no room. ---------- */

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req, limit = 1_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > limit) { reject(new G.GameError('That guess is too big to mail.')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new G.GameError('That guess could not be read.')); } });
    req.on('error', reject);
  });
}

async function dailyRoute(req, res, pathname) {
  const now = new Date();
  const day = Daily.dayNumber(now, DAILY_TZ);
  const clock = { nextInMs: Daily.msUntilNextDay(now, DAILY_TZ), timeZone: DAILY_TZ };
  try {
    if (pathname === '/api/daily' && req.method === 'GET') {
      const player = new URL(req.url, 'http://local').searchParams.get('player');
      sendJson(res, 200, {
        ok: true, ...clock,
        puzzle: Daily.puzzleFor(day),
        result: Daily.resultFor(daily, day, player),
        yesterday: Daily.recapFor(daily, day - 1, player),
      });
    } else if (pathname === '/api/daily/guess' && req.method === 'POST') {
      const { player, x, y } = await readJson(req);
      sendJson(res, 200, { ok: true, ...clock, result: Daily.submitGuess(daily, day, player, { x, y }, { now: now.valueOf() }) });
    } else sendJson(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    if (error instanceof G.GameError) sendJson(res, 400, { ok: false, error: error.message });
    else { console.error('[daily]', error); sendJson(res, 500, { ok: false, error: 'Something went wrong. Try again.' }); }
  }
}

const io = new Server(http, { maxHttpBufferSize: 8_000 });
const rooms = new Map();
const timers = new Map(); // code -> { deadline, handle }
const emptyTimers = new Map();
const botTurns = new Set(); // Keys of bot turns already scheduled.
const BOT_DELAY = [1200, 3500]; // A bot thinks for a moment, like a person.

// Each player gets their own view, so nobody is sent what they may not see.
function sync(room) {
  armTimer(room);
  scheduleBots(room);
  for (const player of room.players) io.to(`player:${player.id}`).emit('state', G.viewFor(room, player.id));
}

function scheduleBots(room) {
  for (const turn of Bots.dueTurns(room)) {
    if (botTurns.has(turn.key)) continue;
    botTurns.add(turn.key);
    const delay = BOT_DELAY[0] + Math.random() * (BOT_DELAY[1] - BOT_DELAY[0]);
    setTimeout(() => {
      botTurns.delete(turn.key);
      if (rooms.get(room.code) !== room) return; // The room has closed.
      if (Bots.playTurn(room, turn)) sync(room);
    }, delay);
  }
}

function armTimer(room) {
  const current = timers.get(room.code);
  if (current?.deadline === room.deadline) return;
  if (current) clearTimeout(current.handle);
  timers.delete(room.code);
  if (!room.deadline) return;
  const handle = setTimeout(() => {
    timers.delete(room.code);
    G.expire(room);
    sync(room);
  }, Math.max(0, room.deadline - Date.now()) + G.GRACE_MS);
  timers.set(room.code, { deadline: room.deadline, handle });
}

function deleteRoom(code) {
  const timer = timers.get(code);
  if (timer) clearTimeout(timer.handle);
  timers.delete(code);
  rooms.delete(code);
  emptyTimers.delete(code);
}

function checkEmpty(room) {
  clearTimeout(emptyTimers.get(room.code));
  emptyTimers.delete(room.code);
  if (G.isEmpty(room)) emptyTimers.set(room.code, setTimeout(() => deleteRoom(room.code), EMPTY_ROOM_MS));
}

function seat(socket, room, player) {
  socket.data.code = room.code;
  socket.data.playerId = player.id;
  socket.join(`player:${player.id}`);
}

io.on('connection', (socket) => {
  // Runs an action, answers the caller, and refuses bad requests without crashing the server.
  const on = (event, handler) => socket.on(event, (payload, reply) => {
    const answer = typeof reply === 'function' ? reply : () => {};
    try {
      answer({ ok: true, ...handler(payload ?? {}) });
    } catch (error) {
      if (error instanceof G.GameError) answer({ ok: false, error: error.message });
      else { console.error(`[${event}]`, error); answer({ ok: false, error: 'Something went wrong. Try again.' }); }
    }
  });
  const seated = () => {
    const room = rooms.get(socket.data.code);
    if (!room || !socket.data.playerId) throw new G.GameError('You are not in a room.');
    return room;
  };

  on('room:create', ({ name, mode }) => {
    if (socket.data.playerId) throw new G.GameError('You are already in a room.');
    if (rooms.size >= MAX_ROOMS) throw new G.GameError('Every room is taken right now. Try again soon.');
    const code = G.makeCode((c) => rooms.has(c));
    const { room, player } = G.createRoom({ code, name, mode });
    rooms.set(code, room);
    seat(socket, room, player);
    sync(room);
    return { code, token: player.token };
  });

  on('room:join', ({ code, name }) => {
    if (socket.data.playerId) throw new G.GameError('You are already in a room.');
    const room = rooms.get(String(code ?? '').trim().toUpperCase());
    if (!room) throw new G.GameError('No room has that code. Check it and try again.');
    const player = G.joinRoom(room, name);
    seat(socket, room, player);
    checkEmpty(room);
    sync(room);
    return { code: room.code, token: player.token };
  });

  // Coming back after a reload or a dropped connection.
  on('room:resume', ({ code, token }) => {
    const room = rooms.get(String(code ?? ''));
    const player = room?.players.find((p) => typeof token === 'string' && p.token === token);
    if (!player) throw new G.GameError('That room has closed.');
    seat(socket, room, player);
    G.setConnected(room, player.id, true);
    if (!room.players.some((p) => p.id === room.hostId && p.connected)) room.hostId = player.id;
    checkEmpty(room);
    sync(room);
    return { code: room.code };
  });

  on('room:mode', ({ mode }) => { const r = seated(); G.setMode(r, socket.data.playerId, mode); sync(r); });
  on('room:bot:add', ({ team }) => { const r = seated(); G.addBot(r, socket.data.playerId, team); sync(r); });
  on('room:bot:remove', ({ botId }) => { const r = seated(); G.removeBot(r, socket.data.playerId, String(botId ?? '')); sync(r); });
  on('room:team', ({ team }) => { const r = seated(); G.setTeam(r, socket.data.playerId, team); sync(r); });
  on('room:settings', ({ topicSet, rounds }) => { const r = seated(); G.setSettings(r, socket.data.playerId, { topicSet, rounds }); sync(r); });
  on('clue:nice', ({ psychicId }) => { const r = seated(); const res = G.niceClue(r, socket.data.playerId, String(psychicId ?? '')); sync(r); return res; });
  on('game:start', () => { const r = seated(); G.startGame(r, socket.data.playerId); sync(r); });
  on('psychic:reroll', () => { const r = seated(); G.rerollSheet(r, socket.data.playerId); sync(r); });
  on('clue:submit', ({ text }) => { const r = seated(); G.submitClue(r, socket.data.playerId, text); sync(r); });
  // Team games: the shared dot. A move goes straight to that team's players (never the rivals),
  // and only a move that unlocks someone needs a full update.
  on('team:move', ({ x, y }) => {
    const r = seated();
    const moved = G.moveTeamMark(r, socket.data.playerId, { x, y });
    for (const p of r.players.filter((pl) => pl.team === moved.team)) io.to(`player:${p.id}`).emit('team:pos', { x: moved.x, y: moved.y, by: socket.data.playerId });
    if (moved.unlocked) sync(r);
  });
  on('team:agree', () => { const r = seated(); const res = G.agreeTeamMark(r, socket.data.playerId); sync(r); return res; });
  on('mark:submit', ({ x, y }) => { const r = seated(); G.submitMark(r, socket.data.playerId, { x, y }); sync(r); });
  on('game:again', () => { const r = seated(); G.playAgain(r, socket.data.playerId); sync(r); });

  on('room:leave', () => {
    const room = seated();
    const id = socket.data.playerId;
    socket.leave(`player:${id}`);
    socket.data.playerId = null;
    socket.data.code = null;
    G.removePlayer(room, id);
    checkEmpty(room);
    if (G.hasPeople(room)) sync(room);
    else deleteRoom(room.code);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.code);
    const id = socket.data.playerId;
    if (!room || !id) return;
    // A second tab may still hold this seat.
    if ((io.sockets.adapter.rooms.get(`player:${id}`)?.size ?? 0) > 0) return;
    G.setConnected(room, id, false);
    checkEmpty(room);
    sync(room);
  });
});

http.listen(PORT, () => console.log(`The Psychic Plane is running on http://localhost:${PORT}`));
