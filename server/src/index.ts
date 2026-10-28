/**
 * MAIN SERVER & SOCKET.IO ENTRY POINT (Dosia's Domain)
 * Authoritative game server orchestrating rooms, security, turn progression, and scoring.
 * References: docs/01 - System Architecture/Socket Protocol & Events.md
 */

import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import {
  RoomState,
  Player,
  ClientToServerEvents,
  ServerToClientEvents,
  Point2D,
  RevealPayload,
} from '../../shared/types.js';
import { GameEngine } from './game/engine.js';
import { DatabaseService } from './db/client.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory active game rooms: roomCode -> RoomState
const activeRooms = new Map<string, RoomState>();

// Secret targets store (strictly server-side, roomCode -> Point2D)
const roomSecretTargets = new Map<string, Point2D>();

// Active timers per room
const roomTimers = new Map<string, NodeJS.Timeout>();

// Helper to generate a 4-letter room code (e.g. "KZPQ")
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const AVATAR_COLORS = [
  '#FF5C8D', // Magenta / Pink
  '#3FD8C7', // Teal / Cyan
  '#FFD35C', // Gold / Yellow
  '#9B7BFF', // Purple
  '#FF9E45', // Orange
  '#48BB78', // Emerald
  '#E5413B', // Red
  '#4299E1', // Blue
];

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    game: 'Psychic Plane',
    activeRooms: activeRooms.size,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Returns a sanitized RoomState copy tailored to a specific player's socket,
 * guaranteeing the secret target is NEVER leaked to guessers before REVEAL.
 */
function getSanitizedRoomState(room: RoomState, socketId?: string): RoomState {
  const isPsychic = room.currentRound?.psychicId === socketId;
  const isRevealOrLater =
    room.phase === 'REVEAL' ||
    room.phase === 'ROUND_END' ||
    room.phase === 'GAME_OVER';

  const round = room.currentRound;
  let sanitizedRound = null;

  if (round) {
    // Hide secretTarget unless it's the psychic or reveal phase
    const secretTarget =
      isPsychic || isRevealOrLater
        ? round.secretTarget
        : undefined;

    // Mask other players' coordinates during guessing phase
    const sanitizedGuesses: Record<string, any> = {};
    for (const [pId, g] of Object.entries(round.guesses)) {
      if (pId === socketId || isRevealOrLater) {
        sanitizedGuesses[pId] = g;
      } else {
        sanitizedGuesses[pId] = {
          playerId: g.playerId,
          isLocked: g.isLocked,
          coords: { x: 0, y: 0 }, // Masked
        };
      }
    }

    sanitizedRound = {
      ...round,
      secretTarget,
      guesses: sanitizedGuesses,
    };
  }

  return {
    ...room,
    currentRound: sanitizedRound,
  };
}

/**
 * Broadcasts sanitized room state to each individual socket in the room.
 */
function broadcastRoomUpdate(room: RoomState) {
  for (const player of room.players) {
    const sanitized = getSanitizedRoomState(room, player.id);
    io.to(player.id).emit('room:updated', sanitized);
  }
}

/**
 * Trigger timer countdown for a room
 */
function startRoomTimer(room: RoomState, seconds: number, onExpire: () => void) {
  if (roomTimers.has(room.roomCode)) {
    clearInterval(roomTimers.get(room.roomCode)!);
  }

  let remaining = seconds;
  if (room.currentRound) {
    room.currentRound.timeRemaining = remaining;
  }

  const timer = setInterval(() => {
    remaining--;
    if (room.currentRound) {
      room.currentRound.timeRemaining = remaining;
    }
    io.to(room.roomCode).emit('timer:tick', { secondsRemaining: remaining });

    if (remaining <= 0) {
      clearInterval(timer);
      roomTimers.delete(room.roomCode);
      onExpire();
    }
  }, 1000);

  roomTimers.set(room.roomCode, timer);
}

function clearRoomTimer(roomCode: string) {
  if (roomTimers.has(roomCode)) {
    clearInterval(roomTimers.get(roomCode)!);
    roomTimers.delete(roomCode);
  }
}

/**
 * Starts a new game round.
 */
