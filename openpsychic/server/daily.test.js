import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as D from './daily.js';
import { scoreFor, GameError } from './engine.js';
import { CARD_BY_ID } from './cards.js';

const P1 = 'player-one-0001';
const P2 = 'player-two-0002';
const P3 = 'player-three-03';
const at = (iso) => new Date(iso);

test('the poll number goes up at midnight in the chosen time zone', () => {
  // Bishkek is UTC+6, so its midnight is 18:00 UTC the day before.
  assert.equal(D.dayNumber(at('2026-11-08T17:59:59Z'), 'Asia/Bishkek', '2026-11-09'), 0);
  assert.equal(D.dayNumber(at('2026-11-08T18:00:00Z'), 'Asia/Bishkek', '2026-11-09'), 1);
  assert.equal(D.dayNumber(at('2026-11-09T17:59:59Z'), 'Asia/Bishkek', '2026-11-09'), 1);
  assert.equal(D.dayNumber(at('2026-11-09T18:00:00Z'), 'Asia/Bishkek', '2026-11-09'), 2);
  assert.equal(D.dayNumber(at('2026-11-09T12:00:00Z'), 'UTC', '2026-11-09'), 1);
  assert.equal(D.dayNumber(at('2026-12-09T12:00:00Z'), 'UTC', '2026-11-09'), 31);
});

test('the time until the next poll counts down to midnight in the time zone', () => {
  assert.equal(D.msUntilNextDay(at('2026-11-09T17:00:00Z'), 'Asia/Bishkek'), 3_600_000);
  assert.equal(D.msUntilNextDay(at('2026-11-09T00:00:00Z'), 'UTC'), 86_400_000);
});

test('items run in order and wrap around after the last', () => {
  const n = D.DATA.items.length;
  assert.equal(D.itemFor(1), D.DATA.items[0]);
  assert.equal(D.itemFor(2), D.DATA.items[1]);
  assert.equal(D.itemFor(n + 1), D.DATA.items[0]);
  assert.equal(D.itemFor(0), D.DATA.items[n - 1]); // The day before launch still has an item.
});

const start = (day) => D.itemFor(day).start;

test('the puzzle is the item and a board from the main game, and no dots', () => {
  for (let day = 1; day <= D.DATA.items.length; day++) {
    const p = D.puzzleFor(day);
    assert.deepEqual(Object.keys(p).sort(), ['board', 'day', 'text']);
    assert.deepEqual(p.board, CARD_BY_ID[D.itemFor(day).card]);
  }
});

test('the crowd’s dot is the middle of the start dot and every guess, axis by axis', () => {
  assert.equal(D.median([3, 1, 2]), 2);
  assert.equal(D.median([4, 1, 2, 3]), 2.5);
  assert.deepEqual(D.crowdOf({ x: 0, y: 0 }, []), { x: 0, y: 0 });
  assert.deepEqual(D.crowdOf({ x: 0, y: 0 }, [{ x: 40, y: -20 }]), { x: 20, y: -10 });
  // One joke guess in the corner barely moves it.
  assert.deepEqual(D.crowdOf({ x: 0, y: 0 }, [{ x: 10, y: 10 }, { x: 12, y: 8 }, { x: 100, y: -100 }]), { x: 11, y: 4 });
});

test('a guess is scored like the main game, against the dot as it stood before it', () => {
  const store = D.createStore();
  const s = start(1);
  const mark = { x: s.x + 20, y: s.y - 10 };
  const r = D.submitGuess(store, 1, P1, mark);
  const expected = scoreFor(mark, s);
  assert.equal(r.you.tier, expected.tier);
  assert.equal(r.you.points, expected.points);
  assert.deepEqual(r.then, s);
  assert.deepEqual([r.crowd.x, r.crowd.y], [s.x + 10, s.y - 5]); // Now halfway between the two.
  assert.equal(r.crowd.count, 1);
  assert.equal(r.text, D.itemFor(1).text);
  // The next player is scored against that new dot, not the start.
  const r2 = D.submitGuess(store, 1, P2, { x: s.x + 10, y: s.y - 5 });
  assert.deepEqual(r2.then, { x: s.x + 10, y: s.y - 5 });
  assert.equal(r2.you.tier, 'Bullseye');
});

test('one guess per player per day', () => {
  const store = D.createStore();
  D.submitGuess(store, 1, P1, { x: 0, y: 0 });
  assert.throws(() => D.submitGuess(store, 1, P1, { x: 10, y: 10 }), GameError);
  assert.equal(D.resultFor(store, 1, P1).you.x, 0); // The first guess stands.
  assert.doesNotThrow(() => D.submitGuess(store, 2, P1, { x: 10, y: 10 })); // A new day, a new guess.
});

test('the dot, the live distance and the "better than" share move as guesses come in', () => {
  const store = D.createStore();
  const s = start(1);
  const first = D.submitGuess(store, 1, P1, { x: s.x, y: s.y });
  assert.equal(first.beat, null); // Nobody else to beat yet.
  D.submitGuess(store, 1, P2, { x: s.x - 60, y: s.y });
  D.submitGuess(store, 1, P3, { x: s.x - 30, y: s.y });
  const r = D.resultFor(store, 1, P1);
  assert.equal(r.crowd.count, 3);
  assert.deepEqual([r.crowd.x, r.crowd.y], [s.x - 15, s.y]); // Middle of s, s, s-30, s-60.
  assert.equal(r.live.distance, 15);
  assert.equal(r.you.distance, 0); // The score from the moment it was mailed stands.
  assert.equal(r.beat, 50); // P3 (15 away) ties, P2 (45 away) is further.
  assert.equal(D.resultFor(store, 1, P2).beat, 0);
});

