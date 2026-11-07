# Design

## Context

`OpenPsychic` holds OpenSpec scaffolding and this page. It is not a git repository and has no build tooling. See `proposal.md` for motivation and `specs/` for required behaviour.

The page in `landing/` was designed from scratch at the client's request, and replaces an earlier version in `site/`. Only the game's rules carry over from that version's planning documents. The game repository is not available in this project, so those rules have not been rechecked against its code in this revision.

## Goals / Non-Goals

**Goals:**
- A page that reads as beautiful and mindful: calm, with room to breathe, and specific to this game.
- One memorable idea: the newspaper's folds are the game's axes.
- No tooling to maintain: the page opens from disk or any static host.

**Non-Goals:**
- A newspaper skin on generic landing-page parts (feature cards, icon rows, pricing blocks).
- Dense broadsheet columns, hairline-ruled layouts, or joke newspaper furniture.
- Live room creation, or sharing the game's code.

## Decisions

### 1. Concept: the folds are the axes

A folded newspaper has two creases that cross. Here they are the chart's two axes, so the front page is the game board.

- The horizontal fold runs the full width of the window and through the centre of the chart.
- From 1040px, the vertical fold runs the length of the page as a spine, and the chart's vertical axis lies on it.
- The nameplate splits across the spine as "Psychic | Plane". The closing line repeats this as "Gather | your people".
- Inside pages sit on either side of the spine.

**Why not a boxed chart beside a story?** It would make the game an illustration on the page. This way the page and the game are one object.

### 2. Layout

| Width | Front page | Inside pages |
|---|---|---|
| 1040px and up | Three columns with the chart in the centre. Text gathers above and below the horizontal fold. | Two columns either side of the spine |
| 760–1039px | Stacked, with the chart centred | Two columns either side of a spine |
| Below 760px | Stacked: headline, intro, button, clue, chart, reveal | One column |

Two equal grid rows place the fold at the chart's centre whatever the text length. Text never crosses a fold. Printer's crop marks, rather than a box, show the chart's edges. Each inside-page column runs independently, like a newspaper page, so the two need not end level.

### 3. Palette and type

| Token | Value | Use |
|---|---|---|
| `--paper` | `#E4E5DD` | Cool newsprint, across the whole window |
| `--ink` | `#151D30` | Everything printed |
| `--ink-faded` | `#4B5263` | Secondary text |
| `--pen` | `#1D3AB8` | Only what the reader does: pin, line to the target, buttons and handwritten score |

The reader is writing on the paper with a ballpoint, so blue always means "you". The target and scoring rings are printed in ink.

Type comes from Google Fonts with serif fallbacks:

- **Newsreader** for everything printed, drawn for news and set light and large.
- **Reenie Beanie** for the reader's handwritten score only. It is loaded up front, so the first score does not appear in a fallback font and jump.

Fold shading is the only gradient, and it depicts the crease. There are no raster images.

### 4. Scoring shown at scale

"How points work" draws the rings at their true scoring distances on the chart's scale, with a table below for exact figures. This teaches how small a Bullseye is in a way a table alone cannot.

### 5. Sample round

Two states, placing and revealed, on inline SVG. Coordinates use the game's space, −100 to +100 with y up, so scoring and the published table agree directly. Only drawing converts to SVG space.

- **Input:** Pointer Events, with `touch-action: none` on the chart only. Arrow keys move by 2 units, Shift+arrow by 10, and Enter reveals.
- **Reveal:** a slightly bowed pen line draws from pin to target, then the rings and handwritten score appear. With reduced motion everything appears at once.
- **Announcements:** one polite live region, with the pin's position worded in axis terms.
- **Clues:** four original clues with authored targets, because a preset clue with a random target would make no sense.

| Clue | X axis (− / +) | Y axis (− / +) | Target |
|---|---|---|---|
| A lighthouse in the desert | Ordinary / Strange | Sad / Hopeful | (74, −22) |
| Sunday evening | Restful / Stressful | Quiet / Loud | (38, −58) |
| Taking the last slice | Worthless / Priceless | Polite / Rude | (55, 46) |
| A handwritten letter | Forgettable / Unforgettable | Cold / Warm | (62, 70) |

### 6. Motion

The folds open once on load. Everything after that answers something the reader did: the reveal, and a pulse on the pin when a play link points at the chart.

### 7. Stack: static files, no build

```text
landing/
  index.html   all content, readable without scripts
  styles.css
  round.js     sample round, play links and date
```

A classic `<script defer>` is used because modules do not load from `file://`.

**Why not a framework?** This is one static document, and a toolchain would add maintenance with no benefit.

### 8. Calls to action

In the HTML, each play link is `<a href="#round">` labelled "Play the sample round", which works with no JavaScript and no address. Setting `PLAY_URL` in `round.js` changes each link's address and label to "Start a room".

## Risks / Trade-offs

- **Game rules drift from the copied figures** → The figures live in `index.html` and `round.js`. Recheck them against the game before launch and whenever it changes.
- **The chart fills a phone's width, so a swipe starting on it moves the pin rather than scrolling** → Dragging the pin needs this. The page can still be scrolled from above and below the chart.
- **The page departs from the game's noir style** → This is deliberate, following the client's request to start fresh. The game and its landing page will look different unless the game's style is revisited.
- **Google Fonts is an outside request** → The page works with fallbacks, and the sample round makes no requests itself.
- **Empty `PLAY_URL` at launch means no live game link** → Labels stay honest and lead to the sample round.
- **No automated tests** → Removing `tests/` leaves none, and the checks on `landing/` were run from temporary scripts. Permanent tests can be added if the page changes often.

## Migration Plan

`site/` and `tests/` have been deleted, and `landing/` is now the only page. They were not under version control, so they cannot be restored.

## Open Questions

- **Public game address:** what should `PLAY_URL` be? It is a one-line change.
- **Hosting:** any static host works, and the choice does not affect this change.
