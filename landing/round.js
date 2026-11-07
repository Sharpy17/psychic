/*
 * The sample round: mark all four clues without seeing an answer, mail the
 * entry, and read every answer in the reply. The page reads fine without this file.
 */
(function () {
  "use strict";

  // Where the room buttons go. Until these are set, the buttons say rooms aren't open yet.
  // In JOIN_ROOM_URL, {code} becomes the code the player typed.
  var CREATE_ROOM_URL = "";
  var JOIN_ROOM_URL = "";

  // Distances are on the game's chart, which runs -100 to +100 on each axis.
  // A distance exactly on a limit earns that result.
  var RESULTS = [
    { name: "Bullseye", limit: 15, points: 1000 },
    { name: "Excellent", limit: 35, points: 750 },
    { name: "Great", limit: 60, points: 500 },
    { name: "Close", limit: 90, points: 250 },
    { name: "Miss", limit: Infinity, points: 50 }
  ];

  // The other players are made up for the sample, and the page says so.
  var RIVALS = ["Marge", "Dev", "Sam"];

  // Each target suits its clue and stays within the game's +/-85 bounds.
  var CLUES = [
    {
      text: "A lighthouse in the desert",
      x: ["Ordinary", "Strange"],
      y: ["Sad", "Hopeful"],
      target: { x: 74, y: -22 },
      rivals: [{ x: 60, y: -30 }, { x: 20, y: 10 }, { x: -20, y: 40 }]
    },
    {
      text: "Sunday evening",
      x: ["Restful", "Stressful"],
      y: ["Quiet", "Loud"],
      target: { x: 38, y: -58 },
      rivals: [{ x: 30, y: -50 }, { x: 55, y: -35 }, { x: 10, y: -20 }]
    },
    {
      text: "Taking the last slice",
      x: ["Worthless", "Priceless"],
      y: ["Polite", "Rude"],
      target: { x: 55, y: 46 },
      rivals: [{ x: 40, y: 30 }, { x: 70, y: 20 }, { x: 60, y: -30 }]
    },
    {
      text: "A handwritten letter",
      x: ["Forgettable", "Unforgettable"],
      y: ["Cold", "Warm"],
      target: { x: 62, y: 70 },
      rivals: [{ x: 50, y: 60 }, { x: 30, y: 75 }, { x: 80, y: 30 }]
    }
  ];

  var EDGE = 100;
  var STEP = 2;
  var BIG_STEP = 10;
  var PEN_MARK = "M-7-8C-2-3 3 3 8 8M7-9C2-3-3 3-8 9";
  var CHART_LINES = '<path class="axes" d="M0-100V100M-100 0H100"/><rect class="border" x="-100" y="-100" width="200" height="200"/>';

  var byId = function (id) { return document.getElementById(id); };
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function clamp(value) {
    return Math.max(-EDGE, Math.min(EDGE, value));
  }

  function scoreFor(pin, target) {
    var distance = Math.hypot(pin.x - target.x, pin.y - target.y);
    var result = RESULTS.find(function (r) { return distance <= r.limit; });
    return { distance: distance, name: result.name, points: result.points };
  }

  function number(value) {
    return value.toLocaleString("en-US");
  }

  function describeAxis(value, ends) {
    var size = Math.abs(value);
    var end = value < 0 ? ends[0] : ends[1];
    if (size <= 10) return "midway between " + ends[0] + " and " + ends[1];
    if (size <= 40) return "slightly toward " + end;
    if (size <= 75) return "toward " + end;
    return "far toward " + end;
  }

  function translate(pin) {
    return "translate(" + pin.x + " " + -pin.y + ")";
  }

  /* The entry form --------------------------------------------------------- */

  var chart = byId("chart");
  var chartSvg = chart.querySelector("svg");
  var pinMark = byId("pin");
  var markButton = byId("mark-button");
  var status = byId("status");
  var thumbs = byId("thumbs");
  var slot = byId("slot");
  var hole = byId("hole");
  var coupon = byId("entry-form");
  var letter = byId("letter");

  var index = 0;
  var marks = [];
  var pos = { x: 0, y: 0 };
  var dragging = false;
  var locked = false;

  function drawThumbs() {
    thumbs.innerHTML = CLUES.map(function (clue, i) {
      var classes = "thumb" + (marks[i] ? " is-marked" : "") + (i === index && !locked ? " is-current" : "");
      var mark = marks[i] ? '<path class="pen-mark" transform="' + translate(marks[i]) + '" d="' + PEN_MARK + '"/>' : "";
      return '<svg class="' + classes + '" viewBox="-104 -104 208 208">' + CHART_LINES + mark + "</svg>";
    }).join("");
  }

  function drawPin() {
    pinMark.setAttribute("transform", translate(pos));
  }

  function actionLabel() {
    return index === CLUES.length - 1 ? "Clip it and mail it" : "Mark it and see clue " + (index + 2);
  }

  function showClue() {
    var clue = CLUES[index];
    pos = { x: 0, y: 0 };
    byId("clue").textContent = clue.text;
    byId("clue-count").textContent = "Clue " + (index + 1) + " of " + CLUES.length;
    byId("end-left").textContent = clue.x[0];
    byId("end-right").textContent = clue.x[1];
    byId("end-bottom").textContent = clue.y[0];
    byId("end-top").textContent = clue.y[1];
    chart.setAttribute(
      "aria-label",
      "Sample chart for clue " + (index + 1) + " of " + CLUES.length + ": " + clue.text +
        ". Left to right runs " + clue.x[0] + " to " + clue.x[1] +
        ". Bottom to top runs " + clue.y[0] + " to " + clue.y[1] +
        ". Arrow keys move your mark, Shift and an arrow key moves it further, Enter confirms it."
    );
    markButton.textContent = actionLabel();
    drawPin();
    drawThumbs();
  }

  function announcePin() {
    var clue = CLUES[index];
    status.textContent = "Mark " + describeAxis(pos.x, clue.x) + ", " + describeAxis(pos.y, clue.y) + ".";
  }

  function confirmMark() {
    if (locked) return;
    marks[index] = { x: pos.x, y: pos.y };
    if (index < CLUES.length - 1) {
      index += 1;
      showClue();
      status.textContent = "Marked, with no answer yet. Clue " + (index + 1) + " of " + CLUES.length + ": " + CLUES[index].text + ".";
      return;
    }
    locked = true;
    drawThumbs();
    mailEntry();
  }

  function movePinTo(event) {
    var box = chartSvg.getBoundingClientRect();
    pos = {
      x: clamp(Math.round(((event.clientX - box.left) / box.width) * 200 - 100)),
      y: clamp(Math.round(100 - ((event.clientY - box.top) / box.height) * 200))
    };
    drawPin();
  }

  chart.addEventListener("pointerdown", function (event) {
    if (locked || event.button !== 0) return;
    dragging = true;
    chart.setPointerCapture(event.pointerId);
    movePinTo(event);
  });

  chart.addEventListener("pointermove", function (event) {
    if (dragging) movePinTo(event);
  });

  function stopDragging() {
    if (!dragging) return;
    dragging = false;
    announcePin();
  }
  chart.addEventListener("pointerup", stopDragging);
  chart.addEventListener("pointercancel", stopDragging);

  var ARROWS = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, 1],
    ArrowDown: [0, -1]
  };

  chart.addEventListener("keydown", function (event) {
    if (locked) return;
    if (event.key === "Enter") {
      event.preventDefault();
      confirmMark();
      return;
    }
    var arrow = ARROWS[event.key];
    if (!arrow) return;
    event.preventDefault();
    var step = event.shiftKey ? BIG_STEP : STEP;
    pos = { x: clamp(pos.x + arrow[0] * step), y: clamp(pos.y + arrow[1] * step) };
    drawPin();
    announcePin();
  });

  markButton.addEventListener("click", confirmMark);

  function resetEntry() {
    index = 0;
    marks = [];
    locked = false;
    slot.classList.remove("is-cut");
    hole.hidden = true;
    showClue();
    status.textContent = "New entry. Clue 1 of " + CLUES.length + ": " + CLUES[0].text + ".";
    chart.focus({ preventScroll: true });
    slot.scrollIntoView({ block: "center", behavior: reducedMotion.matches ? "auto" : "smooth" });
  }

  /* The mail-in sequence --------------------------------------------------- */

  function make(tag, className, parent, html) {
    var element = document.createElement(tag);
    element.className = className;
    if (html) element.innerHTML = html;
    if (parent) parent.appendChild(element);
    return element;
  }

  function place(element, left, top, width, height) {
    element.style.left = left + "px";
    element.style.top = top + "px";
    element.style.width = width + "px";
    element.style.height = height + "px";
  }

  // A copy of the form, with nothing focusable or duplicated by id.
  function copyOfCoupon(width) {
    var copy = coupon.cloneNode(true);
    copy.removeAttribute("id");
    copy.removeAttribute("aria-labelledby");
    copy.querySelectorAll("[id]").forEach(function (el) { el.removeAttribute("id"); });
    copy.querySelectorAll("[tabindex]").forEach(function (el) { el.removeAttribute("tabindex"); });
    copy.inert = true;
    copy.style.width = width + "px";
    return copy;
  }

  function mailEntry() {
    if (reducedMotion.matches) {
      slot.classList.add("is-cut");
      status.textContent = "Your entry has been mailed. Your reply has arrived.";
      openLetter();
      return;
    }
    runMailroom();
  }

  function runMailroom() {
    var finished = false;
    var skipped = false;
    var timers = [];

    // "instant", because "auto" would follow the page's smooth scrolling.
    coupon.scrollIntoView({ block: "center", behavior: "instant" });
    document.documentElement.classList.add("is-mailing");

    var rect;
    var room = make("div", "mailroom", document.body);

    var skipButton = make("button", "button button-plain mailroom-skip", null, "Skip to the results");
    skipButton.type = "button";
    room.setAttribute("role", "group");
    room.setAttribute("aria-label", "Your entry is being mailed");

    var caption = make("p", "mailroom-caption", room);
    room.appendChild(skipButton);
    skipButton.focus({ preventScroll: true });

    function animate(element, frames, duration, options) {
      var settings = Object.assign({ duration: skipped ? 0 : duration, easing: "ease-in-out", fill: "forwards" }, options || {});
      if (skipped) settings.delay = 0;
      return element.animate(frames, settings).finished.catch(function () {});
    }

    function pause(ms) {
      if (skipped) return Promise.resolve();
      return new Promise(function (resolve) { timers.push(setTimeout(resolve, ms)); });
    }

    var scale = Math.min(1, innerWidth / 680, innerHeight / 620);
    var cx = innerWidth / 2;
    var cy = innerHeight / 2 - 50;
    var envW = 300 * scale;
    var envH = 190 * scale;
    var envX = cx - envW / 2;
    var envY = cy + 30 * scale - envH / 2;

    function makeEnvelope(className, html) {
      var envelope = make("div", "env-part env-address " + className, room, html);
      place(envelope, envX, envY, envW, envH);
      envelope.style.padding = envH * 0.5 + "px 8px 0 " + envW * 0.2 + "px";
      envelope.style.setProperty("--address-size", Math.max(9, 13 * scale) + "px");
      return envelope;
    }

    function finish() {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      var leftover = slot.querySelector(".cut-path");
      if (leftover) leftover.remove();
      room.remove();
      document.documentElement.classList.remove("is-mailing");
      status.textContent = "Your entry has been mailed. Your reply has arrived.";
      openLetter();
    }

    skipButton.addEventListener("click", function () {
      skipped = true;
      slot.classList.add("is-cut");
      finish();
    });

    /* Each step reads as one action and waits for the last. */
    async function play() {
      // Cut along the dashed line.
      caption.textContent = "Cut out your entry";
      // This sits on the form itself, so it stays on the dashed line wherever the page is.
      var cutPath = make("div", "cut-path", slot);
      cutPath.innerHTML = '<svg class="cut-scissors" viewBox="0 0 40 24"><use href="#snip"/></svg>';
      var scissors = cutPath.firstChild;
      scissors.style.offsetPath = 'path("M0 0H' + coupon.offsetWidth + "V" + coupon.offsetHeight + 'H0Z")';
      await animate(scissors, [{ offsetDistance: "0%" }, { offsetDistance: "100%" }], 1700, { easing: "linear" });
      if (finished) return;
      cutPath.remove();

      // Lift the piece out of the page, leaving the hole behind. Measure now, not earlier.
      rect = coupon.getBoundingClientRect();
      var piece = make("div", "piece", room);
      place(piece, 0, 0, rect.width, rect.height);
      var halfH = rect.height / 2;
      var top = make("div", "half half-top", piece);
      var bottom = make("div", "half half-bottom", piece);
      top.style.height = halfH + "px";
      bottom.style.height = halfH + "px";
      top.appendChild(copyOfCoupon(rect.width));
      bottom.appendChild(copyOfCoupon(rect.width));
      var back = make("div", "paper-back", top);
      slot.classList.add("is-cut");

      var size = Math.min((240 * scale) / rect.width, (320 * scale) / rect.height);
      var pieceW = rect.width * size;
      var pieceH = rect.height * size;
      var atRest = "translate(" + rect.left + "px," + rect.top + "px) scale(1)";
      var centreX = cx - pieceW / 2;
      var centred = "translate(" + centreX + "px," + (cy - pieceH / 2) + "px) scale(" + size + ")";

      // Let the hole in the page register before the room dims.
      animate(room, [{ backgroundColor: "rgb(26 23 20 / 0)" }, { backgroundColor: "rgb(26 23 20 / .8)" }], 700, { delay: 420 });
      await animate(piece, [{ transform: atRest }, { transform: centred }], 950);
      if (finished) return;

      // Fold it. The back of the paper hides the marks.
      caption.textContent = "Fold it";
      animate(back, [{ opacity: 0 }, { opacity: 0, offset: 0.49 }, { opacity: 1, offset: 0.5 }, { opacity: 1 }], 750, { easing: "linear" });
      await animate(top, [{ transform: "perspective(1400px) rotateX(0deg)" }, { transform: "perspective(1400px) rotateX(-180deg)" }], 750);
      if (finished) return;
      await pause(120);

      // Hold it over an open envelope.
      caption.textContent = "Seal the envelope";
      var envBack = make("div", "env-part env-back", room);
      var envFront = make("div", "env-part env-front", room);
      var envFlap = make("div", "env-part env-flap", room);
      place(envBack, envX, envY, envW, envH);
      place(envFront, envX, envY, envW, envH);
      place(envFlap, envX, envY, envW, envH * 0.55);
      var flapOpen = "perspective(900px) rotateX(-178deg)";
      var flapShut = "perspective(900px) rotateX(0deg)";
      envFlap.style.transform = flapOpen;
      var appear = [{ opacity: 0 }, { opacity: 1 }];
      animate(envBack, appear, 300);
      animate(envFront, appear, 300);
      animate(envFlap, [{ opacity: 0, transform: flapOpen }, { opacity: 1, transform: flapOpen }], 300);

      // The folded half is the lower half of the piece, so aim that into the pocket.
      var above = envY - 40 * scale - pieceH * 0.75;
      var inside = envY + envH * 0.55 - pieceH * 0.75;
      var overEnvelope = "translate(" + centreX + "px," + above + "px) scale(" + size + ")";
      var inEnvelope = "translate(" + centreX + "px," + inside + "px) scale(" + size + ")";
      await animate(piece, [{ transform: centred }, { transform: overEnvelope }], 380);
      if (finished) return;
      await animate(piece, [{ transform: overEnvelope }, { transform: inEnvelope }], 520);
      if (finished) return;

      envFlap.style.zIndex = 4;
      await animate(envFlap, [{ opacity: 1, transform: flapOpen }, { opacity: 1, transform: flapShut }], 480);
      if (finished) return;
      piece.remove();
      envBack.remove();

      // Turn it over to the address side.
      var addressed = makeEnvelope("", "THE PSYCHIC PLANE<br>CONTEST DESK<br>P.O. BOX 8, ANYTOWN");
      addressed.style.transform = "scaleX(0)";
      animate(envFront, [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], 170, { easing: "ease-in" });
      await animate(envFlap, [{ opacity: 1, transform: flapShut + " scaleX(1)" }, { opacity: 1, transform: flapShut + " scaleX(0)" }], 170, { easing: "ease-in" });
      if (finished) return;
      envFront.remove();
      envFlap.remove();
      await animate(addressed, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 170, { easing: "ease-out" });
      if (finished) return;

      // Stamp and postmark.
      caption.textContent = "Stamp it";
      var stamp = make("span", "env-stamp", addressed, "20<br>POST");
      await animate(stamp, [{ opacity: 0, transform: "scale(2.6) rotate(-10deg)" }, { opacity: 1, transform: "none" }], 240, { easing: "ease-in" });
      if (finished) return;
      var postmark = make("span", "env-postmark", addressed, "MAR 17<br>1984");
      await animate(postmark, [{ opacity: 0, transform: "rotate(-14deg) scale(1.5)" }, { opacity: 1, transform: "rotate(-14deg)" }], 150, { easing: "ease-in" });
      if (finished) return;
      await pause(280);

      // Post it.
      caption.textContent = "Post it";
      var boxW = 150 * scale;
      var boxH = 250 * scale;
      var boxX = Math.min(innerWidth - boxW - 12, cx + 170 * scale);
      var boxY = Math.max(10, cy + 130 * scale - boxH);
      var box = make("div", "postbox", room,
        '<svg viewBox="0 0 150 250" aria-hidden="true"><path d="M8 232V60C8-10 142-10 142 60v172z" fill="#e7dcbc"/><path d="M8 232V60C8-10 142-10 142 60v172z" fill="url(#tone-dark)" stroke="#e7dcbc" stroke-width="3"/><rect x="28" y="68" width="94" height="13" fill="#1a1714" stroke="#e7dcbc" stroke-width="2"/><rect x="40" y="118" width="70" height="52" fill="#e7dcbc"/><path d="M24 232v16M126 232v16" stroke="#e7dcbc" stroke-width="10"/></svg>');
      place(box, boxX, boxY, boxW, boxH);
      await animate(box, [{ transform: "translateX(" + (innerWidth - boxX + 20) + "px)" }, { transform: "none" }], 380);
      if (finished) return;
      var slotX = boxX + boxW / 2 - (envX + envW / 2);
      var slotY = boxY + boxH * 0.3 - (envY + envH / 2);
      await animate(addressed, [
        { transform: "none", opacity: 1 },
        { transform: "translate(" + slotX + "px," + slotY + "px) rotate(5deg) scale(.32)", opacity: 1, offset: 0.85 },
        { transform: "translate(" + slotX + "px," + (slotY + 6) + "px) rotate(5deg) scale(.24)", opacity: 0 }
      ], 620);
      if (finished) return;
      addressed.remove();
      await animate(box, [{ transform: "rotate(0)" }, { transform: "rotate(1.6deg)" }, { transform: "rotate(-1.2deg)" }, { transform: "rotate(0)" }], 280);
      if (finished) return;
      await animate(box, [{ transform: "none" }, { transform: "translateX(" + (innerWidth - boxX + 20) + "px)" }], 320);
      if (finished) return;
      box.remove();

      // The wait: the whole point of the game.
      caption.textContent = "";
      animate(room, [{ backgroundColor: "rgb(26 23 20 / .8)" }, { backgroundColor: "rgb(26 23 20 / .95)" }], 300);
      var days = make("p", "days", room);
      days.style.top = cy - 30 + "px";
      var dates = ["Sunday, March 18", "Monday, March 19", "Tuesday, March 20", "Wednesday, March 21"];
      for (var i = 0; i < dates.length; i += 1) {
        days.textContent = dates[i];
        await pause(520);
        if (finished) return;
      }
      days.remove();

      // The reply comes back.
      caption.textContent = "The answers arrive";
      var reply = makeEnvelope("reply-envelope", 'TO: YOU<br>YOUR STREET<br>YOUR TOWN<span class="env-stamp">20<br>POST</span><span class="env-postmark">MAR 20<br>1984</span>');
      await animate(reply, [
        { transform: "translate(-" + (envX + envW + 40) + "px,-" + (envH * 0.6) + "px) rotate(-14deg)" },
        { transform: "none" }
      ], 620, { easing: "cubic-bezier(.2,.7,.2,1)" });
      if (finished) return;
      await pause(650);
      finish();
    }

    play();
  }

  /* The reply: one clue at a time, one player at a time ------------------- */

  var results = null;
  var revealRound = 0;
  var revealFinished = false;
  var stepTimers = [];
  var stepQueue = [];
  var stepsDone = null;
  var letterStatus = byId("letter-status");

  function buildResults() {
    var players = [{ name: "You", isYou: true, scores: [] }].concat(RIVALS.map(function (name) {
      return { name: name, isYou: false, scores: [] };
    }));
    CLUES.forEach(function (clue, i) {
      players[0].scores.push(scoreFor(marks[i], clue.target));
      RIVALS.forEach(function (name, r) {
        players[r + 1].scores.push(scoreFor(clue.rivals[r], clue.target));
      });
    });
    players.forEach(function (player) {
      player.total = player.scores.reduce(function (sum, score) { return sum + score.points; }, 0);
    });
    var ranked = players.slice().sort(function (a, b) { return b.total - a.total; });
    return { players: players, ranked: ranked };
  }

  function totalBefore(player, round) {
    return player.scores.slice(0, round).reduce(function (sum, score) { return sum + score.points; }, 0);
  }

  // Each step runs, then waits. With reduced motion they all run at once.
  function runSteps(steps, done) {
    stopSteps();
    stepQueue = steps.slice();
    stepsDone = done;
    if (reducedMotion.matches) flushSteps();
    else nextStep();
  }

  function nextStep() {
    if (!stepQueue.length) {
      var done = stepsDone;
      stepsDone = null;
      if (done) done();
      return;
    }
    var step = stepQueue.shift();
    step.run();
    stepTimers.push(setTimeout(nextStep, step.wait));
  }

  function flushSteps() {
    stepTimers.forEach(clearTimeout);
    stepTimers = [];
    while (stepQueue.length) stepQueue.shift().run();
    nextStep();
  }

  function stopSteps() {
    stepTimers.forEach(clearTimeout);
    stepTimers = [];
    stepQueue = [];
    stepsDone = null;
  }

  function showIn(element) {
    element.classList.add("is-in");
  }

  function showRound(round) {
    var clue = CLUES[round];
    var mark = marks[round];
    var nextButton = byId("reveal-next");
    revealRound = round;

    byId("reveal-view").hidden = false;
    byId("final-view").hidden = true;
    byId("letter-title").textContent = "Here are your results";
    byId("reveal-count").textContent = "Clue " + (round + 1) + " of " + CLUES.length;
    byId("reveal-clue").textContent = clue.text;
    byId("reveal-note").textContent = "";
    nextButton.textContent = "Show this clue now";

    // Only the marks are written in now. The target and scores arrive at their step.
    var marksSvg = '<g transform="' + translate(mark) + '"><path class="pen-mark step mark-drop" data-mark="0" d="' + PEN_MARK + '"/></g>' +
      clue.rivals.map(function (pin, r) {
        return '<g transform="' + translate(pin) + '"><g class="step mark-drop" data-mark="' + (r + 1) + '">' +
          '<circle class="reveal-rival-dot" r="7.5"/><text class="reveal-rival-letter" text-anchor="middle" y="3.6">' + RIVALS[r][0] + "</text></g></g>";
      }).join("");

    byId("reveal-chart").innerHTML =
      '<svg viewBox="-100 -100 200 200" role="img" aria-label="Chart for ' + clue.text + ", from " + clue.x[0] + " to " + clue.x[1] + " and " + clue.y[0] + " to " + clue.y[1] + '">' +
      '<defs><clipPath id="reveal-edge"><rect x="-100" y="-100" width="200" height="200"/></clipPath></defs>' +
      '<path class="grid" d="M-80-100V100M-60-100V100M-40-100V100M-20-100V100M20-100V100M40-100V100M60-100V100M80-100V100M-100-80H100M-100-60H100M-100-40H100M-100-20H100M-100 20H100M-100 40H100M-100 60H100M-100 80H100"/>' +
      CHART_LINES +
      '<g id="reveal-answer" clip-path="url(#reveal-edge)"></g>' + marksSvg + "</svg>" +
      '<span class="axis axis-top">' + clue.y[1] + '</span><span class="axis axis-bottom">' + clue.y[0] + "</span>" +
      '<span class="axis axis-left">' + clue.x[0] + '</span><span class="axis axis-right">' + clue.x[1] + "</span>";

    byId("roster").innerHTML = results.players.map(function (player, p) {
      var key = player.isYou
        ? '<svg viewBox="-10 -10 20 20" aria-hidden="true"><path class="pen-mark" d="' + PEN_MARK + '"/></svg>'
        : player.name[0];
      return '<li class="roster-row' + (player.isYou ? " is-you" : "") + '" data-player="' + p + '">' +
        '<span class="roster-key" aria-hidden="true">' + key + "</span>" +
        '<span class="roster-name">' + player.name + "</span>" +
        '<span class="roster-result">Sealed</span>' +
        '<span class="roster-total">' + number(totalBefore(player, round)) + "</span></li>";
    }).join("");

    var chartEl = byId("reveal-chart");
    var rosterEl = byId("roster");
    function row(p) { return rosterEl.querySelector('[data-player="' + p + '"]'); }

    var steps = [];

    // Yours first, since you already know it. Then each friend, one at a time.
    results.players.forEach(function (player, p) {
      steps.push({
        wait: p === results.players.length - 1 ? 1300 : 1050,
        run: function () {
          showIn(chartEl.querySelector('[data-mark="' + p + '"]'));
          row(p).querySelector(".roster-result").textContent = "Marked";
          var pin = p === 0 ? mark : clue.rivals[p - 1];
          letterStatus.textContent = player.name + " marked " + describeAxis(pin.x, clue.x) + ", " + describeAxis(pin.y, clue.y) + ".";
        }
      });
    });

    // Then the target, which nobody has seen until this moment.
    steps.push({
      wait: 1300,
      run: function () {
        byId("reveal-answer").innerHTML = '<g transform="' + translate(clue.target) + '">' +
          '<circle class="reveal-ring" r="90"/><circle class="reveal-ring" r="60"/><circle class="reveal-ring" r="35"/><circle class="reveal-ring" r="15"/></g>' +
          '<line class="reveal-line" x1="' + mark.x + '" y1="' + -mark.y + '" x2="' + clue.target.x + '" y2="' + -clue.target.y + '"/>' +
          '<g transform="' + translate(clue.target) + '"><circle class="reveal-target mark-drop is-in" r="4.5"/></g>';
        letterStatus.textContent = "The target is " + describeAxis(clue.target.x, clue.x) + ", " + describeAxis(clue.target.y, clue.y) + ".";
      }
    });

    // Then the scores, one player at a time.
    results.players.forEach(function (player, p) {
      steps.push({
        wait: 620,
        run: function () {
          var score = player.scores[round];
          var line = row(p);
          line.classList.add("is-scored");
          line.querySelector(".roster-result").textContent = score.name + ", " + number(score.points);
          line.querySelector(".roster-total").textContent = number(totalBefore(player, round + 1));
          letterStatus.textContent = player.name + ": " + score.name + ", " + number(score.points) + " points.";
        }
      });
    });

    steps.push({
      wait: 0,
      run: function () {
        var yours = results.players[0].scores[round];
        byId("reveal-note").textContent = "Your mark landed " + Math.round(yours.distance * 10) / 10 + " units from the target.";
      }
    });

    letter.scrollTop = 0;
    runSteps(steps, function () {
      nextButton.textContent = round < CLUES.length - 1 ? "Open clue " + (round + 2) : "See the final standings";
    });
  }

  function showFinal(animated) {
    stopSteps();
    revealFinished = true;
    var ranked = results.ranked;
    var you = results.players[0];
    var place = ranked.indexOf(you) + 1;
    var ordinals = ["first", "second", "third", "fourth"];
    var rest = byId("final-rest");

    byId("reveal-view").hidden = true;
    byId("final-view").hidden = false;
    byId("letter-title").textContent = "Final standings";
    byId("letter-title").focus({ preventScroll: true });
    letter.scrollTop = 0;

    byId("letter-intro").textContent = "You finished " + ordinals[place - 1] + " with " + number(you.total) + " points. Here is every answer again.";

    byId("standings-head").innerHTML = '<tr><th scope="col">Player</th>' + CLUES.map(function (c, i) {
      return '<th scope="col">Clue ' + (i + 1) + "</th>";
    }).join("") + '<th scope="col">Total</th></tr>';

    byId("standings-body").innerHTML = ranked.map(function (player) {
      return "<tr" + (player.isYou ? ' class="is-you"' : "") + '><th scope="row">' + player.name + "</th>" +
        player.scores.map(function (score) { return "<td>" + number(score.points) + "</td>"; }).join("") +
        "<td>" + number(player.total) + "</td></tr>";
    }).join("");

    byId("answers").innerHTML = CLUES.map(function (clue, i) {
      var mark = marks[i];
      var score = you.scores[i];
      var rivals = clue.rivals.map(function (pin, r) {
        return '<circle class="answer-rival" r="11" transform="' + translate(pin) + '"/>' +
          '<text class="answer-rival-name" text-anchor="middle" x="' + pin.x + '" y="' + (-pin.y + 6) + '">' + RIVALS[r][0] + "</text>";
      }).join("");
      var picture = '<svg viewBox="-104 -104 208 208" role="img" aria-label="Chart for ' + clue.text + ", showing the target and each player's mark\">" +
        '<path class="grid" d="M-50-100V100M50-100V100M-100-50H100M-100 50H100"/>' + CHART_LINES + rivals +
        '<line class="answer-line" x1="' + mark.x + '" y1="' + -mark.y + '" x2="' + clue.target.x + '" y2="' + -clue.target.y + '"/>' +
        '<circle class="answer-target" r="6" transform="' + translate(clue.target) + '"/>' +
        '<path class="pen-mark" transform="' + translate(mark) + '" d="' + PEN_MARK + '"/></svg>';
      var away = Math.round(score.distance * 10) / 10;
      return '<div class="answer">' + picture + "<div><h3>" + clue.text + "</h3>" +
        "<p>" + clue.x[0] + " to " + clue.x[1] + ", " + clue.y[0] + " to " + clue.y[1] + "</p>" +
        '<p class="you-result">You: ' + score.name + ", " + number(score.points) + " points, " + away + " units away.</p>" +
        "</div></div>";
    }).join("");

    if (!animated || reducedMotion.matches) {
      rest.hidden = false;
      return;
    }

    // Last place first, so the winner is the last name you read.
    rest.hidden = true;
    var rows = Array.prototype.slice.call(byId("standings-body").rows);
    rows.forEach(function (tableRow) { tableRow.classList.add("is-waiting"); });
    var steps = rows.slice().reverse().map(function (tableRow, n) {
      var player = ranked[rows.length - 1 - n];
      return {
        wait: n === rows.length - 2 ? 1500 : 1000,
        run: function () {
          tableRow.classList.remove("is-waiting");
          tableRow.classList.add("is-arriving");
          letterStatus.textContent = "In " + ordinals[rows.length - 1 - n] + " place, " + player.name + ", with " + number(player.total) + " points.";
        }
      };
    });
    runSteps(steps, function () { rest.hidden = false; });
  }

  function openLetter() {
    results = buildResults();
    revealFinished = false;
    hole.hidden = false;
    slot.classList.add("is-cut");
    letter.showModal();
    showRound(0);
  }

  byId("reveal-next").addEventListener("click", function () {
    // While a clue is still opening, this button shows the rest of it straight away.
    if (stepsDone) {
      flushSteps();
      return;
    }
    if (revealRound < CLUES.length - 1) showRound(revealRound + 1);
    else showFinal(true);
  });

  byId("reveal-skip").addEventListener("click", function () { showFinal(false); });

  byId("letter-close").addEventListener("click", function () { letter.close(); });

  byId("letter-again").addEventListener("click", function () {
    letter.close();
    resetEntry();
  });

  letter.addEventListener("close", function () {
    stopSteps();
    if (locked) byId("read-reply").focus({ preventScroll: true });
  });

  byId("read-reply").addEventListener("click", function () {
    letter.showModal();
    if (revealFinished) showFinal(false);
    else showRound(revealRound);
  });

  byId("enter-again").addEventListener("click", resetEntry);

  /* Sample round links ------------------------------------------------------ */

  document.querySelectorAll("[data-play]").forEach(function (link) {
    // On a wide screen the form may already be in view, so scrolling alone
    // would look like nothing happened. Pulse the mark too.
    link.addEventListener("click", function (event) {
      // Scroll here rather than following the link, which would clear the chart's focus.
      event.preventDefault();
      slot.scrollIntoView({ block: "center", behavior: reducedMotion.matches ? "auto" : "smooth" });
      if (locked) {
        byId("read-reply").focus({ preventScroll: true });
        return;
      }
      chart.focus({ preventScroll: true });
      chart.classList.remove("is-called");
      void chart.getBoundingClientRect();
      chart.classList.add("is-called");
    });
  });

  /* Create or join a room ---------------------------------------------------- */

  var ROOMS_NOT_OPEN = "Rooms aren't open yet. Try the sample round for now.";
  var CODE_PATTERN = /^[A-Z0-9]{4}$/;

  document.querySelectorAll(".rooms").forEach(function (rooms) {
    var input = rooms.querySelector(".room-code");
    var message = rooms.querySelector(".rooms-message");

    function say(text, isError) {
      message.textContent = text;
      message.classList.toggle("is-error", Boolean(isError));
    }

    rooms.querySelector("[data-room-create]").addEventListener("click", function () {
      input.removeAttribute("aria-invalid");
      if (CREATE_ROOM_URL) window.location.assign(CREATE_ROOM_URL);
      else say(ROOMS_NOT_OPEN);
    });

    input.addEventListener("input", function () {
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      input.removeAttribute("aria-invalid");
      say("");
    });

    rooms.querySelector(".join-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var code = input.value.trim().toUpperCase();
      if (!CODE_PATTERN.test(code)) {
        input.setAttribute("aria-invalid", "true");
        say("Enter the 4-character code from whoever created the room.", true);
        input.focus();
        return;
      }
      if (JOIN_ROOM_URL) window.location.assign(JOIN_ROOM_URL.replace("{code}", encodeURIComponent(code)));
      else say(ROOMS_NOT_OPEN);
    });
  });

  /* Sketches: each refresh deals a random one per picture, and readers can flip through the rest. */

  var SKETCHES = {
    waiting: [
      { file: "waiting", w: 560, h: 540, caption: "Day three. A local player waits by the mailbox.", alt: "Brush pen sketch of a person in a hat and heavy coat hunched on a step, chin on fist, waiting by a mailbox." },
      { file: "calendar", w: 560, h: 480, caption: "Five days crossed off. Still no reply.", alt: "Brush pen sketch of a hand crossing off the days on a March wall calendar, each cross more impatient than the last." },
      { file: "cobweb", w: 600, h: 480, caption: "Nothing today. Nothing yesterday either.", alt: "Brush pen sketch of an empty mailbox with its door hanging open, a cobweb across the opening and a small spider dangling." },
      { file: "window", w: 560, h: 560, caption: "Watching the street for the mail truck.", alt: "Brush pen sketch from behind of a person in a hat and dark coat standing at a window, watching the street." }
    ],
    cutting: [
      { file: "cutting", w: 680, h: 460, caption: "Cut along the dashed line.", alt: "Sketch of a hand and dark coat sleeve working a large pair of scissors along the dashed line of a newspaper contest entry." },
      { file: "marking", w: 600, h: 480, caption: "One clue, one X, no second thoughts.", alt: "Brush pen sketch of a hand and dark sleeve inking a heavy X onto a two-axis chart." },
      { file: "hole", w: 620, h: 460, caption: "The page, once the entry has gone.", alt: "Sketch of a newspaper with a neat rectangular hole cut out of it, and a pair of scissors left lying on top." },
      { file: "clippings", w: 620, h: 500, caption: "Four clues marked. Not one answer.", alt: "Sketch of four clipped contest entries scattered on a table, each with a heavy X inked on its chart." }
    ],
    results: [
      { file: "results", w: 600, h: 500, caption: "The reply arrives. Someone is about to be insufferable.", alt: "Sketch of a person with dark curly hair, glasses and raised eyebrows peering wide-eyed over a large letter headed Results." },
      { file: "opening", w: 640, h: 500, caption: "Nobody has ever opened one of these slowly.", alt: "Brush pen sketch of two hands in dark sleeves tearing open an envelope, with a letter headed Results rising out of it." },
      { file: "circled", w: 560, h: 560, caption: "Some results get read more than once.", alt: "Sketch of a results letter with one name in the rankings circled over and over in heavy pen, and an exclamation mark beside it." },
      { file: "reveal", w: 540, h: 540, caption: "The target, at last. Some were closer than others.", alt: "Sketch of a chart with the target finally revealed inside its scoring rings, surrounded by one X and three other players' lettered marks." }
    ],
    posting: [
      { file: "posting", w: 520, h: 580, caption: "An entry goes in. There is no getting it back now.", alt: "Brush pen sketch of a person seen from behind in a hat and long dark coat, reaching up to post an envelope into a street mailbox." },
      { file: "carrier", w: 520, h: 580, caption: "Your answers are in that bag somewhere.", alt: "Brush pen sketch of a mail carrier in a peaked cap striding along with a bag stuffed with envelopes, holding out a letter." },
      { file: "stamped", w: 620, h: 420, caption: "Stamped, postmarked and out of your hands.", alt: "Sketch of a contest entry envelope up close, with a solid perforated stamp and a heavy postmark cancelling it." },
      { file: "truck", w: 700, h: 420, caption: "Out on the morning truck. No turning back.", alt: "Brush pen sketch of a boxy mail truck speeding along a road, with a letter bouncing out of the back." }
    ]
  };

  document.querySelectorAll("[data-sketches]").forEach(function (figure) {
    var variants = SKETCHES[figure.dataset.sketches];
    var image = figure.querySelector("img");
    var caption = figure.querySelector("figcaption");
    var button = document.createElement("button");
    button.type = "button";
    button.className = "sketch-next";
    caption.after(button);

    function show(position) {
      var sketch = variants[position];
      image.src = "drawings/" + sketch.file + ".svg";
      image.width = sketch.w;
      image.height = sketch.h;
      image.alt = sketch.alt;
      caption.textContent = sketch.caption;
      button.textContent = "Another sketch (" + (position + 1) + " of " + variants.length + ")";
    }

    var current = Math.floor(Math.random() * variants.length);
    show(current);

    button.addEventListener("click", function () {
      current = (current + 1) % variants.length;
      show(current);
      image.classList.remove("is-new");
      void image.getBoundingClientRect();
      image.classList.add("is-new");
      status.textContent = "Now showing: " + variants[current].alt;
    });
  });

  // Browsers fetch a font on first use. Fetch the handwriting now, so the
  // mailed note doesn't appear in a fallback font and then jump.
  if (document.fonts) document.fonts.load('3rem "Reenie Beanie"');

  showClue();
})();
