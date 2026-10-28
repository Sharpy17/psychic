# 06 - AI Agent Instructions & Contract

> [!IMPORTANT]
> **SYSTEM DIRECTIVE FOR ALL AI CODING AGENTS (ChatGPT, Claude, Cursor, Antigravity, Copilot):**
> You are collaborating on a shared codebase with 4 human vibecoders and multiple other AI agents. You must strictly obey the rules below to prevent schema drift, naming collisions, and architecture divergence.

---

## 📜 The 5 Golden Rules for AI Agents

### 1. Check Types & Events Before Generating Code
* Before writing or modifying any socket handler, check:
  `[[01 - System Architecture/Socket Protocol & Events]]`
* Before modifying any data structures or state, check:
  `[[03 - Data Models & Schemas/Data Models (TypeScript)]]`
* **DO NOT** invent new event names (e.g., using `guess_submitted` when the spec calls for `player:submit_guess`).

### 2. Respect Normalized Coordinate Space
* Game logic coordinates **must strictly stay within $[-1.0, +1.0]$**.
* Pixel-level or percentage-level coordinates belong solely in rendering transforms, never inside server game state.
* Refer to `[[02 - Game Mechanics/Coordinate System & Math]]` for the math transformation functions.

### 3. Server-Authoritative Target Security
* **NEVER** expose `targetX` / `targetY` / `secretTarget` in public room state broadcasts during `PSYCHIC_TURN` or `GUESSING`.
* Only the socket matching `psychicId` may receive target coordinates prior to the `REVEAL` phase.

### 4. Updating the Vault on Spec Changes
* If a human user asks for a feature that contradicts or expands these documentation files (e.g., adding a new game phase or new socket event):
  1. **Identify the exact `.md` file in this vault that is affected.**
  2. **Update that `.md` file first or alongside your code changes.**
  3. Clearly inform the user: *"I have updated `[Filename.md]` to reflect this change so the rest of your team's agents stay synchronized."*

### 5. Keep Code Modular & Single-Responsibility
* Avoid creating massive monolithic files (>300 lines).
* Separate socket communication (`useSocket.ts`) from UI components (`Board.tsx`, `Scoreboard.tsx`).
* Write clean, self-documenting code with TypeScript annotations matching this vault.

---

## 📋 Copy-Paste Prompt Template for Team Members
When prompting any AI tool (Cursor, Claude, ChatGPT, etc.), include this prelude:

```text
You are an expert full-stack developer assisting our team with building "Wavelength 2D".
Our project rules, architecture, socket event names, and TypeScript interfaces are defined in our Obsidian Vault.
Please review the relevant vault docs before generating code:
- Socket Protocol: 01 - Socket Protocol & Events.md
- Data Models: 03 - Data Models (TypeScript).md
- Coordinate Math: 02 - Coordinate System & Math.md
Do not invent conflicting event names or alter the normalized [-1, 1] coordinate system.
```
