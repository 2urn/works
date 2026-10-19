/* Surface · Toolpath — G-code as a motion engine (Dimitry, 18 Oct 2026: "could these G-code presets move anything
   besides the flow fields? Do we have a directional animation engine for any object or effect?" Yes: this module).

   A toolpath is an ordered line with timing: every move has a position, a heading, a feed speed and the pen up or down.
   This module reads G-code and hands back two things any tool can use, and draws nothing itself:

     the PATH   where you are at any moment along the line: moves ONE thing (a sprite, a brush, a camera, a light,
                a reveal, a playhead carrying sounds, as in Pullula's play lines)
     the FIELD  a direction at every point of the stage: steers MANY things at once (particles, strands, water)

   Born in Current (works.chamy.xyz/current), which uses it for its field. Plain script, window.SurfaceToolpath,
   no dependencies.

   1. Read
     const P = SurfaceToolpath.parse(gcodeText)
       → { segs:[{x0,y0,x1,y1,travel,f}], lines, arcs, hasE, frame:[w,h]|null }   (G-code units, Y up)
       Understands G0/G1/G2/G3 (arcs become short segments), G20/G21, G90/G91, G92, M82/M83, F, and E for printers.
       A move draws when the pen is down (Z at or under zThresh) or, in a printer file, when it extrudes.
       "; frame W H" in a comment sets the drawing's frame.

   2. Place on a stage
     const T = SurfaceToolpath.fit(P, { w, h, pad: 0.08, travel: false })
       → { segs, use, loops, box:{x,y,w,h}, fmax, map(x,y) }   (stage pixels, Y down)
       segs: every segment with its direction (tx,ty), length, bounds, feed share (fw) and index (i)
       use: the ones that make the field (cuts, plus travel when travel:true)
       loops: closed shapes (runs of cuts that end where they start), for inside/outside

   3. The field
     const F = SurfaceToolpath.field(T, { reach: 32, mode: 'along', inside: 'same', feed: false, cell: 8 })
       → { data: Float32Array (vx,vy per cell), inside: Uint8Array, gw, gh, cell }
       reach  how far the current carries from the line, in pixels (it fades as exp(-distance/reach))
       mode   along · across · attract · repel · orbit · weave
       inside same · reverse · across · still · empty   (what happens inside closed shapes)
       feed   true: faster moves pull harder
     SurfaceToolpath.sample(F, x, y, xf?) → [vx, vy]   bilinear; xf (below) turns the whole field without a rebuild

   4. The path
     const R = SurfaceToolpath.path(T, { travel: false, by: 'length' })     by: 'length' (even pace) or 'time' (feed)
     R.at(u) → { x, y, tx, ty, angle, speed, pen, seg, u }   u from 0 to 1 along the whole toolpath, wraps
     R.length, R.duration (seconds at the feed rates), R.points(n) → n evenly spaced stops (for sounds on a play line)

   5. Motion: spin, breathe, drift, without rebuilding anything
     const xf = SurfaceToolpath.motion('breathe', t, { cx, cy })     or a custom { spin, pulse, per, drift, ... }
       → { x, y, s, r, cx, cy }  a transform for this moment
     SurfaceToolpath.apply(xf, x, y) → [x', y']   moves a path point with the transform
     SurfaceToolpath.sample(F, x, y, xf)          reads the field as if it had been moved the same way
     SurfaceToolpath.MOTIONS   the named presets: still, slow spin, breathe, drift, orbit, tide, wobble

   Cheap on a phone: the field is built once. Moving it reads each point backwards through the transform and turns the
   arrow it finds, so a spinning, breathing field costs a few multiplications per sample. Morphing between two
   toolpaths is not here yet: both have to be resampled to match point for point. */
