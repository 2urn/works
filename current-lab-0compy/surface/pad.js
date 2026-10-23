/* Surface · Pad — sounds as dots on a stage, dragged by hand, repeating the journey your hand made
   (Dimitry, 23 Oct 2026: "what if we bring in the draggable sounds from Pullula and the pad?" … "on the stage").
   Ported from Pullula's pad (its placed sounds, journeys and let-go, @ 50dfe54): the method, not its chrome.

   A dot is a sound standing somewhere on the host: across is left to right (pan −1 … 1), height is pitch
   (the top an octave up, the bottom an octave down, the middle as written; `range` sets how far, in cents).
   Placed, a one-shot repeats at its own length (plus a short breath), and a held sound holds for as long as the
   dot is on the stage; taken off, a held sound lets go the way its recipe says ("letgo": "finish", the default,
   finishes the pass of its middle it is in; "now" ends at once). Drag a dot and it follows; let go and it repeats
   your journey: timed points, looped (smoothing on the dot's menu). Dragged to the stage's very edge (`edge` px, 14) or
   past it and let go, it comes off (Undo puts it back). Each finger drags its own dot. A press that
   is not on a dot is the host's: the module never takes the empty stage.

     var PAD = SurfacePad.mount({
       key: 'current',                          // saves per tool: localStorage surface.pad.<key>
       host: element | () => element,           // where the dots stand (positioned; the dots ride its box)
       ctx:  () => AudioContext | null,  dest: () => AudioNode | null,  on: () => boolean,
       sounds: () => [{ id, name, recipe, level, on }],   // what may stand on the stage (a tool's Pad sounds)
       ensure: recipes => [ids],                // presets: make these sounds available, return their ids in order
       say: text => {},  onChange: state => {},  range: 1200,  gap: 0.5,  edge: 14,
       words: { surface: 'the stage' }          // how the words a person reads name the surface (Current's lab: 'the field')
     });
     PAD.add(soundId, x, y, { journey, level }) → dot id      PAD.remove(id)   PAD.clear()   PAD.count(soundId)
     PAD.positions() → [{ id, sound, name, x, y, vx, vy, speed, energy, held, dragging, color }]   (read each frame)
     PAD.voices()    → [{ id, sound, name, recipe, pan, cents, level, held, sounding }]          (what SurfaceVoice plays)
     PAD.state() / PAD.load(state)   plain data {v:1, dots:[{sound, x, y, level, j}]} (works in Room; not synced yet)
     PAD.dragIn(pointerEvent, soundId)   carry a sound from a list onto the stage (let go over it to place)
     PAD.color(soundId)   PAD.presets()   PAD.preset(name)   PAD.sync()   PAD.show(bool)   PAD.paint(ctx, w, h)
   A journey is { pts: [[seconds, x, y], …], dur, smooth? }. SurfacePad.shape.circle/ellipse/eight/cross make them.
   Keyboard: every dot is a button in the tab order. Arrows move it (Shift: further), J walks a journey with the
   arrows (J or Enter keeps it, Escape drops it), + and − its level, Enter hears it, Delete takes it off, the menu
   key (or Shift+F10, or a long press, or a right click) opens its menu: smooth the journey, hold still, take off.
   Needs SurfaceVoice (voice.js) to sound; draws and saves without it. Plain script, window.SurfacePad. */
