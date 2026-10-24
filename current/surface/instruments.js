/* Surface · Instruments — sounds from the studio's synth (recipes, format voice/0), imported into any tool and played there
   (Dimitry, 22 Oct 2026: import into Current; "selectable on import and after, with touch as default").

   What it opens: a recipe (voice/0), a mix (mix/0, each sound carries its recipe), saved mixes (mixes/0), a
   list of recipes, an instrument/1 set (the glass piece's set format: its own recipes, and the glass voices it has on, through
   the studio's library), or a pack zip holding any of those (SurfacePack). The library (voicelib.js) is offered in the
   sheet. "Save as a set" writes instrument/1 with the recipes and each one's role, carrying every section of the last
   set opened that this tool does not use (the glass piece's rule: an engine preserves what it does not understand). Recipes that need a live input (the studio synth's vocal
   sounds) are left out: they need the studio synth's microphone chain.

   What a sound does is its ROLE, chosen when it comes in and changed any time after:
     touch    your finger on the stage plays it: a tap strikes, a hold sustains a held sound; left/right pans it
     beat     it strikes on the beat grid: every beat, the off-beats, once a bar, or eighths
     bed      it plays under everything: a held sound holds, a short one repeats at its own length
     pattern  the drawing is the sequencer: on the grid it walks the pattern's cuts in order, panned where each is
     pad      (opt-in, mount({pad})) it stands on the stage as a dot you drag (pad.js plays it, not this module)
   Nothing plays while the tool's sound is off. The tool gives the context, where the sound goes, the beat grid, the
   pattern's cuts and the stage; the module keeps the sounds (localStorage, small) and its own sheet.

     var I = SurfaceInstruments.mount({
       key: 'current',
       ctx:   () => AudioContext | null,           // the live one (it changes after an audio rebuild)
       dest:  () => AudioNode | null,              // where the sounds go (the tool's mix, so its visuals hear them)
       on:    () => boolean,                       // the tool's sound is on
       grid:  () => ({ bpm, zero }) | null,        // zero: ctx time of a bar's first beat; null → 100 bpm from now
       cuts:  () => [[x0, y0, x1, y1], ...],       // the pattern's drawn segments, 0..1, in drawing order
       stage: element,                             // where a touch plays
       onChange: (list) => {}
     });
     I.open()            the sheet: the sounds, each one's role, import
     I.import(file)      a file the tool was handed (drop, open)
     I.list()            [{ id, name, role, every, on }]
     I.sound(id)         { id, name, recipe, role, on, level }      I.ensure(recipes, role) → ids (reuses what is there)
   Words and help (24 Oct 2026): mount({ words: { title, save, lead }, help: { label, go() } }): the sheet opens on its title
     large and the lead ("Bring in your own sounds"); help adds a link to the tool's longer guide.
   Pad (23 Oct 2026): mount({ pad: { name, title, surface ('the stage'), add(id, x, y), drag(pointerEvent, id), count(id), color(id), presets(),
     preset(name) }, pro: { pad: 'pad' } }) adds the Pad role (named pad.name), a "put on the stage" button on each Pad
     sound (tap, or drag it onto the stage), the pad's presets, and a Pro mark on any role named in pro.
   Needs SurfaceVoice (voice.js); reads zips with SurfacePack (pack.js) when it is there.

   SAMPLES (22 Oct 2026, for the Frost ensemble: "students bring their own sounds"). Besides recipes, it takes
   recordings: a pack zip or a folder whose recipes name files in it ("source": "sample", "sample": "samples/drip.wav",
   relative to the recipe's own file), and bare audio files (wav, mp3, ogg, m4a, aac, flac, webm), each of which becomes
   a sound of its own (shorter than 3 s a one-shot, longer a loop that holds). Recordings are decoded by the browser
   (whatever it can decode plays), registered with SurfaceVoice.sample, and kept on this device in IndexedDB
   ("surface-samples"), so they come back next visit; the list in localStorage names them by key. Caps: 12 MB and 45 s
   a file, 60 MB an import, 200 MB kept; what passes a cap is left out and the sheet says why. "Save as a set" with any
   recording in it saves a pack zip (pack.json, instrument.json, samples/…) that opens whole in any tool with this
   module: the way a set is shared. */
