# 02 - Coordinate System & Math

This document explains the mathematical mapping between screen pixels, SVG viewports, and game coordinates.

---

## 📐 Normalized Cartesian Coordinate Space

The logical game board is a unit square spanning:
* **X-Axis:** $[-1.0, +1.0]$
  * Left border: $-1.0$ (Negative Attribute, e.g. *Ugly*)
  * Center: $0.0$ (Neutral)
  * Right border: $+1.0$ (Positive Attribute, e.g. *Handsome*)
* **Y-Axis:** $[-1.0, +1.0]$
  * Bottom border: $-1.0$ (Negative Attribute, e.g. *Boring*)
  * Center: $0.0$ (Neutral)
  * Top border: $+1.0$ (Positive Attribute, e.g. *Funny*)

```text
               +1.0 (Top: Funny)
                      ▲
                      │
                      │
  -1.0 (Left: Ugly) ──┼── +1.0 (Right: Handsome)
                      │
                      │
                      ▼
              -1.0 (Bottom: Boring)
```

---

## 🔄 Screen-to-Cartesian Transformation

In standard HTML/SVG coordinate systems:
* $(0, 0)$ is the **top-left corner**.
* $X$ increases to the right.
* $Y$ increases **downward** (opposite of Cartesian coordinates).

To guarantee resolution independence, the SVG uses an internal viewBox:
`<svg viewBox="0 0 1000 1000">`

### 1. Pointer Event (Pixel) ➔ Game Coordinate $(x, y)$
When a player clicks or taps on the SVG element:

```typescript
function screenToGameCoords(
  clientX: number, 
  clientY: number, 
  svgElement: SVGSVGElement
): { x: number; y: number } {
  const rect = svgElement.getBoundingClientRect();
  
  // Normalized 0 to 1 relative to SVG box
  const normX = (clientX - rect.left) / rect.width;
  const normY = (clientY - rect.top) / rect.height;
  
  // Convert [0, 1] to [-1, 1], flipping Y so up is positive
  const gameX = Math.max(-1, Math.min(1, normX * 2 - 1));
  const gameY = Math.max(-1, Math.min(1, (1 - normY) * 2 - 1));
  
  // Round to 3 decimal places for precision without floating point noise
  return {
    x: Math.round(gameX * 1000) / 1000,
    y: Math.round(gameY * 1000) / 1000
  };
}
```

### 2. Game Coordinate $(x, y)$ ➔ SVG viewBox $(cx, cy)$
To render pins and secret targets onto the SVG `<svg viewBox="0 0 1000 1000">`:

```typescript
function gameToSvgCoords(x: number, y: number): { cx: number; cy: number } {
  // Convert [-1, 1] to [0, 1000]
  const cx = ((x + 1) / 2) * 1000;
  const cy = ((1 - y) / 2) * 1000; // Invert Y
  return { cx, cy };
}
```

---

## 🎯 Target Clamping Rule
To ensure targets are not placed on the extreme edge or under UI labels, the server clamps randomly generated psychic targets:
$$x_s \in [-0.85, +0.85], \quad y_s \in [-0.85, +0.85]$$
