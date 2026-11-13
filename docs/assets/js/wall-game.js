/* ==========================================================================
   «Сложи часовню» — игра про стройку газобетонной часовни.

   На сцене — бледный контур будущего храма (вид сбоку, по рендеру проекта).
   Подсвечен текущий ряд с местами под блоки. Блок тянут с поддона и
   отпускают рядом с местом — он встаёт ровно (с допуском). Ряд заполнен —
   он превращается в настоящую стену: штукатурка, цоколь, окна с кирпичными
   арками. Следующий ряд — только после текущего, на пустоту блок не встанет.
   Потом кровля, барабан с куполом и последним — крест.

   Простой режим: крупные блоки, три ряда, окна одним проёмом.
   Сложный: блоки мельче, рядов больше, узкие простенки, допуск точнее.
   Компьютер: простой режим — в блоке «Строим вместе», сложный — на его месте.
   Телефон: кнопка под картинкой и игра на весь экран. Без библиотек.
   ========================================================================== */
(function () {
  'use strict';

  var media = document.querySelector('.build__media');
  var section = document.querySelector('.build');
  if (!media || !section || !window.matchMedia || !window.requestAnimationFrame) return;
  var DESKTOP = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Режимы ----------
     bh, bw — высота и длина блока в единицах чертежа (стена 600 × 300);
     tolX, tolY — насколько можно промахнуться мимо места; tolTop — для кровли,
     купола и креста; porchH — высота притвора (кратна ряду). */
  var CFG = {
    easy: { bh: 100, bw: 200, porchH: 200, tolX: 40, tolY: 50, tolTop: 70 },
    hard: { bh: 60, bw: 144, porchH: 180, tolX: 10, tolY: 16, tolTop: 32 }
  };

  var NS = 'http://www.w3.org/2000/svg';
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
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function f1(v) { return (+v).toFixed(1); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* нет вибрации */ } }

  /* ---------- Звук ---------- */
  var AC = null, muted = false;
  function ac() {
    if (muted) return null;
    try {
      if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C(); }
      if (AC.state === 'suspended') AC.resume();
      return AC;
    } catch (e) { return null; }
  }
  function tone(f, dur, vol, f2, type) {
    var c = ac(); if (!c) return;
    var t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + .05);
  }
  function noise(dur, vol, freq) {
    var c = ac(); if (!c) return;
    var t = c.currentTime, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; fl.type = 'bandpass'; fl.frequency.value = freq || 1500; g.gain.value = vol;
    s.connect(fl); fl.connect(g); g.connect(c.destination); s.start(t);
  }
  var sfx = {
    place: function () { tone(170, .18, .2, 90); noise(.08, .25, 700); },
    knock: function () { tone(420, .07, .12, 260, 'triangle'); noise(.05, .2, 2400); },
    bump: function () { tone(120, .25, .3, 60); noise(.14, .35, 500); },
    saw: function () { for (var i = 0; i < 4; i++) setTimeout(function () { noise(.11, .18, 3200); }, i * 120); },
    crack: function () { noise(.25, .3, 4200); tone(900, .12, .04, 300, 'sawtooth'); },
    good: function () { tone(784, .16, .05); setTimeout(function () { tone(1175, .26, .035); }, 70); },
    err: function () { tone(200, .2, .07, 140, 'triangle'); },
    bell: function () { [[.5, .1, 4], [1, .12, 3], [1.5, .05, 2], [2, .04, 1.5], [3, .02, 1]].forEach(function (p) { tone(196 * p[0], p[2], p[1]); }); }
  };

  /* ==========================================================================
     Игра. host — пустой блок с размерами; mode — 'easy' | 'hard';
     opts.onMode(mode) — попросить переключить режим (для кнопки в финале).
     ========================================================================== */
  function Game(host, mode, opts) {
    opts = opts || {};
    var C = CFG[mode];
    var root = h('div', 'wg wg--' + mode);
    root.innerHTML =
      '<div class="wg-hud" data-wg-hud></div>' +
      '<p class="wg-say" data-wg-say role="status" aria-live="polite"></p>' +
      '<div class="wg-card" data-wg-card hidden></div>';
    host.appendChild(root);
    var ui = { hud: root.querySelector('[data-wg-hud]'), say: root.querySelector('[data-wg-say]'), card: root.querySelector('[data-wg-card]') };
    var svg = sv('svg', { 'class': 'wg-svg', role: 'img', 'aria-label': 'Контур будущей часовни; ряды стены заполняют газобетонными блоками' });
    root.insertBefore(svg, root.firstChild);
    var id = 'wg' + mode + Math.floor(Math.random() * 1e6);

    sv('defs', null, svg,
      '<pattern id="' + id + '-pore" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#EEEBE4"/><circle cx="2" cy="2" r=".7" fill="#D3CEC3"/><circle cx="6.5" cy="5" r=".55" fill="#D9D4CA"/><circle cx="3.5" cy="7.4" r=".45" fill="#D3CEC3"/></pattern>' +
      '<linearGradient id="' + id + '-gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C99A45"/><stop offset=".38" stop-color="#F0D28E"/><stop offset="1" stop-color="#B98A3A"/></linearGradient>' +
      '<linearGradient id="' + id + '-cop" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#A9592F"/><stop offset=".4" stop-color="#C9784A"/><stop offset="1" stop-color="#9C5029"/></linearGradient>' +
      '<radialGradient id="' + id + '-glow"><stop offset="0" stop-color="#F6DFA4" stop-opacity=".9"/><stop offset=".5" stop-color="#EBC877" stop-opacity=".3"/><stop offset="1" stop-color="#EBC877" stop-opacity="0"/></radialGradient>' +
      '<clipPath id="' + id + '-clip"><rect data-clip x="-400" y="0" width="1600" height="0"/></clipPath>');
    var PORE = 'url(#' + id + '-pore)', GOLD = 'url(#' + id + '-gold)', COP = 'url(#' + id + '-cop)';
    var clipRect = svg.querySelector('[data-clip]');

    var Lr = {};
    Lr.bg = sv('g', { fill: 'none', stroke: '#3E3122', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    Lr.ghost = sv('g', { 'class': 'wg-ghost' }, svg);                                   // бледный контур храма
    Lr.done = sv('g', { 'clip-path': 'url(#' + id + '-clip)' }, svg);                 // готовые ряды — настоящая стена
    Lr.raw = sv('g', null, svg);                                                       // блоки текущего ряда
    Lr.slots = sv('g', null, svg);                                                     // места под блоки
    Lr.top = sv('g', null, svg);                                                       // кровля, купол, крест
    Lr.pallet = sv('g', null, svg);
    Lr.drag = sv('g', null, svg);
    Lr.fx = sv('g', null, svg);

    /* ---------- Чертёж часовни (вид сбоку, по рендеру проекта) ----------
       Мир: земля y = 0, стены до y = -WALL. Притвор слева (вход смотрит влево),
       апсида справа, над ними кровля, барабан с куполом и крест. */
    var WALL = 300, PL = 40;
    var PORCH = { x0: -170, x1: 0, top: -C.porchH };
    var MAIN = { x0: 0, x1: 600, top: -WALL };
    var APSE = { x0: 600, x1: 690, top: -WALL };
    var WINS = mode === 'easy'
      ? [{ x0: 180, x1: 390, y0: -200, y1: -100, group: true }]
      : [{ x0: 186, x1: 226, y0: -210, y1: -100 }, { x0: 266, x1: 306, y0: -210, y1: -100 }, { x0: 346, x1: 386, y0: -210, y1: -100 }, { x0: 630, x1: 660, y0: -200, y1: -110 }];
    var ROOF = { ax: 300, ay: -345 }, DOME = { ax: 300, ay: -455 }, CROSS = { ax: 300, ay: -555 };

    function archWin(x0, x1, y0, y1) {   // арочное окно с кирпичной аркой и подоконником
      var w = x1 - x0, r = w / 2, cx = x0 + r;
      return '<path d="M' + x0 + ' ' + y1 + 'V' + (y0 + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + x1 + ' ' + (y0 + r) + 'V' + y1 + 'Z" fill="#4F5F68" stroke="#3E3122" stroke-width="1.6"/>' +
        '<path d="M' + cx + ' ' + (y0 + 3) + 'V' + y1 + 'M' + x0 + ' ' + (y0 + r + 30) + 'H' + x1 + '" stroke="#C9A35C" stroke-width="1"/>' +
        '<path d="M' + (x0 - 5) + ' ' + (y0 + r) + 'A' + (r + 5) + ' ' + (r + 5) + ' 0 0 1 ' + (x1 + 5) + ' ' + (y0 + r) + '" fill="none" stroke="#C4643C" stroke-width="8" stroke-dasharray="6 1.6"/>' +
        '<rect x="' + (x0 - 5) + '" y="' + y1 + '" width="' + (w + 10) + '" height="5" fill="#E8DCC8" stroke="#3E3122" stroke-width="1"/>';
    }
    function wallsArt() {
      var o = '', P = '#F6EEE2';
      // штукатурка: притвор, стена, апсида (скруглённая справа)
      o += '<rect x="' + PORCH.x0 + '" y="' + PORCH.top + '" width="' + (PORCH.x1 - PORCH.x0) + '" height="' + (-PORCH.top) + '" fill="' + P + '" stroke="#3E3122" stroke-width="2"/>';
      o += '<path d="M' + APSE.x0 + ' 0V' + APSE.top + 'H' + (APSE.x1 - 40) + 'Q' + APSE.x1 + ' ' + APSE.top + ' ' + APSE.x1 + ' ' + (APSE.top + 40) + 'V0Z" fill="' + P + '" stroke="#3E3122" stroke-width="2"/>';
      o += '<rect x="' + MAIN.x0 + '" y="' + MAIN.top + '" width="' + (MAIN.x1 - MAIN.x0) + '" height="' + (-MAIN.top) + '" fill="' + P + '" stroke="#3E3122" stroke-width="2"/>';
      // каменный цоколь
      o += '<rect x="' + PORCH.x0 + '" y="' + (-PL) + '" width="' + (APSE.x1 - PORCH.x0) + '" height="' + PL + '" fill="#D8C6A4" stroke="#3E3122" stroke-width="2"/>';
      for (var x = PORCH.x0 + 4; x < APSE.x1 - 10; x += 34) o += '<path d="M' + x + ' ' + (-PL) + 'v' + (PL / 2) + 'M' + (x + 17) + ' ' + (-PL / 2) + 'v' + (PL / 2) + '" stroke="#B8A47E" stroke-width="1"/>';
      o += '<path d="M' + PORCH.x0 + ' ' + (-PL / 2) + 'H' + APSE.x1 + '" stroke="#B8A47E" stroke-width="1"/>';
      // окна: в простом режиме — три окна в одном проёме
      WINS.forEach(function (w) {
        if (w.group) { var st = (w.x1 - w.x0) / 3; for (var k = 0; k < 3; k++) o += archWin(w.x0 + st * k + st * .22, w.x0 + st * (k + 1) - st * .22, w.y0 - 6, w.y1 - 4); }
        else o += archWin(w.x0, w.x1, w.y0, w.y1);
      });
      if (mode === 'easy') o += archWin(630, 660, -200, -110);
      // кирпичный крест на стене
      o += '<path d="M500 -230V-130M486 -200H514" stroke="#C4643C" stroke-width="8"/>';
      // притвор стоит к нам боком: кирпичная кромка портала слева и ступени
      o += '<rect x="' + (PORCH.x0 - 6) + '" y="' + PORCH.top + '" width="12" height="' + (-PORCH.top - PL) + '" fill="#C4643C" stroke="#3E3122" stroke-width="1.2"/>';
      o += '<path d="M' + PORCH.x0 + ' 0h-60v-10h20v-10h20v-10h20" fill="#E3D6BE" stroke="#3E3122" stroke-width="1.4"/>';
      return o;
    }
    function roofArt() {
      var o = '', seams = '';
      for (var x = 6; x < 600; x += 18) seams += '<path d="M' + x + ' -304L' + (300 + (x - 300) * .8) + ' -386" stroke="#8E4A2A" stroke-width="1"/>';
      o += '<path d="M-12 -298L60 -390H540L612 -298Z" fill="' + COP + '" stroke="#3E3122" stroke-width="2"/>' + seams;
      o += '<path d="M' + (PORCH.x0 - 14) + ' ' + (PORCH.top + 2) + 'L' + (PORCH.x0 + 4) + ' ' + (PORCH.top - 46) + 'H6V' + (PORCH.top + 2) + 'Z" fill="' + COP + '" stroke="#3E3122" stroke-width="2"/>';
      for (var px = PORCH.x0 + 8; px < 0; px += 16) o += '<path d="M' + px + ' ' + (PORCH.top) + 'V' + (PORCH.top - 44) + '" stroke="#8E4A2A" stroke-width="1"/>';
      o += '<path d="M594 -300Q700 -306 702 -268H594Z" fill="' + COP + '" stroke="#3E3122" stroke-width="2"/>';
      return o;
    }
    function domeArt() {
      var o = '<rect x="228" y="-460" width="144" height="74" fill="#F6EEE2" stroke="#3E3122" stroke-width="2"/>';
      [258, 300, 342].forEach(function (x) { o += archWin(x - 10, x + 10, -448, -400); });
      o += '<path d="M220 -460C228 -528 372 -528 380 -460Z" fill="' + COP + '" stroke="#3E3122" stroke-width="2"/>';
      o += '<path d="M268 -462Q276 -505 300 -514M332 -462Q324 -505 300 -514M300 -514V-462" fill="none" stroke="#8E4A2A" stroke-width="1.2"/>';
      o += '<path d="M214 -460H386" stroke="#3E3122" stroke-width="3"/>';
      return o;
    }
    function crossArt() {
      // восьмиконечный крест: нижняя перекладина — левый от зрителя конец выше
      return '<circle cx="300" cy="-560" r="70" fill="url(#' + id + '-glow)"/>' +
        '<circle cx="300" cy="-522" r="7" fill="' + GOLD + '" stroke="#7A5A22" stroke-width="1.4"/>' +
        '<g stroke="#B88A3E" stroke-width="4" stroke-linecap="round"><path d="M300 -529V-596M293 -588h14M284 -576h32M291 -556l18 8"/></g>';
    }
    var STAGES = [
      { key: 'roof', name: 'Кровля', art: roofArt, a: ROOF },
      { key: 'dome', name: 'Барабан и купол', art: domeArt, a: DOME },
      { key: 'cross', name: 'Крест', art: crossArt, a: CROSS }
    ];

    /* ---------- Ряды и места под блоки ----------
       Ряд — полоса высотой C.bh. В ряд входят те части здания, что достают до
       его верха; окна вырезаются. Места раскладываются с перевязкой: чётные ряды
       начинаются с целого блока, нечётные — с половинки. */
    function buildRows() {
      var rows = [], n = Math.round(WALL / C.bh);
      for (var r = 0; r < n; r++) {
        var yb = -r * C.bh, yt = yb - C.bh;
        var spans = [];
        [PORCH, MAIN, APSE].forEach(function (p) { if (p.top <= yt + .5) spans.push([p.x0, p.x1]); });
        spans.sort(function (a, b) { return a[0] - b[0]; });
        var merged = [];
        spans.forEach(function (s) { var l = merged[merged.length - 1]; if (l && s[0] <= l[1] + .5) l[1] = Math.max(l[1], s[1]); else merged.push(s.slice()); });
        WINS.forEach(function (w) {
          if (!(yt < w.y1 && yb > w.y0)) return;
          var out = [];
          merged.forEach(function (s) {
            if (w.x1 <= s[0] || w.x0 >= s[1]) { out.push(s); return; }
            if (w.x0 > s[0]) out.push([s[0], w.x0]);
            if (w.x1 < s[1]) out.push([w.x1, s[1]]);
          });
          merged = out;
        });
        var slots = [];
        merged.forEach(function (s) {
          var x = s[0], first = true;
          while (x < s[1] - .5) {
            var w = first && r % 2 ? C.bw / 2 : C.bw;
            first = false;
            if (s[1] - (x + w) < C.bw * .3) w = s[1] - x;    // остаток к концу — один подрезанный блок
            slots.push({ x: x, w: w, y: yt, h: C.bh, row: r, filled: false });
            x += w;
          }
        });
        rows.push({ y: yt, yb: yb, slots: slots });
      }
      return rows;
    }

    /* ---------- Раскладка ---------- */
    var portrait = false, view = null, PAL = { x: 0, y: 0 };
    function layout() {
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      portrait = r.width / r.height < 1.05;
      var box = portrait ? { x: -250, y: -620, w: 960, h: 790 } : { x: -250, y: -620, w: 1200, h: 660 };
      PAL = portrait ? { x: 230, y: 90 } : { x: 830, y: -30 };
      var k = Math.max(box.w / r.width, box.h / r.height), vw = r.width * k, vh = r.height * k;
      view = { x: box.x - (vw - box.w) / 2, y: box.y - (vh - box.h) / 2, w: vw, h: vh };
      svg.setAttribute('viewBox', [view.x, view.y, view.w, view.h].map(f1).join(' '));
      drawBg(); renderPallet(); renderSlots();
    }
    function drawBg() {
      clear(Lr.bg);
      var gx0 = view.x - 40, gx1 = view.x + view.w + 40, sx = view.x + view.w - 90, sy = view.y + 80;
      sv('g', null, Lr.bg,
        '<circle cx="' + f1(sx) + '" cy="' + f1(sy) + '" r="30" stroke="#B88A3E"/><g stroke="#C9A35C" stroke-width="1.6"><path d="M' + f1(sx) + ' ' + f1(sy - 44) + 'v-12M' + f1(sx) + ' ' + f1(sy + 44) + 'v12M' + f1(sx - 44) + ' ' + f1(sy) + 'h-12M' + f1(sx + 44) + ' ' + f1(sy) + 'h12"/></g>' +
        '<path d="M' + f1(view.x + 40) + ' ' + f1(view.y + 90) + 'c30-10 60-10 90 0M' + f1(view.x + view.w * .5) + ' ' + f1(view.y + 50) + 'c26-9 52-9 78 0" stroke="#C9B48E" stroke-width="1.4"/>' +
        '<path d="M' + f1(gx0) + ' 2c' + f1((gx1 - gx0) * .3) + ' 4 ' + f1((gx1 - gx0) * .6) + ' -3 ' + f1(gx1 - gx0) + ' 1"/>' +
        '<g stroke="#7E7A4E" stroke-width="1.4"><path d="M' + f1(gx0 + 60) + ' 12l4-10M' + f1(gx0 + 90) + ' 13l3-9M' + f1(gx1 - 120) + ' 12l4-10M' + f1(gx1 - 80) + ' 13l3-9"/></g>');
    }

    /* ---------- Состояние ---------- */
    var S = null, raf = 0, tweens = [], parts = [], timers = [], alive = true;
    function later(fn, ms) { var t = setTimeout(function () { if (alive) fn(); }, ms); timers.push(t); }
    function tween(dur, fn, done) { tweens.push({ t0: performance.now(), dur: dur, fn: fn, done: done }); kick(); }

    function reset() {
      timers.forEach(clearTimeout); timers = []; tweens = [];
      parts.forEach(function (p) { p.el.remove(); }); parts = [];
      [Lr.ghost, Lr.done, Lr.raw, Lr.slots, Lr.top, Lr.pallet, Lr.drag, Lr.fx].forEach(clear);
      S = { phase: 'intro', rows: buildRows(), row: 0, stage: 0, placed: 0, miss: 0, drag: null, t0: 0 };
      // бледный контур будущего храма
      sv('g', { opacity: .16 }, Lr.ghost, wallsArt() + roofArt() + domeArt() + crossArt());
      sv('g', { 'class': 'wg-outline' }, Lr.ghost,
        '<path d="M' + PORCH.x0 + ' 0V' + PORCH.top + 'H0V' + MAIN.top + 'H' + (APSE.x1 - 40) + 'Q' + APSE.x1 + ' ' + APSE.top + ' ' + APSE.x1 + ' ' + (APSE.top + 40) + 'V0"/>' +
        '<path d="M-12 -298L60 -390H540L612 -298M228 -390V-460M372 -390V-460M220 -460C228 -528 372 -528 380 -460M300 -529V-596"/>');
      sv('g', null, Lr.done, wallsArt());
      clipRect.setAttribute('y', '0'); clipRect.setAttribute('height', '0');
      root.classList.remove('is-final'); svg.classList.remove('is-final');
      if (view) { renderSlots(); renderPallet(); }
      hud();
    }

    /* ---------- Места под блоки и сами блоки ---------- */
    function curRow() { return S.rows[S.row]; }
    function renderSlots() {
      clear(Lr.slots);
      if (!S || S.phase !== 'play') return;
      var row = curRow();
      sv('rect', { x: PORCH.x0 - 30, y: row.y, width: APSE.x1 - PORCH.x0 + 60, height: row.yb - row.y, 'class': 'wg-band' }, Lr.slots);
      row.slots.forEach(function (s) {
        if (s.filled) return;
        s.el = sv('rect', { x: f1(s.x + 3), y: f1(s.y + 3), width: f1(s.w - 6), height: f1(s.h - 6), rx: 3, 'class': 'wg-slot' + (S.drag && S.drag.target === s ? ' is-target' : '') }, Lr.slots);
      });
    }
    function blockMarkup(w, hgt) {
      return '<rect x="0" y="0" width="' + f1(w) + '" height="' + f1(hgt) + '" fill="' + PORE + '" stroke="#3E3122" stroke-width="2" rx="1.5"/>' +
        '<path d="M' + f1(w * .16) + ' ' + f1(hgt * .34) + 'h' + f1(w * .22) + '" stroke="#DAD5CB" stroke-width="1.2"/>';
    }
    function placeBlock(s) {
      s.filled = true; S.placed++;
      var g = sv('g', { transform: 'translate(' + f1(s.x) + ' ' + f1(s.y) + ')' }, Lr.raw, blockMarkup(s.w, s.h));
      s.block = g;
      g.style.opacity = 0;
      tween(140, function (k) { g.style.opacity = k; g.setAttribute('transform', 'translate(' + f1(s.x) + ' ' + f1(s.y - 8 * (1 - k)) + ')'); });
      sfx.place(); buzz(10);
      dust(s.x + s.w / 2, s.y + s.h, 4);
      if (curRow().slots.every(function (q) { return q.filled; })) later(rowDone, 260);
      renderSlots(); hud();
    }
    // ряд заполнен — блоки становятся настоящей стеной
    function rowDone() {
      var row = curRow(), blocks = row.slots.map(function (q) { return q.block; });
      var y0 = +clipRect.getAttribute('y'), h0 = +clipRect.getAttribute('height');
      tween(650, function (k) {
        clipRect.setAttribute('y', f1(lerp(y0, row.y, k)));
        clipRect.setAttribute('height', f1(lerp(h0, -row.y, k)));
        blocks.forEach(function (b) { b.style.opacity = 1 - k; });
      }, function () { blocks.forEach(function (b) { b.remove(); }); });
      sfx.good();
      S.row++;
      hud();
      if (S.row >= S.rows.length) {
        S.phase = 'top'; renderSlots();
        later(function () { say('Стены готовы! Теперь — кровля: перетащите её на место', 'ok', 2800); renderPallet(); }, 600);
      } else {
        say(S.row === 1 ? 'Ряд готов! Следующий — только на него' : 'Ряд ' + S.row + ' готов', 'ok', 1600);
        renderSlots(); renderPallet();
      }
    }

    /* ---------- Поддон: блок, а потом кровля, купол и крест ---------- */
    function renderPallet() {
      clear(Lr.pallet);
      if (!S || !view) return;
      var g = sv('g', { transform: 'translate(' + f1(PAL.x) + ' ' + f1(PAL.y) + ')' }, Lr.pallet);
      sv('g', { fill: 'none', stroke: '#3E3122', 'stroke-width': 2 }, g, '<rect x="-80" y="0" width="160" height="8" fill="#CDB289"/><rect x="-80" y="13" width="160" height="6" fill="#CDB289"/><path d="M-70 8v5M0 8v5M70 8v5" stroke="#A88A5C" stroke-width="5"/>');
      if (S.phase === 'play') {
        var bw = Math.min(C.bw, 140) * .8, bh = C.bh * .8 * (Math.min(C.bw, 140) / C.bw);
        for (var i = 0; i < 2; i++) sv('g', { transform: 'translate(' + f1(-bw / 2 + i * 6 - 3) + ' ' + f1(-bh * (i + 1) - i * 2) + ')' }, g, blockMarkup(bw, bh));
        S.palHit = { x: PAL.x - bw / 2 - 12, y: PAL.y - bh * 2 - 16, w: bw + 24, h: bh * 2 + 24 };
        g.classList.add('wg-take');
        sv('text', { x: 0, y: 40, 'text-anchor': 'middle', 'class': 'wg-pal-label' }, g).textContent = 'возьмите блок';
      } else if (S.phase === 'top') {
        var st = STAGES[S.stage], sc = st.key === 'roof' ? .28 : .5;
        var mini = sv('g', { transform: 'translate(' + f1(-st.a.ax * sc) + ' ' + f1(-st.a.ay * sc - (st.key === 'roof' ? 34 : st.key === 'dome' ? 46 : 26)) + ') scale(' + sc + ')' }, g, st.art());
        mini.style.pointerEvents = 'none';
        S.palHit = { x: PAL.x - 100, y: PAL.y - 110, w: 200, h: 120 };
        g.classList.add('wg-take');
        sv('text', { x: 0, y: 40, 'text-anchor': 'middle', 'class': 'wg-pal-label' }, g).textContent = st.name.toLowerCase();
        // где должна встать деталь
        clear(Lr.slots);
        sv('circle', { cx: st.a.ax, cy: st.a.ay, r: C.tolTop, 'class': 'wg-spot' }, Lr.slots);
      } else S.palHit = null;
    }

    /* ---------- Перетаскивание ---------- */
    function wpt(e) {
      var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      var m = svg.getScreenCTM(); return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    }
    function inPal(wp) { var b = S.palHit; return b && wp.x >= b.x && wp.x <= b.x + b.w && wp.y >= b.y && wp.y <= b.y + b.h; }
    // ближайшее свободное место текущего ряда в пределах допуска
    function findSlot(wp) {
      var best = null, row = curRow();
      row.slots.forEach(function (s) {
        if (s.filled) return;
        var dx = Math.abs(wp.x - (s.x + s.w / 2)), dy = Math.abs(wp.y - (s.y + s.h / 2));
        if (dx <= s.w / 2 + C.tolX && dy <= s.h / 2 + C.tolY) { var d = dx + dy * .5; if (!best || d < best.d) best = { s: s, d: d }; }
      });
      return best && best.s;
    }
    var ptr = null;
    svg.addEventListener('pointerdown', function (e) {
      if (!S || (S.phase !== 'play' && S.phase !== 'top') || ptr) return;
      var wp = wpt(e);
      if (!inPal(wp)) return;
      e.preventDefault();
      try { svg.setPointerCapture(e.pointerId); } catch (er) { /* */ }
      ptr = { id: e.pointerId };
      if (S.phase === 'play') {
        S.drag = { kind: 'block', el: sv('g', { 'class': 'wg-held' }, Lr.drag, blockMarkup(C.bw, C.bh)), w: C.bw, target: null };
      } else {
        var st = STAGES[S.stage];
        S.drag = { kind: 'top', st: st, el: sv('g', { 'class': 'wg-held' }, Lr.drag, st.art()), dx: 0, dy: 0 };
      }
      sfx.knock();
      moveDrag(wp);
    });
    function moveDrag(wp) {
      var d = S.drag; if (!d) return;
      if (d.kind === 'block') {
        var s = findSlot(wp);
        if (s !== d.target) { d.target = s; renderSlots(); }
        var w = s ? s.w : C.bw, x = s ? s.x : wp.x - w / 2, y = s ? s.y : wp.y - C.bh / 2;
        if (s) { x = lerp(wp.x - w / 2, s.x, .65); y = lerp(wp.y - C.bh / 2, s.y, .65); }
        if (w !== d.w) { clear(d.el); d.el.innerHTML = blockMarkup(w, C.bh); d.w = w; }
        d.el.setAttribute('transform', 'translate(' + f1(x) + ' ' + f1(y) + ')');
      } else {
        var near = Math.hypot(wp.x - d.st.a.ax, wp.y - d.st.a.ay) <= C.tolTop;
        d.near = near;
        var ox = near ? lerp(wp.x - d.st.a.ax, 0, .7) : wp.x - d.st.a.ax, oy = near ? lerp(wp.y - d.st.a.ay, 0, .7) : wp.y - d.st.a.ay;
        d.el.setAttribute('transform', 'translate(' + f1(ox) + ' ' + f1(oy) + ')');
        Lr.slots.classList.toggle('is-near', near);
      }
    }
    svg.addEventListener('pointermove', function (e) {
      var wp = wpt(e);
      if (ptr && e.pointerId === ptr.id) { moveDrag(wp); return; }
      if (S && S.palHit) svg.style.cursor = inPal(wp) ? 'grab' : '';
    });
    function endDrag(e, cancel) {
      if (!ptr || e.pointerId !== ptr.id) return;
      ptr = null;
      var d = S.drag; S.drag = null;
      if (!d) return;
      var wp = wpt(e);
      d.el.remove();
      Lr.slots.classList.remove('is-near');
      if (cancel) { renderSlots(); return; }
      if (d.kind === 'block') {
        var s = findSlot(wp);
        if (s) placeBlock(s);
        else {
          renderSlots();
          if (!inPal(wp)) {
            S.miss++; sfx.err();
            // блок над пустотой или выше текущего ряда — объясняем почему
            var row = curRow();
            if (wp.y < row.y - C.tolY) say('Сначала закончите этот ряд — выше блоку не на что опереться', 'warn', 2400);
            else if (wp.y > row.yb + C.tolY && wp.y < 0) say('Этот ряд уже готов — ставьте в подсвеченный', 'warn', 2200);
            else say('Мимо — ставьте блок на подсвеченное место', 'warn', 2000);
          }
        }
      } else {
        if (Math.hypot(wp.x - d.st.a.ax, wp.y - d.st.a.ay) <= C.tolTop) topPlaced(d.st);
        else { if (!inPal(wp)) { S.miss++; sfx.err(); say('Не на месте — подведите к подсвеченному кругу', 'warn', 2000); } }
      }
    }
    svg.addEventListener('pointerup', function (e) { endDrag(e, false); });
    svg.addEventListener('pointercancel', function (e) { endDrag(e, true); });
    ['touchstart', 'touchmove'].forEach(function (t) { svg.addEventListener(t, function (e) { if (ptr || (S && S.palHit && inPal(wpt(e.touches[0] || e.changedTouches[0])))) e.preventDefault(); }, { passive: false }); });
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    function topPlaced(st) {
      var g = sv('g', null, Lr.top, st.art());
      g.style.opacity = 0;
      tween(380, function (k) { g.style.opacity = k; g.setAttribute('transform', 'translate(0 ' + f1(-14 * (1 - k)) + ')'); });
      sfx.place(); shake();
      S.stage++;
      hud();
      if (S.stage >= STAGES.length) { clear(Lr.slots); clear(Lr.pallet); S.palHit = null; later(finale, 500); return; }
      say(st.name + ' на месте! Дальше — ' + STAGES[S.stage].name.toLowerCase(), 'ok', 2200);
      renderPallet();
    }

    /* ---------- Панель, подсказки, карточки ---------- */
    function hud() {
      if (!S) return;
      var total = 0; S.rows.forEach(function (r) { total += r.slots.length; });
      ui.hud.innerHTML = S.phase === 'intro' || S.phase === 'final' ? '' :
        '<span><b>Ряд</b>' + Math.min(S.row + 1, S.rows.length) + ' / ' + S.rows.length + '</span>' +
        '<span><b>Блоки</b>' + S.placed + ' / ' + total + '</span>' +
        (S.phase === 'top' ? '<span><b>Верх</b>' + S.stage + ' / ' + STAGES.length + '</span>' : '');
    }
    var sayT = 0;
    function say(t, tone, ms) {
      ui.say.textContent = t;
      ui.say.className = 'wg-say is-on' + (tone ? ' wg-say--' + tone : '');
      clearTimeout(sayT); sayT = setTimeout(function () { ui.say.classList.remove('is-on'); }, ms || 2200);
    }
    function shake() { if (REDUCED.matches) return; svg.classList.remove('is-shake'); void svg.getBoundingClientRect(); svg.classList.add('is-shake'); }
    function dust(x, y, n) {
      if (REDUCED.matches) n = 2;
      for (var i = 0; i < n; i++) {
        var c = sv('circle', { r: rnd(1.5, 3.5), fill: '#D6D0C4' }, Lr.fx);
        parts.push({ el: c, x: x + rnd(-20, 20), y: y, vx: rnd(-60, 60), vy: rnd(-90, -20), life: 0, max: rnd(.4, .7) });
      }
      kick();
    }

    function showCard(kind) {
      var html;
      if (kind === 'intro') {
        html = '<span class="eyebrow">' + (mode === 'hard' ? 'Сложный режим' : 'Мини-игра') + '</span><h3>Сложи часовню</h3>' +
          '<ul class="wg-rules">' +
            '<li><b>Перетаскивайте блоки</b> с поддона в подсвеченный ряд — блок сам встанет ровно.</li>' +
            '<li><b>Ряд заполнен</b> — он становится стеной часовни, и открывается следующий.</li>' +
            '<li><b>Потом</b> — кровля, купол и крест.</li>' +
            (mode === 'hard' ? '<li><b>Сложнее:</b> блоки мельче, рядов больше, узкие простенки между окнами и точнее прицел.</li>' : '') +
          '</ul>' +
          '<button class="btn btn--gold btn--small" type="button" data-wg="start">Начать <svg aria-hidden="true"><use href="#i-arrow"/></svg></button>';
      } else {
        var secs = Math.round((performance.now() - S.t0) / 1000), mm = Math.floor(secs / 60), ss = secs % 60;
        html = '<h3>Часовня готова!</h3>' +
          '<p class="wg-card__meta">' + S.placed + ' ' + plural(S.placed, ['блок', 'блока', 'блоков']) + ' · ' + (mm ? mm + ' мин ' : '') + ss + ' с' + (S.miss ? ' · ' + S.miss + ' ' + plural(S.miss, ['промах', 'промаха', 'промахов']) : ' · без промахов') + '</p>' +
          '<figure class="wg-render"><img src="assets/img/chapel-render.jpg" alt="Проект часовни: белые стены, три арочных окна, медная кровля и купол с крестом" loading="lazy"><figcaption>Так будет выглядеть часовня</figcaption></figure>' +
          '<p class="wg-card__lead">В игре — несколько минут. В жизни — месяцы работы каменщиков и тысячи настоящих блоков. Если есть возможность — подключайтесь.</p>' +
          '<div class="wg-actions"><button class="btn btn--gold btn--small" type="button" data-wg="donate">Поддержать строительство <svg aria-hidden="true"><use href="#i-arrow"/></svg></button>' +
          '<button class="wg-link" type="button" data-wg="again">Сложить заново</button>' +
          (mode === 'easy' && opts.onMode ? '<button class="wg-link" type="button" data-wg="hard">Сложный режим</button>' : '') + '</div>';
      }
      ui.card.innerHTML = html;
      ui.card.className = 'wg-card wg-card--' + kind;
      ui.card.hidden = false;
    }
    function start() { ui.card.hidden = true; S.phase = 'play'; S.t0 = performance.now(); renderSlots(); renderPallet(); hud(); say('Возьмите блок с поддона и перетащите в подсвеченный ряд', null, 3000); }
    ui.card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-wg]'); if (!b) return;
      var a = b.getAttribute('data-wg');
      if (a === 'start') start();
      else if (a === 'again') { reset(); start(); }
      else if (a === 'donate') { var d = document.querySelector('[data-modal-open="donate"]'); if (opts.onDonate) opts.onDonate(); if (d) d.click(); }
      else if (a === 'hard' && opts.onMode) opts.onMode('hard');
    });

    function finale() {
      S.phase = 'final';
      root.classList.add('is-final'); svg.classList.add('is-final');
      Lr.ghost.style.opacity = 0;
      sfx.bell(); hud();
      later(function () { showCard('final'); }, 1100);
    }

    /* ---------- Цикл ---------- */
    function kick() { if (!raf && alive) raf = requestAnimationFrame(loop); }
    var lastT = 0;
    function loop(t) {
      raf = 0; if (!alive) return;
      var dt = Math.min(.05, lastT ? (t - lastT) / 1000 : .016); lastT = t;
      for (var i = tweens.length - 1; i >= 0; i--) {
        var tw = tweens[i], k = clamp((t - tw.t0) / tw.dur, 0, 1);
        tw.fn(easeOut(k)); if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); }
      }
      for (var j = parts.length - 1; j >= 0; j--) {
        var p = parts[j]; p.life += dt;
        if (p.life > p.max) { p.el.remove(); parts.splice(j, 1); continue; }
        p.vy += 200 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        p.el.setAttribute('cx', f1(p.x)); p.el.setAttribute('cy', f1(p.y)); p.el.setAttribute('opacity', f1(1 - p.life / p.max));
      }
      if (tweens.length || parts.length) raf = requestAnimationFrame(loop); else lastT = 0;
    }

    var ro = window.ResizeObserver ? new ResizeObserver(function () { layout(); }) : null;
    if (ro) ro.observe(host); else window.addEventListener('resize', layout);
    reset();
    layout();
    showCard('intro');

    return {
      destroy: function () { alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); if (ro) ro.disconnect(); root.remove(); },
      root: root,
      _state: function () { return S; }
    };
  }

  /* ==========================================================================
     Встраивание на страницу
     ========================================================================== */
  var easy = null, hard = null, overlay = null, launcher = null;
  function switcher(active, onEasy, onHard) {
    var g = h('div', 'kim-modes wg-modes');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', 'Режим игры');
    g.innerHTML = '<button type="button" aria-pressed="' + (active === 'easy') + '">Простой режим</button><button type="button" aria-pressed="' + (active === 'hard') + '">Сложный режим</button>';
    g.children[0].addEventListener('click', function () { if (active !== 'easy') onEasy(); });
    g.children[1].addEventListener('click', function () { if (active !== 'hard') onHard(); });
    return g;
  }
  function soundBtn() {
    var b = h('button', 'wg-icon', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path class="wg-wave" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path class="wg-mute" d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>');
    b.type = 'button'; b.setAttribute('aria-label', 'Звук'); b.setAttribute('aria-pressed', String(!muted)); b.classList.toggle('is-muted', muted);
    b.addEventListener('click', function () { muted = !muted; document.querySelectorAll('.wg-icon[aria-label="Звук"]').forEach(function (x) { x.setAttribute('aria-pressed', String(!muted)); x.classList.toggle('is-muted', muted); }); });
    return b;
  }

  /* --- компьютер: простой режим в блоке, сложный — на месте блока --- */
  var easyHost = null, easyBar = null, hardBox = null;
  function mountDesktop() {
    media.classList.add('is-wall');
    easyHost = h('div', 'wg-host wg-host--easy');
    easyBar = h('div', 'wg-bar');
    easyBar.appendChild(switcher('easy', function () {}, openHard));
    media.appendChild(easyHost); media.appendChild(easyBar);
    easy = Game(easyHost, 'easy', { onMode: function (m) { if (m === 'hard') openHard(); } });
  }
  function unmountDesktop() {
    closeHard();
    if (easy) { easy.destroy(); easy = null; }
    if (easyHost) { easyHost.remove(); easyBar.remove(); easyHost = easyBar = null; }
    media.classList.remove('is-wall');
  }
  function openHard() {
    if (hard) return;
    hardBox = h('div', 'wg-hard');
    hardBox.setAttribute('role', 'region');
    hardBox.setAttribute('aria-label', 'Игра «Сложи часовню», сложный режим');
    var head = h('header', 'wg-hard__head', '<div><span class="eyebrow">Строим вместе</span><h2>Сложи часовню</h2></div>');
    var tools = h('div', 'wg-hard__tools');
    tools.appendChild(switcher('hard', closeHard, function () {}));
    tools.appendChild(soundBtn());
    var x = h('button', 'wg-icon', '<svg aria-hidden="true"><use href="#i-close"/></svg>'); x.type = 'button'; x.setAttribute('aria-label', 'Закрыть'); x.addEventListener('click', closeHard);
    tools.appendChild(x);
    head.appendChild(tools);
    var host = h('div', 'wg-host wg-host--hard');
    hardBox.appendChild(head); hardBox.appendChild(host);
    section.insertBefore(hardBox, section.querySelector('.stages'));
    section.classList.add('is-hard');
    hard = Game(host, 'hard', {});
    var y = section.getBoundingClientRect().top + window.pageYOffset - 20;
    window.scrollTo({ top: y, behavior: REDUCED.matches ? 'auto' : 'smooth' });
  }
  function closeHard() {
    if (!hard) return;
    hard.destroy(); hard = null;
    hardBox.remove(); hardBox = null;
    section.classList.remove('is-hard');
  }

  /* --- телефон и планшет: кнопка под картинкой, игра на весь экран --- */
  function mountMobile() {
    launcher = h('button', 'wg-launch',
      '<span class="wg-launch__icon"><svg aria-hidden="true"><use href="#i-hammer"/></svg></span>' +
      '<span class="wg-launch__text"><b>Сложи часовню сам</b><small>Мини-игра · газобетон</small></span>' +
      '<svg class="wg-launch__arrow" aria-hidden="true"><use href="#i-arrow"/></svg>');
    launcher.type = 'button';
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.addEventListener('click', function () { openOverlay('easy'); });
    media.appendChild(launcher);
  }
  function unmountMobile() { closeOverlay(); if (launcher) { launcher.remove(); launcher = null; } }
  var overGame = null;
  function openOverlay(m) {
    if (!overlay) {
      overlay = h('div', 'wg-over');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Игра «Сложи часовню»');
      document.body.appendChild(overlay);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay && !overlay.hidden && !document.querySelector('.modal:not([hidden])')) closeOverlay(); });
    }
    clear(overlay);
    var head = h('header', 'wg-over__head', '<h2>Сложи часовню</h2>');
    head.appendChild(switcher(m, function () { openOverlay('easy'); }, function () { openOverlay('hard'); }));
    var x = h('button', 'wg-icon', '<svg aria-hidden="true"><use href="#i-close"/></svg>'); x.type = 'button'; x.setAttribute('aria-label', 'Закрыть'); x.addEventListener('click', closeOverlay);
    head.appendChild(x);
    var host = h('div', 'wg-host wg-host--over');
    overlay.appendChild(head); overlay.appendChild(host);
    overlay.hidden = false;
    document.documentElement.classList.add('wg-open');
    if (overGame) overGame.destroy();
    overGame = Game(host, m, { onMode: function (mm) { openOverlay(mm); }, onDonate: closeOverlay });
  }
  function closeOverlay() {
    if (!overlay || overlay.hidden) return;
    if (overGame) { overGame.destroy(); overGame = null; }
    overlay.hidden = true;
    document.documentElement.classList.remove('wg-open');
    if (launcher) launcher.focus({ preventScroll: true });
  }

  var mounted = null;
  function mount() {
    var want = DESKTOP.matches ? 'desktop' : 'mobile';
    if (want === mounted) return;
    if (mounted === 'desktop') unmountDesktop(); else if (mounted === 'mobile') unmountMobile();
    if (want === 'desktop') mountDesktop(); else mountMobile();
    mounted = want;
  }
  mount();
  if (DESKTOP.addEventListener) DESKTOP.addEventListener('change', mount); else if (DESKTOP.addListener) DESKTOP.addListener(mount);
})();
