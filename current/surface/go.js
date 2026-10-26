/* Surface · Go — "go to where it's made": a dot on a control's top-right corner with a quarter arc outside it
   (Dimitry, 25 Oct 2026: "the gear is too much ... a lighter icon ... make it universal. Like a top right corner dot
   with ¼ circle outside of it in top right quadrant"). It replaces the gear Current's Auto play tiles wore (22 Oct).

   The mark is its own button, a sibling of the control in a wrapper (a button cannot hold a button), absolutely over
   the corner: it never changes the control's size and a tap on it never presses the control. The top-right corner is
   the mark's; a Pro padlock beside it moves to the top left (Dimitry, 25 Oct).

     const w = SurfaceGo.wrap(control, {
       label: 'Open the Beats panel',   // the mark's aria-label and title (required)
       go: () => openBeats(),           // where it goes
       swipe: true,                     // touch: a swipe left from the control's top-right quarter goes too (it claims
                                        // sideways drags on the control: pass false in a row that scrolls sideways)
       cls: 'apTW', markCls: 'apGear'   // extra classes for the wrapper and the mark (a tool's own selectors)
     });
     parent.appendChild(w);             // the wrapper takes the control's place
     SurfaceGo.ICON                     // the mark's SVG, for a menu or a guide

   Wake: with a mouse, the arc ripples out of the dot while the pointer is on it; a swipe grows the arc with the finger,
   so the finger sees what it is about to open. Reduced motion: the arc brightens, nothing moves.
   Plain script, window.SurfaceGo, no dependencies. Default looks at zero specificity (:where): the tool's rules win.
   Colour is currentColor at 60%, full on hover, focus and swipe; set --sgo-in to move the dot inside the corner,
   and --sgo-ring to a background colour to ring the dot where it sits half on a lit control. */
(function () {
  "use strict";
  if (window.SurfaceGo) return;
  /* 24-unit grid, dot centred so the button's centre is the corner point; the arc is the dot's top-right quadrant */
  var ICON = '<svg class="sgo-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="sgo-a" d="M12 5.4A6.6 6.6 0 0 1 18.6 12"/><circle class="sgo-d" cx="12" cy="12" r="2.1"/></svg>';
  var CSS =
    ":where(.sgo-w){position:relative}" +
    ":where(.sgo){position:absolute;top:calc(-12px + var(--sgo-in,4px));right:calc(-12px + var(--sgo-in,4px));z-index:2;width:24px;height:24px;margin:0;padding:0;border:0;border-radius:50%;background:transparent;color:inherit;opacity:.6;display:grid;place-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:opacity .2s}" +
    ":where(.sgo) svg{display:block;width:24px;height:24px;overflow:visible;pointer-events:none}" +
    ":where(.sgo) .sgo-d{fill:currentColor;stroke:var(--sgo-ring,transparent);stroke-width:2.6;paint-order:stroke}" +
    ":where(.sgo) .sgo-a{fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;transform-origin:12px 12px;transition:transform .32s cubic-bezier(.2,.7,.2,1)}" +
    ":where(.sgo):hover,:where(.sgo):focus-visible,:where(.sgo-w.sgo-swipe) :where(.sgo){opacity:1}" +
    ":where(.sgo):focus-visible{outline:2px solid currentColor;outline-offset:-2px}" +
    "@media (hover:hover){:where(.sgo):hover .sgo-a,:where(.sgo):focus-visible .sgo-a{animation:sgoWake 1.4s cubic-bezier(.2,.7,.2,1) infinite}}" +
    "@keyframes sgoWake{0%{transform:scale(1);opacity:1}60%{transform:scale(1.55);opacity:0}61%{transform:scale(.7);opacity:0}100%{transform:scale(1);opacity:1}}" +
    ":where(.sgo-w.sgo-swipe) .sgo-a{transition:none;transform:scale(calc(1 + var(--sw,0) * .9))}" +
    ":where(.sgo-w.sgo-sw){touch-action:pan-y}" +   /* from the first touch: browsers read touch-action at pointerdown (review, 25 Oct) */
    "@media (prefers-reduced-motion:reduce){:where(.sgo) .sgo-a{animation:none!important;transition:none}:where(.sgo-w.sgo-swipe) .sgo-a{transform:none}}";
  function css() {
    if (document.getElementById("sgo-css")) return;
    var s = document.createElement("style"); s.id = "sgo-css"; s.textContent = CSS;
    (document.head || document.documentElement).insertBefore(s, (document.head || document.documentElement).firstChild);
  }
  function wrap(control, o) {
    o = o || {};
    if (!o.label) throw new Error("SurfaceGo.wrap: a label is required");
    css();
    var w = document.createElement(o.tag || "div");
    w.className = "sgo-w" + (o.cls ? " " + o.cls : "");
    if (control) w.appendChild(control);
    var b = document.createElement("button");
    b.type = "button"; b.className = "sgo" + (o.markCls ? " " + o.markCls : "");
    b.innerHTML = ICON; b.setAttribute("aria-label", o.label); b.title = o.label;
    b.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    b.onclick = function (e) { e.stopPropagation(); e.preventDefault(); if (o.go) o.go(); };
    w.appendChild(b);
    if (o.swipe !== false) { w.classList.add("sgo-sw"); swipe(w, o); }   /* swipe:false where the row must scroll sideways */
    return w;
  }
  /* a swipe left from the top-right quarter: 36 px of travel, mostly sideways (the gear's gesture, 24 Oct, moved to the
     mark's corner). The click that ends a swipe is eaten, so the control under it is not pressed */
  function swipe(w, o) {
    var sw = null, eat = 0;
    w.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      var r = w.getBoundingClientRect();
      if (e.clientX < r.right - Math.min(48, r.width * .4) || e.clientY > r.top + Math.min(30, r.height * .55)) return;
      sw = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false, t: 0 };
    }, true);
    w.addEventListener("pointermove", function (e) {
      if (!sw || e.pointerId !== sw.id) return;
      var dx = sw.x - e.clientX, dy = Math.abs(e.clientY - sw.y);
      if (!sw.on) {
        if (dy > 14 && dy > dx) { sw = null; return; }
        if (dx > 8) { sw.on = true; w.classList.add("sgo-swipe"); try { w.setPointerCapture(e.pointerId); } catch (_) {} }
      }
      if (sw && sw.on) { sw.t = Math.max(0, Math.min(1, dx / 36)); w.style.setProperty("--sw", sw.t.toFixed(3)); }
    }, true);
    function end(e) {
      if (!sw || e.pointerId !== sw.id) return;
      var go = sw.on && sw.t >= 1;
      if (sw.on) eat = performance.now() + 500;
      sw = null; w.classList.remove("sgo-swipe"); w.style.removeProperty("--sw");
      if (go) { if (navigator.vibrate) navigator.vibrate(8); if (o.go) o.go(); }
    }
    w.addEventListener("pointerup", end, true);
    w.addEventListener("pointercancel", end, true);
    w.addEventListener("click", function (e) { if (performance.now() < eat) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  window.SurfaceGo = { ICON: ICON, wrap: wrap, css: css };
})();
