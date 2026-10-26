/* Surface · Pop — one chrome for every panel that opens over the stage (Dimitry, 18 Oct 2026: "let's go with the
   record version as canon for modals: rounded corners, x to close"). The capture panel (capture.js) is the canon:
   a frosted card with 18 px corners, a 40 px head with the panel's name in small mono capitals on the left, and a
   plain × on the right. This module gives any other panel the same chrome, so a tool never draws its own.

   Plain script, window.SurfacePop, no dependencies. Reads the theme tokens (CONVENTIONS › Theme tokens).

     SurfacePop.dress('#plist', { head: '.mxh', close: '#plClose', label: 'Close the preset list' })
       → the element gets the card (.spop), its head the canon head (.spop-head), and the close button becomes
         the × (.spop-x), keeping its id, its handler and an aria-label (the one given, or "Close").
     SurfacePop.css   the stylesheet, for a tool that builds its panel by hand: class="spop", "spop-head", "spop-x".

   A panel's own body keeps its own layout; only the card, the head and the × are shared.

   FOOT (Dimitry, 21 Oct 2026, Current 0.28.3: "tabs at the bottom ... nearest the thumb and the bar"):
     SurfacePop.dress('#plist', { head: '.mxh', close: '#plClose', foot: true, toward: '#pAuto' })
   - the head becomes a band along the panel's lower edge (.spop-foot): tabs, title and close sit by the thumb;
   - the close is the bottom shelf's tall tab, CLOSE turned 90 degrees (vertical-rl, reading top to bottom, C at the top, low by its ⌄; shared with the shelf as .s-vclose)
     with a ⌄, the whole band's height its target; Esc stays the tool's;
   - the panel opens rising from its button and closes sliding down toward it (translate and opacity, 240 ms,
     ease-out in, ease-in out; a fade only under reduced motion). 'toward' is the bar button it belongs to;
   - a downward swipe on the band closes it (a click on the close, so the tool's own close runs).

   PIN (Dimitry, 24 Oct 2026, Current 0.30.6: "add a pin to this area so that when we want to keep a modal up for a
   while, we can pin it ... the pin is there to hold the position"). { foot: true, pin: true } puts a pin in the band's
   end group, left of ‹ › and Close. Pressed, the panel carries .spop-pinned and SurfacePop.pinned(el) is true: the tool
   asks that before an outside tap closes it, so the stage can be played with the panel up. Close still closes; the pin
   is remembered per panel id on this device (localStorage "surface.pin.<id>") and fires "spop-pin" on the panel. */
