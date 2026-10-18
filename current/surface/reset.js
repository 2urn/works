/* Surface · Reset — double-tap a control's name: its slider glides back to the default and the default
   gives a small pulse. Canon from the Instrument Builder (Dimitry, 18 Oct 2026; CONVENTIONS › Changed vs. preset).

   Plain script, window.SurfaceReset, no dependencies.

   The double-tap is detected against a timestamp, not the browser's dblclick: dblclick only pairs two clicks on the
   same element and never fires on many touch screens, and a row that redraws on the first tap would kill it.

     SurfaceReset.attach({
       name:  labelElement,             // what is double-tapped
       input: rangeInput,               // the slider that glides
       track: element,                  // positioned box around the slider, where the pulse is drawn (default: input.parentNode)
       target: () => number,            // where "default" is right now (the loaded preset's value)
       set: v => {},                    // apply a value (called every frame of the glide, and once at the end)
       done: () => {},                  // optional: once the glide has landed (e.g. fire a change event)
       ms: 240                          // glide length; 0 under reduced motion
     })
   The pulse is drawn over the slider itself wherever it sits in the track box, so the track can be a whole row.
   Call attach again with another name element (a readout, say) to give it the same double-tap.
*/
(function () {
  "use strict";
  var CSS = [
    ".sr-pulse{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;pointer-events:none;z-index:4;",
    "  box-shadow:0 0 0 1.5px var(--sr-acc,var(--sa-acc,currentColor));animation:sr-pulse .55s ease-out forwards}",
    "@keyframes sr-pulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.4);opacity:0}}",
    "@media (prefers-reduced-motion:reduce){.sr-pulse{animation-duration:.01s}}"
  ].join("\n");
  function css() {
    if (document.getElementById("sr-css")) return;
    var s = document.createElement("style"); s.id = "sr-css"; s.textContent = CSS; document.head.appendChild(s);
  }
  var TH = 7;   // half a 14px thumb: where the thumb's centre sits at a given fraction of the track
  function pulse(track, input, v) {
    var min = +input.min, max = +input.max, f = (v - min) / ((max - min) || 1);
    f = f < 0 ? 0 : f > 1 ? 1 : f;
    var p = document.createElement("span"); p.className = "sr-pulse";
    var tr = track.getBoundingClientRect(), ir = input.getBoundingClientRect();
    p.style.left = (ir.left - tr.left + TH + (ir.width - 2 * TH) * f).toFixed(1) + "px";
    p.style.top = (ir.top - tr.top + ir.height / 2).toFixed(1) + "px";
    track.appendChild(p);
    setTimeout(function () { p.remove(); }, 700);
  }
  function attach(o) {
    css();
    var track = o.track || o.input.parentNode, last = 0, raf = 0;
    if (getComputedStyle(track).position === "static") track.style.position = "relative";
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function go() {
      var to = +o.target(), from = +o.input.value, ms = reduce ? 0 : (o.ms == null ? 240 : o.ms), t0 = performance.now();
      cancelAnimationFrame(raf);
      pulse(track, o.input, to);
      if (!ms || Math.abs(to - from) < 1e-9) { o.input.value = to; o.set(to); if (o.done) o.done(); return; }
      (function step(now) {
        var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3), v = from + (to - from) * e;
        o.input.value = v; o.set(k < 1 ? v : to);
        if (k < 1) raf = requestAnimationFrame(step); else if (o.done) o.done();
      })(t0);
    }
    o.name.addEventListener("pointerup", function (e) {
      if (e.button > 0) return;
      var now = performance.now();
      if (now - last < 450) { last = 0; e.preventDefault(); go(); } else last = now;
    });
    o.name.addEventListener("dblclick", function (e) { e.preventDefault(); });   // the timestamp already handled it
    o.name.style.webkitUserSelect = o.name.style.userSelect = "none";
    o.name.style.touchAction = "manipulation";
    if (!o.name.title) o.name.title = "Double-tap to reset";
    return { reset: go };
  }
  window.SurfaceReset = { attach: attach, pulse: pulse };
})();
