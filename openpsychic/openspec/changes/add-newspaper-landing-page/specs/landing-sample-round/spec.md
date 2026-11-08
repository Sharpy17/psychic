# Spec Delta

## Purpose

Lets a visitor experience one round of Psychic Plane on the landing page, alone and without a server, so the two-axis idea is understood by playing it.

## ADDED Requirements

### Requirement: Puzzle presentation
The sample round SHALL show a square plane with four labelled axis ends and a one-line clue. A pin SHALL start at the centre, and the target SHALL stay hidden until reveal.

#### Scenario: Puzzle is first shown
- **WHEN** the sample round first appears
- **THEN** the clue, all four axis labels and a centred pin are visible, and no target is shown

### Requirement: Placing the pin by pointer
The reader SHALL be able to place the pin by tapping or clicking the plane and by dragging it. The pin SHALL stay within the plane. Touch input outside the plane SHALL continue to scroll the page.

#### Scenario: Tap to place
- **WHEN** the reader taps a point on the plane
- **THEN** the pin moves to that point

#### Scenario: Drag past the edge
- **WHEN** the reader drags the pin beyond the plane's edge
- **THEN** the pin stops at the edge

#### Scenario: Scrolling past the puzzle
- **WHEN** the reader swipes vertically on the page outside the plane
- **THEN** the page scrolls

### Requirement: Placing the pin by keyboard
The plane SHALL be focusable. Arrow keys SHALL move the pin by a small step, Shift with an arrow key by a larger step, and Enter SHALL reveal. The pin's position SHALL be announced to assistive technology in terms of the axis labels.

#### Scenario: Keyboard placement
- **WHEN** the plane has focus and the reader presses an arrow key
- **THEN** the pin moves in that direction and its new position is announced

#### Scenario: Keyboard reveal
- **WHEN** the plane has focus and the reader presses Enter before revealing
- **THEN** the target and score are revealed

### Requirement: Reveal and score
Revealing SHALL show the target, a pen-blue line from pin to target, the distance, the tier name and the points. Scoring MUST use the published tiers on the −100 to +100 plane, with a distance exactly on a tier limit earning that tier.

#### Scenario: Pin within a tier
- **WHEN** the reader reveals with the pin 30 units from the target
- **THEN** the result reads Excellent, 750 points, with a distance of 30

#### Scenario: Pin exactly on a limit
- **WHEN** the reader reveals with the pin exactly 15 units from the target
- **THEN** the result reads Bullseye, 1000 points

#### Scenario: Pin far from the target
- **WHEN** the reader reveals with the pin more than 90 units from the target
- **THEN** the result reads Miss, 50 points

#### Scenario: Result is announced
- **WHEN** the reveal happens
- **THEN** the tier, points and distance are announced to assistive technology

### Requirement: Pin locks after reveal
After reveal the pin SHALL NOT move until the next puzzle begins.

#### Scenario: Attempted move after reveal
- **WHEN** the reader taps the plane or presses an arrow key after revealing
- **THEN** the pin, line and score do not change

### Requirement: Next puzzle
After reveal the reader SHALL be able to start another puzzle. It SHALL show a different clue and axes, re-centre the pin and hide the target and result. Puzzles SHALL cycle endlessly in a fixed order.

#### Scenario: Moving on
- **WHEN** the reader chooses the next puzzle
- **THEN** a different clue and axes appear, with the pin centred and no target or score visible

#### Scenario: Last puzzle reached
- **WHEN** the reader chooses the next puzzle after the last one
- **THEN** the first puzzle appears again

### Requirement: Clue fits its target
Each puzzle's target SHALL be a position its clue plausibly describes on that puzzle's axes, and SHALL lie within ±85 on both axes, the same bounds the game uses for targets.

#### Scenario: Editor checks a puzzle
- **WHEN** a puzzle's clue, axes and target are reviewed
- **THEN** the target lies within bounds and its position makes sense for the clue

### Requirement: Works alone and offline from the game
The sample round MUST make no network requests and MUST NOT need a game server, an account or other players. It SHALL be identified as a sample, not a live game.

#### Scenario: Playing with the game server down
- **WHEN** the reader plays the sample round and no game server is reachable
- **THEN** placing, revealing and moving to the next puzzle all work, and no request is made for them
