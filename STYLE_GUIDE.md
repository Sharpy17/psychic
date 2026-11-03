# Psychic Plane: Visual Style & Animation Guide

A brief for any AI or person making art, UI or animation for Psychic Plane.
It is based on the five reference images in the repo root:

| File | What it is |
|---|---|
| `242168a1809b628f7d3568fd87dc6531.jpg` | Comic-cover illustration: a woman detective crouching and writing in a notebook. A red string runs from a wall of pinned case notes to a blood stain on the floor |
| `8f534af41e91683d00f907e86520b23c.jpg` | Old group photo of 1940s people. Each face is covered by a cut-out newspaper label ("weirdly shallow", "secretly fearful", "too beautiful to die") |
| `a080171757e38df0c3f324185df1dea5.jpg` | Poster: Gothic spires in silhouette, a grainy angel statue with a swirl where its face should be, and the serif italic line *"Do you feel **diseased?**"* with the last word in red |
| `a0e20a3723b23045bb5e43b3dc996009.jpg` | 1930s–40s pulp-magazine ink illustration: a man in a fedora at a tavern door, with a small typeset caption |
| `detective.jpg` | Painted monochrome scene: a figure in a hat and trench coat lights a cigarette under a dark stone arch. Behind them is a foggy Gothic street with a church spire and a faint silhouette on the stairs |

> These are **mood references** by other artists (two are signed). Copy the *language*
> they share: palette, texture, composition and motifs. Do not copy the images, the
> characters or the artists' signatures.

---

## 1. The style in one paragraph (paste this into prompts)

> **Occult noir detective aesthetic.** 1930s–40s pulp and film-noir mood mixed with
> Gothic Europe and psychic mystery. Mostly monochrome: ink black, smoky greys and
> aged paper off-white, with **one accent colour, a deep blood/string red**, used
> sparingly for clues, connections and emphasis. Strong chiaroscuro: big blocks of
> solid black shadow, figures in silhouette against fog or bright doorways, light that
> comes from a single source (a lamp, a match, a doorway). The surface is analog and
> tactile: heavy film grain, halftone and photocopy dither, crosshatched ink lines,
> paper texture, cut-out newspaper type. The mood is quiet, uneasy and secretive:
> someone is being watched, faces are hidden, truths are pinned to a wall and joined
> with red string.

Short tag version for image generators:
`noir, occult detective, 1940s pulp illustration, gothic spires, fog, chiaroscuro, monochrome with single red accent, film grain, halftone dither, ink crosshatching, red string conspiracy board, redacted faces, collage of newspaper cut-outs, aged paper`

---

## 2. Visual language

### 2.1 Palette
Keep the image ~90% neutral. Red is a signal, not decoration.

| Role | Colour | Approx. hex |
|---|---|---|
| Ink black (shadows, silhouettes) | near-black, slightly warm | `#141112` |
| Deep shadow / charcoal | | `#2A2627` |
| Smoke grey (fog, mid-tones) | | `#7D7A78` |
| Fog / light grey | | `#BDB9B4` |
| Aged paper (highlights, cards, page) | warm off-white | `#E9E4DA` |
| **Accent red** (string, key word, blood, signature) | deep crimson | `#B3202A` |
| Dark red (dried blood, red on dark) | | `#7A1A1F` |
| Optional warm light (only in the "lit scene" mode) | dusty salmon/rust | `#D98468` → `#8E3B2A` |

Two allowed modes:
- **Cold mode** (default): pure greyscale plus red. From the poster, the photo collage and the painted street.
- **Warm lit mode**: a sepia/rust duotone for the "inside the investigation" moments, like the comic cover. Still only one red for clues.

### 2.2 Light & composition
- **One light source.** Doorway, gas lamp, match flame, window. Everything else falls off into black.
- **Silhouette first.** Figures and architecture should read as shapes before detail: fedoras, trench coats, spires, arches, iron fences, fire escapes.
- **Framing by architecture.** Arches, doorframes and pillars cut the frame into strong black verticals with a lit gap.
- **Tall compositions** with lots of negative space (black or fog) for text.
- **Depth through fog.** Background layers get lighter and lower in contrast.

