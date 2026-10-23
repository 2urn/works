/* Surface · Voice — sounds written as recipes (format voice/0), played by one small synth.
   Moved here from the studio's synth (its repository @ 50dfe54, its "VOICE" section, unchanged) on 22 Oct 2026 so every tool plays a
   the studio's synth sound exactly as the studio's synth does (Dimitry: "we did it for the studio's other instruments, just didn't integrate import
   into Current"). the studio's synth still carries its own copy; when it loads this file instead, there is one engine.

     SurfaceVoice.play(ctx, dest, recipe, opts) → { release(at), stop(at), done, out }   (see the notes below)
     SurfaceVoice.shape(recipe) → { start, hold, end, held }
     SurfaceVoice.limit(n) · SurfaceVoice.live() · SurfaceVoice.rng(seed)
     SurfaceVoice.sample(key[, AudioBuffer | null]) · SurfaceVoice.samples()   (the samples a recipe may name, below)

   SAMPLES (22 Oct 2026, for the Frost ensemble: students bring their own sounds). A layer or a grain may be
   "source": "sample" with "sample": "<key>", a recording the tool has decoded and registered with
   SurfaceVoice.sample(key, buffer) (instruments.js does it for packs and dropped files). Optional "rate" (playback
   speed, 1 = as recorded; a grain may give [lo, hi]), "offset" (seconds into the file) and, on a layer, "loop"
   (default: the recipe's own "hold"). A sample layer's gain defaults to 1, not 0.3, and a one-shot layer with no
   hold time lasts as long as the recording; a grain with no "len" plays the whole file (its "glide" bends the speed).
   A key nobody registered plays silence, never an error. Everything else in a recipe works on a sample as on a tone.
   Plain script, window.SurfaceVoice, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceVoice) return;
/* ── VOICE: a sound written as a recipe, played by one small synth ─────────
   A voice is data, not code: layers of noise or tone, each with a filter and
   three phases — how it STARTS, what it does while HELD, how it ENDS — and
   events, short grains fired during a phase (the ticks of a crack running,
   the bounces of a pebble). The same recipe plays live, where a held voice
   keeps going until it is let go, and offline, where it is held for a given
   time so it can be rendered and measured. Format: modules/voice/FORMAT.md.

   voicePlay(ctx, dest, recipe, opts) → { release(at), stop(at), done }
     opts.at       when to start (ctx seconds; default now)
     opts.holdFor  hold this long then end (offline, or a held voice tapped);
                   leave it out on a held voice to keep going until release()
     opts.level    0–2, on top of the recipe's trim (default 1)
     opts.seed     the same seed plays the same sound, sample for sample
     opts.grain    0–1: break the sound into grains, with a hiss that follows it
     opts.phase    'start', 'hold' or 'end' to hear one phase on its own:
                   'hold' and 'end' begin already in the held state, 'end'
                   lets go at once; the caller stops 'start' and a one-shot's
                   'hold' when that phase is over (voiceShape says when)

   The handle's .out is the sound before the room or panner, for a meter.

   voiceShape(recipe) → { start, hold, end, held } in seconds: how long each
   phase lasts as written (a held voice's hold is how long its glide takes;
   it lasts as long as it is held).

   Three optional fields, for sounds that die away the way struck things do
   rather than the way a fader does (all left out = as before):
     a phase's  "curve": "exp"   its loudness glides exponentially — a ring
                                 fading, not a fader pulled down
     an event's "for" and "delay" on a stream during start or hold: it runs
                                 that long, from that far into its phase,
                                 instead of for the whole phase
     a grain's  "glide": 0.5     its pitch (or its filter) falls, or rises, to
                                 that many times where it began, over its length

   This file names no work. */
