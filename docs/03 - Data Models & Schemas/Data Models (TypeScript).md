# 03 - Data Models (TypeScript)

This file contains the canonical TypeScript type definitions. Any changes here must be updated in both client and server repositories.

---

```typescript
// ==========================================
// GAME PHASES
// ==========================================
export type GamePhase = 
  | "LOBBY"
  | "PSYCHIC_TURN"
  | "GUESSING"
  | "REVEAL"
  | "ROUND_END"
  | "GAME_OVER";

// ==========================================
// COORDINATES & MATH
// ==========================================
export interface Point2D {
  x: number; // Float between -1.0 and +1.0
  y: number; // Float between -1.0 and +1.0
}

// ==========================================
// CONTENT & AXES
// ==========================================
export interface AxisPair {
  negative: string; // -1.0 attribute (e.g. "Ugly", "Boring")
  positive: string; // +1.0 attribute (e.g. "Handsome", "Funny")
}

export interface RoundContent {
  topic: string; // e.g. "Animals", "Fictional Characters"
  axisX: AxisPair;
  axisY: AxisPair;
}

// ==========================================
// PLAYERS & GUESSES
// ==========================================
export interface PlayerGuess {
  playerId: string;
  coords: Point2D;
  isLocked: boolean;
  scoreAwarded?: number;
  distance?: number;
  tier?: "Bullseye" | "Close" | "Warm" | "Edge" | "Miss";
}

export interface Player {
  id: string;             // Socket ID or persistent UUID
  name: string;           // Display name
  avatarColor: string;    // Hex code for pin & UI badge
  score: number;          // Cumulative game score
  isHost: boolean;
  isPsychic: boolean;
  isConnected: boolean;
}

// ==========================================
// ROUND & ROOM STATE
// ==========================================
export interface RoundState {
  roundNumber: number;
  totalRounds: number;
  psychicId: string;
  content: RoundContent;
  clue?: string;
  // NOTE: secretTarget is strictly server-side during PSYCHIC_TURN & GUESSING!
  secretTarget?: Point2D; 
  guesses: Record<string, PlayerGuess>; // Keyed by playerId
  timeRemaining: number;
}

export interface RoomState {
  roomCode: string;       // 4-letter alphanumeric string (e.g., "ABCD")
  phase: GamePhase;
  players: Player[];
  currentRound: RoundState | null;
  settings: {
    roundsPerPlayer: number; // Default: 1 or 2
    clueTimeLimit: number;   // In seconds, default: 90
    guessTimeLimit: number;  // In seconds, default: 60
  };
}

// ==========================================
// REVEAL PAYLOAD (Broadcasted at REVEAL)
// ==========================================
export interface RevealPayload {
  secretTarget: Point2D;
  clue: string;
  guesses: {
    playerId: string;
    playerName: string;
    avatarColor: string;
    coords: Point2D;
    distance: number;
    scoreAwarded: number;
    tier: string;
  }[];
  psychicId: string;
  psychicScoreAwarded: number;
  updatedLeaderboard: {
    playerId: string;
    name: string;
    totalScore: number;
  }[];
}
```
