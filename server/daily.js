// The Daily Poll: one item a day, the same for everyone. You guess where people put it on the
// board; the answer is real survey data (daily-items.json), and the reply also shows where
// today's players guessed on average. Like engine.js, this file has the rules and no networking.
//
// The rule that matters most here too: the survey numbers for today's item never leave the
// server until that player has mailed a guess. puzzleFor() is all a player sees before then.

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { scoreFor, GameError } from './engine.js';

export const DATA = JSON.parse(readFileSync(new URL('./daily-items.json', import.meta.url), 'utf8'));
export const DEFAULT_TZ = 'Asia/Bishkek';
const DAY_MS = 86_400_000;
const MAX_GUESSES = 100_000; // A day's tally stops growing here, as a cap against floods.
const PLAYER_ID = /^[A-Za-z0-9_-]{8,64}$/;

const refuse = (message) => { throw new GameError(message); };
const clampChart = (v) => Math.max(-100, Math.min(100, v));
const round1 = (n) => Math.round(n * 10) / 10;

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

// Survey percentages to the game's chart (-100..100, y up). Each axis has its own range
// (data.scale) so the items spread across the whole board instead of bunching up.
const toAxis = (pct, [lo, hi]) => round1(clampChart(((pct - lo) / (hi - lo)) * 200 - 100));
export function targetOf(item, data = DATA) {
  return { x: toAxis(item.liked, data.scale.liked), y: toAxis(item.disliked, data.scale.disliked) };
}

// What a player sees before guessing: the item and the board, and no numbers.
export function puzzleFor(day, data = DATA) {
  const item = itemFor(day, data);
  return {
    day,
    text: item.text,
    board: { ...data.board },
    // The percentage range each edge of the board stands for, for the chart's tick labels.
    axes: { x: [...data.scale.liked], y: [...data.scale.disliked] },
    source: { name: data.source.name, country: data.source.country },
  };
}

/* Guesses ---------------------------------------------------------------- */

// Each day's guesses are kept in memory and, when dir is given, saved to dir/day-<n>.json.
export function createStore(dir = null) {
  if (dir) mkdirSync(dir, { recursive: true });
  return { dir, days: new Map() };
}

function fileOf(store, day) { return join(store.dir, `day-${day}.json`); }

function tallyOf(store, day) {
  let tally = store.days.get(day);
  if (tally) return tally;
  tally = { guesses: [] };
  if (store.dir) {
    try {
      const saved = JSON.parse(readFileSync(fileOf(store, day), 'utf8'));
      if (Array.isArray(saved.guesses)) tally = saved;
    } catch { /* No guesses saved for this day yet. */ }
  }
  tally.byPlayer = new Map(tally.guesses.map((g) => [g.player, g]));
  store.days.set(day, tally);
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

export function submitGuess(store, day, playerId, mark, { data = DATA, now = Date.now() } = {}) {
  checkPlayer(playerId);
  const x = Number(mark?.x), y = Number(mark?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) refuse('That guess is not on the board.');
  const tally = tallyOf(store, day);
  if (tally.byPlayer.has(playerId)) refuse('You already mailed today’s guess. A new poll comes out at midnight.');
  if (tally.guesses.length >= MAX_GUESSES) refuse('The mailbag is full today. Try again tomorrow.');
  const guess = { player: playerId, x: round1(clampChart(x)), y: round1(clampChart(y)), at: now };
  const score = scoreFor(guess, targetOf(itemFor(day, data), data));
  Object.assign(guess, { distance: round1(score.distance), tier: score.tier, points: score.points });
  tally.guesses.push(guess);
  tally.byPlayer.set(playerId, guess);
  save(store, day, tally);
  return resultFor(store, day, playerId, { data });
}

// The reply, for a player who has guessed today; null for one who hasn't.
export function resultFor(store, day, playerId, { data = DATA } = {}) {
  if (typeof playerId !== 'string') return null;
  const tally = tallyOf(store, day);
  const mine = tally.byPlayer.get(playerId);
  if (!mine) return null;
  const item = itemFor(day, data);
  const all = tally.guesses;
  const others = all.filter((g) => g !== mine);
  const average = (key) => round1(all.reduce((sum, g) => sum + g[key], 0) / all.length);
  return {
    ...puzzleFor(day, data),
    target: targetOf(item, data),
    survey: {
      liked: item.liked, disliked: item.disliked, neutral: item.neutral, fame: item.fame,
      url: item.url, name: data.source.name, country: data.source.country, retrieved: data.source.retrieved,
    },
    you: { x: mine.x, y: mine.y, distance: mine.distance, tier: mine.tier, points: mine.points },
    crowd: { x: average('x'), y: average('y'), count: all.length },
    // The share of today's other players whose guess landed further from the survey than yours.
    beat: others.length ? Math.round((100 * others.filter((g) => g.distance > mine.distance).length) / others.length) : null,
  };
}
