/**
 * Shared Type Definitions for Psychic Plane
 * This file serves as the Single Source of Truth (SSOT) between Client, Server, and Database.
 */

// 2D Coordinates normalized between -100 and +100
// (-100, 0) = Far Left (X Axis Min)
// (+100, 0) = Far Right (X Axis Max)
// (0, -100) = Far Bottom (Y Axis Min)
// (0, +100) = Far Top (Y Axis Max)
// (0, 0)    = Exact Center
export interface Coordinates {
  x: number;
  y: number;
}

// Axis pair represents a spectrum from min to max
export interface AxisPair {
  id?: string;
  minLabel: string; // e.g. "Unfunny", "Ugly", "Underrated"
  maxLabel: string; // e.g. "Funny", "Cute", "Overrated"
}

// Category or Topic prompt
export interface Topic {
  id?: string;
  name: string; // e.g. "Video Game Characters", "Food & Drink", "Historical Figures"
  description?: string;
}

export type PlayerRole = 'PSYCHIC' | 'GUESSER';

export interface Player {
  id: string; // Socket ID or Session UUID
  name: string;
  avatarColor: string;
  score: number;
  isHost: boolean;
  isReady: boolean;
  role: PlayerRole;
}

export type GamePhase =
  | 'LOBBY'             // Waiting for players to join
  | 'PSYCHIC_THINKING'  // Psychic sees target point and category, choosing a clue (e.g., "Liu Kang")
  | 'GUESSING'          // Clue announced. Guessers drag their pins to place their coordinate guesses
  | 'REVEAL'            // Secret target revealed! Distances calculated, scores animated
  | 'ROUND_SUMMARY'     // Leaderboard displayed, ready to advance
  | 'GAME_OVER';        // Final podium and winners

export interface PlayerGuess {
  playerId: string;
  playerName: string;
  avatarColor: string;
  coordinates: Coordinates;
  distanceFromTarget?: number; // Calculated on reveal
  scoreEarned?: number;        // Points awarded for this round
}

export interface RoundData {
  roundNumber: number;
  totalRounds: number;
  psychicId: string;
  psychicName: string;
  topic: Topic;
  xAxis: AxisPair;
  yAxis: AxisPair;
  
  // Target coordinates: ONLY sent to Psychic during thinking phase.
  // Sent to guessers ONLY when phase transitions to 'REVEAL'.
  targetPoint: Coordinates | null;
  
  clue: string | null;           // Submitted by psychic (e.g. "Liu Kang")
  guesses: Record<string, PlayerGuess>; // Map of playerId -> PlayerGuess
  timeRemainingSec?: number;
}

export interface RoomSettings {
  maxPlayers: number;
  roundsCount: number;
  timeLimitSec: number;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  phase: GamePhase;
  players: Player[];
  currentRound: RoundData | null;
  settings: RoomSettings;
}

// ==========================================
// SOCKET.IO EVENT CONTRACTS
// ==========================================

export interface ClientToServerEvents {
  // Room setup
  'room:create': (payload: { playerName: string }, callback: (res: { success: boolean; roomCode?: string; error?: string }) => void) => void;
  'room:join': (payload: { roomCode: string; playerName: string }, callback: (res: { success: boolean; error?: string }) => void) => void;
  'room:ready': () => void;
  'game:start': () => void;

  // Psychic submits clue
  'psychic:submit_clue': (payload: { clue: string }, callback: (res: { success: boolean; error?: string }) => void) => void;

  // Guesser moves / submits guess
  'guesser:submit_guess': (payload: { coordinates: Coordinates }, callback: (res: { success: boolean; error?: string }) => void) => void;

  // Round progression (host or timer)
  'round:next': () => void;
}

export interface ServerToClientEvents {
  'room:updated': (roomState: RoomState) => void;
  'room:error': (message: string) => void;
  'game:phase_change': (payload: { phase: GamePhase; round?: RoundData }) => void;
  'psychic:clue_announced': (payload: { clue: string; topic: string }) => void;
  'round:revealed': (payload: {
    targetPoint: Coordinates;
    guesses: PlayerGuess[];
    psychicScoreEarned: number;
  }) => void;
  'timer:tick': (secondsLeft: number) => void;
}
