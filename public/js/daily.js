// The Daily Poll: one item a day, guessed alone. The server holds the survey answer and sends it
// only after you've mailed your guess (see server/daily.js). This file draws the supplement
// (#daily-paper), unrolls it off a paper roll, and fills in the seal and the ad on the front page.
(() => {
  const PLAYER = 'pp-daily-player';
  const HISTORY = 'pp-daily-history';
  const SHARE_HASH = '#poll'; // The link in "Copy my result".
  const TIER_MARK = { Bullseye: '🎯', Close: '🟢', Warm: '🟡', Edge: '🟠', Miss: '⚪' };
  const PEOPLE = { US: 'Americans', GB: 'Britons', UK: 'Britons' };
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const byId = (id) => document.getElementById(id);
  const number = (n) => n.toLocaleString('en-US');

  // The server's chart runs -100 to +100 with y up; the board draws 0 to 100 with y down.
  const toBoard = (p) => ({ x: (p.x + 100) / 2, y: (100 - p.y) / 2 });
  const toChart = (p) => ({ x: p.x * 2 - 100, y: 100 - p.y * 2 });

  // Browser storage can be blocked or empty; the poll still works without it, minus the streak.
  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } },
  };

  function playerId() {
    let id = store.get(PLAYER);
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      const bytes = crypto.getRandomValues(new Uint8Array(12));
      id = 'p' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
      store.set(PLAYER, id);
    }
    return id;
  }

  const paper = byId('daily-paper');
  const scroller = byId('dp-scroll');
  const sheet = byId('dp-sheet');
  const card = byId('daily-card');
  const statusEl = byId('daily-status');
  const resultEl = byId('daily-result');
  const mailBtn = byId('daily-mail');
  const boardSlot = byId('daily-board');
  const adToday = byId('daily-ad-today');
  const adGo = document.querySelector('.daily-ad .ad-go');
  const sealCta = byId('daily-seal-cta');
  if (!paper || !card) return;

  let board = null, boardSvg = null, crowdDot = null, surveyDot = null;
  let puzzle = null, result = null, mailing = false;
  let nextAt = 0, clockTimer = null;

  const sound = (dur, vol) => window.PPMail?.paperSound?.(dur, vol);
  const people = (country) => PEOPLE[country] ?? 'people';
  const show = (id, on) => { byId(id).hidden = !on; };

  /* The chart ----------------------------------------------------------------------- */

  // Graph paper and newsprint dots instead of the circus sunburst, with the real percentage
  // scale on two edges and a caption in each corner.
  function pollArt(axes) {
    return (clipId) => {
      let grid = '';
      for (let i = 10; i < 100; i += 10) if (i !== 50) grid += `M${i} 0V100M0 ${i}H100`;
      const pct = (v) => `${Math.round(v)}%`;
      let ticks = '', labels = '';
      for (let k = 0; k <= 4; k++) { // Across: % who like it, left to right.
        const bx = k * 25;
        ticks += `M${bx} 100V102.2`;
        labels += `<text class="poll-tick" x="${bx}" y="106.4" text-anchor="middle">${pct(axes.x[0] + (k * (axes.x[1] - axes.x[0])) / 4)}</text>`;
      }
      for (let k = 0; k <= 5; k++) { // Up: % who dislike it, bottom to top.
        const by = 100 - k * 20;
        ticks += `M-2.2 ${by}H0`;
        labels += `<text class="poll-tick" x="-3.4" y="${by + 1.2}" text-anchor="end">${pct(axes.y[0] + (k * (axes.y[1] - axes.y[0])) / 5)}</text>`;
      }
      const corner = (x, y, anchor, text) => `<text class="poll-corner" x="${x}" y="${y}" text-anchor="${anchor}">${text}</text>`;
      return {
        viewBox: '-13 -3 120 113',
        back: `<defs><pattern id="${clipId}-dots" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle class="poll-dot" cx="1.2" cy="1.2" r="0.42"/></pattern></defs>
          <rect class="poll-paper" width="100" height="100"/>
          <rect width="100" height="100" fill="url(#${clipId}-dots)"/>
          <path class="poll-grid" d="${grid}"/><path class="poll-mid" d="M50 0V100M0 50H100"/>
          ${corner(3, 6, 'start', 'Disliked')}${corner(97, 6, 'end', 'Divisive')}${corner(3, 97, 'start', 'Shrugged off')}${corner(97, 97, 'end', 'Beloved')}
          <path class="poll-axis" d="M0 0V100H100"/><path class="poll-frame" d="M0 0H100V100"/><path class="poll-ticks" d="${ticks}"/>${labels}`,
      };
    };
  }

  function ensureBoard(axes) {
    if (board) return;
    let lastTick = { x: 50, y: 50 };
    board = createBoard(boardSlot, {
      art: pollArt(axes),
      onInput(p) {
        if (Math.hypot(p.x - lastTick.x, p.y - lastTick.y) >= 6) { lastTick = p; blip(900, 0.02, 'square', 0.02); }
      },
    });
    boardSvg = boardSlot.querySelector('svg');
    // The survey's answer (a red dot with a label) and the readers' average (an open ring), under your X.
    const group = (cls, html) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', cls);
      g.innerHTML = html;
      boardSvg.querySelector('.marker').before(g);
      return g;
    };
    surveyDot = group('survey-dot', '<circle class="survey-glow" r="6"/><circle class="survey-pip" r="2.4"/><text class="survey-label" y="-4.4" text-anchor="middle">Survey</text>');
    crowdDot = group('crowd-dot', '<circle class="crowd-ring" r="3.2"/><circle class="crowd-pip" r="0.9"/>');
  }

  /* Filling in the paper ---------------------------------------------------------------- */

  function drawPuzzle(p) {
    puzzle = p;
    ensureBoard(p.axes);
    byId('daily-no').textContent = `Vol. I · Poll No. ${number(p.day)}`;
    byId('dp-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    byId('daily-asked').textContent = `We asked ${people(p.source.country)} about:`;
    byId('daily-clue').textContent = p.text;
    byId('dp-ticker').textContent = `Today’s name: ${p.text}. The survey’s answer stays locked in the editor’s safe until you mail your guess.`;
    byId('daily-fine').textContent = `Survey: ${p.source.name}, ${people(p.source.country)}. One entry per reader per day. Void where prohibited by geese.`;
    for (const side of ['top', 'bottom', 'left', 'right']) byId('daily-' + side).textContent = p.board[side];
    boardSvg.setAttribute('aria-label', `Poll ${p.day}: ${p.text}. Top is ${p.board.top}, bottom is ${p.board.bottom}, left is ${p.board.left}, right is ${p.board.right}. Arrow keys move your X, Enter mails it.`);
    for (const id of ['daily-clue', 'daily-board-wrap', 'daily-hint', 'daily-foot']) show(id, true);
    show('daily-result', false);
    crowdDot.classList.remove('show');
    surveyDot.classList.remove('show');
    board.update({ marker: { x: 50, y: 50 }, target: null, interactive: true, revealed: false });
    card.setAttribute('aria-busy', 'false');
    if (adToday) adToday.textContent = `Today: ${p.text}`;
    if (adGo) adGo.firstChild.textContent = 'Read today’s poll ';
    if (sealCta) sealCta.textContent = 'Play today’s poll ›';
  }

  function streakOf(history, today) {
    let streak = 0;
    for (let d = today; history[d] != null; d--) streak++;
    return streak;
  }

  function recordHistory(r) {
    const history = store.get(HISTORY) ?? {};
    history[r.day] = r.you.points;
    for (const day of Object.keys(history)) if (Number(day) < r.day - 400) delete history[day];
    store.set(HISTORY, history);
    return streakOf(history, r.day);
  }

  function crowdLine(r) {
    if (r.crowd.count < 2) return 'You’re the first reader in today. Come back later to see where everyone else guessed.';
    const readers = `${number(r.crowd.count)} readers have guessed so far; the open ring is their average.`;
    if (r.beat === 0) return `${readers} Every one of them read the public better than you. Tomorrow, perhaps.`;
    if (r.beat === 100) return `${readers} You read the public better than <b>all of them</b>.`;
    return `${readers} You read the public better than <b>${r.beat}%</b> of them.`;
  }

  function shareText(r, streak) {
    return [
      `The Psychic Plane · Daily Poll #${r.day}`,
      `${r.text}: ${TIER_MARK[r.you.tier] ?? ''} ${r.you.tier} · ${number(r.you.points)} pts`,
      (r.beat != null ? `Better than ${r.beat}% of readers` : 'First reader of the day') + (streak > 1 ? ` · ${streak}-day streak` : ''),
      location.origin + location.pathname + SHARE_HASH,
    ].join('\n');
  }

  function drawResult(r, { fresh = false } = {}) {
    result = r;
    if (!puzzle) drawPuzzle(r);
    const streak = recordHistory(r);
    const s = r.survey;
    board.update({ marker: toBoard(r.you), target: toBoard(r.target), interactive: false, revealed: true });
    const crowd = toBoard(r.crowd);
    crowdDot.style.transform = `translate(${crowd.x}px, ${crowd.y}px)`;
    crowdDot.classList.toggle('show', r.crowd.count > 1);
    const answer = toBoard(r.target);
    surveyDot.style.transform = `translate(${answer.x}px, ${answer.y}px)`;
    surveyDot.querySelector('text').setAttribute('y', answer.y < 12 ? 8.6 : -4.4); // Under the dot at the top edge.
    surveyDot.classList.add('show');

    show('daily-hint', false);
    show('daily-foot', false);
    resultEl.innerHTML = `
      <div class="dp-verdict"><span class="dp-verdict-stamp tier-${esc(r.you.tier.toLowerCase())}">${esc(r.you.tier)}</span><span class="dp-points">${number(r.you.points)} points</span></div>
      <p class="dp-facts">The survey: <b>${s.liked}%</b> of ${esc(people(s.country))} like ${esc(r.text)}, and <b>${s.disliked}%</b> can’t stand it. ${s.neutral}% feel neutral; ${s.fame}% have heard of it.</p>
      <p class="dp-crowd">${crowdLine(r)}</p>
      <div class="demo-foot"><button class="btn primary" type="button" data-share>Copy my result</button></div>
      <div class="entry-row"><span class="entry-label">Streak: ${streak} ${streak === 1 ? 'day' : 'days'}</span><span class="entry-label" id="daily-next"></span></div>`;
    show('daily-result', true);
    byId('daily-fine').innerHTML = `Survey: <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>, ${esc(people(s.country))}, as published on ${esc(s.retrieved)}. One entry per reader per day.`;
    byId('dp-ticker').textContent = `${r.text}: ${s.liked}% like it, ${s.disliked}% can’t stand it. ${number(r.crowd.count)} ${r.crowd.count === 1 ? 'reader has' : 'readers have'} guessed today.`;
    resultEl.querySelector('[data-share]').addEventListener('click', () => copy(shareText(r, streak)));
    if (adToday) adToday.textContent = `Today: ${r.text} · you scored ${r.you.tier}`;
    if (adGo) adGo.firstChild.textContent = 'Read your reply ';
    if (sealCta) sealCta.textContent = 'See your reply ›';
    tickClock();
    statusEl.textContent = `${r.you.tier}, ${r.you.points} points. The survey found ${s.liked}% like ${r.text} and ${s.disliked}% dislike it. ${r.crowd.count > 1 ? `You beat ${r.beat}% of today’s readers.` : 'You are the first reader today.'}`;
    if (fresh) {
      sound(0.08, 0.3);
      blip(r.you.points >= 750 ? 880 : r.you.points ? 660 : 330, 0.12, 'triangle', 0.06);
      if (!still.matches) resultEl.querySelector('.dp-verdict-stamp').classList.add('thump');
    }
  }

  function drawError(message, retry) {
    card.setAttribute('aria-busy', 'false');
    byId('daily-asked').textContent = message;
    if (retry && !byId('daily-retry')) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.type = 'button';
      btn.id = 'daily-retry';
      btn.textContent = 'Try again';
      btn.addEventListener('click', () => { btn.remove(); load(); });
      byId('daily-asked').after(btn);
    }
  }

  function tickClock() {
    clearTimeout(clockTimer);
    const left = nextAt - Date.now();
    if (left <= 0) { load(); return; } // Midnight: a new poll is out.
    const el = byId('daily-next');
    if (el) {
      const h = Math.floor(left / 3_600_000), m = Math.ceil((left % 3_600_000) / 60_000);
      el.textContent = `Next poll in ${h ? `${h} h ` : ''}${m} min`;
    }
    clockTimer = setTimeout(tickClock, Math.min(left, 30_000));
  }

  /* Talking to the server ---------------------------------------------------------------- */

  async function api(path, options) {
    const res = await fetch(path, options);
    const body = await res.json().catch(() => ({ ok: false, error: 'The paper’s server sent something odd. Try again.' }));
    if (!body.ok) throw Object.assign(new Error(body.error || 'Something went wrong.'), { shown: true });
    if (typeof body.nextInMs === 'number') nextAt = Date.now() + body.nextInMs;
    return body;
  }

  async function load() {
    if (location.protocol === 'file:') {
      drawError('The Daily Poll comes from the game server. Start it with npm start and open the page from there.', false);
      return;
    }
    try {
      const body = await api(`api/daily?player=${encodeURIComponent(playerId())}`);
      puzzle = null;
      result = null;
      drawPuzzle(body.puzzle);
      if (body.result) drawResult(body.result);
      else tickClock();
    } catch (error) {
      drawError(error.shown ? error.message : 'The Daily Poll couldn’t reach the paper’s server.', true);
    }
  }

  async function mail() {
    if (mailing || result || !board) return;
    mailing = true;
    mailBtn.disabled = true;
    const guess = toChart(board.position());
    board.update({ marker: board.position(), target: null, interactive: false, revealed: false });
    sound(0.16, 0.18);
    try {
      const body = await api('api/daily/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: playerId(), x: guess.x, y: guess.y }),
      });
      drawResult(body.result, { fresh: true });
    } catch (error) {
      toast(error.shown ? error.message : 'Your guess didn’t reach the paper. Try again.');
      board.update({ marker: board.position(), target: null, interactive: true, revealed: false });
      if (/already/.test(error.message)) load(); // Played in another tab: show that result.
    } finally {
      mailing = false;
      mailBtn.disabled = false;
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied. Paste it to your friends.');
    } catch {
      // No clipboard (an old browser, or not allowed): show the text so it can be copied by hand.
      const box = document.createElement('textarea');
      box.className = 'daily-copy';
      box.readOnly = true;
      box.rows = 4;
      box.value = text;
      box.setAttribute('aria-label', 'Your result, to copy');
      resultEl.querySelector('.daily-copy')?.remove();
      resultEl.querySelector('.demo-foot').after(box);
      box.select();
    }
  }

  /* The paper roll -------------------------------------------------------------------------
     The sheet is clipped to the part already off the roll; the roll sits on that edge. Its
     diameter follows the paper left on it (a roll's cross-section is proportional to its
     length), and its printed back moves with the distance travelled, so it turns.
     The motion is sampled into dense keyframes and handed to the browser (Web Animations), so
     clip, transform and opacity run on the compositor instead of being set every frame. */

  const roll = paper.querySelector('.dp-roll');
  const curl = paper.querySelector('.dp-curl');
  let running = []; // The Web Animations in flight.

  const easeInOut = (t) => (1 - Math.cos(Math.PI * t)) / 2; // Sine: no sudden start or stop.
  const easeIn = (t) => t * t;
  // A fall that lands with one small bounce.
  const fall = (t) => (t < 0.75 ? Math.pow(t / 0.75, 2) : 1 - Math.sin(((t - 0.75) / 0.25) * Math.PI) * 0.05);

  function rollGeometry() {
    const W = sheet.offsetWidth, H = sheet.offsetHeight;
    const big = Math.max(56, Math.min(96, W * 0.1));
    return { top: sheet.offsetTop, left: sheet.offsetLeft, W, H, big, core: Math.max(16, big * 0.28) };
  }

  // The scene at one moment: the paper's edge (px down the sheet), the roll's lift, its opacity.
  function pose(g, edge, lift = 0, fade = 1) {
    const left = Math.max(0, g.H - edge);
    const d = Math.sqrt(g.core ** 2 + (g.big ** 2 - g.core ** 2) * (left / g.H)); // Less paper, thinner roll.
    const y = (g.top + edge + lift).toFixed(1);
    return {
      clipPath: `inset(0px 0px ${left.toFixed(1)}px 0px)`,
      roll: { transform: `translateY(${y}px) translateY(-50%) scaleY(${(d / g.big).toFixed(4)})`, opacity: fade,
        backgroundPosition: `0 0, 0 ${edge.toFixed(1)}px, 0 ${edge.toFixed(1)}px, 0 0` },
      curl: { transform: `translateY(${(g.top + edge - 90 + lift).toFixed(1)}px)`, opacity: edge > 12 ? fade : 0 },
    };
  }

  // Plays segments of [ms, samples, (k) => pose] back to back as one set of keyframes.
  function play(g, segments) {
    const total = segments.reduce((sum, [ms]) => sum + ms, 0);
    const frames = [];
    let at = 0;
    for (const [ms, n, at_k] of segments) {
      for (let i = frames.length ? 1 : 0; i <= n; i++) frames.push({ offset: Math.min(1, (at + (ms * i) / n) / total), ...at_k(i / n) });
      at += ms;
    }
    Object.assign(roll.style, { left: `${g.left - 8}px`, width: `${g.W + 16}px`, height: `${g.big}px` });
    Object.assign(curl.style, { left: `${g.left}px`, width: `${g.W}px` });
    const opts = { duration: total, fill: 'forwards' };
    running = [
      sheet.animate(frames.map((f) => ({ offset: f.offset, clipPath: f.clipPath })), opts),
      roll.animate(frames.map((f) => ({ offset: f.offset, ...f.roll })), opts),
      curl.animate(frames.map((f) => ({ offset: f.offset, ...f.curl })), opts),
    ];
    return Promise.all(running.map((a) => a.finished)).then(() => true, () => false);
  }

  function stopRoll() {
    for (const a of running) a.cancel();
    running = [];
    paper.classList.remove('is-animating');
  }

  async function unroll() {
    stopRoll();
    paper.classList.add('is-animating');
    scroller.scrollTop = 0;
    const g = rollGeometry();
    const travel = Math.min(g.H, scroller.clientHeight - g.top + g.big); // Past the screen's bottom, nobody sees it.
    const from = -(g.top + g.big + 40);
    const segments = [
      [260, 10, (k) => pose(g, 0, from * (1 - fall(k)))], // It falls in from above and lands on the top edge.
      [700, 36, (k) => pose(g, travel * easeInOut(k))], // It rolls down, laying the paper flat behind it.
    ];
    if (travel >= g.H) segments.push([120, 4, (k) => pose(g, g.H, k * 10, 1 - k)]); // It ran out on screen.
    setTimeout(() => sound(0.05, 0.3), 200);
    setTimeout(() => sound(0.6, 0.09), 260);
    const done = await play(g, segments);
    if (!done) return;
    stopRoll();
    paper.querySelector('.dp-stamp')?.classList.add('thump');
  }

  async function rollUp() {
    stopRoll();
    paper.classList.add('is-animating');
    const g = rollGeometry();
    const scrolled = scroller.scrollTop;
    const start = Math.min(g.H, scrolled + scroller.clientHeight - g.top + g.big / 2);
    const end = Math.max(0, scrolled - g.top - g.big);
    const lift = -(scroller.clientHeight + g.big);
    sound(0.35, 0.08);
    await play(g, [
      [420, 24, (k) => pose(g, start - (start - end) * easeIn(k))], // It comes up and winds the paper back on.
      [160, 6, (k) => pose(g, end, lift * easeIn(k))], // Then lifts away.
    ]);
  }

  /* Opening and closing ------------------------------------------------------------------- */

  async function openPaper() {
    if (paper.open) return;
    paper.classList.remove('is-closing');
    paper.querySelector('.dp-stamp')?.classList.remove('thump');
    paper.showModal();
    if (!still.matches) await unroll();
    else scroller.scrollTop = 0;
    if (paper.open && !paper.classList.contains('is-closing')) (result || !boardSvg ? paper.querySelector('.dp-close') : boardSvg).focus({ preventScroll: true });
  }

  async function closePaper() {
    if (!paper.open || paper.classList.contains('is-closing')) return;
    paper.classList.add('is-closing');
    if (!still.matches) await rollUp();
    stopRoll();
    paper.classList.remove('is-closing');
    paper.close();
    document.querySelector('.daily-seal')?.focus({ preventScroll: true });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-daily]');
    if (!el) return;
    e.preventDefault();
    if (el.dataset.daily === 'open') openPaper();
    else if (el.dataset.daily === 'close') closePaper();
  });
  paper.addEventListener('cancel', (e) => { e.preventDefault(); closePaper(); }); // Escape
  // A click on the dark space around the paper puts it away.
  paper.addEventListener('click', (e) => { if (e.target === paper || e.target === scroller || e.target.classList.contains('dp-stage')) closePaper(); });
  paper.querySelector('a[href="#dp-how"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    byId('dp-how').scrollIntoView({ behavior: still.matches ? 'auto' : 'smooth' });
  });
  // A shared result link (…#poll) opens the paper, once the front page's opening animation is
  // over, and the hash is then dropped so a refresh lands on the front page again. Opening the
  // paper by hand never touches the address.
  function openFromLink() {
    if (location.hash !== SHARE_HASH) return;
    history.replaceState(null, '', location.pathname + location.search);
    if (document.documentElement.classList.contains('intro-on')) document.addEventListener('intro:done', () => openPaper(), { once: true });
    else openPaper();
  }
  addEventListener('hashchange', openFromLink);
  addEventListener('resize', () => { if (running.length) stopRoll(); });

  mailBtn.addEventListener('click', mail);
  boardSlot.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !result) { e.preventDefault(); mail(); }
  });

  load();
  openFromLink();
})();
