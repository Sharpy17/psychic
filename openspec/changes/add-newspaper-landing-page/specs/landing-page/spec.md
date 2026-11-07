# Spec Delta

## Purpose

Presents Psychic Plane to first-time visitors as a newspaper edition that explains the game accurately and leads them to play it.

## ADDED Requirements

### Requirement: Newspaper edition structure
The page SHALL read as one newspaper edition, in this order: a nameplate carrying the game's name with a date line, a front page built around the sample round with visible folds as its axes, inside pages, a closing call to action, and a colophon.

#### Scenario: Reader scrolls the whole page
- **WHEN** a visitor scrolls from the top of the page to the bottom
- **THEN** they pass the nameplate, front page, inside pages, closing call to action and colophon in that order

#### Scenario: Folds are the axes
- **WHEN** the sample round is shown
- **THEN** a fold runs through the chart along each axis, crossing at the chart's centre

#### Scenario: Game name is the page identity
- **WHEN** the page is loaded
- **THEN** the document title and the top-level heading both contain "Psychic Plane"

### Requirement: First screen explains and invites
The first screen SHALL show the game's name, a headline conveying the one-clue, two-axis idea, and a call to action, without scrolling.

#### Scenario: Desktop first screen
- **WHEN** the page loads in a 1280×800 viewport
- **THEN** the nameplate, lead headline, a call to action and the sample-round plane are all visible without scrolling

#### Scenario: Phone first screen
- **WHEN** the page loads in a 390×844 viewport
- **THEN** the nameplate, lead headline and a call to action are visible without scrolling

### Requirement: Explanation of a full round
The page SHALL explain a round in order: the psychic privately sees a target on a plane with two labelled axes, gives one clue, the other players place their guesses within the time limit, then the target and scores are revealed. It SHALL state that the psychic role rotates.

#### Scenario: Reader learns the round flow
- **WHEN** a visitor reads the round explanation
- **THEN** it presents target, clue, guesses and reveal in that order, and says the psychic role moves to another player between rounds

### Requirement: Accurate scoring table
The page SHALL publish the scoring tiers on the game's −100 to +100 plane: within 15 units 1000 points (Bullseye), within 35 750 (Excellent), within 60 500 (Great), within 90 250 (Close), further 50 (Miss). It SHALL state that the psychic earns the average of the guessers' scores.

#### Scenario: Reader checks scoring
- **WHEN** a visitor reads the scoring section
- **THEN** all five tiers appear with the stated distances and points, in an HTML table with column headers

#### Scenario: Psychic's reward is explained
- **WHEN** a visitor reads the section on writing clues
- **THEN** it says the psychic's score for a round is the average of the guessers' scores

### Requirement: Accurate room facts
The page SHALL state the game's current room defaults: a 4-character room code, up to 8 players, 4 rounds and a 60-second time limit.

#### Scenario: Reader checks room facts
- **WHEN** a visitor reads the room facts
- **THEN** each of the four values appears as stated above

### Requirement: No unsupported claims
The page MUST NOT present invented reviews, testimonials, press quotes, player counts or awards as genuine, and MUST NOT state a price or device support the project has not confirmed. Humorous newspaper copy SHALL be clearly in-world, attributed to no real person or publication.

#### Scenario: Editor reviews the copy
- **WHEN** the page copy is reviewed
- **THEN** it contains no real-person quote, statistic, award or review, and no claim that the game is free or works on particular devices

### Requirement: Original work
The page's code, copy, layout and sample content MUST NOT be taken from any earlier Psychic Plane landing page, prototype or landing-page change.

#### Scenario: Reviewer compares sources
- **WHEN** the page's files are reviewed
- **THEN** none of them links to, imports or copies files from the earlier `site/` page or the game repository's landing or prototype code

### Requirement: Calls to action always lead somewhere
Every call to action SHALL open the game when a play address is configured. When none is configured, each SHALL lead to the sample round and be labelled for that purpose.

#### Scenario: Play address configured
- **WHEN** a play address is configured and a visitor activates a call to action
- **THEN** the game opens at that address

#### Scenario: No play address configured
- **WHEN** no play address is configured and a visitor activates a call to action
- **THEN** the page moves to the sample round, and the label promises the sample round rather than a live game

### Requirement: Folded newsprint identity
The page SHALL use blue-black ink on cool newsprint, with pen blue as the only accent colour, reserved for what the reader does. Printed text SHALL be serif, with handwriting used only for the reader's score. It MUST NOT use emoji, gradients as decoration or rounded app-like cards.

#### Scenario: Visual review
- **WHEN** the page is reviewed at any supported width
- **THEN** pen blue appears only on the pin, the line to the target, the buttons and the handwritten score, and no listed exclusion appears

### Requirement: Responsive layout
The page SHALL keep its newspaper character from 320px to 1920px wide, reducing columns as width shrinks, with no horizontal page scrolling and no clipped text.

#### Scenario: Narrow phone
- **WHEN** the page is viewed 320px wide
- **THEN** reading content is in a single column, the page does not scroll sideways, and body text is at least 16px

#### Scenario: Wide desktop
- **WHEN** the page is viewed 1920px wide
- **THEN** the paper fills the window while the content keeps a bounded width with several text columns, rather than stretching lines across the screen

### Requirement: Accessible reading
The page SHALL use semantic landmarks and an ordered heading structure, keep text contrast at WCAG AA or better, show a visible keyboard focus indicator, and remain fully readable when animation is reduced or fonts fail to load.

#### Scenario: Keyboard reader
- **WHEN** a visitor moves through the page with the Tab key
- **THEN** every interactive element receives a visible focus indicator, in reading order

#### Scenario: Reduced motion
- **WHEN** the visitor's system requests reduced motion
- **THEN** non-essential animation does not play and no content is lost

#### Scenario: Fonts unavailable
- **WHEN** the web fonts fail to load
- **THEN** the page renders in a fallback serif with no overlapping or clipped text

### Requirement: Readable without scripts
All explanatory content SHALL be available when JavaScript is disabled, and the page SHALL say that the sample round needs JavaScript.

#### Scenario: JavaScript disabled
- **WHEN** the page loads with JavaScript disabled
- **THEN** the story, round explanation, scoring and room facts are readable, calls to action go to the sample-round section, and that section explains that JavaScript is required to play
