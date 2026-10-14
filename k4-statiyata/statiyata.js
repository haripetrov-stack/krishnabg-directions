/* k4-statiyata: page behaviour (no framework, no network except one same-origin JSON).
   1. links to pages that are not built yet do nothing
   2. header: menu panel and search field on narrow screens
   3. search in the site (index built from the pages, matched in the page)
   4. contents: open on wide screens, collapsed on narrow ones
   5. signature: the "Накратко" table follows the reading position */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* 1 ---------------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[aria-disabled="true"]');
    if (a) e.preventDefault();
  });

  /* 2 ---------------------------------------------------------------- */
  var menu = $('#menu'), btnMenu = $('#btn-menu'), box = $('#search'), btnSearch = $('#btn-search'), q = $('#q');
  function setMenu(open) {
    if (!menu || !btnMenu) return;
    menu.classList.toggle('is-open', open);
    btnMenu.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function setSearch(open) {
    if (!box || !btnSearch) return;
    box.classList.toggle('is-open', open);
    btnSearch.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { setMenu(false); if (q) q.focus(); }
  }
  if (btnMenu) btnMenu.addEventListener('click', function () {
    var open = !menu.classList.contains('is-open');
    setMenu(open);
    if (open) setSearch(false);
  });
  if (btnSearch) btnSearch.addEventListener('click', function () {
    setSearch(!box.classList.contains('is-open'));
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { setMenu(false); closeResults(); if (box && box.classList.contains('is-open')) { setSearch(false); if (btnSearch) btnSearch.focus(); } }
  });

  /* 3 ---------------------------------------------------------------- */
  var results = $('#results');
  var INDEX = null, loading = false;

  function textOf(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  // Fallback when the JSON is not reachable (file://): index this page only.
  function indexFromDom() {
    var out = [];
    var page = location.pathname.split('/').pop() || 'index.html';
    $$('.body section[id]').forEach(function (sec) {
      var h = sec.querySelector('h2, h3');
      if (!h) return;
      var parts = [];
      Array.prototype.forEach.call(sec.children, function (c) {
        if (c.tagName !== 'SECTION' && c !== h) parts.push(textOf(c));
      });
      out.push({ t: textOf(h), u: page + '#' + sec.id, s: parts.join(' ') });
    });
    return out;
  }

  function loadIndex(done) {
    if (INDEX) return done();
    if (loading) return;
    loading = true;
    fetch('assets/search-index.json', { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { INDEX = j; })
      .catch(function () { INDEX = indexFromDom(); })
      .then(function () { loading = false; done(); });
  }

  // Bulgarian is inflected: from five letters up the last two are dropped before matching.
  // Question words are ignored when something else was typed ("къде сте в София").
  var STOP = ' в на и с за от до по ли е са се да не ни ти те ме къде кога как какво кои коя кой дали сте съм сме ние вие като при ако или но а то ' ;
  function stem(t) { return t.length > 5 ? t.slice(0, t.length - 2) : t; }
  function tokens(s) {
    var all = s.toLowerCase().split(/[\s,.;:!?()"„“]+/).filter(Boolean);
    var kept = all.filter(function (t) { return STOP.indexOf(' ' + t + ' ') < 0; });
    return (kept.length ? kept : all).map(stem);
  }

  function run(query) {
    var tk = tokens(query), out = [];
    if (!tk.length) return { tk: tk, list: out };
    INDEX.forEach(function (it) {
      var title = it.t.toLowerCase(), hay = title + ' ' + it.s.toLowerCase(), score = 0;
      var hit = 0;
      for (var i = 0; i < tk.length; i++) {
        if (hay.indexOf(tk[i]) < 0) continue;
        hit++;
        score += title.indexOf(tk[i]) >= 0 ? 3 : 1;
      }
      if (hit < Math.ceil(tk.length / 2)) return;
      out.push({ it: it, score: score + hit * 10 });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return { tk: tk, list: out.slice(0, 6) };
  }

  function mark(parent, text, tk) {
    var low = text.toLowerCase(), pos = 0;
    while (pos < text.length) {
      var best = -1, len = 0;
      for (var i = 0; i < tk.length; i++) {
        var k = low.indexOf(tk[i], pos);
        if (k >= 0 && (best < 0 || k < best)) { best = k; len = tk[i].length; }
      }
      if (best < 0) break;
      if (best > pos) parent.appendChild(document.createTextNode(text.slice(pos, best)));
      var m = document.createElement('mark');
      m.textContent = text.slice(best, best + len);
      parent.appendChild(m);
      pos = best + len;
    }
    if (pos < text.length) parent.appendChild(document.createTextNode(text.slice(pos)));
  }

  function snippet(s, tk) {
    var low = s.toLowerCase(), at = -1;
    for (var i = 0; i < tk.length; i++) { var k = low.indexOf(tk[i]); if (k >= 0 && (at < 0 || k < at)) at = k; }
    var from = Math.max(0, at - 50), to = Math.min(s.length, (at < 0 ? 0 : at) + 110);
    return (from > 0 ? '… ' : '') + s.slice(from, to).trim() + (to < s.length ? ' …' : '');
  }

  function render(res) {
    results.textContent = '';
    var ul = document.createElement('ul');
    if (!res.list.length) {
      var none = document.createElement('p');
      none.className = 'none';
      none.appendChild(document.createTextNode('Няма резултат. '));
      var a = document.createElement('a');
      a.href = 'index.html#kontakti';
      a.textContent = 'Пишете ни';
      none.appendChild(a);
      results.appendChild(none);
    } else {
      res.list.forEach(function (r) {
        var li = document.createElement('li'), link = document.createElement('a'),
            b = document.createElement('b'), sp = document.createElement('span');
        link.href = r.it.u;
        mark(b, r.it.t, res.tk);
        mark(sp, snippet(r.it.s, res.tk), res.tk);
        link.appendChild(b); link.appendChild(sp);
        li.appendChild(link); ul.appendChild(li);
      });
      results.appendChild(ul);
    }
    results.hidden = false;
    q.setAttribute('aria-expanded', 'true');
  }

  function closeResults() {
    if (!results || results.hidden) return;
    results.hidden = true;
    if (q) q.setAttribute('aria-expanded', 'false');
  }

  if (q && results) {
    q.addEventListener('focus', function () { loadIndex(function () {}); });
    q.addEventListener('input', function () {
      var v = q.value.trim();
      if (!v) { closeResults(); return; }
      loadIndex(function () { if (q.value.trim()) render(run(q.value)); });
    });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        var first = $('a', results);
        if (first) { e.preventDefault(); first.focus(); }
      } else if (e.key === 'Enter') {
        var f = $('a', results);
        if (f) { e.preventDefault(); f.click(); }
      }
    });
    results.addEventListener('keydown', function (e) {
      var links = $$('a', results), i = links.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i < links.length - 1) { e.preventDefault(); links[i + 1].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? links[i - 1] : q).focus(); }
    });
    results.addEventListener('click', function (e) {
      if (e.target.closest('a')) { closeResults(); if (box.classList.contains('is-open')) setSearch(false); }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#search')) closeResults();
    });
    document.addEventListener('keydown', function (e) {
      var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (btnSearch && getComputedStyle(btnSearch).display !== 'none') setSearch(true); else q.focus();
      }
    });
  }

  /* 4 ---------------------------------------------------------------- */
  var det = $('#toc-details');
  var wide = window.matchMedia('(min-width: 1200px)');
  function syncToc() { if (det) det.open = wide.matches; }
  if (det) {
    syncToc();
    if (wide.addEventListener) wide.addEventListener('change', syncToc);
    det.addEventListener('toggle', function () { if (wide.matches && !det.open) det.open = true; });
  }

  /* 5 ---------------------------------------------------------------- */
  var rows = {};
  $$('.infobox tr[data-row]').forEach(function (tr) { rows[tr.getAttribute('data-row')] = tr; });
  var marks = $$('[data-row]').filter(function (el) { return el.tagName !== 'TR'; });
  var follow = marks.length && $('.infobox') && !$('.infobox--plain');

  var tocBy = {};
  $$('.toc a[href^="#"]').forEach(function (a) { tocBy[a.getAttribute('href').slice(1)] = a; });

  var strip = $('#strip'), stripR = $('#strip-r'), info = $('#nakratko'), infoVisible = true;
  var curEl = null, curRow = null, curToc = null;

  function tocIdOf(el) {
    while (el && el !== document.body) {
      if (el.id && tocBy[el.id]) return el.id;
      el = el.parentElement;
    }
    return null;
  }

  function keepTocVisible(a) {
    if (!det || !wide.matches) return;
    var ar = a.getBoundingClientRect(), cr = det.getBoundingClientRect();
    if (ar.top < cr.top) det.scrollTop -= (cr.top - ar.top) + 8;
    else if (ar.bottom > cr.bottom) det.scrollTop += (ar.bottom - cr.bottom) + 8;
  }

  function updateStrip() {
    if (!strip) return;
    var tr = curRow && rows[curRow];
    if (!tr || infoVisible) { strip.hidden = true; return; }
    stripR.textContent = '';
    var b = document.createElement('b');
    b.textContent = textOf(tr.querySelector('th'));
    stripR.appendChild(b);
    stripR.appendChild(document.createTextNode(': ' + textOf(tr.querySelector('td'))));
    strip.hidden = false;
  }

  function activate(el) {
    if (el === curEl) return;
    curEl = el;
    var key = el.getAttribute('data-row') || null;

    var tid = tocIdOf(el), next = tid ? tocBy[tid] : null;
    if (next !== curToc) {
      if (curToc) curToc.removeAttribute('aria-current');
      curToc = next;
      if (curToc) { curToc.setAttribute('aria-current', 'location'); keepTocVisible(curToc); }
    }

    if (key !== curRow) {
      var prev = curRow && rows[curRow];
      if (prev) {
        prev.removeAttribute('data-state');
        prev.removeAttribute('aria-current');
        prev.setAttribute('data-seen', 'true');
      }
      curRow = key;
      var now = key && rows[key];
      if (now) { now.setAttribute('data-state', 'current'); now.setAttribute('aria-current', 'true'); }
      updateStrip();
    }
  }

  if (follow && 'IntersectionObserver' in window) {
    // A 1% band 36% down the viewport is the reading line; the last marked element
    // in document order that touches it (the deepest section) is what is being read.
    var live = [], jumping = false;
    var release = function () { if (jumping) { jumping = false; pick(); } };
    var pick = function () {
      if (jumping) return;
      var best = null;
      for (var i = 0; i < marks.length; i++) if (live.indexOf(marks[i]) >= 0) best = marks[i];
      if (!best && window.scrollY < window.innerHeight * 0.5) best = marks[0];
      if (best) activate(best);
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = live.indexOf(e.target);
        if (e.isIntersecting) { if (i < 0) live.push(e.target); }
        else if (i >= 0) live.splice(i, 1);
      });
      pick();
    }, { rootMargin: '-36% 0px -63% 0px', threshold: 0 });
    marks.forEach(function (m) { io.observe(m); });

    if (info) new IntersectionObserver(function (en) {
      infoVisible = en[0].isIntersecting;
      updateStrip();
    }, { threshold: 0.15 }).observe(info);

    // A tap on a section in the contents, or on a row label, lights its row at once and keeps
    // it while the page glides there; any new input by the reader gives the reading line back.
    ['scrollend', 'wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (n) {
      window.addEventListener(n, release, { passive: true });
    });
    $$('.toc a[href^="#"], .infobox th a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function () {
        var t = document.getElementById(a.getAttribute('href').slice(1));
        if (t && t.hasAttribute('data-row')) {
          activate(t);
          if ('onscrollend' in window && Math.abs(t.getBoundingClientRect().top - 84) > 4) jumping = true;
        }
        if (det && !wide.matches && a.closest('.toc')) det.open = false;
      });
    });
  } else {
    $$('.toc a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function () { if (det && !wide.matches) det.open = false; });
    });
  }
})();
