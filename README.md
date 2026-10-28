# 🔮 Psychic Plane

> A 2D Cartesian spectrum multiplayer party game.

---

## 🎯 Game Concept

In **Psychic Plane**, players test their telepathic wavelength across a 2D coordinate grid:

- **Two Spectrum Axes**: 
  - **X-Axis**: e.g., *Unfunny* (left) $\leftrightarrow$ *Hilarious* (right)
  - **Y-Axis**: e.g., *Ugly* (bottom) $\leftrightarrow$ *Cute* (top)
- **The Psychic**: Receives a secret target point $(x, y)$ on the plane and a topic (e.g., *Video Game Characters*). The Psychic gives a single clue that fits those coordinates (e.g., *"Liu Kang"*).
- **The Guessers**: Must discuss and place their pins on the 2D plane where they think *"Liu Kang"* sits on both spectrums.
- **The Reveal**: The target point is exposed! Scores are calculated based on Euclidean distance ($d = \sqrt{\Delta x^2 + \Delta y^2}$). A direct hit earns 1,000 points!

---

## 👥 Team Roles & Code Ownership

| Team Member | Responsibility | Primary Directory / Files |
| :--- | :--- | :--- |
| **Dosia** *(You)* | **Architecture, Integration & DevOps** | `shared/types.ts`, `server/src/index.ts`, `client/src/components/GameBoard.tsx` |
| **Isa** | **Game Engine & Rules Logic** | `server/src/game/engine.ts` |
| **Azim** | **Landing Page & UI Shell** | `client/src/components/LandingPage.tsx`, `client/src/index.css` |
| **Arthur** | **Database & Spectrum Prompts** | `database/prisma/schema.prisma`, `database/seed-data.json`, `server/src/db/` |

---

## 📁 Project Architecture

```text
psychic-plane/
├── shared/
│   └── types.ts             # 💎 THE CONTRACT: Shared TypeScript types for Socket events, coordinates & game state
├── server/
│   ├── src/
│   │   ├── game/engine.ts   # Isa's pure logic: Euclidean scoring, random target generation
│   │   ├── db/client.ts     # Arthur's data layer: Fetching prompts, axis pairs, saving match history
│   │   └── index.ts         # Dosia's Socket.io & Express server
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LandingPage.tsx # Azim's landing page & room join screen
│   │   │   ├── Lobby.tsx       # Player waiting room & host controls
│   │   │   └── GameBoard.tsx   # 2D interactive plane with draggable pins & reveal animation
│   │   ├── services/socket.ts  # Socket.io client connector
│   │   ├── App.tsx             # Main view router
│   │   └── main.tsx
│   └── package.json
└── database/
    ├── prisma/schema.prisma # Arthur's database schema
    └── seed-data.json       # 15+ starter spectrum pairs & 9 categories
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have **Node.js (v18+)** and **npm** installed on your machine.

### Installation

1. Clone your repo:
   ```bash
   git clone https://github.com/<your-username>/psychic-plane.git
   cd psychic-plane
   ```

2. Install server dependencies:
   ```bash
   cd server
   npm install
   ```

3. Install client dependencies:
   ```bash
   cd ../client
   npm install
   ```

### Running Locally

Open two terminal windows:

- **Terminal 1 (Backend)**:
  ```bash
  cd server
  npm run dev
  ```
  *Server runs at `http://localhost:4000`*

- **Terminal 2 (Frontend)**:
  ```bash
  cd client
  npm run dev
  ```
  *Client runs at `http://localhost:3000`*

Open `http://localhost:3000` in multiple browser tabs (or incognito windows) to play against yourself or share via local network IP!

---

## 🌿 Git & Team Workflow

### 1. Dosia's Initial Push
```bash
git init
git add .
git commit -m "feat: initial project scaffold with shared contracts, game engine, and 2D board"
git branch -M main
git remote add origin https://github.com/<your-username>/psychic-plane.git
git push -u origin main
```

### 2. How the Team Works (Branching Strategy)
Nobody commits directly to `main`. Every teammate creates a feature branch:

- **Isa**:
  ```bash
  git checkout -b feature/isa-game-scoring
  # Work inside server/src/game/
  git commit -m "feat(game): refine distance scoring and round timers"
  git push origin feature/isa-game-scoring
  ```
- **Azim**:
  ```bash
  git checkout -b feature/azim-landing-ui
  # Work inside client/src/components/LandingPage.tsx
  git commit -m "style(landing): add animations and sound effects"
  git push origin feature/azim-landing-ui
  ```
- **Arthur**:
  ```bash
  git checkout -b feature/arthur-database
  # Work inside database/ and server/src/db/
  git commit -m "feat(db): setup prisma migration and PostgreSQL connection"
  git push origin feature/arthur-database
  ```

### 3. Pull Requests
Teammates open a Pull Request on GitHub. **Dosia reviews the PR**, checks that it doesn't break `shared/types.ts`, and merges it into `main`!
