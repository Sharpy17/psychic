// The sample entry on the front page: a Free for All with ready-made clues and made-up rivals.
// It runs entirely in the browser and needs no server.
(() => {
  const TIERS = [
    { name: 'Bullseye', limit: 15, points: 1000 },
    { name: 'Close', limit: 35, points: 750 },
    { name: 'Warm', limit: 60, points: 500 },
    { name: 'Edge', limit: 90, points: 250 },
    { name: 'Miss', limit: Infinity, points: 0 },
  ];
  const RIVALS = ['Marge', 'Dev', 'Sam'];
  // Targets suit their clues and stay within the game's +/-85 bounds (7.5 to 92.5 on this board).
  const CARDS = [
    { top: 'Funny', bottom: 'Unfunny', left: 'Ugly', right: 'Cute', clue: 'A pug in a hot dog costume',
      target: { x: 72, y: 24 }, rivals: [{ x: 64, y: 34 }, { x: 50, y: 40 }, { x: 28, y: 62 }] },
    { top: 'Expensive', bottom: 'Cheap', left: 'Gross', right: 'Delicious', clue: 'Airport sushi',
      target: { x: 30, y: 18 }, rivals: [{ x: 22, y: 30 }, { x: 30, y: 21 }, { x: 62, y: 44 }] },
    { top: 'Scary', bottom: 'Not scary', left: 'Tiny', right: 'Huge', clue: 'A goose',
      target: { x: 38, y: 34 }, rivals: [{ x: 32, y: 30 }, { x: 60, y: 46 }, { x: 38, y: 58 }] },
    { top: 'Cool', bottom: 'Cringe', left: 'Useless', right: 'Useful', clue: 'A fanny pack',
      target: { x: 70, y: 72 }, rivals: [{ x: 54, y: 84 }, { x: 72, y: 62 }, { x: 30, y: 40 }] },
  ];

  const byId = (id) => document.getElementById(id);
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const number = (n) => n.toLocaleString('en-US');

  function scoreFor(pin, target) {
    const distance = Math.hypot(pin.x - target.x, pin.y - target.y) * 2; // The board is half the chart's scale.
    const tier = TIERS.find((t) => distance <= t.limit);
    return { distance, tier: tier.name, points: tier.points };
  }

  const slot = byId('slot');
  const coupon = byId('entry');
  const markBtn = byId('mark-btn');
  const statusEl = byId('contest-status');
  const thumbs = byId('thumbs');

  let index = 0, marks = [], locked = false;
  let pos = { x: 50, y: 50 }, lastTick = pos;

  const board = createBoard(byId('board-slot'), {
    onInput(p) {
      pos = p;
      if (Math.hypot(p.x - lastTick.x, p.y - lastTick.y) >= 6) { lastTick = p; blip(900, 0.02, 'square', 0.02); }
    },
  });
  const boardSvg = byId('board-slot').querySelector('svg');
  const drawBoard = () => board.update({ marker: pos, target: null, interactive: !locked, revealed: false });

  function drawThumbs() {
    thumbs.innerHTML = CARDS.map((_, i) => PPMail.thumb(marks[i], i === index && !locked)).join('');
  }

  function showClue() {
    const c = CARDS[index];
    pos = lastTick = { x: 50, y: 50 };
    for (const side of ['top', 'bottom', 'left', 'right']) byId('demo-' + side).textContent = c[side];
    byId('demo-clue').textContent = c.clue;
    byId('clue-no').textContent = index + 1;
    markBtn.textContent = index === CARDS.length - 1 ? 'Clip it and mail it' : `Mark it, on to clue ${index + 2}`;
    boardSvg.setAttribute('aria-label', `Clue ${index + 1} of ${CARDS.length}: ${c.clue}. Top is ${c.top}, bottom is ${c.bottom}, left is ${c.left}, right is ${c.right}. Arrow keys move your mark, Enter confirms it.`);
    drawBoard();
    drawThumbs();
    CFG.onCard?.(c);
  }

  function axisWords(value, low, high) {
    const size = Math.abs(value - 50);
    const end = value < 50 ? low : high;
    if (size <= 5) return `midway between ${low} and ${high}`;
    return (size <= 20 ? 'slightly toward ' : size <= 37 ? 'toward ' : 'far toward ') + end;
  }

  function buildReply() {
    const players = ['You', ...RIVALS];
    const sheets = CARDS.map((c, i) => {
      const scored = players.map((name, p) => {
        const pin = p === 0 ? marks[i] : c.rivals[p - 1];
        const s = scoreFor(pin, c.target);
        return { name, x: pin.x, y: pin.y, tier: s.tier, points: s.points, distance: s.distance, isYou: p === 0, team: null };
      });
      const resonance = scored.filter((m) => m.tier === 'Bullseye').length >= 2; // The team's +250 bonus.
      const psychicPoints = Math.round(scored.reduce((sum, m) => sum + m.points, 0) / scored.length) + (resonance ? 250 : 0);
      return {
        heading: `Clue ${i + 1} of ${CARDS.length}`,
        clues: [{ label: 'Ari', text: c.clue }],
        card: c,
        target: c.target,
        marks: scored,
        psychics: [{ name: 'Ari', points: psychicPoints, isYou: false, resonance }],
      };
    });
    const standings = players.map((name, p) => {
      const perRound = sheets.map((s) => s.marks[p].points);
      return { name: p === 0 ? 'You' : name, perRound, total: perRound.reduce((a, b) => a + b, 0), isYou: p === 0 };
    }).sort((a, b) => b.total - a.total); // A stable sort, with you first: a tie goes to the reader.
    standings[0].isWinner = true;
    const winner = standings[0];
    const ordinals = ['first', 'second', 'third', 'fourth'];
    const you = standings.find((s) => s.isYou);
    return {
      sheets,
      columns: CARDS.map((_, i) => `Clue ${i + 1}`),
      standings,
      prizeLine: winner.isYou ? 'You win the ticket to the circus!' : `${winner.name} wins the ticket to the circus.`,
      prizeName: `Awarded to ${winner.isYou ? 'you' : winner.name} · No. 000419`,
      youLine: `You finished ${ordinals[standings.indexOf(you)]} with ${number(you.total)} points. Here is every answer again.`,
      note: 'In this sample, Ari gives every clue and the other players are made up. In a real game, these are your friends. The circus ticket is make-believe.',
    };
  }

  const replyOptions = () => ({
    againLabel: 'Enter again',
    onAgain: resetEntry,
    onClose() { if (locked) byId('read-reply').focus({ preventScroll: true }); },
  });
  const openReply = () => {
    slot.classList.add('is-cut');
    PPReply.open(buildReply(), replyOptions());
  };

  function confirmMark() {
    if (locked) return;
    pos = board.position();
    marks[index] = { ...pos };
    PPMail.paperSound(0.1, 0.16);
    if (index < CARDS.length - 1) {
      index += 1;
      showClue();
      statusEl.textContent = `Marked, with no answer yet. Clue ${index + 1} of ${CARDS.length}: ${CARDS[index].clue}.`;
      return;
    }
    locked = true;
    drawBoard();
    drawThumbs();
    if (still.matches) {
      statusEl.textContent = 'Your entry has been mailed. Your reply has arrived.';
      openReply();
    } else PPMail.runMailroom({ coupon, slot, statusEl, done: openReply });
  }

  markBtn.addEventListener('click', confirmMark);
  const boardSlot = byId('board-slot');
  boardSlot.addEventListener('keydown', (e) => {
    if (locked) return;
    if (e.key === 'Enter') { e.preventDefault(); confirmMark(); }
    else if (e.key.startsWith('Arrow')) {
      const p = board.position(), c = CARDS[index];
      statusEl.textContent = `Mark ${axisWords(p.x, c.left, c.right)}, ${axisWords(p.y, c.top, c.bottom)}.`;
    }
  });

  function resetEntry() {
    index = 0;
    marks = [];
    locked = false;
    slot.classList.remove('is-cut');
    showClue();
    statusEl.textContent = `New entry. Clue 1 of ${CARDS.length}: ${CARDS[0].clue}.`;
    boardSvg.focus({ preventScroll: true });
    slot.scrollIntoView({ block: 'center', behavior: still.matches ? 'auto' : 'smooth' });
  }

  byId('read-reply').addEventListener('click', () => PPReply.reopen(replyOptions()));
  byId('enter-again').addEventListener('click', resetEntry);

  showClue();
})();
