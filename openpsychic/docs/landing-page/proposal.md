# Proposal

## Why

Psychic Plane is a multiplayer party game with no public page in this project that explains it or sends people to it. The game is hard to describe but quick to grasp once tried, so its first page has to teach the two-axis idea at a glance. A folded newspaper suits that job, because its two creases can be the game's two axes.

## What Changes

- Add a new, standalone landing page for Psychic Plane, designed as a folded newspaper whose creases cross at the centre of the game's chart.
- Add a playable sample round on the front page: the reader reads a clue, places a pin on a two-axis chart, and reveals the hidden target and their score.
- Explain the real game (roles, round flow, scoring, room facts).
- Add calls to action that open the game once its public address is configured, and that lead to the sample round until then, so no button is ever a dead end.
- Design and write the page from scratch. No code, copy, layout or sample content is taken from any earlier Psychic Plane landing page, prototype or landing-page change. This includes the earlier version of this change in `site/`, which `landing/` replaces.

**Out of scope:**
- Changes to the game repository (`Psychic/psychic`), including its client, server and existing landing page.
- Creating or joining rooms from this page. It has no connection to the game server.
- Hosting and deployment, analytics, localisation, and a print stylesheet.

## Capabilities

### New Capabilities

- `landing-page`: The public newspaper-style page: its edition structure, game explanation, content accuracy, calls to action, visual identity, responsive layout and accessibility.
- `landing-sample-round`: The playable single-player sample round on the landing page: placing a pin, revealing the target, scoring and moving to the next puzzle.

### Modified Capabilities

None. The project has no existing specs.

## Impact

- **New code:** a static page in `landing/`. It needs no framework, build step or runtime package.
- **Removed code:** the earlier page in `site/` and its tests in `tests/`.
- **External dependency:** web fonts from Google Fonts, with serif fallbacks if they fail to load.
- **Game facts:** the rules and figures on the page must match the game. If the game changes, the page copy and scoring must be updated by hand.
- **Existing systems:** none affected.
