/**
 * LANDING PAGE - AZIM'S MYSTIC THEME (Ported to React)
 * Features celestial starfield, glowing crystal board, tarot card rules, and room modals.
 * Reference: prototype/variants/mystic.html
 */

import React, { useState, useRef } from 'react';
import { Volume2, VolumeX, ArrowRight, RefreshCw, Eye } from 'lucide-react';
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
    top: 'Handsome / Cute',
    bottom: 'Ugly',
    left: 'Serious / Boring',
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
    targetX: 0.75,
    targetY: 0.7,
  },
  {
    clue: 'Airport sushi',
    topic: 'Foods & Drinks',
    top: 'Delicious',
    bottom: 'Disgusting / Gross',
    left: 'Dirt Cheap',
    right: 'Ultra-Luxurious',
    targetX: 0.6,
    targetY: -0.75,
  },
  {
    clue: 'A Canada goose',
    topic: 'Animals',
    top: 'Lethally Powerful',
    bottom: 'Completely Harmless',
    left: 'Small',
    right: 'Huge',
    targetX: -0.2,
    targetY: 0.85,
  },
  {
    clue: 'A fanny pack',
    topic: 'Everyday Objects',
    top: 'Desert Island Essential',
    bottom: 'Totally Useless',
    left: 'Unbearably Cringe',
    right: 'Undeniably Cool',
    targetX: 0.65,
    targetY: 0.5,
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onJoinedRoom }) => {
  // Modal states
  const [modalMode, setModalMode] = useState<'create' | 'join' | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [codeBoxes, setCodeBoxes] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [soundOn, setSoundOn] = useState(sound.isEnabled());

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
    <div className="min-h-screen bg-mystic text-[#f3ead6] flex flex-col justify-between selection:bg-[#e8c36a] selection:text-[#0a0820]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#0a0820]/80 border-b border-[#3b2f5e]/60 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#9c6bff] to-[#e8c36a] shadow-[0_0_14px_#9c6bff] flex items-center justify-center">
              <span className="text-xs text-white">✦</span>
            </div>
            <div>
              <span className="text-xl font-serif font-bold tracking-wider text-[#e8c36a]">
                Psychic Plane
              </span>
              <span className="hidden sm:inline-block ml-3 text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-[#e8c36a]/15 text-[#e8c36a] border border-[#e8c36a]/30">
                Wavelength 2D
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleSound}
              className="p-2.5 rounded-full border border-[#e8c36a]/30 hover:border-[#e8c36a] text-[#e8c36a] hover:bg-[#e8c36a]/10 transition"
              title={soundOn ? 'Mute sound' : 'Unmute sound'}
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
            <button
              onClick={() => {
                sound.click();
                setError(null);
                setModalMode('join');
              }}
              className="px-5 py-2 text-xs font-serif font-bold text-[#e8c36a] hover:bg-[#e8c36a]/15 border border-[#e8c36a]/50 rounded-full transition"
            >
              Join Room
            </button>
            <button
              onClick={() => {
                sound.click();
                setError(null);
                setModalMode('create');
              }}
              className="px-6 py-2 text-xs font-serif font-bold text-[#0a0820] bg-gradient-to-r from-[#f3d68a] to-[#c99a3e] hover:shadow-[0_0_20px_#e8c36a88] rounded-full transition transform active:scale-95"
            >
              Create Room
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Pitch */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="text-xs uppercase tracking-[0.3em] font-serif text-[#e8c36a]">
              ✦ CAN YOU SENSE IT? ✦
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-[1.1]">
              Can you read your{' '}
              <em className="text-[#e8c36a] not-italic shadow-[0_0_24px_#e8c36a66]">
                friends' minds?
              </em>
            </h1>

            <p className="text-base sm:text-lg text-[#b3a7c9] leading-relaxed max-w-xl mx-auto lg:mx-0 font-serif">
              One Psychic channels a secret coordinate on the celestial 2D spectrum and utters a single clue. The guessers align their wavelengths to locate the bullseye!
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
              <button
                onClick={() => {
                  sound.click();
                  setError(null);
                  setModalMode('create');
                }}
                className="px-8 py-4 rounded-full bg-gradient-to-r from-[#f3d68a] to-[#c99a3e] hover:shadow-[0_0_28px_#e8c36a88] text-[#0a0820] font-serif font-bold text-base shadow-xl transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
              >
                Create a Room
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  sound.click();
                  setError(null);
                  setModalMode('join');
                }}
                className="px-8 py-4 rounded-full border border-[#e8c36a]/40 hover:border-[#e8c36a] hover:bg-[#e8c36a]/10 text-[#e8c36a] font-serif font-bold text-base transition"
              >
                Join with a Code
              </button>
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-6 text-xs text-[#b3a7c9] pt-4 font-serif">
              <span>✦ Instant browser play</span>
              <span>✦ Touch & phone friendly</span>
              <span>✦ 3–10 players</span>
            </div>
          </div>

          {/* Right Crystal Board Frame (Azim's Mystic Design) */}
          <div className="lg:col-span-6 flex flex-col items-center">
            <div className="w-full max-w-[460px] crystal-frame rounded-[28px] p-6 shadow-2xl relative">
              {/* Gold Inner Border Accent */}
              <div className="absolute inset-2 border border-[#e8c36a]/20 rounded-[20px] pointer-events-none" />

              {/* Clue Header Badge */}
              <div className="text-center mb-3 relative z-10">
                <small className="text-[#b3a7c9] text-xs font-serif italic block">
                  ✦ {currentCard.topic} ✦
                </small>
                <div className="text-xl sm:text-2xl font-serif italic text-white mt-0.5">
                  “<span className="text-[#e8c36a]">{currentCard.clue}</span>”
                </div>
              </div>

              {/* 2D Plane Grid Container with Axis Labels */}
              <div className="relative z-10">
                {/* Top Axis Label */}
                <div className="text-center pb-2">
                  <span className="inline-block px-4 py-1 rounded-full text-xs font-serif font-semibold bg-[#e8c36a]/15 text-[#e8c36a] border border-[#e8c36a]/30 shadow-md">
                    ▲ {currentCard.top}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Left Axis Label */}
                  <div className="w-7 text-center">
                    <span className="block -rotate-90 origin-center whitespace-nowrap text-xs font-serif font-semibold text-[#e8c36a]">
                      ◀ {currentCard.left}
                    </span>
                  </div>

                  {/* The SVG Plane */}
                  <div className="flex-1 aspect-square relative rounded-2xl overflow-hidden border border-[#3b2f5e] bg-[#1b1440] shadow-inner animate-breathe">
                    <svg
                      ref={boardSvgRef}
                      viewBox="0 0 1000 1000"
                      className="w-full h-full cursor-crosshair touch-none select-none"
                      onPointerDown={(e) => updateMarkerFromPointer(e.clientX, e.clientY)}
                      onPointerMove={(e) => {
                        if (e.buttons === 1) updateMarkerFromPointer(e.clientX, e.clientY);
                      }}
                    >
                      {/* Grid quadrant backgrounds */}
                      <rect x="0" y="0" width="500" height="500" fill="#8f6bff" opacity="0.08" />
                      <rect x="500" y="0" width="500" height="500" fill="#e8c36a" opacity="0.08" />
                      <rect x="0" y="500" width="500" height="500" fill="#4bc6ff" opacity="0.08" />
                      <rect x="500" y="500" width="500" height="500" fill="#ff7ac6" opacity="0.08" />

                      {/* Center Crosshairs */}
                      <line x1="500" y1="0" x2="500" y2="1000" stroke="#e8c36a" strokeWidth="2" strokeDasharray="6 6" opacity="0.4" />
                      <line x1="0" y1="500" x2="1000" y2="500" stroke="#e8c36a" strokeWidth="2" strokeDasharray="6 6" opacity="0.4" />

                      {/* Reveal Concentric Rings (When Revealed) */}
                      {isRevealed && (
                        <g className="animate-drop-in">
                          {/* Edge Ring: r = 450 */}
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={450} fill="#5b3fb0" opacity="0.2" />
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={450} fill="none" stroke="#8f6bff" strokeWidth="2" strokeDasharray="4 4" />

                          {/* Warm Ring: r = 300 */}
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={300} fill="#7b52cc" opacity="0.25" />
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={300} fill="none" stroke="#9c6bff" strokeWidth="2" strokeDasharray="4 4" />

                          {/* Close Ring: r = 175 */}
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={175} fill="#9c6bff" opacity="0.35" />
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={175} fill="none" stroke="#b99cff" strokeWidth="2.5" />

                          {/* Bullseye Ring: r = 75 */}
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={75} fill="#e8c36a" opacity="0.5" />
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={75} fill="none" stroke="#f3d68a" strokeWidth="3.5" />

                          {/* Bullseye Center Dot */}
                          <circle cx={targetSvg.cx} cy={targetSvg.cy} r={14} fill="#ffffff" stroke="#e8c36a" strokeWidth="4" />
                        </g>
                      )}

                      {/* Guesser Marker Dot */}
                      <g transform={`translate(${markerSvg.cx}, ${markerSvg.cy})`}>
                        <circle r={28} fill="#e8c36a" opacity="0.2" className="animate-pulse-ring" />
                        <circle r={18} fill="#f3ead6" stroke="#e8c36a" strokeWidth="4" />
                        <text y={38} textAnchor="middle" fill="#ffffff" fontSize={26} fontFamily="serif" fontWeight="bold">
                          You
                        </text>
                      </g>
                    </svg>
                  </div>

                  {/* Right Axis Label */}
                  <div className="w-7 text-center">
                    <span className="block rotate-90 origin-center whitespace-nowrap text-xs font-serif font-semibold text-[#e8c36a]">
                      {currentCard.right} ▶
                    </span>
                  </div>
                </div>

                {/* Bottom Axis Label */}
                <div className="text-center pt-2">
                  <span className="inline-block px-4 py-1 rounded-full text-xs font-serif font-semibold bg-[#e8c36a]/15 text-[#e8c36a] border border-[#e8c36a]/30 shadow-md">
                    ▼ {currentCard.bottom}
                  </span>
                </div>
              </div>

              {/* Demo Controls */}
              <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-[#3b2f5e]/80 relative z-10">
                <button
                  onClick={handleNewCard}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-serif text-[#b3a7c9] hover:text-[#e8c36a] rounded-full border border-[#3b2f5e] hover:border-[#e8c36a]/40 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  New Clue Card
                </button>

                <div className="flex items-center gap-3">
                  {demoScore !== null && (
                    <span className="text-xs font-serif font-bold text-[#e8c36a] bg-[#e8c36a]/15 px-3 py-1 rounded-full border border-[#e8c36a]/30 animate-drop-in">
                      +{demoScore} pts!
                    </span>
                  )}
                  <button
                    onClick={handleRevealDemo}
                    disabled={isRevealed}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-serif font-bold text-[#0a0820] bg-gradient-to-r from-[#f3d68a] to-[#c99a3e] hover:shadow-[0_0_16px_#e8c36a88] disabled:opacity-50 rounded-full transition"
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

      {/* Tarot Card Rules Section */}
      <section className="border-t border-[#3b2f5e]/60 py-16 px-6 bg-[#0a0820]/60">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#e8c36a]">The Three Divinations</h2>
            <p className="text-[#b3a7c9] text-sm font-serif italic max-w-md mx-auto">
              How the mystical game unfolds
            </p>
            <div className="text-[#a8843c] tracking-[0.6em] text-xs">✦ ✦ ✦</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card I */}
            <div className="bg-gradient-to-b from-[#1d1645] to-[#120d2b] border border-[#a8843c]/60 rounded-2xl p-8 text-center space-y-4 shadow-xl">
              <span className="text-xs font-serif tracking-[0.2em] text-[#e8c36a] uppercase">Card I</span>
              <h3 className="font-serif font-bold text-white text-xl">The Oracle Peeks</h3>
              <p className="text-[#b3a7c9] text-sm leading-relaxed font-serif">
                One player sees the secret celestial coordinate $(x, y)$ concealed in the crystal, bound between opposing attributes.
              </p>
            </div>

            {/* Card II */}
            <div className="bg-gradient-to-b from-[#1d1645] to-[#120d2b] border border-[#a8843c]/60 rounded-2xl p-8 text-center space-y-4 shadow-xl">
              <span className="text-xs font-serif tracking-[0.2em] text-[#e8c36a] uppercase">Card II</span>
              <h3 className="font-serif font-bold text-white text-xl">The Utterance</h3>
              <p className="text-[#b3a7c9] text-sm leading-relaxed font-serif">
                The Psychic speaks a single word or character fitting the secret point across both spectral dimensions.
              </p>
            </div>

            {/* Card III */}
            <div className="bg-gradient-to-b from-[#1d1645] to-[#120d2b] border border-[#a8843c]/60 rounded-2xl p-8 text-center space-y-4 shadow-xl">
              <span className="text-xs font-serif tracking-[0.2em] text-[#e8c36a] uppercase">Card III</span>
              <h3 className="font-serif font-bold text-white text-xl">The Divination</h3>
              <p className="text-[#b3a7c9] text-sm leading-relaxed font-serif">
                Everyone discusses, drops their pins on the plane, and locks in. True Bullseyes unlock 1,000 points!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#3b2f5e]/40 py-6 px-6 text-center text-xs text-[#b3a7c9]/60 font-serif">
        Psychic Plane &bull; Azim's Mystic Design &bull; Built with React, TypeScript & Socket.io
      </footer>

      {/* Modal: Create Room */}
      {modalMode === 'create' && (
        <div className="fixed inset-0 z-50 bg-[#050310]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#15112f] border border-[#a8843c] rounded-[24px] p-8 shadow-2xl animate-drop-in">
            <h2 className="text-2xl font-serif font-bold text-[#e8c36a] mb-2">Create a Game Room</h2>
            <p className="text-sm font-serif text-[#b3a7c9] mb-6">Choose a nickname your friends will recognize.</p>

            <form onSubmit={handleCreateSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-serif uppercase tracking-wider text-[#e8c36a] mb-2">
                  Your Nickname
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="e.g. Dosia, Alex"
                  autoFocus
                  className="w-full bg-[#0a0820] border border-[#3b2f5e] focus:border-[#e8c36a] rounded-xl px-4 py-3 text-white font-serif outline-none transition"
                />
              </div>

              {error && <div className="text-xs text-red-400 font-semibold bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</div>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-5 py-2.5 text-xs font-serif font-bold text-[#b3a7c9] hover:text-white rounded-full transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 text-xs font-serif font-bold text-[#0a0820] bg-gradient-to-r from-[#f3d68a] to-[#c99a3e] hover:shadow-[0_0_16px_#e8c36a88] rounded-full transition disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-[#050310]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#15112f] border border-[#a8843c] rounded-[24px] p-8 shadow-2xl animate-drop-in">
            <h2 className="text-2xl font-serif font-bold text-[#e8c36a] mb-2">Join a Room</h2>
            <p className="text-sm font-serif text-[#b3a7c9] mb-6">Enter the 4-letter room code from your host.</p>

            <form onSubmit={handleJoinSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-serif uppercase tracking-wider text-[#e8c36a] mb-2">
                  Your Nickname
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="e.g. Sam"
                  autoFocus
                  className="w-full bg-[#0a0820] border border-[#3b2f5e] focus:border-[#e8c36a] rounded-xl px-4 py-3 text-white font-serif outline-none transition mb-4"
                />

                <label className="block text-xs font-serif uppercase tracking-wider text-[#e8c36a] mb-2">
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
                      className="w-14 h-16 text-center text-2xl font-serif font-bold uppercase bg-[#0a0820] border border-[#3b2f5e] focus:border-[#e8c36a] rounded-xl text-white outline-none transition"
                    />
                  ))}
                </div>
              </div>

              {error && <div className="text-xs text-red-400 font-semibold bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</div>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-5 py-2.5 text-xs font-serif font-bold text-[#b3a7c9] hover:text-white rounded-full transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 text-xs font-serif font-bold text-[#0a0820] bg-gradient-to-r from-[#f3d68a] to-[#c99a3e] hover:shadow-[0_0_16px_#e8c36a88] rounded-full transition disabled:opacity-50"
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
