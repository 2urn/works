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
    ".spop-x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}",
    /* a panel glides in when it opens (Dimitry, 19 Oct): up a little and out of transparency. translate, not transform,
       so it never fights a panel's own centring transform. Shown again after [hidden] or display:none, it plays again. */
    "@media (prefers-reduced-motion:no-preference){.spop:not([hidden]){animation:spop-in .24s cubic-bezier(.2,.8,.2,1)}}",
    "@keyframes spop-in{from{opacity:0;translate:0 12px}to{opacity:1;translate:0 0}}"
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
  /* GLIDE: folded sections open by gliding to their height instead of appearing, and the page's own scrolling panes
     scroll smoothly. SurfacePop.glide({ shut: 'cx-shut', bodies: '.cx-gbody,.cx-body', scrollers: '#panel,.track' })
     watches the whole page: when an element loses the "shut" class, its body (a direct child matching bodies) grows
     from 0 to its height and fades in. Closing stays instant. Off with prefers-reduced-motion. */
  function glide(o) {
    o = o || {}; var shut = o.shut || "cx-shut", bodies = o.bodies || ".cx-gbody,.cx-body", scr = o.scrollers || "";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (scr && !document.getElementById("spop-glide")) { var st = document.createElement("style"); st.id = "spop-glide"; st.textContent = scr + "{scroll-behavior:smooth}"; document.head.appendChild(st); }
    if (!window.MutationObserver) return;
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        var el = m.target; if (m.attributeName !== "class" || !el.classList || el.classList.contains(shut)) return;
        if (!(m.oldValue || "").split(/\s+/).includes(shut)) return;
        for (var i = 0; i < el.children.length; i++) { var b = el.children[i]; if (!b.matches || !b.matches(bodies)) continue;
          var h = b.scrollHeight; if (!h || !b.animate) continue;
          b.style.overflow = "hidden";
          var a = b.animate([{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }], { duration: Math.min(420, 180 + h * .25), easing: "cubic-bezier(.2,.8,.2,1)" });
          a.onfinish = a.oncancel = (function (x) { return function () { x.style.overflow = ""; }; })(b); }
      });
    }).observe(document.body, { attributes: true, attributeOldValue: true, subtree: true, attributeFilter: ["class"] });
  }
  window.SurfacePop = { dress: dress, css: CSS, X: X, glide: glide };
})();
