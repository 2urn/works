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
     SurfaceTouchSound.on(id) / active() / set([ids]) / enabled(bool?) / add({id, name, note})
   Plain script, window.SurfaceTouchSound, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceTouchSound) return;
  var MAX = 2, KEY = "surface.touchsound";
  var PRESETS = [
    { id: "fader", name: "Fader", note: "the faster you drag, the louder the music; let go and it settles" },
    { id: "sweep", name: "Sweep", note: "finger height opens a filter: low is muffled, high is bright" },
    { id: "pan", name: "Pan", note: "the sound follows your finger, left to right" },
    { id: "wash", name: "Wash", note: "hold still and reverb builds; move and it clears" }
  ];
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
    A = { ctx: ctx, fader: fader, filt: filt, pan: pan, wet: wet };
    return A;
  }
  function tick(s, dt) {
    if (!A) return; s = s || {}; dt = Math.min(0.1, dt || 0.016);
    var t = A.ctx.currentTime, down = !!s.down, sp = down ? Math.max(0, Math.min(1, s.speed || 0)) : 0;
    env.speed += (sp - env.speed) * (sp > env.speed ? Math.min(1, dt / 0.08) : Math.min(1, dt / 1.2));   // quick to rise, slow to settle
    A.fader.gain.setTargetAtTime(on("fader") ? 0.35 + 0.65 * env.speed : 1, t, 0.06);
    if (on("sweep") && down) { A.filt.frequency.setTargetAtTime(160 * Math.pow(2, 7 * Math.max(0, Math.min(1, s.y))), t, 0.05); A.filt.Q.setTargetAtTime(1.4, t, 0.1); }
    else { A.filt.frequency.setTargetAtTime(20000, t, 0.35); A.filt.Q.setTargetAtTime(0.7, t, 0.3); }
    if (A.pan) A.pan.pan.setTargetAtTime(on("pan") && down ? (Math.max(0, Math.min(1, s.x)) * 2 - 1) * 0.85 : 0, t, on("pan") && down ? 0.05 : 0.4);
    var still = down && sp < 0.06, goal = on("wash") ? (still ? 0.75 : 0) : 0, rate = goal > env.wet ? dt / 2.5 : (down ? dt / 0.4 : dt / 1.5);
    env.wet += (goal - env.wet) * Math.min(1, rate * 3);
    A.wet.gain.setTargetAtTime(env.wet, t, 0.05);
  }
  var CSS = ".sts{display:flex;flex-direction:column;gap:12px;padding:8px 16px 14px}" +
    ".sts-sw{display:flex;align-items:center;justify-content:space-between;gap:12px;font:600 13px/1.3 var(--sans,system-ui)}" +
    ".sts-sw button{font:600 11px/1 var(--mono,ui-monospace,monospace);letter-spacing:.12em;text-transform:uppercase;padding:8px 12px;border-radius:999px;border:1px solid rgb(var(--ui-hi,255 255 255) / .22);background:none;color:inherit;cursor:pointer}" +
    ".sts-sw button[aria-pressed=true]{background:var(--acc,#55b8c9);border-color:var(--acc,#55b8c9);color:var(--acc-ink,#04181c)}" +
    ".sts-list{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}" +
    ".sts-list button{width:100%;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:baseline;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid rgb(var(--ui-hi,255 255 255) / .14);background:none;color:inherit;cursor:pointer}" +
    ".sts-list button b{font:600 14px/1.2 var(--sans,system-ui)}.sts-list button span{grid-column:1/-1;font:400 12px/1.35 var(--sans,system-ui);color:var(--ui-dim,#8a9396)}" +
    ".sts-list button[aria-pressed=true]{border-color:var(--acc,#55b8c9);box-shadow:inset 0 0 0 1px var(--acc,#55b8c9)}" +
    ".sts-list button[aria-pressed=true] b::after{content:' \\2022 on';font:600 10px/1 var(--mono,monospace);letter-spacing:.1em;color:var(--acc,#55b8c9)}" +
    ".sts-list button:focus-visible,.sts-sw button:focus-visible{outline:2px solid var(--acc,#55b8c9);outline-offset:2px}" +
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
      var p = document.createElement("p"); p.className = "sts-note"; p.textContent = "Your touch plays the sound as it moves the field. Pick up to two."; box.appendChild(p);
      var ul = document.createElement("ul"); ul.className = "sts-list";
      PRESETS.forEach(function (pr) {
        var li = document.createElement("li"), bt = document.createElement("button"); bt.type = "button"; bt.setAttribute("aria-pressed", String(on(pr.id)));
        bt.innerHTML = "<b></b><span></span>"; bt.querySelector("b").textContent = pr.name; bt.querySelector("span").textContent = pr.note;
        bt.onclick = function () { toggle(pr.id); if (o.onChange) o.onChange(); };
        li.appendChild(bt); ul.appendChild(li);
      });
      box.appendChild(ul);
      var pro = document.createElement("p"); pro.className = "sts-note";
      pro.textContent = "With Pro: Touch Mapping, any gesture to any part of the sound, several at once, shaped and saved as your own touch rigs.";
      box.appendChild(pro);
    }
    listeners.push(draw); draw();
    return { draw: draw };
  }
  function add(p) { if (p && p.id && !known(p.id)) PRESETS.push({ id: p.id, name: p.name || p.id, note: p.note || "" }); }
  window.SurfaceTouchSound = { use: use, attach: attach, tick: tick, picker: picker, on: on, set: set, toggle: toggle, enabled: enabled, add: add,
    state: function () { return A ? { fader: +A.fader.gain.value.toFixed(3), cutoff: Math.round(A.filt.frequency.value), pan: A.pan ? +A.pan.pan.value.toFixed(3) : 0, wet: +A.wet.gain.value.toFixed(3) } : null; },
    active: function () { return st.on ? st.act.slice() : []; }, listen: function (f) { listeners.push(f); }, presets: function () { return PRESETS.slice(); } };
})();
