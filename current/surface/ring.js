/* Surface · Ring — a ring of round choices around a point (a pie menu), opened where the finger is.
   (Dimitry, 24 Oct 2026, 19:31: "the pie menu … is the model for something that's missing and will be needed in this app
   anyway … a ring of dots … invoked on the stage … why don't we start with a touchable pie menu"; opened by a double-tap.)

   The ring is the studio's answer to choices made on the stage itself, without reaching for the bar: what a finger does
   (Current's Touch ring, first), and later the random ring and the colour-and-sound chips. One rule for all of them:

   - It opens centred on the point, pulled in from the edges so every dot is on screen, its centre a small label.
   - Each dot is a round button (at least 44 px, a finger's size) with an icon; the lit one is the current choice.
   - A tap on a dot chooses and closes (unless the item says stay); a tap anywhere else, Esc, or a second double-tap closes.
   - The arrow keys walk round the ring, Enter chooses; focus comes back to where it was. role=menu, items menuitemradio
     or menuitemcheckbox, so a screen reader hears what each is and whether it is on.
   - It grows out from the point (reduced motion: it simply appears).

     var R = SurfaceRing.open({ x, y,                       // client px: where it centres
       title: 'Touch',                                      // the word in the middle (and the menu's name)
       items: [{ id, icon: '<svg…>', label: 'push', aria: 'Push: …', on: bool, kind: 'radio'|'check'|'go', stay: bool,
                 pick: () => {} }],
       onClose: () => {} })
     R.close() · SurfaceRing.isOpen() · SurfaceRing.close()
     SurfaceRing.doubleTap(el, (x, y, e) => {}, { ms: 320, px: 24, when: e => bool })   // a one-finger double-tap on el
   Plain script, window.SurfaceRing, no dependencies. Loads its own styles; a tool's rules win (:where). */
