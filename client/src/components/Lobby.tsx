/**
 * LOBBY SCREEN
 * Displays connected players, room code, and allows the host to launch the game.
 */

import React, { useState } from 'react';
import { Crown, Copy, Check, Play, Users } from 'lucide-react';
import { RoomState, Player } from '../../../shared/types';
import { socket } from '../services/socket';

interface LobbyProps {
  roomState: RoomState;
  currentPlayerId: string;
}

export const Lobby: React.FC<LobbyProps> = ({ roomState, currentPlayerId }) => {
  const [copied, setCopied] = useState(false);
  const isHost = roomState.hostId === currentPlayerId;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomState.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    socket.emit('game:start');
  };

  return (
    <div className="min-h-screen radial-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        {/* Room Header */}
        <div className="text-center mb-8">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Room Code</span>
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="text-5xl font-mono font-black tracking-widest text-transparent bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text">
              {roomState.roomCode}
            </span>
            <button
              onClick={handleCopyCode}
              title="Copy Room Code"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Share this code with your friends to join</p>
        </div>

        {/* Players List */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-400" />
              Players in Room ({roomState.players.length}/{roomState.settings.maxPlayers})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {roomState.players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-md"
                    style={{ backgroundColor: player.avatarColor }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                      {player.name}
                      {player.id === currentPlayerId && (
                        <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded font-medium">
                          You
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {player.isHost && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    <Crown className="w-3 h-3" /> Host
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        {isHost ? (
          <div>
            <button
              onClick={handleStartGame}
              disabled={roomState.players.length < 2}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Play className="w-5 h-5 fill-current" />
              {roomState.players.length < 2 ? 'Need at least 2 players to start' : 'Start Round 1'}
            </button>
          </div>
        ) : (
          <div className="text-center py-4 bg-slate-950/40 rounded-2xl border border-slate-800 text-slate-400 text-sm animate-pulse">
            Waiting for the host to start the game...
          </div>
        )}
      </div>
    </div>
  );
};
