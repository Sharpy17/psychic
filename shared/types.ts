/**
 * CANONICAL SHARED TYPE DEFINITIONS FOR PSYCHIC PLANE (Wavelength 2D)
 * Single Source of Truth (SSOT) defined in docs/03 - Data Models & Schemas/Data Models (TypeScript).md
 */

// ==========================================
// GAME PHASES
// ==========================================
export type GamePhase =
  | 'LOBBY'
  | 'PSYCHIC_TURN'
  | 'GUESSING'
  | 'REVEAL'
  | 'ROUND_END'
  | 'GAME_OVER';

// ==========================================
// COORDINATES & MATH (Strictly [-1.0, +1.0])
// ==========================================
export interface Point2D {
  x: number; // Float between -1.0 and +1.0
  y: number; // Float between -1.0 and +1.0
}
export type Coordinates = Point2D;

// ==========================================
// CONTENT & AXES
// ==========================================
export interface AxisPair {
  id?: string;
  negative: string; // -1.0 attribute (e.g. "Ugly", "Boring")
  positive: string; // +1.0 attribute (e.g. "Handsome", "Funny")
}

export interface RoundContent {
  topic: string; // e.g. "Fictional Characters", "Animals"
  axisX: AxisPair;
  axisY: AxisPair;
}

// ==========================================
// PLAYERS & GUESSES
// ==========================================
export type ScoreTier = 'Bullseye' | 'Close' | 'Warm' | 'Edge' | 'Miss';

export interface PlayerGuess {
  playerId: string;
  playerName?: string;
  avatarColor?: string;
  coords: Point2D;
  isLocked: boolean;
  scoreAwarded?: number;
  distance?: number;
  tier?: ScoreTier;
}

export interface Player {
  id: string;          // Socket ID or persistent UUID
  name: string;        // Display name
  avatarColor: string; // Hex color for pin & UI badge
  score: number;       // Cumulative score
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
  psychicName?: string;
  content: RoundContent;
  clue?: string;
  // NOTE: secretTarget is strictly server-side during PSYCHIC_TURN & GUESSING!
  secretTarget?: Point2D;
  guesses: Record<string, PlayerGuess>; // Keyed by playerId
  timeRemaining: number;
}

export interface RoomSettings {
  roundsPerPlayer: number; // Default: 1 or 2
  clueTimeLimit: number;   // In seconds, default: 90
  guessTimeLimit: number;  // In seconds, default: 60
}

export interface RoomState {
  roomCode: string; // 4-letter alphanumeric string (e.g. "ABCD")
  phase: GamePhase;
  players: Player[];
  currentRound: RoundState | null;
  settings: RoomSettings;
}

// ==========================================
// REVEAL PAYLOAD (Broadcasted at REVEAL)
// ==========================================
export interface RevealGuess {
  playerId: string;
  playerName: string;
  avatarColor: string;
  coords: Point2D;
  distance: number;
  scoreAwarded: number;
  tier: ScoreTier;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  totalScore: number;
}

export interface RevealPayload {
  secretTarget: Point2D;
  clue: string;
  guesses: RevealGuess[];
  psychicId: string;
  psychicScoreAwarded: number;
  updatedLeaderboard: LeaderboardEntry[];
}

// ==========================================
// SOCKET.IO EVENT CONTRACTS
// ==========================================

export interface ClientToServerEvents {
  // Room entry
  'room:create': (
    payload: { playerName: string },
    callback: (res: { success: boolean; roomCode?: string; error?: string }) => void
  ) => void;
  'room:join': (
    payload: { roomCode: string; playerName: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  // Game control
  'game:start': () => void;
  'game:next_round': () => void;

  // Psychic submits clue
  'psychic:submit_clue': (
    payload: { clue: string },
    callback?: (res: { success: boolean; error?: string }) => void
  ) => void;

  // Guesser locks in coordinates (x, y in [-1, 1])
  'player:submit_guess': (
    payload: { x: number; y: number },
    callback?: (res: { success: boolean; error?: string }) => void
  ) => void;
}

export interface ServerToClientEvents {
  'room:joined': (payload: { roomCode: string; playerId: string; isHost: boolean }) => void;
  'room:updated': (roomState: RoomState) => void;
  'game:phase_change': (payload: { phase: GamePhase; roundData?: RoundState | null }) => void;
  'psychic:secret_data': (payload: { targetX: number; targetY: number }) => void;
  'player:guess_locked': (payload: { playerId: string }) => void;
  'game:reveal': (payload: RevealPayload) => void;
  'timer:tick': (payload: { secondsRemaining: number }) => void;
  'error:message': (payload: { code: string; message: string }) => void;
}
