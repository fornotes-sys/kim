/* Выпадающий список «на пергаменте» для <select data-parchment>.
   Настоящий <select> остаётся в форме (скрыт) и всегда хранит выбранное значение.
   Работает и на телефонах: все формы сайта в одном стиле «пергамента». */
(function () {
  'use strict';

  var uid = 0;
  [].forEach.call(document.querySelectorAll('select[data-parchment]'), function (sel) {
    var id = 'ps-' + (++uid);
    var wrap = document.createElement('div');
    wrap.className = 'ps';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.classList.add('ps__native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ps__btn';
    btn.id = sel.id ? sel.id + '-btn' : id + '-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', id);
    var label = sel.closest('label');
    if (label) {
      // подпись поля читается вместе с кнопкой; клик по подписи открывает список
      var lid = id + '-label';
      var txt = document.createElement('span');
      txt.id = lid; txt.className = 'visually-hidden';
      txt.textContent = (label.firstChild && label.firstChild.nodeType === 3 ? label.firstChild.textContent : '').trim();
      wrap.appendChild(txt);
      btn.setAttribute('aria-labelledby', lid + ' ' + btn.id);
      if (sel.id) label.setAttribute('for', btn.id);
    }
    var val = document.createElement('span');
    val.className = 'ps__value';
    btn.appendChild(val);
    btn.insertAdjacentHTML('beforeend', '<svg class="ps__chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5 6 6.5l5-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    wrap.appendChild(btn);

    var list = document.createElement('ul');
    list.className = 'ps__list';
    list.id = id;
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    list.hidden = true;
    [].forEach.call(sel.options, function (o, i) {
      var li = document.createElement('li');
      li.className = 'ps__opt';
      li.id = id + '-o' + i;
      li.setAttribute('role', 'option');
      li.dataset.index = i;
      li.innerHTML = '<span class="ps__mark" aria-hidden="true">✠</span><span></span>';
      li.lastChild.textContent = o.textContent;
      list.appendChild(li);
    });
    wrap.appendChild(list);
    var opts = [].slice.call(list.children);
    var active = sel.selectedIndex;

    function render() {
      val.textContent = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '';
      opts.forEach(function (li, i) { li.setAttribute('aria-selected', String(i === sel.selectedIndex)); });
    }
    function setActive(i) {
      active = Math.max(0, Math.min(opts.length - 1, i));
      opts.forEach(function (li, k) { li.classList.toggle('is-active', k === active); });
      list.setAttribute('aria-activedescendant', opts[active].id);
      var li = opts[active];
      if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop;
      else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight;
    }
    function open() {
      if (!list.hidden) return;
      list.hidden = false;
      wrap.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      setActive(sel.selectedIndex);
      list.focus({ preventScroll: true });
    }
    function close(refocus) {
      if (list.hidden) return;
      list.hidden = true;
      wrap.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      if (refocus) btn.focus();
    }
    function choose(i) {
      if (sel.selectedIndex !== i) {
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      render();
      close(true);
    }

    btn.addEventListener('click', function () { list.hidden ? open() : close(true); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    list.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
      else if (e.key === 'End') { e.preventDefault(); setActive(opts.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') { close(false); }
    });
    list.addEventListener('mousemove', function (e) {
      var li = e.target.closest('.ps__opt'); if (li) setActive(+li.dataset.index);
    });
    list.addEventListener('click', function (e) {
      e.preventDefault(); // иначе клик уйдёт в <label> и снова откроет список
      var li = e.target.closest('.ps__opt'); if (li) choose(+li.dataset.index);
    });
    document.addEventListener('pointerdown', function (e) { if (!wrap.contains(e.target)) close(false); });
    sel.addEventListener('change', render);
    if (sel.form) sel.form.addEventListener('reset', function () { setTimeout(render, 0); });
    render();
  });
})();
