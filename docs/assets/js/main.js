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
  openBtn && openBtn.addEventListener('click', function () { setMenu(true); });
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

  /* ---------- Книжный режим: блоки перелистываются как страницы книги ---------- */
  (function book() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var wide = window.matchMedia ? window.matchMedia('(min-width: 900px)') : { matches: true };
    var main = $('main'), hero = $('.hero'), footer = $('.site-footer');
    if (reduce || !main || !hero || !footer) return;

    var blocks = [hero].concat($$('main > section'), [footer]);
    var spacer = document.createElement('div'); spacer.className = 'book-spacer'; spacer.setAttribute('aria-hidden', 'true');
    var shade = document.createElement('div'); shade.className = 'book-shade';
    var on = false, pages = [], L = 0, vh = 0, cur = 0, ticking = false;
    var HOLD = 0.22;   // доля шага, когда страница лежит спокойно перед переворотом

    function unwrap() {
      blocks.forEach(function (b) { b.style.flexGrow = ''; main.appendChild(b); });
      pages.forEach(function (p) { p.remove(); });
      pages = [];
    }
    function build() {
      unwrap();
      vh = window.innerHeight;
      var hs = blocks.map(function (b) { return b.offsetHeight; });
      // подряд идущие блоки собираем в страницы не выше экрана
      var groups = [], g = [], sum = 0;
      blocks.forEach(function (b, i) {
        if (g.length && sum + hs[i] > vh) { groups.push({ items: g, h: sum }); g = []; sum = 0; }
        g.push(i); sum += hs[i];
      });
      groups.push({ items: g, h: sum });
      var lastG = groups[groups.length - 1];
      if (groups.length > 1 && lastG.h < vh * 0.4) {
        var prev = groups[groups.length - 2];
        prev.items = prev.items.concat(lastG.items); prev.h += lastG.h; groups.pop();
      }
      groups.forEach(function (gr) {
        var page = document.createElement('div'); page.className = 'book-page';
        var sheet = document.createElement('div'); sheet.className = 'book-sheet';
        page.appendChild(sheet); main.appendChild(page); pages.push(page);
        gr.items.forEach(function (i) { blocks[i].style.flexGrow = String(hs[i]); sheet.appendChild(blocks[i]); });
        var sc = Math.min(1, vh / gr.h);   // слишком высокую страницу слегка уменьшаем, чтобы влезла в экран
        page.style.height = vh + 'px';
        sheet.style.height = (vh / sc) + 'px';
        sheet.style.width = (100 / sc) + '%';
        sheet.style.transform = sc < 1 ? 'scale(' + sc.toFixed(4) + ')' : '';
      });
      var n = pages.length;
      pages.forEach(function (p, i) { p.style.zIndex = String(2 * (n - i) + 2); p.style.transformOrigin = '0 ' + Math.round(vh / 2) + 'px'; });
      main.appendChild(shade);
      // по одному экрану прокрутки на страницу, с точками «прилипания»
      L = vh;
      spacer.innerHTML = '';
      for (var k = 0; k < n; k++) { var d = document.createElement('div'); d.style.height = L + 'px'; spacer.appendChild(d); }
      update();
    }
    function ease(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }   // мягко трогается и мягко ложится
    function update() {
      ticking = false;
      if (!on || !pages.length) return;
      var n = pages.length, y = window.scrollY, W = main.clientWidth, d = W * 4;
      var k = Math.max(0, Math.min(n - 1, Math.floor(y / L)));
      var p = k < n - 1 ? Math.max(0, Math.min(1, (y / L - k - HOLD) / (1 - HOLD))) : 0;
      var e = ease(p), ang = -96 * e;   // лист поднимается за правый край и уходит влево
      cur = p > 0.5 ? k + 1 : k;
      pages.forEach(function (pg, j) {
        var st = pg.style;
        if (j === k) {
          pg.classList.remove('is-off');
          st.transform = p > 0 ? 'perspective(' + Math.round(d) + 'px) rotateY(' + ang.toFixed(3) + 'deg)' : 'none';
          st.setProperty('--turn', (Math.sin(Math.PI * 0.5 * e)).toFixed(3));
        } else if (j === k + 1 && p > 0) {
          pg.classList.remove('is-off');
          st.transform = 'none';
          st.setProperty('--turn', '0');
        } else {
          pg.classList.add('is-off');
          st.transform = 'none';
        }
      });
      if (p > 0) {
        // где сейчас свободный край листа на экране (с учётом перспективы)
        var r = ang * Math.PI / 180, x3 = W * Math.cos(r), z3 = -W * Math.sin(r);
        var X = Math.max(0, x3 * d / (d - z3));
        shade.style.visibility = 'visible';
        shade.style.zIndex = String(2 * (n - k) + 1);
        shade.style.setProperty('--x', X.toFixed(1) + 'px');
        shade.style.setProperty('--dim', (0.30 * (1 - e)).toFixed(3));
      } else {
        shade.style.visibility = 'hidden';
      }
    }
    function pageOf(el) { for (var i = 0; i < pages.length; i++) { if (pages[i].contains(el)) return i; } return -1; }
    function rebuildKeepingPage() { var k = cur; build(); window.scrollTo({ top: k * L, behavior: 'instant' }); update(); }

    function enable() {
      if (on) return; on = true;
      main.insertBefore(hero, main.firstChild); main.appendChild(footer);
      document.body.classList.add('book'); document.documentElement.classList.add('book-snap');
      document.body.appendChild(spacer);
      build();
    }
    function disable() {
      if (!on) return; on = false;
      unwrap(); shade.remove(); spacer.remove();
      main.parentNode.insertBefore(hero, main);
      main.parentNode.insertBefore(footer, main.nextSibling);
      document.body.classList.remove('book'); document.documentElement.classList.remove('book-snap');
    }

    // ссылки-якоря: листаем к нужной странице
    document.addEventListener('click', function (e) {
      if (!on) return;
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href').slice(1); if (!id) return;
      var el = document.getElementById(id); if (!el) return;
      var k = pageOf(el); if (k < 0) return;
      e.preventDefault();
      window.scrollTo({ top: k * L, behavior: 'smooth' });
    });
    // фокус с клавиатуры ушёл на другую страницу — открываем её
    document.addEventListener('focusin', function (e) {
      if (!on) return;
      var k = pageOf(e.target);
      if (k >= 0 && k !== cur) window.scrollTo({ top: k * L, behavior: 'instant' });
    });

    window.addEventListener('scroll', function () { if (on && !ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (wide.matches && !on) enable(); else if (!wide.matches && on) disable();
        else if (on) rebuildKeepingPage();
      }, 150);
    });
    window.addEventListener('load', function () { if (on) rebuildKeepingPage(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (on) rebuildKeepingPage(); });
    if (wide.matches) enable();
    if (on && location.hash) { var el0 = document.getElementById(location.hash.slice(1)); var k0 = el0 ? pageOf(el0) : -1; if (k0 >= 0) window.scrollTo(0, k0 * L); }
  })();

  setText('[data-year]', String(new Date().getFullYear()));
})();
