import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as D from './daily.js';
import { scoreFor, GameError } from './engine.js';

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

test('the puzzle never carries the survey numbers', () => {
  for (let day = 1; day <= D.DATA.items.length; day++) {
    const { axes, ...rest } = D.puzzleFor(day);
    assert.deepEqual(axes, { x: D.DATA.scale.liked, y: D.DATA.scale.disliked }); // The same every day.
    const text = JSON.stringify(rest);
    assert.ok(!/liked|disliked|neutral|fame|target|url|"x"|"y"/.test(text), text);
  }
});

test('survey percentages map onto the whole board', () => {
  const data = { ...D.DATA, scale: { liked: [20, 100], disliked: [0, 50] } };
  assert.deepEqual(D.targetOf({ liked: 20, disliked: 0 }, data), { x: -100, y: -100 });
  assert.deepEqual(D.targetOf({ liked: 100, disliked: 50 }, data), { x: 100, y: 100 });
  assert.deepEqual(D.targetOf({ liked: 60, disliked: 25 }, data), { x: 0, y: 0 });
  assert.deepEqual(D.targetOf({ liked: 5, disliked: 80 }, data), { x: -100, y: 100 }); // Clamped to the edge.
});

test('a guess is scored like the main game and against the survey', () => {
  const store = D.createStore();
  const target = D.targetOf(D.itemFor(1));
  const mark = { x: target.x + 20, y: target.y - 10 };
  const r = D.submitGuess(store, 1, P1, mark);
  const expected = scoreFor(mark, target);
  assert.equal(r.you.tier, expected.tier);
  assert.equal(r.you.points, expected.points);
  assert.deepEqual(r.target, target);
  assert.equal(r.survey.liked, D.itemFor(1).liked);
  assert.equal(r.survey.url, D.itemFor(1).url);
  assert.equal(r.text, D.itemFor(1).text);
});

test('one guess per player per day', () => {
  const store = D.createStore();
  D.submitGuess(store, 1, P1, { x: 0, y: 0 });
  assert.throws(() => D.submitGuess(store, 1, P1, { x: 10, y: 10 }), GameError);
  assert.equal(D.resultFor(store, 1, P1).you.x, 0); // The first guess stands.
  assert.doesNotThrow(() => D.submitGuess(store, 2, P1, { x: 10, y: 10 })); // A new day, a new guess.
});

test('the players’ average, count and "better than" share update with each guess', () => {
  const store = D.createStore();
  const t = D.targetOf(D.itemFor(1));
  const first = D.submitGuess(store, 1, P1, { x: t.x, y: t.y });
  assert.equal(first.crowd.count, 1);
  assert.equal(first.beat, null); // Nobody else to beat yet.
  D.submitGuess(store, 1, P2, { x: t.x - 60, y: t.y });
  D.submitGuess(store, 1, P3, { x: t.x - 30, y: t.y });
  const r = D.resultFor(store, 1, P1);
  assert.equal(r.crowd.count, 3);
  assert.equal(r.crowd.x, Math.round(((t.x + t.x - 60 + t.x - 30) / 3) * 10) / 10);
  assert.equal(r.beat, 100);
  assert.equal(D.resultFor(store, 1, P2).beat, 0);
  assert.equal(D.resultFor(store, 1, P3).beat, 50);
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

test('every item in daily-items.json is complete and sourced', () => {
  const { items, board, scale, source, launchDate } = D.DATA;
  assert.ok(items.length >= 7, 'at least a week of polls');
  assert.match(launchDate, /^\d{4}-\d{2}-\d{2}$/);
  for (const side of ['top', 'bottom', 'left', 'right']) assert.ok(board[side]);
  assert.ok(source.name && source.country && source.retrieved);
  assert.ok(scale.liked[0] < scale.liked[1] && scale.disliked[0] < scale.disliked[1]);
  const names = new Set();
  for (const item of items) {
    assert.ok(item.text && !names.has(item.text), `"${item.text}" is named once`);
    names.add(item.text);
    for (const key of ['liked', 'disliked', 'neutral', 'fame']) {
      assert.ok(Number.isInteger(item[key]) && item[key] >= 0 && item[key] <= 100, `${item.text}: ${key}`);
    }
    assert.ok(item.liked + item.disliked + item.neutral <= 100, `${item.text}: shares add up to at most 100`);
    assert.match(item.url, /^https:\/\/yougov\.com\//, `${item.text}: source page`);
  }
});
