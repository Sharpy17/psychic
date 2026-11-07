// Opening sequence: a crumpled front page is tossed onto a desk, then unfolds into the live page.
//
// The paper is a triangle mesh. Its front is a snapshot of the real page (so the hand-off at the
// end is seamless) and its back is a painted "page 2". Every vertex knows where it sits on the flat
// sheet; unfolding bends the sheet around a sphere whose radius grows from ball size to infinity
// (arc length is kept, so it opens like real paper). The sheet curls toward the camera, so the
// print is on the inside of the ball and the outer layers peel open first. Crumple noise fades as
// it opens, and each facet is shaded from its normal so creases catch the lamp.
// Time is held "on twos" (12 fps) with per-frame jitter and film dirt, like stop-motion.
// A page can opt out with html[data-motion="smooth"]: then every display frame is drawn, the
// hand-held jitter and lamp flicker are dropped, and the stamp's impact is a damped sine shake.
//
// html[data-intro] is set in : "full" (first visit this session) or "none".
(() => {
  const root = document.documentElement;
  const MODE = root.dataset.intro;
  const SMOOTH = root.dataset.motion === 'smooth';
  const { rng } = window.PP;

  const W = 600, H = 800;       // sheet size in world units
  const R0 = 84;                // ball radius
  const TEX = 2;                // pixels per world unit for the painted textures
  const RESIDUE = 1.7;          // creases left once flat
  const STAMP = { x: 492, y: 64, s: 1 }; // where "EXTRA!" lands, in sheet units (moved to match the page)
  const LIGHT = norm([-0.38, -0.55, 0.74]);

  function norm(v) {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeBack = t => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

  // ---------- Mesh ----------
  function buildMesh(cols, rows) {
    const R = rng(1984);
    const n = (cols + 1) * (rows + 1);
    const m = {
      cols, rows, n,
      lx: new Float32Array(n), ly: new Float32Array(n), d: new Float32Array(n), a: new Float32Array(n),
      delay: new Float32Array(n), nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n),
      u: new Float32Array(n), v: new Float32Array(n),
      x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n),
      sx: new Float32Array(n), sy: new Float32Array(n),
      tris: [],
    };
    const dMax = Math.hypot(W, H) / 2;
    for (let j = 0, k = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++, k++) {
        const u = i / cols, v = j / rows;
        const lx = (u - 0.5) * W, ly = (v - 0.5) * H;
        m.u[k] = u;
        m.v[k] = v;
        m.lx[k] = lx;
        m.ly[k] = ly;
        m.d[k] = Math.hypot(lx, ly);
        m.a[k] = Math.atan2(ly, lx);
        // The outer layers (the sheet's edges) peel open first, the middle last.
        m.delay[k] = 0.24 * (1 - m.d[k] / dMax) + 0.07 * R();
        const edge = i === 0 || j === 0 || i === cols || j === rows ? 0.5 : 1;
        m.nx[k] = (R() * 2 - 1) * edge;
        m.ny[k] = (R() * 2 - 1) * edge;
        m.nz[k] = R() * 2 - 1;
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * (cols + 1) + i;
        m.tris.push([k, k + 1, k + cols + 2], [k, k + cols + 2, k + cols + 1]);
      }
    }
    m.order = m.tris.map((_, i) => i);
    m.depth = new Float32Array(m.tris.length);
    return m;
  }

  // Positions every vertex for an unfold amount P (0 = ball, 1 = flat), centred on the origin.
  // `settle` (0-1) irons out the leftover creases at the very end.
  function deform(m, P, settle = 0) {
    const residue = RESIDUE * (1 - settle);
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < m.n; k++) {
      const p = clamp01((P - m.delay[k]) / 0.69);
      const curve = Math.pow(1 - p, 2.2) / R0;
      let x, y, z;
      if (curve < 1e-6) {
        x = m.lx[k]; y = m.ly[k]; z = 0;
      } else {
        // Stop just short of wrapping round the back: wrapped facets stretch into shards.
        const phi = Math.min(m.d[k] * curve, Math.PI * 0.94);
        const r = (1 / curve) * (1 + 0.06 * phi);
        const rho = r * Math.sin(phi);
        x = rho * Math.cos(m.a[k]);
        y = rho * Math.sin(m.a[k]);
        z = r * (1 - Math.cos(phi)); // curls toward the camera: print inside
      }
      const amp = R0 * 0.4 * Math.pow(1 - p, 1.2);
      x += m.nx[k] * (amp + residue * 0.15);
      y += m.ny[k] * (amp + residue * 0.15);
      z += m.nz[k] * (amp + residue);
      m.x[k] = x; m.y[k] = y; m.z[k] = z;
      cx += x; cy += y; cz += z;
    }
    cx /= m.n; cy /= m.n; cz /= m.n;
    if (settle >= 1) cx = cy = cz = 0; // flat: keep the sheet exactly where the page is
    for (let k = 0; k < m.n; k++) { m.x[k] -= cx; m.y[k] -= cy; m.z[k] -= cz; }
  }

  function rotate(m, rx, ry, rz) {
    const [sx, cx, sy, cy, sz, cz] = [Math.sin(rx), Math.cos(rx), Math.sin(ry), Math.cos(ry), Math.sin(rz), Math.cos(rz)];
    for (let k = 0; k < m.n; k++) {
      let x = m.x[k], y = m.y[k], z = m.z[k];
      let t = y * cx - z * sx; z = y * sx + z * cx; y = t;
      t = x * cy + z * sy; z = -x * sy + z * cy; x = t;
      t = x * cz - y * sz; y = x * sz + y * cz; x = t;
      m.x[k] = x; m.y[k] = y; m.z[k] = z;
    }
  }

  // Light minus "flat" light: positive faces the lamp more than a flat sheet does.
  function shadeOf(m, t, flip) {
    const [a, b, c] = t;
    const ux = m.x[b] - m.x[a], uy = m.y[b] - m.y[a], uz = m.z[b] - m.z[a];
    const vx = m.x[c] - m.x[a], vy = m.y[c] - m.y[a], vz = m.z[c] - m.z[a];
    let [nx, ny, nz] = norm([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
    if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    return nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] - LIGHT[2];
  }

  // ---------- The front page texture (a sketch of the real page above it) ----------
  function paintTexture() {
    const c = document.createElement('canvas');
    c.width = W * TEX;
    c.height = H * TEX;
    const g = c.getContext('2d');
    g.scale(TEX, TEX);
    const R = rng(7), ink = '#1b1b1b', red = '#b3261e', muted = '#55504a', M = 26;

    g.fillStyle = '#f3eee2';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(70,45,20,${R() * 0.07})`;
      g.fillRect(R() * W, R() * H, R() * 1.6, R() * 1.6);
    }
    const age = g.createRadialGradient(W / 2, H * 0.45, H * 0.28, W / 2, H / 2, H * 0.72);
    age.addColorStop(0, '#0000');
    age.addColorStop(1, 'rgba(156,122,74,.3)');
    g.fillStyle = age;
    g.fillRect(0, 0, W, H);

    const font = (f, color = ink, align = 'left') => { g.font = f; g.fillStyle = color; g.textAlign = align; };
    const rule = (y, h = 0.8, x0 = M, x1 = W - M) => { g.fillStyle = ink; g.fillRect(x0, y, x1 - x0, h); };
    const wrap = (s, x, y, w, lh, maxY) => {
      let line = '';
      for (const word of s.split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (g.measureText(t).width > w && line) {
          g.fillText(line, x, y);
          line = word;
          y += lh;
          if (y > maxY) return y;
        } else line = t;
      }
      if (line) g.fillText(line, x, y);
      return y + lh;
    };
    const SC = '"Old Standard TT", Georgia, serif', HEAD = '"Playfair Display", Georgia, serif';

    font(`700 7.5px ${SC}`, muted); g.fillText('LATE EDITION', M, 24);
    font(`700 7.5px ${SC}`, muted, 'right'); g.fillText('HOW TO PLAY    CLASSIFIEDS    PLAY', W - M, 24);
    rule(30, 0.6);
    // ears
    g.strokeStyle = ink; g.lineWidth = 0.6;
    g.strokeRect(M, 44, 92, 50); g.strokeRect(W - M - 92, 44, 92, 50);
    font(`700 7px ${HEAD}`, ink, 'center'); g.fillText('WEATHER', M + 46, 54); g.fillText('EST. 2026', W - M - 46, 54);
    font(`6px ${SC}`, ink, 'center');
    wrap('80% chance of mind-reading. Light clues.', M + 46, 66, 82, 8, 90);
    wrap('Price: one clue. Prize: one circus ticket. Two readers or more.', W - M - 46, 66, 82, 8, 90);
    font(`50px UnifrakturMaguntia, "Old English Text MT", serif`, ink, 'center'); g.fillText('The Psychic Plane', W / 2, 88);
    font(`italic 8.5px ${SC}`, muted, 'center'); g.fillText('“All the clues that are fit to guess”', W / 2, 104);
    rule(114); rule(117);
    font(`700 7px ${SC}`); g.fillText('VOL. I · NO. 1', M + 2, 127);
    font(`700 7px ${SC}`, ink, 'center'); g.fillText('GAME NIGHT EDITION', W / 2, 127);
    font(`700 7px ${SC}`, ink, 'right'); g.fillText('FREE · FOR 2 OR MORE READERS', W - M - 2, 127);
    rule(132); rule(135);
    g.fillStyle = ink; g.fillRect(M, 141, 62, 12);
    font(`6.5px "Special Elite", monospace`, '#f3eee2', 'center'); g.fillText('STOP PRESS', M + 31, 149.5);
    font(`7.5px "Special Elite", monospace`); g.fillText('Psychic predicts own victory; nobody surprised.', M + 70, 150);
    rule(158, 0.6);

    // left column: the lead story
    const LW = 318;
    font(`700 7px ${SC}`, red); g.fillText('MIND-READING · EXCLUSIVE', M, 178);
    font(`900 27px ${HEAD}`);
    ['Local Friends Caught', 'Reading Each Other’s', 'Minds'].forEach((s, i) => g.fillText(s, M, 206 + i * 28));
    font(`italic 10px ${SC}`, muted);
    let y = wrap('Experts baffled as a single clue leads an entire group to the very same dot', M, 278, LW, 13, 320);
    rule(y - 4, 0.6, M, M + LW); rule(y + 9, 0.6, M, M + LW);
    font(`700 6.5px ${SC}`); g.fillText('BY OUR PARTY GAMES CORRESPONDENT · FILED 8:02 P.M.', M, y + 5);
    y += 16;
    g.fillStyle = '#f3eee2';
    window.PP.halftone(g, M, y, LW, LW * 4 / 11, 3.2);
    g.strokeStyle = ink; g.lineWidth = 0.6; g.strokeRect(M, y, LW, LW * 4 / 11);
    y += LW * 4 / 11 + 9;
    font(`6px ${SC}`, muted); g.fillText('Two readers, moments before a bullseye. (Staff photo)', M, y);
    y += 12;
    const story = 'A new party game is sweeping living rooms and video calls alike. Each round, one player, the psychic, is shown a secret point on a board marked with two pairs of opposites. The psychic may offer just one clue. The remaining players then mark, in secret, where they believe the point lies. When the target is revealed, the closest guesses earn the most points. It took thirty seconds to learn, said one player, and three hours to stop arguing about whether a goose is scary. ';
    const colW = (LW - 14) / 2;
    font(`900 26px ${HEAD}`, red); g.fillText('A', M, y + 17);
    font(`6.4px ${SC}`, '#2b2925');
    wrap(story.repeat(2), M + 18, y + 6, colW - 18, 8.2, y + 14);
    wrap(story.slice(120).repeat(2), M, y + 22.4, colW, 8.2, 640);
    wrap(story.slice(260).repeat(2), M + colW + 14, y + 6, colW, 8.2, 640);
    g.fillStyle = '#1b1b1b33'; g.fillRect(M + colW + 6.5, y, 0.6, 640 - y);
    // buttons
    g.fillStyle = ink; g.fillRect(M, 656, 102, 22);
    g.strokeStyle = ink; g.lineWidth = 1.2; g.strokeRect(M + 116, 656, 112, 22);
    font(`700 8px ${HEAD}`, '#f3eee2', 'center'); g.fillText('CREATE A ROOM', M + 51, 670);
    font(`700 8px ${HEAD}`, ink, 'center'); g.fillText('JOIN WITH A CODE', M + 172, 670);

    // right column: the puzzle coupon
    const RX = M + LW + 24, RW = W - M - RX;
    g.save();
    g.translate(RX + RW / 2, 330); g.rotate(0.012); g.translate(-(RX + RW / 2), -330);
    g.fillStyle = '#f8f4ea'; g.fillRect(RX, 170, RW, 330);
    g.setLineDash([4, 3]); g.lineWidth = 1.2; g.strokeStyle = ink; g.strokeRect(RX, 170, RW, 330); g.setLineDash([]);
    font(`700 9px ${HEAD}`, ink, 'center'); g.fillText('CONTEST ENTRY FORM', RX + RW / 2, 188);
    rule(193, 0.6, RX + 10, RX + RW - 10);
    font(`italic 7px ${SC}`, muted, 'center'); g.fillText('Ari, our resident psychic, offers this clue:', RX + RW / 2, 206);
    font(`900 12px ${HEAD}`, ink, 'center'); g.fillText('“A pug in a hot dog costume”', RX + RW / 2, 224);
    const B = RW - 56, bx = RX + 28, by = 250;
    font(`700 7px ${HEAD}`, ink, 'center'); g.fillText('FUNNY', RX + RW / 2, by - 7); g.fillText('UNFUNNY', RX + RW / 2, by + B + 13);
    g.fillStyle = '#fbf8f0'; g.fillRect(bx, by, B, B);
    g.lineWidth = 1.2; g.strokeRect(bx, by, B, B);
    g.setLineDash([2, 1.5]); g.lineWidth = 0.5; g.strokeStyle = '#1b1b1b88';
    g.beginPath(); g.moveTo(bx + B / 2, by + 4); g.lineTo(bx + B / 2, by + B - 4); g.moveTo(bx + 4, by + B / 2); g.lineTo(bx + B - 4, by + B / 2); g.stroke();
    g.setLineDash([]);
    g.fillStyle = ink; g.beginPath(); g.arc(bx + B / 2, by + B / 2, 3, 0, 7); g.fill();
    g.save(); g.translate(bx - 8, by + B / 2); g.rotate(-Math.PI / 2); font(`700 7px ${HEAD}`, ink, 'center'); g.fillText('UGLY', 0, 0); g.restore();
    g.save(); g.translate(bx + B + 8, by + B / 2); g.rotate(Math.PI / 2); font(`700 7px ${HEAD}`, ink, 'center'); g.fillText('CUTE', 0, 0); g.restore();
    g.fillStyle = ink; g.fillRect(RX + 12, by + B + 26, (RW - 34) / 2, 18);
    g.strokeRect(RX + 22 + (RW - 34) / 2, by + B + 26, (RW - 34) / 2, 18);
    g.restore();
    font(`7px "Special Elite", monospace`, '#f8f4ea', 'center'); g.fillText('✂', RX + 16, 173);

    // below the fold
    rule(694, 0.6);
    font(`700 7px ${SC}`, red, 'center'); g.fillText('RULES OF PLAY', W / 2, 716);
    font(`900 15px ${HEAD}`, ink, 'center'); g.fillText('How the Game Is Played', W / 2, 734);
    const cw = (W - 2 * M - 40) / 3;
    ['I. The Psychic Takes a Peek', 'II. A Single Clue Is Given', 'III. Readers Place Their Marks'].forEach((h, i) => {
      const x = M + i * (cw + 20);
      font(`700 8.5px ${HEAD}`); g.fillText(h, x, 754);
      font(`6.4px ${SC}`, '#2b2925'); wrap(story.slice(i * 90), x, 766, cw, 8.2, 790);
      if (i) { g.fillStyle = '#1b1b1b55'; g.fillRect(x - 10, 746, 0.6, 50); }
    });
    return { canvas: c, g };
  }

  // The back of the sheet: "page 2", printed a little paler, seen on the outside of the ball.
  function paintBack() {
    const c = document.createElement('canvas');
    c.width = W * 1.5;
    c.height = H * 1.5;
    const g = c.getContext('2d');
    g.scale(1.5, 1.5);
    const R = rng(21), ink = '#3a3530', red = '#a8473f', M = 26;
    const SC = '"Old Standard TT", Georgia, serif', HEAD = '"Playfair Display", Georgia, serif';
    g.fillStyle = '#ebe3cf';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = `rgba(70,45,20,${R() * 0.08})`;
      g.fillRect(R() * W, R() * H, R() * 1.8, R() * 1.8);
    }
    const lines = (x, y, w, h, gap = 7) => {
      g.fillStyle = '#3a353055';
      for (let yy = y; yy < y + h; yy += gap) g.fillRect(x, yy, w * (0.7 + R() * 0.3), 2.2);
    };
    g.fillStyle = ink;
    g.font = `700 8px ${SC}`;
    g.fillText('2 · THE PSYCHIC PLANE', M, 26);
    g.textAlign = 'right';
    g.fillText('CLASSIFIEDS & PUZZLES', W - M, 26);
    g.textAlign = 'left';
    g.fillRect(M, 32, W - 2 * M, 1.2);
    g.font = `900 30px ${HEAD}`;
    g.fillText('Classifieds', M, 70);
    // ad grid
    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 3; col++) {
        const x = M + col * 120, y = 86 + r * 92;
        g.strokeStyle = ink;
        g.lineWidth = 0.8;
        g.strokeRect(x, y, 110, 84);
        g.font = `700 9px ${HEAD}`;
        g.fillStyle = ink;
        g.fillText(['WANTED', 'FOR SALE', 'LOST', 'FOUND', 'PERSONALS', 'NOTICE'][(r * 3 + col) % 6], x + 8, y + 16);
        lines(x + 8, y + 26, 94, 50);
      }
    }
    // crossword
    const cx = M + 372, cy = 86, cell = 19;
    g.font = `900 15px ${HEAD}`;
    g.fillStyle = ink;
    g.fillText('The Crossword', cx, 74);
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        const black = (i * 7 + j * 3) % 5 === 0 && (i + j) % 2 === 0;
        g.fillStyle = black ? ink : '#f2ecdc';
        g.fillRect(cx + i * cell, cy + j * cell, cell, cell);
        g.strokeStyle = ink;
        g.lineWidth = 0.6;
        g.strokeRect(cx + i * cell, cy + j * cell, cell, cell);
      }
    }
    lines(cx, cy + 9 * cell + 12, 9 * cell, 150, 8);
    // horoscopes and a big display ad
    g.fillStyle = ink;
    g.font = `900 20px ${HEAD}`;
    g.fillText('Your Stars, Read For You', M, 476);
    for (let col = 0; col < 3; col++) lines(M + col * 186, 490, 172, 150, 8);
    g.strokeStyle = red;
    g.lineWidth = 3;
    g.strokeRect(M, 660, W - 2 * M, 112);
    g.fillStyle = red;
    g.font = `900 34px ${HEAD}`;
    g.textAlign = 'center';
    g.fillText('Can You Read Minds?', W / 2, 712);
    g.font = `italic 13px ${SC}`;
    g.fillText('Find out tonight. Rooms open now.', W / 2, 742);
    return { canvas: c };
  }

  function drawStamp(g, x, y, s, rot, alpha) {
    const R = rng(55);
    g.save();
    g.translate(x, y);
    g.rotate(rot - 0.16);
    g.scale(s, s);
    g.globalAlpha = alpha;
    g.strokeStyle = g.fillStyle = '#b3261e';
    g.lineWidth = 2.6; g.strokeRect(-58, -21, 116, 42);
    g.lineWidth = 1; g.strokeRect(-53, -16, 106, 32);
    g.font = '900 25px "Playfair Display", Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('EXTRA!', 0, 1.5);
    g.fillStyle = '#f3eee2'; // worn rubber: paper shows through
    for (let i = 0; i < 90; i++) g.fillRect(R() * 124 - 62, R() * 46 - 23, R() * 2.2, R() * 1.6);
    g.restore();
  }

  function bakeStamp(tex) {
    drawStamp(tex.g, STAMP.x, STAMP.y, STAMP.s, 0, 0.72); // as faint as the page's stamp
  }

  // ---------- Creases on the real page (drawn in every mode, it's cheap) ----------
  function creaseImage() {
    const m = buildMesh(18, 24);
    deform(m, 1);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.filter = 'blur(2px)'; // soften the facet edges into creases
    for (const t of m.tris) {
      const s = shadeOf(m, t, false);
      const v = Math.round(255 - Math.max(0, -s) * 650);
      if (v > 250) continue;
      g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      g.beginPath();
      t.forEach((k, i) => g[i ? 'lineTo' : 'moveTo'](m.lx[k] + W / 2, m.ly[k] + H / 2));
      g.closePath();
      g.fill();
    }
    g.filter = 'none';
    const fold = g.createLinearGradient(0, H / 2 - 10, 0, H / 2 + 10); // where it was folded in half
    fold.addColorStop(0, '#fff0');
    fold.addColorStop(0.5, '#00000026');
    fold.addColorStop(1, '#fff0');
    g.fillStyle = fold;
    g.fillRect(0, H / 2 - 10, W, 20);
    return c.toDataURL();
  }

  const creases = document.querySelector('.creases');
  if (creases) creases.style.backgroundImage = `url(${creaseImage()})`;

  const stage = document.getElementById('intro');
  if (MODE !== 'full') {
    stage?.remove();
    return;
  }

  // ---------- Sound: paper crinkles and thuds from filtered noise ----------
  let noiseBuf = null;
  function audioReady() {
    if (!soundOn || !navigator.userActivation?.hasBeenActive) return null;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (!noiseBuf) {
        noiseBuf = audio.createBuffer(1, audio.sampleRate * 0.6, audio.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return audio;
    } catch (e) { return null; }
  }
  function crinkle(dur = 0.3, vol = 0.35) {
    const a = audioReady();
    if (!a) return;
    for (let i = 0; i < 16; i++) {
      const src = a.createBufferSource(), bp = a.createBiquadFilter(), gain = a.createGain();
      const at = a.currentTime + Math.random() * dur, len = 0.008 + Math.random() * 0.04;
      src.buffer = noiseBuf;
      bp.type = 'bandpass';
      bp.frequency.value = 1500 + Math.random() * 5000;
      bp.Q.value = 0.8;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(vol * (0.3 + Math.random() * 0.7), at + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
      src.connect(bp).connect(gain).connect(a.destination);
      src.start(at, Math.random() * 0.5, len + 0.02);
    }
  }
  function thud(vol = 0.5) {
    const a = audioReady();
    if (!a) return;
    const osc = a.createOscillator(), gain = a.createGain(), t = a.currentTime;
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + 0.25);
    crinkle(0.06, vol * 0.5);
  }


  // ---------- Stage ----------
  stage.style.animation = 'none';
  scrollTo(0, 0);
  const canvas = stage.querySelector('.intro-canvas');
  const ctx = canvas.getContext('2d');
  const filmCanvas = stage.querySelector('.intro-film');
  const fctx = filmCanvas.getContext('2d');
  const dark = stage.querySelector('.intro-dark');
  const grain = stage.querySelector('.intro-grain');
  const hint = stage.querySelector('.intro-hint');
  // Film layers settle to the page's own (weaker) film look; the desk props fade out entirely.
  const dimmed = [...stage.querySelectorAll('.intro-vignette, .intro-tint, .intro-grain, .intro-film, .props')];
  const sheet = document.querySelector('.sheet');
  const pageStamp = document.querySelector('.stamp');
  let vw, vh, dpr, baseS;
  function resize() {
    vw = stage.clientWidth; // not innerWidth: the page keeps a gutter for its scrollbar
    vh = stage.clientHeight;
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    filmCanvas.width = vw;
    filmCanvas.height = vh;
    baseS = Math.min((vh * 0.8) / H, (vw * 0.88) / W);
  }
  resize();
  addEventListener('resize', resize);

  const mesh = vw < 700 ? buildMesh(12, 16) : buildMesh(18, 24);
  let tex = null, back = null;

  // Timeline (seconds). The intro waits on the landed ball for a tap (or a moment).
  const tl = {};
  function scheduleUnfold(at) {
    tl.unfold = at;
    tl.jerks = [0, 0.42, 0.84, 1.22].map(d => at + d);
    tl.stamp = at + 1.72;
    tl.handoff = at + 2.15;
    tl.end = at + 3.15;
  }
  const LAND = [1.0, 1.26, 1.43, 1.53]; // ball contacts with the desk
  scheduleUnfold(2.35);

  const fired = new Set();
  const once = (key, fn) => { if (!fired.has(key)) { fired.add(key); fn(); } };

  // State of everything at time t (quantized to 12 fps until the hand-off).
  function stateAt(t) {
    const s = { visible: true, P: 1, h: 0, x: 0, y: 0, rx: 0, ry: 0, rz: -0.03, zoom: 1, light: 1, lift: 0 };
    s.light = t < 0.12 ? 0 : t < 0.2 ? 0.7 : t < 0.27 ? 0.15 : 1; // the lamp clicks on
    const t0 = 0.42;
    if (t < t0) { s.visible = false; return s; }
    if (t < LAND[3] + 0.1) {
      const k = easeOut(clamp01((t - t0) / (LAND[2] - t0)));
      s.x = lerp(vw * 0.75, 0, k);
      s.y = lerp(-vh * 0.42, 0, k);
      if (t < LAND[0]) s.h = 1.7 * (1 - Math.pow((t - t0) / (LAND[0] - t0), 2));
      else {
        const peaks = [0.32, 0.11, 0.035];
        for (let i = 0; i < 3; i++) {
          if (t >= LAND[i] && t < LAND[i + 1]) {
            const u = (t - LAND[i]) / (LAND[i + 1] - LAND[i]);
            s.h = peaks[i] * 4 * u * (1 - u);
          }
        }
      }
    }
    const spin = 1 - easeOut(clamp01((t - t0) / (LAND[3] - t0)));
    s.rx = spin * 5.2;
    s.ry = spin * -3.4;
    s.rz = -0.03 + spin * 7.5;
    // Unfold in uneven jerks, each overshooting a touch.
    const targets = [0.2, 0.48, 0.79, 1];
    let P = 0;
    tl.jerks.forEach((at, i) => {
      const from = i ? targets[i - 1] : 0;
      if (t >= at) P = lerp(from, targets[i], easeBack(clamp01((t - at) / 0.26)));
    });
    if (t < tl.unfold && t > LAND[3]) { // resting ball, rocking a little
      s.rz += Math.sin(t * 9) * 0.03;
      P = 0.015 + 0.012 * Math.sin(t * 13);
    }
    s.P = Math.min(1, P);
    if (s.P < 1 && t >= tl.unfold) s.rz += (1 - s.P) * 0.25 * Math.sin(t * 3);
    if (t >= tl.handoff) {
      // The camera settles onto the page and the lights come up.
      const k = easeInOut(clamp01((t - tl.handoff) / (tl.end - tl.handoff)));
      const r = sheet.getBoundingClientRect();
      const targetS = r.width / W;
      s.x = lerp(0, r.left + r.width / 2 - vw / 2, k);
      s.y = lerp(0, r.top + (H * targetS) / 2 - vh / 2, k);
      s.zoom = lerp(1, targetS / baseS, k);
      s.rz = lerp(-0.03, 0, k);
      s.lift = k;
    }
    return s;
  }

  // Affine map from a texture triangle (u, v in pixels) onto a screen triangle.
  function mapTri(img, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
    const den = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
    ctx.transform(
      (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / den,
      (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / den,
      (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / den,
      (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / den,
      (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / den,
      (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / den,
    );
    ctx.drawImage(img, 0, 0);
  }

  function render(t, frame) {
    const s = stateAt(t);
    const R = rng(frame * 7919 + 1);
    const steady = 1 - s.lift; // the stop-motion wobble dies down as the camera settles
    let jx, jy, jr;
    if (SMOOTH) {
      const k = t - tl.stamp - 0.15, hit = k > 0 && k < 0.5 ? Math.exp(-k * 9) * 7 * steady : 0;
      jx = Math.sin(k * 70) * hit; jy = Math.cos(k * 55) * hit * 0.6; jr = 0;
      R(); R(); R(); R(); // keep the dust in step with the stop-motion version
      dark.style.opacity = (1 - s.light) * 0.95 * steady;
    } else {
      const shakeAmp = (t >= tl.stamp + 0.15 && t < tl.stamp + 0.32 ? 6 : 1.4) * steady;
      jx = (R() - 0.5) * 2 * shakeAmp; jy = (R() - 0.5) * 2 * shakeAmp; jr = (R() - 0.5) * 0.006 * steady;
      dark.style.opacity = ((1 - s.light) * 0.95 + R() * 0.08) * steady;
    }
    grain.style.transform = `translate(${(R() * 80) | 0}px, ${(R() * 80) | 0}px)`;
    for (const el of dimmed) el.style.opacity = lerp(1, +(el.dataset.settle || 0), s.lift);
    fctx.clearRect(0, 0, vw, vh);
    window.PP.dust(fctx, vw, vh, R, 1);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    if (!s.visible || !tex) return;

    deform(mesh, s.P, s.lift);
    rotate(mesh, s.rx, s.ry, s.rz + jr);
    const S = baseS * s.zoom * (1 + s.h * 0.45), f = 1800;
    const CX = vw / 2 + s.x + jx, CY = vh / 2 + s.y + jy;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let k = 0; k < mesh.n; k++) {
      const p = f / (f - mesh.z[k]);
      const x = CX + mesh.x[k] * S * p, y = CY + mesh.y[k] * S * p;
      mesh.sx[k] = x; mesh.sy[k] = y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }

    // Soft shadow on the desk, further away the higher the paper is.
    const bw = maxX - minX, bh = maxY - minY, far = 10000;
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${(0.62 - s.h * 0.2) * steady})`;
    ctx.shadowBlur = (10 + s.h * 40 + (1 - s.P) * 8) * dpr;
    ctx.shadowOffsetX = (far + 6 + s.h * 70) * dpr;
    ctx.shadowOffsetY = (9 + s.h * 90) * dpr;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    const rad = lerp(Math.min(bw, bh) / 2, 2, s.P);
    if (ctx.roundRect) ctx.roundRect(minX - far + bw * 0.04, minY + bh * 0.04, bw * 0.92, bh * 0.92, rad);
    else ctx.ellipse(minX - far + bw / 2, minY + bh / 2, bw * 0.46, bh * 0.46, 0, 0, 7);
    ctx.fill();
    ctx.restore();

    // Painter's sort, back to front.
    const { tris, order, depth } = mesh;
    for (let i = 0; i < tris.length; i++) {
      const [a, b, c] = tris[i];
      depth[i] = mesh.z[a] + mesh.z[b] + mesh.z[c];
    }
    order.sort((i, j) => depth[i] - depth[j]);

    const img = tex.canvas, tw = img.width, th = img.height;
    const bimg = back.canvas, bw2 = bimg.width, bh2 = bimg.height;
    const { u, v } = mesh;
    for (const i of order) {
      const [a, b, c] = tris[i];
      const x0 = mesh.sx[a], y0 = mesh.sy[a], x1 = mesh.sx[b], y1 = mesh.sy[b], x2 = mesh.sx[c], y2 = mesh.sy[c];
      const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
      if (Math.abs(area) < 0.05) continue;
      const front = area > 0;
      const shade = s.lift >= 1 ? 0 : shadeOf(mesh, tris[i], !front);
      // Grow the clip a hair past each edge so facets don't show seams.
      const mx = (x0 + x1 + x2) / 3, my = (y0 + y1 + y2) / 3, grow = 0.8;
      const out = (x, y) => {
        const dx = x - mx, dy = y - my, l = Math.hypot(dx, dy) || 1;
        return [x + (dx / l) * grow, y + (dy / l) * grow];
      };
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(...out(x0, y0));
      ctx.lineTo(...out(x1, y1));
      ctx.lineTo(...out(x2, y2));
      ctx.closePath();
      ctx.clip();
      if (front) mapTri(img, x0, y0, x1, y1, x2, y2, u[a] * tw, v[a] * th, u[b] * tw, v[b] * th, u[c] * tw, v[c] * th);
      else mapTri(bimg, x0, y0, x1, y1, x2, y2, (1 - u[a]) * bw2, v[a] * bh2, (1 - u[b]) * bw2, v[b] * bh2, (1 - u[c]) * bw2, v[c] * bh2);
      if (shade > 0.01) {
        ctx.fillStyle = `rgba(255,246,226,${Math.min(0.5, shade * 1.25)})`;
        ctx.fill();
      } else if (shade < -0.01) {
        ctx.fillStyle = `rgba(24,14,6,${Math.min(0.72, -shade * 1.35)})`;
        ctx.fill();
      }
      ctx.restore();
    }

    // The stamp coming down, before it is baked into the paper.
    if (t >= tl.stamp && t < tl.stamp + 0.17) {
      const k = clamp01((t - tl.stamp) / 0.17);
      const lx = STAMP.x - W / 2, ly = STAMP.y - H / 2, cs = Math.cos(s.rz), sn = Math.sin(s.rz);
      const px = CX + (lx * cs - ly * sn) * S, py = CY + (lx * sn + ly * cs) * S;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.5)';
      ctx.shadowBlur = 20 * dpr * (1 - k);
      ctx.shadowOffsetY = 30 * dpr * (1 - k);
      drawStamp(ctx, px, py, S * STAMP.s * lerp(2.6, 1.05, k), s.rz, lerp(0.35, 0.95, k));
      ctx.restore();
    }
  }

  function events(t) {
    if (t >= 0.12) once('lamp', () => crinkle(0.02, 0.15));
    LAND.slice(0, 3).forEach((at, i) => { if (t >= at) once('land' + i, () => thud(0.5 / (i + 1))); });
    if (t >= LAND[3] + 0.12 && t < tl.unfold) once('hint', () => hint.classList.add('show'));
    if (t >= tl.unfold) once('hint-off', () => hint.classList.remove('show'));
    tl.jerks.forEach((at, i) => { if (t >= at) once('jerk' + i, () => crinkle(0.28, 0.38 - i * 0.05)); });
    if (t >= tl.stamp + 0.17) once('bake', () => { bakeStamp(tex); thud(0.7); });
  }

  // ---------- Loop ----------
  // ?t=2.6 freezes the intro at 2.6 s, for inspecting a single frame.
  const FREEZE = parseFloat(new URLSearchParams(location.search).get('t'));
  let start = null, last = -1, done = false;
  function tick(now) {
    if (done) return;
    if (start === null) start = now;
    if (FREEZE >= 0) {
      for (let s = 0; s <= FREEZE; s += 1 / 12) events(s);
      return render(FREEZE >= tl.handoff ? FREEZE : Math.floor(FREEZE * 12) / 12, 1);
    }
    const t = (now - start) / 1000;
    if (t >= tl.handoff || SMOOTH) {
      // The camera move runs at the display's full frame rate, so it glides (smooth pages: all of it).
      events(t);
      render(Math.min(t, tl.end), Math.floor(t * 12));
    } else {
      const frame = Math.floor(t * 12);
      if (frame !== last) {
        last = frame;
        events(frame / 12);
        render(frame / 12, frame);
      }
    }
    if (t >= tl.end) finish();
    else requestAnimationFrame(tick);
  }

  function finish(skipped) {
    if (done) return;
    done = true;
    root.classList.remove('intro-on');
    if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
    if (skipped || !fired.has('bake')) pageStamp?.classList.add('thump');
    // After a full run the canvas already matches the page, so it can dissolve quickly.
    stage.classList.add(skipped ? 'fading' : 'handing-off');
    setTimeout(() => stage.remove(), 450);
    document.dispatchEvent(new Event('intro:done'));
  }

  // A tap on the waiting ball opens it now (and unlocks sound); later taps and keys skip.
  stage.addEventListener('click', e => {
    if (e.target.closest('.intro-skip')) return finish(true);
    const t = start === null ? 0 : (performance.now() - start) / 1000;
    if (t < tl.unfold) scheduleUnfold(Math.max(t + 0.05, LAND[3] + 0.08));
    else finish(true);
  });
  addEventListener('keydown', e => {
    if (!done && !e.metaKey && !e.ctrlKey && !e.altKey) finish(true);
  });

  // The front of the sheet is a snapshot of the real page, so the hand-off lines up exactly.
  function snapshot() {
    if (!window.html2canvas) return Promise.resolve(null);
    const w = sheet.offsetWidth;
    const labels = [...document.querySelectorAll('.axis-label.left, .axis-label.right')].map(el => [el.offsetWidth, el.offsetHeight]);
    return html2canvas(sheet, {
      width: w,
      height: Math.round((w * H) / W),
      scale: Math.max(1.5, dpr),
      logging: false,
      backgroundColor: getComputedStyle(sheet).backgroundColor || '#f3eee2',
      ignoreElements: el => el.id === 'intro' || el.classList?.contains('creases'),
      onclone: doc => patchClone(doc, labels),
    }).then(c => {
      const g = c.getContext('2d');
      g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
      return { canvas: c, g };
    });
  }

  // html2canvas misses a few CSS features; patch its copy of the page so the snapshot matches.
  function patchClone(doc, labels) {
    // Sideways axis labels: rotate the text instead of using writing-mode, at the same size.
    doc.querySelectorAll('.axis-label.left, .axis-label.right').forEach((el, i) => {
      const [w, h] = labels[i];
      const text = el.textContent;
      Object.assign(el.style, { writingMode: 'horizontal-tb', transform: 'none', width: w + 'px', height: h + 'px', position: 'relative', padding: '0' });
      el.innerHTML = `<span style="position:absolute;left:50%;top:50%;white-space:nowrap;transform:translate(-50%,-50%) rotate(${el.classList.contains('left') ? -90 : 90}deg)"></span>`;
      el.firstChild.textContent = text;
    });
    // The drop cap (::first-letter is not supported).
    const p = doc.querySelector('.story p');
    const first = p?.firstChild;
    if (first?.nodeType === 3) {
      const cap = doc.createElement('span');
      cap.textContent = first.textContent[0];
      cap.style.cssText = 'float:left;font:900 3.7rem/0.82 "Playfair Display",Georgia,serif;padding:5px 8px 0 0;color:#b3261e';
      first.textContent = first.textContent.slice(1);
      p.insertBefore(cap, first);
    }
    // Tiny dot pattern renders as stripes; outlines are skipped.
    doc.querySelector('.sheet').style.backgroundImage = 'radial-gradient(ellipse at 50% 40%, #0000, #9c7a4a26 95%)';
    window.PP.patchClone?.(doc); // each variant can patch its own details
  }

  // Put the canvas stamp exactly where the page's stamp sits.
  function placeStamp() {
    if (!pageStamp) return;
    const sr = sheet.getBoundingClientRect(), r = pageStamp.getBoundingClientRect(), k = W / sr.width;
    STAMP.x = (r.left + r.width / 2 - sr.left) * k;
    STAMP.y = (r.top + r.height / 2 - sr.top) * k;
    STAMP.s = (pageStamp.offsetWidth * k) / 116; // the drawn stamp is 116 units wide
  }

  // Wait (briefly) for fonts and the snapshot, with the lamp still off, then roll.
  const wait = (ms, value) => new Promise(r => setTimeout(() => r(value), ms));
  const fonts = ['58px UnifrakturMaguntia', '900 27px "Playfair Display"', '700 8px "Playfair Display"',
    '7px "Old Standard TT"', 'italic 7px "Old Standard TT"', '700 7px "Old Standard TT"', '7px "Special Elite"'];
  const loaded = document.fonts ? Promise.all([...fonts.map(f => document.fonts.load(f)), document.fonts.ready]) : Promise.resolve();
  Promise.race([loaded, wait(1800)]).catch(() => {})
    .then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))) // let page.js draw the photo
    .then(() => Promise.race([snapshot(), wait(3500, null)]).catch(() => null))
    .then(snap => {
      placeStamp();
      tex = snap || paintTexture();
      back = paintBack();
      requestAnimationFrame(tick);
    });
})();
