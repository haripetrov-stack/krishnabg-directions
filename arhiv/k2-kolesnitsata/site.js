/* The procession. One pinned act (engine); this file turns its scroll position into:
   a layered hero that pulls back, a street that moves between five stops, a peak at "България",
   and the signature: the rope in the foreground slides under the scroll and the chariot advances with it. */
(function () {
  'use strict';
  var html = document.documentElement;
  var show = document.getElementById('shestvie');
  var pin = html.classList.contains('pin');
  var SPAN = 14.5, TR = SPAN - 1;               // act length and pinned travel, in viewport heights

  if (pin) { show.setAttribute('data-sc-act', 'pin'); show.setAttribute('data-sc-span', String(SPAN)); }
  ScrollCraft.mount(document.body);
  if (!pin) return;

  // ---- the score, in viewport-heights of travel --------------------------------
  var PULL = [0.55, 2.1];                       // hero layers pull back
  var STOPS = [                                 // enter start, settled, exit start, gone
    [2.2, 2.8, 3.7, 4.2],                       // Кои сме
    [3.7, 4.3, 5.2, 5.7],                       // Учение
    [5.2, 5.8, 6.7, 7.2],                       // Практика
    [7.7, 8.4, 10.6, 11.1],                     // България (the peak, longest hold)
    [10.7, 11.3, 12.4, 12.9]                    // Литература
  ];                                            // 7.2 to 7.7: authored silence; 12.9 to 13.5: quiet dusk
  var TRAVEL = [[0.55, 2.8], [3.7, 4.3], [5.2, 5.8], [6.7, 8.4], [10.6, 11.3], [12.4, 13.5]];
  var DIST = [0.9, 0.9, 0.9, 3.2, 0.9, 1.4];    // street distance of each travel window, in viewport widths
  var GOLD = [7.7, 9.0], BUNT = [8.0, 9.2], DUSK = [11.0, 13.0];
  var BEATS = [8.1, 8.9, 9.7];                  // the three history cards of the peak

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), chariot = $('chariot'), road = $('road');
  var curb = $('curb'), marks = $('marks'), ropew = $('ropew'), ropet = $('ropet');
  var cfar = $('cfar'), cnear = $('cnear'), bunting = $('bunting'), sun = $('sun');
  var banner = $('banner'), warm = $('warm'), tint = $('tint');
  var gold = stage.querySelector('.sky__gold'), dusk = stage.querySelector('.sky__dusk'), sky = stage.querySelector('.sky');
  var stops = [].slice.call(stage.querySelectorAll('.stop'));
  var beats = [].slice.call(stage.querySelectorAll('.stop--4 .beat'));

  var W, H, top, mobile, x0, y0, cwid, chei, sEnd, dx, dy, period, zl, zw, roadDy, ropeDy, sunD, raf = 0, last = '';

  function sm(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  function seg(t, a, b) { return sm((t - a) / (b - a)); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function mod(a, m) { return ((a % m) + m) % m; }
  function px(v) { return v.toFixed(1) + 'px'; }

  function layout() {
    W = stage.clientWidth; H = stage.clientHeight;
    mobile = W <= 860;
    top = show.getBoundingClientRect().top + (window.scrollY || 0);
    stops.forEach(function (s) { s.classList.add('near'); });
    zl = stops[0].offsetLeft; zw = stops[0].offsetWidth;
    stops.forEach(function (s) { s.classList.remove('near'); });
    x0 = chariot.offsetLeft; y0 = chariot.offsetTop; chei = chariot.offsetHeight; cwid = chariot.offsetWidth;
    sEnd = mobile ? 0.6 : 0.72;
    var yb = 0.80 * H + (mobile ? 0.03 : 0.04) * H;
    dx = (mobile ? -0.05 * W : 0.02 * W) - x0;
    dy = (yb - chei * sEnd) - y0;
    period = ropew.offsetHeight * 28 / 24;
    roadDy = -0.10 * H;
    ropeDy = (mobile ? -0.03 : -0.02) * H;
    sunD = sun.offsetHeight;
    render();
  }

  function render() {
    raf = 0;
    var y = window.scrollY || window.pageYOffset || 0;
    var t = (y - top) / H; t = t < 0 ? 0 : t > TR ? TR : t;
    var e = seg(t, PULL[0], PULL[1]);

    var D = 0, adv = 0, i;
    for (i = 0; i < TRAVEL.length; i++) {
      var q = seg(t, TRAVEL[i][0], TRAVEL[i][1]);
      D += DIST[i] * q;
      if (i > 0) adv += q;
    }
    D = D * W + t * 6;
    adv *= 0.011 * W;
    var R = y * 0.9;                            // the rope: slides 0.9 px for every px of scroll
    var rp = mod(R, period);
    var g = seg(t, GOLD[0], GOLD[1]), d = seg(t, DUSK[0], DUSK[1]), u = seg(t, BUNT[0], BUNT[1]);
    var along = t / TR;

    var cx = dx * e + adv, cy = dy * e, cs = lerp(1, sEnd, e);
    chariot.style.transform = 'translate3d(' + px(cx) + ',' + px(cy) + ',0) scale(' + cs.toFixed(4) + ')';

    road.style.transform = 'translate3d(0,' + px(roadDy * e) + ',0)';
    curb.style.transform = 'translate3d(' + px(-mod(D, 96)) + ',0,0)';
    marks.style.transform = 'translate3d(' + px(-mod(D, 200)) + ',0,0)';
    ropew.style.transform = 'translate3d(0,' + px(ropeDy * e) + ',0) rotate(' + lerp(-3, -0.8, e).toFixed(3) + 'deg)';
    ropet.style.transform = 'translate3d(' + px(-rp) + ',0,0)';

    sky.style.transform = 'translate3d(0,' + px(-Math.min(t, 2.4) * 12) + ',0)';
    cfar.style.transform = 'translate3d(' + px(-along * 0.08 * W) + ',0,0)';
    cnear.style.transform = 'translate3d(' + px(-along * 0.17 * W) + ',0,0)';
    gold.style.opacity = (g * (1 - 0.7 * d)).toFixed(3);
    dusk.style.opacity = d.toFixed(3);
    warm.style.opacity = (0.14 * g * (1 - d)).toFixed(3);
    tint.style.opacity = (0.36 * d).toFixed(3);
    var sunY = lerp(1.15 * H, 0.36 * H, g) + 0.55 * H * d - sunD / 2;
    sun.style.opacity = g > 0.005 ? '1' : '0';
    sun.style.transform = 'translate3d(0,' + px(sunY) + ',0)';
    bunting.style.opacity = u > 0.01 ? '1' : '0';
    bunting.style.transform = 'translate3d(' + px(-mod(D * 0.55, 480)) + ',0,0) scale(1,' + u.toFixed(3) + ')';

    var bo = 1 - seg(e, 0.0, 0.22);
    banner.style.opacity = bo.toFixed(3);
    banner.style.visibility = bo < 0.01 ? 'hidden' : 'visible';
    banner.style.transform = 'translate3d(0,' + px(-e * 0.10 * H) + ',0) scale(' + (1 - e * 0.06).toFixed(4) + ')';

    var sig = [Math.round(cx), Math.round(cy), Math.round(rp), Math.round(D / 4), (g * 20) | 0, (d * 20) | 0, (u * 20) | 0, (bo * 20) | 0];
    for (i = 0; i < stops.length; i++) {
      var K = STOPS[i], s = stops[i];
      var kin = seg(t, K[0], K[1]), kout = seg(t, K[2], K[3]);
      var near = t > K[0] - 2.4 && t < K[3] + 0.6, on = kin > 0.001 && kout < 0.999;
      s.classList.toggle('near', near);
      s.classList.toggle('on', on);
      if (!near) continue;
      var X = (1 - kin) * (W - zl + 80) - kout * (zl + zw + 160);
      s.style.transform = 'translate3d(' + px(X) + ',0,0)';
      s.style.opacity = (1 - seg(kout, 0.7, 1)).toFixed(3);
      s.style.setProperty('--k', kin.toFixed(3));
      sig.push((kin * 20) | 0, (kout * 20) | 0);
    }
    for (i = 0; i < beats.length; i++) {
      var b = seg(t, BEATS[i], BEATS[i] + 0.5);
      beats[i].style.setProperty('--b', b.toFixed(3));
      sig.push((b * 10) | 0);
    }
    var str = sig.join(',');
    if (str !== last) { stage.setAttribute('data-sc-verify-state', str); last = str; }
  }

  function schedule() { if (!raf) raf = requestAnimationFrame(render); }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', function () { layout(); }, { passive: true });
  addEventListener('load', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  layout();
})();
