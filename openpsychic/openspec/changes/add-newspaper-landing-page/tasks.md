# Tasks

Throughout: do not copy from `site/` or from the game repository's `client/src/landing/`, `client/src/components/LandingPage.tsx`, `prototype/` or `redesign-landing-newspaper` change.

## 1. Page and content

- [x] 1.1 Create `landing/` with `index.html`, `styles.css` and `round.js`, and verify `index.html` opens from disk with its styles and script applied.
- [x] 1.2 Write the semantic structure, with the nameplate as the `h1` and a "Psychic Plane" document title, and verify headings run h1, h2, h3 with no skipped levels.
- [x] 1.3 Write the nameplate, date line and front-page text, and verify the copy conveys one clue and two axes.
- [x] 1.4 Write "How a round goes" in the order target, clue, guesses, reveal, including psychic rotation, and verify the page presents them in that order.
- [x] 1.5 Write "How points work" and the psychic's average rule, and verify all five tiers appear in an HTML table with column headers.
- [x] 1.6 Write "What a room looks like", and verify the code length, player limit, rounds and time limit match the spec.
- [ ] 1.7 Check the rules, scoring and room facts against the game's code, and verify they match or correct them.

## 2. Folded newsprint design

- [x] 2.1 Build the fold axes, split nameplate and spine, and verify at 1280×800 that the nameplate, headline, call to action and chart are visible without scrolling.
- [x] 2.2 Add the tablet and phone layouts, and verify in a 390px-wide frame that the nameplate, headline and call to action fall within the first 844px, and that 320, 390 and 768px have no sideways scrolling.
- [x] 2.3 Review a 1920×1080 screenshot, and verify the content stays bounded with several columns.
- [x] 2.4 Load the page without web fonts, and verify the fallback serif causes no overlapping or clipped text.
- [ ] 2.5 Measure text contrast, and verify all text meets WCAG AA.
- [ ] 2.6 Tab through the page, and verify every interactive element shows a visible focus indicator in reading order.

## 3. Sample round

- [x] 3.1 Draw the chart with clue, four axis labels and a centred pin, and verify with a scripted check that no target position is set before reveal.
- [x] 3.2 Add scoring, and verify with scripted checks that an exact hit, a pin 30 units away, a pin exactly 15 units away and a distant pin give the specified results.
- [x] 3.3 Add keyboard control, and verify with scripted checks that arrows and Shift+arrows move the pin, the edge stops it, Enter reveals and the position is announced.
- [x] 3.4 Lock the pin after reveal, and verify with a scripted check that later taps and keys change nothing.
- [x] 3.5 Add the four clues and the next-clue cycle, and verify with scripted checks that the state resets and the set wraps from last to first.
- [x] 3.6 Add reveal motion, and verify that each reveal animation ends fully visible and that a reduced-motion render shows the result immediately.
- [x] 3.7 Add the JavaScript-required message, and verify on a copy with scripts removed that the message and all explanatory content display.
- [ ] 3.8 Drag and swipe on a real touch device, and verify the pin stops at the edges and the page scrolls when swiped outside the chart.
- [ ] 3.9 Play a round with a screen reader, and verify the pin's position and the result are announced.
- [ ] 3.10 Play a full round with the Network panel open, and verify that placing, revealing and advancing make no requests.

## 4. Calls to action

- [x] 4.1 Author all play links to the sample round, and verify their labels and addresses in the page source.
- [x] 4.2 Apply `PLAY_URL` to each link, and verify on a temporary copy with a test address that every link changes, leaving `PLAY_URL` empty in `landing/round.js`.

## 5. Replacing the earlier page

- [x] 5.1 Delete `site/` and `tests/`, and verify `landing/` still loads and no longer has either folder beside it.

## 6. Final review

- [ ] 6.1 Walk through every scenario in `specs/landing-page/spec.md` and `specs/landing-sample-round/spec.md`, and verify each passes or fix it.

## Workflow follow-up

- Set `PLAY_URL` once the game has a public address.
- Archive the change after review.
