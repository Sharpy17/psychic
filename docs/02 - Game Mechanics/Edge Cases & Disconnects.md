# 02 - Edge Cases & Disconnects

Party games in web browsers frequently encounter page refreshes, spotty mobile connections, and AFK players. This document defines how the system handles interruptions.

---

## 🔌 1. Player Disconnection Handling

### A. Non-Psychic Guesser Disconnects
* **During `GUESSING` Phase:**
  * If a guesser disconnects or closes their tab, do not block the game!
  * Reduce the required locked-in count to the remaining connected guessers.
  * If they reconnect before the timer expires, restore their session using `localStorage` session tokens (`playerId`).

### B. Psychic Disconnects
* **During `PSYCHIC_TURN` or `GUESSING`:**
  * Give a 15-second grace period for the psychic to reconnect.
  * If the grace period expires:
    1. Broadcast an alert: *"Psychic disconnected! Skipping round..."*
    2. Discard current round without scoring.
    3. Rotate psychic role to the next player in line.

---

## ⏱️ 2. Timeouts & AFK Behavior

1. **Psychic Clue Submission Timeout:**
   * Psychic is given **90 seconds** to submit a clue.
   * If time expires without a clue, auto-generate a random skip, give 0 points to psychic, and rotate role.
2. **Guessing Phase Timeout:**
   * Guessers have **60 seconds** to place and lock in their pins.
   * If time expires and a player has placed a pin without hitting "Lock In", their current pin position is auto-locked.
   * If they never touched the board, their guess is set to $(0, 0)$ (the neutral center) or registered as a Miss ($0\text{ pts}$).

---

## 👥 3. Minimum Player Constraint
* **Minimum: 3 Players** (1 Psychic + 2 Guessers).
* **Maximum: 10 Players** (To keep the SVG board from becoming an unreadable clump of pins).
* If a player leaves mid-game leaving only 2 players:
  * Game pauses and shows: *"Need at least 3 players to continue. Invite a friend!"*