test('someone who has not guessed gets no result', () => {
  const store = D.createStore();
  D.submitGuess(store, 1, P1, { x: 0, y: 0 });
  assert.equal(D.resultFor(store, 1, P2), null);
  assert.equal(D.resultFor(store, 1, null), null);
});

test('bad guesses and missing player ids are refused, and wild marks are clamped', () => {
  const store = D.createStore();
  assert.throws(() => D.submitGuess(store, 1, '', { x: 0, y: 0 }), GameError);
  assert.throws(() => D.submitGuess(store, 1, 'short', { x: 0, y: 0 }), GameError);
  assert.throws(() => D.submitGuess(store, 1, 'has spaces in it!', { x: 0, y: 0 }), GameError);
  assert.throws(() => D.submitGuess(store, 1, P1, { x: 'left', y: 0 }), GameError);
  assert.throws(() => D.submitGuess(store, 1, P1, null), GameError);
  const r = D.submitGuess(store, 1, P1, { x: 900, y: -900 });
  assert.deepEqual([r.you.x, r.you.y], [100, -100]);
});

test('yesterday’s recap: where the dot started and finished, its road, and a final score', () => {
  const store = D.createStore();
  const s = start(4);
  D.submitGuess(store, 4, P1, { x: s.x + 40, y: s.y });
  D.submitGuess(store, 4, P2, { x: s.x + 40, y: s.y });
  D.submitGuess(store, 4, P3, { x: s.x + 40, y: s.y });
  const r = D.recapFor(store, 4, P1);
  assert.equal(r.text, D.itemFor(4).text);
  assert.deepEqual(r.start, s);
  assert.deepEqual(r.end, { x: s.x + 40, y: s.y });
  assert.equal(r.moved, 40);
  assert.equal(r.count, 3);
  assert.deepEqual(r.trail[0], s);
  assert.deepEqual(r.trail.at(-1), r.end);
  assert.deepEqual(r.you.then, s);
  assert.equal(r.you.movedSince, 20); // Your own pull (halfway, to s+20) doesn't count.
  assert.equal(r.you.final.tier, 'Bullseye');
  assert.equal(D.recapFor(store, 4, 'someone-else-9').you, null);
  assert.equal(D.recapFor(store, 0, P1), null); // No poll before the first.
  // A quiet day: the dot never left the start.
  assert.deepEqual(D.recapFor(store, 5, P1).trail, [start(5), start(5)]);
});

test('a long day’s road is cut down to a few dozen stops', () => {
  const store = D.createStore();
  for (let i = 0; i < 500; i++) D.submitGuess(store, 1, `player-${String(i).padStart(6, '0')}`, { x: i % 100, y: -(i % 50) });
  const r = D.recapFor(store, 1, null);
  assert.ok(r.trail.length <= 34, `${r.trail.length} stops`);
});

test('guesses are saved and come back after a restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pp-daily-'));
  try {
    D.submitGuess(D.createStore(dir), 3, P1, { x: 12, y: -34 });
    const reopened = D.createStore(dir);
    assert.deepEqual([D.resultFor(reopened, 3, P1).you.x, D.resultFor(reopened, 3, P1).you.y], [12, -34]);
    assert.throws(() => D.submitGuess(reopened, 3, P1, { x: 0, y: 0 }), GameError);
    assert.equal(D.submitGuess(reopened, 3, P2, { x: 0, y: 0 }).crowd.count, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('every item in daily-items.json has a name, a real board and a start dot', () => {
  const { items, launchDate } = D.DATA;
  assert.ok(items.length >= 7, 'at least a week of polls');
  assert.match(launchDate, /^\d{4}-\d{2}-\d{2}$/);
  const names = new Set();
  for (const item of items) {
    assert.ok(item.text && !names.has(item.text), `"${item.text}" is named once`);
    names.add(item.text);
    assert.ok(CARD_BY_ID[item.card], `${item.text}: card`);
    for (const k of ['x', 'y']) assert.ok(Math.abs(item.start[k]) <= 100, `${item.text}: start.${k}`);
  }
});

test('your own pull on the dot is kept apart from the guesses after yours', () => {
  const store = D.createStore();
  const s = start(1);
  const r = D.submitGuess(store, 1, P1, { x: s.x + 40, y: s.y });
  assert.equal(r.since, 0);
  assert.deepEqual(r.after, { x: r.crowd.x, y: r.crowd.y }); // Nobody since: the dot is where you left it.
  D.submitGuess(store, 1, P2, { x: s.x - 40, y: s.y });
  const later = D.resultFor(store, 1, P1);
  assert.equal(later.since, 1);
  assert.deepEqual(later.after, r.after);
  assert.notDeepEqual([later.crowd.x, later.crowd.y], [r.after.x, r.after.y]);
});
