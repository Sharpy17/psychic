// Showbill page behaviour (loaded before page.js, which merges window.LANDING_TEXT into its settings).
(() => {
  // The sound toggle reads as type, not an emoji.
  const SOUND = ['Sound: on', 'Sound: off'];
  window.LANDING_TEXT = Object.assign(window.LANDING_TEXT || {}, { soundLabels: SOUND });

  const $ = id => document.getElementById(id);

  // Sticky tickets: the tickets scroll with the page until they touch the top of the screen, then
  // stay there (the same elements, from the same spot, so nothing jumps) and ease into a compact size.
  // The slot keeps their place in the page. At the closing call they slide up out of the way.
  function dock() {
    const slot = $('tickets-slot'), row = $('tickets');
    if (!slot || !row) return;
    const root = document.documentElement;
    const extra = document.querySelector('.extra');
    const GAP = 10;
    let on = false, away = false, queued = false;
    // Stick from exactly where the tickets are; on a phone, then widen to the screen so the two
    // compact tickets fit side by side (left and width ease, so this reads as one movement).
    const place = widen => {
      const r = slot.getBoundingClientRect();
      const narrow = innerWidth <= 680;
      row.style.left = (widen && narrow ? 8 : r.left) + 'px';
      row.style.width = (widen && narrow ? innerWidth - 16 : r.width) + 'px';
    };
    const update = () => {
      queued = false;
      if (root.classList.contains('intro-on')) return;
      const r = slot.getBoundingClientRect();
      const stick = r.top <= GAP;
      if (stick !== on) {
        on = stick;
        if (on) {
          slot.style.height = slot.offsetHeight + 'px';
          place(false);
          row.classList.add('docked');
          requestAnimationFrame(() => place(true));
        } else {
          row.classList.remove('docked');
          row.style.left = row.style.width = slot.style.height = '';
        }
        root.classList.toggle('tickets-docked', on);
      }
      const hide = on && !!extra && extra.getBoundingClientRect().top < innerHeight * 0.75;
      if (hide !== away) { away = hide; row.classList.toggle('away', away); }
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', () => { if (on) place(true); queue(); });
    document.addEventListener('intro:done', queue);
    update();
  }

  // Join stub: type (or paste) the 4-letter code onto the ticket; the 4th letter seats you.
  // Invite links like ?room=ABCD or #ABCD arrive with the code already written in.
  function stub() {
    const form = $('stub');
    if (!form) return;
    const boxes = [...form.querySelectorAll('input')];
    const note = $('stub-note');
    const defaultNote = note.textContent;
    const code = () => boxes.map(b => b.value).join('');
    const firstEmpty = () => boxes.find(b => !b.value) || boxes[3];
    const fill = (text, from) => {
      [...text].slice(0, 4 - from).forEach((ch, j) => { boxes[from + j].value = ch; });
      firstEmpty().focus();
    };
    let resetTimer;
    const submit = () => {
      const c = code();
      clearTimeout(resetTimer);
      if (c.length < 4) {
        form.classList.remove('bad'); void form.offsetWidth; form.classList.add('bad');
        note.textContent = 'Room codes are 4 letters';
        firstEmpty().focus();
        return;
      }
      note.textContent = `Seating you in room ${c}…`;
      if (typeof toast === 'function') toast(`Room ${c}: the lobby isn't built yet`);
      resetTimer = setTimeout(() => { note.textContent = defaultNote; }, 2600);
    };

    boxes.forEach((box, i) => {
      box.addEventListener('input', () => {
        const clean = box.value.replace(/[^a-z]/gi, '').toUpperCase();
        box.value = clean.slice(-1);
        form.classList.remove('bad', 'ready');
        note.textContent = defaultNote;
        if (clean && boxes[i + 1]) boxes[i + 1].focus();
        if (clean && i === 3 && code().length === 4) submit();
      });
      box.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !box.value && boxes[i - 1]) { e.preventDefault(); boxes[i - 1].value = ''; boxes[i - 1].focus(); }
        else if (e.key === 'ArrowLeft' && boxes[i - 1]) { e.preventDefault(); boxes[i - 1].focus(); }
        else if (e.key === 'ArrowRight' && boxes[i + 1]) { e.preventDefault(); boxes[i + 1].focus(); }
        else if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
      box.addEventListener('focus', () => box.select());
      box.addEventListener('paste', e => {
        e.preventDefault();
        const text = (e.clipboardData.getData('text') || '').replace(/[^a-z]/gi, '').toUpperCase();
        fill(text, text.length >= 4 ? 0 : i);
        if (code().length === 4) submit();
      });
    });
    form.addEventListener('submit', e => { e.preventDefault(); submit(); });
    // A click anywhere on the stub lands in the first empty slot.
    form.addEventListener('mousedown', e => {
      if (e.target.tagName === 'INPUT') return;
      e.preventDefault();
      firstEmpty().focus();
    });

    const invite = (new URLSearchParams(location.search).get('room') || location.hash.slice(1))
      .replace(/[^a-z]/gi, '').toUpperCase();
    if (invite.length === 4) {
      [...invite].forEach((ch, j) => { boxes[j].value = ch; });
      form.classList.add('ready');
      note.textContent = `You're invited · press Enter`;
    }
  }

  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

  // Lettering set on an arc: each letter is turned about a centre `radius` px below the line.
  function arc(el) {
    const text = el.textContent;
    el.setAttribute('aria-label', text);
    el.innerHTML = [...text].map(ch => `<span aria-hidden="true">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
    const spans = [...el.children];
    const layout = () => {
      el.classList.remove('bent');
      const widths = spans.map(s => s.getBoundingClientRect().width);
      const total = widths.reduce((a, b) => a + b, 0);
      const radius = Math.max(+el.dataset.arc * Math.min(1, el.clientWidth / 900), total / 2.4);
      let x = -total / 2;
      spans.forEach((s, i) => {
        s.style.transform = `translateX(-50%) rotate(${(x + widths[i] / 2) / radius}rad)`;
        s.style.height = radius + 'px';
        x += widths[i];
      });
      el.style.height = radius * (1 - Math.cos(total / 2 / radius)) + spans[0].offsetHeight * 1.1 + 'px';
      el.classList.add('bent');
    };
    layout();
    return layout;
  }

  // Marquee bulbs evenly spaced along the inner frame; --i drives the travelling wave of light.
  function bulbs() {
    const box = $('bulbs');
    if (!box) return () => {};
    const layout = () => {
      const w = box.clientWidth, h = box.clientHeight, inset = innerWidth < 680 ? 13 : 19;
      const iw = w - inset * 2, ih = h - inset * 2, per = 2 * (iw + ih);
      const n = Math.max(24, Math.round(per / 24));
      let html = '';
      for (let i = 0; i < n; i++) {
        let d = (i / n) * per, x, y;
        if (d < iw) { x = d; y = 0; }
        else if ((d -= iw) < ih) { x = iw; y = d; }
        else if ((d -= ih) < iw) { x = iw - d; y = ih; }
        else { d -= iw; x = 0; y = ih - d; }
        html += `<i class="bulb" style="left:${(x + inset).toFixed(1)}px;top:${(y + inset).toFixed(1)}px;--i:${i}"></i>`;
      }
      box.innerHTML = html;
    };
    layout();
    return layout;
  }

  // Spotlight: drifts in a slow figure-eight, and eases toward the pointer while it's over the bill.
  function spotlight() {
    const bill = $('playbill');
    if (!bill || still.matches) return;
    let tx = 0.5, ty = 0.42, x = 0.5, y = 0.42, over = false, visible = true;
    bill.addEventListener('pointermove', e => {
      const r = bill.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width; ty = (e.clientY - r.top) / r.height; over = true;
    });
    bill.addEventListener('pointerleave', () => { over = false; });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) requestAnimationFrame(frame); }).observe(bill);
    function frame(now) {
      if (!visible) return;
      if (!over) { const t = now / 1000; tx = 0.5 + Math.sin(t * 0.31) * 0.22; ty = 0.42 + Math.sin(t * 0.62) * 0.12; }
      x += (tx - x) * 0.06; y += (ty - y) * 0.06;
      bill.style.setProperty('--mx', (x * 100).toFixed(2) + '%');
      bill.style.setProperty('--my', (y * 100).toFixed(2) + '%');
      requestAnimationFrame(frame);
    }
  }

  // Tickets lean toward the pointer, and sink a little while pressed.
  function tilt() {
    document.querySelectorAll('.tk').forEach(tk => {
      if (finePointer.matches && !still.matches) {
        tk.addEventListener('pointermove', e => {
          const r = tk.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
          tk.style.setProperty('--ry', (px * 14).toFixed(2) + 'deg');
          tk.style.setProperty('--rx', (-py * 12).toFixed(2) + 'deg');
        });
        tk.addEventListener('pointerleave', () => { tk.style.removeProperty('--rx'); tk.style.removeProperty('--ry'); });
      }
      tk.addEventListener('pointerdown', () => tk.classList.add('pressing'));
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => tk.addEventListener(ev, () => tk.classList.remove('pressing')));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sound = document.querySelector('[data-action="sound"]');
    if (sound) sound.textContent = SOUND[sound.getAttribute('aria-pressed') === 'false' ? 1 : 0];
    dock();
    stub();
    tilt();
    spotlight();
    const relayBulbs = bulbs();
    (document.fonts?.ready || Promise.resolve()).then(() => {
      const relayArcs = [...document.querySelectorAll('[data-arc]')].map(arc);
      relayBulbs(); // the bill's height settles once the display fonts are in
      let t;
      addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(() => { relayArcs.forEach(f => f()); relayBulbs(); }, 120);
      });
    });
  });
})();
