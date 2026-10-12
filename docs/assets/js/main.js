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

  /* ---------- Книжный режим: блоки перелистываются как страницы ---------- */
  (function book() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var wide = window.matchMedia ? window.matchMedia('(min-width: 900px)') : { matches: true, addEventListener: function () {} };
    var main = $('main'), hero = $('.hero'), footer = $('.site-footer');
    if (reduce || !main || !hero || !footer) return;

    var blocks = [hero].concat($$('main > section'), [footer]);
    var spacer = document.createElement('div'); spacer.className = 'book-spacer'; spacer.setAttribute('aria-hidden', 'true');
    var shade = document.createElement('div'); shade.className = 'book-shade';
    var on = false, pages = [], S = [], R = [], F = 0, vh = 0, cur = 0, ticking = false;

    function unwrap() {
      blocks.forEach(function (b) { main.appendChild(b); });
      pages.forEach(function (p) { p.remove(); });
      pages = [];
    }
    function group() {
      unwrap();
      vh = window.innerHeight;
      var page = null, sum = 0;
      blocks.forEach(function (b) {
        if (!page || sum >= vh) {
          page = document.createElement('div'); page.className = 'book-page';
          main.appendChild(page); pages.push(page); sum = 0;
        }
        page.appendChild(b); sum += b.offsetHeight;
      });
      // последняя страница не короче экрана: иначе присоединяем к предыдущей
      if (pages.length > 1 && pages[pages.length - 1].offsetHeight < vh) {
        var last = pages.pop();
        while (last.firstChild) pages[pages.length - 1].appendChild(last.firstChild);
        last.remove();
      }
      pages.forEach(function (p, i) { p.style.zIndex = String(2 * i + 2); });
      main.appendChild(shade);
    }
    function measure() {
      if (!on) return;
      vh = window.innerHeight; F = Math.round(vh * 0.95);
      var y = 0; S = []; R = [];
      pages.forEach(function (p, i) {
        S.push(y);
        var r = Math.max(0, p.offsetHeight - vh); R.push(r); y += r;
        if (i < pages.length - 1) y += F;
        p.style.transformOrigin = '0 ' + Math.round(vh / 2) + 'px';
      });
      spacer.style.height = (y + vh) + 'px';
      update();
    }
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function update() {
      ticking = false;
      if (!on || !pages.length) return;
      var y = window.scrollY, W = main.clientWidth, d = W * 3, last = pages.length - 1, k = last;
      for (var i = 0; i < last; i++) { if (y < S[i] + R[i] + F) { k = i; break; } }
      cur = k;
      var readEnd = S[k] + R[k];
      var p = (k < last && y > readEnd) ? Math.min(1, (y - readEnd) / F) : 0;
      var e = ease(p), ang = -90 * (1 - e);
      pages.forEach(function (pg, j) {
        var st = pg.style;
        if (j === k) {
          pg.classList.remove('is-off');
          st.transform = 'translate3d(0,' + (-Math.min(R[k], Math.max(0, y - S[k]))).toFixed(1) + 'px,0)';
          st.setProperty('--turn', '0');
        } else if (j === k + 1 && p > 0) {
          pg.classList.remove('is-off');
          st.transform = 'perspective(' + Math.round(d) + 'px) rotateY(' + ang.toFixed(3) + 'deg)';
          st.setProperty('--turn', (1 - e).toFixed(3));
        } else {
          pg.classList.add('is-off');
          st.transform = 'none';
        }
      });
      if (p > 0) {
        // где сейчас свободный край листа на экране (с учётом перспективы)
        var r = ang * Math.PI / 180, x3 = W * Math.cos(r), z3 = -W * Math.sin(r);
        var X = x3 * d / (d - z3);
        shade.style.visibility = 'visible';
        shade.style.zIndex = String(2 * k + 3);
        shade.style.setProperty('--x', X.toFixed(1) + 'px');
        shade.style.setProperty('--dim', (0.28 * e).toFixed(3));
      } else {
        shade.style.visibility = 'hidden';
      }
    }
    function offsetIn(el, pg) { var o = 0, n = el; while (n && n !== pg) { o += n.offsetTop; n = n.offsetParent; } return o; }
    function targetFor(el, pad) {
      var k = -1;
      for (var i = 0; i < pages.length; i++) { if (pages[i].contains(el)) { k = i; break; } }
      if (k < 0) return null;
      return { k: k, o: offsetIn(el, pages[k]), y: S[k] + Math.min(R[k], Math.max(0, offsetIn(el, pages[k]) - (pad || 0))) };
    }

    function enable() {
      if (on) return; on = true;
      var keepY = window.scrollY, keepEl = null;
      main.insertBefore(hero, main.firstChild); main.appendChild(footer);
      document.body.classList.add('book'); document.body.appendChild(spacer);
      group(); measure();
      if (keepY > 0) window.scrollTo(0, 0);
      update();
    }
    function disable() {
      if (!on) return; on = false;
      unwrap(); shade.remove(); spacer.remove();
      main.parentNode.insertBefore(hero, main);
      main.parentNode.insertBefore(footer, main.nextSibling);
      document.body.classList.remove('book');
    }

    // ссылки-якоря: прокрутка к нужной странице
    document.addEventListener('click', function (e) {
      if (!on) return;
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href').slice(1); if (!id) return;
      var el = document.getElementById(id); if (!el) return;
      var t = targetFor(el, 0); if (!t) return;
      e.preventDefault();
      window.scrollTo({ top: t.y, behavior: 'smooth' });
    });
    // фокус с клавиатуры уходит на скрытую страницу — показываем её
    document.addEventListener('focusin', function (e) {
      if (!on) return;
      var t = targetFor(e.target, vh / 3); if (!t) return;
      var shown = t.k === cur && t.o - Math.min(R[cur], Math.max(0, window.scrollY - S[cur])) >= 0 &&
                  t.o - Math.min(R[cur], Math.max(0, window.scrollY - S[cur])) < vh - 40;
      if (!shown) window.scrollTo({ top: t.y, behavior: 'instant' });
    });

    window.addEventListener('scroll', function () { if (on && !ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (wide.matches && !on) enable(); else if (!wide.matches && on) disable();
        else if (on && Math.abs(window.innerHeight - vh) > 1) { group(); measure(); } else measure();
      }, 120);
    });
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(function () { measure(); }); blocks.forEach(function (b) { ro.observe(b); }); }
    window.addEventListener('load', function () { if (on) { group(); measure(); } });
    if (wide.matches) enable();
    if (on && location.hash) { var el0 = document.getElementById(location.hash.slice(1)); var t0 = el0 && targetFor(el0, 0); if (t0) window.scrollTo(0, t0.y); }
  })();

  setText('[data-year]', String(new Date().getFullYear()));
})();
