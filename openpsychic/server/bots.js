// Bots, for testing every mode alone. A bot takes its turn a moment after it's due, like a person:
// it writes a clue, sometimes rerolls first, marks the board near the target with a random error,
// and sometimes gives a clue a nod. Bots are told the target (they're test players, not rivals).

import * as G from './engine.js';

const CLUES = [
  'Grandma’s attic', 'A wet sock', 'Shrek', 'Pineapple pizza', 'Monday morning', 'A tax form',
  'Fireworks', 'The Eiffel Tower', 'A haunted doll', 'Kittens', 'Elevator music', 'Spicy ramen',
  'A traffic cone', 'Dragons', 'Bubble wrap', 'A dentist', 'Rubber duck', 'Volcano', 'Glitter',
  'A library at night', 'Socks with sandals', 'Rollercoaster', 'Penguins', 'A burnt toast',
];

const pick = (list, random) => list[Math.floor(random() * list.length)];
const clamp = (v) => Math.max(-100, Math.min(100, Math.round(v)));

// What each bot still has to do, as { botId, kind, key }. The key changes with each new task,
// so the server schedules every turn once.
export function dueTurns(room) {
  const round = room.rounds[room.roundIndex];
  if (!round || (room.phase !== 'WRITING' && room.phase !== 'MARKING')) return [];
  const turns = [];
  for (const bot of room.players.filter((p) => p.isBot && p.connected)) {
    if (room.phase === 'WRITING') {
      const sheet = round.sheets.find((s) => s.writers.includes(bot.id));
      if (sheet && sheet.clues[bot.id] === undefined) turns.push({ botId: bot.id, kind: 'clue', key: `${room.code}:${room.roundIndex}:W:${bot.id}:${sheet.deal}` });
    } else {
      const sheet = round.sheets.find((s) => s.guessers.includes(bot.id));
      if (!sheet) continue;
      if (sheet.teamMarks) {
        // Team dot: due until it has agreed. A teammate's move unlocks it, which starts a new cycle.
        const m = sheet.teamMarks[bot.team];
        if (!m.sealed && !m.agreed.includes(bot.id)) turns.push({ botId: bot.id, kind: 'mark', key: `${room.code}:${room.roundIndex}:M:${bot.id}:${m.cycle}` });
      } else if (!sheet.marks[bot.id]) {
        turns.push({ botId: bot.id, kind: 'mark', key: `${room.code}:${room.roundIndex}:M:${bot.id}` });
      }
    }
  }
  return turns;
}

// Plays one turn. Returns false if the moment has passed (the room moved on).
export function playTurn(room, { botId, kind }, random = Math.random) {
  const round = room.rounds[room.roundIndex];
  if (!round) return false;
  try {
    if (kind === 'clue' && room.phase === 'WRITING') {
      const sheet = round.sheets.find((s) => s.writers.includes(botId));
      // One in five bots rerolls first, so the reroll gets tested too.
      if (sheet && !sheet.rerolled[botId] && !Object.keys(sheet.clues).length && random() < 0.2) {
        G.rerollSheet(room, botId);
        return true; // The new deal gets its own turn.
      }
      G.submitClue(room, botId, pick(CLUES, random));
      return true;
    }
    if (kind === 'mark' && room.phase === 'MARKING') {
      const sheet = round.sheets.find((s) => s.guessers.includes(botId));
      if (!sheet) return false;
      // A nod for about one clue in three (once: pressing again would take it back).
      for (const psychicId of sheet.writers) {
        const already = (sheet.nice[psychicId] ?? []).includes(botId);
        if (!already && sheet.clues[psychicId] !== undefined && random() < 0.35) G.niceClue(room, botId, psychicId);
      }
      // Anything from a Bullseye to a Miss: the error runs 0 to 110 units.
      const angle = random() * Math.PI * 2, error = random() * random() * 110;
      const guess = { x: clamp(sheet.target.x + Math.cos(angle) * error), y: clamp(sheet.target.y + Math.sin(angle) * error) };
      if (sheet.teamMarks) {
        // In a team, the first to act places the dot; after that a bot goes along with its teammates.
        const bot = room.players.find((p) => p.id === botId);
        const m = sheet.teamMarks[bot.team];
        if (m.agreed.includes(botId) || m.sealed) return false;
        if (m.moved === 0) G.moveTeamMark(room, botId, guess);
        G.agreeTeamMark(room, botId);
        return true;
      }
      G.submitMark(room, botId, guess);
      return true;
    }
  } catch (error) {
    if (error instanceof G.GameError) return false;
    throw error;
  }
  return false;
}
