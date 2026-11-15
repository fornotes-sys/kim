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
     tolX, tolY — как близко к месту надо отпустить блок; tolTop — для частей верха;
     tolGap, tolH — допуск щели и высоты («ровно»); sideStep, topStep — сколько
     сдвигает один удар киянки; dz — насколько блок сидит выше ряда на свежем
     клее; jiggle — удар сверху тревожит соседа; cutSnap — шаг рулетки.
     Кран: sling — длина строп (маятник), winch — скорость лебёдки вниз, vSoft — с какой
     скорости посадка считается жёсткой, hardK — насколько глубоко уходит блок при жёсткой
     посадке, tiltK — насколько выше встаёт край, если блок качался; wind — ветер.
     Киянка: sideMax, topMax — сила полного удара, period — скорость шкалы замаха. */
  var CFG = {
    easy: { bh: 100, bw: 200, porchH: 200, tolX: 40, tolY: 55, tolTop: 46, tolGap: 3, tolH: 2, sideStep: 4, topStep: 2.2, dz: [1, 3], jiggle: 0, cutSnap: 2,
            sideMax: 12, topMax: 7, period: 1.35, winch: 160, vSoft: 110, hardK: .03, tiltK: .5, sling: 62, wind: 0 },
    hard: { bh: 60, bw: 144, porchH: 180, tolX: 26, tolY: 26, tolTop: 22, tolGap: 2, tolH: 1, sideStep: 3, topStep: 1.4, dz: [1.5, 3.5], jiggle: .5, cutSnap: 1,
            sideMax: 10, topMax: 6, period: .9, winch: 220, vSoft: 95, hardK: .05, tiltK: .7, sling: 56, wind: 1 }
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
    Lr.meter = sv('g', null, svg);
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
    function mainRoofArt() {
      var seams = '';
      for (var x = 6; x < 600; x += 18) seams += '<path d="M' + x + ' -304L' + (300 + (x - 300) * .8) + ' -386" stroke="#8E4A2A" stroke-width="1"/>';
      return '<path d="M-12 -298L60 -390H540L612 -298Z" fill="' + COP + '" stroke="#3E3122" stroke-width="2"/>' + seams;
    }
    function porchRoofArt() {
      var o = '<path d="M' + (PORCH.x0 - 14) + ' ' + (PORCH.top + 2) + 'L' + (PORCH.x0 + 4) + ' ' + (PORCH.top - 46) + 'H6V' + (PORCH.top + 2) + 'Z" fill="' + COP + '" stroke="#3E3122" stroke-width="2"/>';
      for (var px = PORCH.x0 + 8; px < 0; px += 16) o += '<path d="M' + px + ' ' + (PORCH.top) + 'V' + (PORCH.top - 44) + '" stroke="#8E4A2A" stroke-width="1"/>';
      return o;
    }
    function apseRoofArt() { return '<path d="M594 -300Q700 -306 702 -268H594Z" fill="' + COP + '" stroke="#3E3122" stroke-width="2"/>'; }
    function drumArt() {
      var o = '<rect x="228" y="-460" width="144" height="74" fill="#F6EEE2" stroke="#3E3122" stroke-width="2"/>';
      [258, 300, 342].forEach(function (x) { o += archWin(x - 10, x + 10, -448, -400); });
      return o + '<path d="M214 -460H386" stroke="#3E3122" stroke-width="3"/>';
    }
    function domeArt() {
      return '<path d="M220 -460C228 -528 372 -528 380 -460Z" fill="' + COP + '" stroke="#3E3122" stroke-width="2"/>' +
        '<path d="M268 -462Q276 -505 300 -514M332 -462Q324 -505 300 -514M300 -514V-462" fill="none" stroke="#8E4A2A" stroke-width="1.2"/><path d="M214 -460H386" stroke="#3E3122" stroke-width="3"/>';
    }
    function crossArt() {
      // восьмиконечный крест: нижняя перекладина — левый от зрителя конец выше
      return '<circle cx="300" cy="-560" r="70" fill="url(#' + id + '-glow)"/>' +
        '<circle cx="300" cy="-522" r="7" fill="' + GOLD + '" stroke="#7A5A22" stroke-width="1.4"/>' +
        '<g stroke="#B88A3E" stroke-width="4" stroke-linecap="round"><path d="M300 -529V-596M293 -588h14M284 -576h32M291 -556l18 8"/></g>';
    }
    function roofArt() { return porchRoofArt() + mainRoofArt() + apseRoofArt(); }
    // части верха по порядку; a — опорная точка (куда тянуть), sc — масштаб на поддоне
    var STAGES = [
      { key: 'porch', name: 'Кровля притвора', art: porchRoofArt, a: { ax: -82, ay: -C.porchH - 22 }, sc: .55, lift: 30 },
      { key: 'main', name: 'Главная кровля', art: mainRoofArt, a: { ax: 300, ay: -344 }, sc: .26, lift: 30 },
      { key: 'apse', name: 'Кровля апсиды', art: apseRoofArt, a: { ax: 648, ay: -288 }, sc: .9, lift: 24 },
      { key: 'drum', name: 'Барабан', art: drumArt, a: { ax: 300, ay: -423 }, sc: .55, lift: 30 },
      { key: 'dome', name: 'Купол', art: domeArt, a: { ax: 300, ay: -488 }, sc: .55, lift: 24 },
      { key: 'cross', name: 'Крест', art: crossArt, a: { ax: 300, ay: -560 }, sc: .55, lift: 30 }
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
        merged.forEach(function (sp, si) {
          var x = sp[0], first = true;
          while (x < sp[1] - .5) {
            var half = first && r % 2 && sp[1] - sp[0] > C.bw * .8, w = half ? C.bw / 2 : C.bw;
            first = false;
            var rest = sp[1] - x;
            if (rest <= C.bw + .5) w = rest;                         // последний на участке — по месту
            else if (rest - w < C.bw * .3) w = rest - C.bw * .5;     // чтобы последний не вышел крошечным
            slots.push({ x: x, w: w, y: yt, h: C.bh, row: r, seg: r + ':' + si, segStart: sp[0], segEnd: sp[1], half: half && Math.abs(w - C.bw / 2) < .5, last: false, block: null });
            x += w;
          }
          slots[slots.length - 1].last = true;
        });
        rows.push({ y: yt, yb: yb, slots: slots });
      }
      return rows;
    }

    /* ---------- Раскладка ---------- */
    var portrait = false, view = null, PAL = { x: 0, y: 0 }, UK = 1;   // UK — единиц чертежа в одном пикселе экрана
    function layout() {
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      portrait = r.width / r.height < 1.05;
      var box = portrait ? { x: -250, y: -620, w: 960, h: 790 } : { x: -250, y: -620, w: 1200, h: 660 };
      PAL = portrait ? { x: 230, y: 90 } : { x: 830, y: -30 };
      var k = Math.max(box.w / r.width, box.h / r.height), vw = r.width * k, vh = r.height * k;
      view = { x: box.x - (vw - box.w) / 2, y: box.y - (vh - box.h) / 2, w: vw, h: vh };
      UK = k;
      svg.setAttribute('viewBox', [view.x, view.y, view.w, view.h].map(f1).join(' '));
      drawBg(); renderPallet(); renderSlots(); if (S) renderRaw();
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
      S = { phase: 'intro', rows: buildRows(), row: 0, stage: 0, placed: 0, miss: 0, redo: 0, over: 0, drag: null, t0: 0, sel: null, carry: null, piece: null, tips: {} };
      // бледный контур будущего храма
      sv('g', { opacity: .16 }, Lr.ghost, wallsArt() + roofArt() + drumArt() + domeArt() + crossArt());
      sv('g', { 'class': 'wg-outline' }, Lr.ghost,
        '<path d="M' + PORCH.x0 + ' 0V' + PORCH.top + 'H0V' + MAIN.top + 'H' + (APSE.x1 - 40) + 'Q' + APSE.x1 + ' ' + APSE.top + ' ' + APSE.x1 + ' ' + (APSE.top + 40) + 'V0"/>' +
        '<path d="M-12 -298L60 -390H540L612 -298M228 -390V-460M372 -390V-460M220 -460C228 -528 372 -528 380 -460M300 -529V-596"/>');
      sv('g', null, Lr.done, wallsArt());
      clipRect.setAttribute('y', '0'); clipRect.setAttribute('height', '0');
      root.classList.remove('is-final'); svg.classList.remove('is-final');
      if (view) { renderSlots(); renderPallet(); renderRaw(); }
      hud();
    }

    /* ---------- Места под блоки и сами блоки ----------
       Блок ложится там, где его отпустили, — без примагничивания. Слева от него
       остаётся щель до соседа (или до края стены, окна), а на свежем клее он
       сидит чуть выше ряда. Киянкой: «◀» — подбить к соседу, «▼» — осадить,
       «↺» — снять и переложить. Перестарался сбоку — соседа приподнимет,
       сверху — блок уйдёт ниже ряда. Следующий блок — только когда этот ровный. */
    function curRow() { return S.rows[S.row]; }
    function nextSlot() { var sl = curRow().slots; for (var i = 0; i < sl.length; i++) if (!sl[i].block) return sl[i]; return null; }
    function prevOf(s) { var sl = curRow().slots, i = sl.indexOf(s); return i > 0 && sl[i - 1].seg === s.seg ? sl[i - 1] : null; }
    function prevEnd(s) { var p = prevOf(s); return p && p.block ? p.block.x + p.block.w : s.segStart; }
    function gapOf(b) { return b.x - prevEnd(b.slot); }
    function endGapOf(b) { return b.slot.last ? b.slot.segEnd - (b.x + b.w) : 0; }
    function okOf(b) {
      return gapOf(b) <= C.tolGap + .01 && Math.abs(b.dz) <= C.tolH + .01 &&
        (!b.slot.last || (endGapOf(b) <= C.tolGap * 1.5 + .01 && endGapOf(b) >= -C.tolGap - .01));
    }
    // нужен ли подрезанный блок и какой длины
    function needLen(s) { return (s.last ? s.segEnd : s.x + s.w) - prevEnd(s); }
    // пилить нужно только у края участка (угол, окно) и там, где по раскладке стоит неполный блок
    function needsCut(s) { return !s.half && (s.last ? Math.abs(needLen(s) - C.bw) > 1.5 : s.w < C.bw - 1); }

    function renderSlots() {
      clear(Lr.slots);
      if (!S || S.phase !== 'play') return;
      var row = curRow(), nx = nextSlot();
      sv('rect', { x: PORCH.x0 - 30, y: row.y, width: APSE.x1 - PORCH.x0 + 60, height: row.yb - row.y, 'class': 'wg-band' }, Lr.slots);
      row.slots.forEach(function (s) {
        if (s.block) return;
        sv('rect', { x: f1(s.x + 3), y: f1(s.y + 3), width: f1(s.w - 6), height: f1(s.h - 6), rx: 3, 'class': 'wg-slot' + (s === nx ? ' is-next' : '') + (S.drag && S.drag.target === s ? ' is-target' : '') }, Lr.slots);
      });
    }
    function blockMarkup(w, hgt, cls) {
      return '<rect x="0" y="0" width="' + f1(w) + '" height="' + f1(hgt) + '" fill="' + PORE + '" stroke="#3E3122" stroke-width="2" rx="1.5"' + (cls ? ' class="' + cls + '"' : '') + '/>' +
        '<path d="M' + f1(w * .16) + ' ' + f1(hgt * .34) + 'h' + f1(Math.min(w * .22, 40)) + '" stroke="#DAD5CB" stroke-width="1.2"/>';
    }
    // блоки текущего ряда: положение, подсветка, подписи и кнопки киянки
    function renderRaw() {
      clear(Lr.raw);
      if (!S || S.phase !== 'play') return;
      curRow().slots.forEach(function (s) {
        var b = s.block; if (!b) return;
        var ok = okOf(b), sel = b === S.sel;
        var g = sv('g', { transform: 'translate(' + f1(b.x) + ' ' + f1(s.y - b.dz) + ')', 'class': 'wg-blk' + (ok ? ' is-ok' : '') + (sel ? ' is-sel' : '') }, Lr.raw, blockMarkup(b.w, s.h, 'wg-blk__body'));
        g.setAttribute('data-blk', S.row + ':' + curRow().slots.indexOf(s));
        b.el = g;
      });
      var b = S.sel;
      if (!b) return;
      var s = b.slot, gap = gapOf(b), eg = endGapOf(b), y = s.y - b.dz, cx = b.x + b.w / 2;
      // мерка: щель слева и высота
      var bits = [];
      if (gap > C.tolGap + .01) bits.push('щель ' + Math.round(gap));
      if (b.dz > C.tolH + .01) bits.push('выше на ' + Math.round(b.dz));
      if (b.dz < -C.tolH - .01) bits.push('ниже на ' + Math.round(-b.dz));
      if (s.last && eg > C.tolGap * 1.5 + .01) bits.push('у края щель ' + Math.round(eg));
      if (s.last && eg < -C.tolGap - .01) bits.push('выступает на ' + Math.round(-eg));
      var ok = okOf(b);
      // мерка и кнопки — постоянного экранного размера, при любом масштабе сцены
      var tag = sv('g', { 'class': 'wg-tag' + (ok ? ' is-ok' : ''), transform: 'translate(' + f1(cx) + ' ' + f1(y + s.h + 6 * UK) + ') scale(' + UK.toFixed(3) + ')' }, Lr.raw);
      var txt = ok ? 'ровно ✓' : bits.join(' · ');
      var tw = Math.max(58, txt.length * 7 + 18);
      sv('rect', { x: f1(-tw / 2), y: 0, width: f1(tw), height: 22, rx: 11 }, tag);
      sv('text', { x: 0, y: 15.5, 'text-anchor': 'middle' }, tag).textContent = txt;
      if (gap > .5) sv('path', { d: 'M' + f1(b.x - gap) + ' ' + f1(y + s.h / 2) + 'H' + f1(b.x), 'class': 'wg-gapline' }, Lr.raw);
      // кнопки киянки над блоком
      var bs = [['side', '◀', 'подбить'], ['top', '▼', 'осадить'], ['undo', '↺', 'переложить']];
      var r = 15, gapb = 38, by = y - (r + 8) * UK;
      bs.forEach(function (d, i) {
        var bg = sv('g', { 'class': 'wg-btn wg-btn--' + d[0], 'data-act': d[0], transform: 'translate(' + f1(cx + (i - 1) * gapb * UK) + ' ' + f1(by) + ') scale(' + UK.toFixed(3) + ')' }, Lr.raw);
        sv('circle', { r: r }, bg);
        sv('text', { y: 5.5, 'text-anchor': 'middle', style: 'font-size:15px' }, bg).textContent = d[1];
        sv('title', null, bg).textContent = d[0] === 'undo' ? d[2] : d[2] + ': зажмите для замаха';
      });
    }

    // lnd — как села: vy — скорость вниз, vx — вбок, th — качка в момент касания
    function landBlock(s, x, piece, lnd) {
      lnd = lnd || { vy: 0, vx: 0, th: 0 };
      var p = prevEnd(s), w = piece.w, msg = null;
      if (x < p) x = p + rnd(2, 5);                        // наехал на соседа — клей отжал назад
      var dz = rnd(C.dz[0], C.dz[1]) + Math.abs(lnd.th) * 57.3 * C.tiltK;   // качался — встал с перекосом, край выше
      if (lnd.vy > C.vSoft) { dz -= (lnd.vy - C.vSoft) * C.hardK; msg = 'Опустили резко — клей выдавило, блок сел глубоко'; }
      x += clamp(lnd.vx * .03, -6, 6);
      if (x < p) x = p + rnd(.5, 2);
      var pv = prevOf(s);
      if (pv && pv.block && lnd.vx < -60 && x - p < 4) { pv.block.dz += clamp(-lnd.vx / 80, .8, 3); msg = 'Задели соседний блок — его приподняло'; S.over++; }
      else if (Math.abs(lnd.th) > .12 && !msg) msg = 'Блок качался — встал с перекосом';
      var b = { slot: s, x: x, w: w, dz: dz, cut: piece.cut };
      s.block = b; S.sel = b; S.placed++;
      sfx.place(); buzz(10); dust(x + w / 2, s.y + s.h, 4);
      if (msg) say(msg, 'warn', 2600);
      else if (!S.tips.mallet) { S.tips.mallet = 1; say('Блок лёг. Зажмите ◀ или ▼ — растёт сила удара, отпустите в зелёной зоне', null, 4200); }
      afterChange();
    }
    function firstBad() { var sl = curRow().slots; for (var i = 0; i < sl.length; i++) if (sl[i].block && !okOf(sl[i].block)) return sl[i].block; return null; }
    function afterChange() {
      // текущий блок ровный, а другой в ряду сбился — переводим внимание на него
      var bad = firstBad();
      if (bad && (!S.sel || okOf(S.sel)) && bad !== S.sel) { S.sel = bad; say('Этот блок сбился — поправьте его', 'warn', 2200); }
      renderRaw(); renderSlots(); renderPallet(); hud();
      var row = curRow();
      if (row.slots.every(function (q) { return q.block && okOf(q.block); })) { S.sel = null; renderRaw(); later(rowDone, 380); }
    }
    function act(kind, pw) {
      var b = S.sel; if (!b || S.phase !== 'play') return;
      var s = b.slot, gap = gapOf(b);
      if (kind === 'side') {
        var step = pw == null ? C.sideStep : C.sideMax * pw * rnd(.92, 1.08);
        b.dz -= rnd(0, .4);
        if (gap > step) b.x -= step;
        else {
          b.x -= gap;
          var extra = step - gap, pv = prevOf(s);
          if (extra > 1 && pv && pv.block) {
            pv.block.dz += extra * .7;                      // перестарались — соседа приподняло
            say('Перестарались — соседний блок приподняло. Осадите его ▼', 'warn', 2800);
            S.sel = pv.block; S.over++;
          } else if (extra > 1) say('Уже в стык — дальше некуда', null, 1400);
        }
        sfx.knock();
      } else if (kind === 'top') {
        b.dz -= (pw == null ? C.topStep : C.topMax * pw) * rnd(.92, 1.08);
        if (C.jiggle) [prevOf(s)].forEach(function (q) { if (q && q.block && q.block !== b) q.block.dz += rnd(-C.jiggle, C.jiggle); });
        if (b.dz < -C.tolH - .01) { say('Слишком глубоко — снимите блок ↺ и уложите заново', 'warn', 2800); S.over++; }
        sfx.knock();
      } else if (kind === 'undo') {
        s.block = null; S.sel = null; S.redo++; S.placed--;
        // целый блок возвращается на поддон; неудачно подрезанный — в обрезки, пилим новый
        S.carry = b.cut ? null : { w: b.w, cut: false };
        if (b.cut) say('Обрезок — в сторону. Возьмите новый блок и отпилите заново', null, 2600);
        sfx.err();
      }
      if (S.sel && okOf(S.sel) && kind !== 'undo') { sfx.good(); }
      afterChange();
    }
    // замах: шкала силы ходит туда-обратно, удар — когда отпустили
    function power(t) { var ph = ((t - S.wind.t0) / 1000 / C.period) % 2; return ph < 1 ? ph : 2 - ph; }
    function idealOf(kind) {
      var b = S.sel; if (!b) return null;
      return kind === 'side' ? { c: gapOf(b) / C.sideMax, tol: C.tolGap / C.sideMax } : { c: b.dz / C.topMax, tol: C.tolH / C.topMax };
    }
    function renderMeter(t) {
      clear(Lr.meter);
      if (!S.wind || !S.sel) return;
      var b = S.sel, p = power(t), id = idealOf(S.wind.kind), W = 140, H = 14;
      var g = sv('g', { 'class': 'wg-meter', transform: 'translate(' + f1(b.x + b.w / 2) + ' ' + f1(b.slot.y - b.dz - 62 * UK) + ') scale(' + UK.toFixed(3) + ')' }, Lr.meter);
      sv('rect', { x: -W / 2, y: -H / 2, width: W, height: H, rx: 7, 'class': 'wg-meter__bg' }, g);
      if (id && id.c > 0) {
        var a = clamp(id.c - id.tol, 0, 1), z = clamp(id.c + id.tol * .6, 0, 1);
        if (id.c > 1) { a = .88; z = 1; }
        sv('rect', { x: f1(-W / 2 + a * W), y: -H / 2, width: f1(Math.max(4, (z - a) * W)), height: H, 'class': 'wg-meter__zone' }, g);
      }
      sv('rect', { x: -W / 2, y: -H / 2, width: f1(p * W), height: H, rx: 7, 'class': 'wg-meter__fill' }, g);
      sv('text', { x: 0, y: -H / 2 - 5, 'text-anchor': 'middle', 'class': 'wg-meter__lbl' }, g).textContent = S.wind.kind === 'side' ? 'сила удара сбоку' : 'сила удара сверху';
    }
    // ряд готов — блоки становятся настоящей стеной
    function rowDone() {
      var row = curRow();
      var y0 = +clipRect.getAttribute('y'), h0 = +clipRect.getAttribute('height');
      var els = Array.prototype.slice.call(Lr.raw.childNodes);
      tween(650, function (k) {
        clipRect.setAttribute('y', f1(lerp(y0, row.y, k)));
        clipRect.setAttribute('height', f1(lerp(h0, -row.y, k)));
        els.forEach(function (e) { e.style.opacity = 1 - k; });
      }, function () { clear(Lr.raw); });
      sfx.good();
      S.row++; S.carry = null;
      hud();
      if (S.row >= S.rows.length) {
        S.phase = 'top'; renderSlots();
        later(function () { say('Стены готовы! Теперь верх — по частям, начиная с кровли', 'ok', 3000); renderPallet(); }, 650);
      } else {
        say(S.row === 1 ? 'Ряд готов! Следующий — только на него' : 'Ряд ' + S.row + ' готов', 'ok', 1700);
        later(function () { renderSlots(); renderPallet(); }, 660);
      }
    }

    /* ---------- Поддон: блок (или его подрезка), потом части верха ---------- */
    var palScale = 1, palBox = null;
    function renderPallet() {
      clear(Lr.pallet);
      S && (S.palHit = null, S.sawHit = null, S.recutHit = null);
      if (!S || !view) return;
      var g = sv('g', { transform: 'translate(' + f1(PAL.x) + ' ' + f1(PAL.y) + ')' }, Lr.pallet);
      sv('g', { fill: 'none', stroke: '#3E3122', 'stroke-width': 2 }, g, '<rect x="-90" y="0" width="180" height="8" fill="#CDB289"/><rect x="-90" y="13" width="180" height="6" fill="#CDB289"/><path d="M-80 8v5M0 8v5M80 8v5" stroke="#A88A5C" stroke-width="5"/>');
      var label = sv('text', { x: 0, y: f1(22 + 14 * UK), 'text-anchor': 'middle', 'class': 'wg-pal-label', style: 'font-size:' + f1(13 * UK) + 'px' }, g);
      if (S.phase === 'play') {
        var nx = nextSlot();
        if (!nx) return;
        if (firstBad()) { label.textContent = 'сначала уложите блок ровно'; g.classList.add('is-wait'); return; }
        var piece = S.carry;
        if (!piece) {
          if (nx.half) piece = { w: C.bw / 2, cut: false };
          else if (!needsCut(nx)) piece = { w: C.bw, cut: false };
        }
        palScale = Math.min(1, 170 / C.bw);
        if (piece) {
          var w = piece.w * palScale, hh = C.bh * palScale;
          sv('g', { transform: 'translate(' + f1(-w / 2) + ' ' + f1(-hh - 2) + ')' }, g, blockMarkup(w, hh));
          S.palHit = { x: PAL.x - w / 2 - 12, y: PAL.y - hh - 14, w: w + 24, h: hh + 28 };
          S.piece = piece;
          g.classList.add('wg-take');
          label.textContent = piece.cut ? 'подрезанный блок' : nx.half ? 'половинка' : 'возьмите блок';
          if (piece.cut) {
            var re = sv('text', { x: 0, y: f1(22 + 32 * UK), 'text-anchor': 'middle', 'class': 'wg-recut', style: 'font-size:' + f1(12 * UK) + 'px' }, g);
            re.textContent = '↺ отпилить заново';
            S.recutHit = { x: PAL.x - 60 * UK, y: PAL.y + 22 + 20 * UK, w: 120 * UK, h: 18 * UK };
          }
        } else {
          // подрезка: щёлкните по блоку там, где пилить; рулетка показывает нужную длину
          var need = needLen(nx), W0 = C.bw * palScale, H0 = C.bh * palScale, bx = -W0 / 2, by = -H0 - 2;
          sv('g', { transform: 'translate(' + f1(bx) + ' ' + f1(by) + ')' }, g, blockMarkup(W0, H0));
          var t = sv('g', { 'class': 'wg-tape' }, g);
          sv('path', { d: 'M' + f1(bx) + ' ' + f1(by - 12) + 'h' + f1(need * palScale) }, t);
          for (var k = 0; k <= C.bw; k += 10) sv('path', { d: 'M' + f1(bx + k * palScale) + ' ' + f1(by - 12) + 'v' + (k % 50 ? 4 : 8), 'class': 'wg-tape__tick' }, t);
          sv('text', { x: f1(bx + need * palScale / 2), y: f1(by - 18), 'text-anchor': 'middle', style: 'font-size:' + f1(13 * UK) + 'px' }, t).textContent = 'нужно ' + Math.round(need);
          S.sawHit = { x: PAL.x + bx, y: PAL.y + by - 20, w: W0, h: H0 + 24, need: need };
          g.classList.add('wg-saw');
          label.textContent = 'щёлкните, где пилить';
          if (!S.tips.saw) { S.tips.saw = 1; say('До края не хватает целого блока — подрежьте: щёлкните по блоку на поддоне', null, 3600); }
        }
      } else if (S.phase === 'top') {
        var st = STAGES[S.stage], sc = st.sc || .5;
        var mini = sv('g', { transform: 'translate(' + f1(-st.a.ax * sc) + ' ' + f1(-st.a.ay * sc - st.lift) + ') scale(' + sc + ')' }, g, st.art());
        mini.style.pointerEvents = 'none';
        S.palHit = { x: PAL.x - 110, y: PAL.y - 120, w: 220, h: 130 };
        g.classList.add('wg-take');
        label.textContent = st.name.toLowerCase();
        clear(Lr.slots);
        sv('g', { 'class': 'wg-spot', opacity: .55 }, Lr.slots, st.art());
      }
    }
    function saw(wp) {
      var h0 = S.sawHit, cutAt = clamp((wp.x - h0.x) / palScale, C.bw * .15, C.bw - 4);
      cutAt = Math.round(cutAt / C.cutSnap) * C.cutSnap;
      S.carry = { w: cutAt, cut: true };
      sfx.saw(); dust(PAL.x, PAL.y - 10, 6);
      var err = cutAt - h0.need;
      if (Math.abs(err) > C.tolGap * 1.5) say(err > 0 ? 'Отпилили ' + Math.round(cutAt) + ' — длинновато, может не влезть' : 'Отпилили ' + Math.round(cutAt) + ' — коротковато, будет щель', 'warn', 2400);
      else say('Отпилили ' + Math.round(cutAt) + ' — в самый раз', 'ok', 1600);
      renderPallet();
    }

    /* ---------- Перетаскивание и киянка ---------- */
    function wpt(e) {
      var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      var m = svg.getScreenCTM(); return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    }
    function inBox(b, wp) { return b && wp.x >= b.x && wp.x <= b.x + b.w && wp.y >= b.y && wp.y <= b.y + b.h; }
    function nearSlot(wp, w) {
      var s = nextSlot(); if (!s) return null;
      var left = wp.x - w / 2;
      return Math.abs(left - s.x) <= C.tolX && Math.abs(wp.y - (s.y + s.h / 2)) <= s.h / 2 + C.tolY ? s : null;
    }
    var ptr = null;
    svg.addEventListener('pointerdown', function (e) {
      if (!S || ptr || (S.phase !== 'play' && S.phase !== 'top')) return;
      var wp = wpt(e), btn = e.target.closest && e.target.closest('[data-act]');
      if (btn) {
        e.preventDefault();
        var k = btn.getAttribute('data-act');
        if (k === 'undo') { act(k); return; }
        try { svg.setPointerCapture(e.pointerId); } catch (er) { /* */ }
        ptr = { id: e.pointerId };
        S.wind = { kind: k, t0: performance.now() }; kick();
        return;
      }
      var bel = e.target.closest && e.target.closest('[data-blk]');
      if (bel && S.phase === 'play') {         // выбрать уложенный блок текущего ряда
        var i = +bel.getAttribute('data-blk').split(':')[1], s = curRow().slots[i];
        if (s && s.block) { S.sel = s.block; renderRaw(); renderPallet(); }
        return;
      }
      if (S.phase === 'play' && S.sawHit && inBox(S.sawHit, wp)) { e.preventDefault(); saw(wp); return; }
      if (S.phase === 'play' && S.recutHit && inBox(S.recutHit, wp)) { e.preventDefault(); S.carry = null; S.redo++; sfx.err(); renderPallet(); hud(); return; }
      if (!inBox(S.palHit, wp)) return;
      e.preventDefault();
      try { svg.setPointerCapture(e.pointerId); } catch (er) { /* */ }
      ptr = { id: e.pointerId };
      if (S.phase === 'play') {
        var pc = S.piece;
        // блок цепляют краном: тележка идёт за рукой, блок висит на стропах и качается
        var cr = sv('g', { 'class': 'wg-crane' }, Lr.drag);
        S.drag = { kind: 'block', piece: pc, target: null, crane: cr,
          rope: sv('path', { 'class': 'wg-crane__rope' }, cr), slings: sv('path', { 'class': 'wg-crane__sling' }, cr),
          hook: sv('path', { d: 'M0 -9v6a5 5 0 1 0 6 5', 'class': 'wg-crane__hook' }, cr),
          el: sv('g', { 'class': 'wg-held' }, cr, blockMarkup(pc.w, C.bh)),
          off: C.sling + C.bh / 2 + (e.pointerType === 'mouse' ? 0 : 70 * UK),
          px: wp.x, py: wp.y, tx: wp.x, hy: wp.y - C.sling - C.bh / 2, th: 0, om: 0, vs: 0, vp: 0, lx: wp.x, ly: wp.y, vx: 0, vy: 0, bumpT: 0, lifted: false };
        kick();
      } else {
        var st = STAGES[S.stage];
        S.drag = { kind: 'top', st: st, el: sv('g', { 'class': 'wg-held' }, Lr.drag, st.art()) };
      }
      sfx.knock();
      moveDrag(wp);
    });
    function moveDrag(wp) {
      var d = S.drag; if (!d) return;
      if (d.kind === 'block') { d.px = wp.x; d.py = wp.y; return; }
      else {
        var dx = wp.x - d.st.a.ax, dy = wp.y - d.st.a.ay, near = Math.hypot(dx, dy) <= C.tolTop;
        d.el.setAttribute('transform', 'translate(' + f1(near ? dx * .25 : dx) + ' ' + f1(near ? dy * .25 : dy) + ')');
        Lr.slots.classList.toggle('is-near', near);
      }
    }
    svg.addEventListener('pointermove', function (e) {
      var wp = wpt(e);
      if (ptr && e.pointerId === ptr.id) { moveDrag(wp); return; }
      if (S) svg.style.cursor = inBox(S.palHit, wp) ? 'grab' : inBox(S.sawHit, wp) ? 'crosshair' : '';
    });
    function endDrag(e, cancel) {
      if (!ptr || e.pointerId !== ptr.id) return;
      ptr = null;
      if (S.wind) {                                       // удар киянкой
        var pw = power(performance.now()), kind = S.wind.kind;
        S.wind = null; clear(Lr.meter);
        if (!cancel) act(kind, pw);
        return;
      }
      var d = S.drag; S.drag = null;
      if (!d) return;
      var wp = wpt(e);
      if (d.crane) {                                      // отпустили блок, не опустив до ряда, — он возвращается на поддон
        d.crane.remove(); renderSlots();
        if (!cancel && d.lifted) say('Блок не опустили — он вернулся на поддон. Опускайте, ведя вниз', null, 2400);
        return;
      }
      d.el.remove();
      Lr.slots.classList.remove('is-near');
      if (cancel) { renderSlots(); return; }
      if (d.kind === 'block') {
        var s = nearSlot(wp, d.piece.w);
        if (s) {
          var x = wp.x - d.piece.w / 2, endLimit = s.last ? s.segEnd : Infinity;
          // отпустили с запасом у края — блок упирается в край, щель остаётся слева (её закроет киянка)
          if (x + d.piece.w > endLimit && prevEnd(s) + d.piece.w <= endLimit + C.tolGap + .5) x = Math.max(prevEnd(s), endLimit - d.piece.w);
          if (prevEnd(s) + d.piece.w > endLimit + C.tolGap + .5) {
            S.miss++; sfx.err();
            say(d.piece.cut ? 'Длинный — не помещается. Подрежьте новый блок короче' : 'Не помещается до края', 'warn', 2600);
            if (d.piece.cut) S.carry = null;
            renderSlots(); renderPallet(); return;
          }
          S.carry = null;
          landBlock(s, x, d.piece);
        } else {
          renderSlots();
          if (!inBox(S.palHit, wp)) {
            S.miss++; sfx.err();
            var row = curRow();
            if (wp.y < row.y - C.tolY) say('Сначала закончите этот ряд — выше блоку не на что опереться', 'warn', 2400);
            else say('Кладите блок к подсвеченному месту — вплотную к соседу', 'warn', 2200);
          }
        }
      } else {
        if (Math.hypot(wp.x - d.st.a.ax, wp.y - d.st.a.ay) <= C.tolTop) topPlaced(d.st);
        else if (!inBox(S.palHit, wp)) { S.miss++; sfx.err(); say('Не на месте — совместите с контуром', 'warn', 2000); }
      }
    }
    svg.addEventListener('pointerup', function (e) { endDrag(e, false); });
    svg.addEventListener('pointercancel', function (e) { endDrag(e, true); });
    ['touchstart', 'touchmove'].forEach(function (t) { svg.addEventListener(t, function (e) { if (ptr || e.target.closest('[data-act], [data-blk]') || (S && (inBox(S.palHit, wpt(e.touches[0] || e.changedTouches[0])) || inBox(S.sawHit, wpt(e.touches[0] || e.changedTouches[0]))))) e.preventDefault(); }, { passive: false }); });
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    function topPlaced(st) {
      var g = sv('g', null, Lr.top, st.art());
      g.style.opacity = 0;
      tween(380, function (k) { g.style.opacity = k; g.setAttribute('transform', 'translate(0 ' + f1(-14 * (1 - k)) + ')'); });
      sfx.place(); shake();
      S.stage++;
      hud();
      if (S.stage >= STAGES.length) { clear(Lr.slots); clear(Lr.pallet); S.palHit = null; later(finale, 500); return; }
      say(st.name + ' — на месте. Дальше: ' + STAGES[S.stage].name.toLowerCase(), 'ok', 2000);
      renderPallet();
    }

    /* ---------- Панель, подсказки, карточки ---------- */
    function hud() {
      if (!S) return;
      var total = 0; S.rows.forEach(function (r) { total += r.slots.length; });
      ui.hud.innerHTML = S.phase === 'intro' || S.phase === 'final' ? '' :
        '<span><b>Ряд</b>' + Math.min(S.row + 1, S.rows.length) + ' / ' + S.rows.length + '</span>' +
        '<span><b>Блоки</b>' + S.placed + ' / ' + total + '</span>' +
        (S.phase === 'top' ? '<span><b>Верх</b>' + S.stage + ' / ' + STAGES.length + '</span>' : '') +
        (S.redo ? '<span><b>Переложено</b>' + S.redo + '</span>' : '');
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
            '<li><b>Кран:</b> возьмите блок с поддона — он повиснет на стропах. Ведите к подсвеченному месту и опускайте плавно: резко поведёте — раскачаете, резко опустите — сядет криво.</li>' +
            '<li><b>Киянка:</b> зажмите ◀ (подбить) или ▼ (осадить) — растёт сила удара; отпустите в зелёной зоне. Перебьёте — сдвинете соседний.</li>' +
            '<li><b>У края и у окна</b> блок подрежьте по рулетке. Ряд ровный — он становится стеной часовни.</li>' +
            '<li><b>Потом верх</b> — кровля, барабан, купол и крест по частям.</li>' +
            (mode === 'hard' ? '<li><b>Сложнее:</b> ветер раскачивает блок, шкала удара быстрее, допуск в 1–2 единицы.</li>' : '') +
          '</ul>' +
          '<button class="btn btn--gold btn--small" type="button" data-wg="start">Начать <svg aria-hidden="true"><use href="#i-arrow"/></svg></button>';
      } else {
        var secs = Math.round((performance.now() - S.t0) / 1000), mm = Math.floor(secs / 60), ss = secs % 60;
        html = '<h3>Часовня готова!</h3>' +
          '<p class="wg-card__meta">' + S.placed + ' ' + plural(S.placed, ['блок', 'блока', 'блоков']) + ' · ' + (mm ? mm + ' мин ' : '') + ss + ' с' + (S.redo ? ' · переложено ' + S.redo : '') + (S.over ? ' · перебито ' + S.over : '') + '</p>' +
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
    function start() { ui.card.hidden = true; S.phase = 'play'; S.t0 = performance.now(); renderSlots(); renderPallet(); hud(); say('Возьмите блок с поддона — кран подхватит его. Опустите на подсвеченное место', null, 3400); }
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

    /* ---------- Физика крана ----------
       Рука ведёт тележку крана (с запаздыванием) и крюк (лебёдка вниз — не быстрее
       C.winch). Блок висит на стропах длины C.sling — маятник: резкое движение
       тележки раскачивает его, качка гаснет медленно. Касание ряда — посадка:
       скорость вниз, вбок и качка в этот момент решают, как ляжет блок. */
    function craneTick(dt) {
      var d = S.drag, row = curRow(), s = nextSlot();
      var k = Math.min(1, dt * 9), ntx = lerp(d.tx, d.px, k);
      var v = (ntx - d.tx) / dt; d.vs += (v - d.vs) * Math.min(1, dt * 12);
      var ax = clamp((d.vs - d.vp) / dt, -8000, 8000); d.vp = d.vs; d.tx = ntx;
      var want = d.py - d.off, maxDown = C.winch * dt;
      d.hy = want > d.hy ? Math.min(want, d.hy + maxDown) : lerp(d.hy, want, Math.min(1, dt * 12));
      // ветер (сложный режим): порывы раскачивают блок
      S.windT = (S.windT || 0) + dt;
      var gust = C.wind ? C.wind * (Math.sin(S.windT * .8) * .6 + Math.sin(S.windT * 2.3 + 1) * .4) * 260 : 0;
      var L = C.sling, n = Math.max(1, Math.ceil(dt * 240)), hh = dt / n;
      for (var i = 0; i < n; i++) {
        var a = -(1100 / L) * Math.sin(d.th) - 1.6 * d.om - (ax * .55 / L) * Math.cos(d.th) + gust / L;
        d.om += a * hh; d.th = clamp(d.th + d.om * hh, -.8, .8);
      }
      var bw = d.piece.w, bh = C.bh;
      var cx = d.tx + L * Math.sin(d.th), top = d.hy + L * Math.cos(d.th), left = cx - bw / 2, bottom = top + bh;
      // крюк выше подсвеченного ряда, если внизу уже готовый ряд, — нельзя ниже его верха
      var support = row.yb;
      // задели уложенный блок текущего ряда
      d.bumpT -= dt;
      if (bottom > row.y + 4) {
        row.slots.forEach(function (q) {
          var bk = q.block; if (!bk || d.bumpT > 0) return;
          if (left < bk.x + bk.w - 1 && left + bw > bk.x + 1) {
            var ov = Math.min(bk.x + bk.w - left, left + bw - bk.x);
            // чуть зашёл на соседа и движется спокойно — клей отжимает блок в сторону, без удара
            if (ov <= 10 && Math.abs(d.vx) < 90) { var dir = left > bk.x ? 1 : -1; d.tx += dir * (ov + .5); d.px += dir * (ov + .5); return; }
            bk.dz += clamp(Math.abs(d.vx) / 120 + d.vy / 200, .6, 3); S.over++;
            d.hy -= 26; d.om += (d.vx > 0 ? -1 : 1) * 1.2; d.bumpT = .5;
            sfx.knock(); say('Задели уложенный блок — его сдвинуло', 'warn', 2200);
            S.sel = bk; renderRaw();
          }
        });
      }
      // ниже основания ряда — нельзя: либо посадка, либо упор
      if (bottom >= support) {
        var ok = s && Math.abs(left - s.x) <= C.tolX;
        if (ok) {
          var x = left, endLimit = s.last ? s.segEnd : Infinity;
          if (x + bw > endLimit && prevEnd(s) + bw <= endLimit + C.tolGap + .5) x = Math.max(prevEnd(s), endLimit - bw);
          if (prevEnd(s) + bw > endLimit + C.tolGap + .5) {
            S.miss++; sfx.err(); say(d.piece.cut ? 'Длинный — не помещается. Подрежьте новый блок короче' : 'Не помещается до края', 'warn', 2600);
            if (d.piece.cut) S.carry = null;
            d.crane.remove(); S.drag = null; renderSlots(); renderPallet(); return;
          }
          var lnd = { vy: d.vy, vx: d.vx, th: d.th };
          d.crane.remove(); S.drag = null; S.carry = null;
          landBlock(s, x, d.piece, lnd);
          return;
        }
        d.hy = support - bh - L * Math.cos(d.th);
        if (d.lifted && (!d.warnT || S.windT - d.warnT > 2.5)) { d.warnT = S.windT; say(d.py < row.y - C.tolY ? 'Сначала закончите этот ряд' : 'Сюда нельзя — опускайте на подсвеченное место', 'warn', 2000); }
        top = d.hy + L * Math.cos(d.th); bottom = top + bh;
      }
      d.vx = (cx - d.lx) / dt; d.vy = (top - d.ly) / dt; d.lx = cx; d.ly = top;
      if (top < row.y - 40) d.lifted = true;
      // подсветка места, если блок над ним
      var tg = s && Math.abs(left - s.x) <= C.tolX && bottom > row.y - 160 ? s : null;
      if (tg !== d.target) { d.target = tg; renderSlots(); }
      // рисуем: трос до крюка, стропы, блок с наклоном по качке
      var vtop = view ? view.y - 20 : -800, rot = d.th * 57.3 * .5;
      d.rope.setAttribute('d', 'M' + f1(d.tx) + ' ' + f1(vtop) + 'V' + f1(d.hy));
      d.hook.setAttribute('transform', 'translate(' + f1(d.tx) + ' ' + f1(d.hy + 6) + ')');
      var c = Math.cos(rot / 57.3), sn = Math.sin(rot / 57.3);
      function pt(px, py) { return f1(cx + (px - bw / 2) * c - py * sn) + ' ' + f1(top + (px - bw / 2) * sn + py * c); }
      d.slings.setAttribute('d', 'M' + f1(d.tx) + ' ' + f1(d.hy + 12) + 'L' + pt(bw * .15, 0) + 'M' + f1(d.tx) + ' ' + f1(d.hy + 12) + 'L' + pt(bw * .85, 0));
      d.el.setAttribute('transform', 'translate(' + pt(0, 0) + ') rotate(' + f1(rot) + ')');
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
      if (S && S.drag && S.drag.crane) craneTick(dt);
      if (S && S.wind) renderMeter(t);
      if (tweens.length || parts.length || (S && ((S.drag && S.drag.crane) || S.wind))) raf = requestAnimationFrame(loop); else lastT = 0;
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
