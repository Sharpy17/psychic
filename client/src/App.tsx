import { useState, useEffect } from 'react';
import { RoomState } from '../../shared/types';
import { socket } from './services/socket';
import { LandingPage } from './components/LandingPage';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';

export function App() {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [socketId, setSocketId] = useState<string>('');

  useEffect(() => {
    if (socket.id) {
      setSocketId(socket.id);
    }

    const onConnect = () => {
      if (socket.id) setSocketId(socket.id);
    };

    const onRoomUpdated = (updatedRoom: RoomState) => {
      setRoomState(updatedRoom);
    };

    const onRoomJoined = ({ playerId }: { playerId: string }) => {
      setSocketId(playerId);
    };

    socket.on('connect', onConnect);
    socket.on('room:updated', onRoomUpdated);
    socket.on('room:joined', onRoomJoined);

    return () => {
      socket.off('connect', onConnect);
      socket.off('room:updated', onRoomUpdated);
      socket.off('room:joined', onRoomJoined);
    };
  }, []);

  // 1. Landing Page (Not in room)
  if (!roomState) {
    return <LandingPage onJoinedRoom={() => {}} />;
  }

  // 2. Lobby (Waiting room)
  if (roomState.phase === 'LOBBY') {
    return <Lobby roomState={roomState} currentPlayerId={socket.id || socketId} />;
  }

  // 3. Active Game Board (Psychic Turn, Guessing, Reveal, Round End, Game Over)
  return <GameBoard roomState={roomState} currentPlayerId={socket.id || socketId} />;
}

export default App;