(function () {
  "use strict";
  if (window.SurfaceInstruments) return;
  var ROLES = [["touch", "Touch", "your finger plays it"], ["beat", "On the beat", "it strikes on the grid"], ["bed", "Bed", "it plays under everything"], ["pattern", "Pattern", "the drawing sequences it"]];
  /* PAD (23 Oct 2026, with pad.js): a fifth role a tool opts into with mount({pad: {...}}): the sound stands on the stage
     as a dot you drag (SurfacePad). Shown only where the tool hosts a pad; its name is the tool's (pad.name). */
  var PAD_ROLE = ["pad", "Pad", "a dot on the stage you drag"];
  /* the four roles' icons (Dimitry, 22 Oct: "icons for touch, beat, bed and pattern"): drawn once here, 24-unit strokes
     (round caps, currentColor; class "f" is filled), used on the sheet's role buttons and by any guide
     (SurfaceInstruments.ROLE_ICONS). Touch: a tap and its ripple. On the beat: even pulses, the first accented.
     Bed: two long layers under everything. Pattern: a path through points, the drawing as sequencer. */
  var ROLE_ICONS = {
    touch: '<circle class="f" cx="12" cy="12" r="2.4"/><path d="M7.2 12a4.8 4.8 0 0 1 9.6 0M16.8 12a4.8 4.8 0 0 1-9.6 0" opacity=".75"/><path d="M3.6 12a8.4 8.4 0 0 1 16.8 0M20.4 12a8.4 8.4 0 0 1-16.8 0" opacity=".4"/>',
    beat: '<path d="M4 6.5v11M9.3 9.5v5M14.7 9.5v5M20 9.5v5"/>',
    bed: '<path d="M3 10c3-2 6-2 9 0s6 2 9 0"/><path d="M3 15.5c3-2 6-2 9 0s6 2 9 0" opacity=".6"/>',
    pattern: '<path d="M4 17.5 9 8l5 7 6-9.5"/><circle class="f" cx="4" cy="17.5" r="1.7"/><circle class="f" cx="9" cy="8" r="1.7"/><circle class="f" cx="14" cy="15" r="1.7"/><circle class="f" cx="20" cy="5.5" r="1.7"/>',
    /* Pad: a dot with the short trail of its journey behind it */
    pad: '<circle class="f" cx="16.2" cy="8.2" r="3.3"/><path d="M12.6 10.6C10.4 13.6 7.6 16.6 4 18" opacity=".75"/><path d="M3.6 13.2c1.4-.5 2.6-1.3 3.6-2.3" opacity=".4"/>'
  };
  function roleIcon(r) { return '<svg class="ri" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ROLE_ICONS[r] || "") + "</svg>"; }
  var EVERY = [["beat", "every beat", 4], ["back", "2 and 4", 16], ["off", "off-beats", 4], ["bar", "once a bar", 16], ["eighth", "eighths", 2]];
  /* the library's drums arrive as a groove, not all on every beat: kick, backbeat, eighth hats; the rest wait */
  var GROOVE = { kick: { every: "beat" }, snare: { every: "back" }, "closed hat": { every: "eighth", level: .6 }, "open hat": { every: "off", on: false },
    "low tom": { every: "bar", on: false }, "high tom": { every: "bar", on: false }, clap: { every: "back", on: false }, rim: { every: "off", on: false } };
  function uid() { return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function usesInput(r) { return !!(r && r.layers && r.layers.some(function (l) { return l && l.source === "input"; })); }
  function isRecipe(r) { return !!(r && typeof r === "object" && r.format === "voice/0" && (Array.isArray(r.layers) || Array.isArray(r.events))); }

  /* ---------- samples: the recordings a recipe names ---------- */
  var AUDIO = /\.(wav|wave|mp3|ogg|oga|opus|m4a|mp4|aac|flac|webm|aif|aiff|caf)$/i;
  var CAP = { file: 12e6, secs: 45, batch: 60e6, store: 200e6 };
  function eachSample(r, fn) {   // every place a recipe names a recording: its layers and its grains
    (r.layers || []).forEach(function (l) { if (l && l.source === "sample") fn(l); });
    (r.events || []).forEach(function (e) { [].concat(e && e.grain || []).forEach(function (g) { if (g && g.source === "sample") fn(g); }); });
  }
  function samplesOf(r) { var k = []; eachSample(r, function (o) { if (o.sample && k.indexOf(o.sample) < 0) k.push(o.sample); }); return k; }
  var BYTES = new Map();   // key -> Uint8Array as it came (to keep, and to save in a pack)
  var DB = null;
  function db() {
    if (DB) return DB;
    DB = new Promise(function (ok, no) {
      try { var q = indexedDB.open("surface-samples", 1); q.onupgradeneeded = function () { q.result.createObjectStore("s"); };
        q.onsuccess = function () { ok(q.result); }; q.onerror = function () { no(q.error); }; } catch (e) { no(e); }
    });
    return DB;
  }
  function idb(mode, fn) { return db().then(function (d) { return new Promise(function (ok, no) { var t = d.transaction("s", mode), st = t.objectStore("s"), r = fn(st); t.oncomplete = function () { ok(r && r.result); }; t.onerror = function () { no(t.error); }; }); }); }
  function keepBytes(key, u8) { return idb("readwrite", function (st) { return st.put({ bytes: u8, size: u8.length, at: Date.now() }, key); }); }
  function getBytes(key) { return idb("readonly", function (st) { return st.get(key); }).then(function (v) { return v && v.bytes ? new Uint8Array(v.bytes) : null; }); }
  function dropBytes(key) { BYTES.delete(key); try { SurfaceVoice.sample(key, null); } catch (e) {} return idb("readwrite", function (st) { return st.delete(key); }).catch(function () {}); }
  function keptSize() { return idb("readonly", function (st) { return st.getAll(); }).then(function (a) { return (a || []).reduce(function (n, v) { return n + (v && v.size || 0); }, 0); }, function () { return 0; }); }
  var DEC = null;
  function decoder(live) {
    if (live) return live;
    if (!DEC) { var O = window.OfflineAudioContext || window.webkitOfflineAudioContext; DEC = O ? new O(2, 1, 48000) : null; }
    return DEC;
  }
  function decode(u8, live) {
    var c = decoder(live); if (!c) return Promise.reject(new Error("this browser cannot decode audio"));
    var ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    return new Promise(function (ok, no) { var p = c.decodeAudioData(ab, ok, function (e) { no(e || new Error("not audio this browser can play")); }); if (p && p.then) p.then(ok, no); });
  }
  function slugOf(s) { return String(s || "pack").toLowerCase().replace(/\.zip$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "pack"; }
  function baseName(p) { return String(p).split("/").pop(); }
  function norm(dir, ref) {   // a path in the pack, from a recipe's folder
    var parts = (ref.charAt(0) === "/" ? ref.slice(1) : (dir ? dir + "/" : "") + ref).split("/"), out = [];
    parts.forEach(function (x) { if (x === "..") out.pop(); else if (x && x !== ".") out.push(x); });
    return out.join("/");
  }
  function soundFor(name, key, secs) {   // a bare recording becomes a sound: a one-shot, or (3 s and longer) a loop that holds
    var long = secs >= 3;
    return { format: "voice/0", name: name.slice(0, 40), about: (long ? "A loop" : "A one-shot") + " from the recording " + name + ".",
      made: { by: "you", from: name }, hold: long, trim: 0,
      layers: [{ source: "sample", sample: key, loop: long, start: { time: long ? 0.25 : 0.003, gain: 1 }, end: { time: long ? 0.8 : 0.06, gain: 0 } }] };
  }
  /* every recipe in whatever was opened. An instrument/1 set (the glass piece's set format, now every tool's) gives its own
     recipes, and its voices that the studio's library has a recipe for (the glass piece's glass, SurfaceVoiceLib.glass);
     a voice the studio's glass piece keeps off unless asked (crystal, scan) counts only when the set switches it on. */
  var VOICE_OFF = ["crystal", "scan"];
  function fromSet(o, out) {
    if (Array.isArray(o.recipes)) recipesIn(o.recipes, out);
    var L = window.SurfaceVoiceLib, V = o.voices;
    if (L && V && typeof V === "object") Object.keys(V).forEach(function (id) {
      var v = V[id] || {}, on = v.on == null ? VOICE_OFF.indexOf(id) < 0 : !!+v.on, nm = (L.glass || {})[id];
      if (!on || !nm) return;
      var r = L.sounds.filter(function (x) { return x.name === nm; })[0]; if (!r) return;
      r = JSON.parse(JSON.stringify(r)); r._level = Math.max(0, Math.min(2, typeof v.level === "number" ? v.level : 1)); out.push(r);
    });
    return out;
  }
  function recipesIn(o, out) {
    out = out || [];
    if (!o || typeof o !== "object") return out;
    if (Array.isArray(o)) { o.forEach(function (x) { recipesIn(x, out); }); return out; }
    if (isRecipe(o)) { out.push(o); return out; }
    if (o.format === "instrument/1") return fromSet(o, out);
    if (o.format === "mix/0" && Array.isArray(o.sounds)) o.sounds.forEach(function (s) { if (s && isRecipe(s.recipe)) out.push(s.recipe); });
    else if (o.format === "mixes/0" && Array.isArray(o.mixes)) o.mixes.forEach(function (m) { recipesIn(m, out); });
    else if (Array.isArray(o.recipes)) recipesIn(o.recipes, out);
    return out;
  }
  function mount(O) {
    O = O || {};
    /* O.words (22 Oct 2026, Dimitry: "kit or pack … be consistent; pack is a common thing in this world"): what the sheet
       calls itself and its save button. Default Instruments / Save as a set; Current says Pack / Save as a pack. */
    var WD = { title: "Instruments", save: "Save as a set", lead: "Bring in your own sounds" };
    if (O.words && typeof O.words === "object") { if (typeof O.words.title === "string") WD.title = O.words.title; if (typeof O.words.save === "string") WD.save = O.words.save; if (typeof O.words.lead === "string") WD.lead = O.words.lead; }
    var LS = "surface.instruments." + (O.key || "tool"), list = [], kept = null;
    var PADO = O.pad && typeof O.pad === "object" ? O.pad : null;
    var MY_ROLES = PADO ? ROLES.concat([[PAD_ROLE[0], PADO.name || PAD_ROLE[1], PADO.title || PAD_ROLE[2]]]) : ROLES;
    function padCall(fn) { if (!PADO || typeof PADO[fn] !== "function") return null; try { return PADO[fn].apply(null, [].slice.call(arguments, 1)); } catch (e) { try { console.warn("[instruments] pad." + fn, e); } catch (_) {} return null; } }
    try { kept = JSON.parse(localStorage.getItem(LS + ".set") || "null"); } catch (e) { kept = null; }
    try { list = JSON.parse(localStorage.getItem(LS) || "[]").filter(function (x) { return x && isRecipe(x.recipe); }); } catch (e) { list = []; }
    function save() { try { localStorage.setItem(LS, JSON.stringify(list)); } catch (e) {} try { O.onChange && O.onChange(pub()); } catch (e) {} }
    function pub() { return list.map(function (x) { return { id: x.id, name: x.name, role: x.role, every: x.every, on: x.on }; }); }
    function ctx() { try { return O.ctx && O.ctx(); } catch (e) { return null; } }
    function dest() { try { return O.dest && O.dest(); } catch (e) { return null; } }
    function soundOn() { try { return !!(O.on && O.on()); } catch (e) { return false; } }
    var V = function () { return window.SurfaceVoice; };
    /* every voice this module started, so "off" can mean off: tails stop with a short fade, not after their own end */
    var LIVE = [], wasOn = false;
    function hush() { var c = ctx(), t = c ? c.currentTime + 0.04 : undefined; LIVE.splice(0).forEach(function (v) { try { v.stop(t); } catch (_) {} }); }
    try { if (window.SurfaceVoice && SurfaceVoice.live() === 0) SurfaceVoice.limit(O.limit || 24); } catch (e) {}
    function strike(x, at, pan, holdFor) {
      var c = ctx(), d = dest(); if (!c || !d || !V()) return null;
      var to = d;
      if (pan != null && c.createStereoPanner) { var p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(d); to = p; }
      try {
        var h = V().play(c, to, x.recipe, { at: at, holdFor: holdFor, level: x.level == null ? 1 : x.level });
        if (h) { LIVE.push(h); if (h.done && h.done.then) h.done.then(function () { var i = LIVE.indexOf(h); if (i >= 0) LIVE.splice(i, 1); if (to !== d) try { to.disconnect(); } catch (e) {} }); }
        return h;
      } catch (e) { try { console.warn("[instruments] " + x.name + ": " + (e && e.message)); } catch (_) {} return null; }
    }
    function oneShot(x) { var s = V() ? V().shape(x.recipe) : { start: .1, hold: .2, end: .3, held: false }; return s.held ? Math.max(0.12, s.hold || 0.25) : undefined; }

    /* ---------- touch ---------- */
    var held = {};
    if (O.stage) {
      O.stage.addEventListener("pointerdown", function (e) {
        if (e.button > 0 || !soundOn()) return;
        var T = list.filter(function (x) { return x.on && x.role === "touch"; }); if (!T.length) return;
        var r = O.stage.getBoundingClientRect(), pan = r.width ? ((e.clientX - r.left) / r.width) * 2 - 1 : 0;
        held[e.pointerId] = T.map(function (x) { return strike(x, undefined, pan, undefined); }).filter(Boolean);
      }, { passive: true });
      var up = function (e) { var h = held[e.pointerId]; if (!h) return; delete held[e.pointerId]; var c = ctx(); h.forEach(function (v) { try { v.release(c ? c.currentTime : undefined); } catch (_) {} }); };
      ["pointerup", "pointercancel"].forEach(function (t) { window.addEventListener(t, up, true); });
    }

    /* ---------- the grid: beat and pattern, scheduled a little ahead ---------- */
    var next = {}, cutAt = {}, lastCtx = null;
    function grid(c) {
      var g = null; try { g = O.grid && O.grid(); } catch (e) {}
      if (!g || !(g.bpm > 0) || g.zero == null) g = { bpm: 100, zero: grid.z || (grid.z = c.currentTime) };
      return g;
    }
    function tick() {
      var c = ctx();
      if (c !== lastCtx) { lastCtx = c; next = {}; bedStop(); grid.z = null; }
      var on = !!c && soundOn() && c.state === "running";
      if (!on) { if (wasOn) { bedStop(); hush(); resetBed(); } wasOn = false; next = {}; return; }
      wasOn = true;
      var g = grid(c), step = 60 / g.bpm / 4, now = c.currentTime, ahead = now + 0.12;
      list.forEach(function (x) {
        if (!x.on || (x.role !== "beat" && x.role !== "pattern")) return;
        var E = EVERY.filter(function (e) { return e[0] === x.every; })[0] || (x.role === "pattern" ? EVERY[3] : EVERY[0]);
        var every = E[2], off = x.every === "off" ? 2 : x.every === "back" ? 4 : 0;
        var k = next[x.id]; if (k == null) k = Math.ceil((now + 0.03 - g.zero) / step);
        for (; ; k++) {
          var t = g.zero + k * step; if (t > ahead) break; if (t < now) continue;
          var m = ((k - off) % every + every) % every;
          if (x.every === "back" ? (m !== 0 && m !== 8) : m) continue;
          if (x.role === "beat") strike(x, t, null, oneShot(x));
          else {
            var C = []; try { C = (O.cuts && O.cuts()) || []; } catch (e) {}
            if (!C.length) { strike(x, t, null, oneShot(x)); continue; }
            var i = (cutAt[x.id] || 0) % C.length; cutAt[x.id] = i + 1; var s = C[i];
            strike(x, t, (s[0] + s[2]) - 1, oneShot(x));   // panned where the cut is: its middle, -1 left … 1 right
          }
        }
        next[x.id] = k;
      });
      bedSync(c);
    }
    setInterval(tick, 25);

    /* ---------- bed ---------- */
    var bed = { h: [], ids: "", t: 0 };
    function bedStop() { var c = ctx(); bed.h.forEach(function (v) { try { v.release(c ? c.currentTime : undefined); } catch (_) {} }); bed.h = []; bed.ids = ""; }
    function bedSync(c) {
      var B = list.filter(function (x) { return x.on && x.role === "bed"; }), ids = B.map(function (x) { return x.id; }).join(",");
      if (ids !== bed.ids) { bedStop(); bed.ids = ids; bed.t = 0; }
      if (!B.length) return;
      B.forEach(function (x) {
        var s = V() ? V().shape(x.recipe) : { held: true };
        if (s.held) { if (!x._bedOn || x._bedCtx !== c) { x._bedOn = true; x._bedCtx = c; var h = strike(x, undefined, null, undefined); if (h) bed.h.push(h); } }
        else { var len = Math.max(0.3, (s.start || 0) + (s.hold || 0) + (s.end || 0)); if (!x._bedNext || x._bedNext < c.currentTime) { x._bedNext = c.currentTime + len; strike(x, undefined, null, undefined); } }
      });
    }
    function resetBed() { list.forEach(function (x) { x._bedOn = false; x._bedNext = 0; }); bedStop(); }

    /* ---------- import ---------- */
    var lastSet = null;
    function noteSet(o) { if (o && o.format === "instrument/1") lastSet = o; }
    /* READ WHAT WAS HANDED IN: a zip (SurfacePack), a folder (its files with their paths), loose files, or one json.
       Every json gives its recipes; every recipe's recordings are found beside it; recordings no recipe names become
       sounds of their own. Resolves { recipes, samples: {key: {bytes, buf}}, notes: [], roles }. */
    function gather(input) {
      lastSet = null;
      var one = input && !input.length && input.name != null ? input : null, files = one ? [input] : [].slice.call(input || []);
      var zips = files.filter(function (f) { return window.SurfacePack && SurfacePack.isZip(f); });
      var name = files.length === 1 ? files[0].name : (files[0] && files[0].webkitRelativePath ? files[0].webkitRelativePath.split("/")[0] : files.length + " files");
      var map = new Map();   // path -> Uint8Array | File
      var jobs = zips.map(function (z) { return SurfacePack.read(z).then(function (p) { p.files.forEach(function (u, k) { map.set(zips.length > 1 ? slugOf(z.name) + "/" + k : k, u); }); return p.manifest; }); });
      var rest = files.filter(function (f) { return zips.indexOf(f) < 0; });
      var rel = rest.map(function (f) { return f.webkitRelativePath || f.name; });
      var tops = new Set(rel.map(function (r) { return r.split("/")[0]; })), strip = tops.size === 1 && rel.every(function (r) { return r.indexOf("/") > 0; });
      rest.forEach(function (f, i) { map.set(strip ? rel[i].replace(/^[^/]+\//, "") : rel[i], f); });
      return Promise.all(jobs).then(function (mans) {
        var man = mans.filter(Boolean)[0] || null, ns = "pack:" + slugOf(man && man.id || name) + "/";
        var u8 = function (v) { return v instanceof Uint8Array ? Promise.resolve(v) : v.arrayBuffer().then(function (b) { return new Uint8Array(b); }); };
        var paths = []; map.forEach(function (v, k) { paths.push(k); });
        var jsons = paths.filter(function (k) { return /\.json$/i.test(k); }), audio = paths.filter(function (k) { return AUDIO.test(k); });
        var out = { name: (man && man.name) || name, recipes: [], samples: {}, notes: [], roles: null, live: 0 };
        return Promise.all(jsons.map(function (k) { return u8(map.get(k)).then(function (b) { var o = null; try { o = JSON.parse(new TextDecoder().decode(b)); } catch (e) {} return [k, o]; }); })).then(function (js) {
          var used = {}, total = 0;
          js.forEach(function (x) {
            var o = x[1]; if (!o || typeof o !== "object") return; noteSet(o);
            if (o.format === "instrument/1" && o.roles) out.roles = Object.assign(out.roles || {}, o.roles);
            var dir = x[0].indexOf("/") >= 0 ? x[0].replace(/\/[^/]*$/, "") : "";
            recipesIn(o).forEach(function (r) {
              r = JSON.parse(JSON.stringify(r));
              eachSample(r, function (g) {
                var ref = String(g.sample || ""), p = [norm(dir, ref), norm("", ref)].filter(function (q) { return map.has(q); })[0];
                if (!p) { var b = baseName(ref); p = audio.filter(function (q) { return baseName(q) === b; })[0]; }
                if (p) { used[p] = 1; g.sample = ns + p; } else if (ref.indexOf("pack:") !== 0 && ref.indexOf("file:") !== 0) out.notes.push(r.name + ": " + ref + " is not in it");
              });
              out.recipes.push(r);
            });
          });
          var loose = audio.filter(function (p) { return !used[p]; });
          return Promise.all(audio.map(function (p) {
            var v = map.get(p), size = v.size != null ? v.size : v.length;
            if (size > CAP.file) { out.notes.push(baseName(p) + " is over " + CAP.file / 1e6 + " MB"); return null; }
            if (total + size > CAP.batch) { out.notes.push(baseName(p) + ": past " + CAP.batch / 1e6 + " MB in one go"); return null; }
            total += size;
            return u8(v).then(function (b) { return decode(b, ctx()).then(function (buf) {
              if (buf.duration > CAP.secs + 0.05) { out.notes.push(baseName(p) + " is " + Math.round(buf.duration) + " s (" + CAP.secs + " s at most: loop a shorter piece)"); return null; }
              var key = used[p] ? ns + p : "file:" + slugOf(baseName(p).replace(AUDIO, "")) + "-" + size;
              out.samples[key] = { bytes: b, buf: buf };
              if (!used[p]) out.recipes.push(soundFor(baseName(p).replace(AUDIO, ""), key, buf.duration));
            }); }, function () { out.notes.push(baseName(p) + " could not be decoded here (try wav or mp3)"); });
          })).then(function () {
            /* a recipe whose recording was left out stays out */
            out.recipes = out.recipes.filter(function (r) { var miss = samplesOf(r).filter(function (k) { return !out.samples[k] && !SurfaceVoice.sample(k); }); return !miss.length; });
            void loose; return out;
          });
        });
      });
    }
    /* SAVE AS A SET (instrument/1, the glass piece's rule: an engine preserves what it does not understand). Every section of
       the last set opened that this tool does not use goes back out unchanged; the recipes and each one's role here are
       written in sections of their own, which the studio's other instruments keep in turn. */
    function exportSet(name) {
      var base = kept ? JSON.parse(JSON.stringify(kept)) : {};
      base.format = "instrument/1"; base.engine = O.key || "tool"; base.name = name || base.name || ((O.name || "My") + " instruments");
      base.recipes = list.map(function (x) { return x.recipe; });
      base.roles = {}; list.forEach(function (x) { base.roles[x.name] = { role: x.role, every: x.every, on: x.on, level: x.level }; });
      return base;
    }
    function deliver(blob, fn) {
      if (O.save) { try { O.save(blob, fn); return; } catch (e) {} }
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fn; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
    /* with recordings in it, the set goes out as a pack: the recipes name samples/<file>, and the files ride along */
    function saveSet() {
      if (!list.length) return;
      var doc = exportSet(), fn = String(doc.name).replace(/[\\/:*?"<>|]+/g, " ").trim();
      var keys = []; list.forEach(function (x) { samplesOf(x.recipe).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); }); });
      if (!keys.length || !window.SurfacePack) { deliver(new Blob([JSON.stringify(doc, null, 1)], { type: "application/json" }), fn + ".json"); return; }
      Promise.all(keys.map(function (k) { return BYTES.has(k) ? BYTES.get(k) : getBytes(k).catch(function () { return null; }); })).then(function (bs) {
        var names = {}, files = [], taken = {};
        keys.forEach(function (k, i) { if (!bs[i]) return; var b = /^file:/.test(k) ? k.slice(5).replace(/-\d+$/, "") : baseName(k.slice(5)), n = b, j = 2;
          if (!AUDIO.test(n)) { var u = bs[i]; n += u[0] === 0x52 && u[1] === 0x49 ? ".wav" : u[0] === 0x4f && u[1] === 0x67 ? ".ogg" : u[0] === 0x66 && u[1] === 0x4c ? ".flac" : u[4] === 0x66 && u[5] === 0x74 ? ".m4a" : ".mp3"; }
          while (taken[n]) n = n.replace(/(\.[^.]+)$/, "-" + (j++) + "$1"); taken[n] = 1; names[k] = "samples/" + n; files.push([names[k], bs[i]]); });
        doc.recipes = doc.recipes.map(function (r) { r = JSON.parse(JSON.stringify(r)); eachSample(r, function (g) { if (names[g.sample]) g.sample = names[g.sample]; }); return r; });
        var id = slugOf(doc.name);
        files.unshift(["instrument.json", JSON.stringify(doc, null, 1)]);
        files.unshift(["pack.json", JSON.stringify({ kind: "surface.pack", v: 1, tool: O.key || "tool", id: id, name: doc.name, made: new Date().toISOString(),
          files: { "instrument.json": "the set (instrument/1): its sounds and how each plays", "samples/": "the recordings the sounds name" } }, null, 1)]);
        deliver(SurfacePack.zip(files), fn + ".zip");
      });
    }
    function add(recipes, role, roles) {
      var have = {}; list.forEach(function (x) { have[x.name + "|" + JSON.stringify(x.recipe).length] = 1; });
      var n = 0;
      recipes.forEach(function (r) {
        if (usesInput(r)) return;
        var k = (r.name || "sound") + "|" + JSON.stringify(r).length; if (have[k]) return; have[k] = 1;
        var R = roles && roles[r.name] || {}, rl = R.role || role || "touch", lv = typeof R.level === "number" ? R.level : r._level != null ? r._level : 1;
        if (r._level != null) { r = JSON.parse(JSON.stringify(r)); delete r._level; }
        list.push({ id: uid(), name: String(r.name || "sound").slice(0, 40), recipe: r, role: rl, every: R.every || (rl === "pattern" ? "eighth" : "beat"), on: R.on == null ? true : !!R.on, level: lv }); n++;
      });
      resetBed(); save(); return n;
    }
    var pending = null;
    function importFile(f) {
      var nm = f && f.name != null ? f.name : (f && f.length ? (f[0].webkitRelativePath || "").split("/")[0] || f.length + " files" : "import");
      if (!f || (f.length === 0)) return Promise.resolve(0);
      return gather(f).then(function (g) {
        var rs = g.recipes, ok = rs.filter(function (r) { return !usesInput(r); });
        Object.keys(g.samples).forEach(function (k) { try { SurfaceVoice.sample(k, g.samples[k].buf); } catch (e) {} });
        var allSmp = ok.length && ok.every(function (r) { return samplesOf(r).length; }), allLong = allSmp && ok.every(function (r) { return r.hold; });
        pending = { name: g.name || nm, recipes: ok, live: rs.length - ok.length, role: allLong ? "bed" : "touch", set: lastSet, roles: g.roles, samples: g.samples, notes: g.notes };
        open(); return ok.length;
      }, function (e) { pending = { name: nm, error: e && e.message || "could not be read" }; open(); return 0; });
    }
    /* keep the recordings the list uses, on this device; let go of the rest */
    function keepSamples(smp) {
      var keys = Object.keys(smp || {}).filter(function (k) { return list.some(function (x) { return samplesOf(x.recipe).indexOf(k) >= 0; }); });
      if (!keys.length) return Promise.resolve(true);
      keys.forEach(function (k) { BYTES.set(k, smp[k].bytes); });
      /* written at once (a page closed straight after Add keeps them), then measured: past the cap, these go again */
      return Promise.all(keys.map(function (k) { return keepBytes(k, smp[k].bytes); })).then(keptSize).then(function (have) {
        if (have <= CAP.store) return true;
        return Promise.all(keys.map(function (k) { return idb("readwrite", function (st) { return st.delete(k); }); })).then(function () { return false; });
      }).catch(function () { return false; });
    }
    function gcSamples() {
      var want = {}; list.forEach(function (x) { samplesOf(x.recipe).forEach(function (k) { want[k] = 1; }); });
      idb("readonly", function (st) { return st.getAllKeys(); }).then(function (ks) { (ks || []).forEach(function (k) { if (!want[k]) dropBytes(k); }); }).catch(function () {});
    }
    /* next visit: the recordings come back from this device before anything asks for them */
    (function restore() {
      var keys = {}; list.forEach(function (x) { samplesOf(x.recipe).forEach(function (k) { keys[k] = 1; }); });
      Object.keys(keys).forEach(function (k) {
        if (SurfaceVoice.sample(k)) return;
        getBytes(k).then(function (b) { if (!b) return; BYTES.set(k, b); return decode(b, ctx()).then(function (buf) { SurfaceVoice.sample(k, buf); }); }).catch(function () {});
      });
    })();

    /* ---------- the sheet ---------- */
    var box = null, veil = null, fileIn = null, dirIn = null;
    var canDir = (function () { try { var i = document.createElement("input"); return "webkitdirectory" in i && !(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) && !(navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform)); } catch (e) { return false; } })();
    /* THEMED (Dimitry, 22 Oct 23:34: in the light theme the Pack tab was white on white): the sheet's whites are the
       tool's --ui-* colors when it has them, the old dark-sheet values when it has not */
    var CSS =
      ".sin-veil{position:fixed;inset:0;z-index:80;background:rgba(5,7,9,.55);opacity:0;transition:opacity .3s}.sin-veil.on{opacity:1}" +
      ".sin{position:fixed;z-index:81;left:50%;top:calc(env(safe-area-inset-top,0px) + 12px);translate:-50% 0;width:min(400px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow-y:auto;scrollbar-gutter:stable;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:16px;background:rgb(var(--ui-g,10 13 16) / .95);color:var(--ui-ink,#fff);border:1px solid rgb(var(--ui-hi,255 255 255) / .14);box-shadow:0 20px 60px rgba(0,0,0,.5);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);opacity:0;transition:opacity .3s;font:400 13px/1.4 var(--sans,system-ui)}" +
      /* O.host: the sheet lives inside the tool's own panel (Current: a tab of the Sound panel), at that panel's width and
         place, with no veil and no close of its own (the panel has one) */
      ".sin.sin-in{position:static;left:auto;top:auto;translate:none;width:auto;max-height:none;overflow:visible;padding:0;border:0;border-radius:0;background:none;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none;opacity:1}.sin.sin-in>h2{display:none}" +
      "@media (min-width:900px) and (hover:hover){.sin:not(.sin-in){top:50%;translate:-50% -50%}}.sin.on{opacity:1}.sin[hidden],.sin-veil[hidden]{display:none}" +
      ".sin h2{display:flex;align-items:center;justify-content:space-between;margin:0;font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.18em;text-transform:uppercase}" +
      ".sin .x{width:32px;height:32px;margin:-6px -6px -6px 0;border:0;border-radius:50%;background:rgb(var(--ui-hi,255 255 255) / .08);color:var(--ui-ink,#fff);font:16px/1 system-ui;cursor:pointer}" +
      ".sin .lead{display:grid;gap:6px;padding-bottom:4px}.sin .lead .lt{font:600 19px/1.15 var(--sans,system-ui,sans-serif);color:var(--ui-ink,#eef1f2)}.sin .lead .ls{font:600 14px/1.3 var(--sans,system-ui,sans-serif);color:var(--ui-ink,#eef1f2)}" +
      ".sin .steps{margin:2px 0 0;padding-left:20px;display:grid;gap:4px;font-size:12.5px;line-height:1.4;color:rgb(var(--ui-hi,255 255 255) / .78)}.sin .steps b{color:var(--ui-ink,#eef1f2);font-weight:600}" +
      ".sin .hl{justify-self:start;margin-top:2px;padding:6px 0;border:0;background:none;color:var(--acc-tx,var(--acc,#55b8c9));font:600 10px/1 var(--mono,monospace);letter-spacing:.12em;text-transform:uppercase;text-decoration:underline;text-underline-offset:4px;cursor:pointer}" +
      ".sin .sh{margin:8px 0 0;font:600 10px/1 var(--mono,monospace);letter-spacing:.16em;text-transform:uppercase;color:var(--ui-dim,#8a9396)}" +
      ".sin p{margin:0;color:rgb(var(--ui-hi,255 255 255) / .72);font-size:12px}.sin .st{font:500 10px/1.3 var(--mono,monospace);letter-spacing:.06em;color:rgb(var(--ui-hi,255 255 255) / .55)}" +
      ".sin button.b{height:36px;padding:0 14px;border:0;border-radius:18px;background:rgb(var(--ui-hi,255 255 255) / .1);color:var(--ui-ink,#fff);font:600 10px/1 var(--mono,monospace);letter-spacing:.16em;text-transform:uppercase;cursor:pointer}" +
      ".sin button.go{background:var(--ui-ink,#fff);color:var(--ui-solid,#0b0f10)}.sin .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
      ".sin .seg{display:flex;border:1px solid rgb(var(--ui-hi,255 255 255) / .2);border-radius:11px;overflow:hidden}" +
      ".sin .seg button{flex:1;min-width:0;height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:0 4px;border:0;background:none;color:rgb(var(--ui-hi,255 255 255) / .75);font:600 9.5px/1.15 var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}" +
      ".sin .seg .ri{width:17px;height:17px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.sin .seg .ri .f{fill:currentColor;stroke:none}" +
      ".sin .seg button{position:relative}.sin .seg .proB{position:absolute;top:4px;right:5px;line-height:0;font-style:normal;color:var(--acc-tx,var(--acc,#55b8c9));pointer-events:none}.sin .seg .proB svg{width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.sin .seg .proB svg .bolt{fill:currentColor;stroke:none}.sin .seg button[aria-checked=true] .proB{color:inherit}" +
      ".sin .ps{align-self:flex-start;display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px 0 8px;border:1px solid rgb(var(--ui-hi,255 255 255) / .2);border-radius:16px;background:none;color:rgb(var(--ui-hi,255 255 255) / .85);font:600 9.5px/1 var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;cursor:grab;touch-action:none}" +
      ".sin .pst .proB{display:inline-block;margin-left:6px;vertical-align:-1px;line-height:0;color:var(--acc-tx,var(--acc,#55b8c9))}.sin .pst .proB svg{width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.sin .pst .proB svg .bolt{fill:currentColor;stroke:none}" +
      ".sin .ps i{width:14px;height:14px;border-radius:50%;background:var(--c,#fff);box-shadow:0 0 8px var(--c,#fff);flex:none}.sin .pads{display:flex;flex-wrap:wrap;gap:6px}" +
      ".sin .seg button+button{border-left:1px solid rgb(var(--ui-hi,255 255 255) / .2)}.sin .seg button[aria-checked=true]{background:var(--ui-ink,#fff);color:var(--ui-solid,#0b0f10)}" +
      ".sin .snd{display:flex;flex-direction:column;gap:8px;padding:10px 0;border-top:1px solid rgb(var(--ui-hi,255 255 255) / .1)}" +
      ".sin .hd{display:flex;align-items:center;gap:8px}.sin .hd .nm{flex:1;min-width:0;font:600 13px/1.2 var(--sans,system-ui);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".sin .hd button{width:32px;height:32px;padding:0;border:0;border-radius:50%;background:rgb(var(--ui-hi,255 255 255) / .08);color:var(--ui-ink,#fff);cursor:pointer;display:grid;place-items:center}" +
      ".sin .hd button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
      ".sin .hd button[aria-pressed=true]{background:var(--acc,#55b8c9);color:#04181c}" +
      ".sin .ev{align-self:flex-start;height:28px;padding:0 10px;border:1px solid rgb(var(--ui-hi,255 255 255) / .2);border-radius:14px;background:none;color:rgb(var(--ui-hi,255 255 255) / .8);font:600 9.5px/1 var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}" +
      /* THE BROWSER (Dimitry, 24 Oct: the explanation behind an i beside the heading, import and folder as round buttons at the top right, the library a browser shown or grouped by kind like the scenes, Water in it as itself) */
      ".sfPaneH.sin-h:not([hidden]){display:flex;align-items:center;gap:6px}.sin-ha{display:contents}.sin-hr{display:flex;gap:6px;margin-left:auto}" +
      ".sin-ib,.sin-rb{flex:none;display:inline-grid;place-items:center;width:32px;height:32px;padding:0;border:0;border-radius:50%;background:rgb(var(--ui-hi,255 255 255) / .1);color:var(--ui-ink,#fff);cursor:pointer}" +
      ".sin-ib{width:26px;height:26px;background:none;color:rgb(var(--ui-hi,255 255 255) / .6)}.sin-ib[aria-expanded=true]{color:var(--acc-tx,var(--acc,#55b8c9))}" +
      ".sin-rb{width:36px;height:36px}.sin-ib svg,.sin-rb svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
      ".sin-ib:focus-visible,.sin-rb:focus-visible{outline:2px solid var(--acc,#55b8c9);outline-offset:2px}" +
      ".sin .info{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:12px;background:rgb(var(--ui-hi,255 255 255) / .06)}" +
      ".sin .lbs{display:flex;flex-direction:column}.sin .lbk{margin:10px 0 2px;font:600 10px/1.3 var(--mono,monospace);letter-spacing:.14em;text-transform:uppercase;color:rgb(var(--ui-hi,255 255 255) / .55)}" +
      ".sin .lb{display:flex;align-items:center;gap:10px;min-height:52px;padding:6px 0;border-top:1px solid rgb(var(--ui-hi,255 255 255) / .1)}" +
      ".sin .lb .t{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.sin .lb b{font:600 13px/1.2 var(--sans,system-ui)}.sin .lb small{font:400 11.5px/1.35 var(--sans,system-ui);color:rgb(var(--ui-hi,255 255 255) / .62)}" +
      ".sin .lb .tag{margin-left:6px;padding:2px 6px;border-radius:8px;font:600 9px/1 var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;background:rgb(var(--ui-hi,255 255 255) / .1);color:rgb(var(--ui-hi,255 255 255) / .75);vertical-align:1px}" +
      ".sin .s-lvbar{margin:2px 0 4px}.sin .s-lvbar>.segs{gap:4px}.sin .s-lvbar .sg{min-height:32px;padding:0 12px!important;border:0;border-radius:16px;background:rgb(var(--ui-hi,255 255 255) / .08);color:rgb(var(--ui-hi,255 255 255) / .75);font:600 9.5px/1 var(--mono,monospace);letter-spacing:.12em;text-transform:uppercase;cursor:pointer;white-space:nowrap}" +
      ".sin .s-lvbar>.segs{overflow-x:auto;scrollbar-width:none}.sin .s-lvbar>.segs>.sg{flex:0 0 auto!important}" +   /* each pill as wide as its word: shrunk to share the row, TEXTURES ran into DRUMS (24 Oct) */
      ".sin .s-lvbar .sg[aria-checked=true]{background:var(--ui-ink,#fff);color:var(--ui-solid,#0b0f10)}" +
      ".sin .lb button.b{flex:none}.sin .lb button.b[disabled]{opacity:.5;cursor:default}" +
      ".sin .off .nm{opacity:.5}.sin .new{background:rgb(var(--ui-hi,255 255 255) / .05);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px}";
    function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function proMk(r) { var f = O.pro && O.pro[r]; return f && window.SurfacePro && SurfacePro.mark ? '<em class="proB">' + SurfacePro.mark(f) + "</em>" : ""; }
    function seg(cur, label) { return '<div class="seg" role="radiogroup" aria-label="' + label + '">' + MY_ROLES.map(function (r) { return '<button type="button" role="radio" data-r="' + r[0] + '" aria-checked="' + (cur === r[0]) + '" title="' + r[2] + '">' + roleIcon(r[0]) + "<span>" + r[1] + "</span>" + proMk(r[0]) + "</button>"; }).join("") + "</div>"; }
    function ensure() {
      if (box) return;
      if (!document.getElementById("sin-css")) { var st = el("style"); st.id = "sin-css"; st.textContent = CSS; document.head.appendChild(st); }
      var host = typeof O.host === "function" ? O.host() : O.host;
      veil = el("div", "sin-veil"); box = el("div", host ? "sin sin-in" : "sin"); veil.hidden = box.hidden = true;
      if (!host) { box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); }
      box.setAttribute("aria-label", WD.title);
      fileIn = el("input"); fileIn.type = "file"; fileIn.multiple = true; fileIn.accept = ".json,.zip,application/json,application/zip,audio/*,.wav,.mp3,.ogg,.m4a,.aac,.flac,.webm"; fileIn.hidden = true;
      fileIn.onchange = function () { var f = [].slice.call(fileIn.files || []); fileIn.value = ""; if (f.length) importFile(f.length === 1 ? f[0] : f); };
      dirIn = el("input"); dirIn.type = "file"; dirIn.hidden = true; dirIn.setAttribute("webkitdirectory", ""); dirIn.multiple = true;
      dirIn.onchange = function () { var f = [].slice.call(dirIn.files || []); dirIn.value = ""; if (f.length) importFile(f); };
      veil.onclick = close; box.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
      /* a drop on the open sheet: a pack, a folder's files, recordings */
      box.addEventListener("dragover", function (e) { e.preventDefault(); }); box.addEventListener("drop", function (e) { e.preventDefault(); e.stopPropagation(); var f = [].slice.call(e.dataTransfer && e.dataTransfer.files || []); if (f.length) importFile(f.length === 1 ? f[0] : f); });
      if (host) { host.append(box); document.body.append(fileIn, dirIn); } else document.body.append(veil, box, fileIn, dirIn);
    }
    var PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5.6v12.8a.8.8 0 0 0 1.2.7l10.3-6.4a.8.8 0 0 0 0-1.4L9.2 4.9A.8.8 0 0 0 8 5.6z" fill="currentColor" stroke="none"/></svg>';
    var BIN = '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/></svg>';
    var ON = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    /* a Pad sound's button: tap puts it on the stage, drag carries it there (PADO.drag hands the pointer to the pad) */
    function padBtn(x) { var n = padCall("count", x.id) || 0, c = padCall("color", x.id) || "#fff", on = (PADO && PADO.surface) || "the stage";
      return '<button type="button" class="ps" style="--c:' + esc(c) + '" aria-label="Put ' + esc(x.name) + " on " + esc(on) + (n ? " (" + n + " there)" : "") + '" title="Tap to put it on ' + esc(on) + ', or drag it there"><i></i>' + (n ? "on " + esc(on) + " · " + n : "put on " + esc(on)) + "</button>"; }
    function padWire(b, x) {
      var g = null;
      b.addEventListener("pointerdown", function (e) { if (e.button > 0) return; g = { id: e.pointerId, x: e.clientX, y: e.clientY, gone: false }; });
      b.addEventListener("pointermove", function (e) { if (!g || g.gone || e.pointerId !== g.id) return; if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8) { g.gone = true; try { b.releasePointerCapture(e.pointerId); } catch (_) {} padCall("drag", e, x.id); } });
      b.addEventListener("pointerup", function () { setTimeout(function () { g = null; }, 0); });
      b.onclick = function () { if (g && g.gone) return; var n = padCall("count", x.id) || 0; padCall("add", x.id, 0.3 + ((n * 0.27) % 0.4), 0.35 + ((n * 0.19) % 0.3)); render(); };
    }
    /* THE HEAD: an i that shows how it works, and round buttons for a file and a folder. Hosted, they join the panel's own
       heading (the tabs' h2.sfPaneH just above the host, or O.head); in the sheet, its h2. */
    var infoOn = false, KEY = O.key || "tool";
    var I_INFO = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".6" fill="currentColor"/></svg>';
    var I_FILE = '<svg viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 14v5h14v-5"/></svg>';
    var I_DIR = '<svg viewBox="0 0 24 24"><path d="M3.5 7.5V18a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-8l-2-2.5h-5a1 1 0 0 0-1 1z"/></svg>';
    function headEl() { var hd = typeof O.head === "function" ? O.head() : O.head; if (hd) return hd;
      var host = typeof O.host === "function" ? O.host() : O.host, pv = host && host.previousElementSibling;
      return pv && pv.classList.contains("sfPaneH") ? pv : box.querySelector("h2"); }
    function head() {
      var hd = headEl(); if (!hd) return;
      var sp = hd.querySelector(".sin-ha"); if (!sp) { sp = el("span", "sin-ha"); var x = hd.querySelector(".x"); if (x) hd.insertBefore(sp, x); else hd.appendChild(sp); hd.classList.add("sin-h"); }
      sp.innerHTML = '<button type="button" class="sin-ib" aria-expanded="' + infoOn + '" aria-controls="sin-info-' + esc(KEY) + '" aria-label="How it works" title="How it works">' + I_INFO + "</button>" +
        '<span class="sin-hr"><button type="button" class="sin-rb imp" aria-label="Import a file: recordings, a pack, a sound or a set" title="Import a file">' + I_FILE + "</button>" +
        (canDir ? '<button type="button" class="sin-rb dir" aria-label="Import a folder" title="Import a folder">' + I_DIR + "</button>" : "") + "</span>";
      sp.querySelector(".sin-ib").onclick = function () { infoOn = !infoOn; render(); };
      sp.querySelector(".imp").onclick = function () { fileIn.click(); };
      var d = sp.querySelector(".dir"); if (d) d.onclick = function () { dirIn.click(); };
    }
    /* THE LIBRARY: the studio's own sounds (voicelib.js) and any packs the tool offers (O.packs: [{ id, name, kind, note,
       url | open, label, tag, here() }]), shown by kind or all, grouped by kind or A to Z, like the scenes */
    var LB = (function () { try { return JSON.parse(localStorage.getItem("surface.instr." + KEY + ".lib")) || {}; } catch (e) { return {}; } })();
    function libItems() {
      var L = window.SurfaceVoiceLib, out = [];
      if (L && L.sounds) out.push({ id: "sounds", name: "Glass and textures", kind: "Textures", note: L.sounds.length + " sounds from the studio’s synth: glass, air, metal", lib: "sounds" });
      if (L && L.drums) out.push({ id: "drums", name: "Drums", kind: "Drums", note: L.drums.length + " drums, arriving as a groove: kick, backbeat, eighth hats", lib: "drums" });
      var P = typeof O.packs === "function" ? O.packs() : O.packs; (P || []).forEach(function (p) { if (p && p.name) out.push(p); });
      return out;
    }
    function library(at) {
      if (!at) return; var items = libItems(); if (!items.length) return;
      var kinds = []; items.forEach(function (p) { if (kinds.indexOf(p.kind) < 0) kinds.push(p.kind); });
      var show = LB.show && (LB.show === "all" || kinds.indexOf(LB.show) >= 0) ? LB.show : "all", sort = LB.sort === "az" ? "az" : "kind";
      var put = function (pt) { for (var k in pt) LB[k] = pt[k]; try { localStorage.setItem("surface.instr." + KEY + ".lib", JSON.stringify(LB)); } catch (e) {} render(); };
      at.appendChild(el("p", "st", "The studio’s library"));
      if (window.SurfaceListView && kinds.length > 1) at.appendChild(SurfaceListView.bar({ label: "Library",
        show: [["all", "All", "Every pack"]].concat(kinds.map(function (k) { return [k, esc(k), "Only " + k]; })),
        sort: [["kind", "Kind", "Grouped by kind"], ["az", "A–Z", "By name"]], sortNames: { kind: "Kind", az: "A–Z" },
        get: function () { return { show: show, sort: sort }; }, set: put }));
      var vis = items.filter(function (p) { return show === "all" || p.kind === show; });
      if (sort === "az") vis.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      else vis.sort(function (a, b) { return kinds.indexOf(a.kind) - kinds.indexOf(b.kind); });
      var last = null;
      vis.forEach(function (p) {
        if (sort === "kind" && p.kind !== last) { at.appendChild(el("p", "lbk", esc(p.kind))); last = p.kind; }
        var here = typeof p.here === "function" && p.here();
        var r = el("div", "lb", '<span class="t"><b>' + esc(p.name) + (p.tag ? '<span class="tag">' + esc(p.tag) + "</span>" : "") + "</b>" + (p.note ? "<small>" + esc(p.note) + "</small>" : "") + "</span>" +
          '<button type="button" class="b"' + (here ? " disabled" : "") + ' aria-label="' + esc((p.label || "Add") + " " + p.name) + '">' + esc(here ? (p.hereLabel || "Here") : (p.label || "Add")) + "</button>");
        r.querySelector("button").onclick = function () { take(p, r.querySelector("button")); };
        at.appendChild(r);
      });
    }
    function take(p, btn) {
      var L = window.SurfaceVoiceLib;
      if (p.lib && L) { var k = p.lib; pending = { name: k === "drums" ? "the studio’s drums" : "the studio’s glass and textures", recipes: JSON.parse(JSON.stringify(L[k])), live: 0, role: k === "drums" ? "beat" : "touch", groove: k === "drums" }; render(); box.scrollIntoView && box.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
      if (typeof p.open === "function") { p.open(); return; }
      if (p.url) { if (btn) { btn.disabled = true; btn.textContent = "…"; }
        fetch(p.url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
          .then(function (b) { importFile(new File([b], (p.file || p.id || "pack") + ".zip", { type: "application/zip" })); })
          .catch(function () { if (btn) { btn.disabled = false; btn.textContent = p.label || "Add"; } try { O.say && O.say(p.name + " could not be fetched: are you offline?"); } catch (e) {} }); }
    }
    function render() {
      if (!box || box.hidden) return;
      var h = '<h2><span>' + esc(WD.title) + '</span><button type="button" class="x" aria-label="Close">✕</button></h2>';
      if (pending) {
        if (pending.error) h += '<div class="new"><p><b>' + esc(pending.name) + "</b>: " + esc(pending.error) + '</p><div class="row"><button type="button" class="b pd">OK</button></div></div>';
        else if (!pending.recipes.length) h += '<div class="new"><p><b>' + esc(pending.name) + "</b> has no sounds this tool can play" + (pending.live ? " (its " + pending.live + " live voice" + (pending.live > 1 ? "s need" : " needs") + " a live microphone chain)" : "") + '.</p><div class="row"><button type="button" class="b pd">OK</button></div></div>';
        else h += '<div class="new"><p><b>' + pending.recipes.length + " sound" + (pending.recipes.length > 1 ? "s" : "") + "</b> in " + esc(pending.name) + (pending.live ? " · " + pending.live + " live voice" + (pending.live > 1 ? "s" : "") + " left out" : "") + '</p><p class="st">' + pending.recipes.map(function (r) { return esc(r.name); }).join(" · ") + "</p>" +
          (pending.notes && pending.notes.length ? '<p class="st">Left out: ' + pending.notes.map(esc).join(" · ") + "</p>" : "") +
          (pending.roles && pending.asSet !== false ? '<p>Each plays as the set says (touch, beat, bed or pattern); change any of them after.</p><div class="row"><button type="button" class="b own">Choose one role for all</button></div>'
            : "<p>How should " + (pending.recipes.length > 1 ? "they" : "it") + " play?</p>" + seg(pending.role, "Role for the new sounds")) +
          '<div class="row"><button type="button" class="b go pa">Add</button><button type="button" class="b pd">Cancel</button></div></div>';
      }
      if (infoOn) h += '<div class="info" id="sin-info-' + esc(KEY) + '"><p>Bring in sounds: your own recordings (wav, mp3, ogg, m4a), or a recipe, a mix or a pack made in a synth or by hand (.json or .zip), with the round buttons at the top or by dropping them here. Each one plays by touch, on the beat, as a bed, or from the pattern, and you can change which any time.</p><p>A set with recordings saves as a pack zip to share. Sounds play while the sound is on. Touch: tap or hold on the stage.</p></div>';
      /* THE LEAD (Dimitry, 24 Oct, driving: "it should say pack at the top and bring in your own media ... no heading, no
         bold"): the sheet names itself and its purpose in large type, with the way to the tool's longer guide (O.help);
         the how-to stays behind the i, the packs in the browser below. */
      if (!pending) {
        h += '<div class="lead">' + (O.host ? "" : '<p class="lt">' + esc(WD.title) + "</p>") + '<p class="ls">' + esc(WD.lead) + "</p>";   // hosted, the panel's own heading already names it
        if (O.help && O.help.label) h += '<button type="button" class="hl">' + esc(O.help.label) + " \u2192</button>";
        h += "</div>";
      }
      if (list.length && !pending) h += '<p class="sh">Your sounds</p>';
      list.forEach(function (x) {
        h += '<div class="snd' + (x.on ? "" : " off") + '" data-id="' + x.id + '"><div class="hd"><span class="nm">' + esc(x.name) + '</span><button type="button" class="pv" aria-label="Hear ' + esc(x.name) + '" title="Hear it">' + PLAY + '</button><button type="button" class="tg" aria-pressed="' + x.on + '" aria-label="' + esc(x.name) + (x.on ? " plays" : " is off") + '" title="On or off">' + ON + '</button><button type="button" class="rm" aria-label="Remove ' + esc(x.name) + '" title="Remove">' + BIN + "</button></div>" + seg(x.role, "How " + x.name + " plays") +
          (x.role === "beat" || x.role === "pattern" ? '<button type="button" class="ev" title="How often">' + ((EVERY.filter(function (e) { return e[0] === x.every; })[0] || EVERY[0])[1]) + "</button>" : "") +
          (x.role === "pad" && PADO ? padBtn(x) : "") + "</div>";
      });
      var PS = PADO && padCall("presets");
      if (PS && PS.length) h += '<p class="st pst">' + esc(PADO.presetsTitle || "Ready on " + (PADO.surface || "the stage")) + proMk("pad") + "</p>" + '<div class="row">' + PS.map(function (p) { return '<button type="button" class="b pp" data-p="' + esc(p.name) + '" title="' + esc(p.note) + '">' + esc(p.name) + "</button>"; }).join("") + "</div>";
      h += '<div class="lbs"></div>' + (list.length ? '<div class="row"><button type="button" class="b sv">' + esc(WD.save) + "</button></div>" : "");
      box.innerHTML = h;
      var q = function (s) { return box.querySelector(s); };
      var xb = q(".x"); if (xb) xb.onclick = close;
      head();
      var hl = q(".hl"); if (hl) hl.onclick = function () { try { O.help.go(); } catch (e) {} };
      library(q(".lbs"));
      var sv = q(".sv"); if (sv) sv.onclick = saveSet;
      var pd = q(".pd"); if (pd) pd.onclick = function () { pending = null; render(); };
      box.querySelectorAll(".pp").forEach(function (b) { b.onclick = function () { if (padCall("preset", b.dataset.p)) { render(); try { O.say && O.say(b.dataset.p + ": " + b.title); } catch (e) {} } }; });
      var own = q(".own"); if (own) own.onclick = function () { pending.asSet = false; render(); };
      var pa = q(".pa"); if (pa) pa.onclick = function () {
        var st = pending.set, gr = null, smp = pending.samples;
        if (pending.groove && pending.role === "beat") { gr = {}; Object.keys(GROOVE).forEach(function (k) { gr[k] = Object.assign({ role: "beat" }, GROOVE[k]); }); }
        var before = {}; list.forEach(function (y) { before[y.id] = 1; });
        var n = add(pending.recipes, pending.role, pending.asSet === false ? null : (pending.roles || st && st.roles || gr));
        if (PADO) list.filter(function (y) { return !before[y.id] && y.role === "pad" && y.on; }).forEach(function (y, k, a) { padCall("add", y.id, a.length > 1 ? 0.2 + 0.6 * k / (a.length - 1) : 0.5, 0.5); });
        if (st) { var lean = JSON.parse(JSON.stringify(st)); delete lean.recipes; kept = lean; try { localStorage.setItem(LS + ".set", JSON.stringify(lean)); } catch (e) {} }
        pending = null; render();
        var said = n ? n + " sound" + (n > 1 ? "s" : "") + " added" : "already here";
        keepSamples(smp).then(function (okd) { try { O.say && O.say(said + (okd ? "" : " · recordings kept for this visit only (no room on this device)")); } catch (e) {} }); };
      var nw = q(".new .seg"); if (nw) nw.querySelectorAll("button").forEach(function (b) { b.onclick = function () { pending.role = b.dataset.r; render(); }; });
      box.querySelectorAll(".snd").forEach(function (row) {
        var x = list.filter(function (y) { return y.id === row.dataset.id; })[0]; if (!x) return;
        row.querySelectorAll(".seg button").forEach(function (b) { b.onclick = function () { x.role = b.dataset.r; if (x.role === "pattern" && x.every === "beat") x.every = "eighth"; resetBed(); save();
          if (x.role === "pad" && PADO && !padCall("count", x.id)) padCall("add", x.id, 0.5, 0.5);   // chosen for the stage: it stands there at once
          render(); }; });
        var ps = row.querySelector(".ps"); if (ps) padWire(ps, x);
        row.querySelector(".tg").onclick = function () { x.on = !x.on; resetBed(); save(); render(); };
        row.querySelector(".rm").onclick = function () { list = list.filter(function (y) { return y !== x; }); resetBed(); save(); render(); gcSamples(); };
        row.querySelector(".pv").onclick = function () { strike(x, undefined, null, oneShot(x) || 0.6); };
        var ev = row.querySelector(".ev"); if (ev) ev.onclick = function () { var i = EVERY.findIndex(function (e) { return e[0] === x.every; }); x.every = EVERY[(i + 1) % EVERY.length][0]; next[x.id] = null; save(); render(); };
      });
    }
    /* hosted, open() shows the tool's panel first (O.show), and close() asks the tool to close it (O.hide) */
    function open() { if (O.host && O.show && !open.busy) { open.busy = true; try { O.show(); } finally { open.busy = false; } }
      ensure(); box.hidden = false; if (!O.host) veil.hidden = false; render(); requestAnimationFrame(function () { box.classList.add("on"); if (!O.host) veil.classList.add("on"); }); }
    function close() { if (!box) return; if (O.host) { box.hidden = true; if (O.hide) O.hide(); return; } box.classList.remove("on"); veil.classList.remove("on"); setTimeout(function () { box.hidden = veil.hidden = true; }, 300); }
    /* one sound, with its recipe (a pad reads what it plays); and "make sure these are here", for presets: each recipe that is
       already in the list (same name and recipe) is reused, the rest are added with the role; resolves their ids in order */
    function sound(id) { var x = list.filter(function (y) { return y.id === id; })[0]; return x ? { id: x.id, name: x.name, recipe: x.recipe, role: x.role, on: x.on, level: x.level } : null; }
    function ensureSounds(recipes, role) {
      var ids = [], dirty = false;
      (recipes || []).forEach(function (r) { if (!isRecipe(r)) { ids.push(null); return; } var js = JSON.stringify(r);
        var x = list.filter(function (y) { return y.name === r.name && JSON.stringify(y.recipe) === js; })[0];
        if (x) { if (role && (x.role !== role || !x.on)) { x.role = role; x.on = true; dirty = true; } }
        else { x = { id: uid(), name: String(r.name || "sound").slice(0, 40), recipe: JSON.parse(js), role: role || "touch", every: "beat", on: true, level: 1 }; list.push(x); dirty = true; }
        ids.push(x.id); });
      if (dirty) { resetBed(); save(); render(); }
      return ids;
    }
    return { open: open, close: close, import: importFile, list: pub, add: add, recipesIn: recipesIn, exportSet: exportSet, saveSet: saveSet, sound: sound, ensure: ensureSounds, render: function () { render(); },
      playing: function () { return LIVE.length > 0 || bed.h.length > 0; },
      samples: function () { var k = {}; list.forEach(function (x) { samplesOf(x.recipe).forEach(function (s) { k[s] = !!SurfaceVoice.sample(s); }); }); return k; } };
  }
  window.SurfaceInstruments = { mount: mount, ROLE_ICONS: ROLE_ICONS, recipesIn: recipesIn, AUDIO: AUDIO, CAP: CAP,
    /* does this pack hold anything for instruments? (a tool's own pack opener asks, then hands the file over) */
    inPack: function (P) { var any = false; P.files.forEach(function (u, k) { if (any) return; if (AUDIO.test(k)) any = true; else if (/\.json$/i.test(k)) { var o = P.json(k); if (o && recipesIn(o).length) any = true; } }); return any; } };
})();
