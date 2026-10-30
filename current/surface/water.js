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
     SurfaceWater.bed(ctx, name, {level}) → {output, level(v), stop()}        name: surf | stream | hose | lap | hydrophone | rain
     SurfaceWater.voice(ctx, out, kind, {pitch, pan, size, when, gain}) → end time
         kind: drop | bubbles | whale | porpoise | seagull | sand | wade | splash | lap | wash | lighthouse; pitch 0..1 (1 = high), pan -1..1, size 0..1 (bigger = longer,
         lower; a longer click train, more gull calls). porpoise takes {whistle: bool}; seagull takes {air: t.air}
     SurfaceWater.hold(ctx, out, "bottle", {pitch, pan, gain}) → {set({pitch, pan, gain, breath}), release()}  a voice held by a finger
     SurfaceWater.pitchHz(kind, pitch, size) → the fundamental in Hz a pitch gives (whale, lighthouse, drop, bottle), else null;
         voice and hold take {hz} (and the bottle set({hz})) for an exact one: a tool snaps it to a scale (29 Oct 2026)
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
    { id: "stream", name: "Stream", note: "a little brook, bubbling over stones" },
    { id: "hose", name: "Garden hose", note: "a hose spraying the inside of a bucket" },
    { id: "lap", name: "Lapping waves", note: "tiny waves at a lakeshore, against a dock and the stones" },
    { id: "hydrophone", name: "Hydrophone", note: "the deep hum under a harbor" },
    { id: "rain", name: "Rain", note: "rain on a roof" },
    /* THE SHOW'S WEATHER (Dimitry, 29 Oct 23:15, the story: "first scene is dry no water airy winds birds. second walking
       then rain starts light then heavy ... ocean storm whales underwater quake to surfacing to sun and sky") */
    { id: "dry", name: "Dry air", note: "wind over dry ground, and birds" },
    { id: "walk", name: "Walking", note: "steps on dry ground, in the wind" },
    { id: "storm", name: "Storm", note: "heavy surf, driving rain and gusts" },
    { id: "quake", name: "Quake", note: "a deep rumble that rolls and breaks, under water" },
    { id: "rise", name: "Surfacing", note: "bubbles rising past you toward the light" },
    { id: "sky", name: "Sun and sky", note: "a soft breeze, birds, and a little water at the shore" }
  ];
  var VOICES = [
    { id: "drop", name: "Drop", note: "one drop; higher on screen, higher drop" },
    { id: "bubbles", name: "Bubbles", note: "a small scatter of bubbles" },
    { id: "whale", name: "Whale", note: "a slow slide, for long gestures" },
    { id: "porpoise", name: "Porpoise", note: "a click train that speeds up and slows, sometimes a whistle", gap: 0.5 },
    { id: "seagull", name: "Seagull", note: "a gull's cry, sometimes laughing; above the water, so dry", gap: 1.6, air: true },
    { id: "sand", name: "Sand", note: "a step on dry crunchy sand: heel, toe, a crowd of grains" },
    { id: "wade", name: "Wading", note: "a foot pushed through shallow water" },
    { id: "splash", name: "Splash", note: "something breaking the surface, the spray falling back" },
    { id: "lap", name: "Lap", note: "a small wave against a stone or a hull" },
    { id: "wash", name: "Wash", note: "a wave running up the sand and drawing back", gap: 0.8 },
    { id: "lighthouse", name: "Lighthouse", note: "one turn of the beam: a deep pulse that swells and passes", gap: 1 },
    { id: "bottle", name: "Bottle", note: "breath across a bottle's mouth, held: hold() follows the finger", held: true }
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

  /* A BROOK (Dimitry, 28 Oct 14:32: the old Stream "sounds more like air escaping underwater ... from a hose or a pressure
     system ... stream suggests something more gentle ... a little bubbling stream"): many small bubbles, each a sine that
     rises in pitch as it closes (the Minnaert bubble: smaller is higher), in runs, as water tumbles over stones */
  function brookBuf(ctx, secs, seed, lo, hi, rate) {
    var c = cache(ctx), k = "brook:" + secs + ":" + seed + ":" + lo; if (c[k]) return c[k];
    var sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(2, n, sr), r = rng(seed), L = b.getChannelData(0), R = b.getChannelData(1);
    var t = 0;
    while (t < secs) {
      var run = 2 + Math.floor(r() * 6), at = t, pan = 0.2 + r() * 0.6;            // a little run of bubbles, then a pause
      for (var q = 0; q < run; q++) {
        var f = lo * Math.pow(hi / lo, r()), dur = 0.012 + 3 / f + r() * 0.02, amp = 0.05 + Math.pow(r(), 2) * 0.16, s0 = Math.floor(at * sr), len = Math.floor(dur * sr);
        var ph = 0, p2 = Math.max(0, Math.min(1, pan + (r() - 0.5) * 0.3));
        for (var i = 0; i < len; i++) {
          var x = i / len, e = Math.exp(-x * 5) * Math.min(1, i / (sr * 0.0015)), fi = f * (1 + 0.9 * x);   // rises as it closes; a soft onset, no click
          ph += 2 * Math.PI * fi / sr; var v = Math.sin(ph) * e * amp, j = (s0 + i) % n; L[j] += v * (1 - p2); R[j] += v * p2;
        }
        at += 0.02 + r() * 0.07;
      }
      t = at + (0.04 + r() * 0.35) / rate;
    }
    return (c[k] = b);
  }
  /* LAPPING WAVES (Dimitry, 28 Oct 14:35; 14:42 after the first try: "too much like the ocean ... tiny little lapping waves
     like you're walking along a lakeshore or a dock ... the waves hitting the pylons and maybe the rocks ... a very quiet
     sound, not necessarily rhythmic ... it's more about this gentleness"): small irregular laps, each a short slosh of
     water, sometimes a soft hollow knock (a pylon) or a little clop on stone, now and then a drip; clustered, never on
     a beat, and quiet */
  function lapBuf(ctx, secs, seed) {
    var c = cache(ctx), k = "lap3:" + secs + ":" + seed; if (c[k]) return c[k];
    var sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(2, n, sr), r = rng(seed), L = b.getChannelData(0), R = b.getChannelData(1);
    var put = function (j, v, p) { j = j % n; L[j] += v * (1 - p); R[j] += v * p; };
    var t = r() * 0.5;
    while (t < secs) {
      var s0 = Math.floor(t * sr), pan = 0.15 + r() * 0.7, amp = 0.12 + r() * 0.18;
      /* the slosh: noise through a filter that opens with the lap and closes as it falls back */
      var len = Math.floor(sr * (0.3 + r() * 0.45)), y = 0, z = 0, cut = 0.03 + r() * 0.03;
      for (var i = 0; i < len; i++) { var x = i / len, e = Math.sin(Math.min(1, i / (sr * 0.09)) * Math.PI / 2) * Math.pow(1 - x, 1.6), cc = cut * (0.5 + 0.5 * (1 - x));
        y += cc * ((r() * 2 - 1) - y); z += 0.004 * (y - z); put(s0 + i, (y - z) * e * amp * 3.2, pan); }   // a soft rise (90 ms), and a band, so it is wet, never a slap
      /* the water itself, not a knock (14:46: the knocks read as "windows slapping shut ... flapping in the wind"): as the
         lap falls back it gurgles, a few low bubbles closing under the surface */
      var gN = r() < 0.7 ? 1 + Math.floor(r() * 4) : 0, gt = s0 + Math.floor(len * (0.35 + r() * 0.3));
      for (var gq = 0; gq < gN; gq++) { var gf = 260 + r() * 520, gl = Math.floor(sr * (0.025 + 2.5 / gf)), gp = 0, ga = amp * (0.18 + r() * 0.2);
        for (var gi = 0; gi < gl; gi++) { var xg = gi / gl; gp += 2 * Math.PI * gf * (1 + 0.7 * xg) / sr; put(gt + gi, Math.sin(gp) * Math.exp(-xg * 4.5) * Math.min(1, gi / (sr * 0.004)) * ga, pan); }
        gt += Math.floor(sr * (0.03 + r() * 0.08)); }
      /* now and then a drip after it */
      if (r() < 0.3) { var df = 900 + r() * 1300, dl = Math.floor(sr * 0.03), ds = s0 + len + Math.floor(sr * r() * 0.3), dp = 0;
        for (var d = 0; d < dl; d++) { var xd = d / dl; dp += 2 * Math.PI * df * (1 + 0.8 * xd) / sr; put(ds + d, Math.sin(dp) * Math.exp(-xd * 5) * Math.min(1, d / (sr * 0.0015)) * 0.07, Math.min(1, Math.max(0, pan + (r() - 0.5) * 0.3))); } }
      /* irregular: sometimes two or three close together, then a pause */
      t += r() < 0.4 ? 0.22 + r() * 0.3 : 0.8 + r() * 2.2;
    }
    return (c[k] = b);
  }
  /* BIRDS: little phrases of chirps, each a sine swept fast through a few kilohertz, some trilled, from all around;
     long quiet gaps, so it is a morning, not an aviary */
  function birdBuf(ctx, secs, seed, dens) {
    var c = cache(ctx), k = "bird:" + secs + ":" + seed + ":" + dens; if (c[k]) return c[k];
    var sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(2, n, sr), r = rng(seed), L = b.getChannelData(0), R = b.getChannelData(1);
    var put = function (j, v, p) { j = j % n; L[j] += v * (1 - p); R[j] += v * p; };
    var t = r() * 1.5;
    while (t < secs) {
      var pan = 0.1 + r() * 0.8, base = 2200 + r() * 2800, notes = 2 + Math.floor(r() * 6), far = r() < 0.5 ? 0.35 : 1, at = t, kind = r();
      for (var q = 0; q < notes; q++) {
        var dur = 0.04 + r() * 0.11, len = Math.floor(dur * sr), f0 = base * (0.85 + r() * 0.3), f1 = f0 * (kind < 0.5 ? 1.35 + r() * 0.4 : 0.6 + r() * 0.2), amp = (0.05 + r() * 0.06) * far, tr = r() < 0.3 ? 28 + r() * 30 : 0, ph = 0, s0 = Math.floor(at * sr);
        for (var i = 0; i < len; i++) { var x = i / len, f = f0 + (f1 - f0) * Math.sin(x * Math.PI / 2), e = Math.sin(Math.PI * x) * (tr ? 0.55 + 0.45 * Math.sin(2 * Math.PI * tr * i / sr) : 1);
          ph += 2 * Math.PI * f / sr; put(s0 + i, Math.sin(ph) * e * e * amp, pan); }
        at += dur + 0.02 + r() * 0.09;
      }
      t = at + (0.6 + r() * 3.2) / dens;
    }
    return (c[k] = b);
  }
  /* WALKING: a step every half second or so, a soft heel and then the crunch of dry ground under the toe (a scatter of
     short grains), the feet a little left, a little right */
  function walkBuf(ctx, secs, seed) {
    var c = cache(ctx), k = "walk:" + secs + ":" + seed; if (c[k]) return c[k];
    var sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(2, n, sr), r = rng(seed), L = b.getChannelData(0), R = b.getChannelData(1);
    var put = function (j, v, p) { j = j % n; L[j] += v * (1 - p); R[j] += v * p; };
    var t = 0.1, foot = 0;
    while (t < secs - 0.2) {
      var pan = foot ? 0.62 : 0.38, s0 = Math.floor(t * sr), amp = 0.75 + r() * 0.4, y = 0;
      var hl = Math.floor(sr * 0.07); for (var i = 0; i < hl; i++) { var x = i / hl; y += 0.06 * ((r() * 2 - 1) - y); put(s0 + i, y * Math.pow(1 - x, 2) * Math.min(1, i / (sr * 0.004)) * amp * 2.4, pan); }   // the heel: low and short
      var g0 = s0 + Math.floor(sr * (0.05 + r() * 0.03)), gn = 18 + Math.floor(r() * 22);
      for (var q = 0; q < gn; q++) { var gs = g0 + Math.floor(sr * r() * 0.16), gl = Math.floor(sr * (0.001 + r() * 0.004)), ga = (0.04 + r() * 0.12) * amp, z = 0;
        for (var gi = 0; gi < gl; gi++) { var v = r() * 2 - 1; z += 0.5 * (v - z); put(gs + gi, (v - z) * Math.exp(-gi / (gl * 0.3)) * ga, Math.min(1, Math.max(0, pan + (r() - 0.5) * 0.15))); } }   // the crunch: bright grains
      t += 0.5 + r() * 0.12; foot = 1 - foot;
    }
    return (c[k] = b);
  }
  /* THE QUAKE'S BREAKS: now and then a long low roll that swells and cracks, the ground giving way far below */
  function quakeBuf(ctx, secs, seed) {
    var c = cache(ctx), k = "quake:" + secs + ":" + seed; if (c[k]) return c[k];
    var sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(2, n, sr), r = rng(seed), L = b.getChannelData(0), R = b.getChannelData(1);
    var t = 0.5 + r();
    while (t < secs) {
      var s0 = Math.floor(t * sr), len = Math.floor(sr * (1.6 + r() * 2.4)), pan = 0.3 + r() * 0.4, y = 0, z = 0, amp = 0.6 + r() * 0.5, cr = r() * 0.5 + 0.25;
      for (var i = 0; i < len; i++) { var x = i / len, e = Math.pow(Math.sin(Math.PI * Math.min(1, x / 0.85)), 1.5) * (1 + (Math.abs(x - cr) < 0.03 ? 2.5 * (1 - Math.abs(x - cr) / 0.03) : 0));
        y += 0.004 * ((r() * 2 - 1) - y); z += 0.03 * ((r() * 2 - 1) - z); var v = (y * 6 + z * 0.25 * (Math.abs(x - cr) < 0.05 ? 1 : 0.1)) * e * amp, j = (s0 + i) % n; L[j] += v * (1 - pan); R[j] += v * pan; }
      t += 3 + r() * 4;
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
      /* the brook: two layers of bubbling (small and high, larger and low), over a soft wash of water, low and quiet */
      var wa = add(loop(ctx, noiseBuf(ctx, "pink", 7, 31))), wl = ctx.createBiquadFilter(); wl.type = "lowpass"; wl.frequency.value = 650; wl.Q.value = 0.3;
      var wgn = ctx.createGain(); wgn.gain.value = 0.34; wa.connect(wl); wl.connect(wgn); wgn.connect(out); swell(0.07, 0.05, wgn.gain, 32);
      [[7, 33, 700, 2200, 2.2, 2.6], [11, 34, 300, 900, 1.1, 3.4]].forEach(function (L) {
        var bb = add(loop(ctx, brookBuf(ctx, L[0], L[1], L[2], L[3], L[4]))), bl = ctx.createBiquadFilter(); bl.type = "lowpass"; bl.frequency.value = 3800;
        var bg2 = ctx.createGain(); bg2.gain.value = L[5]; bb.connect(bl); bl.connect(bg2); bg2.connect(out);
      });
    } else if (name === "hose") {
      /* GARDEN HOSE (Dimitry, 28 Oct 14:33: "a pressure hose ... cleaning the inside of a bucket ... call it something like garden hose"): the old Stream, kept under the name of what it sounds like */
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
    } else if (name === "lap") {
      /* two loops of laps that never line up, a faint stillness of water under them, and a soft low cut so it stays gentle */
      var lp2 = ctx.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = 2600; lp2.Q.value = 0.4; lp2.connect(out);
      [[11, 61, 2.8], [17, 62, 2.0]].forEach(function (L) { var lb = add(loop(ctx, lapBuf(ctx, L[0], L[1]))), lg = ctx.createGain(); lg.gain.value = L[2]; lb.connect(lg); lg.connect(lp2); });
      var st2 = add(loop(ctx, noiseBuf(ctx, "pink", 9, 63))), sl = ctx.createBiquadFilter(); sl.type = "lowpass"; sl.frequency.value = 420; var sg = ctx.createGain(); sg.gain.value = 0.08; st2.connect(sl); sl.connect(sg); sg.connect(out);
    } else if (name === "hydrophone") {
      var b1 = add(loop(ctx, noiseBuf(ctx, "brown", 6, 41))), l1 = ctx.createBiquadFilter(); l1.type = "lowpass"; l1.frequency.value = 170;
      var g1 = ctx.createGain(); g1.gain.value = 0.9; b1.connect(l1); l1.connect(g1); g1.connect(out);
      var r1 = ctx.createBiquadFilter(); r1.type = "bandpass"; r1.frequency.value = 78; r1.Q.value = 14; var rg = ctx.createGain(); rg.gain.value = 2.2;
      swell(0.05, 18, r1.frequency, 43); b1.connect(r1); r1.connect(rg); rg.connect(out);
      /* a far-off hiss of the harbor, very low */
      var h = add(loop(ctx, noiseBuf(ctx, "pink", 8, 44))), hb = ctx.createBiquadFilter(); hb.type = "bandpass"; hb.frequency.value = 2200; hb.Q.value = 0.7;
      var hg = ctx.createGain(); hg.gain.value = 0.03; h.connect(hb); hb.connect(hg); hg.connect(out); swell(0.03, 0.02, hg.gain, 45);
    } else if (name === "dry" || name === "walk" || name === "sky" || name === "storm") {
      /* WIND: noise through a band that wanders, in two layers, the gusts a slow swell of level and pitch */
      var W = { dry: [520, 0.5, 0.35], walk: [480, 0.38, 0.3], sky: [900, 0.4, 0.25], storm: [700, 0.55, 0.8] }[name];
      [[-0.5, 71, 0.9], [0.5, 72, 1.25]].forEach(function (s) {
        var wn = add(loop(ctx, noiseBuf(ctx, "pink", 9 + s[1] % 3, s[1]))), wf = ctx.createBiquadFilter(), wg = ctx.createGain(); wf.type = "bandpass"; wf.frequency.value = W[0] * s[2]; wf.Q.value = 0.9;
        wg.gain.value = W[1]; swell(0.05 + s[2] * 0.03, W[0] * 0.45, wf.frequency, s[1] + 2); swell(0.07 + s[2] * 0.02, W[2] * W[1], wg.gain, s[1] + 4);
        wn.connect(wf); wf.connect(wg); panTo(ctx, wg, s[0], out);
      });
      if (name === "dry" || name === "sky") [[13, 81, name === "sky" ? 1.6 : 1, name === "sky" ? 1.6 : 0.9], [17, 82, name === "sky" ? 1.2 : 0.7, name === "sky" ? 1.1 : 0.6]].forEach(function (B) { var bb = add(loop(ctx, birdBuf(ctx, B[0], B[1], B[2]))), bg = ctx.createGain(); bg.gain.value = B[3]; bb.connect(bg); bg.connect(out); });
      if (name === "walk") { var wk = add(loop(ctx, walkBuf(ctx, 8, 91))), wkf = ctx.createBiquadFilter(), wkg = ctx.createGain(); wkf.type = "lowpass"; wkf.frequency.value = 5200; wkg.gain.value = 1.1; wk.connect(wkf); wkf.connect(wkg); wkg.connect(out); }
      if (name === "sky") { var sl3 = add(loop(ctx, lapBuf(ctx, 13, 93))), sg3 = ctx.createGain(); sg3.gain.value = 0.9; sl3.connect(sg3); sg3.connect(out); }
      if (name === "storm") {
        /* heavy surf, low and fast, and rain driving across it */
        [[0, 0.11, -0.6, 95], [1, 0.08, 0.6, 96]].forEach(function (S) { var sn = add(loop(ctx, noiseBuf(ctx, "brown", 7 + S[0], S[3]))), sf = ctx.createBiquadFilter(), sg4 = ctx.createGain(); sf.type = "lowpass"; sf.frequency.value = 900; sf.Q.value = 0.5; sg4.gain.value = 0.45;
          swell(S[1], 650, sf.frequency, S[3] + 1); swell(S[1], 0.35, sg4.gain, S[3] + 2); sn.connect(sf); sf.connect(sg4); panTo(ctx, sg4, S[2], out); });
        var rd = add(loop(ctx, rainBuf(ctx, 7, 97))), rdg = ctx.createGain(); rdg.gain.value = 3; rd.connect(rdg); rdg.connect(out);
        var rh = add(loop(ctx, noiseBuf(ctx, "pink", 9, 98))), rhp = ctx.createBiquadFilter(), rhg = ctx.createGain(); rhp.type = "highpass"; rhp.frequency.value = 700; rhg.gain.value = 0.6; rh.connect(rhp); rhp.connect(rhg); rhg.connect(out); swell(0.09, 0.25, rhg.gain, 99);
      }
    } else if (name === "quake") {
      /* the ground's hum, far under, and its breaks */
      var qb = add(loop(ctx, noiseBuf(ctx, "brown", 8, 101))), ql = ctx.createBiquadFilter(), qg = ctx.createGain(); ql.type = "lowpass"; ql.frequency.value = 90; qg.gain.value = 0.8; swell(0.06, 0.4, qg.gain, 102); qb.connect(ql); ql.connect(qg); qg.connect(out);
      var qr = add(loop(ctx, quakeBuf(ctx, 19, 103))), qrl = ctx.createBiquadFilter(), qrg = ctx.createGain(); qrl.type = "lowpass"; qrl.frequency.value = 260; qrg.gain.value = 1.3; qr.connect(qrl); qrl.connect(qrg); qrg.connect(out);
    } else if (name === "rise") {
      /* SURFACING: bubbles rising past, from low to high, over a hum that thins as the light comes */
      [[9, 105, 180, 700, 1.6, 2.6], [13, 106, 500, 1800, 2.4, 1.8]].forEach(function (Lr) { var rb = add(loop(ctx, brookBuf(ctx, Lr[0], Lr[1], Lr[2], Lr[3], Lr[4]))), rl = ctx.createBiquadFilter(), rg2 = ctx.createGain(); rl.type = "lowpass"; rl.frequency.value = 2600; rg2.gain.value = Lr[5]; rb.connect(rl); rl.connect(rg2); rg2.connect(out); });
      var rh2 = add(loop(ctx, noiseBuf(ctx, "brown", 6, 107))), rhl = ctx.createBiquadFilter(), rhg2 = ctx.createGain(); rhl.type = "lowpass"; rhl.frequency.value = 220; rhg2.gain.value = 0.35; swell(0.04, 0.15, rhg2.gain, 108); rh2.connect(rhl); rhl.connect(rhg2); rhg2.connect(out);
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
  /* ---- 4. the shore (Dimitry, 29 Oct 2026, for an ensemble of five on the water: "walking on crunchy sand", wading,
     "splashing sounds that intimate human interaction with the environment", a bottle found on the beach and blown,
     "a low pulse that sounds a bit like a lighthouse spinning"). Steps, wading, splashes, laps and a wave washing up are
     each drawn into one buffer (one node however many grains), so a walk costs no more than a drop. The bottle is held:
     SurfaceWater.hold() lasts as long as the finger and follows it. */
  function rbuf(ctx, dur) { var sr = ctx.sampleRate, n = Math.max(1, Math.floor(sr * dur)), b = ctx.createBuffer(1, n, sr); return { b: b, d: b.getChannelData(0), sr: sr, n: n }; }
  function norm(d, peak) { var m = 0, i; for (i = 0; i < d.length; i++) { var a = d[i] < 0 ? -d[i] : d[i]; if (a > m) m = a; } if (m > peak) { var k = peak / m; for (i = 0; i < d.length; i++) d[i] *= k; } }
  function playBuf(ctx, out, t, B, pan, amp, chain) {
    var end = t + B.n / B.sr; if (!room(ctx, t, end)) return t;
    var s = ctx.createBufferSource(), g = ctx.createGain(), head = s, nodes = [s, g]; s.buffer = B.b; g.gain.value = amp;
    (chain || []).forEach(function (F) { var q = ctx.createBiquadFilter(); q.type = F[0]; q.frequency.value = F[1]; q.Q.value = F[2] || 0.7; head.connect(q); head = q; nodes.push(q); });
    head.connect(g); nodes.push(panTo(ctx, g, pan, out));
    s.onended = function () { nodes.forEach(function (x) { try { if (x) x.disconnect(); } catch (e) {} }); };
    s.start(t); return end;
  }
  /* a state-variable filter for drawing noise into a buffer: svf(fc, damping) → step(x) gives {lo, bd, hi} */
  function svf(sr) { var lo = 0, bd = 0, o = { lo: 0, bd: 0, hi: 0 }; return function (x, fc, q) { var f = 2 * Math.sin(Math.PI * Math.min(0.24, fc / sr)), hi = x - lo - q * bd; bd += f * hi; lo += f * bd; o.lo = lo; o.bd = bd; o.hi = hi; return o; }; }
  /* SAND: one step on dry crunchy sand. The heel, then the toe 50–90 ms later and lighter, each a crowd of tiny grains
     (sand grains rubbing and breaking), over a soft thud of weight. Higher is brighter, finer sand; bigger is heavier. */
  function sand(ctx, out, t, h, pan, size, amp) {
    var dur = 0.24 + size * 0.16, B = rbuf(ctx, dur + 0.03), d = B.d, sr = B.sr, fc = 1500 + h * 3400;
    [[0, 1], [0.05 + Math.random() * 0.04 + size * 0.03, 0.55 + Math.random() * 0.3]].forEach(function (c) {
      var len = dur * (0.5 + Math.random() * 0.2), n = Math.floor((380 + size * 520) * c[1] * len);
      for (var k = 0; k < n; k++) {
        var u = Math.pow(Math.random(), 1.7), s0 = Math.floor((c[0] + u * len) * sr), gl = Math.floor(sr * (0.0005 + Math.random() * 0.002));
        var a = c[1] * (1 - u) * (0.2 + Math.random() * 0.8), ff = fc * (0.55 + Math.random() * 1.1), ph = Math.random() * 6.283;
        for (var i = 0; i < gl && s0 + i < B.n; i++) { var e = Math.exp(-i / (gl * 0.3)); d[s0 + i] += ((Math.random() * 2 - 1) * 0.6 + Math.sin(ph + 6.2832 * ff * i / sr) * 0.4) * e * a; }
      }
    });
    for (var i = 0, z = 0, m = Math.min(B.n, Math.floor(sr * 0.09)); i < m; i++) { z += 0.02 * ((Math.random() * 2 - 1) - z); d[i] += z * 6 * Math.exp(-i / (sr * 0.022)) * (0.5 + size); }
    norm(d, 0.95);
    return playBuf(ctx, out, t, B, pan, amp * 1.5, [["highpass", 110, 0.7]]);
  }
  /* WADE: a foot pushed through shallow water: a slosh of low noise that swells and settles, a gurgle moving in it,
     and a few bubbles let go as the foot lifts. */
  function wade(ctx, out, t, h, pan, size, amp) {
    var dur = 0.6 + size * 0.6, B = rbuf(ctx, dur), d = B.d, sr = B.sr, F = svf(sr), f0 = 320 + h * 650, rise = 0.16 + Math.random() * 0.1;
    var wob = 4 + Math.random() * 5, ph = Math.random() * 6.283;
    for (var i = 0; i < B.n; i++) {
      var u = i / sr, env = u < rise ? Math.sin(u / rise * Math.PI / 2) : Math.exp(-(u - rise) / (dur * 0.3)), w = Math.sin(ph + 6.2832 * wob * u);
      var o = F(Math.random() * 2 - 1, f0 * (1 + 0.55 * w * env), 0.3);
      d[i] = (o.bd * 0.85 + o.lo * 0.4) * env * (0.75 + 0.25 * Math.sin(ph * 2 + 6.2832 * wob * 1.7 * u));
    }
    norm(d, 0.9);
    var end = playBuf(ctx, out, t, B, pan, amp * 1.4, [["lowpass", 2200 + h * 1800, 0.6]]);
    for (var k = 0, nb = 2 + Math.round(size * 3); k < nb; k++) { var fb = (480 + h * 900) * (0.7 + Math.random() * 0.8); chirp(ctx, out, t + rise + Math.random() * dur * 0.6, fb, fb * 1.8, 0.03 + Math.random() * 0.03, amp * 0.22, pan + (Math.random() - 0.5) * 0.4); }
    return end;
  }
  /* SPLASH: something breaking the surface: a bright slap, the spray falling back hissing and thinning, and drops
     landing all through the tail. Bigger is a bigger splash, longer. */
  function splash(ctx, out, t, h, pan, size, amp) {
    var dur = 0.5 + size * 0.6, B = rbuf(ctx, dur), d = B.d, sr = B.sr, F = svf(sr);
    for (var i = 0; i < B.n; i++) {
      var u = i / sr, slap = Math.exp(-u / 0.014) * Math.min(1, u / 0.0015), spray = Math.exp(-u / (0.09 + size * 0.18)) * 0.6 * Math.min(1, u / 0.03);
      var o = F(Math.random() * 2 - 1, 900 + h * 1400 + 2600 * Math.exp(-u / 0.05), 0.6);
      d[i] = o.lo * slap * 1.3 + o.hi * 0.3 * slap + o.bd * spray;
    }
    for (var k = 0, nd = 6 + Math.round(size * 14); k < nd; k++) {
      var at = 0.04 + Math.pow(Math.random(), 0.8) * dur * 0.85, s0 = Math.floor(at * sr), ff = (900 + h * 2400) * (0.6 + Math.random()), gl = Math.floor(sr * (0.012 + Math.random() * 0.02)), a = 0.3 * (1 - at / dur);
      for (var j = 0; j < gl && s0 + j < B.n; j++) { var v = j / gl; d[s0 + j] += Math.sin(6.2832 * ff * (j + 0.6 * j * v) / sr) * Math.sin(Math.PI * v) * a; }
    }
    norm(d, 0.92);
    return playBuf(ctx, out, t, B, pan, amp * 1.6, [["highpass", 90, 0.7]]);
  }
  /* LAP: a small wave meeting a stone or a hull: a soft rush in, a hollow slap, a gurgle going back. */
  function lap(ctx, out, t, h, pan, size, amp) {
    var dur = 0.55 + size * 0.5, B = rbuf(ctx, dur), d = B.d, sr = B.sr, F = svf(sr), at = 0.12 + Math.random() * 0.08 + size * 0.06, f0 = 200 + h * 480;
    for (var i = 0; i < B.n; i++) {
      var u = i / sr, env = u < at ? Math.pow(u / at, 2) : Math.exp(-(u - at) / (dur * 0.24)), o = F(Math.random() * 2 - 1, f0 * (1 + 2.4 * Math.exp(-Math.abs(u - at) / 0.03)), 0.45);
      d[i] = (o.lo * 0.7 + o.bd * 0.6) * env;
    }
    norm(d, 0.9);
    var end = playBuf(ctx, out, t, B, pan, amp * 1.4, [["lowpass", 1500 + h * 1500, 0.7]]);
    chirp(ctx, out, t + at, f0 * 0.95, f0 * 0.55, 0.13, amp * 0.4, pan, "sine");
    return end;
  }
  /* WASH: a wave running up the sand and drawing back: the rush builds over a second, foam fizzes at its edge, and it
     hisses away through the sand. Bigger is a longer wave. */
  function wash(ctx, out, t, h, pan, size, amp) {
    var dur = 1.8 + size * 1.8, B = rbuf(ctx, dur), d = B.d, sr = B.sr, F = svf(sr), pk = dur * (0.3 + Math.random() * 0.08), base = 420 + h * 900;
    for (var i = 0; i < B.n; i++) {
      var u = i / sr, back = u > pk ? (u - pk) / (dur - pk) : 0, env = u < pk ? Math.pow(Math.sin(u / pk * Math.PI / 2), 1.5) : Math.exp(-back * 3.2);
      var o = F(Math.random() * 2 - 1, base * (0.5 + env * 1.5) * (1 + back * 2.2), 0.7), fizz = Math.random() < 0.03 * env ? (Math.random() * 2 - 1) * (u > pk * 0.7 ? 0.6 : 0.2) : 0;
      d[i] = o.bd * env * 0.8 + o.lo * env * 0.35 + fizz;
    }
    norm(d, 0.9);
    return playBuf(ctx, out, t, B, pan, amp * 1.5, [["highpass", 120, 0.7]]);
  }
  /* LIGHTHOUSE: one turn of the beam: a deep tone that swells as the light swings toward you and falls as it passes,
     brighter at its height, a little Doppler in it and moving across. Its second and third harmonics carry it on small
     speakers. Higher is a higher tone; bigger is a slower turn. */
  function lighthouse(ctx, out, t, h, pan, size, amp) {
    var dur = 1.6 + size * 2.2; if (!room(ctx, t, t + dur)) return t;
    var f = 52 + h * 74, N = 32, gv = new Float32Array(N), fv = new Float32Array(N), dv = new Float32Array(N), pv = new Float32Array(N);
    for (var k = 0; k < N; k++) { var v = k / (N - 1), b = Math.exp(-Math.pow((v - 0.45) / 0.17, 2)), win = Math.pow(Math.sin(Math.PI * v), 0.35);
      gv[k] = Math.max(0.0001, amp * 0.85 * (0.05 + 0.95 * b) * win); fv[k] = f * (2.5 + 9 * b); dv[k] = 14 * Math.cos(Math.PI * Math.min(1, v / 0.9)); pv[k] = clamp(pan + 0.45 * (v - 0.5), -1, 1); }
    var g = ctx.createGain(), lp = ctx.createBiquadFilter(), nodes = [g, lp], oscs = [];
    lp.type = "lowpass"; lp.Q.value = 1.2; lp.frequency.setValueCurveAtTime(fv, t, dur); g.gain.setValueCurveAtTime(gv, t, dur);
    [[f, "sine", 1], [f * 2.003, "triangle", 0.45], [f * 3.01, "sine", 0.18]].forEach(function (P) {
      var o = ctx.createOscillator(), og = ctx.createGain(); o.type = P[1]; o.frequency.value = P[0]; og.gain.value = P[2]; o.detune.setValueCurveAtTime(dv, t, dur);
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05); oscs.push(o); nodes.push(o, og);
    });
    lp.connect(g); var p = panTo(ctx, g, pan, out); if (p) { try { p.pan.setValueCurveAtTime(pv, t, dur); } catch (e) {} } nodes.push(p);
    oscs[0].onended = function () { nodes.forEach(function (x) { try { if (x) x.disconnect(); } catch (e) {} }); };
    return t + dur;
  }
  var ONESHOT = { sand: sand, wade: wade, splash: splash, lap: lap, wash: wash, lighthouse: lighthouse };
  /* BOTTLE, held: breath blown across a bottle's mouth. Breath noise through a narrow band at the bottle's note, a pure
     tone under it, a little flutter; pitch 0..1 spans two octaves (a wine bottle to a small vial). The handle follows
     the finger: set({pitch, pan, gain, breath}), and release() lets the breath go. */
  function hold(ctx, out, kind, o) {
    o = o || {}; if (kind !== "bottle") return null;
    var t = ctx.currentTime + 0.005, h = clamp(o.pitch != null ? o.pitch : 0.5, 0, 1), amp = (o.gain != null ? o.gain : 1) * 0.35, br = 1;
    if (o.hz > 0) h = HZ.bottle.h(o.hz);
    var fq = function (x) { return 165 * Math.pow(2, x * 2); }, f = fq(h);
    var nz = ctx.createBufferSource(); nz.buffer = noiseBuf(ctx, "white", 2, 73); nz.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = 28;
    var bg = ctx.createGain(); bg.gain.value = 3.2;
    var hs = ctx.createBiquadFilter(); hs.type = "bandpass"; hs.frequency.value = 1900; hs.Q.value = 1.1; var hg = ctx.createGain(); hg.gain.value = 0.05;
    var os = ctx.createOscillator(); os.type = "sine"; os.frequency.value = f; var og = ctx.createGain(); og.gain.value = 0.32;
    var vib = lfo(ctx, 4.6 + Math.random(), 9, os.detune), flu = lfo(ctx, 7 + Math.random() * 3, 0.18, null);
    /* the flutter is a stage of its own (a 1 +/- 0.18 tremolo) before the envelope, so letting go fades it too (review 61235c2e48 r-4) */
    var env = ctx.createGain(), tr = ctx.createGain(); env.gain.value = 0; tr.gain.value = 1; flu.gain.connect(tr.gain);
    nz.connect(bp); bp.connect(bg); bg.connect(tr); nz.connect(hs); hs.connect(hg); hg.connect(tr); os.connect(og); og.connect(tr); tr.connect(env);
    var p = panTo(ctx, env, o.pan || 0, out), nodes = [nz, bp, bg, hs, hg, os, og, vib.osc, vib.gain, flu.osc, flu.gain, tr, env, p];
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(amp * 0.25, t + 0.08); env.gain.setTargetAtTime(amp, t + 0.08, 0.12);
    nz.start(t); os.start(t);
    var gone = false;
    return {
      set: function (q) { if (gone || !q) return; var n = ctx.currentTime;
        if (q.pitch != null || q.hz > 0) { h = q.hz > 0 ? HZ.bottle.h(q.hz) : clamp(+q.pitch, 0, 1); f = fq(h); bp.frequency.setTargetAtTime(f, n, 0.05); os.frequency.setTargetAtTime(f, n, 0.05); }
        if (q.pan != null && p) p.pan.setTargetAtTime(clamp(+q.pan, -1, 1), n, 0.05);
        if (q.gain != null) amp = Math.max(0, +q.gain) * 0.35;
        if (q.breath != null) br = clamp(+q.breath, 0, 1.5);
        if (q.gain != null || q.breath != null) { env.gain.cancelScheduledValues(n); env.gain.setTargetAtTime(amp * (0.55 + 0.45 * br), n, 0.08); hg.gain.setTargetAtTime(0.05 + 0.07 * br, n, 0.08); } },
      release: function () { if (gone) return; gone = true; var n = ctx.currentTime; env.gain.cancelScheduledValues(n); env.gain.setTargetAtTime(0, n, 0.12);
        [nz, os, vib.osc, flu.osc].forEach(function (x) { try { x.stop(n + 1.1); } catch (e) {} });   // 1.1 s: the fade (0.12 s a step) is at -80 dB by then
        setTimeout(function () { nodes.forEach(function (x) { try { if (x) x.disconnect(); } catch (e) {} }); }, 1300); }
    };
  }
  /* IN TUNE (Dimitry, 29 Oct 18:31, for an ensemble: a key and a scale the room shares). The pitched voices say what
     fundamental a pitch gives (pitchHz) and take an exact one back (o.hz, or set({hz}) on the bottle), so a tool can snap
     a note to a scale; the rest (bubbles, sand, splashes, laps, waves, gulls) are noise and stay as they are. */
  var HZ = {
    whale: { f: function (h) { return 90 + h * 320; }, h: function (f) { return (f - 90) / 320; } },
    lighthouse: { f: function (h) { return 52 + h * 74; }, h: function (f) { return (f - 52) / 74; } },
    drop: { f: function (h, s) { return (380 + h * 1700) * (1.15 - s * 0.3); }, h: function (f, s) { return (f / (1.15 - s * 0.3) - 380) / 1700; } },
    bottle: { f: function (h) { return 165 * Math.pow(2, h * 2); }, h: function (f) { return Math.log(f / 165) / Math.LN2 / 2; } }
  };
  function pitchHz(kind, pitch, size) { var z = HZ[kind]; if (!z) return null; return z.f(clamp(pitch != null ? pitch : 0.5, 0, 1), clamp(size != null ? size : 0.5, 0, 1)); }
  function voice(ctx, out, kind, o) {
    o = o || {};
    var t = o.when != null ? o.when : ctx.currentTime + 0.005, h = clamp(o.pitch != null ? o.pitch : 0.5, 0, 1), pan = o.pan || 0;
    var size = clamp(o.size != null ? o.size : 0.5, 0, 1), amp = (o.gain != null ? o.gain : 1) * 0.35;
    if (o.hz > 0 && HZ[kind]) h = HZ[kind].h(o.hz, size);   // IN TUNE: an exact fundamental, a little past the 0..1 range if a note asks
    if (kind === "porpoise") return porpoise(ctx, out, t, h, pan, size, amp, o);
    if (kind === "seagull") return seagull(ctx, out, t, h, pan, size, amp, o);
    if (ONESHOT[kind]) return ONESHOT[kind](ctx, out, t, h, pan, size, amp);
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
    treat: treat, bed: bed, voice: voice, hold: hold, pitchHz: pitchHz, PRESETS: PRESETS, BEDS: BEDS, VOICES: VOICES,
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
