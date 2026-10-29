# 04 - 2D Coordinate Board Component (SVG)

This component is the visual heart of the game. It must be responsive, touch-friendly, and capable of rendering 3 distinct modes:
1. **Psychic Mode:** Shows the secret target point $(x_s, y_s)$ as a glowing icon.
2. **Guesser Mode:** Lets the player drag or tap to reposition their own pin; shows axes and topic labels.
3. **Reveal Mode:** Renders the secret bullseye rings and drops all players' pins onto the board with animated lines to the target.

---

## 🎨 Visual Specifications

* **Aspect Ratio:** Square ($1:1$, e.g. `w-full max-w-[500px] aspect-square mx-auto`).
* **SVG internal viewBox:** `0 0 1000 1000`.
* **Grid lines:**
  * Subtle background grid lines at $0.25, 0.50, 0.75$ intervals (opacity 10-15%).
  * Thick center axes ($x = 0, y = 0$) dividing the board into 4 quadrants.
* **Axis Labels:**
  * Placed just outside the coordinate boundary or in pill badges at the four edges:
    * Left: `axisX.negative`
    * Right: `axisX.positive`
    * Top: `axisY.positive`
    * Bottom: `axisY.negative`

---

## 📍 Pin Rendering
* **Player Pin:**
  * Circle ($r = 18$) with player's avatar color and a white border.
  * Small name label pill below the pin.
* **Secret Target (Psychic & Reveal):**
  * Center dot ($r = 12$) in vibrant gold.
  * Concentric translucent circles corresponding to score tiers:
    * Bullseye: $r = 75$ (scaled from $0.15 \times 500$)
    * Close: $r = 175$ (scaled from $0.35 \times 500$)
    * Warm: $r = 300$ (scaled from $0.60 \times 500$)
    * Edge: $r = 450$ (scaled from $0.90 \times 500$)

---

## 👆 Touch & Interaction Handling

```tsx
// React Pseudo-code for Board Interaction
<svg
  viewBox="0 0 1000 1000"
  className="w-full h-full touch-none select-none"
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
>
  {/* Quadrant backgrounds / Grid */}
  <rect x="0" y="0" width="1000" height="1000" fill="#18181B" rx="16" />
  
  {/* Crosshair Axes */}
  <line x1="500" y1="0" x2="500" y2="1000" stroke="#3F3F46" strokeWidth="3" />
  <line x1="0" y1="500" x2="1000" y2="500" stroke="#3F3F46" strokeWidth="3" />

  {/* Reveal Rings (Only rendered in REVEAL mode) */}
  {isReveal && <ScoringRings target={secretTarget} />}

  {/* Active Player Pin */}
  {currentGuess && (
    <PlayerPin 
      x={currentGuess.x} 
      y={currentGuess.y} 
      color={playerColor} 
      isDraggable={isGuessingPhase && !isLocked}
    />
  )}

  {/* Other Players' Pins (Only shown on REVEAL) */}
  {isReveal && allGuesses.map(g => (
    <PlayerPin key={g.playerId} {...g} />
  ))}
</svg>
```
