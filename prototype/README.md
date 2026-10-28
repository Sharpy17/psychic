# `frontend` branch: landing page prototype

**Owner:** Azim (Landing Page & UI Shell)
**Based on:** `main` at `d4dac08` (the team scaffold), plus one folder: `prototype/`
**Status:** clickable mockup, not connected to the server, not yet ported to React

This branch holds **only the landing page** for Psychic Plane, built as a single HTML file
so the team can click through it and agree on the look and feel before it's turned into
`LandingPage.tsx`. Nothing in the React app (`client/`), the server or the database is
changed on this branch.

> The full clickable prototype (lobby, game board, reveal, live scoreboards, bots) is on
> the **`demo`** branch. This branch is the landing page cut out of it.

---

## Run it

No install, no build, no internet needed.

```bash
git clone https://github.com/Sharpy17/psychic.git
cd psychic
git checkout frontend
```

Then double-click `prototype/landing.html`, or drag it into a browser.

---

## What's in this branch

```text
psychic/
├── client/ server/ shared/ database/ ...   ← unchanged from main
└── prototype/
    ├── landing.html   ← the whole landing page: HTML, CSS and JS in one file
    └── README.md      ← this file
```

`landing.html` has no dependencies and loads nothing from the network: no fonts, images
or libraries. Its icons are emoji and inline SVG, and its sounds are generated in code.

---

## The page, top to bottom

| Section | What's there |
|---|---|
| **Nav** (sticky) | Logo, links to *How to play* / *Features*, 🔊 sound toggle, **Join room**, **Play now** |
| **Hero** | Headline, tagline, **Create a room** and **Join with a code** buttons, "Free to play / No downloads / Works on phones" |
| **Demo board** | A playable round on the 2D board (details below) |
| **How to play** | 3 steps: the psychic peeks, gives one clue, everyone places a dot |
| **Features** | 4 cards: every player for themselves, phone-friendly, endless combos, 4-letter rooms |
| **Call to action** | "Gather your crew" with **Create a room** |
| **Footer** | Rules (jumps to *How to play*), Privacy and Contact (show "Coming soon") |

### Every button and what it does

| Button | Result |
|---|---|
| **Play now** / **Create a room** (3 places) | Opens the *Create a room* box: enter a name, then you get a random 4-letter room code with **Copy code** and **Go to lobby** |
| **Join room** / **Join with a code** | Opens the *Join a room* box with 4 letter boxes. Typing jumps to the next box, Backspace goes back, pasting a code fills all four, letters only. An incomplete code shakes the box |
| **Go to lobby** / **Join** | Closes the box and shows "the lobby isn't built yet". The lobby isn't on this branch (see `demo`) |
| **Copy code** | Copies the room code to the clipboard |
| **Reveal target** | Shows the hidden target rings and your score; the button becomes **Play again** |
| **New card** | New labels, new clue, new hidden target |
| **🔊 / 🔇** | Turns click sounds on and off |
| **Esc**, clicking outside, **Cancel** | Closes any open box |

Every `.btn` sinks when pressed, shows a ripple and plays a short click.

### The demo board

- A square board with **4 labels** (top/bottom and left/right), e.g. *Funny / Unfunny* × *Ugly / Cute*.
- A sample clue from "Ari". Drag the dot, or tap anywhere to jump it there.
  Arrow keys move it, **Shift + arrow** moves faster, **Enter** reveals.
- **Reveal** pops in 3 rings around the hidden target and draws a dotted line from your dot to it.
- Scoring, by distance on a 0–100 board:

  | Distance from target | Points |
  |---|---|
  | within 5 | **4** (bullseye) |
  | within 11 | **3** |
  | within 18 | **2** |
  | further | 0 |

- 6 built-in cards, cycled with **New card**:

  | Top / Bottom | Left / Right | Clue |
  |---|---|---|
  | Funny / Unfunny | Ugly / Cute | A pug in a hot dog costume |
  | Expensive / Cheap | Gross / Delicious | Airport sushi |
  | Scary / Not scary | Tiny / Huge | A goose |
  | Cool / Cringe | Useless / Useful | A fanny pack |
  | Exciting / Boring | Easy / Hard | Learning to juggle |
  | Healthy / Unhealthy | Bland / Tasty | Kale chips |

---

## Behaviour details

- **Responsive:** below 900px the hero stacks and the board goes under the text. Below 680px the nav links hide and cards go to one column.
- **Accessibility:** keyboard focus rings, the board works with the arrow keys, Esc closes boxes, focus returns to the button that opened a box, and animations turn off when the system is set to *reduce motion*.
- **Fake data:** the room code is random and isn't sent anywhere. The player count (3–8) and the "Ari" clue are placeholder copy.
- **Name:** the page still says *Mind Meter*, a placeholder. Swap it for *Psychic Plane* when porting.

---

## Inside `landing.html`

| Part | Contents |
|---|---|
| `<style>` (1st) | Board styles: board, labels, rings, dot |
| `<style>` (2nd) | Page styles: colour variables in `:root`, buttons, nav, hero, sections, modals, toast, responsive rules |
| `<script>` (1st) | `createBoard()`, the reusable board component, plus `scoreForDistance()` |
| `<script>` (2nd) | Helpers and toast · sound (`blip()`, Web Audio) · button ripple · demo board (`CARDS`, `newCard()`, `reveal()`) · modals (`createModal()`, `joinModal()`) · button actions (one `data-action` click handler) |

To add a button, give it `class="btn"` (plus `primary` / `ghost` / `big`) and a
`data-action="..."`, then handle that action in the click handler at the bottom.

---

## Porting to React (next step)

| From | To |
|---|---|
| Page markup and modals | `client/src/components/LandingPage.tsx` |
| Page styles and colour variables | `client/src/index.css` (or Tailwind classes) |
| `createBoard()` | Reuse for, or merge into, `GameBoard.tsx` (Dosia) |
| Create / Join submit | `room:create` / `room:join` socket events from `shared/types.ts` |

**Coordinates differ.** The prototype uses 0–100 with y pointing **down**. `shared/types.ts` uses −100 to +100 with y pointing **up**:

```ts
const toShared = (p: { x: number; y: number }) => ({ x: p.x * 2 - 100, y: 100 - p.y * 2 });
const fromShared = (c: { x: number; y: number }) => ({ x: (c.x + 100) / 2, y: (100 - c.y) / 2 });
```

---

## Branches at a glance

| Branch | Purpose |
|---|---|
| `main` | Team scaffold (React client, Socket.IO server, shared types, Prisma). Nobody commits directly |
| `frontend` | **This branch.** Landing page prototype only |
| `demo` | First full variant to refer to: landing page plus the whole clickable game prototype with bots |
