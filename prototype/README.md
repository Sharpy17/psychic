# Psychic Plane: UI prototype (Azim)

A clickable, no-build prototype of the landing page and the full game flow, made to try out
the look and feel before porting it into the React app in `client/`. Nothing in here is
imported by the real app. ("Mind Meter" was a placeholder name.)

Port targets: `landing.html` → `client/src/components/LandingPage.tsx`, styles → `client/src/index.css`.
Note the real contract in `shared/types.ts` uses coordinates from -100 to +100 with y up;
this prototype uses 0 to 100 with y down.

## Run it

Open `prototype/landing.html` (landing page) or `prototype/index.html` (game) in a browser.
No install or build step.

The game runs against `prototype/mock-server.js`, a fake in-browser server with bot players.
Use the **Mock server, View as** box (bottom right) to see the game as any player.
Every player you aren't viewing as is played by a bot.

## Files

| File | Owner | What it does |
|---|---|---|
| `app.js` | UI | Screens (home, lobby, game, reveal, game over) and input handling |
| `board.js` + `board.css` | UI | The square board with 4 labels and a draggable dot (mouse, touch, arrow keys). Shared by the game and the landing page |
| `landing.html` | UI | Marketing / landing page with a playable demo board |
| `styles.css` | UI | All styling |
| `mock-server.js` | Server / glue | Stand-in for the backend. Its rules are the spec for the real server |

## Contract (client to server)

| Event | Payload | Who can send |
|---|---|---|
| `create_room` | `{ name }` | anyone |
| `join_room` | `{ name, roomCode }` | anyone |
| `start_game` | none | host |
| `submit_clue` | `{ clue }` | psychic, CLUE phase |
| `move_marker` | `{ x, y }` (each 0 to 100, y grows downward) | any non-psychic player, GUESSING phase, until they lock |
| `lock_guess` | none | any non-psychic player, GUESSING phase. Reveal happens when everyone has locked |
| `next_round` | none | anyone, REVEAL phase |
| `play_again` | none | host, GAME_OVER phase |
| `leave` | none | anyone |

Server to client: `room_state` (see `viewFor()` in `mock-server.js`) and `error { message }`.

A card has four labels: `{ top, bottom, left, right }`. The target is a point `{ x, y }`.
Free-for-all: every player has their own score. Each round one player is the psychic
(everyone takes one turn); everyone else places their own dot. Scoring is by distance from
the target: within 5 = 4 points, within 11 = 3, within 18 = 2. The psychic gets 1 point per
player who scores. Tuning constants are at the top of `mock-server.js`.

**Rule:** until REVEAL, `target` is `null` for everyone except the psychic, and each player
only receives their own dot (others show just `{ locked }`). The real server must build this
per player and never broadcast the raw room.

## Swapping in the real server

Replace `mock-server.js` with a file that defines `MockServer.send / onState / onError`
on top of Socket.IO. `app.js` shouldn't need changes.
