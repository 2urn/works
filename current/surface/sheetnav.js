/* Surface · Sheet nav — move between tabs and between sheets without going back to the bar (Dimitry, 20 Oct 2026:
   "once you've opened a modal, if you swiped left or right on a modal with tabs you would be switching from one tab to
   another ... maybe arrows on either side of the modal that would allow you to explicitly switch". His choice: swipe
   for tabs, arrows for sheets).

   1. SWIPE CHANGES TABS. A sideways swipe on a tabbed sheet goes to the next or previous tab; at the first or last tab
      the sheet bounces and stays. It only counts when it starts on something that has no sideways meaning of its own:
      not a slider, a text field, a drag handle, a canvas, a row that scrolls sideways, or anything marked
      [data-noswipe]. Touch only: a mouse drag selects text as it always did. A swipe never leaves the sheet.
   2. ARROWS GO TO THE NEXT SHEET. While a sheet of the ring is open, a round arrow sits on each side edge, showing the
      neighbour's icon; a tap closes this sheet and opens that one, in the bar's order, round and round. [ and ] do the
      same from the keyboard (not while typing).

     SurfaceSheetNav.swipe(sheetEl, tabsApi)          tabsApi from SurfaceTabs.mount (needs .step)
     SurfaceSheetNav.ring([{ id, el, name, icon, isOpen(), open(), close() } …], {keys})   in the bar's order → {go(±1)}
       keys:false when the tool registers [ and ] as named actions with keys.js (it should): they then call go(±1)
   Plain script, window.SurfaceSheetNav. Default looks at zero specificity. */
(function () {
  "use strict";
  if (window.SurfaceSheetNav) return;
  var CSS =
    ":where(.s-snav){position:fixed;z-index:60;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1px solid rgb(255 255 255 / .22);" +
    "background:rgb(18 22 24 / .82);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#eef1f2;display:grid;place-items:center;padding:0;cursor:pointer;" +
    "box-shadow:0 3px 12px rgb(0 0 0 / .35);touch-action:manipulation;transition:opacity .18s}" +
    ":where(.s-snav)[hidden]{display:none}:where(.s-snav) svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
    ":where(.s-snav) .ch{position:absolute;top:50%;width:9px;height:9px;margin-top:-4.5px;stroke-width:2.4}" +
    ":where(.s-snav.prev) .ch{left:-1px}:where(.s-snav.next) .ch{right:-1px}" +
    ":where(.s-snav):focus-visible{outline:2px solid var(--acc,#55b8c9);outline-offset:2px}" +
    "@keyframes sSnavIn{from{opacity:.2;translate:var(--snav-from,24px) 0}to{opacity:1;translate:0 0}}" +
    "@keyframes sSnavBump{0%,100%{translate:0 0}35%{translate:var(--snav-bump,10px) 0}}" +
    ":where(.s-snav-in){animation:sSnavIn .22s cubic-bezier(.2,.8,.2,1)}:where(.s-snav-bump){animation:sSnavBump .26s ease-out}" +
    "@media (prefers-reduced-motion:reduce){:where(.s-snav-in),:where(.s-snav-bump){animation:none}}";
  function css() { if (document.getElementById("snav-css")) return; var s = document.createElement("style"); s.id = "snav-css"; s.textContent = CSS; (document.head || document.documentElement).prepend(s); }
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
    function openIdx() { for (var i = 0; i < items.length; i++) { try { if (items[i].isOpen()) return i; } catch (e) {} } return -1; }
    function chev(d) { return '<svg class="ch" viewBox="0 0 10 10" aria-hidden="true"><path d="' + (d < 0 ? "M6.5 1.5 3 5l3.5 3.5" : "M3.5 1.5 7 5 3.5 8.5") + '"/></svg>'; }
    function label(b, it, d) { b.innerHTML = chev(d) + (it.icon || ""); var t = (d < 0 ? "Previous: " : "Next: ") + it.name; b.setAttribute("aria-label", t + " ([ or ])".replace(d < 0 ? " or ]" : "[ or ", "")); b.title = t; }
    function place() {
      if (held >= 0 && performance.now() - heldAt < 1500) { raf = requestAnimationFrame(place); return; }   // mid-press: stay put, or the click would land on nothing
      cur = openIdx(); var on = cur >= 0;
      prev.hidden = next.hidden = !on;
      if (on) {
        var it = items[cur], r = it.el.getBoundingClientRect(), y = r.top + Math.min(r.height / 2, 220), n = items.length;
        if (!r.width) { prev.hidden = next.hidden = true; }
        else {
          prev.style.left = Math.max(19, r.left) + "px"; prev.style.top = y + "px";
          next.style.left = Math.min(innerWidth - 19, r.right) + "px"; next.style.top = y + "px";
          var a = items[(cur - 1 + n) % n], b = items[(cur + 1) % n];
          if (prev.__for !== a.id) { label(prev, a, -1); prev.__for = a.id; }
          if (next.__for !== b.id) { label(next, b, 1); next.__for = b.id; }
        }
      }
      raf = requestAnimationFrame(place);
    }
    raf = requestAnimationFrame(place);
    /* the sheets close on a press outside them, in the capture phase, before the arrow hears its own press: so which sheet
       was open is taken first, on the window, as the press begins */
    addEventListener("pointerdown", function (e) { if (e.target && e.target.closest && e.target.closest(".s-snav")) { held = openIdx(); heldAt = performance.now(); } }, true);
    function go(d) {
      var i = openIdx(); if (i < 0 && held >= 0 && performance.now() - heldAt < 1500) i = held; held = -1; if (i < 0) return false; var n = items.length, j = (i + d + n) % n;
      try { items[i].close(); } catch (e) { try { console.warn("[sheetnav] close " + items[i].id + ": " + (e && e.message)); } catch (_) {} }
      try { items[j].open(); } catch (e) { try { console.warn("[sheetnav] open " + items[j].id + ": " + (e && e.message)); } catch (_) {} }
      setTimeout(function () { play(items[j].el, "s-snav-in", (d > 0 ? 28 : -28) + "px", "--snav-from"); }, 0);
      return true;
    }
    [prev, next].forEach(function (b, k) {
      b.addEventListener("pointerdown", function (e) { e.stopPropagation(); });   // the sheets close on a press outside them; this press is not outside
      b.addEventListener("click", function (e) { e.stopPropagation(); go(k ? 1 : -1); });
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
