/* Surface · Instruments — sounds made in Pullula (recipes, format voice/0), imported into any tool and played there
   (Dimitry, 22 Oct 2026: import into Current; "selectable on import and after, with touch as default").

   What it opens: a recipe (voice/0), a Pullula mix (mix/0, each sound carries its recipe), saved mixes (mixes/0), a
   list of recipes, or a pack zip holding any of those (SurfacePack). Recipes that need a live input (Pullula's vocal
   sounds) are left out: they need Pullula's microphone chain.

   What a sound does is its ROLE, chosen when it comes in and changed any time after:
     touch    your finger on the stage plays it: a tap strikes, a hold sustains a held sound; left/right pans it
     beat     it strikes on the beat grid: every beat, the off-beats, once a bar, or eighths
     bed      it plays under everything: a held sound holds, a short one repeats at its own length
     pattern  the drawing is the sequencer: on the grid it walks the pattern's cuts in order, panned where each is
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
   Needs SurfaceVoice (voice.js); reads zips with SurfacePack (pack.js) when it is there. */
(function () {
  "use strict";
  if (window.SurfaceInstruments) return;
  var ROLES = [["touch", "Touch", "your finger plays it"], ["beat", "On the beat", "it strikes on the grid"], ["bed", "Bed", "it plays under everything"], ["pattern", "Pattern", "the drawing sequences it"]];
  var EVERY = [["beat", "every beat", 4], ["off", "off-beats", 4], ["bar", "once a bar", 16], ["eighth", "eighths", 2]];
  function uid() { return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function usesInput(r) { return !!(r && r.layers && r.layers.some(function (l) { return l && l.source === "input"; })); }
  function isRecipe(r) { return !!(r && typeof r === "object" && r.format === "voice/0" && (Array.isArray(r.layers) || Array.isArray(r.events))); }
  /* every recipe in whatever was opened */
  function recipesIn(o, out) {
    out = out || [];
    if (!o || typeof o !== "object") return out;
    if (Array.isArray(o)) { o.forEach(function (x) { recipesIn(x, out); }); return out; }
    if (isRecipe(o)) { out.push(o); return out; }
    if (o.format === "mix/0" && Array.isArray(o.sounds)) o.sounds.forEach(function (s) { if (s && isRecipe(s.recipe)) out.push(s.recipe); });
    else if (o.format === "mixes/0" && Array.isArray(o.mixes)) o.mixes.forEach(function (m) { recipesIn(m, out); });
    else if (Array.isArray(o.recipes)) recipesIn(o.recipes, out);
    return out;
  }
  function mount(O) {
    O = O || {};
    var LS = "surface.instruments." + (O.key || "tool"), list = [];
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
        var every = E[2], off = x.every === "off" ? 2 : 0;
        var k = next[x.id]; if (k == null) k = Math.ceil((now + 0.03 - g.zero) / step);
        for (; ; k++) {
          var t = g.zero + k * step; if (t > ahead) break; if (t < now) continue;
          if (((k - off) % every + every) % every) continue;
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
    function readFile(f) {
      if (window.SurfacePack && SurfacePack.isZip(f)) return SurfacePack.read(f).then(function (p) {
        var all = []; p.files.forEach(function (u, path) { if (/\.json$/i.test(path)) { var o = p.json(path); if (o) recipesIn(o, all); } }); return all;
      });
      return f.text().then(function (t) { var o; try { o = JSON.parse(t); } catch (e) { throw new Error("not a recipe, a mix or a pack"); } return recipesIn(o); });
    }
    function add(recipes, role) {
      var have = {}; list.forEach(function (x) { have[x.name + "|" + JSON.stringify(x.recipe).length] = 1; });
      var n = 0;
      recipes.forEach(function (r) {
        if (usesInput(r)) return;
        var k = (r.name || "sound") + "|" + JSON.stringify(r).length; if (have[k]) return; have[k] = 1;
        list.push({ id: uid(), name: String(r.name || "sound").slice(0, 40), recipe: r, role: role || "touch", every: role === "pattern" ? "eighth" : "beat", on: true, level: 1 }); n++;
      });
      resetBed(); save(); return n;
    }
    var pending = null;
    function importFile(f) {
      return readFile(f).then(function (rs) {
        var ok = rs.filter(function (r) { return !usesInput(r); });
        pending = { name: f.name, recipes: ok, live: rs.length - ok.length, role: "touch" };
        open(); return ok.length;
      }, function (e) { pending = { name: f.name, error: e && e.message || "could not be read" }; open(); return 0; });
    }

    /* ---------- the sheet ---------- */
    var box = null, veil = null, fileIn = null;
    var CSS =
      ".sin-veil{position:fixed;inset:0;z-index:80;background:rgba(5,7,9,.55);opacity:0;transition:opacity .3s}.sin-veil.on{opacity:1}" +
      ".sin{position:fixed;z-index:81;left:50%;top:calc(env(safe-area-inset-top,0px) + 12px);translate:-50% 0;width:min(400px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow-y:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:16px;background:rgba(10,13,16,.95);color:#fff;border:1px solid rgba(255,255,255,.14);box-shadow:0 20px 60px rgba(0,0,0,.5);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);opacity:0;transition:opacity .3s;font:400 13px/1.4 var(--sans,system-ui)}" +
      "@media (min-width:900px) and (hover:hover){.sin{top:50%;translate:-50% -50%}}.sin.on{opacity:1}.sin[hidden],.sin-veil[hidden]{display:none}" +
      ".sin h2{display:flex;align-items:center;justify-content:space-between;margin:0;font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.18em;text-transform:uppercase}" +
      ".sin .x{width:32px;height:32px;margin:-6px -6px -6px 0;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font:16px/1 system-ui;cursor:pointer}" +
      ".sin p{margin:0;color:rgba(255,255,255,.72);font-size:12px}.sin .st{font:500 10px/1.3 var(--mono,monospace);letter-spacing:.06em;color:rgba(255,255,255,.55)}" +
      ".sin button.b{height:36px;padding:0 14px;border:0;border-radius:18px;background:rgba(255,255,255,.1);color:#fff;font:600 10px/1 var(--mono,monospace);letter-spacing:.16em;text-transform:uppercase;cursor:pointer}" +
      ".sin button.go{background:#fff;color:#0b0f10}.sin .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
      ".sin .seg{display:flex;border:1px solid rgba(255,255,255,.2);border-radius:11px;overflow:hidden}" +
      ".sin .seg button{flex:1;min-width:0;height:40px;padding:0 4px;border:0;background:none;color:rgba(255,255,255,.75);font:600 9.5px/1.15 var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}" +
      ".sin .seg button+button{border-left:1px solid rgba(255,255,255,.2)}.sin .seg button[aria-checked=true]{background:#fff;color:#0b0f10}" +
      ".sin .snd{display:flex;flex-direction:column;gap:8px;padding:10px 0;border-top:1px solid rgba(255,255,255,.1)}" +
      ".sin .hd{display:flex;align-items:center;gap:8px}.sin .hd .nm{flex:1;min-width:0;font:600 13px/1.2 var(--sans,system-ui);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".sin .hd button{width:32px;height:32px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;cursor:pointer;display:grid;place-items:center}" +
      ".sin .hd button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
      ".sin .hd button[aria-pressed=true]{background:var(--acc,#55b8c9);color:#04181c}" +
      ".sin .ev{align-self:flex-start;height:28px;padding:0 10px;border:1px solid rgba(255,255,255,.2);border-radius:14px;background:none;color:rgba(255,255,255,.8);font:600 9.5px/1 var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}" +
      ".sin .off .nm{opacity:.5}.sin .new{background:rgba(255,255,255,.05);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px}";
    function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function seg(cur, label) { return '<div class="seg" role="radiogroup" aria-label="' + label + '">' + ROLES.map(function (r) { return '<button type="button" role="radio" data-r="' + r[0] + '" aria-checked="' + (cur === r[0]) + '" title="' + r[2] + '">' + r[1] + "</button>"; }).join("") + "</div>"; }
    function ensure() {
      if (box) return;
      if (!document.getElementById("sin-css")) { var st = el("style"); st.id = "sin-css"; st.textContent = CSS; document.head.appendChild(st); }
      veil = el("div", "sin-veil"); box = el("div", "sin"); veil.hidden = box.hidden = true;
      box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Instruments");
      fileIn = el("input"); fileIn.type = "file"; fileIn.accept = ".json,.zip,application/json,application/zip"; fileIn.hidden = true;
      fileIn.onchange = function () { var f = fileIn.files && fileIn.files[0]; fileIn.value = ""; if (f) importFile(f); };
      veil.onclick = close; box.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
      document.body.append(veil, box, fileIn);
    }
    var PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5.6v12.8a.8.8 0 0 0 1.2.7l10.3-6.4a.8.8 0 0 0 0-1.4L9.2 4.9A.8.8 0 0 0 8 5.6z" fill="currentColor" stroke="none"/></svg>';
    var BIN = '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/></svg>';
    var ON = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    function render() {
      if (!box || box.hidden) return;
      var h = '<h2><span>Instruments</span><button type="button" class="x" aria-label="Close">✕</button></h2>';
      if (pending) {
        if (pending.error) h += '<div class="new"><p><b>' + esc(pending.name) + "</b>: " + esc(pending.error) + '</p><div class="row"><button type="button" class="b pd">OK</button></div></div>';
        else if (!pending.recipes.length) h += '<div class="new"><p><b>' + esc(pending.name) + "</b> has no sounds this tool can play" + (pending.live ? " (its " + pending.live + " live voice" + (pending.live > 1 ? "s need" : " needs") + " Pullula’s microphone)" : "") + '.</p><div class="row"><button type="button" class="b pd">OK</button></div></div>';
        else h += '<div class="new"><p><b>' + pending.recipes.length + " sound" + (pending.recipes.length > 1 ? "s" : "") + "</b> in " + esc(pending.name) + (pending.live ? " · " + pending.live + " live voice" + (pending.live > 1 ? "s" : "") + " left out" : "") + '</p><p class="st">' + pending.recipes.map(function (r) { return esc(r.name); }).join(" · ") + "</p><p>How should " + (pending.recipes.length > 1 ? "they" : "it") + " play?</p>" + seg(pending.role, "Role for the new sounds") +
          '<div class="row"><button type="button" class="b go pa">Add</button><button type="button" class="b pd">Cancel</button></div></div>';
      }
      if (!list.length && !pending) h += "<p>Bring in sounds made in Pullula: a recipe, a mix, saved mixes or a pack (.json or .zip). Each one plays by touch, on the beat, as a bed, or from the pattern, and you can change which any time.</p>";
      list.forEach(function (x) {
        h += '<div class="snd' + (x.on ? "" : " off") + '" data-id="' + x.id + '"><div class="hd"><span class="nm">' + esc(x.name) + '</span><button type="button" class="pv" aria-label="Hear ' + esc(x.name) + '" title="Hear it">' + PLAY + '</button><button type="button" class="tg" aria-pressed="' + x.on + '" aria-label="' + esc(x.name) + (x.on ? " plays" : " is off") + '" title="On or off">' + ON + '</button><button type="button" class="rm" aria-label="Remove ' + esc(x.name) + '" title="Remove">' + BIN + "</button></div>" + seg(x.role, "How " + x.name + " plays") +
          (x.role === "beat" || x.role === "pattern" ? '<button type="button" class="ev" title="How often">' + ((EVERY.filter(function (e) { return e[0] === x.every; })[0] || EVERY[0])[1]) + "</button>" : "") + "</div>";
      });
      h += '<div class="row"><button type="button" class="b imp">Import…</button></div><p class="st">Sounds play while the sound is on. Touch: tap or hold on the stage.</p>';
      box.innerHTML = h;
      var q = function (s) { return box.querySelector(s); };
      q(".x").onclick = close;
      q(".imp").onclick = function () { fileIn.click(); };
      var pd = q(".pd"); if (pd) pd.onclick = function () { pending = null; render(); };
      var pa = q(".pa"); if (pa) pa.onclick = function () { var n = add(pending.recipes, pending.role); pending = null; render(); try { O.say && O.say(n ? n + " sound" + (n > 1 ? "s" : "") + " added" : "already here"); } catch (e) {} };
      var nw = q(".new .seg"); if (nw) nw.querySelectorAll("button").forEach(function (b) { b.onclick = function () { pending.role = b.dataset.r; render(); }; });
      box.querySelectorAll(".snd").forEach(function (row) {
        var x = list.filter(function (y) { return y.id === row.dataset.id; })[0]; if (!x) return;
        row.querySelectorAll(".seg button").forEach(function (b) { b.onclick = function () { x.role = b.dataset.r; if (x.role === "pattern" && x.every === "beat") x.every = "eighth"; resetBed(); save(); render(); }; });
        row.querySelector(".tg").onclick = function () { x.on = !x.on; resetBed(); save(); render(); };
        row.querySelector(".rm").onclick = function () { list = list.filter(function (y) { return y !== x; }); resetBed(); save(); render(); };
        row.querySelector(".pv").onclick = function () { strike(x, undefined, null, oneShot(x) || 0.6); };
        var ev = row.querySelector(".ev"); if (ev) ev.onclick = function () { var i = EVERY.findIndex(function (e) { return e[0] === x.every; }); x.every = EVERY[(i + 1) % EVERY.length][0]; next[x.id] = null; save(); render(); };
      });
    }
    function open() { ensure(); box.hidden = veil.hidden = false; render(); requestAnimationFrame(function () { box.classList.add("on"); veil.classList.add("on"); }); }
    function close() { if (!box) return; box.classList.remove("on"); veil.classList.remove("on"); setTimeout(function () { box.hidden = veil.hidden = true; }, 300); }
    return { open: open, close: close, import: importFile, list: pub, add: add, recipesIn: recipesIn };
  }
  window.SurfaceInstruments = { mount: mount, recipesIn: recipesIn };
})();
