/* Surface · Rail — a sideways row of choices (cards, presets, thumbnails) that shows it can be moved
   (Dimitry, 20 Oct 2026: "it's not always clear that you can actually scroll on the computer").

   Wraps a horizontally scrolling row in a left and a right arrow and puts a dot navigator under it:
     · an arrow is shown only while there is more that way; it steps to the previous or next item
     · one dot per item; the lit dot is the picked item (aria-checked / aria-selected / aria-pressed),
       or, when nothing is picked, the item nearest the middle; a dot goes to its item
     · with pick:true (default) an arrow or a dot picks the item (clicks it), as the arrow keys already do in a radio
       group; with pick:false it only scrolls there
   Items added later are picked up (MutationObserver), so the row can be built after mounting.

     SurfaceRail.mount(row, {label:'Card designs', pick:true, dots:true})  → {sync(), destroy()}

   The CSS standard for this (::scroll-button / ::scroll-marker, CSS Overflow 5) runs in Chrome only so far, so this is
   the script version; it can step aside when Safari ships it. Plain script, window.SurfaceRail, no dependencies;
   colours from the theme tokens (--ui-ink, --ui-hi, --acc). */
(function () {
  "use strict";
  if (window.SurfaceRail) return;
  var CSS =
    ".sfr{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;width:100%}" +
    ".sfr-row{position:relative;width:100%}" +
    ".sfr-a{position:absolute;top:50%;z-index:2;width:34px;height:34px;margin-top:-17px;padding:0;border-radius:50%;display:grid;place-items:center;" +
    "border:1px solid rgba(255,255,255,.22);background:rgba(14,14,16,.72);color:#fff;cursor:pointer;" +   // dark glass: reads over any card, light or dark
    "-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 2px 10px rgba(0,0,0,.25);transition:opacity .18s,background .15s}" +
    ".sfr-a.l{left:2px}.sfr-a.r{right:2px}.sfr-a[hidden]{display:grid;opacity:0;pointer-events:none}" +
    ".sfr-a:hover{background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c)}" +
    ".sfr-a:focus-visible{outline:2px solid var(--acc,#55b8c9);outline-offset:2px}" +
    ".sfr-a svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}" +
    ".sfr-d{display:flex;flex-wrap:wrap;justify-content:center;gap:2px;margin:0;padding:0}" +
    ".sfr-d button{width:22px;height:22px;padding:0;border:0;background:none;color:inherit;display:grid;place-items:center;cursor:pointer}" +
    ".sfr-d button::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.5;transition:opacity .15s,background .15s,transform .15s}" +
    ".sfr-d button:hover::before{opacity:.8}" +
    ".sfr-d button[aria-current=true]::before{background:var(--acc,#55b8c9);opacity:1;transform:scale(1.25)}" +
    ".sfr-d button:focus-visible{outline:2px solid var(--acc,#55b8c9);outline-offset:-2px;border-radius:50%}" +
    "@media (prefers-reduced-motion:reduce){.sfr-a,.sfr-d button::before{transition:none}}";
  var L = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.5 6l-6 6 6 6"/></svg>';
  var R = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 6l6 6-6 6"/></svg>';
  function picked(el) {
    return ["aria-checked", "aria-selected", "aria-pressed"].some(function (a) { return el.getAttribute(a) === "true"; });
  }
  function mount(row, o) {
    o = o || {};
    if (!row || row.__sfr) return row && row.__sfr;
    if (!document.getElementById("sfr-css")) { var st = document.createElement("style"); st.id = "sfr-css"; st.textContent = CSS; document.head.appendChild(st); }
    var pick = o.pick !== false, label = o.label || row.getAttribute("aria-label") || "items";
    var wrap = document.createElement("div"); wrap.className = "sfr";
    var inner = document.createElement("div"); inner.className = "sfr-row";
    row.parentNode.insertBefore(wrap, row); inner.appendChild(row); wrap.appendChild(inner);
    function arrow(cls, html, name) {
      var b = document.createElement("button"); b.type = "button"; b.className = "sfr-a " + cls; b.innerHTML = html;
      b.setAttribute("aria-label", name); b.setAttribute("data-tip", name); inner.appendChild(b); return b;
    }
    var al = arrow("l", L, "Previous"), ar = arrow("r", R, "Next");
    var dots = null;
    if (o.dots !== false) { dots = document.createElement("div"); dots.className = "sfr-d"; dots.setAttribute("aria-label", label + ": go to"); wrap.appendChild(dots); }
    function items() { return Array.prototype.filter.call(row.children, function (c) { return c.nodeType === 1 && !c.hidden; }); }
    function current() {
      var all = items(), k = all.findIndex(picked);
      if (k >= 0) return k;
      var mid = row.scrollLeft + row.clientWidth / 2, best = 0, d = Infinity;
      all.forEach(function (c, i) { var m = c.offsetLeft + c.offsetWidth / 2, x = Math.abs(m - mid); if (x < d) { d = x; best = i; } });
      return best;
    }
    function go(k) {
      var all = items(); if (!all.length) return;
      k = Math.max(0, Math.min(all.length - 1, k));
      var c = all[k];
      try { c.scrollIntoView({ inline: "center", block: "nearest", behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" }); } catch (e) {}
      if (pick) { c.click(); try { c.focus({ preventScroll: true }); } catch (e) {} }
      setTimeout(sync, 0);
    }
    al.onclick = function () { go(current() - 1); };
    ar.onclick = function () { go(current() + 1); };
    function sync() {
      var max = row.scrollWidth - row.clientWidth;
      al.hidden = row.scrollLeft <= 2; ar.hidden = row.scrollLeft >= max - 2;
      if (!dots) return;
      var all = items();
      if (dots.children.length !== all.length) {
        dots.textContent = "";
        all.forEach(function (c, i) {
          var b = document.createElement("button"); b.type = "button";
          b.setAttribute("aria-label", (c.getAttribute("aria-label") || (label + " " + (i + 1))));
          b.onclick = function () { go(i); }; dots.appendChild(b);
        });
      }
      var k = current();
      Array.prototype.forEach.call(dots.children, function (b, i) { b.setAttribute("aria-current", String(i === k)); });
    }
    var raf = 0; function soon() { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }
    row.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    var mo = new MutationObserver(soon); mo.observe(row, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-checked", "aria-selected", "aria-pressed", "hidden"] });
    var ro = window.ResizeObserver ? new ResizeObserver(soon) : null; if (ro) ro.observe(row);
    sync();
    row.__sfr = { sync: sync, go: go, destroy: function () { mo.disconnect(); if (ro) ro.disconnect(); row.removeEventListener("scroll", soon); window.removeEventListener("resize", soon); } };
    return row.__sfr;
  }
  window.SurfaceRail = { mount: mount };
})();
