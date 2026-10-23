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

  /* ---------- Обложка: первый экран перелистывается, дальше обычный лендинг ----------
     Широкие экраны. Первый экран лежит поверх сайта; при прокрутке он загибается
     с правого нижнего угла и уходит, открывая лендинг, который в это время стоит на месте.
     Когда лист ушёл, страница прокручивается как обычно. */
  (function cover() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var wide = window.matchMedia ? window.matchMedia('(min-width: 900px)') : { matches: true };
    var main = $('main'), hero = $('.hero'), footer = $('.site-footer');
    if (reduce || !main || !hero || !footer) return;

    var TURN_SCREENS = 1.1;   // сколько экранов прокрутки уходит на переворот обложки: больше — медленнее
    var HOLD = 0.12;          // доля этого пути, когда обложка ещё лежит спокойно

    var landing = document.createElement('div'); landing.className = 'landing';
    var spacer = document.createElement('div'); spacer.className = 'cover-spacer'; spacer.setAttribute('aria-hidden', 'true');
    var snapTop = document.createElement('div'), snapEnd = document.createElement('div');
    snapTop.className = 'cover-snap'; snapEnd.className = 'cover-snap'; spacer.appendChild(snapTop); spacer.appendChild(snapEnd);
    var fx = document.createElement('div'); fx.className = 'cover-fx'; fx.setAttribute('aria-hidden', 'true');
    var shade = document.createElement('div'); shade.className = 'cover-shade';
    var curl = document.createElement('div'); curl.className = 'book-curl'; curl.inert = true;
    fx.appendChild(shade); fx.appendChild(curl);
    var curlFor = -1, strips = [], idleT, on = false, L = 0, vh = 0, pinned = null, ticking = false;

    function ease(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }   // мягко трогается и мягко ложится

    // полоски-копии страницы k для изгиба. Сгиб идёт по диагонали от правого нижнего угла:
    // рамка с полосками повёрнута на PHI, внутри каждой полоски страница повёрнута обратно.
    var PHI = 22 * Math.PI / 180, geo = null;
    function makeStrips(k) {
      if (curlFor === k) return;
      curl.innerHTML = ''; strips = [];
      var H = vh;
      var W = document.documentElement.clientWidth, c = Math.cos(PHI), sn = Math.sin(PHI);
      var Cx = W / 2, Cy = H / 2, D = Math.ceil(Math.hypot(W, H)) + 6;
      var uMin = -(Cx * c + Cy * sn), uMax = -uMin;
      var frame = document.createElement('div'); frame.className = 'curl-frame';
      frame.style.left = (Cx - D / 2) + 'px'; frame.style.top = (Cy - D / 2) + 'px';
      frame.style.width = D + 'px'; frame.style.height = D + 'px';
      frame.style.transform = 'rotate(' + (PHI * 180 / Math.PI).toFixed(3) + 'deg)';
      var N = Math.max(18, Math.round((uMax - uMin) / 40)), w = (uMax - uMin) / N;
      var rcx = Cx * c + Cy * sn, rcy = -Cx * sn + Cy * c;   // центр страницы в повёрнутых координатах
      var src = hero;
      var frag = document.createDocumentFragment();
      function face(cls, xs) {
        var tx = -rcx + D / 2 - xs, ty = -rcy + D / 2;
        var f = document.createElement('div'); f.className = 'curl-face ' + cls;
        f.style.width = W + 'px'; f.style.height = H + 'px';
        f.style.transform = 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) rotate(' + (-PHI * 180 / Math.PI).toFixed(3) + 'deg)';
        return { el: f };
      }
      for (var i = 0; i < N; i++) {
        var xs = D / 2 + uMin + i * w;
        var st = document.createElement('div'); st.className = 'curl-strip';
        st.style.left = xs.toFixed(2) + 'px'; st.style.width = (w + 1.2).toFixed(2) + 'px';
        var fr = face('curl-face--front', xs), bk = face('curl-face--back', xs);
        var copy = src.cloneNode(true);
        copy.removeAttribute('id');
        copy.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
        fr.el.appendChild(copy);
        st.appendChild(fr.el); st.appendChild(bk.el); frag.appendChild(st);
        strips.push({ el: st, u: uMin + i * w, w: w, isBack: false });
      }
      // общий слой светотени: на всю рамку, обрезан по повёрнутому прямоугольнику страницы
      var light = document.createElement('div'); light.className = 'curl-light';
      light.style.left = '0px'; light.style.top = '0px'; light.style.width = '0px'; light.style.height = '0px';
      var tint = document.createElement('div'); tint.className = 'curl-tint';
      var rampB = document.createElement('div'); rampB.className = 'curl-ramp-back';
      var rampF = document.createElement('div'); rampF.className = 'curl-ramp-front';
      [tint, rampF, rampB].forEach(function (el) { el.style.height = D + 'px'; });
      light.appendChild(tint); light.appendChild(rampF); light.appendChild(rampB);
      frame.appendChild(frag); curl.appendChild(frame); curl.appendChild(light);
      geo = { uMin: uMin, uMax: uMax, D: D, tint: tint, rampB: rampB, rampF: rampF,
              pre: 'translate(' + Cx.toFixed(1) + 'px,' + Cy.toFixed(1) + 'px) rotate(' + (PHI * 180 / Math.PI).toFixed(3) + 'deg) ' };
      curlFor = k;
    }
    // светотень видимой поверхности изгиба вдоль оси сгиба (одна градиентная заливка на кадр)
    function layer(el, x, w, op) {
      // в экранных координатах: к центру страницы, поворот на угол сгиба, затем сдвиг вдоль оси сгиба
      var tf = geo.pre + 'translate3d(' + (x - geo.D / 2).toFixed(1) + 'px,' + (-geo.D / 2).toFixed(1) + 'px,0) scaleX(' + Math.max(0.0001, w / 100).toFixed(4) + ')';
      if (el._tf !== tf) { el.style.transform = tf; el._tf = tf; }
      var o = op.toFixed(3);
      if (el._op !== o) { el.style.opacity = o; el._op = o; }
    }
    function setLight(xf, r) {
      var Lc = geo.uMax - xf, thMax = Lc / r, half = Math.PI * r, o = geo.D / 2;
      // изнанка, лёгшая плоско поверх страницы
      if (Lc > half) layer(geo.tint, xf - (Lc - half) + o, Lc - half, 0.06); else layer(geo.tint, 0, 0, 0);
      if (thMax >= Math.PI / 2) {          // видна изнаночная половина дуги: светлая у сгиба, темнее к гребню
        layer(geo.rampB, xf + o, r, 1); layer(geo.rampF, 0, 0, 0);
      } else {                             // загнут только краешек: видна лицевая сторона, темнеет к гребню
        var tm = Math.sin(thMax);
        layer(geo.rampF, xf + o, r * tm, Math.pow(tm, 1.6)); layer(geo.rampB, 0, 0, 0);
      }
    }
    function resetStrips() {
      if (geo) { layer(geo.tint, 0, 0, 0); layer(geo.rampB, 0, 0, 0); layer(geo.rampF, 0, 0, 0); }
      for (var i = 0; i < strips.length; i++) {
        var st = strips[i];
        if (st._tf !== 'translateZ(0)') { st.el.style.transform = 'translateZ(0)'; st._tf = 'translateZ(0)'; }
        if (st.isBack) { st.el.classList.remove('is-back'); st.isBack = false; }
      }
    }
    // положение точки листа (расстояние u от корешка) при линии сгиба xf и радиусе r
    function bend(u, xf, r) {
      if (u <= xf) return [u, 0, 0];
      var s = u - xf, half = Math.PI * r;
      if (s <= half) { var th = s / r; return [xf + r * Math.sin(th), r * (1 - Math.cos(th)), th]; }
      return [xf - (s - half), 2 * r, Math.PI];
    }
    // насколько темна поверхность листа под углом th: лицевая темнеет, отворачиваясь от света;
    // изнанка темнее у сгиба и светлеет, ложась
    function shadeAt(th) {
      if (th <= 0) return 0;
      if (th <= Math.PI / 2) return 0.40 * Math.pow(Math.sin(th), 1.6);
      return 0.06 + 0.30 * Math.pow(Math.sin(th), 2);
    }
    function measure() {
      if (!on) return;
      vh = window.innerHeight;
      L = Math.round(vh * TURN_SCREENS);
      hero.style.height = vh + 'px';
      snapTop.style.height = L + 'px';
      curlFor = -1; curl.innerHTML = ''; strips = [];
      pinned = null;
      update();
    }
    function setPinned(v) {
      if (pinned === v) return;
      pinned = v;
      landing.classList.toggle('is-pinned', v);
      // пока лендинг закреплён под обложкой, высоту страницы держит прокладка
      spacer.style.height = (v ? L + landing.offsetHeight : L) + 'px';
    }
    function update() {
      ticking = false;
      if (!on) return;
      var y = window.scrollY, W = document.documentElement.clientWidth;
      var p = Math.max(0, Math.min(1, (y / L - HOLD) / (1 - HOLD)));
      setPinned(y < L);
      hero.classList.toggle('is-turning', p > 0);
      if (p > 0 && p < 1) {
        makeStrips(0);
        var e = ease(p);
        var r = W * (0.06 + 0.05 * Math.sin(Math.PI * e));
        var xf = geo.uMax - (geo.uMax - geo.uMin + r * 1.15) * e;   // линия сгиба: от правого нижнего угла к левому верхнему
        fx.style.visibility = 'visible'; fx.style.zIndex = '55';
        for (var i = 0; i < strips.length; i++) {
          var st = strips[i], a = bend(st.u, xf, r), c = bend(st.u + st.w / 2, xf, r), th = c[2];
          var tf = a[2] === 0 && th === 0 ? 'translateZ(0)' :
            'translate3d(' + (a[0] - st.u).toFixed(1) + 'px,0,' + a[1].toFixed(1) + 'px) rotateY(' + (-th * 180 / Math.PI).toFixed(2) + 'deg)';
          if (st._tf !== tf) { st.el.style.transform = tf; st._tf = tf; }
          var isBack = th > Math.PI / 2;
          if (isBack !== st.isBack) { st.el.classList.toggle('is-back', isBack); st.isBack = isBack; }
        }
        setLight(xf, r);
        var X = Math.max(0, Math.min(geo.uMax - geo.uMin, xf + r - geo.uMin));
        shade.style.visibility = 'inherit';
        shade.style.setProperty('--ang', (90 + PHI * 180 / Math.PI).toFixed(2) + 'deg');
        shade.style.setProperty('--x', X.toFixed(1) + 'px');
        shade.style.setProperty('--dim', (0.26 * (1 - e)).toFixed(3));
      } else if (p === 0) {
        // обложка лежит: заранее готовим изгиб под ней, чтобы переворот начался без рывка
        shade.style.visibility = 'hidden';
        if (curlFor === 0) { resetStrips(); fx.style.zIndex = '45'; fx.style.visibility = 'visible'; }
        if (curlFor !== 0) { makeStrips(0); resetStrips(); fx.style.zIndex = '45'; fx.style.visibility = 'visible'; }
      } else {
        fx.style.visibility = 'hidden';   // лист ушёл
        shade.style.visibility = 'hidden';
      }
    }
    function landingTarget(el) {
      var top = el.getBoundingClientRect().top - landing.getBoundingClientRect().top;
      var bar = $('.site-header--bar');
      return L + top - (bar ? bar.offsetHeight : 0);
    }

    function enable() {
      if (on) return; on = true;
      main.parentNode.insertBefore(landing, main);
      landing.appendChild(main); landing.appendChild(footer);
      landing.parentNode.insertBefore(spacer, landing);
      document.body.appendChild(fx);
      document.body.classList.add('cover-on'); document.documentElement.classList.add('cover-on-root');
      measure();
    }
    function disable() {
      if (!on) return; on = false;
      landing.parentNode.insertBefore(main, landing);
      main.parentNode.insertBefore(footer, main.nextSibling);
      landing.remove(); spacer.remove(); fx.remove();
      hero.style.height = ''; hero.classList.remove('is-turning');
      document.body.classList.remove('cover-on'); document.documentElement.classList.remove('cover-on-root');
    }

    // ссылки-якоря: ведём к нужному месту лендинга с учётом перелистанной обложки
    document.addEventListener('click', function (e) {
      if (!on) return;
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href').slice(1); if (!id) return;
      if (id === 'top') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      var el = document.getElementById(id);
      if (!el || !landing.contains(el)) return;
      e.preventDefault();
      window.scrollTo({ top: landingTarget(el), behavior: 'smooth' });
    });
    // фокус с клавиатуры: обложка или лендинг должны быть видны
    document.addEventListener('focusin', function (e) {
      if (!on) return;
      if (landing.contains(e.target) && window.scrollY < L) window.scrollTo({ top: L, behavior: 'instant' });
      else if (hero.contains(e.target) && window.scrollY >= L) window.scrollTo({ top: 0, behavior: 'instant' });
    });

    window.addEventListener('scroll', function () {
      if (!on) return;
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
      // остановились посреди переворота — мягко доводим лист до конца или возвращаем
      clearTimeout(idleT);
      idleT = setTimeout(function () {
        var y = window.scrollY, p = (y / L - HOLD) / (1 - HOLD);
        if (y > 2 && y < L - 2) window.scrollTo({ top: p >= 0.45 ? L : 0, behavior: 'smooth' });
      }, 160);
    }, { passive: true });
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (wide.matches && !on) enable(); else if (!wide.matches && on) disable(); else measure();
      }, 150);
    });
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { if (on && pinned) spacer.style.height = (L + landing.offsetHeight) + 'px'; }).observe(main);
    }
    window.addEventListener('load', measure);
    if (wide.matches) enable();
    if (on && location.hash && location.hash !== '#top') {
      var el0 = document.getElementById(location.hash.slice(1));
      if (el0 && landing.contains(el0)) { setPinned(false); window.scrollTo(0, landingTarget(el0)); }
    }
  })();

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
