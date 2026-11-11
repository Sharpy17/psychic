// The Daily Poll: "guess the people's mind". One item a day on a board from the main game; the
// answer is the crowd's dot, the middle of every guess mailed today, which the server sends only
// after you've mailed yours (see server/daily.js). After that the dot keeps moving as guesses come
// in, and the paper polls for it while it's open. Yesterday's poll is printed above today's: where
// its dot started, the road it took and where it finished.
// This file also unrolls the supplement (#daily-paper) off a paper roll and fills in the seal and
// the ad on the front page.
(() => {
  const PLAYER = 'pp-daily-player';
  const HISTORY = 'pp-daily-history';
  const SHARE_HASH = '#poll'; // The link in "Copy my result".
  const LIVE_MS = 20_000; // How often an open paper asks where the dot is now.
  const TIER_MARK = { Bullseye: '🎯', Close: '🟢', Warm: '🟡', Edge: '🟠', Miss: '⚪' };
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const byId = (id) => document.getElementById(id);
  const number = (n) => n.toLocaleString('en-US');
  const SIDES = ['top', 'bottom', 'left', 'right'];

  // The server's chart runs -100 to +100 with y up; the board draws 0 to 100 with y down.
  const toBoard = (p) => ({ x: (p.x + 100) / 2, y: (100 - p.y) / 2 });
  const toChart = (p) => ({ x: p.x * 2 - 100, y: 100 - p.y * 2 });
  // Distances on the chart (0 to 283) read better as board steps (0 to 141).
  const steps = (d) => Math.round(d / 2);

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
  const recapEl = byId('daily-recap');
  const mailBtn = byId('daily-mail');
  const boardSlot = byId('daily-board');
  const adToday = byId('daily-ad-today');
  const adGo = document.querySelector('.daily-ad .ad-go');
  const sealCta = byId('daily-seal-cta');
  if (!paper || !card) return;

  let board = null, boardSvg = null, crowdDot = null, thenDot = null, youLabel = null;
  let puzzle = null, result = null, mailing = false;
  let nextAt = 0, clockTimer = null;

  const sound = (dur, vol) => window.PPMail?.paperSound?.(dur, vol);
  const show = (id, on) => { byId(id).hidden = !on; };

  /* The chart ----------------------------------------------------------------------- */

  // Graph paper and newsprint dots instead of the circus sunburst. The board's words are the
  // main game's, printed around it by the page (#daily-top and friends).
  function pollBack(clipId) {
    let grid = '';
    for (let i = 10; i < 100; i += 10) if (i !== 50) grid += `M${i} 0V100M0 ${i}H100`;
    return `<defs><pattern id="${clipId}-dots" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle class="poll-dot" cx="1.2" cy="1.2" r="0.42"/></pattern></defs>
      <rect class="poll-paper" width="100" height="100"/>
      <rect width="100" height="100" fill="url(#${clipId}-dots)"/>
      <path class="poll-grid" d="${grid}"/><path class="poll-mid" d="M50 0V100M0 50H100"/>
      <path class="poll-frame" d="M0 0H100V100H0Z"/>`;
  }
  const pollArt = (clipId) => ({ viewBox: '-1 -1 102 102', back: pollBack(clipId) });

  function ensureBoard() {
    if (board) return;
    let lastTick = { x: 50, y: 50 };
    board = createBoard(boardSlot, {
      art: pollArt,
      onInput(p) {
        sideLabel(p);
        if (Math.hypot(p.x - lastTick.x, p.y - lastTick.y) >= 6) { lastTick = p; blip(900, 0.02, 'square', 0.02); }
      },
    });
    boardSvg = boardSlot.querySelector('svg');
    // Your guess is the game's own mark (YOU_MARK, an ink dot in a paper ring); here it also
    // carries a "You" label, since the crowd's red dot shares the board with it.
    boardSvg.querySelector('.marker').insertAdjacentHTML('beforeend', '<text class="you-label" x="5" y="1.5">You</text>');
    youLabel = boardSvg.querySelector('.you-label');
    // The crowd's dot (red, labelled) and where it stood when you mailed (a dashed ring), under your mark.
    const group = (cls, html) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', cls);
      g.innerHTML = html;
      boardSvg.querySelector('.marker').before(g);
      return g;
    };
    thenDot = group('then-dot', '<circle class="then-ring" r="3.2"/>');
    crowdDot = group('crowd-dot', '<circle class="crowd-glow" r="6"/><circle class="crowd-pip" r="2.4"/><text class="crowd-label" y="-4.4" text-anchor="middle">Crowd</text>');
  }

  // "You" sits right of your mark, or left of it near the right edge.
  function sideLabel(boardPos) {
    if (!youLabel) return;
    const left = boardPos.x > 84;
    youLabel.setAttribute('x', left ? -5 : 5);
    youLabel.setAttribute('text-anchor', left ? 'end' : 'start');
  }

  // A dot's label sits above it, or below at the top edge. When your mark is close by, the label
  // moves to the side away from it and further out, so your mark never covers it.
  function placeDot(dot, p, avoid = null) {
    const b = toBoard(p);
    dot.style.transform = `translate(${b.x}px, ${b.y}px)`;
    let below = b.y < 12;
    let far = false;
    if (avoid) {
      const a = toBoard(avoid);
      far = Math.hypot(a.x - b.x, a.y - b.y) < 10;
      if (far) below = a.y < b.y ? b.y < 88 : b.y < 12;
    }
    dot.querySelector('text')?.setAttribute('y', below ? (far ? 11 : 8.6) : (far ? -7.4 : -4.4));
  }

  /* Filling in the paper ---------------------------------------------------------------- */

  function drawPuzzle(p) {
    puzzle = p;
    ensureBoard();
    byId('daily-no').textContent = `Vol. I · Poll No. ${number(p.day)}`;
    byId('dp-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    byId('daily-asked').textContent = 'Where would most people put…';
    byId('daily-clue').textContent = p.text;
    byId('dp-ticker').textContent = `Today’s name: ${p.text}. The crowd’s dot stays sealed in the editor’s safe until you mail your guess.`;
    byId('daily-fine').textContent = 'One entry per reader per day. Void where prohibited by geese.';
    for (const side of SIDES) byId('daily-' + side).textContent = p.board[side];
    boardSvg.setAttribute('aria-label', `Poll ${p.day}: where would most people put ${p.text}? Top is ${p.board.top}, bottom is ${p.board.bottom}, left is ${p.board.left}, right is ${p.board.right}. Arrow keys move your mark, Enter mails it.`);
    for (const id of ['daily-clue', 'daily-board-wrap', 'daily-hint', 'daily-foot']) show(id, true);
    show('daily-result', false);
    crowdDot.classList.remove('show');
    thenDot.classList.remove('show');
    board.update({ marker: { x: 50, y: 50 }, target: null, interactive: true, revealed: false });
    sideLabel({ x: 50, y: 50 });
    card.setAttribute('aria-busy', 'false');
    if (adToday) adToday.textContent = `Today: ${p.text}`;
    if (adGo) adGo.firstChild.textContent = 'Read today’s poll ';
    if (sealCta) sealCta.textContent = 'Play today’s poll ›';
  }

  // The streak counts days played. Each day keeps its points: the score on mailing, swapped for
  // the final score once the day is over and the recap has it.
  function streakOf(history, today) {
    let streak = 0;
    for (let d = today; history[d] != null; d--) streak++;
    return streak;
  }

  function recordHistory(day, points) {
    const history = store.get(HISTORY) ?? {};
    history[day] = points;
    for (const d of Object.keys(history)) if (Number(d) < day - 400) delete history[d];
    store.set(HISTORY, history);
    return streakOf(history, day);
  }

  const readers = (n) => `${number(n)} ${n === 1 ? 'reader has' : 'readers have'}`;

  function crowdLine(r) {
    const first = r.crowd.count < 2 ? 'You’re the first reader today, so the dot only had the editor’s guess to go on. ' : '';
    if (!r.since) return `${first}Your guess pulled the dot a little your way. Nobody has guessed since: watch it move as others mail theirs.`;
    // Only the guesses after yours count as the dot moving; your own pull isn't news.
    const was = Math.hypot(r.you.x - r.after.x, r.you.y - r.after.y);
    const now = r.live.distance > was + 2 ? `the dot has drifted ${steps(r.live.distance - was)} steps away from you`
      : r.live.distance < was - 2 ? `the dot has moved ${steps(was - r.live.distance)} steps toward you` : 'the dot has hardly moved';
    const rank = r.beat === 100 ? ' Right now you’re closer than <b>everyone else</b>.'
      : r.beat ? ` Right now you’re closer than <b>${r.beat}%</b> of today’s readers.` : '';
    return `${first}Since you mailed, ${number(r.since)} more ${r.since === 1 ? 'reader has' : 'readers have'} guessed and ${now}.${rank}`;
  }

  function shareText(r, streak) {
    return [
      `The Psychic Plane · Daily Poll #${r.day}`,
      `${r.text}: ${TIER_MARK[r.you.tier] ?? ''} ${r.you.tier} · ${number(r.you.points)} pts`,
      (r.beat != null ? `Closer to the crowd than ${r.beat}% of readers` : 'First reader of the day') + (streak > 1 ? ` · ${streak}-day streak` : ''),
      location.origin + location.pathname + SHARE_HASH,
    ].join('\n');
  }

  // The words that change as the dot moves: kept apart so a live update rewrites only them.
  function drawLive(r) {
    placeDot(crowdDot, r.crowd, r.you);
    crowdDot.classList.add('show');
    const moved = Math.hypot(r.crowd.x - r.then.x, r.crowd.y - r.then.y) > 1;
    thenDot.classList.toggle('show', moved);
    const line = resultEl.querySelector('.dp-crowd');
    if (line) line.innerHTML = crowdLine(r);
    byId('dp-ticker').textContent = `${r.text}: ${readers(r.crowd.count)} guessed today. The dot keeps moving until midnight.`;
  }

  function drawResult(r, { fresh = false } = {}) {
    result = r;
    if (!puzzle) drawPuzzle(r);
    const streak = recordHistory(r.day, r.you.points);
    board.update({ marker: toBoard(r.you), target: null, interactive: false, revealed: false });
    sideLabel(toBoard(r.you));
    placeDot(thenDot, r.then);
    show('daily-hint', false);
    show('daily-foot', false);
    resultEl.innerHTML = `
      <div class="dp-verdict"><span class="dp-verdict-stamp tier-${esc(r.you.tier.toLowerCase())}">${esc(r.you.tier)}</span><span class="dp-points">${number(r.you.points)} points</span></div>
      <p class="dp-facts">When you mailed it, the crowd’s dot was <b>${steps(r.you.distance)} ${steps(r.you.distance) === 1 ? 'step' : 'steps'}</b> from your mark.</p>
      <p class="dp-crowd"></p>
      <div class="demo-foot"><button class="btn primary" type="button" data-share>Copy my result</button></div>
      <div class="entry-row"><span class="entry-label">Streak: ${streak} ${streak === 1 ? 'day' : 'days'}</span><span class="entry-label" id="daily-next"></span></div>`;
    show('daily-result', true);
    byId('daily-fine').textContent = 'Come back after midnight to see where the dot finished. One entry per reader per day.';
    drawLive(r);
    resultEl.querySelector('[data-share]').addEventListener('click', () => copy(shareText(result, streak)));
    if (adToday) adToday.textContent = `Today: ${r.text} · you scored ${r.you.tier}`;
    if (adGo) adGo.firstChild.textContent = 'Watch the crowd’s dot ';
    if (sealCta) sealCta.textContent = 'See your reply ›';
    tickClock();
    statusEl.textContent = `${r.you.tier}, ${r.you.points} points. ${r.crowd.count > 1 ? `${r.crowd.count} readers have guessed today.` : 'You are the first reader today.'}`;
    if (fresh) {
      sound(0.08, 0.3);
      blip(r.you.points >= 750 ? 880 : r.you.points ? 660 : 330, 0.12, 'triangle', 0.06);
      if (!still.matches) resultEl.querySelector('.dp-verdict-stamp').classList.add('thump');
    }
  }

  // Yesterday's poll in miniature: the dot's road from where it started to where it finished,
  // and your mark if you played.
  function drawRecap(y) {
    if (!y) { recapEl.hidden = true; return; }
    const b = (p) => toBoard(p);
    const road = y.trail.map((p) => `${b(p).x.toFixed(1)},${b(p).y.toFixed(1)}`).join(' ');
    const s = b(y.start), e = b(y.end);
    const x = y.you ? b(y.you) : null;
    const axis = (t, ax, ay, anchor) => `<text class="recap-axis" x="${ax}" y="${ay}" text-anchor="${anchor}">${esc(t)}</text>`;
    const svg = `<svg class="recap-board" viewBox="-1 -8 102 118" role="img" aria-label="Yesterday’s board for ${esc(y.text)}: the crowd’s dot moved ${steps(y.moved)} steps.">
      ${pollBack('recap')}
      ${axis(y.board.top, 50, -2.5, 'middle')}${axis(y.board.bottom, 50, 106.5, 'middle')}
      <polyline class="recap-road" points="${road}"/>
      <circle class="recap-start" cx="${s.x}" cy="${s.y}" r="1.8"/>
      <circle class="crowd-glow" cx="${e.x}" cy="${e.y}" r="5"/><circle class="crowd-pip" cx="${e.x}" cy="${e.y}" r="2.2"/>
      ${x ? `<g transform="translate(${x.x} ${x.y}) scale(0.85)">${YOU_MARK}</g>` : ''}
    </svg>`;
    let mine = '';
    if (y.you) {
      const f = y.you.final;
      mine = `<p>Your final score: <b>${esc(f.tier)}, ${number(f.points)} points</b> (${steps(f.distance)} steps off).
        ${y.you.movedSince > 2 ? `The dot moved ${steps(y.you.movedSince)} steps after you mailed.` : 'The dot barely moved after you mailed.'}</p>`;
      recordHistory(y.day, f.points);
    }
    const crowd = y.count ? `${number(y.count)} ${y.count === 1 ? 'reader' : 'readers'} guessed, and the crowd’s dot travelled <b>${steps(y.moved)} steps</b> from where the day began.`
      : 'Nobody guessed, so the dot never left the editor’s spot.';
    recapEl.innerHTML = `
      <span class="recap-kicker">Yesterday’s poll · No. ${number(y.day)}</span>
      ${svg}
      <div>
        <h3>Where did people put ${esc(y.text)}?</h3>
        <p>${crowd}</p>${mine}
        <p class="recap-labels">Left: ${esc(y.board.left)} · Right: ${esc(y.board.right)}. The hollow dot is where it started, the dotted road is its journey, the red dot is where it finished${y.you ? ', and the ringed ink dot is your guess' : ''}.</p>
      </div>`;
    recapEl.hidden = false;
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
      drawRecap(body.yesterday);
      drawPuzzle(body.puzzle);
      if (body.result) drawResult(body.result);
      else tickClock();
    } catch (error) {
      drawError(error.shown ? error.message : 'The Daily Poll couldn’t reach the paper’s server.', true);
    }
  }

  // While the paper is open after your guess, ask now and then where the dot has got to.
  async function refresh() {
    if (!result || !paper.open || document.hidden || mailing) return;
    try {
      const body = await api(`api/daily?player=${encodeURIComponent(playerId())}`);
      if (!body.result || body.result.day !== result.day) { load(); return; } // A new day began.
      const before = result.crowd;
      result = body.result;
      drawLive(result);
      if ((before.x !== result.crowd.x || before.y !== result.crowd.y) && !still.matches) {
        crowdDot.classList.remove('nudge');
        void crowdDot.getBBox();
        crowdDot.classList.add('nudge');
        sound(0.04, 0.12);
      }
    } catch { /* Try again on the next tick. */ }
  }
  setInterval(refresh, LIVE_MS);

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
