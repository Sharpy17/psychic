// Page motion for the newspaper landing: the halftone photo, pencil and red-pen marks on the board,
// the stop-press ticker, stamp ink on buttons and sections that "print" as they scroll in.
// Loaded before common.js so the board hooks below are in window.LANDING when it reads them.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Small seeded random generator, so hand-drawn shapes look the same every time.
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Halftone photo (also used by intro.js for the crumpled page) ----------
  // A greyscale "staff photo": two readers in profile with a single dot between them.
  function photoScene(g, w, h) {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#c9c9c9');
    bg.addColorStop(1, '#6f6f6f');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const glow = g.createRadialGradient(w / 2, h * 0.44, 0, w / 2, h * 0.44, w * 0.26);
    glow.addColorStop(0, '#fff');
    glow.addColorStop(1, '#fff0');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#111';
    for (const side of [-1, 1]) {
      const cx = w / 2 + side * w * 0.29;
      const hr = Math.min(w * 0.085, h * 0.22);
      g.beginPath();
      g.ellipse(cx, h * 0.42, hr * 0.92, hr, side * 0.12, 0, Math.PI * 2);
      g.fill();
      g.beginPath(); // nose
      g.moveTo(cx - side * hr * 0.7, h * 0.36);
      g.lineTo(cx - side * hr * 1.22, h * 0.47);
      g.lineTo(cx - side * hr * 0.7, h * 0.5);
      g.fill();
      g.beginPath(); // shoulders
      g.ellipse(cx + side * w * 0.04, h * 1.04, w * 0.19, h * 0.4, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(w / 2, h * 0.44, Math.min(w, h) * 0.035, 0, Math.PI * 2);
    g.fill();
  }

  // Redraws photoScene as a 45° halftone screen of ink dots inside (x, y, w, h).
  // `scene` paints a greyscale picture; variants register their own in PP.scenes.
  function halftone(g, x, y, w, h, cell = 4, ink = '#1b1b1b', scene = photoScene) {
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(w));
    off.height = Math.max(1, Math.round(h));
    const og = off.getContext('2d');
    scene(og, off.width, off.height);
    const px = og.getImageData(0, 0, off.width, off.height).data;
    const lum = (sx, sy) => {
      const i = (Math.min(off.height - 1, Math.max(0, sy | 0)) * off.width + Math.min(off.width - 1, Math.max(0, sx | 0))) * 4;
      return px[i] / 255;
    };
    const ca = Math.SQRT1_2, n = Math.ceil(Math.hypot(w, h) / cell / 2) + 1;
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.fillStyle = ink;
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const lx = w / 2 + (i - j) * ca * cell, ly = h / 2 + (i + j) * ca * cell;
        if (lx < -cell || ly < -cell || lx > w + cell || ly > h + cell) continue;
        const r = cell * 0.64 * Math.sqrt(1 - lum(lx, ly));
        if (r < 0.2) continue;
        g.beginPath();
        g.arc(x + lx, y + ly, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }

  // Every <canvas class="photo"> on the page; data-scene picks a picture from PP.scenes.
  function drawPhoto() {
    document.querySelectorAll('canvas.photo').forEach(canvas => {
      // Layout size, not on-screen size: a canvas inside a 3D-tilted page projects smaller than it is.
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!width) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const g = canvas.getContext('2d');
      g.scale(dpr, dpr);
      g.fillStyle = canvas.dataset.paper || '#f3eee2';
      g.fillRect(0, 0, width, height);
      const scene = window.PP.scenes[canvas.dataset.scene] || photoScene;
      const cell = +canvas.dataset.cell || (width < 420 ? 3.4 : 4.2);
      halftone(g, 0, 0, width, height, cell, canvas.dataset.ink || '#1b1b1b', scene);
    });
  }

  // ---------- Film dirt: dust, hairs and scratches, a fresh set every frame ----------
  // `amount` (0-1) scales how much dirt there is; the intro uses 1, the page less.
  function dust(g, w, h, R, amount) {
    const specks = Math.round((4 + R() * 9) * amount);
    for (let i = 0; i < specks; i++) {
      const r = 0.6 + R() * R() * 3.4;
      g.fillStyle = R() < 0.7 ? 'rgba(12,7,3,.75)' : 'rgba(255,242,214,.6)';
      g.beginPath();
      g.ellipse(R() * w, R() * h, r, r * (0.4 + R() * 0.8), R() * 3, 0, Math.PI * 2);
      g.fill();
    }
    if (R() < 0.25 * amount) {
      const x = R() * w, y = R() * h, l = 30 + R() * 80;
      g.strokeStyle = 'rgba(12,7,3,.6)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + l * (R() - 0.5), y + l * 0.4, x + l * (R() - 0.5), y + l * 0.7, x + l * (R() - 0.5), y + l);
      g.stroke();
    }
    for (let i = 0; i < 2; i++) {
      if (R() > 0.4 * amount) continue;
      const x = R() * w;
      g.strokeStyle = `rgba(255,244,220,${0.1 + R() * 0.15})`;
      g.lineWidth = 0.6 + R() * 0.9;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + (R() - 0.5) * 6, h);
      g.stroke();
    }
  }

  // The page keeps a lighter film look: a little dust at 12 frames a second.
  function filmDirt() {
    const canvas = document.querySelector('.film-dirt');
    if (!canvas || reduced) return;
    const g = canvas.getContext('2d');
    let frame = -1;
    const loop = now => {
      const f = Math.floor(now / 83);
      if (f !== frame) {
        frame = f;
        if (canvas.width !== innerWidth || canvas.height !== innerHeight) {
          canvas.width = innerWidth;
          canvas.height = innerHeight;
        }
        g.clearRect(0, 0, canvas.width, canvas.height);
        dust(g, canvas.width, canvas.height, rng(f * 7919 + 1), 0.5);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  window.PP = Object.assign(window.PP || {}, { rng, halftone, dust, drawPhoto });
  window.PP.scenes = window.PP.scenes || {};

  // ---------- Hand-drawn marks on the board ----------
  // A wobbly circle that overshoots its start, like a pen stroke. Radius in board units (0-100).
  function scribble(r, turns, seed) {
    const R = rng(seed), steps = Math.round(40 * turns), a0 = R() * Math.PI * 2;
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / 40) * Math.PI * 2;
      const rr = r * (1 + (R() - 0.5) * 0.05 + (i / steps) * 0.12);
      d += (i ? 'L' : 'M') + (Math.cos(a) * rr).toFixed(2) + ' ' + (Math.sin(a) * rr * 0.9).toFixed(2);
    }
    return d;
  }

  let redpen = null, cards = 0;
  function boardMarks() {
    const svg = document.querySelector('#board-slot svg');
    if (!svg || redpen) return;
    const pencil = document.createElementNS(SVG_NS, 'path');
    pencil.setAttribute('class', 'pencil');
    pencil.setAttribute('d', scribble(5.2, 1.35, 11));
    svg.querySelector('.marker').appendChild(pencil);
    redpen = document.createElementNS(SVG_NS, 'path');
    redpen.setAttribute('class', 'redpen');
    svg.querySelector('.target').appendChild(redpen);
  }

  window.LANDING = Object.assign({
    wave: 'triangle',
    revealLabel: 'Reveal answer',
    againLabel: 'Play again',
    results: { 4: 'Headline news: perfect telepathy!', 3: 'A close call, sources say.', 2: 'Within the margin of error.', 0: 'Correction: that was way off.' },
    lobbyMsg: 'The lobby goes to print soon',
    onCard() {
      boardMarks();
      redpen.classList.remove('draw');
      redpen.setAttribute('d', scribble(21, 1.15, 100 + cards++));
      redpen.style.setProperty('--len', Math.ceil(redpen.getTotalLength()) + 1);
    },
    onReveal() {
      void redpen.getBoundingClientRect(); // restart the stroke
      redpen.classList.add('draw');
    },
  }, window.LANDING_TEXT);

  // ---------- Stamp ink on buttons ----------
  document.addEventListener('pointerdown', e => {
    const btn = e.target.closest('.btn');
    if (!btn || reduced) return;
    const r = btn.getBoundingClientRect();
    const ink = document.createElement('span');
    ink.className = 'ink';
    ink.style.left = e.clientX - r.left + 'px';
    ink.style.top = e.clientY - r.top + 'px';
    btn.appendChild(ink);
    setTimeout(() => ink.remove(), 520);
  });

  // ---------- Stop-press ticker: typed on at 12 frames a second ----------
  const DEFAULT_BULLETINS = [
    'Psychic predicts own victory; nobody surprised.',
    'Goose ruled “somewhat scary” after heated debate.',
    'Airport sushi placed firmly in “Expensive”. Again.',
    'Man insists fanny packs are cool. Board disagrees.',
    'Local dot found exactly where everyone thought it was.',
    'Weather: 80% chance of mind-reading, clearing by midnight.',
  ];
  function ticker() {
    const el = document.getElementById('ticker');
    if (!el) return;
    const BULLETINS = window.PP.bulletins || DEFAULT_BULLETINS;
    let n = 0;
    const next = () => {
      n = (n + 1) % BULLETINS.length;
      const text = BULLETINS[n];
      if (reduced) {
        el.textContent = text;
        return setTimeout(next, 5000);
      }
      let i = 0;
      const type = setInterval(() => {
        i += 2;
        el.textContent = text.slice(0, i);
        if (i >= text.length) {
          clearInterval(type);
          setTimeout(next, 3200);
        }
      }, 83);
    };
    setTimeout(next, 3600);
  }

  // ---------- Printing on scroll ----------
  function printing() {
    // Watch the sections, not the clipped items: a fully clipped element never counts as visible.
    const sections = [...document.querySelectorAll('main section')];
    const print = sec => sec.querySelectorAll('[data-print]').forEach(el => el.classList.add('printed'));
    sections.forEach(sec => {
      sec.querySelectorAll('[data-print]').forEach((el, i) => el.style.setProperty('--d', i * 0.09 + 's'));
    });
    if (!('IntersectionObserver' in window)) return sections.forEach(print);
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        print(e.target);
        io.unobserve(e.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    sections.forEach(sec => io.observe(sec));

    document.querySelectorAll('[data-shout]').forEach(shout => {
    shout.innerHTML = [...shout.textContent].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');
    new IntersectionObserver(([e]) => shout.classList.toggle('live', e.isIntersecting)).observe(shout);
    });
  }

  function today() {
    const el = document.getElementById('today');
    if (el) el.textContent =
      new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  document.addEventListener('DOMContentLoaded', () => {
    today();
    filmDirt();
    ticker();
    printing();
    (document.fonts?.ready || Promise.resolve()).then(drawPhoto);
    let t;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(drawPhoto, 150); });
  });
})();
