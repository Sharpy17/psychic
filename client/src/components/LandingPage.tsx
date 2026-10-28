/**
 * LANDING PAGE (Azim's Domain)
 * Entry portal for players to create or join rooms and read game rules.
 */

import React, { useState } from 'react';
import { Sparkles, Users, HelpCircle, ArrowRight, Compass } from 'lucide-react';
import { socket } from '../services/socket';

interface LandingPageProps {
  onJoinedRoom: (roomCode: string, playerName: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onJoinedRoom }) => {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your nickname first!');
      return;
    }
    setError(null);
    setIsLoading(true);

    socket.emit('room:create', { playerName: playerName.trim() }, (response) => {
      setIsLoading(false);
      if (response.success && response.roomCode) {
        onJoinedRoom(response.roomCode, playerName.trim());
      } else {
        setError(response.error || 'Failed to create room.');
      }
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('Please enter your nickname first!');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a 4-letter room code!');
      return;
    }
    setError(null);
    setIsLoading(true);

    socket.emit('room:join', { roomCode: roomCode.trim().toUpperCase(), playerName: playerName.trim() }, (response) => {
      setIsLoading(false);
      if (response.success) {
        onJoinedRoom(roomCode.trim().toUpperCase(), playerName.trim());
      } else {
        setError(response.error || 'Could not join room.');
      }
    });
  };

  return (
    <div className="min-h-screen radial-bg flex flex-col justify-between p-6 max-w-5xl mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center py-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-200 bg-clip-text text-transparent">
            Psychic Plane
          </span>
        </div>

        <button
          onClick={() => setShowRules(true)}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 px-4 py-2 rounded-full transition"
        >
          <HelpCircle className="w-4 h-4 text-purple-400" />
          How to Play
        </button>
      </header>

      {/* Hero Body */}
      <main className="flex-1 flex flex-col items-center justify-center text-center my-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" /> 2D Spectrum Party Game
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-2xl text-white mb-4 leading-tight">
          Read minds on a{' '}
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
            2D Coordinate Plane
          </span>
        </h1>

        <p className="text-slate-400 text-base md:text-lg max-w-lg mb-10 leading-relaxed">
          One Psychic. Two spectrum axes. A secret target point. Guess where the clue lands between
          <span className="text-purple-300"> Funny $\leftrightarrow$ Unfunny</span> and
          <span className="text-pink-300"> Cute $\leftrightarrow$ Ugly</span>.
        </p>

        {/* Action Card */}
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl shadow-purple-950/20">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl">
              {error}
            </div>
          )}

          {/* Name input */}
          <div className="mb-6 text-left">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Your Nickname
            </label>
            <input
              type="text"
              placeholder="e.g. Dosia, Liu Kang, Gandalf"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            />
          </div>

          {/* Create Room Button */}
          <button
            onClick={handleCreateRoom}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            Create New Game Room
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-3 text-slate-500 font-semibold">Or join friends</span>
            </div>
          </div>

          {/* Join Room Form */}
          <form onSubmit={handleJoinRoom} className="flex gap-2">
            <input
              type="text"
              placeholder="ROOM CODE"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={4}
              className="flex-1 uppercase font-mono tracking-widest text-center text-lg bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-5 py-3 rounded-xl flex items-center justify-center transition disabled:opacity-50"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </main>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl relative text-left">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Compass className="w-6 h-6 text-purple-400" />
              How the Game Works
            </h3>

            <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/40">
                <span className="font-bold text-purple-300 block mb-1">1. The Setup</span>
                The board has two spectrums (e.g. X-axis: <em>Unfunny $\leftrightarrow$ Funny</em>, Y-axis: <em>Ugly $\leftrightarrow$ Cute</em>).
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <span className="font-bold text-indigo-300 block mb-1">2. The Psychic's Clue</span>
                The Psychic secretly sees a random coordinate point on the grid and a category (e.g. *Video Game Characters*). They must provide a clue (e.g. *"Liu Kang"*) that matches that exact spot!
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <span className="font-bold text-pink-300 block mb-1">3. The Guessers Pin</span>
                All other players debate and place their pin on the plane where they think *"Liu Kang"* belongs on both spectrums.
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/40">
                <span className="font-bold text-emerald-300 block mb-1">4. The Big Reveal</span>
                The secret target is revealed! Points are awarded based on Euclidean distance ($d = \sqrt{\Delta x^2 + \Delta y^2}$). A direct hit earns 1000 points!
              </div>
            </div>

            <button
              onClick={() => setShowRules(false)}
              className="mt-6 w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition"
            >
              Got it, let's play!
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 py-4">
        Built by Isa (Logic), Azim (Landing), Arthur (Database), and Dosia (Arch & Integration)
      </footer>
    </div>
  );
};
