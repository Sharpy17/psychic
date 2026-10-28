# 03 - Content Deck Schema

The game requires two core pools of content:
1. **Topics:** The subject matter constraint (e.g., "Movies", "Food", "Superpowers").
2. **Axis Pairs:** Antonym pairs or spectrum poles (e.g., "Hot / Cold", "Overrated / Underrated").

---

## 🗃️ JSON Schema (`decks.json`)

To maximize replayability, topics and axes are stored separately and combined combinatorially at runtime.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GameContentDeck",
  "type": "object",
  "required": ["topics", "axisPairs"],
  "properties": {
    "topics": {
      "type": "array",
      "items": { "type": "string" }
    },
    "axisPairs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["negative", "positive"],
        "properties": {
          "id": { "type": "string" },
          "negative": { "type": "string" },
          "positive": { "type": "string" },
          "tags": { 
            "type": "array", 
            "items": { "type": "string" } 
          }
        }
      }
    }
  }
}
```

---

## 🎲 Round Generation Logic (Backend)

When generating a round:
1. Draw **1 random Topic** from `topics`.
2. Draw **2 distinct random Axis Pairs** from `axisPairs`.
   - Assign one to `axisX`.
   - Assign the other to `axisY`.
3. (Optional Polish) Randomly 50/50 flip `negative` and `positive` so "Good" isn't always on the right/top.
