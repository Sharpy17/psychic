/**
 * 2D GAME BOARD COMPONENT (Dosia & Isa's Domain)
 * Authoritative SVG unit square implementation adhering to docs/04 - Modules & UI/2D Coordinate Board Component.md
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Trophy,
  Send,
  Eye,
  CheckCircle2,
  Clock,
  ArrowRight,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  RoomState,
  Point2D,
  RevealPayload,
  RevealGuess,
} from '../../../shared/types';
import { socket } from '../services/socket';
import { sound } from '../services/sound';

interface GameBoardProps {
  roomState: RoomState;
  currentPlayerId: string;
}

export const GameBoard: React.FC<GameBoardProps> = ({ roomState, currentPlayerId }) => {
  const round = roomState.currentRound;
  if (!round) return null;

  const isPsychic = round.psychicId === currentPlayerId;
  const isHost = roomState.players.find((p) => p.id === currentPlayerId)?.isHost || false;
  const phase = roomState.phase;

  // Local state
  const [clueInput, setClueInput] = useState('');
  const [myGuess, setMyGuess] = useState<Point2D>({ x: 0, y: 0 }); // [-1, 1]
  const [hasLocked, setHasLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secretTargetOverride, setSecretTargetOverride] = useState<Point2D | null>(null);
  const [revealData, setRevealData] = useState<RevealPayload | null>(null);
  const [soundOn, setSoundOn] = useState(sound.isEnabled());

  const svgRef = useRef<SVGSVGElement>(null);

  // Listen for socket events
  useEffect(() => {
    const onPsychicSecret = ({ targetX, targetY }: { targetX: number; targetY: number }) => {
      setSecretTargetOverride({ x: targetX, y: targetY });
    };

    const onReveal = (payload: RevealPayload) => {
      setRevealData(payload);
      sound.reveal();
      // Check for bullseyes
      if (payload.guesses.some((g) => g.tier === 'Bullseye')) {
        setTimeout(() => sound.bullseye(), 400);
      }
    };

    const onGuessLocked = ({ playerId }: { playerId: string }) => {
      if (playerId === currentPlayerId) {
        setHasLocked(true);
      }
      sound.click();
    };

    socket.on('psychic:secret_data', onPsychicSecret);
    socket.on('game:reveal', onReveal);
    socket.on('player:guess_locked', onGuessLocked);

    return () => {
      socket.off('psychic:secret_data', onPsychicSecret);
      socket.off('game:reveal', onReveal);
      socket.off('player:guess_locked', onGuessLocked);
    };
  }, [currentPlayerId]);

  // Reset local guess & lock when round changes
  useEffect(() => {
    if (phase === 'PSYCHIC_TURN') {
      setHasLocked(false);
      setMyGuess({ x: 0, y: 0 });
      setClueInput('');
      setRevealData(null);
    }
  }, [round.roundNumber, phase]);

  // Coordinate Conversion: [-1, 1] Cartesian -> [0, 1000] SVG viewBox
  const toSvg = (coord: Point2D) => ({
    cx: ((coord.x + 1) / 2) * 1000,
    cy: ((1 - coord.y) / 2) * 1000, // Inverted because SVG 0 is at top
  });

  // Pointer drag/tap handling on the SVG plane
  const handlePointerEvent = (clientX: number, clientY: number) => {
    if (isPsychic || phase !== 'GUESSING' || hasLocked) return;
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;

    // Convert [0, 1] to [-1, 1], flipping Y so up is positive
    const gameX = Math.max(-0.95, Math.min(0.95, normX * 2 - 1));
    const gameY = Math.max(-0.95, Math.min(0.95, (1 - normY) * 2 - 1));

    setMyGuess({
      x: Math.round(gameX * 1000) / 1000,
      y: Math.round(gameY * 1000) / 1000,
    });
    sound.drag();
  };

  // Submit Clue (Psychic)
  const handleClueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clueInput.trim()) return;

    sound.click();
    setIsSubmitting(true);
    socket.emit('psychic:submit_clue', { clue: clueInput.trim() }, () => {
      setIsSubmitting(false);
      sound.lockIn();
    });
  };

  // Lock In Guess (Guesser)
  const handleGuessSubmit = () => {
    sound.click();
    setIsSubmitting(true);
    socket.emit('player:submit_guess', { x: myGuess.x, y: myGuess.y }, (res) => {
      setIsSubmitting(false);
      if (res?.success) {
        setHasLocked(true);
        sound.lockIn();
      }
    });
  };

  // Next Round
  const handleNextRound = () => {
    sound.click();
    socket.emit('game:next_round');
  };

  // Target coordinates for psychic view or reveal view
  const activeTarget: Point2D | null =
    revealData?.secretTarget ||
    round.secretTarget ||
    (isPsychic ? secretTargetOverride : null);

  const targetSvg = activeTarget ? toSvg(activeTarget) : null;
  const myGuessSvg = toSvg(myGuess);

  // Active guessers who locked in
  const nonPsychicPlayers = roomState.players.filter((p) => p.id !== round.psychicId);
  const lockedCount = Object.keys(round.guesses).length;

  return (
    <div className="min-h-screen text-slate-100 flex flex-col justify-between p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between bg-[#1d1940]/80 border border-[#3a3470] rounded-2xl px-5 py-3 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-amber-400 flex items-center justify-center font-black text-xs text-white shadow-md">
            R{round.roundNumber}
          </div>
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-purple-300 block">
              Round {round.roundNumber} of {round.totalRounds}
            </span>
            <span className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5">
              Topic: <span className="text-amber-300 font-bold">{round.content.topic}</span>
            </span>
          </div>
        </div>

        {/* Psychic & Timer indicator */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-[#15122e] px-3 py-1.5 rounded-xl border border-[#3a3470]/60">
            <span className="text-xs text-slate-400">Psychic:</span>
            <span className="text-xs font-black text-pink-400">{round.psychicName}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
            <Clock className="w-3.5 h-3.5" />
            {round.timeRemaining}s
          </div>

          <button
            onClick={() => setSoundOn(sound.toggle())}
            className="p-2 rounded-xl bg-[#241f4d] border border-[#3a3470] text-purple-200 transition"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </header>

      {/* Main Play Area */}
      <div className="flex-1 my-4 flex flex-col items-center justify-center">
        {/* Banner: Topic & Clue Announcement */}
        <div className="w-full max-w-xl text-center mb-4">
          {phase === 'PSYCHIC_TURN' && (
            <div className="inline-block bg-pink-500/15 border border-pink-500/30 px-5 py-2.5 rounded-2xl animate-pulse">
              {isPsychic ? (
                <span className="text-sm font-extrabold text-pink-300">
                  ✨ You are the Psychic! Inspect the secret point and type a clue.
                </span>
              ) : (
                <span className="text-sm font-extrabold text-purple-200">
                  🔮 {round.psychicName} is channeling telepathic wavelength...
                </span>
              )}
            </div>
          )}

          {(phase === 'GUESSING' || phase === 'REVEAL' || phase === 'ROUND_END') && round.clue && (
            <div className="bg-[#1d1940] border border-[#3a3470] px-6 py-3 rounded-2xl shadow-xl inline-block max-w-lg">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Psychic Clue ({round.content.topic})
              </span>
              <div className="text-2xl sm:text-3xl font-black text-amber-300 mt-0.5">
                "{round.clue}"
              </div>
            </div>
          )}
        </div>

        {/* The 2D Coordinate Board Grid */}
        <div className="w-full max-w-[480px]">
          {/* Top Axis Label */}
          <div className="text-center pb-2">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs sm:text-sm font-black bg-pink-500/20 text-pink-300 border border-pink-500/30 shadow-md">
              ▲ {round.content.axisY.positive}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Left Axis Label */}
            <div className="w-8 text-center">
              <span className="block -rotate-90 origin-center whitespace-nowrap text-xs sm:text-sm font-black text-purple-300">
                ◀ {round.content.axisX.negative}
              </span>
            </div>

            {/* SVG Canvas Board */}
            <div className="flex-1 aspect-square relative rounded-3xl overflow-hidden border-2 border-[#3a3470] bg-[#15122e] shadow-2xl">
              <svg
                ref={svgRef}
                viewBox="0 0 1000 1000"
                className="w-full h-full cursor-crosshair touch-none select-none"
                onPointerDown={(e) => handlePointerEvent(e.clientX, e.clientY)}
                onPointerMove={(e) => {
                  if (e.buttons === 1) handlePointerEvent(e.clientX, e.clientY);
                }}
              >
                {/* Quadrant backgrounds */}
                <rect x="0" y="0" width="500" height="500" fill="#ff5c8d" opacity="0.05" />
                <rect x="500" y="0" width="500" height="500" fill="#ffd35c" opacity="0.05" />
                <rect x="0" y="500" width="500" height="500" fill="#9b7bff" opacity="0.05" />
                <rect x="500" y="500" width="500" height="500" fill="#3fd8c7" opacity="0.05" />

                {/* Grid guidelines */}
                <line x1="250" y1="0" x2="250" y2="1000" stroke="#3a3470" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                <line x1="750" y1="0" x2="750" y2="1000" stroke="#3a3470" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                <line x1="0" y1="250" x2="1000" y2="250" stroke="#3a3470" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                <line x1="0" y1="750" x2="1000" y2="750" stroke="#3a3470" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />

                {/* Center Crosshairs */}
                <line x1="500" y1="0" x2="500" y2="1000" stroke="#4a4290" strokeWidth="3" strokeDasharray="8 6" />
                <line x1="0" y1="500" x2="1000" y2="500" stroke="#4a4290" strokeWidth="3" strokeDasharray="8 6" />

                {/* Secret Target for Psychic during PSYCHIC_TURN / GUESSING */}
                {isPsychic && activeTarget && targetSvg && phase !== 'REVEAL' && phase !== 'ROUND_END' && (
                  <g transform={`translate(${targetSvg.cx}, ${targetSvg.cy})`}>
                    <circle r={40} fill="#f59e0b" opacity="0.2" className="animate-pulse-ring" />
                    <circle r={22} fill="#f59e0b" stroke="#ffffff" strokeWidth="4" />
                    <text y={38} textAnchor="middle" fill="#ffd35c" fontSize={22} fontWeight="bold">
                      Secret Target
                    </text>
                  </g>
                )}

                {/* REVEAL: Concentric Target Rings and All Guesses */}
                {(phase === 'REVEAL' || phase === 'ROUND_END' || phase === 'GAME_OVER') && targetSvg && (
                  <g className="animate-drop-in">
                    {/* Edge Ring: r = 450 (0.90 * 500) */}
                    <circle cx={targetSvg.cx} cy={targetSvg.cy} r={450} fill="#8b5cf6" opacity="0.12" />
                    <circle cx={targetSvg.cx} cy={targetSvg.cy} r={450} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="4 4" />

                    {/* Warm Ring: r = 300 (0.60 * 500) */}
                    <circle cx={targetSvg.cx} cy={targetSvg.cy} r={300} fill="#10b981" opacity="0.18" />
                    <circle cx={targetSvg.cx} cy={targetSvg.cy} r={300} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />

                    {/* Close Ring: r = 175 (0.35 * 500) */}
                    <circle cx={targetSvg.cx} cy={targetSvg.cy} r={175} fill="#06b6d4" opacity="0.25" />
                    <circle cx={targetSvg.cx} cy={targetSvg.cy} r={175} fill="none" stroke="#06b6d4" strokeWidth="2.5" />

                    {/* Bullseye Ring: r = 75 (0.15 * 500) */}
                    <circle cx={targetSvg.cx} cy={targetSvg.cy} r={75} fill="#f59e0b" opacity="0.45" />
                    <circle cx={targetSvg.cx} cy={targetSvg.cy} r={75} fill="none" stroke="#ffd35c" strokeWidth="3.5" />

                    {/* Bullseye Center Dot */}
                    <circle cx={targetSvg.cx} cy={targetSvg.cy} r={16} fill="#ffffff" stroke="#f59e0b" strokeWidth="5" />
                  </g>
                )}

                {/* Player Pins during REVEAL */}
                {(phase === 'REVEAL' || phase === 'ROUND_END' || phase === 'GAME_OVER') &&
                  revealData?.guesses.map((g) => {
                    const pos = toSvg(g.coords);
                    return (
                      <g key={g.playerId} transform={`translate(${pos.cx}, ${pos.cy})`} className="animate-drop-in">
                        {/* Connecting dotted line to target */}
                        {targetSvg && (
                          <line
                            x1={0}
                            y1={0}
                            x2={targetSvg.cx - pos.cx}
                            y2={targetSvg.cy - pos.cy}
                            stroke={g.avatarColor}
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            opacity={0.6}
                          />
                        )}
                        <circle r={20} fill={g.avatarColor} stroke="#ffffff" strokeWidth="3" />
                        <text y={32} textAnchor="middle" fill="#ffffff" fontSize={22} fontWeight="bold">
                          {g.playerName} (+{g.scoreAwarded})
                        </text>
                      </g>
                    );
                  })}

                {/* Guesser's active pin during GUESSING */}
                {!isPsychic && (phase === 'GUESSING' || phase === 'PSYCHIC_TURN') && (
                  <g transform={`translate(${myGuessSvg.cx}, ${myGuessSvg.cy})`}>
                    <circle r={26} fill="#3fd8c7" opacity="0.2" className="animate-pulse-ring" />
                    <circle r={18} fill="#3fd8c7" stroke="#ffffff" strokeWidth="3.5" />
                    <text y={34} textAnchor="middle" fill="#ffffff" fontSize={20} fontWeight="bold">
                      {hasLocked ? 'Locked' : 'Your Pin'}
                    </text>
                  </g>
                )}
              </svg>
            </div>

            {/* Right Axis Label */}
            <div className="w-8 text-center">
              <span className="block rotate-90 origin-center whitespace-nowrap text-xs sm:text-sm font-black text-teal-300">
                {round.content.axisX.positive} ▶
              </span>
            </div>
          </div>

          {/* Bottom Axis Label */}
          <div className="text-center pt-2">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs sm:text-sm font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-md">
              ▼ {round.content.axisY.negative}
            </span>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="w-full max-w-xl mt-4">
          {/* 1. Psychic Clue Input Form */}
          {phase === 'PSYCHIC_TURN' && isPsychic && (
            <form onSubmit={handleClueSubmit} className="flex gap-2">
              <input
                type="text"
                maxLength={40}
                value={clueInput}
                onChange={(e) => setClueInput(e.target.value)}
                placeholder={`Type a clue fitting topic: ${round.content.topic}`}
                autoFocus
                className="flex-1 bg-[#1d1940] border border-[#3a3470] focus:border-amber-400 rounded-2xl px-5 py-3 text-white font-extrabold outline-none shadow-xl"
              />
              <button
                type="submit"
                disabled={isSubmitting || !clueInput.trim()}
                className="px-6 py-3 rounded-2xl font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:opacity-90 disabled:opacity-50 shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition"
              >
                <Send className="w-4 h-4" />
                Submit
              </button>
            </form>
          )}

          {/* 2. Guesser Lock-In Button */}
          {phase === 'GUESSING' && !isPsychic && (
            <div className="flex items-center justify-between bg-[#1d1940] border border-[#3a3470] p-4 rounded-2xl">
              <div>
                <span className="text-xs text-slate-400 block font-semibold">Your coordinate position</span>
                <span className="text-sm font-mono font-bold text-teal-300">
                  X: {myGuess.x.toFixed(2)}, Y: {myGuess.y.toFixed(2)}
                </span>
              </div>
              <button
                onClick={handleGuessSubmit}
                disabled={hasLocked || isSubmitting}
                className="px-8 py-3 rounded-xl font-black text-slate-950 bg-gradient-to-r from-teal-400 to-teal-300 hover:opacity-90 disabled:opacity-50 shadow-lg shadow-teal-500/20 transition"
              >
                {hasLocked ? '✓ Guess Locked In!' : 'Lock In Guess'}
              </button>
            </div>
          )}

          {/* 3. Psychic Spectator View during GUESSING */}
          {phase === 'GUESSING' && isPsychic && (
            <div className="text-center bg-[#1d1940] border border-[#3a3470] p-4 rounded-2xl">
              <span className="text-xs text-slate-400 font-bold block mb-1">
                Waiting for players to lock in ({lockedCount}/{nonPsychicPlayers.length})
              </span>
              <div className="flex justify-center gap-2">
                {nonPsychicPlayers.map((p) => {
                  const locked = !!round.guesses[p.id];
                  return (
                    <span
                      key={p.id}
                      className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                        locked
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {locked ? '✓ ' : '⏳ '}
                      {p.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Reveal & Round End Results */}
          {(phase === 'REVEAL' || phase === 'ROUND_END') && (
            <div className="space-y-4 animate-drop-in">
              <div className="bg-[#1d1940] border border-[#3a3470] p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-bold block">Psychic Score Awarded</span>
                  <span className="text-xl font-black text-amber-300">
                    +{revealData?.psychicScoreAwarded || 0} pts
                  </span>
                </div>

                {isHost && (
                  <button
                    onClick={handleNextRound}
                    className="px-6 py-2.5 rounded-xl font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:opacity-90 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition"
                  >
                    Next Round
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 5. Game Over Podium */}
          {phase === 'GAME_OVER' && (
            <div className="bg-[#1d1940] border border-[#3a3470] p-6 rounded-3xl text-center space-y-4 animate-drop-in">
              <Trophy className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
              <h2 className="text-2xl font-black text-white">Game Over!</h2>

              <div className="space-y-2 max-w-sm mx-auto">
                {roomState.players
                  .sort((a, b) => b.score - a.score)
                  .map((player, idx) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between bg-[#15122e] px-4 py-2.5 rounded-xl border border-[#3a3470]"
                    >
                      <span className="font-extrabold text-sm flex items-center gap-2">
                        <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️'}</span>
                        {player.name}
                      </span>
                      <span className="font-mono font-black text-amber-300">{player.score} pts</span>
                    </div>
                  ))}
              </div>

              {isHost && (
                <button
                  onClick={handleNextRound}
                  className="px-6 py-3 rounded-2xl font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:opacity-90 shadow-lg transition"
                >
                  Play Again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
