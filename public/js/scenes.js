// "Staff photos" for the picture desk: greyscale scenes that page.js turns into halftone.
// One is picked per visit (never the same twice in a row) along with its headline and caption.
(() => {
  const PP = (window.PP = window.PP || {});
  PP.scenes = PP.scenes || {};
  const TAU = Math.PI * 2;

  // ---------- drawing helpers (everything is dark ink on a lighter backdrop) ----------
  function sky(g, w, h, top, bottom) {
    const s = g.createLinearGradient(0, 0, 0, h);
    s.addColorStop(0, top);
    s.addColorStop(1, bottom);
    g.fillStyle = s;
    g.fillRect(0, 0, w, h);
  }
  function glow(g, x, y, r, a = 1) {
    const s = g.createRadialGradient(x, y, 0, x, y, r);
    s.addColorStop(0, `rgba(255,255,255,${a})`);
    s.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = s;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // A person from the chest up: `lean` tips the head forward (-1 left, 1 right).
  function bust(g, x, base, s, lean = 0, ink = '#141414') {
    g.fillStyle = ink;
    g.beginPath();
    g.ellipse(x + lean * s * 0.18, base - s * 1.18, s * 0.34, s * 0.4, lean * 0.25, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(x - s * 0.72, base + 2);
    g.bezierCurveTo(x - s * 0.7, base - s * 0.5, x - s * 0.4, base - s * 0.72, x + lean * s * 0.1, base - s * 0.74);
    g.bezierCurveTo(x + s * 0.4, base - s * 0.72, x + s * 0.7, base - s * 0.5, x + s * 0.72, base + 2);
    g.fill();
  }
  // A standing figure, feet at `ground`; arm: angle in radians from straight down, or null.
  function figure(g, x, ground, s, arm = null, ink = '#141414') {
    g.fillStyle = ink;
    g.strokeStyle = ink;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(x, ground - s * 1.72, s * 0.15, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(x - s * 0.2, ground - s * 1.52);
    g.lineTo(x + s * 0.2, ground - s * 1.52);
    g.lineTo(x + s * 0.17, ground - s * 0.8);
    g.lineTo(x - s * 0.17, ground - s * 0.8);
    g.fill();
    g.lineWidth = s * 0.13;
    g.beginPath();
    g.moveTo(x - s * 0.09, ground - s * 0.84); g.lineTo(x - s * 0.13, ground);
    g.moveTo(x + s * 0.09, ground - s * 0.84); g.lineTo(x + s * 0.13, ground);
    g.stroke();
    g.lineWidth = s * 0.1;
    g.beginPath();
    g.moveTo(x - s * 0.18, ground - s * 1.45); g.lineTo(x - s * 0.24, ground - s * 0.9);
    if (arm === null) { g.moveTo(x + s * 0.18, ground - s * 1.45); g.lineTo(x + s * 0.24, ground - s * 0.9); }
    else {
      g.moveTo(x + s * 0.18, ground - s * 1.45);
      g.lineTo(x + s * 0.18 + Math.sin(arm) * s * 0.62, ground - s * 1.45 + Math.cos(arm) * s * 0.62);
    }
    g.stroke();
  }
  function leaf(g, x, y, len, ang, wid) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.3, -wid, len * 0.85, -wid * 0.8, len, 0);
    g.bezierCurveTo(len * 0.85, wid * 0.8, len * 0.3, wid, 0, 0);
    g.fill();
    g.globalCompositeOperation = 'destination-out'; // the monstera's slits
    g.lineWidth = Math.max(1, wid * 0.08);
    for (let i = 1; i < 4; i++) {
      g.beginPath();
      g.moveTo(len * (0.2 + i * 0.17), -wid * 0.95);
      g.lineTo(len * (0.24 + i * 0.17), -wid * 0.3);
      g.moveTo(len * (0.2 + i * 0.17), wid * 0.95);
      g.lineTo(len * (0.24 + i * 0.17), wid * 0.3);
      g.stroke();
    }
    g.restore();
  }

  // ---------- the scenes ----------
  PP.scenes.plant = (g, w, h) => {
    sky(g, w, h, '#dcdcdc', '#8a8a8a');
    glow(g, w * 0.5, h * 0.3, w * 0.34, 0.9);
    g.fillStyle = '#9a9a9a'; // window frame
    g.fillRect(w * 0.36, h * 0.04, w * 0.28, h * 0.02);
    g.fillRect(w * 0.495, h * 0.04, w * 0.01, h * 0.5);
    g.fillStyle = '#3a3a3a'; // table
    g.fillRect(0, h * 0.8, w, h * 0.2);
    g.fillStyle = '#1c1c1c'; // pot
    g.beginPath();
    g.moveTo(w * 0.45, h * 0.62); g.lineTo(w * 0.55, h * 0.62); g.lineTo(w * 0.535, h * 0.82); g.lineTo(w * 0.465, h * 0.82);
    g.fill();
    g.fillStyle = '#222';
    const L = h * 0.5;
    [[-2.5, 1], [-2.0, 0.9], [-1.55, 1.05], [-1.1, 0.95], [-0.65, 1], [-3.0, 0.75], [-0.2, 0.75]].forEach(([a, k]) =>
      leaf(g, w * 0.5, h * 0.62, L * k, a, L * k * 0.32));
    g.fillStyle = '#111'; // the plant's crown
    g.beginPath();
    const cx = w * 0.5, cy = h * 0.14, cw = h * 0.07;
    g.moveTo(cx - cw, cy); g.lineTo(cx - cw, cy - cw * 0.8); g.lineTo(cx - cw * 0.5, cy - cw * 0.3); g.lineTo(cx, cy - cw);
    g.lineTo(cx + cw * 0.5, cy - cw * 0.3); g.lineTo(cx + cw, cy - cw * 0.8); g.lineTo(cx + cw, cy);
    g.fill();
    bust(g, w * 0.13, h * 1.0, h * 0.36, 1);
    bust(g, w * 0.26, h * 1.04, h * 0.28, 1, '#2a2a2a');
    bust(g, w * 0.86, h * 1.0, h * 0.38, -1);
    bust(g, w * 0.73, h * 1.06, h * 0.27, -1, '#2a2a2a');
  };

  PP.scenes.dot = (g, w, h) => {
    sky(g, w, h, '#a9a9a9', '#f0f0f0');
    const x = w * 0.62, y = h * 0.24, r = h * 0.07;
    glow(g, x, y, r * 6, 0.9);
    g.strokeStyle = '#555';
    g.lineWidth = 1.2;
    for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(x, y, r * (1 + i * 0.8), 0, TAU); g.stroke(); }
    g.fillStyle = '#0d0d0d';
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = '#4a4a4a'; // rooftops
    [[0, 0.62, 0.14], [0.12, 0.55, 0.1], [0.24, 0.66, 0.16], [0.78, 0.58, 0.12], [0.88, 0.5, 0.12]].forEach(([a, t, bw]) =>
      g.fillRect(w * a, h * t, w * bw, h));
    const R = PP.rng ? PP.rng(7) : Math.random;
    for (let row = 0; row < 3; row++) {
      const n = 10 + row * 3, s = h * (0.13 + row * 0.05);
      for (let i = 0; i < n; i++) {
        const px = ((i + 0.5 + (R() - 0.5) * 0.6) / n) * w;
        bust(g, px, h * (0.92 + row * 0.08), s, (x - px) / w * 0.6, row ? '#151515' : '#2c2c2c');
      }
    }
    figure(g, w * 0.3, h * 1.02, h * 0.42, Math.PI * 0.82); // the one who spotted it
  };

  PP.scenes.plane = (g, w, h) => {
    sky(g, w, h, '#efefef', '#9b9b9b');
    const bx = w * 0.8, by = h * 0.46, br = h * 0.3;
    for (let i = 5; i > 0; i--) {
      g.fillStyle = i % 2 ? '#1c1c1c' : '#d8d8d8';
      g.beginPath(); g.arc(bx, by, (br * i) / 5, 0, TAU); g.fill();
    }
    g.strokeStyle = '#333';
    g.lineWidth = 2;
    g.setLineDash([7, 7]);
    g.beginPath();
    g.moveTo(w * 0.12, h * 0.62);
    g.bezierCurveTo(w * 0.28, h * 0.02, w * 0.5, h * 0.1, bx - h * 0.05, by - h * 0.02);
    g.stroke();
    g.setLineDash([]);
    g.save(); // the plane, nose in the bullseye
    g.translate(bx - h * 0.04, by - h * 0.02);
    g.rotate(0.42);
    g.fillStyle = '#f7f7f7';
    g.strokeStyle = '#111';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-h * 0.34, -h * 0.13); g.lineTo(-h * 0.25, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#9a9a9a';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-h * 0.25, 0); g.lineTo(-h * 0.31, h * 0.07); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.fillStyle = '#3a3a3a';
    g.fillRect(0, h * 0.9, w, h * 0.1);
    figure(g, w * 0.12, h * 0.95, h * 0.5, Math.PI * 0.72);
    figure(g, w * 0.26, h * 0.97, h * 0.4, Math.PI * 0.9, '#2a2a2a');
  };

  PP.scenes.huddle = (g, w, h) => {
    sky(g, w, h, '#8c8c8c', '#4a4a4a');
    const px = w * 0.5, py = h * 0.66;
    glow(g, px, py, h * 0.75, 1);
    g.fillStyle = '#fff';
    g.save(); g.translate(px, py); g.rotate(-0.12);
    g.fillRect(-h * 0.06, -h * 0.1, h * 0.12, h * 0.2);
    g.restore();
    bust(g, w * 0.22, h * 1.08, h * 0.5, 1);
    bust(g, w * 0.36, h * 1.04, h * 0.36, 1, '#262626');
    bust(g, w * 0.78, h * 1.08, h * 0.5, -1);
    bust(g, w * 0.64, h * 1.04, h * 0.36, -1, '#262626');
    bust(g, w * 0.5, h * 0.5, h * 0.22, 0, '#303030');
    g.strokeStyle = '#161616'; // hands on the phone
    g.lineWidth = h * 0.05;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w * 0.3, h * 0.92); g.lineTo(px - h * 0.07, py + h * 0.06);
    g.moveTo(w * 0.7, h * 0.92); g.lineTo(px + h * 0.07, py + h * 0.04);
    g.stroke();
  };

  PP.scenes.goose = (g, w, h) => {
    sky(g, w, h, '#e6e6e6', '#a3a3a3');
    g.fillStyle = '#7a7a7a';
    g.fillRect(0, h * 0.82, w, h * 0.18);
    g.fillStyle = '#1a1a1a'; // the goose
    const gx = w * 0.68, gy = h * 0.68;
    g.beginPath(); g.ellipse(gx, gy, h * 0.2, h * 0.11, -0.15, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(gx + h * 0.2, gy - h * 0.05); g.lineTo(gx + h * 0.34, gy - h * 0.14); g.lineTo(gx + h * 0.16, gy + h * 0.02); g.fill();
    g.lineWidth = h * 0.06;
    g.strokeStyle = '#1a1a1a';
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(gx - h * 0.12, gy - h * 0.05);
    g.bezierCurveTo(gx - h * 0.2, gy - h * 0.25, gx - h * 0.08, gy - h * 0.34, gx - h * 0.16, gy - h * 0.44);
    g.stroke();
    g.beginPath(); g.arc(gx - h * 0.17, gy - h * 0.46, h * 0.05, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(gx - h * 0.2, gy - h * 0.48); g.lineTo(gx - h * 0.3, gy - h * 0.45); g.lineTo(gx - h * 0.2, gy - h * 0.43); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(gx - h * 0.18, gy - h * 0.47, h * 0.011, 0, TAU); g.fill();
    g.lineWidth = h * 0.02;
    g.beginPath();
    g.moveTo(gx - h * 0.02, gy + h * 0.1); g.lineTo(gx - h * 0.03, gy + h * 0.2);
    g.moveTo(gx + h * 0.06, gy + h * 0.09); g.lineTo(gx + h * 0.06, gy + h * 0.2);
    g.stroke();
    figure(g, w * 0.3, h * 0.92, h * 0.5, -Math.PI * 0.55 + Math.PI); // arm out, hand on the forehead side
    g.strokeStyle = '#555';
    g.lineWidth = 1.5;
    g.setLineDash([3, 6]);
    g.beginPath(); g.moveTo(w * 0.33, h * 0.07 + h * 0.06); g.lineTo(gx - h * 0.22, gy - h * 0.47); g.stroke();
    g.setLineDash([]);
  };

  // ---------- one story per scene ----------
  const STORIES = [
    { scene: 'plant', kicker: 'Botany · Exclusive', head: 'Houseplant Picks Game Night Winner for Third Week Running',
      deck: 'Gerald, a monstera, has never once been more than a dot away', caption: 'Gerald, centre, moments before calling it. Friends were not consulted.' },
    { scene: 'dot', kicker: 'Sightings · Live', head: 'Crowd Stops Traffic to Stare at a Single Dot',
      deck: 'Everyone agreed where it was. Nobody agreed why', caption: 'Onlookers on Market Street, 8:02 p.m. One man claims he “saw it coming”.' },
    { scene: 'plane', kicker: 'Aviation · Bullseye', head: 'Paper Plane Lands Dead Centre; Pilot Says “I Just Knew”',
      deck: 'Investigators find the flight path matched the clue exactly', caption: 'The flight, reconstructed. The pilot is nine.' },
    { scene: 'huddle', kicker: 'Living · Developing', head: 'Five Friends Huddle Over One Phone, Refuse to Explain',
      deck: 'Witnesses report shouting, then silence, then “FUNNY BUT UGLY”', caption: 'The huddle, as seen through a window. The phone has since been passed on.' },
    { scene: 'goose', kicker: 'Wildlife · Standoff', head: 'Psychic and Goose Locked in Hour-Long Staring Contest',
      deck: 'The question, once again: just how scary is a goose?', caption: 'Left, a psychic. Right, the goose. The board has ruled it “somewhat scary”.' },
  ];
  let last = -1;
  try { last = +localStorage.getItem('pp-picture') ; } catch (e) {}
  let pick = Math.floor(Math.random() * (STORIES.length - 1));
  if (pick >= last && last >= 0) pick++;
  try { localStorage.setItem('pp-picture', pick); } catch (e) {}

  function show(i) {
    const s = STORIES[i];
    const $ = id => document.getElementById(id);
    $('photo').dataset.scene = s.scene;
    $('kicker').textContent = s.kicker;
    $('headline').textContent = s.head;
    $('deck').textContent = s.deck;
    $('caption').firstChild.textContent = s.caption + ' ';
    $('plate').textContent = `Plate ${i + 1} of ${STORIES.length}`;
    document.querySelectorAll('.frame').forEach((f, n) => f.classList.toggle('picked', n === i));
  }
  PP.pictureDesk = { stories: STORIES, current: pick, show };
  function pickFrame(i) {
    const p = PP.pictureDesk;
    if (i === p.current) return;
    p.current = i;
    try { localStorage.setItem('pp-picture', i); } catch (e) {}
    const fig = document.querySelector('.lead-photo');
    fig.classList.remove('develop');
    void fig.offsetWidth; // restart the developing animation
    show(i);
    PP.drawPhoto();
    fig.classList.add('develop');
  }

  // The contact sheet: every frame on the roll, the front-page one circled in grease pencil.
  function contactSheet() {
    const box = document.getElementById('frames');
    if (!box) return;
    box.innerHTML = STORIES.map((s, i) =>
      `<button type="button" class="frame" data-i="${i}" aria-label="Frame ${i + 1}: ${s.head}">` +
      `<canvas class="photo" data-scene="${s.scene}" data-cell="2.4" data-paper="#e9e3d4"></canvas><span>${26 - i}A</span></button>`).join('');
    box.addEventListener('click', e => {
      const f = e.target.closest('.frame');
      if (f) pickFrame(+f.dataset.i);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    contactSheet();
    if (!document.getElementById('photo')) return;
    show(pick);
    document.getElementById('next-photo').addEventListener('click', () => pickFrame((PP.pictureDesk.current + 1) % STORIES.length));
  });
})();
