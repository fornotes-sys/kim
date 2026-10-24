/* ==========================================================================
   «Сложи сруб» для телефона: пирамидка, которую держат наклоном.
   На компьютере не включается — там живая иллюстрация (chapel-toy.js).

   Кран качает бревно над срубом. Ведёшь пальцем вниз — трос опускается,
   вверх — поднимается (не быстрее лебёдки). Где коснулось — там и легло, а коснуться надо при ровном
   телефоне, иначе бревно ляжет одним концом и соскочит. Сдвиг от середины
   смещает центр тяжести, и сруб начинает клониться. Наклон телефона наклоняет «землю» — им сруб и удерживают.
   Наклон читается с датчика движения (на iPhone — после разрешения),
   без датчика его задают пальцем по полоске-уровню внизу.
   Сруб наклонился слишком сильно — верхние брёвна раскатываются.
   Восемь венцов — и часовня готова.
   ========================================================================== */
(function () {
  'use strict';

  var media = document.querySelector('.build__media');
  if (!media || !window.matchMedia || !window.requestAnimationFrame) return;
  var DESKTOP = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Параметры ---------- */
  var GOAL = 8;
  var LL = 232, LR = 11, STEP = 21;          // бревно: длина, радиус, шаг венца
  var CX = 206, GY = 600;                    // центр сруба и уровень земли (мир 412 × 600)
  var BASE_Y = GY - 20;                      // верх фундамента
  var OVERLAP = LL * 0.42;                   // дальше — бревно не удержится и упадёт
  var PERFECT = 9;                           // «ровно», если сдвиг меньше
  var MAX_TILT = 24;                         // предел наклона «земли», °
  var FALL_LEAN = 11;                        // при таком наклоне сруба верх рассыпается, °

  var NS = 'http://www.w3.org/2000/svg', PI = Math.PI, DEG = 180 / PI;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function plural(n, f) { var a = Math.abs(n) % 100, b = a % 10; return f[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b > 1 && b < 5 ? 1 : 2]; }
  function sv(tag, attrs, parent, html) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function setT(e, x, y, r) { e.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')' + (r ? ' rotate(' + r.toFixed(2) + ')' : '')); }
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* нет вибрации */ } }

  /* ---------- Звук ---------- */
  var AC = null, muted = false;
  function tone(f, dur, vol, f2, type) {
    if (muted) return;
    try {
      if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return; AC = new C(); }
      if (AC.state === 'suspended') AC.resume();
      var t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + .05);
    } catch (e) { /* без звука */ }
  }
  var sfx = {
    thud: function () { tone(105, .32, .3, 46); },
    soft: function () { tone(150, .18, .14, 70); },
    perfect: function () { tone(784, .18, .05); tone(1175, .3, .035); },
    creak: function () { tone(rnd(380, 520), .09, .02, 260, 'sawtooth'); },
    bell: function () { [[.5, .1, 4], [1, .12, 3], [1.5, .05, 2], [2, .04, 1.5], [3, .02, 1]].forEach(function (p) { tone(196 * p[0], p[2], p[1]); }); }
  };

  function logMarkup() {
    var a = LL / 2, r = LR;
    return '<path d="M' + (-a) + ' ' + (-r) + 'H' + a + 'A' + (r * .5) + ' ' + r + ' 0 0 1 ' + a + ' ' + r + 'H' + (-a) + 'A' + (r * .5) + ' ' + r + ' 0 0 1 ' + (-a) + ' ' + (-r) + 'Z" fill="url(#cm-log)" stroke="#3E3122" stroke-width="2"/>' +
      '<path d="M' + (-a + 24) + ' ' + (-r * .3) + 'h' + rnd(40, 70).toFixed(0) + 'M' + (a - 96) + ' ' + (r * .35) + 'h' + rnd(40, 60).toFixed(0) + '" stroke="#C4A06C" stroke-width="1"/>' +
      '<ellipse cx="' + (-a + 1) + '" cy="0" rx="' + (r * .42) + '" ry="' + (r * .78) + '" fill="#E9D3A8" stroke="#8C6A3E" stroke-width="1.2"/>' +
      '<ellipse cx="' + (a - 1) + '" cy="0" rx="' + (r * .42) + '" ry="' + (r * .78) + '" fill="#E9D3A8" stroke="#8C6A3E" stroke-width="1.2"/>';
  }

  /* ---------- Состояние ---------- */
  var root, svg, L = {}, ui = {}, built = false, open = false, raf = 0, lastT = 0, launcher;
  var S, tweens = [], parts = [], timers = [];
  function later(fn, ms) { var id = setTimeout(function () { if (open) fn(); }, ms); timers.push(id); }
  function tween(dur, fn, done) { tweens.push({ t0: performance.now(), dur: dur, fn: fn, done: done }); }

  /* ---------- Наклон: датчик или палец ---------- */
  var sensor = { on: false, zero: null, raw: 0, got: false };
  function onOrient(e) {
    if (e.gamma == null) return;
    // gamma — наклон влево-вправо; учитываем поворот экрана
    var ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    var v = ang === 90 ? -e.beta : ang === -90 || ang === 270 ? e.beta : ang === 180 ? -e.gamma : e.gamma;
    if (v == null) return;
    sensor.raw = v; sensor.got = true;
    if (sensor.zero == null) sensor.zero = v;
  }
  function startSensor(done) {
    function attach() {
      window.addEventListener('deviceorientation', onOrient);
      sensor.on = true; sensor.zero = null; sensor.got = false;
      setTimeout(function () { done(sensor.got); }, 900);   // нет событий — значит, датчика нет
    }
    var D = window.DeviceOrientationEvent;
    if (!D) { done(false); return; }
    if (typeof D.requestPermission === 'function') {        // iPhone: разрешение — только по касанию
      D.requestPermission().then(function (st) { if (st === 'granted') attach(); else done(false); }).catch(function () { done(false); });
    } else attach();
  }
  function stopSensor() { window.removeEventListener('deviceorientation', onOrient); sensor.on = false; }

  /* ---------- Окно ---------- */
  function build() {
    root = h('div', 'cm');
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'cm-title');
    root.innerHTML =
      '<header class="cm__head"><h2 id="cm-title">Сложи сруб</h2>' +
        '<button class="cm-icon" type="button" data-cm-sound aria-pressed="true" aria-label="Звук"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path class="cm-wave" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path class="cm-mute" d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>' +
        '<button class="cm-icon" type="button" data-cm-close aria-label="Закрыть"><svg aria-hidden="true"><use href="#i-close"/></svg></button></header>' +
      '<div class="cm__scene" data-cm-scene>' +
        '<dl class="cm-hud"><div><dt>Венец</dt><dd data-cm-crown></dd></div><div><dt>Ровно</dt><dd data-cm-perfect></dd></div><div><dt>Сорвалось</dt><dd data-cm-fails></dd></div></dl>' +
        '<p class="cm-say" data-cm-say role="status" aria-live="polite"></p>' +
        '<svg class="cm-phone" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="rgba(247,242,233,.92)" stroke="#DCCFB8"/><g data-cm-phone><rect x="22" y="12" width="20" height="40" rx="5" fill="none" stroke-width="2.2"/><path d="M29 16h6" stroke-width="2" stroke-linecap="round"/></g><path d="M10 32a22 22 0 0 1 6-15M54 32a22 22 0 0 0-6-15M14 15l2 2 3-1M50 15l-2 2-3-1" fill="none" stroke="#A78345" stroke-width="1.6" stroke-linecap="round"/></svg>' +
        '<div class="cm-card" data-cm-card hidden></div>' +
      '</div>' +
      '<div class="cm__bar"><div class="cm-lbl"><b>Наклон</b><span data-cm-lbl>ровно</span></div>' +
        '<div class="cm-level" data-cm-level><i></i><i></i><span data-cm-bubble></span></div></div>';
    document.body.appendChild(root);
    ['scene', 'crown', 'perfect', 'fails', 'say', 'card', 'lbl', 'level', 'bubble', 'phone', 'sound'].forEach(function (k) { ui[k] = root.querySelector('[data-cm-' + k + ']'); });

    root.querySelector('[data-cm-close]').addEventListener('click', close);
    ui.sound.addEventListener('click', function () { muted = !muted; ui.sound.setAttribute('aria-pressed', String(!muted)); ui.sound.classList.toggle('is-muted', muted); });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cm]'); if (!b) return;
      var a = b.getAttribute('data-cm');
      if (a === 'start') begin();
      else if (a === 'again') { reset(); begin(true); }
      else if (a === 'donate') { close(); var d = document.querySelector('[data-modal-open="donate"]'); if (d) d.click(); }
      else if (a === 'volunteer') { close(); var v = document.querySelector('[data-modal-open="volunteer"]'); if (v) v.click(); }
    });
    document.addEventListener('keydown', function (e) { if (open && e.key === 'Escape' && !document.querySelector('.modal:not([hidden])')) { e.stopImmediatePropagation(); close(); } }, true);

    // наклон пальцем: ведём по полоске-уровню
    var dragging = false;
    function fromBar(e) {
      var r = ui.level.getBoundingClientRect();
      S.finger = clamp(((e.clientX - r.left) / r.width - .5) * 2, -1, 1) * MAX_TILT;
    }
    ui.level.addEventListener('pointerdown', function (e) { if (S.mode !== 'finger') return; dragging = true; try { ui.level.setPointerCapture(e.pointerId); } catch (er) { /* */ } fromBar(e); e.preventDefault(); });
    ui.level.addEventListener('pointermove', function (e) { if (dragging) fromBar(e); });
    ui.level.addEventListener('pointerup', function () { dragging = false; });
    ui.level.addEventListener('pointercancel', function () { dragging = false; });

    // ведёшь пальцем вниз — трос травится, вверх — выбирается; бревно идёт за пальцем,
    // но не быстрее лебёдки
    var holdId = null, lastY = 0;
    ui.scene.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.cm-card, button') || S.phase !== 'play') return;
      holdId = e.pointerId; lastY = e.clientY; S.holding = true; e.preventDefault();
      try { ui.scene.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    });
    ui.scene.addEventListener('pointermove', function (e) {
      if (e.pointerId !== holdId || !S.view) return;
      var k = S.view.h / ui.scene.getBoundingClientRect().height;
      S.target = Math.max(0, S.target + (e.clientY - lastY) * k * 1.15);
      lastY = e.clientY;
    });
    function release(e) { if (e.pointerId === holdId) { holdId = null; if (S) S.holding = false; } }
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    // долгое нажатие на телефоне: без выделения, лупы и меню «Скопировать / Сохранить»
    function noNative(e) { if (!e.target.closest('.cm-card button, .cm__head button')) e.preventDefault(); }
    [ui.scene, ui.level].forEach(function (el) {
      el.addEventListener('touchstart', noNative, { passive: false });
      el.addEventListener('touchmove', noNative, { passive: false });
    });
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    root.addEventListener('selectstart', function (e) { e.preventDefault(); });
    root.addEventListener('dragstart', function (e) { e.preventDefault(); });

    svg = sv('svg', { 'class': 'cm-svg', role: 'img', 'aria-label': 'Сруб часовни на фундаменте, над ним кран с бревном' });
    ui.scene.insertBefore(svg, ui.scene.firstChild);
    sv('defs', null, svg,
      '<linearGradient id="cm-log" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2E3C4"/><stop offset=".45" stop-color="#E6CFA2"/><stop offset="1" stop-color="#C9A570"/></linearGradient>' +
      '<linearGradient id="cm-gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C99A45"/><stop offset=".38" stop-color="#F0D28E"/><stop offset="1" stop-color="#B98A3A"/></linearGradient>' +
      '<radialGradient id="cm-glow"><stop offset="0" stop-color="#F6DFA4" stop-opacity=".95"/><stop offset=".5" stop-color="#EBC877" stop-opacity=".3"/><stop offset="1" stop-color="#EBC877" stop-opacity="0"/></radialGradient>');
    sv('g', { fill: 'none', stroke: '#C9B48E', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, svg, '<path d="M30 190c30-10 60-10 90 0M250 130c24-8 48-8 72 0M120 70c20-7 40-7 60 0"/>');
    sv('g', { fill: 'none', stroke: '#B88A3E', 'stroke-width': 2 }, svg, '<circle cx="350" cy="80" r="26"/><g stroke="#C9A35C" stroke-width="1.4" stroke-linecap="round"><path d="M350 42v-12M350 118v12M312 80h-12M388 80h12"/></g>');
    L.world = sv('g', { fill: 'none', stroke: '#3E3122', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    sv('g', null, L.world,
      '<path d="M-400 600c150 4 300-4 420 0s300-4 400 0 300-2 400 0"/><g stroke="#7E7A4E" stroke-width="1.4"><path d="M30 608l4-10M56 610l3-9M340 609l4-10M370 607l5-11"/></g>' +
      '<g fill="#DAD0BC" stroke-width="2"><rect x="96" y="580" width="34" height="20" rx="2"/><rect x="189" y="580" width="34" height="20" rx="2"/><rect x="282" y="580" width="34" height="20" rx="2"/></g>');
    L.stack = sv('g', null, L.world);
    L.top = sv('g', null, L.world);
    L.crane = sv('g', { fill: 'none', 'stroke-linecap': 'round' }, svg);
    L.rope = sv('path', { stroke: '#6B5130', 'stroke-width': 1.8 }, L.crane);
    L.straps = sv('path', { stroke: '#8C6A3E', 'stroke-width': 1.5 }, L.crane);
    L.hook = sv('path', { d: 'M0 -9v6a5 5 0 1 0 6 5', stroke: '#3E3122', 'stroke-width': 2.2 }, L.crane);
    L.hang = sv('g', null, L.crane);
    L.aim = sv('path', { stroke: '#B88A3E', 'stroke-width': 1.6, 'stroke-dasharray': '4 5' }, svg);
    L.fly = sv('g', null, svg);
    L.fx = sv('g', null, svg);
    window.addEventListener('resize', function () { if (open) fit(); });
    built = true;
  }

  function fit() {
    var r = ui.scene.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var w = 412, hgt = w * r.height / r.width;
    if (hgt < 560) { hgt = 560; w = hgt * r.width / r.height; }
    S.view = { x: CX - w / 2, y: 612 - hgt, w: w, h: hgt };
    svg.setAttribute('viewBox', S.view.x.toFixed(1) + ' ' + S.view.y.toFixed(1) + ' ' + w.toFixed(1) + ' ' + hgt.toFixed(1));
  }

  function openGame(from) {
    if (!built) build();
    launcher = from || null;
    open = true; root.hidden = false;
    document.documentElement.classList.add('cg-open');
    reset();
    fit();
    showCard('intro');
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function close() {
    if (!open) return;
    open = false; root.hidden = true;
    document.documentElement.classList.remove('cg-open');
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout); timers = [];
    stopSensor();
    if (launcher) launcher.focus({ preventScroll: true });
  }

  function reset() {
    timers.forEach(clearTimeout); timers = []; tweens = [];
    parts.forEach(function (p) { p.el.remove(); }); parts = [];
    [L.stack, L.top, L.hang, L.fly, L.fx].forEach(function (g) { while (g.firstChild) g.firstChild.remove(); });
    S = { phase: 'intro', mode: S ? S.mode : null, view: S && S.view, logs: [], perfect: 0, fails: 0, t: 0, tilt: 0, finger: 0,
          lean: 0, leanV: 0, swingT: rnd(0, 6), falling: null, low: 0, target: 0, holding: false, gust: 0, gustT: 0, warned: 0, creakT: 0 };
    svg.classList.remove('is-final');
    if (root) root.classList.remove('is-final');
    L.crane.style.display = ''; L.hang.style.display = '';   // новое бревно снова на крюке
    ui.say.classList.remove('is-on');
    hud();
  }

  function hud() {
    ui.crown.textContent = Math.min(S.logs.length + (S.phase === 'final' ? 0 : 1), GOAL) + ' / ' + GOAL;
    ui.perfect.textContent = String(S.perfect);
    ui.fails.textContent = String(S.fails);
  }
  var sayT = 0;
  function say(t, tone, ms) {
    ui.say.textContent = t;
    ui.say.className = 'cm-say is-on' + (tone ? ' cm-say--' + tone : '');
    clearTimeout(sayT); sayT = setTimeout(function () { ui.say.classList.remove('is-on'); }, ms || 2200);
  }

  function showCard(kind) {
    var html;
    if (kind === 'intro') {
      html = '<span class="eyebrow">Мини-игра</span><h3>Сложи сруб</h3>' +
        '<p>Восемь венцов — и часовня у поклонного креста готова. Кран качает бревно над срубом.</p>' +
        '<ol class="cm-rules">' +
          '<li><b>Ведите пальцем вниз</b> — трос опускается, вверх — поднимается. Бревно идёт за пальцем, но не быстрее лебёдки.</li>' +
          '<li><b>Поймайте момент</b>, когда бревно над срубом: где коснётся, там и ляжет.</li>' +
          '<li><b>Держите телефон ровно.</b> Наклон отводит висящее бревно, а коснувшись сруба криво, оно ляжет одним концом и соскочит.</li>' +
          '<li><b>Удерживайте сруб.</b> Легло со сдвигом — сруб клонится, выравнивайте его наклоном. Слишком сильно — верх рассыплется.</li>' +
        '</ol>' +
        '<button class="btn btn--gold" type="button" data-cm="start">Начать <svg aria-hidden="true"><use href="#i-arrow"/></svg></button>' +
        '<p class="cm-card__small">Игра попросит доступ к датчику наклона. Без него наклон задаётся пальцем по полоске внизу.</p>';
    } else {
      var stars = S.perfect >= 6 && S.fails <= 1 ? 3 : S.fails <= 4 ? 2 : 1;
      html = '<div class="cm-stars">' + [1, 2, 3].map(function (i) { return '<span' + (i <= stars ? ' class="is-on"' : '') + '>✦</span>'; }).join('') + '</div>' +
        '<h3>Сруб сложен!</h3><p class="cm-card__meta">' + S.perfect + ' ' + plural(S.perfect, ['венец', 'венца', 'венцов']) + ' ровно · ' + S.fails + ' ' + plural(S.fails, ['срыв', 'срыва', 'срывов']) + '</p>' +
        '<p class="cm-card__lead">Видите, как это непросто? Давайте доверим это профессионалам — плотникам. Если есть возможность — подключайтесь.</p>' +
        '<button class="btn btn--gold" type="button" data-cm="donate">Поддержать строительство <svg aria-hidden="true"><use href="#i-arrow"/></svg></button>' +
        '<div class="cm-links"><button type="button" data-cm="volunteer">Помочь руками</button><button type="button" data-cm="again">Сыграть ещё</button></div>';
    }
    ui.card.innerHTML = html;
    ui.card.className = 'cm-card cm-card--' + kind;
    ui.card.hidden = false;
  }

  function begin(again) {
    ui.card.hidden = true;
    function go(ok) {
      if (!open) return;
      S.mode = ok ? 'sensor' : 'finger';
      root.classList.toggle('is-finger', !ok);
      S.phase = 'play';
      hud();
      say(ok ? 'Ведите пальцем вниз — трос опускается' : 'Наклон — пальцем по полоске внизу', null, 2600);
    }
    if (again && S.mode) { if (S.mode === 'sensor') sensor.zero = null; go(S.mode === 'sensor'); return; }
    startSensor(go);
  }

  /* ---------- Геометрия сруба ---------- */
  function topY() { return BASE_Y - LR - S.logs.length * STEP; }
  function comOffset() {                       // смещение центра тяжести всех брёвен
    if (!S.logs.length) return 0;
    var s = 0; S.logs.forEach(function (l) { s += l.x; });
    return s / S.logs.length;
  }
  function worldAngle() { return S.tilt * .5 + S.lean; }   // на экране: наклон «земли» + собственный наклон сруба, °
  function hookX() {
    var amp = 70 + S.logs.length * 9, sp = 1.1 + S.logs.length * .09;
    return CX + amp * Math.sin(S.swingT * sp) + 10 * Math.sin(S.swingT * sp * 2.7);
  }
  function hookY() { return Math.min(topY() - 120, 360); }

  /* ---------- Опускание бревна: держишь палец — кран травит трос ----------
     Бревно висит на тросе ровно, а сруб наклонён вместе с «землёй». Пока бревно
     опускается, наклон телефона ещё и отводит его в сторону. Коснулось сруба
     при наклоне — ляжет одним концом и соскочит, поэтому телефон держат ровно. */
  var LOWER = 95;                              // скорость лебёдки, пикс/с
  var LAND_DEG = 4.5;                          // допустимый наклон в момент касания, °
  function logPos() {
    var tx = hookX(), rope = 80 + S.low;
    return { x: tx + rope * Math.sin(S.tilt * .5 / DEG), y: hookY() + S.low, tx: tx };
  }
  // где на верхнем венце окажется точка экрана: переводим в систему сруба
  function toStack(x, y) {
    var a = -worldAngle() / DEG, dx = x - CX, dy = y - GY;
    return { x: CX + dx * Math.cos(a) - dy * Math.sin(a), y: GY + dx * Math.sin(a) + dy * Math.cos(a) };
  }
  function lowerTick(dt) {
    if (L.hang.style.display === 'none') return;
    var d = S.target - S.low, step = LOWER * dt;
    if (Math.abs(d) > .5) {
      S.low += clamp(d, -step, step);
      S.creakT2 = (S.creakT2 || 0) - dt;
      if (S.creakT2 <= 0) { S.creakT2 = .28; sfx.creak(); }
    }
    var p = logPos(), q = toStack(p.x, p.y + LR);
    if (q.y >= topY() + LR) touchDown(p, q);
  }
  function touchDown(p, q) {
    L.hang.style.display = 'none';
    S.low = 0; S.target = 0;
    var ty = topY() + LR, ang = worldAngle();
    var below = S.logs.length ? S.logs[S.logs.length - 1].x : 0, off = q.x - CX - below;
    if (Math.abs(off) > OVERLAP) {             // мимо — бревно соскальзывает
      flyOff(p.x, p.y, off > 0 ? 1 : -1);
      S.fails++; hud(); say('Мимо — бревно скатилось', 'warn'); sfx.soft(); buzz(40);
      later(respawn, 700);
      return;
    }
    if (Math.abs(ang) > LAND_DEG) {            // телефон держали криво — легло одним концом
      flyOff(p.x, p.y, ang > 0 ? 1 : -1);
      S.fails++; hud(); say('Легло одним концом — держите телефон ровно', 'warn', 2400); sfx.soft(); buzz(40);
      later(respawn, 700);
      return;
    }
    var el = sv('g', null, L.stack, logMarkup());
    var lg = { x: below + off, el: el };
    S.logs.push(lg);
    placeLog(lg, S.logs.length - 1);
    sfx.thud(); buzz(15);
    S.leanV += off * 0.012 + ang * 0.08;      // касание толкает сруб
    if (Math.abs(off) < PERFECT) { S.perfect++; say('Ровно!', 'ok', 1100); sfx.perfect(); }
    else if (Math.abs(off) > OVERLAP * .55) say('Сильно сдвинуто — держите наклоном!', 'warn', 1800);
    dust(p.x - 100, p.y + 10, 5); dust(p.x + 100, p.y + 10, 5);
    hud();
    if (S.logs.length >= GOAL) { later(finale, 600); S.phase = 'done'; return; }
    later(respawn, 420);
  }
  function placeLog(lg, i) { setT(lg.el, CX + lg.x, BASE_Y - LR - i * STEP, 0); }
  function respawn() { S.low = 0; S.target = 0; L.hang.style.display = ''; }

  // бревно падает с края
  function flyOff(x, y, dir) {
    var el = sv('g', null, L.fly, logMarkup());
    parts.push({ el: el, x: x, y: y - LR, vx: dir * rnd(60, 120), vy: -40, r: 0, w: dir * rnd(90, 160), log: true, life: 0, max: 2.2 });
  }
  // верх сруба рассыпается
  function collapse() {
    var n = Math.min(S.logs.length, Math.max(2, Math.ceil(S.logs.length / 3)));
    var dir = worldAngle() > 0 ? 1 : -1;
    for (var k = 0; k < n; k++) {
      var lg = S.logs.pop(), i = S.logs.length;
      var p = stackToScreen(CX + lg.x, BASE_Y - LR - i * STEP);
      lg.el.remove();
      var el = sv('g', null, L.fly, logMarkup());
      parts.push({ el: el, x: p.x, y: p.y, vx: dir * rnd(80, 180) + rnd(-20, 20), vy: rnd(-120, -40), r: worldAngle(), w: dir * rnd(60, 200), log: true, life: 0, max: 2.6 });
    }
    S.lean = 0; S.leanV = 0; S.warned = 0;
    S.fails++; hud();
    say('Сруб рассыпался! ' + n + ' ' + plural(n, ['бревно', 'бревна', 'брёвен']) + ' — заново', 'warn', 2600);
    sfx.thud(); setTimeout(sfx.soft, 120); setTimeout(sfx.soft, 260); buzz([60, 40, 90]);
  }
  function stackToScreen(x, y) {
    var a = worldAngle() / DEG, dx = x - CX, dy = y - GY;
    return { x: CX + dx * Math.cos(a) - dy * Math.sin(a), y: GY + dx * Math.sin(a) + dy * Math.cos(a) };
  }

  /* ---------- Физика сруба ----------
     Сруб — пружинящая стопка на фундаменте. Его клонит в сторону, куда
     смещён общий центр тяжести и куда наклонена «земля». Чем выше сруб,
     тем слабее он держится — и тем точнее надо держать телефон. */
  function physics(dt) {
    // наклон «земли»
    var want = S.mode === 'sensor' && sensor.got && sensor.zero != null ? clamp((sensor.raw - sensor.zero) * 1.1, -MAX_TILT, MAX_TILT) : S.finger;
    S.tilt += (want - S.tilt) * Math.min(1, dt * 10);
    // ветер наверху: медленные порывы
    S.gustT += dt;
    var n = S.logs.length;
    S.gust = n >= 3 ? (Math.sin(S.gustT * .7) * .6 + Math.sin(S.gustT * 1.9 + 1) * .4) * (n - 2) * .35 : 0;
    var hgt = Math.max(1, n);
    var drive = S.tilt * .55 + comOffset() * (.12 + n * .02) + S.gust;          // что клонит сруб, °
    var stiff = 26 - n * 2.1, damp = 3.2;
    S.leanV += (-(stiff) * (S.lean - drive * (hgt / 4)) - damp * S.leanV) * dt;
    S.lean += S.leanV * dt;
    if (S.phase === 'play' && n >= 2 && Math.abs(S.lean) > FALL_LEAN) { collapse(); return; }
    var risk = n >= 2 ? Math.abs(S.lean) / FALL_LEAN : 0;
    if (risk > .62 && !S.warned) { S.warned = 1; say('Сруб клонится — выровняйте!', 'warn', 1600); buzz(25); }
    if (risk < .4) S.warned = 0;
    if (risk > .62) { S.creakT -= dt; if (S.creakT <= 0) { S.creakT = .35 - risk * .2; sfx.creak(); } }
    S.risk = risk;
  }

  function render() {
    var a = worldAngle();
    L.world.setAttribute('transform', 'rotate(' + a.toFixed(2) + ' ' + CX + ' ' + GY + ')');
    // кран: тележка качается, бревно висит на тросе
    var lp = logPos(), vy = S.view ? S.view.y - 10 : -10, hy = lp.y;
    L.rope.setAttribute('d', 'M' + lp.tx.toFixed(1) + ' ' + vy.toFixed(1) + 'L' + lp.x.toFixed(1) + ' ' + (hy - 22).toFixed(1));
    var on = L.hang.style.display !== 'none';
    L.straps.setAttribute('d', !on ? '' : 'M' + lp.x.toFixed(1) + ' ' + (hy - 22).toFixed(1) + 'l-70 ' + (22 - LR) + 'M' + lp.x.toFixed(1) + ' ' + (hy - 22).toFixed(1) + 'l70 ' + (22 - LR));
    setT(L.hook, lp.x, hy - 26, 0);
    if (!L.hang.firstChild) sv('g', null, L.hang, logMarkup());
    setT(L.hang, lp.x, hy, Math.sin(S.swingT * 1.3) * 1.5);
    // куда опустится
    if (S.phase === 'play' && on) L.aim.setAttribute('d', 'M' + lp.x.toFixed(1) + ' ' + (hy + LR + 8).toFixed(1) + 'V' + (hy + LR + 44).toFixed(1));
    else L.aim.setAttribute('d', '');
    // уровень и телефон
    var shown = clamp(S.lean, -FALL_LEAN, FALL_LEAN), k = shown / FALL_LEAN;
    ui.bubble.style.left = (50 + k * 44).toFixed(1) + '%';
    var risk = S.risk || 0, col = risk > .62 ? '#9E2B32' : risk > .3 ? '#C9A35C' : '#4F6B3A';
    ui.bubble.style.background = col;
    ui.lbl.textContent = Math.abs(shown) < .8 ? 'ровно' : (shown > 0 ? 'вправо ' : 'влево ') + Math.abs(shown).toFixed(0) + '°';
    var ph = ui.phone; ph.setAttribute('transform', 'rotate(' + (-S.tilt).toFixed(1) + ' 32 32)'); ph.setAttribute('stroke', col);
  }

  function dust(x, y, n) {
    if (REDUCED.matches) n = 2;
    for (var i = 0; i < n; i++) {
      var c = sv('circle', { r: rnd(1.4, 3), fill: '#C9B48E' }, L.fx);
      parts.push({ el: c, x: x + rnd(-8, 8), y: y, vx: rnd(-50, 50), vy: rnd(-80, -20), life: 0, max: rnd(.4, .8) });
    }
  }

  /* ---------- Финал ---------- */
  function finale() {
    S.phase = 'final';
    root.classList.add('is-final');
    L.crane.style.display = 'none'; L.aim.setAttribute('d', '');
    var top = topY() + LR, x = CX + comOffset();
    var g = sv('g', { fill: 'none', stroke: '#3E3122', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', transform: 'translate(' + x.toFixed(1) + ' ' + top.toFixed(1) + ')' }, L.top);
    var parts2 = [
      '<path d="M' + (-25) + ' ' + (BASE_Y - top) + 'V' + (BASE_Y - top - 52) + 'a25 25 0 0 1 50 0V' + (BASE_Y - top) + '" fill="#F4ECDD"/>',
      '<path d="M-126 0L0 -96L126 0Z" fill="#EBD8B2" stroke="#8C6A3E"/><path d="M-140 8L0 -104L140 8" stroke="#5A3F22" stroke-width="8"/>',
      '<path d="M-16 -100V-146h32v46" fill="url(#cm-log)"/><path d="M-20 -146C-36 -158 -26 -180 0 -202C26 -180 36 -158 20 -146Z" fill="url(#cm-gold)" stroke="#7A5A22"/><path d="M0 -202C-10 -184 -14 -164 -8 -146M0 -202C10 -184 14 -164 8 -146" stroke="#A47F38" stroke-width="1"/>',
      // восьмиконечный крест: нижняя перекладина — левый от зрителя конец выше
      '<circle cx="0" cy="-230" r="90" fill="url(#cm-glow)" stroke="none"/><g stroke="#7A5A22" stroke-width="3"><path d="M0 -206V-266M-7 -256h14M-16 -244h32M-9 -226l18 8"/></g>'
    ];
    parts2.forEach(function (p, i) {
      later(function () {
        var e = sv('g', null, g, p); e.style.opacity = 0;
        tween(420, function (k) { e.style.opacity = k; e.style.transform = 'translateY(' + (-18 * (1 - k)).toFixed(1) + 'px)'; });
        if (i === 3) { sfx.bell(); svg.classList.add('is-final'); } else sfx.soft();
      }, 200 + i * 520);
    });
    later(function () { showCard('final'); }, 200 + parts2.length * 520 + 700);
  }

  /* ---------- Цикл ---------- */
  function loop(t) {
    if (!open) return;
    raf = requestAnimationFrame(loop);
    var dt = Math.min(.05, Math.max(.001, (t - lastT) / 1000)); lastT = t;
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i], k = clamp((t - tw.t0) / tw.dur, 0, 1);
      tw.fn(easeOut(k)); if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); }
    }
    if (S.phase === 'play') {
      S.swingT += dt * (S.holding ? .55 : 1);   // пока палец на экране — кран качается медленнее
      physics(dt);
    } else if (S.phase === 'done' || S.phase === 'final') {
      S.lean *= Math.pow(.05, dt); S.tilt *= Math.pow(.05, dt); S.risk = 0;   // сруб сложен — выпрямляется
    }
    if (S.phase === 'play') lowerTick(dt);
    render();
    for (var j = parts.length - 1; j >= 0; j--) {
      var p = parts[j]; p.life += dt;
      if (p.life > p.max || p.y > 700) { p.el.remove(); parts.splice(j, 1); continue; }
      p.vy += (p.log ? 1400 : 160) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.log) { p.r += p.w * dt; if (p.y > GY - LR) { p.y = GY - LR; p.vy *= -.25; p.vx *= .6; p.w *= .5; } setT(p.el, p.x, p.y, p.r); p.el.style.opacity = p.life > p.max - .5 ? (p.max - p.life) / .5 : 1; }
      else { p.el.setAttribute('cx', p.x.toFixed(1)); p.el.setAttribute('cy', p.y.toFixed(1)); p.el.setAttribute('opacity', (1 - p.life / p.max).toFixed(2)); }
    }
  }

  /* ---------- Кнопка запуска под картинкой (только телефон и планшет) ---------- */
  var btn = h('button', 'cm-launch',
    '<span class="cm-launch__icon"><svg aria-hidden="true"><use href="#i-hammer"/></svg></span>' +
    '<span class="cm-launch__text"><b>Сложи сруб сам</b><small>Мини-игра · наклоняйте телефон</small></span>' +
    '<svg class="cm-launch__arrow" aria-hidden="true"><use href="#i-arrow"/></svg>');
  btn.type = 'button';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.addEventListener('click', function (e) { e.stopPropagation(); openGame(btn); });
  function mount() {
    var on = !DESKTOP.matches;
    if (on && !btn.parentNode) media.appendChild(btn);
    if (!on && btn.parentNode) btn.remove();
    media.classList.toggle('has-tilt', on);
  }
  mount();
  if (DESKTOP.addEventListener) DESKTOP.addEventListener('change', mount); else if (DESKTOP.addListener) DESKTOP.addListener(mount);
  window.KimChapelTilt = { open: openGame };
})();
