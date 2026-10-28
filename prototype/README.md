# Psychic Plane: landing page prototype (Azim)

A clickable, no-build mockup of the landing page, made to try out the look and feel
before porting it into the React app. Nothing in here is imported by the real app.
("Mind Meter" is a placeholder name.)

Open `prototype/landing.html` in a browser. It's a single file with no install or build step.

## What's on the page

- Nav with sound toggle, **Join room** and **Play now**
- Hero with **Create a room** / **Join with a code**
- A playable demo board: four labels, drag or tap the dot (arrow keys work), **Reveal target**, **New card**
- How to play, features, call to action, footer
- Create-room modal (name, then a room code with copy) and join modal (4 letter boxes, paste support)
- Pressable buttons with ripple and click sounds, toasts, phone layout, reduced-motion support

The lobby and game aren't on this branch, so "Go to lobby" just shows a message.
The full clickable game prototype lives on the `demo` branch.

## Porting

`landing.html` → `client/src/components/LandingPage.tsx`, styles → `client/src/index.css`.
The demo board uses coordinates from 0 to 100 with y pointing down; the real contract in
`shared/types.ts` uses -100 to +100 with y pointing up.
