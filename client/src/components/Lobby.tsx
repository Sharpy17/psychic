/**
 * LOBBY SCREEN (Azim & Dosia's Domain)
 * Displays connected players, 4-letter room code, and allows the host to start the game.
 */

import React, { useState } from 'react';
import { Crown, Copy, Check, Play, Users, Sparkles } from 'lucide-react';
import { RoomState } from '../../../shared/types';
import { socket } from '../services/socket';
import { sound } from '../services/sound';

interface LobbyProps {
  roomState: RoomState;
  currentPlayerId: string;
}

export const Lobby: React.FC<LobbyProps> = ({ roomState, currentPlayerId }) => {
  const [copied, setCopied] = useState(false);
  const me = roomState.players.find((p) => p.id === currentPlayerId);
  const isHost = me?.isHost || false;

  const handleCopyCode = () => {
    sound.click();
    navigator.clipboard.writeText(roomState.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    sound.lockIn();
    socket.emit('game:start');
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl bg-[#1d1940]/90 border border-[#3a3470] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl animate-drop-in">
        {/* Room Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Lobby Waiting Room
          </div>

          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2">Room Code</h2>
          <div className="flex items-center justify-center gap-3 mt-1">
            <span className="text-5xl font-mono font-black tracking-widest text-transparent bg-gradient-to-r from-pink-400 via-amber-300 to-teal-300 bg-clip-text">
              {roomState.roomCode}
            </span>
            <button
              onClick={handleCopyCode}
              title="Copy Room Code"
              className="p-3 rounded-xl bg-[#241f4d] hover:bg-[#2f2870] text-slate-300 hover:text-white transition border border-[#3a3470]"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 font-medium">Share this code with your friends to join</p>
        </div>

        {/* Players List */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-400" />
              Players in Room ({roomState.players.length}/10)
            </span>
            <span className="text-xs text-amber-300 font-bold">Min 2 required</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roomState.players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#15122e] border border-[#3a3470]/70"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-md"
                    style={{ backgroundColor: player.avatarColor }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm font-extrabold text-white block leading-tight">{player.name}</span>
                    {player.id === currentPlayerId && (
                      <span className="text-[10px] text-teal-400 font-bold">You</span>
                    )}
                  </div>
                </div>

                {player.isHost && (
                  <span className="flex items-center gap-1 text-[11px] font-black text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    <Crown className="w-3 h-3 text-amber-400" /> Host
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Host Controls */}
        <div className="space-y-3">
          {isHost ? (
            <button
              onClick={handleStartGame}
              disabled={roomState.players.length < 2}
              className="w-full py-4 rounded-2xl font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-teal-300 hover:opacity-95 disabled:opacity-40 shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition text-base"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              {roomState.players.length < 2 ? 'Need at least 2 players' : 'Start Game!'}
            </button>
          ) : (
            <div className="text-center p-3 rounded-2xl bg-[#15122e] border border-[#3a3470] text-sm text-slate-400 font-semibold animate-pulse">
              Waiting for the host to start the game...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
