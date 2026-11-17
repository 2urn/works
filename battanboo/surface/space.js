/* Surface · Space — a page's sounds on one speaker, two, headphones, or a ring of four to eight (17 Nov 2026).

   Dimitry (17 Nov): the studio synth's speaker engine, shared, so any tool can be composed for quadraphonic or up to
   eight speakers while knowing (and saying) when it is only heard on two. The listener stands in the middle of the floor:
   sounds can be in front, behind and to either side.

   How: first-order ambisonics (W Y Z X, SN3D). Each sound gets a small encoder that says where it is; all of them sum
   into one four-channel bus that is decoded once for whatever is plugged in. Each speaker row is a cardioid aimed at
   it, normalised by sweeping a source all the way round so loudness stays even between speakers. On two speakers each
   sound keeps a plain stereo panner. Distance is separate from direction: far sounds are a little quieter, darker and
   mostly room, the clue the ear believes on any number of speakers. A device with fewer outputs than the layout asks
   for falls back to two speakers (or one) and `why` says so.

     const F = SurfaceSpace.field(audioContext, outNode)         // outNode: where the decoded sound goes (to the speakers)
     F.set('quad' | 'stereo' | 'mono' | 'headphones' | '5.1' | '7.1' | 'octo' | 'custom', custom?)
     F.layout, F.heard, F.speakers, F.why                        // what is really being heard, in words
     const s = F.source(); sound.connect(s.input)
     s.set(nx, ny, glide, far)   nx −1 left … +1 right, ny −1 behind … +1 in front (from the listener), far 0 … 1
     s.release()
     SurfaceSpace.LAYOUTS, .SPEAKERS (names per output), .NAME (layout in words)

   Foundations: Ambisonics (Michael Gerzon, 1970s; ACN channel order and SN3D normalisation, the AmbiX convention);
   cardioid virtual-microphone decoding; Web Audio (W3C). Plain script, window.SurfaceSpace, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceSpace) return;
function ambDir(nx, up, map) {
  if (map === 'wall')
    return { az: -nx * Math.PI / 2, el: Math.max(-1, Math.min(1, up)) * Math.PI / 4 };
  if (Math.abs(nx) < 1e-9 && Math.abs(up) < 1e-9) return { az: 0, el: 0 };
  return { az: Math.atan2(-nx, -up), el: 0 };
}
function ambEncode(nx, up, r, map) {
  const d = ambDir(nx, up, map);
  const s = Math.sqrt(Math.max(0, Math.min(1, r)));
  const ce = Math.cos(d.el), se = Math.sin(d.el);
  return [1, s * Math.sin(d.az) * ce, s * se, s * Math.cos(d.az) * ce];
}
function ambMatrix(spk) {
  if (spk === 'amb') return 'amb';
  const rows = spk.map(a => {
    if (a === 'lfe') return [1, 0, 0, 0];
    const p = (a === 'centre' ? 0 : a) * Math.PI / 180;
    return [1, Math.sin(p), 0, Math.cos(p)];
  });
  let sum = 0, n = 0;
  for (let i = 0; i < 360; i += 3) {
    const e = ambEncode(-Math.sin(i * Math.PI / 180),
                        -Math.cos(i * Math.PI / 180), 1, 'wrap');
    let p = 0;
    for (let s = 0; s < rows.length; s++) {
      if (spk[s] === 'lfe') continue;
      const g = rows[s][0] * e[0] + rows[s][1] * e[1]
              + rows[s][2] * e[2] + rows[s][3] * e[3];
      p += g * g;
    }
    sum += Math.sqrt(p); n++;
  }
  const k = sum / n > 1e-6 ? 1 / (sum / n) : 1;
  return rows.map((r, s) => r.map(v => v * (spk[s] === 'lfe' ? 0.7 : k)));
}
const SPACE_LAYOUTS = {
  mono: ['mono'],
  stereo: null,
  headphones: [45, -45],
  quad: [45, -45, 135, -135],
  '5.1': [30, -30, 'centre', 'lfe', 110, -110],
  '7.1': [30, -30, 'centre', 'lfe', 150, -150, 90, -90],
  octo: [0, -45, -90, -135, 180, 135, 90, 45],
  custom: []
};
const SPACE_SPEAKERS = {
  mono: ['the speaker'],
  stereo: ['left', 'right'],
  headphones: ['left ear', 'right ear'],
  quad: ['front left', 'front right', 'rear left', 'rear right'],
  '5.1': ['left', 'right', 'centre', 'sub', 'left surround', 'right surround'],
  '7.1': ['left', 'right', 'centre', 'sub', 'left back', 'right back', 'left side', 'right side'],
  octo: ['front', 'front right', 'right', 'rear right', 'behind', 'rear left', 'left', 'front left']
};
const SPACE_NAME = { mono: 'one speaker', stereo: 'two speakers', headphones: 'headphones', quad: 'four speakers',
  '5.1': '5.1', '7.1': '7.1', octo: 'eight speakers', custom: 'this room' };
function spaceCustom(list) {
  if (!Array.isArray(list)) return null;
  const taken = new Set(), rows = [];
  list.slice(0, 32).forEach((sp, i) => {
    if (!sp || typeof sp !== 'object') return;
    const lfe = sp.lfe === true || sp.angle === 'lfe';
    let a = lfe ? 'lfe' : +sp.angle; if (!lfe && !isFinite(a)) return;
    if (!lfe) { a = ((a + 180) % 360 + 360) % 360 - 180; }
    let out = Math.max(1, Math.min(64, Math.round(+sp.out || i + 1)));
    while (taken.has(out)) out++;
    taken.add(out);
    rows.push({ angle: a, name: String(sp.name || 'speaker ' + (i + 1)).slice(0, 40), out,
                dist: Math.max(0.3, Math.min(50, +sp.dist > 0 ? +sp.dist : 2)) });
  });
  if (!rows.length) return null;
  const far = rows.filter(r => r.angle !== 'lfe').map(r => r.dist), dmax = far.length ? Math.max.apply(null, far) : 2;
  return { angles: rows.map(r => r.angle), names: rows.map(r => r.name), outs: rows.map(r => r.out),
           delay: rows.map(r => Math.max(0, (dmax - r.dist) / 343)), gain: rows.map(r => Math.min(1, r.dist / dmax)),
           channels: Math.max.apply(null, rows.map(r => r.out)), dmax };
}
const SPACE_PAIR = [30, -30];
function spaceGains(nx, ny) {
  const r = Math.min(1, Math.hypot(nx, ny));
  return ambEncode(nx, -ny, r, 'wrap');
}
function spaceFar(far) {
  const f = Math.max(0, Math.min(1, far || 0));
  return { dry: Math.pow(10, -6 * f / 20), air: 18000 * Math.pow(4500 / 18000, f), send: 0.6 * Math.pow(f, 1.2) };
}
function spaceTail(ctx, seed) {
  ctx._spaceTails = ctx._spaceTails || {};
  if (ctx._spaceTails[seed]) return ctx._spaceTails[seed];
  const sr = ctx.sampleRate, len = Math.ceil(sr * 2.6), pre = Math.round(sr * 0.018);
  const buf = ctx.createBuffer(2, len, sr);
  let a = (seed * 2654435761) >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; };
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c); let lp = 0, e = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr, k = Math.exp(-6.9 * t / 2.6);
      const cut = 0.55 * Math.exp(-t * 1.4) + 0.06;
      lp += cut * (rnd() - lp); d[i] = lp * k; e += d[i] * d[i];
    }
    const n = 1 / Math.sqrt(e || 1); for (let i = 0; i < len; i++) d[i] *= n;
  }
  return (ctx._spaceTails[seed] = buf);
}
function spaceField(ctx, out) {
  const bus = ctx.createGain();
  bus.channelCount = 4; bus.channelCountMode = 'explicit'; bus.channelInterpretation = 'discrete';
  const wet = ctx.createGain();                   // every sound's send to the room
  const ctr = ctx.createGain();
  const F = { layout: 'stereo', mode: 'pan', why: '', speakers: 2, heard: 'stereo', centre: false, bus, wet, ctr, dec: [] };
  const clear = () => { for (const n of F.dec) { try { n.disconnect(); } catch (e) {} } F.dec = []; for (const n of [bus, wet, ctr]) { try { n.disconnect(); } catch (e) {} } };
  const ahead = () => { const e = spaceGains(0, 1), m = ctx.createChannelMerger(4);
    e.forEach((k, j) => { const g = ctx.createGain(); g.gain.value = k; ctr.connect(g); g.connect(m, 0, j); F.dec.push(g); }); m.connect(bus); F.dec.push(m); };
  function room() {
    if (F.mode === 'pan') {
      const cv = ctx.createConvolver(); cv.normalize = false; cv.buffer = spaceTail(ctx, 1);
      wet.connect(cv); cv.connect(out); F.dec.push(cv); return;
    }
    [[1, [-0.7071, 0.7071], [0.7071, 0.7071]], [2, [-0.7071, -0.7071], [0.7071, -0.7071]]].forEach(([seed, L, R]) => {
      const cv = ctx.createConvolver(); cv.normalize = false; cv.buffer = spaceTail(ctx, seed);
      const sp = ctx.createChannelSplitter(2); wet.connect(cv); cv.connect(sp); F.dec.push(cv, sp);
      [L, R].forEach((p, c) => { const e = spaceGains(p[0], p[1]), m = ctx.createChannelMerger(4);
        e.forEach((k, j) => { const g = ctx.createGain(); g.gain.value = k; sp.connect(g, c); g.connect(m, 0, j); F.dec.push(g); });
        m.connect(bus); F.dec.push(m); });
    });
  }
  F.set = function (layout, custom) {
    clear();
    let C = null;
    if (layout === 'custom') C = spaceCustom(custom && custom.speakers);
    F.custom = C;
    F.layout = layout === 'custom' ? (C ? 'custom' : 'stereo') : SPACE_LAYOUTS.hasOwnProperty(layout) ? layout : 'stereo';
    const want = C ? C.angles : SPACE_LAYOUTS[F.layout];
    const dst = ctx.destination, max = dst.maxChannelCount || 2;
    if (!want) {                                     // stereo: each sound's own panner, the bus idle
      dst.channelCount = Math.min(2, max); dst.channelCountMode = 'explicit'; dst.channelInterpretation = 'speakers';
      out.channelCount = 2; out.channelCountMode = 'max'; out.channelInterpretation = 'speakers';
      F.mode = 'pan'; F.heard = 'stereo'; F.speakers = 2; F.why = 'two speakers'; F.centre = false; ctr.connect(out); room(); return F;
    }
    const need = C ? C.channels : want.length;
    const heard = need <= max ? want : max >= 2 ? SPACE_PAIR : SPACE_LAYOUTS.mono;
    F.mode = 'field'; F.speakers = heard.length;
    F.heard = heard === want ? F.layout : heard === SPACE_PAIR ? 'pair' : 'mono';
    F.why = heard === want
      ? (C ? C.angles.length + ' speakers on ' + (C.channels === C.angles.length ? 'outputs 1\u2013' + C.channels : C.channels + ' outputs')
        : heard.length > 2 ? SPACE_NAME[F.layout] + ' on outputs 1–' + heard.length
                          : F.layout === 'headphones' ? 'headphones: left, right and distance' : 'one speaker: distance, no direction')
      : SPACE_NAME[F.layout] + ' folded onto ' + (heard.length === 1 ? 'one' : 'two') + ': this device has ' + max + (max === 1 ? ' output' : ' outputs');
    const how = heard.length === 1 ? 'speakers' : 'discrete';
    const wired = C && heard === want;
    const chans = wired ? C.channels : heard.length;
    dst.channelCount = chans; dst.channelCountMode = 'explicit'; dst.channelInterpretation = how;
    const rows = heard === SPACE_LAYOUTS.mono ? [[1, 0, 0, 0]] : ambMatrix(heard);
    const split = ctx.createChannelSplitter(4), merge = ctx.createChannelMerger(chans);
    merge.channelInterpretation = 'discrete';
    bus.connect(split);
    rows.forEach((row, s) => {
      let to = merge, at = s;
      if (wired) {         // this speaker's own output, kept in time and level with the others
        const dl = ctx.createDelay(1), cg = ctx.createGain(); dl.delayTime.value = C.delay[s]; cg.gain.value = C.gain[s];
        dl.connect(cg); cg.connect(merge, 0, C.outs[s] - 1); F.dec.push(dl, cg); to = dl; at = 0;
      }
      if (heard[s] === 'lfe') { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 110; lp.Q.value = 0.7;
        lp.connect(to, 0, at); F.dec.push(lp); to = lp; at = 0; }
      row.forEach((k, c) => {
        if (!k) return;
        const g = ctx.createGain(); g.gain.value = k;
        split.connect(g, c); g.connect(to, 0, at); F.dec.push(g);
      });
    });
    merge.connect(out); F.dec.push(split, merge);
    const c = heard.indexOf('centre'); F.centre = c >= 0;
    if (c >= 0) ctr.connect(merge, 0, c); else ahead();
    out.channelCount = chans; out.channelCountMode = 'explicit'; out.channelInterpretation = how;
    room();
    return F;
  };
  F.source = function () {
    const input = ctx.createGain();
    input.channelCount = 1; input.channelCountMode = 'explicit';
    const air = ctx.createBiquadFilter(); air.type = 'lowpass'; air.Q.value = 0.5;
    const dry = ctx.createGain(), send = ctx.createGain(), cg = ctx.createGain();
    input.connect(air); air.connect(dry); input.connect(send); send.connect(wet);
    cg.gain.value = 0; dry.connect(cg); cg.connect(ctr);
    let centred = false, last = { nx: 0, ny: 0 };
    let pan = null, gs = null, merge = null;
    if (F.mode === 'pan') { pan = ctx.createStereoPanner(); dry.connect(pan); pan.connect(out); }
    else {
      merge = ctx.createChannelMerger(4);
      gs = [0, 1, 2, 3].map(c => { const g = ctx.createGain(); dry.connect(g); g.connect(merge, 0, c); return g; });
      merge.connect(bus);
    }
    const to = (p, v, glide, t) => glide === 0 ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, 0.02);
    const S = { input, place(o, glide) {
      const t = ctx.currentTime, pos = o.pos;
      if (o.centre != null && !!o.centre !== centred) { centred = !!o.centre; if (!pan) to(cg.gain, centred ? 1 : 0, glide, t); }
      if (pos) last = pos;
      if (pan) { if (o.pan != null || pos || o.centre != null) {
        to(pan.pan, centred ? 0 : Math.max(-1, Math.min(1, o.pan != null ? o.pan : last.nx)), glide, t); } }
      else if (pos || o.centre != null) { const e = spaceGains(last.nx, last.ny); gs.forEach((g, c) => to(g.gain, centred ? 0 : e[c], glide, t)); }
      if (o.far != null || glide === 0) {
        const d = spaceFar(o.far);
        to(dry.gain, d.dry, glide, t); to(air.frequency, d.air, glide, t); to(send.gain, d.send, glide, t);
      }
    }, set(nx, ny, glide, far) { S.place({ pos: { nx, ny }, far }, glide); },
    release() { [input, air, dry, send, cg, pan, ...(gs || [])].forEach(n => { if (n) try { n.disconnect(); } catch (e) {} });
      if (merge) try { merge.disconnect(); } catch (e) {} } };
    S.place({ pos: { nx: 0, ny: 0 }, far: 0 }, 0);
    return S;
  };
  return F;
}
  window.SurfaceSpace = { field: spaceField, custom: spaceCustom, gains: spaceGains,
    LAYOUTS: SPACE_LAYOUTS, SPEAKERS: SPACE_SPEAKERS, NAME: SPACE_NAME };
})();