### 2.3 Line & texture
- Ink linework with **crosshatching** and feathered strokes (pulp illustration). Line weight varies; shadows are filled solid black, not gradients.
- Painterly areas: flat, blocky value shapes with soft fog edges, no small fussy detail.
- **Grain everywhere.** Film grain or noise at roughly 4–8% opacity. Photos look **dithered/photocopied** (coarse halftone, crushed blacks).
- Paper: slight warmth, faint fibres, a little edge wear. Nothing should look clean and digital.

### 2.4 Recurring motifs (the game's symbols)
1. **Red string / conspiracy board.** Pinned notes, photos and documents joined by straight red lines that meet at a point. This means *connection, deduction, a psychic link*.
2. **Hidden faces.** Faces covered by cut-out type labels, black bars, or a spiral/swirl. This means *identity is secret, a role is unknown*.
3. **Cut-out newspaper words.** Small serif fragments on paper strips, slightly rotated, with uneven edges.
4. **Gothic skyline.** Spires, crosses, cathedral silhouettes. This means *the old world, the uncanny*.
5. **The detective figure.** Hat, coat collar up, face in shadow, a small light at the hands (match, cigarette, pen on a notebook).
6. **Blood / red trail.** A brushy red pool or loop on the floor, where the string ends. Use rarely.
7. **The spiral.** A hypnotic swirl in place of a face. This means *the psychic plane itself*.

### 2.5 Typography
- **Headlines:** classic book serif in *italic* (Garamond / Cormorant / EB Garamond style). Mix dark grey and accent red, and put the key word in red: *"Do you feel **diseased?**"*
- **Labels / clues:** small typewriter or old newspaper serif (Courier Prime, Special Elite, Old Standard) on paper strips.
- **Captions:** tiny, plain, left-aligned, like pulp-magazine captions ("A man was running toward the door…").
- **Vertical accent text** (a small red word running sideways along an edge) is allowed.
- No rounded, geometric or "app-like" sans-serifs in art or hero areas.

### 2.6 Do / Don't
**Do:** heavy blacks, one red, grain, paper, silhouettes, fog, hidden faces, restrained composition.
**Don't:** full colour, neon, glossy 3D, bright gradients, cartoon proportions, clean flat vector, emoji, big drop shadows, more than one accent colour, gore beyond a stylised red stain.

---

## 3. Animation guide

### 3.1 Motion philosophy
The world feels like **old film, a slow investigation and something watching you**.
Motion is **slow, deliberate and sparse**, with long holds and then a sudden, precise
action. Think of a match being struck in the dark, not a bouncing UI. Most of the frame
stays still while one thing moves.

### 3.2 Core rules
| Rule | Detail |
|---|---|
| Frame rate feel | Character/illustration animation **on 2s or 3s** (12 or 8 fps) for a hand-drawn, limited-animation feel. UI motion can stay smooth (60 fps) but should feel restrained |
| Easing | Slow-in, hard stop: `cubic-bezier(0.2, 0.0, 0.0, 1)` for reveals; plain `linear` for string drawing; **no bounce, no elastic, no overshoot** |
| Durations | Ambient loops 4–12 s · reveals 600–1200 ms · UI feedback 150–250 ms · dramatic beats get a 300–800 ms hold *before* they happen |
| Amount of motion | At most one main moving element per scene; everything else is ambient (grain, fog, flicker) |
| Colour in motion | Red appears *during* animation only to mark a clue, a link or a reveal. Red never pulses decoratively |

### 3.3 Always-on ambient layer (every screen)
- **Film grain:** a noise texture that changes every frame (or every 2nd frame) at about 5% opacity. Optional rare vertical scratch or dust speck (about 1 per 5–10 s).
- **Light flicker:** the main light source dims irregularly by 3–8% brightness, like a gas lamp. Use random intervals, never a steady sine.
- **Fog drift:** 2–3 parallax fog layers moving sideways very slowly (≈ 5–15 px/s), at different speeds.
- **Gate weave (optional):** the whole frame shifts 0.5–1 px at random, like an old projector.

### 3.4 Signature animations
1. **Red string connect** (the hero effect: clues, links, psychic connection)
   - A pin drops onto a note (a tiny 2 px settle, no bounce). After a beat, a red line *draws* from it to the target in a straight line, linear, 400–700 ms (SVG `stroke-dashoffset`).
   - When it arrives, the line goes taut with a 1-frame flash brighter and the target note shakes slightly (1–2 px, 2 frames).
   - Several strings can draw one after another (stagger 150–250 ms), all meeting at one point.
