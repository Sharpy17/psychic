// The Daily Poll: one item a day, the same for everyone, on a board from the main game.
// "Guess your friends' mind" becomes "guess the people's mind": the answer is the crowd's dot,
// the middle of every guess mailed today (the median on each axis, so a few joke guesses in a
// corner can't drag it away). The day starts with one dot of the paper's own (item.start),
// counted as a guess. Each guess is scored against the crowd's dot as it stood the moment before
// it was mailed, so nobody pulls the answer toward themselves; the next day the reply also shows
// where the dot finished and a final score against that. Like engine.js: rules, no networking.
//
// The crowd's dot for today never leaves the server until that player has mailed a guess.

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { scoreFor, GameError } from './engine.js';
import { CARD_BY_ID } from './cards.js';

export const DATA = JSON.parse(readFileSync(new URL('./daily-items.json', import.meta.url), 'utf8'));
for (const item of DATA.items) if (!CARD_BY_ID[item.card]) throw new Error(`daily-items.json: "${item.text}" has no card "${item.card}".`);
export const DEFAULT_TZ = 'Asia/Bishkek';
const DAY_MS = 86_400_000;
const MAX_GUESSES = 100_000; // A day's tally stops growing here, as a cap against floods.
const TRAIL_POINTS = 32; // How many stops of the dot's road the recap draws.
const PLAYER_ID = /^[A-Za-z0-9_-]{8,64}$/;

const refuse = (message) => { throw new GameError(message); };
const clampChart = (v) => Math.max(-100, Math.min(100, v));
const round1 = (n) => Math.round(n * 10) / 10;
const point = (p) => ({ x: round1(p.x), y: round1(p.y) });
const gap = (a, b) => round1(Math.hypot(a.x - b.x, a.y - b.y));

/* Days ------------------------------------------------------------------- */

// The calendar date ("2026-11-09") in a time zone.
export function dateIn(now, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// Poll No. 1 is the launch date; the number goes up by one at each midnight in the time zone.
export function dayNumber(now, tz = DEFAULT_TZ, launchDate = DATA.launchDate) {
  const today = Date.parse(`${dateIn(now, tz)}T00:00:00Z`);
  return Math.round((today - Date.parse(`${launchDate}T00:00:00Z`)) / DAY_MS) + 1;
}

// Milliseconds until the next midnight in the time zone.
export function msUntilNextDay(now, tz = DEFAULT_TZ) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, Number(p.value)]));
  const sinceMidnight = ((parts.hour * 60 + parts.minute) * 60 + parts.second) * 1000 + (now.valueOf() % 1000);
  return DAY_MS - sinceMidnight;
}

/* Items ------------------------------------------------------------------ */

export function itemFor(day, data = DATA) {
  const n = data.items.length;
  return data.items[(((day - 1) % n) + n) % n];
}

// What a player sees before guessing: the item and the board, and no dots.
export function puzzleFor(day, data = DATA) {
  const item = itemFor(day, data);
  return { day, text: item.text, board: { ...CARD_BY_ID[item.card] } };
}

/* The crowd's dot -------------------------------------------------------- */

export function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// The middle of the day's start dot and every guess so far.
export function crowdOf(start, guesses) {
  const all = [start, ...guesses];
  return point({ x: median(all.map((g) => g.x)), y: median(all.map((g) => g.y)) });
}

/* Guesses ---------------------------------------------------------------- */

// Each day's guesses are kept in memory and, when dir is given, saved to dir/crowd-<n>.json.
export function createStore(dir = null) {
  if (dir) mkdirSync(dir, { recursive: true });
  return { dir, days: new Map() };
}

function fileOf(store, day) { return join(store.dir, `crowd-${day}.json`); }

function tallyOf(store, day, data) {
  let tally = store.days.get(day);
  if (!tally) {
    tally = { guesses: [] };
    if (store.dir) {
      try {
        const saved = JSON.parse(readFileSync(fileOf(store, day), 'utf8'));
        if (Array.isArray(saved.guesses)) tally = saved;
      } catch { /* No guesses saved for this day yet. */ }
    }
    tally.byPlayer = new Map(tally.guesses.map((g) => [g.player, g]));
    store.days.set(day, tally);
    for (const d of store.days.keys()) if (Math.abs(d - day) > 2) store.days.delete(d); // Only today and yesterday matter.
  }
  if (tally.cached?.count !== tally.guesses.length) {
    tally.cached = { count: tally.guesses.length, crowd: crowdOf(itemFor(day, data).start, tally.guesses) };
  }
  return tally;
}

