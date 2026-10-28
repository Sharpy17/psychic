import React, { useState, useEffect } from 'react';
import { RoomState } from '../../shared/types';
import { socket } from './services/socket';
import { LandingPage } from './components/LandingPage';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';

export function App() {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [socketId, setSocketId] = useState<string>('');

  useEffect(() => {
    // Keep track of our own socket ID
    if (socket.id) {
      setSocketId(socket.id);
    }

    const onConnect = () => {
      if (socket.id) setSocketId(socket.id);
    };

    const onRoomUpdated = (updatedRoom: RoomState) => {
      setRoomState(updatedRoom);
    };

    socket.on('connect', onConnect);
    socket.on('room:updated', onRoomUpdated);

    return () => {
      socket.off('connect', onConnect);
      socket.off('room:updated', onRoomUpdated);
    };
  }, []);

  // 1. Landing Page (Not in a room yet)
  if (!roomState) {
    return (
      <LandingPage
        onJoinedRoom={(roomCode, name) => {
          // Socket events will deliver roomState update
        }}
      />
    );
  }

  // 2. Waiting Lobby
  if (roomState.phase === 'LOBBY') {
    return <Lobby roomState={roomState} currentPlayerId={socket.id || socketId} />;
  }

  // 3. Game Board (Playing, Guessing, or Reveal)
  return <GameBoard roomState={roomState} currentPlayerId={socket.id || socketId} />;
}

export default App;
