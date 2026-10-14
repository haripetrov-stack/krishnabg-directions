/* k5-kartata: one continuous map under the scroll.
   The picture is a pure function of the act's scroll progress p. Nothing here runs on a
   timer: if the visitor stops scrolling, nothing moves. No tiles, no map library; the
   outlines are our own SVG paths (Natural Earth, public domain), the labels are real HTML.
   Camera: van Wijk and Nuij smooth zoom and pan between views (the d3-zoom interpolation). */
(function () {
  'use strict';

  var W0 = 2048;                       // world width in map units (Web Mercator)
  var D2R = Math.PI / 180;
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
    if (d2 < 1e-6) {
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

  // ---- the route: great circle New York to Sofia, precomputed in map units
  var routeEl = document.getElementById('route-data');
  var ROUTE = routeEl ? JSON.parse(routeEl.textContent) : [];
  var CUM = [0];
  for (var i = 1; i < ROUTE.length; i++) {
    CUM.push(CUM[i - 1] + Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]));
  }
  var ROUTE_LEN = CUM[CUM.length - 1] || 1;
  function routeUpTo(f) {              // f in 0..1 -> {d, head:[x,y]}
    if (f <= 0.0005) return { d: '', head: ROUTE[0] };
    var target = clamp(f, 0, 1) * ROUTE_LEN, j = 1;
    while (j < CUM.length - 1 && CUM[j] < target) j++;
    var t = (target - CUM[j - 1]) / Math.max(CUM[j] - CUM[j - 1], 1e-6);
    var hx = ROUTE[j - 1][0] + (ROUTE[j][0] - ROUTE[j - 1][0]) * t;
    var hy = ROUTE[j - 1][1] + (ROUTE[j][1] - ROUTE[j - 1][1]) * t;
    var d = 'M' + ROUTE[0][0] + ' ' + ROUTE[0][1];
    for (var q = 1; q < j; q++) d += 'L' + ROUTE[q][0] + ' ' + ROUTE[q][1];
    d += 'L' + hx.toFixed(2) + ' ' + hy.toFixed(2);
    return { d: d, head: [hx, hy] };
  }

  // ---- timelines: [p, view] keys, camera eased between neighbours; line fraction likewise
  var TL = {
    one: {
      cam: [[0, 'w'], [0.08, 'w'], [0.21, 'a'], [0.28, 'a'], [0.41, 'e'], [0.50, 'e'], [0.63, 'b'], [1, 'b']],
      line: [[0, 0], [0.08, 0], [0.21, 0.6], [0.28, 0.64], [0.41, 0.9], [0.50, 0.93], [0.63, 1], [1, 1]]
    },
    two: {
      cam: [[0, 'b'], [0.1, 'b'], [0.55, 's'], [1, 's']],
      line: [[0, 1], [1, 1]]
    }
  };
  var VIEWS = {                        // lon/lat boxes [w, s, e, n]
    w: [-180, -56, 180, 80],
    a: [-80, 24, 14, 60],
    e: [-13, 34, 43, 62],
    b: [22.2, 41.15, 28.8, 44.3]
  };
  var SOFIA = [23.3219, 42.6977];

  function trap(p, a, b, c, d) {
    if (p <= a || p >= d) return p >= d && c >= d ? 1 : 0;
    if (p < b) return smooth((p - a) / (b - a));
    if (p <= c) return 1;
    return 1 - smooth((p - c) / (d - c));
  }

  function barH() {
    var b = document.querySelector('.bar');
    return (b ? b.offsetHeight : 56) + 10;
  }

  // ---- one stage = one map + its overlays
  function init(stage, key) {
    var st = { stage: stage, key: key, W: 0, H: 0, views: null, last: {} };
    st.cam = stage.querySelector('.cam');
    st.lod = {
      w: stage.querySelector('.lod-w'), e: stage.querySelector('.lod-e'),
      b: stage.querySelector('.lod-b'), g: stage.querySelector('.lod-g')
    };
    st.route = stage.querySelectorAll('.route-line');
    st.head = stage.querySelector('.head');
    st.scaleBar = stage.querySelector('.scale__bar');
    st.scaleTxt = stage.querySelector('.scale__t');
    st.ov = Array.prototype.map.call(stage.querySelectorAll('.pt'), function (el) {
      var lon = parseFloat(el.getAttribute('data-lon')), lat = parseFloat(el.getAttribute('data-lat'));
      var pp = el.getAttribute('data-p'), lit = el.getAttribute('data-lit');
      return {
        el: el, x: mx(lon), y: my(lat),
        p: pp ? pp.split(/\s+/).map(parseFloat) : null,
        lit: lit ? lit.split(/\s+/).map(parseFloat) : null,
        link: el.tagName === 'A', op: -1, vis: '', litv: -1
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
    function rect(name) {
      if (wide) return name === 'w' ? [16, top, W - 16, H - 16] : [left, top, W - 20, H - 20];
      return [10, top, W - 10, Math.round(H * 0.5)];
    }
    function mk(bx, by, k, r) {
      var fx = (r[0] + r[2]) / 2, fy = (r[1] + r[3]) / 2;
      return { x: bx - (fx - W / 2) / k, y: by - (fy - H / 2) / k, w: W / k };
    }
    function fit(name) {
      var b = VIEWS[name], r = rect(name);
      var x0 = mx(b[0]), x1 = mx(b[2]), y0 = my(b[3]), y1 = my(b[1]);
      var k = Math.min((r[2] - r[0]) / (x1 - x0), (r[3] - r[1]) / (y1 - y0));
      return mk((x0 + x1) / 2, (y0 + y1) / 2, k, r);
    }
    var v = {};
    ['w', 'a', 'e', 'b'].forEach(function (n) { v[n] = fit(n); });
    v.s = mk(mx(SOFIA[0]), my(SOFIA[1]), wide ? 64 : 34, rect('s'));
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
    var kmPerUnit = 40075.017 * Math.cos(lat * D2R) / W0;
    var kmPerPx = kmPerUnit / k;
    var target = (st.W >= 900 ? 120 : 84) * kmPerPx, best = 1, mag = Math.pow(10, Math.floor(Math.log10(target)));
    for (var m = mag; m <= mag * 10; m *= 10) {
      for (var n = 0; n < NICE.length; n++) { if (NICE[n] * m <= target) best = NICE[n] * m; }
    }
    var wpx = Math.round(best / kmPerPx);
    var txt = (best >= 1000 ? String(best).replace(/(\d)(\d{3})$/, '$1 $2') : String(best)) + ' км';
    if (st.last.sw !== wpx) { st.last.sw = wpx; st.scaleBar.style.width = wpx + 'px'; }
    if (st.last.st !== txt) { st.last.st = txt; st.scaleTxt.textContent = txt; }
  }

  function frame(st, p) {
    var tl = TL[st.key], V = st.views;
    var cam = keyed(tl.cam, p, function (a, b, t) { return t === 0 || a === b ? V[a] : zoomTo(V[a], V[b], t); });
    var L = keyed(tl.line, p, function (a, b, t) { return a + (b - a) * t; });
    var k = st.W / cam.w;
    var tx = st.W / 2 - cam.x * k, ty = st.H / 2 - cam.y * k;
    st.cam.setAttribute('transform', 'translate(' + tx.toFixed(2) + ' ' + ty.toFixed(2) + ') scale(' + k.toFixed(5) + ')');

    // level of detail follows the visible width in map units, so it is the same on every screen
    var w = cam.w;
    var euIn = smooth((640 - w) / 100), bgIn = smooth((100 - w) / 24);
    setOp(st.lod.w, 'lw', st, 1 - euIn);
    setOp(st.lod.e, 'le', st, euIn * (1 - bgIn));
    setOp(st.lod.b, 'lb', st, bgIn);
    setOp(st.lod.g, 'lg', st, clamp((w - 450) / 300, 0, 1) * 0.9);

    // the line from 1966
    var rt = routeUpTo(L), lk = Math.round(L * 1000);
    if (st.last.rt !== lk) {
      st.last.rt = lk;
      for (var r = 0; r < st.route.length; r++) st.route[r].setAttribute('d', rt.d);
    }
    if (st.head) {
      var hx = (rt.head[0] - cam.x) * k + st.W / 2, hy = (rt.head[1] - cam.y) * k + st.H / 2;
      st.head.style.transform = 'translate3d(' + hx.toFixed(1) + 'px,' + hy.toFixed(1) + 'px,0)';
      var hv = L > 0.002 && L < 0.998 ? 1 : 0;
      if (st.last.hv !== hv) { st.last.hv = hv; st.head.style.opacity = hv; }
    }

    // labels, photographs and cities: real HTML laid on the map at their real coordinates
    var sig = Math.round(cam.x) + ',' + Math.round(cam.w) + ',' + lk;
    for (var i = 0; i < st.ov.length; i++) {
      var o = st.ov[i];
      var vis = o.p ? trap(p, o.p[0], o.p[1], o.p[2], o.p[3]) : 1;
      var sx = (o.x - cam.x) * k + st.W / 2, sy = (o.y - cam.y) * k + st.H / 2;
      var on = sx > -240 && sx < st.W + 240 && sy > -240 && sy < st.H + 240;
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
    if (all) { acts.forEach(function (a) { layout(a.st); }); }
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
    if (reduce) {
      // static and whole: every level becomes a still frame of the same map, no scroll-linked motion
      var holder = document.createElement('div');
      holder.className = 'mapstatic';
      var frames = [];
      [[s1, 'one', [[0, 0], [1, 0.245], [2, 0.455], [3, 0.7], [4, 1]]], [s2, 'two', [[5, 1]]]].forEach(function (g) {
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
    request(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