(function () {
  "use strict";
  if (window.SurfacePad) return;

  /* a sound's colour, the same one everywhere it shows (Pullula's colourOf): eight warm-and-cool hues, nine set apart
     from them, then hues a golden angle apart */
  var HUES = ["#f0b44c", "#7fd3e8", "#f08a9c", "#b6dd6a", "#b69cf0", "#f59a5a", "#6ad6b6", "#e8d86a"];
  var HUES2 = ["#4f8df0", "#d46be0", "#3fbf7f", "#ff6b6b", "#a7b1c2", "#f0e6c8", "#8a7cf0", "#e0a0c8", "#b08060"];
  function colourOf(i) { return i < HUES.length ? HUES[i] : i < HUES.length + HUES2.length ? HUES2[i - HUES.length] : "hsl(" + Math.round((i * 137.508 + 23) % 360) + " 68% 68%)"; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r3(v) { return Math.round(v * 1000) / 1000; }

  /* ---------- journeys made by number (for presets and tools) ---------- */
  function timed(pts, secs) { var n = pts.length; return { pts: pts.map(function (q, k) { return [r3(secs * k / (n - 1)), r3(q[0]), r3(q[1])]; }), dur: r3(secs), smooth: true }; }
  var shape = {
    /* round a centre: dir 1 clockwise on screen, −1 the other way; phase in turns */
    ellipse: function (cx, cy, rx, ry, secs, dir, phase, n) { n = n || 48; dir = dir || 1; phase = phase || 0; var p = [];
      for (var k = 0; k <= n; k++) { var a = (phase + dir * k / n) * Math.PI * 2; p.push([clamp(cx + rx * Math.cos(a), 0, 1), clamp(cy + ry * Math.sin(a), 0, 1)]); } return timed(p, secs); },
    circle: function (cx, cy, r, secs, dir, phase) { return shape.ellipse(cx, cy, r, r, secs, dir, phase); },
    /* a figure of eight lying on its side */
    eight: function (cx, cy, rx, ry, secs, n) { n = n || 64; var p = [];
      for (var k = 0; k <= n; k++) { var a = k / n * Math.PI * 2; p.push([clamp(cx + rx * Math.sin(a), 0, 1), clamp(cy + ry * Math.sin(2 * a), 0, 1)]); } return timed(p, secs); },
    /* across and back on a bow (arc > 0 bows up, toward the higher pitch), so the repeat never jumps */
    cross: function (x0, y0, x1, y1, secs, arc, n) { n = n || 40; arc = arc || 0; var p = [];
      for (var k = 0; k <= n; k++) { var u = k / n, f = u < 0.5 ? u * 2 : 2 - u * 2, s = (1 - Math.cos(f * Math.PI)) / 2, b = Math.sin(s * Math.PI) * arc * (u < 0.5 ? 1 : 0.6);
        p.push([clamp(x0 + (x1 - x0) * s, 0, 1), clamp(y0 + (y1 - y0) * s - b, 0, 1)]); } return timed(p, secs); }
  };

  /* smooth a journey (Pullula's): rounded (Chaikin, three passes), closed back to where it started so the repeat
     never jumps, and re-timed so it moves at an even pace */
  function smoothed(j) {
    var P = j.pts.map(function (q) { return [q[1], q[2]]; }); P.push(P[0]);
    for (var n = 0; n < 3; n++) { var Q = [];
      for (var k = 0; k < P.length - 1; k++) { var A = P[k], B = P[k + 1]; Q.push([A[0] * 0.75 + B[0] * 0.25, A[1] * 0.75 + B[1] * 0.25], [A[0] * 0.25 + B[0] * 0.75, A[1] * 0.25 + B[1] * 0.75]); }
      Q.push(Q[0]); P = Q; }
    var L = 0, len = [0];
    for (var i = 1; i < P.length; i++) { L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); len.push(L); }
    var dur = Math.max(1, j.dur * 1.15);
    return { pts: P.map(function (q, k) { return [r3(dur * len[k] / (L || 1)), r3(q[0]), r3(q[1])]; }), dur: r3(dur), smooth: true };
  }
  function at(j, t) {   // where a journey is, t seconds in (looped)
    var P = j.pts, u = j.dur > 0 ? t % j.dur : 0, k = 1;
    while (k < P.length - 1 && P[k][0] < u) k++;
    var A = P[k - 1], B = P[k], f = B[0] > A[0] ? clamp((u - A[0]) / (B[0] - A[0]), 0, 1) : 0;
    return [A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f];
  }
  function okJourney(j) { return !!(j && Array.isArray(j.pts) && j.pts.length > 1 && j.dur > 0.25 && j.pts.every(function (q) { return Array.isArray(q) && q.length >= 3 && isFinite(q[0]) && isFinite(q[1]) && isFinite(q[2]); })); }
  function cleanJ(j) { if (!okJourney(j)) return null; return { pts: j.pts.slice(0, 2000).map(function (q) { return [r3(Math.max(0, +q[0])), r3(clamp(+q[1], 0, 1)), r3(clamp(+q[2], 0, 1))]; }), dur: r3(Math.min(600, +j.dur)), smooth: !!j.smooth }; }

  /* ---------- presets: a few sounds already on their journeys (synth recipes, so they play with nothing imported) ---------- */
  function lib(name) { var L = window.SurfaceVoiceLib; var r = L && (L.sounds || []).filter(function (x) { return x.name === name; })[0]; return r ? JSON.parse(JSON.stringify(r)) : null; }
  /* two of the Frost Water starter pack's synth sounds, as they are in the pack (CC BY 4.0, CHAMY·XYZ studio) */
  var DROP_LADDER = { format: "voice/0", name: "drop ladder", about: "A drop whose pitch climbs as it rings (glide 1.8), a different note each time. From the Frost Water starter pack.", made: { by: "CHAMY·XYZ studio (Dimitry Saïd Chamy, with Claude)", for: "Frost Electronic Music Ensemble, University of Miami · WATER, 8 Nov 2026" }, hold: false, trim: -3,
    events: [{ during: "start", count: 1, grain: { source: "tone", wave: "sine", len: 0.22, gain: 0.55, freq: [520, 1180], glide: 1.8, filter: { type: "lowpass", freq: 6000, q: 0.7 } } }], layers: [] };
  var GLASS_BOWL = null;   // read from the pack when it is there; otherwise the library's rubbed rim plays the part
  var PRESETS = [
    { name: "Tide pool", note: "drips circling slowly, a pebble going the other way, a glass bell above them",
      sounds: function () { return [DROP_LADDER, lib("pebble on tile"), lib("crystal")]; },
      dots: [{ n: 0, j: shape.circle(0.5, 0.56, 0.24, 14, 1) , level: 0.9 }, { n: 1, j: shape.ellipse(0.5, 0.6, 0.12, 0.09, 9, -1, 0.5), level: 0.7 }, { n: 2, x: 0.5, y: 0.22, level: 0.55 }] },
    { name: "Two gulls", note: "two held calls crossing the stage high up, one each way, rising as they cross",
      sounds: function () { return [lib("rubbed rim"), GLASS_BOWL || lib("sustain")]; },
      dots: [{ n: 0, j: shape.cross(0.1, 0.3, 0.9, 0.24, 11, 0.12), level: 0.7 }, { n: 1, j: shape.cross(0.88, 0.4, 0.12, 0.34, 14, 0.1), level: 0.6 }] },
    { name: "Undertow", note: "air drifting low in a figure of eight, a crystal far up, shards turning slowly between them",
      sounds: function () { return [lib("air"), lib("crystal"), lib("shards")]; },
      dots: [{ n: 0, j: shape.eight(0.5, 0.78, 0.34, 0.08, 18), level: 0.6 }, { n: 1, x: 0.72, y: 0.16, level: 0.5 }, { n: 2, j: shape.circle(0.32, 0.46, 0.1, 12, -1), level: 0.5 }] }
  ];

  var CSS = ".spad{position:absolute;inset:0;pointer-events:none;z-index:4;overflow:hidden;contain:layout}" +
    ".spad[hidden]{display:none}.spad svg.spt{position:absolute;inset:0;width:100%;height:100%;overflow:visible}" +
    ".spad svg.spt polyline{fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;opacity:.32;vector-effect:non-scaling-stroke}" +
    ".spad svg.spt polyline.rec{opacity:.6;stroke-dasharray:2 5}" +
    ".spd{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;padding:0;border:0;border-radius:50%;background:none;pointer-events:auto;touch-action:none;cursor:grab;-webkit-tap-highlight-color:transparent;--e:0;--lv:1;user-select:none;-webkit-user-select:none}" +
    ".spd::before{content:'';position:absolute;inset:-8px;border-radius:50%}" +   /* a 46 px target, drawn at 30 */
    ".spd i{position:absolute;border-radius:50%;pointer-events:none}" +
    ".spd .cr{inset:7px;background:var(--c);box-shadow:0 0 0 1.5px rgb(0 0 0 / .55),0 0 calc(6px + 16px * var(--e)) var(--c);opacity:calc(.55 + .45 * var(--lv))}" +
    ".spd .rg{inset:0;border:1.5px solid var(--c);opacity:calc(.25 + .6 * var(--e));transform:scale(calc(.82 + .5 * var(--e)))}" +
    ".spd .tp{position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);white-space:nowrap;font:600 10px/1 var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.06em;color:#fff;background:rgb(0 0 0 / .55);padding:4px 6px;border-radius:6px;opacity:0;transition:opacity .2s;pointer-events:none}" +
    ".spd:hover .tp,.spd:focus-visible .tp,.spd.drag .tp{opacity:1}" +
    ".spd:focus-visible{outline:2px solid var(--c);outline-offset:6px}" +
    ".spd.drag{cursor:grabbing}.spd.drag .cr{transform:scale(1.15)}" +
    ".spd.leaving{opacity:.3}.spd.off .cr{background:none;box-shadow:inset 0 0 0 1.5px var(--c)}" +
    ".spd.gone{opacity:0;transform:scale(.4);transition:opacity .35s,transform .35s;pointer-events:none}" +
    ".spm{position:absolute;pointer-events:auto;display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:12px;background:var(--ui-solid,#0f1213);border:1px solid var(--ui-line,#23292b);box-shadow:0 8px 24px rgb(0 0 0 / .4);z-index:5;min-width:150px}" +
    ".spm b{font:600 10px/1.2 var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;color:var(--ui-dim,#8a9396);padding:4px 8px 6px}" +
    ".spm button{all:unset;box-sizing:border-box;min-height:36px;padding:0 10px;border-radius:8px;font:500 13px/36px var(--sans,system-ui);color:var(--ui-ink,#eef1f2);cursor:pointer}" +
    ".spm button:hover,.spm button:focus-visible{background:rgb(var(--ui-hi,255 255 255) / .08)}" +
    ".spg{position:fixed;z-index:200;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;pointer-events:none;background:var(--c);opacity:.8;box-shadow:0 0 14px var(--c)}" +
    ".spg.out{opacity:.35}" +
    "@media (prefers-reduced-motion:reduce){.spd .rg{transform:none}.spd.gone{transition:none}}";

  function mount(O) {
    O = O || {};
    /* the words a person reads name the surface as the tool does (Current's lab: "the field"; default "the stage") */
    var ON = (O.words && typeof O.words.surface === "string" && O.words.surface) || "the stage";
    var LS = "surface.pad." + (O.key || "tool"), RANGE = O.range || 1200, GAP = O.gap == null ? 0.5 : O.gap;
    var V = function () { return window.SurfaceVoice; };
    function ctx() { try { return O.ctx && O.ctx(); } catch (e) { return null; } }
    function dest() { try { return O.dest && O.dest(); } catch (e) { return null; } }
    function soundOn() { try { return !!(O.on && O.on()); } catch (e) { return false; } }
    function sounds() { try { return (O.sounds && O.sounds()) || []; } catch (e) { return []; } }
    function soundOf(id) { return sounds().filter(function (s) { return s.id === id; })[0] || null; }
    function say(t) { try { O.say && O.say(t); } catch (e) {} }
    function hostEl() { return typeof O.host === "function" ? O.host() : O.host; }
    var DOTS = [], DID = 0, layer = null, svg = null, menu = null, raf = 0, wasOn = false, lastCtx = null;

    /* ---------- the layer over the host ---------- */
    function ensure() {
      if (layer && layer.isConnected) return layer;
      var h = hostEl(); if (!h) return null;
      if (!document.getElementById("spad-css")) { var st = document.createElement("style"); st.id = "spad-css"; st.textContent = CSS; document.head.appendChild(st); }
      layer = document.createElement("div"); layer.className = "spad"; layer.setAttribute("role", "group"); layer.setAttribute("aria-label", "Sounds on " + ON);
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "spt"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true");
      layer.appendChild(svg); h.appendChild(layer);
      DOTS.forEach(function (d) { if (d.el) layer.appendChild(d.el); if (d.trail) svg.appendChild(d.trail); });
      return layer;
    }
    function box() { var l = ensure(); return l ? l.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1, right: 1, bottom: 1 }; }

    /* ---------- where a dot sounds ---------- */
    function soundAt(d) { return { pan: clamp(d.x * 2 - 1, -1, 1), cents: Math.round((0.5 - d.y) * 2 * RANGE) }; }
    function shapeOf(r) { try { return V().shape(r); } catch (e) { return { start: 0.05, hold: 0.2, end: 0.3, held: !!(r && r.hold) }; } }
    function lenOf(sh) { return Math.max(0.05, (sh.start || 0) + (sh.hold || 0) + (sh.end || 0)); }
    function strike(d) {
      clearTimeout(d.loop); d.loop = 0;
      if (d.gone || !soundOn()) return;
      var s = soundOf(d.sound), c = ctx(), out = dest(); if (!s || !c || !out || !V() || s.on === false) return;
      var r = s.recipe, sh = shapeOf(r), o = soundAt(d);
      if (d.h && !r.hold) { try { d.h.stop(c.currentTime + sh.end + 0.2); } catch (e) {} }
      try { d.h = V().play(c, out, r, { level: (s.level == null ? 1 : s.level) * d.level, pan: o.pan, cents: o.cents }); } catch (e) { d.h = null; try { console.warn("[pad] " + s.name + ": " + (e && e.message)); } catch (_) {} }
      d.held = !!r.hold; d.hitAt = performance.now(); d.len = lenOf(sh); d.t0a = c.currentTime;
      if (!r.hold) d.loop = setTimeout(function () { strike(d); }, (d.len + GAP) * 1000);
    }
    /* let go the way the recipe says: "finish" (the default) ends after the pass of its middle it is in, "now" at once */
    function letGo(d, quick) {
      clearTimeout(d.loop); d.loop = 0;
      var h = d.h, c = ctx(); d.h = null; if (!h || !c) return;
      if (quick) { try { h.stop(c.currentTime + 0.04); } catch (e) {} return; }
      if (!d.held) return;                                   // a one-shot rings out by itself
      var s = soundOf(d.sound), r = s && s.recipe, at = c.currentTime;
      if (r && r.letgo !== "now") { var sh = shapeOf(r), pass = Math.max(1, sh.hold || 0), into = at - ((d.t0a || at) + (sh.start || 0)); at = into <= 0 ? (d.t0a || at) + (sh.start || 0) + pass : at + (pass - (into % pass)); }
      try { h.release(at); } catch (e) {}
    }
    function retune(d) { if (d.h && d.h.set) { var o = soundAt(d); try { d.h.set(o); } catch (e) {} } }

    /* ---------- a dot ---------- */
    function label(d) {
      var s = soundOf(d.sound), nm = s ? s.name : "sound", lr = d.x < 0.4 ? "left" : d.x > 0.6 ? "right" : "middle", ud = d.y < 0.4 ? "higher" : d.y > 0.6 ? "lower" : "as written";
      d.el.setAttribute("aria-label", nm + ", " + lr + ", " + ud + (d.j ? ", repeating a journey" : "") + (s && s.on === false ? ", off" : "") +
        ". Arrows move it, J walks a journey, plus and minus its level, Delete takes it off, the menu key for more.");
      d.el.querySelector(".tp").textContent = nm;
    }
    function place(d) { d.el.style.left = (d.x * 100).toFixed(3) + "%"; d.el.style.top = (d.y * 100).toFixed(3) + "%"; }
    function colour(id) { if (O.color) { try { var c = O.color(id); if (c) return c; } catch (e) {} } var L = sounds(), i = -1; for (var k = 0; k < L.length; k++) if (L[k].id === id) { i = k; break; } return colourOf(i < 0 ? 0 : i); }
    function drawTrail(d) {
      if (d.trail) { d.trail.remove(); d.trail = null; }
      var j = d.rec ? { pts: d.rec } : d.j; if (!j || !svg) return;
      var pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      pl.setAttribute("points", j.pts.map(function (q) { return (q[1] * 100).toFixed(2) + "," + (q[2] * 100).toFixed(2); }).join(" "));
      pl.setAttribute("stroke", colour(d.sound)); if (d.rec) pl.setAttribute("class", "rec");
      svg.appendChild(pl); d.trail = pl;
    }
    function build(d) {
      var b = document.createElement("button"); b.type = "button"; b.className = "spd"; b.dataset.id = d.id;
      b.innerHTML = '<i class="rg"></i><i class="cr"></i><span class="tp"></span>';
      b.style.setProperty("--c", colour(d.sound)); b.style.setProperty("--lv", Math.sqrt(clamp(d.level, 0, 2) / 1.0).toFixed(2));
      b.addEventListener("pointerdown", function (e) { down(e, d); });
      b.addEventListener("pointermove", function (e) { move(e, d); });
      b.addEventListener("pointerup", function (e) { up(e, d, false); });
      b.addEventListener("pointercancel", function (e) { up(e, d, true); });
      b.addEventListener("contextmenu", function (e) { e.preventDefault(); e.stopPropagation(); openMenu(d); });
      b.addEventListener("keydown", function (e) { key(e, d); });
      b.addEventListener("blur", function () { if (KJ && KJ.d === d) dropKJ(); });
      ["click", "dblclick"].forEach(function (t) { b.addEventListener(t, function (e) { e.stopPropagation(); }); });
      d.el = b; place(d); label(d);
      var l = ensure(); if (l) l.appendChild(b);
    }
    function add(soundId, x, y, o) {
      o = o || {}; if (!soundOf(soundId) && !o.force) return null;
      var d = { id: ++DID, sound: soundId, x: clamp(x == null ? 0.5 : +x, 0, 1), y: clamp(y == null ? 0.5 : +y, 0, 1), level: o.level == null ? 1 : clamp(+o.level, 0, 4), j: cleanJ(o.journey), t0: performance.now(), vx: 0, vy: 0, px: null, py: null, h: null, loop: 0 };
      if (d.j) { var p = at(d.j, 0); d.x = p[0]; d.y = p[1]; }
      DOTS.push(d); build(d); drawTrail(d); strike(d); kick(); if (!o.quiet) changed();
      return d.id;
    }
    function byId(id) { return DOTS.filter(function (d) { return d.id === id; })[0] || null; }
    function plain(d) { return { sound: d.sound, x: r3(d.x), y: r3(d.y), level: r3(d.level), j: d.j ? JSON.parse(JSON.stringify(d.j)) : null }; }
    function drop(d, quick) {
      var k = DOTS.indexOf(d); if (k < 0) return -1; DOTS.splice(k, 1); d.gone = true; letGo(d, quick);
      if (d.trail) { d.trail.remove(); d.trail = null; }
      if (d.el) { var el = d.el; el.classList.add("gone"); setTimeout(function () { el.remove(); }, 400); }
      if (menu && menu._d === d) closeMenu();
      return k;
    }
    function remove(id, silent) {
      var d = byId(id); if (!d) return false;
      var s = soundOf(d.sound), keep = plain(d), k = drop(d, false); changed();
      if (!silent) {
        var nm = (s ? s.name : "sound");
        if (window.SurfaceUndo) SurfaceUndo.deleted({ kind: "pad-dot", label: nm + " (on " + ON + ")", data: keep, restore: function () { restore(keep, k); } });
        else say(nm + " is off " + ON);
      }
      return true;
    }
    function restore(p, k) {
      if (!soundOf(p.sound)) { say("that sound is no longer in the pack"); return; }
      var id = add(p.sound, p.x, p.y, { journey: p.j, level: p.level, quiet: true }), d = byId(id);
      if (d && k != null && k >= 0 && k < DOTS.length - 1) { DOTS.splice(DOTS.indexOf(d), 1); DOTS.splice(k, 0, d); }
      changed();
    }
    if (window.SurfaceUndo && SurfaceUndo.kind) try { SurfaceUndo.kind("pad-dot", { name: "Sound on the stage", restore: function (p) { restore(p); } }); SurfaceUndo.kind("pad-set", { name: "Sounds on the stage", restore: function (p) { load(p); } }); } catch (e) {}
    function clear(silent) {
      if (!DOTS.length) return;
      var keep = state(); DOTS.slice().forEach(function (d) { drop(d, false); }); changed();
      if (!silent && window.SurfaceUndo) SurfaceUndo.deleted({ kind: "pad-set", label: keep.dots.length + " sound" + (keep.dots.length > 1 ? "s" : "") + " on " + ON, data: keep, restore: function () { load(keep); } });
    }

    /* ---------- the hand: each pointer drags its own dot; the empty stage is never ours ---------- */
    var DRAG = {}, HOLD_MS = (window.SurfaceKeys && SurfaceKeys.holdMs) || 520;
    function rel(e) { var b = box(); return { x: (e.clientX - b.left) / (b.width || 1), y: (e.clientY - b.top) / (b.height || 1), b: b }; }
    function down(e, d) {
      e.stopPropagation(); if (e.button > 0) return; e.preventDefault();
      closeMenu(); if (KJ && KJ.d === d) dropKJ();
      try { d.el.setPointerCapture(e.pointerId); } catch (_) {}
      var D = DRAG[e.pointerId] = { d: d, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, from: plain(d) };
      D.timer = setTimeout(function () { if (DRAG[e.pointerId] === D && !D.moved) { D.menu = true; if (navigator.vibrate) try { navigator.vibrate(10); } catch (_) {} openMenu(d); } }, HOLD_MS);
      d.drag = true; d.el.classList.add("drag");
      if (!d.h && soundOn()) strike(d);
    }
    function move(e, d) {
      var D = DRAG[e.pointerId]; if (!D || D.d !== d) return; e.stopPropagation();
      if (!D.moved && Math.hypot(e.clientX - D.x0, e.clientY - D.y0) > 6) { D.moved = true; clearTimeout(D.timer); if (D.menu) closeMenu(); D.menu = false;
        d.j = null; d.rec = [[0, r3(d.x), r3(d.y)]]; D.t0 = performance.now(); }
      if (!D.moved) return;
      /* off the stage: past its edge, or into the last few pixels of it (a full-screen stage has no outside to drag to) */
      var q = rel(e), b = q.b, E = O.edge == null ? 14 : O.edge;
      var out = e.clientX < b.left + E || e.clientX > b.right - E || e.clientY < b.top + E || e.clientY > b.bottom - E;
      if (out !== !!d.leaving) { d.leaving = out; d.el.classList.toggle("leaving", out); }
      d.x = clamp(q.x, 0, 1); d.y = clamp(q.y, 0, 1); place(d); retune(d);
      if (!out) {
        var t = (performance.now() - D.t0) / 1000, L = d.rec[d.rec.length - 1];
        if (t - L[0] >= 0.02 || Math.hypot(d.x - L[1], d.y - L[2]) >= 0.003) { d.rec.push([r3(t), r3(d.x), r3(d.y)]); if (d.rec.length % 4 === 0) drawTrail(d); }
      }
    }
    function up(e, d, cancel) {
      var D = DRAG[e.pointerId]; if (!D || D.d !== d) return; e.stopPropagation(); delete DRAG[e.pointerId];
      clearTimeout(D.timer); d.drag = false; d.el.classList.remove("drag");
      if (D.menu) return;                                                     // the long press opened its menu
      if (d.leaving && !cancel) { d.leaving = false; remove(d.id); return; }
      d.leaving = false; d.el.classList.remove("leaving");
      if (!D.moved) { if (!d.held) strike(d); return; }                       // a tap: hear it now
      var rec = d.rec; d.rec = null;
      if (cancel) { d.x = D.from.x; d.y = D.from.y; d.j = D.from.j; d.t0 = performance.now(); place(d); retune(d); drawTrail(d); return; }
      var dur = rec.length ? rec[rec.length - 1][0] : 0;
      if (rec.length > 3 && dur > 0.25) { d.j = { pts: rec, dur: dur }; d.t0 = performance.now(); say((soundOf(d.sound) || {}).name + " repeats your journey"); }
      else d.j = null;
      drawTrail(d); label(d); changed(); kick();
    }
    /* from a list onto the stage: a ghost follows the pointer; let go over the stage and the sound stands there */
    function dragIn(e, soundId) {
      if (!soundOf(soundId)) return;
      var g = document.createElement("div"); g.className = "spg"; g.style.setProperty("--c", colour(soundId)); document.body.appendChild(g);
      if (!document.getElementById("spad-css")) ensure();
      var pid = e.pointerId, over = false;
      var mv = function (ev) { if (ev.pointerId !== pid) return; g.style.left = ev.clientX + "px"; g.style.top = ev.clientY + "px"; var b = box(); over = ev.clientX >= b.left && ev.clientX <= b.right && ev.clientY >= b.top && ev.clientY <= b.bottom; g.classList.toggle("out", !over); };
      var fin = function (ev) { if (ev.pointerId !== pid) return; removeEventListener("pointermove", mv, true); removeEventListener("pointerup", fin, true); removeEventListener("pointercancel", fin, true); g.remove();
        if (ev.type === "pointerup" && over) { var q = rel(ev); add(soundId, clamp(q.x, 0.02, 0.98), clamp(q.y, 0.02, 0.98)); say((soundOf(soundId) || {}).name + " is on " + ON + ": drag it and it repeats your journey"); } };
      addEventListener("pointermove", mv, true); addEventListener("pointerup", fin, true); addEventListener("pointercancel", fin, true);
      mv(e);
    }

    /* ---------- keys ---------- */
    var KJ = null;
    function dropKJ() { var K = KJ; KJ = null; var d = K.d; d.x = K.from.x; d.y = K.from.y; d.j = K.from.j; d.rec = null; d.t0 = performance.now(); place(d); retune(d); drawTrail(d); }
    function key(e, d) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key, stop = function () { e.preventDefault(); e.stopPropagation(); };
      if (KJ && KJ.d === d) {
        var st0 = e.shiftKey ? 0.12 : 0.03, mv0 = { ArrowLeft: [-st0, 0], ArrowRight: [st0, 0], ArrowUp: [0, -st0], ArrowDown: [0, st0] }[k];
        if (mv0) { stop(); d.x = clamp(d.x + mv0[0], 0, 1); d.y = clamp(d.y + mv0[1], 0, 1); place(d); retune(d); KJ.pts.push([r3((performance.now() - KJ.t0) / 1000), r3(d.x), r3(d.y)]); d.rec = KJ.pts; drawTrail(d); return; }
        if (k === "j" || k === "J" || k === "Enter") { stop(); var K = KJ; KJ = null; d.rec = null; var dur = K.pts[K.pts.length - 1][0];
          if (K.pts.length > 3 && dur > 0.25) { d.j = { pts: K.pts, dur: dur }; d.t0 = performance.now(); say("journey kept: " + (soundOf(d.sound) || {}).name + " repeats it"); changed(); kick(); }
          else { KJ = K; dropKJ(); say("too short to keep: take a few more steps with the arrows"); }
          drawTrail(d); label(d); return; }
        if (k === "Escape") { stop(); dropKJ(); say("journey dropped"); return; }
        if (k.length === 1 || k === "Delete" || k === "Backspace") { stop(); return; }
        return;
      }
      var st = e.shiftKey ? 0.2 : 0.05, mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[k];
      if (mv) { stop(); d.j = null; d.x = clamp(d.x + mv[0], 0, 1); d.y = clamp(d.y + mv[1], 0, 1); place(d); retune(d); drawTrail(d); label(d); changed(); return; }
      if (k === "j" || k === "J") { stop(); KJ = { d: d, pts: [[0, r3(d.x), r3(d.y)]], t0: performance.now(), from: plain(d) }; d.j = null; drawTrail(d); say("journey: the arrows walk it, J keeps it, Escape puts it back"); return; }
      if (k === "+" || k === "=") { stop(); setLevel(d, Math.min(4, (d.level || 0.05) * 1.26)); return; }
      if (k === "-") { stop(); setLevel(d, d.level * 0.79); return; }
      if (k === "Delete" || k === "Backspace") { stop(); var nx = DOTS[DOTS.indexOf(d) + 1] || DOTS[DOTS.indexOf(d) - 1]; remove(d.id); if (nx && nx.el) nx.el.focus({ preventScroll: true }); return; }
      if (k === "Enter" || k === " ") { stop(); strike(d); return; }
      if (k === "ContextMenu" || (e.shiftKey && k === "F10")) { stop(); openMenu(d, true); return; }
      if (k === "Escape") { stop(); d.el.blur(); }
    }
    function setLevel(d, v) { d.level = clamp(v, 0, 4); d.el.style.setProperty("--lv", Math.sqrt(Math.min(1, d.level)).toFixed(2)); var s = soundOf(d.sound);
      if (d.h && d.h.set) try { d.h.set({ level: (s && s.level != null ? s.level : 1) * d.level }); } catch (e) {}
      var db = d.level > 0 ? Math.round(20 * Math.log10(d.level)) : -Infinity; say((s ? s.name : "sound") + " " + (isFinite(db) ? (db > 0 ? "+" : "") + db + " dB" : "silent")); changed(); }

    /* ---------- its menu: smooth, hold still, take off ---------- */
    function closeMenu() { if (!menu) return; var m = menu; menu = null; m.remove(); removeEventListener("pointerdown", outside, true); }
    function outside(e) { if (menu && !menu.contains(e.target)) closeMenu(); }
    function openMenu(d, focus) {
      closeMenu(); var l = ensure(); if (!l) return; var s = soundOf(d.sound);
      var m = document.createElement("div"); m.className = "spm"; m.setAttribute("role", "menu"); m.setAttribute("aria-label", (s ? s.name : "sound") + " on " + ON); m._d = d;
      var items = [];
      if (d.j) { if (!d.j.smooth) items.push(["smooth", "Smooth the journey"]); items.push(["still", "Hold still"]); }
      items.push(["hear", "Hear it"], ["off", "Take it off " + ON]);
      m.innerHTML = "<b></b>" + items.map(function (x) { return '<button type="button" role="menuitem" data-a="' + x[0] + '">' + x[1] + "</button>"; }).join("");
      m.querySelector("b").textContent = s ? s.name : "sound";
      m.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      m.addEventListener("click", function (e) { e.stopPropagation(); var b = e.target.closest("button"); if (!b) return; var a = b.dataset.a; closeMenu();
        if (a === "smooth" && d.j) { d.j = smoothed(d.j); d.t0 = performance.now(); drawTrail(d); changed(); say("journey smoothed"); }
        else if (a === "still") { d.j = null; drawTrail(d); label(d); changed(); say((s ? s.name : "it") + " holds still"); }
        else if (a === "hear") strike(d);
        else if (a === "off") remove(d.id);
        if (!d.gone && d.el) d.el.focus({ preventScroll: true }); });
      m.addEventListener("keydown", function (e) { var bs = [].slice.call(m.querySelectorAll("button")), i = bs.indexOf(document.activeElement);
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(); d.el.focus({ preventScroll: true }); }
        else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); bs[(i + (e.key === "ArrowDown" ? 1 : bs.length - 1)) % bs.length].focus(); }
        else e.stopPropagation(); });
      l.appendChild(m);
      var b = l.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight, px = d.x * b.width, py = d.y * b.height;
      m.style.left = clamp(px + 22, 8, Math.max(8, b.width - mw - 8)) + "px"; m.style.top = clamp(py - mh / 2, 8, Math.max(8, b.height - mh - 8)) + "px";
      menu = m; setTimeout(function () { addEventListener("pointerdown", outside, true); }, 0);
      if (focus !== false) { var f = m.querySelector("button"); if (f) f.focus({ preventScroll: true }); }
    }

    /* ---------- every frame: journeys, the sound following, the ring breathing ---------- */
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function frame(now) {
      raf = 0;
      var on = soundOn(), c = ctx();
      if (c !== lastCtx) { lastCtx = c; DOTS.forEach(function (d) { d.h = null; clearTimeout(d.loop); }); wasOn = false; }
      if (on && !wasOn) DOTS.forEach(function (d) { if (!d.h) strike(d); });
      if (!on && wasOn) DOTS.forEach(function (d) { letGo(d, true); });
      wasOn = on;
      var dt = frame.last ? Math.min(0.1, (now - frame.last) / 1000) : 0.016; frame.last = now;
      DOTS.forEach(function (d) {
        if (d.j && !d.drag && !(KJ && KJ.d === d)) { var p = at(d.j, (now - d.t0) / 1000); d.x = p[0]; d.y = p[1]; place(d); retune(d); }
        if (d.px != null && dt > 0) { d.vx = d.vx * 0.7 + ((d.x - d.px) / dt) * 0.3; d.vy = d.vy * 0.7 + ((d.y - d.py) / dt) * 0.3; }
        d.px = d.x; d.py = d.y;
        var e = 0;
        if (on && d.h) e = d.held ? 0.65 + 0.15 * Math.sin(now / 420 + d.id) : Math.exp(-(now - (d.hitAt || 0)) / 1000 / Math.max(0.15, (d.len || 0.4) * 0.6));
        d.e = e; if (d.el) d.el.style.setProperty("--e", e.toFixed(2));
        var s = soundOf(d.sound); if (d.el) d.el.classList.toggle("off", !!s && s.on === false);
      });
      if (DOTS.length) kick();
    }

    /* ---------- reading it ---------- */
    function positions() { return DOTS.map(function (d) { var s = soundOf(d.sound); return { id: d.id, sound: d.sound, name: s ? s.name : "", x: d.x, y: d.y, vx: d.vx || 0, vy: d.vy || 0, speed: Math.hypot(d.vx || 0, d.vy || 0), energy: d.e || 0, held: !!d.held, dragging: !!d.drag, journey: !!d.j, color: colour(d.sound) }; }); }
    function voices() { return DOTS.map(function (d) { var s = soundOf(d.sound), o = soundAt(d); return { id: d.id, sound: d.sound, name: s ? s.name : "", recipe: s ? s.recipe : null, pan: o.pan, cents: o.cents, level: (s && s.level != null ? s.level : 1) * d.level, held: !!d.held, sounding: !!d.h }; }); }
    function state() { return { v: 1, dots: DOTS.map(plain) }; }
    function load(st, quiet) {
      DOTS.slice().forEach(function (d) { drop(d, true); });
      ((st && st.dots) || []).slice(0, 32).forEach(function (p) { if (p && typeof p.sound === "string") add(p.sound, p.x, p.y, { journey: p.j, level: p.level, quiet: true }); });
      if (!quiet) changed();
    }
    var saveT = 0;
    function changed() {
      clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem(LS, JSON.stringify(state())); } catch (e) {} }, 120);
      try { O.onChange && O.onChange(state()); } catch (e) {}
    }
    /* the sounds changed (one removed, or its role moved off Pad): dots whose sound has gone leave quietly; colours follow */
    function sync() {
      var ids = {}; sounds().forEach(function (s) { ids[s.id] = 1; });
      var gone = DOTS.filter(function (d) { return !ids[d.sound]; });
      gone.forEach(function (d) { drop(d, false); });
      DOTS.forEach(function (d) { if (d.el) { d.el.style.setProperty("--c", colour(d.sound)); label(d); } if (d.trail) d.trail.setAttribute("stroke", colour(d.sound)); });
      if (gone.length) changed();
      kick();
    }
    function preset(name) {
      var P = PRESETS.filter(function (p) { return p.name === name; })[0]; if (!P || !O.ensure) return false;
      var rs = P.sounds().filter(Boolean); if (!rs.length) return false;
      var ids = O.ensure(rs) || []; if (!ids.length) return false;
      var had = DOTS.length ? state() : null;
      DOTS.slice().forEach(function (d) { drop(d, true); });
      P.dots.forEach(function (p) { var id = ids[p.n]; if (!id) return; add(id, p.x, p.y, { journey: p.j, level: p.level, quiet: true }); });
      changed();
      if (had && window.SurfaceUndo) SurfaceUndo.deleted({ kind: "pad-set", label: had.dots.length + " sound" + (had.dots.length > 1 ? "s" : "") + " on " + ON, data: had, restore: function () { load(had); } });
      else say(P.name + ": " + P.note);
      return true;
    }
    /* for a capture that wants them: the trails and dots drawn into a canvas the size of the host */
    function paint(g, w, h) {
      DOTS.forEach(function (d) { var c = colour(d.sound); g.save();
        if (d.j) { g.globalAlpha = 0.3; g.strokeStyle = c; g.lineWidth = 1.5; g.beginPath(); d.j.pts.forEach(function (q, k) { if (k) g.lineTo(q[1] * w, q[2] * h); else g.moveTo(q[1] * w, q[2] * h); }); g.stroke(); }
        g.globalAlpha = 1; g.fillStyle = c; g.beginPath(); g.arc(d.x * w, d.y * h, 8, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 0.25 + 0.6 * (d.e || 0); g.strokeStyle = c; g.lineWidth = 1.5; g.beginPath(); g.arc(d.x * w, d.y * h, 15 * (0.82 + 0.5 * (d.e || 0)), 0, Math.PI * 2); g.stroke(); g.restore(); });
    }

    /* what was on the stage last visit comes back (once the host is there) */
    (function boot() {
      var st = null; try { st = JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) {}
      if (st && Array.isArray(st.dots)) st.dots.slice(0, 32).forEach(function (p) { if (p && typeof p.sound === "string" && soundOf(p.sound)) add(p.sound, p.x, p.y, { journey: p.j, level: p.level, quiet: true }); });
      kick();
    })();
    document.addEventListener("visibilitychange", function () { if (!document.hidden) kick(); });

    return { add: add, remove: remove, clear: clear, count: function (sid) { return DOTS.filter(function (d) { return sid == null || d.sound === sid; }).length; },
      positions: positions, voices: voices, state: state, load: load, sync: sync, dragIn: dragIn, color: colour, paint: paint,
      presets: function () { return PRESETS.map(function (p) { return { name: p.name, note: p.note }; }); }, preset: preset,
      show: function (v) { var l = ensure(); if (l) l.hidden = !v; if (!v) closeMenu(); }, layer: ensure,
      menu: function (id) { var d = byId(id); if (d) openMenu(d, true); } };
  }

  window.SurfacePad = { mount: mount, colourOf: colourOf, shape: shape, smooth: smoothed, at: at, PRESETS: PRESETS };
})();
