/* Surface · Water — sound that sounds like water, all made in the browser (Dimitry, 21 Oct 2026, for the Frost
   Electronic Music Ensemble piece, 8 Nov, theme water: "more ambient and less beat driven, although we may still want
   the original ability to do byte beats. Maybe it's just a way of modifying the sound so that it has a more aquatic
   quality."). No samples: nothing to license, nothing to download, every sound is made here from noise and sines.

   THREE LAYERS
   1. TREATMENT, for any sound (beats and bytebeats too): a low-pass that slowly breathes (heard from under the
      surface), a slow double wobble (the surface moving), a long dark reverb (the room is the water).
      One amount, DEPTH 0..1: 0 is at the surface (almost dry), 1 is deep (muffled, wide, far). A touch STIRS it:
      the wobble deepens and the filter swings, then settles back over a few seconds.
   2. BEDS, sound with no beat for the field to listen to: surf, stream, hydrophone, rain.
   3. VOICES the field or a finger fires: drop (a short rising sine chirp: a real drop rings as its bubble shrinks),
      bubbles (a scatter of small rising chirps), whale (a slow slide on a long gesture). Pitch from height.
      22 Oct, with animals: porpoise (an echolocation click train, slow, a buzz, slow again, sometimes a whistle) and
      seagull (a nasal "kee-ow", sometimes a laughing series; it is in the air, so it can skip the water: {air}).

   PRESETS (named, finished, tuned to just work)
     Shallows         ankle deep: a little muffle, a little shimmer
     Deep             far under: muffled, slow, a long dark tail
     Open sea         surf under everything, a slow swell in the filter
     Rain on the roof rain bed, a light touch of water on the music
     Stream           a brook under the music, drops on touch
     Hydrophone       a listening mic in the harbor: rumble, whale slides on long gestures
     Harbor           surf on the wall, drops, gulls overhead (a tap above the waterline is a gull)
     Pod              open sea, porpoises clicking past (a tap is a click train)

     SurfaceWater.treat(ctx, input, {preset, depth}) → {input, output, air, depth(v?, still), stir(x, y, amount), bypass(bool?),
                                                         set({breath, wobble, wet, dark}), preset(id), stop()}
         put it between your sound and your speakers; input may be null (connect to t.input yourself)
     SurfaceWater.bed(ctx, name, {level}) → {output, level(v), stop()}        name: surf | stream | hydrophone | rain
     SurfaceWater.voice(ctx, out, kind, {pitch, pan, size, when, gain}) → end time
         kind: drop | bubbles | whale | porpoise | seagull; pitch 0..1 (1 = high), pan -1..1, size 0..1 (bigger = longer,
         lower; a longer click train, more gull calls). porpoise takes {whistle: bool}; seagull takes {air: t.air}
     SurfaceWater.pick(presetId, ctx) → the voice the music plays (the preset's mix weights; gulls and porpoises keep a gap)
     SurfaceWater.tap(presetId, y) → the voice a tap plays (y 1 at the top; above the waterline a preset's sky voice)
     SurfaceWater.PRESETS, .BEDS, .VOICES   [{id, name, note, ...}] for pickers
     SurfaceWater.rebuild()   forget the cached buffers (after an AudioContext is closed and replaced)

   CPU: everything heavy is made once per context and looped (noise, the reverb's impulse, the slow random curves);
   the running graph is ~12 nodes for the treatment and 3–8 per bed. Voices are capped at 24 at once.
   Plain script, window.SurfaceWater, loads nothing. */
