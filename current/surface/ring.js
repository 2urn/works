/* Surface · Ring — a ring of round choices around a point (a pie menu), opened where the finger is.
   (Dimitry, 24 Oct 2026, 19:31: "the pie menu … is the model for something that's missing and will be needed in this app
   anyway … a ring of dots … invoked on the stage … why don't we start with a touchable pie menu"; opened by a double-tap.)

   The ring is the studio's answer to choices made on the stage itself, without reaching for the bar: what a finger does
   (Current's Touch ring, first), and later the random ring and the colour-and-sound chips. One rule for all of them:

   - It opens centred on the point, pulled in from the edges so every dot is on screen, its centre the ring's name.
   - Each dot is a round button (at least 44 px, a finger's size) with an icon; the lit one is the current choice.
   - A tap on a dot chooses and closes (unless the item says stay); a tap anywhere else, Esc, or a second open closes.
   - The arrow keys walk round the ring, Enter chooses; focus comes back to where it was. role=menu, items menuitemradio
     or menuitemcheckbox, so a screen reader hears what each is and whether it is on.
   - Everything on a ring is also somewhere else in the tool (a ring is a short way, never the only way).

   MOTION (Dimitry, 24 Oct 20:14: "pop out like a flower … start small from where you touched … two or three steps, pop
   pop pop … as the labels and icons become visible"; and on a choice "it should grow bigger … the other buttons disappear
   first and that button disappears last, it slides back into the center, and then the label"): the dots open in three
   quick pops from the point, the labels arrive with the last; a chosen dot swells, the others fold away first, it slides
   home last, then the name goes. Reduced motion: it simply appears and goes.

   SEVERAL RINGS (same note: "a grab bar on one side and a drop-down … on the other … swap between different ring menus,
   and whichever one you used last is the one that shows up the next time"): rings are defined once by id; the name in the
   middle carries a grip (drag to move the ring) and, with more than one ring, a switch that lists them. The last one
   used is remembered (per tool key) and opens next time.

     SurfaceRing.define(id, { title, items: () => [ … ] })          // items as below, built fresh each time it opens
     var R = SurfaceRing.open({ x, y,                                // client px: where it centres
       rings: ['touch', 'play'], ring: 'touch', key: 'current',      // defined rings to switch between; which; where the last is kept
       hub: 'label' | 'mark',                                        // the name as a word, or as the ring's mark (aria keeps the name)
       title, items,                                                 // or a one-off ring without define()
       onClose: (why) => {}, onSwitch: (id) => {} })
     items: [{ id, icon: '<svg…>', label: 'push', aria: 'Push: …', on: bool, kind: 'radio'|'check'|'go', stay: bool, pick: () => {} }]
     a value: { id, kind: 'value', icon, label, aria, get: () => n, set: (n) => {}, min: 0, max: 100, step: 1, fmt: n => '50%' }
       (Dimitry, 24 Oct 20:15: "where you drag and a number changes, that number could happen inside the button that you
       pressed, or it could take over the name of the ring … like a 0 to 100 slider"): drag across the dot and the number
       shows inside it; tap it and the ring's name becomes that value's slider, with a tick to come back.
     R.close() · SurfaceRing.isOpen() · SurfaceRing.close() · SurfaceRing.last(key) · SurfaceRing.MARK (the six-dot mark)
     SurfaceRing.doubleTap(el, (x, y, e) => {}, { ms: 320, px: 24, when: e => bool })   // a one-finger double-tap on el
   Plain script, window.SurfaceRing, no dependencies. Loads its own styles; a tool's rules win (:where). */