function voiceRng(seed) {
  let a = (seed == null ? Math.floor(Math.random() * 4294967296) : seed) >>> 0;
  const f = function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /* where it stands, and a jump of n draws at once (each draw only adds the same constant), so a buffer made
     before from the same place can be used again and what follows it is drawn exactly as if it had been made */
  f.at = () => a; f.skip = n => { a = (a + Math.imul(n >>> 0, 0x6D2B79F5)) >>> 0; }; f.seeded = seed != null;
  return f;
}
/* MADE ONCE, NOT ON EVERY STRIKE: the noise a voice is cut from (two seconds) and the grain's gating (one) were
   made afresh each time a sound played — half a megabyte, and two hundred thousand random draws, per strike.
   Now they are kept per context: a seeded voice gets back exactly the buffer it would have made (keyed by where
   its random numbers stand, which then jump on as if it had been made); an unseeded one, which only needs
   noise, takes one of a few. */
const VOICE_KEEP = typeof WeakMap === 'function' ? new WeakMap() : null;
function voiceKept(ctx, kind, rnd, make) {
  if (!VOICE_KEEP || !rnd.at) return make().b;
  let m = VOICE_KEEP.get(ctx); if (!m) VOICE_KEEP.set(ctx, m = new Map());
  const key = rnd.seeded ? kind + ':' + rnd.at() : kind + ':any' + Math.floor(rnd() * 4);
  const had = m.get(key);
  if (had) { if (rnd.seeded) rnd.skip(had.n); return had.b; }
  const made = make();
  if (m.size >= 48) m.delete(m.keys().next().value);
  m.set(key, made); return made.b;
}
const voiceDb = db => Math.pow(10, (db || 0) / 20);
/* the recordings recipes can name (key -> AudioBuffer); an AudioBuffer belongs to no one context, so one decode serves all */
const VOICE_SAMPLES = new Map();
function voiceSample(key, buf) {
  if (buf === undefined) return VOICE_SAMPLES.get(key) || null;
  if (buf) VOICE_SAMPLES.set(key, buf); else VOICE_SAMPLES.delete(key);
  return buf || null;
}
const voiceRateMin = r => Math.max(0.05, Math.abs(Array.isArray(r) ? Math.min(r[0], r[1]) : (+r || 1)));
/* a layer's hold as written; a one-shot sample layer without one holds for the rest of its recording */
function voiceHoldOf(R, l) {
  if (l && l.hold && l.hold.time) return l.hold.time;
  if (l && l.source === 'sample' && !(l.loop != null ? l.loop : R && R.hold)) {
    const b = VOICE_SAMPLES.get(l.sample);
    if (b) return Math.max(0, b.duration / voiceRateMin(l.rate) - (l.offset || 0) - ((l.start && l.start.time) || 0));
  }
  return 0;
}
function voiceNoise(ctx, rnd) {
  return voiceKept(ctx, 'noise', rnd, () => {
    const n = Math.floor(ctx.sampleRate * 2), b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
    return { b, n };
  });
}
const voicePick = (v, rnd) => Array.isArray(v) ? v[0] + (v[1] - v[0]) * rnd() : v;

/* ramp an AudioParam: gain linearly (it may reach zero), frequencies
   exponentially (the ear hears them as ratios) */
function voiceRamp(p, v, t, lin) {
  if (v == null) return;
  if (lin) p.linearRampToValueAtTime(v, t);
  else p.exponentialRampToValueAtTime(Math.max(1, v), t);
}
/* loudness: a straight line, or (curve "exp") the way a ring dies — to a
   whisper exponentially, then the last step to silence */
function voiceFade(p, v, t, curve) {
  if (curve !== 'exp') { p.linearRampToValueAtTime(v, t); return; }
  if (v > 1e-4) { p.exponentialRampToValueAtTime(v, t); return; }
  p.exponentialRampToValueAtTime(1e-4, t); p.linearRampToValueAtTime(0, t + 0.004);
}
function voiceFreeze(p, t) {
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
  else { const v = p.value; p.cancelScheduledValues(t); p.setValueAtTime(v, t); }
}

