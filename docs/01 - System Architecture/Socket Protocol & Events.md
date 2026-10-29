# 01 - Socket Protocol & Events

This document defines the strict Socket.io protocol contracts. Any client-side or server-side AI agent MUST adhere to these exact event names and payload signatures.

---

## 🔒 Security Rule: Server-Authoritative Secret Target
> [!CAUTION]
> The secret point `(targetX, targetY)` must **NEVER** be sent to non-psychic players during the `PSYCHIC_TURN` or `GUESSING` phases.
> - **During `PSYCHIC_TURN` & `GUESSING`:** Only the psychic's socket receives `secretPoint`.
> - **During `REVEAL`:** The server broadcasts `secretPoint` and all players' locked guesses to everyone.

---

## 📡 Client-to-Server Events (Emitted by Client)

| Event Name | Payload | Description |
| :--- | :--- | :--- |
| `room:create` | `{ playerName: string }` | Host creates a room. Returns `room:joined`. |
| `room:join` | `{ roomCode: string, playerName: string }` | Player joins an existing 4-letter room code. |
| `game:start` | `{}` | Host starts the game from the lobby. |
| `psychic:reroll` | `{}` | Psychic uses their 1-time reroll to get a fresh topic, axes, and secret target. |
| `psychic:submit_clue` | `{ clue: string }` | Psychic submits clue word/phrase for the axes. |
| `player:submit_guess` | `{ x: number, y: number }` | Guesser locks in their guess coordinates ($x, y \in [-1, 1]$). |
| `game:next_round` | `{}` | Host (or automatic timer) advances to the next round. |

---

## 📥 Server-to-Client Events (Emitted by Server)

| Event Name | Payload | Description |
| :--- | :--- | :--- |
| `room:joined` | `{ roomCode: string, playerId: string, isHost: boolean }` | Confirms room entry and assigns player ID. |
| `room:update` | `RoomState` (excluding hidden secret) | Broadcast whenever players join/leave/ready up. |
| `game:phase_change` | `{ phase: GamePhase, roundData: RoundPublicData }` | Broadcast to all players on phase transition. |
| `psychic:secret_data` | `{ targetX: number, targetY: number }` | **Sent ONLY to the psychic socket** during `PSYCHIC_TURN`. |
| `psychic:rerolled` | `{ targetX: number, targetY: number, rerollsRemaining: number }` | **Sent ONLY to psychic socket** with new secret target coordinates. |
| `player:guess_locked` | `{ playerId: string }` | Broadcast to all that a player has locked in (hides coordinates). |
| `game:reveal` | `RevealPayload` | Broadcast at reveal: contains secret target, all player guesses, and round scores. |
| `error:message` | `{ code: string, message: string }` | Dispatched if a room doesn't exist, name is taken, etc. |

---

## 📦 Payload Examples

### 1. `psychic:submit_clue`
```json
{
  "clue": "Shrek"
}
```

### 2. `player:submit_guess`
```json
{
  "x": 0.45,
  "y": -0.80
}
```

### 3. `game:reveal`
```json
{
  "target": { "x": 0.50, "y": -0.75 },
  "clue": "Shrek",
  "guesses": [
    { "playerId": "p1", "playerName": "Alice", "x": 0.45, "y": -0.80, "distance": 0.07, "scoreAwarded": 1000 },
    { "playerId": "p2", "playerName": "Bob", "x": 0.10, "y": 0.20, "distance": 1.03, "scoreAwarded": 0 }
  ],
  "psychicScoreAwarded": 500,
  "leaderboard": [
    { "playerId": "p1", "playerName": "Alice", "totalScore": 2500 }
  ]
}
```
