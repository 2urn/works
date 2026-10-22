/* Surface · Capture panel — what the shutter's hold opens, in Fracture's layout (Dimitry, 18 Oct 2026: "Fracture has
   a better layout / polish for this screen"). One look for every tool: a frosted card above the bar, "capture" and
   the output size in its head, the modes as a segmented pair (or three), the shapes as cards that say what each is
   for, the tool's own extras (a GIF length…), one primary action in the accent and a quiet secondary beside it.

   Plain script, window.SurfaceCapture, no dependencies. The tool keeps its own capture engine; this draws the panel.

     const cap = SurfaceCapture.panel({
       host: '#shotPop',                                  // the dialog element (positioned by the tool), or omitted for a new one
       label: 'Capture: mode, shape and sharing',
       modes:  [['still','still'], ['video','video'], ['gif','gif']],
       shapes: SurfaceCapture.SHAPES,                     // [key, what it is for]; Fracture's order and words by default
       extras: [{ key: 'gif', show: s => s.mode === 'gif', items: [[3,'3s'],[5,'5s'],[8,'8s']], label: 'GIF length' }],
                                                          // or a slider: { key, type: 'range', min: 0, max: 1, step: .05,
                                                          //   ends: v => ['music 50%', 'mic 50%'], live: true (stays usable while busy) }
       get: () => ({ mode, shape, gif }),                  // the current choices
       set: (key, value) => {},                            // a choice changed (key: 'mode' | 'shape' | an extra's key)
       dims: s => '1080×1920',                             // the head's readout
       hint: s => 'A PNG at full resolution.',             // a line under the actions ('' hides it)
       primary:   { label: s => 'save', run: () => {} },   // the accent button
       secondary: { label: 'share', run: () => {} },       // optional
       busy: () => false,                                  // true while recording/encoding: choices lock
       onClose: () => {},
       foot: true, toward: '#pShot',                      // optional (21 Oct 2026): the head is pop.js's foot band (tabs,
                                                          //   steps and the vertical close at the bottom; slides to its button)
       modes: false,                                      // optional: no mode row (the tool keeps the modes elsewhere)
       ratioIcons: true                                   // optional: each shape a fixed tile with its proportion drawn
     })  → { el, build(), open(), close(), isOpen() }
   Colours: --cap-acc (the accent; falls back to --sc-acc) and --cap-on (text on the accent). */
