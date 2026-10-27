/* Surface · Steady — what you touch never moves. A panel that scrolls keeps its place when its content is rebuilt.

   (Dimitry, 27 Oct 08:08, the Mixer: "if I select solo ... the panel vertical scroll position moves for some reason
   that has no reason to and the main problem with that is you don't realize whether or not ... you can't see the button
   that you've just pressed again ... the problem of you touch a button and then it shifts should be a very hard rule".)

   Tools redraw a list by emptying it and building it again (innerHTML = ''), and an emptied box scrolls back to the top
   before the new rows arrive. Steady remembers every scroll box's place as you scroll it, and when a box's content is
   replaced, puts it back in the same step, before the next frame is drawn: nothing visibly moves. A scroll a tool makes
   on purpose (scrollIntoView, scrollTop =) is a scroll like any other, so it is kept too.

     SurfaceSteady.init()   (runs by itself on load)     SurfaceSteady.state() → { kept }   for the self-test
   Plain script, window.SurfaceSteady, no dependencies. Load it early (surface.js imports it). */
(function () {
  "use strict";
  if (window.SurfaceSteady) return;
  var PLACE = new WeakMap(), kept = 0, on = false;
  function scroller(el) {
    for (var x = el; x && x.nodeType === 1 && x !== document.body && x !== document.documentElement; x = x.parentElement) {
      if (PLACE.has(x)) return x;
    }
    return null;
  }
  function init() {
    if (on) return api; on = true;
    /* the place, as the person scrolls (scroll events, a frame late) */
    document.addEventListener("scroll", function (e) { var t = e.target; if (t && t.nodeType === 1) PLACE.set(t, t.scrollTop); }, { capture: true, passive: true });
    /* and as a tool scrolls on purpose, in the same step (review 804b17f76b r-1: the keys sheet set scrollTop = 0 while
       rebuilding, and the frame-late event let the old place win): scrollTop =, scrollTo, scrollBy write the new place at
       once; scrollIntoView lets its boxes go, so a scroll to an item is never undone */
    try {
      var P = Element.prototype, d = Object.getOwnPropertyDescriptor(P, "scrollTop");
      if (d && d.set && d.get) Object.defineProperty(P, "scrollTop", { configurable: true, enumerable: d.enumerable, get: d.get,
        set: function (v) { d.set.call(this, v); if (PLACE.has(this) || v > 0) PLACE.set(this, d.get.call(this)); } });
      var aim = function (el, a, b, by) { var top = a && typeof a === "object" ? a.top : b; if (top == null || isNaN(top)) return; PLACE.set(el, Math.max(0, (by ? el.scrollTop : 0) + +top)); };
      ["scrollTo", "scroll"].forEach(function (k) { var f = P[k]; if (f) P[k] = function (a, b) { aim(this, a, b, false); return f.apply(this, arguments); }; });
      var fb = P.scrollBy; if (fb) P.scrollBy = function (a, b) { aim(this, a, b, true); return fb.apply(this, arguments); };
      var fi = P.scrollIntoView; if (fi) P.scrollIntoView = function () { for (var x = this.parentElement; x; x = x.parentElement) PLACE.delete(x); return fi.apply(this, arguments); };
    } catch (e) {}
    /* a rebuild: put the box back where it was, in the same microtask, before the browser paints the jump */
    new MutationObserver(function (ms) {
      var seen = [];
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i]; if (m.type !== "childList" || !m.removedNodes.length) continue;
        var box = scroller(m.target); if (!box || seen.indexOf(box) >= 0) continue; seen.push(box);
        if (!box.clientHeight) { PLACE.delete(box); continue; }   /* hidden: when it shows again, its code decides where it starts */
        var want = PLACE.get(box);
        if (want > 0 && box.scrollTop !== want) {
          var max = box.scrollHeight - box.clientHeight;
          if (max > 0) { var to = Math.min(want, max); try { box.scrollTo({ top: to, behavior: "instant" }); } catch (e) { box.scrollTop = to; } if (box.scrollTop !== to) box.scrollTop = to; kept++; }   /* instant: a box with scroll-behavior:smooth would glide down from the top, a visible jump */
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
    return api;
  }
  var api = { init: init, state: function () { return { kept: kept }; } };
  window.SurfaceSteady = api;
  if (document.documentElement) init();
})();
