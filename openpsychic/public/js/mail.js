// The mailing animation: cut the form out, fold it, seal it, post it, and open the reply.
(() => {
  function paperSound(dur = 0.22, vol = 0.22) {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * dur), audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      const src = audio.createBufferSource(), band = audio.createBiquadFilter(), gain = audio.createGain();
      src.buffer = buffer;
      band.type = 'bandpass';
      band.frequency.value = 3200;
      band.Q.value = 0.7;
      gain.gain.value = vol;
      src.connect(band).connect(gain).connect(audio.destination);
      src.start();
    } catch (e) { /* audio unavailable; stay silent */ }
  }
  const thud = () => blip(110, 0.2, 'sine', 0.22);

  function make(tag, className, parent, html) {
    const el = document.createElement(tag);
    el.className = className;
    if (html) el.innerHTML = html;
    if (parent) parent.appendChild(el);
    return el;
  }
  function place(el, left, top, width, height) {
    Object.assign(el.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' });
  }
  // A copy of the form with nothing focusable or duplicated by id, wrapped so the page's layout rules still apply.
  let copies = 0;
  function copyOfForm(width, coupon) {
    const wrap = make('div', 'front');
    const inner = make('div', 'slot', wrap);
    const copy = coupon.cloneNode(true);
    copy.removeAttribute('id');
    // The board's clip gets its own id: the original is hidden once it's cut out, and would hide the grid.
    const clipId = `board-clip-copy-${++copies}`;
    copy.querySelector('clipPath').id = clipId;
    copy.querySelectorAll('[clip-path]').forEach(el => el.setAttribute('clip-path', `url(#${clipId})`));
    copy.querySelectorAll('[id]:not(clipPath)').forEach(el => el.removeAttribute('id'));
    copy.querySelectorAll('[tabindex]').forEach(el => el.removeAttribute('tabindex'));
    inner.appendChild(copy);
    wrap.inert = true;
    wrap.style.width = width + 'px';
    return wrap;
  }

  // A small drawing of one clue's board, with your mark if you've made it.
  function thumb(m, current) {
    const mark = m ? `<g transform="translate(${m.x} ${m.y}) scale(3.2)">${YOU_MARK}</g>` : ''; // The board's own mark, scaled up.
    return `<svg class="thumb${current ? ' is-current' : ''}" viewBox="0 0 100 100" aria-hidden="true"><line x1="50" y1="0" x2="50" y2="100"/><line x1="0" y1="50" x2="100" y2="50"/>${mark}</svg>`;
  }

  function runMailroom({ coupon, slot, statusEl, done }) {
    let finished = false, skipped = false;
    const timers = [];
    const EASE = 'cubic-bezier(.45, .05, .25, 1)';
    const SETTLE = 'cubic-bezier(.16, 1, .3, 1)';

    coupon.scrollIntoView({ block: 'center', behavior: 'instant' });
    document.documentElement.classList.add('is-mailing');

    const room = make('div', 'mailroom', document.body);
    room.setAttribute('role', 'group');
    room.setAttribute('aria-label', 'Your entry is being mailed');
    const desk = make('div', 'mail-desk', room);
    const shadow = make('div', 'mail-shadow', room);
    const stage = make('div', 'mail-stage', room);
    const caption = make('p', 'mailroom-caption', room);
    const skipBtn = make('button', 'btn mailroom-skip', room, 'Skip to the reply');
    skipBtn.type = 'button';
    skipBtn.focus({ preventScroll: true });

    const animate = (el, frames, duration, options) =>
      el.animate(frames, { duration: skipped ? 0 : duration, easing: EASE, fill: 'forwards', ...options }).finished.catch(() => {});
    const pause = ms => skipped ? Promise.resolve() : new Promise(r => timers.push(setTimeout(r, ms)));

    // GSAP gives the physical moves their weight: springy settles, wobbles, and curved flight paths.
    // Skipping jumps straight past them; finish() kills whatever is still running.
    const G = window.gsap;
    if (G && window.MotionPathPlugin) G.registerPlugin(window.MotionPathPlugin);
    const tween = (el, vars) => (G && !skipped ? G.to(el, vars).then(() => {}) : Promise.resolve());
    const set = (el, vars) => G?.set(el, vars);

    // The caption ticket: the old words fade off, the new ones type on letter by letter.
    let saying = 0;
    async function say(text) {
      const turn = ++saying;
      if (caption.textContent && !skipped) {
        await caption.animate([{ opacity: 1 }, { opacity: 0, translate: '-50% 5px' }], { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
      }
      if (turn !== saying) return;
      caption.getAnimations().forEach(a => a.cancel());
      caption.textContent = text;
      if (!text || skipped) return;
      caption.animate([{ opacity: 0, translate: '-50% -5px' }, { opacity: 1, translate: '-50% 0' }], { duration: 220, easing: SETTLE });
      caption.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: Math.min(520, 40 * text.length), easing: `steps(${text.length}, end)` });
    }

    function finish() {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      G?.killTweensOf(room.querySelectorAll('*'));
      slot.querySelector('.cut-path')?.remove();
      slot.classList.add('is-cut');
      statusEl.textContent = 'Your entry has been mailed. Your reply has arrived.';
      document.documentElement.classList.remove('is-mailing');
      done();
      // The letter is already on top; let the desk fade away behind it.
      if (skipped) room.remove();
      else room.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, fill: 'forwards' }).finished.then(() => room.remove(), () => room.remove());
    }
    skipBtn.addEventListener('click', () => { skipped = true; finish(); });

    const midX = innerWidth / 2, midY = innerHeight * 0.46;

    /* ---- The paper: panels on hinges, each with a printed front and a plain reverse ---- */

    const W = coupon.offsetWidth, H = coupon.offsetHeight;
    const wide = W > H;
    const root = make('div', 'fold-root', stage);
    place(root, 0, 0, W, H);
    root.style.visibility = 'hidden';

    function panel(parent, x, y, w, h, left, top, axis, origin) {
      const p = make('div', 'fold-panel', parent);
      place(p, left, top, w, h);
      if (origin) p.style.transformOrigin = origin;
      const front = make('div', 'fold-face fold-front', p);
      const copy = copyOfForm(W, coupon);
      copy.style.left = -x + 'px';
      copy.style.top = -y + 'px';
      front.appendChild(copy);
      const frontShade = make('i', 'fold-shade', front);
      const back = make('div', 'fold-face fold-back', p);
      back.style.transform = axis === 'y' ? 'rotateY(180deg)' : 'rotateX(180deg)';
      const backShade = make('i', 'fold-shade', back);
      return { el: p, front, back, shades: [frontShade, backShade] };
    }

    // Wide forms fold in half twice. Tall forms get the classic letter fold in three.
    // Each fold: what turns (axis, direction, how high it lands), which shades light it,
    // and which faces it comes to rest on. Those faces are hidden as it lands, so the print
    // underneath can never flicker through the fold. topFace is the blank side left on top.
    let folds, boxes, topFace;
    const turn = (el, axis, sign, z) => ({ el, axis, sign, z });
    if (wide) {
      const qw = W / 2, qh = H / 2;
      const tl = panel(root, 0, 0, qw, qh, 0, 0, 'x');
      const tr = panel(root, qw, 0, qw, qh, qw, 0, 'y', '0 50%');
      const hinge = make('div', 'fold-hinge', root);
      place(hinge, 0, qh, W, qh);
      hinge.style.transformOrigin = '50% 0';
      const bl = panel(hinge, 0, qh, qw, qh, 0, 0, 'x');
      const br = panel(hinge, qw, qh, qw, qh, qw, 0, 'y', '0 50%');
      folds = [
        { moving: [turn(tr.el, 'Y', -1, 2), turn(br.el, 'Y', -1, 2)], lit: [tr.shades, br.shades], cast: [tl.shades[0], bl.shades[0]], cover: [tl.front, bl.front] },
        { moving: [turn(hinge, 'X', 1, 6)], lit: [bl.shades], cast: [tr.shades[1]], cover: [tr.back] },
      ];
      topFace = bl.back;
      boxes = [{ x: 0, y: 0, w: W, h: H }, { x: 0, y: 0, w: qw, h: H }, { x: 0, y: 0, w: qw, h: qh }];
    } else {
      const third = H / 3;
      const top = panel(root, 0, 0, W, third, 0, 0, 'x', '50% 100%');
      const mid = panel(root, 0, third, W, third, 0, third, 'x');
      const bot = panel(root, 0, third * 2, W, third, 0, third * 2, 'x', '50% 0');
      folds = [
        { moving: [turn(bot.el, 'X', 1, 2)], lit: [bot.shades], cast: [mid.shades[0]], cover: [mid.front] },
        { moving: [turn(top.el, 'X', -1, 6)], lit: [top.shades], cast: [bot.shades[1]], cover: [bot.back] },
      ];
      topFace = top.back;
      boxes = [{ x: 0, y: 0, w: W, h: H }, { x: 0, y: 0, w: W, h: third * 2 }, { x: 0, y: third, w: W, h: third }];
    }

    // Where the paper sits so that a given part of it is centred on (cx, cy).
    const poseFor = (box, s, cx, cy, extra = '') =>
      `translate(${cx - (box.x + box.w / 2) * s}px, ${cy - (box.y + box.h / 2) * s}px) ${extra} scale(${s})`;
    const shadowFor = (box, s, cx, cy) => ({
      left: cx - (box.w * s) / 2 + 'px', top: cy - (box.h * s) / 2 + 'px', width: box.w * s + 'px', height: box.h * s + 'px',
    });

    const foldScale = Math.min(1, (innerWidth * 0.8) / W, (innerHeight * 0.56) / H);

    /* ---- The envelope ---- */

    const packet = boxes[2];
    const packetW = packet.w * foldScale, packetH = packet.h * foldScale;
    const envAspect = 1.55;
    let envW = Math.max(packetW / 0.86, (packetH / 0.76) * envAspect);
    const envFit = Math.min(1, (innerWidth * 0.82) / envW, (innerHeight * 0.4) / (envW / envAspect));
    envW *= envFit;
    const envH = envW / envAspect;
    const packetScale = foldScale * envFit;

    function envelope(address, parentBefore) {
      const env = make('div', 'env', stage);
      place(env, midX - envW / 2, midY - envH / 2, envW, envH);
      env.innerHTML = `
        <div class="env-side env-inner"></div>
        <div class="env-side env-pocket"></div>
        <div class="env-flap" style="height:${envH * 0.58}px"><div class="env-flap-out"></div><div class="env-flap-in"></div></div>
        <div class="env-seal" style="width:${envH * 0.24}px;height:${envH * 0.24}px;font-size:${envH * 0.13}px;top:${envH * 0.58 - envH * 0.12}px">★</div>
        <div class="env-address" style="--address-size:${Math.max(9, envH * 0.07)}px">${address}</div>`;
      const part = c => env.querySelector(c);
      return { env, flap: part('.env-flap'), seal: part('.env-seal'), addressSide: part('.env-address') };
    }
    const STAMP = '<span class="env-stamp"><b>★</b>Big Top</span>';

    /* ---- The post box: a striped Big Top mailbox ---- */

    const boxScale = Math.min(1, innerHeight / 620, innerWidth / 560);
    const boxW = 170 * boxScale, boxH = 300 * boxScale;
    const boxX = Math.min(innerWidth - boxW - 14, midX + 96 * boxScale), boxY = midY - boxH * 0.42;

    function mailbox() {
      const stripes = [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${17 + i * 17}" y="58" width="17" height="190" fill="${i % 2 ? '#e9e0c8' : '#b3261e'}"/>`).join('');
      const scallops = [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<path d="M${17 + i * 17} 58a8.5 9 0 0 0 17 0z" fill="${i % 2 ? '#e9e0c8' : '#b3261e'}" stroke="#1b1b1b" stroke-width="1.4"/>`).join('');
      const box = make('div', 'mailbox', room, `<svg viewBox="0 0 170 300" aria-hidden="true">
        <path d="M85 4v22" stroke="#1b1b1b" stroke-width="3"/><path class="mb-pennant" d="M85 5l26 8-26 8z" fill="#b3261e" stroke="#1b1b1b" stroke-width="1.4"/>
        ${stripes}
        <path d="M17 58C20 36 56 24 85 24s65 12 68 34z" fill="#b3261e" stroke="#1b1b1b" stroke-width="2"/>
        <path d="M58 58C60 42 72 28 85 24c13 4 25 18 27 34z" fill="#e9e0c8" stroke="#1b1b1b" stroke-width="1.4"/>
        ${scallops}
        <rect x="17" y="58" width="136" height="190" fill="none" stroke="#1b1b1b" stroke-width="2.4"/>
        <rect x="32" y="84" width="106" height="13" rx="2" fill="#17110b" stroke="#e9e0c8" stroke-width="2"/>
        <g class="mb-flap"><rect x="33" y="85" width="104" height="11" rx="1.5" fill="#8f1d17" stroke="#1b1b1b" stroke-width="1.2"/><path d="M40 89.5h90" stroke="#e9e0c8" stroke-width="0.8" opacity="0.6"/></g>
        <rect x="42" y="124" width="86" height="62" fill="#e9e0c8" stroke="#1b1b1b" stroke-width="2"/>
        <rect x="46" y="128" width="78" height="54" fill="none" stroke="#1b1b1b" stroke-width="0.8"/>
        <text x="85" y="147" text-anchor="middle" font-family="Rye, Georgia, serif" font-size="12.5" fill="#1b1b1b">Big Top</text>
        <text x="85" y="162" text-anchor="middle" font-family="Rye, Georgia, serif" font-size="12.5" fill="#b3261e">Mail</text>
        <text x="85" y="175" text-anchor="middle" font-family="'Special Elite', monospace" font-size="6.5" fill="#1b1b1b">CONTEST ENTRIES</text>
        <path d="M30 248v44M140 248v44" stroke="#1b1b1b" stroke-width="9"/><path d="M14 294h142" stroke="#1b1b1b" stroke-width="4"/>
      </svg>`);
      place(box, boxX, boxY, boxW, boxH);
      return box;
    }

    /* ---- One fold: quick and smooth, lit as it turns ---- */

    const FOLD = 0.44; // seconds per fold
    async function foldOnce(fold, prev, next) {
      paperSound(0.22, 0.2);
      if (!G || skipped) {
        fold.moving.forEach(({ el, axis, sign, z }) => { el.style.transform = `translateZ(${z}px) rotate${axis}(${sign * 180}deg)`; });
        fold.cover.forEach(face => { face.style.visibility = 'hidden'; });
        root.style.transform = poseFor(next, foldScale, midX, midY);
        return finished;
      }
      let covered = false;
      const cover = () => { if (!covered) { covered = true; fold.cover.forEach(face => { face.style.visibility = 'hidden'; }); } };
      const turns = fold.moving.map(({ el, axis, sign, z }) => {
        const origin = el.style.transformOrigin || '50% 50%';
        // It lifts as it turns and lands flat; the faces it lands on go once it is nearly down.
        G.timeline().to(el, { z: z + 22, duration: FOLD / 2, ease: 'sine.out', transformOrigin: origin }).to(el, { z, duration: FOLD / 2, ease: 'sine.in' });
        return G.to(el, {
          [axis === 'Y' ? 'rotationY' : 'rotationX']: sign * 180, duration: FOLD, ease: 'power2.inOut', transformOrigin: origin,
          onUpdate() { if (this.progress() > 0.88) cover(); },
        }).then(cover);
      });
      // Light: the printed side dims as it turns away; the blank side starts in shadow and brightens as it lands.
      fold.lit.forEach(([front, back]) => {
        G.fromTo(front, { opacity: 0 }, { opacity: 0.38, duration: FOLD / 2, ease: 'power1.in' });
        G.fromTo(back, { opacity: 0.42 }, { opacity: 0, duration: FOLD / 2, delay: FOLD / 2, ease: 'power2.out' });
      });
      // The turning panel casts a shadow on the half it is about to cover.
      fold.cast.forEach(shade => G.timeline().fromTo(shade, { opacity: 0 }, { opacity: 0.24, duration: FOLD * 0.7, ease: 'power1.in' }).to(shade, { opacity: 0, duration: FOLD * 0.3 }));
      animate(shadow, [shadowFor(prev, foldScale, midX, midY), shadowFor(next, foldScale, midX, midY)], FOLD * 1000, { easing: 'cubic-bezier(.2, .7, .3, 1)' });
      await Promise.all([...turns, animate(root, [{ transform: poseFor(prev, foldScale, midX, midY) }, { transform: poseFor(next, foldScale, midX, midY) }], FOLD * 1000)]);
      if (finished) return true;
      await pause(30);
      return finished;
    }

    /* ---- The signature: an 80s four-colour clicky pen signs the blank side ---- */

    // One continuous stroke of a loose cursive signature, and an underline, drawn in a 300 x 100 box.
    const SIGNATURE = 'M8 66C14 40 30 18 36 30C42 44 26 72 34 74C44 76 50 44 58 46C66 48 56 70 64 70C72 70 76 50 84 50C92 50 84 70 92 70C100 70 104 38 112 22C118 12 122 24 116 44C110 64 108 76 118 70C128 64 132 48 140 50C148 52 140 70 150 68C160 66 164 50 172 52C180 54 172 72 182 70C192 68 198 54 206 54C214 54 208 70 218 68C232 66 246 40 262 44C276 48 266 66 252 64C240 62 262 52 290 50';
    const UNDERLINE = 'M20 86C80 80 170 92 284 82';
    const PEN = `<g class="pen-body">
        <path d="M0 0 L-2.6 -9 L2.6 -9Z" fill="#c8c8c4" stroke="#1b1b1b" stroke-width="0.5"/>
        <rect x="-4.6" y="-34" width="9.2" height="25" rx="2" fill="#ecebe4" stroke="#1b1b1b" stroke-width="0.6"/>
        <rect x="-3.6" y="-31" width="1.6" height="20" fill="#ffffff" opacity="0.7"/>
        <rect x="-5.4" y="-38" width="10.8" height="5" rx="1" fill="#cfd2d6" stroke="#1b1b1b" stroke-width="0.5"/>
        <rect x="-5.8" y="-104" width="11.6" height="67" rx="3" fill="#2d5fb5" stroke="#1b1b1b" stroke-width="0.6"/>
        <rect x="-4.2" y="-100" width="2" height="58" rx="1" fill="#ffffff" opacity="0.28"/>
        <rect x="-5.2" y="-112" width="2.4" height="10" fill="#c0272d" stroke="#1b1b1b" stroke-width="0.4"/>
        <rect x="-2.6" y="-110" width="2.4" height="8" fill="#2e8b3e" stroke="#1b1b1b" stroke-width="0.4"/>
        <rect x="0" y="-110" width="2.4" height="8" fill="#1b1b1b" stroke="#1b1b1b" stroke-width="0.4"/>
        <rect x="2.6" y="-115" width="2.4" height="13" fill="#2d5fb5" stroke="#1b1b1b" stroke-width="0.4"/>
        <rect x="5.4" y="-100" width="3.2" height="40" rx="1.6" fill="#d9dbde" stroke="#1b1b1b" stroke-width="0.5"/>
        <rect x="6" y="-98" width="0.9" height="34" fill="#ffffff" opacity="0.8"/>
      </g>`;

    async function sign(face, box) {
      const fs = foldScale, w = box.w, h = box.h;
      // Drawn on an overlay exactly over the folded packet, then handed to the paper itself.
      const NS = 'http://www.w3.org/2000/svg';
      const over = document.createElementNS(NS, 'svg');
      over.setAttribute('class', 'sign-overlay');
      over.setAttribute('viewBox', `0 0 ${w} ${h}`);
      over.setAttribute('aria-hidden', 'true');
      Object.assign(over.style, { left: midX - (w * fs) / 2 + 'px', top: midY - (h * fs) / 2 + 'px', width: w * fs + 'px', height: h * fs + 'px' });
      const k = Math.min((w * 0.72) / 300, (h * 0.5) / 100); // the signature box, fitted to the packet
      const ox = (w - 300 * k) / 2, oy = h * 0.6 - 60 * k;
      over.innerHTML = `<g class="sign-ink">
          <line x1="${ox}" y1="${oy + 88 * k}" x2="${ox + 300 * k}" y2="${oy + 88 * k}" stroke="#1b1b1b" stroke-opacity="0.45" stroke-width="${0.9 / fs}" stroke-dasharray="${3 / fs} ${3 / fs}"/>
          <text x="${ox}" y="${oy + 88 * k + 13 / fs}" font-family="'Special Elite', monospace" font-size="${9 / fs}" fill="#55504a" letter-spacing="${1 / fs}">ENTRANT’S SIGNATURE</text>
          <g transform="translate(${ox} ${oy}) scale(${k})" fill="none" stroke="#1d3a8a" stroke-linecap="round" stroke-linejoin="round" stroke-width="${1.9 / (fs * k)}">
            <path class="sig" d="${SIGNATURE}"/><path class="sig-under" d="${UNDERLINE}"/>
          </g>
        </g>
        <g class="pen" opacity="0"><g transform="rotate(26) scale(${(h * 0.9) / 115})">${PEN}</g></g>`;
      room.appendChild(over);
      const [sig, under] = over.querySelectorAll('.sig, .sig-under');
      const pen = over.querySelector('.pen');
      const lens = [sig.getTotalLength(), under.getTotalLength()];
      [sig, under].forEach((path, i) => { path.style.strokeDasharray = lens[i]; path.style.strokeDashoffset = lens[i]; });
      const at = (path, len) => { const pt = path.getPointAtLength(len); return { x: ox + pt.x * k, y: oy + pt.y * k }; };
      const place = ({ x, y }) => pen.setAttribute('transform', `translate(${x} ${y})`);
      const handOver = () => {
        // The ink now belongs to the paper, so it travels into the envelope with it.
        const ink = document.createElementNS(NS, 'svg');
        ink.setAttribute('class', 'sign-ink-on-paper');
        ink.setAttribute('viewBox', `0 0 ${w} ${h}`);
        ink.appendChild(over.querySelector('.sign-ink'));
        face.appendChild(ink);
        over.remove();
      };
      if (!G || skipped) {
        [sig, under].forEach(path => { path.style.strokeDashoffset = 0; });
        handOver();
        return finished;
      }
      // The pen comes in from the lower right, clicks, signs in one go, underlines, and lifts away.
      const start = at(sig, 0);
      const from = { x: start.x + w * 0.5, y: start.y + h * 0.5 };
      const pos = { ...from };
      place(pos);
      await G.to(pos, { x: start.x, y: start.y, duration: 0.2, ease: 'power2.out', onStart: () => pen.setAttribute('opacity', '1'), onUpdate: () => place(pos) }).then(() => {});
      if (finished) return true;
      blip(2600, 0.015, 'square', 0.03);
      timers.push(setTimeout(() => blip(2100, 0.015, 'square', 0.03), 60));
      const write = (path, len, duration, ease) => {
        const prog = { t: 0 };
        for (let i = 0; i < Math.round(duration / 0.07) && !skipped; i++) timers.push(setTimeout(() => paperSound(0.05, 0.05), i * 70));
        return G.to(prog, {
          t: 1, duration, ease,
          onUpdate: () => { path.style.strokeDashoffset = len * (1 - prog.t); place(at(path, len * prog.t)); },
        }).then(() => {});
      };
      await write(sig, lens[0], 0.72, 'power1.inOut');
      if (finished) return true;
      const end = at(sig, lens[0]), u0 = at(under, 0);
      Object.assign(pos, end);
      await G.to(pos, { x: u0.x, y: u0.y, duration: 0.1, ease: 'power1.inOut', onUpdate: () => place(pos) }).then(() => {});
      if (finished) return true;
      await write(under, lens[1], 0.2, 'power2.in');
      if (finished) return true;
      const last = at(under, lens[1]);
      Object.assign(pos, last);
      await G.to(pos, { x: last.x + w * 0.4, y: last.y - h * 0.7, duration: 0.22, ease: 'power2.in', onUpdate: () => place(pos) }).then(() => {});
      if (finished) return true;
      handOver();
      await pause(80);
      return finished;
    }

    /* ---- The sequence ---- */

    async function play() {
      // Cut along the dashed line. The blades snip while a slit opens behind them.
      say('Cut out your entry');
      const cut = make('div', 'cut-path', slot, `
        <svg class="cut-slit" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path pathLength="100" d="M0 0H${W}V${H}H0Z"/></svg>
        <svg class="cut-blades" viewBox="-30 -18 60 36" aria-hidden="true">
          <g class="blade one"><path d="M-2 1 28 -1.5 -2 -3z" fill="#2a2a2a"/><circle cx="-16" cy="7" r="6.2" fill="none" stroke="#1b1b1b" stroke-width="3"/><path d="M-11 4 0 -1" stroke="#1b1b1b" stroke-width="3"/></g>
          <g class="blade two"><path d="M-2 -1 28 1.5 -2 3z" fill="#444"/><circle cx="-16" cy="-7" r="6.2" fill="none" stroke="#1b1b1b" stroke-width="3"/><path d="M-11 -4 0 1" stroke="#1b1b1b" stroke-width="3"/></g>
          <circle r="1.7" fill="#c9c2ae"/>
        </svg>`);
      const blades = cut.querySelector('.cut-blades');
      blades.style.offsetPath = `path("M0 0H${W}V${H}H0Z")`;
      const SNIP = 1100;
      for (let i = 0; i < 7 && !skipped; i++) timers.push(setTimeout(() => paperSound(0.05, 0.16), i * (SNIP / 7)));
      animate(cut.querySelector('.cut-slit path'), [{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], SNIP, { easing: 'linear' });
      await animate(blades, [{ offsetDistance: '0%' }, { offsetDistance: '100%' }], SNIP, { easing: 'linear' });
      if (finished) return;
      cut.remove();

      // Lift it out of the page, leaving the hole, and bring it down onto the desk under the lamp.
      const rect = coupon.getBoundingClientRect();
      const at = `translate(${rect.left}px, ${rect.top}px) scale(1)`;
      root.style.transform = at;
      root.style.visibility = 'visible';
      shadow.style.opacity = 0;
      Object.assign(shadow.style, shadowFor({ w: W, h: H }, 1, rect.left + W / 2, rect.top + H / 2));
      slot.classList.add('is-cut');
      paperSound(0.2, 0.18);
      animate(desk, [{ opacity: 0 }, { opacity: 1 }], 600, { delay: 160, easing: 'ease-in-out' });
      const spot = poseFor(boxes[0], foldScale, midX, midY);
      animate(shadow, [{ opacity: 0, ...shadowFor(boxes[0], 1, rect.left + W / 2, rect.top + H / 2) }, { opacity: 1, ...shadowFor(boxes[0], foldScale, midX, midY) }], 720);
      await animate(root, [
        { transform: at },
        { transform: `translate(${rect.left - 6}px, ${rect.top - 14}px) rotate(-1.2deg) scale(1.015)`, offset: 0.25 },
        { transform: spot },
      ], 720);
      if (finished) return;
      await pause(40);

      // Fold it, with the printed side inward, until only the blank reverse shows.
      say('Fold it');
      for (let i = 0; i < folds.length; i++) {
        if (await foldOnce(folds[i], boxes[i], boxes[i + 1])) return;
      }

      // Signed with a four-colour clicky pen, straight onto the blank side.
      say('Sign it');
      if (await sign(topFace, packet)) return;

      // An envelope slides in with its flap open; the folded paper goes into the pocket.
      say('Seal the envelope');
      const outgoing = envelope(`<span class="env-lines">THE PSYCHIC PLANE<br>CONTEST DESK, THE BIG TOP<br>P.O. BOX 8</span>${STAMP}`);
      const flapOpen = 'translateZ(-2px) rotateX(180deg)', flapShut = 'translateZ(10px) rotateX(0deg)';
      outgoing.flap.style.transform = flapOpen;
      shadow.style.transition = 'none';
      const hold = midY - envH * 0.82, inside = midY + envH * 0.04;
      animate(shadow, [{ opacity: 1 }, { opacity: 0 }], 300);
      animate(root, [
        { transform: poseFor(packet, foldScale, midX, midY) },
        { transform: poseFor(packet, packetScale, midX, hold, 'translateZ(2px)') },
      ], 480);
      set(outgoing.env, { y: innerHeight * 0.75, rotation: -5 });
      await tween(outgoing.env, { y: 0, rotation: 0, duration: 0.55, ease: 'back.out(1.1)' });
      if (finished) return;
      paperSound(0.14, 0.2);
      await animate(root, [
        { transform: poseFor(packet, packetScale, midX, hold, 'translateZ(2px)') },
        { transform: poseFor(packet, packetScale, midX, inside, 'translateZ(2px)') },
      ], 420);
      if (finished) return;
      await pause(40);
      paperSound(0.18, 0.2);
      await animate(outgoing.flap, [
        { transform: flapOpen },
        { transform: 'translateZ(26px) rotateX(90deg)', offset: 0.5 },
        { transform: flapShut },
      ], 420);
      if (finished) return;
      root.remove();
      // A wax seal in the Big Top's red.
      set(outgoing.seal, { z: 11, opacity: 0, scale: 2.3, rotation: -14 });
      await tween(outgoing.seal, { opacity: 1, scale: 1, rotation: 0, duration: 0.26, ease: 'power3.in' });
      if (finished) return;
      thud();
      tween(outgoing.seal, { keyframes: [{ scaleX: 1.16, scaleY: 0.84, duration: 0.07, ease: 'power1.out' }, { scaleX: 1, scaleY: 1, duration: 0.55, ease: 'elastic.out(1, 0.4)' }] });
      await pause(180);

      // Turn it over to the address side, then stamp it.
      say('Stamp it');
      paperSound(0.16, 0.14);
      await animate(outgoing.env, [
        { transform: 'rotateY(0deg)' },
        { transform: 'translateZ(60px) rotateY(90deg)', offset: 0.5 },
        { transform: 'rotateY(180deg)' },
      ], 520);
      if (finished) return;
      const box = mailbox();
      const offstage = innerWidth - boxX + 30;
      set(box, { x: offstage, transformOrigin: '50% 100%' });
      const stamp = outgoing.addressSide.querySelector('.env-stamp');
      set(stamp, { opacity: 0, scale: 2.2, rotation: -9 });
      await tween(stamp, { opacity: 1, scale: 1, rotation: 2, duration: 0.24, ease: 'power4.in' });
      if (finished) return;
      thud();
      tween(stamp, { keyframes: [{ scale: 0.93, duration: 0.05 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' }] });
      const boxIn = tween(box, { x: 0, duration: 0.75, ease: 'back.out(1.2)' });
      const mark = make('span', 'env-postmark', outgoing.addressSide, 'THE BIG TOP<br>CONTEST');
      set(mark, { opacity: 0, scale: 1.5, rotation: -14, filter: 'blur(2px)' });
      await tween(mark, { opacity: 0.8, scale: 1, filter: 'blur(0px)', duration: 0.18, ease: 'power3.in' });
      if (finished) return;
      thud();
      await pause(120);

      // Post it: flat in the hand, over to the slot, tipped into it, and down inside.
      say('Post it');
      const flat = outgoing.addressSide.cloneNode(true);
      flat.classList.add('env-flat');
      place(flat, midX - envW / 2, midY - envH / 2, envW, envH);
      room.appendChild(flat);
      outgoing.env.remove();
      await boxIn;
      if (finished) return;
      const slotW = (106 / 170) * boxW, slotX = boxX + (85 / 170) * boxW, slotY = boxY + (90 / 300) * boxH;
      const k = (slotW * 0.92) / envW;
      const flap = box.querySelector('.mb-flap');
      const overX = slotX - midX, overY = slotY - midY - (envH * k) / 2;
      set(flat, { x: 0, y: 0, scale: 1, rotation: 0, rotationX: 0, clipPath: 'inset(0% 0% 0% 0%)' });
      // It rises in an arc, sways a little in the hand, and tips forward as it lines up with the slot.
      tween(flat, { keyframes: [{ rotation: 4, duration: 0.4, ease: 'sine.out' }, { rotation: 0, duration: 0.42, ease: 'sine.inOut' }] });
      await tween(flat, {
        motionPath: { path: [{ x: overX * 0.45, y: Math.min(overY, 0) - 70 }, { x: overX, y: overY }], curviness: 1.3 },
        scale: k, rotationX: 28, duration: 0.7, ease: 'power2.inOut',
      });
      if (finished) return;
      // The flap swings in, the envelope slides down through it, and the flap claps shut behind it.
      await tween(flap, { scaleY: 0.12, transformOrigin: '50% 0%', duration: 0.14, ease: 'power2.out' });
      if (finished) return;
      paperSound(0.2, 0.2);
      await tween(flat, { y: overY + envH * k, clipPath: 'inset(0% 0% 100% 0%)', duration: 0.42, ease: 'power2.in' });
      if (finished) return;
      flat.remove();
      thud();
      tween(flap, { scaleY: 1, duration: 0.6, ease: 'elastic.out(1.1, 0.35)' });
      // The box rocks on its legs, and the pennant on top flutters.
      tween(box.querySelector('.mb-pennant'), { skewY: -14, scaleX: 0.86, transformOrigin: '0% 50%', duration: 0.16, yoyo: true, repeat: 5, ease: 'sine.inOut' });
      await tween(box, { keyframes: [{ rotation: 1.8, duration: 0.08, ease: 'power1.out' }, { rotation: 0, duration: 0.7, ease: 'elastic.out(1, 0.3)' }] });
      if (finished) return;
      await tween(box, { x: offstage, duration: 0.42, ease: 'power2.in' });
      if (finished) return;
      box.remove();

      // The wait: the whole point of the game.
      say('');
      const card = make('p', 'day-card', stage);
      card.style.top = midY - 40 + 'px';
      for (const day of ['Day one.', 'Day two.', 'Day three.', 'The mail truck turns the corner.']) {
        card.textContent = day;
        await animate(card, [
          { transform: 'translateX(-50%) rotateX(-90deg)', opacity: 0 },
          { transform: 'translateX(-50%) rotateX(0deg)', opacity: 1, offset: 0.3 },
          { transform: 'translateX(-50%) rotateX(0deg)', opacity: 1, offset: 0.8 },
          { transform: 'translateX(-50%) rotateX(90deg)', opacity: 0 },
        ], 420, { easing: 'linear' });
        if (finished) return;
      }
      card.remove();

      // The reply lands address up, turns over, breaks its seal and opens.
      say('Your reply arrives');
      const reply = envelope(`<span class="env-lines">TO: YOU<br>YOUR STREET<br>YOUR TOWN</span>${STAMP}<span class="env-postmark" style="opacity:.8;transform:rotate(-14deg)">THE BIG TOP<br>CONTEST</span>`);
      const letterSheet = make('div', 'env-letter', reply.env, '<b>The Psychic Plane</b><i></i><i></i><i></i><i></i>');
      place(letterSheet, envW * 0.07, envH * 0.1, envW * 0.86, envH * 0.84);
      reply.flap.style.transform = flapShut;
      reply.seal.style.opacity = 1;
      reply.seal.style.transform = 'translateZ(11px)';
      paperSound(0.3, 0.26);
      set(reply.env, { x: -innerWidth * 0.8, y: -envH * 0.7, rotation: -16, rotationY: 180 });
      await tween(reply.env, {
        motionPath: { path: [{ x: -innerWidth * 0.32, y: -envH * 1.05 }, { x: 0, y: 0 }], curviness: 1.1 },
        rotation: 0, duration: 0.7, ease: 'power3.out',
      });
      if (finished) return;
      thud();
      await pause(240);
      say('Open it');
      paperSound(0.16, 0.14);
      await animate(reply.env, [
        { transform: 'rotateY(180deg)' },
        { transform: 'translateZ(60px) rotateY(90deg)', offset: 0.5 },
        { transform: 'rotateY(0deg)' },
      ], 500);
      if (finished) return;
      paperSound(0.08, 0.2);
      animate(reply.seal, [{ opacity: 1, transform: 'translateZ(40px)' }, { opacity: 0, transform: `translate(${envW * 0.1}px, ${envH * 0.7}px) translateZ(40px) rotate(70deg)` }], 340, { easing: 'ease-in' });
      await animate(reply.flap, [
        { transform: flapShut },
        { transform: 'translateZ(26px) rotateX(90deg)', offset: 0.5 },
        { transform: flapOpen },
      ], 520);
      if (finished) return;
      paperSound(0.22, 0.2);
      await animate(letterSheet, [
        { transform: 'translateZ(3px) translateY(0)' },
        { transform: `translateZ(3px) translateY(${-envH * 0.86}px)` },
      ], 450);
      if (finished) return;
      await pause(120);
      finish();
    }
    play();
  }

  window.PPMail = { runMailroom, paperSound, thud, thumb };
})();
