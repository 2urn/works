/* Surface · Sheet nav — move between tabs and between sheets without going back to the bar (Dimitry, 20 Oct 2026:
   "once you've opened a modal, if you swiped left or right on a modal with tabs you would be switching from one tab to
   another ... maybe arrows on either side of the modal that would allow you to explicitly switch". His choice: swipe
   for tabs, arrows for sheets).

   1. SWIPE CHANGES TABS. A sideways swipe on a tabbed sheet goes to the next or previous tab; at the first or last tab
      the sheet bounces and stays. It only counts when it starts on something that has no sideways meaning of its own:
      not a slider, a text field, a drag handle, a canvas, a row that scrolls sideways, or anything marked
      [data-noswipe]. Touch only: a mouse drag selects text as it always did. A swipe never leaves the sheet.
   2. ARROWS GO TO THE NEXT SHEET. While a sheet of the ring is open, a slim arrow tab waits on each side, in the gap
      between the sheet and the screen edge, never on the sheet (Dimitry, 20 Oct: the round arrows "covering some of the
      content ... maybe it's just an arrow and when you touch it, that's when the icon comes forward"). Pressing it (or
      hovering, or keyboard focus) brings the neighbour's icon forward; letting go closes this sheet and opens that one,
      in the bar's order, round and round. Its touch area reaches a little into the sheet's own padding, not its
      content. [ and ] do the same from the keyboard (not while typing).

     SurfaceSheetNav.swipe(sheetEl, tabsApi)          tabsApi from SurfaceTabs.mount (needs .step)
     SurfaceSheetNav.ring([{ id, el, name, icon, isOpen(), open(), close() } …], {keys, band})   in the bar's order → {go(±1)}
       band: true puts ‹ › in each sheet's foot band (pop.js foot), left of its close, instead of beside the sheet
       ringIcon: '<svg…>' with band: a ring button between ‹ and › on every sheet whose item has ring(rect) (the tool opens
       its ring for that sheet; rect is the sheet's box, so a small screen can fold the sheet into its ring and a big one
       open the ring beside it). Dimitry, 26-27 Oct: "a dedicated Ring menu icon … in the tab strip", "between the left
       and right arrows" 
       keys:false when the tool registers [ and ] as named actions with keys.js (it should): they then call go(±1)
   Plain script, window.SurfaceSheetNav. Default looks at zero specificity. */
