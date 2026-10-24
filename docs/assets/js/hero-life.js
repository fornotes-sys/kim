/* «Живая» картинка храма на первом экране — по временам года.

   Сезон выбирает маленький скрипт в <head> index.html (по дате по московскому времени
   или по ?season=…) и кладёт его в window.KIM_SEASON; картинка сезона грузится сразу,
   а этот скрипт стартует после загрузки страницы.

   Поверх фото — холст, на котором изредка и неравномерно что-то происходит. У каждого
   сезона свой характер (см. SEASONS ниже):
     ранняя осень — ветер в золотой листве, падают листья, птица садится на крест,
                    облака, блик на куполе, раз в несколько минут тучи → дождь → солнце;
     поздняя осень — чаще пасмурно, низкие серые облака, морось, последние листья
                    срываются редко, изредка короткий просвет солнца на куполе;
     зима          — мягкий снег в три слоя по глубине (то почти нет, то гуще),
                    снежная пыль с карнизов и веток, морозная дымка, низкое солнце;
     весна         — молодая листва, летят лепестки, птицы чаще, короткий дождь
                    и после него едва заметная радуга;
     лето          — тёплый лёгкий ветер, кучевые облака, свет и пылинки, редкий
                    короткий тёплый дождь.
   Маски неба, листвы и золота — в одном файле (каналы R, G, B, половинное разрешение):
   assets/img/hero-life-masks.webp для ранней осени и assets/img/seasons/<сезон>-masks.webp.
   Скрипт спит, когда первый экран не виден, и не анимирует ничего, если в системе
   включено «уменьшить движение» (переключатель сезонов при этом работает).
   ?life=demo в адресе — всё происходит чаще (для показа). */
