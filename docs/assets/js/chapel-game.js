/* ==========================================================================
   «Сложи сруб» — полная версия игры («по-серьёзному»). Открывается кнопкой
   из живой иллюстрации блока (assets/js/chapel-toy.js), то есть на компьютере.
   Раскладка при этом умеет и узкие экраны, и касания.

   Суть: бревно сбежистое — комель (толстый конец) тяжелее вершины, у некоторых
   брёвен ещё и сук смещает вес. Где игрок подцепит бревно краном, так оно и
   повиснет: не в точке равновесия — перекосит. Бревно качается на тросе,
   на верхних венцах поднимается ветер. Опустил криво или мимо — бревно
   соскакивает со сруба. Кладёшь комель на комель — стена идёт вкось.
   Восемь венцов — и часовня достраивается, а в конце — честная фраза:
   это непросто, давайте доверим профессионалам и поможем им.

   Сцена — один SVG, мир 1000×600; область просмотра подстраивается под экран.
   Без библиотек и сборки.
   ========================================================================== */
(function () {
  'use strict';

  var media = document.querySelector('.build__media');
  if (!media || !window.requestAnimationFrame || !window.matchMedia) return;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* ---------- Параметры ---------- */
  var CROWNS = 8;
  var LOG_L = 248, RB = 12.5, RT = 7;   // длина, наибольший радиус комля и наименьший — вершины
  var D_TILT = 90;                      // «плечо» подвеса: чем больше, тем мягче перекос
  var PERFECT_DEG = 3, OK_DEG = 7.5;    // допуск по углу
  var PERFECT_DX = 12, OK_DX = 30;      // допуск по положению
  var WX = 610, BASE = 500, GROUND = 520;
  var PILE_X = 310, SLEEPER_TOP = 506;
  var ROPE = 64, G = 1500;

  /* ---------- Утилиты ---------- */
  var NS = 'http://www.w3.org/2000/svg', PI = Math.PI, DEG = 180 / PI;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function easeIn(k) { return k * k; }
  function easeInOut(k) { return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function plural(n, f) { var a = Math.abs(n) % 100, b = a % 10; return f[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b > 1 && b < 5 ? 1 : 2]; }
  function sv(tag, attrs, parent, html) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function setT(e, x, y, r) { e.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')' + (r ? ' rotate(' + r.toFixed(3) + ')' : '')); }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function now() { return performance.now(); }
  function fmtDeg(d) { return (Math.round(Math.abs(d) * 10) / 10).toString().replace('.', ',') + '°'; }

  /* ---------- Звук ---------- */
  var AC = null, muted = false;
  function ac() {
    if (muted) return null;
    if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { AC = new C(); } catch (e) { return null; } }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(f, dur, type, vol, f2, delay) {
    var c = ac(); if (!c) return;
    var t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq, delay) {
    var c = ac(); if (!c) return;
    var t = c.currentTime + (delay || 0), n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq || 1200; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t);
  }
  var sfx = {
    pick: function () { noise(0.06, 0.12, 2000); tone(320, 0.08, 'triangle', 0.03, 240); },
    thud: function () { tone(105, 0.34, 'sine', 0.34, 46); noise(0.16, 0.22, 480); },
    clack: function () { tone(150, 0.2, 'sine', 0.22, 70); noise(0.1, 0.18, 900); },
    knock: function () { tone(720, 0.06, 'triangle', 0.08, 480); noise(0.04, 0.12, 3200); },
    perfect: function () { tone(784, 0.18, 'sine', 0.05); tone(1175, 0.3, 'sine', 0.04, null, 0.08); },
    err: function () { tone(190, 0.22, 'triangle', 0.07, 130); },
    flip: function () { noise(0.12, 0.08, 1400); },
    bell: function () {
      [[0.5, .10, 5], [1, .13, 3.6], [1.19, .06, 2.4], [1.5, .05, 2], [2, .045, 1.6], [2.52, .03, 1.2], [3, .02, 1]].forEach(function (p) { tone(196 * p[0], p[2], 'sine', p[1]); });
    }
  };

  /* ---------- Бревно ---------- */
  // у каждого бревна свой сбег: одни почти ровные, другие заметно сужаются
  function comShift(rb, rt) { return LOG_L * (0.5 - (rb * rb + 2 * rb * rt + 3 * rt * rt) / (4 * (rb * rb + rb * rt + rt * rt))); }
  function newLog(side) {
    side = side || (Math.random() < .5 ? -1 : 1);     // где комель: -1 слева, +1 справа
    var rb = rnd(10.5, RB), rt = rnd(RT, 10);
    var j = rnd(-8, 8); if (Math.abs(j) < 2.5) j = 0; // сук смещает вес
    return { side: side, rb: rb, rt: rt, jit: j, knot: j ? Math.sign(j) * rnd(30, 80) : null, e: side * comShift(rb, rt) + j };
  }
  function rLeft(lg) { return lg.side < 0 ? lg.rb : lg.rt; }
  function rRight(lg) { return lg.side < 0 ? lg.rt : lg.rb; }
  function rAt(lg, x) { return lerp(rLeft(lg), rRight(lg), (x + LOG_L / 2) / LOG_L); }
  function logMarkup(lg) {
    var h2 = LOG_L / 2, a = rLeft(lg), b = rRight(lg);
    var body = 'M' + (-h2) + ' ' + (-a) + 'L' + h2 + ' ' + (-b) + 'A' + (b * .5) + ' ' + b + ' 0 0 1 ' + h2 + ' ' + b + 'L' + (-h2) + ' ' + a + 'A' + (a * .5) + ' ' + a + ' 0 0 1 ' + (-h2) + ' ' + (-a) + 'Z';
    var s = '<path d="' + body + '" fill="url(#cg-log)"/>';
    [-0.35, 0.05, 0.4].forEach(function (k, i) {
      var x1 = -h2 + 26 + i * 50, x2 = x1 + 60 + i * 12;
      s += '<path d="M' + x1 + ' ' + (rAt(lg, x1) * k).toFixed(1) + 'L' + x2 + ' ' + (rAt(lg, x2) * k).toFixed(1) + '" stroke="#C4A06C" stroke-width=".9"/>';
    });
    // торец комля с годовыми кольцами — чтобы было видно, где толстый конец
    var br = lg.side < 0 ? a : b, bx = lg.side * (h2 - br * .1);
    s += '<ellipse cx="' + bx.toFixed(1) + '" cy="0" rx="' + (br * .42).toFixed(1) + '" ry="' + (br * .78).toFixed(1) + '" fill="#E9D3A8" stroke="#8C6A3E" stroke-width="1.1"/>';
    s += '<ellipse cx="' + bx.toFixed(1) + '" cy="0" rx="' + (br * .2).toFixed(1) + '" ry="' + (br * .4).toFixed(1) + '" fill="none" stroke="#B8935E" stroke-width=".8"/>';
    if (lg.knot != null) s += '<ellipse cx="' + lg.knot.toFixed(1) + '" cy="' + (-rAt(lg, lg.knot) * .2).toFixed(1) + '" rx="5" ry="3.6" fill="#8C6A3E" stroke="#5A3F22" stroke-width="1"/>';
    return s;
  }

  /* ---------- Состояние ---------- */
  var S = null, root, svg, L = {}, ui = {}, timers = [], tweens = [], parts = [];
  var raf = 0, lastT = 0, built = false, open = false, launcher = null;
  var cur = null;   // бревно на крюке или в падении
  var pile = [];    // штабель на подкладках
  var hold = null;  // бревно на крюке
  var fall = null;  // бревно падает

  function later(fn, ms) { var id = setTimeout(function () { timers = timers.filter(function (t) { return t !== id; }); if (open) fn(); }, ms); timers.push(id); return id; }
  function tween(dur, fn, done, ease) { var t = { t0: now(), dur: dur, fn: fn, done: done, e: ease || easeOut }; tweens.push(t); return t; }

  /* ---------- Окно ---------- */
  function buildDom() {
    root = h('div', 'cg');
    root.id = 'chapel-game';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'cg-title');
    root.innerHTML =
      '<div class="cg__box">' +
        '<header class="cg__head">' +
          '<div class="cg__title"><span class="eyebrow">Строим вместе</span><h2 id="cg-title">Сложи сруб</h2></div>' +
          '<div class="cg__tools">' +
            '<button class="cg-icon" type="button" data-cg-sound aria-pressed="true" title="Звук"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path class="cg-icon__wave" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path class="cg-icon__mute" d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><span class="visually-hidden">Звук</span></button>' +
            '<button class="cg-icon" type="button" data-cg-close aria-label="Закрыть"><svg aria-hidden="true"><use href="#i-close"/></svg></button>' +
          '</div>' +
        '</header>' +
        '<div class="cg__body">' +
          '<div class="cg__scene" data-cg-scene>' +
            '<div class="cg-say" data-cg-say role="status" aria-live="polite"></div>' +
            '<div class="cg-card" data-cg-card hidden></div>' +
          '</div>' +
          '<aside class="cg__side">' +
            '<dl class="cg-stats">' +
              '<div><dt>Венец</dt><dd data-cg-crown></dd></div>' +
              '<div><dt>Ровно</dt><dd data-cg-perfect></dd></div>' +
              '<div><dt>Сорвалось</dt><dd data-cg-fails></dd></div>' +
              '<div><dt>Стена</dt><dd data-cg-wall></dd></div>' +
            '</dl>' +
            '<div class="cg-butt" data-cg-butt></div>' +
            '<p class="cg-tip" data-cg-tip></p>' +
            '<div class="cg-controls"><span class="cg-wind" data-cg-wind hidden></span></div>' +
          '</aside>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);

    ['crown', 'perfect', 'fails', 'wall', 'butt', 'tip', 'wind', 'say', 'card', 'scene', 'sound'].forEach(function (k) { ui[k] = root.querySelector('[data-cg-' + k + ']'); });

    root.querySelector('[data-cg-close]').addEventListener('click', closeGame);
    root.addEventListener('click', function (e) { if (e.target === root) closeGame(); });
    ui.sound.addEventListener('click', function () {
      muted = !muted;
      ui.sound.setAttribute('aria-pressed', String(!muted));
      ui.sound.classList.toggle('is-muted', muted);
    });
    root.addEventListener('click', onAction);
    root.addEventListener('keydown', function (e) { if (e.key === 'Tab') trapFocus(e); });
    document.addEventListener('keydown', function (e) {
      if (!open) return;
      if (e.key === 'Escape') {
        if (document.querySelector('.modal:not([hidden])')) return;
        e.stopImmediatePropagation(); closeGame();
      }
    }, true);
    window.addEventListener('resize', function () { if (open) fitView(); });

    buildSvg();
    built = true;
  }

  function trapFocus(e) {
    var f = Array.prototype.filter.call(root.querySelectorAll('button:not([disabled]), [href]'), function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function buildSvg() {
    L.tint = h('div', 'cg-tint');
    ui.scene.insertBefore(L.tint, ui.scene.firstChild);
    svg = sv('svg', { 'class': 'cg-svg', viewBox: '0 0 1000 600', role: 'img', 'aria-label': 'Стройплощадка: сруб часовни у поклонного креста, бревно на подкладках и кран' });
    ui.scene.insertBefore(svg, L.tint.nextSibling);
    sv('defs', null, svg,
      '<linearGradient id="cg-log" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2E3C4"/><stop offset=".45" stop-color="#E6CFA2"/><stop offset="1" stop-color="#C9A570"/></linearGradient>' +
      '<linearGradient id="cg-gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C99A45"/><stop offset=".38" stop-color="#F0D28E"/><stop offset="1" stop-color="#B98A3A"/></linearGradient>' +
      '<radialGradient id="cg-glow"><stop offset="0" stop-color="#F6DFA4" stop-opacity=".95"/><stop offset=".45" stop-color="#EBC877" stop-opacity=".35"/><stop offset="1" stop-color="#EBC877" stop-opacity="0"/></radialGradient>');

    L.bg = sv('g', { 'class': 'cg-bg', fill: 'none', stroke: '#3E3122', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg,
      '<g class="cg-sun"><circle cx="880" cy="96" r="36" stroke="#B88A3E"/><g class="cg-rays" stroke="#C9A35C" stroke-width="1.6"><path d="M880 42v-20M880 150v20M826 96h-20M934 96h20M842 58l-14-14M918 134l14 14M918 58l14-14M842 134l-14 14"/></g></g>' +
      '<g stroke="#C9B48E" stroke-width="1.4"><path d="M140 110c40-14 80-14 120 0M640 150c30-10 60-10 90 0M380 70c26-9 52-9 78 0M-120 160c30-10 60-10 90 0M1080 200c30-10 60-10 90 0"/></g>' +
      '<path d="M-600 520c200 4 400 0 600 2c130-6 230 4 340 0s260-8 680 2c200 4 400-2 600 0"/>' +
      '<g stroke="#7E7A4E" stroke-width="1.4"><path d="M24 530l4-10M44 532l3-9M70 529l5-11M440 531l4-10M780 531l3-9M960 530l5-11M1000 533l3-8M1060 530l4-10M-60 530l4-10M-160 532l3-9"/></g>' +
      // поклонный крест справа от часовни (нижняя перекладина: левый от зрителя конец выше)
      '<g stroke="#5A3F22" stroke-width="3"><path d="M860 522V290"/><path d="M846 314h28"/><path d="M826 344h68"/><path d="M838 418l44 20"/></g>' +
      '<circle cx="860" cy="344" r="5" fill="#B88A3E" stroke="none"/>' +
      // фундамент
      '<g fill="#DAD0BC" stroke-width="2">' + [508, 576, 644, 712].map(function (x) { return '<rect x="' + (x - 20) + '" y="500" width="40" height="22" rx="2"/>'; }).join('') + '</g>' +
      // подкладки под бревно
      '<rect x="200" y="506" width="22" height="16" rx="2" fill="#CDB289" stroke-width="1.6"/><rect x="398" y="506" width="22" height="16" rx="2" fill="#CDB289" stroke-width="1.6"/>');
    L.stock = sv('g', { fill: '#E8D4AE', stroke: '#3E3122', 'stroke-width': 1.6 }, svg);
    L.blueprint = sv('g', { 'class': 'cg-blueprint' }, svg,
      '<path d="M486 500V348H734V500"/><path d="M466 352L610 236L754 352"/><path d="M592 250V206h36v44M586 199h48"/><path d="M588 199C568 185 580 159 610 135C640 159 652 185 632 199"/><path d="M610 131V65M592 86h36M599 106l22 10"/>');
    L.wall = sv('g', { fill: 'none', stroke: '#3E3122', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    L.ghost = sv('g', { 'class': 'cg-ghost' }, svg);
    L.top = sv('g', { fill: 'none', stroke: '#3E3122', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    L.crane = sv('g', { 'class': 'cg-crane', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    L.act = sv('g', { fill: 'none', stroke: '#3E3122', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    L.aim = sv('g', { 'class': 'cg-aim', fill: 'none' }, svg);
    L.fx = sv('g', { 'class': 'cg-fx' }, svg);

    L.rope = sv('path', { stroke: '#6B5130', 'stroke-width': 1.7 }, L.crane);
    L.trolley = sv('g', null, L.crane, '<rect x="-11" y="-6" width="22" height="9" rx="2" fill="#6B5130" stroke="none"/>');
    L.hook = sv('g', null, L.crane, '<path d="M0 -9v6a5 5 0 1 0 6 5" stroke="#3E3122" stroke-width="2.2"/>');
    L.level = sv('g', { 'class': 'cg-level' }, L.crane,
      '<rect x="-24" y="-6" width="48" height="12" rx="6" fill="#F7F2E9" stroke="#3E3122" stroke-width="1.4"/><path d="M-6 -6v12M6 -6v12" stroke="#A78345" stroke-width="1"/><circle r="4.2" fill="#C9A35C" stroke="none"/>');
    L.bubble = L.level.querySelector('circle');
    L.crane.style.display = 'none';

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('pointerleave', function () { if (!hold) clear(L.aim); });
  }

  /* Область просмотра под размер экрана: на телефоне — крупнее, только площадка */
  function fitView() {
    var r = ui.scene.getBoundingClientRect(), sw = r.width, sh = r.height;
    if (!sw || !sh) return;
    var portrait = sw / sh < 1.05;
    var box = portrait ? { x: 178, w: 566 } : { x: 40, w: 940 };
    var needH = portrait ? 470 : 560;
    var sc = Math.min(sw / box.w, sh / needH);
    var vw = sw / sc, vh = sh / sc;
    var vx = box.x + box.w / 2 - vw / 2, vy = 590 - vh;
    S.view = { x: vx, y: vy, w: vw, h: vh };
    svg.setAttribute('viewBox', vx.toFixed(1) + ' ' + vy.toFixed(1) + ' ' + vw.toFixed(1) + ' ' + vh.toFixed(1));
    root.classList.toggle('is-portrait', portrait);
  }
  function pt(e) {
    var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    var m = svg.getScreenCTM(); return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }

  /* ---------- Открыть / закрыть ---------- */
  function openGame() {
    if (!built) buildDom();
    open = true;
    root.hidden = false;
    document.documentElement.classList.add('cg-open');
    reset();
    fitView();
    lastT = now();
    raf = requestAnimationFrame(loop);
    var b = ui.card.querySelector('button'); if (b) b.focus({ preventScroll: true });
  }
  function closeGame() {
    if (!open) return;
    open = false;
    root.hidden = true;
    document.documentElement.classList.remove('cg-open');
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout); timers = [];
    hold = null; fall = null;
    if (launcher) launcher.focus({ preventScroll: true });
  }
  function openSiteModal(name) {
    closeGame();
    var b = document.querySelector('[data-modal-open="' + name + '"]');
    if (b) b.click();
  }

  function reset() {
    timers.forEach(clearTimeout); timers = []; tweens = [];
    parts.forEach(function (p) { p.el.remove(); }); parts = [];
    hold = null; fall = null; cur = null; pile = [];
    S = { phase: 'intro', crown: 0, yl: BASE, yr: BASE, perfect: 0, fails: 0, regrips: 0, streak: 0, lastSide: null, wind: 0, windT: 0, tips: {}, view: S && S.view };
    [L.wall, L.ghost, L.top, L.act, L.aim, L.fx].forEach(clear);
    L.crane.style.display = 'none';
    L.blueprint.style.opacity = '';
    svg.classList.remove('is-final', 'is-grabbing', 'is-over');
    root.classList.remove('is-final');
    ui.say.classList.remove('is-on');
    drawStock();
    renderStats();
    setTip('');
    showCard('intro');
  }

  /* ---------- Панель ---------- */
  function wallDeg() { return Math.atan2(S.yr - S.yl, LOG_L) * DEG; }
  function renderStats() {
    ui.crown.textContent = Math.min(S.crown + (S.phase === 'final' ? 0 : 1), CROWNS) + ' / ' + CROWNS;
    ui.perfect.textContent = String(S.perfect);
    ui.fails.textContent = String(S.fails);
    var wd = wallDeg();
    ui.wall.innerHTML = Math.abs(wd) < 0.6 ? 'ровно' : (wd > 0 ? '<span class="cg-long">вправо </span>↘ ' : '<span class="cg-long">влево </span>↙ ') + fmtDeg(wd);
    ui.wall.parentNode.classList.toggle('is-bad', Math.abs(wd) >= 3);
    if (S.phase === 'play' && S.lastSide != null) {
      var want = S.lastSide < 0 ? 'справа →' : '← слева';
      ui.butt.innerHTML = '<span>В прошлом венце комель ' + (S.lastSide < 0 ? 'слева' : 'справа') + '</span><b>Теперь лучше комлем ' + want + '</b>';
      ui.butt.classList.toggle('is-same', !!(cur && cur.lg.side === S.lastSide));
    } else ui.butt.innerHTML = '';
    if (S.wind > 0.05 && S.phase === 'play') {
      ui.wind.hidden = false;
      ui.wind.textContent = S.wind > .7 ? 'Ветер: порывы' : 'Ветер: свежий';
    } else ui.wind.hidden = true;
  }
  function setTip(html) { ui.tip.innerHTML = html; }
  function tipOnce(key, html) { if (S.tips[key]) return false; S.tips[key] = 1; setTip(html); return true; }

  function onAction(e) {
    var b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    var a = b.getAttribute('data-act');
    if (a === 'start') { hideCard(); startPlay(); }
    else if (a === 'donate') openSiteModal('donate');
    else if (a === 'volunteer') openSiteModal('volunteer');
    else if (a === 'restart') { reset(); hideCard(); startPlay(); }
  }

  /* ---------- Карточки ---------- */
  function showCard(kind) {
    var html = '';
    if (kind === 'intro') {
      html = '<span class="eyebrow">Мини-игра</span><h3>Сложи сруб</h3>' +
        '<p>Восемь венцов — и часовня у поклонного креста готова. Подцепите бревно краном, поднесите к срубу и опустите ровно.</p>' +
        '<ul class="cg-rules">' +
          '<li><b>Где взять.</b> Комель — толстый конец — тяжелее. Возьмёте не в точке равновесия, бревно перекосит.</li>' +
          '<li><b>Как опустить.</b> Дождитесь, пока перестанет качаться: пузырёк уровня на крюке станет зелёным.</li>' +
          '<li><b>Какое взять.</b> Брёвна в штабеле лежат по-разному. Выбирайте так, чтобы комель лёг над вершиной предыдущего, — иначе стена пойдёт вкось.</li>' +
        '</ul>' +
        '<button class="btn btn--gold" type="button" data-act="start">Начать <svg aria-hidden="true"><use href="#i-arrow"/></svg></button>';
    } else if (kind === 'final') {
      var stars = starCount();
      html = '<div class="cg-stars" aria-label="Оценка: ' + stars + ' из 3">' + [1, 2, 3].map(function (i) { return '<span class="' + (i <= stars ? 'is-on' : '') + '">✦</span>'; }).join('') + '</div>' +
        '<h3>Сруб сложен!</h3>' +
        '<p class="cg-card__stats">' + S.perfect + ' ' + plural(S.perfect, ['венец', 'венца', 'венцов']) + ' ровно · ' + S.fails + ' ' + plural(S.fails, ['срыв', 'срыва', 'срывов']) + ' · стена ' + (Math.abs(wallDeg()) < 0.6 ? 'ровная' : 'с наклоном ' + fmtDeg(wallDeg())) + '</p>' +
        '<p class="cg-card__lead">Видите, как это непросто? Давайте доверим это профессионалам — плотникам, которые знают, где брать бревно и как оно ляжет. Если есть возможность — подключайтесь.</p>' +
        '<div class="cg-actions"><button class="btn btn--gold" type="button" data-act="donate">Поддержать строительство <svg aria-hidden="true"><use href="#i-arrow"/></svg></button>' +
        '<button class="cg-link" type="button" data-act="volunteer">Помочь руками</button><button class="cg-link" type="button" data-act="restart">Сыграть ещё</button></div>';
    }
    ui.card.innerHTML = html;
    ui.card.className = 'cg-card cg-card--' + kind;
    ui.card.hidden = false;
  }
  function hideCard() { ui.card.hidden = true; }
  function starCount() {
    var w = Math.abs(wallDeg());
    if (S.perfect >= 6 && S.fails <= 1 && w < 3) return 3;
    if (S.fails <= 4 && w < 6) return 2;
    return 1;
  }

  var sayTimer = 0;
  function say(text, tone, ms) {
    ui.say.textContent = text;
    ui.say.className = 'cg-say is-on' + (tone ? ' cg-say--' + tone : '');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(function () { ui.say.classList.remove('is-on'); }, ms || 2800);
  }

  /* ---------- Запас брёвен: торцы в штабеле ---------- */
  function remaining() { return CROWNS - S.crown - pile.length - (cur ? 1 : 0); }
  function drawStock() {
    clear(L.stock);
    var left = remaining();
    var pos = [[110, 510], [132, 510], [154, 510], [176, 510], [121, 491], [143, 491], [165, 491], [132, 472], [154, 472]];
    for (var i = 0; i < Math.max(0, left) && i < pos.length; i++) {
      sv('circle', { cx: pos[i][0], cy: pos[i][1], r: 10 }, L.stock);
      sv('circle', { cx: pos[i][0], cy: pos[i][1], r: 4, fill: 'none', stroke: '#B8935E', 'stroke-width': 1 }, L.stock);
    }
  }

  /* ---------- Ход игры ---------- */
  function startPlay() {
    S.phase = 'play';
    refill();
    drawGhost();
    tipOnce('grab', FINE.matches
      ? 'Брёвна лежат по-разному — выберите любое. Наведите: пунктир покажет, где кран его подцепит. Нажмите и держите.'
      : 'Брёвна лежат по-разному — выберите любое. Коснитесь и держите палец: кран подцепит бревно в этой точке.');
  }

  /* Штабель на подкладках: брёвна лежат друг на друге, нижнее вынули — верхние опускаются */
  function slotOf(k) {
    var y = SLEEPER_TOP;
    for (var i = 0; i < k; i++) y -= rLeft(pile[i].lg) + rRight(pile[i].lg) - 1;
    var lg = pile[k].lg, a = rLeft(lg), b = rRight(lg);
    return { x: PILE_X + (k % 2 ? 6 : -4), y: y - (a + b) / 2, r: -Math.atan2(a - b, LOG_L) * DEG };
  }
  function restack(skip) {
    pile.forEach(function (it, k) {
      var s = slotOf(k); it.home = s;
      if (it === skip || it.dropping) return;
      if (Math.abs(it.y - s.y) < .5 && Math.abs(it.x - s.x) < .5) return;
      var x0 = it.x, y0 = it.y, r0 = it.r;
      it.busy = true;
      tween(260, function (q) { it.x = lerp(x0, s.x, q); it.y = lerp(y0, s.y, q); it.r = lerp(r0, s.r, q); setT(it.el, it.x, it.y, it.r); }, function () { it.busy = false; sfx.clack(); }, easeIn);
    });
  }
  function makeItem(lg) {
    var el = sv('g', { 'class': 'cg-log' }, L.act);
    var inner = sv('g', null, el, logMarkup(lg));
    var strap = sv('rect', { x: -2.5, y: -14, width: 5, height: 28, rx: 1.5, fill: '#8C6A3E', stroke: 'none' }, el);
    strap.style.display = 'none';
    return { lg: lg, el: el, inner: inner, strap: strap, x: PILE_X, y: 0, r: 0, busy: true };
  }
  function addLog(lg, delay) {
    var it = makeItem(lg);
    pile.push(it);
    var s0 = slotOf(pile.length - 1); it.home = s0;
    it.x = s0.x; it.y = s0.y - 60; it.r = s0.r; it.dropping = true;
    it.el.style.opacity = 0;
    setT(it.el, it.x, it.y, it.r);
    later(function () {
      var y0 = it.y;
      tween(420, function (k) { it.y = lerp(y0, it.home.y, k); it.el.style.opacity = Math.min(1, k * 2); setT(it.el, it.x, it.y, it.r); },
        function () { it.busy = false; it.dropping = false; sfx.clack(); dust(it.x - 100, it.y + 10, 3, 6); dust(it.x + 100, it.y + 10, 3, 6); renderStats(); }, easeIn);
    }, delay || 0);
    return it;
  }
  // в штабеле до трёх брёвен; следим, чтобы комли лежали в разные стороны
  function refill() {
    var k = 0;
    while (pile.length < 3 && remaining() > 0) {
      var sides = pile.map(function (it) { return it.lg.side; }), side = null;
      if (sides.length && sides.every(function (v) { return v === sides[0]; })) side = -sides[0];
      addLog(newLog(side), k++ * 160);
    }
    drawStock();
  }
  function drawGhost() {
    clear(L.ghost);
    var x1 = WX - LOG_L / 2, x2 = WX + LOG_L / 2, ym = (S.yl + S.yr) / 2;
    sv('path', { d: 'M' + x1 + ' ' + (S.yl - 1).toFixed(1) + 'L' + x2 + ' ' + (S.yr - 1).toFixed(1) }, L.ghost);
    sv('path', { d: 'M' + WX + ' ' + (ym - 8).toFixed(1) + 'v-16M' + (WX - 6) + ' ' + (ym - 14).toFixed(1) + 'l6 6 6 -6', 'class': 'cg-ghost__mark' }, L.ghost);
  }

  function toLocal(it, p) {
    var a = -it.r / DEG, dx = p.x - it.x, dy = p.y - it.y;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  }
  function hitLog(p) {
    var pad = FINE.matches ? 4 : 18;
    for (var i = pile.length - 1; i >= 0; i--) {   // сверху вниз
      var it = pile[i]; if (it.busy) continue;
      var q = toLocal(it, p);
      if (Math.abs(q.x) <= LOG_L / 2 + pad && Math.abs(q.y) <= rAt(it.lg, clamp(q.x, -LOG_L / 2, LOG_L / 2)) + pad) return it;
    }
    return null;
  }
  function gripWorld(it, gx) {
    var a = it.r / DEG, ly = -rAt(it.lg, gx);
    return { x: it.x + gx * Math.cos(a) - ly * Math.sin(a), y: it.y + gx * Math.sin(a) + ly * Math.cos(a) };
  }

  /* ---------- Указатель ---------- */
  function onDown(e) {
    if (!S || S.phase !== 'play' || cur || hold || fall) return;
    var p = pt(e), it = hitLog(p);
    if (!it) return;
    e.preventDefault();
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ничего */ }
    var gx = clamp(toLocal(it, p).x, -LOG_L / 2 + 8, LOG_L / 2 - 8);
    var touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    var gp = gripWorld(it, gx);
    cur = it;
    pile.splice(pile.indexOf(it), 1);
    L.act.appendChild(it.el);                 // поднятое бревно — поверх штабеля
    restack();
    hold = {
      gx: gx, lift: touch ? 80 : 26, px: p.x, py: p.y,
      tx: gp.x, ty: gp.y - ROPE, startY: it.y,
      th: 0, om: 0, phi: it.r / DEG, phiV: 0, lx: gp.x, vs: 0, vp: 0, hvx: 0, lifted: 0
    };
    clear(L.aim);
    it.strap.style.display = '';
    setT(it.strap, gx, 0, 0);
    L.crane.style.display = '';
    svg.classList.add('is-grabbing'); svg.classList.remove('is-over');
    sfx.pick();
    renderStats();
  }
  function onMove(e) {
    var p = pt(e);
    if (hold) { hold.px = p.x; hold.py = p.y; return; }
    if (e.pointerType !== 'mouse' || !S || S.phase !== 'play' || cur || fall) return;
    clear(L.aim);
    var it = hitLog(p);
    if (it) {
      var gx = clamp(toLocal(it, p).x, -LOG_L / 2 + 8, LOG_L / 2 - 8), gp = gripWorld(it, gx);
      sv('path', { d: 'M' + gp.x.toFixed(1) + ' ' + (gp.y - 50).toFixed(1) + 'V' + (gp.y - 4).toFixed(1), 'class': 'cg-aim__line' }, L.aim);
      sv('path', { d: 'M0 -9v6a5 5 0 1 0 6 5', transform: 'translate(' + gp.x.toFixed(1) + ' ' + (gp.y - 12).toFixed(1) + ')', 'class': 'cg-aim__hook' }, L.aim);
      svg.classList.add('is-over');
    } else svg.classList.remove('is-over');
  }
  function onUp() {
    if (!hold) return;
    var hd = hold; hold = null;
    svg.classList.remove('is-grabbing');
    L.crane.style.display = 'none';
    L.ghost.classList.remove('is-ready');
    cur.strap.style.display = 'none';
    var top = Math.min(S.yl, S.yr);
    if (Math.abs(cur.x - WX) < 110 && cur.y < top + 4) {
      fall = { vx: clamp(hd.hvx * 0.5, -260, 260), vy: 0, w: hd.phiV * 0.6, phi: hd.phi };
    } else {
      if (hd.lifted > 20) { S.regrips++; tipOnce('regrip', 'Положили обратно — можно взять в другой точке или выбрать другое бревно. Комель тяжелее: берите ближе к нему.'); }
      putBack();
    }
    renderStats();
  }
  // бревно возвращается на верх штабеля
  function putBack() {
    var me = cur; cur = null;
    pile.push(me);
    var s = slotOf(pile.length - 1), x0 = me.x, y0 = me.y, r0 = me.r;
    me.home = s; me.busy = true;
    tween(420, function (k) { me.x = lerp(x0, s.x, k); me.y = lerp(y0, s.y, k); me.r = lerp(r0, s.r, k); setT(me.el, me.x, me.y, me.r); },
      function () { me.busy = false; sfx.clack(); renderStats(); }, easeInOut);
  }

  /* ---------- Физика подвеса ---------- */
  function holdTick(dt) {
    var hd = hold, lg = cur.lg;
    var tx = hd.px, ty = hd.py - hd.lift - ROPE;
    // бревно нельзя «вдавить» в сруб или в землю
    var minTop = Math.min(S.yl, S.yr);
    var nearWall = Math.abs(tx - WX) < LOG_L / 2 + 50;
    var maxHook = (nearWall ? minTop : SLEEPER_TOP) - 2 * RB - 4;
    ty = Math.min(ty, maxHook - ROPE);
    ty = Math.max(ty, (S.view ? S.view.y : 0) + 14);
    // тележка крана догоняет цель с запаздыванием
    var k = Math.min(1, dt * 12);
    var ntx = lerp(hd.tx, tx, k), nty = lerp(hd.ty, ty, k);
    var v = (ntx - hd.tx) / dt;
    hd.vs += (v - hd.vs) * Math.min(1, dt * 12);
    var ax = clamp((hd.vs - hd.vp) / dt, -9000, 9000); hd.vp = hd.vs;
    hd.tx = ntx; hd.ty = nty;

    var wind = 0;
    if (S.wind > 0) {
      S.windT += dt;
      var gust = Math.max(0, Math.sin(S.windT * 0.55) * Math.sin(S.windT * 1.3 + 1.7));
      wind = S.wind * (0.3 + 1.4 * gust) * 260;
    }

    var eq = Math.atan2(lg.e - hd.gx, D_TILT);
    var steps = Math.max(1, Math.ceil(dt * 240)), hh = dt / steps;
    for (var i = 0; i < steps; i++) {
      var thA = -(G / ROPE) * Math.sin(hd.th) - 2.4 * hd.om - (ax * .6 / ROPE) * Math.cos(hd.th) + wind / ROPE;
      hd.om += thA * hh; hd.th = clamp(hd.th + hd.om * hh, -0.7, 0.7);
      var phA = -38 * Math.sin(hd.phi - eq) - 3.2 * hd.phiV - thA * 0.3 + wind * 0.004;
      hd.phiV += phA * hh; hd.phi = clamp(hd.phi + hd.phiV * hh, -1.1, 1.1);
    }
    var hx = hd.tx + ROPE * Math.sin(hd.th), hy = hd.ty + ROPE * Math.cos(hd.th);
    hd.hvx = (hx - hd.lx) / dt; hd.lx = hx;
    var a = hd.phi, ly = -rAt(lg, hd.gx);
    cur.x = hx - (hd.gx * Math.cos(a) - ly * Math.sin(a));
    cur.y = hy - (hd.gx * Math.sin(a) + ly * Math.cos(a));
    cur.r = a * DEG;
    setT(cur.el, cur.x, cur.y, cur.r);
    hd.lifted = Math.max(hd.lifted, hd.startY - cur.y);

    var vtop = (S.view ? S.view.y : 0) - 20;
    L.rope.setAttribute('d', 'M' + hd.tx.toFixed(1) + ' ' + vtop.toFixed(1) + 'V' + hd.ty.toFixed(1) + 'L' + hx.toFixed(1) + ' ' + (hy - 8).toFixed(1));
    setT(L.trolley, hd.tx, hd.ty, 0);
    setT(L.hook, hx, hy, 0);
    setT(L.level, hd.tx, hd.ty - 18, 0);
    var err = hd.phi * DEG - wallDeg();
    var still = Math.abs(hd.phiV) < 0.6 && Math.abs(hd.om) < 0.7;
    var good = Math.abs(err) <= PERFECT_DEG && still, ok = Math.abs(err) <= OK_DEG;
    L.bubble.setAttribute('cx', clamp(err * 2.4, -18, 18).toFixed(1));
    L.bubble.setAttribute('fill', good ? '#4F6B3A' : ok ? '#C9A35C' : '#9E2B32');
    L.ghost.classList.toggle('is-ready', good && Math.abs(cur.x - WX) <= PERFECT_DX);

    if (hd.lifted > 30) {
      if (Math.abs(eq * DEG) > 8) tipOnce('tilt', 'Бревно перевешивает в сторону ' + (lg.e - hd.gx > 0 ? 'правого' : 'левого') + ' конца. Опустите его обратно на подкладки и перехватите ближе к тяжёлой стороне.');
      else tipOnce('aim', 'Подведите бревно к срубу и отпустите, когда пузырёк уровня станет зелёным.');
    }
  }

  /* ---------- Падение и приземление ---------- */
  function wallTopAt(x) { return lerp(S.yl, S.yr, (x - (WX - LOG_L / 2)) / LOG_L); }
  function fallTick(dt) {
    var f = fall, lg = cur.lg;
    f.vy += 2400 * dt;
    f.vx *= Math.pow(0.2, dt);
    f.w *= Math.pow(0.4, dt);
    cur.x += f.vx * dt; cur.y += f.vy * dt; f.phi += f.w * dt;
    cur.r = f.phi * DEG;
    setT(cur.el, cur.x, cur.y, cur.r);
    var a = f.phi, c = Math.cos(a), s = Math.sin(a);
    var ends = [[-LOG_L / 2 + 6, rLeft(lg)], [LOG_L / 2 - 6, rRight(lg)]];
    for (var i = 0; i < 2; i++) {
      var ex = cur.x + ends[i][0] * c - ends[i][1] * s, ey = cur.y + ends[i][0] * s + ends[i][1] * c;
      if ((ex > WX - LOG_L / 2 - 10 && ex < WX + LOG_L / 2 + 10 && ey >= wallTopAt(ex)) || ey >= GROUND) { land(); return; }
    }
  }
  function land() {
    var f = fall; fall = null;
    var lg = cur.lg, dx = cur.x - WX, err = f.phi * DEG - wallDeg();
    cur.busy = true;
    if (Math.abs(dx) > OK_DX || Math.abs(err) > OK_DEG) {
      var off = Math.abs(dx) > OK_DX;
      tumble(off ? Math.sign(dx) : Math.sign(err), off ? 'Мимо паза — бревно скатилось со сруба' : 'Легло одним концом и соскочило. Бревно должно висеть ровно');
      return;
    }
    // перекос от сбега наполовину гасится подгонкой чаш и паза — стена не уходит веером
    var a = rLeft(lg), b = rRight(lg), mid = (a + b) / 2;
    var incL = 2 * mid + (a - b) * 0.5, incR = 2 * mid + (b - a) * 0.5;
    var yl = S.yl - incL / 2, yr = S.yr - incR / 2;
    var ty = (yl + yr) / 2, tr = Math.atan2(yr - yl, LOG_L) * DEG;
    var perfect = Math.abs(err) <= PERFECT_DEG && Math.abs(dx) <= PERFECT_DX;
    var me = cur, x0 = me.x, y0 = me.y, r0 = me.r;
    tween(perfect ? 140 : 300, function (k) { me.x = lerp(x0, WX, k); me.y = lerp(y0, ty, k); me.r = lerp(r0, tr, k); setT(me.el, me.x, me.y, me.r); }, function () {
      sfx.thud(); shake(perfect ? 1 : 2);
      dust(WX - 110, ty + 8, 6, 10); dust(WX + 110, ty + 8, 6, 10);
      L.wall.appendChild(me.el);
      // торцы поперечных брёвен в углах — сруб «в чашу»
      var corner = sv('g', { fill: '#E8D4AE', stroke: '#3E3122', 'stroke-width': 1.4 }, L.wall);
      sv('ellipse', { cx: WX - LOG_L / 2 + 16, cy: ((yl + S.yl) / 2 + 3).toFixed(1), rx: 6, ry: (a * .7).toFixed(1) }, corner);
      sv('ellipse', { cx: WX + LOG_L / 2 - 16, cy: ((yr + S.yr) / 2 + 3).toFixed(1), rx: 6, ry: (b * .7).toFixed(1) }, corner);
      S.yl -= incL; S.yr -= incR;
      S.crown++;
      if (perfect) { S.perfect++; S.streak++; sfx.perfect(); popText(S.streak > 1 ? 'Ровно! ×' + S.streak : 'Ровно!', WX, ty - 34, true); }
      else { S.streak = 0; popText('Легло', WX, ty - 34, false); }
      if (S.lastSide != null && S.lastSide === lg.side) {
        say('Комель на комель — стена пошла вкось', 'warn', 3200);
        setTip('Плотники кладут брёвна «комель на вершину»: толстый конец над тонким. Тогда стена растёт ровно. Выбирайте из штабеля бревно, лежащее комлем в другую сторону.');
      } else if (S.crown === 1) {
        setTip('Следующее бревно кладите комлем в другую сторону — так стена останется ровной.');
      }
      S.lastSide = lg.side;
      cur = null;
      renderStats();
      if (S.crown >= CROWNS) { later(finale, 700); return; }
      drawGhost();
      if (S.crown >= 4 && S.wind === 0) { S.wind = 0.45; if (tipOnce('wind', 'Наверху поднялся ветер. Бревно раскачивает сильнее — опускайте между порывами.')) say('Поднялся ветер', null, 2000); }
      if (S.crown >= 6) S.wind = 0.85;
      later(refill, 300);
    });
  }
  function tumble(dir, msg) {
    S.fails++; S.streak = 0;
    sfx.thud(); sfx.err();
    say(msg, 'warn', 3200);
    var me = cur, x0 = me.x, y0 = me.y, r0 = me.r;
    var gx = me.x + dir * 150, gy = GROUND - 10;
    tween(820, function (k) {
      me.x = lerp(x0, gx, k);
      me.y = k < .4 ? lerp(y0, y0 - 6, k / .4) : lerp(y0 - 6, gy, easeIn((k - .4) / .6));
      me.r = lerp(r0, dir * 14, easeOut(k)) + (k > .85 ? dir * 3 * Math.sin((k - .85) * 40) : 0);
      setT(me.el, me.x, me.y, me.r);
    }, function () {
      sfx.clack(); shake(2); dust(me.x, GROUND, 12, 60);
      tween(500, function (k) { me.el.style.opacity = 1 - k; }, function () {
        me.el.remove(); cur = null;
        later(function () { addLog(me.lg); drawStock(); setTip('Бревно вернули в штабель. Возьмите его ближе к точке равновесия и опускайте без раскачки.'); }, 200);
      });
    }, function (k) { return k; });
    renderStats();
  }

  function popText(text, x, y, gold) {
    var t = sv('text', { x: x, y: y, 'text-anchor': 'middle', 'class': 'cg-pop' + (gold ? ' is-gold' : '') }, L.fx);
    t.textContent = text;
    tween(1300, function (k) { t.setAttribute('y', (y - 34 * k).toFixed(1)); t.style.opacity = k < .15 ? k / .15 : k > .6 ? (1 - k) / .4 : 1; }, function () { t.remove(); }, function (k) { return k; });
  }

  /* ---------- Частицы ---------- */
  function dust(x, y, n, spread, color) {
    if (REDUCED.matches) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var c = sv('circle', { r: rnd(1.5, 3.6), fill: color || '#C9B48E' }, L.fx);
      parts.push({ el: c, x: x + rnd(-spread, spread), y: y + rnd(-2, 2), vx: rnd(-60, 60), vy: rnd(-90, -20), g: 160, life: 0, max: rnd(.5, .9) });
    }
  }
  function shake(n) {
    if (REDUCED.matches) return;
    svg.classList.remove('is-shake', 'is-shake2'); void svg.getBoundingClientRect(); svg.classList.add(n > 1 ? 'is-shake2' : 'is-shake');
  }

  /* ---------- Финал: часовня достраивается ---------- */
  function finale() {
    S.phase = 'final';
    root.classList.add('is-final');
    pile.forEach(function (it) { tween(500, function (k) { it.el.style.opacity = 1 - k; }, function () { it.el.remove(); }); });
    pile = [];
    setTip('');
    renderStats();
    clear(L.ghost);
    tween(600, function (k) { L.blueprint.style.opacity = 1 - k; });
    var slope = wallDeg(), topY = (S.yl + S.yr) / 2;
    // всё, что выше сруба, встаёт на него — с тем же наклоном, если стена ушла вкось
    var grp = sv('g', { transform: 'translate(' + WX + ' ' + topY.toFixed(1) + ') rotate(' + slope.toFixed(2) + ')' }, L.top);
    var steps = [
      function () {
        var op = sv('g', null, L.wall,
          '<path d="M' + (WX - 25) + ' 500V440a25 25 0 0 1 50 0V500" fill="#F4ECDD"/>' +
          '<rect x="' + (WX - 90) + '" y="420" width="28" height="26" fill="#F4ECDD"/><path d="M' + (WX - 76) + ' 420v26M' + (WX - 90) + ' 433h28" stroke-width="1.4"/>');
        fadeIn(op); sfx.knock(); dust(WX, 470, 8, 30, '#E3CBA0');
      },
      function () {
        var lines = '';
        for (var i = 0; i < 15; i++) { var x = -112 + i * 16; lines += '<path d="M' + x + ' ' + (-Math.max(0, 108 - Math.abs(x) * 108 / 128)).toFixed(1) + 'V0" stroke="#C4A06C" stroke-width="1"/>'; }
        var r = sv('g', null, grp,
          '<path d="M-132 -2H132" stroke="#5A3F22" stroke-width="6"/>' +
          '<path d="M-128 0L0 -108L128 0Z" fill="#EBD8B2" stroke="#8C6A3E" stroke-width="1.2"/>' + lines +
          '<path d="M-146 8L0 -114L146 8" stroke="#5A3F22" stroke-width="9"/><path d="M-144 5L0 -115L144 5" stroke="#A07C4E" stroke-width="3"/>');
        fadeIn(r, true); sfx.knock(); later(sfx.knock, 140); later(sfx.knock, 280);
      },
      function () {
        var d = sv('g', null, grp,
          '<path d="M-18 -150V-96L0 -111L18 -96V-150Z" fill="url(#cg-log)"/><rect x="-24" y="-157" width="48" height="8" rx="1.5" fill="#E3CBA0"/>' +
          '<path d="M-4 -220v-7h8v7" fill="#E3CBA0"/><path d="M-22 -157C-42 -171 -30 -197 0 -221C30 -197 42 -171 22 -157Z" fill="url(#cg-gold)" stroke="#7A5A22"/><path d="M0 -221C-12 -201 -17 -175 -10 -157M0 -221C12 -201 17 -175 10 -157M0 -221V-157" stroke="#A47F38" stroke-width="1.1"/>');
        fadeIn(d, true); sfx.thud();
      },
      function () {
        // восьмиконечный крест: нижняя перекладина — левый от зрителя конец выше
        var glow = sv('circle', { cx: 0, cy: -260, r: 120, fill: 'url(#cg-glow)', opacity: 0, stroke: 'none' }, grp);
        grp.insertBefore(glow, grp.firstChild);
        var c = sv('g', null, grp, '<g stroke="#7A5A22" stroke-width="3.2"><path d="M0 -227V-293"/><path d="M-7 -284h14"/><path d="M-18 -272h36"/><path d="M-11 -252L11 -242"/></g>');
        fadeIn(c, true);
        tween(1600, function (k) { glow.setAttribute('opacity', (k * .9).toFixed(2)); });
        sfx.bell(); later(sfx.bell, 2000);
        svg.classList.add('is-final');
        sparkles(WX, topY - 260);
      }
    ];
    steps.forEach(function (fn, i) { later(fn, 300 + i * 650); });
    later(function () { showCard('final'); var b = ui.card.querySelector('button'); b && b.focus({ preventScroll: true }); }, 300 + steps.length * 650 + 1400);
  }
  function fadeIn(el, drop) {
    el.style.opacity = 0;
    tween(450, function (k) { el.style.opacity = k; if (drop) el.style.transform = 'translateY(' + (-24 * (1 - k)).toFixed(1) + 'px)'; });
  }
  function sparkles(x, y) {
    for (var i = 0; i < 24; i++) {
      later(function () {
        var s = sv('circle', { r: rnd(1.2, 2.6), fill: '#D9B567' }, L.fx);
        parts.push({ el: s, x: x + rnd(-60, 60), y: y + rnd(-40, 40), vx: rnd(-20, 20), vy: rnd(-40, -10), g: -6, life: 0, max: rnd(1.4, 2.4) });
      }, i * 70);
    }
  }

  /* ---------- Главный цикл ---------- */
  function loop(t) {
    if (!open) return;
    var dt = Math.min(0.05, Math.max(0.001, (t - lastT) / 1000)); lastT = t;
    var n = now();
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i], k = clamp((n - tw.t0) / tw.dur, 0, 1);
      tw.fn(tw.e(k));
      if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); }
    }
    if (hold && cur) holdTick(dt);
    if (fall && cur) fallTick(dt);
    for (var j = parts.length - 1; j >= 0; j--) {
      var p = parts[j];
      p.life += dt;
      if (p.life > p.max) { p.el.remove(); parts.splice(j, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.el.setAttribute('cx', p.x.toFixed(1)); p.el.setAttribute('cy', p.y.toFixed(1));
      p.el.setAttribute('opacity', (1 - p.life / p.max).toFixed(2));
    }
    raf = requestAnimationFrame(loop);
  }

  /* ---------- Запуск: кнопка «Заняться строительством по-серьёзному» в живой иллюстрации ---------- */
  window.KimChapelGame = { open: function (from) { launcher = from || null; openGame(); } };
})();