(function () {
  "use strict";
  if (window.SurfacePop) return;
  var X = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var CSS = [
    /* one corner for every pane over the stage: drawers, the bottom shelf, panels (Dimitry, 21 Oct night) */
    ":where(:root){--s-pane-radius:20px;--s-tile-w:64px;--s-tile-h:56px;--s-bead:40px;--s-seg-h:36px}",
    ":where(:root[data-sdial]){--s-tile-w:calc(64px * var(--s-ku,1));--s-tile-h:calc(56px * var(--s-ku,1));--s-bead:calc(40px * var(--s-ku,1));--s-seg-h:calc(36px * var(--s-ku,1))}",   /* the size dial (size.js) when the tool opts in */   /* the kit's sizes (CONVENTIONS › Sizes) */
    ".spop{border-radius:var(--s-pane-radius,20px);overflow:hidden;background:rgb(var(--ui-g,14 14 16) / .9);border:1px solid rgb(var(--ui-hi,255 255 255) / .14);",
    "  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);color:var(--ui-ink,#fff)}",
    ".spop-head{display:flex;justify-content:space-between;align-items:center;min-height:40px;padding:0 6px 0 16px;border-bottom:1px solid rgb(var(--ui-hi,255 255 255) / .08);",
    "  font:500 10px/1 var(--sc-mono,var(--mono,ui-monospace,Menlo,monospace));letter-spacing:.18em;text-transform:uppercase;color:var(--ui-dim,#a8a8a8)}",
    ".spop-x{width:36px;height:36px;display:grid;place-items:center;padding:0;border:0;background:none;color:var(--ui-dim,#8f8f8f);cursor:pointer;font-size:0}",
    ".spop-x:hover{color:var(--ui-ink,#fff)}.spop-x:focus-visible{outline:2px solid var(--cap-acc,var(--sc-acc,#8fd3e8));outline-offset:-2px;border-radius:8px}",
    ".spop-x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round}",
    /* a panel glides in when it opens (Dimitry, 19 Oct): up a little and out of transparency. translate, not transform,
       so it never fights a panel's own centring transform. Shown again after [hidden] or display:none, it plays again. */
    /* 0.6 s (Dimitry, 19 Oct: \"0.2 s is instantaneous for a human\"). 0.17.13: in and out with CSS transitions (display and @starting-style), only opacity and translate, which the
       compositor runs off the main thread, so a busy stage cannot make them stutter; where a browser lacks
       transition-behavior it simply shows and hides as before */
    "@media (prefers-reduced-motion:no-preference){.spop,.scap{transition:opacity .55s ease,translate .6s cubic-bezier(.2,.8,.2,1),display .6s allow-discrete,overlay .6s allow-discrete}",
    ".spop[hidden],.scap[hidden]{opacity:0;translate:0 16px}",
    "@starting-style{.spop:not([hidden]),.scap:not([hidden]){opacity:0;translate:0 16px}}}",
    /* FOOT: the band at the bottom, the tall close, the slide to and from the button */
    /* the band is the frame's last row, pinned to its bottom, always (Dimitry, 23 Oct 00:26: Random's band sat mid-frame
       with ~290 px of nothing under it). overflow:hidden still lets focus() and scrollIntoView() scroll the frame itself
       when anything inside reaches past it; clip cannot be scrolled at all. Only the panel's own body scrolls. */
    ".spop.spop-foot{display:flex;flex-direction:column;overflow:clip}.spop-foot>.spop-head{margin-top:auto}",   /* a frame taller than its content (a step's height glide) still ends in its band */
    ".spop-foot>.spop-head{order:99;border-bottom:0;border-top:1px solid rgb(var(--ui-hi,255 255 255) / .08);min-height:44px;padding-right:0;align-items:stretch}.spop-foot>.spop-head>*:not(.spop-vx):not(.s-snav-band){align-self:center}",
    ".spop-foot>.sfTabCap{order:98}.spop-foot>.sfTabCap:not([hidden]){display:none}",   /* in a band the icons stay icons; the name is the tab's label and title */
    ".spop-foot .sfTab{border-bottom:0;border-top:2px solid transparent;margin:-1px 0 0;min-height:44px}.spop-foot .sfTab[aria-selected=true]{border-top-color:var(--acc,#55b8c9)}",
    /* THE VERTICAL CLOSE, one component for panels and the bottom shelf (Dimitry, 21 Oct night: "face down" like the
       shelf's): CLOSE set vertically reading top to bottom (C at the top), low, by its ⌄; the whole height the target.
       Class .s-vclose (or .spop-vx, which dress() gives a panel's close). */
    ".spop-head .spop-vx,.spop-vx,.s-vclose{align-self:stretch;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;width:36px;min-height:44px;padding:0 0 4px;margin:0;border:0;",
    "  border-left:1px solid rgb(var(--ui-hi,255 255 255) / .1);border-radius:0;background:none;color:var(--ui-dim,#8f8f8f);cursor:pointer;box-sizing:border-box}",
    ".spop-vx:hover,.s-vclose:hover{color:var(--ui-ink,#fff)}.spop-vx:focus-visible,.s-vclose:focus-visible{outline:2px solid var(--acc,#55b8c9);outline-offset:-2px}",
    ".spop-head .spop-vx span,.spop-vx span,.s-vclose span{writing-mode:vertical-rl;transform:none;font:600 7.5px/1 var(--mono,ui-monospace,monospace);letter-spacing:.08em;text-transform:uppercase}",
    ".spop-vx svg,.s-vclose svg{flex:none;width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    /* in a panel's band the word goes (Dimitry, 21 Oct 22:42: "CLOSE is unnecessary"): the ⌄ alone, centred, the word kept
       for screen readers; the bottom shelf's .s-vclose keeps its word */
    ".spop-head .spop-vx{justify-content:center;padding:0}.spop-head .spop-vx span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.spop-head .spop-vx svg{width:16px;height:16px}",
    "@media (prefers-reduced-motion:no-preference){.spop.spop-foot{transition:opacity .24s ease-out,translate .24s cubic-bezier(.2,.7,.2,1),display .24s allow-discrete,overlay .24s allow-discrete}",
    ".spop.spop-foot[hidden]{opacity:0;translate:var(--spop-dx,0px) var(--spop-dy,40px);transition-timing-function:ease-in,cubic-bezier(.4,0,.8,.4)}",
    "@starting-style{.spop.spop-foot:not([hidden]){opacity:0;translate:var(--spop-dx,0px) var(--spop-dy,40px)}}}",
    "@media (prefers-reduced-motion:reduce){.spop.spop-foot{transition:opacity .15s,display .15s allow-discrete}.spop.spop-foot[hidden]{opacity:0}}",
    /* THE BAND'S END (Dimitry, 22 Oct 22:52): ‹ | › | ⌄ are one fixed group pinned to the lower right, the same size and
       place in every panel; whatever sits before them (tabs, a title) takes the rest of the band and gives way first */
    ".spop-foot>.spop-head{justify-content:flex-start}",
    ".spop-foot>.spop-head>.spop-end{display:flex;flex:none;align-self:stretch;margin-left:auto;gap:0;padding:0}",
    ".spop-foot>.spop-head>:not(.spop-end){min-width:0;flex:0 1 auto}",
    /* a button that belongs at the right end of the band (an (i), Dimitry 22 Oct 23:54) wears .spop-right: it sits just
       left of ‹ › ⌄, so titles and tabs never push it */
    ".spop-foot>.spop-head>.spop-right{margin-left:auto;flex:none}.spop-foot>.spop-head>.spop-right:not([hidden])~.spop-end{margin-left:0}",
    /* (Dimitry, 25 Oct 23:02, the Pack panel: pin ‹ › ⌄ sat by the tab, not in the corner) a HIDDEN right-hand button must not take the
       group's push: only a shown one sits between the tabs and the end */
    ".spop-foot>.spop-head>.spop-end>.s-snav-band,.spop-foot>.spop-head>.spop-end>.spop-vx{margin:0;flex:none}",
    /* the pin: a band cell like ‹ ›; pressed, a filled pin in the accent and a lit top edge, so a pinned panel reads at a glance */
    ".spop-pin{align-self:stretch;flex:none;width:38px;min-height:44px;padding:0;margin:0;border:0;border-left:1px solid rgb(var(--ui-hi,255 255 255) / .1);background:none;color:var(--ui-dim,#8f8f8f);cursor:pointer;display:grid;place-items:center;-webkit-tap-highlight-color:transparent}",
    ".spop-pin:hover{color:var(--ui-ink,#fff)}.spop-pin:focus-visible{outline:2px solid var(--acc,#55b8c9);outline-offset:-2px}",
    ".spop-pin svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;transition:rotate .2s ease}",
    ".spop-pin[aria-pressed=true]{color:var(--acc-tx,var(--acc,#55b8c9));box-shadow:inset 0 2px 0 var(--acc,#55b8c9)}.spop-pin[aria-pressed=true] svg{fill:currentColor;rotate:0deg}.spop-pin[aria-pressed=false] svg{rotate:35deg}",
    /* SPAN (22 Oct): a panel is exactly the bar's width, from its first button's left edge to its last one's right */
    ".spop.spop-span{left:var(--span-l,12px)!important;right:auto!important;width:var(--span-w,calc(100vw - 24px))!important;max-width:none!important;min-width:0!important;transform:none!important;box-sizing:border-box;container-type:inline-size}"
  ].join("\n");
  var V = '<span>Close</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg>';
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
      x.innerHTML = o.foot ? V : X;
      if (o.foot) { x.classList.remove("spop-x"); x.classList.add("spop-vx"); }
    }
    if (o.foot) foot(el, head, x, o);
    return el;
  }
  function foot(el, head, x, o) {
    el.classList.add("spop-foot");
    /* where overflow:clip is missing (older engines), a frame that was scrolled anyway goes straight back */
    el.addEventListener("scroll", function () { if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } });
    /* the close sits in the band's end group (.spop-end); sheetnav.js puts ‹ › in front of it, in the same group */
    if (head && x && head.contains(x) && !(x.parentNode && x.parentNode.classList && x.parentNode.classList.contains("spop-end"))) {
      var end = document.createElement("div"); end.className = "spop-end"; head.appendChild(end); end.appendChild(x);
    }
    if (o.pin && head && x && x.parentNode && x.parentNode.classList.contains("spop-end")) pinIn(el, x.parentNode, o);
    /* where to slide: from the panel's bottom middle to its button's middle, measured each time it opens */
    var aim = function () {
      var b = o.toward ? q(document, o.toward) : null; if (!b || !b.offsetWidth) { el.style.removeProperty("--spop-dx"); el.style.removeProperty("--spop-dy"); return; }
      var r = el.getBoundingClientRect(), t = b.getBoundingClientRect();
      var dy = Math.max(16, Math.min(160, t.top + t.height / 2 - r.bottom)), dx = Math.max(-120, Math.min(120, (t.left + t.width / 2) - (r.left + r.width / 2)));
      el.style.setProperty("--spop-dx", Math.round(dx * .5) + "px"); el.style.setProperty("--spop-dy", Math.round(dy) + "px");
    };
    try { new MutationObserver(function () { if (!el.hidden) requestAnimationFrame(aim); }).observe(el, { attributes: true, attributeFilter: ["hidden"] }); } catch (e) {}
    addEventListener("resize", function () { if (!el.hidden) aim(); });
    /* swipe down on the band: close */
    if (head && x) {
      var s0 = null;
      head.addEventListener("touchstart", function (e) { if (e.touches.length !== 1) { s0 = null; return; } var t = e.touches[0]; s0 = { x: t.clientX, y: t.clientY, t: performance.now() }; }, { passive: true });
      head.addEventListener("touchend", function (e) { if (!s0) return; var t = e.changedTouches[0], dx = t.clientX - s0.x, dy = t.clientY - s0.y; var ok = dy > 40 && Math.abs(dx) < dy * .7 && performance.now() - s0.t < 700; s0 = null; if (ok) x.click(); }, { passive: true });
      head.addEventListener("touchcancel", function () { s0 = null; }, { passive: true });
    }
  }
  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 3.5h6M10 3.5v6.2L6.8 13.5h10.4L14 9.7V3.5M12 13.5v7"/></svg>';
  function pinKey(el) { return el.id ? "surface.pin." + el.id : null; }
  function pinned(el) { el = q(document, el); return !!(el && el.classList.contains("spop-pinned")); }
  function pinIn(el, end, o) {
    if (end.querySelector(".spop-pin")) return;
    var b = document.createElement("button"); b.type = "button"; b.className = "spop-pin"; b.innerHTML = PIN; b.setAttribute("data-noswipe", "");
    var k = pinKey(el), on = false; try { on = !!k && localStorage.getItem(k) === "1"; } catch (e) {}
    var set = function (v, quiet) {
      on = !!v; el.classList.toggle("spop-pinned", on); b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", on ? "Pinned: this panel stays open while you play. Tap to unpin" : "Pin this panel: it stays open while you play on the stage");
      b.title = on ? "Pinned" : "Pin";
      if (!quiet) { try { if (k) localStorage.setItem(k, on ? "1" : "0"); } catch (e) {} try { el.dispatchEvent(new CustomEvent("spop-pin", { detail: { pinned: on } })); } catch (e) {} }
    };
    b.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    b.onclick = function (e) { e.stopPropagation(); set(!on); };
    set(on, true); end.insertBefore(b, end.firstChild);
  }
  /* GLIDE: folded sections fade and settle as they open and close, and the page's own scrolling panes scroll
     smoothly. SurfacePop.glide({ shut: 'cx-shut', bodies: '.cx-gbody,.cx-body', scrollers: '#panel,.track' }).
     CSS only (transitions on opacity, translate and display). Off with prefers-reduced-motion. */
  function glide(o) {
    o = o || {}; var shut = o.shut || "cx-shut", bodies = (o.bodies || ".cx-gbody,.cx-body").split(","), scr = o.scrollers || "";
    if (document.getElementById("spop-glide")) return;
    var b = bodies.map(function (x) { return "." + shut + ">" + x.trim(); }).join(","), open = bodies.map(function (x) { return ":not(." + shut + ")>" + x.trim(); }).join(",");
    var all = bodies.map(function (x) { return x.trim(); }).join(",");
    /* 0.17.13 (Dimitry: "the glide open is very, very rough"): the height animation laid the page out every frame while
       the stage was drawing. Now a section's body fades and settles (opacity and translate only), in and out. */
    var css = "@media (prefers-reduced-motion:no-preference){" + (scr ? scr + "{scroll-behavior:smooth}" : "") +
      all + "{transition:opacity .55s ease,translate .6s cubic-bezier(.2,.8,.2,1),display .6s allow-discrete}" +
      b + "{opacity:0;translate:0 -10px}" + "@starting-style{" + open + "{opacity:0;translate:0 -10px}}}";
    var st = document.createElement("style"); st.id = "spop-glide"; st.textContent = css; document.head.appendChild(st);
  }
  /* SPAN (Dimitry, 22 Oct 22:52: "panels span the bar"): every panel above the bar is exactly the bar's width, its left
     edge at the bar's first button, its right at the last (buttons placed absolutely in a corner, like full screen, are
     not the row). Measured live and followed through resize, a hand swap or full screen (ResizeObserver on the bar and
     its buttons). Never wider than the window less 8 px each side.
       SurfacePop.span({ bar: '#playbar', panels: ['#plist', '#mixPop', …] })   → { measure() }
     Sets --span-l, --span-w (and --span-r) on the root; panels get .spop-span. Top drawers are not panels: they keep
     hugging their content. Inside, a panel lays out by container queries (.spop-span is an inline-size container). */
  function span(o) {
    o = o || {}; inject();
    var bar = q(document, o.bar || "#playbar"), root = document.documentElement, last = "";
    (o.panels || []).forEach(function (p) { var el = q(document, p); if (el) el.classList.add("spop-span"); });
    function measure() {
      if (!bar) return;
      var kids = [].slice.call(bar.children).filter(function (c) { if (!c.offsetWidth || c.hidden) return false; var ps = getComputedStyle(c).position; return ps !== "absolute" && ps !== "fixed"; });
      if (!kids.length) return;
      var l = Infinity, r = -Infinity;
      kids.forEach(function (c) { var b = c.getBoundingClientRect(); if (b.left < l) l = b.left; if (b.right > r) r = b.right; });
      l = Math.max(8, Math.round(l)); r = Math.min(innerWidth - 8, Math.round(r));
      var key = l + "," + r; if (key === last) return; last = key;
      root.style.setProperty("--span-l", l + "px"); root.style.setProperty("--span-w", (r - l) + "px"); root.style.setProperty("--span-r", (innerWidth - r) + "px");
    }
    measure();
    try { var ro = new ResizeObserver(function () { measure(); }); ro.observe(bar); [].slice.call(bar.children).forEach(function (c) { ro.observe(c); }); } catch (e) {}
    try { new MutationObserver(function () { requestAnimationFrame(measure); }).observe(bar, { attributes: true, subtree: true, childList: true, attributeFilter: ["hidden", "class", "style"] }); } catch (e) {}
    addEventListener("resize", function () { last = ""; measure(); });
    document.addEventListener("fullscreenchange", function () { last = ""; setTimeout(measure, 120); });
    return { measure: function () { last = ""; measure(); } };
  }
  window.SurfacePop = { dress: dress, css: CSS, X: X, V: V, glide: glide, span: span, pinned: pinned };
})();
