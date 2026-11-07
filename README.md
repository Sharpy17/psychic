# The Psychic Plane

A party game played by mail, for a ticket to the circus. A psychic gives one clue for a secret spot
on a board with two pairs of opposites, and everyone marks where they think it is. Nobody learns a
thing until all four rounds are sealed and the reply arrives, with every clue, target and mark, and a
leaderboard.

## Run it

Needs Node 20 or newer.

```bash
npm install
npm start        # http://localhost:4100
npm test         # the game rules
```

Set `PORT` to use another port. To play with others on your network, share your computer's address.
The page itself, including the sample entry on the front page, is in `public/`.

## The three modes

Every game is 4 rounds, a clue has 90 seconds and a mark has 60. Marks and targets stay secret until
the reply, in every mode.

| Mode | Players | How it plays | Scoring |
|---|---|---|---|
| **Head to Head** | Exactly 2 | Both write a clue for their own target at once, swap, then both guess at once | You score only for your own guess |
| **Free for All** | 3 to 8 | A psychic is drawn at random, and everyone else guesses | Guessers score their own marks, and the psychic earns the average |
| **Team Against Team** | 4 or more, at least 2 per team | Each team has a psychic, both teams chase one shared target, and both clues are visible to everyone | A team's round score is the average of its marks |

**Points:** within 15 units of the target earns 1,000 (Bullseye), within 35 earns 750 (Excellent),
within 60 earns 500 (Great), within 90 earns 250 (Close), and further earns 50 (Miss). The chart runs
from -100 to +100 on each axis. A player who leaves no mark scores 0.

**Psychics** are drawn at random, with no repeats until everyone has had a turn. In team games this
happens within each team.

**Winning:** the top of the leaderboard takes the ticket, and every member of a winning team gets
one. Head to Head and team games break level scores on the lowest total distance from the targets,
then share the win. Free for All shares a tied win.

## How it's built

```text
server/
  engine.js        the rules, with no networking
  engine.test.js   tests for the rules and for what each player may see
  cards.js         the deck of boards
  index.js         the web server and Socket.IO rooms
public/
  index.html       the page
  css/             base and board, page, intro, style (the contest look), game (lobby and play)
  js/common.js     board, sounds, toasts and the room pop-ups
  js/mail.js       the mailing animation
  js/reply.js      the reply letter
  js/sample.js     the sample entry, which needs no server
  js/game.js       the lobby and play screens
```

**The rule that matters most:** `viewFor()` in `engine.js` is the only game data that leaves the
server. It gives a target only to that sheet's psychics, a mark only to the player who made it, and
clues only once every psychic is done. The full results exist only after the last round. Never send
a room to players directly, or anyone could read the answers in their browser's developer tools.

Rooms are held in memory, so restarting the server ends the games in progress. A player who reloads or
loses their connection returns to their seat, and absent players never hold up the room.