(function () {
  "use strict";
  if (window.SurfaceRing) return;
  var CSS =
    ":where(.sr-veil){position:fixed;inset:0;z-index:70;background:transparent}" +
    ":where(.sr-ring){position:fixed;z-index:71;width:0;height:0;pointer-events:none}" +
    ":where(.sr-hub){position:absolute;left:0;top:0;transform:translate(-50%,-50%);min-width:64px;padding:7px 10px;border-radius:999px;background:rgb(var(--ui-g,12 14 16) / .82);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--ui-ink,#eef1f2);font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.16em;text-transform:uppercase;text-align:center;pointer-events:none;box-shadow:0 0 0 1px rgb(var(--ui-hi,255 255 255) / .12)}" +
    ":where(.sr-dot){position:absolute;left:0;top:0;width:var(--sr-d,52px);height:var(--sr-d,52px);margin:calc(var(--sr-d,52px) / -2) 0 0 calc(var(--sr-d,52px) / -2);padding:0;border:0;border-radius:50%;display:grid;place-items:center;background:rgb(var(--ui-g,12 14 16) / .86);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--ui-ink,#eef1f2);box-shadow:0 0 0 1px rgb(var(--ui-hi,255 255 255) / .16),0 6px 20px rgb(0 0 0 / .35);cursor:pointer;pointer-events:auto;transform:translate(var(--x),var(--y));transition:transform .26s cubic-bezier(.2,1.3,.4,1),opacity .2s ease;-webkit-tap-highlight-color:transparent}" +
    ":where(.sr-ring:not(.in)) .sr-dot{transform:translate(0,0) scale(.4);opacity:0}" +
    ":where(.sr-dot) svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
    ":where(.sr-dot)[aria-checked=true]{background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c);box-shadow:0 0 0 2px rgb(255 255 255 / .5),0 6px 20px rgb(0 0 0 / .35)}" +
    ":where(.sr-dot):focus-visible{outline:2px solid #fff;outline-offset:3px}" +
    ":where(.sr-lab){position:absolute;left:50%;top:calc(100% + 4px);transform:translateX(-50%);white-space:nowrap;font:600 9.5px/1 var(--mono,ui-monospace,monospace);letter-spacing:.12em;text-transform:uppercase;color:#fff;text-shadow:0 1px 3px rgb(0 0 0 / .9),0 0 8px rgb(0 0 0 / .7);pointer-events:none}" +
    "@media (prefers-reduced-motion:reduce){:where(.sr-dot){transition:none}}";
  function css() { if (document.getElementById("sring-css")) return; var st = document.createElement("style"); st.id = "sring-css"; st.textContent = CSS; (document.head || document.documentElement).prepend(st); }
  var cur = null;
  function close(why) {
    if (!cur) return; var c = cur; cur = null;
    try { c.veil.remove(); c.ring.remove(); } catch (e) {}
    document.removeEventListener("keydown", c.key, true);
    try { if (c.back && c.back.focus && why !== "pick") c.back.focus({ preventScroll: true }); } catch (e) {}
    try { c.o.onClose && c.o.onClose(why); } catch (e) {}
  }
  function open(o) {
    css(); close("again"); o = o || {};
    var items = (o.items || []).filter(Boolean), n = items.length; if (!n) return null;
    var d = Math.max(44, o.dot || 52), gap = 10;
    /* the radius: the dots sit round the circle with a gap between them, never closer than the hub needs */
    var R = Math.max(o.r || 0, 88, (n * (d + gap + 18)) / (2 * Math.PI));   // room for each dot's label, clear of the hub
    var lab = 14, pad = R + d / 2 + lab + 8, W = innerWidth, H = innerHeight;
    var x = Math.max(pad, Math.min(W - pad, o.x == null ? W / 2 : o.x)), y = Math.max(pad, Math.min(H - pad, o.y == null ? H / 2 : o.y));
    var veil = document.createElement("div"); veil.className = "sr-veil";
    var ring = document.createElement("div"); ring.className = "sr-ring"; ring.setAttribute("role", "menu"); ring.setAttribute("aria-label", o.title || "Choices");
    ring.style.left = x + "px"; ring.style.top = y + "px"; ring.style.setProperty("--sr-d", d + "px");
    if (o.title) { var hub = document.createElement("div"); hub.className = "sr-hub"; hub.textContent = o.title; hub.setAttribute("aria-hidden", "true"); ring.appendChild(hub); }
    var dots = items.map(function (it, i) {
      var a = -Math.PI / 2 + (i / n) * Math.PI * 2, b = document.createElement("button");
      b.type = "button"; b.className = "sr-dot"; b.dataset.id = it.id || "";
      b.setAttribute("role", it.kind === "check" ? "menuitemcheckbox" : it.kind === "go" ? "menuitem" : "menuitemradio");
      if (it.kind !== "go") b.setAttribute("aria-checked", String(!!it.on));
      b.setAttribute("aria-label", it.aria || it.label || it.id); if (it.aria) b.title = it.aria;
      b.innerHTML = (it.icon || "") + '<span class="sr-lab" aria-hidden="true"></span>'; b.querySelector(".sr-lab").textContent = it.label || "";
      b.style.setProperty("--x", (Math.cos(a) * R).toFixed(1) + "px"); b.style.setProperty("--y", (Math.sin(a) * R).toFixed(1) + "px");
      b.tabIndex = -1;
      b.addEventListener("click", function (e) { e.stopPropagation(); if (e.detail > 0 && cur && performance.now() - cur.t0 < 350) return;   /* the click that ends the opening tap lands where the dots start, in the middle: not a choice */
        var keep = !!it.stay; try { it.pick && it.pick(); } catch (er) { console.warn("[ring]", er); }
        if (keep && cur) { if (it.kind === "check") b.setAttribute("aria-checked", String(b.getAttribute("aria-checked") !== "true")); else if (it.kind !== "go") dots.forEach(function (x) { if (x.getAttribute("role") === "menuitemradio") x.setAttribute("aria-checked", String(x === b)); }); }
        else close("pick"); });
      ring.appendChild(b); return b;
    });
    var stop = function (e) { e.stopPropagation(); e.preventDefault(); };
    veil.addEventListener("pointerdown", function (e) { stop(e); if (cur && performance.now() - cur.t0 < 250) return; close("outside"); });
    ["pointerup", "click", "touchstart", "touchend"].forEach(function (t) { veil.addEventListener(t, stop, { passive: false }); });
    var key = function (e) {
      if (!cur) return; var i = dots.indexOf(document.activeElement);
      if (e.key === "Escape") { stop(e); close("esc"); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { stop(e); dots[(i + 1 + n) % n].focus(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { stop(e); dots[(i - 1 + n) % n].focus(); }
      else if (e.key === "Home") { stop(e); dots[0].focus(); } else if (e.key === "End") { stop(e); dots[n - 1].focus(); }
      else if (e.key === "Tab") { stop(e); dots[((i < 0 ? 0 : i) + (e.shiftKey ? -1 : 1) + n) % n].focus(); }
    };
    document.addEventListener("keydown", key, true);
    document.body.append(veil, ring);
    cur = { o: o, veil: veil, ring: ring, key: key, back: document.activeElement, t0: performance.now() };
    requestAnimationFrame(function () { ring.classList.add("in"); var f = dots.filter(function (b) { return b.getAttribute("aria-checked") === "true"; })[0] || dots[0]; try { f.focus({ preventScroll: true }); } catch (e) {} });
    return { close: function () { close("api"); }, el: ring };
  }
  /* a one-finger double-tap: two quick taps near each other, no drag between (the stage's own drag still pushes) */
  function doubleTap(el, fn, o) {
    o = o || {}; var ms = o.ms || 320, px = o.px || 24, last = null, down = null;
    el.addEventListener("pointerdown", function (e) { if (e.button > 0 || !e.isPrimary) { down = null; return; } down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; }, true);
    el.addEventListener("pointerup", function (e) {
      if (!down || e.pointerId !== down.id) return; var d = down; down = null;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || performance.now() - d.t > 280) { last = null; return; }   // a drag or a hold is not a tap
      var now = performance.now();
      if (last && now - last.t < ms && Math.hypot(e.clientX - last.x, e.clientY - last.y) < px) { last = null; if (o.when && !o.when(e)) return; fn(e.clientX, e.clientY, e); return; }
      last = { x: e.clientX, y: e.clientY, t: now };
    }, true);
    el.addEventListener("pointercancel", function () { down = null; }, true);
  }
  window.SurfaceRing = { open: open, close: function () { close("api"); }, isOpen: function () { return !!cur; }, doubleTap: doubleTap };
})();
