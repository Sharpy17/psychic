/**
 * Sound Effects Engine using pure Web Audio API (Azim & Isa's Audio Spec)
 * No audio files or external downloads needed!
 */

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const sound = {
  toggle(): boolean {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
      sound.blip(523, 0.1);
    }
    return soundEnabled;
  },

  isEnabled(): boolean {
    return soundEnabled;
  },

  blip(freq = 440, duration = 0.08, type: OscillatorType = 'sine', gainVal = 0.08) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  },

  click() {
    this.blip(600, 0.05, 'triangle', 0.04);
  },

  drag() {
    this.blip(320, 0.03, 'sine', 0.02);
  },

  lockIn() {
    this.blip(220, 0.15, 'sawtooth', 0.06);
    setTimeout(() => this.blip(440, 0.12, 'sine', 0.08), 100);
  },

  reveal() {
    [392, 523, 659, 784].forEach((freq, idx) => {
      setTimeout(() => this.blip(freq, 0.2, 'triangle', 0.07), idx * 110);
    });
  },

  bullseye() {
    [523, 659, 784, 1046].forEach((freq, idx) => {
      setTimeout(() => this.blip(freq, 0.25, 'sine', 0.09), idx * 90);
    });
  },

  tick() {
    this.blip(880, 0.03, 'sine', 0.03);
  },

  error() {
    this.blip(180, 0.2, 'sawtooth', 0.07);
  },
};
