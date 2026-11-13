/* Surface · Prism — a bank of tuned resonators (Dimitry, 13 Nov 2026; "Prism" is a working name).

   It makes no sound by itself. Sound that goes in excites resonators tuned to a chord or scale, and they ring at those
   notes. A resonator only rings at frequencies present in what it is fed: a clean tone wakes few of them, noise and
   short clicks wake them all. Built once here so Battanboo, Current and the other instruments load the same node and a preset made
   in one is a preset in all three.

     var P = SurfacePrism.create(audioContext, { preset: 'Struck Glass' });
     source.connect(P.input);              // dry plus wet (an insert)
     other.connect(P.excite);              // wet only (a send: the dry sound does not pass)
     P.output.connect(destination);
     P.set('chord', 'min7'); P.set('root', 2); P.set({ decay: 1.5, depth: .4 });
     P.preset('Bent Bell'); P.get(); P.strike(when, level, ms);   // a short noise burst into the bank (a "hit")
     P.setNotes([0, 2, 4, 7, 9]);          // the tool's own scale (semitones above the root), in place of a named chord
     P.ready  → a promise: the worklets (frequency shifter, safety guard) are in. Until then it runs on the native
                limiter, which is always there.
     P.bypass(true) · P.destroy()

   Parameters (all 0..1 unless said): chord, root (0..11), octave (1..5, the lowest octave), spread (octaves in the bank,
   1 to 3), attack (s, softens the strike), decay (ring time, s), spacing (how far the partials leave the chord:
   stretched, bell-like), drift (slow detune of each resonator), shift (Hz, frequency shifter, 0 = off and free),
   arp ('off' | 'up' | 'down' | 'updown' | 'random' | 'chord'), arpRate (Hz free, or steps per beat when arpSync),
   arpSync, bpm, motion (strength), motionRate (Hz), motionShape ('sine' | 'triangle' | 'square' | 'sawtooth'),
   inLo / inHi (Hz, what reaches the bank), tilt (-1..1), scoop (tames resonant peaks), width (stereo), depth (wet/dry).

   Safety, always on: a high-pass, a gate that closes on silence, a guard that pulls the wet level down when the ring
   runs away (a live microphone and high-Q filters can do that), a soft clip and a limiter. A wet signal that has gone
   to NaN rebuilds the bank. Plain script, window.SurfacePrism, no dependencies. Credits: Bismuth by Lunacy Audio
   (inspiration); Mutable Instruments Rings (modal resonator reference, open source); Karplus-Strong; Web Audio API. */