2. **Face redaction / identity reveal**
   - Hidden: a paper label slides in and lands rotated (−4° to 4°) over the face, like a hand placing a cut-out. 200 ms, then still.
   - Reveal: the label peels or tears away (lift with a slight rotation, then drop off-frame), or a black bar dissolves through dither noise (pixels flip, not fade).
3. **Spiral (psychic plane / "entering the mind")**
   - A swirl slowly turns where a face or object was (one rotation every 6–10 s). On transition it speeds up and pulls the frame inward (zoom + twist, 800 ms), then cuts to black.
4. **Match strike / spotlight reveal**
   - The screen is black. A tiny spark on 2s, then a warm glow quickly grows into a soft radial light (300 ms) that shows the subject. The flicker then settles in.
   - Use it to introduce a character, a player's turn, or a clue.
5. **Ink bleed / typewriter text**
   - Headlines: letters appear one at a time with a typewriter *strike* (each letter starts 10% darker and settles), or ink spreads into the letters from a blur.
   - The key word in red arrives last, after a short pause.
6. **Silhouette in the background**
   - A distant figure (as on the stairs in `detective.jpg`) appears or disappears between flickers. It is only visible on some frames and never moves while you are looking. Use it sparingly, for unease.
7. **Blood / red trail**
   - The red stain spreads slowly from where the string ends (organic, irregular edge, 1–2 s). Only for elimination or a "failed" reveal.

### 3.5 Transitions between screens
- **Iris / vignette close** to black (old film), or **hard cut** with one blank black frame.
- **Paper slide:** the next screen arrives as a new document laid on top of the old one (slight rotation, shadow, settle).
- **Film burn / overexposure** (white flare with grain) for dramatic moments only.
- Never use slide-swipe or zoom-bounce app transitions.

### 3.6 UI motion (lobby, board, scores)
- Buttons: on hover, the ink darkens and a thin red underline draws left → right (200 ms). On press, a 1 px "stamp" push down with no scale bounce.
- Cards / notes: they sit slightly rotated. On hover they lift (tiny shadow growth, 1–2° straighten). When selected, a pin appears and a red string starts.
- Score changes: numbers flip like a typewriter or ticker. A gain gets a short red underline, not a colour flash.
- Loading: a spiral slowly turning, or a red string pacing between two pins.

### 3.7 Sound pairing (if audio is added)
Room tone or rain, a ticking clock, a match strike, typewriter keys, paper rustle, a
pin into cork, a low string drone at reveals. No upbeat music, no UI "blips".

### 3.8 Technical notes for implementers
- Grain: a full-screen `<canvas>` or a tiled noise PNG with its `background-position` changed every frame via `steps()`. Use `mix-blend-mode: overlay/multiply`.
- Dither reveals: an SVG `feTurbulence` + threshold mask, or a precomputed Bayer-dither mask sequence.
- Red strings: SVG `<line>`/`<path>` with `stroke-dasharray` + `stroke-dashoffset` animation. Stroke `#B3202A`, width 2–3 px, with a slight 0.5 px darker shadow.
- On-2s look in CSS: `animation-timing-function: steps(n)`, or update sprite frames at 12 fps.
- Respect `prefers-reduced-motion`: turn off grain flicker, gate weave, spiral spin and the background silhouette, and keep only instant state changes and short fades.

---

## 4. Ready-to-paste prompts

**Still image:**
> Occult noir detective illustration, 1940s pulp style, monochrome ink black and fog grey
> on aged paper, single deep crimson accent (#B3202A) used only for a red string linking
> pinned clues. Strong chiaroscuro, one light source, silhouette of a figure in fedora and
> trench coat, gothic spires in fog behind, crosshatched ink shadows, heavy film grain and
> halftone dither, faces hidden by cut-out newspaper labels. Quiet, uneasy, secretive mood.
> No full colour, no neon, no glossy 3D.

**Animation:**
> Animate in an occult film-noir style: limited animation on 2s, long still holds with one
> precise action. Constant subtle film grain, irregular gas-lamp flicker, slow parallax fog.
> Hero motion: a red string drawing in a straight line between pinned notes, linear, ending
> with a tiny taut snap. Reveals by dither dissolve or a paper label peeling off a face.
> Transitions by iris-to-black or a hard cut. Slow-in, hard-stop easing, no bounce, red used
> only to mark clues and reveals.