(function () {
  "use strict";
  if (window.SurfaceSheetNav) return;
  /* the button is the touch area (24 x 56, transparent); .s-snav-pill is the arrow you see, .s-snav-peek the neighbour's icon that
     comes forward on press, hover or focus, toward the sheet */
  var CSS =
    ":where(.s-snav){position:fixed;z-index:60;width:24px;height:56px;margin:-28px 0 0 -12px;border:0;background:none;padding:0;cursor:pointer;" +
    "color:#eef1f2;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:opacity .18s}" +
    ":where(.s-snav)[hidden]{display:none}" +
    ":where(.s-snav) .s-snav-pill{position:absolute;left:50%;top:50%;width:var(--snav-w,12px);height:40px;margin:-20px 0 0 calc(var(--snav-w,12px) / -2);" +
    "box-sizing:border-box;border-radius:99px;border:1px solid rgb(255 255 255 / .2);background:rgb(18 22 24 / .72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);" +
    "box-shadow:0 2px 8px rgb(0 0 0 / .3);display:grid;place-items:center;transition:background .15s,transform .15s}" +
    ":where(.s-snav) svg{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round}" +
    ":where(.s-snav) .ch{width:8px;height:8px;stroke-width:2.4}" +
    ":where(.s-snav) .s-snav-peek{position:absolute;top:50%;width:38px;height:38px;margin-top:-19px;border-radius:50%;border:1px solid rgb(255 255 255 / .22);" +
    "background:rgb(18 22 24 / .88);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 4px 14px rgb(0 0 0 / .4);" +
    "display:grid;place-items:center;opacity:0;transform:scale(.4);pointer-events:none;transition:opacity .14s,transform .18s cubic-bezier(.2,.8,.2,1)}" +
    ":where(.s-snav) .s-snav-peek svg{width:17px;height:17px;stroke-width:1.8}" +
    ":where(.s-snav.prev) .s-snav-peek{left:calc(50% + var(--snav-w,12px) / 2 + 6px);transform-origin:0 50%}" +
    ":where(.s-snav.next) .s-snav-peek{right:calc(50% + var(--snav-w,12px) / 2 + 6px);transform-origin:100% 50%}" +
    ":where(.s-snav.s-snav-on) .s-snav-peek{opacity:1;transform:none}:where(.s-snav.s-snav-on) .s-snav-pill{background:rgb(40 46 50 / .9)}" +
    "@media (hover:hover){:where(.s-snav):hover .s-snav-peek{opacity:1;transform:none}}" +
    ":where(.s-snav):focus-visible{outline:none}:where(.s-snav):focus-visible .s-snav-peek{opacity:1;transform:none;outline:2px solid var(--acc,#55b8c9);outline-offset:2px}" +
    "@keyframes sSnavIn{from{opacity:.2;translate:var(--snav-from,24px) 0}to{opacity:1;translate:0 0}}" +
    "@keyframes sSnavBump{0%,100%{translate:0 0}35%{translate:var(--snav-bump,10px) 0}}" +
    ":where(.s-snav-in){animation:sSnavIn .22s cubic-bezier(.2,.8,.2,1)}:where(.s-snav-bump){animation:sSnavBump .26s ease-out}" +
    "@media (prefers-reduced-motion:reduce){:where(.s-snav-in),:where(.s-snav-bump){animation:none}:where(.s-snav) .s-snav-peek{transition:opacity .14s}}";
  var BAND_CSS = ".spop.spop-now{transition:none!important}" +   /* a step between panels: no rise, no slide down (go) */
    ":where(.s-snav-band){align-self:stretch;flex:none;width:38px;min-height:44px;padding:0;margin:0;border:0;border-left:1px solid rgb(var(--ui-hi,255 255 255) / .1);background:none;color:var(--ui-dim,#8f8f8f);cursor:pointer;display:grid;place-items:center}" +
    ":where(.s-snav-band):hover{color:var(--ui-ink,#fff)}:where(.s-snav-band):focus-visible{outline:2px solid var(--acc,#55b8c9);outline-offset:-2px}" +
    ":where(.s-snav-band) svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}:where(.s-snav-band.ring) svg{width:20px;height:20px}";
  function css() { if (!document.getElementById("snav-band-css")) { var t = document.createElement("style"); t.id = "snav-band-css"; t.textContent = BAND_CSS; (document.head || document.documentElement).prepend(t); }
    if (document.getElementById("snav-css")) return; var s = document.createElement("style"); s.id = "snav-css"; s.textContent = CSS; (document.head || document.documentElement).prepend(s); }
  function play(el, cls, v, name) { if (!el) return; el.classList.remove(cls); el.style.setProperty(name, v); void el.offsetWidth; el.classList.add(cls); setTimeout(function () { el.classList.remove(cls); }, 300); }
  function sideways(t, stop) {
    for (var n = t; n && n !== stop && n.nodeType === 1; n = n.parentElement) {
      if (n.matches("input,select,textarea,canvas,[contenteditable],[role=slider],[data-noswipe],[draggable=true],.hd,.rmGrip,.s-grip")) return true;
      var cs = getComputedStyle(n); if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && n.scrollWidth > n.clientWidth + 2) return true;
    }
    return false;
  }
  function swipe(sheet, T) {
    css(); if (!sheet || !T || !T.step) return;
    /* touch events, not pointer events: once the finger moves the browser takes the touch for scrolling and cancels the
       pointer, but touchend still comes */
    var s0 = null;
    sheet.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) { s0 = null; return; }
      var t = e.touches[0]; s0 = sideways(e.target, sheet) ? null : { x: t.clientX, y: t.clientY, t: performance.now() };
    }, { passive: true, capture: true });
    sheet.addEventListener("touchend", function (e) {
      if (!s0) return; var t = e.changedTouches[0], dx = t.clientX - s0.x, dy = t.clientY - s0.y, dt = performance.now() - s0.t; s0 = null;
      if (Math.abs(dx) < 56 || Math.abs(dy) > Math.abs(dx) * 0.6 || dt > 700) return;
      var d = dx < 0 ? 1 : -1;   // finger to the left: the next tab, as a page turns
      sheet.__snavEat = performance.now();
      if (T.step(d)) { var tab = T.list && T.list.querySelector("[aria-selected=true]"), pane = tab && document.getElementById(tab.getAttribute("aria-controls")); play(pane, "s-snav-in", (d > 0 ? 28 : -28) + "px", "--snav-from"); }
      else play(sheet, "s-snav-bump", (d > 0 ? -10 : 10) + "px", "--snav-bump");
    }, { passive: true, capture: true });
    sheet.addEventListener("touchcancel", function () { s0 = null; }, { passive: true, capture: true });
    /* a swipe that changed tab must not also click what it started on */
    sheet.addEventListener("click", function (e) { if (sheet.__snavEat && performance.now() - sheet.__snavEat < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  function ring(items, o) {
    o = o || {};
    css(); items = (items || []).filter(function (x) { return x && x.el; });
    if (items.length < 2) return null;
    var prev = document.createElement("button"), next = document.createElement("button");
    [prev, next].forEach(function (b, k) { b.type = "button"; b.className = "s-snav " + (k ? "next" : "prev"); b.hidden = true; b.setAttribute("data-noswipe", ""); document.body.appendChild(b); });
    var cur = -1, raf = 0, held = -1, heldAt = 0;
    /* IN THE BAND (Dimitry, 21 Oct night: no arrows on the panel's sides; ‹ | › | CLOSE along its bottom band): with
       o.band, a sheet whose foot band (pop.js foot: .spop-foot > .spop-head) exists gets the two steps there, just left of
       its close, and the side arrows stay hidden for it. A sheet without a band keeps the side arrows. */
    var bandBtns = [];
    if (o.band) items.forEach(function (it) {
      var head = it.el.querySelector(".spop-foot > .spop-head, .spop-head"); if (!head || !it.el.classList.contains("spop-foot")) return;
      var x = head.querySelector(".spop-vx, .s-vclose");
      [-1, 0, 1].forEach(function (d) {
        if (d === 0) {   /* the ring, between the arrows: same size as they are, so nothing in the band moves from sheet to sheet */
          if (!o.ringIcon || typeof it.ring !== "function") return;
          var g = document.createElement("button"); g.type = "button"; g.className = "s-snav-band ring"; g.setAttribute("data-noswipe", "");
          g.innerHTML = o.ringIcon; g.title = "Open the ring for " + it.name; g.setAttribute("aria-label", "Open the ring for " + it.name);
          g.addEventListener("click", function (e) { e.stopPropagation(); try { it.ring(it.el.getBoundingClientRect()); } catch (er) { console.warn("[sheetnav] ring", er); } });
          (x ? x.parentNode : head).insertBefore(g, x || null); return;
        }
        var b = document.createElement("button"); b.type = "button"; b.className = "s-snav-band " + (d < 0 ? "prev" : "next"); b.setAttribute("data-noswipe", "");
        b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + (d < 0 ? "M14.5 6.5 9 12l5.5 5.5" : "M9.5 6.5 15 12l-5.5 5.5") + '"/></svg>';
        b.addEventListener("pointerdown", function (e) { held = openIdx(); heldAt = performance.now(); e.stopPropagation(); }, true);
        b.addEventListener("click", function (e) { e.stopPropagation(); go(d); });
        (x ? x.parentNode : head).insertBefore(b, x || null); b.__it = it; b.__d = d; bandBtns.push(b);
      });
      it.__band = true;
    });
    function bandLabels() { var n = items.length; bandBtns.forEach(function (b) { var i = items.indexOf(b.__it), t = items[(i + b.__d + n) % n]; var s = (b.__d < 0 ? "Previous: " : "Next: ") + t.name; if (b.title !== s) { b.title = s; b.setAttribute("aria-label", s); } }); }
    bandLabels();
    function openIdx() { for (var i = 0; i < items.length; i++) { try { if (items[i].isOpen()) return i; } catch (e) {} } return -1; }
    function chev(d) { return '<svg class="ch" viewBox="0 0 10 10" aria-hidden="true"><path d="' + (d < 0 ? "M6.5 1.5 3 5l3.5 3.5" : "M3.5 1.5 7 5 3.5 8.5") + '"/></svg>'; }
    function label(b, it, d) { b.innerHTML = '<span class="s-snav-pill">' + chev(d) + '</span><span class="s-snav-peek">' + (it.icon || "") + "</span>"; var t = (d < 0 ? "Previous: " : "Next: ") + it.name; b.setAttribute("aria-label", t + " ([ or ])".replace(d < 0 ? " or ]" : "[ or ", "")); b.title = t; }
    /* the arrow sits in the gap between the sheet and the screen edge: 10 px clear of the sheet when there is room, centred
       in the gap (and slimmer) when the gap is narrow, as on a phone; never over the sheet */
    function gutter(b, gap, d, y) {
      var w = gap >= 14 ? 12 : Math.max(6, gap - 3), c = gap >= 26 ? gap - 10 - w / 2 : Math.max(w / 2 + 1, gap / 2);
      b.style.setProperty("--snav-w", w + "px"); b.style.top = y + "px";
      b.style.left = (d < 0 ? c : innerWidth - c) + "px";
    }
    function place() {
      if (held >= 0 && performance.now() - heldAt < 1500) { raf = requestAnimationFrame(place); return; }   // mid-press: stay put, or the click would land on nothing
      cur = openIdx(); var on = cur >= 0 && !items[cur].__band;
      prev.hidden = next.hidden = !on;
      if (on) {
        var it = items[cur], r = it.el.getBoundingClientRect(), y = r.top + Math.min(r.height / 2, 220), n = items.length;
        if (!r.width) { prev.hidden = next.hidden = true; }
        else {
          gutter(prev, r.left, -1, y); gutter(next, innerWidth - r.right, 1, y);
          var a = items[(cur - 1 + n) % n], b = items[(cur + 1) % n], now = performance.now();
          if (prev.__for !== a.id && !(prev.__keep > now)) { label(prev, a, -1); prev.__for = a.id; }
          if (next.__for !== b.id && !(next.__keep > now)) { label(next, b, 1); next.__for = b.id; }
        }
      }
      raf = requestAnimationFrame(place);
    }
    raf = requestAnimationFrame(place);
    /* the sheets close on a press outside them, in the capture phase on the document. A press on the arrow is taken first, on
       the window, and goes no further: the sheet stays open while the neighbour's icon shows, and the arrow's own click
       then moves on. Which sheet was open is noted too, in case a tool closes on something else. */
    addEventListener("pointerdown", function (e) {
      var b = e.target && e.target.closest && e.target.closest(".s-snav"); if (!b) return;
      held = openIdx(); heldAt = performance.now(); b.classList.add("s-snav-on"); e.stopPropagation();
    }, true);
    /* STEPPING KEEPS THE FRAME (Dimitry, 23 Oct 00:20): between two band panels (pop.js foot, spanning the bar, anchored
       above it) the frame stays where it is, same left, same width, same bottom; the band never moves. The old panel goes
       at once (no slide down to its button: that is only for a real close), the new one comes at once (no rise), its
       frame's height glides from the old height to its own (growing or shrinking upward, the bottom fixed), and only its
       interior slides in: from the left for ‹, from the right for ›, 220 ms, transform and opacity. Reduced motion: the
       interior crossfades and the height is set at once. */
    function stepIn(el, h0, d) {
      var reduce = false; try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
      var h1 = el.getBoundingClientRect().height, E = "cubic-bezier(.2,.8,.2,1)", T = 220;
      if (!el.animate) return;
      if (!reduce && Math.abs(h1 - h0) > 1) el.animate([{ height: h0 + "px" }, { height: h1 + "px" }], { duration: T, easing: E });
      [].forEach.call(el.children, function (c) {
        if (c.classList.contains("spop-head") || !c.offsetHeight) return;
        c.animate(reduce ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateX(" + (d < 0 ? -36 : 36) + "px)" }, { opacity: 1, transform: "none" }], { duration: reduce ? 160 : T, easing: E });
      });
    }
    function go(d) {
      var i = openIdx(); if (i < 0 && held >= 0 && performance.now() - heldAt < 1500) i = held; held = -1; if (i < 0) return false; var n = items.length, j = (i + d + n) % n;
      var A = items[i].el, B = items[j].el, keep = !!(o.band && A.classList.contains("spop-foot") && B.classList.contains("spop-foot")), h0 = A.getBoundingClientRect().height;
      if (keep) { A.classList.add("spop-now"); B.classList.add("spop-now"); }
      try { items[i].close(); } catch (e) { try { console.warn("[sheetnav] close " + items[i].id + ": " + (e && e.message)); } catch (_) {} }
      try { items[j].open(); } catch (e) { try { console.warn("[sheetnav] open " + items[j].id + ": " + (e && e.message)); } catch (_) {} }
      if (keep) { if (!B.hidden && h0) stepIn(B, h0, d); setTimeout(function () { A.classList.remove("spop-now"); B.classList.remove("spop-now"); }, 260); }
      else setTimeout(function () { play(items[j].el, "s-snav-in", (d > 0 ? 28 : -28) + "px", "--snav-from"); }, 0);
      return true;
    }
    [prev, next].forEach(function (b, k) {
      var off = function () { b.classList.remove("s-snav-on"); };
      b.addEventListener("pointercancel", off); b.addEventListener("pointerleave", function (e) { if (e.pointerType !== "mouse") off(); });
      /* after the switch the icon stays forward a moment, still showing where it went, then the arrow takes its new neighbour */
      b.addEventListener("click", function (e) { e.stopPropagation(); b.__keep = performance.now() + 260; b.classList.add("s-snav-on"); go(k ? 1 : -1); setTimeout(off, 260); });
    });
    if (o.keys !== false) addEventListener("keydown", function (e) {
      if (e.key !== "[" && e.key !== "]") return; if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target; if (t && t.closest && t.closest("input,textarea,select,[contenteditable]")) return;
      if (go(e.key === "]" ? 1 : -1)) e.preventDefault();
    });
    return { go: go, stop: function () { cancelAnimationFrame(raf); prev.remove(); next.remove(); } };
  }
  window.SurfaceSheetNav = { swipe: swipe, ring: ring };
})();
