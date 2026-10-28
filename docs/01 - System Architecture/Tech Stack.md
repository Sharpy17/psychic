# 01 - Tech Stack & Infrastructure

This document defines the approved technology stack for Wavelength 2D. All team members and AI coding agents must restrict their implementations to this stack.

---

## 🏗️ Architectural Philosophy
1. **Lightweight & Mobile-First:** Players will play on mobile phones or laptops without downloading apps. Pages must load instantly.
2. **No Heavy Game Engines:** Do NOT use Unity, Godot, or Phaser. The game board is an interactive coordinate diagram; using game engines introduces bundle bloat, viewport scaling headaches, and complex networking.
3. **Vibecoding Compatibility:** Libraries chosen have extensive online documentation and strong LLM training coverage (React, Tailwind, Socket.io).

---

## 💻 Frontend (Client)
* **Framework:** **React 18+** with **Vite** (or Next.js App Router). Vite + React is recommended for maximum simplicity and zero server-side rendering confusion.
* **Styling:** **Tailwind CSS**. Ensures responsive mobile layouts, clean typography, and rapid UI prototyping.
* **Board Rendering:** **Native SVG (`<svg>`)**.
  * Crisply renders on retina displays and mobile phones without pixelation.
  * Native DOM event support (`onClick`, `onTouchStart`, `onTouchMove`).
  * Easily animates using CSS transitions or Framer Motion.
* **State Management:** **Zustand** or simple React Context + custom hooks (`useSocket`).
* **Icons & UI Extras:** `lucide-react` for party game icons; `canvas-confetti` for win celebration.

---

## ⚡ Backend (Game Server & Networking)
* **Runtime:** **Node.js** (TypeScript recommended or standard ES Modules).
* **Server Framework:** **Express** or **Fastify**.
* **Real-time Networking:** **Socket.io (v4+)**.
  * Built-in support for rooms (`socket.join(roomCode)`).
  * Heartbeat/reconnection handling.
  * Simple JSON event broadcasting.
* **Hosting Options for Free/Low Cost:** Render, Railway, Fly.io, or Heroku.

---

## 📁 Suggested Monorepo Structure

```text
wavelength-2d/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/     # Board, Pin, Scoreboard, Timer
│   │   ├── hooks/          # useSocket, useGameRoom
│   │   ├── types/          # Shared or client-specific types
│   │   └── App.tsx
│   └── package.json
├── server/                 # Node.js + Socket.io backend
│   ├── src/
│   │   ├── game/           # RoomManager, Scoring, GameLoop
│   │   ├── data/           # decks.json (topics & axes)
│   │   ├── socket/         # Socket event handlers
│   │   └── index.ts
│   └── package.json
└── shared/                 # Shared TypeScript interfaces (optional but recommended)
    └── types.ts
```
