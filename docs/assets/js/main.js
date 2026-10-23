/* Приход храма свв. Кирилла и Мефодия — поведение главной страницы */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     Сбор средств. Пока смета не утверждена, показываются цифры-пример
     из макета с пометкой «пример». Когда появятся настоящие данные:
       collected: <собрано, ₽>, goal: <цель, ₽>, isExample: false
     Чтобы скрыть цифры совсем: collected: null, goal: null
     --------------------------------------------------------------- */
  var FUNDRAISING = { collected: 4850000, goal: 13000000, isExample: true };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  function setText(sel, text) { var el = $(sel); if (el) el.textContent = text; }

  /* ---------- Тост ---------- */
  var toastEl = $('[data-toast]');
  var toastTimer;
  function toast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 3400);
  }
  $$('[data-soon]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); toast('Этот раздел готовится и скоро появится на сайте'); });
  });

  /* ---------- Модальные окна ---------- */
  var lastFocus = null;
  function openModal(name) {
    var m = $('#modal-' + name);
    if (!m) return;
    lastFocus = document.activeElement;
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    var f = $('input, select, button:not([data-modal-close])', m) || $('[data-modal-close]', m);
    f && f.focus();
  }
  function closeModals() {
    var any = false;
    $$('.modal').forEach(function (m) { if (!m.hidden) { m.hidden = true; any = true; } });
    if (any) { document.body.style.overflow = ''; lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true }); }
  }
  $$('[data-modal-open]').forEach(function (b) {
    b.addEventListener('click', function () { setMenu(false, true); openModal(b.getAttribute('data-modal-open')); });
  });
  $$('[data-modal-close]').forEach(function (b) { b.addEventListener('click', closeModals); });
  $$('.modal').forEach(function (m) { m.addEventListener('click', function (e) { if (e.target === m) closeModals(); }); });

  /* ---------- Мобильное меню ---------- */
  var menu = $('#mobile-menu');
  var openBtn = $('[data-menu-open]');
  function setMenu(open, silent) {
    if (!menu || menu.hidden === !open) return;
    menu.hidden = !open;
    openBtn && openBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (silent) return;
    if (open) { var f = $('[data-menu-close]', menu); f && f.focus(); } else if (openBtn) { openBtn.focus({ preventScroll: true }); }
  }
  $$('[data-menu-open]').forEach(function (btn) { btn.addEventListener('click', function () { openBtn = btn; setMenu(true); }); });
  $$('#mobile-menu [data-menu-close]').forEach(function (el) {
    el.addEventListener('click', function () { if (!el.hasAttribute('data-modal-open')) setMenu(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeModals();
    if (menu && !menu.hidden) setMenu(false);
  });

  /* ---------- Слайдер первого экрана ---------- */
  var slides = $$('[data-slide]');
  var cur = 0;
  setText('[data-slide-total]', pad(slides.length));
  function show(i) {
    if (!slides.length) return;
    slides[cur].classList.remove('is-active');
    cur = (i + slides.length) % slides.length;
    slides[cur].classList.add('is-active');
    setText('[data-slide-current]', pad(cur + 1));
  }
  var prev = $('[data-slide-prev]'), next = $('[data-slide-next]');
  prev && prev.addEventListener('click', function () { show(cur - 1); });
  next && next.addEventListener('click', function () { show(cur + 1); });

  /* ---------- Календарь ---------- */
  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function oldStyle(d) { var o = new Date(d); o.setDate(o.getDate() - 13); return o; } // 1900–2099

  (function renderCalendar() {
    var raw = $('#calendar-data');
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw.textContent); } catch (e) { return; }
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var key = iso(today);
    var os = oldStyle(today);

    setText('[data-cal-day]', String(today.getDate()));
    setText('[data-cal-month]', MONTHS_GEN[today.getMonth()]);
    setText('[data-cal-weekday]', WEEKDAYS[today.getDay()]);
    setText('[data-cal-saint-sub]', os.getDate() + ' ' + MONTHS_GEN[os.getMonth()] + ' по ст. ст.');

    var day = data.days && data.days[key];
    setText('[data-cal-saint]', day ? day.saint : 'Память святых дня');
    setText('[data-cal-fast]', day ? day.fast : 'См. в полном календаре');

    var upcoming = (data.feasts || []).filter(function (f) { return parseIso(f.date) >= today; })
      .sort(function (a, b) { return parseIso(a.date) - parseIso(b.date); })[0];
    if (upcoming) {
      var fd = parseIso(upcoming.date);
      setText('[data-cal-feast]', upcoming.title);
      setText('[data-cal-feast-date]', iso(fd) === key ? 'Сегодня' : fd.getDate() + ' ' + MONTHS_GEN[fd.getMonth()]);
    }
    var link = $('[data-cal-link]');
    if (link) link.href = 'https://azbyka.ru/days/' + key;
  })();

  /* ---------- Прогресс сбора ---------- */
  (function renderFundraising() {
    var c = FUNDRAISING.collected, g = FUNDRAISING.goal;
    if (typeof c !== 'number' || typeof g !== 'number' || g <= 0) return;
    var pct = Math.max(0, Math.min(100, Math.round((c / g) * 100)));
    var rub = function (n) { return n.toLocaleString('ru-RU') + ' ₽'; };
    setText('[data-fund-pct]', pct + '%');
    var bar = $('[data-fund-bar]');
    bar && bar.setAttribute('aria-valuenow', String(pct));
    var fill = $('[data-fund-fill]');
    if (fill) requestAnimationFrame(function () { fill.style.width = pct + '%'; });
    var sums = $('[data-fund-sums]');
    if (sums) {
      sums.textContent = '';
      var b = document.createElement('b'); b.textContent = 'Собрано ' + rub(c);
      var s = document.createElement('span'); s.textContent = 'из ' + rub(g);
      sums.appendChild(b); sums.appendChild(s);
    }
    var note = $('[data-fund-note]');
    if (note && FUNDRAISING.isExample) { note.textContent = 'Цифры-пример. Будут заменены данными утверждённой сметы.'; note.hidden = false; }
  })();

  /* ---------- Окно пожертвования ---------- */
  var donateForm = $('[data-donate-form]');
  if (donateForm) {
    var amountInput = $('#donate-amount');
    $$('[data-amount]', donateForm).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-amount]', donateForm).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        amountInput.value = b.getAttribute('data-amount');
      });
    });
    amountInput.addEventListener('input', function () {
      $$('[data-amount]', donateForm).forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-amount') === amountInput.value)); });
    });
    donateForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = parseInt(amountInput.value, 10);
      if (!v || v < 100) { amountInput.focus(); toast('Укажите сумму от 100 ₽'); return; }
      closeModals();
      toast('Платёж не создан: онлайн-оплата пока не подключена');
    });
  }

  /* ---------- Фотолента событий ---------- */
  var track = $('[data-events-track]');
  var evNext = $('[data-events-next]');
  if (track && evNext) {
    evNext.addEventListener('click', function () {
      if (track.scrollWidth <= track.clientWidth + 4) { toast('Раздел событий готовится и скоро появится на сайте'); return; }
      var card = track.querySelector('.event-card');
      var step = card ? card.getBoundingClientRect().width + 8 : 240;
      var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      track.scrollTo({ left: atEnd ? 0 : track.scrollLeft + step, behavior: 'smooth' });
    });
  }

  /* ---------- Записки ---------- */
  var MAX_LINES = 25;
  $$('[data-note-form]').forEach(function (form) {
    var kind = form.getAttribute('data-note-form');
    var lines = $('[data-note-lines]', form);
    var addBtn = $('[data-note-add]', form);
    var status = $('[data-note-status]', form);
    var counter = lines.children.length;
    function refreshAdd() { addBtn.disabled = lines.children.length >= MAX_LINES; }

    addBtn.addEventListener('click', function () {
      if (lines.children.length >= MAX_LINES) return;
      counter += 1;
      var id = kind + '-' + counter;
      var row = document.createElement('div'); row.className = 'note-line';
      var label = document.createElement('label'); label.className = 'visually-hidden'; label.htmlFor = id; label.textContent = 'Имя ' + (lines.children.length + 1);
      var input = document.createElement('input');
      input.id = id; input.name = 'name'; input.type = 'text'; input.autocomplete = 'off'; input.placeholder = ''; input.maxLength = 40;
      var rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'note-line__remove'; rm.setAttribute('aria-label', 'Удалить строку');
      rm.innerHTML = '<svg aria-hidden="true"><use href="#i-x"/></svg>';
      rm.addEventListener('click', function () { row.remove(); refreshAdd(); addBtn.focus(); });
      row.appendChild(label); row.appendChild(input); row.appendChild(rm);
      lines.appendChild(row);
      input.focus();
      refreshAdd();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var names = $$('input[name="name"]', form).map(function (i) { return i.value.trim(); }).filter(Boolean);
      status.hidden = false;
      if (!names.length) {
        status.className = 'note-form__status is-error';
        status.textContent = 'Впишите хотя бы одно имя.';
        var first = $('input[name="name"]', form); first && first.focus();
        return;
      }
      var bad = names.filter(function (n) { return !/^[А-Яа-яЁё\s\-]+$/.test(n); });
      if (bad.length) {
        status.className = 'note-form__status is-error';
        status.textContent = 'Имена пишутся кириллицей, без сокращений и цифр: «' + bad[0] + '».';
        return;
      }
      status.className = 'note-form__status';
      status.textContent = 'Онлайн-приём записок пока не подключён, записка не отправлена. Подать её можно в приходе.';
    });
  });

  /* ---------- Вопрос священнику ---------- */
  var qForm = $('[data-q-form]');
  if (qForm) {
    qForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = $('[data-q-status]', qForm);
      var text = $('#q-text').value.trim();
      var email = $('#q-email').value.trim();
      status.hidden = false;
      if (!text) { status.textContent = 'Напишите вопрос.'; $('#q-text').focus(); return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status.textContent = 'Проверьте адрес почты.'; $('#q-email').focus(); return; }
      status.textContent = 'Приём вопросов через сайт пока не подключён, вопрос не отправлен. Задать его можно священнику в приходе.';
    });
  }

  /* ---------- Хочу помочь ---------- */
  var volForm = $('[data-volunteer-form]');
  if (volForm) {
    volForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!$('#vol-contact').value.trim()) { $('#vol-contact').focus(); toast('Оставьте телефон или почту для связи'); return; }
      closeModals();
      toast('Заявка не отправлена: приём через сайт пока не подключён');
    });
  }

  /* ---------- Плавные переходы между блоками ----------
     На каждом стыке — полоса, где цвет верхнего блока перетекает в цвет нижнего.
     Цвета берутся с самих блоков; у блоков с градиентным фоном — из data-edge. */
  (function seams() {
    var EDGE = { prayer: '#E2D3B7' };          // фон из градиента: цвет у краёв блока
    function colorOf(el) {
      if (!el) return null;
      if (el.id && EDGE[el.id]) return EDGE[el.id];
      var c = getComputedStyle(el).backgroundColor;
      return (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) ? c : getComputedStyle(document.body).backgroundColor;
    }
    var secs = $$('main > section'), footer = $('.site-footer');
    function add(before, prev, next) {
      var d = document.createElement('div'); d.className = 'seam'; d.setAttribute('aria-hidden', 'true');
      d.style.setProperty('--a', colorOf(prev)); d.style.setProperty('--b', colorOf(next));
      before.parentNode.insertBefore(d, before);
      return d;
    }
    secs.forEach(function (sec, i) { if (i > 0) add(sec, secs[i - 1], sec); });
    var last = secs[secs.length - 1];
    if (last && footer) {
      var d = document.createElement('div'); d.className = 'seam'; d.setAttribute('aria-hidden', 'true');
      d.style.setProperty('--a', colorOf(last)); d.style.setProperty('--b', colorOf(footer));
      last.parentNode.insertBefore(d, last.nextSibling);
    }
  })();

  setText('[data-year]', String(new Date().getFullYear()));
})();

