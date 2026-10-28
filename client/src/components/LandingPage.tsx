/**
 * LANDING PAGE (Azim's Domain, ported to React)
 * Features playable interactive demo board, Web Audio sound effects, and room entry modals.
 */

import React, { useState, useRef } from 'react';
import { Sparkles, Volume2, VolumeX, ArrowRight, RefreshCw, Eye } from 'lucide-react';
import { socket } from '../services/socket';
import { sound } from '../services/sound';

interface LandingPageProps {
  onJoinedRoom: (roomCode: string, playerName: string) => void;
}

interface DemoCard {
  clue: string;
  topic: string;
  top: string;
  bottom: string;
  left: string;
  right: string;
  targetX: number; // -1 to 1
  targetY: number; // -1 to 1
}

const DEMO_CARDS: DemoCard[] = [
  {
    clue: 'Liu Kang',
    topic: 'Video Game Characters',
    top: 'Cute / Beautiful',
    bottom: 'Ugly',
    left: 'Unfunny / Serious',
    right: 'Hilarious',
    targetX: -0.65,
    targetY: 0.35,
  },
  {
    clue: 'A pug in a hot dog costume',
    topic: 'Animals',
    top: 'Cute',
    bottom: 'Ugly',
    left: 'Unfunny',
    right: 'Hilarious',
    targetX: 0.8,
    targetY: 0.7,
  },
  {
    clue: 'Airport sushi',
    topic: 'Foods & Drinks',
    top: 'Delicious',
    bottom: 'Disgusting / Gross',
    left: 'Cheap',
    right: 'Expensive',
    targetX: 0.6,
    targetY: -0.75,
  },
  {
    clue: 'A Canada goose',
    topic: 'Animals',
    top: 'Terrifying / Lethal',
    bottom: 'Harmless',
    left: 'Small',
    right: 'Huge',
    targetX: -0.2,
    targetY: 0.85,
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onJoinedRoom }) => {
  // Modal states
  const [modalMode, setModalMode] = useState<'create' | 'join' | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [codeBoxes, setCodeBoxes] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  // Demo board state
  const [cardIndex, setCardIndex] = useState(0);
  const [markerPos, setMarkerPos] = useState({ x: 0, y: 0 }); // -1 to 1
  const [isRevealed, setIsRevealed] = useState(false);
  const [demoScore, setDemoScore] = useState<number | null>(null);

  const currentCard = DEMO_CARDS[cardIndex];
  const boardSvgRef = useRef<SVGSVGElement>(null);
  const codeBoxRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const toggleSound = () => {
    const next = sound.toggle();
    setSoundOn(next);
  };

  const handleNewCard = () => {
    sound.click();
    setIsRevealed(false);
    setDemoScore(null);
    setMarkerPos({ x: 0, y: 0 });
    setCardIndex((prev) => (prev + 1) % DEMO_CARDS.length);
  };

  const handleRevealDemo = () => {
    if (isRevealed) return;
    setIsRevealed(true);

    const dx = markerPos.x - currentCard.targetX;
    const dy = markerPos.y - currentCard.targetY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let points = 0;
    if (distance <= 0.15) {
      points = 1000;
      sound.bullseye();
    } else if (distance <= 0.35) {
      points = 750;
      sound.reveal();
    } else if (distance <= 0.60) {
      points = 500;
      sound.reveal();
    } else if (distance <= 0.90) {
      points = 250;
      sound.lockIn();
    } else {
      points = 0;
      sound.error();
    }
    setDemoScore(points);
  };

  // Drag/click logic on interactive demo board
  const updateMarkerFromPointer = (clientX: number, clientY: number) => {
    if (!boardSvgRef.current || isRevealed) return;
    const rect = boardSvgRef.current.getBoundingClientRect();
    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;

    // Convert to [-1, 1], flipping Y so up is positive
    const gameX = Math.max(-0.95, Math.min(0.95, normX * 2 - 1));
    const gameY = Math.max(-0.95, Math.min(0.95, (1 - normY) * 2 - 1));

    setMarkerPos({
      x: Math.round(gameX * 100) / 100,
      y: Math.round(gameY * 100) / 100,
    });
    sound.drag();
  };

  // Convert game [-1, 1] coords to SVG [0, 1000]
  const toSvg = (coord: { x: number; y: number }) => ({
    cx: ((coord.x + 1) / 2) * 1000,
    cy: ((1 - coord.y) / 2) * 1000,
  });

  const markerSvg = toSvg(markerPos);
  const targetSvg = toSvg({ x: currentCard.targetX, y: currentCard.targetY });

  // Handle Create Room
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      sound.error();
      setError('Please enter your name');
      return;
    }
    sound.click();
    setIsLoading(true);
    setError(null);

    socket.emit('room:create', { playerName: playerName.trim() }, (res) => {
      setIsLoading(false);
      if (res.success && res.roomCode) {
        sound.lockIn();
        onJoinedRoom(res.roomCode, playerName.trim());
      } else {
        sound.error();
        setError(res.error || 'Failed to create room');
      }
    });
  };

  // Handle Join Room
  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      sound.error();
      setError('Please enter your name');
      return;
    }
    const fullCode = codeBoxes.join('').toUpperCase();
    if (fullCode.length !== 4) {
      sound.error();
      setError('Room code must be 4 letters');
      return;
    }

    sound.click();
    setIsLoading(true);
    setError(null);

    socket.emit('room:join', { roomCode: fullCode, playerName: playerName.trim() }, (res) => {
      setIsLoading(false);
      if (res.success) {
        sound.lockIn();
        onJoinedRoom(fullCode, playerName.trim());
      } else {
        sound.error();
        setError(res.error || 'Could not join room');
      }
    });
  };

  // Code box keyboard navigation
  const handleCodeBoxInput = (index: number, val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-1);
    const newBoxes = [...codeBoxes];
    newBoxes[index] = clean;
    setCodeBoxes(newBoxes);

    if (clean && index < 3) {
      codeBoxRefs[index + 1].current?.focus();
    }
  };

  const handleCodeBoxKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeBoxes[index] && index > 0) {
      codeBoxRefs[index - 1].current?.focus();
    }
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col justify-between selection:bg-purple-500 selection:text-white">
      {/* Sticky Header Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#15122e]/80 border-b border-[#3a3470]/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 via-purple-500 to-amber-400 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-pink-400 via-purple-300 to-amber-300 bg-clip-text text-transparent">
                Psychic Plane
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Wavelength 2D
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleSound}
              className="p-2.5 rounded-xl bg-[#241f4d] hover:bg-[#2f2870] border border-[#3a3470] text-purple-200 transition"
              title={soundOn ? 'Mute sound' : 'Unmute sound'}
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
            <button
              onClick={() => {
                sound.click();
                setError(null);
                setModalMode('join');
              }}
              className="px-4 py-2 text-sm font-bold text-slate-300 hover:text-white bg-[#241f4d] hover:bg-[#2f2870] border border-[#3a3470] rounded-xl transition"
            >
              Join Room
            </button>
            <button
              onClick={() => {
                sound.click();
                setError(null);
                setModalMode('create');
              }}
              className="px-5 py-2 text-sm font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95"
            >
              Create Room
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Interactive Demo Board */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Pitch */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-300 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
              Party Game on 2D Spectrums
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
              Can you read your{' '}
              <span className="bg-gradient-to-r from-pink-400 via-amber-300 to-teal-300 bg-clip-text text-transparent">
                friends' minds?
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
              One Psychic gets a secret coordinate on a 2D plane and gives a clue. Everyone else tries to drop their pins as close as possible to the bullseye!
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
              <button
                onClick={() => {
                  sound.click();
                  setError(null);
                  setModalMode('create');
                }}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:opacity-95 text-white font-black text-lg shadow-xl shadow-purple-500/25 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
              >
                Create a Room
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  sound.click();
                  setError(null);
                  setModalMode('join');
                }}
                className="px-8 py-4 rounded-2xl bg-[#241f4d] hover:bg-[#2f2870] border border-[#3a3470] text-slate-200 font-bold text-lg transition"
              >
                Join with a Code
              </button>
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-6 text-xs text-slate-400 pt-4 font-semibold">
              <span className="flex items-center gap-1.5">⚡ Instant browser play</span>
              <span className="flex items-center gap-1.5">📱 Phone friendly</span>
              <span className="flex items-center gap-1.5">👥 3–10 players</span>
            </div>
          </div>

          {/* Right Hero Demo Board */}
          <div className="lg:col-span-6 flex flex-col items-center">
            <div className="w-full max-w-[460px] bg-[#1d1940]/90 border border-[#3a3470] rounded-3xl p-5 shadow-2xl backdrop-blur-xl">
              {/* Clue Header Badge */}
              <div className="flex items-center justify-between mb-3 bg-[#15122e] px-4 py-2.5 rounded-2xl border border-[#3a3470]/60">
                <div>
                  <span className="text-[10px] uppercase font-black text-purple-400 tracking-wider">
                    Topic: {currentCard.topic}
                  </span>
                  <div className="text-base font-extrabold text-white">
                    Clue: <span className="text-amber-300">"{currentCard.clue}"</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-semibold">Demo Toy</span>
                  <span className="text-xs font-bold text-teal-300">Drag dot below!</span>
                </div>
              </div>

              {/* 2D Plane Grid Container with Axis Labels */}
              <div className="relative">
                {/* Top Axis Label */}
                <div className="text-center pb-2">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    ▲ {currentCard.top}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Left Axis Label */}
                  <div className="w-7 text-center">
                    <span className="block -rotate-90 origin-center whitespace-nowrap text-xs font-extrabold text-purple-300">
                      ◀ {currentCard.left}
                    </span>
                  </div>

                  {/* The SVG Plane */}
                  <div className="flex-1 aspect-square relative rounded-2xl overflow-hidden border-2 border-[#3a3470] bg-[#15122e] shadow-inner">
                    <svg
                      ref={boardSvgRef}
                      viewBox="0 0 1000 1000"
                      className="w-full h-full cursor-crosshair touch-none select-none"
                      onPointerDown={(e) => {
                        updateMarkerFromPointer(e.clientX, e.clientY);
                      }}
                      onPointerMove={(e) => {
                        if (e.buttons === 1) {
                          updateMarkerFromPointer(e.clientX, e.clientY);
                        }
                      }}
                    >
                      {/* Grid quadrant backgrounds */}
                      <rect x="0" y="0" width="500" height="500" fill="#ff5c8d" opacity="0.04" />
                      <rect x="500" y="0" width="500" height="500" fill="#ffd35c" opacity="0.04" />
                      <rect x="0" y="500" width="500" height="500" fill="#9b7bff" opacity="0.04" />
                      <rect x="500" y="500" width="500" height="500" fill="#3fd8c7" opacity="0.04" />

                      {/* Center Crosshair Axes */}
                      <line x1="500" y1="0" x2="500" y2="1000" stroke="#3a3470" strokeWidth="3" strokeDasharray="6 6" />
                      <line x1="0" y1="500" x2="1000" y2="500" stroke="#3a3470" strokeWidth="3" strokeDasharray="6 6" />

                      {/* Reveal Concentric Rings (When Revealed) */}
                      {isRevealed && (
                        <g className="animate-drop-in">
                          {/* Edge Ring */}
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={450} fill="#8b5cf6" opacity="0.12" />
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={450} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="4 4" />

                          {/* Warm Ring */}
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={300} fill="#10b981" opacity="0.18" />
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={300} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />

                          {/* Close Ring */}
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={175} fill="#06b6d4" opacity="0.25" />
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={175} fill="none" stroke="#06b6d4" strokeWidth="2" />

                          {/* Bullseye Ring */}
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={75} fill="#f59e0b" opacity="0.45" />
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={75} fill="none" stroke="#ffd35c" strokeWidth="3" />

                          {/* Center Target Star */}
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={14} fill="#ffffff" stroke="#f59e0b" strokeWidth="4" />
                        </g>
                      )}

                      {/* Guesser Marker Dot */}
                      <g transform={`translate(${markerSvg.cx}, ${markerSvg.cy})`}>
                        <circle r={28} fill="#e5413b" opacity="0.25" className="animate-pulse-ring" />
                        <circle r={18} fill="#e5413b" stroke="#ffffff" strokeWidth="4" />
                        <text y={38} textAnchor="middle" fill="#ffffff" fontSize={26} fontWeight="bold">
                          You
                        </text>
                      </g>
                    </svg>
                  </div>

                  {/* Right Axis Label */}
                  <div className="w-7 text-center">
                    <span className="block rotate-90 origin-center whitespace-nowrap text-xs font-extrabold text-teal-300">
                      {currentCard.right} ▶
                    </span>
                  </div>
                </div>

                {/* Bottom Axis Label */}
                <div className="text-center pt-2">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    ▼ {currentCard.bottom}
                  </span>
                </div>
              </div>

              {/* Demo Controls */}
              <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-[#3a3470]/60">
                <button
                  onClick={handleNewCard}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white bg-[#241f4d] hover:bg-[#2f2870] rounded-xl border border-[#3a3470] transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  New Clue Card
                </button>

                <div className="flex items-center gap-3">
                  {demoScore !== null && (
                    <span className="text-sm font-black text-amber-300 bg-amber-500/20 px-3 py-1 rounded-xl border border-amber-500/30 animate-drop-in">
                      +{demoScore} pts!
                    </span>
                  )}
                  <button
                    onClick={handleRevealDemo}
                    disabled={isRevealed}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-slate-950 bg-gradient-to-r from-teal-400 to-teal-300 hover:from-teal-300 hover:to-teal-200 disabled:opacity-50 rounded-xl transition shadow-md shadow-teal-500/20"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Reveal Target
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* How To Play & Features Section */}
      <section className="bg-[#1d1940]/60 border-t border-[#3a3470]/50 py-12 px-6">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">How It Works</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto">Three simple steps to test your wavelength</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#241f4d]/80 border border-[#3a3470] rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 font-black">
                1
              </div>
              <h3 className="font-extrabold text-white text-lg">The Psychic Peeks</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                One player sees the secret coordinate $(x, y)$ visible only to them, along with two opposing attribute axes.
              </p>
            </div>

            <div className="bg-[#241f4d]/80 border border-[#3a3470] rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black">
                2
              </div>
              <h3 className="font-extrabold text-white text-lg">They Give One Clue</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                The Psychic gives a single clue word or character (e.g. <em>"Liu Kang"</em>) that fits that exact spot on both spectrums.
              </p>
            </div>

            <div className="bg-[#241f4d]/80 border border-[#3a3470] rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 font-black">
                3
              </div>
              <h3 className="font-extrabold text-white text-lg">Everyone Places a Dot</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Guessers discuss, drag their pins to where they think the clue belongs, and lock in. Direct Bullseye hits score 1,000 pts!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#3a3470]/40 py-6 px-6 text-center text-xs text-slate-500">
        Psychic Plane &bull; Built with React, TypeScript & Socket.io &bull; Free open-source party game
      </footer>

      {/* Modal: Create Room */}
      {modalMode === 'create' && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1d1940] border border-[#3a3470] rounded-3xl p-6 sm:p-8 shadow-2xl animate-drop-in">
            <h2 className="text-2xl font-black text-white mb-2">Create a Game Room</h2>
            <p className="text-sm text-slate-300 mb-6">Choose a nickname your friends will recognize.</p>

            <form onSubmit={handleCreateSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-purple-300 mb-2">
                  Your Nickname
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="e.g. Dosia, Alex"
                  autoFocus
                  className="w-full bg-[#15122e] border border-[#3a3470] focus:border-amber-400 rounded-xl px-4 py-3 text-white font-bold outline-none transition"
                />
              </div>

              {error && <div className="text-xs text-red-400 font-semibold bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</div>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-300 hover:text-white bg-[#241f4d] rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 text-sm font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:opacity-95 rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Room */}
      {modalMode === 'join' && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1d1940] border border-[#3a3470] rounded-3xl p-6 sm:p-8 shadow-2xl animate-drop-in">
            <h2 className="text-2xl font-black text-white mb-2">Join a Room</h2>
            <p className="text-sm text-slate-300 mb-6">Enter the 4-letter room code from your host.</p>

            <form onSubmit={handleJoinSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-purple-300 mb-2">
                  Your Nickname
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="e.g. Sam"
                  autoFocus
                  className="w-full bg-[#15122e] border border-[#3a3470] focus:border-amber-400 rounded-xl px-4 py-3 text-white font-bold outline-none transition mb-4"
                />

                <label className="block text-xs font-extrabold uppercase tracking-wider text-purple-300 mb-2">
                  4-Letter Room Code
                </label>
                <div className="flex gap-2 justify-center">
                  {codeBoxes.map((box, idx) => (
                    <input
                      key={idx}
                      ref={codeBoxRefs[idx]}
                      type="text"
                      maxLength={1}
                      value={box}
                      onChange={(e) => handleCodeBoxInput(idx, e.target.value)}
                      onKeyDown={(e) => handleCodeBoxKeyDown(idx, e)}
                      className="w-14 h-16 text-center text-2xl font-black font-mono uppercase bg-[#15122e] border border-[#3a3470] focus:border-amber-400 rounded-xl text-white outline-none transition"
                    />
                  ))}
                </div>
              </div>

              {error && <div className="text-xs text-red-400 font-semibold bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</div>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-300 hover:text-white bg-[#241f4d] rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 text-sm font-black text-slate-950 bg-gradient-to-r from-teal-400 to-teal-300 hover:opacity-95 rounded-xl shadow-lg shadow-teal-500/20 transition disabled:opacity-50"
                >
                  {isLoading ? 'Joining...' : 'Join Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