function save(store, day, tally) {
  if (!store.dir) return;
  const file = fileOf(store, day);
  writeFileSync(`${file}.tmp`, JSON.stringify({ guesses: tally.guesses }));
  renameSync(`${file}.tmp`, file); // Whole-file swap, so a crash never leaves half a file.
}

function checkPlayer(playerId) {
  if (typeof playerId !== 'string' || !PLAYER_ID.test(playerId)) refuse('This browser has no player id. Reload the page.');
}

function scored(mark, target) {
  const s = scoreFor(mark, target);
  return { distance: round1(s.distance), tier: s.tier, points: s.points };
}

export function submitGuess(store, day, playerId, mark, { data = DATA, now = Date.now() } = {}) {
  checkPlayer(playerId);
  const x = Number(mark?.x), y = Number(mark?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) refuse('That guess is not on the board.');
  const tally = tallyOf(store, day, data);
  if (tally.byPlayer.has(playerId)) refuse('You already mailed today’s guess. A new poll comes out at midnight.');
  if (tally.guesses.length >= MAX_GUESSES) refuse('The mailbag is full today. Try again tomorrow.');
  const guess = { player: playerId, x: round1(clampChart(x)), y: round1(clampChart(y)), at: now };
  const before = tally.cached.crowd;
  Object.assign(guess, { before }, scored(guess, before));
  tally.guesses.push(guess);
  tally.byPlayer.set(playerId, guess);
  guess.after = tallyOf(store, day, data).cached.crowd; // Your own pull on the dot, kept apart from later ones.
  save(store, day, tally);
  return resultFor(store, day, playerId, { data });
}

// The reply, for a player who has guessed today; null for one who hasn't.
//   you:   your pin, scored against the dot as it stood when you mailed it (then)
//   after: the dot just after your guess joined it; since: how many guesses came after yours
//   crowd: where the dot is now, and how many guesses are in it; live: your distance to it now
//   beat:  the share of today's other players whose pin is further from the dot now than yours
export function resultFor(store, day, playerId, { data = DATA } = {}) {
  if (typeof playerId !== 'string') return null;
  const tally = tallyOf(store, day, data);
  const mine = tally.byPlayer.get(playerId);
  if (!mine) return null;
  const crowd = tally.cached.crowd;
  const others = tally.guesses.filter((g) => g !== mine);
  const myGap = gap(mine, crowd);
  return {
    ...puzzleFor(day, data),
    you: { x: mine.x, y: mine.y, distance: mine.distance, tier: mine.tier, points: mine.points },
    then: { ...mine.before },
    after: { ...(mine.after ?? mine.before) },
    since: tally.guesses.length - 1 - tally.guesses.indexOf(mine),
    crowd: { ...crowd, count: tally.guesses.length },
    live: scored(mine, crowd),
    beat: others.length ? Math.round((100 * others.filter((g) => gap(g, crowd) > myGap).length) / others.length) : null,
  };
}

// A finished poll (yesterday's), shown above today's: where the dot started and finished, the
// road between (sampled from the dot as each guess found it) and, for a player who took part,
// a final score against the finished dot. null before the first poll.
export function recapFor(store, day, playerId, { data = DATA } = {}) {
  if (day < 1) return null;
  const tally = tallyOf(store, day, data);
  const start = point(itemFor(day, data).start);
  const end = tally.cached.crowd;
  const stops = tally.guesses.map((g) => g.before ?? start);
  const step = Math.max(1, stops.length / TRAIL_POINTS);
  const trail = [];
  for (let i = 0; i < stops.length; i += step) trail.push(point(stops[Math.floor(i)]));
  if (!trail.length) trail.push(start);
  trail.push(end);
  const mine = typeof playerId === 'string' ? tally.byPlayer.get(playerId) : null;
  return {
    ...puzzleFor(day, data),
    start, end, trail,
    count: tally.guesses.length,
    moved: gap(start, end),
    you: mine ? {
      x: mine.x, y: mine.y,
      then: { ...(mine.before ?? start) },
      first: { distance: mine.distance, tier: mine.tier, points: mine.points },
      final: scored(mine, end),
      movedSince: gap(mine.after ?? mine.before ?? start, end), // Moved by the guesses after yours.
    } : null,
  };
}
