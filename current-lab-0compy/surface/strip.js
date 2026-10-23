/* Surface · Strip: a row of small screens, one per scene (Dimitry, 21 Oct 2026, Current: "the robot's shelf = the
   scenes, as small TV-shaped thumbnails ... the playing scene highlighted ... mark which scene is next").

   - Each item is a small 16:9 screen with no name under it. Names run long, so a name is the title and the
     aria-label only.
   - The playing one is outlined in the accent and filled with it lightly.
   - The next one, when the tool knows it (a robot that picks ahead, in shuffle too), wears a dashed accent outline and
     a small notch on top.
   - A tap plays that item at once: the tool decides what else follows (Current: the robot keeps running, its timer
     restarts from there).
   - One row, scrolling sideways with snap. The playing item is kept in view, and the strip never scrolls the page.

     SurfaceStrip.make({
       ids:    () => [id...],              // what is in the strip, in order
       label:  id => 'name',               // for the title and the aria-label
       draw:   (screenEl, id) => {},       // paint the thumbnail (a background image is fine); called lazily
       current:() => id,                   // the one playing
       next:   () => id | null,            // the one that plays next, or null
       pick:   id => {},                   // a tap
       remove: id => {},                   // optional: a long press or right-click on an item (Delete when it has focus)
       name:   'Scenes'                    // the list's accessible name
     }) -> { el, sync(), rebuild() }

   Plain script, window.SurfaceStrip. Default look at zero specificity: the tool's rules win. Sizes are fixed in px at
   every width (Surface rule: more room shows more of the row, never wider items). */
(function () {
  "use strict";
  if (window.SurfaceStrip) return;
  var CSS =
    ":where(.s-strip){display:flex;align-items:center;gap:8px;flex:none}" +
    ":where(.s-strip-i){position:relative;flex:none;width:68px;height:40px;padding:0;margin:0;border-radius:7px;cursor:pointer;scroll-snap-align:start;" +
    "border:1.5px solid rgb(var(--ui-hi,255 255 255) / .16);background:#0c0e11 center/contain no-repeat;-webkit-tap-highlight-color:transparent}" +
    ":where(.s-strip-i[aria-current=true]){border-color:var(--acc,#55b8c9);box-shadow:0 0 0 1.5px var(--acc,#55b8c9),inset 0 0 0 40px rgb(var(--acc-rgb,85 184 201) / .16)}" +
    ":where(.s-strip-i.next){border-style:dashed;border-color:var(--acc,#55b8c9)}" +
    ":where(.s-strip-i.next)::after{content:'';position:absolute;left:50%;top:-6px;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:var(--acc,#55b8c9);box-shadow:0 0 0 2px rgb(var(--ui-g,10 10 12))}" +
    ":where(.s-strip-i:focus-visible){outline:2px solid var(--acc,#55b8c9);outline-offset:2px}";
  function css() { if (document.getElementById("s-strip-css")) return; var s = document.createElement("style"); s.id = "s-strip-css"; s.textContent = CSS; (document.head || document.documentElement).prepend(s); }
  function make(o) {
    css();
    var el = document.createElement("div"); el.className = "s-strip"; el.setAttribute("role", "list"); el.setAttribute("aria-label", o.name || "Scenes");
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); try { o.draw(e.target, e.target._id); } catch (_) {} } });
    }, { rootMargin: "0px 160px" }) : null;
    var last = null;
    function rebuild() {
      el.innerHTML = ""; last = null;
      (o.ids() || []).forEach(function (id) {
        var b = document.createElement("button"); b.type = "button"; b.className = "s-strip-i"; b.setAttribute("role", "listitem"); b._id = id; b.dataset.id = String(id);
        var n = String(o.label(id) || ""); b.title = n; b.setAttribute("aria-label", "Play " + n);
        b.onclick = function () { if (b.__held) { b.__held = false; return; } o.pick(id); sync(); };
        if (o.remove) {
          var t = 0; b.addEventListener("pointerdown", function (e) { if (e.button > 0) return; b.__held = false; t = setTimeout(function () { b.__held = true; if (navigator.vibrate) navigator.vibrate(10); o.remove(id); }, (window.SurfaceKeys && SurfaceKeys.holdMs) || 520); });
          ["pointerup", "pointercancel", "pointerleave"].forEach(function (k) { b.addEventListener(k, function () { clearTimeout(t); }); });
          b.addEventListener("contextmenu", function (e) { e.preventDefault(); clearTimeout(t); o.remove(id); });
          b.addEventListener("keydown", function (e) { if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); o.remove(id); } });
          b.title = n + " (hold to remove)";
        }
        el.appendChild(b); if (io) io.observe(b); else { try { o.draw(b, id); } catch (_) {} }
      });
      sync();
    }
    function sync() {
      var cur = o.current(), nx = o.next ? o.next() : null;
      for (var i = 0; i < el.children.length; i++) {
        var b = el.children[i], on = b._id === cur, isN = nx != null && b._id === nx && !on;
        b.setAttribute("aria-current", on ? "true" : "false"); b.classList.toggle("next", isN);
        b.setAttribute("aria-label", (on ? "Playing: " : isN ? "Next: " : "Play ") + b.title);
        if (on && last !== cur && keep(b)) last = cur;
      }
    }
    /* keep the playing one in view, moving only the strip's own scroller, never the page */
    function keep(b) {
      var sc = b.parentNode; while (sc && sc !== document.body && !(sc.scrollWidth > sc.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowX))) sc = sc.parentNode;
      if (!sc || sc === document.body) return false;
      var r = b.getBoundingClientRect(), s = sc.getBoundingClientRect();
      if (r.left < s.left + 12 || r.right > s.right - 12) sc.scrollTo({ left: sc.scrollLeft + (r.left + r.width / 2) - (s.left + s.width / 2), behavior: "smooth" });
      return true;
    }
    rebuild();
    return { el: el, sync: sync, rebuild: rebuild };
  }
  window.SurfaceStrip = { make: make };
})();