async function startRound(room: RoomState, psychicIndex: number = 0) {
  clearRoomTimer(room.roomCode);

  const psychic = room.players[psychicIndex % room.players.length];
  for (const p of room.players) {
    p.isPsychic = p.id === psychic.id;
  }

  const topic = await DatabaseService.getRandomTopic();
  const { xAxis, yAxis } = await DatabaseService.getRandomAxes();

  const totalRounds = room.players.length * room.settings.roundsPerPlayer;
  const currentRoundNumber = (room.currentRound?.roundNumber || 0) + 1;

  const round = GameEngine.createRound(
    currentRoundNumber,
    totalRounds,
    psychic,
    topic,
    xAxis,
    yAxis,
    room.settings.clueTimeLimit
  );

  // Store secret target securely
  roomSecretTargets.set(room.roomCode, round.secretTarget!);
  room.currentRound = round;
  room.phase = 'PSYCHIC_TURN';

  // Send secret target exclusively to the psychic
  io.to(psychic.id).emit('psychic:secret_data', {
    targetX: round.secretTarget!.x,
    targetY: round.secretTarget!.y,
  });

  broadcastRoomUpdate(room);

  // Start Psychic Turn Timer
  startRoomTimer(room, room.settings.clueTimeLimit, () => {
    // If psychic times out, auto-fill clue as "Pass" and advance
    if (room.phase === 'PSYCHIC_TURN' && room.currentRound) {
      room.currentRound.clue = 'Time expired!';
      transitionToGuessing(room);
    }
  });
}

function transitionToGuessing(room: RoomState) {
  clearRoomTimer(room.roomCode);
  room.phase = 'GUESSING';

  broadcastRoomUpdate(room);

  // Start Guessing Countdown Timer
  startRoomTimer(room, room.settings.guessTimeLimit, () => {
    if (room.phase === 'GUESSING') {
      revealRound(room);
    }
  });
}

/**
 * Resolves the round, calculates scores, and broadcasts the reveal.
 */
function revealRound(room: RoomState) {
  clearRoomTimer(room.roomCode);
  if (!room.currentRound) return;

  const secretTarget = roomSecretTargets.get(room.roomCode) || room.currentRound.secretTarget!;
  room.currentRound.secretTarget = secretTarget;

  const revealPayload: RevealPayload = GameEngine.resolveRound(
    room.currentRound,
    room.players
  );

  room.phase = 'REVEAL';

  // Broadcast the official reveal payload
  io.to(room.roomCode).emit('game:reveal', revealPayload);
  broadcastRoomUpdate(room);

  // Auto-advance to ROUND_END after 8 seconds
  setTimeout(() => {
    if (room.phase === 'REVEAL') {
      room.phase = 'ROUND_END';
      broadcastRoomUpdate(room);
    }
  }, 8000);
}

// ==========================================
// SOCKET CONNECTION HANDLING
// ==========================================

