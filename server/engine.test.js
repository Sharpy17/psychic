import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from './engine.js';

// A room with players, returning { room, ids } where ids[0] is the host.
function setup(mode, names) {
  const { room, player } = G.createRoom({ code: 'TEST', name: names[0], mode });
  const ids = [player.id, ...names.slice(1).map((n) => G.joinRoom(room, n).id)];
  return { room, ids };
}
const writers = (room) => room.rounds[room.roundIndex].sheets.flatMap((s) => s.writers);
const guessers = (room) => room.rounds[room.roundIndex].sheets.flatMap((s) => s.guessers);
const sheetOf = (room, id) => room.rounds[room.roundIndex].sheets.find((s) => s.guessers.includes(id));

// Plays one round; `markFor` picks each guesser's mark.
function playRound(room, markFor = () => ({ x: 0, y: 0 })) {
  writers(room).forEach((id) => G.submitClue(room, id, `clue from ${id}`));
  guessers(room).forEach((id) => G.submitMark(room, id, markFor(id, sheetOf(room, id))));
}
const playGame = (room, markFor) => { for (let i = 0; i < G.ROUNDS; i++) playRound(room, markFor); };

test('scoring matches the published tiers, and a distance on a limit earns that tier', () => {
  const at = (x) => G.scoreFor({ x, y: 0 }, { x: 0, y: 0 });
  assert.equal(at(0).points, 1000);
  assert.equal(at(15).points, 1000);
  assert.equal(at(15.1).points, 750);
  assert.equal(at(35).points, 750);
  assert.equal(at(60).points, 500);
  assert.equal(at(90).points, 250);
  assert.equal(at(91).points, 50);
  assert.equal(at(91).tier, 'Miss');
});

test('start rules for each mode', () => {
  assert.match(G.startProblem(setup('duel', ['A']).room), /exactly 2/);
  assert.equal(G.startProblem(setup('duel', ['A', 'B']).room), null);
  assert.match(G.startProblem(setup('free', ['A', 'B']).room), /at least 3/);
  assert.equal(G.startProblem(setup('free', ['A', 'B', 'C']).room), null);
  assert.match(G.startProblem(setup('teams', ['A', 'B', 'C']).room), /at least 4/);
  assert.equal(G.startProblem(setup('teams', ['A', 'B', 'C', 'D']).room), null);

  const { room, ids } = setup('teams', ['A', 'B', 'C', 'D']);
  ids.forEach((id) => G.setTeam(room, id, 'lions'));
  assert.match(G.startProblem(room), /Tigers need at least 2/);
  assert.throws(() => G.startGame(room, ids[0]), G.GameError);
});

