/* Surface · Two fingers — tell a two-finger SLIDE (both fingers moving the same way together) from a PINCH or TWIST,
   and catch a two-finger DOUBLE TAP (Dimitry, 22 Oct 2026, Current's master flow: "two fingers dragging up or down
   together = faster or slower", beside the pinch that spreads the field and the twist that sets its strength).

   No DOM, no listeners: the tool keeps its own pointer map and asks.

     const g = SurfaceTwoFinger.start(a, b)        // a, b: {x, y} where the two fingers are when the second lands
     g.update(a, b) → null | 'slide' | 'pinch'     // null until the fingers have travelled `slop` px (12); then fixed
     g.kind, g.dy (the midpoint's travel down since it was decided), g.y0
     SurfaceTwoFinger.classify(a0, b0, a, b, o)    // the same decision, stateless
     SurfaceTwoFinger.logStep(m0, dy, {per: 160, min: .25, max: 3, snap: 1, snapBand: .06})
       → m0 × 2^(−dy / per), clamped, snapped to `snap` within ±snapBand octaves (finger up = more)
     const t = SurfaceTwoFinger.taps({gap: 450, still: 10, quick: 280})
     t.down(n, pts) on every pointerdown (n = fingers now, pts = their points); t.up(n) on every pointerup
       → true on the second quick, still, two-finger tap inside `gap` ms

   A SLIDE: both fingers travel mostly vertically (|dy| ≥ 1.5 |dx|), in the same direction, while the distance between
   them changes by less than 15% and their angle by less than 0.2 rad. `axis: 'x'` asks the same sideways. Anything
   else is a pinch (or a twist): the tool's own two-finger meaning. Decided once per gesture, so it never flips.
   Each finger's move arrives as its own event, so nothing is decided until both have moved (or one has gone 3 x slop
   while the other stayed: that is a pinch about a still finger). */
(function () {
  "use strict";
  if (window.SurfaceTwoFinger) return;
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y) || 1; }
  function ang(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
  function classify(a0, b0, a, b, o) {
    o = o || {};
    var slop = o.slop || 12, X = o.axis === "x";
    var ax = a.x - a0.x, ay = a.y - a0.y, bx = b.x - b0.x, by = b.y - b0.y;
    var ma = Math.hypot(ax, ay), mb = Math.hypot(bx, by);
    if (Math.max(ma, mb) < slop) return null;
    /* pointer events arrive one finger at a time: wait for the other finger's move too, unless it stays put (a pinch
       or twist about one finger) while the first goes on past 3 x slop */
    if (Math.min(ma, mb) < slop * .5 && Math.max(ma, mb) < slop * 3) return null;
    var pa = X ? ax : ay, qa = X ? ay : ax, pb = X ? bx : by, qb = X ? by : bx;
    var da = ang(a, b) - ang(a0, b0); while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    var same = pa * pb > 0, along = Math.abs(pa) >= 1.5 * Math.abs(qa) && Math.abs(pb) >= 1.5 * Math.abs(qb);
    var steady = Math.abs(dist(a, b) / dist(a0, b0) - 1) < .15 && Math.abs(da) < .2;
    return same && along && steady ? "slide" : "pinch";
  }
  function start(a, b, o) {
    var g = { kind: null, a0: { x: a.x, y: a.y }, b0: { x: b.x, y: b.y }, y0: 0, x0: 0, dy: 0, dx: 0 };
    g.update = function (p, q) {
      if (!g.kind) { g.kind = classify(g.a0, g.b0, p, q, o); if (g.kind) { g.y0 = (p.y + q.y) / 2; g.x0 = (p.x + q.x) / 2; } }
      if (g.kind) { g.dy = (p.y + q.y) / 2 - g.y0; g.dx = (p.x + q.x) / 2 - g.x0; }
      return g.kind;
    };
    return g;
  }
  function logStep(m0, dy, o) {
    o = o || {};
    var per = o.per || 160, lo = o.min == null ? .25 : o.min, hi = o.max == null ? 3 : o.max, sn = o.snap == null ? 1 : o.snap, band = o.snapBand == null ? .06 : o.snapBand;
    var m = m0 * Math.pow(2, -dy / per);
    if (sn && Math.abs(Math.log2(m / sn)) < band) m = sn;
    return Math.max(lo, Math.min(hi, m));
  }
  function taps(o) {
    o = o || {};
    var gap = o.gap || 450, still = o.still || 10, quick = o.quick || 280;
    var t0 = 0, pts = null, moved = false, max = 0, last = 0;
    return {
      down: function (n, p) { if (n === 1) { max = 1; moved = false; pts = null; } if (n > max) max = n; if (n === 2) { t0 = performance.now(); pts = p.map(function (q) { return { x: q.x, y: q.y }; }); } else if (n > 2) pts = null; },
      move: function (p) { if (!pts) return; for (var i = 0; i < Math.min(p.length, pts.length); i++) if (Math.hypot(p[i].x - pts[i].x, p[i].y - pts[i].y) > still) moved = true; },
      up: function (n) {
        if (n !== 0) return false;
        var ok = max === 2 && pts && !moved && performance.now() - t0 < quick; pts = null;
        if (!ok) { last = 0; return false; }
        var now = performance.now();
        if (last && now - last < gap) { last = 0; return true; }
        last = now; return false;
      }
    };
  }
  window.SurfaceTwoFinger = { classify: classify, start: start, logStep: logStep, taps: taps };
})();
