# 08 - Potential Problems & Critical Review

This document contains a comprehensive breakdown of all identified design flaws, mathematical edge cases, mobile UX friction points, and technical ambiguities discovered in the initial architecture of **Wavelength 2D**. 

Any team member or AI agent working on the game should consult this list before implementing features to ensure these pitfalls are mitigated.

---

## 1. 🧠 Gameplay & Psychological Pitfalls

### 1.1 The "Analysis Paralysis" Bottleneck (2D Cognitive Overload)
* **The Problem:** In original 1D *Wavelength*, finding a clue along one spectrum (e.g. *Hot vs Cold*) takes 15–30 seconds. In 2D, the psychic must satisfy **two axes simultaneously** (e.g., $X = -0.8$ *Very Evil* AND $Y = +0.7$ *Hilarious*) within a narrow topic (e.g., *Kitchen Utensils*).
* **The Risk:** Psychics will freeze up, take 3+ minutes, or get frustrated because a valid word simply does not exist for that specific coordinate/topic pair.
* **Proposed Solution:**
  1. Add a **"Reroll" button**: The psychic can discard the current axes/target once per turn.
  2. Keep topics broad and character-driven (*Fictional Characters*, *Animals*, *Celebrities* have enough variety to populate all 4 quadrants).

### 1.2 Lack of Explicit Clue Constraints (Cheating Loopholes)
* **The Problem:** The initial specification vaguely states *"psychic enters a word within topic constraints"*.
* **The Risk:** Players will exploit cheap clues:
  * Using axis root words (e.g., if the axis is *Hot*, saying *"Hotdog"* or *"Heater"*).
  * Using directional or spatial hints (*"Top-left goblin"*, *"High up dog"*).
  * Using numeric/scale hints (*"Level 5 threat"*).
* **Proposed Solution:** Establish rigid validation rules:
  * Ban words sharing linguistic roots with active axis labels.
  * Ban directional terms (*"up"*, *"down"*, *"high"*, *"low"*, *"center"*, *"corner"*).
  * Limit clues to a single noun/proper noun or short phrase ($\le 3$ words).

### 1.3 Social Dynamic: The "Silent Phone-Staring" Trap
* **The Problem:** In an individual free-for-all mode, players silently stare at their screens, drop a pin, and lock in without talking.
* **The Risk:** *Wavelength* thrives on hilarious table arguments over subjective definitions. Silent guessing drains the party game atmosphere.
* **Proposed Solution:**
  * Option A: Introduce a **Discussion Phase** where players can chat before locking in.
  * Option B: Support a **Team vs. Team mode** (Team A agrees on a single pin placement, then Team B guesses if the real point is to the left or right).

---

## 2. 📐 Mathematical & Coordinate Space Quirks

### 2.1 The "Square vs. Circle" Corner Flaw
* **The Problem:** The board is a unit square spanning $[-1, 1] \times [-1, 1]$. The distance from center to side is $1.0$, but from center to corner is $\sqrt{2} \approx 1.414$.
* **The Risk:** If a target generates at $(0.8, 0.8)$, more than half of the concentric scoring rings fall outside the game board. 
  * Guessers can deduce that guesses outside the board are impossible, narrowing down the search space in corners.
  * Center targets are surrounded on all sides and are statistically harder to hit.
* **Proposed Solution:**
  * Restrict target coordinates to an inscribed circle: $x_s^2 + y_s^2 \le 0.85^2$.
  * Or clip the scoring rings cleanly at the SVG boundary.

### 2.2 Euclidean Distance vs. Independent Dual-Axis Scoring
* **The Problem:** Scoring currently uses Euclidean distance: $d = \sqrt{\Delta x^2 + \Delta y^2}$.
* **The Risk:** Suppose the secret is $(0.8, 0.8)$:
  * **Player A** nails the X-axis completely ($\Delta x = 0$) but misses Y by $0.4$ ($d = 0.4 \implies$ **500 pts**).
  * **Player B** is slightly off on both ($\Delta x = 0.28, \Delta y = 0.28 \implies d = 0.396 \implies$ **500 pts**).
  * Casual players may find circular Euclidean scoring confusing compared to evaluating each axis independently ($Score_X + Score_Y$).
* **Proposed Solution:** Keep circular rings for visual aesthetics, but clearly communicate that closeness is radial ("as the crow flies").

### 2.3 Troll & AFK Vulnerability in Psychic Rewards
* **The Problem:** The psychic's score is calculated as the mathematical average of all guessers' points.
* **The Risk:** If 4 players hit the Bullseye ($1000\text{ pts}$) and 1 troll or disconnected player clicks the opposite corner ($0\text{ pts}$), the psychic is severely penalized.
* **Proposed Solution:**
  * Use the **median score** of guessers.
  * Or drop the single lowest guess before computing the psychic average.

