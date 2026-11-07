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
    const mark = m ? `<path d="M${m.x - 11} ${m.y - 11}L${m.x + 11} ${m.y + 11}M${m.x + 11} ${m.y - 11}L${m.x - 11} ${m.y + 11}"/>` : '';
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

    function finish() {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
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
      return { el: p, shades: [frontShade, backShade] };
    }

    // Wide forms fold in half twice. Tall forms get the classic letter fold in three.
    let folds, boxes;
    const turn = (axis, sign, z) => [
      { transform: `translateZ(0px) rotate${axis}(0deg)` },
      { transform: `translateZ(${z + 16}px) rotate${axis}(${sign * 90}deg)`, offset: 0.5 },
      { transform: `translateZ(${z}px) rotate${axis}(${sign * 183}deg)`, offset: 0.88 },
      { transform: `translateZ(${z}px) rotate${axis}(${sign * 180}deg)` },
    ];
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
        { moving: [[tr.el, turn('Y', -1, 1)], [br.el, turn('Y', -1, 1)]], shades: [...tr.shades, ...br.shades], cast: [tl.shades[0], bl.shades[0]] },
        { moving: [[hinge, turn('X', 1, 3)]], shades: bl.shades, cast: [tr.shades[1]] },
      ];
      boxes = [{ x: 0, y: 0, w: W, h: H }, { x: 0, y: 0, w: qw, h: H }, { x: 0, y: 0, w: qw, h: qh }];
    } else {
      const third = H / 3;
      const top = panel(root, 0, 0, W, third, 0, 0, 'x', '50% 100%');
      const mid = panel(root, 0, third, W, third, 0, third, 'x');
      const bot = panel(root, 0, third * 2, W, third, 0, third * 2, 'x', '50% 0');
      folds = [
        { moving: [[bot.el, turn('X', 1, 1)]], shades: bot.shades, cast: [mid.shades[0]] },
        { moving: [[top.el, turn('X', -1, 3)]], shades: top.shades, cast: [bot.shades[1]] },
      ];
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
        <path d="M85 4v22" stroke="#1b1b1b" stroke-width="3"/><path d="M85 5l26 8-26 8z" fill="#b3261e" stroke="#1b1b1b" stroke-width="1.4"/>
        ${stripes}
        <path d="M17 58C20 36 56 24 85 24s65 12 68 34z" fill="#b3261e" stroke="#1b1b1b" stroke-width="2"/>
        <path d="M58 58C60 42 72 28 85 24c13 4 25 18 27 34z" fill="#e9e0c8" stroke="#1b1b1b" stroke-width="1.4"/>
        ${scallops}
        <rect x="17" y="58" width="136" height="190" fill="none" stroke="#1b1b1b" stroke-width="2.4"/>
        <rect x="32" y="84" width="106" height="13" rx="2" fill="#17110b" stroke="#e9e0c8" stroke-width="2"/>
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

    /* ---- The sequence ---- */

    async function play() {
      // Cut along the dashed line. The blades snip while a slit opens behind them.
      caption.textContent = 'Cut out your entry';
      const cut = make('div', 'cut-path', slot, `
        <svg class="cut-slit" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path pathLength="100" d="M0 0H${W}V${H}H0Z"/></svg>
        <svg class="cut-blades" viewBox="-30 -18 60 36" aria-hidden="true">
          <g class="blade one"><path d="M-2 1 28 -1.5 -2 -3z" fill="#2a2a2a"/><circle cx="-16" cy="7" r="6.2" fill="none" stroke="#1b1b1b" stroke-width="3"/><path d="M-11 4 0 -1" stroke="#1b1b1b" stroke-width="3"/></g>
          <g class="blade two"><path d="M-2 -1 28 1.5 -2 3z" fill="#444"/><circle cx="-16" cy="-7" r="6.2" fill="none" stroke="#1b1b1b" stroke-width="3"/><path d="M-11 -4 0 1" stroke="#1b1b1b" stroke-width="3"/></g>
          <circle r="1.7" fill="#c9c2ae"/>
        </svg>`);
      const blades = cut.querySelector('.cut-blades');
      blades.style.offsetPath = `path("M0 0H${W}V${H}H0Z")`;
      const SNIP = 1500;
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
      animate(desk, [{ opacity: 0 }, { opacity: 1 }], 800, { delay: 260, easing: 'ease-in-out' });
      const spot = poseFor(boxes[0], foldScale, midX, midY);
      animate(shadow, [{ opacity: 0, ...shadowFor(boxes[0], 1, rect.left + W / 2, rect.top + H / 2) }, { opacity: 1, ...shadowFor(boxes[0], foldScale, midX, midY) }], 1000);
      await animate(root, [
        { transform: at },
        { transform: `translate(${rect.left - 6}px, ${rect.top - 14}px) rotate(-1.2deg) scale(1.015)`, offset: 0.22 },
        { transform: spot },
      ], 1000);
      if (finished) return;
      await pause(120);

      // Fold it, with the printed side inward, until only the blank reverse shows.
      caption.textContent = 'Fold it';
      for (let i = 0; i < folds.length; i++) {
        const fold = folds[i], next = boxes[i + 1], prev = boxes[i];
        paperSound(0.32, 0.22);
        fold.moving.forEach(([el, frames]) => animate(el, frames, 760));
        fold.shades.forEach(s => animate(s, [{ opacity: 0 }, { opacity: 0.42, offset: 0.46 }, { opacity: 0.2, offset: 0.54 }, { opacity: 0 }], 760, { easing: 'linear' }));
        fold.cast.forEach(s => animate(s, [{ opacity: 0 }, { opacity: 0.3, offset: 0.7 }, { opacity: 0 }], 760, { easing: 'linear' }));
        animate(shadow, [shadowFor(prev, foldScale, midX, midY), shadowFor(next, foldScale, midX, midY)], 760);
        await animate(root, [{ transform: poseFor(prev, foldScale, midX, midY) }, { transform: poseFor(next, foldScale, midX, midY) }], 760);
        if (finished) return;
        await pause(110);
      }

      // An envelope slides in with its flap open; the folded paper goes into the pocket.
      caption.textContent = 'Seal the envelope';
      const outgoing = envelope(`<span class="env-lines">THE PSYCHIC PLANE<br>CONTEST DESK, THE BIG TOP<br>P.O. BOX 8</span>${STAMP}`);
      const flapOpen = 'translateZ(-2px) rotateX(180deg)', flapShut = 'translateZ(10px) rotateX(0deg)';
      outgoing.flap.style.transform = flapOpen;
      shadow.style.transition = 'none';
      const hold = midY - envH * 0.82, inside = midY + envH * 0.04;
      animate(shadow, [{ opacity: 1 }, { opacity: 0 }], 300);
      animate(root, [
        { transform: poseFor(packet, foldScale, midX, midY) },
        { transform: poseFor(packet, packetScale, midX, hold, 'translateZ(2px)') },
      ], 620);
      await animate(outgoing.env, [
        { transform: `translateY(${innerHeight * 0.75}px) rotate(-5deg)` },
        { transform: 'translateY(0) rotate(0)' },
      ], 720, { easing: SETTLE });
      if (finished) return;
      paperSound(0.14, 0.2);
      await animate(root, [
        { transform: poseFor(packet, packetScale, midX, hold, 'translateZ(2px)') },
        { transform: poseFor(packet, packetScale, midX, inside, 'translateZ(2px)') },
      ], 560);
      if (finished) return;
      await pause(70);
      paperSound(0.18, 0.2);
      await animate(outgoing.flap, [
        { transform: flapOpen },
        { transform: 'translateZ(26px) rotateX(90deg)', offset: 0.5 },
        { transform: flapShut },
      ], 560);
      if (finished) return;
      root.remove();
      // A wax seal in the Big Top's red.
      await animate(outgoing.seal, [{ opacity: 0, transform: 'translateZ(11px) scale(2.3) rotate(-14deg)' }, { opacity: 1, transform: 'translateZ(11px) scale(1)' }], 240, { easing: 'ease-in' });
      if (finished) return;
      thud();
      await pause(190);

      // Turn it over to the address side, then stamp it.
      caption.textContent = 'Stamp it';
      paperSound(0.16, 0.14);
      await animate(outgoing.env, [
        { transform: 'rotateY(0deg)' },
        { transform: 'translateZ(60px) rotateY(90deg)', offset: 0.5 },
        { transform: 'rotateY(180deg)' },
      ], 660);
      if (finished) return;
      const stamp = outgoing.addressSide.querySelector('.env-stamp');
      await animate(stamp, [{ opacity: 0, transform: 'scale(2.2) rotate(-9deg)' }, { opacity: 1, transform: 'rotate(2deg)' }], 230, { easing: 'ease-in' });
      if (finished) return;
      thud();
      const mark = make('span', 'env-postmark', outgoing.addressSide, 'THE BIG TOP<br>CONTEST');
      await animate(mark, [{ opacity: 0, transform: 'scale(1.5) rotate(-14deg)' }, { opacity: 0.8, transform: 'rotate(-14deg)' }], 150, { easing: 'ease-in' });
      if (finished) return;
      thud();
      await pause(220);

      // Post it: flat in the hand, over to the slot, and down inside.
      caption.textContent = 'Post it';
      const flat = outgoing.addressSide.cloneNode(true);
      flat.classList.add('env-flat');
      place(flat, midX - envW / 2, midY - envH / 2, envW, envH);
      room.appendChild(flat);
      outgoing.env.remove();
      const box = mailbox();
      const offstage = `translateX(${innerWidth - boxX + 30}px)`;
      await animate(box, [{ transform: offstage }, { transform: 'none' }], 520, { easing: SETTLE });
      if (finished) return;
      const slotW = (106 / 170) * boxW, slotX = boxX + (85 / 170) * boxW, slotY = boxY + (90 / 300) * boxH;
      const k = (slotW * 0.92) / envW;
      const overSlot = `translate(${slotX - midX}px, ${slotY - midY - (envH * k) / 2}px) scale(${k})`;
      await animate(flat, [{ transform: 'none' }, { transform: `translate(${(slotX - midX) * 0.6}px, ${(slotY - midY) * 0.3 - 30}px) rotate(3deg) scale(${(1 + k) / 2})`, offset: 0.55 }, { transform: overSlot }], 680);
      if (finished) return;
      paperSound(0.2, 0.2);
      await animate(flat, [
        { transform: overSlot, clipPath: 'inset(0 0 0 0)' },
        { transform: `translate(${slotX - midX}px, ${slotY - midY + (envH * k) / 2}px) scale(${k})`, clipPath: 'inset(0 0 100% 0)' },
      ], 430, { easing: 'ease-in' });
      if (finished) return;
      flat.remove();
      thud();
      await animate(box, [{ transform: 'rotate(0)' }, { transform: 'rotate(1.4deg)', offset: 0.3 }, { transform: 'rotate(-0.9deg)', offset: 0.65 }, { transform: 'rotate(0)' }], 300, { easing: 'ease-out' });
      if (finished) return;
      await animate(box, [{ transform: 'none' }, { transform: offstage }], 400, { easing: 'ease-in' });
      if (finished) return;
      box.remove();

      // The wait: the whole point of the game.
      caption.textContent = '';
      const card = make('p', 'day-card', stage);
      card.style.top = midY - 40 + 'px';
      for (const day of ['Day one.', 'Day two.', 'Day three.', 'The mail truck turns the corner.']) {
        card.textContent = day;
        await animate(card, [
          { transform: 'translateX(-50%) rotateX(-90deg)', opacity: 0 },
          { transform: 'translateX(-50%) rotateX(0deg)', opacity: 1, offset: 0.3 },
          { transform: 'translateX(-50%) rotateX(0deg)', opacity: 1, offset: 0.8 },
          { transform: 'translateX(-50%) rotateX(90deg)', opacity: 0 },
        ], 520, { easing: 'linear' });
        if (finished) return;
      }
      card.remove();

      // The reply lands address up, turns over, breaks its seal and opens.
      caption.textContent = 'Your reply arrives';
      const reply = envelope(`<span class="env-lines">TO: YOU<br>YOUR STREET<br>YOUR TOWN</span>${STAMP}<span class="env-postmark" style="opacity:.8;transform:rotate(-14deg)">THE BIG TOP<br>CONTEST</span>`);
      const letterSheet = make('div', 'env-letter', reply.env, '<b>The Psychic Plane</b><i></i><i></i><i></i><i></i>');
      place(letterSheet, envW * 0.07, envH * 0.1, envW * 0.86, envH * 0.84);
      reply.flap.style.transform = flapShut;
      reply.seal.style.opacity = 1;
      reply.seal.style.transform = 'translateZ(11px)';
      paperSound(0.3, 0.26);
      await animate(reply.env, [
        { transform: `translate(${-innerWidth * 0.8}px, ${-envH * 0.7}px) rotateZ(-16deg) rotateY(180deg)` },
        { transform: 'translate(0, 0) rotateZ(0deg) rotateY(180deg)' },
      ], 700, { easing: SETTLE });
      if (finished) return;
      thud();
      await pause(420);
      caption.textContent = 'Open it';
      paperSound(0.16, 0.14);
      await animate(reply.env, [
        { transform: 'rotateY(180deg)' },
        { transform: 'translateZ(60px) rotateY(90deg)', offset: 0.5 },
        { transform: 'rotateY(0deg)' },
      ], 600);
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
      ], 560);
      if (finished) return;
      await pause(120);
      finish();
    }
    play();
  }

  window.PPMail = { runMailroom, paperSound, thud, thumb };
})();
