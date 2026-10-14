/* krishnabg.com, direction k3 "Маха-мантрата": the page's own behaviour.
   The engine (scrollcraft.js) is untouched; everything bespoke lives here and reads scroll position only. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var smooth = function (x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  /* ---------------------------------------------------------------- menu -- */
  var menu = $('#menu'), menuBtn = $('.bar__menu'), menuClose = $('.menu__close');
  var behind = $$('main, .foot, .bar, .skip');
  function openMenu() {
    menu.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    root.classList.add('menu-open');
    behind.forEach(function (n) { n.inert = true; });
    menuClose.focus();
  }
  function closeMenu() {
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
    root.classList.remove('menu-open');
    behind.forEach(function (n) { n.inert = false; });
    menuBtn.focus();
  }
  if (menu && menuBtn) {
    menuBtn.addEventListener('click', openMenu);
    menuClose.addEventListener('click', closeMenu);
    menu.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('button, a[href]', menu);
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }
  // Pages that are not built yet: the link stays, and does nothing.
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[aria-disabled="true"]');
    if (a) e.preventDefault();
  });

  /* ------------------------------------------------------ word meanings -- */
  var card = $('#meaning'), openBtn = null, openY = 0;
  var TITLES = { hare: 'Харе', krishna: 'Кришна', rama: 'Рама' };
  var MEANING = {};
  $$('#meanings [data-w]').forEach(function (p) { MEANING[p.getAttribute('data-w')] = p.textContent.trim(); });
  function hideCard() {
    if (!card) return;
    card.hidden = true;
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    openBtn = null;
  }
  function showCard(btn) {
    var k = btn.getAttribute('data-w');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    openBtn = btn;
    btn.setAttribute('aria-expanded', 'true');
    $('.meaning__t', card).textContent = TITLES[k];
    $('.meaning__d', card).textContent = MEANING[k];
    card.classList.toggle('meaning--light', !!btn.closest('.plum'));
    card.hidden = false;
    var r = btn.getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight;
    var left = clamp(r.left + r.width / 2 - cw / 2, 12, innerWidth - cw - 12);
    var top = r.bottom + 12;
    if (top + ch > innerHeight - 12) top = Math.max(12, r.top - ch - 12);
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    openY = scrollY;
  }
  if (card) {
    doc.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.w');
      if (b) { if (b === openBtn) hideCard(); else showCard(b); return; }
      if (!e.target.closest('#meaning')) hideCard();
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (menu && !menu.hidden) { closeMenu(); return; }
      if (openBtn) { var b = openBtn; hideCard(); b.focus(); }
    });
    addEventListener('scroll', function () {
      if (openBtn && Math.abs(scrollY - openY) > 140) hideCard();
    }, { passive: true });
  }

  /* --------------------------------------------------------- the score -- */
  var hero = $('#start');
  if (!hero) return;
  if (window.ScrollCraft) window.ScrollCraft.mount(doc.body);

  var LINES = [
    ['Харе', 'Кришна,', 'Харе', 'Кришна,'],
    ['Кришна', 'Кришна,', 'Харе', 'Харе'],
    ['Харе', 'Рама,', 'Харе', 'Рама,'],
    ['Рама', 'Рама,', 'Харе', 'Харе']
  ];
  var bar = $('.bar'), barWords = $$('.bw', bar), ring = $('.orb__ring'), plum = $('#plum');
  var peakPhoto = $('.peak__photo'), peakText = $('.peak__text'), peakRim = $('.peak__rim'),
      peakCircle = $('.peak__rim circle'), peakPlate = $('.peak__plate'), peakCap = $('.peak__cap');
  var closeEl = $('#close'), stanza = $$('.stanza__l');
  var opens = [], moves = [], vh = 0, vw = 0, geo = { peak: null, close: null };
  var barLine = -1;

  // A word inside a pinned stage that takes keyboard focus: park the page where that stage is held,
  // instantly, because the smooth scroll would glide through everything in between.
  doc.addEventListener('focusin', function (e) {
    var w = e.target.closest && e.target.closest('.w');
    if (!w) return;
    var st = w.closest('[data-open]');
    var o = opens.filter(function (x) { return x.el === st; })[0];
    if (!o) return;
    var r = w.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= vh && r.width > 0) return;
    scrollTo({ top: o.top + (o.el.id === 'peak' ? 0.56 * vh : (o.h - vh) * 0.5), behavior: 'instant' });
  });

  function put(el, prop, v) {
    var s = v.toFixed(2);
    if (el['_' + prop] !== s) { el['_' + prop] = s; el.style.setProperty('--' + prop, s); }
  }
  // Word k is sung when q has reached its slot; the one just sung is the current one.
  function sing(words, q) {
    var n = words.length, k0 = q * (n + 0.6);
    for (var i = 0; i < n; i++) {
      var lit = clamp((k0 - i) / 0.35, 0, 1);
      var next = clamp((k0 - i - 1) / 0.35, 0, 1);
      put(words[i], 'lit', lit);
      put(words[i], 'cur', lit - next);
    }
    return k0;
  }
  function sig(el, s) { if (el._sig !== s) { el._sig = s; el.setAttribute('data-sc-verify-state', s); } }

  function measure() {
    vh = innerHeight; vw = innerWidth;
    var y = scrollY;
    function box(el) { var r = el.getBoundingClientRect(); return { el: el, top: r.top + y, h: r.height }; }
    opens = $$('[data-open]').map(function (el) {
      var b = box(el);
      b.i = +el.getAttribute('data-open') - 1;
      b.stage = $('[data-sc-stage]', el);
      b.words = $$('.w', el);
      return b;
    });
    moves = $$('[data-move]').map(function (el) { var b = box(el); b.i = +el.getAttribute('data-move') - 1; return b; });
    geo.close = closeEl ? box(closeEl) : null;
    geo.plum = plum ? box(plum) : null;
    var stage = $('.peak__stage');
    if (stage) {
      var r = stage.getBoundingClientRect();
      geo.W = r.width; geo.H = r.height;
      peakRim.setAttribute('viewBox', '0 0 ' + Math.round(r.width) + ' ' + Math.round(r.height));
      peakCircle.setAttribute('cx', (r.width / 2).toFixed(1));
      peakCircle.setAttribute('cy', (r.height / 2).toFixed(1));
    }
    frame();
  }

  function setBarLine(i) {
    if (i === barLine) return;
    barLine = i;
    barWords.forEach(function (w, k) { w.textContent = LINES[i][k]; });
  }

  function frame() {
    var y = scrollY, i, o, q;
    if (ring && !reduce) ring.style.transform = 'rotate(' + (y * 0.06).toFixed(2) + 'deg)';
    if (geo.plum) bar.classList.toggle('on-plum', geo.plum.top - y <= 28 && geo.plum.top + geo.plum.h - y >= 28);
    if (reduce) {
      setBarLine(0);
      return;
    }

    // the four openings: the line is sung word by word while the stage holds
    for (i = 0; i < opens.length; i++) {
      o = opens[i];
      var isPeak = o.el.id === 'peak';
      if (y < o.top - 1.3 * vh || y > o.top + o.h + 0.3 * vh) continue;
      var y0 = o.top - (isPeak ? 0.4 : 0.45) * vh, y1 = o.top + (o.h - vh) - (isPeak ? 0 : 0.06 * vh);
      q = clamp((y - y0) / Math.max(y1 - y0, 1), 0, 1);
      var uw = isPeak ? clamp(q / 0.40, 0, 1) : q;
      sing(o.words, uw);
      var s = (uw * 10 | 0) + '';
      if (isPeak) {
        var u2 = clamp((q - 0.50) / 0.12, 0, 1);
        var u3 = smooth((q - 0.60) / 0.30);
        var u4 = smooth((q - 0.90) / 0.10);
        var R = Math.sqrt(geo.W * geo.W + geo.H * geo.H) / 2 * 1.03, r = u3 * R;
        peakText.style.opacity = (1 - u2).toFixed(3);
        peakText.style.transform = 'translate3d(0,' + (-8 * u2).toFixed(2) + 'vh,0)';
        peakText.style.visibility = u2 >= 1 ? 'hidden' : 'visible';
        peakPhoto.style.clipPath = 'circle(' + r.toFixed(1) + 'px at 50% 50%)';
        peakCircle.setAttribute('r', r.toFixed(1));
        peakRim.style.opacity = r > 1 ? (1 - smooth((u3 - 0.82) / 0.18)).toFixed(3) : '0';
        peakPlate.style.opacity = u4.toFixed(3);
        peakCap.style.opacity = u4.toFixed(3);
        s += '|' + u2.toFixed(1) + '|' + u3.toFixed(1) + '|' + u4.toFixed(1);
      }
      sig(o.stage, s);
    }

    // the four lines come together
    if (geo.close) {
      var c = geo.close;
      if (y > c.top - 1.3 * vh && y < c.top + c.h + 0.3 * vh) {
        q = clamp((y - (c.top - 0.4 * vh)) / Math.max((c.h - vh) + 0.4 * vh, 1), 0, 1);
        var e = smooth((q - 0.05) / 0.7), spread = (vw <= 640 ? 0.045 : 0.16) * vw;
        stanza.forEach(function (l, k) {
          l.style.transform = 'translate3d(' + ((k % 2 ? 1 : -1) * spread * (1 - e)).toFixed(1) + 'px,0,0)';
          l.style.opacity = (0.3 + 0.7 * e).toFixed(3);
        });
        sig($('[data-sc-stage]', closeEl), e.toFixed(1));
      }
    }

    // the bar: which line is current, and how far into it the reader is
    var line = 0;
    for (i = 0; i < opens.length; i++) if (y >= opens[i].top - 0.5 * vh) line = opens[i].i;
    setBarLine(line);
    var m = moves[line], p = 0;
    if (m && y >= opens[line].top - 0.5 * vh) {
      var a = m.top - 0.2 * vh, b = m.top + m.h - 0.5 * vh;
      p = clamp((y - a) / Math.max(b - a, 1), 0, 1);
    }
    sing(barWords, p);
  }

  var ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; frame(); }); } }
  function later() { requestAnimationFrame(measure); }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', later, { passive: true });
  addEventListener('load', later);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(later);
  later();
})();