---

## 3. 📱 Mobile UI & Visual Blindspots

### 3.1 The "Fat Finger" / Touch Occlusion Problem
* **The Problem:** On mobile screens (~380px wide), placing a thumb on the screen directly blocks the user's view of the pin, the crosshairs, and nearby grid markers.
* **Proposed Solution:**
  * Add a **touch drag offset**: Render the active pin 40px above the finger contact point.
  * Add directional nudge buttons ($\leftarrow, \rightarrow, \uparrow, \downarrow$) below the board for pixel-perfect adjustments before locking in.

### 3.2 Axis Label Overflow on Narrow Viewports
* **The Problem:** Labels like *"Dies First in a Horror Movie"* contain 29 characters. Placing them directly outside the left or right edge of a 1:1 SVG square causes severe text clipping or requires microscopic font sizes.
* **Proposed Solution:**
  * Place Y-axis labels at the very top and bottom of the screen container.
  * Place X-axis labels in dedicated pill banners or stacked badges on the left and right sides.

### 3.3 Pin Clumping on the Reveal Screen
* **The Problem:** If 8 players all make accurate guesses, 8 colored circles and player names will overlap into an unreadable knot directly over the target.
* **Proposed Solution:**
  * Stagger player name tags outward using radiating leader lines.
  * Add tap-to-inspect tooltips for individual player pins.

---

## 4. ⚡ Technical & Networking Pitfalls

### 4.1 Monorepo Shared Types Pitfall for Vibecoders
* **The Problem:** Attempting to share a `shared/types.ts` directory across separate `client/` and `server/` projects without complex monorepo tooling (like Turborepo or npm workspaces) frequently causes build and import path failures in Vite.
* **Proposed Solution:**
  * Keep types authored in `server/src/types.ts` and sync a copy to `client/src/types.ts`.
  * Or maintain a single-package repository where client and server coexist cleanly.

### 4.2 Timer Desynchronization & Drift
* **The Problem:** Running local `setInterval` on client devices causes countdown timers to drift out of sync by several seconds across different phones.
* **Proposed Solution:**
  * The server broadcasts a phase expiration timestamp: `{ expiresAt: 1729876543000 }`.
  * Clients compute remaining seconds dynamically: `Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))`.

### 4.3 Server Memory Leaks / Zombie Rooms
* **The Problem:** Without room garbage collection, disconnected rooms and lingering socket listeners remain in server memory indefinitely.
* **Proposed Solution:**
  * Implement an automatic cleanup interval: If a room has 0 connected players for more than 5 minutes, delete it from memory.

---

## 5. 👥 Team Workload Imbalance

### 5.1 The "Backend Bottleneck"
* **The Problem:** Member 2 (Backend & Sockets) has a massive workload (state machine, socket routing, timeouts, scoring, validation). Other members are blocked until socket events work. Meanwhile, Member 4 (Content Deck & Sound) has minimal initial work.
* **Proposed Rebalancing:**
  * **Gameplay Pair:**
    * *Member 1:* Board SVG + Coordinate Math + Touch handling.
    * *Member 4:* Reveal animations, scoring animations, visual juice, sound cues, and leaderboard.
  * **Infrastructure Pair:**
    * *Member 2:* Server Game Loop, Socket.io event bus, and scoring logic.
    * *Member 3:* Lobby UI, Player flow, Mobile responsive shell, and Deck integration.

---

## 📋 Open Decision Matrix

| # | Topic | Issue | Recommended Fix | Status |
| :-: | :--- | :--- | :--- | :-: |
| 1 | **Psychic Clueing** | Analysis paralysis on difficult axes/topics | Add 1 Reroll per psychic turn | 🟢 Added to Docs |
| 2 | **Clue Integrity** | Players using axis words or directional hints | Strict validation: Ban axis roots & spatial words | 🟢 Added to Docs |
| 3 | **Scoring Security** | 1 troll tanks the psychic's entire score | Use median score or drop lowest guess | 🟡 Open |
| 4 | **Target Space** | Corners truncate scoring rings outside square | Inscribe target zone inside circle ($r \le 0.85$) | 🟡 Open |
| 5 | **Mobile Control** | Thumb covers the pin during placement | Add touch vertical offset + nudge arrows | 🟡 Open |
| 6 | **Timer Sync** | `setInterval` drift across devices | Server sends timestamp `expiresAt` | 🟡 Open |
| 7 | **Team Balance** | Member 2 is overloaded; Member 4 underutilized | Rebalance into 2 pairs (Gameplay & Infrastructure) | 🟡 Open |