(function () {
  "use strict";
  var SHAPES = [["screen", "this screen"], ["16:9", "video, YouTube"], ["4:5", "Instagram feed"], ["1:1", "square"], ["9:16", "stories, Reels, TikTok"]];
  var CSS = [
    ".scap{--ca:var(--cap-acc,var(--sc-acc,#8fd3e8));--co:var(--cap-on,#06131a);display:flex;flex-direction:column;border-radius:18px;overflow:hidden;",
    "  background:rgb(var(--ui-g,14 14 16) / .9);border:1px solid rgb(var(--ui-hi,255 255 255) / .14);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);color:var(--ui-ink,#fff)}",
    ".scap[hidden]{display:none!important}",
    ".scap-head{display:flex;justify-content:space-between;align-items:center;min-height:40px;padding:0 6px 0 16px;border-bottom:1px solid rgb(var(--ui-hi,255 255 255) / .08);",
    "  font:500 10px/1 var(--sc-mono,ui-monospace,Menlo,monospace);letter-spacing:.18em;text-transform:uppercase;color:var(--ui-dim,#a8a8a8)}",
    ".scap-r{display:flex;align-items:center;gap:2px}",
    ".scap-dims{color:var(--ca);letter-spacing:.06em;text-transform:none;font-size:11px}",
    ".scap-x{width:36px;height:36px;display:grid;place-items:center;padding:0;border:0;background:none;color:var(--ui-dim,#8f8f8f);cursor:pointer}.scap-x:hover{color:var(--ui-ink,#fff)}",
    ".scap-x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}",
    ".scap-body{overflow-y:auto;overscroll-behavior:contain;padding:10px 12px 12px;display:grid;gap:8px}",
    ".scap-row{display:flex;flex-wrap:wrap;gap:6px}.scap-row[hidden]{display:none}",
    ".scap-c{flex:1 1 auto;min-height:44px;padding:5px 8px;border-radius:11px;background:rgb(var(--ui-hi,255 255 255) / .05);border:1px solid rgb(var(--ui-hi,255 255 255) / .12);color:var(--ui-ink,#fff);cursor:pointer;",
    "  font:500 11px/1.1 var(--sc-mono,ui-monospace,Menlo,monospace);letter-spacing:.12em;text-transform:uppercase;display:grid;place-items:center;gap:3px;-webkit-tap-highlight-color:transparent}",
    ".scap-modes .scap-c{min-height:40px}",
    ".scap-shapes .scap-c{min-width:62px;text-transform:none;letter-spacing:.02em}",
    ".scap-shapes .scap-c b{font-size:12.5px;font-weight:600}",
    ".scap-shapes .scap-c i{font-size:9.5px;line-height:1.15;font-style:normal;color:var(--ui-dim,#7d8590);letter-spacing:.04em}",
    ".scap-shapes .scap-c.wide{flex-basis:100%}",
    ".scap-c[aria-checked=true]{background:var(--ca);border-color:var(--ca);color:var(--co);font-weight:700}",
    /* RATIO TILES (Dimitry, 21 Oct night): each shape shows its proportion, an outlined rectangle at the true ratio, its name
       under it; every tile the kit's tile size */
    ".scap-shapes.ratios{justify-content:center}.scap-shapes.ratios .scap-c{flex:0 0 auto;width:var(--s-tile-w,64px);min-width:0;height:var(--s-tile-h,56px);min-height:0;padding:4px 2px;gap:4px;align-content:center}",
    ".scap-shapes.ratios .scap-c svg{width:30px;height:24px;overflow:visible}.scap-shapes.ratios .scap-c rect{fill:none;stroke:currentColor;stroke-width:1.6}",
    ".scap-shapes.ratios .scap-c b{font-size:10px;letter-spacing:.06em}",
    ".scap-c[aria-checked=true] i{color:var(--co);opacity:.72}",
    ".scap-c:disabled{opacity:.4;cursor:default}",
    ".scap-c:focus-visible,.scap-go:focus-visible,.scap-x:focus-visible{outline:2px solid var(--ca);outline-offset:2px}",
    ".scap-acts{display:flex;gap:8px;padding-top:2px}",
    ".scap-go{flex:1;min-height:46px;border-radius:12px;border:1px solid var(--ca);background:var(--ca);color:var(--co);cursor:pointer;",
    "  font:600 11px/1 var(--sc-mono,ui-monospace,Menlo,monospace);letter-spacing:.12em;text-transform:uppercase}",
    ".scap-go.ghost{flex:0 0 auto;padding:0 16px;background:rgb(var(--ui-hi,255 255 255) / .06);border-color:rgb(var(--ui-hi,255 255 255) / .14);color:var(--ui-ink,#fff);font-weight:500}",
    ".scap-go.ghost:hover{border-color:var(--ca)}.scap-go:disabled{opacity:.5}",
    ".scap-range{display:grid;grid-template-columns:minmax(4.5em,auto) 1fr minmax(4.5em,auto);align-items:center;gap:10px;padding:4px 4px 2px}",
    ".scap-range[hidden]{display:none}",
    ".scap-range span{font:500 10px/1.2 var(--sc-mono,ui-monospace,Menlo,monospace);letter-spacing:.1em;text-transform:uppercase;color:var(--ui-dim,#8f8f8f);white-space:nowrap}",
    ".scap-range span:last-child{text-align:right}",
    ".scap-range input{width:100%;min-height:36px;margin:0;accent-color:var(--ca);cursor:pointer}",
    ".scap-hint{margin:0;padding:0 4px;font:400 12px/1.4 var(--sc-sans,system-ui,sans-serif);color:var(--ui-dim,#8f8f8f)}.scap-hint:empty{display:none}",
    "@media (prefers-reduced-transparency:reduce){.scap{background:rgb(var(--ui-g,14 14 16));backdrop-filter:none;-webkit-backdrop-filter:none}}"
  ].join("\n");
  function css() { if (document.getElementById("scap-css")) return; var s = document.createElement("style"); s.id = "scap-css"; s.textContent = CSS; document.head.appendChild(s); }
  function el(t, c, txt) { var e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
  var X = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  /* a shape's proportion, width over height: "16:9" -> 1.78; "screen" is the window's */
  function ratio(k) { var m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(k)); return m ? +m[1] / +m[2] : Math.max(.3, Math.min(3, innerWidth / Math.max(1, innerHeight))); }
  function panel(o) {
    css();
    var root = typeof o.host === "string" ? document.querySelector(o.host) : o.host;
    if (!root) { root = el("div"); root.hidden = true; document.body.appendChild(root); }
    root.innerHTML = ""; root.classList.add("scap"); root.setAttribute("role", "dialog"); root.setAttribute("aria-label", o.label || "Capture");
    var head = el("div", "scap-head"), r = el("span", "scap-r"), dims = el("span", "scap-dims"), x = el("button", "scap-x");
    head.append(el("span", null, "capture")); x.type = "button"; x.innerHTML = X; x.setAttribute("aria-label", "Close the capture options");
    r.append(dims, x); head.append(r);
    var body = el("div", "scap-body");
    var modes = el("div", "scap-row scap-modes"); modes.setAttribute("role", "radiogroup"); modes.setAttribute("aria-label", "What the shutter makes");
    var shapes = el("div", "scap-row scap-shapes"); shapes.setAttribute("role", "radiogroup"); shapes.setAttribute("aria-label", "Shape");
    var extras = (o.extras || []).map(function (e) {
      if (e.type === "range") { var g = el("div", "scap-range scap-extra"); g.setAttribute("role", "group"); g.setAttribute("aria-label", e.label || e.key); return { def: e, el: g }; }
      var d = el("div", "scap-row scap-extra"); d.setAttribute("role", "radiogroup"); d.setAttribute("aria-label", e.label || e.key); return { def: e, el: d }; });
    var acts = el("div", "scap-acts"), go = el("button", "scap-go"); go.type = "button"; acts.append(go);
    var sec = null; if (o.secondary) { sec = el("button", "scap-go ghost"); sec.type = "button"; acts.append(sec); }
    var hint = el("p", "scap-hint");
    if (o.ratioIcons) shapes.classList.add("ratios");
    body.append(modes, shapes); extras.forEach(function (e) { body.append(e.el); }); body.append(acts, hint);
    root.append(head, body);

    function radios(box, items, cur, key, two) {
      box.innerHTML = ""; var lock = !!(o.busy && o.busy()), last = items.length - 1;
      items.forEach(function (it, i) {
        var v = it[0], b = el("button", "scap-c"); b.type = "button"; b.dataset.k = v;
        b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(v === cur));
        if (two && o.ratioIcons) { var rr = ratio(v), W = 30, H = 24, sc = Math.min((W - 1.6) / rr, H - 1.6), w = sc * rr + 1.6, h = sc + 1.6;
          b.innerHTML = '<svg viewBox="0 0 30 24" aria-hidden="true"><rect x="' + ((W - w) / 2 + .8).toFixed(1) + '" y="' + ((H - h) / 2 + .8).toFixed(1) + '" width="' + (w - 1.6).toFixed(1) + '" height="' + (h - 1.6).toFixed(1) + '" rx="1.5"/></svg><b></b>';
          b.querySelector("b").textContent = it[2] || v; b.title = it[1]; b.setAttribute("aria-label", (it[2] || v) + ": " + it[1]); }
        else if (two) { b.innerHTML = "<b></b><i></i>"; b.querySelector("b").textContent = it[2] || v; b.querySelector("i").textContent = it[1]; b.setAttribute("aria-label", (it[2] || v) + ": " + it[1]); if (i === last && items.length % 2 === 1) b.classList.add("wide"); }
        else { b.textContent = it[1]; if (it[2]) b.setAttribute("aria-label", it[2]); }
        b.disabled = lock;
        b.onclick = function () { o.set(key, v); build(); };
        box.append(b);
      });
    }
    // a slider extra: drawn once, then only its ends and value follow, so a drag is never interrupted by a rebuild
    function range(box, d, cur) {
      var inp = box.querySelector("input"), a, b;
      if (!inp) {
        a = el("span"); b = el("span"); inp = el("input"); inp.type = "range";
        inp.min = d.min != null ? d.min : 0; inp.max = d.max != null ? d.max : 1; inp.step = d.step || 0.05;
        inp.setAttribute("aria-label", d.label || d.key);
        inp.addEventListener("input", function () { var v = +inp.value; o.set(d.key, v); ends(box, d, v); });
        box.append(a, inp, b);
      }
      if (document.activeElement !== inp) inp.value = cur;
      inp.disabled = !d.live && !!(o.busy && o.busy());
      ends(box, d, +inp.value);
    }
    function ends(box, d, v) { var t = d.ends ? d.ends(v) : ["", ""], sp = box.querySelectorAll("span"); sp[0].textContent = t[0]; sp[1].textContent = t[1];
      box.querySelector("input").setAttribute("aria-valuetext", t.join(", ")); }
    function build() {
      var s = o.get();
      if (o.modes === false) modes.hidden = true; else radios(modes, o.modes || [["still", "still"], ["video", "video"]], s.mode, "mode");
      radios(shapes, o.shapes || SHAPES, s.shape, "shape", true);
      extras.forEach(function (e) { var show = !e.def.show || e.def.show(s); e.el.hidden = !show; if (!show) return;
        if (e.def.type === "range") range(e.el, e.def, s[e.def.key]); else radios(e.el, e.def.items, s[e.def.key], e.def.key); });
      dims.textContent = o.dims ? o.dims(s) : "";
      hint.textContent = o.hint ? o.hint(s) : "";
      go.textContent = typeof o.primary.label === "function" ? o.primary.label(s) : o.primary.label;
      go.disabled = !!(o.primary.disabled && o.primary.disabled(s));
      if (sec) sec.textContent = typeof o.secondary.label === "function" ? o.secondary.label(s) : o.secondary.label;
    }
    function isOpen() { return !root.hidden; }
    function open() { build(); root.hidden = false; }
    function close() { if (root.hidden) return; root.hidden = true; if (o.onClose) o.onClose(); }
    x.onclick = close;
    go.onclick = function () { o.primary.run(); };
    if (sec) sec.onclick = function () { o.secondary.run(); };
    root.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    build();
    /* FOOT: the head goes to the bottom as pop.js's band, the × becomes the vertical close */
    if (o.foot && window.SurfacePop) { x.innerHTML = ""; head.appendChild(x); SurfacePop.dress(root, { head: head, close: x, label: "Close the capture options", foot: true, toward: o.toward || null }); }
    return { el: root, build: build, open: open, close: close, isOpen: isOpen, go: go };
  }
  window.SurfaceCapture = { panel: panel, SHAPES: SHAPES };
})();