io.on('connection', (socket: Socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // 1. Create Room
  socket.on('room:create', async ({ playerName }, callback) => {
    let roomCode = generateRoomCode();
    while (activeRooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const hostPlayer: Player = {
      id: socket.id,
      name: playerName.trim() || 'Host',
      avatarColor: AVATAR_COLORS[0],
      score: 0,
      isHost: true,
      isPsychic: true,
      isConnected: true,
    };

    const newRoom: RoomState = {
      roomCode,
      phase: 'LOBBY',
      players: [hostPlayer],
      currentRound: null,
      settings: {
        roundsPerPlayer: 1,
        clueTimeLimit: 90,
        guessTimeLimit: 60,
      },
    };

    activeRooms.set(roomCode, newRoom);
    socket.join(roomCode);

    socket.emit('room:joined', { roomCode, playerId: socket.id, isHost: true });
    broadcastRoomUpdate(newRoom);

    callback({ success: true, roomCode });
    console.log(`[Room Created] Code: ${roomCode} by ${playerName}`);
  });

  // 2. Join Room
  socket.on('room:join', ({ roomCode, playerName }, callback) => {
    const code = roomCode.trim().toUpperCase();
    const room = activeRooms.get(code);

    if (!room) {
      callback({ success: false, error: 'Room does not exist.' });
      return;
    }

    if (room.phase !== 'LOBBY') {
      callback({ success: false, error: 'Game is already in progress.' });
      return;
    }

    if (room.players.length >= 10) {
      callback({ success: false, error: 'Room is full (max 10 players).' });
      return;
    }

    const colorIndex = room.players.length % AVATAR_COLORS.length;
    const newPlayer: Player = {
      id: socket.id,
      name: playerName.trim() || `Player ${room.players.length + 1}`,
      avatarColor: AVATAR_COLORS[colorIndex],
      score: 0,
      isHost: false,
      isPsychic: false,
      isConnected: true,
    };

    room.players.push(newPlayer);
    socket.join(code);

    socket.emit('room:joined', { roomCode: code, playerId: socket.id, isHost: false });
    broadcastRoomUpdate(room);

    callback({ success: true });
    console.log(`[Player Joined] ${newPlayer.name} joined ${code}`);
  });

  // 3. Start Game
  socket.on('game:start', () => {
    const room = Array.from(activeRooms.values()).find((r) =>
      r.players.some((p) => p.id === socket.id && p.isHost)
    );

    if (!room) return;

    if (room.players.length < 2) {
      socket.emit('error:message', {
        code: 'MIN_PLAYERS',
        message: 'Need at least 2 players to start (3+ recommended).',
      });
      return;
    }

    console.log(`[Game Started] Room ${room.roomCode}`);
    startRound(room, 0);
  });

  // 4. Psychic Submits Clue
  socket.on('psychic:submit_clue', ({ clue }, callback) => {
    const room = Array.from(activeRooms.values()).find((r) =>
      r.players.some((p) => p.id === socket.id)
    );

    if (!room || !room.currentRound || room.phase !== 'PSYCHIC_TURN') {
      callback?.({ success: false, error: 'Invalid state to submit clue.' });
      return;
    }

    if (room.currentRound.psychicId !== socket.id) {
      callback?.({ success: false, error: 'Only the psychic can submit a clue.' });
      return;
    }

    room.currentRound.clue = clue.trim();
    callback?.({ success: true });

    transitionToGuessing(room);
  });

  // 5. Player Locks In Guess
  socket.on('player:submit_guess', ({ x, y }, callback) => {
    const room = Array.from(activeRooms.values()).find((r) =>
      r.players.some((p) => p.id === socket.id)
    );

    if (!room || !room.currentRound || room.phase !== 'GUESSING') {
      callback?.({ success: false, error: 'Not in guessing phase.' });
      return;
    }

    if (room.currentRound.psychicId === socket.id) {
      callback?.({ success: false, error: 'Psychic does not submit guesses.' });
      return;
    }

    // Clamp coordinates strictly between [-1.0, +1.0]
    const clampedX = Math.max(-1, Math.min(1, Math.round(x * 1000) / 1000));
    const clampedY = Math.max(-1, Math.min(1, Math.round(y * 1000) / 1000));

    const player = room.players.find((p) => p.id === socket.id);

    room.currentRound.guesses[socket.id] = {
      playerId: socket.id,
      playerName: player?.name,
      avatarColor: player?.avatarColor,
      coords: { x: clampedX, y: clampedY },
      isLocked: true,
    };

    io.to(room.roomCode).emit('player:guess_locked', { playerId: socket.id });
    broadcastRoomUpdate(room);

    callback?.({ success: true });

    // Check if ALL non-psychic players have locked in
    const activeGuessers = room.players.filter(
      (p) => p.id !== room.currentRound!.psychicId && p.isConnected
    );
    const lockedCount = Object.keys(room.currentRound.guesses).length;

    if (lockedCount >= activeGuessers.length) {
      revealRound(room);
    }
  });

  // 6. Next Round
  socket.on('game:next_round', () => {
    const room = Array.from(activeRooms.values()).find((r) =>
      r.players.some((p) => p.id === socket.id)
    );

    if (!room || !room.currentRound) return;

    const currentPsychicIndex = room.players.findIndex(
      (p) => p.id === room.currentRound!.psychicId
    );
    const nextPsychicIndex = (currentPsychicIndex + 1) % room.players.length;

    const totalRounds = room.players.length * room.settings.roundsPerPlayer;
    if (room.currentRound.roundNumber >= totalRounds) {
      room.phase = 'GAME_OVER';
      broadcastRoomUpdate(room);
    } else {
      startRound(room, nextPsychicIndex);
    }
  });

  // 7. Disconnection
  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    for (const [code, room] of activeRooms.entries()) {
      const playerIndex = room.players.findIndex((p) => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players[playerIndex].isConnected = false;

        // If in lobby, remove player
        if (room.phase === 'LOBBY') {
          room.players.splice(playerIndex, 1);
          if (room.players.length === 0) {
            clearRoomTimer(code);
            activeRooms.delete(code);
            roomSecretTargets.delete(code);
          } else {
            if (!room.players.some((p) => p.isHost)) {
              room.players[0].isHost = true;
            }
            broadcastRoomUpdate(room);
          }
        } else {
          // If in active game, broadcast update
          broadcastRoomUpdate(room);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Psychic Plane Server running on port ${PORT}`);
});
