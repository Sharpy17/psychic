/**
 * 2D GAME BOARD (Dosia & Isa's Domain)
 * Interactive Cartesian coordinate plane with draggable pins, axes, secret target, and reveal mechanics.
 */

import React, { useState, useRef } from 'react';
import { Target, Send, Eye, Award, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, HelpCircle } from 'lucide-react';
import { RoomState, Coordinates, PlayerGuess } from '../../../shared/types';
import { socket } from '../services/socket';

interface GameBoardProps {
  roomState: RoomState;
  currentPlayerId: string;
}

export const GameBoard: React.FC<GameBoardProps> = ({ roomState, currentPlayerId }) => {
  const round = roomState.currentRound;
  if (!round) return null;

  const isPsychic = round.psychicId === currentPlayerId;
  const isHost = roomState.hostId === currentPlayerId;
  const phase = roomState.phase;

  // Local state
  const [clueInput, setClueInput] = useState('');
  const [myGuess, setMyGuess] = useState<Coordinates>({ x: 0, y: 0 });
  const [hasSubmittedGuess, setHasSubmittedGuess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const planeRef = useRef<HTMLDivElement>(null);

  // Convert board normalized coordinates (-100 to 100) to percentage (0% to 100%) for CSS positioning
  const toPercent = (coord: Coordinates) => ({
    left: `${((coord.x + 100) / 200) * 100}%`,
    top: `${((100 - coord.y) / 200) * 100}%`, // Inverted because CSS top: 0 is top
  });

  // Handle click on plane to place guess
  const handlePlaneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPsychic || phase !== 'GUESSING' || hasSubmittedGuess) return;
    if (!planeRef.current) return;

    const rect = planeRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert pixel to [-100, 100]
    const normX = Math.round(((clickX / rect.width) * 200) - 100);
    const normY = Math.round(100 - ((clickY / rect.height) * 200));

    // Clamp
    const clampedX = Math.max(-100, Math.min(100, normX));
    const clampedY = Math.max(-100, Math.min(100, normY));

    setMyGuess({ x: clampedX, y: clampedY });
  };

  // Psychic submit clue
  const handleClueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clueInput.trim()) return;

    setIsSubmitting(true);
    socket.emit('psychic:submit_clue', { clue: clueInput.trim() }, (res) => {
      setIsSubmitting(false);
    });
  };

  // Guesser lock in guess
  const handleGuessSubmit = () => {
    setIsSubmitting(true);
    socket.emit('guesser:submit_guess', { coordinates: myGuess }, (res) => {
      setIsSubmitting(false);
      if (res.success) {
        setHasSubmittedGuess(true);
      }
    });
  };

  const handleNextRound = () => {
    socket.emit('round:next');
    setHasSubmittedGuess(false);
    setClueInput('');
  };

  return (
    <div className="min-h-screen radial-bg flex flex-col p-4 md:p-8 max-w-6xl mx-auto">
      {/* Top Bar: Round info & Scores */}
      <header className="flex justify-between items-center mb-6 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-md">
        <div>
          <span className="text-xs uppercase font-extrabold tracking-widest text-purple-400">
            Round {round.roundNumber} / {round.totalRounds}
          </span>
          <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            Topic: <span className="text-indigo-300">{round.topic.name}</span>
          </h2>
        </div>

        {/* Psychic indicator */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/60">
          <Eye className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-slate-300">
            Psychic: <strong className="text-white">{round.psychicName}</strong>
            {isPsychic && ' (You!)'}
          </span>
        </div>
      </header>

      {/* Main Game Arena */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Players & Scores */}
        <div className="lg:col-span-1 bg-slate-900/70 border border-slate-800 p-4 rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" />
            Leaderboard
          </h3>
          <div className="space-y-2">
            {roomState.players
              .sort((a, b) => b.score - a.score)
              .map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border ${
                    p.id === round.psychicId
                      ? 'bg-purple-950/40 border-purple-800/60'
                      : 'bg-slate-950/50 border-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-white"
                      style={{ backgroundColor: p.avatarColor }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {p.name}
                      {p.id === currentPlayerId && ' (You)'}
                    </span>
                  </div>
                  <span className="text-sm font-mono font-bold text-purple-300">{p.score} pts</span>
                </div>
              ))}
          </div>
        </div>

        {/* Middle Column: The 2D Interactive Plane */}
        <div className="lg:col-span-3 flex flex-col items-center">
          {/* Phase Banner */}
          <div className="w-full text-center mb-4">
            {phase === 'PSYCHIC_THINKING' && (
              <div className="p-3 bg-purple-950/40 border border-purple-800/40 rounded-2xl text-purple-200 text-sm">
                {isPsychic ? (
                  <span>
                    🔮 <strong>You are the Psychic!</strong> Look at your secret target point below. Think of a{' '}
                    <strong>{round.topic.name}</strong> clue that lands right there!
                  </span>
                ) : (
                  <span className="animate-pulse">
                    🔮 The Psychic (<strong>{round.psychicName}</strong>) is meditating on a secret clue...
                  </span>
                )}
              </div>
            )}

            {phase === 'GUESSING' && (
              <div className="p-4 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-700/50 rounded-2xl text-white">
                <span className="text-xs uppercase font-extrabold tracking-widest text-purple-300 block mb-1">
                  Psychic Clue Announced:
                </span>
                <span className="text-3xl font-black text-transparent bg-gradient-to-r from-purple-200 via-pink-200 to-indigo-100 bg-clip-text">
                  "{round.clue}"
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Where does this belong between {round.xAxis.minLabel} $\leftrightarrow$ {round.xAxis.maxLabel} and {round.yAxis.minLabel} $\leftrightarrow$ {round.yAxis.maxLabel}?
                </p>
              </div>
            )}

            {phase === 'REVEAL' && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-2xl text-emerald-200">
                <span className="text-xs uppercase font-bold tracking-widest block mb-1">Target Revealed!</span>
                <p className="text-sm">
                  Clue was <strong>"{round.clue}"</strong>. See how close each guess came to the bullseye!
                </p>
              </div>
            )}
          </div>

          {/* THE 2D PLANE BOARD CONTAINER */}
          <div className="relative w-full max-w-[500px] aspect-square select-none p-8">
            {/* Outer Spectrum Labels */}
            {/* Top Y-Axis Max */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-pink-400 bg-slate-900 px-3 py-1 rounded-full border border-pink-500/30">
              <ArrowUp className="w-3.5 h-3.5" />
              {round.yAxis.maxLabel}
            </div>

            {/* Bottom Y-Axis Min */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-pink-400 bg-slate-900 px-3 py-1 rounded-full border border-pink-500/30">
              <ArrowDown className="w-3.5 h-3.5" />
              {round.yAxis.minLabel}
            </div>

            {/* Left X-Axis Min */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-purple-400 bg-slate-900 px-3 py-1 rounded-full border border-purple-500/30 whitespace-nowrap z-10">
              <ArrowLeft className="w-3.5 h-3.5" />
              {round.xAxis.minLabel}
            </div>

            {/* Right X-Axis Max */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-purple-400 bg-slate-900 px-3 py-1 rounded-full border border-purple-500/30 whitespace-nowrap z-10">
              {round.xAxis.maxLabel}
              <ArrowRight className="w-3.5 h-3.5" />
            </div>

            {/* The Clickable Cartesian Canvas Box */}
            <div
              ref={planeRef}
              onClick={handlePlaneClick}
              className={`relative w-full h-full bg-slate-900/90 border-2 border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl transition ${
                phase === 'GUESSING' && !isPsychic && !hasSubmittedGuess ? 'cursor-crosshair hover:border-purple-500' : ''
              }`}
            >
              {/* Grid Lines */}
              <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 divide-x divide-y divide-slate-800/40 pointer-events-none" />

              {/* Major Center X & Y Axes */}
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-700/70 pointer-events-none" />
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-700/70 pointer-events-none" />

              {/* 1. PSYCHIC TARGET POINT (Shown only to Psychic during thinking OR to everyone on reveal) */}
              {(isPsychic || phase === 'REVEAL') && round.targetPoint && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-700 z-20"
                  style={toPercent(round.targetPoint)}
                >
                  {/* Bullseye Rings */}
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-20 h-20 rounded-full border-2 border-dashed border-amber-400/40 animate-spin" />
                    <div className="absolute w-10 h-10 rounded-full bg-amber-400/20 border border-amber-400/60 animate-ping" />
                    <div className="w-6 h-6 rounded-full bg-amber-400 border-2 border-white shadow-lg shadow-amber-400/50 flex items-center justify-center text-[10px] font-black text-slate-950">
                      🎯
                    </div>
                  </div>
                  <div className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded shadow">
                    TARGET
                  </div>
                </div>
              )}

              {/* 2. GUESSER'S ACTIVE PIN (While placing guess) */}
              {!isPsychic && (phase === 'GUESSING' || phase === 'REVEAL') && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 transition-transform"
                  style={toPercent(myGuess)}
                >
                  <div className="w-5 h-5 rounded-full bg-indigo-500 border-2 border-white shadow-lg shadow-indigo-500/50 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <span className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                    You
                  </span>
                </div>
              )}

              {/* 3. REVEALED GUESSES FROM ALL PLAYERS */}
              {phase === 'REVEAL' &&
                Object.values(round.guesses).map((guess) => (
                  <div
                    key={guess.playerId}
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-25"
                    style={toPercent(guess.coordinates)}
                  >
                    <div
                      className="w-5 h-5 rounded-full border-2 border-white shadow-md flex items-center justify-center"
                      style={{ backgroundColor: guess.avatarColor }}
                    />
                    <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-950/80 border border-slate-700 text-white text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-1">
                      {guess.playerName}
                      {guess.scoreEarned !== undefined && (
                        <span className="text-emerald-400">+{guess.scoreEarned}</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Interactive Controls Below Plane */}
          <div className="w-full max-w-md mt-4">
            {/* Psychic clue submission form */}
            {isPsychic && phase === 'PSYCHIC_THINKING' && (
              <form onSubmit={handleClueSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder={`Clue for ${round.topic.name} (e.g. "Liu Kang")`}
                  value={clueInput}
                  onChange={(e) => setClueInput(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  disabled={!clueInput.trim() || isSubmitting}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-3 rounded-xl flex items-center gap-1.5 transition disabled:opacity-40"
                >
                  <Send className="w-4 h-4" /> Clue
                </button>
              </form>
            )}

            {/* Guesser lock-in button */}
            {!isPsychic && phase === 'GUESSING' && (
              <div>
                {!hasSubmittedGuess ? (
                  <button
                    onClick={handleGuessSubmit}
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                  >
                    <Target className="w-4 h-4" />
                    Lock In Guess (X: {myGuess.x}, Y: {myGuess.y})
                  </button>
                ) : (
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-center text-slate-300 text-sm">
                    ✅ Guess locked in! Waiting for other guessers...
                  </div>
                )}
              </div>
            )}

            {/* Host Next Round Button on Reveal */}
            {phase === 'REVEAL' && isHost && (
              <button
                onClick={handleNextRound}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-lg shadow-purple-600/30"
              >
                Continue to Next Round →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
