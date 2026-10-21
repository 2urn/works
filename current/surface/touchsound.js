/* Surface · Touchable Sound — the hand that moves the field also plays the sound (Dimitry, 20 Oct 2026).

   FREE: named presets, each a finished recipe tuned to just work; up to two at once (his choice, 20 Oct).
     Fader  the faster you drag, the louder the music comes up; let go and it settles back
     Sweep  finger height opens a filter: low is muffled, high is bright
     Pan    the sound follows your finger, left to right
     Wash   hold still and reverb builds; move and it clears
   A tool can add its own presets (Current adds Tide: the drag plays the bytebeat) with SurfaceTouchSound.add().
   PRO (not built here yet): Touch Mapping, any gesture to any sound parameter, several at once, ranges and curves,
   saved touch rigs, recorded gestures, MIDI/OSC out. The picker says so once, plainly.

   The module owns a short chain the tool puts on its master, before the speakers (and before any recording tap, so
   a video carries what you heard):  input -> fader -> filter -> pan -> dry + reverb -> output.
   Every stage rests neutral (gain 1, filter open, centre, dry) while no preset uses it.

     SurfaceTouchSound.use(key)                            where the choices are kept (call at boot, after add())
     SurfaceTouchSound.attach(ctx, input, output, {key})   build the chain between two nodes the tool owns
     SurfaceTouchSound.tick({down, x, y, speed}, dt)       every frame: x, y in 0..1 (y = 1 at the top), speed 0..1
     SurfaceTouchSound.picker(host, {onChange})             the preset chips, the two-at-once rule, the Pro line
     SurfaceTouchSound.on(id) / active() / set([ids]) / enabled(bool?) / add({id, name, note, icon})   icon: the inside of a 24-unit svg
     picker(host, {onChange, onPro})   onPro: the Pro tile was tapped (its sentence shows either way)
   Plain script, window.SurfaceTouchSound, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceTouchSound) return;
  var MAX = 2, KEY = "surface.touchsound";
  var PRESETS = [
    { id: "fader", name: "Fader", note: "the faster you drag, the louder the music; let go and it settles",
      icon: '<path d="M12 3v18"/><rect x="8" y="12" width="8" height="4.5" rx="1.5"/><path d="M4 8h2M4 12h2M4 16h2M18 8h2M18 12h2M18 16h2"/>' },
    { id: "sweep", name: "Sweep", note: "finger height opens a filter: low is muffled, high is bright",
      icon: '<path d="M3 9h7c4 0 5 9 11 9"/><path d="M19 3v6M17 5l2-2 2 2"/>' },
    { id: "pan", name: "Pan", note: "the sound follows your finger, left to right",
      icon: '<path d="M3 12h18M6.5 8.5 3 12l3.5 3.5M17.5 8.5 21 12l-3.5 3.5"/><circle cx="12" cy="12" r="2.2"/>' },
    { id: "wash", name: "Wash", note: "hold still and reverb builds; move and it clears",
      icon: '<circle cx="5.5" cy="12" r="1.6"/><path d="M9 8.5a5 5 0 0 1 0 7M12.5 6a8.5 8.5 0 0 1 0 12M16 3.5a12 12 0 0 1 0 17"/>' }
  ];
  /* ICONS FIRST (Dimitry, 21 Oct: "touchable sound needs icons, too wordy; let descriptions exist as a hover layer on
     baseline"). Each preset is a tile, an icon and its name; its sentence shows in one line at the foot of the pane
     while it is pointed at, focused or tapped, and the line says what the pane is for the rest of the time. Pro's
     Touch Mapping is a tile of its own: a lock, a dotted edge and a tint (CONVENTIONS), its sentence in the same line. */
  var MAP_ICON = '<circle cx="6" cy="17" r="2"/><circle cx="18" cy="7" r="2"/><path d="M7.6 15.6c2.4-2.6 2-6.6 4.4-8.1s3.2-.4 4.4-.6"/><path d="M6 6h4M8 4v4M14 18h4"/>';
  var LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/><rect x="4.5" y="10" width="15" height="11.5" rx="2.4"/></svg>';
  var REST = "Your touch plays the sound as it moves the field. Pick up to two.";
  var PRO_NOTE = "Pro: Touch Mapping. Any gesture to any part of the sound, several at once, saved as your own touch rigs.";
  var st = { on: false, act: [], last: ["sweep"] }, loaded = false, A = null, env = { speed: 0, wet: 0 }, listeners = [];
  function use(k) { KEY = "surface.touchsound." + k; loaded = true; load(KEY); changed(); }
  function load(k) { try { var o = JSON.parse(localStorage.getItem(k) || "{}"); if (Array.isArray(o.act)) st.act = o.act.slice(0, MAX); if (Array.isArray(o.last) && o.last.length) st.last = o.last.slice(0, MAX); st.on = !!o.on && st.act.length > 0; } catch (e) {} }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ on: st.on, act: st.act, last: st.last })); } catch (e) {} }
  function changed() { save(); listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
  function known(id) { return PRESETS.some(function (p) { return p.id === id; }); }
  function on(id) { return st.on && st.act.indexOf(id) >= 0; }
  function set(ids) { st.act = (ids || []).filter(known).slice(-MAX); if (st.act.length) st.last = st.act.slice(); st.on = st.act.length > 0; changed(); }
  function toggle(id) {
    var a = st.on ? st.act.slice() : [], i = a.indexOf(id);
    if (i >= 0) a.splice(i, 1); else { a.push(id); if (a.length > MAX) a.shift(); }   // a third replaces the oldest
    set(a);
  }
  function enabled(v) { if (v === undefined) return st.on; if (v) set(st.act.length ? st.act : st.last); else { st.on = false; changed(); } return st.on; }
  function attach(ctx, input, output, o) {
    o = o || {}; if (o.key && !loaded) use(o.key);
    var fader = ctx.createGain(), filt = ctx.createBiquadFilter(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null,
      dry = ctx.createGain(), wet = ctx.createGain(), conv = ctx.createConvolver(), out = ctx.createGain();
    filt.type = "lowpass"; filt.frequency.value = 20000; filt.Q.value = 0.7; wet.gain.value = 0;
    var L = Math.round(ctx.sampleRate * 1.8), ir = ctx.createBuffer(2, L, ctx.sampleRate);   // a room made here: decaying noise, a little different left and right
    for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < L; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / L, 2.6); }
    conv.buffer = ir;
    input.connect(fader); fader.connect(filt); var last = filt; if (pan) { filt.connect(pan); last = pan; }
    last.connect(dry); last.connect(conv); conv.connect(wet); dry.connect(out); wet.connect(out); out.connect(output);
    /* the watch (Current 0.26.39): ears on what comes in and what goes out, so a filter that breaks can be replaced */
    var inAn = ctx.createAnalyser(), outAn = ctx.createAnalyser(); inAn.fftSize = outAn.fftSize = 512;
    input.connect(inAn); out.connect(outAn);
    A = { ctx: ctx, fader: fader, filt: filt, pan: pan, wet: wet, dry: dry, conv: conv, inAn: inAn, outAn: outAn, buf: new Float32Array(512), quiet: 0, check: 0, heals: 0 };
    return A;
  }
  function fin(v, d) { v = +v; return isFinite(v) ? v : d; }
  function peak(an) { an.getFloatTimeDomainData(A.buf); var m = 0, bad = false; for (var i = 0; i < A.buf.length; i++) { var v = A.buf[i]; if (!isFinite(v)) { bad = true; break; } if (v < 0) v = -v; if (v > m) m = v; } return bad ? -1 : m; }
  /* SELF-REPAIR (Dimitry's iPhone, 20 Oct: Beat: Hat Shimmer with Pan + Sweep went silent mid-drag, and stayed silent).
     Safari's BiquadFilterNode can be pushed into NaN by a fast-moving cutoff; once its state is NaN everything after it
     is silent for good. A few times a second, compare what comes in with what goes out: NaN out, or music in and
     nothing out for half a second, and the filter is replaced with a fresh one at the same settings. */
  function heal() {
    var c = A.ctx, old = A.filt, nf = c.createBiquadFilter();
    nf.type = "lowpass"; nf.frequency.value = 20000; nf.Q.value = 0.7;
    try { A.fader.disconnect(old); } catch (e) {} try { old.disconnect(); } catch (e) {}
    A.fader.connect(nf);
    if (A.pan) nf.connect(A.pan); else { nf.connect(A.dry); nf.connect(A.conv); }   // without a panner the filter fed dry and the room
    A.filt = nf; A.heals++; A.quiet = 0;
    try { console.warn("[touchsound] filter replaced (" + A.heals + ")"); } catch (e) {}
  }
  function watch(dt) {
    A.check += dt; if (A.check < 0.25) return; var step = A.check; A.check = 0;
    var o = peak(A.outAn); if (o < 0) { heal(); return; }
    var i = peak(A.inAn); if (i > 0.02 && o < 1e-5) { A.quiet += step; if (A.quiet >= 0.5) heal(); } else A.quiet = 0;
  }
  function tick(s, dt) {
    if (!A) return; s = s || {}; dt = Math.min(0.1, fin(dt, 0.016));
    s = { down: !!s.down, x: Math.max(0, Math.min(1, fin(s.x, 0.5))), y: Math.max(0, Math.min(1, fin(s.y, 0.5))), speed: fin(s.speed, 0) };
    try { watch(dt); } catch (e) {}
    var t = A.ctx.currentTime, down = !!s.down, sp = down ? Math.max(0, Math.min(1, s.speed || 0)) : 0;
    env.speed += (sp - env.speed) * (sp > env.speed ? Math.min(1, dt / 0.08) : Math.min(1, dt / 1.2));   // quick to rise, slow to settle
    A.fader.gain.setTargetAtTime(on("fader") ? 0.35 + 0.65 * env.speed : 1, t, 0.06);
    var top = Math.min(18000, A.ctx.sampleRate * 0.4);
    if (on("sweep") && down) { A.filt.frequency.setTargetAtTime(Math.min(top, 160 * Math.pow(2, 7 * s.y)), t, 0.09); A.filt.Q.setTargetAtTime(1.0, t, 0.15); }
    else { A.filt.frequency.setTargetAtTime(top, t, 0.35); A.filt.Q.setTargetAtTime(0.7, t, 0.3); }
    if (A.pan) A.pan.pan.setTargetAtTime(on("pan") && down ? (Math.max(0, Math.min(1, s.x)) * 2 - 1) * 0.85 : 0, t, on("pan") && down ? 0.05 : 0.4);
    var still = down && sp < 0.06, goal = on("wash") ? (still ? 0.75 : 0) : 0, rate = goal > env.wet ? dt / 2.5 : (down ? dt / 0.4 : dt / 1.5);
    env.wet += (goal - env.wet) * Math.min(1, rate * 3);
    A.wet.gain.setTargetAtTime(env.wet, t, 0.05);
  }
  var CSS = ".sts{display:flex;flex-direction:column;gap:12px;padding:8px 16px 14px}" +
    ".sts-sw{display:flex;align-items:center;justify-content:space-between;gap:12px;font:600 13px/1.3 var(--sans,system-ui)}" +
    ".sts-sw button{font:600 11px/1 var(--mono,ui-monospace,monospace);letter-spacing:.12em;text-transform:uppercase;padding:8px 12px;border-radius:999px;border:1px solid rgb(var(--ui-hi,255 255 255) / .22);background:none;color:inherit;cursor:pointer}" +
    ".sts-sw button[aria-pressed=true]{background:var(--acc,#55b8c9);border-color:var(--acc,#55b8c9);color:var(--acc-ink,#04181c)}" +
    ".sts-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}" +
    ".sts-t{position:relative;width:100%;min-height:62px;padding:8px 4px;border-radius:12px;border:1px solid rgb(var(--ui-hi,255 255 255) / .14);background:rgb(var(--ui-hi,255 255 255) / .04);color:var(--ui-mid,var(--ui-ink,inherit));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;font:500 10px/1.1 var(--mono,ui-monospace,monospace);letter-spacing:.08em;text-transform:uppercase;-webkit-tap-highlight-color:transparent}" +
    ".sts-t>svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}" +
    ".sts-t:hover{border-color:rgb(var(--ui-hi,255 255 255) / .3)}" +
    ".sts-t[aria-pressed=true]{background:var(--acc,#55b8c9);border-color:var(--acc,#55b8c9);color:var(--acc-ink,#04181c)}" +
    ".sts-t.pro{border-style:dotted;border-width:1.5px;border-color:rgb(var(--acc-rgb,85 184 201) / .55);background:rgb(var(--acc-rgb,85 184 201) / .08);color:var(--ui-dim,#8a9396)}" +
    ".sts-t .lk{position:absolute;top:6px;right:7px;display:inline-flex;color:var(--acc,#55b8c9)}.sts-t .lk svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".sts-off .sts-t[aria-pressed=false]:not(.pro){opacity:.75}" +
    ".sts-base{margin:0;min-height:2.8em;font:400 12px/1.4 var(--sans,system-ui);color:var(--ui-dim,#8a9396);transition:color .15s ease}" +
    ".sts-base.on{color:var(--ui-ink,inherit)}.sts-base b{font-weight:600}" +
    ".sts-t:focus-visible,.sts-sw button:focus-visible{outline:2px solid var(--acc,#55b8c9);outline-offset:2px}" +
    ".sts-note{margin:0;font:400 12px/1.4 var(--sans,system-ui);color:var(--ui-dim,#8a9396)}";
  function picker(host, o) {
    o = o || {};
    if (!document.getElementById("sts-css")) { var s = document.createElement("style"); s.id = "sts-css"; s.textContent = CSS; document.head.appendChild(s); }
    var box = document.createElement("div"); box.className = "sts"; host.innerHTML = ""; host.appendChild(box);
    function draw() {
      box.innerHTML = "";
      var sw = document.createElement("div"); sw.className = "sts-sw";
      var lab = document.createElement("span"); lab.textContent = "Touchable sound";
      var b = document.createElement("button"); b.type = "button"; b.textContent = st.on ? "on" : "off"; b.setAttribute("aria-pressed", String(st.on));
      b.setAttribute("aria-label", "Touchable sound " + (st.on ? "on" : "off")); b.onclick = function () { enabled(!st.on); if (o.onChange) o.onChange(); };
      sw.append(lab, b); box.appendChild(sw);
      box.classList.toggle("sts-off", !st.on);
      var ul = document.createElement("ul"); ul.className = "sts-list";
      var base = document.createElement("p"); base.className = "sts-base"; base.setAttribute("aria-live", "polite");
      var say = function (pr) { if (!pr) { base.classList.remove("on"); base.textContent = REST; return; }
        base.classList.add("on"); base.innerHTML = "<b></b>: "; base.querySelector("b").textContent = pr.name; base.appendChild(document.createTextNode(pr.note)); };
      var tile = function (pr, pro) {
        var li = document.createElement("li"), bt = document.createElement("button"); bt.type = "button"; bt.className = "sts-t" + (pro ? " pro" : "");
        bt.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (pr.icon || '<circle cx="12" cy="12" r="6"/>') + "</svg><span></span>" + (pro ? '<em class="lk">' + LOCK + "</em>" : "");
        bt.querySelector("span").textContent = pr.name;
        if (pro) { bt.setAttribute("aria-disabled", "true"); bt.setAttribute("aria-label", pr.name + ", a Pro feature: " + pr.note); }
        else { bt.setAttribute("aria-pressed", String(on(pr.id))); bt.setAttribute("aria-label", pr.name + ": " + pr.note); }
        bt.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") say(pr); });
        bt.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") say(null); });
        bt.addEventListener("focus", function () { say(pr); }); bt.addEventListener("blur", function () { say(null); });
        bt.onclick = function () { if (pro) { say(pr); if (o.onPro) o.onPro(); return; } toggle(pr.id); if (o.onChange) o.onChange(); };
        li.appendChild(bt); ul.appendChild(li);
      };
      PRESETS.forEach(function (pr) { tile(pr, false); });
      tile({ id: "mapping", name: "Mapping", note: PRO_NOTE.replace(/^Pro: Touch Mapping\. /, ""), icon: MAP_ICON }, true);
      box.appendChild(ul); say(null); box.appendChild(base);
    }
    var said = null; var draw0 = draw; draw = function () { draw0(); if (said) { var pr = PRESETS.filter(function (x) { return x.id === said; })[0]; var b = box.querySelector('.sts-base'); if (pr && b) { b.classList.add('on'); b.innerHTML = '<b></b>: '; b.querySelector('b').textContent = pr.name; b.appendChild(document.createTextNode(pr.note)); } said = null; } };
    box.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('.sts-t'); if (!t || t.classList.contains('pro')) return; var i = Array.prototype.indexOf.call(box.querySelectorAll('.sts-t'), t); if (PRESETS[i]) said = PRESETS[i].id; }, true);
    listeners.push(function () { draw(); }); draw();
    return { draw: draw };
  }
  function add(p) { if (p && p.id && !known(p.id)) PRESETS.push({ id: p.id, name: p.name || p.id, note: p.note || "", icon: p.icon || "" }); }
  window.SurfaceTouchSound = { use: use, attach: attach, tick: tick, picker: picker, on: on, set: set, toggle: toggle, enabled: enabled, add: add,
    state: function () { return A ? { heals: A.heals, fader: +A.fader.gain.value.toFixed(3), cutoff: Math.round(A.filt.frequency.value), pan: A.pan ? +A.pan.pan.value.toFixed(3) : 0, wet: +A.wet.gain.value.toFixed(3) } : null; },
    _chain: function () { return A; },   // for tests: break a stage on purpose and watch it heal
    active: function () { return st.on ? st.act.slice() : []; }, listen: function (f) { listeners.push(f); }, presets: function () { return PRESETS.slice(); } };
})();
