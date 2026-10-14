/* site.js: the "Попитайте" field, the phone menu, inert links. No dependencies.
   The engine (scrollcraft.js) only reveals sections once as they enter the screen. */
(function () {
  'use strict';

  if (window.ScrollCraft) { window.ScrollCraft.mount(document.body); }

  var DATA = window.ASK_DATA || [];
  var ARROW = '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-arrow"/></svg>';
  var CONTACT = document.body.getAttribute('data-contact') || '#registraciya';

  /* ---- search ---------------------------------------------------------- */
  var STOP = {};
  ('и в на с за от да се е са ли ще не по ни ви си ми ти то но че как кой коя кое кои какво какви какъв ' +
   'когато къде защо дали сте съм сме има при до или това тази този тези моля мога може трябва ние вие ако ' +
   'без още само също вече бил била били всичко всеки ваш ваше вашите').split(' ').forEach(function (w) { STOP[w] = 1; });

  function norm(s) { return String(s).toLocaleLowerCase('bg').replace(/[„“”"«»]/g, ' ').replace(/ѝ/g, 'и'); }
  function words(s) { return norm(s).match(/[\p{L}\p{N}]+/gu) || []; }
  function stem(w) { return w.length <= 4 ? w : w.slice(0, Math.max(4, w.length - 2)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  DATA.forEach(function (e) { e._t = words(e.h); e._x = words(e.x); e._k = words(e.k || ''); });

  // A short stem has to match a whole word (plus an ending of up to two letters), so "бог" does not match a long word such as "богове".
  function has(list, st) {
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (w.indexOf(st) === 0 && (st.length >= 4 || w.length <= st.length + 2)) return true;
    }
    return false;
  }

  function search(q) {
    var toks = words(q).filter(function (w) { return w.length >= 3 && !STOP[w]; });
    if (!toks.length) return { valid: false, hits: [], stems: [] };
    var stems = toks.map(stem);
    var idf = stems.map(function (st) {
      var df = 0;
      DATA.forEach(function (e) { if (has(e._t, st) || has(e._x, st) || has(e._k, st)) df++; });
      return Math.log(1 + DATA.length / (1 + df));
    });
    var scored = [];
    DATA.forEach(function (e, n) {
      var s = 0;
      stems.forEach(function (st, i) {
        var w = has(e._t, st) ? 3 : (has(e._k, st) ? 2.5 : (has(e._x, st) ? 1 : 0));
        s += w * idf[i];
      });
      if (s > 0) scored.push({ e: e, s: s, n: n });
    });
    scored.sort(function (a, b) { return b.s - a.s || a.n - b.n; });
    var top = scored.length ? scored[0].s : 0;
    var hits = scored.filter(function (r) { return r.s >= top * 0.42; }).map(function (r) { return r.e; });
    return { valid: true, hits: hits, stems: stems };
  }

  function highlighter(stems) {
    if (!stems.length) return function (s) { return s; };
    var re = new RegExp('(^|[^\\p{L}\\p{N}])(' + stems.map(reEsc).join('|') + ')([\\p{L}\\p{N}]*)', 'giu');
    return function (s) { return s.replace(re, '$1<mark>$2$3</mark>'); };
  }

  function item(e, hl) {
    var off = e.u === '#';
    return '<li><a href="' + esc(e.u) + '"' + (off ? ' aria-disabled="true" title="Страницата още не е в прототипа"' : '') + '>' +
      '<span class="res__type">' + esc(e.t) + '</span>' +
      '<span class="res__title">' + hl(esc(e.h)) + '</span>' +
      '<span class="res__text">' + hl(esc(e.x)) + '</span></a></li>';
  }

  function none() {
    return '<p class="none">Не намерихте отговор? <a class="link" href="' + esc(CONTACT) + '" data-contact-link>Пишете ни ' + ARROW + '</a></p>';
  }

  /* One field, two places: the bar on a wide screen (results in a panel under it)
     and the big field on the first page (results in the page). */
  function Ask(opts) {
    var input = opts.input, out = opts.out, max = opts.max, panel = opts.panel, status = opts.status, chips = opts.chips;

    function open(on) { if (panel) { out.hidden = !on; } }
    function render() {
      var q = input.value.trim();
      if (!q) { out.innerHTML = ''; open(false); if (chips) chips.hidden = false; if (status) status.textContent = ''; return; }
      var r = search(q);
      if (!r.valid) { out.innerHTML = ''; open(false); if (chips) chips.hidden = false; return; }
      if (chips) chips.hidden = true;
      var hl = highlighter(r.stems);
      var list = r.hits.slice(0, max);
      out.innerHTML = list.length
        ? '<ul class="res">' + list.map(function (e) { return item(e, hl); }).join('') + '</ul>' + (panel ? '' : none())
        : none();
      open(true);
      if (status) status.textContent = list.length ? 'Отговори: ' + list.length : 'Няма отговор';
    }

    input.addEventListener('input', render);
    input.addEventListener('focus', function () { if (panel && input.value.trim()) render(); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (panel && !out.hidden) { open(false); ev.preventDefault(); }
        else if (input.value) { input.value = ''; render(); ev.preventDefault(); }
      } else if (ev.key === 'ArrowDown') {
        var first = out.querySelector('a');
        if (first && (!panel || !out.hidden)) { first.focus(); ev.preventDefault(); }
      }
    });
    out.addEventListener('keydown', function (ev) {
      var links = Array.prototype.slice.call(out.querySelectorAll('a'));
      var i = links.indexOf(document.activeElement);
      if (i < 0) return;
      if (ev.key === 'ArrowDown') { (links[i + 1] || links[i]).focus(); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp') { (i ? links[i - 1] : input).focus(); ev.preventDefault(); }
      else if (ev.key === 'Escape') { open(false); input.focus(); ev.preventDefault(); }
    });
    if (panel) {
      document.addEventListener('click', function (ev) { if (!opts.form.contains(ev.target)) open(false); });
      opts.form.addEventListener('focusout', function (ev) {
        if (ev.relatedTarget && !opts.form.contains(ev.relatedTarget)) open(false);
      });
      out.addEventListener('click', function (ev) { if (ev.target.closest('a:not([aria-disabled="true"])')) open(false); });
    }
    opts.form.addEventListener('submit', function (ev) { ev.preventDefault(); if (opts.onSubmit) opts.onSubmit(); });
    return { render: render };
  }

  var mainInput = document.getElementById('ask-main');
  var mainAsk = null;
  if (mainInput) {
    var chips = document.querySelector('.chips');
    mainAsk = Ask({
      form: mainInput.closest('form'), input: mainInput, out: document.getElementById('ask-out'),
      max: 6, panel: false, status: document.getElementById('ask-status'), chips: chips
    });
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (b) {
      b.addEventListener('click', function () {
        mainInput.value = b.getAttribute('data-q');
        mainAsk.render();
        mainInput.focus();
      });
    });
  }

  var barInput = document.getElementById('ask-bar');
  if (barInput) {
    Ask({
      form: barInput.closest('form'), input: barInput, out: document.getElementById('ask-pop'),
      max: 4, panel: true, status: document.getElementById('ask-bar-status'),
      onSubmit: function () {
        // On the first page the question moves into the big field, where the answers have room.
        if (mainInput && barInput.value.trim()) {
          mainInput.value = barInput.value;
          mainAsk.render();
          document.getElementById('poproste').scrollIntoView();
          mainInput.focus({ preventScroll: true });
          document.getElementById('ask-pop').hidden = true;
        }
      }
    });
  }

  /* ---- inert links: the other pages are not part of the prototype -------- */
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[aria-disabled="true"]');
    if (a) ev.preventDefault();
  });

  /* ---- keyboard focus must never land on something still waiting to appear - */
  document.addEventListener('focusin', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var box = t.closest('[data-sc-in]');
    if (box) {
      box.classList.add('sc-in');
      if (box.hasAttribute('data-sc-stagger')) Array.prototype.forEach.call(box.children, function (k) { k.classList.add('sc-in'); });
    }
    var kid = t.closest('[data-sc-stagger] > *');
    if (kid) kid.classList.add('sc-in');
  });

  /* ---- an FAQ answer found by the field opens when its link is followed -- */
  function openFromHash() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (el && el.tagName === 'DETAILS') el.open = true;
    if (id === 'poproste' && mainInput) { setTimeout(function () { mainInput.focus({ preventScroll: true }); }, 50); }
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();

  /* ---- phone menu -------------------------------------------------------- */
  var menuBtn = document.getElementById('menu-btn');
  var sheet = document.getElementById('sheet');
  if (menuBtn && sheet) {
    function setMenu(on, focusBack) {
      sheet.hidden = !on;
      menuBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) { var a = sheet.querySelector('a'); if (a) a.focus(); }
      else if (focusBack) menuBtn.focus();
    }
    menuBtn.addEventListener('click', function () { setMenu(sheet.hidden, false); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !sheet.hidden) setMenu(false, true); });
    document.addEventListener('click', function (ev) {
      if (!sheet.hidden && !sheet.contains(ev.target) && !menuBtn.contains(ev.target)) setMenu(false, false);
    });
  }
})();
