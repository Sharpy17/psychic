# `demo` branch: full clickable prototype (first variant)

**Owner:** Azim
**Based on:** `main` at `d4dac08` (the team scaffold), plus one folder: `prototype/`
**Status:** reference version. Fully playable in one browser with bots, not connected to the real server

This branch is the **first complete variant** of Psychic Plane to refer to: the landing page
**and** the whole game flow (lobby → psychic's clue → secret guesses → reveal of everyone's
pins → live scores → final ranking). It's plain HTML, CSS and JavaScript, so anyone can open it
and play through every screen without installing anything.

Nothing in the React app (`client/`), the server or the database is changed on this branch.

> This README replaces the team README on this branch only. For the project overview,
> roles and setup, see the README on [`main`](https://github.com/Sharpy17/psychic/tree/main).
> The landing page on its own is on the **`landingpage`** branch.

---

## Run it

No install, no build, no internet needed.

```bash
git clone https://github.com/Sharpy17/psychic.git
cd psychic
git checkout demo
```

Then open one of these in a browser:

| File | Starts at |
|---|---|
| `prototype/landing.html` | The landing page. **Create a room → Go to lobby** opens the game |
| `prototype/index.html` | The game directly, at its own name and room screen |

---

## What's in this branch

```text
psychic/
├── README.md              ← this file (branch-specific)
├── client/ server/ shared/ database/ ...   ← unchanged from main
└── prototype/
    ├── landing.html       ← landing page with a playable demo board
    ├── index.html         ← game shell (loads the files below)
    ├── app.js             ← all game screens and input handling
    ├── styles.css         ← game styles
    ├── board.js           ← the 2D board component (shared by landing + game)
    ├── board.css          ← board styles (shared by landing + game)
    └── mock-server.js     ← fake server with bots, running in the browser
```

---

## How the game plays

**Free-for-all.** No teams, and every player has their own score.

1. **Lobby:** the host shares a 4-letter room code. You need at least **3 players**.
2. **Each round, one player is the psychic.** Everyone takes one turn, so 5 players means 5 rounds.
3. **The board** has 4 labels, top/bottom and left/right, e.g. *Funny / Unfunny* × *Ugly / Cute*.
   Only the psychic sees where the hidden target is.
4. **The psychic types a one-line clue**, e.g. "A pug in a hot dog costume".
5. **Everyone else secretly places their own dot.** Nobody can see anyone else's dot.
   The side panels show who is *Thinking...* and who is *✓ Locked in*.
6. **Reveal** happens once everyone has locked in. Every player's dot pops onto the board in their
   colour, labelled with their name and points, and the target rings appear.
7. **Scores count up** in the side panels with a **+N** badge. The leader gets a 👑.
8. After the last round, a **ranked final screen** shows the winner or a tie, and the host can **Play again**.

### Scoring

| Who | Points |
|---|---|
| Guesser within 5 of the target | **4** (bullseye) |
| within 11 | **3** |
| within 18 | **2** |
| further | 0 |
| **Psychic** | **1 per player who scored**, so a good clue pays off |

The board runs from 0 to 100 on both axes. The numbers to tune are at the top of `mock-server.js`:
`MIN_PLAYERS`, `ROUNDS_PER_PLAYER`, `PSYCHIC_POINTS_PER_HIT` and `RINGS`.

---

## Screens

| Screen | What's there |
|---|---|
| **Landing** (`landing.html`) | Nav, hero, demo board (drag, reveal, new card), how to play, features, create and join boxes, click sounds, 🔊 toggle |
| **Home** | Name field, **Create a room**, join with a code, *How to play* |
| **Lobby** | Big room code (tap to copy), player list with colours, *you* and *host* tags, **Start game** (host) |
| **Game** | Round *N of M*, status line, the board with 4 labels, **player cards down the left and right** (name, live score, status), clue input or clue display, **Lock in my guess** / **Next round** |
| **Game over** | 🏆, winner or tie, ranked list with scores, **Play again** (host) |

On phones, the two player columns sit above the board.

### Board controls

Drag the dot, or tap anywhere to jump it there. Arrow keys move it, and **Shift + arrow** moves faster.

---

## Testing alone: the mock server

There's no real server yet. `mock-server.js` runs the game rules inside the browser and fills
the room with 4 bots (**Ari, Bo, Cy, Dee**).

- The **Mock server · View as** box (bottom right) switches whose eyes you're looking through:
  you, the psychic, or any guesser. What each player can see changes exactly as it would for them.
- **Every player except the one you're viewing as is played by a bot.** Bots give clues and
  place and lock their dots after a few seconds, so a full game runs with just you.

### The rule that matters most

Until the reveal, `target` is `null` for everyone except the psychic, and each player only
receives **their own** dot (others show just `{ locked }`). See `viewFor()` in `mock-server.js`.
The real server must build state **per player** like this and never broadcast the raw room,
or anyone could open DevTools and see the answer.

---

## Event contract used by the prototype

Client → server (`MockServer.send(type, payload)`):

| Event | Payload | Who can send |
|---|---|---|
| `create_room` | `{ name }` | anyone |
| `join_room` | `{ name, roomCode }` | anyone |
| `start_game` | none | host, 3+ players |
| `submit_clue` | `{ clue }` | psychic, CLUE phase |
| `move_marker` | `{ x, y }` | any guesser, GUESSING phase, until they lock |
| `lock_guess` | none | any guesser. Reveal happens when everyone has locked |
| `next_round` | none | anyone, REVEAL phase |
| `play_again` | none | host, GAME_OVER phase |
| `leave` | none | anyone |

Server → client: `room_state` (via `MockServer.onState`) and `error` (via `MockServer.onError`).
Phases: `LOBBY → CLUE → GUESSING → REVEAL → … → GAME_OVER`.

`app.js` only talks to the server through `MockServer.send / onState / onError`. Swap
`mock-server.js` for a Socket.IO wrapper with the same three functions and the UI keeps working.

---

## Differences from `shared/types.ts` on `main`

| Prototype | Team contract | Note |
|---|---|---|
| Coordinates 0 to 100, y **down** | −100 to +100, y **up** | `x' = x*2 - 100`, `y' = 100 - y*2` |
| Card `{ top, bottom, left, right }` | `xAxis` / `yAxis` as `AxisPair { minLabel, maxLabel }` | Same idea, different shape |
| Phase `CLUE` | `PSYCHIC_THINKING` | Rename when porting |
| Points 4 / 3 / 2 | "A direct hit earns 1,000 points" | Team to decide |
| `move_marker` + `lock_guess` | `guesser:submit_guess` | The prototype separates dragging from locking in |
| No topic | `Topic` (e.g. *Video Game Characters*) | Not in the prototype yet |
| No timer | `timeLimitSec`, `timer:tick` | Not in the prototype yet |

---

## Branches at a glance

| Branch | Purpose |
|---|---|
| `main` | Team scaffold (React client, Socket.IO server, shared types, Prisma). Nobody commits directly |
| `landingpage` | Landing page prototype only |
| `demo` | **This branch.** First full variant: landing page plus the whole clickable game with bots |
