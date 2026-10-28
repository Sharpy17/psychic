/**
 * MAIN SERVER & SOCKET.IO ENTRY POINT (Dosia's Domain)
 * Orchestrates communication between the clients, game engine, and database.
 */

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  RoomState,
  Player,
  ClientToServerEvents,
  ServerToClientEvents,
  Coordinates,
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

// Helper to generate a 4-letter room code (e.g. "KZPQ")
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const AVATAR_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: activeRooms.size });
});

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // 1. Create Room
  socket.on('room:create', async ({ playerName }, callback) => {
    let roomCode = generateRoomCode();
    while (activeRooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const hostPlayer: Player = {
      id: socket.id,
      name: playerName || 'Host',
      avatarColor: AVATAR_COLORS[0],
      score: 0,
      isHost: true,
      isReady: true,
      role: 'PSYCHIC',
    };

    const newRoom: RoomState = {
      roomCode,
      hostId: socket.id,
      phase: 'LOBBY',
      players: [hostPlayer],
      currentRound: null,
      settings: {
        maxPlayers: 8,
        roundsCount: 4,
        timeLimitSec: 60,
      },
    };

    activeRooms.set(roomCode, newRoom);
    socket.join(roomCode);

    callback({ success: true, roomCode });
    io.to(roomCode).emit('room:updated', newRoom);
    console.log(`[Room Created] Code: ${roomCode} by ${playerName}`);
  });

  // 2. Join Room
  socket.on('room:join', ({ roomCode, playerName }, callback) => {
    const code = roomCode.toUpperCase().trim();
    const room = activeRooms.get(code);

    if (!room) {
      return callback({ success: false, error: 'Room not found. Check your code!' });
    }

    if (room.players.length >= room.settings.maxPlayers) {
      return callback({ success: false, error: 'Room is full.' });
    }

    const color = AVATAR_COLORS[room.players.length % AVATAR_COLORS.length];
    const newPlayer: Player = {
      id: socket.id,
      name: playerName || `Player ${room.players.length + 1}`,
      avatarColor: color,
      score: 0,
      isHost: false,
      isReady: false,
      role: 'GUESSER',
    };

    room.players.push(newPlayer);
    socket.join(code);

    callback({ success: true });
    io.to(code).emit('room:updated', room);
    console.log(`[Player Joined] ${newPlayer.name} joined room ${code}`);
  });

  // 3. Start Game
  socket.on('game:start', async () => {
    const room = Array.from(activeRooms.values()).find((r) => r.hostId === socket.id);
    if (!room) return;

    const topic = await DatabaseService.getRandomTopic();
    const { xAxis, yAxis } = await DatabaseService.getRandomAxes();
    const psychic = room.players[0]; // First psychic

    // Update roles
    room.players.forEach((p) => {
      p.role = p.id === psychic.id ? 'PSYCHIC' : 'GUESSER';
    });

    const round = GameEngine.createRound(1, room.settings.roundsCount, psychic, topic, xAxis, yAxis);
    room.currentRound = round;
    room.phase = 'PSYCHIC_THINKING';

    // Broadcast updated state to room
    // Note: Hide targetPoint from guessers!
    room.players.forEach((player) => {
      const sanitizedRound = {
        ...round,
        targetPoint: player.id === psychic.id ? round.targetPoint : null,
      };

      io.to(player.id).emit('room:updated', {
        ...room,
        currentRound: sanitizedRound,
      });
    });

    console.log(`[Game Started] Room ${room.roomCode}, Psychic: ${psychic.name}`);
  });

  // 4. Psychic Submits Clue
  socket.on('psychic:submit_clue', ({ clue }, callback) => {
    const room = Array.from(activeRooms.values()).find(
      (r) => r.currentRound && r.currentRound.psychicId === socket.id
    );

    if (!room || !room.currentRound || room.phase !== 'PSYCHIC_THINKING') {
      return callback({ success: false, error: 'Not authorized or wrong phase.' });
    }

    room.currentRound.clue = clue;
    room.phase = 'GUESSING';

    callback({ success: true });

    // Send clue to everyone (target still hidden from guessers)
    room.players.forEach((player) => {
      const sanitizedRound = {
        ...room.currentRound!,
        targetPoint: player.id === room.currentRound!.psychicId ? room.currentRound!.targetPoint : null,
      };

      io.to(player.id).emit('room:updated', {
        ...room,
        currentRound: sanitizedRound,
      });
    });

    console.log(`[Clue Submitted] "${clue}" in room ${room.roomCode}`);
  });

  // 5. Guesser Submits Guess
  socket.on('guesser:submit_guess', ({ coordinates }, callback) => {
    const room = Array.from(activeRooms.values()).find((r) =>
      r.players.some((p) => p.id === socket.id)
    );

    if (!room || !room.currentRound || room.phase !== 'GUESSING') {
      return callback({ success: false, error: 'Cannot submit guess right now.' });
    }

    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.role === 'PSYCHIC') {
      return callback({ success: false, error: 'Psychic cannot guess!' });
    }

    room.currentRound.guesses[socket.id] = {
      playerId: player.id,
      playerName: player.name,
      avatarColor: player.avatarColor,
      coordinates,
    };

    callback({ success: true });

    // If all guessers have submitted, automatically trigger REVEAL
    const guessersCount = room.players.filter((p) => p.role === 'GUESSER').length;
    const submittedCount = Object.keys(room.currentRound.guesses).length;

    if (submittedCount >= guessersCount) {
      triggerReveal(room);
    } else {
      // Broadcast guess submission count update
      io.to(room.roomCode).emit('room:updated', room);
    }
  });

  // 6. Next Round
  socket.on('round:next', async () => {
    const room = Array.from(activeRooms.values()).find((r) => r.hostId === socket.id);
    if (!room || !room.currentRound) return;

    if (room.currentRound.roundNumber >= room.settings.roundsCount) {
      room.phase = 'GAME_OVER';
      io.to(room.roomCode).emit('room:updated', room);
      return;
    }

    // Rotate psychic to next player
    const currentPsychicIndex = room.players.findIndex((p) => p.id === room.currentRound!.psychicId);
    const nextPsychic = room.players[(currentPsychicIndex + 1) % room.players.length];

    room.players.forEach((p) => {
      p.role = p.id === nextPsychic.id ? 'PSYCHIC' : 'GUESSER';
    });

    const topic = await DatabaseService.getRandomTopic();
    const { xAxis, yAxis } = await DatabaseService.getRandomAxes();

    room.currentRound = GameEngine.createRound(
      room.currentRound.roundNumber + 1,
      room.settings.roundsCount,
      nextPsychic,
      topic,
      xAxis,
      yAxis
    );
    room.phase = 'PSYCHIC_THINKING';

    room.players.forEach((player) => {
      const sanitizedRound = {
        ...room.currentRound!,
        targetPoint: player.id === nextPsychic.id ? room.currentRound!.targetPoint : null,
      };

      io.to(player.id).emit('room:updated', {
        ...room,
        currentRound: sanitizedRound,
      });
    });
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
    for (const [code, room] of activeRooms.entries()) {
      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.players.length === 0) {
          activeRooms.delete(code);
          console.log(`[Room Deleted] Empty room ${code}`);
        } else {
          if (room.hostId === socket.id) {
            room.hostId = room.players[0].id;
            room.players[0].isHost = true;
          }
          io.to(code).emit('room:updated', room);
        }
      }
    }
  });
});

function triggerReveal(room: RoomState) {
  if (!room.currentRound) return;

  const { evaluatedGuesses, psychicScoreBonus } = GameEngine.resolveRound(room.currentRound);

  // Update cumulative player scores
  evaluatedGuesses.forEach((g) => {
    const player = room.players.find((p) => p.id === g.playerId);
    if (player && g.scoreEarned) {
      player.score += g.scoreEarned;
    }
  });

  const psychic = room.players.find((p) => p.id === room.currentRound!.psychicId);
  if (psychic) {
    psychic.score += psychicScoreBonus;
  }

  room.phase = 'REVEAL';

  // Broadcast full state with real target to everyone!
  io.to(room.roomCode).emit('room:updated', room);
  io.to(room.roomCode).emit('round:revealed', {
    targetPoint: room.currentRound.targetPoint!,
    guesses: evaluatedGuesses,
    psychicScoreEarned: psychicScoreBonus,
  });

  console.log(`[Round Revealed] Room ${room.roomCode}`);
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Psychic Plane Server running on http://localhost:${PORT}`);
});
