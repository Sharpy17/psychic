# 02 - Scoring Formula & Balance

This document details the distance calculations, point brackets, and psychological reward incentives for both guessers and the psychic.

---

## 📏 Distance Metric: 2D Euclidean Distance

Given the secret point $S = (x_s, y_s)$ and a player's guess $G = (x_g, y_g)$:

$$d = \sqrt{(x_g - x_s)^2 + (y_g - y_s)^2}$$

Because both coordinates range across $[-1.0, +1.0]$, the maximum possible Euclidean distance between diagonal corners is:

$$d_{\max} = \sqrt{(1 - (-1))^2 + (1 - (-1))^2} = \sqrt{4 + 4} = \sqrt{8} \approx 2.828$$

---

## 🎯 Guesser Scoring Tiers (Concentric Target Rings)

Like physical *Wavelength*, the secret point is surrounded by concentric scoring rings. This feels significantly more satisfying than an abstract formula because players can see the "bullseye" rings visually on the reveal screen.

| Tier Name | Distance Threshold ($d$) | Points Awarded | Visual Ring Color |
| :--- | :--- | :--- | :--- |
| **Bullseye** | $d \le 0.15$ | **1000 pts** | Gold / Yellow (`#F59E0B`) |
| **Close** | $0.15 < d \le 0.35$ | **750 pts** | Cyan / Teal (`#06B6D4`) |
| **Warm** | $0.35 < d \le 0.60$ | **500 pts** | Green (`#10B981`) |
| **Edge** | $0.60 < d \le 0.90$ | **250 pts** | Purple / Violet (`#8B5CF6`) |
| **Miss** | $d > 0.90$ | **0 pts** | Transparent / No Ring |

### TypeScript Implementation
```typescript
export function calculatePlayerScore(
  target: { x: number; y: number }, 
  guess: { x: number; y: number }
): { distance: number; points: number; tier: string } {
  const dx = guess.x - target.x;
  const dy = guess.y - target.y;
  const distance = Math.round(Math.sqrt(dx * dx + dy * dy) * 1000) / 1000;

  if (distance <= 0.15) return { distance, points: 1000, tier: "Bullseye" };
  if (distance <= 0.35) return { distance, points: 750, tier: "Close" };
  if (distance <= 0.60) return { distance, points: 500, tier: "Warm" };
  if (distance <= 0.90) return { distance, points: 250, tier: "Edge" };
  return { distance, points: 0, tier: "Miss" };
}
```

---

## 🧠 Psychic Reward Balancing

A party game collapses if the psychic is rewarded when players fail (it causes malicious clues). The psychic **must** want the team to succeed.

### Formula
Psychic score is the **average score of all guessers in the round**:

$$\text{Psychic Points} = \text{round}\left(\frac{\sum_{i=1}^{N} \text{Points}_i}{N}\right)$$

* Where $N$ is the count of active guessers who locked in.
* **Bonus ("Psychic Resonance"):** If **at least 2 players hit the Bullseye**, the psychic earns an extra $+250\text{ pts}$ bonus!

This creates excitement: when someone hits the bullseye, the psychic cheers with them!