(function () {
  'use strict';
  var fig = document.querySelector('.hero__slide');
  var img = fig && fig.querySelector('img');
  if (!img) return;

  var ORDER = ['winter', 'spring', 'summer', 'early-autumn', 'late-autumn'];
  var NAMES = { 'winter': 'Зима', 'spring': 'Весна', 'summer': 'Лето', 'early-autumn': 'Ранняя осень', 'late-autumn': 'Поздняя осень' };
  function photo(s) { return s === 'early-autumn' ? 'assets/img/hero.webp' : 'assets/img/seasons/' + s + '.webp'; }
  function maskSrc(s) { return s === 'early-autumn' ? 'assets/img/hero-life-masks.webp' : 'assets/img/seasons/' + s + '-masks.webp'; }
  var season = (window.KIM_SEASON && window.KIM_SEASON.name) || 'early-autumn';
  if (ORDER.indexOf(season) < 0) season = 'early-autumn';
  if (!img.getAttribute('src')) img.src = photo(season);      // на случай, если скрипт в <head> не сработал

  var DEMO = /[?&]life=demo\b/.test(location.search);
  var STILL = !window.requestAnimationFrame || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var IW = 1444, IH = 1089;                         // размер исходного снимка
  var PERCH = [[671, 22], [190, 236]];              // верх креста купола и креста колокольни (в пикселях снимка)
  var GOLD_CENTER = [670, 300];
  // где на снимке цветут деревья (весна) — оттуда летят лепестки
  var BLOSSOM = [[0, 380, 125, 940], [960, 300, 1220, 590], [0, 0, 520, 290]];
  // откуда зимой срывается снежная пыль: карнизы и скаты кровель
  var EAVES = [[330, 646, 650, 662], [615, 636, 860, 640], [860, 640, 1040, 637], [190, 340, 360, 378], [350, 508, 610, 474]];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function r2(a) { return DEMO ? rnd(a[0] / 6, a[1] / 6) : rnd(a[0], a[1]); }

  /* ---------- характер сезонов ----------
     wind   — сила ветра (1 — как ранней осенью); gust — пауза между порывами, с;
     leaves — цвета падающих листьев (null — не падают), leafRate — как часто;
     petals — лепестки (весна); snow — снег (зима);
     clouds — облака: n, высота (доля кадра), масштаб, прозрачность, оттенок;
     wx     — погода: через сколько первая смена, как часто, дождь/морось, что после;
     bird   — как часто прилетает птица; glint — как часто блик на куполе;
     motes  — пылинки в солнечном свете; light — тёплый свет от солнца справа. */
  var SEASONS = {
    'early-autumn': {
      wind: 1, gust: [3, 14], leaves: ['#D9A531', '#C7841F', '#E4B84C', '#B8721C'], leafRate: 1,
      clouds: { n: 6, y: [0, 0.26], k: [0.45, 0.85], a: [0.45, 0.75], tint: null },
      wx: { first: [150, 260], every: [180, 300], rain: 'rain', rainDur: 20, after: 'glint' },
      sunbreak: [35, 60],
      bird: [20, 40], glint: [20, 35], motes: 14, light: 0
    },
    'late-autumn': {
      wind: 0.9, gust: [4, 16], leaves: ['#8E6B3C', '#7A5A33', '#A07C4A', '#6C5233', '#93743F'], leafRate: 0.3,
      clouds: { n: 7, y: [-0.04, 0.3], k: [0.8, 1.35], a: [0.3, 0.5], tint: [112, 118, 127, 0.6] },
      wx: { first: [35, 80], every: [90, 170], rain: 'drizzle', rainDur: [28, 50], after: null, overcast: 0.5 },
      sunbreak: [30, 55],
      bird: [35, 60], glint: null, motes: 0, light: 0
    },
    'winter': {
      wind: 0.22, gust: [6, 20], leaves: null, leafRate: 0,
      clouds: { n: 4, y: [0, 0.2], k: [0.6, 1.0], a: [0.22, 0.38], tint: [226, 231, 239, 0.35] },
      wx: null, snow: true, sunbreak: [30, 55],
      bird: [40, 70], glint: null, motes: 0, light: 0
    },
    'spring': {
      wind: 0.85, gust: [3, 12], leaves: null, petals: true, leafRate: 0,
      clouds: { n: 5, y: [0, 0.24], k: [0.45, 0.85], a: [0.45, 0.75], tint: null },
      wx: { first: [120, 220], every: [180, 300], rain: 'rain', rainDur: 14, after: 'rainbow' },
      sunbreak: [45, 80],
      bird: [15, 30], glint: [25, 45], motes: 6, light: 0
    },
    'summer': {
      wind: 0.7, gust: [4, 15], leaves: null, leafRate: 0,
      clouds: { n: 5, y: [-0.02, 0.2], k: [0.55, 1.0], a: [0.55, 0.85], tint: null },
      wx: { first: [200, 320], every: [240, 400], rain: 'rain', rainDur: 12, after: 'glint' },
      sunbreak: [35, 60],
      bird: [20, 40], glint: [20, 35], motes: 18, light: 1
    }
  };

  /* ---------- переключатель сезонов (кружки в углу картинки) ---------- */
  var life = null, switching = false;
  var bar = document.querySelector('[data-seasons]');
  function mark(s) {
    if (!bar) return;
    [].forEach.call(bar.querySelectorAll('[data-season-btn]'), function (b) {
      var on = b.getAttribute('data-season-btn') === s;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  mark(season);
  if (bar) bar.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-season-btn]');
    if (b) setSeason(b.getAttribute('data-season-btn'));
  });

  function loadImg(src, cb) {
    var i = new Image(); i.decoding = 'async';
    i.onload = function () { (i.decode ? i.decode() : Promise.resolve()).then(function () { cb(i); }, function () { cb(i); }); };
    i.onerror = function () { cb(null); };
    i.src = src;
  }

  function setSeason(s) {
    if (ORDER.indexOf(s) < 0 || s === season || switching) return;
    switching = true; mark(s);
    var n = 0, ph, mk_;
    function done() {
      if (++n < 2) return;
      if (!ph) { switching = false; mark(season); return; }
      // новое фото плавно проявляется поверх старого
      var next = ph; next.className = 'hero__img-next'; next.alt = (window.KIM_ALT && KIM_ALT[s]) || img.alt;
      next.width = IW; next.height = IH; next.setAttribute('fetchpriority', 'high');
      if (life) life.hold();
      img.insertAdjacentElement('afterend', next);
      requestAnimationFrame(function () { requestAnimationFrame(function () { next.style.opacity = 1; }); });
      setTimeout(function () {
        img.parentNode.removeChild(img);
        next.className = ''; next.style.opacity = '';
        img = next; season = s;
        if (window.KIM_SEASON) window.KIM_SEASON.name = s;
        document.documentElement.setAttribute('data-season', s);
        var glow = document.querySelector('.hero__glow');
        if (glow) glow.style.backgroundImage = 'url("' + new URL(photo(s), document.baseURI).href + '")';
        if (life) life.swap(img, mk_, s);
        switching = false;
      }, 3100);
    }
    loadImg(photo(s), function (i) { ph = i; done(); });
    if (life) loadImg(maskSrc(s), function (i) { mk_ = i; done(); }); else done();
  }
  window.KimHero = { setSeason: setSeason, season: function () { return season; } };

  /* ---------- сезоны сменяют друг друга сами ----------
     Начинаем с сезона по дате, дальше по кругу: каждый держится ~50 с и плавно
     перетекает в следующий. Пока первый экран не виден или вкладка скрыта — пауза. */
  var CYCLE = DEMO ? 15 : 50, shown = 0, onScreen = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; }).observe(fig);
  if (!STILL) setInterval(function () {
    if (!onScreen || document.hidden || switching) return;
    if (++shown < CYCLE) return;
    shown = 0;
    setSeason(ORDER[(ORDER.indexOf(season) + 1) % ORDER.length]);
  }, 1000);

  if (STILL) return;

  function start() {
    var masks = new Image(), wind = new Image(), n = 0;
    function done() { if (++n === 2) life = init(masks, wind); }
    masks.onload = wind.onload = done;
    wind.onerror = function () { wind = null; done(); };
    masks.onerror = function () { masks = null; done(); };
    masks.src = maskSrc(season);
    wind.src = 'assets/img/hero-wind.webp';
  }

  function init(masks, windMap) {
    if (!masks) return null;
    var C = SEASONS[season];
    var chan, src, MW, MH, leafSpots, petalSpots, crownTops;

    // каналы масок → отдельные альфа-маски, точки листвы
    function readMasks(m) {
      MW = m.naturalWidth; MH = m.naturalHeight;
      var mc = mk(MW, MH), mx = mc.getContext('2d');
      mx.drawImage(m, 0, 0);
      src = mx.getImageData(0, 0, MW, MH).data;
      chan = [0, 1, 2].map(function (k) {
        var c = mk(MW, MH), x = c.getContext('2d'), d = x.createImageData(MW, MH);
        for (var i = 0; i < src.length; i += 4) { d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = src[i + k]; }
        x.putImageData(d, 0, 0); return c;
      });
      leafSpots = []; petalSpots = []; crownTops = [];
      for (var y = 0; y < MH * 0.6; y += 4) for (var x = 0; x < MW; x += 4) {
        if (src[(y * MW + x) * 4 + 1] <= 200) continue;
        var ix = x / MW * IW, iy = y / MH * IH;
        leafSpots.push([ix, iy]);
        if (BLOSSOM.some(function (b) { return ix > b[0] && ix < b[2] && iy > b[1] && iy < b[3]; })) petalSpots.push([ix, iy]);
        // верх кроны: над точкой — небо
        if (y > 8 && src[((y - 8) * MW + x) * 4] > 160 && iy > 280) crownTops.push([ix, iy]);
      }
    }
    readMasks(masks);

    var cv = document.createElement('canvas'); cv.className = 'hero__life'; cv.setAttribute('aria-hidden', 'true');
    var tint = document.createElement('div'); tint.className = 'hero__weather'; tint.setAttribute('aria-hidden', 'true');
    var gl = windMap ? makeWind(windMap, img) : null;
    if (gl) img.insertAdjacentElement('afterend', gl.canvas);
    fig.appendChild(tint); fig.appendChild(cv);
    var ctx = cv.getContext('2d');

    var W = 0, H = 0, S = 1, OX = 0, OY = 0, K = 1;
    var sky, gold, tmp, tmp2;
    function P(ix, iy) { return [OX + ix * S, OY + iy * S]; }

    function layout(force) {
      var w = Math.round(fig.clientWidth), h = Math.round(fig.clientHeight);
      if (!w || !h || (!force && w === W && h === H)) return;
      W = w; H = h; cv.width = W; cv.height = H;
      S = Math.max(W / IW, H / IH); OX = (W - IW * S) / 2; OY = 0;   // как object-fit: cover; object-position: 50% 0
      K = clamp(W / 860, 0.45, 1.5);                                  // масштаб частиц
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
      puffs.forEach(function (p) {          // тень снизу
        var g = x.createRadialGradient(p[0], p[1] + p[2] * .35, 0, p[0], p[1] + p[2] * .35, p[2] * 1.05);
        g.addColorStop(0, 'rgba(196,208,224,.55)'); g.addColorStop(1, 'rgba(196,208,224,0)');
        x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1] + p[2] * .35, p[2] * 1.05, 0, 7); x.fill();
      });
      puffs.forEach(function (p) {          // светлый объём сверху
        var g = x.createRadialGradient(p[0] - p[2] * .2, p[1] - p[2] * .25, 0, p[0], p[1], p[2]);
        g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.6, 'rgba(255,253,248,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1], p[2], 0, 7); x.fill();
      });
      x.globalCompositeOperation = 'destination-in';   // мягко срезаем низ — основание ровное
      var cut = x.createLinearGradient(0, base - 12, 0, base + 26);
      cut.addColorStop(0, 'rgba(0,0,0,1)'); cut.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = cut; x.fillRect(0, 0, cw, chh);
      return c;
    });
    // мягкая снежинка (ближние, крупные хлопья — чуть размыты, как не в фокусе)
    var flake = (function () {
      var c = mk(32, 32), x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.45, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 32, 32); return c;
    })();

    function newCloud(x) {
      var c = C.clouds;
      // скорость — доля ширины кадра в секунду: облако пересекает небо за 2–4 минуты
      return { x: x, y: rnd(c.y[0], c.y[1]), k: rnd(c.k[0], c.k[1]), v: rnd(0.0042, 0.0075) * (c.tint && c.tint[3] > 0.5 ? 0.8 : 1), a: rnd(c.a[0], c.a[1]), s: (Math.random() * 3) | 0 };
    }

    // ---------- состояние ----------
    var T = 0, last = 0, held = false;
    var gust, leaves, drops, motes, flakes, dust, bird, glint, wx, sunb, bow, clouds;
    var W8 = 0, RAIN = 0, lastTint = -1, snowI = 0.5, snowPhase = rnd(0, 100), puffNext = 0;

    function reset() {
      C = SEASONS[season];
      gust = { on: false, t0: 0, dur: 0, amp: 0, next: T + (DEMO ? 1 : rnd(2, 5)) };
      leaves = []; drops = []; motes = []; flakes = []; dust = [];
      bird = { st: 'off', next: T + (C.bird ? (DEMO ? 3 : rnd(C.bird[0] * 0.3, C.bird[0])) : 1e9) };
      glint = { on: false, t0: 0, dur: 2.6, big: false, warm: 0, next: T + (C.glint ? (DEMO ? 6 : rnd(8, 20)) : 1e9) };
      wx = { st: 'clear', t0: 0, next: T + (C.wx ? (DEMO ? rnd(2, 4) : r2(C.wx.first)) : 1e9) };
      sunb = { on: false, t0: 0, dur: 12, next: T + (C.sunbreak ? (DEMO ? 8 : rnd(C.sunbreak[0] * 0.5, C.sunbreak[1] * 0.6)) : 1e9) };
      bow = { on: false, t0: 0, dur: 16 };
      W8 = 0; RAIN = 0; lastTint = -1;
      clouds = [];
      for (var i = 0; i < C.clouds.n; i++) clouds.push(newCloud(rnd(-0.2, 1.1)));
      for (i = 0; i < C.motes; i++) motes.push({ x: Math.random(), y: rnd(0.15, 0.9), v: rnd(0.004, 0.012), p: rnd(0, 6), r: rnd(0.6, 1.4) });
      if (C.snow) {
        // три слоя по глубине: дальние мелкие и медленные, ближние крупные, мягкие и быстрые
        var LAY = [[220, 0.8, 1.5, 14, 24, 0.6], [110, 1.5, 2.6, 26, 40, 0.8], [24, 3.4, 5.8, 44, 66, 0.9]];
        LAY.forEach(function (L, z) {
          for (var j = 0; j < L[0]; j++) flakes.push({ z: z, i: j / L[0], x: Math.random(), y: Math.random(), r: rnd(L[1], L[2]), v: rnd(L[3], L[4]), a: L[5] * rnd(0.7, 1), p: rnd(0, 6.3), f: rnd(0.4, 1.1), sw: rnd(4, 12) * (z + 1) / 2, on: false });
        });
        puffNext = T + (DEMO ? 2 : rnd(8, 20));
      }
      img.style.filter = ''; if (gl) gl.canvas.style.filter = ''; tint.style.opacity = 0;
    }

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
      var f = (breeze + g * (.75 + .25 * noise1(T * 1.9))) * C.wind;  // порыв неровный
      for (var k = 0; k < 2; k++) {                                 // два подшага — устойчиво при любом fps
        spring(WB, f, .55, .22, dt / 2);
        spring(WT, f * .9, .8, .3, dt / 2);
        spring(WT2, f * .8 + .15 * C.wind * noise1(T * .7 + 3), 1.15, .35, dt / 2);
      }
      flutter += (Math.min(1, (breeze * .6 + g) * C.wind) - flutter) * Math.min(1, dt * 2);
      if (gl) gl.set(T, WB.x, WT.x, WT2.x, flutter);
    }

    function gustValue() {
      if (!gust.on) return 0;
      var p = (T - gust.t0) / gust.dur;
      if (p >= 1) { gust.on = false; gust.next = T + (DEMO ? rnd(1.5, 5) : rnd(C.gust[0], C.gust[1])); return 0; }
      return gust.amp * Math.pow(Math.sin(Math.PI * p), 2);
    }

    function clearSky() { return wx.st === 'clear' && RAIN < 0.05; }

    function stepWeather() {
      var e = T - wx.t0, X = C.wx;
      if (!X) return;
      var top = X.overcast || 1;                                   // поздней осенью тучи — не сплошная тьма
      if (wx.st === 'clear' && T > wx.next && !sunb.on) { wx.st = 'cloud'; wx.t0 = T; wx.dur = typeof X.rainDur === 'number' ? X.rainDur : rnd(X.rainDur[0], X.rainDur[1]); }
      else if (wx.st === 'cloud') { var ci = DEMO ? 5 : 12; W8 = top * ease(e / ci); if (e > ci) { wx.st = 'rain'; wx.t0 = T; } }
      else if (wx.st === 'rain') {
        var d = wx.dur; W8 = top;
        RAIN = e < 4 ? ease(e / 4) : e > d - 4 ? 1 - ease((e - d + 4) / 4) : 1;
        if (X.rain === 'drizzle') RAIN *= 0.75 + 0.25 * noise1(T * 0.13);   // морось то гуще, то реже
        if (e > d) { wx.st = 'clearing'; wx.t0 = T; RAIN = 0; }
      }
      else if (wx.st === 'clearing') {
        W8 = top * (1 - ease(e / 10));
        if (X.after === 'glint' && e > 7 && !glint.on) startGlint(true);
        if (X.after === 'rainbow' && e > 5 && !bow.on) { bow.on = true; bow.t0 = T; }
        if (e > 10) { wx.st = 'clear'; W8 = 0; wx.next = T + r2(X.every); }
      }
    }

    function update(dt) {
      // порывы ветра: случайные, то тишина, то два подряд
      if (!gust.on && T > gust.next) { gust.on = true; gust.t0 = T; gust.dur = rnd(1.4, 4); gust.amp = rnd(0.35, 1) * (Math.random() < 0.2 ? 0.4 : 1); }
      var g = gustValue() + RAIN * (C.wx && C.wx.rain === 'drizzle' ? 0.2 : 0.5);
      stepWind(dt, g);
      stepWeather();

      // короткий просвет солнца (поздняя осень, зима): тёплый свет и блик по куполу
      if (!sunb.on && T > sunb.next && clearSky() && (!C.snow || snowI < 0.45)) { sunb.on = true; sunb.t0 = T; sunb.dur = rnd(10, 15); }
      if (sunb.on) {
        var se = T - sunb.t0;
        if (se > sunb.dur * 0.35 && !glint.on) startGlint(true, true);
        if (se > sunb.dur) { sunb.on = false; sunb.next = T + r2(C.sunbreak); }
      }

      // листья (ранняя осень — часто, поздняя — редко и только на порывах)
      if (C.leaves && leafSpots.length) {
        var thr = C.leafRate < 1 ? 0.45 : 0.25;
        if (g > thr && Math.random() < dt * (0.25 + g * 0.7) * C.leafRate) {
          var sp = pick(leafSpots), q = P(sp[0], sp[1]);
          leaves.push({ x: q[0], y: q[1], vx: rnd(8, 26), vy: rnd(10, 22), a: rnd(0, 6), va: rnd(-3, 3), s: rnd(3.2, 5.5) * Math.max(S, 0.45) / 0.6, life: 0, c: pick(C.leaves) });
        }
      }
      // лепестки (весна): лёгкие, долго кружат, летят больше вбок
      if (C.petals && petalSpots.length && Math.random() < dt * (0.12 + g * 1.1)) {
        var n2 = g > 0.5 ? 3 : 1;
        for (var k2 = 0; k2 < n2; k2++) {
          var ps = pick(petalSpots), pq = P(ps[0] + rnd(-6, 6), ps[1] + rnd(-6, 6));
          leaves.push({ petal: true, x: pq[0], y: pq[1], vx: rnd(10, 30), vy: rnd(5, 12), a: rnd(0, 6), va: rnd(-4, 4), fl: rnd(0, 6), s: rnd(1.8, 3.1) * K, life: 0, c: pick(['#FBEFF1', '#F6DDE3', '#FFF7F5', '#F2D3DB']) });
        }
      }
      leaves = leaves.filter(function (l) {
        l.life += dt; l.a += l.va * dt;
        if (l.petal) {
          l.fl += dt * 5;
          l.x += (l.vx + g * 45 + Math.sin(l.life * 1.7 + l.a) * 18) * dt;
          l.y += (l.vy + Math.sin(l.life * 2.6) * 9) * dt;
        } else {
          l.x += (l.vx + g * 30 + Math.sin(l.life * 2.4) * 14) * dt;
          l.y += (l.vy + Math.sin(l.life * 3.1 + l.a) * 6) * dt;
        }
        return l.y < H + 20 && l.x < W + 20 && l.life < 16;
      });

      // дождь и морось
      var drizzle = C.wx && C.wx.rain === 'drizzle';
      var want = Math.round(RAIN * Math.min(drizzle ? 260 : 140, W * H / (drizzle ? 1800 : 3500)));
      while (drops.length < want) drops.push({ x: rnd(-40, W), y: rnd(-H, 0), v: drizzle ? rnd(240, 340) : rnd(380, 560), l: drizzle ? rnd(5, 9) : rnd(9, 16), a: drizzle ? rnd(0.5, 1) : 1 });
      if (drops.length > want) drops.length = want;
      drops.forEach(function (d) { d.y += d.v * dt; d.x += d.v * (drizzle ? 0.1 : 0.18) * dt; if (d.y > H) { d.y = rnd(-60, -10); d.x = rnd(-40, W); } });

      // снег: плотность медленно гуляет — то почти нет, то гуще
      if (C.snow) {
        var sp2 = DEMO ? 0.05 : 0.012;
        var s = 0.5 + 0.32 * Math.sin(T * sp2 + snowPhase) + 0.2 * Math.sin(T * sp2 * 2.7 + 1.3) + 0.12 * Math.sin(T * sp2 * 6.1 + 4);
        snowI = clamp((s - 0.12) / 0.9, 0.04, 1);
        var drift = 5 + g * 30 + 4 * noise1(T * 0.17);
        flakes.forEach(function (f) {
          if (!f.on) { if (f.i < snowI) { f.on = true; f.y = -0.03 - Math.random() * 0.05; f.x = rnd(-0.05, 1.0); } else return; }
          var dpx = (f.z + 1) / 3;
          f.y += f.v * K * dt / H;
          f.x += ((Math.sin(T * f.f + f.p) * f.sw) + drift * dpx) * K * dt / W;
          if (f.y > 1.03 || f.x > 1.05) f.on = f.i < snowI ? (f.y = -0.03, f.x = rnd(-0.1, 0.95), true) : false;
        });
        // снежная пыль: с карниза или верха кроны срывается горсть снега
        if (T > puffNext) {
          puffNext = T + (DEMO ? rnd(2, 5) : rnd(9, 26) * (g > 0.4 ? 0.5 : 1));
          var src2 = Math.random() < 0.55 || !crownTops.length ? (function () { var e = pick(EAVES), t = Math.random(); return [e[0] + (e[2] - e[0]) * t, e[1] + (e[3] - e[1]) * t]; })() : pick(crownTops);
          var c0 = P(src2[0], src2[1]), cnt = (rnd(18, 34) * K) | 0;
          for (var j = 0; j < cnt; j++) dust.push({ x: c0[0] + rnd(-10, 10) * K, y: c0[1] + rnd(-2, 3) * K, vx: rnd(-6, 10) * K + drift * 0.6, vy: rnd(2, 14) * K, r: rnd(0.5, 1.5) * K, life: 0, max: rnd(2.2, 4) });
        }
        dust = dust.filter(function (d) {
          d.life += dt; d.vy += 18 * K * dt; d.vx *= (1 - dt * 0.6); d.vy = Math.min(d.vy, 34 * K);
          d.x += (d.vx + drift * 0.5 * K) * dt; d.y += d.vy * dt;
          return d.life < d.max;
        });
      }

      updateBird(dt);

      // небольшой блик время от времени
      if (C.glint && !glint.on && T > glint.next && clearSky()) startGlint(false);
      if (glint.on && T - glint.t0 > glint.dur) { glint.on = false; glint.next = T + (C.glint ? (DEMO ? rnd(8, 14) : rnd(C.glint[0], C.glint[1])) : 1e9); }
      if (bow.on && T - bow.t0 > bow.dur) bow.on = false;

      clouds.forEach(function (c, i) { c.x += c.v * dt * (1 + W8 * 0.8 + g * 0.4); if (c.x > 1.35) clouds[i] = newCloud(-0.4); });
      motes.forEach(function (m) { m.y -= m.v * dt * 0.6; m.x += Math.sin(T * 0.3 + m.p) * 0.0006; if (m.y < 0.1) { m.y = 0.9; m.x = Math.random(); } });
      return g;
    }

    function startGlint(big, warm) { glint.on = true; glint.t0 = T; glint.big = big; glint.warm = warm ? 1 : 0; glint.dur = big ? (warm ? 4.2 : 3.2) : 2.4; }

    function updateBird(dt) {
      var b = bird;
      if (b.st === 'off') {
        if (T > b.next && clearSky() && (!C.snow || snowI < 0.5)) {
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
        if (e > b.stay || !clearSky()) { b.st = 'out'; b.t0 = T; b.dur = rnd(2.6, 3.6); b.to = [-30, rnd(-20, H * 0.15)]; b.ctrl = [W * rnd(0.15, 0.45), rnd(-H * 0.1, H * 0.1)]; }
      }
      else if (b.st === 'out' && e > b.dur) { b.st = 'off'; b.next = T + (DEMO ? rnd(6, 10) : rnd(C.bird[0], C.bird[1])); }
    }

    /* Лучи солнца сквозь воздух во время просвета: несколько мягких полос сверху справа. */
    function rays(a) {
      if (a < 0.01) return;
      var ox = W * 0.97, oy = -H * 0.12, L = Math.hypot(W, H) * 1.1;
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      [[2.32, 0.035, 1], [2.45, 0.05, 0.8], [2.6, 0.03, 0.9], [2.75, 0.045, 0.6]].forEach(function (r, i) {
        var ang = r[0] + 0.02 * Math.sin(T * 0.15 + i * 1.7), w = r[1];
        var g = ctx.createLinearGradient(ox, oy, ox + Math.cos(ang) * L, oy + Math.sin(ang) * L);
        g.addColorStop(0, 'rgba(255,236,190,0)'); g.addColorStop(0.18, 'rgba(255,236,190,' + (0.32 * r[2] * a).toFixed(3) + ')'); g.addColorStop(0.75, 'rgba(255,236,190,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(ang - w) * L, oy + Math.sin(ang - w) * L); ctx.lineTo(ox + Math.cos(ang + w) * L, oy + Math.sin(ang + w) * L); ctx.closePath(); ctx.fill();
      });
      ctx.restore();
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

    // мягкий свет солнца справа сверху (как на снимке): тёплый, через «экран»
    function sunLight(a, warm) {
      if (a < 0.005) return;
      var sg = ctx.createRadialGradient(W * 0.94, -H * 0.06, 0, W * 0.94, -H * 0.06, W * 0.8);
      var c = warm ? '255,226,170' : '255,238,200';
      sg.addColorStop(0, 'rgba(' + c + ',.6)'); sg.addColorStop(1, 'rgba(' + c + ',0)');
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = a; ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    function draw(g) {
      ctx.clearRect(0, 0, W, H);
      var t2 = tmp.getContext('2d');

      // облака — только по небу
      t2.globalCompositeOperation = 'source-over'; t2.clearRect(0, 0, W, H);
      var grey = Math.round(255 - W8 * 85), ct = C.clouds.tint;
      clouds.forEach(function (c) {
        t2.globalAlpha = Math.min(1, c.a + W8 * 0.3);
        var cw = 520 * c.k * W / 860, ch = 200 * c.k * W / 860;
        t2.drawImage(cloudSprites[c.s], c.x * W - cw / 2, c.y * H, cw, ch);
      });
      t2.globalAlpha = 1; t2.globalCompositeOperation = 'source-atop';
      if (ct) { t2.fillStyle = 'rgba(' + ct.slice(0, 3) + ',' + ct[3] + ')'; t2.fillRect(0, 0, W, H); }
      if (W8 > 0.02) { t2.fillStyle = 'rgba(' + [grey - 10, grey - 2, grey + 6] + ',' + (W8 * 0.7) + ')'; t2.fillRect(0, 0, W, H); }
      t2.globalCompositeOperation = 'destination-in'; t2.drawImage(sky, 0, 0);
      ctx.drawImage(tmp, 0, 0);

      if (gl) gl.draw();

      // радуга после весеннего дождя: едва заметная дуга, только по небу
      if (bow.on) {
        var bp = (T - bow.t0) / bow.dur, ba = Math.pow(Math.sin(Math.PI * clamp(bp, 0, 1)), 1.5) * 0.2;
        t2.globalCompositeOperation = 'source-over'; t2.clearRect(0, 0, W, H);
        var cx = W * 1.02, cy = H * 1.15, R = H * 1.02, bw = H * 0.075;
        var rg = t2.createRadialGradient(cx, cy, R - bw, cx, cy, R + bw);
        [['148,110,190', 0], ['148,110,190', .12], ['90,140,220', .28], ['110,190,140', .45], ['245,225,120', .6], ['245,160,90', .75], ['225,100,90', .88], ['225,100,90', 1]].forEach(function (s, i, arr) {
          var edge = (i === 0 || i === arr.length - 1) ? 0 : 1;
          rg.addColorStop(s[1], 'rgba(' + s[0] + ',' + edge + ')');
        });
        t2.fillStyle = rg; t2.fillRect(0, 0, W, H);
        // к земле дуга растворяется
        t2.globalCompositeOperation = 'destination-in';
        var fade = t2.createLinearGradient(0, H * 0.05, 0, H * 0.7);
        fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.35, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0.2)');
        t2.fillStyle = fade; t2.fillRect(0, 0, W, H);
        t2.drawImage(sky, 0, 0);
        ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = ba; ctx.drawImage(tmp, 0, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }

      // свет: летом тёплый свет медленно «дышит»; просвет солнца поздней осенью и зимой
      if (C.light) sunLight((0.12 + 0.07 * noise1(T * 0.09)) * (1 - W8), false);
      if (sunb.on) { var sp = (T - sunb.t0) / sunb.dur; var sa = Math.pow(Math.sin(Math.PI * clamp(sp, 0, 1)), 1.3); sunLight(sa * (C.snow ? 0.5 : 0.42), true); rays(sa); }

      // пылинки в солнечном свете
      if (motes.length && W8 < 0.6) {
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
        var gc = glint.warm ? '255,226,160' : '255,240,190', gm = glint.warm ? '255,236,190' : '255,246,214';
        gr.addColorStop(0, 'rgba(' + gc + ',0)'); gr.addColorStop(0.5, 'rgba(' + gm + ',1)'); gr.addColorStop(1, 'rgba(' + gc + ',0)');
        t3.fillStyle = gr; t3.fillRect(0, 0, W, H);
        t3.globalCompositeOperation = 'destination-in'; t3.drawImage(gold, 0, 0);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.sin(Math.PI * p) * (glint.big ? 0.8 : 0.5);
        ctx.drawImage(tmp2, 0, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        if (glint.big && !glint.warm) sunLight(Math.sin(Math.PI * p) * 0.6, false);   // мягкий свет солнца после дождя
      }

      // листья и лепестки
      leaves.forEach(function (l) {
        ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.a);
        if (l.petal) {
          ctx.scale(1, 0.25 + 0.75 * Math.abs(Math.sin(l.fl)));
          ctx.globalAlpha = Math.min(1, l.life * 2) * 0.95;
          ctx.fillStyle = l.c; ctx.beginPath(); ctx.ellipse(0, 0, l.s, l.s * 0.72, 0, 0, 7); ctx.fill();
        } else {
          ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(l.a * 1.7)));
          ctx.fillStyle = l.c; ctx.beginPath(); ctx.ellipse(0, 0, l.s, l.s * 0.55, 0, 0, 7); ctx.fill();
        }
        ctx.restore();
      });

      drawBird();

      // снег: дальние слои — точки, ближние хлопья — мягкие пятна
      if (C.snow) {
        flakes.forEach(function (f) {
          if (!f.on) return;
          var x = f.x * W, y = f.y * H, r = f.r * K;
          if (f.z < 2) { ctx.globalAlpha = f.a; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
          else { ctx.globalAlpha = f.a; ctx.drawImage(flake, x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2); }
        });
        ctx.fillStyle = '#fff';
        dust.forEach(function (d) {
          var a = Math.min(1, d.life * 4) * (1 - d.life / d.max);
          ctx.globalAlpha = a * 0.85; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
        });
        ctx.globalAlpha = 1;
        // морозная дымка у земли, едва дышит
        var hz = 0.11 + 0.05 * noise1(T * 0.05);
        var hg = ctx.createLinearGradient(0, H * 0.62, 0, H);
        hg.addColorStop(0, 'rgba(236,241,248,0)'); hg.addColorStop(1, 'rgba(236,241,248,' + hz.toFixed(3) + ')');
        ctx.fillStyle = hg; ctx.fillRect(0, H * 0.62, W, H * 0.38);
      }

      // дождь
      if (drops.length) {
        var drz = C.wx && C.wx.rain === 'drizzle';
        ctx.strokeStyle = drz ? 'rgba(222,228,236,' + (0.22 * RAIN + 0.04) + ')' : 'rgba(226,232,240,' + (0.32 * RAIN + 0.05) + ')';
        ctx.lineWidth = drz ? 0.8 : 1; ctx.beginPath();
        drops.forEach(function (d) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * (drz ? 0.1 : 0.18), d.y + d.l); });
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
      var g = update(dt);
      if (!held) draw(g);
    }
    function wake() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; wake(); }).observe(fig);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('resize', function () { W = 0; });
    reset();
    wake();

    // для показа и проверки (?life=demo): KimHero.trigger('rain' | 'rainbow' | 'sun' | 'glint' | 'bird' | 'gust')
    if (DEMO) window.KimHero.trigger = function (what) {
      if (what === 'rain' && C.wx) { wx.st = 'clear'; wx.next = T; }
      if (what === 'rainbow') { bow.on = true; bow.t0 = T; }
      if (what === 'sun') { sunb.on = true; sunb.t0 = T; sunb.dur = 12; }
      if (what === 'glint') startGlint(true);
      if (what === 'bird') { bird.st = 'off'; bird.next = T; }
      if (what === 'gust') { gust.on = true; gust.t0 = T; gust.dur = 3.5; gust.amp = 1; }
    };

    return {
      // смена сезона: сначала гасим «жизнь», под ней проявляется новое фото, потом всё заново
      hold: function () {
        held = true; cv.style.transition = 'opacity 1.2s ease'; cv.style.opacity = 0;
        if (gl) { gl.canvas.style.transition = 'opacity 1.2s ease'; gl.canvas.style.opacity = 0; }
        img.style.filter = ''; tint.style.opacity = 0;
      },
      swap: function (newImg, newMasks, s) {
        img = newImg; season = s;
        if (newMasks) readMasks(newMasks);
        if (gl) gl.setPhoto(img);
        reset(); layout(true);
        held = false;
        ctx.clearRect(0, 0, W, H);
        setTimeout(function () { cv.style.opacity = 1; if (gl) gl.canvas.style.opacity = 1; }, 60);
      }
    };
  }

  /* ---------- WebGL: плавный изгиб листвы ----------
     Снимок рисуется заново с маленьким смещением, которое плавно меняется по картинке.
     Карта hero-wind.png: R — кроны деревьев, G — ближняя размытая ветка; храм там чёрный
     и не двигается. Поле смещения шире самих листьев, поэтому край кроны изгибается
     вместе с небом за ним — без «призраков» и разрывов. */
  function makeWind(windMap, photoEl) {
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
    var texs = [];
    function tex(unit, el) {
      var tx = texs[unit] || (texs[unit] = g.createTexture()); g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(g.TEXTURE_2D, tx);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, el);
    }
    tex(0, photoEl); tex(1, windMap);
    var U = {}; ['ph', 'wm', 'sz', 'off', 'isz', 't', 'wb', 'wt', 'wt2', 'fl'].forEach(function (k) { U[k] = g.getUniformLocation(pr, k); });
    g.uniform1i(U.ph, 0); g.uniform1i(U.wm, 1);
    var dpr = Math.min(2, window.devicePixelRatio || 1), ready = false;
    return {
      canvas: c,
      resize: function (w, h, s, ox, oy) {
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); g.viewport(0, 0, c.width, c.height);
        g.uniform2f(U.sz, c.width, c.height); g.uniform2f(U.off, ox * dpr, oy * dpr); g.uniform2f(U.isz, IW * s * dpr, IH * s * dpr);
      },
      setPhoto: function (el) { tex(0, el); },
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
