/* Телефон: свёрнутая «Помощь делом» и записки «О здравии / Об упокоении» со свайпом.
   На компьютере кнопка и переключатель скрыты стилями — список и бланки видны целиком. */
(function () {
  'use strict';

  /* ---------- Помощь делом: сначала два направления и край третьего ---------- */
  var toc = document.querySelector('[data-help-toc]'), more = document.querySelector('[data-help-more]');
  if (toc && more) {
    var label = more.querySelector('[data-help-more-label]');
    toc.classList.add('is-collapsed');
    more.addEventListener('click', function () {
      var open = toc.classList.toggle('is-collapsed') === false;
      more.setAttribute('aria-expanded', String(open));
      label.textContent = open ? 'Свернуть' : 'Все направления помощи';
      if (!open) toc.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  /* ---------- Записки: вкладки связаны со свайпом ---------- */
  var track = document.querySelector('[data-note-track]'), sw = document.querySelector('[data-note-switch]');
  if (track && sw) {
    var tabs = [].slice.call(sw.querySelectorAll('[data-note-tab]'));
    var notes = [].slice.call(track.querySelectorAll('.note-form'));
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function mark(i) {
      tabs.forEach(function (t, j) { t.setAttribute('aria-selected', String(i === j)); t.tabIndex = i === j ? 0 : -1; });
      sw.classList.toggle('is-second', i === 1);
    }
    function go(i) {
      var n = notes[i]; if (!n) return;
      var left = n.offsetLeft - track.offsetLeft - (track.clientWidth - n.offsetWidth) / 2;
      track.scrollTo({ left: left, behavior: reduce ? 'auto' : 'smooth' });
      mark(i);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { go(i); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); var k = e.key === 'ArrowRight' ? 1 : 0; go(k); tabs[k].focus(); }
      });
    });
    var raf = 0;
    track.addEventListener('scroll', function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        var mid = track.scrollLeft + track.clientWidth / 2, best = 0, bd = Infinity;
        notes.forEach(function (n, i) { var c = n.offsetLeft - track.offsetLeft + n.offsetWidth / 2, d = Math.abs(c - mid); if (d < bd) { bd = d; best = i; } });
        mark(best);
      });
    }, { passive: true });
    mark(0);
  }
})();
