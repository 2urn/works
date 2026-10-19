/* Surface · Pop — one chrome for every panel that opens over the stage (Dimitry, 18 Oct 2026: "let's go with the
   record version as canon for modals: rounded corners, x to close"). The capture panel (capture.js) is the canon:
   a frosted card with 18 px corners, a 40 px head with the panel's name in small mono capitals on the left, and a
   plain × on the right. This module gives any other panel the same chrome, so a tool never draws its own.

   Plain script, window.SurfacePop, no dependencies. Reads the theme tokens (CONVENTIONS › Theme tokens).

     SurfacePop.dress('#plist', { head: '.mxh', close: '#plClose', label: 'Close the preset list' })
       → the element gets the card (.spop), its head the canon head (.spop-head), and the close button becomes
         the × (.spop-x), keeping its id, its handler and an aria-label (the one given, or "Close").
     SurfacePop.css   the stylesheet, for a tool that builds its panel by hand: class="spop", "spop-head", "spop-x".

   A panel's own body keeps its own layout; only the card, the head and the × are shared. */
(function () {
  "use strict";
  if (window.SurfacePop) return;
  var X = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var CSS = [
    ".spop{border-radius:18px;overflow:hidden;background:rgb(var(--ui-g,14 14 16) / .9);border:1px solid rgb(var(--ui-hi,255 255 255) / .14);",
    "  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);color:var(--ui-ink,#fff)}",
    ".spop-head{display:flex;justify-content:space-between;align-items:center;min-height:40px;padding:0 6px 0 16px;border-bottom:1px solid rgb(var(--ui-hi,255 255 255) / .08);",
    "  font:500 10px/1 var(--sc-mono,var(--mono,ui-monospace,Menlo,monospace));letter-spacing:.18em;text-transform:uppercase;color:var(--ui-dim,#a8a8a8)}",
    ".spop-x{width:36px;height:36px;display:grid;place-items:center;padding:0;border:0;background:none;color:var(--ui-dim,#8f8f8f);cursor:pointer;font-size:0}",
    ".spop-x:hover{color:var(--ui-ink,#fff)}.spop-x:focus-visible{outline:2px solid var(--cap-acc,var(--sc-acc,#8fd3e8));outline-offset:-2px;border-radius:8px}",
    ".spop-x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}"
  ].join("\n");
  function inject() {
    if (document.getElementById("spop-css")) return;
    var st = document.createElement("style"); st.id = "spop-css"; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  function q(root, s) { return typeof s === "string" ? (root || document).querySelector(s) : s; }
  function dress(el, o) {
    o = o || {}; inject();
    el = q(document, el); if (!el) return null;
    el.classList.add("spop");
    var head = o.head ? q(el, o.head) : null; if (head) head.classList.add("spop-head");
    var x = o.close ? (q(el, o.close) || q(document, o.close)) : null;
    if (x) {
      x.classList.add("spop-x");
      if (!x.getAttribute("aria-label")) x.setAttribute("aria-label", o.label || "Close");
      x.title = x.title || "Close";
      x.innerHTML = X;
    }
    return el;
  }
  window.SurfacePop = { dress: dress, css: CSS, X: X };
})();
