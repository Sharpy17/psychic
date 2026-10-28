# Wavelength 2D — Master Obsidian Vault 🎯

Welcome to the central knowledge base and single source of truth for **Wavelength 2D** (working title), a multiplayer web-based party game for 3–10 players.

> [!IMPORTANT]
> **To All Team Members and AI Agents:**
> This repository is synchronized via GitHub. Any AI agent (ChatGPT, Claude, Cursor, Copilot, Antigravity) and human working on this project **must read and adhere to the specifications in this vault before writing or altering code**. If architectural decisions change, update the corresponding markdown note in this vault and commit it to Git first.

---

## 🗺️ Quick Navigation (Map of Content)

### 1. Core Architecture & Tech
- [[01 - System Architecture/Tech Stack|Tech Stack & Frameworks]]: React + Tailwind + SVG, Node.js + Socket.io.
- [[01 - System Architecture/Socket Protocol & Events|Socket Protocol & Events]]: Exact socket event names, request/response payloads, and security boundaries.
- [[01 - System Architecture/State Machine & Game Loop|State Machine & Game Loop]]: Phase definitions (`LOBBY` ➔ `PSYCHIC_TURN` ➔ `GUESSING` ➔ `REVEAL` ➔ `ROUND_END`).

### 2. Mechanics & Mathematics
- [[02 - Game Mechanics/Coordinate System & Math|Coordinate System & Math]]: Normalized $[-1, 1]$ coordinate space, screen-to-cartesian mapping, touch handling.
- [[02 - Game Mechanics/Scoring Formula & Balance|Scoring Formula & Balance]]: Euclidean distance equations, concentric target rings, psychic reward incentives.
- [[02 - Game Mechanics/Edge Cases & Disconnects|Edge Cases & Disconnects]]: Psychic disconnects, timeouts, minimum player handling.

### 3. Data Schemas & Types
- [[03 - Data Models & Schemas/Data Models (TypeScript)|Data Models (TypeScript)]]: Unified types for Player, Room, Guess, Round, and GameState.
- [[03 - Data Models & Schemas/Content Deck Schema|Content Deck Schema]]: Schema for game topics and opposing attribute axes.

### 4. UI & Components
- [[04 - Modules & UI/2D Coordinate Board Component|2D Coordinate Board Component]]: Interactive SVG unit square specifications, pin placement, bullseye visualization.
- [[04 - Modules & UI/Screens & Role Views|Screens & Role Views]]: Psychic screen vs. Guesser screen vs. Spectator/Lobby screens.

### 5. Project Management & AI Directives
- [[05 - Team & Roadmap/Team Ownership & Tasks|Team Ownership & Tasks]]: Division of responsibilities across the 4 team members.
- [[05 - Team & Roadmap/Sprint Roadmap|Sprint Roadmap]]: Phased development milestones from prototype to playtest.
- [[06 - AI Guidelines/AI Agent Instructions & Contract|AI Agent Instructions & Contract]]: Prompt directives for AI agents to prevent code drift and schema collisions.
- [[07 - Content Bank/Starter Topics & Word Pairs|Starter Topics & Word Pairs]]: Initial deck of 30+ curated topics and axes for testing.

---

## 🎮 Game Summary
- **Players:** 3 to 10 players.
- **Roles:** 1 Psychic (rotates each round) and 2–9 Guessers.
- **Board:** A 2D plane (unit square) bounded between $-1$ and $+1$ along X and Y.
  - **X-Axis:** Pair of opposing attributes (e.g., *Ugly* $\leftrightarrow$ *Handsome*).
  - **Y-Axis:** Pair of opposing attributes (e.g., *Boring* $\leftrightarrow$ *Funny*).
- **The Psychic:** Sees a secret target point $(x_s, y_s)$ visible **only** to them. Submits a clue word or phrase strictly within the designated topic.
- **The Guessers:** See only the clue and axes; each drops a pin on the plane attempting to hit the secret point.
- **Scoring:** Points awarded based on proximity. Psychic earns points based on the collective accuracy of the team.
