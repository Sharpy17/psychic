// The reply letter: opens one clue at a time, then the leaderboard and the ticket. The sample
// round and real games both use it, and pass in the same shape of data (board coordinates):
//
//   sheets:    [{ heading, topic?, clues: [{ label, text, nice?: [names] }], card, target,
//                 marks: [{ name, x, y, tier, points, distance, isYou, team }],
//                 psychics: [{ name, points, isYou, resonance? }] }]
//   columns:   ['Clue 1', ...]
//   standings: [{ name, perRound, total, isYou, isWinner, members }], best first
//   prizeLine, prizeName, youLine, note, tieNote, nicest?: [{ text, name, count }]
(() => {
  const RING_RADII = [45, 30, 17.5, 7.5]; // The scoring limits, in board units.
  const X_PATH = 'M-3.4-3.6 3.6 3.6M3.4-3.6-3.6 3.6';
  const byId = (id) => document.getElementById(id);
  const number = (n) => n.toLocaleString('en-US');
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
      if (m.isYou) return `<g transform="translate(${m.x} ${m.y})"><path class="reply-x drop${shown}" data-mark="${i}" d="${X_PATH}"/></g>`;
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

  function showSheet(i) {
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

    const chart = byId('reveal-chart');
    chart.innerHTML = labelled(sheet);
    const roster = byId('roster');
    const youKey = `<svg viewBox="-6 -6 12 12" aria-hidden="true"><path class="reply-x" d="${X_PATH}"/></svg>`;
    roster.innerHTML = sheet.marks.map((m, i2) =>
      `<li class="${m.isYou ? 'is-you' : ''}" data-row="${i2}"><span class="roster-key" aria-hidden="true">${m.isYou ? youKey : initial(m.name)}</span><span><span class="roster-name">${esc(m.isYou ? 'You' : m.name)}</span><span class="roster-result">Sealed</span></span><span class="roster-total">&nbsp;</span></li>`).join('') +
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
        status.textContent = hasMark(m) ? `${m.isYou ? 'You' : m.name} marked the board.` : `${m.name} left no mark.`;
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
        line.querySelector('.roster-total').textContent = number(m.points);
        blip(m.points >= 750 ? 660 : 420, 0.06);
        status.textContent = `${m.isYou ? 'You' : m.name}: ${m.tier}, ${number(m.points)} points.`;
      },
    }));
    sheet.psychics.forEach((p, i2) => steps.push({
      wait: 300,
      run() {
        if (p.points === null || p.points === undefined) return;
        const line = roster.querySelector(`[data-psychic="${i2}"]`);
        line.querySelector('.roster-result').textContent = p.resonance ? 'Psychic: the average, plus 250 for two Bullseyes' : 'Psychic, earns the average';
        line.querySelector('.roster-total').textContent = number(p.points);
      },
    }));
    steps.push({
      wait: 0,
      run() {
        const you = sheet.marks.find((m) => m.isYou && hasMark(m));
        byId('reveal-note').textContent = you ? `Your mark landed ${away(you.distance)} from the target.` : '';
      },
    });
    letter.scrollTop = 0;
    runSteps(steps, () => { nextBtn.textContent = i < data.sheets.length - 1 ? 'Open the next clue' : 'See the winner'; });
  }

  function showFinal(animated) {
    stopSteps();
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
        ? (hasMark(you) ? `You: ${you.tier}, ${number(you.points)} points, ${away(you.distance)} away.` : 'You left no mark.')
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
  byId('reply-close').addEventListener('click', () => letter.close());
  byId('reply-again').addEventListener('click', () => { const again = options.onAgain; letter.close(); again?.(); });
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