function voiceGrain(ctx, out, g, t, rnd, noise, scale, cents) {
  const smp = g.source === 'sample';
  let len = Math.max(0.002, voicePick(g.len || 0.02, rnd));
  const peak = voicePick(g.gain == null ? (smp ? 1 : 0.3) : g.gain, rnd) * (scale == null ? 1 : scale);
  let src;
  if (smp) {
    const buf = VOICE_SAMPLES.get(g.sample); if (!buf) return;
    const rate = Math.max(0.05, voicePick(g.rate || 1, rnd)), off = g.offset || 0;
    if (g.len == null) len = Math.max(0.002, (buf.duration - off) / rate);
    src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.setValueAtTime(rate, t);
    if (g.glide) src.playbackRate.exponentialRampToValueAtTime(Math.max(0.05, rate * g.glide), t + len);
    if (cents && src.detune) src.detune.value = cents;
    src.start(t, off); src.stop(t + len + 0.01);
  } else if ((g.source || 'noise') === 'noise') {
    src = ctx.createBufferSource(); src.buffer = noise;
    src.start(t, rnd() * 1.5, len + 0.01);
  } else {
    src = ctx.createOscillator(); src.type = g.source;
    const f0 = voicePick(g.pitch || 440, rnd);
    src.frequency.setValueAtTime(f0, t);
    if (g.glide) src.frequency.exponentialRampToValueAtTime(Math.max(1, f0 * g.glide), t + len);
    if (cents) src.detune.value = cents;
    src.start(t); src.stop(t + len + 0.01);
  }
  let node = src;
  if (g.filter) {
    const f = ctx.createBiquadFilter(); f.type = g.filter.type || 'bandpass';
    const ff = voicePick(g.filter.freq || 2000, rnd);
    f.frequency.setValueAtTime(ff, t);
    if (g.glide && (g.source || 'noise') === 'noise') f.frequency.exponentialRampToValueAtTime(Math.max(1, ff * g.glide), t + len);
    f.Q.value = g.filter.q == null ? 1 : g.filter.q;
    if (cents) f.detune.value = cents;
    node.connect(f); node = f;
  }
  const e = ctx.createGain();
  e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.min(0.002, len / 3));
  if (smp) { e.gain.setValueAtTime(Math.max(0.0002, peak), t + len * 0.85); e.gain.linearRampToValueAtTime(0, t + len); }   // a recording keeps its own shape; only its last moment fades
  else e.gain.exponentialRampToValueAtTime(0.0001, t + len);
  node.connect(e);
  if (g.pan != null && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner(); p.pan.value = voicePick(g.pan, rnd);
    e.connect(p); p.connect(out);
  } else e.connect(out);
}

function voiceShape(R) {
  const L = (R && R.layers) || [], E = (R && R.events) || [];
  const most = (a) => Math.max(0, ...a);
  return {
    start: most([...L.map(l => (l.start && l.start.time) || 0),
                 ...E.filter(e => e.during === 'start').map(voiceEventSpan)]),
    hold: most(L.map(l => voiceHoldOf(R, l))),
    end: most([...L.map(l => (l.end && l.end.time) || 0),
               ...E.filter(e => e.during === 'end').map(voiceEventSpan)]),
    held: !!(R && R.hold)
  };
}

/* HOW MANY ARE SOUNDING, AND A CEILING (live contexts only, never a render). voiceLive() is how many sounds are
   playing now. voiceLimit(n) sets a ceiling (0: none): a sound that would pass it first lets the oldest go with a
   short fade — one already ending before one still held — so a crowded moment thins itself instead of piling up
   more than the device can work. */