(function () {
  "use strict";
  if (window.SurfaceToolpath) return;

  /* ---------- 1. read ---------- */
  function parse(src, zThresh) {
    if (zThresh == null) zThresh = 0.05;
    var x = 0, y = 0, z = 0, e = 0, abs = true, absE = true, unit = 1, motion = 0, feed = 1000;
    var segs = [], hasE = /\bE-?\d/i.test(src), lines = 0, arcs = 0;
    var rows = String(src || "").split(/\r?\n/);
    for (var li = 0; li < rows.length; li++) {
      var line = rows[li].replace(/\(.*?\)/g, "").replace(/;.*$/, "").trim().toUpperCase();
      if (!line) continue; lines++;
      var words = {}, gs = [], ms = [], re = /([A-Z])\s*([-+]?\d*\.?\d+)/g, m;
      while ((m = re.exec(line))) { var L = m[1], v = parseFloat(m[2]); if (L === "G") gs.push(v); else if (L === "M") ms.push(v); else words[L] = v; }
      for (var gi = 0; gi < gs.length; gi++) {
        var gc = gs[gi];
        if (gc === 20) unit = 25.4; else if (gc === 21) unit = 1; else if (gc === 90) abs = true; else if (gc === 91) abs = false;
        else if (gc === 92) { if ("E" in words) e = words.E; continue; }
        else if (gc === 0 || gc === 1 || gc === 2 || gc === 3) motion = gc;
      }
      if (gs.indexOf(92) >= 0) continue;
      for (var mi = 0; mi < ms.length; mi++) { if (ms[mi] === 82) absE = true; if (ms[mi] === 83) absE = false; }
      if ("F" in words) feed = words.F * unit;
      if (!("X" in words || "Y" in words || "Z" in words || "E" in words)) continue;
      var val = function (k, cur) { return k in words ? (abs ? words[k] * unit : cur + words[k] * unit) : cur; };
      var nx = val("X", x), ny = val("Y", y), nz = val("Z", z);
      var ne = "E" in words ? (absE ? words.E : e + words.E) : e;
      var draw = motion !== 0 && (hasE ? ne > e + 1e-9 : nz <= zThresh), travel = !draw;
      if (motion === 2 || motion === 3) {
        arcs++;
        var cx = x + (words.I || 0) * unit, cy = y + (words.J || 0) * unit;
        var a0 = Math.atan2(y - cy, x - cx), a1 = Math.atan2(ny - cy, nx - cx), r = Math.hypot(x - cx, y - cy);
        if (motion === 2) { while (a1 >= a0) a1 -= Math.PI * 2; } else { while (a1 <= a0) a1 += Math.PI * 2; }
        var n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 36))), px = x, py = y;
        for (var i = 1; i <= n; i++) { var t = a0 + (a1 - a0) * i / n, qx = cx + r * Math.cos(t), qy = cy + r * Math.sin(t);
          segs.push({ x0: px, y0: py, x1: qx, y1: qy, travel: travel, f: feed }); px = qx; py = qy; }
      } else if (nx !== x || ny !== y) {
        segs.push({ x0: x, y0: y, x1: nx, y1: ny, travel: travel, f: feed });
      }
      x = nx; y = ny; z = nz; e = ne;
    }
    var fm = String(src || "").match(/;\s*frame\s+(-?[\d.]+)\s+(-?[\d.]+)/i);
    return { segs: segs, lines: lines, arcs: arcs, hasE: hasE, frame: fm ? [+fm[1], +fm[2]] : null };
  }

  /* ---------- 2. place ---------- */
  function fit(P, o) {
    o = o || {}; var W = o.w, H = o.h, all = P.segs, out = [];
    var res = { segs: out, use: [], loops: [], box: null, fmax: 1, map: null };
    if (!all.length) return res;
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, s, i;
    if (P.frame) { minx = 0; miny = 0; maxx = P.frame[0]; maxy = P.frame[1]; }
    else { var hasCut = all.some(function (q) { return !q.travel; });
      for (i = 0; i < all.length; i++) { s = all[i]; if (hasCut && s.travel) continue;
        minx = Math.min(minx, s.x0, s.x1); maxx = Math.max(maxx, s.x0, s.x1); miny = Math.min(miny, s.y0, s.y1); maxy = Math.max(maxy, s.y0, s.y1); } }
    var pad = Math.min(W, H) * (o.pad == null ? 0.08 : o.pad);
    var sc = Math.min((W - 2 * pad) / Math.max(maxx - minx, 1e-6), (H - 2 * pad) / Math.max(maxy - miny, 1e-6));
    var ox = (W - (maxx - minx) * sc) / 2, oy = (H - (maxy - miny) * sc) / 2;
    var map = function (X, Y) { return [ox + (X - minx) * sc, H - (oy + (Y - miny) * sc)]; };   // G-code Y points up; screen Y down
    var post = typeof o.place === "function" ? o.place : null;   // a tool's own placement on top (Current's frame)
    res.map = post ? function (X, Y) { var a = map(X, Y); return post(a[0], a[1]); } : map;
    res.box = { x: ox, y: H - (oy + (maxy - miny) * sc), w: (maxx - minx) * sc, h: (maxy - miny) * sc };
    var fmax = 1; for (i = 0; i < all.length; i++) fmax = Math.max(fmax, all[i].f); res.fmax = fmax;
    for (i = 0; i < all.length; i++) { s = all[i]; var a = res.map(s.x0, s.y0), b = res.map(s.x1, s.y1);
      out.push(seg(a[0], a[1], b[0], b[1], s.travel, s.f / fmax, i)); }
    res.use = out.filter(function (q) { return !q.travel || o.travel; });
    res.loops = loops(out);
    return res;
  }
  function seg(x0, y0, x1, y1, travel, fw, i) {
    var q = { x0: x0, y0: y0, x1: x1, y1: y1, travel: travel, fw: fw, i: i };
    q.dx = x1 - x0; q.dy = y1 - y0; q.len = Math.hypot(q.dx, q.dy) || 1e-6; q.tx = q.dx / q.len; q.ty = q.dy / q.len;
    q.bx0 = Math.min(x0, x1); q.bx1 = Math.max(x0, x1); q.by0 = Math.min(y0, y1); q.by1 = Math.max(y0, y1);
    return q;
  }
  /* closed shapes: runs of consecutive cuts whose end meets their start */
  function loops(segs) {
    var out = [], run = [];
    var close = function () { if (run.length > 2) { var a = run[0], b = run[run.length - 1]; if (Math.hypot(a.x0 - b.x1, a.y0 - b.y1) < 2) out.push(run.map(function (q) { return [q.x0, q.y0]; })); } run = []; };
    for (var i = 0; i < segs.length; i++) { var s = segs[i]; if (s.travel) { close(); continue; }
      if (run.length) { var p = run[run.length - 1]; if (Math.hypot(p.x1 - s.x0, p.y1 - s.y0) > 0.5) close(); } run.push(s); }
    close(); return out;
  }
  /* even-odd across every closed loop, so counters (the holes in letters) read as outside */
  function inside(L, x, y) {
    var c = false;
    for (var k = 0; k < L.length; k++) { var P = L[k];
      for (var i = 0, j = P.length - 1; i < P.length; j = i++) { var xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } }
    return c;
  }

  /* ---------- 3. the field ---------- */
  function field(T, o) {
    o = o || {}; var W = o.w, H = o.h, CELL = o.cell || 8;
    if (W == null || H == null) { W = 0; H = 0; T.segs.forEach(function (s) { W = Math.max(W, s.bx1); H = Math.max(H, s.by1); }); }
    var GW = Math.ceil(W / CELL) + 1, GH = Math.ceil(H / CELL) + 1, data = new Float32Array(GW * GH * 2), ins = new Uint8Array(GW * GH);
    var F = { data: data, inside: ins, gw: GW, gh: GH, cell: CELL };
    var use = o.use || T.use; if (!use.length) return F;
    var fall = o.reach || CELL * 4, cut = fall * 7, mode = o.mode || "along", feed = !!o.feed;
    var BS = Math.max(cut, CELL * 4), BW = Math.ceil(W / BS) + 1, BH = Math.ceil(H / BS) + 1, bins = [], i, s;
    for (i = 0; i < BW * BH; i++) bins.push([]);
    for (i = 0; i < use.length; i++) { s = use[i];
      var x0 = Math.max(0, Math.floor((s.bx0 - cut) / BS)), x1 = Math.min(BW - 1, Math.floor((s.bx1 + cut) / BS)),
        y0 = Math.max(0, Math.floor((s.by0 - cut) / BS)), y1 = Math.min(BH - 1, Math.floor((s.by1 + cut) / BS));
      for (var by = y0; by <= y1; by++) for (var bx = x0; bx <= x1; bx++) bins[by * BW + bx].push(s); }
    var mmax = 1e-6, mags = new Float32Array(GW * GH);
    for (var gy = 0; gy < GH; gy++) for (var gx = 0; gx < GW; gx++) {
      var px = gx * CELL, py = gy * CELL, sx = 0, sy = 0, ws = 0;
      var bin = bins[Math.min(BH - 1, Math.floor(py / BS)) * BW + Math.min(BW - 1, Math.floor(px / BS))];
      for (var bi = 0; bi < bin.length; bi++) { s = bin[bi];
        if (px < s.bx0 - cut || px > s.bx1 + cut || py < s.by0 - cut || py > s.by1 + cut) continue;
        var t = ((px - s.x0) * s.dx + (py - s.y0) * s.dy) / (s.len * s.len); t = t < 0 ? 0 : t > 1 ? 1 : t;
        var qx = s.x0 + s.dx * t, qy = s.y0 + s.dy * t, ddx = qx - px, ddy = qy - py, d = Math.hypot(ddx, ddy);
        var w = Math.exp(-d / fall); if (feed) w *= 0.25 + 0.75 * s.fw;
        var nx = d > 1e-6 ? ddx / d : 0, ny = d > 1e-6 ? ddy / d : 0, vx, vy;
        switch (mode) {
          case "across": vx = -s.ty; vy = s.tx; break;
          case "attract": vx = nx; vy = ny; break;
          case "repel": vx = -nx; vy = -ny; break;
          case "orbit": vx = s.tx + nx * 0.55; vy = s.ty + ny * 0.55; break;
          case "weave": { var k2 = (s.i % 2) ? -1 : 1; vx = s.tx * k2; vy = s.ty * k2; break; }
          default: vx = s.tx; vy = s.ty;
        }
        sx += vx * w; sy += vy * w; ws += w;
      }
      var k = gy * GW + gx, mg = Math.hypot(sx, sy);
      if (mg > 1e-9) { data[k * 2] = sx / mg; data[k * 2 + 1] = sy / mg; }
      mags[k] = Math.min(ws, 1.5); if (mags[k] > mmax) mmax = mags[k];
    }
    for (k = 0; k < GW * GH; k++) { var r = mags[k] / mmax; data[k * 2] *= r; data[k * 2 + 1] *= r; }
    var L = o.loops || T.loops, how = o.inside || "same";
    if (L && L.length) for (gy = 0; gy < GH; gy++) for (gx = 0; gx < GW; gx++) {
      k = gy * GW + gx; if (!inside(L, gx * CELL, gy * CELL)) continue; ins[k] = 1;
      var ax = data[k * 2], ay = data[k * 2 + 1];
      switch (how) {
        case "reverse": data[k * 2] = -ax; data[k * 2 + 1] = -ay; break;
        case "across": data[k * 2] = -ay; data[k * 2 + 1] = ax; break;
        case "still": { var m3 = Math.hypot(ax, ay) || 1; data[k * 2] = ax / m3 * 0.06; data[k * 2 + 1] = ay / m3 * 0.06; break; }
        case "empty": data[k * 2] = 0; data[k * 2 + 1] = 0; break;
      }
    }
    return F;
  }
  function sample(F, x, y, xf) {
    var c = 1, s = 0;
    if (xf) { var p = unapply(xf, x, y); x = p[0]; y = p[1]; c = Math.cos(xf.r || 0); s = Math.sin(xf.r || 0); }
    var fx = x / F.cell, fy = y / F.cell, ix = Math.floor(fx), iy = Math.floor(fy), GW = F.gw, f = F.data;
    if (ix < 0 || iy < 0 || ix >= GW - 1 || iy >= F.gh - 1) return [0, 0];
    var ax = fx - ix, ay = fy - iy, i00 = (iy * GW + ix) * 2, i10 = i00 + 2, i01 = i00 + GW * 2, i11 = i01 + 2;
    var vx = (f[i00] * (1 - ax) + f[i10] * ax) * (1 - ay) + (f[i01] * (1 - ax) + f[i11] * ax) * ay;
    var vy = (f[i00 + 1] * (1 - ax) + f[i10 + 1] * ax) * (1 - ay) + (f[i01 + 1] * (1 - ax) + f[i11 + 1] * ax) * ay;
    return xf ? [vx * c - vy * s, vx * s + vy * c] : [vx, vy];
  }

  /* ---------- 4. the path ---------- */
  function path(T, o) {
    o = o || {}; var segs = T.segs.filter(function (q) { return !q.travel || o.travel; });
    var byTime = o.by === "time", cum = [0], tot = 0, dur = 0, len = 0, i;
    for (i = 0; i < segs.length; i++) { var q = segs[i], w = byTime ? q.len / Math.max(0.05, q.fw || 1) : q.len; tot += w; cum.push(tot); len += q.len; dur += q.len / Math.max(0.05, q.fw || 1); }
    function at(u) {
      if (!segs.length) return null;
      u = u - Math.floor(u); var want = u * tot, lo = 0, hi = segs.length - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (cum[mid + 1] < want) lo = mid + 1; else hi = mid; }
      var s = segs[lo], span = cum[lo + 1] - cum[lo], t = span > 0 ? (want - cum[lo]) / span : 0;
      return { x: s.x0 + s.dx * t, y: s.y0 + s.dy * t, tx: s.tx, ty: s.ty, angle: Math.atan2(s.ty, s.tx), speed: s.fw || 1, pen: !s.travel, seg: s.i, u: u };
    }
    function points(n) { var out = []; for (var k = 0; k < n; k++) out.push(at(k / n)); return out; }
    return { at: at, points: points, length: len, duration: dur, count: segs.length };
  }

  /* ---------- 5. motion ---------- */
  /* named presets: per is the length of one cycle in seconds */
  var MOTIONS = {
    "still":     { },
    "slow spin": { spin: 0.04 },
    "breathe":   { pulse: 0.08, per: 6 },
    "drift":     { drift: 0.06, per: 14 },
    "orbit":     { spin: 0.02, drift: 0.04, per: 10 },
    "tide":      { pulse: 0.05, drift: 0.03, per: 9, sway: 0.08 },
    "wobble":    { sway: 0.12, per: 3 }
  };
  /* spin: turns per second · pulse: scale swing (0.08 = ±8%) · drift: wander as a share of the stage · sway: rocking, radians */
  function motion(name, t, o) {
    o = o || {}; var m = typeof name === "string" ? (MOTIONS[name] || {}) : (name || {});
    var per = m.per || 8, ph = (t || 0) / per * Math.PI * 2, span = o.span || Math.max(o.cx || 0, o.cy || 0) * 2 || 1;
    return {
      cx: o.cx || 0, cy: o.cy || 0,
      r: (m.spin || 0) * (t || 0) * Math.PI * 2 + (m.sway || 0) * Math.sin(ph * 0.5),
      s: 1 + (m.pulse || 0) * Math.sin(ph),
      x: (m.drift || 0) * span * Math.sin(ph * 0.7), y: (m.drift || 0) * span * Math.sin(ph * 0.43 + 1.3)
    };
  }
  function apply(xf, x, y) {
    var c = Math.cos(xf.r || 0) * (xf.s || 1), s = Math.sin(xf.r || 0) * (xf.s || 1), dx = x - xf.cx, dy = y - xf.cy;
    return [xf.cx + (xf.x || 0) + dx * c - dy * s, xf.cy + (xf.y || 0) + dx * s + dy * c];
  }
  function unapply(xf, x, y) {
    var k = 1 / (xf.s || 1), c = Math.cos(-(xf.r || 0)) * k, s = Math.sin(-(xf.r || 0)) * k, dx = x - xf.cx - (xf.x || 0), dy = y - xf.cy - (xf.y || 0);
    return [xf.cx + dx * c - dy * s, xf.cy + dx * s + dy * c];
  }

  window.SurfaceToolpath = { parse: parse, fit: fit, seg: seg, loops: loops, inside: inside, field: field, sample: sample,
    path: path, motion: motion, apply: apply, unapply: unapply, MOTIONS: MOTIONS };
})();
