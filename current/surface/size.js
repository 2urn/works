/* Surface · Size — one dial for the size of every control (Dimitry, 24 Oct 2026: the same screen in the Claude app
   and in Chrome showed the interface at different sizes; "how can we measure and adapt for consistency across
   browsers and os and devices?").

   WHAT A PAGE CAN KNOW. The window in CSS pixels (exact), the visible part of it (visualViewport: pinch zoom, the
   phone's keyboard), the pixel ratio (Retina, the OS's display scaling and the browser's zoom, all mixed into one
   number), finger or mouse (pointer and hover). It can never know the screen's size in inches. So the dial keeps
   proportions and comfort, not physical size, and the person's own Size setting covers what no measurement can
   (zoom, a projector across a room, eyesight).

   THE DIAL. One length, --s-ctl: the size of a round bar button. It follows the window's short side with limits:
     ctl = clamp(min, min(vw × width, vh × height), max) × the Size setting
   with min 36, vw 0.104, vh 0.065, max 72 by default (a phone keeps the width rule it had; a short, wide window gets
   a smaller bar and the field more room; a big monitor a bigger one, up to 72). With a finger the result never goes
   under `finger` (default 40) unless the row would not fit. --s-k is the same as a factor of the reference size
   (54 px, the bar button Current had), so any length can follow: calc(12px * var(--s-k)). --s-ku is the factor for
   everything that is not the bar (tiles, beads, pills): the same on big windows, never below the Size setting, so a
   phone's narrow bar does not shrink its shelves.
   `fit`: a selector (the bar). When that row is wider than the window minus `margin` on each side, the dial steps
   down until it fits: a control is never cut by the window's edge.

   THE SETTING. Small, Medium, Large (0.85, 1, 1.2), remembered on this device (localStorage surface.size), shown as
   html[data-size=s|m|l]. SurfaceSize.row(label) gives a ready row for a tool's Settings.

   OPT IN. Nothing changes until a tool calls SurfaceSize.init(): then --s-ctl and --s-k are set on <html> and
   html[data-sdial] lets surface.css (and pop.js) derive the kit's sizes from them (tiles, beads, pills). A tool that
   never calls it keeps the fixed sizes it was made with.

     SurfaceSize.init({ fit: '#playbar', margin: 8, min: 36, max: 72, vw: .104, vh: .065, finger: 40, ref: 54 })
     SurfaceSize.set('l')  get() → 's'|'m'|'l'  ctl() → px  k() → factor  measure() → the display report (below)
     document 'surface:size' event, detail {ctl, k, size}

   measure() is what the self-test report prints under Display, so a report pasted from any device says what that
   device saw: window, visible area, pixel ratio, finger or mouse, a guess at the browser's zoom (desktop only:
   outerWidth / innerWidth, rough and wrong inside embeds), the dial and the setting.

   Plain script, window.SurfaceSize, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceSize) return;
  var KEY = "surface.size", SCALE = { s: 0.85, m: 1, l: 1.2 };
  var O = null, cur = 1, raf = 0, last = 0;
  function load() { try { var v = localStorage.getItem(KEY); return SCALE[v] ? v : "m"; } catch (e) { return "m"; } }
  var size = load();
  function root() { return document.documentElement; }
  function coarse() { try { return matchMedia("(pointer:coarse)").matches; } catch (e) { return false; } }
  function win() { var vv = window.visualViewport; return { w: innerWidth, h: innerHeight, vw: vv ? vv.width : innerWidth, vh: vv ? vv.height : innerHeight }; }
  function want() {
    var o = O, d = win(), base = Math.max(o.min, Math.min(o.vw * d.w, o.vh * d.h, o.max));
    if (coarse()) base = Math.max(base, Math.min(o.finger, o.vw * d.w));   // a finger's floor, unless the width rule says the row cannot take it
    return base * SCALE[size];
  }
  function apply(px) {
    cur = Math.round(px * 10) / 10;
    var r = root(); r.style.setProperty("--s-ctl", cur + "px"); r.style.setProperty("--s-k", String(Math.round(cur / O.ref * 1000) / 1000));
    /* --s-ku: the factor for everything else (tiles, beads, pills, icon words). It follows the dial up on big windows
       but never below the Size setting itself, so a phone's narrow bar does not shrink its shelves */
    r.style.setProperty("--s-ku", String(Math.round(Math.max(cur / O.ref, SCALE[size]) * 1000) / 1000));
    r.setAttribute("data-size", size);
  }
  function fit() {
    if (!O.fit) return;
    var row = document.querySelector(O.fit); if (!row) return;
    var kids = [].slice.call(row.children).filter(function (e) { var r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).position !== "absolute" && getComputedStyle(e).position !== "fixed"; });
    if (!kids.length) return;
    var L = Infinity, R = -Infinity; kids.forEach(function (e) { var r = e.getBoundingClientRect(); L = Math.min(L, r.left); R = Math.max(R, r.right); });
    var room = innerWidth - 2 * O.margin, w = R - L;
    if (w > room + 0.5 && cur > 24) apply(Math.max(24, cur * room / w - 0.5));
  }
  function update() {
    raf = 0; if (!O) return;
    apply(want());
    requestAnimationFrame(function () { fit(); var k = cur / O.ref; if (Math.abs(cur - last) > 0.05) { last = cur; try { document.dispatchEvent(new CustomEvent("surface:size", { detail: { ctl: cur, k: k, size: size } })); } catch (e) {} } });
  }
  function soon() { if (!raf) raf = requestAnimationFrame(update); }
  function init(o) {
    o = o || {};
    O = { fit: o.fit || null, margin: o.margin == null ? 8 : o.margin, min: o.min || 36, max: o.max || 72, vw: o.vw || 0.104, vh: o.vh || 0.065, finger: o.finger || 40, ref: o.ref || 54 };
    root().setAttribute("data-sdial", "");
    update();
    addEventListener("resize", soon); addEventListener("orientationchange", soon); addEventListener("load", soon);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", soon);
    if (window.visualViewport) visualViewport.addEventListener("resize", soon);
    try { matchMedia("(pointer:coarse)").addEventListener("change", soon); } catch (e) {}
    addEventListener("storage", function (e) { if (e.key === KEY) { size = load(); update(); } });
    return api;
  }
  function set(v) { if (!SCALE[v]) return; size = v; try { localStorage.setItem(KEY, v); } catch (e) {} update(); }
  function zoomGuess() {
    if (coarse()) return null;
    try { if (window.top !== window.self) return null; } catch (e) { return null; }
    var z = outerWidth / innerWidth; return z > 0.3 && z < 5 ? Math.round(z * 100) : null;
  }
  function measure() {
    var d = win(), vv = window.visualViewport;
    return {
      window: d.w + "×" + d.h, visible: Math.round(d.vw) + "×" + Math.round(d.vh) + (vv && vv.scale && vv.scale !== 1 ? " at " + vv.scale.toFixed(2) + "×" : ""),
      screen: screen.width + "×" + screen.height, ratio: Math.round(devicePixelRatio * 100) / 100,
      input: coarse() ? "finger" : "mouse", hover: (function () { try { return matchMedia("(hover:hover)").matches; } catch (e) { return null; } })(),
      zoom: zoomGuess(), embedded: (function () { try { return window.top !== window.self; } catch (e) { return true; } })(),
      ctl: O ? cur : null, k: O ? Math.round(cur / O.ref * 1000) / 1000 : null, size: size
    };
  }
  function line() {
    var m = measure();
    return "window " + m.window + " · visible " + m.visible + " · screen " + m.screen + " · pixel ratio " + m.ratio + " · " + m.input +
      (m.zoom ? " · zoom ≈ " + m.zoom + "%" : "") + (m.embedded ? " · embedded" : "") + (m.ctl ? " · controls " + m.ctl + " px (×" + m.k + ")" : "") + " · size " + { s: "Small", m: "Medium", l: "Large" }[m.size];
  }
  /* a ready Settings row: Size  S  M  L, as a radio group */
  function row(label) {
    var wrap = document.createElement("div"); wrap.className = "ssz"; wrap.setAttribute("role", "radiogroup"); wrap.setAttribute("aria-label", label || "Size of the controls");
    [["s", "S", "Small"], ["m", "M", "Medium"], ["l", "L", "Large"]].forEach(function (x) {
      var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "radio"); b.textContent = x[1]; b.title = x[2]; b.setAttribute("aria-label", x[2] + " controls");
      b.dataset.v = x[0]; b.onclick = function () { set(x[0]); sync(); }; wrap.appendChild(b);
    });
    function sync() { [].forEach.call(wrap.children, function (b) { b.setAttribute("aria-checked", String(b.dataset.v === size)); }); }
    sync(); document.addEventListener("surface:size", sync);
    return wrap;
  }
  var api = { init: init, set: set, get: function () { return size; }, ctl: function () { return cur; }, k: function () { return O ? cur / O.ref : 1; }, measure: measure, line: line, row: row };
  window.SurfaceSize = api;
})();