const VOICE_LIVE = [];
let VOICE_CAP = 0;
function voiceLimit(n) { VOICE_CAP = Math.max(0, Math.floor(+n || 0)); }
function voiceLive() { return VOICE_LIVE.length; }
const voiceOffline = ctx => (typeof OfflineAudioContext === 'function' && ctx instanceof OfflineAudioContext) || (typeof webkitOfflineAudioContext === 'function' && ctx instanceof webkitOfflineAudioContext);
function voicePlay(ctx, dest, recipe, opts) {
  opts = Object.assign({}, opts);
  const offline = voiceOffline(ctx);
  if (!offline) while (VOICE_CAP && VOICE_LIVE.length >= VOICE_CAP) {
    const k = Math.max(0, VOICE_LIVE.findIndex(v => v.releasedAt != null)), v = VOICE_LIVE.splice(k, 1)[0];
    try { v.stop(); } catch (e) {}
  }
  const R = recipe || {}, rnd = voiceRng(opts.seed != null ? opts.seed : R.seed);
  const t0 = opts.at != null ? opts.at : ctx.currentTime + 0.01;
  /* one phase on its own: the middle and the end begin already held */
  const skip = opts.phase === 'hold' || opts.phase === 'end';
  if (opts.phase === 'end') opts.holdFor = 0;
  const held = !!R.hold && opts.holdFor == null;
  const noise = voiceNoise(ctx, rnd);
  const out = ctx.createGain();
  out.gain.value = voiceDb(R.trim) * (opts.level == null ? 1 : opts.level);
  /* PLAYED FROM A PAD: where it sits left and right (a panner after
     everything), and how high (detune, in cents, on every oscillator and
     filter it has and every grain it fires from now on) — both movable while
     the sound is held, through set() */
  let panNode = null, place = null;
  /* IN A ROOM (opts.space, a spaceField from space/field.js): the sound goes
     to the room — at its point (opts.pos, or opts.pan on two speakers), as far
     away as opts.far says, or alone in the centre speaker (opts.centre) — instead of a panner of its own */
  /* GRAIN (opts.grain 0–1, when given): the sound broken into grains — gated
     on and off in short random bursts — with a hiss that follows its own
     loudness (noise multiplied by the sound itself), so it roughens as it
     plays and is silent when it is. At 0 it passes untouched. */
  let tail = out, grain = null;
  if (opts.grain != null) grain = voiceGrainStage(ctx, out, noise, voiceRng(opts.seed != null ? opts.seed + 7919 : R.seed != null ? R.seed + 7919 : null), opts.grain), tail = grain.out;
  if (opts.space) { place = opts.space.source(); tail.connect(place.input); place.place({ pos: opts.pos, pan: opts.pan, far: opts.far || 0, centre: !!opts.centre }, 0); }
  else if (ctx.createStereoPanner) { panNode = ctx.createStereoPanner(); panNode.pan.value = opts.pan || 0; tail.connect(panNode); panNode.connect(dest); }
  else tail.connect(dest);
  const tuned = [];
  let cents = opts.cents || 0;

  /* when each phase begins: start, then hold; the end begins at release */
  const startLen = skip ? 0.001 : Math.max(0, ...(R.layers || []).map(l => (l.start && l.start.time) || 0), 0.001);
  const holdLen = R.hold ? (opts.holdFor != null ? opts.holdFor : Infinity)
                         : Math.max(0, ...(R.layers || []).map(l => voiceHoldOf(R, l)));
  const endLen = Math.max(0, ...(R.layers || []).map(l => (l.end && l.end.time) || 0),
                          ...(R.events || []).filter(e => e.during === 'end')
                            .map(e => voiceEventSpan(e)));
  const state = { tRel: isFinite(holdLen) ? t0 + startLen + holdLen : null, stopped: false, live: [] };

  /* ── the layers ── */
  for (const L of R.layers || []) {
    const S = L.start || {}, H = L.hold || {}, E = L.end || {};
    const g0 = L.source === 'sample' ? 1 : 0.3;   // a recording comes in at its own level
    const srcs = [];
    let into;
    const env = ctx.createGain(), wob = ctx.createGain();
    if (L.source === 'input') {
      /* A SOUND FROM OUTSIDE: opts.input is a node somebody else keeps running (a microphone, a recorded
         clip) — the layer only shapes and routes it, and lets go of it when the sound is over */
      into = opts.input || ctx.createGain();
      const shared = into;
      srcs.push({ stop(at) { const go = () => { try { shared.disconnect(L.filter ? filt : env); } catch (e) {} };
        if (typeof setTimeout === 'function' && !offline) setTimeout(go, Math.max(0, (at - ctx.currentTime) * 1000)); } });
    } else if (L.source === 'sample') {
      /* A RECORDING (see SAMPLES above): unregistered, the source has no buffer and plays silence */
      const s = ctx.createBufferSource(), b = VOICE_SAMPLES.get(L.sample);
      if (b) s.buffer = b;
      s.loop = L.loop != null ? !!L.loop : !!R.hold;
      s.playbackRate.value = Math.max(0.05, voicePick(L.rate || 1, rnd));
      if (s.detune) { s.detune.value = cents; tuned.push(s); }
      s.start(t0, L.offset || 0); srcs.push(s); into = s;
    } else if ((L.source || 'noise') === 'noise') {
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
      s.start(t0, rnd() * 1.5); srcs.push(s); into = s;
    } else {
      const sum = ctx.createGain(); into = sum;
      for (const [ratio, amp] of L.partials || [[1, 1]]) {
        const o = ctx.createOscillator(); o.type = L.source;
        o.frequency.setValueAtTime((S.pitch || L.pitch || 440) * ratio, t0);
        const g = ctx.createGain(); g.gain.value = amp;
        o.connect(g); g.connect(sum); o.detune.value = cents; tuned.push(o); o.start(t0); srcs.push(o);
        o._ratio = ratio;
      }
    }
    let node = into, filt = null;
    if (L.filter) {
      filt = ctx.createBiquadFilter(); filt.type = L.filter.type || 'bandpass';
      filt.detune.value = cents; tuned.push(filt);
      filt.Q.value = L.filter.q == null ? 1 : L.filter.q;
      filt.frequency.setValueAtTime(S.freq || L.filter.freq || 1000, t0);
      node.connect(filt); node = filt;
    }
    node.connect(env); env.connect(wob);
    if (L.pan != null && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = L.pan; wob.connect(p); p.connect(out);
    } else wob.connect(out);
    const tH = t0 + startLen, hT = Math.max(0.001, H.time || 0.001);
    if (skip) {
      // already held: at the hold values from the first sample (a 5 ms fade in)
      const g = H.gain != null ? H.gain : (S.gain == null ? g0 : S.gain);
      env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(g, t0 + 0.005);
      if (filt) filt.frequency.setValueAtTime(H.freq || S.freq || L.filter.freq || 1000, t0);
      for (const o of srcs) if (o.frequency && o._ratio)
        o.frequency.setValueAtTime((H.pitch || S.pitch || L.pitch || 440) * o._ratio, t0);
    } else {
    // start: from silence to the start values
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(S.gain == null ? g0 : S.gain, t0 + (S.time || 0.005));
    // hold: glide to the hold values, then stay there
    if (H.gain != null) { env.gain.setValueAtTime(S.gain == null ? g0 : S.gain, tH); voiceFade(env.gain, H.gain, tH + hT, H.curve); }
    if (filt && H.freq != null) { filt.frequency.setValueAtTime(S.freq || L.filter.freq || 1000, tH); voiceRamp(filt.frequency, H.freq, tH + hT); }
    if (H.pitch != null) for (const o of srcs) if (o.frequency) {
      o.frequency.setValueAtTime((S.pitch || L.pitch || 440) * o._ratio, tH);
      voiceRamp(o.frequency, H.pitch * o._ratio, tH + hT); }
    }
    // the held middle moves: a slow wobble in loudness, so a long hold is alive
    if (H.wobble) {
      const lfo = ctx.createOscillator(), dep = ctx.createGain();
      lfo.frequency.value = H.wobble.rate || 4; dep.gain.value = H.wobble.depth || 0.2;
      lfo.connect(dep); dep.connect(wob.gain); lfo.start(tH); srcs.push(lfo);
    }
    state.live.push({ env, filt, srcs, E });
    if (state.tRel != null) voiceEnd(state.live[state.live.length - 1], state.tRel);
  }

  /* ── the events ── */
  const sched = [];               // held events are scheduled a little ahead, live
  for (const ev of R.events || []) {
    const grains = [].concat(ev.grain || []);
    const fire = (t, scale) => grains.forEach(g => voiceGrain(ctx, out, g, t, rnd, noise, scale, cents));
    if (skip && ev.during === 'start') continue;
    const from = ev.during === 'end' ? null : (ev.during === 'hold' ? t0 + startLen : t0) + (ev.every && ev.delay ? ev.delay : 0);
    if (ev.count != null) {
      // a counted run: count grains, gaps shrinking, each quieter than the last
      const run = at => { let t = at + (ev.delay || 0), gap = ev.gap || 0.1, sc = 1;
        for (let i = 0; i < ev.count; i++) { fire(t, sc); t += gap; gap *= ev.shrink || 1; sc *= ev.fade || 1; } };
      if (from != null) run(from); else sched.push({ end: run });
    } else if (ev.every) {
      // a stream: a grain every so often for as long as its phase lasts
      const until = () => ev.for != null && ev.during !== 'end' ? from + ev.for
        : ev.during === 'hold' ? state.tRel : ev.during === 'start' ? t0 + startLen : null;
      if (from == null) { sched.push({ end: at => { let t = at + (ev.delay || 0); while (t < at + (ev.delay || 0) + (ev.for || 0.3)) { fire(t); t += voicePick(ev.every, rnd); } } }); continue; }
      const s = { t: from, ev, fire };
      if (until() != null) { while (s.t < until()) { fire(s.t); s.t += voicePick(ev.every, rnd); } }
      else sched.push({ stream: s });
    }
  }
  const ends = sched.filter(x => x.end);
  if (state.tRel != null) ends.forEach(x => x.end(state.tRel));

  /* live, held: keep streams going a little ahead of time until release */
  let timer = null;
  const streams = sched.filter(x => x.stream).map(x => x.stream);
  if (held && streams.length && typeof setInterval === 'function') {
    const pump = () => {
      const edge = state.tRel != null ? state.tRel : ctx.currentTime + 0.15;
      for (const s of streams) while (s.t < edge) { s.fire(s.t); s.t += voicePick(s.ev.every, rnd); }
      if (state.tRel != null) { clearInterval(timer); timer = null; }
    };
    pump(); timer = setInterval(pump, 50);
  }

  /* LET GO OF THE GRAPH WHEN IT IS OVER: a finished sound's nodes stayed wired to the output (and, in a room, to
     the room's bus). Chrome drops them anyway; Safari keeps every wired node alive and working, so a set that
     played for a while — sooner with two lines, which strike twice as often — piled up thousands and the page
     died. Once its last sound has stopped, the sound unplugs itself (its reverb is already in the room). */
  let unplugT = null;
  const unplug = () => { clearTimeout(unplugT); unplugT = null;
    try { tail.disconnect(); } catch (e) {} try { if (panNode) panNode.disconnect(); } catch (e) {}
    if (tail !== out) { try { out.disconnect(); } catch (e) {} }
    if (place && place.release) place.release();
    const k = VOICE_LIVE.indexOf(H); if (k >= 0) VOICE_LIVE.splice(k, 1); };
  const finish = at => { for (const v of state.live) for (const s of v.srcs) { try { s.stop(at); } catch (e) {} }
    if (grain) for (const s of grain.srcs) { try { s.stop(at); } catch (e) {} }
    clearTimeout(unplugT);
    // (not offline: a render runs faster than its clock, and is let go whole when it ends)
    if (!offline && typeof setTimeout === 'function') unplugT = setTimeout(unplug, Math.max(0, (at - ctx.currentTime) * 1000) + 250); };
  let H = null;
  if (state.tRel != null) finish(state.tRel + endLen + 0.05);
  H = {
    get releasedAt() { return state.tRel; },
    /* the sound itself, before it is placed in the room: to listen to (an
       analyser, say), never to route elsewhere */
    out: tail,
    /* move it while it sounds: pan −1…1 (or pos {nx, ny} and far 0–1 in a room), cents ±, level 0–4; glides over ~20 ms */
    set(o) {
      const t = ctx.currentTime;
      if (o.pan != null && panNode) panNode.pan.setTargetAtTime(Math.max(-1, Math.min(1, o.pan)), t, 0.02);
      if (place && (o.pos || o.pan != null || o.far != null || o.centre != null)) place.place({ pos: o.pos, pan: o.pan, far: o.far, centre: o.centre });
      if (o.cents != null) { cents = o.cents; for (const n of tuned) n.detune.setTargetAtTime(cents, t, 0.02); }
      if (o.grain != null && grain) grain.set(o.grain, t);
      if (o.level != null && !state.stopped) out.gain.setTargetAtTime(voiceDb(R.trim) * Math.max(0, o.level), t, 0.03);
    },
    endsAt: () => state.tRel == null ? null : state.tRel + endLen,
    release(at) {
      if (state.tRel != null) return;
      const t = Math.max(at != null ? at : ctx.currentTime, t0 + 0.005);
      state.tRel = t;
      if (timer) { for (const s of streams) while (s.t < t) { s.fire(s.t); s.t += voicePick(s.ev.every, rnd); } clearInterval(timer); timer = null; }
      for (const v of state.live) voiceEnd(v, t);
      ends.forEach(x => x.end(t));
      finish(t + endLen + 0.05);
    },
    /* cut it off: a 15 ms fade, no end phase */
    stop(at) {
      if (timer) clearInterval(timer); timer = null;
      const t = Math.max(at != null ? at : ctx.currentTime, ctx.currentTime);
      state.tRel = state.tRel || t;
      voiceFreeze(out.gain, t); out.gain.linearRampToValueAtTime(0, t + 0.015);
      finish(t + 0.03);
    }
  };
  if (!offline) VOICE_LIVE.push(H);
  return H;
}
function voiceGrainStage(ctx, src, noise, rnd, amt) {
  // the grains: a second of random bursts, 15–60 ms each, soft-edged, with gaps between
  const b = voiceKept(ctx, 'grain', rnd, () => {
    const sr = ctx.sampleRate, n = sr, b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    let draws = 0;
    for (let i = 0; i < n;) {
      const len = Math.floor(sr * (0.015 + 0.045 * rnd())), gap = Math.floor(sr * (0.005 + 0.05 * rnd())); draws += 2;
      for (let k = 0; k < len && i + k < n; k++) d[i + k] = 0.5 - 0.5 * Math.cos(2 * Math.PI * k / len);
      i += len + gap;
    }
    return { b, n: draws };
  });
  const env = ctx.createBufferSource(); env.buffer = b; env.loop = true;
  const depth = ctx.createGain(), gate = ctx.createGain(), hiss = ctx.createBufferSource(), hg = ctx.createGain(), follow = ctx.createGain(), sum = ctx.createGain();
  hiss.buffer = noise; hiss.loop = true; hg.gain.value = 0;
  env.connect(depth); depth.connect(gate.gain);
  src.connect(gate); gate.connect(sum);
  hiss.connect(hg); src.connect(follow); follow.connect(hg.gain); hg.connect(sum);
  const G = { out: sum, srcs: [env, hiss], set(a, t) {
    a = Math.max(0, Math.min(1, a || 0)); t = t == null ? ctx.currentTime : t;
    gate.gain.setTargetAtTime(1 - a, t, 0.03); depth.gain.setTargetAtTime(a, t, 0.03); follow.gain.setTargetAtTime(a * 0.8, t, 0.03);
  } };
  gate.gain.value = 1 - Math.max(0, Math.min(1, amt || 0)); depth.gain.value = Math.max(0, Math.min(1, amt || 0)); follow.gain.value = Math.max(0, Math.min(1, amt || 0)) * 0.8;
  const t0 = ctx.currentTime; env.start(t0, rnd()); hiss.start(t0, rnd() * 1.5);
  return G;
}
function voiceEventSpan(e) {
  if (e.count != null) { let s = e.delay || 0, g = e.gap || 0.1; for (let i = 0; i < e.count; i++) { s += g; g *= e.shrink || 1; } return s + 0.1; }
  return (e.delay || 0) + (e.for || 0.3) + 0.1;
}
function voiceEnd(v, t) {
  const E = v.E, T = Math.max(0.005, E.time || 0.05);
  voiceFreeze(v.env.gain, t);
  voiceFade(v.env.gain, E.gain == null ? 0 : E.gain, t + T, E.curve);
  if (v.filt && E.freq != null) { voiceFreeze(v.filt.frequency, t); voiceRamp(v.filt.frequency, E.freq, t + T); }
  if (E.pitch != null) for (const o of v.srcs) if (o.frequency && o._ratio) {
    voiceFreeze(o.frequency, t); voiceRamp(o.frequency, E.pitch * o._ratio, t + T); }
}
  window.SurfaceVoice = { play: voicePlay, shape: voiceShape, limit: voiceLimit, live: voiceLive, rng: voiceRng,
    sample: voiceSample, samples: () => [...VOICE_SAMPLES.keys()] };
})();
