# 02 - Clue & Word Selection Rules

This document establishes the official rules governing how the Psychic selects and submits clue words, as well as the mechanics of the Psychic Reroll button.

---

## 🎯 The Psychic's Objective
The Psychic must choose a **single clue** (word or short proper phrase) that simultaneously hints at the secret target's position on **both axes** ($X$ and $Y$) within the constraints of the assigned **Topic**.

*Example:*
* **Topic:** *Fictional Characters*
* **X-Axis:** *Pure Evil ($-1.0$)* $\leftrightarrow$ *Saintly & Pure ($+1.0$)*
* **Y-Axis:** *Ugly ($-1.0$)* $\leftrightarrow$ *Handsome ($+1.0$)*
* **Secret Target:** $(+0.85, -0.60)$ *(Saintly and Ugly)*
* **Legal Clues:** *"Quasimodo"*, *"The Elephant Man"*, *"Dobby"*
* **Illegal Clues:** *"Ugly Angel"* (uses axis word), *"Bottom-right hero"* (uses spatial direction)

---

## 🚫 Explicit Word Selection Rules

To protect game integrity and prevent cheap exploits, all clues must adhere to these five core rules:

### 1. Topic Constraint
* The clue **must strictly belong** to the active round's topic.
* If the topic is *Animals*, the clue must be an animal (real or mythological, e.g., *"Capybara"*, *"Pegasus"*). You cannot name a celebrity or a food item.

### 2. Length & Format (Max 3 Words)
* Clues should ideally be **a single word** or a **standard proper name/title** ($\le 3$ words).
* *Allowed:* *"Shrek"*, *"The Godfather"*, *"Ice Cream"*, *"Abraham Lincoln"*.
* *Disallowed:* Descriptive sentences (e.g., *"A very small green frog jumping"*).

### 3. No Axis Root Words or Synonyms (The "No Echo" Rule)
* The clue **cannot contain any word (or grammatical root)** currently displayed on either axis.
* *Example:* If the axis is *Hot $\leftrightarrow$ Cold*:
  * ❌ *Hotdog*, *Hottie*, *Coldplay*, *Cold brew*, *Heating pad*.
* This applies across all languages or obvious translations if playing multilingually.

### 4. No Spatial, Directional, or Coordinate Clues
* The clue **must never reference screen position, geometry, or compass directions**.
* Banned terms include:
  * *"Top"*, *"Bottom"*, *"Left"*, *"Right"*, *"Up"*, *"Down"*.
  * *"Center"*, *"Middle"*, *"Neutral"*, *"Corner"*, *"Diagonal"*, *"Quadrant"*.
  * *"High"*, *"Low"*, *"North"*, *"South"*, *"East"*, *"West"*.

### 5. No Numerical Scales or Quantitative Anchors
* Clues cannot communicate coordinates via numbers, percentages, or grades.
* *Banned:* *"Ten out of ten"*, *"50 percent"*, *"Tier 1"*, *"Level 99"*, *"Grade A"*.

### 6. Public Knowledge (No Private Inside Codes)
* A clue must be something that could reasonably be understood based on public knowledge, pop culture, or common sense. Clues like *"Dave's sweater last Tuesday"* are considered illegal table play.

---

## 🎲 The Psychic Reroll Button

Because finding a clue that satisfies **two distinct spectrums simultaneously** within a narrow topic can sometimes cause severe cognitive overload ("analysis paralysis"), every Psychic is equipped with a **1-time Reroll Button**.

```text
┌──────────────────────────────────────────────┐
│  Topic: Kitchen Appliances                   │
│  X: Sexy ↔ Unsexy   |  Y: Holy ↔ Demonic     │
│  Target: (+0.80, +0.90)                      │
│                                              │
│     [ 🎲 Reroll Attributes & Target (1 left) ]│
└──────────────────────────────────────────────┘
```

### Reroll Rules & Behavior
1. **Allowance:** Exactly **1 reroll per psychic turn**.
2. **Trigger:** The Psychic clicks the `🎲 Reroll` button on their device during `PSYCHIC_TURN`.
3. **Server Action:**
   * Generates a completely new random **Topic**.
   * Draws 2 new distinct **Axis Pairs**.
   * Generates a fresh random **Secret Target** $(x_s, y_s) \in [-0.85, 0.85]$.
   * Decrements `rerollsRemaining` from `1` to `0`.
   * Emits `psychic:rerolled` to the psychic and updates public room state for all players.
4. **Irreversible:** Once clicked, the previous target and axes are discarded and cannot be restored.
5. **Button State:** The button becomes disabled and shows `Reroll Used (0 left)`.

---

## ⚖️ Handling Disputed Clues

If a guesser believes the psychic violated one of the rules above:
* **Casual / Party Rule:** Any player can call for a vote during the `REVEAL` phase. If the majority agrees the clue broke a rule, the psychic receives $0\text{ pts}$ for the round (guessers keep their points).
* **Automated Client Validation (Regex):** 
  * The client and server run a simple string matching check: if `clue.toLowerCase()` contains any words from `axisX.negative`, `axisX.positive`, `axisY.negative`, or `axisY.positive`, the submission is rejected with an on-screen warning: *"Clue cannot contain words from the active axes!"*