/* Полосы-клинья на стыках блоков */
(function () {
  var OLIVE = 'rgb(51,80,92)', LIGHT_FALLBACK = 'rgb(239,228,208)';
  function rgb(s) { var m = s.match(/\d+(\.\d+)?/g); return m ? m.map(Number) : null; }
  function colorOf(el) {
    if (el.classList.contains('hero')) return OLIVE;
    var c = getComputedStyle(el).backgroundColor, v = rgb(c);
    return (!v || (v.length > 3 && v[3] === 0)) ? LIGHT_FALLBACK : c;
  }
  function dark(c) { var v = c[0] === '#' ? [parseInt(c.substr(1,2),16),parseInt(c.substr(3,2),16),parseInt(c.substr(5,2),16)] : rgb(c); return (v[0]*.299+v[1]*.587+v[2]*.114) < 128; }
  function lum(c) { var v = rgb(c); return v[0]*.299+v[1]*.587+v[2]*.114; }
  function deepen(c, k) { var v = rgb(c); return 'rgb(' + v.slice(0,3).map(function (x) { return Math.round(x * k); }).join(',') + ')'; }
  function add(el, color, bottom) {
    var j = document.createElement('span'); j.className = 'joint' + (bottom ? ' joint--bottom' : ''); j.setAttribute('aria-hidden', 'true');
    j.style.background = color; el.appendChild(j);
  }
  function run() {
    var blocks = [].slice.call(document.querySelectorAll('.hero, main > section, body > footer'));
    blocks.forEach(function (el, i) {
      if (!i || blocks[i - 1].classList.contains('hero')) return;
      var up = blocks[i - 1], prev = colorOf(up), cur = colorOf(el);
      if (dark(prev) !== dark(cur)) { add(el, prev, false); return; }
      var d = lum(prev) - lum(cur);
      if (Math.abs(d) < 3) return;
      // тот же тон, разная яркость: на более светлом блоке — полоса цвета более тёмного, чуть насыщеннее
      if (d > 0) add(up, deepen(cur, .9), true); else add(el, deepen(prev, .9), false);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();

/* Первый экран + полоса календаря помещаются в окно */
(function () {
  var cal = document.querySelector('.calendar-strip');
  if (!cal) return;
  function set() { document.documentElement.style.setProperty('--cal-h', cal.offsetHeight + 'px'); }
  set(); window.addEventListener('resize', set);
  if (window.ResizeObserver) new ResizeObserver(set).observe(cal);
})();

/* ---------- Живой первый экран ----------
   Поверх фото храма: листва шелестит порывами (SVG-фильтр смещения по маске крон),
   иногда прилетает птица и садится на крышу, изредка проходит человек за кустами,
   во время порывов падают листья. Всё случайно и нелинейно; при «уменьшить движение»
   ничего не запускается, вне экрана анимация стоит на паузе. */
(function () {
  var slide = document.querySelector('.hero__slide');
  var stage = slide && slide.querySelector('.hero__stage');
  if (!stage) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var IW = 1444, IH = 1089, NS = 'http://www.w3.org/2000/svg';
  var base = slide.querySelector(':scope > img');
  var wind = stage.querySelector('.hero__wind');
  var back = stage.querySelector('.hero__fx--back');
  var front = stage.querySelector('.hero__fx--front');
  var fOff = document.querySelector('#hero-wind feOffset');
  var fMap = document.querySelector('#hero-wind feDisplacementMap');
  var pxPerUnit = 1;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }

  /* сцена = кадр фото при object-fit: cover, object-position: 50% 0 */
  function fit() {
    var w = slide.clientWidth, h = slide.clientHeight; if (!w || !h) return;
    var s = Math.max(w / IW, h / IH), sw = IW * s, sh = IH * s;
    stage.style.width = sw + 'px'; stage.style.height = sh + 'px';
    stage.style.left = ((w - sw) / 2) + 'px'; stage.style.top = '0px';
    pxPerUnit = s;
  }
  fit(); window.addEventListener('resize', fit);
  if (base && !base.complete) base.addEventListener('load', fit);

  /* ---- ветер: тишина, лёгкий бриз или порыв ---- */
  var gust = null, nextGust = rnd(1.5, 4), breeze = 0, phase = 0, intensity = 0;
  function windAt(t, dt) {
    if (!gust && t > nextGust) gust = { t0: t, dur: rnd(1.6, 4.5), amp: rnd(.35, 1) };
    var g = 0;
    if (gust) {
      var p = (t - gust.t0) / gust.dur;
      if (p >= 1) { gust = null; nextGust = t + (Math.random() < .35 ? rnd(.8, 2.5) : rnd(3.5, 11)); }
      else g = gust.amp * Math.pow(Math.sin(Math.PI * p), 2) * (.8 + .2 * Math.sin(t * 9.1) * Math.sin(t * 3.7));
    }
    breeze += (((Math.sin(t * .23) + Math.sin(t * .071 + 2)) > .6 ? .12 : 0) - breeze) * Math.min(1, dt * .8);
    intensity = Math.max(g, breeze);
    phase += dt * (.35 + 2.4 * intensity);
    var dx = 70 * Math.sin(phase * .9) + 25 * Math.sin(phase * 2.6 + 1);
    var dy = 45 * Math.cos(phase * 1.2) + 15 * Math.sin(phase * 3.1);
    var sc = intensity < .015 ? 0 : (1.2 + 9 * intensity) * pxPerUnit * 1.4;
    fOff.setAttribute('dx', dx.toFixed(1)); fOff.setAttribute('dy', dy.toFixed(1));
    fMap.setAttribute('scale', sc.toFixed(2));
    wind.style.filter = sc ? 'url(#hero-wind)' : 'none';
  }

  /* ---- листья ---- */
  var leafSrc = [[40, 30, 460, 200], [10, 380, 110, 900], [980, 320, 1230, 520], [1240, 420, 1430, 900]];
  var leafCols = ['#E3A63A', '#D98F2B', '#F0C25A', '#C9772A'];
  var leaves = [];
  function spawnLeaf() {
    if (leaves.length > 7) return;
    var b = leafSrc[(Math.random() * leafSrc.length) | 0];
    var g = el('g', {}, front);
    el('path', { d: 'M0,-7 C5,-5 6,2 0,8 C-6,2 -5,-5 0,-7 Z M0,-7 L0,8', fill: leafCols[(Math.random() * 4) | 0], stroke: 'rgba(120,70,20,.5)', 'stroke-width': '.6' }, g);
    leaves.push({ g: g, x: rnd(b[0], b[2]), y: rnd(b[1], b[3]), vx: rnd(-10, 10), vy: rnd(28, 46), r: rnd(0, 360), vr: rnd(-160, 160), ph: rnd(0, 6), s: rnd(.8, 1.35) });
  }
  function stepLeaves(dt) {
    if (Math.random() < dt * (.04 + 1.6 * intensity * intensity)) spawnLeaf();
    for (var i = leaves.length - 1; i >= 0; i--) {
      var L = leaves[i]; L.ph += dt * 3;
      L.x += (L.vx + 140 * intensity + 18 * Math.sin(L.ph)) * dt;
      L.y += (L.vy + 10 * Math.cos(L.ph * 1.3)) * dt;
      L.r += L.vr * dt * (1 + intensity);
      L.g.setAttribute('transform', 'translate(' + L.x.toFixed(1) + ',' + L.y.toFixed(1) + ') rotate(' + L.r.toFixed(0) + ') scale(' + L.s.toFixed(2) + ',' + (L.s * (.55 + .45 * Math.abs(Math.sin(L.ph)))).toFixed(2) + ')');
      if (L.y > IH + 20 || L.x > IW + 40) { L.g.remove(); leaves.splice(i, 1); }
    }
  }

  /* ---- птица ---- */
  var perches = [[300, 354, 1], [262, 340, 1], [1150, 581, -1], [690, 470, 1]]; // точки на крышах (x, y лапок, куда смотрит)
  var bird = el('g', { opacity: 0 }, front), bBody = el('g', {}, bird);
  el('path', { d: 'M-11,0 C-7,-6 4,-7 9,-4 L13,-3 L9,-1 C7,4 -4,5 -11,0 Z', fill: '#2B2520' }, bBody);          // тело и голова
  el('path', { d: 'M-11,0 L-18,-3 L-17,2 Z', fill: '#2B2520' }, bBody);                                        // хвост
  el('path', { d: 'M1,4 L0,8 M4,4 L4,8', stroke: '#2B2520', 'stroke-width': '1.1' }, bBody);                   // лапки
  var wingUp = el('path', { d: 'M-2,-3 C-6,-16 -14,-20 -20,-19 C-12,-12 -7,-6 -2,-1 Z', fill: '#3A312A' }, bird);
  var wingFold = el('path', { d: 'M-8,-3 C-3,-6 5,-5 6,-2 C2,0 -4,1 -8,-1 Z', fill: '#3F352D' }, bBody);
  var B = { st: 'away', t: 0, next: rnd(5, 9) };
  function bez(a, c, b, p) { var q = 1 - p; return [q * q * a[0] + 2 * q * p * c[0] + p * p * b[0], q * q * a[1] + 2 * q * p * c[1] + p * p * b[1]]; }
  function birdFly(from, to, dur) {
    var c = [(from[0] + to[0]) / 2 + rnd(-120, 120), Math.min(from[1], to[1]) - rnd(60, 160)];
    B.path = [from, c, to]; B.dur = dur; B.t = 0;
  }
  function stepBird(t, dt) {
    var x, y, dir = 1, flap = 0;
    if (B.st === 'away') {
      if (t < B.next) return;
      var P = perches[(Math.random() * perches.length) | 0]; B.perch = P;
      var fromLeft = Math.random() < .5;
      birdFly([fromLeft ? -40 : IW + 40, rnd(40, 260)], [P[0], P[1] - 8], rnd(3.2, 4.8));
      B.st = 'in'; bird.setAttribute('opacity', 1);
    }
    if (B.st === 'in' || B.st === 'out') {
      B.t += dt; var p = Math.min(1, B.t / B.dur), e = B.st === 'in' ? 1 - Math.pow(1 - p, 2.2) : p * p;
      var pt = bez(B.path[0], B.path[1], B.path[2], e), pt2 = bez(B.path[0], B.path[1], B.path[2], Math.min(1, e + .02));
      x = pt[0]; y = pt[1]; dir = pt2[0] >= x ? 1 : -1;
      var glide = B.st === 'in' && p > .7 ? 0 : 1;
      flap = glide ? Math.sin(t * 34) : (p > .9 ? Math.sin(t * 40) : .3);
      if (p >= 1) {
        if (B.st === 'in') { B.st = 'sit'; B.t = 0; B.stay = rnd(3, 8); B.hop = rnd(1, 2.5); B.dir = B.perch[2]; }
        else { B.st = 'away'; bird.setAttribute('opacity', 0); B.next = t + rnd(14, 32); return; }
      }
      wingUp.setAttribute('opacity', 1); wingFold.setAttribute('opacity', 0);
      wingUp.setAttribute('transform', 'scale(1,' + (.25 + .75 * (flap * .5 + .5)).toFixed(2) + ') ' + (flap < -.4 ? 'scale(1,-1)' : ''));
      bird.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + (dir * 1.05) + ',1.05)');
      return;
    }
    if (B.st === 'sit') {
      B.t += dt; var P2 = B.perch;
      if (B.t > B.hop) { B.dir = -B.dir; B.hop = B.t + rnd(1.2, 3); }
      var bob = Math.max(0, Math.sin(B.t * 5)) * .8 * (Math.sin(B.t * .9) > .5 ? 1 : 0);
      wingUp.setAttribute('opacity', 0); wingFold.setAttribute('opacity', 1);
      bBody.setAttribute('transform', 'rotate(' + (-bob * 6).toFixed(1) + ')');
      bird.setAttribute('transform', 'translate(' + P2[0] + ',' + (P2[1] - 8 - bob).toFixed(1) + ') scale(' + (B.dir * 1.05) + ',1.05)');
      if (B.t > B.stay || intensity > .85) {
        bBody.setAttribute('transform', '');
        var away = Math.random() < .5 ? -60 : IW + 60;
        birdFly([P2[0], P2[1] - 8], [away, rnd(-60, 120)], rnd(2.6, 3.6)); B.st = 'out';
      }
    }
  }

  /* ---- прохожий за кустами ---- */
  var man = el('g', { opacity: 0 }, back);
  var legs = [el('path', { d: 'M-5,40 L-6,95', stroke: '#2A2420', 'stroke-width': '9', 'stroke-linecap': 'round' }, man),
              el('path', { d: 'M5,40 L6,95', stroke: '#2A2420', 'stroke-width': '9', 'stroke-linecap': 'round' }, man)];
  el('path', { d: 'M-16,-40 C-18,-46 -10,-52 0,-52 C10,-52 18,-46 16,-40 L20,40 L-20,40 Z', fill: '#2F2A2C' }, man);  // пальто
  var arm = el('path', { d: 'M0,-38 L2,10', stroke: '#2A2528', 'stroke-width': '8', 'stroke-linecap': 'round' }, man);
  el('circle', { cx: 0, cy: -62, r: 11, fill: '#3A2E28' }, man);                                                  // голова
  el('path', { d: 'M-11,-66 C-9,-76 9,-76 11,-66 Z', fill: '#2A2420' }, man);                                       // шапка
  var M = { on: false, next: rnd(10, 18) };
  function stepMan(t, dt) {
    if (!M.on) {
      if (t < M.next) return;
      M.on = true; M.dir = Math.random() < .5 ? 1 : -1; M.x = M.dir > 0 ? 250 : IW + 40; M.ph = 0; M.v = rnd(38, 52);
      man.setAttribute('opacity', .93);
    }
    M.x += M.dir * M.v * dt; M.ph += dt * 5.2;
    var sw = Math.sin(M.ph), bob = Math.abs(Math.cos(M.ph)) * 2.2;
    legs[0].setAttribute('transform', 'rotate(' + (sw * 16).toFixed(1) + ' -5 40)');
    legs[1].setAttribute('transform', 'rotate(' + (-sw * 16).toFixed(1) + ' 5 40)');
    arm.setAttribute('transform', 'rotate(' + (-sw * 12).toFixed(1) + ' 0 -38)');
    man.setAttribute('transform', 'translate(' + M.x.toFixed(1) + ',' + (968 - bob).toFixed(1) + ') scale(' + M.dir + ',1)');
    if ((M.dir > 0 && M.x > IW + 40) || (M.dir < 0 && M.x < 250)) { M.on = false; man.setAttribute('opacity', 0); M.next = t + rnd(35, 70); }
  }

  /* ---- цикл ---- */
  var visible = true, last = 0, clock = 0, raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    if (!visible || document.hidden) return;
    clock += dt;
    windAt(clock, dt); stepLeaves(dt); stepBird(clock, dt); stepMan(clock, dt);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(slide);
  raf = requestAnimationFrame(frame);
})();

/* Паттерн из букв: привязываем узор к верху страницы, чтобы на стыках блоков он не ломался */
(function () {
  var sel = '.hero, .calendar-strip, .saints, .about, .prayer, .place, .chronicle, .build, .events, .questions, .help, .merch, .site-footer';
  var raf = 0;
  function apply() {
    raf = 0;
    var y = window.pageYOffset || 0;
    document.querySelectorAll(sel).forEach(function (el) {
      el.style.setProperty('--doc-y', -Math.round(el.getBoundingClientRect().top + y) + 'px');
    });
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(apply); }
  apply();
  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.body);
})();
