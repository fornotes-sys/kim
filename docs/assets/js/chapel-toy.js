/* ==========================================================================
   Живая иллюстрация в блоке «Строим вместе» (только компьютер).
   Вместо картинки — та же сцена, но брёвна можно брать мышкой.

   Простая версия: бревно ровное, центр тяжести посередине. Возьмёшь не в
   середине — перекосит. Бревно качается на тросе. Опустил ровно — легло
   на сруб, криво или мимо — скатилось. Без подсказок. Несколько венцов —
   и короткая фраза про профессионалов с кнопкой поддержки.

   Кнопка «Заняться строительством по-серьёзному» открывает полную игру
   (assets/js/chapel-game.js). На телефоне остаётся обычная картинка.
   ========================================================================== */
(function () {
  'use strict';

  var media = document.querySelector('.build__media');
  if (!media || !window.matchMedia || !window.requestAnimationFrame) return;
  var DESKTOP = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Параметры ---------- */
  var LOG_L = 220, RB = 9, RT = 9;      // бревно ровное, без сбега
  var D_TILT = 80, ROPE = 54, G = 1500;
  var WX = 470, BASE = 385, GROUND = 405, PILE_X = 215, SLEEPER = 392;
  var PREBUILT = 3, GOAL = 5;           // три венца уже стоят, игрок кладёт ещё пять — всего восемь
  var OK_DEG = 6, OK_DX = 24, GOOD_DEG = 2.5, GOOD_DX = 10;
  var COM = LOG_L * (0.5 - (RB * RB + 2 * RB * RT + 3 * RT * RT) / (4 * (RB * RB + RB * RT + RT * RT)));

  var NS = 'http://www.w3.org/2000/svg', PI = Math.PI, DEG = 180 / PI;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function easeIn(k) { return k * k; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function sv(tag, attrs, parent, html) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function setT(e, x, y, r) { e.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')' + (r ? ' rotate(' + r.toFixed(3) + ')' : '')); }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }

  /* ---------- Тихий звук удара бревна (после первого касания) ---------- */
  var AC = null;
  function thud(soft) {
    try {
      if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return; AC = new C(); }
      var t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
      o.frequency.setValueAtTime(soft ? 140 : 105, t); o.frequency.exponentialRampToValueAtTime(48, t + .3);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(soft ? .12 : .25, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .32);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + .4);
    } catch (e) { /* без звука */ }
  }

  /* ---------- Бревно ---------- */
  function newLog(side) {
    side = side || (Math.random() < .5 ? -1 : 1);
    return { side: side, e: rnd(-3, 3) };   // центр тяжести почти точно посередине
  }
  function rL(lg) { return lg.side < 0 ? RB : RT; }
  function rR(lg) { return lg.side < 0 ? RT : RB; }
  function rAt(lg, x) { return lerp(rL(lg), rR(lg), (x + LOG_L / 2) / LOG_L); }
  function logMarkup(lg) {
    var h = LOG_L / 2, a = rL(lg), b = rR(lg);
    var s = '<path d="M' + (-h) + ' ' + (-a) + 'L' + h + ' ' + (-b) + 'A' + (b * .5) + ' ' + b + ' 0 0 1 ' + h + ' ' + b + 'L' + (-h) + ' ' + a + 'A' + (a * .5) + ' ' + a + ' 0 0 1 ' + (-h) + ' ' + (-a) + 'Z" fill="url(#ct-log)"/>';
    s += '<path d="M' + (-h + 30) + ' ' + (-rAt(lg, -h + 30) * .3).toFixed(1) + 'L' + (-h + 100) + ' ' + (-rAt(lg, -h + 100) * .3).toFixed(1) + 'M' + (h - 120) + ' ' + (rAt(lg, h - 120) * .35).toFixed(1) + 'L' + (h - 40) + ' ' + (rAt(lg, h - 40) * .35).toFixed(1) + '" stroke="#C4A06C" stroke-width=".9"/>';
    [-1, 1].forEach(function (sd) { s += '<ellipse cx="' + (sd * (h - a * .1)).toFixed(1) + '" cy="0" rx="' + (a * .42).toFixed(1) + '" ry="' + (a * .78).toFixed(1) + '" fill="#E9D3A8" stroke="#8C6A3E" stroke-width="1.1"/>'; });
    return s;
  }

  /* ---------- Состояние ---------- */
  var svg, L = {}, ui = {}, active = false, built = false;
  var wall, cur, hold, fall, tweens = [], parts = [], raf = 0, lastT = 0;

  function tween(dur, fn, done, ease) { tweens.push({ t0: performance.now(), dur: dur, fn: fn, done: done, e: ease || easeOut }); kick(); }

  /* ---------- Сцена ---------- */
  function build() {
    svg = sv('svg', { 'class': 'ct-svg', viewBox: '0 0 790 430', preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': 'Стройка часовни: сруб, бревно на подкладках и кран. Бревно можно взять мышкой и положить на сруб.' });
    sv('defs', null, svg,
      '<linearGradient id="ct-log" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2E3C4"/><stop offset=".45" stop-color="#E6CFA2"/><stop offset="1" stop-color="#C9A570"/></linearGradient>');
    sv('g', { fill: 'none', stroke: '#3E3122', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg,
      '<circle cx="640" cy="78" r="38" stroke="#B88A3E"/><g stroke="#C9A35C" stroke-width="1.6"><path d="M640 22v-18M640 134v18M584 78h-18M696 78h18M600 38l-13-13M680 118l13 13M680 38l13-13M600 118l-13 13"/></g>' +
      '<path d="M70 70c40-14 80-14 120 0M300 50c26-9 52-9 78 0" stroke="#C9B48E" stroke-width="1.4"/>' +
      '<path d="M-200 405c160 4 300-4 420 0s260-6 400 2 200-2 400 0"/>' +
      '<g stroke="#7E7A4E" stroke-width="1.4"><path d="M24 412l4-10M44 414l3-9M330 413l4-10M640 413l3-9M720 412l5-11M760 414l3-8"/></g>' +
      // поклонный крест (нижняя перекладина: левый от зрителя конец выше)
      '<g stroke="#5A3F22" stroke-width="3"><path d="M70 405V170"/><path d="M56 194h28"/><path d="M36 226h68"/><path d="M48 300l44 20"/></g><circle cx="70" cy="226" r="5" fill="#B88A3E" stroke="none"/>' +
      // фундамент сруба
      '<g fill="#DAD0BC" stroke-width="2">' + [380, 440, 500, 560].map(function (x) { return '<rect x="' + (x - 18) + '" y="385" width="36" height="22" rx="2"/>'; }).join('') + '</g>' +
      // подкладки под бревно
      '<rect x="122" y="392" width="20" height="14" rx="2" fill="#CDB289" stroke-width="1.6"/><rect x="288" y="392" width="20" height="14" rx="2" fill="#CDB289" stroke-width="1.6"/>' +
      // главка с крестом ждёт на земле
      '<g><path d="M672 405v-30h52v30" fill="#E8D4AE"/><path d="M668 375h60"/><path d="M698 322c-21 10-32 28-28 53h56c4-25-7-43-28-53z" fill="#E6C278" stroke="#7A5A22"/><path d="M698 322c-8 13-10 32-8 53M698 322c8 13 10 32 8 53" stroke="#A47F38" stroke-width="1.2"/><g stroke="#7A5A22" stroke-width="2.6"><path d="M698 322v-46M690 286h16M684 298h28M690 308l16 7"/></g></g>');
    L.stock = sv('g', { fill: '#E8D4AE', stroke: '#3E3122', 'stroke-width': 1.6 }, svg);
    L.wall = sv('g', { fill: 'none', stroke: '#3E3122', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    L.target = sv('path', { 'class': 'ct-target', 'display': 'none' }, svg);
    L.crane = sv('g', { fill: 'none', 'stroke-linecap': 'round' }, svg);
    L.rope = sv('path', { stroke: '#6B5130', 'stroke-width': 1.7 }, L.crane);
    L.hook = sv('path', { d: 'M0 -9v6a5 5 0 1 0 6 5', stroke: '#3E3122', 'stroke-width': 2.2 }, L.crane);
    L.crane.style.display = 'none';
    L.act = sv('g', { fill: 'none', stroke: '#3E3122', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    L.aim = sv('g', { fill: 'none' }, svg);
    L.fx = sv('g', null, svg);
    media.appendChild(svg);

    ui.say = document.createElement('p');
    ui.say.className = 'ct-say';
    ui.say.setAttribute('role', 'status');
    media.appendChild(ui.say);
    ui.more = document.createElement('button');
    ui.more.type = 'button';
    ui.more.className = 'ct-more';
    ui.more.innerHTML = 'Заняться строительством по-серьёзному <svg aria-hidden="true"><use href="#i-arrow"/></svg>';
    media.appendChild(ui.more);
    ui.card = document.createElement('div');
    ui.card.className = 'ct-card';
    ui.card.hidden = true;
    ui.card.innerHTML =
      '<p class="ct-card__title">Сруб сложен!</p>' +
      '<p>Видите, как это непросто? Давайте доверим это профессионалам — плотникам. Если есть возможность — подключайтесь.</p>' +
      '<div class="ct-card__actions"><button class="btn btn--gold btn--small" type="button" data-ct="donate">Поддержать строительство <svg aria-hidden="true"><use href="#i-arrow"/></svg></button>' +
      '<button class="ct-link" type="button" data-ct="again">Сложить заново</button></div>';
    media.appendChild(ui.card);

    ui.more.addEventListener('click', function (e) {
      e.stopPropagation();
      if (window.KimChapelGame) window.KimChapelGame.open(ui.more);
    });
    ui.card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ct]'); if (!b) return;
      if (b.getAttribute('data-ct') === 'donate') { var d = document.querySelector('[data-modal-open="donate"]'); if (d) d.click(); }
      else reset();
    });

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('pointerleave', function () { if (!hold) { clear(L.aim); svg.classList.remove('is-over'); } });
    built = true;
  }

  function reset() {
    tweens = []; parts.forEach(function (p) { p.el.remove(); }); parts = [];
    hold = fall = null;
    clear(L.wall); clear(L.act); clear(L.aim); clear(L.fx);
    ui.card.hidden = true;
    wall = { yl: BASE, yr: BASE, n: 0, side: null };
    // три венца уже стоят — «комель на вершину»
    for (var i = 0; i < PREBUILT; i++) placeOnWall(newLog(i % 2 ? 1 : -1), true);
    spawn();
  }
  function setActive(on) {
    if (on && !built) build();
    if (!built) return;
    active = on;
    media.classList.toggle('is-toy', on);
    if (on && !wall) reset();
  }

  /* ---------- Стена ---------- */
  function wallDeg() { return Math.atan2(wall.yr - wall.yl, LOG_L) * DEG; }
  function wallTopAt(x) { return lerp(wall.yl, wall.yr, (x - (WX - LOG_L / 2)) / LOG_L); }
  function placeOnWall(lg, silent, el) {
    var a = rL(lg), b = rR(lg), yl = wall.yl - a, yr = wall.yr - b;
    if (!el) { el = sv('g', null, L.wall, logMarkup(lg)); }
    else L.wall.appendChild(el);
    setT(el, WX, (yl + yr) / 2, Math.atan2(yr - yl, LOG_L) * DEG);
    var c = sv('g', { fill: '#E8D4AE', stroke: '#3E3122', 'stroke-width': 1.4 }, L.wall);
    sv('ellipse', { cx: WX - LOG_L / 2 + 15, cy: ((yl + wall.yl) / 2 + 3).toFixed(1), rx: 5.5, ry: (a * .7).toFixed(1) }, c);
    sv('ellipse', { cx: WX + LOG_L / 2 - 15, cy: ((yr + wall.yr) / 2 + 3).toFixed(1), rx: 5.5, ry: (b * .7).toFixed(1) }, c);
    wall.yl -= 2 * a; wall.yr -= 2 * b; wall.side = lg.side;
    if (!silent) wall.n++;
    L.target.setAttribute('d', 'M' + (WX - LOG_L / 2) + ' ' + (wall.yl - 1).toFixed(1) + 'L' + (WX + LOG_L / 2) + ' ' + (wall.yr - 1).toFixed(1));
  }
  /* ---------- Бревно на подкладках ---------- */
  function pileRest(lg) {
    var a = rL(lg), b = rR(lg);
    return { x: PILE_X, y: SLEEPER - (a + b) / 2, r: -Math.atan2(a - b, LOG_L) * DEG };
  }
  function spawn(lg) {
    // следующее бревно подаём «комлем на вершину» — так честнее для простой версии
    lg = lg || newLog(wall.side ? -wall.side : null);
    var el = sv('g', { 'class': 'ct-log' }, L.act, logMarkup(lg));
    var strap = sv('rect', { x: -2.5, y: -13, width: 5, height: 26, rx: 1.5, fill: '#8C6A3E', stroke: 'none' }, el);
    strap.style.display = 'none';
    var rest = pileRest(lg);
    cur = { lg: lg, el: el, strap: strap, x: rest.x, y: rest.y - 40, r: rest.r, busy: true };
    el.style.opacity = 0;
    var me = cur;
    tween(380, function (k) { me.y = lerp(rest.y - 40, rest.y, k); el.style.opacity = Math.min(1, k * 2); setT(el, me.x, me.y, me.r); }, function () { me.busy = false; }, easeIn);
  }
  function toLocal(p) {
    var a = -cur.r / DEG, dx = p.x - cur.x, dy = p.y - cur.y;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  }
  function hit(p) {
    if (!cur) return false;
    var q = toLocal(p);
    return Math.abs(q.x) <= LOG_L / 2 + 6 && Math.abs(q.y) <= rAt(cur.lg, clamp(q.x, -LOG_L / 2, LOG_L / 2)) + 7;
  }
  function gripWorld(gx) {
    var a = cur.r / DEG, ly = -rAt(cur.lg, gx);
    return { x: cur.x + gx * Math.cos(a) - ly * Math.sin(a), y: cur.y + gx * Math.sin(a) + ly * Math.cos(a) };
  }
  function pt(e) {
    var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }

  /* ---------- Мышь ---------- */
  function onDown(e) {
    if (!active || !cur || cur.busy || hold || fall || !ui.card.hidden) return;
    var p = pt(e);
    if (!hit(p)) return;
    e.preventDefault();
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ничего */ }
    var gx = clamp(toLocal(p).x, -LOG_L / 2 + 8, LOG_L / 2 - 8), gp = gripWorld(gx);
    hold = { gx: gx, px: p.x, py: p.y, tx: gp.x, ty: gp.y - ROPE, th: 0, om: 0, phi: cur.r / DEG, phiV: 0, vs: 0, vp: 0, lx: gp.x, hvx: 0 };
    clear(L.aim);
    cur.strap.style.display = ''; setT(cur.strap, gx, 0, 0);
    L.crane.style.display = '';
    svg.classList.add('is-grabbing');
    media.classList.add('is-touched');
    kick();
  }
  function onMove(e) {
    if (!active) return;
    var p = pt(e);
    if (hold) { hold.px = p.x; hold.py = p.y; return; }
    clear(L.aim);
    if (cur && !cur.busy && !fall && ui.card.hidden && hit(p)) {
      svg.classList.add('is-over');
    } else svg.classList.remove('is-over');
  }
  function onUp() {
    if (!hold) return;
    var hd = hold; hold = null;
    svg.classList.remove('is-grabbing');
    L.crane.style.display = 'none';
    cur.strap.style.display = 'none';
    if (Math.abs(cur.x - WX) < 100 && cur.y < Math.min(wall.yl, wall.yr) + 4) {
      fall = { vx: clamp(hd.hvx * .5, -240, 240), vy: 0, w: hd.phiV * .6, phi: hd.phi };
    } else {
      var me = cur, rest = pileRest(me.lg), x0 = me.x, y0 = me.y, r0 = me.r;
      me.busy = true;
      tween(400, function (k) { me.x = lerp(x0, rest.x, k); me.y = lerp(y0, rest.y, k); me.r = lerp(r0, rest.r, k); setT(me.el, me.x, me.y, me.r); }, function () { me.busy = false; thud(true); });
    }
    kick();
  }

  /* ---------- Физика: бревно на тросе ---------- */
  function holdTick(dt) {
    var hd = hold, lg = cur.lg;
    var tx = hd.px, ty = hd.py - 22 - ROPE;
    var near = Math.abs(tx - WX) < LOG_L / 2 + 40;
    ty = Math.min(ty, (near ? Math.min(wall.yl, wall.yr) : SLEEPER) - 2 * RB - 4 - ROPE);
    ty = Math.max(ty, -20);
    var k = Math.min(1, dt * 12), ntx = lerp(hd.tx, tx, k), nty = lerp(hd.ty, ty, k);
    var v = (ntx - hd.tx) / dt;
    hd.vs += (v - hd.vs) * Math.min(1, dt * 12);
    var ax = clamp((hd.vs - hd.vp) / dt, -9000, 9000); hd.vp = hd.vs;
    hd.tx = ntx; hd.ty = nty;
    var eq = Math.atan2(lg.e - hd.gx, D_TILT);
    var n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (var i = 0; i < n; i++) {
      var thA = -(G / ROPE) * Math.sin(hd.th) - 2.6 * hd.om - (ax * .55 / ROPE) * Math.cos(hd.th);
      hd.om += thA * h; hd.th = clamp(hd.th + hd.om * h, -.7, .7);
      var phA = -38 * Math.sin(hd.phi - eq) - 3.4 * hd.phiV - thA * .3;
      hd.phiV += phA * h; hd.phi = clamp(hd.phi + hd.phiV * h, -1.1, 1.1);
    }
    var hx = hd.tx + ROPE * Math.sin(hd.th), hy = hd.ty + ROPE * Math.cos(hd.th);
    hd.hvx = (hx - hd.lx) / dt; hd.lx = hx;
    var a = hd.phi, ly = -rAt(lg, hd.gx);
    cur.x = hx - (hd.gx * Math.cos(a) - ly * Math.sin(a));
    cur.y = hy - (hd.gx * Math.sin(a) + ly * Math.cos(a));
    cur.r = a * DEG;
    setT(cur.el, cur.x, cur.y, cur.r);
    L.rope.setAttribute('d', 'M' + hd.tx.toFixed(1) + ' -30V' + hd.ty.toFixed(1) + 'L' + hx.toFixed(1) + ' ' + (hy - 8).toFixed(1));
    setT(L.hook, hx, hy, 0);
    var err = Math.abs(hd.phi * DEG - wallDeg());
    L.target.classList.toggle('is-ready', err <= GOOD_DEG && Math.abs(hd.phiV) < .6 && Math.abs(cur.x - WX) <= GOOD_DX);
  }
  function fallTick(dt) {
    var f = fall, lg = cur.lg;
    f.vy += 2400 * dt; f.vx *= Math.pow(.2, dt); f.w *= Math.pow(.4, dt);
    cur.x += f.vx * dt; cur.y += f.vy * dt; f.phi += f.w * dt; cur.r = f.phi * DEG;
    setT(cur.el, cur.x, cur.y, cur.r);
    var c = Math.cos(f.phi), s = Math.sin(f.phi);
    var ends = [[-LOG_L / 2 + 6, rL(lg)], [LOG_L / 2 - 6, rR(lg)]];
    for (var i = 0; i < 2; i++) {
      var ex = cur.x + ends[i][0] * c - ends[i][1] * s, ey = cur.y + ends[i][0] * s + ends[i][1] * c;
      if ((Math.abs(ex - WX) < LOG_L / 2 + 10 && ey >= wallTopAt(ex)) || ey >= GROUND) { land(); return; }
    }
  }
  function land() {
    var f = fall; fall = null;
    L.target.classList.remove('is-ready');
    var me = cur, dx = me.x - WX, err = f.phi * DEG - wallDeg();
    me.busy = true;
    if (Math.abs(dx) > OK_DX || Math.abs(err) > OK_DEG) {
      var dir = Math.abs(dx) > OK_DX ? Math.sign(dx) : Math.sign(err);
      say(Math.abs(dx) > OK_DX ? 'Мимо — бревно скатилось' : 'Легло одним концом и соскочило');
      thud();
      var x0 = me.x, y0 = me.y, r0 = me.r;
      tween(760, function (k) {
        me.x = lerp(x0, x0 + dir * 130, k);
        me.y = k < .35 ? lerp(y0, y0 - 5, k / .35) : lerp(y0 - 5, GROUND - 9, easeIn((k - .35) / .65));
        me.r = lerp(r0, dir * 12, easeOut(k));
        setT(me.el, me.x, me.y, me.r);
      }, function () {
        thud(true); dust(me.x, GROUND, 10, 50);
        tween(450, function (k) { me.el.style.opacity = 1 - k; }, function () { me.el.remove(); cur = null; spawn(me.lg); });
      }, function (k) { return k; });
      return;
    }
    var good = Math.abs(err) <= GOOD_DEG && Math.abs(dx) <= GOOD_DX;
    var a = rL(me.lg), b = rR(me.lg), yl = wall.yl - a, yr = wall.yr - b;
    var ty = (yl + yr) / 2, tr = Math.atan2(yr - yl, LOG_L) * DEG, x0b = me.x, y0b = me.y, r0b = me.r;
    tween(good ? 130 : 260, function (k) { me.x = lerp(x0b, WX, k); me.y = lerp(y0b, ty, k); me.r = lerp(r0b, tr, k); setT(me.el, me.x, me.y, me.r); }, function () {
      thud(); dust(WX - 100, ty + 8, 5, 8); dust(WX + 100, ty + 8, 5, 8);
      me.el.classList.remove('ct-log');
      placeOnWall(me.lg, false, me.el);
      if (good) say('Ровно!', 'ok');
      cur = null;
      if (wall.n >= GOAL) { setTimeout(function () { ui.card.hidden = false; }, 500); return; }
      spawn();
    });
  }

  var sayTimer = 0;
  function say(t, tone) {
    ui.say.textContent = t;
    ui.say.className = 'ct-say is-on' + (tone ? ' ct-say--' + tone : '');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(function () { ui.say.classList.remove('is-on'); }, 1800);
  }
  function dust(x, y, n, spread) {
    if (REDUCED.matches) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var c = sv('circle', { r: rnd(1.4, 3.2), fill: '#C9B48E' }, L.fx);
      parts.push({ el: c, x: x + rnd(-spread, spread), y: y, vx: rnd(-50, 50), vy: rnd(-80, -20), life: 0, max: rnd(.45, .8) });
    }
    kick();
  }

  /* ---------- Цикл: работает только пока что-то движется ---------- */
  function kick() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); } }
  function loop(t) {
    raf = 0;
    var dt = Math.min(.05, Math.max(.001, (t - lastT) / 1000)); lastT = t;
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i], k = clamp((t - tw.t0) / tw.dur, 0, 1);
      tw.fn(tw.e(k));
      if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); }
    }
    if (hold && cur) holdTick(dt);
    if (fall && cur) fallTick(dt);
    for (var j = parts.length - 1; j >= 0; j--) {
      var p = parts[j]; p.life += dt;
      if (p.life > p.max) { p.el.remove(); parts.splice(j, 1); continue; }
      p.vy += 160 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.el.setAttribute('cx', p.x.toFixed(1)); p.el.setAttribute('cy', p.y.toFixed(1)); p.el.setAttribute('opacity', (1 - p.life / p.max).toFixed(2));
    }
    if (hold || fall || tweens.length || parts.length) raf = requestAnimationFrame(loop);
  }

  setActive(DESKTOP.matches);
  var onChange = function () { setActive(DESKTOP.matches); };
  if (DESKTOP.addEventListener) DESKTOP.addEventListener('change', onChange); else if (DESKTOP.addListener) DESKTOP.addListener(onChange);
})();
