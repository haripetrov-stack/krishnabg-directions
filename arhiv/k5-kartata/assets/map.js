/* k5-kartata: one continuous map under the scroll, from the whole of Bulgaria to the temple and the streets of Ratha Yatra in Sofia.
   The picture is a pure function of the act's scroll progress p. Nothing runs on a timer: if the visitor stops scrolling, nothing moves.
   No tiles, no map library. Bulgaria is our own SVG (Natural Earth, public domain); Sofia is our own SVG drawn from OpenStreetMap data
   (ODbL, (c) OpenStreetMap contributors) and fetched from this site. Labels, cities and photographs are real HTML laid on the map at
   real coordinates. Camera: van Wijk and Nuij smooth zoom and pan between views (the d3-zoom interpolation). */
(function () {
  'use strict';

  var W0 = 2048;                       // world width in map units (Web Mercator)
  var D2R = Math.PI / 180;
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mx(lon) { return (lon + 180) / 360 * W0; }
  function my(lat) { return (1 - Math.log(Math.tan(Math.PI / 4 + lat * D2R / 2)) / Math.PI) / 2 * W0; }
  function ilat(y) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / W0))) / D2R; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function ease(x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  // ---- van Wijk and Nuij zoom interpolation: views are {x, y, w} (centre, visible width)
  var RHO = Math.SQRT2, R2 = 2, R4 = 4;
  function zoomTo(a, b, t) {
    var dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, S;
    if (d2 < 1e-12) {
      S = Math.log(b.w / a.w) / RHO;
      return { x: a.x, y: a.y, w: a.w * Math.exp(RHO * t * S) };
    }
    var d1 = Math.sqrt(d2);
    var b0 = (b.w * b.w - a.w * a.w + R4 * d2) / (2 * a.w * R2 * d1);
    var b1 = (b.w * b.w - a.w * a.w - R4 * d2) / (2 * b.w * R2 * d1);
    var r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
    var r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
    S = (r1 - r0) / RHO;
    var s = t * S;
    var u = a.w / (R2 * d1) * (Math.cosh(r0) * Math.tanh(RHO * s + r0) - Math.sinh(r0));
    return { x: a.x + u * dx, y: a.y + u * dy, w: a.w * Math.cosh(r0) / Math.cosh(RHO * s + r0) };
  }

  // ---- timelines: [p, view] keys, camera eased between neighbours
  var TL = {
    one: { cam: [[0, 'b'], [0.10, 'b'], [0.30, 'b'], [0.46, 's1'], [0.56, 's1'], [0.68, 's2'], [1, 's2']] },
    two: { cam: [[0, 's2'], [0.08, 's2'], [0.58, 't'], [1, 't']] }
  };
  var VIEWS = {                        // lon/lat boxes [west, south, east, north]
    b: [22.2, 41.15, 28.8, 44.3],      // Bulgaria
    s1: [23.298, 42.620, 23.386, 42.698],   // Sofia: the temple in the south and the centre in the north
    s2: [23.3105, 42.6805, 23.3475, 42.6945] // the centre: Borisova gradina, Graf Ignatiev, Vitosha, NDK
  };
  var TEMPLE = [23.35686, 42.63006];

  function trap(p, a, b, c, d) {
    if (p <= a || p >= d) return p >= d && c >= d ? 1 : 0;
    if (p < b) return smooth((p - a) / (b - a));
    if (p <= c) return 1;
    return 1 - smooth((p - c) / (d - c));
  }
  function barH() {
    var b = document.querySelector('.bar');
    return (b ? b.offsetHeight : 80) + 10;
  }

  // ---- one stage = one map + its overlays
  function init(stage, key) {
    var st = { stage: stage, key: key, W: 0, H: 0, views: null, last: {} };
    st.cam = stage.querySelector('.cam');
    st.ground = stage.querySelector('.ground');
    st.lod = { b: stage.querySelector('.lod-b'), c: stage.querySelector('.lod-c'), m: stage.querySelector('.lod-m') };
    st.attr = stage.querySelector('.attr');
    st.scaleBar = stage.querySelector('.scale__bar');
    st.scaleTxt = stage.querySelector('.scale__t');
    st.ov = Array.prototype.map.call(stage.querySelectorAll('.pt'), function (el) {
      var lon = parseFloat(el.getAttribute('data-lon')), lat = parseFloat(el.getAttribute('data-lat'));
      var pp = el.getAttribute('data-p'), lit = el.getAttribute('data-lit');
      return {
        el: el, x: mx(lon), y: my(lat),
        p: pp ? pp.split(/\s+/).map(parseFloat) : null,
        lit: lit ? lit.split(/\s+/).map(parseFloat) : null,
        op: -1, vis: '', litv: -1
      };
    });
    // links inside a panel are tabbable only while that panel is on screen
    st.tabs = Array.prototype.map.call(stage.querySelectorAll('.lvl[data-tab]'), function (el) {
      var r = el.getAttribute('data-tab').split(/\s+/).map(parseFloat);
      return { links: el.querySelectorAll('a'), a: r[0], b: r[1], on: null };
    });
    layout(st);
    return st;
  }

  function layout(st) {
    var W = st.stage.clientWidth, H = st.stage.clientHeight;
    st.W = W; st.H = H;
    var top = barH(), wide = W >= 900;
    var left = clamp(W * 0.35, 360, 520);
    function rect() {
      if (wide) return [left, top, W - 20, H - 20];
      return [10, top, W - 10, Math.round(H * 0.5)];
    }
    function mk(bx, by, k, r) {
      var fx = (r[0] + r[2]) / 2, fy = (r[1] + r[3]) / 2;
      return { x: bx - (fx - W / 2) / k, y: by - (fy - H / 2) / k, w: W / k };
    }
    function fit(name) {
      var b = VIEWS[name], r = rect();
      var x0 = mx(b[0]), x1 = mx(b[2]), y0 = my(b[3]), y1 = my(b[1]);
      var k = Math.min((r[2] - r[0]) / (x1 - x0), (r[3] - r[1]) / (y1 - y0));
      return mk((x0 + x1) / 2, (y0 + y1) / 2, k, r);
    }
    var v = {};
    ['b', 's1', 's2'].forEach(function (n) { v[n] = fit(n); });
    v.t = mk(mx(TEMPLE[0]), my(TEMPLE[1]), wide ? 8500 : 4600, rect());
    st.views = v;
    st.last = {};
  }

  function keyed(keys, p, f) {         // piecewise with eased segments
    if (p <= keys[0][0]) return f(keys[0][1], keys[0][1], 0);
    for (var i = 1; i < keys.length; i++) {
      if (p <= keys[i][0]) {
        var a = keys[i - 1], b = keys[i];
        var t = b[0] === a[0] ? 1 : (p - a[0]) / (b[0] - a[0]);
        return f(a[1], b[1], ease(t));
      }
    }
    var last = keys[keys.length - 1][1];
    return f(last, last, 0);
  }

  function setOp(el, key, st, v) {
    if (!el) return;
    var s = v.toFixed(3);
    if (st.last[key] === s) return;
    st.last[key] = s;
    el.style.opacity = s;
    el.style.display = v < 0.004 ? 'none' : '';
  }

  var NICE = [1, 2, 5];
  function scaleFor(cam, k, st) {
    if (!st.scaleBar) return;
    var lat = ilat(cam.y);
    var kmPerPx = 40075.017 * Math.cos(lat * D2R) / W0 / k;
    var target = (st.W >= 900 ? 120 : 84) * kmPerPx, best = 1, mag = Math.pow(10, Math.floor(Math.log10(target)));
    for (var m = mag; m <= mag * 10; m *= 10) {
      for (var n = 0; n < NICE.length; n++) { if (NICE[n] * m <= target) best = NICE[n] * m; }
    }
    var wpx = Math.round(best / kmPerPx);
    var txt = best >= 1 ? best + ' км' : Math.round(best * 1000) + ' м';
    if (st.last.sw !== wpx) { st.last.sw = wpx; st.scaleBar.style.width = wpx + 'px'; }
    if (st.last.st !== txt) { st.last.st = txt; st.scaleTxt.textContent = txt; }
  }

  function frame(st, p) {
    var tl = TL[st.key], V = st.views;
    var cam = keyed(tl.cam, p, function (a, b, t) { return t === 0 || a === b ? V[a] : zoomTo(V[a], V[b], t); });
    var k = st.W / cam.w;
    var tx = st.W / 2 - cam.x * k, ty = st.H / 2 - cam.y * k;
    st.cam.setAttribute('transform', 'translate(' + tx.toFixed(3) + ' ' + ty.toFixed(3) + ') scale(' + k.toFixed(5) + ')');

    // level of detail follows the visible width in map units, so it is the same on every screen
    var w = cam.w;
    var bgOp = 1 - smooth((2.6 - w) / 0.8);
    setOp(st.lod.b, 'lb', st, bgOp);
    var cOp = smooth((2.2 - w) / 0.8);
    setOp(st.lod.c, 'lc', st, cOp);
    if (st.attr) { var ao = cOp.toFixed(2); if (st.last.a !== ao) { st.last.a = ao; st.attr.style.opacity = ao; } }
    setOp(st.lod.m, 'lm', st, smooth((0.75 - w) / 0.4));
    if (st.ground) {
      var g = (1 - bgOp).toFixed(3);
      if (st.last.g !== g) { st.last.g = g; st.ground.style.opacity = g; }
    }

    // labels, photographs and places: real HTML laid on the map at their real coordinates
    var sig = Math.round(cam.x * 100) + ',' + Math.round(cam.w * 1000);
    for (var i = 0; i < st.ov.length; i++) {
      var o = st.ov[i];
      var vis = o.p ? trap(p, o.p[0], o.p[1], o.p[2], o.p[3]) : 1;
      var sx = (o.x - cam.x) * k + st.W / 2, sy = (o.y - cam.y) * k + st.H / 2;
      var on = sx > -260 && sx < st.W + 260 && sy > -260 && sy < st.H + 260;
      if (!on) vis = 0;
      var s = vis.toFixed(3);
      if (on) o.el.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0)';
      if (o.op !== s) {
        o.op = s; o.el.style.opacity = s;
        var hid = vis < 0.02 ? 'hidden' : 'visible';
        if (o.vis !== hid) { o.vis = hid; o.el.style.visibility = hid; }
      }
      if (o.lit) {
        var lv = smooth((p - o.lit[0]) / (o.lit[1] - o.lit[0])).toFixed(2);
        if (o.litv !== lv) { o.litv = lv; o.el.style.setProperty('--lit', lv); }
        sig += lv;
      }
    }
    for (var t = 0; t < st.tabs.length; t++) {
      var tb = st.tabs[t], tabOn = p >= tb.a && p <= tb.b;
      if (tb.on !== tabOn) {
        tb.on = tabOn;
        for (var li = 0; li < tb.links.length; li++) tb.links[li].tabIndex = tabOn ? 0 : -1;
      }
    }
    scaleFor(cam, k, st);
    st.stage.setAttribute('data-sc-verify-state', sig);
    return cam;
  }

  // ---- the city: our own SVG from OpenStreetMap data, fetched from this site once and drawn with <use>
  var SOFIA_ORDER = {
    a: ['c-park', 'c-water', 'c-river', 'c-rail'],
    m: ['c-min-ctr', 'c-min-tmp'],
    b: ['c-sec', 'c-main']
  };
  function use(id, cls) {
    var u = document.createElementNS(NS, 'use');
    u.setAttribute('href', '#' + id);
    u.setAttribute('class', cls);
    return u;
  }
  function loadCity() {
    var defs = document.querySelector('svg.defs defs');
    return fetch('assets/sofia-map.svg').then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (txt) {
        var doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
        Array.prototype.forEach.call(doc.querySelectorAll('path'), function (p) { defs.appendChild(document.importNode(p, true)); });
        Array.prototype.forEach.call(document.querySelectorAll('.lod-c'), function (g) {
          var a = g.querySelector('.cl-a'), m = g.querySelector('.lod-m'), b = g.querySelector('.cl-b');
          SOFIA_ORDER.a.forEach(function (id) { a.appendChild(use(id, id)); });
          SOFIA_ORDER.m.forEach(function (id) { m.appendChild(use(id, id)); });
          SOFIA_ORDER.b.forEach(function (id) { b.appendChild(use(id, id)); });
        });
      }).catch(function () { /* without the city the country map still tells the story */ });
  }

  // ---- wiring
  var acts = [];
  function pOf(el) {
    var r = el.getBoundingClientRect();
    return { p: clamp(-r.top / Math.max(r.height - innerHeight, 1), 0, 1), near: r.bottom > -80 && r.top < innerHeight + 80 };
  }
  var queued = false;
  function paint(all) {
    queued = false;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i], q = pOf(a.act);
      if (!all && !q.near) continue;
      if (a.p !== q.p || all) { a.p = q.p; frame(a.st, q.p); }
    }
  }
  function request(all) {
    if (all) { acts.forEach(function (a) { layout(a.st); a.p = -1; }); }
    if (queued && !all) return;
    queued = true;
    requestAnimationFrame(function () { paint(true === all); });
  }

  // a city on the map and its row in the list answer together
  function pairHot(root) {
    var cities = root.querySelectorAll('[data-city]');
    function set(id, on) {
      for (var i = 0; i < cities.length; i++) {
        if (cities[i].getAttribute('data-city') === id) cities[i].classList.toggle('hot', on);
      }
    }
    for (var i = 0; i < cities.length; i++) {
      (function (c) {
        var id = c.getAttribute('data-city');
        c.addEventListener('mouseenter', function () { set(id, true); });
        c.addEventListener('mouseleave', function () { set(id, false); });
        c.addEventListener('focusin', function () { set(id, true); });
        c.addEventListener('focusout', function () { set(id, false); });
      })(cities[i]);
    }
  }

  function start() {
    var one = document.getElementById('karta'), two = document.getElementById('vrata');
    if (!one || !two) return;
    var s1 = one.querySelector('[data-sc-stage]'), s2 = two.querySelector('[data-sc-stage]');
    var loaded = loadCity();
    if (reduce) {
      // static and whole: every level becomes a still frame of the same map, no scroll-linked motion
      loaded.then(function () {
        var holder = document.createElement('div');
        holder.className = 'mapstatic';
        var frames = [];
        [[s1, 'one', [[0, 0], [1, 0.28], [2, 0.5], [3, 1]]], [s2, 'two', [[4, 1]]]].forEach(function (g) {
          g[2].forEach(function (lv) {
            var c = g[0].cloneNode(true);
            c.classList.add('stage--static');
            c.removeAttribute('data-sc-stage');
            c.removeAttribute('data-sc-verify-state');
            c.setAttribute('data-level', lv[0]);
            Array.prototype.forEach.call(c.querySelectorAll('[data-sc-cue]'), function (e) {
              e.removeAttribute('data-sc-cue'); e.removeAttribute('style');
              if (e.getAttribute('data-n') !== String(lv[0])) e.hidden = true;
            });
            holder.appendChild(c);
            frames.push({ el: c, key: g[1], p: lv[1] });
          });
        });
        one.parentNode.insertBefore(holder, one);
        one.hidden = true; two.hidden = true;
        one.style.display = 'none'; two.style.display = 'none';
        var states = frames.map(function (f) { pairHot(f.el); return { st: init(f.el, f.key), p: f.p }; });
        var redo = function () { states.forEach(function (s) { layout(s.st); frame(s.st, s.p); }); };
        redo();
        var t0;
        addEventListener('resize', function () { cancelAnimationFrame(t0); t0 = requestAnimationFrame(redo); });
      });
      return;
    }
    acts.push({ act: one, st: init(s1, 'one'), p: -1 });
    acts.push({ act: two, st: init(s2, 'two'), p: -1 });
    pairHot(document);
    // keyboard: a link in the door is reachable from the top; park the scroll where the door is on screen
    two.addEventListener('focusin', function () {
      if (acts[1].p >= 0.3) return;
      var r = two.getBoundingClientRect();
      scrollTo({ top: scrollY + r.top + 0.55 * (r.height - innerHeight), behavior: 'instant' });
    });
    addEventListener('scroll', function () { request(false); }, { passive: true });
    addEventListener('resize', function () { request(true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { request(true); });
    loaded.then(function () { request(true); });
    request(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
