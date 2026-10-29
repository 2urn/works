/* Surface · No zoom — an instrument, not a page: a double tap never zooms the screen, a long press never selects the
   interface, and a zoom that still slips in goes back by itself. Load it first, in every tool (starter.html does).

   (Dimitry, 25 Oct, iPhone: "trying to double tap the screen it triggered the zoom and I couldn't zoom out"; 27 Oct 07:57,
   iPad: "when I double tap on the screen to invoke the menu ... the screen zooms in and I lose the entire interface ...
   this is really something that should be checked at a global level ... defined high in the system so that we don't have
   to think about it in the future, and ... be aware of any changes in the accessibility functions of the browser").

   THREE LAYERS, because browsers have changed this before and will again:
   1. CSS. html{touch-action:manipulation} (pan and pinch kept, the double-tap zoom dropped; it applies to every element
      under html, since a child can only narrow what its ancestors allow), no text inflation, no selecting or callout on
      the interface (fields and anything marked [data-select] still select).
   2. THE SECOND TAP. iPad Safari has been seen zooming on a double tap even with layer 1. So the second touch of a quick
      double tap (under 350 ms, within 40 px) has its touchend cancelled, unless it lands on a control (a button, a field,
      a link, a role'd control): the browser never sees a double tap, while pointer events (a tool's own double tap, such
      as opening a ring) still arrive. Controls keep every tap (a tap-tempo button tapped fast keeps every click).
   3. THE UNDO. If the page is zoomed anyway (an older iOS, a field that zoomed to type), 0.8 s after the last finger
      lifts, and when a field is left, the viewport is told maximum-scale=1 for a moment, which brings iOS back to 1.

   WHAT IT NEVER TOUCHES: pinch zoom stays the person's (the stage decides its own two-finger gestures with
   touch-action:none), and the system's Zoom (Settings › Accessibility › Zoom, three fingers) belongs to the person and
   cannot and should not be blocked by a page.

   WATCHING FOR CHANGE: SurfaceNoZoom.state() → { scale, guarded, undone, css } for the self-test report, so a zoom that a
   new browser lets through shows up in a pasted report: scale above 1 and the count of undos.

     SurfaceNoZoom.init({ controls: 'button,…' })   (runs by itself on load; init again to widen what counts as a control)
   Plain script, window.SurfaceNoZoom, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceNoZoom) return;
  var CONTROLS = "button,input,select,textarea,a[href],label,summary,[contenteditable],[role=button],[role=slider],[role=radio],[role=checkbox],[role=switch],[role=tab],[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[data-select]";
  var S = { guarded: 0, undone: 0 };
  function css() {
    if (document.getElementById("snz-css")) return;
    var st = document.createElement("style"); st.id = "snz-css";
    st.textContent = "html{touch-action:manipulation;-webkit-text-size-adjust:100%;text-size-adjust:100%}" +
      "body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}" +
      "input,textarea,select,[contenteditable],[data-select]{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}";
    (document.head || document.documentElement).prepend(st);
  }
  /* 2. the second tap */
  var last = null;
  function onEnd(e) {
    if (e.touches && e.touches.length) return;
    var c = e.changedTouches && e.changedTouches[0]; if (!c) return;
    var now = e.timeStamp || performance.now(), t = e.target;
    var isCtl = t && t.closest && t.closest(CONTROLS);
    if (last && !isCtl && now - last.t < 350 && Math.hypot(c.clientX - last.x, c.clientY - last.y) < 40 && e.cancelable) { e.preventDefault(); S.guarded++; last = null; return; }
    last = isCtl ? null : { t: now, x: c.clientX, y: c.clientY };
  }
  /* 3. the undo */
  var vv = window.visualViewport, zt = 0, down = 0;
  function unzoom() {
    if (!vv || vv.scale <= 1.01 || down) return;
    var a = document.activeElement; if (a && a.matches && a.matches("input,select,textarea,[contenteditable]")) return;
    var m = document.querySelector("meta[name=viewport]"); if (!m) return;
    var was = m.getAttribute("content") || "width=device-width,initial-scale=1";
    m.setAttribute("content", was.replace(/,?\s*maximum-scale=[^,]*/, "") + ",maximum-scale=1"); S.undone++;
    setTimeout(function () { m.setAttribute("content", was); }, 400);
  }
  function later() { clearTimeout(zt); zt = setTimeout(unzoom, 800); }
  var on = false;
  function init(o) {
    o = o || {}; if (o.controls) CONTROLS += "," + o.controls; css();
    if (on) return api; on = true;
    addEventListener("touchend", onEnd, { passive: false, capture: true });
    addEventListener("touchstart", function (e) { down = e.touches.length; }, { passive: true, capture: true });
    addEventListener("touchend", function (e) { down = e.touches.length; if (!down && vv && vv.scale > 1.01) later(); }, { passive: true, capture: true });
    addEventListener("touchcancel", function () { down = 0; later(); }, { passive: true, capture: true });
    document.addEventListener("focusout", function (e) { if (e.target && e.target.matches && e.target.matches("input,select,textarea")) { down = 0; later(); } });
    if (vv) vv.addEventListener("resize", function () { if (vv.scale > 1.01) later(); });
    return api;
  }
  function state() {
    var ta = ""; try { ta = getComputedStyle(document.documentElement).touchAction; } catch (e) {}
    return { scale: vv ? Math.round(vv.scale * 100) / 100 : 1, guarded: S.guarded, undone: S.undone, css: ta };
  }
  var api = { init: init, state: state };
  window.SurfaceNoZoom = api;
  init();
})();
