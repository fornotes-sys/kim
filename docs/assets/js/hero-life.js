/* «Живая» картинка храма на первом экране.
   Поверх фото — холст, на котором изредка и неравномерно что-то происходит:
   ветер шевелит листву, падают листья, на крест садится птица, медленно плывут облака,
   по куполу пробегает блик, а раз в несколько минут набегают тучи, идёт лёгкий дождь
   и снова выходит солнце.
   Маски неба, листвы и золота лежат в одном файле hero-life-masks.png (каналы R, G, B).
   Скрипт стартует после загрузки страницы, спит, когда первый экран не виден,
   и не запускается совсем, если в системе включено «уменьшить движение».
   ?life=demo в адресе — всё происходит чаще (для показа). */
(function () {
  'use strict';
  var fig = document.querySelector('.hero__slide');
  var img = fig && fig.querySelector('img');
  if (!img || !window.requestAnimationFrame) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var DEMO = /[?&]life=demo\b/.test(location.search);
  var IW = 1444, IH = 1089;                         // размер исходного снимка
  var PERCH = [[671, 22], [190, 236]];              // верх креста купола и креста колокольни (в пикселях снимка)
  var GOLD_CENTER = [670, 300];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function start() {
    var masks = new Image(), wind = new Image(), n = 0;
    function done() { if (++n === 2) init(masks, wind); }
    masks.onload = wind.onload = done;
    wind.onerror = function () { wind = null; done(); };
    masks.src = 'assets/img/hero-life-masks.webp';
    wind.src = 'assets/img/hero-wind.webp';
  }

  function init(masks, windMap) {
    // каналы масок → отдельные альфа-маски
    var MW = masks.naturalWidth, MH = masks.naturalHeight;
    var mc = mk(MW, MH), mx = mc.getContext('2d');
    mx.drawImage(masks, 0, 0);
    var src = mx.getImageData(0, 0, MW, MH).data;
    var chan = [0, 1, 2].map(function (k) {
      var c = mk(MW, MH), x = c.getContext('2d'), d = x.createImageData(MW, MH);
      for (var i = 0; i < src.length; i += 4) { d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = src[i + k]; }
      x.putImageData(d, 0, 0); return c;
    });
    // точки листвы, откуда срываются листья (верхняя половина кадра)
    var leafSpots = [];
    for (var y = 0; y < MH * 0.6; y += 4) for (var x = 0; x < MW; x += 4) if (src[(y * MW + x) * 4 + 1] > 200) leafSpots.push([x / MW * IW, y / MH * IH]);

    var cv = document.createElement('canvas'); cv.className = 'hero__life'; cv.setAttribute('aria-hidden', 'true');
    var tint = document.createElement('div'); tint.className = 'hero__weather'; tint.setAttribute('aria-hidden', 'true');
    var gl = windMap ? makeWind(windMap) : null;
    if (gl) img.insertAdjacentElement('afterend', gl.canvas);
    fig.appendChild(tint); fig.appendChild(cv);
    var ctx = cv.getContext('2d');

    var W = 0, H = 0, S = 1, OX = 0, OY = 0;
    var sky, gold, tmp, tmp2;
    function P(ix, iy) { return [OX + ix * S, OY + iy * S]; }

    function layout() {
      var w = Math.round(fig.clientWidth), h = Math.round(fig.clientHeight);
      if (!w || !h || (w === W && h === H)) return;
      W = w; H = h; cv.width = W; cv.height = H;
      S = Math.max(W / IW, H / IH); OX = (W - IW * S) / 2; OY = 0;   // как object-fit: cover; object-position: 50% 0
      if (gl) gl.resize(W, H, S, OX, OY);
      sky = mk(W, H); sky.getContext('2d').drawImage(chan[0], OX, OY, IW * S, IH * S);
      gold = mk(W, H); gold.getContext('2d').drawImage(chan[2], OX, OY, IW * S, IH * S);
      tmp = mk(W, H); tmp2 = mk(W, H);
    }

    // облака: три разных формы из мягких «клубов» — плоское основание, пышный верх,
    // чуть затенённый низ, как у кучевых облаков на снимке
    var cloudSprites = [0, 1, 2].map(function (v) {
      var cw = 520, chh = 200, c = mk(cw, chh), x = c.getContext('2d');
      var base = 150, n = 7 + v * 2, puffs = [];
      for (var i = 0; i < n; i++) {
        var px = 70 + (cw - 140) * (i + rnd(-.3, .3)) / (n - 1);
        var mid = 1 - Math.abs(i / (n - 1) - .5) * 2;          // в середине облако выше
        var r = rnd(34, 52) + mid * rnd(18, 34);
        puffs.push([px, base - r * rnd(.55, .8), r]);
      }
      for (i = 0; i < 5; i++) puffs.push([rnd(90, cw - 90), base - rnd(10, 30), rnd(28, 40)]);
      // тень снизу
      puffs.forEach(function (p) {
        var g = x.createRadialGradient(p[0], p[1] + p[2] * .35, 0, p[0], p[1] + p[2] * .35, p[2] * 1.05);
        g.addColorStop(0, 'rgba(196,208,224,.55)'); g.addColorStop(1, 'rgba(196,208,224,0)');
        x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1] + p[2] * .35, p[2] * 1.05, 0, 7); x.fill();
      });
      // светлый объём сверху
      puffs.forEach(function (p) {
        var g = x.createRadialGradient(p[0] - p[2] * .2, p[1] - p[2] * .25, 0, p[0], p[1], p[2]);
        g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.6, 'rgba(255,253,248,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1], p[2], 0, 7); x.fill();
      });
      // мягко срезаем низ — основание ровное, как у кучевых облаков
      x.globalCompositeOperation = 'destination-in';
      var cut = x.createLinearGradient(0, base - 12, 0, base + 26);
      cut.addColorStop(0, 'rgba(0,0,0,1)'); cut.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = cut; x.fillRect(0, 0, cw, chh);
      return c;
    });
    var clouds = [];
    for (var i = 0; i < 6; i++) clouds.push(newCloud(rnd(-0.2, 1.1)));
    function newCloud(x) {
      // скорость — доля ширины кадра в секунду: облако пересекает небо за 2–4 минуты
      return { x: x, y: rnd(0.0, 0.26), k: rnd(0.45, 0.85), v: rnd(0.0042, 0.0075), a: rnd(0.45, 0.75), s: (Math.random() * 3) | 0 };
    }

    // ---------- состояние ----------
    var T = 0, last = 0, acc = 0;
    var gust = { on: false, t0: 0, dur: 0, amp: 0, next: DEMO ? 1 : rnd(2, 5) };
    var leaves = [], drops = [], motes = [];
    var bird = { st: 'off', next: DEMO ? 3 : rnd(10, 18) };
    var glint = { on: false, t0: 0, dur: 2.6, big: false, next: DEMO ? 6 : rnd(25, 45) };
    var wx = { st: 'clear', t0: 0, next: DEMO ? 9 : rnd(150, 260) };
    var W8 = 0, RAIN = 0, lastTint = -1;
    for (i = 0; i < 14; i++) motes.push({ x: Math.random(), y: rnd(0.15, 0.9), v: rnd(0.004, 0.012), p: rnd(0, 6), r: rnd(0.6, 1.4) });

    /* Ветер как в жизни: сила ветра плавно гуляет, а ветки — это пружины с инерцией.
       Они разгоняются с запаздыванием, чуть перелетают и успокаиваются.
       Ближняя ветка мягче и медленнее, дальние кроны жёстче и с меньшим размахом. */
    var WB = { x: 0, v: 0 }, WT = { x: 0, v: 0 }, WT2 = { x: 0, v: 0 }, flutter = 0, breeze = 0;
    function spring(o, f, hz, damp, dt) {
      var k = Math.pow(2 * Math.PI * hz, 2), c = 2 * damp * 2 * Math.PI * hz;
      o.v += (k * (f - o.x) - c * o.v) * dt; o.x += o.v * dt;
    }
    function noise1(t) { return Math.sin(t) * .5 + Math.sin(t * 2.31 + 1.7) * .3 + Math.sin(t * 4.13 + .4) * .2; }
    function stepWind(dt, g) {
      breeze = .14 + .1 * noise1(T * .21);                         // почти всегда есть лёгкое движение воздуха
      var f = breeze + g * (.75 + .25 * noise1(T * 1.9));          // порыв неровный
      for (var k = 0; k < 2; k++) {                                 // два подшага — устойчиво при любом fps
        spring(WB, f, .55, .22, dt / 2);
        spring(WT, f * .9, .8, .3, dt / 2);
        spring(WT2, f * .8 + .15 * noise1(T * .7 + 3), 1.15, .35, dt / 2);
      }
      flutter += (Math.min(1, breeze * .6 + g) - flutter) * Math.min(1, dt * 2);
      if (gl) gl.set(T, WB.x, WT.x, WT2.x, flutter);
    }

    function gustValue() {
      if (!gust.on) return 0;
      var p = (T - gust.t0) / gust.dur;
      if (p >= 1) { gust.on = false; gust.next = T + (DEMO ? rnd(1.5, 5) : rnd(3, 14)); return 0; }
      return gust.amp * Math.pow(Math.sin(Math.PI * p), 2);
    }

    function update(dt) {
      // порывы ветра: случайные, то тишина, то два подряд
      if (!gust.on && T > gust.next) { gust.on = true; gust.t0 = T; gust.dur = rnd(1.4, 4); gust.amp = rnd(0.35, 1) * (Math.random() < 0.2 ? 0.4 : 1); }
      var g = gustValue() + RAIN * 0.5;
      stepWind(dt, g);

      // погода: ясно → тучи → дождь → проясняется (с бликом)
      var e = T - wx.t0;
      if (wx.st === 'clear' && T > wx.next) { wx.st = 'cloud'; wx.t0 = T; }
      else if (wx.st === 'cloud') { W8 = ease(e / 12); if (e > 12) { wx.st = 'rain'; wx.t0 = T; } }
      else if (wx.st === 'rain') { W8 = 1; RAIN = e < 4 ? ease(e / 4) : e > 16 ? 1 - ease((e - 16) / 4) : 1; if (e > 20) { wx.st = 'clearing'; wx.t0 = T; RAIN = 0; } }
      else if (wx.st === 'clearing') { W8 = 1 - ease(e / 10); if (e > 7 && !glint.on) startGlint(true); if (e > 10) { wx.st = 'clear'; W8 = 0; wx.next = T + (DEMO ? 40 : rnd(180, 300)); } }

      // листья
      if (g > 0.25 && leafSpots.length && Math.random() < dt * (0.25 + g * 0.7)) {
        var sp = leafSpots[(Math.random() * leafSpots.length) | 0], q = P(sp[0], sp[1]);
        leaves.push({ x: q[0], y: q[1], vx: rnd(8, 26), vy: rnd(10, 22), a: rnd(0, 6), va: rnd(-3, 3), s: rnd(3.2, 5.5) * Math.max(S, 0.45) / 0.6, life: 0, c: ['#D9A531', '#C7841F', '#E4B84C', '#B8721C'][(Math.random() * 4) | 0] });
      }
      leaves = leaves.filter(function (l) {
        l.life += dt; l.a += l.va * dt;
        l.x += (l.vx + g * 30 + Math.sin(l.life * 2.4) * 14) * dt;
        l.y += (l.vy + Math.sin(l.life * 3.1 + l.a) * 6) * dt;
        return l.y < H + 20 && l.x < W + 20 && l.life < 14;
      });

      // дождь
      var want = Math.round(RAIN * Math.min(140, W * H / 3500));
      while (drops.length < want) drops.push({ x: rnd(-40, W), y: rnd(-H, 0), v: rnd(380, 560), l: rnd(9, 16) });
      if (drops.length > want) drops.length = want;
      drops.forEach(function (d) { d.y += d.v * dt; d.x += d.v * 0.18 * dt; if (d.y > H) { d.y = rnd(-60, -10); d.x = rnd(-40, W); } });

      // птица
      updateBird(dt);

      // небольшой блик время от времени
      if (!glint.on && T > glint.next && wx.st === 'clear') startGlint(false);
      if (glint.on && T - glint.t0 > glint.dur) { glint.on = false; glint.next = T + (DEMO ? rnd(8, 14) : rnd(40, 80)); }

      clouds.forEach(function (c, i) { c.x += c.v * dt * (1 + W8 * 0.8 + g * 0.4); if (c.x > 1.35) clouds[i] = newCloud(-0.4); });
      motes.forEach(function (m) { m.y -= m.v * dt * 0.6; m.x += Math.sin(T * 0.3 + m.p) * 0.0006; if (m.y < 0.1) { m.y = 0.9; m.x = Math.random(); } });
      return g;
    }

    function startGlint(big) { glint.on = true; glint.t0 = T; glint.big = big; glint.dur = big ? 3.2 : 2.4; }

    function updateBird(dt) {
      var b = bird;
      if (b.st === 'off') {
        if (T > b.next && wx.st === 'clear') {
          var p = PERCH[Math.random() < 0.65 ? 0 : 1];
          b.perch = p; b.st = 'in'; b.t0 = T; b.dur = rnd(3, 4.2);
          b.from = [W + 30, rnd(-10, H * 0.25)]; b.ctrl = [W * rnd(0.55, 0.85), rnd(-H * 0.1, H * 0.12)];
          b.stay = rnd(4, 9);
        }
        return;
      }
      var e = T - b.t0;
      if (b.st === 'in' && e > b.dur) { b.st = 'sit'; b.t0 = T; b.look = 1; b.nextLook = T + rnd(0.8, 2); }
      else if (b.st === 'sit') {
        if (T > b.nextLook) { b.look = -b.look; b.nextLook = T + rnd(0.8, 2.2); }
        if (e > b.stay || wx.st !== 'clear') { b.st = 'out'; b.t0 = T; b.dur = rnd(2.6, 3.6); b.to = [-30, rnd(-20, H * 0.15)]; b.ctrl = [W * rnd(0.15, 0.45), rnd(-H * 0.1, H * 0.1)]; }
      }
      else if (b.st === 'out' && e > b.dur) { b.st = 'off'; b.next = T + (DEMO ? rnd(6, 10) : rnd(60, 120)); }
    }

    function bez(a, c, b, t) { var u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; }

    function drawBird() {
      var b = bird; if (b.st === 'off') return;
      var sz = Math.max(5, 11 * S / 0.6), pos, flap = 0, flying = true, dir = -1;
      var perch = P(b.perch[0], b.perch[1]); perch = [perch[0], perch[1] - sz * 0.35];
      var e = T - b.t0;
      if (b.st === 'in') { var t = ease(e / b.dur); pos = bez(b.from, b.ctrl, perch, t); flap = Math.sin(T * (t > 0.85 ? 26 : 15)); }
      else if (b.st === 'sit') { pos = perch; flying = false; }
      else { t = Math.pow(clamp(e / b.dur, 0, 1), 1.4); pos = bez(perch, b.ctrl, b.to, t); flap = Math.sin(T * 17); }
      ctx.save(); ctx.translate(pos[0], pos[1]); ctx.fillStyle = 'rgba(38,36,34,.92)'; ctx.strokeStyle = 'rgba(38,36,34,.92)';
      if (flying) {
        ctx.scale(dir, 1);
        ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.42, sz * 0.16, 0, 0, 7); ctx.fill();
        ctx.lineWidth = Math.max(1, sz * 0.12); ctx.lineCap = 'round';
        var wy = -flap * sz * 0.55;
        ctx.beginPath(); ctx.moveTo(-sz * 0.05, 0); ctx.quadraticCurveTo(sz * 0.18, wy * 0.6 - sz * 0.1, sz * 0.5, wy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-sz * 0.05, 0); ctx.quadraticCurveTo(-sz * 0.25, wy * 0.6 - sz * 0.1, -sz * 0.55, wy); ctx.stroke();
        ctx.beginPath(); ctx.arc(-sz * 0.44, -sz * 0.04, sz * 0.12, 0, 7); ctx.fill();
      } else {
        ctx.scale(b.look, 1);
        ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.24, sz * 0.32, -0.25, 0, 7); ctx.fill();            // туловище
        ctx.beginPath(); ctx.arc(sz * 0.13, -sz * 0.34, sz * 0.15, 0, 7); ctx.fill();                  // голова
        ctx.beginPath(); ctx.moveTo(sz * 0.26, -sz * 0.36); ctx.lineTo(sz * 0.38, -sz * 0.32); ctx.lineTo(sz * 0.26, -sz * 0.29); ctx.fill(); // клюв
        ctx.beginPath(); ctx.moveTo(-sz * 0.12, sz * 0.18); ctx.lineTo(-sz * 0.42, sz * 0.42); ctx.lineTo(-sz * 0.2, sz * 0.3); ctx.fill();  // хвост
      }
      ctx.restore();
    }

    function draw(g) {
      ctx.clearRect(0, 0, W, H);
      var t2 = tmp.getContext('2d');

      // облака — только по небу
      t2.globalCompositeOperation = 'source-over'; t2.clearRect(0, 0, W, H);
      var grey = Math.round(255 - W8 * 85);
      clouds.forEach(function (c) {
        t2.globalAlpha = Math.min(1, c.a + W8 * 0.3);
        var cw = 520 * c.k * W / 860, ch = 200 * c.k * W / 860;
        t2.drawImage(cloudSprites[c.s], c.x * W - cw / 2, c.y * H, cw, ch);
      });
      t2.globalAlpha = 1;
      if (W8 > 0.02) { t2.globalCompositeOperation = 'source-atop'; t2.fillStyle = 'rgba(' + [grey - 10, grey - 2, grey + 6] + ',' + (W8 * 0.7) + ')'; t2.fillRect(0, 0, W, H); }
      t2.globalCompositeOperation = 'destination-in'; t2.drawImage(sky, 0, 0);
      ctx.drawImage(tmp, 0, 0);

      if (gl) gl.draw();

      // пылинки в солнечном свете
      if (W8 < 0.6) {
        ctx.fillStyle = 'rgba(255,244,214,' + (0.5 * (1 - W8)) + ')';
        motes.forEach(function (m) { var a = 0.5 + 0.5 * Math.sin(T * 0.9 + m.p); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(m.x * W, m.y * H, m.r, 0, 7); ctx.fill(); });
        ctx.globalAlpha = 1;
      }

      // блик по золоту купола и крестов
      if (glint.on) {
        var p = (T - glint.t0) / glint.dur, c0 = P(GOLD_CENTER[0], GOLD_CENTER[1]);
        var bx = c0[0] + (p * 2 - 1) * 260 * S;
        var t3 = tmp2.getContext('2d');
        t3.globalCompositeOperation = 'source-over'; t3.clearRect(0, 0, W, H);
        var gr = t3.createLinearGradient(bx - 70 * S, 0, bx + 70 * S, 0);
        gr.addColorStop(0, 'rgba(255,240,190,0)'); gr.addColorStop(0.5, 'rgba(255,246,214,1)'); gr.addColorStop(1, 'rgba(255,240,190,0)');
        t3.fillStyle = gr; t3.fillRect(0, 0, W, H);
        t3.globalCompositeOperation = 'destination-in'; t3.drawImage(gold, 0, 0);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.sin(Math.PI * p) * (glint.big ? 0.8 : 0.5);
        ctx.drawImage(tmp2, 0, 0);
        if (glint.big) {   // мягкий свет солнца после дождя
          var sg = ctx.createRadialGradient(W * 0.92, -H * 0.05, 0, W * 0.92, -H * 0.05, W * 0.75);
          sg.addColorStop(0, 'rgba(255,236,190,.55)'); sg.addColorStop(1, 'rgba(255,236,190,0)');
          ctx.globalAlpha = Math.sin(Math.PI * p) * 0.6; ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }

      // листья
      leaves.forEach(function (l) {
        ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.a); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(l.a * 1.7)));
        ctx.fillStyle = l.c; ctx.beginPath(); ctx.ellipse(0, 0, l.s, l.s * 0.55, 0, 0, 7); ctx.fill(); ctx.restore();
      });

      drawBird();

      // дождь
      if (drops.length) {
        ctx.strokeStyle = 'rgba(226,232,240,' + (0.32 * RAIN + 0.05) + ')'; ctx.lineWidth = 1; ctx.beginPath();
        drops.forEach(function (d) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * 0.18, d.y + d.l); });
        ctx.stroke();
      }

      // пасмурно: фото тускнеет (CSS-фильтр меняем только когда значение заметно сдвинулось)
      if (Math.abs(W8 - lastTint) > 0.01) {
        lastTint = W8;
        img.style.filter = W8 > 0.005 ? 'saturate(' + (1 - W8 * 0.4).toFixed(3) + ') brightness(' + (1 - W8 * 0.15).toFixed(3) + ')' : '';
        if (gl) gl.canvas.style.filter = img.style.filter;
        tint.style.opacity = (W8 * 0.28).toFixed(3);
      }
    }

    var visible = true, raf = 0;
    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) { last = 0; return; }
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;   // каждый кадр экрана — движение плавное
      T += dt;
      layout(); if (!W) return;
      draw(update(dt));
    }
    function wake() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; wake(); }).observe(fig);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('resize', function () { W = 0; });
    wake();
  }

  /* ---------- WebGL: плавный изгиб листвы ----------
     Снимок рисуется заново с маленьким смещением, которое плавно меняется по картинке.
     Карта hero-wind.png: R — кроны деревьев, G — ближняя размытая ветка; храм там чёрный
     и не двигается. Поле смещения шире самих листьев, поэтому край кроны изгибается
     вместе с небом за ним — без «призраков» и разрывов. */
  function makeWind(windMap) {
    var c = document.createElement('canvas'); c.className = 'hero__windgl'; c.setAttribute('aria-hidden', 'true');
    var g = c.getContext('webgl', { premultipliedAlpha: false, antialias: false, alpha: true });
    if (!g) return null;
    var VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;v.y=1.-v.y;gl_Position=vec4(p,0.,1.);}';
    var FS = [
      'precision mediump float;varying vec2 v;',
      'uniform sampler2D ph,wm;uniform vec2 sz,off,isz;uniform float t,wb,wt,wt2,fl;',
      'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
      ' return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
      'void main(){',
      ' vec2 px=v*sz;vec2 iu=(px-off)/isz;',               // координаты на снимке 0..1
      ' vec4 w=texture2D(wm,iu);',
      ' float aspect=isz.x/isz.y;',
      // ближняя ветка: поворот вокруг точки за левым верхним краем + лёгкий изгиб
      ' vec2 pv=vec2(-.12,-.25);vec2 r=(iu-pv)*vec2(aspect,1.);',
      ' float ang=wb*.022;vec2 rr=vec2(r.x*cos(ang)-r.y*sin(ang),r.x*sin(ang)+r.y*cos(ang));',
      ' vec2 dB=(rr-r)/vec2(aspect,1.);',
      // дальние кроны: качание у каждой кроны чуть своё (фаза по месту), верх кроны сильнее
      ' float phs=n(iu*vec2(3.,2.))*6.283;',
      ' float sway=mix(wt,wt2,.5+.5*sin(phs));',
      ' vec2 dT=vec2(sway*.0042,-abs(sway)*.0009);',
      // мелкая дрожь листьев поверх
      ' vec2 q=iu*vec2(26.,20.);',
      ' vec2 fx=vec2(n(q+vec2(t*1.7,t*.6))-.5,n(q+vec2(5.2-t*1.3,t*1.1))-.5)*fl*.0016;',
      ' vec2 d=dB*w.g+(dT+fx)*w.r+fx*w.g*.6;',
      ' gl_FragColor=texture2D(ph,iu-d);',
      '}'].join('');
    function sh(type, src) { var o = g.createShader(type); g.shaderSource(o, src); g.compileShader(o); return g.getShaderParameter(o, g.COMPILE_STATUS) ? o : null; }
    var vs = sh(g.VERTEX_SHADER, VS), fs = sh(g.FRAGMENT_SHADER, FS); if (!vs || !fs) return null;
    var pr = g.createProgram(); g.attachShader(pr, vs); g.attachShader(pr, fs); g.linkProgram(pr);
    if (!g.getProgramParameter(pr, g.LINK_STATUS)) return null;
    g.useProgram(pr);
    var buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
    var loc = g.getAttribLocation(pr, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    function tex(unit, el) {
      var tx = g.createTexture(); g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(g.TEXTURE_2D, tx);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, el);
    }
    tex(0, img); tex(1, windMap);
    var U = {}; ['ph', 'wm', 'sz', 'off', 'isz', 't', 'wb', 'wt', 'wt2', 'fl'].forEach(function (k) { U[k] = g.getUniformLocation(pr, k); });
    g.uniform1i(U.ph, 0); g.uniform1i(U.wm, 1);
    var dpr = Math.min(2, window.devicePixelRatio || 1), ready = false;
    return {
      canvas: c,
      resize: function (w, h, s, ox, oy) {
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); g.viewport(0, 0, c.width, c.height);
        g.uniform2f(U.sz, c.width, c.height); g.uniform2f(U.off, ox * dpr, oy * dpr); g.uniform2f(U.isz, IW * s * dpr, IH * s * dpr);
      },
      set: function (t, wb, wt, wt2, fl) { g.uniform1f(U.t, t); g.uniform1f(U.wb, wb); g.uniform1f(U.wt, wt); g.uniform1f(U.wt2, wt2); g.uniform1f(U.fl, fl); },
      draw: function () { g.drawArrays(g.TRIANGLE_STRIP, 0, 4); if (!ready) { ready = true; c.style.opacity = 1; } }
    };
  }

  function go() {
    if (img.complete && img.naturalWidth) start(); else img.addEventListener('load', start, { once: true });
  }
  if (document.readyState === 'complete') setTimeout(go, 300);
  else window.addEventListener('load', function () { setTimeout(go, 300); });
})();
