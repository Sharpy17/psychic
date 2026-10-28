# 05 - Team Ownership & Tasks (4 Vibecoders)

To avoid merge conflicts and overlapping AI instructions, the project is divided into four distinct ownership modules.

---

## 👥 Team Roles

### 🧑‍💻 Member 1: Board Component & Coordinate Math
* **Primary Scope:**
  * Build the responsive SVG board (`Board.tsx`).
  * Implement touch and mouse drag/tap handlers.
  * Coordinate conversion functions ($[-1, 1] \leftrightarrow \text{SVG coords}$).
  * Pin drop animations and visual bullseye target rings.
* **Relevant Vault Docs:**
  * [[02 - Game Mechanics/Coordinate System & Math]]
  * [[04 - Modules & UI/2D Coordinate Board Component]]

### 🧑‍💻 Member 2: Backend, State Machine & Sockets
* **Primary Scope:**
  * Node.js + Socket.io server setup (`server/`).
  * Room creation, join codes, and connection lifecycle.
  * Server-side game loop (`LOBBY` ➔ `PSYCHIC_TURN` ➔ `GUESSING` ➔ `REVEAL`).
  * Euclidean distance calculations and score distribution.
  * Keeping secret target secure on server.
* **Relevant Vault Docs:**
  * [[01 - System Architecture/Socket Protocol & Events]]
  * [[01 - System Architecture/State Machine & Game Loop]]
  * [[02 - Game Mechanics/Scoring Formula & Balance]]
  * [[03 - Data Models & Schemas/Data Models (TypeScript)]]

### 🧑‍💻 Member 3: Lobby, Player Flow & Mobile Shell
* **Primary Scope:**
  * Room entry screen (Enter Room Code, Enter Name, Pick Avatar Color).
  * In-game header (Timer countdown, Current Round, Topic badge).
  * Role-conditional wrappers (Psychic text input vs Guesser "Lock In" button).
  * Leaderboard drawer and Game Over podium screen.
* **Relevant Vault Docs:**
  * [[04 - Modules & UI/Screens & Role Views]]
  * [[02 - Game Mechanics/Edge Cases & Disconnects]]

### 🧑‍💻 Member 4: Content Deck, Sound & Polish (The Game Juice)
* **Primary Scope:**
  * Curating and expanding the JSON content deck (`decks.json`).
  * Sound effects: click, timer tick, lock-in thud, reveal fanfare, bullseye cheer.
  * Particle effects (e.g. `canvas-confetti` on high scores).
  * End-to-end playtesting and edge case validation.
* **Relevant Vault Docs:**
  * [[03 - Data Models & Schemas/Content Deck Schema]]
  * [[07 - Content Bank/Starter Topics & Word Pairs]]