(function () {
  "use strict";
  if (window.SurfaceWater) return;

  var PRESETS = [
    { id: "shallows", name: "Shallows", note: "ankle deep: a little muffle, a little shimmer", depth: 0.3, breath: 0.35, wobble: 0.35, wet: 0.22, dark: 0.3, bed: null, voice: "drop" },
    { id: "deep", name: "Deep", note: "far under: muffled, slow, a long dark tail", depth: 0.85, breath: 0.6, wobble: 0.5, wet: 0.55, dark: 0.8, bed: "hydrophone", voice: "bubbles" },
    { id: "opensea", name: "Open sea", note: "surf under everything, a slow swell in the filter", depth: 0.5, breath: 0.8, wobble: 0.4, wet: 0.4, dark: 0.5, bed: "surf", voice: "whale" },
    { id: "rain", name: "Rain on the roof", note: "rain, and a light touch of water on the music", depth: 0.2, breath: 0.25, wobble: 0.25, wet: 0.3, dark: 0.35, bed: "rain", voice: "drop" },
    { id: "stream", name: "Stream", note: "a brook under the music, drops on touch", depth: 0.35, breath: 0.4, wobble: 0.45, wet: 0.28, dark: 0.4, bed: "stream", voice: "drop" },
    { id: "hydrophone", name: "Hydrophone", note: "a listening mic in the harbor: rumble, whale slides", depth: 0.7, breath: 0.5, wobble: 0.3, wet: 0.5, dark: 0.7, bed: "hydrophone", voice: "whale" },
    /* 22 Oct: the two with animals. mix: what the music's beats play, by weight (pick); tap: what a tap plays;
       sky: what a tap above the waterline (the top third) plays instead */
    { id: "harbor", name: "Harbor", note: "surf on the wall, drops, and gulls overhead", depth: 0.25, breath: 0.3, wobble: 0.3, wet: 0.3, dark: 0.35, bed: "surf", voice: "seagull", mix: { drop: 0.72, seagull: 0.28 }, tap: "drop", sky: "seagull" },
    { id: "pod", name: "Pod", note: "open sea, and porpoises clicking past", depth: 0.6, breath: 0.65, wobble: 0.4, wet: 0.45, dark: 0.55, bed: "surf", voice: "porpoise", mix: { porpoise: 0.6, bubbles: 0.4 }, tap: "porpoise" }
  ];
  var BEDS = [
    { id: "surf", name: "Surf", note: "waves arriving, slow and wide" },
    { id: "stream", name: "Stream", note: "a brook over stones" },
    { id: "hydrophone", name: "Hydrophone", note: "the deep hum under a harbor" },
    { id: "rain", name: "Rain", note: "rain on a roof" }
  ];
  var VOICES = [
    { id: "drop", name: "Drop", note: "one drop; higher on screen, higher drop" },
    { id: "bubbles", name: "Bubbles", note: "a small scatter of bubbles" },
    { id: "whale", name: "Whale", note: "a slow slide, for long gestures" },
    { id: "porpoise", name: "Porpoise", note: "a click train that speeds up and slows, sometimes a whistle", gap: 0.5 },
    { id: "seagull", name: "Seagull", note: "a gull's cry, sometimes laughing; above the water, so dry", gap: 1.6, air: true }
  ];
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---- buffers made once per context ---------------------------------------------------------------------- */
  var CACHE = typeof WeakMap === "function" ? new WeakMap() : null;
  function cache(ctx) { if (!CACHE) return {}; var c = CACHE.get(ctx); if (!c) { c = {}; CACHE.set(ctx, c); } return c; }
  /* seeded random, so every phone makes the same water */
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  function noiseBuf(ctx, kind, secs, seed) {
    var c = cache(ctx), k = "n:" + kind + secs + ":" + seed; if (c[k]) return c[k];
    var sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(2, n, sr), r = rng(seed);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch), last = 0, b0 = 0, b1 = 0, b2 = 0;
      for (var i = 0; i < n; i++) {
        var w = r() * 2 - 1;
        if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else if (kind === "pink") { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11; }
        else d[i] = w * 0.5;
      }
      /* fade the seam so the loop does not click */
      var f = Math.min(2048, n >> 3);
      for (var j = 0; j < f; j++) { var g = j / f; d[j] = d[j] * g + d[n - f + j] * (1 - g); }
    }
    return (c[k] = b);
  }
  /* a slow random curve, -1..1, looped: drives filters without timers, so it also runs in an offline render */
  function wanderBuf(ctx, secs, rate, seed) {
    var c = cache(ctx), k = "w:" + secs + ":" + rate + ":" + seed; if (c[k]) return c[k];
    /* made at 3 kHz: a curve this slow needs no more, and it is 15× cheaper to make */
    var sr = 3000, n = Math.floor(sr * secs), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), r = rng(seed);
    var pts = Math.max(4, Math.round(secs * rate)), v = [];
    for (var p = 0; p < pts; p++) v.push(r() * 2 - 1);
    for (var i = 0; i < n; i++) {
      var t = i / n * pts, a = Math.floor(t), u = t - a, y0 = v[a % pts], y1 = v[(a + 1) % pts];
      u = u * u * (3 - 2 * u); d[i] = y0 + (y1 - y0) * u;          // smoothstep, and it wraps, so the loop is seamless
    }
    return (c[k] = b);
  }
  /* the reverb: decaying stereo noise that darkens as it fades (water swallows the highs first) */
  function impulse(ctx, secs, dark) {
    var c = cache(ctx), k = "ir:" + secs + ":" + dark; if (c[k]) return c[k];
    var sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(2, n, sr), r = rng(7);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch), y = 0;
      for (var i = 0; i < n; i++) {
        var t = i / n, a = 0.55 - 0.5 * dark * t;                    // one-pole low-pass that closes over the tail
        y += (r() * 2 - 1 - y) * Math.max(0.03, a);
        var pre = i < sr * 0.012 ? i / (sr * 0.012) : 1;             // a short pre-delay swell, no hard click
        d[i] = y * Math.pow(1 - t, 2.4) * pre;
      }
    }
    return (c[k] = b);
  }
  /* rain: thousands of tiny drops, rendered once into a long loop */
  function rainBuf(ctx, secs, seed) {
    var c = cache(ctx), k = "rain:" + secs + ":" + seed; if (c[k]) return c[k];
    var sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(2, n, sr), r = rng(seed);
    var count = Math.floor(secs * 70);
    for (var q = 0; q < count; q++) {
      var at = Math.floor(r() * n), f = 1800 + r() * 5200, len = Math.floor(sr * (0.004 + r() * 0.012)), amp = 0.04 + Math.pow(r(), 3) * 0.25;
      var pan = r(), L = b.getChannelData(0), R = b.getChannelData(1);
      for (var i = 0; i < len; i++) {
        var j = (at + i) % n, e = Math.exp(-i / (len * 0.25)), ph = 2 * Math.PI * f * (1 + i / len * 0.6) * i / sr;
        var s = Math.sin(ph) * e * amp; L[j] += s * (1 - pan); R[j] += s * pan;
      }
    }
    return (c[k] = b);
  }

  function loop(ctx, buf, when) { var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(when || ctx.currentTime); return s; }
  function lfo(ctx, hz, amt, target) { var o = ctx.createOscillator(); o.frequency.value = hz; var g = ctx.createGain(); g.gain.value = amt; o.connect(g); if (target) g.connect(target); o.start(); return { osc: o, gain: g }; }
  function ramp(p, v, ctx, tc) { try { p.cancelScheduledValues(ctx.currentTime); p.setTargetAtTime(v, ctx.currentTime, tc || 0.08); } catch (e) { p.value = v; } }

  /* ---- 1. the treatment ----------------------------------------------------------------------------------- */
  function treat(ctx, input, o) {
    o = o || {};
    var P = byId(PRESETS, o.preset) || PRESETS[0];
    var st = { depth: o.depth != null ? o.depth : P.depth, breath: P.breath, wobble: P.wobble, wet: P.wet, dark: P.dark, on: true, stir: 0 };
    var inp = ctx.createGain(), out = ctx.createGain(), dry = ctx.createGain(), wetIn = ctx.createGain();
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.9;
    var shelf = ctx.createBiquadFilter(); shelf.type = "lowshelf"; shelf.frequency.value = 220;   // water carries the lows
    var d1 = ctx.createDelay(0.1), d2 = ctx.createDelay(0.1), cg = ctx.createGain(), direct = ctx.createGain();
    d1.delayTime.value = 0.011; d2.delayTime.value = 0.017;
    var verb = ctx.createConvolver(); verb.normalize = true;
    var rv = ctx.createGain(), rvLp = ctx.createBiquadFilter(); rvLp.type = "lowpass";
    var bypassG = ctx.createGain(), procG = ctx.createGain();
    /* AIR: for sounds above the water (a gull). Straight to the output, past the muffle and the wobble; a little of
       it reaches the reverb, so the gull is in the same harbor */
    var air = ctx.createGain(), airV = ctx.createGain(); airV.gain.value = 0.18; air.connect(out); air.connect(airV); airV.connect(rvLp);

    /* input → [bypass] → out ; input → lp → shelf → (direct + wobble) → dry/out and → reverb → out */
    inp.connect(bypassG); bypassG.connect(out);
    inp.connect(procG); procG.connect(lp); lp.connect(shelf);
    shelf.connect(direct); shelf.connect(d1); shelf.connect(d2); d1.connect(cg); d2.connect(cg);
    direct.connect(dry); cg.connect(dry); dry.connect(out);
    dry.connect(rvLp); rvLp.connect(verb); verb.connect(rv); rv.connect(out);

    /* the breath: a slow sine on the filter's detune (cents), so it swings by the same musical amount at any depth;
       a second, slower wander so it never repeats exactly */
    var breath = lfo(ctx, 0.07, 0, lp.detune);
    var wsrc = loop(ctx, wanderBuf(ctx, 40, 0.5, 11)), wg = ctx.createGain(); wsrc.connect(wg); wg.connect(lp.detune);
    var w1 = lfo(ctx, 0.23, 0, d1.delayTime), w2 = lfo(ctx, 0.31, 0, d2.delayTime);
    /* the tail's length comes in five steps, so a moving depth reuses a handful of cached impulses */
    var setIR = function () { verb.buffer = impulse(ctx, 2 + 2 * Math.round(st.depth * 4) / 4, Math.round(st.dark * 10) / 10); };

    function apply(tc) {
      var D = clamp(st.depth, 0, 1);
      ramp(lp.frequency, 18000 * Math.pow(420 / 18000, Math.pow(D, 0.8)), ctx, tc);   // 18 kHz at the surface, ~420 Hz deep
      ramp(breath.gain.gain, 900 * st.breath * (0.3 + D), ctx, tc);
      ramp(wg.gain, 500 * st.breath * D, ctx, tc);
      ramp(shelf.gain, 4 * D, ctx, tc);
      var wob = st.wobble * (0.25 + 0.75 * D) + st.stir;
      ramp(w1.gain.gain, 0.0035 * wob, ctx, tc); ramp(w2.gain.gain, 0.0045 * wob, ctx, tc);
      ramp(cg.gain, 0.55 * clamp(wob, 0, 1.2), ctx, tc); ramp(direct.gain, 1 - 0.35 * clamp(wob, 0, 1), ctx, tc);
      var wet = clamp(st.wet * (0.4 + 0.9 * D), 0, 0.9);
      ramp(rv.gain, wet * 1.6, ctx, tc); ramp(dry.gain, 1 - wet * 0.45, ctx, tc);
      ramp(rvLp.frequency, 6000 - 4800 * st.dark, ctx, tc);
      ramp(bypassG.gain, st.on ? 0 : 1, ctx, tc); ramp(procG.gain, st.on ? 1 : 0, ctx, tc);
    }
    setIR(); apply(0.01);
    if (input) input.connect(inp);
    var lastIR = st.depth, stirT = 0;

    var api = {
      input: inp, output: out, air: air,
      /* still: a depth that moves all the time (the field driving it) keeps its tail; only a chosen depth renews it */
      depth: function (v, still) {
        if (v == null) return st.depth; st.depth = clamp(+v || 0, 0, 1); apply(still ? 0.6 : 0.25);
        if (!still && Math.abs(st.depth - lastIR) > 0.18) { lastIR = st.depth; setIR(); }      // a new tail only for a real change
        return st.depth;
      },
      /* a touch: amount 0..1 deepens the wobble and kicks the filter by height, then it settles over ~3 s */
      stir: function (x, y, amount) {
        var a = clamp(+amount || 0, 0, 1); if (a <= 0) return; var now = ctx.currentTime;
        if (now - stirT < 0.05) return; stirT = now;
        st.stir = clamp(st.stir * 0.7 + a * 0.9, 0, 1.2);
        w1.gain.gain.cancelScheduledValues(now); w2.gain.gain.cancelScheduledValues(now);
        var wob = st.wobble * (0.25 + 0.75 * st.depth);
        w1.gain.gain.setTargetAtTime(0.0035 * (wob + st.stir), now, 0.05); w1.gain.gain.setTargetAtTime(0.0035 * wob, now + 0.3, 1.1);
        w2.gain.gain.setTargetAtTime(0.0045 * (wob + st.stir), now, 0.05); w2.gain.gain.setTargetAtTime(0.0045 * wob, now + 0.3, 1.1);
        lp.Q.cancelScheduledValues(now); lp.Q.setTargetAtTime(0.9 + 5 * a, now, 0.04); lp.Q.setTargetAtTime(0.9, now + 0.25, 0.8);
        if (y != null) { var shift = (clamp(y, 0, 1) - 0.5) * 1800 * a; lp.detune.cancelScheduledValues(now); lp.detune.setTargetAtTime(shift, now, 0.06); lp.detune.setTargetAtTime(0, now + 0.3, 1.2); }
        setTimeout(function () { st.stir *= 0.4; }, 600);
      },
      bypass: function (b) { if (b == null) return !st.on; st.on = !b; apply(0.15); return !st.on; },
      set: function (p) { p = p || {}; ["breath", "wobble", "wet", "dark"].forEach(function (k) { if (p[k] != null) st[k] = clamp(+p[k], 0, 1); }); if (p.dark != null) setIR(); apply(0.2); },
      preset: function (id) { var q = byId(PRESETS, id); if (!q) return null; st.depth = q.depth; st.breath = q.breath; st.wobble = q.wobble; st.wet = q.wet; st.dark = q.dark; lastIR = st.depth; setIR(); apply(0.6); return q; },
      state: function () { return { depth: st.depth, breath: st.breath, wobble: st.wobble, wet: st.wet, dark: st.dark, on: st.on }; },
      stop: function () { [breath.osc, w1.osc, w2.osc, wsrc].forEach(function (n) { try { n.stop(); } catch (e) {} }); try { inp.disconnect(); air.disconnect(); out.disconnect(); } catch (e) {} }
    };
    return api;
  }

  /* ---- 2. beds -------------------------------------------------------------------------------------------- */
  function bed(ctx, name, o) {
    o = o || {};
    var out = ctx.createGain(), lvl = o.level != null ? o.level : 0.6, srcs = [];
    out.gain.value = 0; ramp(out.gain, lvl, ctx, 0.8);
    var add = function (n) { srcs.push(n); return n; };
    function swell(hz, amt, param, seed) {          // a slow wave plus a wander, so no two waves are alike
      var a = lfo(ctx, hz, amt, param); add(a.osc);
      var w = add(loop(ctx, wanderBuf(ctx, 37, 0.35, seed))), g = ctx.createGain(); g.gain.value = amt * 0.8; w.connect(g); g.connect(param);
    }
    if (name === "surf") {
      [[0, 0.083, -0.6, 3], [1, 0.061, 0.6, 5]].forEach(function (s, i) {
        var n = add(loop(ctx, noiseBuf(ctx, "pink", 6 + i, 21 + i))), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        f.type = "lowpass"; f.frequency.value = 700; f.Q.value = 0.4; g.gain.value = 0.5;
        swell(s[1], 550, f.frequency, s[3]); swell(s[1], 0.42, g.gain, s[3] + 1);
        n.connect(f); f.connect(g); if (p) { p.pan.value = s[2]; g.connect(p); p.connect(out); } else g.connect(out);
      });
    } else if (name === "stream") {
      var n = add(loop(ctx, noiseBuf(ctx, "white", 7, 31))), base = ctx.createBiquadFilter(); base.type = "lowpass"; base.frequency.value = 1400;
      var bg = ctx.createGain(); bg.gain.value = 0.45; n.connect(base); base.connect(bg); bg.connect(out);
      /* the babble: resonant bands that wander quickly, like water over stones */
      [[900, 41], [1500, 43], [2300, 47], [3200, 53]].forEach(function (b, i) {
        var f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = b[0]; f.Q.value = 9;
        var w = add(loop(ctx, wanderBuf(ctx, 11 + i, 6 + i * 1.7, b[1]))), wg = ctx.createGain(); wg.gain.value = b[0] * 0.45; w.connect(wg); wg.connect(f.frequency);
        var g = ctx.createGain(); g.gain.value = 3.6 / (i + 1.5);
        var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        n.connect(f); f.connect(g); if (p) { p.pan.value = (i % 2 ? 0.5 : -0.5) * (0.4 + i * 0.15); g.connect(p); p.connect(out); } else g.connect(out);
      });
    } else if (name === "hydrophone") {
      var b1 = add(loop(ctx, noiseBuf(ctx, "brown", 6, 41))), l1 = ctx.createBiquadFilter(); l1.type = "lowpass"; l1.frequency.value = 170;
      var g1 = ctx.createGain(); g1.gain.value = 0.9; b1.connect(l1); l1.connect(g1); g1.connect(out);
      var r1 = ctx.createBiquadFilter(); r1.type = "bandpass"; r1.frequency.value = 78; r1.Q.value = 14; var rg = ctx.createGain(); rg.gain.value = 2.2;
      swell(0.05, 18, r1.frequency, 43); b1.connect(r1); r1.connect(rg); rg.connect(out);
      /* a far-off hiss of the harbor, very low */
      var h = add(loop(ctx, noiseBuf(ctx, "pink", 8, 44))), hb = ctx.createBiquadFilter(); hb.type = "bandpass"; hb.frequency.value = 2200; hb.Q.value = 0.7;
      var hg = ctx.createGain(); hg.gain.value = 0.03; h.connect(hb); hb.connect(hg); hg.connect(out); swell(0.03, 0.02, hg.gain, 45);
    } else { /* rain */
      var drops = add(loop(ctx, rainBuf(ctx, 7, 51))), dg = ctx.createGain(); dg.gain.value = 3.2; drops.connect(dg); dg.connect(out);
      var drops2 = add(loop(ctx, rainBuf(ctx, 11, 52))), dl = ctx.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 2600; var dg2 = ctx.createGain(); dg2.gain.value = 2; drops2.connect(dl); dl.connect(dg2); dg2.connect(out);
      var hiss = add(loop(ctx, noiseBuf(ctx, "pink", 9, 53))), hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000; var hg2 = ctx.createGain(); hg2.gain.value = 0.7;
      hiss.connect(hp); hp.connect(lp); lp.connect(hg2); hg2.connect(out); swell(0.04, 0.2, hg2.gain, 54);
    }
    return {
      output: out, name: name,
      level: function (v) { if (v == null) return lvl; lvl = clamp(+v || 0, 0, 1.5); ramp(out.gain, lvl, ctx, 0.3); return lvl; },
      stop: function (fade) {
        var t = ctx.currentTime, f = fade == null ? 0.6 : fade; ramp(out.gain, 0, ctx, f / 4);
        srcs.forEach(function (s) { try { s.stop(t + f + 0.1); } catch (e) {} });
        setTimeout(function () { try { out.disconnect(); } catch (e) {} }, (f + 0.3) * 1000);
      }
    };
  }

  /* ---- 3. voices ------------------------------------------------------------------------------------------ */
  /* the cap counts voices by when they end, not by onended (which an offline render delivers late) */
  var ends = [], MAXV = 24;
  function room(ctx, t, end) {
    var now = ctx.currentTime; ends = ends.filter(function (e) { return e[1] > now; });
    var busy = 0; for (var i = 0; i < ends.length; i++) if (ends[i][0] <= t && ends[i][1] > t) busy++;
    if (busy >= MAXV) return false; ends.push([t, end]); return true;
  }
  function chirp(ctx, out, t, f0, f1, dur, amp, pan, type) {
    if (!room(ctx, t, t + dur)) return t;
    var o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.type = type || "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + Math.min(0.004, dur * 0.1)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); if (p) { p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(out); } else g.connect(out);
    o.onended = function () { try { g.disconnect(); if (p) p.disconnect(); } catch (e) {} };
    o.start(t); o.stop(t + dur + 0.02); return t + dur;
  }
  function panTo(ctx, node, pan, out) {
    var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = clamp(pan, -1, 1); node.connect(p); p.connect(out); } else node.connect(out);
    return p;
  }
  /* PORPOISE: a click train rendered into one buffer (one node, however many clicks), band-passed high, plus sometimes
     a whistle. The clicks come slowly, crowd into a buzz, then thin out, as a porpoise closes on something. */
  function porpoise(ctx, out, t, h, pan, size, amp, o) {
    var L = 0.35 + size * 1.4, wh = o.whistle != null ? !!o.whistle : Math.random() < 0.45, wd = 0.35 + size * 0.45;
    var end = t + Math.max(L, wh ? 0.1 + wd : 0) + 0.02;
    if (!room(ctx, t, end)) return t;
    var sr = ctx.sampleRate, n = Math.floor(sr * (L + 0.01)), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    var at = 0.004, fc = 5200 + h * 3800, buzz = 0.45 + Math.random() * 0.25, count = 0;
    while (at < L && count < 160) {
      var u = at / L, x = (u - buzz) / 0.22;                                  // the interval dips to a buzz near u = buzz
      var ici = 0.006 + 0.07 * (1 - Math.exp(-x * x)) * (u > buzz ? 0.55 : 1);
      var len = Math.floor(sr * (0.0012 + Math.random() * 0.0016)), f = fc * (0.85 + Math.random() * 0.3), a = Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.6 + Math.random() * 0.4);
      var s0 = Math.floor(at * sr);
      for (var i = 0; i < len && s0 + i < n; i++) {
        var e = Math.exp(-i / (len * 0.22)) * Math.min(1, i / 6);            // a click: a damped ring with a little hiss
        d[s0 + i] += (Math.sin(2 * Math.PI * f * i / sr) * 0.8 + (Math.random() * 2 - 1) * 0.35) * e * a;
      }
      at += ici * (0.85 + Math.random() * 0.3); count++;
    }
    var src = ctx.createBufferSource(); src.buffer = b;
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 7000; bp.Q.value = 0.6;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 9500; lp.Q.value = 0.5;   // a touch of water
    var g = ctx.createGain(); g.gain.value = amp * 3.2;
    src.connect(bp); bp.connect(lp); lp.connect(g); var p = panTo(ctx, g, pan, out);
    var nodes = [src, bp, lp, g, p];
    if (wh) {                                                                  // the whistle: a sine swept up and down, fast FM on top
      var w0 = t + 0.05 + Math.random() * Math.max(0.05, L - wd), base = 2400 + h * 2600, ow = ctx.createOscillator(), wg = ctx.createGain();
      var curve = new Float32Array(24), up = 0.5 + Math.random() * 0.5;
      for (var k = 0; k < 24; k++) { var v = k / 23; curve[k] = base * (1 + up * Math.sin(Math.PI * v) - 0.25 * v); }
      ow.frequency.setValueCurveAtTime(curve, w0, wd);
      var fm = lfo(ctx, 9 + Math.random() * 6, 45, ow.detune);
      wg.gain.setValueAtTime(0.0001, w0); wg.gain.exponentialRampToValueAtTime(amp * 0.16, w0 + 0.04);
      wg.gain.setValueAtTime(amp * 0.16, w0 + wd * 0.7); wg.gain.exponentialRampToValueAtTime(0.0001, w0 + wd);
      ow.connect(wg); wg.connect(lp); ow.start(w0); ow.stop(w0 + wd + 0.02); fm.osc.stop(w0 + wd + 0.02);
      nodes.push(ow, wg, fm.osc, fm.gain);
    }
    src.onended = function () { setTimeout(function () { nodes.forEach(function (x) { try { if (x) x.disconnect(); } catch (e) {} }); }, Math.max(0, (end - ctx.currentTime) * 1000) + 50); };
    src.start(t); src.stop(t + L + 0.01);
    return end;
  }
  /* SEAGULL: a nasal "kee-ow": sawtooth and a pulse, gliding up fast and falling, through three formants, with a rasp
     (a fast flutter in the level) and a breath of noise. Bigger is more calls: 1 to 4, the later ones short ("laughing").
     It is in the air: give it {air} (the treatment's .air) and it skips the water. One graph plays the whole series. */
  function seagull(ctx, out, t, h, pan, size, amp, o) {
    var calls = 1 + Math.round(size * 3 * (0.6 + Math.random() * 0.4)), fb = 820 + h * 760, plan = [], at = t;
    for (var i = 0; i < calls; i++) {
      var long = i === 0, dur = long ? 0.36 + size * 0.18 + Math.random() * 0.08 : 0.17 + Math.random() * 0.09;
      plan.push([at, dur, long ? 1.65 : 1.3 + Math.random() * 0.15]); at += dur + (long ? 0.12 : 0.06 + Math.random() * 0.05);
    }
    var end = at + 0.05; if (!room(ctx, t, end)) return t;
    var dest = o.air || out;
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), m = ctx.createGain(); o1.type = "sawtooth"; o2.type = "square";
    var g2 = ctx.createGain(); g2.gain.value = 0.35; o1.connect(m); o2.connect(g2); g2.connect(m);
    var vib = lfo(ctx, 6 + Math.random() * 2, 28, null); vib.gain.connect(o1.detune); vib.gain.connect(o2.detune);
    var rasp = ctx.createGain(); rasp.gain.value = 0.7; var ra = lfo(ctx, 48 + Math.random() * 18, 0.3, rasp.gain); m.connect(rasp);
    var env = ctx.createGain(); env.gain.value = 0;
    var nz = ctx.createBufferSource(); nz.buffer = noiseBuf(ctx, "white", 2, 61); nz.loop = true;
    var nb = ctx.createBiquadFilter(); nb.type = "bandpass"; nb.frequency.value = 3000; nb.Q.value = 1.4; var ng = ctx.createGain(); ng.gain.value = 0.22;
    nz.connect(nb); nb.connect(ng); ng.connect(env);
    var mix = ctx.createGain(); mix.gain.value = 1;
    var nodes = [o1, o2, m, g2, vib.osc, vib.gain, rasp, ra.osc, ra.gain, env, nz, nb, ng, mix];
    [[1250, 5, 1], [2500, 7, 0.75], [3650, 9, 0.4]].forEach(function (F) {     // the nasal throat
      var f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = F[0] * (0.9 + h * 0.2); f.Q.value = F[1];
      var fg = ctx.createGain(); fg.gain.value = F[2] * 2.2; rasp.connect(f); f.connect(fg); fg.connect(env); nodes.push(f, fg);
    });
    var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 700; var hg = ctx.createGain(); hg.gain.value = 0.12;
    var top = ctx.createBiquadFilter(); top.type = "lowpass"; top.frequency.value = 5200; top.Q.value = 0.6;   // the rasp, not the fizz
    rasp.connect(hp); hp.connect(hg); hg.connect(env); env.connect(top); top.connect(mix); nodes.push(hp, hg, top);
    mix.gain.value = amp * 0.32; var p = panTo(ctx, mix, pan, dest); nodes.push(p);
    o1.frequency.setValueAtTime(fb * 0.75, t); o2.frequency.setValueAtTime(fb * 0.75 * 1.006, t);
    plan.forEach(function (c) {
      var s = c[0], du = c[1], peak = c[2], N = 20, cv = new Float32Array(N), cv2 = new Float32Array(N);
      for (var k = 0; k < N; k++) {                                            // up fast to the "kee", then the long fall of the "ow"
        var v = k / (N - 1), y = v < 0.2 ? 0.72 + (peak - 0.72) * Math.sin(v / 0.2 * Math.PI / 2) : peak - (peak - 0.95) * Math.pow((v - 0.2) / 0.8, 0.8);
        cv[k] = fb * y; cv2[k] = fb * y * 1.006;
      }
      o1.frequency.setValueCurveAtTime(cv, s, du); o2.frequency.setValueCurveAtTime(cv2, s, du);
      env.gain.setValueAtTime(0, s); env.gain.linearRampToValueAtTime(1, s + 0.025);
      env.gain.setValueAtTime(1, s + du * 0.65); env.gain.linearRampToValueAtTime(0, s + du);
    });
    [o1, o2, nz].forEach(function (x) { x.start(t); x.stop(end); }); vib.osc.stop(end); ra.osc.stop(end);   // lfo() has started its own
    o1.onended = function () { nodes.forEach(function (x) { try { if (x) x.disconnect(); } catch (e) {} }); };
    return end;
  }
  function voice(ctx, out, kind, o) {
    o = o || {};
    var t = o.when != null ? o.when : ctx.currentTime + 0.005, h = clamp(o.pitch != null ? o.pitch : 0.5, 0, 1), pan = o.pan || 0;
    var size = clamp(o.size != null ? o.size : 0.5, 0, 1), amp = (o.gain != null ? o.gain : 1) * 0.35;
    if (kind === "porpoise") return porpoise(ctx, out, t, h, pan, size, amp, o);
    if (kind === "seagull") return seagull(ctx, out, t, h, pan, size, amp, o);
    if (kind === "bubbles") {
      var n = 3 + Math.round(size * 6), end = t;
      for (var i = 0; i < n; i++) {
        var f = (700 + h * 2200) * (0.7 + Math.random() * 0.8), at = t + Math.random() * (0.12 + size * 0.35);
        end = Math.max(end, chirp(ctx, out, at, f, f * (1.5 + Math.random()), 0.025 + Math.random() * 0.04, amp * (0.3 + Math.random() * 0.5), pan + (Math.random() - 0.5) * 0.5));
      }
      return end;
    }
    if (kind === "whale") {
      var dur = 1.4 + size * 3.2;
      if (!room(ctx, t, t + dur)) return t;
      var base = 90 + h * 320, o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      var vib = lfo(ctx, 4.5, base * 0.012, null); vib.gain.connect(o1.frequency); vib.gain.connect(o2.frequency);
      o1.type = "triangle"; o2.type = "sine"; lp.type = "lowpass"; lp.frequency.value = 900 + h * 900; lp.Q.value = 2;
      [o1, o2].forEach(function (x, k) {
        var m = k ? 2.003 : 1; x.frequency.setValueAtTime(base * m, t);
        x.frequency.exponentialRampToValueAtTime(base * m * (1.6 + size * 0.6), t + dur * 0.45);
        x.frequency.exponentialRampToValueAtTime(base * m * 0.8, t + dur);
      });
      var g2 = ctx.createGain(); g2.gain.value = 0.35; o2.connect(g2); g2.connect(lp); o1.connect(lp); lp.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp * 0.7, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (p) { p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(out); } else g.connect(out);
      o1.onended = function () { try { vib.osc.stop(); g.disconnect(); if (p) p.disconnect(); } catch (e) {} };
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05); vib.osc.stop(t + dur + 0.05);
      return t + dur;
    }
    /* drop: a short rise, then a quieter echo of itself a touch higher, as a real drop rings */
    var f0 = (380 + h * 1700) * (1.15 - size * 0.3);
    var e1 = chirp(ctx, out, t, f0, f0 * 2.4, 0.07 + size * 0.09, amp, pan);
    chirp(ctx, out, t + 0.012, f0 * 1.5, f0 * 3, 0.03, amp * 0.25, pan);
    return e1;
  }

  window.SurfaceWater = {
    treat: treat, bed: bed, voice: voice, PRESETS: PRESETS, BEDS: BEDS, VOICES: VOICES,
    preset: function (id) { return byId(PRESETS, id); },
    /* which voice the music plays for a preset: by its mix weights, but a voice with a gap (a gull, a porpoise) never
       comes back sooner than that; then the preset's other voice plays instead. ctx gives the time. */
    pick: function (id, ctx) {
      var P = byId(PRESETS, id) || PRESETS[0], mx = P.mix; if (!mx) return P.voice || "drop";
      var now = ctx ? ctx.currentTime : 0, last = ctx ? cache(ctx) : {}, keys = Object.keys(mx), sum = 0, r, k, i;
      for (i = 0; i < keys.length; i++) sum += mx[keys[i]];
      r = Math.random() * sum; for (i = 0; i < keys.length; i++) { k = keys[i]; r -= mx[k]; if (r <= 0) break; }
      var V = byId(VOICES, k);
      if (V && V.gap && ctx) { var lk = "last:" + k; if (last[lk] != null && now - last[lk] < V.gap) { for (i = 0; i < keys.length; i++) { var W2 = byId(VOICES, keys[i]); if (!W2 || !W2.gap) return keys[i]; } return "drop"; } last[lk] = now; }
      return k;
    },
    /* what a tap plays for a preset; y 0..1, 1 at the top: above the waterline (the top third) its sky voice */
    tap: function (id, y) { var P = byId(PRESETS, id) || PRESETS[0]; if (P.sky && y != null && y > 0.67) return P.sky; return P.tap || "drop"; },
    rebuild: function () { ends = []; if (CACHE) CACHE = new WeakMap(); }
  };
})();
