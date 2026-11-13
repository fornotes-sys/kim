/* ==========================================================================
   «Сложи стену» — игра про кладку часовни из газобетона.

   Блоки ровные, поэтому дело не в перекосе, а в точности:
   • блок ведут по ряду — он идёт по клею с запаздыванием; подвёл мягко —
     встал в стык; толкнул с разгона или передавил — сдвинул соседний;
   • после укладки блок слегка «садится»: щель добивают киянкой по торцу,
     уступ — киянкой сверху. Перестарался — соседний выбит, блок просел
     (поднять нельзя, только снять и уложить заново);
   • перевязка: швы соседних рядов не должны совпадать — иначе трещина;
   • последний блок ряда подрезают по рулетке пилой.
   Сложный режим: стена длиннее, первый ряд на растворе выставляют по уровню,
   клей схватывается за несколько секунд — после этого блок уже не поправить.

   Компьютер: простой режим — прямо в блоке «Строим вместе», сложный —
   разворачивается на его месте. Телефон: игра на весь экран.
   Без библиотек и сборки. Сцена — SVG, единицы — миллиметры.
   ========================================================================== */
(function () {
  'use strict';

  var media = document.querySelector('.build__media');
  var section = document.querySelector('.build');
  if (!media || !section || !window.matchMedia || !window.requestAnimationFrame) return;
  var DESKTOP = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Параметры ---------- */
  // Цена одного блока для финальной фразы. Пока сметы нет — null, и цена не показывается.
  var BLOCK_PRICE = null;

  var MM = 0.2;                 // пикселей мира в миллиметре
  var BL = 600, BH = 250;       // блок 600 × 250 мм (как настоящий газоблок)
  var HALF = 300;
  var EXAG = 5, EXAG_CAP = 12;  // щели до 12 мм рисуем впятеро шире — иначе их не видно
  var STEPX = 5;                // уступы тоже
  var GAP_OK = 1, GAP_BAD = 3;  // мм: «в стык» / «щель»
  var STEP_OK = 1, STEP_BAD = 2.5;
  var SEAM_MIN = 150;           // швы соседних рядов — не ближе четверти блока
  var V_BUMP = 520;             // мм/с: быстрее — удар по соседнему блоку
  var P_MAX = 90;               // мм «передавливания» мышью/пальцем
  var BEAR = 150;               // перемычка заходит на стену с каждой стороны, мм
  var MODES = {
    easy: { len: 2250, rows: 5, seat: [-.3, 1.6], first: [-.3, 1.6], setTime: 0, win: { x0: 750, x1: 1350, r0: 1, r1: 2 } },
    hard: { len: 3150, rows: 6, seat: [-.4, 2.0], first: [-.8, 4.6], setTime: 12, win: { x0: 1050, x1: 1650, r0: 1, r1: 3 } }
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
  function f1(v) { return v.toFixed(1); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* нет вибрации */ } }
  // визуальная ширина щели: малые щели преувеличиваем, большие — как есть
  function gv(g) { g = Math.max(0, g); return g + (EXAG - 1) * Math.min(g, EXAG_CAP); }
  function gvInv(d) { d = Math.max(0, d); return d <= EXAG * EXAG_CAP ? d / EXAG : d - (EXAG - 1) * EXAG_CAP; }

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
    var M = MODES[mode];
    var L = M.len, W = L * MM, ROWH = BH * MM;
    var root = h('div', 'wg wg--' + mode);
    root.innerHTML =
      '<div class="wg-hud" data-wg-hud></div>' +
      '<p class="wg-say" data-wg-say role="status" aria-live="polite"></p>' +
      '<div class="wg-card" data-wg-card hidden></div>';
    host.appendChild(root);
    var ui = { hud: root.querySelector('[data-wg-hud]'), say: root.querySelector('[data-wg-say]'), card: root.querySelector('[data-wg-card]') };
    var svg = sv('svg', { 'class': 'wg-svg', role: 'img', 'aria-label': 'Стена часовни из газобетонных блоков, поддон с блоками рядом' });
    root.insertBefore(svg, root.firstChild);

    sv('defs', null, svg,
      '<pattern id="wg-pore-' + mode + '" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#EEEBE4"/><circle cx="2" cy="2" r=".7" fill="#D3CEC3"/><circle cx="6.5" cy="5" r=".55" fill="#D9D4CA"/><circle cx="3.5" cy="7.4" r=".45" fill="#D3CEC3"/></pattern>' +
      '<linearGradient id="wg-gold-' + mode + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C99A45"/><stop offset=".38" stop-color="#F0D28E"/><stop offset="1" stop-color="#B98A3A"/></linearGradient>' +
      '<radialGradient id="wg-glow-' + mode + '"><stop offset="0" stop-color="#F6DFA4" stop-opacity=".9"/><stop offset=".5" stop-color="#EBC877" stop-opacity=".3"/><stop offset="1" stop-color="#EBC877" stop-opacity="0"/></radialGradient>');
    var PORE = 'url(#wg-pore-' + mode + ')';

    var Lr = {};
    Lr.bg = sv('g', { fill: 'none', stroke: '#3E3122', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    Lr.wall = sv('g', { 'class': 'wg-wall' }, svg);
    Lr.marks = sv('g', { 'class': 'wg-marks' }, svg);
    Lr.top = sv('g', { fill: 'none', stroke: '#3E3122', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    Lr.pallet = sv('g', null, svg);
    Lr.held = sv('g', null, svg);
    Lr.fx = sv('g', null, svg);

    /* ---------- Раскладка: поддон справа или (на узком экране) под стеной ---------- */
    var portrait = false, view = null, palletX = 0, palletY = 0;
    function layout() {
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      portrait = r.width / r.height < 1.05;
      var top = -M.rows * ROWH - 70;
      var box;
      if (portrait) { palletX = W / 2; palletY = 92; box = { x: -36, y: top, w: W + 72, h: 92 + 60 - top }; }
      else { palletX = W + 150; palletY = 22; box = { x: -50, y: top, w: W + 300, h: 70 - top }; }
      // заполняем контейнер, не обрезая нужное
      var k = Math.max(box.w / r.width, box.h / r.height), vw = r.width * k, vh = r.height * k;
      view = { x: box.x - (vw - box.w) / 2, y: box.y - (vh - box.h) / 2 - (vh - box.h) * .25, w: vw, h: vh };
      if (S && S.phase === 'final') view = finalView();
      applyView();
      drawBg();
      render();
    }
    function finalView() {
      var r = host.getBoundingClientRect(), top = -M.rows * ROWH - 310;
      var box = portrait ? { x: -W * .44, y: top, w: W * 1.6, h: 60 - top } : { x: -W * .46, y: top, w: W * 2.28, h: 70 - top };
      var k = Math.max(box.w / r.width, box.h / r.height), vw = r.width * k, vh = r.height * k;
      return { x: box.x - (vw - box.w) / 2, y: box.y - (vh - box.h) / 2, w: vw, h: vh };
    }
    function applyView() { svg.setAttribute('viewBox', [view.x, view.y, view.w, view.h].map(f1).join(' ')); }

    function drawBg() {
      clear(Lr.bg);
      var gx0 = view.x - 40, gx1 = view.x + view.w + 40, cx = view.x + view.w - 70, cy = view.y + 60;
      sv('g', null, Lr.bg,
        '<g class="wg-sun"><circle cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="24" stroke="#B88A3E"/><g stroke="#C9A35C" stroke-width="1.4"><path d="M' + f1(cx) + ' ' + f1(cy - 36) + 'v-10M' + f1(cx) + ' ' + f1(cy + 36) + 'v10M' + f1(cx - 36) + ' ' + f1(cy) + 'h-10M' + f1(cx + 36) + ' ' + f1(cy) + 'h10"/></g></g>' +
        '<path d="M' + f1(view.x + 30) + ' ' + f1(view.y + 70) + 'c26-9 52-9 78 0M' + f1(view.x + view.w * .45) + ' ' + f1(view.y + 40) + 'c22-8 44-8 66 0" stroke="#C9B48E" stroke-width="1.3"/>' +
        // земля и фундамент
        '<path d="M' + f1(gx0) + ' 24c' + f1((gx1 - gx0) * .3) + ' 3 ' + f1((gx1 - gx0) * .6) + ' -3 ' + f1(gx1 - gx0) + ' 1"/>' +
        '<rect x="-14" y="0" width="' + f1(W + 28) + '" height="22" fill="#D8CFBE" stroke-width="2"/>' +
        '<path d="M-14 11H' + f1(W + 14) + '" stroke="#BDB2A0" stroke-width="1"/>' +
        // поддон
        (portrait
          ? '<g transform="translate(' + f1(palletX) + ' ' + f1(palletY) + ')"><rect x="-80" y="0" width="160" height="7" fill="#CDB289"/><rect x="-80" y="11" width="160" height="5" fill="#CDB289"/><path d="M-70 7v4M0 7v4M70 7v4" stroke-width="5" stroke="#A88A5C"/></g>'
          : '<g transform="translate(' + f1(palletX) + ' 0)"><rect x="-80" y="8" width="160" height="6" fill="#CDB289"/><rect x="-80" y="18" width="160" height="4" fill="#CDB289"/><path d="M-70 14v4M0 14v4M70 14v4" stroke-width="5" stroke="#A88A5C"/></g>'));
    }

    /* ---------- Состояние ---------- */
    var S = null, raf = 0, lastT = 0, tweens = [], parts = [], timers = [], alive = true;
    function later(fn, ms) { var id = setTimeout(function () { if (alive) fn(); }, ms); timers.push(id); }
    function tween(dur, fn, done) { tweens.push({ t0: performance.now(), dur: dur, fn: fn, done: done }); kick(); }

    function reset() {
      timers.forEach(clearTimeout); timers = []; tweens = [];
      parts.forEach(function (p) { p.el.remove(); }); parts = [];
      [Lr.wall, Lr.marks, Lr.top, Lr.pallet, Lr.held, Lr.fx].forEach(clear);
      S = {
        phase: 'intro', rows: [[]], row: 0, seg: 0, spans: {}, lintels: [], offer: [], held: null, cracks: [], rebar: [],
        placed: 0, bumps: 0, overdo: 0, recuts: 0, tips: {}, sunkTold: false
      };
      for (var wr = M.win.r0; wr <= M.win.r1; wr++) S.spans[wr] = [{ x0: M.win.x0, x1: M.win.x1, kind: 'hole' }];
      root.classList.remove('is-final');
      svg.classList.remove('is-final');
      if (view && view.y !== undefined) layout();
      hud();
    }

    /* ---------- Ряд ---------- */
    function curRow() { return S.rows[S.row]; }
    function rowEnd(row) { row = row || curRow(); return row.length ? row[row.length - 1].x + row[row.length - 1].len : 0; }
    function rowBottomY(r) { return -r * ROWH; }
    // ряд делится проёмом или перемычкой на участки; каждый кладут от его левого края
    function spansOf(r) { return S.spans[r] || []; }
    function segsOf(r) { var a = 0, out = []; spansOf(r).forEach(function (sp) { out.push({ a: a, b: sp.x0 }); a = sp.x1; }); out.push({ a: a, b: L, solid: spansOf(r).length && spansOf(r)[spansOf(r).length - 1].kind === 'lintel' }); return out; }
    function curSeg() { var sg = segsOf(S.row); return sg[Math.min(S.seg, sg.length - 1)]; }
    function segBlocks(sg) { return curRow().filter(function (b) { return b.x >= sg.a - 1 && b.x < sg.b; }); }
    function segPrev() { var sg = curSeg(), e = sg.a; segBlocks(sg).forEach(function (b) { e = Math.max(e, b.x + b.len); }); return e; }
    function segEnd() { return curSeg().b; }
    function segLast() { var bl = segBlocks(curSeg()); return bl.length ? bl[bl.length - 1] : null; }
    function peFor(row, i) {   // где кончается то, к чему примыкает блок слева
      var b = row[i], pe = i ? row[i - 1].x + row[i - 1].len : 0;
      spansOf(b.row).forEach(function (sp) { if (sp.x1 <= b.x + .5 && sp.x1 > pe) pe = sp.x1; });
      return pe;
    }
    function prevVis() {
      var last = segLast(); if (!last) return curSeg().a * MM;
      var v = rowVis(S.row), i = curRow().indexOf(last); return v.xs[i] + last.len * MM;
    }

    function offerNext() {
      var row = curRow(), sg = curSeg(), pe = segPrev(), R = sg.b - pe, last = segLast();
      clear(Lr.pallet);
      S.offer = [];
      // участок закончен: последний подрезан или дошли до края
      if ((last && last.cut) || R <= 4) {
        if (S.seg < segsOf(S.row).length - 1) { S.seg++; offerNext(); return; }
        closeRow(); return;
      }
      if (!row.length) {
        // начало ряда: целый блок или половинка
        S.offer.push(makePiece(BL, false, -1), makePiece(HALF, false, 1));
        S.phase = 'play';
        if (S.row === 0) say(mode === 'hard' ? 'Первый ряд — на раствор. Начните с целого блока' : 'Начните ряд: возьмите блок с поддона', null, 2600);
        else if (!S.tips.seam) { S.tips.seam = 1; say('Швы не должны совпадать с нижним рядом', null, 2800); }
      } else if (R >= BL - .5) {
        S.offer.push(makePiece(BL, false, 0));
        if (!last && spansOf(S.row).length && !S.tips.after) { S.tips.after = 1; say(sg.solid ? 'Теперь — от перемычки: подведите блок к ней вплотную' : 'За проёмом ряд начинается заново — от края проёма', null, 2800); }
      } else {
        S.offer.push(makePiece(BL, true, 0));          // последний на участке — подрезать по месту
        if (!S.tips.cut) { S.tips.cut = 1; say('Последний блок подрежьте по рулетке: щёлкните по блоку, где пилить', null, 3400); }
        else if (sg.b < L && !S.tips.cutWin) { S.tips.cutWin = 1; say(spansOf(S.row)[0].kind === 'hole' ? 'Перед проёмом — подрезать до края окна' : 'Перед перемычкой — подрезать вплотную к ней', null, 3000); }
        drawTape(R);
      }
      renderPallet();
      hud();
    }
    function makePiece(len, needCut, slot) { return { len: len, needCut: needCut, slot: slot, dl: 0, dr: 0, cut: false }; }
    function pieceHome(p) {
      var w = p.len * MM;
      if (portrait) {
        var base = palletY;
        return { x: palletX + (p.slot === 1 ? 6 : p.slot === -1 ? -w - 6 : -w / 2), y: base - ROWH };
      }
      return { x: palletX + (p.slot === 1 ? 8 : p.slot === -1 ? -w - 8 : -w / 2) + (p.slot ? 0 : 0), y: 8 - ROWH };
    }
    function blockShape(w, dl, dr, cutEnd) {
      var a = -dl * MM * STEPX, b = -dr * MM * STEPX;
      return '<path d="M0 ' + f1(ROWH + a) + 'L' + f1(w) + ' ' + f1(ROWH + b) + 'L' + f1(w) + ' ' + f1(b) + 'L0 ' + f1(a) + 'Z" fill="' + PORE + '" stroke="#3E3122" stroke-width="1.8" stroke-linejoin="round"/>' +
        (cutEnd ? '<path d="M' + f1(w) + ' ' + f1(b + 2) + 'V' + f1(ROWH + b - 2) + '" stroke="#B9AF9C" stroke-width="2.4"/>' : '') +
        '<path d="M' + f1(w * .18) + ' ' + f1(ROWH * .35 + a * .8) + 'h' + f1(w * .22) + '" stroke="#DAD5CB" stroke-width="1"/>';
    }
    function renderPallet() {
      clear(Lr.pallet);
      S.offer.forEach(function (p) {
        var hm = pieceHome(p), g = sv('g', { 'class': 'wg-piece', transform: 'translate(' + f1(hm.x) + ' ' + f1(hm.y) + ')' }, Lr.pallet, blockShape(p.len * MM, 0, 0, p.cut));
        p.el = g;
        if (p.needCut && !p.cut) {
          // рулетка на блоке
          var t = '<g class="wg-ruler">';
          for (var m = 50; m < p.len; m += 50) t += '<path d="M' + f1(m * MM) + ' 0v' + (m % 100 ? 4 : 8) + '" stroke="#85642C" stroke-width="1"/>' + (m % 100 ? '' : '<text x="' + f1(m * MM) + '" y="17" text-anchor="middle">' + (m / 10) + '</text>');
          t += '</g><path class="wg-saw" d="" stroke="#9E2B32" stroke-width="2" stroke-dasharray="4 3"/>';
          sv('g', null, g, t);
          p.sawEl = g.querySelector('.wg-saw');
          g.classList.add('is-cut');
        } else if (S.rows[S.row].length === 0) {
          sv('text', { x: f1(p.len * MM / 2), y: f1(ROWH / 2 + 4), 'text-anchor': 'middle', 'class': 'wg-piece-label' }, g).textContent = p.len === BL ? 'целый' : '½';
        }
      });
    }
    function drawTape(R) {
      clear(Lr.marks);
      var x0 = prevVis(), y = rowBottomY(S.row) - ROWH - 10;
      var t = '<g class="wg-tape"><path d="M' + f1(x0) + ' ' + f1(y) + 'h' + f1(R * MM) + '" stroke="#C9A35C" stroke-width="5" stroke-linecap="butt"/>';
      for (var m = 50; m < R; m += 50) t += '<path d="M' + f1(x0 + m * MM) + ' ' + f1(y - 2.5) + 'v' + (m % 100 ? 3 : 5) + '" stroke="#5A3F22" stroke-width="1"/>' + (m % 100 ? '' : '<text x="' + f1(x0 + m * MM) + '" y="' + f1(y - 6) + '" text-anchor="middle">' + (m / 10) + '</text>');
      t += '<path d="M' + f1(x0 + R * MM) + ' ' + f1(y - 8) + 'V' + f1(rowBottomY(S.row)) + '" stroke="#9E2B32" stroke-width="1.4" stroke-dasharray="3 3"/></g>';
      sv('g', null, Lr.marks, t);
    }

    /* ---------- Видимые координаты блоков ---------- */
    function rowVis(r) {
      var row = S.rows[r] || [], prev = 0, extra = 0, out = [];
      row.forEach(function (b) {
        spansOf(r).forEach(function (sp) { if (sp.x1 <= b.x + .5 && sp.x1 > prev) { prev = sp.x1; extra = 0; } });
        var g = b.x - prev; extra += gv(g) - g; out.push((b.x + extra) * MM); prev = b.x + b.len;
      });
      return { xs: out, extra: extra };
    }
    function visEnd(r) {
      var row = S.rows[r] || [];
      if (!row.length) return 0;
      var v = rowVis(r), last = row[row.length - 1];
      return v.xs[v.xs.length - 1] + last.len * MM;
    }

    function render() {
      if (!S || !view) return;
      clear(Lr.wall);
      // причальный шнур — по верху текущего ряда
      if (S.phase === 'play' || S.phase === 'rebar') {
        var yT = rowBottomY(S.row) - ROWH;
        sv('path', { d: 'M-24 ' + f1(yT) + 'H' + f1(W + 24), 'class': 'wg-string' }, Lr.wall);
        sv('path', { d: 'M-24 ' + f1(yT - 6) + 'v' + f1(-yT + 6) + 'M' + f1(W + 24) + ' ' + f1(yT - 6) + 'v' + f1(-yT + 6), stroke: '#8C6A3E', 'stroke-width': 2 }, Lr.wall);
      }
      S.rows.forEach(function (row, r) {
        var v = rowVis(r), yb = rowBottomY(r) - ROWH, now = performance.now();
        // клеевой шов под рядом
        if (row.length) sv('path', { d: 'M' + f1(v.xs[0]) + ' ' + f1(yb + ROWH + .5) + 'H' + f1(visEnd(r)), stroke: '#BDB6A8', 'stroke-width': 1.2 }, Lr.wall);
        row.forEach(function (b, i) {
          var x = v.xs[i], g = sv('g', { transform: 'translate(' + f1(x) + ' ' + f1(yb) + ')', 'class': 'wg-block' + (editable(b) ? ' is-live' : '') }, Lr.wall, blockShape(b.len * MM, b.dl, b.dr, b.cut));
          b.vx = x; b.vy = yb;
          // время схватывания клея (сложный режим)
          if (M.setTime && editable(b)) {
            var k = clamp((now - b.t) / (M.setTime * 1000), 0, 1), cx = b.len * MM - 9, cy = 9 - b.dr * MM * STEPX, rr = 5, c = 2 * Math.PI * rr;
            sv('circle', { cx: f1(cx), cy: f1(cy), r: rr, fill: 'none', stroke: '#DCCFB8', 'stroke-width': 2 }, g);
            sv('circle', { cx: f1(cx), cy: f1(cy), r: rr, fill: 'none', stroke: '#A78345', 'stroke-width': 2, 'stroke-dasharray': f1(c * (1 - k)) + ' ' + f1(c), transform: 'rotate(-90 ' + f1(cx) + ' ' + f1(cy) + ')' }, g);
          }
        });
        // щели и уступы — подписи
        if ((r === S.row || r === S.row - 1) && S.phase !== 'final' && S.phase !== 'done') {
          row.forEach(function (b, i) {
            var gap = b.x - peFor(row, i);
            if ((i > 0 || r === S.row) && gap > GAP_OK + .05) mark(v.xs[i] - gv(gap) * MM / 2, yb + ROWH + 12, Math.round(gap) + ' мм', gap > GAP_BAD ? 'bad' : 'warn');
            [[b.dl, 0], [b.dr, 1]].forEach(function (d) {
              if (Math.abs(d[0]) > STEP_OK + .05) mark(v.xs[i] + (d[1] ? b.len * MM - 10 : 10), yb - 6 - Math.max(0, d[0]) * MM * STEPX, (d[0] > 0 ? '↑' : '↓') + Math.round(Math.abs(d[0])), Math.abs(d[0]) > STEP_BAD ? 'bad' : 'warn');
            });
          });
        }
      });
      // трещины по совпавшим швам
      S.cracks.forEach(function (c) {
        var x = c.x, y0 = rowBottomY(c.row) - ROWH, d = 'M' + f1(x) + ' ' + f1(y0);
        for (var i = 1; i <= 8; i++) d += 'L' + f1(x + (i % 2 ? 3 : -2) + rnd(-.5, .5)) + ' ' + f1(y0 + i * ROWH * 2 / 8);
        sv('path', { d: d, 'class': 'wg-crack' }, Lr.wall);
      });
      // перемычки
      S.lintels.forEach(function (ln) { sv('g', { transform: 'translate(' + f1(ln.x * MM) + ' ' + f1(rowBottomY(ln.row) - ROWH) + ')' }, Lr.wall, lintelShape(ln.len * MM)); });
      // проём под окна — по проекту, пунктиром
      if (S.phase !== 'final') {
        var wy0 = rowBottomY(M.win.r1) - ROWH, wh = (M.win.r1 - M.win.r0 + 1) * ROWH;
        sv('rect', { x: f1(M.win.x0 * MM), y: f1(wy0), width: f1((M.win.x1 - M.win.x0) * MM), height: f1(wh), 'class': 'wg-win' }, Lr.wall);
        if (S.row <= M.win.r1) sv('text', { x: f1((M.win.x0 + M.win.x1) / 2 * MM), y: f1(wy0 + wh / 2 + 3), 'text-anchor': 'middle', 'class': 'wg-win-label' }, Lr.wall).textContent = 'окно';
        if (S.phase === 'rebar' && S.row === M.win.r1 + 1) {
          var ly = rowBottomY(S.row) - ROWH;
          sv('rect', { x: f1((M.win.x0 - BEAR) * MM), y: f1(ly), width: f1((M.win.x1 - M.win.x0 + 2 * BEAR) * MM), height: f1(ROWH), 'class': 'wg-win wg-win--lintel' }, Lr.wall);
        }
      }
      // блок в руках
      clear(Lr.held);
      if (S.held) {
        var hb = S.held, hx = heldVisX(), hy = rowBottomY(S.row) - ROWH;
        if (hb.lift < 1) { hx = lerp(hb.fromX, hx, easeOut(hb.lift)); hy = lerp(hb.fromY, hy, easeOut(hb.lift)); }
        sv('g', { transform: 'translate(' + f1(hx) + ' ' + f1(hy - (hb.lift < 1 ? 0 : 1.5)) + ')', 'class': 'wg-held' }, Lr.held, blockShape(hb.p.len * MM, 0, 0, hb.p.cut));
      }
    }
    function mark(x, y, text, kind) {
      var g = sv('g', { 'class': 'wg-mark wg-mark--' + kind }, Lr.wall);
      var t = sv('text', { x: f1(x), y: f1(y), 'text-anchor': 'middle' }, g); t.textContent = text;
    }
    function editable(b) {
      if (b.locked) return false;
      if (M.setTime && performance.now() - b.t > M.setTime * 1000) { b.locked = true; return false; }
      return b.row === S.row && S.phase === 'play';
    }

    /* ---------- Блок в руках: ведём по ряду ---------- */
    function heldVisX() {
      var hb = S.held, prevEnd = segPrev(), vEnd = prevVis();
      return vEnd + gv(hb.x - prevEnd) * MM;
    }
    function pick(p, wp) {
      var hm = pieceHome(p), prevEnd = segPrev();
      // блок встаёт на ряд и дальше идёт за пальцем на столько, на сколько сдвинули палец
      var grab = clamp((wp.x - hm.x) / MM, 0, p.len);
      var x = clamp(xFromPointer(wp.x, grab), prevEnd + 150, Math.max(prevEnd + 150, segEnd() - 40));
      S.held = { p: p, x: x, x0: x, px0: wp.x, target: x, v: 0, press: 0, cool: 0, lift: 0, fromX: hm.x, fromY: hm.y, contact: false };
      p.el.style.visibility = 'hidden';
      tween(160, function (k) { if (S.held) S.held.lift = k; });
    }
    function xFromPointer(px, grab) {
      var prevEnd = segPrev(), vEnd = prevVis();
      var d = (px - vEnd) / MM - grab;
      return d >= 0 ? prevEnd + gvInv(d) : prevEnd + d;
    }
    function heldTick(dt) {
      var hb = S.held, prevEnd = segPrev(), stopIsBlock = !!segLast() || curSeg().solid;
      hb.cool = Math.max(0, hb.cool - dt);
      var want = hb.target, v = clamp((want - hb.x) * 9, -1600, 1600);  // блок идёт по клею с запаздыванием
      var nx = hb.x + v * dt;
      if (nx <= prevEnd && hb.cool <= 0) {
        if (!hb.contact && -v > V_BUMP && stopIsBlock) { bump(hb, 'Удар! Блок толкнули с разгона — соседний выбит'); return; }
        nx = prevEnd; hb.contact = true;
        var press = prevEnd - want;
        hb.press = press > P_MAX ? hb.press + dt : 0;
        if (hb.press > .22 && stopIsBlock) { bump(hb, 'Передавили — соседний блок сдвинулся'); return; }
      } else if (nx > prevEnd + .5) hb.contact = false;
      if (nx < prevEnd) nx = prevEnd;
      hb.x = nx; hb.v = v;
    }
    function bump(hb, msg) {
      var row = curRow(), nb = segLast();
      if (nb) {
        disturb(nb, rnd(1.3, 2.6), rnd(.3, 1.1));
        // если у соседа была щель слева — его вдавило
        var ni = row.indexOf(nb), pe = peFor(row, ni), g = nb.x - pe;
        if (g > .3 && !nb.locked) nb.x -= Math.min(g, rnd(.5, 2));
      } else msg = 'Удар о перемычку — так её можно сдвинуть. Подводите мягче';
      var back = rnd(10, 22); hb.x = segPrev() + back; hb.x0 += (hb.x - Math.min(hb.target, hb.x)); hb.target = Math.max(hb.target, hb.x); hb.cool = .3; hb.press = 0; hb.contact = false;
      S.bumps++; S.overdo++; hud();
      say(msg, 'warn', 2600); sfx.bump(); shake(); buzz(40);
    }
    function disturb(b, dr, dl) {
      if (!b) return;
      if (b.locked) { b.dr += dr * .25; b.dl += dl * .25; return; }   // схватившийся сдвигается меньше
      b.dr += dr; b.dl += dl;
    }
    function release() {
      var hb = S.held; S.held = null;
      var p = hb.p, prevEnd = segPrev(), E = segEnd(), atWin = E < L;
      if (hb.x > E - 30 || hb.x + p.len > E + 2) {
        if (hb.x < E - 30 && hb.x + p.len > E + 2) { say(p.cut ? (atWin ? 'Длинный — заходит в проём. Подрежьте ещё' : 'Длинный — выступает за угол. Подрежьте ещё') : (atWin ? 'Блок заходит в проём' : 'Блок выступает за угол'), 'warn', 2400); sfx.err(); if (p.cut) { p.cut = false; p.needCut = true; S.recuts++; } }
        p.el.style.visibility = ''; renderPallet(); return;
      }
      // блок садится на клей: чуть отходит и встаёт неровно
      var first = S.row === 0, seat = first ? M.first : M.seat;
      var b = { len: p.len, x: Math.min(hb.x + (hb.contact ? rnd(0, 1.4) : 0), E - p.len), dl: rnd(seat[0], seat[1]), dr: rnd(seat[0], seat[1]), cut: p.cut, row: S.row, t: performance.now() };
      if (first && mode === 'hard' && Math.abs(b.dl - b.dr) < 1.5) b.dr += (Math.random() < .5 ? -1 : 1) * 1.6;
      curRow().push(b);
      curRow().sort(function (u, w) { return u.x - w.x; });
      S.placed++;
      sfx.place(); buzz(12);
      clear(Lr.marks);
      render();
      dust(b.vx + b.len * MM / 2, rowBottomY(S.row), 5);
      if (first && !S.tips.level) { S.tips.level = 1; later(function () { say(mode === 'hard' ? 'Раствор неровный — стучите киянкой сверху по высокому краю' : 'Есть щель или уступ? Стукните киянкой: по торцу — подвинуть, сверху — осадить', null, 3600); }, 400); }
      later(offerNext, 250);
      render();
    }

    /* ---------- Пила ---------- */
    function sawAt(p, wp) {
      var hm = pieceHome(p), m = clamp(Math.round((wp.x - hm.x) / MM / 5) * 5, 60, p.len - 30);
      return m;
    }
    function cut(p, m) {
      var R = segEnd() - segPrev();
      p.len = m; p.cut = true; p.needCut = false;
      S.cutErr = m - R;
      sfx.saw();
      // обрезок падает
      var hm = pieceHome(p), off = sv('g', null, Lr.fx, blockShape((BL - m) * MM, 0, 0, false));
      parts.push({ el: off, x: hm.x + m * MM + 4, y: hm.y, vx: 40, vy: -60, r: 0, w: 40, log: true, life: 0, max: 1.4 });
      dust(hm.x + m * MM, hm.y + ROWH / 2, 8);
      renderPallet();
    }

    /* ---------- Киянка ---------- */
    function hitBlock(wp) {
      var row = curRow(), v = rowVis(S.row), yb = rowBottomY(S.row) - ROWH;
      for (var i = row.length - 1; i >= 0; i--) {
        var b = row[i], x0 = v.xs[i], x1 = x0 + b.len * MM;
        if (wp.x >= x0 - 3 && wp.x <= x1 + 6 && wp.y >= yb - 10 && wp.y <= yb + ROWH + 4) return { b: b, i: i, u: clamp((wp.x - x0) / (x1 - x0), 0, 1), y: (wp.y - yb) / ROWH };
      }
      return null;
    }
    function mallet(hit, wp) {
      var b = hit.b, row = curRow(), i = hit.i;
      if (!editable(b)) { say(M.setTime ? 'Клей схватился — блок уже не подвинуть' : 'Этот ряд уже готов', null, 1800); return; }
      var pe = peFor(row, i), gap = b.x - pe;
      malletFx(wp, hit.u > .8 && hit.y > .15);
      sfx.knock(); buzz(8);
      if (hit.u > .8 && hit.y > .15) {
        // по торцу — подвинуть к соседу
        if (gap > .05) { b.x -= gap > 6 ? gap * .5 : Math.min(gap, 1.5); if (b.x - pe < .05) b.x = pe; }
        else {
          // уже в стык — удар уходит в соседний
          if (i > 0) disturb(row[i - 1], rnd(.6, 1.3), rnd(.1, .5));
          b.dr += rnd(.2, .6);
          S.overdo++; hud();
          say(i > 0 ? 'Перестарались — уже было в стык, соседний сдвинулся' : 'Перестарались — уже было в стык', 'warn', 2200);
        }
      } else {
        // сверху — осадить: сильнее у того края, по которому стучим
        var k = .9;
        b.dl -= (1 - hit.u) * k; b.dr -= hit.u * k;
        if ((b.dl < -STEP_OK || b.dr < -STEP_OK) && !b.sunkTold) {
          b.sunkTold = true; S.overdo++; hud();
          say(i === row.length - 1 ? 'Пережали — блок просел. Его можно снять и уложить заново' : 'Пережали — блок просел', 'warn', 2600);
        }
      }
      render();
    }
    function malletFx(wp, side) {
      var g = sv('g', { 'class': 'wg-mallet', transform: 'translate(' + f1(wp.x) + ' ' + f1(wp.y) + ')' }, Lr.fx,
        '<g><rect x="-3" y="-34" width="6" height="26" rx="2" fill="#B88A3E" stroke="#3E3122" stroke-width="1.4"/><rect x="-11" y="-10" width="22" height="12" rx="3" fill="#3F3A33" stroke="#3E3122" stroke-width="1.4"/></g>');
      var inner = g.firstChild, ang = side ? -90 : 0;
      tween(180, function (k) { inner.setAttribute('transform', 'rotate(' + f1(ang + (1 - k) * -28) + ')'); g.style.opacity = k < .7 ? 1 : (1 - k) / .3; }, function () { g.remove(); });
    }

    /* ---------- Ряд готов ---------- */
    function closeRow() {
      var row = curRow();
      row.forEach(function (b) { b.locked = true; });
      // перевязка: швы этого ряда против швов нижнего
      if (S.row > 0) {
        var edges = []; [S.row, S.row - 1].forEach(function (r) { spansOf(r).forEach(function (sp) { edges.push(sp.x0, sp.x1); }); });
        function realSeam(x) { return !edges.some(function (e) { return Math.abs(e - x) < 2; }); }
        var seams = row.slice(1).map(function (b) { return b.x; }).filter(realSeam);
        var below = S.rows[S.row - 1].slice(1).map(function (b) { return b.x; }).filter(realSeam);
        var vBelow = rowVis(S.row - 1), vThis = rowVis(S.row), bad = 0;
        seams.forEach(function (s, i) {
          below.forEach(function (t, j) {
            if (Math.abs(s - t) < SEAM_MIN) { S.cracks.push({ row: S.row, x: (s + t) / 2 * MM - 1 }); bad++; }
          });
        });
        if (bad) { sfx.crack(); shake(); say('Швы совпали с нижним рядом — по ним пошла трещина', 'warn', 3200); buzz([30, 30, 60]); }
      }
      var endGap = L - row.reduce(function (e, b) { return Math.max(e, b.x + b.len); }, 0);
      S.endGaps = (S.endGaps || []).concat([endGap]);
      if (endGap > GAP_BAD && !S.cracks.length) say('У угла щель ' + Math.round(endGap) + ' мм — подрезали коротко', 'warn', 2400);
      else if (rowGood(row) && endGap <= GAP_OK + .5) { say('Ряд ровный!', 'ok', 1400); sfx.good(); }
      S.row++; S.seg = 0;
      hud();
      if (S.row >= M.rows) { later(finale, 700); S.phase = 'done'; render(); return; }
      S.rows.push([]);
      if (S.row === M.win.r1 + 1) { later(startRebar, 500); S.phase = 'rebar'; render(); return; }
      later(offerNext, 600);
      render();
    }
    function rowGood(row) {
      var ok = true;
      row.forEach(function (b, i) { if (b.x - peFor(row, i) > GAP_OK + .05 || Math.abs(b.dl) > STEP_OK + .05 || Math.abs(b.dr) > STEP_OK + .05) ok = false; });
      return ok;
    }

    /* ---------- Армирование (сложный режим) ---------- */
    var LEN_LINTEL = 0;
    function startRebar() {
      clear(Lr.pallet);
      LEN_LINTEL = M.win.x1 - M.win.x0 + 2 * BEAR;
      var w = LEN_LINTEL * MM, hm = portrait ? { x: palletX - w / 2, y: palletY - ROWH } : { x: palletX - w / 2, y: 8 - ROWH };
      var g = sv('g', { 'class': 'wg-piece wg-rod', transform: 'translate(' + f1(hm.x) + ' ' + f1(hm.y) + ')' }, Lr.pallet, lintelShape(w));
      S.rod = { el: g, hm: hm, w: w };
      say('Окно выложено. Положите перемычку над проёмом — она должна опираться на стену с обеих сторон', null, 3800);
      render();
    }
    function lintelShape(w) {
      return '<rect x="0" y="0" width="' + f1(w) + '" height="' + f1(ROWH) + '" fill="' + PORE + '" stroke="#3E3122" stroke-width="1.8"/>' +
        '<path d="M' + f1(BEAR * MM * .5) + ' ' + f1(ROWH * .35) + 'H' + f1(w - BEAR * MM * .5) + '" stroke="#9C968B" stroke-width="1.4" stroke-dasharray="6 3"/>' +
        '<text x="' + f1(w / 2) + '" y="' + f1(ROWH * .72) + '" text-anchor="middle" class="wg-piece-label">перемычка</text>';
    }
    function dropRod(wp) {
      var r = S.row, yTop = rowBottomY(r) - ROWH, el = S.rod.el;
      var x = (wp.x - S.rodDx) / MM, cx = (M.win.x0 + M.win.x1) / 2, ok = Math.abs(x + LEN_LINTEL / 2 - cx) <= BEAR - 60;
      if (Math.abs(wp.y - S.rodDy - yTop) < 60 && Math.abs(x + LEN_LINTEL / 2 - cx) < 600) {
        if (!ok) { say('Перемычка опирается одним краем — сдвиньте, чтобы зашла на стену с обеих сторон', 'warn', 3000); sfx.err(); setTrans(el, S.rod.hm.x, S.rod.hm.y); return false; }
        var lx = Math.round(x);
        S.spans[r] = [{ x0: lx, x1: lx + LEN_LINTEL, kind: 'lintel' }];
        S.lintels.push({ row: r, x: lx, len: LEN_LINTEL });
        clear(Lr.pallet); S.rod = null;
        sfx.place(); shake(); buzz(20); say('Перемычка на месте — дальше ряд упирается в неё', 'ok', 2200);
        S.phase = 'play'; S.seg = 0; later(offerNext, 400); render(); return true;
      }
      setTrans(el, S.rod.hm.x, S.rod.hm.y);
      return false;
    }
    function setTrans(el, x, y) { el.setAttribute('transform', 'translate(' + f1(x) + ' ' + f1(y) + ')'); }

    /* ---------- Указатель ---------- */
    var ptr = null;
    function wpt(e) {
      var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      var m = svg.getScreenCTM(); return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    }
    function pieceAt(wp) {
      for (var i = 0; i < S.offer.length; i++) {
        var p = S.offer[i], hm = pieceHome(p), w = p.len * MM, pad = portrait ? 10 : 4;
        if (wp.x >= hm.x - pad && wp.x <= hm.x + w + pad && wp.y >= hm.y - pad - 8 && wp.y <= hm.y + ROWH + pad) return p;
      }
      return null;
    }
    svg.addEventListener('pointerdown', function (e) {
      if (!S || (S.phase !== 'play' && S.phase !== 'rebar') || S.held) return;
      var wp = wpt(e);
      if (S.phase === 'rebar') {
        if (!S.rod) return;
        var hm = S.rod.hm;
        if (wp.x > hm.x - 6 && wp.x < hm.x + S.rod.w + 6 && wp.y > hm.y - 8 && wp.y < hm.y + ROWH + 8) { ptr = { id: e.pointerId, kind: 'rod', dx: wp.x - hm.x, dy: wp.y - hm.y }; S.rodDx = ptr.dx; S.rodDy = ptr.dy; capture(e); }
        return;
      }
      var p = pieceAt(wp);
      if (p) {
        e.preventDefault(); capture(e);
        if (p.needCut && !p.cut) { cut(p, sawAt(p, wp)); return; }
        ptr = { id: e.pointerId, kind: 'held' };
        pick(p, wp);
        // второе предложение (целый/половинка) убираем
        S.offer.forEach(function (q) { if (q !== p && q.el) q.el.remove(); });
        S.offer = [p];
        return;
      }
      var hit = hitBlock(wp);
      if (hit) { e.preventDefault(); capture(e); ptr = { id: e.pointerId, kind: 'tap', hit: hit, wp: wp, sx: e.clientX, sy: e.clientY }; }
    });
    svg.addEventListener('pointermove', function (e) {
      var wp = wpt(e);
      if (!ptr) {
        // наведение: пила следует за мышью, киянка — подсказка курсором
        if (S && S.phase === 'play') {
          S.offer.forEach(function (p) {
            if (p.sawEl) {
              var hm = pieceHome(p), over = pieceAt(wp) === p;
              p.sawEl.setAttribute('d', over ? 'M' + f1(sawAt(p, wp) * MM) + ' -8V' + f1(ROWH + 8) : '');
            }
          });
          var hit = S.held ? null : hitBlock(wp), pc = pieceAt(wp);
          svg.style.cursor = pc ? (pc.needCut && !pc.cut ? 'crosshair' : 'grab') : hit ? (editable(hit.b) ? (hit.u > .8 && hit.y > .15 ? 'w-resize' : 's-resize') : 'default') : '';
        }
        return;
      }
      if (e.pointerId !== ptr.id) return;
      if (ptr.kind === 'held' && S.held) S.held.target = S.held.x0 + (wp.x - S.held.px0) / MM;
      else if (ptr.kind === 'rod' && S.rod) setTrans(S.rod.el, wp.x - ptr.dx, wp.y - ptr.dy);
      else if (ptr.kind === 'tap') {
        // потянули последний уложенный блок — снимаем его
        var dx = e.clientX - ptr.sx, row = curRow();
        if (dx > 10 && ptr.hit.i === row.length - 1 && editable(ptr.hit.b)) {
          var b = row.pop(), p = makePiece(b.len, false, 0); p.cut = b.cut;
          S.placed--;
          clear(Lr.pallet); clear(Lr.marks);
          S.offer = [p]; renderPallet();
          ptr.kind = 'held';
          S.held = { p: p, x: b.x, x0: b.x, px0: wpt(e).x, target: b.x, v: 0, press: 0, cool: 0, lift: 1, fromX: 0, fromY: 0, contact: false };
          p.el.style.visibility = 'hidden';
          say('Блок сняли — уложите заново', null, 1600);
        }
      }
    });
    function endPtr(e, cancel) {
      if (!ptr || e.pointerId !== ptr.id) return;
      var p0 = ptr; ptr = null;
      if (p0.kind === 'held' && S.held) release();
      else if (p0.kind === 'rod') dropRod(wpt(e));
      else if (p0.kind === 'tap' && !cancel) mallet(p0.hit, p0.wp);
    }
    svg.addEventListener('pointerup', function (e) { endPtr(e, false); });
    svg.addEventListener('pointercancel', function (e) { endPtr(e, true); });
    function capture(e) { try { svg.setPointerCapture(e.pointerId); } catch (er) { /* */ } }
    // долгое нажатие на телефоне — без меню и выделения
    ['touchstart', 'touchmove'].forEach(function (t) { svg.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false }); });
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* ---------- Панель, подсказки, карточки ---------- */
    function hud() {
      if (!S) return;
      var joints = 0, good = 0;
      S.rows.forEach(function (row) { row.forEach(function (b, i) { joints++; if (b.x - peFor(row, i) <= GAP_OK + .05 && Math.abs(b.dl) <= STEP_OK + .05 && Math.abs(b.dr) <= STEP_OK + .05) good++; }); });
      S.good = good; S.joints = joints;
      ui.hud.innerHTML = S.phase === 'intro' || S.phase === 'final' ? '' :
        '<span><b>Ряд</b>' + Math.min(S.row + 1, M.rows) + ' / ' + M.rows + '</span>' +
        '<span><b>Ровно</b>' + good + ' / ' + joints + '</span>' +
        (S.cracks.length ? '<span class="is-bad"><b>Трещины</b>' + S.cracks.length + '</span>' : '') +
        (S.overdo ? '<span class="is-warn"><b>Перестарались</b>' + S.overdo + '</span>' : '');
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
        var c = sv('circle', { r: rnd(1, 2.4), fill: '#D6D0C4' }, Lr.fx);
        parts.push({ el: c, x: x + rnd(-6, 6), y: y, vx: rnd(-40, 40), vy: rnd(-60, -15), life: 0, max: rnd(.4, .7) });
      }
      kick();
    }

    function showCard(kind) {
      var html;
      if (kind === 'intro') {
        html = '<span class="eyebrow">' + (mode === 'hard' ? 'Сложный режим' : 'Мини-игра') + '</span><h3>Сложи стену</h3>' +
          '<ul class="wg-rules">' +
            '<li><b>Ведите блок</b> с поддона к стене и подводите мягко — встанет в стык. С разгона собьёте соседний.</li>' +
            '<li><b>Киянка:</b> по торцу — подвинуть, сверху — осадить. Лишний удар сдвигает уже уложенные.</li>' +
            '<li><b>Швы</b> рядов не должны совпадать. Последний блок перед углом или окном подрежьте по рулетке.</li>' +
            '<li><b>Окно:</b> над проёмом положите перемычку — она должна опираться на стену с обеих сторон.</li>' +
            (mode === 'hard' ? '<li><b>Сложнее:</b> стена длиннее, первый ряд на неровном растворе, клей схватывается за ' + M.setTime + ' секунд.</li>' : '') +
          '</ul>' +
          '<button class="btn btn--gold btn--small" type="button" data-wg="start">Начать <svg aria-hidden="true"><use href="#i-arrow"/></svg></button>';
      } else {
        var share = S.joints ? S.good / S.joints : 0, cr = S.cracks.length;
        var stars = share >= .85 && cr === 0 && S.overdo <= 1 ? 3 : share >= .6 && cr <= 1 ? 2 : 1;
        var price = BLOCK_PRICE ? ' Один настоящий блок стоит около ' + BLOCK_PRICE.toLocaleString('ru-RU') + ' ₽.' : '';
        html = '<div class="wg-stars">' + [1, 2, 3].map(function (i) { return '<span' + (i <= stars ? ' class="is-on"' : '') + '>✦</span>'; }).join('') + '</div>' +
          '<h3>Стена готова!</h3>' +
          '<p class="wg-card__meta">' + S.good + ' из ' + S.joints + ' блоков в стык и ровно' + (cr ? ' · ' + cr + ' ' + plural(cr, ['трещина', 'трещины', 'трещин']) : '') + '</p>' +
          '<figure class="wg-render"><img src="assets/img/chapel-render.jpg" alt="Проект часовни: белые стены, три арочных окна, медная кровля и купол с крестом" loading="lazy"><figcaption>Так будет выглядеть часовня</figcaption></figure>' +
          '<p class="wg-card__lead">Видите, как это непросто? Давайте доверим это профессионалам — каменщикам. Если есть возможность — подключайтесь.</p>' +
          '<p class="wg-card__block">Вы уложили ' + S.placed + ' ' + plural(S.placed, ['блок', 'блока', 'блоков']) + '. В настоящей часовне каждый блок — чьё-то пожертвование.' + price + ' Подарите приходу хотя бы один.</p>' +
          '<div class="wg-actions"><button class="btn btn--gold btn--small" type="button" data-wg="donate">Подарить блок <svg aria-hidden="true"><use href="#i-arrow"/></svg></button>' +
          '<button class="wg-link" type="button" data-wg="again">Сложить заново</button>' +
          (mode === 'easy' && opts.onMode ? '<button class="wg-link" type="button" data-wg="hard">Сложный режим</button>' : '') + '</div>';
      }
      ui.card.innerHTML = html;
      ui.card.className = 'wg-card wg-card--' + kind;
      ui.card.hidden = false;
    }
    ui.card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-wg]'); if (!b) return;
      var a = b.getAttribute('data-wg');
      if (a === 'start') { ui.card.hidden = true; S.phase = 'play'; offerNext(); render(); }
      else if (a === 'again') { reset(); ui.card.hidden = true; S.phase = 'play'; offerNext(); render(); }
      else if (a === 'donate') { var d = document.querySelector('[data-modal-open="donate"]'); if (opts.onDonate) opts.onDonate(); if (d) d.click(); }
      else if (a === 'hard' && opts.onMode) opts.onMode('hard');
    });

    /* ---------- Финал: штукатурка, кровля, главка, крест ---------- */
    function finale() {
      S.phase = 'final';
      root.classList.add('is-final');
      clear(Lr.pallet); clear(Lr.marks);
      hud(); render();
      var from = view, to = finalView();
      tween(900, function (k) { view = { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), w: lerp(from.w, to.w, k), h: lerp(from.h, to.h, k) }; applyView(); }, function () { drawBg(); });
      // часовня по рендеру проекта: цоколь из камня, белые стены, три арочных окна
      // с кирпичными арками, кирпичный крест, слева притвор, справа апсида,
      // медная кровля, барабан с окнами, медный купол, золотой крест с шаром
      var top = -M.rows * ROWH, Hh = -top, cx = W * .47;
      var COP = '#B8693E', COPD = '#8E4A2A', BRICK = '#C4643C', PL = '#F6EEE2', STONE = '#D8C6A4';
      function arch(x, y, w, hgt, brick) {   // арочное окно: x — центр, y — низ
        var r = w / 2, d = 'M' + f1(x - r) + ' ' + f1(y) + 'V' + f1(y - hgt + r) + 'A' + f1(r) + ' ' + f1(r) + ' 0 0 1 ' + f1(x + r) + ' ' + f1(y - hgt + r) + 'V' + f1(y) + 'Z';
        var o = '<path d="' + d + '" fill="#4F5F68" stroke="#3E3122" stroke-width="1.4"/>' +
          '<path d="M' + f1(x) + ' ' + f1(y - hgt + 2) + 'V' + f1(y) + '" stroke="#C9A35C" stroke-width="1"/>';
        if (brick) o += '<path d="M' + f1(x - r - 3) + ' ' + f1(y - hgt + r) + 'A' + f1(r + 3) + ' ' + f1(r + 3) + ' 0 0 1 ' + f1(x + r + 3) + ' ' + f1(y - hgt + r) + '" fill="none" stroke="' + BRICK + '" stroke-width="5" stroke-dasharray="4 1.4"/>' +
          '<rect x="' + f1(x - r - 3) + '" y="' + f1(y) + '" width="' + f1(w + 6) + '" height="3" fill="#E8DCC8" stroke="#3E3122" stroke-width=".8"/>';
        return o;
      }
      var plH = Hh * .2, ridge = top - Hh * .3, eave = top - 6;
      var px0 = -W * .3, porchTop = top + Hh * .1, doorTop = porchTop + Hh * .38;   // притвор
      var ax1 = W + W * .13;                                  // апсида
      var dW = W * .28, dTop = ridge - Hh * .3, domeTop = dTop - Hh * .32;
      var winW = W * .045, winY = rowBottomY(M.win.r0) - 3, winH = (M.win.r1 - M.win.r0 + 1) * ROWH - 6;
      var stones = '';
      for (var sx = px0; sx < ax1; sx += 22) stones += '<path d="M' + f1(sx) + ' ' + f1(-plH) + 'v' + f1(plH / 2) + 'M' + f1(sx + 11) + ' ' + f1(-plH / 2) + 'v' + f1(plH / 2) + '" stroke="#B8A47E" stroke-width=".8"/>';
      var seams = '';
      for (var rx = 0; rx <= W; rx += 14) seams += '<path d="M' + f1(rx) + ' ' + f1(eave + 1) + 'L' + f1(W * .5 + (rx - W * .5) * .86) + ' ' + f1(ridge + 2) + '" stroke="' + COPD + '" stroke-width=".8"/>';
      var steps = [
        // штукатурка и побелка стены, апсида, притвор, цоколь
        '<rect x="' + f1(ax1 - W * .13 - 2) + '" y="' + f1(top + 4) + '" width="' + f1(W * .13) + '" height="' + f1(Hh - 4) + '" rx="' + f1(W * .06) + '" fill="' + PL + '"/>' +
          '<rect x="0" y="' + f1(top) + '" width="' + f1(W) + '" height="' + f1(Hh) + '" fill="' + PL + '" opacity=".96"/>' +
          '<rect x="' + f1(px0) + '" y="' + f1(porchTop) + '" width="' + f1(-px0) + '" height="' + f1(-porchTop) + '" fill="' + PL + '"/>' +
          '<rect x="' + f1(px0 - 2) + '" y="' + f1(-plH) + '" width="' + f1(ax1 - px0 + 2) + '" height="' + f1(plH) + '" fill="' + STONE + '"/>' +
          '<path d="M' + f1(px0) + ' ' + f1(-plH / 2) + 'H' + f1(ax1) + '" stroke="#B8A47E" stroke-width=".8"/>' + stones,
        // окна с кирпичными арками, крест на стене, дверь притвора со ступенями
        (function () { var a0 = M.win.x0 * MM, a1 = M.win.x1 * MM, st = (a1 - a0) / 3, o = ''; for (var k = 0; k < 3; k++) o += arch(a0 + st * (k + .5), winY, Math.min(winW * 1.4, st * .62), winH, true); return o; })() +
          arch(ax1 - W * .06, winY, winW * .8, winH * .9, true) +
          '<path d="M' + f1(W * .82) + ' ' + f1(winY - winH * .95) + 'V' + f1(winY - winH * .2) + 'M' + f1(W * .82 - 9) + ' ' + f1(winY - winH * .72) + 'H' + f1(W * .82 + 9) + '" stroke="' + BRICK + '" stroke-width="5"/>' +
          // притвор стоит к нам боком, вход с аркой смотрит влево: видна кирпичная кромка портала и ступени
          '<rect x="' + f1(px0 - 4) + '" y="' + f1(porchTop) + '" width="9" height="' + f1(-porchTop - plH) + '" fill="' + BRICK + '" stroke="#3E3122" stroke-width="1"/>' +
          '<path d="M' + f1(px0 - 4) + ' ' + f1(porchTop + 8) + 'h9M' + f1(px0 - 4) + ' ' + f1(porchTop + 20) + 'h9M' + f1(px0 - 4) + ' ' + f1(porchTop + 32) + 'h9" stroke="#8E4A2A" stroke-width=".8"/>' +
          '<path d="M' + f1(px0) + ' 0h' + f1(-W * .12) + 'v' + f1(-plH * .3) + 'h' + f1(W * .04) + 'v' + f1(-plH * .3) + 'h' + f1(W * .04) + 'v' + f1(-plH * .3) + 'h' + f1(W * .04) + '" fill="#E3D6BE" stroke="#3E3122" stroke-width="1.2"/>',
        // медная кровля: основная, притвор, апсида
        '<path d="M' + f1(-8) + ' ' + f1(eave) + 'L' + f1(W * .5 - W * .43) + ' ' + f1(ridge) + 'H' + f1(W * .5 + W * .43) + 'L' + f1(W + 8) + ' ' + f1(eave) + 'Z" fill="' + COP + '" stroke="#3E3122"/>' + seams +
          '<path d="M' + f1(px0 - 10) + ' ' + f1(porchTop + 2) + 'L' + f1(px0 + 2) + ' ' + f1(porchTop - Hh * .2) + 'H' + f1(4) + 'V' + f1(porchTop + 2) + 'Z" fill="' + COP + '" stroke="#3E3122"/>' +
          (function () { var o = ''; for (var x = px0; x < 0; x += 12) o += '<path d="M' + f1(x) + ' ' + f1(porchTop + 1) + 'V' + f1(porchTop - Hh * .2 + 1) + '" stroke="' + COPD + '" stroke-width=".8"/>'; return o; })() +
          '<path d="M' + f1(W - 4) + ' ' + f1(top - 4) + 'Q' + f1(ax1 + 8) + ' ' + f1(top - 6) + ' ' + f1(ax1 + 6) + ' ' + f1(top + 10) + 'H' + f1(W - 4) + 'Z" fill="' + COP + '" stroke="#3E3122"/>',
        // барабан с окнами и медный купол
        '<rect x="' + f1(cx - dW / 2) + '" y="' + f1(dTop) + '" width="' + f1(dW) + '" height="' + f1(ridge - dTop + 4) + '" fill="' + PL + '" stroke="#3E3122"/>' +
          arch(cx - dW * .3, ridge - 6, winW * .8, (ridge - dTop) * .62, true) + arch(cx, ridge - 6, winW * .8, (ridge - dTop) * .62, true) + arch(cx + dW * .3, ridge - 6, winW * .8, (ridge - dTop) * .62, true) +
          '<path d="M' + f1(cx - dW / 2 - 6) + ' ' + f1(dTop) + 'C' + f1(cx - dW / 2) + ' ' + f1(domeTop + 6) + ' ' + f1(cx + dW / 2) + ' ' + f1(domeTop + 6) + ' ' + f1(cx + dW / 2 + 6) + ' ' + f1(dTop) + 'Z" fill="' + COP + '" stroke="#3E3122"/>' +
          '<path d="M' + f1(cx - dW * .18) + ' ' + f1(dTop - 2) + 'Q' + f1(cx - dW * .12) + ' ' + f1(domeTop + 14) + ' ' + f1(cx) + ' ' + f1(domeTop + 2) + 'M' + f1(cx + dW * .18) + ' ' + f1(dTop - 2) + 'Q' + f1(cx + dW * .12) + ' ' + f1(domeTop + 14) + ' ' + f1(cx) + ' ' + f1(domeTop + 2) + '" fill="none" stroke="' + COPD + '" stroke-width="1"/>' +
          '<path d="M' + f1(cx - dW / 2 - 8) + ' ' + f1(dTop) + 'H' + f1(cx + dW / 2 + 8) + '" stroke="#3E3122" stroke-width="2.4"/>',
        // золотой шар и восьмиконечный крест: нижняя перекладина — левый от зрителя конец выше
        '<circle cx="' + f1(cx) + '" cy="' + f1(domeTop - 30) + '" r="80" fill="url(#wg-glow-' + mode + ')" stroke="none"/>' +
          '<circle cx="' + f1(cx) + '" cy="' + f1(domeTop - 3) + '" r="5" fill="url(#wg-gold-' + mode + ')" stroke="#7A5A22"/>' +
          '<g stroke="#B88A3E" stroke-width="3"><path d="M' + f1(cx) + ' ' + f1(domeTop - 8) + 'V' + f1(domeTop - 62) + 'M' + f1(cx - 6) + ' ' + f1(domeTop - 54) + 'h12M' + f1(cx - 14) + ' ' + f1(domeTop - 44) + 'h28M' + f1(cx - 8) + ' ' + f1(domeTop - 26) + 'l16 7"/></g>'
      ];
      steps.forEach(function (s, i) {
        later(function () {
          var e = sv('g', null, Lr.top, s); e.style.opacity = 0;
          tween(450, function (k) { e.style.opacity = k; });
          if (i === steps.length - 1) { sfx.bell(); svg.classList.add('is-final'); } else sfx.place();
        }, 700 + i * 520);
      });
      later(function () { showCard('final'); }, 700 + steps.length * 520 + 600);
    }

    /* ---------- Цикл ---------- */
    function kick() { if (!raf && alive) { lastT = performance.now(); raf = requestAnimationFrame(loop); } }
    function loop(t) {
      raf = 0;
      if (!alive) return;
      var dt = Math.min(.05, Math.max(.001, (t - lastT) / 1000)); lastT = t;
      for (var i = tweens.length - 1; i >= 0; i--) {
        var tw = tweens[i], k = clamp((t - tw.t0) / tw.dur, 0, 1);
        tw.fn(easeOut(k)); if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); }
      }
      if (S && S.held) heldTick(dt);
      for (var j = parts.length - 1; j >= 0; j--) {
        var p = parts[j]; p.life += dt;
        if (p.life > p.max) { p.el.remove(); parts.splice(j, 1); continue; }
        p.vy += (p.log ? 900 : 140) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.log) { p.r += p.w * dt; if (p.y > 24 - ROWH * .4 && !portrait) { p.y = 24 - ROWH * .4; p.vy *= -.2; p.vx *= .5; } p.el.setAttribute('transform', 'translate(' + f1(p.x) + ' ' + f1(p.y) + ') rotate(' + f1(p.r) + ')'); p.el.style.opacity = p.life > p.max - .4 ? (p.max - p.life) / .4 : 1; }
        else { p.el.setAttribute('cx', f1(p.x)); p.el.setAttribute('cy', f1(p.y)); p.el.setAttribute('opacity', f1(1 - p.life / p.max)); }
      }
      if (S && (S.phase === 'play' || S.phase === 'rebar')) render();
      // в сложном режиме идёт таймер клея — перерисовываем постоянно
      if (tweens.length || parts.length || (S && S.held) || (M.setTime && S && S.phase === 'play')) raf = requestAnimationFrame(loop);
    }

    var ro = window.ResizeObserver ? new ResizeObserver(function () { layout(); }) : null;
    if (ro) ro.observe(host); else window.addEventListener('resize', layout);
    reset();
    layout();
    showCard('intro');
    kick();

    return {
      destroy: function () { alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); if (ro) ro.disconnect(); root.remove(); },
      root: root
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
    hardBox.setAttribute('aria-label', 'Игра «Сложи стену», сложный режим');
    var head = h('header', 'wg-hard__head', '<div><span class="eyebrow">Строим вместе</span><h2>Сложи стену</h2></div>');
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
      '<span class="wg-launch__text"><b>Сложи стену сам</b><small>Мини-игра · газобетон</small></span>' +
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
      overlay.setAttribute('aria-label', 'Игра «Сложи стену»');
      document.body.appendChild(overlay);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay && !overlay.hidden && !document.querySelector('.modal:not([hidden])')) closeOverlay(); });
    }
    clear(overlay);
    var head = h('header', 'wg-over__head', '<h2>Сложи стену</h2>');
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
