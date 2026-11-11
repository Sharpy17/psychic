// The reply letter: opens one clue at a time, then the leaderboard and the ticket. The sample
// round and real games both use it, and pass in the same shape of data (board coordinates):
//
//   sheets:    [{ heading, topic?, clues: [{ label, text, nice?: [names] }], card, target,
//                 marks: [{ name, x, y, tier, points, distance, isYou, youLabel?, team }],
//                 psychics: [{ name, points, isYou, resonance? }] }]
//   columns:   ['Clue 1', ...]
//   standings: [{ name, perRound, total, isYou, isWinner, members }], best first
//   prizeLine, prizeName, youLine, note, tieNote, nicest?: [{ text, name, count }]
(() => {
  const RING_RADII = [45, 30, 17.5, 7.5]; // The scoring limits, in board units.
  // Your own mark is YOU_MARK (common.js), the same as on the board.
  const byId = (id) => document.getElementById(id);
  const number = (n) => n.toLocaleString('en-US');
  // Points tick up like a scoreboard instead of appearing all at once. The final figure is always exact.
  function countUp(el, to, ms = 520) {
    if (still.matches || !to) { el.textContent = number(to ?? 0); return; }
    const t0 = performance.now();
    const step = () => {
      // Its own clock, clamped: a frame's timestamp can be earlier than t0, which would count below zero.
      const k = Math.max(0, Math.min(1, (performance.now() - t0) / ms));
      el.textContent = number(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
      else el.textContent = number(to);
    };
    requestAnimationFrame(step);
  }
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const away = (distance) => {
    const d = Math.round(distance * 10) / 10;
    return `${d} ${d === 1 ? 'unit' : 'units'}`;
  };

  const letter = byId('reply');
  const status = byId('reply-status');
  let data = null, options = {}, index = 0, finished = false, charts = 0;
  let stepTimers = [], stepQueue = [], stepsDone = null;

  function stopSteps() {
    stepTimers.forEach(clearTimeout);
    stepTimers = [];
    stepQueue = [];
    stepsDone = null;
  }
  function nextStep() {
    if (!stepQueue.length) {
      const done = stepsDone;
      stepsDone = null;
      done?.();
      return;
    }
    const step = stepQueue.shift();
    step.run();
    stepTimers.push(setTimeout(nextStep, step.wait));
  }
  function flushSteps() {
    stepTimers.forEach(clearTimeout);
    stepTimers = [];
    while (stepQueue.length) stepQueue.shift().run();
    nextStep();
  }
  function runSteps(steps, done) {
    stopSteps();
    stepQueue = steps.slice();
    stepsDone = done;
    if (still.matches) flushSteps();
    else nextStep();
  }

  const hasMark = (m) => m.x !== null && m.x !== undefined;
  const initial = (name) => esc([...name][0].toUpperCase());

  // One clue's chart. `full` shows everything at once; otherwise the steps bring in each part.
  function chartSvg(sheet, full) {
    const t = sheet.target, shown = full ? ' is-in' : '';
    const clipId = `reply-clip-${++charts}`;
    const art = boardArt(clipId, !full); // The small charts drop the marquee band.
    const rings = RING_RADII.map((r) => `<circle class="reply-ring" cx="${t.x}" cy="${t.y}" r="${r}"/>`).join('');
    const you = sheet.marks.find((m) => m.isYou && hasMark(m));
    const miss = you ? `<line class="reply-miss" x1="${you.x}" y1="${you.y}" x2="${t.x}" y2="${t.y}"/>` : '';
    const dots = sheet.marks.map((m, i) => {
      if (!hasMark(m)) return '';
      if (m.isYou) return `<g transform="translate(${m.x} ${m.y})"><g class="drop${shown}" data-mark="${i}">${YOU_MARK}</g></g>`;
      const team = m.team ? ` team-${esc(m.team)}` : '';
      return `<g transform="translate(${m.x} ${m.y})"><g class="drop${shown}" data-mark="${i}"><circle class="reply-rival${team}" r="4"/><text class="reply-letter" y="1.6">${initial(m.name)}</text></g></g>`;
    }).join('');
    return `<svg class="reply-board" viewBox="${art.viewBox}" role="img" aria-label="Clue ${esc(sheet.clues.map((c) => c.text ?? 'none').join(' and '))}: the target and each player's mark">
      <defs><clipPath id="${clipId}"><rect width="100" height="100"/></clipPath></defs>
      ${art.back}
      <g class="reply-answer${shown}" clip-path="url(#${clipId})">${rings}${miss}<circle class="reply-target" cx="${t.x}" cy="${t.y}" r="1.9"/></g>
      ${dots}
    </svg>`;
  }
  const labelled = (sheet) => {
    const c = sheet.card;
    return `<span class="axis-label top">${esc(c.top)}</span><span class="axis-label left">${esc(c.left)}</span><div class="board-slot">${chartSvg(sheet, false)}</div><span class="axis-label right">${esc(c.right)}</span><span class="axis-label bottom">${esc(c.bottom)}</span>`;
  };
  const clueText = (clue) => clue.text ?? 'No clue came in time.';
  const niceTag = (clue) => {
    const n = clue.nice?.length ?? 0;
    return n ? `<span class="nice-tag" title="${esc(`Nice clue from ${clue.nice.join(', ')}`)}">★ Nice clue${n > 1 ? ` ×${n}` : ''}</span>` : '';
  };
  const topicLine = (sheet) => (sheet.topic ? `<span class="reply-topic">Topic: ${esc(sheet.topic)}</span>` : '');
  const clueLines = (sheet) => topicLine(sheet) + sheet.clues.map((c) => `<span class="reveal-clue-line">${c.label ? `<span class="clue-by">${esc(c.label)}:</span> ` : ''}<em>${esc(clueText(c))}</em>${niceTag(c)}</span>`).join('');

  /* Team games: two boards, one per team. Each replays how its team moved its mark, building a
     heatmap where it lingered, and only then shows the target. ------------------------------ */
  const HEAT = 5; // Heatmap cell size, in board units (a 20 by 20 grid).
  const REPLAY_MS = 3200;
  let replayer = null;
  const cellOf = ([x, y]) => `${Math.min(19, Math.max(0, Math.floor(x / HEAT)))}:${Math.min(19, Math.max(0, Math.floor(y / HEAT)))}`;
  const names = (list) => (list.length > 2 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list.join(' and '));

  function teamBoard(sheet, m) {
    const t = sheet.target, j = m.journey;
    const clipId = `reply-clip-${++charts}`;
    const art = boardArt(clipId, true);
    const cells = [...new Set(j.trail.map(cellOf))].map((key) => {
      const [cx, cy] = key.split(':').map(Number);
      return `<rect class="heat-cell" data-cell="${key}" x="${cx * HEAT}" y="${cy * HEAT}" width="${HEAT}" height="${HEAT}"/>`;
    }).join('');
    const rings = RING_RADII.map((r) => `<circle class="reply-ring" cx="${t.x}" cy="${t.y}" r="${r}"/>`).join('');
    const head = m.isYou
      ? YOU_MARK
      : `<circle class="reply-rival team-${esc(m.team)}" r="4"/><text class="reply-letter" y="1.6">${initial(m.name)}</text>`;
    const start = j.trail[0];
    return `<svg class="reply-board team-board" viewBox="${art.viewBox}" role="img" aria-label="${esc(m.isYou ? 'Your team' : m.name)}: how the mark moved, and the target">
      <defs><clipPath id="${clipId}"><rect width="100" height="100"/></clipPath></defs>
      ${art.back}
      <g clip-path="url(#${clipId})">
        <g class="heat team-${esc(m.team)}">${cells}</g>
        <polyline class="trail team-${esc(m.team)}" points="${start[0]},${start[1]}"/>
        <g class="reply-answer">${rings}<line class="reply-miss" x1="${m.x}" y1="${m.y}" x2="${t.x}" y2="${t.y}"/><circle class="reply-target" cx="${t.x}" cy="${t.y}" r="1.9"/></g>
      </g>
      <g class="trail-head" transform="translate(${start[0]} ${start[1]})">${head}</g>
    </svg>`;
  }

  function journeyLine(m) {
    const j = m.journey;
    if (!j.moves) return 'Nobody moved it: the mark stayed in the middle.';
    return `Moved by ${esc(names(j.movers))} · travelled ${j.travelled} units · ${j.lockedIn ? `locked in after ${j.seconds}s` : 'time ran out'}`;
  }

  // Plays every team's trail at once; finish() jumps to the end (skips, reduced motion).
  function replayTrails(panels) {
    const state = panels.map((p) => {
      const counts = new Map();
      p.trail.forEach((pt) => counts.set(cellOf(pt), (counts.get(cellOf(pt)) ?? 0) + 1));
      return { ...p, max: Math.max(...counts.values()), seen: new Map(), drawn: -1 };
    });
    let start = null, raf = 0, done = false;
    const draw = (progress) => {
      for (const s of state) {
        const last = s.trail.length - 1, at = progress * last, n = Math.floor(at);
        for (let k = s.drawn + 1; k <= n; k++) {
          const key = cellOf(s.trail[k]), c = (s.seen.get(key) ?? 0) + 1;
          s.seen.set(key, c);
          const cell = s.svg.querySelector(`[data-cell="${key}"]`);
          if (cell) cell.style.opacity = (0.1 + 0.62 * (c / s.max)).toFixed(3);
        }
        s.drawn = Math.max(s.drawn, n);
        const a = s.trail[n], b = s.trail[Math.min(last, n + 1)], f = at - n;
        const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
        s.svg.querySelector('.trail').setAttribute('points', [...s.trail.slice(0, n + 1), [x, y]].map((p) => p.join(',')).join(' '));
        s.svg.querySelector('.trail-head').setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      }
    };
    const frame = (ts) => {
      if (done) return;
      start ??= ts;
      const p = Math.min(1, (ts - start) / REPLAY_MS);
      draw(p);
      if (p < 1) raf = requestAnimationFrame(frame);
      else done = true;
    };
    const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); draw(1); };
    if (still.matches) finish();
    else raf = requestAnimationFrame(frame);
    return { finish };
  }

  function showTeamSheet(i) {
    const sheet = data.sheets[i];
    const nextBtn = byId('reveal-next');
    index = i;
    byId('reveal-view').hidden = false;
    byId('final-view').hidden = true;
    byId('reply-title').textContent = 'Here are your results';
    byId('reveal-count').textContent = sheet.heading;
    byId('reveal-clue').innerHTML = clueLines(sheet);
    byId('reveal-note').textContent = '';
    nextBtn.textContent = 'Show this clue now';
    replayer?.finish();

    const chart = byId('reveal-chart');
    chart.classList.remove('board-wrap');
    chart.closest('.reply-body').classList.add('is-teams');
    byId('roster').hidden = true;
    const c = sheet.card;
    // Your team first, on the left.
    const marks = [...sheet.marks].sort((a, b) => Number(b.isYou) - Number(a.isYou));
    chart.innerHTML = `<div class="team-boards">${marks.map((m) => {
      const psychic = sheet.clues.find((cl) => cl.team === m.team);
      return `<figure class="team-panel team-${esc(m.team)}${m.isYou ? ' is-you' : ''}" data-team="${esc(m.team)}">
        <figcaption><b>${esc(m.isYou ? `Your team · ${m.name}` : m.name)}</b>${psychic?.by ? `<small>Clue by ${esc(psychic.by)}</small>` : ''}</figcaption>
        <div class="board-wrap"><span class="axis-label top">${esc(c.top)}</span><span class="axis-label left">${esc(c.left)}</span><div class="board-slot">${teamBoard(sheet, m)}</div><span class="axis-label right">${esc(c.right)}</span><span class="axis-label bottom">${esc(c.bottom)}</span></div>
        <p class="journey-stats"></p>
        <p class="journey-score" aria-live="polite"></p>
      </figure>`;
    }).join('')}</div>`;
    const panel = (m) => chart.querySelector(`.team-panel[data-team="${CSS.escape(m.team)}"]`);

    const steps = [
      { wait: 350, run() { status.textContent = 'Replaying how each team moved its mark.'; PPMail.paperSound(0.05, 0.1); } },
      { wait: REPLAY_MS + 250, run() { replayer = replayTrails(marks.map((m) => ({ svg: panel(m).querySelector('svg'), trail: m.journey.trail }))); } },
      { wait: 900, run() {
        marks.forEach((m) => { panel(m).querySelector('.journey-stats').innerHTML = journeyLine(m); });
        PPMail.paperSound(0.05, 0.12);
      } },
      { wait: 900, run() {
        replayer?.finish();
        chart.querySelectorAll('.reply-answer').forEach((a) => a.classList.add('is-in'));
        PPMail.thud();
        status.textContent = 'The target is on both charts.';
      } },
      ...marks.map((m) => ({ wait: 450, run() {
        const j = m.journey;
        const near = j.moves && j.closest < m.distance - 2 ? `<small>At one point it was only ${away(j.closest)} away.</small>` : '';
        panel(m).querySelector('.journey-score').innerHTML = `<b>${esc(m.tier)}</b>, ${away(m.distance)} away · <b>${number(m.points)}</b> points${near}`;
        panel(m).classList.add('is-scored');
        countUp(panel(m).querySelectorAll('.journey-score > b')[1], m.points);
        blip(m.points >= 750 ? 660 : 420, 0.06);
        status.textContent = `${m.isYou ? 'Your team' : m.name}: ${m.tier}, ${number(m.points)} points.`;
      } })),
      { wait: 0, run() {
        const you = sheet.marks.find((m) => m.isYou);
        byId('reveal-note').textContent = you ? `Your team’s mark landed ${away(you.distance)} from the target.` : '';
      } },
    ];
    letter.scrollTop = 0;
    runSteps(steps, () => { nextBtn.textContent = i < data.sheets.length - 1 ? 'Open the next clue' : 'See the winner'; });
  }

  function showSheet(i) {
    const sheet = data.sheets[i];
    if (sheet.marks.some((m) => m.journey)) { showTeamSheet(i); return; }
    // Back to the one-board layout, in case a team sheet changed it.
    byId('reveal-chart').classList.add('board-wrap');
    byId('reveal-chart').closest('.reply-body').classList.remove('is-teams');
    byId('roster').hidden = false;
    const nextBtn = byId('reveal-next');
    index = i;
    byId('reveal-view').hidden = false;
    byId('final-view').hidden = true;
    byId('reply-title').textContent = 'Here are your results';
    byId('reveal-count').textContent = sheet.heading;
    byId('reveal-clue').innerHTML = clueLines(sheet);
    byId('reveal-note').textContent = '';
    nextBtn.textContent = 'Show this clue now';

    const chart = byId('reveal-chart');
    chart.innerHTML = labelled(sheet);
    const roster = byId('roster');
    const youKey = `<svg viewBox="-6 -6 12 12" aria-hidden="true">${YOU_MARK}</svg>`;
    roster.innerHTML = sheet.marks.map((m, i2) =>
      `<li class="${m.isYou ? 'is-you' : ''}" data-row="${i2}"><span class="roster-key" aria-hidden="true">${m.isYou ? youKey : initial(m.name)}</span><span><span class="roster-name">${esc(m.isYou ? (m.youLabel ?? 'You') : m.name)}</span><span class="roster-result">Sealed</span></span><span class="roster-total">&nbsp;</span></li>`).join('') +
      sheet.psychics.map((p, i2) =>
        `<li class="is-psychic${p.isYou ? ' is-you' : ''}" data-psychic="${i2}"><span class="roster-key" aria-hidden="true">★</span><span><span class="roster-name">${esc(p.isYou ? 'You' : p.name)}</span><span class="roster-result">Psychic</span></span><span class="roster-total">&nbsp;</span></li>`).join('');
    const row = (i2) => roster.querySelector(`[data-row="${i2}"]`);

    const steps = [];
    sheet.marks.forEach((m, i2) => steps.push({
      wait: 420,
      run() {
        chart.querySelector(`[data-mark="${i2}"]`)?.classList.add('is-in');
        row(i2).querySelector('.roster-result').textContent = hasMark(m) ? 'Marked' : 'No mark';
        PPMail.paperSound(0.05, 0.12);
        status.textContent = hasMark(m) ? `${m.isYou ? (m.youLabel ?? 'You') : m.name} marked the board.` : `${m.name} left no mark.`;
      },
    }));
    steps.push({
      wait: 760,
      run() {
        chart.querySelector('.reply-answer').classList.add('is-in');
        PPMail.thud();
        status.textContent = 'The target is on the chart.';
      },
    });
    sheet.marks.forEach((m, i2) => steps.push({
      wait: 340,
      run() {
        const line = row(i2);
        line.classList.add('is-scored');
        line.querySelector('.roster-result').textContent = hasMark(m) ? `${m.tier}, ${away(m.distance)} away` : 'No mark';
        countUp(line.querySelector('.roster-total'), m.points);
        blip(m.points >= 750 ? 660 : 420, 0.06);
        status.textContent = `${m.isYou ? (m.youLabel ?? 'You') : m.name}: ${m.tier}, ${number(m.points)} points.`;
      },
    }));
    sheet.psychics.forEach((p, i2) => steps.push({
      wait: 300,
      run() {
        if (p.points === null || p.points === undefined) return;
        const line = roster.querySelector(`[data-psychic="${i2}"]`);
        line.querySelector('.roster-result').textContent = p.resonance ? 'Psychic: the average, plus 250 for two Bullseyes' : 'Psychic, earns the average';
        countUp(line.querySelector('.roster-total'), p.points);
      },
    }));
    steps.push({
      wait: 0,
      run() {
        const you = sheet.marks.find((m) => m.isYou && hasMark(m));
        byId('reveal-note').textContent = you ? `${you.youLabel ? 'Your team’s mark' : 'Your mark'} landed ${away(you.distance)} from the target.` : '';
      },
    });
    letter.scrollTop = 0;
    runSteps(steps, () => { nextBtn.textContent = i < data.sheets.length - 1 ? 'Open the next clue' : 'See the winner'; });
  }

  function showFinal(animated) {
    stopSteps();
    replayer?.finish();
    finished = true;
    const rest = byId('final-rest');
    byId('reveal-view').hidden = true;
    byId('final-view').hidden = false;
    const title = byId('reply-title');
    title.textContent = 'The final leaderboard';
    title.focus({ preventScroll: true });
    letter.scrollTop = 0;

    byId('standings-head').innerHTML = `<tr><th scope="col">${data.columnsLabel ?? 'Player'}</th>${data.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}<th scope="col">Total</th></tr>`;
    byId('standings-body').innerHTML = data.standings.map((s, n) => {
      const cls = [s.isYou ? 'is-you' : '', s.isWinner ? 'is-winner' : ''].join(' ').trim();
      const members = s.members ? `<small class="standing-members">${esc(s.members.join(', '))}</small>` : '';
      return `<tr class="${cls}"><th scope="row">${n + 1}. ${esc(s.name)}${members}</th>${s.perRound.map((v) => `<td>${number(v)}</td>`).join('')}<td>${number(s.total)}</td></tr>`;
    }).join('');

    byId('prize-line').textContent = data.prizeLine;
    byId('prize-name').textContent = data.prizeName;
    byId('prize-you').textContent = data.youLine;
    byId('tie-note').textContent = data.tieNote ?? '';
    byId('tie-note').hidden = !data.tieNote;
    const nicest = byId('nicest-clue');
    if (nicest) {
      const list = data.nicest ?? [];
      const nods = (n) => (n === 1 ? 'one nod' : `${n} nods`);
      nicest.innerHTML = list.length
        ? `<b>★ Nicest clue ★</b><br>${list.map((c) => `“${esc(c.text)}” by ${esc(c.name)}`).join(' and ')}, with ${nods(list[0].count)}`
        : '';
      nicest.hidden = !list.length;
    }
    byId('reply-note').textContent = data.note ?? '';
    byId('reply-note').hidden = !data.note;

    byId('answers').innerHTML = data.sheets.map((sheet) => {
      const you = sheet.marks.find((m) => m.isYou);
      const line = you
        ? (hasMark(you) ? `${you.youLabel ?? 'You'}: ${you.tier}, ${number(you.points)} points, ${away(you.distance)} away.` : 'You left no mark.')
        : (sheet.psychics.some((p) => p.isYou) ? 'You were the psychic.' : '');
      const clues = topicLine(sheet) + sheet.clues.map((c) => `<h3>${c.label ? `<span class="clue-by">${esc(c.label)}:</span> ` : ''}${esc(clueText(c))}${niceTag(c)}</h3>`).join('');
      const c = sheet.card;
      return `<div class="answer">${chartSvg(sheet, true)}<div>${clues}<p>${esc(c.left)} to ${esc(c.right)}, ${esc(c.top)} to ${esc(c.bottom)}</p><p class="you-result">${esc(line)}</p></div></div>`;
    }).join('');

    const ticket = byId('prize-ticket');
    ticket.classList.remove('thump');
    const award = () => {
      rest.hidden = false;
      void ticket.offsetWidth;
      ticket.classList.add('thump');
      if (animated) {
        PPMail.thud();
        CFG.chime.forEach((f, i) => setTimeout(() => blip(f, 0.12), 120 + i * 90));
      }
    };
    if (!animated || still.matches) { award(); return; }

    // Last place first, so the winner is the last name you read.
    rest.hidden = true;
    const rows = [...byId('standings-body').rows];
    rows.forEach((r) => r.classList.add('is-waiting'));
    const steps = [...rows].reverse().map((r, n) => ({
      wait: n === rows.length - 2 ? 1000 : 600,
      run() {
        r.classList.remove('is-waiting');
        r.classList.add('is-arriving');
        const totalCell = r.cells[r.cells.length - 1];
        countUp(totalCell, data.standings[rows.length - 1 - n].total, 700);
        PPMail.paperSound(0.07, 0.14);
        const s = data.standings[rows.length - 1 - n];
        status.textContent = `In place ${rows.length - n}, ${s.name}, with ${number(s.total)} points.`;
      },
    }));
    runSteps(steps, award);
  }

  byId('reveal-next').addEventListener('click', () => {
    // While a clue is still opening, this button shows the rest of it straight away.
    if (stepsDone) { flushSteps(); return; }
    if (index < data.sheets.length - 1) showSheet(index + 1);
    else showFinal(true);
  });
  byId('reveal-skip').addEventListener('click', () => showFinal(false));
  // The letter folds down off the desk instead of vanishing.
  function fold(then) {
    if (!letter.open || letter.classList.contains('is-leaving')) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { letter.close(); then?.(); return; }
    letter.classList.add('is-leaving');
    PPMail.paperSound?.(0.18, 0.14);
    setTimeout(() => { letter.classList.remove('is-leaving'); if (letter.open) letter.close(); then?.(); }, 320);
  }
  byId('reply-close').addEventListener('click', () => fold());
  byId('reply-again').addEventListener('click', () => { const again = options.onAgain; fold(again); });
  letter.addEventListener('cancel', (e) => { e.preventDefault(); fold(); });
  letter.addEventListener('close', () => { stopSteps(); options.onClose?.(); });

  function configure(opts) {
    options = opts;
    const again = byId('reply-again');
    again.textContent = opts.againLabel ?? '';
    again.hidden = !opts.onAgain;
  }

  window.PPReply = {
    open(reply, opts = {}) {
      data = reply;
      finished = false;
      configure(opts);
      if (!letter.open) letter.showModal();
      showSheet(0);
    },
    reopen(opts) {
      if (opts) configure(opts);
      if (!letter.open) letter.showModal();
      if (finished) showFinal(false);
      else showSheet(index);
    },
    close() { if (letter.open) letter.close(); },
  };
})();