(function () {
  "use strict";
  if (window.SurfacePrism) return;

  var CHORDS = {
    "maj7": [0, 4, 7, 11], "min7": [0, 3, 7, 10], "dom7": [0, 4, 7, 10], "maj9": [0, 2, 4, 7, 11], "min9": [0, 2, 3, 7, 10],
    "add9": [0, 2, 4, 7], "sus2": [0, 2, 7], "sus4": [0, 5, 7], "dim7": [0, 3, 6, 9], "open fifths": [0, 7],
    "major": [0, 2, 4, 5, 7, 9, 11], "minor": [0, 2, 3, 5, 7, 8, 10], "dorian": [0, 2, 3, 5, 7, 9, 10],
    "pentatonic": [0, 2, 4, 7, 9], "minor pentatonic": [0, 3, 5, 7, 10], "whole tone": [0, 2, 4, 6, 8, 10], "hirajoshi": [0, 2, 3, 7, 8]
  };
  var DEFAULTS = {
    chord: "maj7", root: 0, octave: 3, spread: 1, attack: .004, decay: 1.2, spacing: .2, drift: .2, shift: 0,
    arp: "off", arpRate: 4, arpSync: true, bpm: 100, motion: 0, motionRate: 3, motionShape: "sine",
    inLo: 60, inHi: 12000, tilt: 0, scoop: .3, width: .5, depth: .5
  };
  /* Named presets: set it once and play. Each is a full set of values, so any tool can load it. */
  var PRESETS = {
    "Struck Glass": { chord: "maj7", octave: 4, spread: 1, attack: .001, decay: .4, spacing: .6, drift: .12, shift: 0, arp: "off", motion: 0, inLo: 200, inHi: 14000, tilt: .25, scoop: .35, width: .7, depth: .65 },
    "Tuned Street": { chord: "min7", octave: 3, spread: 1, attack: .02, decay: 4, spacing: .15, drift: .45, shift: 0, arp: "off", motion: .15, motionRate: .25, inLo: 90, inHi: 7000, tilt: -.1, scoop: .6, width: .6, depth: .22 },
    "Prism Arp": { chord: "maj9", octave: 3, spread: 1, attack: .003, decay: .9, spacing: .25, drift: .15, shift: 0, arp: "up", arpRate: 2, arpSync: true, motion: 0, inLo: 120, inHi: 12000, tilt: .15, scoop: .4, width: .8, depth: .55 },
    "Bent Bell": { chord: "sus2", octave: 3, spread: 1, attack: .002, decay: 2.4, spacing: .9, drift: .1, shift: 0, arp: "off", motion: .1, motionRate: .6, inLo: 180, inHi: 13000, tilt: .3, scoop: .5, width: .55, depth: .5 }
  };

  var NOTES = 7, OCTS = 3, N = NOTES * OCTS;
  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var hz = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  /* the worklets, built as text so the module stays one file */
  var WK = "" +
    "class PrismShift extends AudioWorkletProcessor{" +
    " static get parameterDescriptors(){return[{name:'hz',defaultValue:0,minValue:-2000,maxValue:2000,automationRate:'k-rate'}]}" +
    " constructor(){super();this.T=65;this.h=new Float32Array(this.T);var c=(this.T-1)/2;for(var n=0;n<this.T;n++){var k=n-c;this.h[n]=(k===0||k%2===0)?0:(2/(Math.PI*k))*(0.54+0.46*Math.cos(Math.PI*k/c))}" +
    "  this.b=new Float32Array(this.T*2);this.i=0;this.ph=0}" +
    " process(ins,outs,p){var x=ins[0][0],o=outs[0][0];if(!x||!o)return true;var f=p.hz[0];" +
    "  if(Math.abs(f)<.01){for(var j=0;j<o.length;j++)o[j]=x[j];this.ph=0;return true}" +
    "  var T=this.T,c=(T-1)/2,b=this.b,h=this.h,w=2*Math.PI*f/sampleRate;" +
    "  for(var j=0;j<o.length;j++){b[this.i]=x[j];b[this.i+T]=x[j];var q=0;" +
    "   for(var n=1;n<T;n+=2){q+=h[n]*b[this.i+T-n]}" +
    "   var re=b[this.i+T-c];this.i=(this.i+1)%T;" +
    "   var s=Math.sin(this.ph),co=Math.cos(this.ph);o[j]=re*co-q*s;this.ph+=w;if(this.ph>6.283185307)this.ph-=6.283185307;if(this.ph<0)this.ph+=6.283185307}" +
    "  return true}}" +
    "registerProcessor('prism-shift',PrismShift);" +
    /* the guard: gate on silence, pulls the level down when the ring runs away, kills NaN and tells the host */
    "class PrismGuard extends AudioWorkletProcessor{" +
    " constructor(){super();this.e=0;this.g=1;this.quiet=0;this.hot=0;this.sent=0;this.nan=0}" +
    " process(ins,outs){var x=ins[0],o=outs[0];if(!x||!x[0]||!o||!o[0])return true;var ch=Math.min(x.length,o.length),n=x[0].length,sq=0;" +
    "  for(var c=0;c<ch;c++){var a=x[c];for(var j=0;j<n;j++){var v=a[j];if(v!==v||v>1e3||v<-1e3){this.nan=1;v=0}sq+=v*v}}" +
    "  var r=Math.sqrt(sq/(n*ch));this.e+=(r-this.e)*.2;var dt=n/sampleRate;" +
    "  if(this.e<1e-4)this.quiet+=dt;else this.quiet=0;" +
    "  if(this.e>.5)this.hot+=dt;else this.hot=Math.max(0,this.hot-dt*.5);" +
    "  var tg=1;if(this.hot>.15)tg=.25/Math.max(.25,this.e);if(this.quiet>.4)tg=0;" +
    "  this.g+=(tg-this.g)*(tg<this.g?.35:.02);" +
    "  for(var c=0;c<ch;c++){var a=x[c],d=o[c];for(var j=0;j<n;j++){var v=a[j];d[j]=(v!==v)?0:v*this.g}}" +
    "  this.sent+=dt;if(this.sent>.1){this.sent=0;this.port.postMessage({e:this.e,g:this.g,nan:this.nan});this.nan=0}" +
    "  return true}}" +
    "registerProcessor('prism-guard',PrismGuard);";
  var wkUrl = null;
  function wkModule(ctx) {
    if (!ctx.audioWorklet) return Promise.reject(new Error("no audio worklet"));
    if (!wkUrl) wkUrl = URL.createObjectURL(new Blob([WK], { type: "application/javascript" }));
    return ctx.audioWorklet.addModule(wkUrl);
  }

  function create(ctx, opts) {
    opts = opts || {};
    var p = {}, k, st = { step: 0, dir: 1, timer: 0, nextT: 0, onT: 0 };
    for (k in DEFAULTS) p[k] = DEFAULTS[k];
    if (opts.preset && PRESETS[opts.preset]) for (k in PRESETS[opts.preset]) p[k] = PRESETS[opts.preset][k];
    if (opts.params) for (k in opts.params) p[k] = opts.params[k];
    var custom = null, bypassed = false, dead = false, level = 0, gain = 1, readyFlag = false;

    function G(v) { var g = ctx.createGain(); g.gain.value = v == null ? 1 : v; return g; }
    function F(type, f, q) { var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }

    var input = G(1), excite = G(1), output = G(1);
    var dry = G(.7), wetIn = G(1), wetSum = G(1), wet = G(.7);
    var inHP = F("highpass", 60, .5), inLP = F("lowpass", 12000, .5), atk = F("lowpass", 20000, .5);
    var mono = G(1); mono.channelCount = 1; mono.channelCountMode = "explicit"; mono.channelInterpretation = "speakers";
    input.connect(dry); dry.connect(output);
    input.connect(wetIn); excite.connect(wetIn);
    wetIn.connect(inHP); inHP.connect(inLP); inLP.connect(atk); atk.connect(mono);

    var bank = [];
    for (var i = 0; i < N; i++) {
      var f = F("bandpass", 440, 20), g = G(0), a = G(0), pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null, oct = G(1);
      mono.connect(f); f.connect(g); g.connect(a); a.connect(oct);
      if (pn) { oct.connect(pn); pn.connect(wetSum); } else oct.connect(wetSum);
      bank.push({ f: f, g: g, a: a, o: oct, pn: pn, on: false });
    }

    /* shifter (worklet) sits between the sum and motion; until it is ready the sum goes straight on */
    var shiftNode = null, guardNode = null;
    var motionAM = G(1), lfo = ctx.createOscillator(), lfoG = G(0);
    lfo.type = "sine"; lfo.frequency.value = 3; lfo.connect(lfoG); lfoG.connect(motionAM.gain); lfo.start();
    wetSum.connect(motionAM);

    var tiltLo = F("lowshelf", 400, 0), tiltHi = F("highshelf", 2500, 0);
    tiltLo.gain.value = 0; tiltHi.gain.value = 0;
    var scoop = ctx.createDynamicsCompressor();
    scoop.threshold.value = -40; scoop.knee.value = 12; scoop.ratio.value = 4; scoop.attack.value = .004; scoop.release.value = .25;
    var outHP = F("highpass", 35, .5);
    var pre = G(1), clip = ctx.createWaveShaper(), lim = ctx.createDynamicsCompressor();
    var cv = new Float32Array(1025); for (i = 0; i < 1025; i++) { var x = i / 512 - 1; cv[i] = Math.tanh(x * 1.4) / Math.tanh(1.4); } clip.curve = cv;
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .08;
    motionAM.connect(tiltLo); tiltLo.connect(tiltHi); tiltHi.connect(scoop); scoop.connect(outHP); outHP.connect(pre);
    var tail = pre; // the node the guard (when ready) is spliced after
    pre.connect(wet); wet.connect(clip); clip.connect(lim); lim.connect(output);

    /* hit: a noise burst, cached, excites the bank only */
    var burst = null;
    function burstBuf() {
      if (burst) return burst;
      var n = Math.round(ctx.sampleRate * .04), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      for (var j = 0; j < n; j++) d[j] = (Math.random() * 2 - 1) * Math.exp(-j / (n * .22));
      return (burst = b);
    }

    function notes() { return custom || CHORDS[p.chord] || CHORDS.maj7; }
    function layout(now) {
      now = now == null ? ctx.currentTime : now;
      var ns = notes().slice(0, NOTES), base = 12 * (Math.round(p.octave) + 1) + (p.root | 0), spc = clamp(p.spacing, 0, 1);
      var oct = clamp(p.spread, 0, 1) * 3;
      var nyq = ctx.sampleRate * .45, nres = 0;
      for (var o = 0; o < OCTS; o++) for (var n = 0; n < NOTES; n++) if (n < ns.length) nres++;
      for (o = 0; o < OCTS; o++) for (n = 0; n < NOTES; n++) {
        var r = bank[o * NOTES + n];
        if (n >= ns.length) { r.on = false; r.o.gain.setTargetAtTime(0, now, .02); continue; }
        var semi = base + ns[n] + 12 * o;
        /* spacing: stretched octaves (stiff strings) and a note-by-note scatter that grows with it (bars, bells) */
        var stretch = 1 + spc * (.012 * o * o + .045 * ((n * .37 + o * .81 + .13) % 1));
        var fr = clamp(hz(semi) * stretch, 40, nyq);
        var q = clamp(p.decay * fr / 2.2, .8, 600);
        r.f.frequency.setTargetAtTime(fr, now, .03); r.f.Q.setTargetAtTime(q, now, .03);
        r.g.gain.setTargetAtTime(clamp(1.5 * Math.sqrt(q) / Math.sqrt(nres * 6), .02, 4), now, .03);
        if (r.pn) r.pn.pan.setTargetAtTime(((((o * NOTES + n) * .618) % 1) * 2 - 1) * .8 * clamp(p.width, 0, 1), now, .05);
        r.o.gain.setTargetAtTime(clamp(oct - o, 0, 1), now, .05);
        r.on = true;
      }
      /* input and output */
      inHP.frequency.setTargetAtTime(clamp(p.inLo, 20, 4000), now, .03);
      inLP.frequency.setTargetAtTime(clamp(p.inHi, 400, nyq), now, .03);
      atk.frequency.setTargetAtTime(clamp(1 / (6.283 * Math.max(p.attack, .0003)), 80, 20000), now, .03);
      var d = clamp(p.depth, 0, 1), th = d * Math.PI / 2;
      dry.gain.setTargetAtTime(bypassed ? 1 : Math.cos(th), now, .03); wet.gain.setTargetAtTime(bypassed ? 0 : Math.sin(th) * 1.0, now, .03);
      tiltLo.gain.setTargetAtTime(-clamp(p.tilt, -1, 1) * 9, now, .05); tiltHi.gain.setTargetAtTime(clamp(p.tilt, -1, 1) * 9, now, .05);
      var sc = clamp(p.scoop, 0, 1);
      scoop.threshold.setTargetAtTime(-18 - (1 - sc) * 30, now, .05); scoop.ratio.setTargetAtTime(2 + sc * 10, now, .05);
      lfo.type = p.motionShape; lfo.frequency.setTargetAtTime(clamp(p.motionRate, .05, 20), now, .05);
      var m = clamp(p.motion, 0, 1); lfoG.gain.setTargetAtTime(m * .5, now, .05); motionAM.gain.setTargetAtTime(1 - m * .5, now, .05);
      if (shiftNode) shiftNode.parameters.get("hz").setTargetAtTime(clamp(p.shift, -2000, 2000), now, .03);
    }

    /* drift: a slow random walk of each resonator's detune, in cents */
    var drift = new Float32Array(N), driftT = setInterval(function () {
      if (dead || ctx.state === "closed") return;
      var amt = clamp(p.drift, 0, 1) * 18, now = ctx.currentTime;
      for (var j = 0; j < N; j++) {
        drift[j] = clamp(drift[j] * .85 + (Math.random() * 2 - 1) * amt * .5, -amt, amt);
        bank[j].f.detune.setTargetAtTime(drift[j], now, .4);
      }
    }, 250);

    /* arp: which resonators are active, one chord note (all its octaves) at a time, or the chord pulsed */
    function arpStepSec() { return p.arpSync ? 60 / Math.max(20, p.bpm) / Math.max(.125, p.arpRate) : 1 / Math.max(.05, p.arpRate); }
    function arpApply(active, t) {
      var ns = Math.min(notes().length, NOTES), tc = clamp(p.attack * 2, .004, .06);
      for (var o = 0; o < OCTS; o++) for (var n = 0; n < NOTES; n++) {
        var on = n < ns && (active === "all" || active.indexOf(n) >= 0), r = bank[o * NOTES + n];
        r.a.gain.setTargetAtTime(on ? 1 : 0, t, on ? tc : clamp(p.decay * .18, .02, .5));
      }
    }
    function arpTick() {
      if (dead) return;
      var ns = Math.min(notes().length, NOTES), now = ctx.currentTime;
      if (p.arp === "off" || ns < 1) { arpApply("all", now); return; }
      while (st.nextT < now + .12) {
        var t = Math.max(st.nextT, now), idx;
        if (p.arp === "up") idx = st.step % ns;
        else if (p.arp === "down") idx = ns - 1 - (st.step % ns);
        else if (p.arp === "updown") { var cyc = Math.max(1, ns * 2 - 2), q = st.step % cyc; idx = q < ns ? q : cyc - q; }
        else if (p.arp === "random") idx = (Math.random() * ns) | 0;
        else idx = -1;
        if (idx >= 0) arpApply([idx], t);
        else { arpApply("all", t); arpApply([], t + arpStepSec() * .5); }
        st.step++; st.nextT = t + arpStepSec();
      }
    }
    st.timer = setInterval(arpTick, 25);

    function rebuildBank() { /* a NaN got in: the filters keep their state, so reset them by re-creating their values */
      bank.forEach(function (r) { try { r.f.disconnect(); mono.disconnect(r.f); } catch (e) {} });
      for (var j = 0; j < N; j++) {
        var old = bank[j], f2 = F("bandpass", 440, 20);
        mono.connect(f2); f2.connect(old.g); old.f = f2;
      }
      layout();
    }

    function attachWorklets() {
      return wkModule(ctx).then(function () {
        if (dead) return;
        shiftNode = new AudioWorkletNode(ctx, "prism-shift", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        wetSum.disconnect(motionAM);
        var mid = G(1); /* the shifter works on a mono sum; stereo width is added by the pans before it, so sum first */
        wetSum.connect(shiftNode); shiftNode.connect(motionAM);
        guardNode = new AudioWorkletNode(ctx, "prism-guard", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
        pre.disconnect(wet); pre.connect(guardNode); guardNode.connect(wet);
        guardNode.port.onmessage = function (e) {
          level = e.data.e; gain = e.data.g;
          if (e.data.nan) rebuildBank();
        };
        readyFlag = true; layout();
      }).catch(function () { readyFlag = false; });
    }
    var ready = attachWorklets();

    layout();

    var api = {
      input: input, excite: excite, output: output, ready: ready,
      get isReady() { return readyFlag; },
      /* the Prism's own readings, for a meter */
      get level() { return level; }, get guard() { return gain; },
      set: function (a, v) {
        if (typeof a === "object") { for (var key in a) { if (key === "notes") custom = a[key]; else p[key] = a[key]; } }
        else if (a === "notes") custom = v; else { p[a] = v; if (a === "chord") custom = null; }
        if (dead) return api;
        layout(); if (typeof a === "object" && "arp" in a || a === "arp" || a === "arpRate" || a === "arpSync" || a === "bpm") { st.nextT = 0; }
        return api;
      },
      setNotes: function (arr) { custom = arr && arr.length ? arr.slice(0, NOTES) : null; layout(); return api; },
      get: function () { var o = {}; for (var key in p) o[key] = p[key]; if (custom) o.notes = custom.slice(); return o; },
      preset: function (name) {
        var pr = PRESETS[name]; if (!pr) return false;
        for (var key in DEFAULTS) p[key] = DEFAULTS[key]; for (key in pr) p[key] = pr[key]; custom = null; layout(); st.nextT = 0; return true;
      },
      /* a short burst into the bank only: every hit strikes the whole chord */
      strike: function (when, lv, ms) {
        if (dead) return;
        var s = ctx.createBufferSource(), g = G(clamp(lv == null ? 1 : lv, 0, 2) * 9); /* a short click holds little energy: 9× so one hit rings at a playing level */
        s.buffer = burstBuf(); s.playbackRate.value = clamp(.04 / ((ms || 12) / 1000), .3, 8);
        s.connect(g); g.connect(excite); var t = when == null ? ctx.currentTime : when;
        s.start(t); s.onended = function () { try { g.disconnect(); } catch (e) {} };
      },
      bypass: function (on) { bypassed = !!on; layout(); return api; },
      destroy: function () {
        dead = true; clearInterval(driftT); clearInterval(st.timer);
        try { lfo.stop(); } catch (e) {}
        [input, excite, output, dry, wet, wetIn, wetSum].forEach(function (n) { try { n.disconnect(); } catch (e) {} });
        bank.forEach(function (r) { try { r.f.disconnect(); r.g.disconnect(); r.a.disconnect(); r.o.disconnect(); if (r.pn) r.pn.disconnect(); } catch (e) {} });
        if (shiftNode) try { shiftNode.disconnect(); } catch (e) {}
        if (guardNode) try { guardNode.disconnect(); } catch (e) {}
      }
    };
    return api;
  }

  window.SurfacePrism = { create: create, CHORDS: CHORDS, PRESETS: PRESETS, DEFAULTS: DEFAULTS, NOTES: NOTES, OCTAVES: OCTS };
})();