test('room limits, names and permissions', () => {
  const duel = setup('duel', ['A', 'B']);
  assert.throws(() => G.joinRoom(duel.room, 'C'), /full/);
  const free = setup('free', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  assert.throws(() => G.joinRoom(free.room, 'I'), /full/);
  const teams = setup('teams', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
  assert.equal(teams.room.players.length, 10);
  assert.equal(teams.room.players.filter((p) => p.team === 'lions').length, 5);
  assert.throws(() => G.joinRoom(setup('free', ['Sam']).room, 'sam'), /already has that name/);
  assert.throws(() => G.cleanName('   '), /name/);
  assert.equal(G.cleanName('x'.repeat(40)).length, G.MAX_NAME);

  const { room, ids } = setup('free', ['A', 'B', 'C']);
  assert.throws(() => G.startGame(room, ids[1]), /Only the host/);
  G.startGame(room, ids[0]);
  assert.throws(() => G.joinRoom(room, 'Late'), /already started/);
});

test('nothing secret reaches a player before the reply', () => {
  for (const [mode, names] of [['free', ['A', 'B', 'C']], ['teams', ['A', 'B', 'C', 'D', 'E']], ['duel', ['A', 'B']]]) {
    const { room, ids } = setup(mode, names);
    G.startGame(room, ids[0]);
    for (let r = 0; r < G.ROUNDS; r++) {
      const round = room.rounds[room.roundIndex];
      const everyView = () => ids.map((id) => ({ id, json: JSON.stringify(G.viewFor(room, id)) }));

      // No view carries a token, a random source or the room's raw rounds.
      everyView().forEach(({ json }) => assert.ok(!json.includes('token') && !json.includes('"rounds":[{')));

      // Writing: only a sheet's writers can see its target, and nobody sees another's clue.
      ids.forEach((id) => {
        const task = G.viewFor(room, id).task;
        const mine = round.sheets.find((s) => s.writers.includes(id));
        if (mine) assert.deepEqual(task.target, mine.target);
        else assert.equal(task.target, undefined);
      });
      const [firstWriter, ...restWriters] = writers(room);
      G.submitClue(room, firstWriter, 'SECRETCLUE');
      if (room.phase === 'WRITING') {
        ids.filter((id) => id !== firstWriter).forEach((id) => {
          assert.ok(!JSON.stringify(G.viewFor(room, id)).includes('SECRETCLUE'), `${mode}: clue leaked before all clues were in`);
        });
      }
      restWriters.forEach((id) => G.submitClue(room, id, `other ${id}`));
      assert.equal(room.phase, 'MARKING');

      // Marking: guessers see no target, and nobody sees anyone else's mark.
      ids.forEach((id) => {
        const task = G.viewFor(room, id).task;
        if (guessers(room).includes(id)) assert.equal(task.target, undefined);
      });
      const [firstGuesser, ...others] = guessers(room);
      // A unique mark each round, because a player's view rightly lists their own earlier marks.
      const secretMark = { x: 37 + r, y: -41 - r };
      G.submitMark(room, firstGuesser, secretMark);
      if (room.phase === 'MARKING') {
        ids.filter((id) => id !== firstGuesser).forEach((id) => {
          const json = JSON.stringify(G.viewFor(room, id));
          assert.ok(!json.includes(`"x":${secretMark.x},"y":${secretMark.y}`), `${mode}: mark leaked`);
          assert.equal(G.viewFor(room, id).reply, null);
        });
      }
      others.forEach((id) => { if (room.phase === 'MARKING' && room.roundIndex === r) G.submitMark(room, id, { x: 0, y: 0 }); });
    }
    assert.equal(room.phase, 'REPLY');
    assert.ok(G.viewFor(room, ids[0]).reply);
  }
});

test('free for all: psychics are random, and nobody repeats until all have gone', () => {
  const names = ['A', 'B', 'C', 'D'];
  const { room, ids } = setup('free', names);
  G.startGame(room, ids[0]);
  const seen = [];
  for (let r = 0; r < G.ROUNDS; r++) {
    assert.equal(writers(room).length, 1);
    seen.push(writers(room)[0]);
    playRound(room);
  }
  assert.equal(new Set(seen).size, 4);
});

test('free for all: the psychic earns the average, and ties are shared', () => {
  const { room, ids } = setup('free', ['A', 'B', 'C']);
  G.startGame(room, ids[0]);
  playGame(room, (id, sheet) => (id === ids[0] ? sheet.target : { x: Math.max(-100, sheet.target.x - 100), y: sheet.target.y > 0 ? -100 : 100 }));
  const { reply } = room;
  reply.sheets.forEach((s) => {
    const avg = Math.round(s.marks.reduce((t, m) => t + m.points, 0) / s.marks.length);
    assert.equal(s.clues[0].points, avg);
  });
  reply.standings.forEach((row) => assert.equal(row.total, row.perRound.reduce((a, b) => a + b, 0)));

  // Three identical results share the ticket.
  const tie = setup('free', ['A', 'B', 'C']);
  G.startGame(tie.room, tie.ids[0]);
  playGame(tie.room, (id, sheet) => sheet.target);
  assert.equal(tie.room.reply.winners.length, 3);
});

test('head to head: both write and both guess the other, on separate targets', () => {
  const { room, ids } = setup('duel', ['A', 'B']);
  G.startGame(room, ids[0]);
  const [s0, s1] = room.rounds[0].sheets;
  assert.deepEqual([s0.writers, s0.guessers], [[ids[0]], [ids[1]]]);
  assert.deepEqual([s1.writers, s1.guessers], [[ids[1]], [ids[0]]]);

  // The first clue doesn't move the game on, and the second opens marking for both.
  G.submitClue(room, ids[0], 'first');
  assert.equal(room.phase, 'WRITING');
  G.submitClue(room, ids[1], 'second');
  assert.equal(room.phase, 'MARKING');
  assert.equal(G.viewFor(room, ids[1]).task.clues[0].text, 'first');
  assert.equal(G.viewFor(room, ids[0]).task.clues[0].text, 'second');
  assert.deepEqual(G.viewFor(room, ids[1]).task.card, s0.card);
  G.submitMark(room, ids[0], s1.target);
  G.submitMark(room, ids[1], { x: s0.target.x, y: s0.target.y });
  for (let i = 1; i < G.ROUNDS; i++) playRound(room, (id, sheet) => (id === ids[0] ? sheet.target : { x: sheet.target.x > 0 ? -100 : 100, y: sheet.target.y > 0 ? -100 : 100 }));

  // You score only for your own guess, so the better guesser wins outright.
  const { reply } = room;
  assert.deepEqual(reply.winners, [ids[0]]);
  assert.equal(reply.standings[0].total, 4000);
  assert.ok(reply.sheets.every((s) => s.clues.every((c) => c.points === null)));
});

test('head to head: a level score goes to the lower total distance, then is shared', () => {
  const { room, ids } = setup('duel', ['A', 'B']);
  G.startGame(room, ids[0]);
  // Both always land in the Bullseye ring, but A is closer.
  playGame(room, (id, sheet) => {
    const off = id === ids[0] ? 1 : 10;
    return { x: sheet.target.x + off, y: sheet.target.y };
  });
  assert.equal(room.reply.standings[0].total, room.reply.standings[1].total);
  assert.deepEqual(room.reply.winners, [ids[0]]);
  assert.equal(room.reply.decidedOnDistance, true);

  const even = setup('duel', ['A', 'B']);
  G.startGame(even.room, even.ids[0]);
  playGame(even.room, (id, sheet) => sheet.target);
  assert.equal(even.room.reply.winners.length, 2);
});

test('teams: one shared target, a psychic each, both clues visible, scored by average', () => {
  const { room, ids } = setup('teams', ['A', 'B', 'C', 'D', 'E', 'F', 'G']); // 4 lions, 3 tigers
  G.startGame(room, ids[0]);
  const round = room.rounds[0];
  assert.equal(round.sheets.length, 1);
  const team = (id) => room.players.find((p) => p.id === id).team;
  const [w1, w2] = round.sheets[0].writers;
  assert.notEqual(team(w1), team(w2));

  // Both psychics see the same target.
  assert.deepEqual(G.viewFor(room, w1).task.target, G.viewFor(room, w2).task.target);

  G.submitClue(room, w1, 'in joke one');
  G.submitClue(room, w2, 'in joke two');
  const guesser = round.sheets[0].guessers[0];
  const clues = G.viewFor(room, guesser).task.clues.map((c) => c.text).sort();
  assert.deepEqual(clues, ['in joke one', 'in joke two']);

  // Lions all hit, and tigers split one hit and one miss: the bigger team has no edge.
  const tigers = () => room.rounds[room.roundIndex].sheets[0].guessers.filter((id) => team(id) === 'tigers');
  const mark = (id, sheet) => {
    if (team(id) === 'lions' || tigers()[0] === id) return sheet.target;
    return { x: sheet.target.x > 0 ? -100 : 100, y: sheet.target.y > 0 ? -100 : 100 };
  };
  guessersMark(room, mark);
  for (let i = 1; i < G.ROUNDS; i++) playRound(room, mark);

  const { reply } = room;
  const lions = reply.standings.find((s) => s.id === 'lions');
  const tigerRow = reply.standings.find((s) => s.id === 'tigers');
  assert.equal(lions.total, 4000);
  assert.equal(tigerRow.total, 4 * Math.round((1000 + 50) / 2));
  assert.deepEqual(reply.winners, ['lions']);
  assert.equal(lions.members.length, 4);
});
function guessersMark(room, markFor) {
  guessers(room).forEach((id) => G.submitMark(room, id, markFor(id, sheetOf(room, id))));
}

test('the psychic in teams rotates within each team, with no repeats', () => {
  const { room, ids } = setup('teams', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
  G.startGame(room, ids[0]);
  const byTeam = { lions: [], tigers: [] };
  for (let r = 0; r < G.ROUNDS; r++) {
    writers(room).forEach((id) => byTeam[room.players.find((p) => p.id === id).team].push(id));
    playRound(room);
  }
  assert.equal(new Set(byTeam.lions).size, 4);
  assert.equal(new Set(byTeam.tigers).size, 4);
});

test('bad input is refused and marks are clamped', () => {
  const { room, ids } = setup('free', ['A', 'B', 'C']);
  G.startGame(room, ids[0]);
  const [w] = writers(room);
  const g = guessers(room)[0];
  assert.throws(() => G.submitClue(room, g, 'not my turn'), /not the psychic/);
  assert.throws(() => G.submitClue(room, w, '   '), /Write a clue/);
  assert.throws(() => G.submitClue(room, w, 'x'.repeat(G.MAX_CLUE + 1)), /Keep your clue/);
  assert.throws(() => G.submitMark(room, g, { x: 0, y: 0 }), /not time/);
  G.submitClue(room, w, 'ok');
  assert.throws(() => G.submitClue(room, w, 'again'), /not time/);
  assert.throws(() => G.submitMark(room, w, { x: 0, y: 0 }), /not guessing/);
  assert.throws(() => G.submitMark(room, g, { x: 'NaN', y: 1 }), /not on the board/);
  G.submitMark(room, g, { x: 9999, y: -9999 });
  assert.deepEqual(sheetOf(room, g).marks[g], { x: 100, y: -100 });
  assert.throws(() => G.submitMark(room, g, { x: 1, y: 1 }), /already sealed/);
});

test('timers move the game on, and a missing mark scores nothing', () => {
  const { room, ids } = setup('free', ['A', 'B', 'C']);
  G.startGame(room, ids[0], 1000);
  assert.equal(G.viewFor(room, ids[0], 1000).msLeft, G.WRITE_MS);
  G.expire(room, 2000);
  assert.equal(room.phase, 'MARKING');
  G.expire(room, 3000);
  assert.equal(room.phase, 'WRITING');
  assert.equal(room.roundIndex, 1);
  for (let i = 0; i < 3; i++) { G.expire(room); G.expire(room); }
  assert.equal(room.phase, 'REPLY');
  const { sheets } = room.reply;
  assert.equal(sheets[0].clues[0].text, null);
  assert.equal(sheets[0].marks[0].tier, 'No mark');
  assert.equal(sheets[0].marks[0].points, 0);
});

test('a player who drops never holds up the room, and the host moves on', () => {
  const { room, ids } = setup('free', ['A', 'B', 'C']);
  G.startGame(room, ids[0]);
  G.setConnected(room, ids[0], false);
  assert.notEqual(room.hostId, ids[0]);
  if (writers(room)[0] === ids[0]) assert.equal(room.phase, 'MARKING');
  else {
    G.submitClue(room, writers(room)[0], 'ok');
    assert.equal(room.phase, 'MARKING');
  }
  guessers(room).filter((id) => id !== ids[0]).forEach((id) => G.submitMark(room, id, { x: 0, y: 0 }));
  assert.equal(room.roundIndex, 1);
  G.setConnected(room, ids[0], true);
  assert.equal(room.players.find((p) => p.id === ids[0]).connected, true);
});

test('play again returns everyone to the lobby with a clean slate', () => {
  const { room, ids } = setup('duel', ['A', 'B']);
  G.startGame(room, ids[0]);
  playGame(room);
  assert.throws(() => G.playAgain(room, ids[1]), /Only the host/);
  G.playAgain(room, ids[0]);
  assert.equal(room.phase, 'LOBBY');
  assert.equal(G.viewFor(room, ids[0]).reply, null);
  G.startGame(room, ids[0]);
  assert.equal(room.roundIndex, 0);
  assert.equal(room.rounds.length, 1);
});

test('room codes use the agreed characters and avoid codes in use', () => {
  const seen = new Set(['AAAA']);
  let calls = 0;
  const code = G.makeCode((c) => seen.has(c), () => (calls++ < 4 ? 0 : 0.5));
  assert.notEqual(code, 'AAAA');
  assert.match(G.makeCode(), /^[A-HJ-NP-Z2-9]{4}$/);
});
