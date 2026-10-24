/* Мерч: стороны шопера и выбор/переворот открыток */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Шопер: эмблема / девиз ---------- */
  var bag = document.querySelector('[data-mx-bag]');
  if (bag) {
    var tote = bag.querySelector('[data-tote]');
    var sideBtns = [].slice.call(bag.querySelectorAll('[data-bag-side]'));
    var labels = {
      emblem: 'Шопер «Человек Слова», сторона с эмблемой храма',
      motto: 'Шопер «Человек Слова», сторона с девизом «Я человек Слова» и QR-кодом'
    };
    var turning = false;

    function showSide(side) {
      [].forEach.call(tote.querySelectorAll('[data-side]'), function (img) {
        img.classList.toggle('is-on', img.getAttribute('data-side') === side);
      });
      tote.setAttribute('aria-label', labels[side]);
    }

    sideBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('aria-pressed') === 'true' || turning) return;
        var side = btn.getAttribute('data-bag-side');
        sideBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        if (reduce) { showSide(side); return; }
        turning = true;
        tote.classList.add('is-turning');
        setTimeout(function () {
          showSide(side);
          tote.classList.remove('is-turning');
          setTimeout(function () { turning = false; }, 200);
        }, 200);
      });
    });
  }

  /* ---------- Открытки ---------- */
  var cards = document.querySelector('[data-mx-cards]');
  if (cards) {
    var pc = cards.querySelector('[data-pc]');
    var front = cards.querySelector('[data-pc-front]');
    var flipBtn = cards.querySelector('[data-pc-flip]');
    var flipLabel = cards.querySelector('[data-pc-flip-label]');
    var titleEl = cards.querySelector('[data-pc-title]');
    var textEl = cards.querySelector('[data-pc-text]');
    var thumbs = [].slice.call(cards.querySelectorAll('.pc-thumb'));

    function setFlipped(on) {
      pc.classList.toggle('is-flipped', on);
      pc.setAttribute('aria-pressed', String(on));
      pc.setAttribute('aria-label', on ? 'Показать лицевую сторону открытки' : 'Показать оборот открытки');
      flipBtn.setAttribute('aria-pressed', String(on));
      flipLabel.textContent = on ? 'Лицевая сторона' : 'Оборот';
    }

    function toggle() { setFlipped(!pc.classList.contains('is-flipped')); }
    pc.addEventListener('click', toggle);
    flipBtn.addEventListener('click', toggle);

    thumbs.forEach(function (t) {
      t.addEventListener('click', function () {
        thumbs.forEach(function (x) { x.setAttribute('aria-pressed', String(x === t)); });
        var apply = function () {
          front.src = t.getAttribute('data-src');
          front.alt = t.getAttribute('data-alt');
          titleEl.textContent = t.getAttribute('data-title');
          textEl.textContent = t.getAttribute('data-text');
        };
        if (pc.classList.contains('is-flipped')) {
          // сначала вернуть лицевую сторону, потом сменить сюжет
          setFlipped(false);
          setTimeout(apply, reduce ? 0 : 250);
        } else {
          apply();
        }
      });
    });
  }
})();