(function () {
  "use strict";
  if (window.SurfaceRing) return;
  var MARK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="4.6" r="2"/><circle cx="18.4" cy="8.3" r="2"/><circle cx="18.4" cy="15.7" r="2"/><circle cx="12" cy="19.4" r="2"/><circle cx="5.6" cy="15.7" r="2"/><circle cx="5.6" cy="8.3" r="2"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>';
  var GRIP = '<svg viewBox="0 0 12 20" aria-hidden="true" focusable="false"><circle cx="4" cy="5" r="1.3"/><circle cx="8" cy="5" r="1.3"/><circle cx="4" cy="10" r="1.3"/><circle cx="8" cy="10" r="1.3"/><circle cx="4" cy="15" r="1.3"/><circle cx="8" cy="15" r="1.3"/></svg>';
  var CARET = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 10l5 5 5-5"/></svg>';
  /* three pops: a third of the way, three quarters, home; each step overshoots a little and settles */
  var POP = "cubic-bezier(.2,1.7,.45,1)";
  var CSS =
    ":where(.sr-veil){position:fixed;inset:0;z-index:70;background:transparent}" +
    ":where(.sr-ring){position:fixed;z-index:71;width:0;height:0;pointer-events:none}" +
    ":where(.sr-hub){position:absolute;left:0;top:0;transform:translate(-50%,-50%);display:flex;align-items:center;gap:2px;padding:3px;border-radius:999px;background:rgb(var(--ui-g,12 14 16) / .86);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--ui-ink,#eef1f2);pointer-events:auto;box-shadow:0 0 0 1px rgb(var(--ui-hi,255 255 255) / .14);z-index:1;white-space:nowrap}" +
    ":where(.sr-hub) .sr-name{padding:6px 8px;font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.16em;text-transform:uppercase}" +
    ":where(.sr-hub) .sr-name svg{display:block;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6}" +
    ":where(.sr-hub) button{display:grid;place-items:center;min-width:30px;height:30px;padding:0 4px;border:0;border-radius:999px;background:none;color:inherit;cursor:pointer;touch-action:none}" +
    ":where(.sr-hub) button:hover{background:rgb(var(--ui-hi,255 255 255) / .1)}" +
    ":where(.sr-hub) .sr-grip{cursor:grab}:where(.sr-hub) .sr-grip svg{width:9px;height:16px;fill:currentColor;opacity:.7}" +
    ":where(.sr-hub) .sr-sw svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ":where(.sr-hub) button:focus-visible{outline:2px solid #fff;outline-offset:1px}" +
    ":where(.sr-list){position:absolute;left:0;top:24px;transform:translateX(-50%);display:flex;flex-direction:column;gap:4px;padding:4px;border-radius:16px;background:rgb(var(--ui-g,12 14 16) / .94);box-shadow:0 0 0 1px rgb(var(--ui-hi,255 255 255) / .14),0 10px 30px rgb(0 0 0 / .4);pointer-events:auto;z-index:2}" +
    ":where(.sr-list) button{min-height:40px;padding:0 16px;border:0;border-radius:12px;background:none;color:var(--ui-ink,#eef1f2);font:600 10.5px/1 var(--mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;text-align:left;cursor:pointer;white-space:nowrap}" +
    ":where(.sr-list) button[aria-checked=true]{background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c)}" +
    ":where(.sr-dot){position:absolute;left:0;top:0;width:var(--sr-d,52px);height:var(--sr-d,52px);margin:calc(var(--sr-d,52px) / -2) 0 0 calc(var(--sr-d,52px) / -2);padding:0;border:0;border-radius:50%;display:grid;place-items:center;background:rgb(var(--ui-g,12 14 16) / .86);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--ui-ink,#eef1f2);box-shadow:0 0 0 1px rgb(var(--ui-hi,255 255 255) / .16),0 6px 20px rgb(0 0 0 / .35);cursor:pointer;pointer-events:auto;transform:translate(var(--x),var(--y));-webkit-tap-highlight-color:transparent}" +
    ":where(.sr-dot) svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
    ":where(.sr-dot)[aria-checked=true]{background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c);box-shadow:0 0 0 2px rgb(255 255 255 / .5),0 6px 20px rgb(0 0 0 / .35)}" +
    ":where(.sr-dot):focus-visible{outline:2px solid #fff;outline-offset:3px}" +
    ":where(.sr-dot) .sr-num{font:700 13px/1 var(--mono,ui-monospace,monospace)}:where(.sr-dot.sr-busy){background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c)}" +
    ":where(.sr-hub) .sr-val{display:flex;align-items:center;gap:8px;padding:0 6px}:where(.sr-hub) .sr-val b{min-width:44px;font:700 12px/1 var(--mono,ui-monospace,monospace);text-align:right}" +
    ":where(.sr-hub) .sr-val input{width:140px;accent-color:var(--acc,#55b8c9)}" +
    ":where(.sr-lab){position:absolute;left:50%;top:calc(100% + 4px);transform:translateX(-50%);white-space:nowrap;font:600 9.5px/1 var(--mono,ui-monospace,monospace);letter-spacing:.12em;text-transform:uppercase;color:#fff;text-shadow:0 1px 3px rgb(0 0 0 / .9),0 0 8px rgb(0 0 0 / .7);pointer-events:none}" +
    /* opening: pop, pop, pop; the icon and the label arrive with the last pop */
    ".sr-ring.pop .sr-dot{animation:srPop .46s both;animation-delay:calc(var(--i) * 22ms)}" +
    ".sr-ring.pop .sr-dot svg,.sr-ring.pop .sr-lab{animation:srShow .2s ease-out both;animation-delay:calc(.26s + var(--i) * 22ms)}" +
    ".sr-ring.pop .sr-hub{animation:srHub .3s " + POP + " both}" +
    "@keyframes srPop{0%{transform:translate(0,0) scale(.15);opacity:0;animation-timing-function:" + POP + "}" +
    "33%{transform:translate(calc(var(--x) * .34),calc(var(--y) * .34)) scale(.5);opacity:1;animation-timing-function:" + POP + "}" +
    "66%{transform:translate(calc(var(--x) * .74),calc(var(--y) * .74)) scale(.8);animation-timing-function:" + POP + "}" +
    "100%{transform:translate(var(--x),var(--y)) scale(1);opacity:1}}" +
    "@keyframes srShow{from{opacity:0}to{opacity:1}}" +
    "@keyframes srHub{from{transform:translate(-50%,-50%) scale(.6);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}" +
    /* closing: the others fold home first; a chosen dot swells, then slides home; the name goes last */
    ".sr-ring .sr-dot.sr-fold{transition:transform .18s ease-in,opacity .18s ease-in;transform:translate(0,0) scale(.3);opacity:0}" +
    ".sr-ring .sr-dot.sr-chosen{z-index:1;transition:transform .2s " + POP + ";transform:translate(var(--x),var(--y)) scale(1.28)}" +
    ".sr-ring .sr-dot.sr-chosen.sr-home{transition:transform .22s cubic-bezier(.5,0,.3,1),opacity .22s ease-in .08s;transform:translate(0,0) scale(.7);opacity:0}" +
    ".sr-ring .sr-hub.sr-gone{transition:opacity .16s ease-in,transform .16s ease-in;opacity:0;transform:translate(-50%,-50%) scale(.85)}" +
    "@media (prefers-reduced-motion:reduce){.sr-ring.pop .sr-dot,.sr-ring.pop .sr-dot svg,.sr-ring.pop .sr-lab,.sr-ring.pop .sr-hub{animation:none}.sr-ring .sr-dot.sr-fold,.sr-ring .sr-dot.sr-chosen,.sr-ring .sr-hub.sr-gone{transition:none}}";
  function css() { if (document.getElementById("sring-css")) return; var st = document.createElement("style"); st.id = "sring-css"; st.textContent = CSS; (document.head || document.documentElement).prepend(st); }
  var RINGS = {}, cur = null;
  var calm = function () { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  var lastKey = function (k) { return "surface.ring.last." + (k || "tool"); };
  function last(k) { try { return localStorage.getItem(lastKey(k)) || null; } catch (e) { return null; } }
  function remember(k, id) { try { localStorage.setItem(lastKey(k), id); } catch (e) {} }
  function define(id, def) { RINGS[id] = def; }
  /* the end: what = 'pick' (a dot was chosen, the effect already done), anything else folds everything at once */
  function close(why, chosen) {
    if (!cur) return; var c = cur; cur = null;
    document.removeEventListener("keydown", c.key, true);
    try { c.veil.remove(); } catch (e) {}
    var gone = function () { try { c.ring.remove(); } catch (e) {} };
    if (calm() || why === "again" || !c.ring.isConnected) gone();
    else {
      c.ring.classList.remove("pop");
      var dots = [].slice.call(c.ring.querySelectorAll(".sr-dot")), hub = c.ring.querySelector(".sr-hub"), list = c.ring.querySelector(".sr-list");
      if (list) list.remove();
      dots.forEach(function (d) { if (d !== chosen) d.classList.add("sr-fold"); });
      if (chosen) { chosen.classList.add("sr-chosen"); setTimeout(function () { chosen.classList.add("sr-home"); }, 220); setTimeout(function () { if (hub) hub.classList.add("sr-gone"); }, 400); setTimeout(gone, 600); }
      else { if (hub) hub.classList.add("sr-gone"); setTimeout(gone, 220); }
    }
    try { if (c.back && c.back.focus && why !== "pick") c.back.focus({ preventScroll: true }); } catch (e) {}
    try { c.o.onClose && c.o.onClose(why); } catch (e) {}
  }
  function open(o) {
    css(); close("again"); o = o || {};
    var rings = (o.rings || []).filter(function (id) { return RINGS[id]; });
    var rid = o.ring && RINGS[o.ring] ? o.ring : rings.length ? (rings.indexOf(last(o.key)) >= 0 ? last(o.key) : rings[0]) : null;
    var def = rid ? RINGS[rid] : { title: o.title, items: function () { return o.items || []; } };
    var items = (typeof def.items === "function" ? def.items() : def.items || []).filter(Boolean), n = items.length; if (!n) return null;
    if (rid) remember(o.key, rid);
    var d = Math.max(44, o.dot || 52), gap = 10;
    /* the radius: the dots sit round the circle with a gap between them, room for each label, clear of the hub */
    var R = Math.max(o.r || 0, 92, (n * (d + gap + 18)) / (2 * Math.PI));
    var lab = 14, pad = R + d / 2 + lab + 8, W = innerWidth, H = innerHeight;
    var clampX = function (v) { return Math.max(pad, Math.min(W - pad, v)); }, clampY = function (v) { return Math.max(pad, Math.min(H - pad, v)); };
    var x = clampX(o.x == null ? W / 2 : o.x), y = clampY(o.y == null ? H / 2 : o.y);
    var veil = document.createElement("div"); veil.className = "sr-veil";
    var ring = document.createElement("div"); ring.className = "sr-ring" + (calm() ? "" : " pop"); ring.setAttribute("role", "menu"); ring.setAttribute("aria-label", def.title || "Choices");
    ring.style.left = x + "px"; ring.style.top = y + "px"; ring.style.setProperty("--sr-d", d + "px");
    /* the hub: grip · name · switch */
    var hub = document.createElement("div"); hub.className = "sr-hub";
    var grip = document.createElement("button"); grip.type = "button"; grip.className = "sr-grip"; grip.innerHTML = GRIP; grip.setAttribute("aria-label", "Move the ring (drag)"); grip.title = "Drag to move the ring";
    var name = document.createElement("span"); name.className = "sr-name";
    if (o.hub === "mark") { name.innerHTML = MARK; name.setAttribute("aria-label", def.title || ""); name.title = def.title || ""; } else name.textContent = def.title || "";
    hub.append(grip, name);
    if (rings.length > 1) {
      var sw = document.createElement("button"); sw.type = "button"; sw.className = "sr-sw"; sw.innerHTML = CARET; sw.setAttribute("aria-haspopup", "menu"); sw.setAttribute("aria-label", "Switch ring: " + rings.map(function (r) { return RINGS[r].title; }).join(", ")); sw.title = "Switch ring";
      sw.onclick = function (e) { e.stopPropagation(); var L = ring.querySelector(".sr-list"); if (L) { L.remove(); return; }
        L = document.createElement("div"); L.className = "sr-list"; L.setAttribute("role", "menu"); L.setAttribute("aria-label", "Rings");
        rings.forEach(function (id) { var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitemradio"); b.setAttribute("aria-checked", String(id === rid)); b.textContent = RINGS[id].title;
          b.onclick = function (ev) { ev.stopPropagation(); if (id === rid) { L.remove(); return; } var oo = Object.assign({}, o, { ring: id, x: parseFloat(ring.style.left), y: parseFloat(ring.style.top) });
            remember(o.key, id); try { o.onSwitch && o.onSwitch(id); } catch (er) {} open(oo); }; L.appendChild(b); });
        ring.appendChild(L); var f = L.querySelector("[aria-checked=true]") || L.firstChild; try { f.focus({ preventScroll: true }); } catch (er) {} };
      hub.appendChild(sw);
    }
    ring.appendChild(hub);
    /* the grip moves the whole ring, kept on screen */
    grip.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); try { grip.setPointerCapture(e.pointerId); } catch (er) {} var sx = e.clientX, sy = e.clientY, ox = parseFloat(ring.style.left), oy = parseFloat(ring.style.top);
      var mv = function (ev) { ring.style.left = clampX(ox + ev.clientX - sx) + "px"; ring.style.top = clampY(oy + ev.clientY - sy) + "px"; };
      var up = function () { grip.removeEventListener("pointermove", mv); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up); };
      grip.addEventListener("pointermove", mv); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up); });
    grip.addEventListener("keydown", function (e) { var k = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[e.key]; if (!k) return; e.preventDefault(); e.stopPropagation();
      ring.style.left = clampX(parseFloat(ring.style.left) + k[0]) + "px"; ring.style.top = clampY(parseFloat(ring.style.top) + k[1]) + "px"; });
    var dots = items.map(function (it, i) {
      var a = -Math.PI / 2 + (i / n) * Math.PI * 2, b = document.createElement("button");
      b.type = "button"; b.className = "sr-dot"; b.dataset.id = it.id || ""; b.style.setProperty("--i", String(i));
      b.setAttribute("role", it.kind === "check" ? "menuitemcheckbox" : it.kind === "go" ? "menuitem" : "menuitemradio");
      if (it.kind !== "go") b.setAttribute("aria-checked", String(!!it.on));
      b.setAttribute("aria-label", it.aria || it.label || it.id); if (it.aria) b.title = it.aria;
      b.innerHTML = (it.icon || "") + '<span class="sr-lab" aria-hidden="true"></span>'; b.querySelector(".sr-lab").textContent = it.label || "";
      b.style.setProperty("--x", (Math.cos(a) * R).toFixed(1) + "px"); b.style.setProperty("--y", (Math.sin(a) * R).toFixed(1) + "px");
      b.tabIndex = -1;
      if (it.kind === "value") { valueDot(b, it); ring.appendChild(b); return b; }
      b.addEventListener("click", function (e) { e.stopPropagation(); if (e.detail > 0 && cur && performance.now() - cur.t0 < 350) return;   /* the click that ends the opening tap lands where the dots start, in the middle: not a choice */
        var keep = !!it.stay;
        if (it.kind === "check") b.setAttribute("aria-checked", String(b.getAttribute("aria-checked") !== "true")); else if (it.kind !== "go") dots.forEach(function (x) { if (x.getAttribute("role") === "menuitemradio") x.setAttribute("aria-checked", String(x === b)); });
        try { it.pick && it.pick(); } catch (er) { console.warn("[ring]", er); }
        if (!(keep && cur)) close("pick", b); });
      ring.appendChild(b); return b;
    });
    /* a value dot: drag across it (left to right, or down to up) and its number shows inside; a tap hands the hub its slider */
    function valueDot(b, it) {
      var mn = it.min == null ? 0 : it.min, mx = it.max == null ? 100 : it.max, st = it.step || 1, fmt = it.fmt || function (v) { return String(Math.round(v)); };
      var clampV = function (v) { return Math.max(mn, Math.min(mx, Math.round(v / st) * st)); }, icon = b.innerHTML, g = null;
      b.setAttribute("role", "menuitem"); b.style.touchAction = "none"; b.setAttribute("aria-label", (it.aria || it.label || it.id) + ": " + fmt(it.get()) + ". Drag to change, or tap for a slider");
      var show = function (v) { b.innerHTML = '<span class="sr-num">' + fmt(v) + '</span><span class="sr-lab" aria-hidden="true"></span>'; b.querySelector(".sr-lab").textContent = it.label || ""; };
      b.addEventListener("pointerdown", function (e) { e.stopPropagation(); if (performance.now() - (cur ? cur.t0 : 0) < 350) return; try { b.setPointerCapture(e.pointerId); } catch (er) {} g = { x: e.clientX, y: e.clientY, v: +it.get(), moved: false }; });
      b.addEventListener("pointermove", function (e) { if (!g) return; var dd = (e.clientX - g.x) - (e.clientY - g.y); if (!g.moved && Math.abs(dd) < 6) return; g.moved = true; b.classList.add("sr-busy");
        var v = clampV(g.v + dd * (mx - mn) / 220); it.set(v); show(v); });
      var end = function () { if (!g) return; var m = g.moved; g = null; b.classList.remove("sr-busy"); if (m) { setTimeout(function () { b.innerHTML = icon; }, 700); } else slider(it, fmt, clampV); };
      b.addEventListener("pointerup", end); b.addEventListener("pointercancel", function () { g = null; b.classList.remove("sr-busy"); b.innerHTML = icon; });
      b.addEventListener("click", function (e) { e.stopPropagation(); if (e.detail === 0) slider(it, fmt, clampV); });
    }
    /* the hub becomes the value's slider; the tick (or Esc) gives the name back */
    function slider(it, fmt, clampV) {
      var nm = hub.querySelector(".sr-name"), old = hub.querySelector(".sr-val"); if (old) old.remove();
      var v = document.createElement("label"); v.className = "sr-val"; var t = document.createElement("span"); t.textContent = it.label || ""; var bb = document.createElement("b");
      var r = document.createElement("input"); r.type = "range"; r.min = it.min == null ? 0 : it.min; r.max = it.max == null ? 100 : it.max; r.step = it.step || 1; r.value = it.get(); r.setAttribute("aria-label", it.aria || it.label || "value");
      var ok = document.createElement("button"); ok.type = "button"; ok.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'; ok.setAttribute("aria-label", "Done");
      var paint = function () { bb.textContent = fmt(+r.value); }; paint();
      r.oninput = function () { it.set(clampV(+r.value)); paint(); };
      var back = function () { v.remove(); ok.remove(); nm.hidden = false; try { (dots.filter(function (x) { return x.dataset.id === (it.id || ""); })[0] || dots[0]).focus(); } catch (er) {} };
      ok.onclick = function (e) { e.stopPropagation(); back(); }; r.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); back(); } });
      v.append(t, r, bb); nm.hidden = true; nm.after(v, ok); try { r.focus(); } catch (er) {}
    }
    var stop = function (e) { e.stopPropagation(); e.preventDefault(); };
    veil.addEventListener("pointerdown", function (e) { stop(e); if (cur && performance.now() - cur.t0 < 250) return; close("outside"); });
    ["pointerup", "click", "touchstart", "touchend"].forEach(function (t) { veil.addEventListener(t, stop, { passive: false }); });
    var key = function (e) {
      if (!cur) return; var L = ring.querySelector(".sr-list"); if (L && L.contains(document.activeElement)) { if (e.key === "Escape") { stop(e); L.remove(); try { sw.focus(); } catch (er) {} } return; }
      var ae = document.activeElement; if (ae && ae.type === "range" && ring.contains(ae)) { if (e.key === "Escape") { stop(e); var okb = hub.querySelector(".sr-val + button"); if (okb) okb.click(); } return; }   // the slider keeps its arrows
      var i = dots.indexOf(document.activeElement);
      if (e.key === "Escape") { stop(e); close("esc"); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { if (document.activeElement === grip) return; stop(e); dots[(i + 1 + n) % n].focus(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { if (document.activeElement === grip) return; stop(e); dots[(i - 1 + n) % n].focus(); }
      else if (e.key === "Home") { stop(e); dots[0].focus(); } else if (e.key === "End") { stop(e); dots[n - 1].focus(); }
    };
    document.addEventListener("keydown", key, true);
    document.body.append(veil, ring);
    cur = { o: o, veil: veil, ring: ring, key: key, back: o.back || document.activeElement, t0: performance.now(), id: rid };
    requestAnimationFrame(function () { var f = dots.filter(function (b) { return b.getAttribute("aria-checked") === "true"; })[0] || dots[0]; try { f.focus({ preventScroll: true }); } catch (e) {} });
    return { close: function () { close("api"); }, el: ring, ring: rid };
  }
  /* a one-finger double-tap: two quick taps near each other, no drag between (the stage's own drag still pushes) */
  function doubleTap(el, fn, o) {
    o = o || {}; var ms = o.ms || 320, px = o.px || 24, lastT = null, down = null;
    /* times are the events' own (e.timeStamp: when the finger touched), not when a busy page got round to them */
    var ts = function (e) { return e.timeStamp || performance.now(); };
    el.addEventListener("pointerdown", function (e) { if (e.button > 0 || !e.isPrimary) { down = null; return; } down = { x: e.clientX, y: e.clientY, t: ts(e), id: e.pointerId }; }, true);
    el.addEventListener("pointerup", function (e) {
      if (!down || e.pointerId !== down.id) return; var d = down; down = null;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || ts(e) - d.t > 280) { lastT = null; return; }   // a drag or a hold is not a tap
      var now = ts(e);
      if (lastT && now - lastT.t < ms && Math.hypot(e.clientX - lastT.x, e.clientY - lastT.y) < px) { lastT = null; if (o.when && !o.when(e)) return; fn(e.clientX, e.clientY, e); return; }
      lastT = { x: e.clientX, y: e.clientY, t: now };
    }, true);
    el.addEventListener("pointercancel", function () { down = null; }, true);
  }
  window.SurfaceRing = { open: open, define: define, last: last, MARK: MARK, close: function () { close("api"); }, isOpen: function () { return !!cur; }, current: function () { return cur && cur.id; }, doubleTap: doubleTap };
})();
