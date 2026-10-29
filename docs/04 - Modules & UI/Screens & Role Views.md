# 04 - Screens & Role Views

This document defines what is displayed on each player's screen depending on their role and current phase.

---

## 📱 Role View Matrix

| Phase | Psychic View | Guesser View | Spectator View |
| :--- | :--- | :--- | :--- |
| **`LOBBY`** | Room code, player list, "Start Game" button (if host). | Same as psychic. | Same as psychic. |
| **`PSYCHIC_TURN`** | **Topic**, **Axes**, and **Secret Target Point**. Text input for Clue. "🎲 Reroll" button (1 per turn) and "Submit Clue" button. | **Topic** and **Axes**. Waiting status: *"Waiting for [Name] to give a clue..."* | Same as guesser. |
| **`GUESSING`** | Topic, Axes, Submitted Clue. List of players with checkmarks when locked in. Cannot move pins. | Topic, Axes, Clue. Interactive board to place/adjust pin. "Lock In" button. | Same as psychic. |
| **`REVEAL`** | Full board reveal: Secret target + all player pins + score cards + celebration sound. | Same as psychic. | Same as psychic. |
| **`ROUND_END`** | Updated Leaderboard, Next Psychic announcement, "Next Round" button (or 5s auto-countdown). | Same as psychic. | Same as psychic. |
| **`GAME_OVER`** | Winner podium (1st, 2nd, 3rd), MVP awards (e.g. Best Psychic, Closest Guess), "Play Again". | Same as psychic. | Same as psychic. |

---

## 💡 UX Best Practices for Party Games
1. **Prominent Clue Banner:** In the `GUESSING` phase, the clue must be in large text at the top:
   > **Topic:** Animals  
   > **Clue:** *"Capybara"*
2. **Clear Feedback on Lock In:** Once a guesser presses "Lock In", dim the board slightly and show a satisfying badge: *"Guess Locked In! Waiting for others..."*
3. **Sound & Haptics:** Vibrate slightly on mobile when locking in a pin; play a distinct ding sound during the reveal.
