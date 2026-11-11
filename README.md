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

A game is 4 rounds unless the host changes it in the lobby (1 to 12). In Free for All the host can
instead give everyone 1 to 3 turns as psychic, so the game runs that many times the number of players.
A clue has 90 seconds and a mark has 60.

**Topics:** the host picks a topic set in the lobby (Grab Bag, Everyday Things, Food & Drink, Pop
Culture, Creatures & Nature, People & Places, or Anything Goes). Each round deals a board suited to
the set and a topic such as "A dessert", and the psychic's clue must be one. Sets live in
`server/cards.js`.

**Nice clue:** while a clue is on the board, anyone guessing it (and the rival psychic in team games)
can give it a nod. It scores nothing. The psychic sees how many nods came in, never who gave them,
and the reply names the fans and crowns the nicest clue. Marks and targets stay secret until
the reply, in every mode.

| Mode | Players | How it plays | Scoring |
|---|---|---|---|
| **Head to Head** | Exactly 2 | Both write a clue for their own target at once, swap, then both guess at once | You score only for your own guess |
| **Free for All** | 3 to 8 | A psychic is drawn at random, and everyone else guesses | Guessers score their own marks, and the psychic earns the average |
| **Team Against Team** | 4 or more, at least 2 per team | Each team has a psychic, both teams chase one shared target, and both clues are visible to everyone. Each team moves **one shared mark** live (only that team sees it) and it seals once every teammate has pressed Lock in; any move unlocks everyone | A team scores its mark. When time runs out the mark counts where it stands |

In the reply, each team-game clue opens with **two boards side by side**, one per team. Both teams' paths replay at once (the trail, plus a heatmap of where the mark lingered), with who moved it, how far it travelled and when the team locked in. Only then does the target appear, with each team's score and the closest its mark ever got. The server records the path during marking (`teamMarks[team].path`), and `journeyOf()` in `engine.js` turns it into the replay.

**Points** (the team's scoring, from Sharpy17/psychic): within 15 units of the target earns 1,000
(Bullseye), within 35 earns 750 (Close), within 60 earns 500 (Warm), within 90 earns 250 (Edge), and
further earns 0 (Miss). The chart runs from -100 to +100 on each axis. A player who leaves no mark scores 0.
In Free for All the psychic earns the average of the guessers, plus a 250 **Psychic Resonance** bonus
when two or more of them hit the Bullseye.

**Reroll:** once per turn, while writing, a psychic can swap the board, topic and target for new ones.
It can't be undone, and the clock keeps running. In team games both psychics share the board, so a
reroll changes it for both, and it's refused once either psychic has sealed a clue.

**Psychics** are drawn at random, with no repeats until everyone has had a turn. In team games this
happens within each team.

**Winning:** the top of the leaderboard takes the ticket, and every member of a winning team gets
one. Head to Head and team games break level scores on the lowest total distance from the targets,
then share the win. Free for All shares a tied win.

## Testing alone with bots

In the lobby the host can press **+ Add a bot** (in team games, one button per team) and remove a bot
with its ×. Bots fill seats like players, so one person can start any mode: Head to Head with one bot,
Free for All with two or more, Team Against Team with three. A bot takes 1 to 3.5 seconds per turn:
it writes a clue from a stock list (and rerolls first about one time in five), gives a nice clue now
and then, and marks near the target with a random error, so every score tier turns up. Bots know the
target, so they're for testing, not for playing against. They never become host, and a room with
only bots left closes. The brain is in `server/bots.js`.

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
