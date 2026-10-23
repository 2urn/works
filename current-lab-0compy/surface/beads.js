/* Surface · Beads — a count or a duration chosen on a thread (Dimitry, 21 Oct 2026: the text sequencer's "2 seconds,
   4 seconds, 8 seconds, 16 seconds … that should be our bead layout", after Current's Auto play beads).

   - BEADS: round buttons strung on one hairline thread, evenly spaced, one lit (a radio group). The value IS the
     label inside the bead (2, 4, 8, bar, cut); the unit lives in the heading, never in the bead.
   - ONE ROW, TWO MEANINGS: when two settings share the same kind of values (how long a word stays, how long the morph
     takes), one row of beads serves both, with a small two-way switch above it at the heading's right
     (Stay | Morph). The lit bead shows the side the switch is on; the other side's value is written under the row,
     so both are always readable.
   - ICONS: drawn on the 24-unit grid at the weight for their size (CONVENTIONS, line weight by size); never set in
     a font. Dotted lines are round-capped dashes of 0.1, so they read as dots at any size.

     SurfaceBeads.row({values:[[v, label, aria]...], get:()=>v, set:(v)=>{}, label:'Change every', cls:'', beadCls:''})
       → element (.s-beads, role radiogroup); el.sync() relights it
     SurfaceBeads.toggle({options:[[v, text, aria]...], get, set, label}) → element (.s-btog, role radiogroup)
     SurfaceBeads.head(text, toggle) → a heading with the switch at its right (.s-beadsh)
     SurfaceBeads.ICONS.{caseAs, caseCaps, sizeSame, sizeFill}  → inner SVG markup on the 24 grid
     SurfaceBeads.svg(inner, strokeWidth)  → '<svg …>' with stroke-width set for its size
   Plain script, window.SurfaceBeads. Default looks at zero specificity: the tool's rules win. */
(function () {
  "use strict";
  if (window.SurfaceBeads) return;
  var DOT = ' stroke-dasharray="0.1 3" stroke-linecap="round"';
  var ICONS = {
    /* as typed: a capital A and a small a */
    caseAs: '<path d="M2.5 18.5 7 5.5l4.5 13M4.1 14h5.8"/><circle cx="17" cy="15" r="3.4"/><path d="M20.4 11.3v7.2"/>',
    /* ALL CAPS: two capital As */
    caseCaps: '<path d="M1.5 18.5 6 5.5l4.5 13M3.1 14h5.8M13.5 18.5 18 5.5l4.5 13M15.1 14h5.8"/>',
    /* same size: one height for every word, a vertical double-headed arrow between two dotted lines */
    sizeSame: '<path d="M3 3.5h18M3 20.5h18"' + DOT + '/><path d="M12 6.5v11M9.2 9.3 12 6.5l2.8 2.8M9.2 14.7 12 17.5l2.8-2.8"/>',
    /* each fills: every word fills the width, a horizontal double-headed arrow between two dotted lines (cap height) */
    sizeFill: '<path d="M3 6h18M3 18h18"' + DOT + '/><path d="M4 12h16M6.8 9.2 4 12l2.8 2.8M17.2 9.2 20 12l-2.8 2.8"/>'
  };
  function svg(inner, sw) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.56) +
      '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }
  var CSS = ":where(.s-beads){position:relative;display:flex;justify-content:space-between;align-items:center;padding:2px 0}" +
    ":where(.s-beads)::before{content:'';position:absolute;left:20px;right:20px;top:50%;height:2px;margin-top:-1px;border-radius:2px;background:color-mix(in srgb,currentColor 18%,transparent)}" +
    ":where(.s-bead){position:relative;width:42px;height:42px;flex:none;border-radius:50%;border:1px solid color-mix(in srgb,currentColor 22%,transparent);background:Canvas;color:inherit;display:grid;place-items:center;padding:0;font:600 15px/1 system-ui,sans-serif;font-variant-numeric:tabular-nums;cursor:pointer}" +
    ":where(.s-bead[aria-checked=true]){background:var(--acc,#55b8c9);border-color:var(--acc,#55b8c9);color:var(--acc-ink,#04181c)}" +
    ":where(.s-beadsh){display:flex;align-items:center;justify-content:space-between;gap:10px}" +
    ":where(.s-btog){display:flex;gap:2px;padding:2px;border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:99px}" +
    ":where(.s-btog) button{border:0;background:none;color:inherit;opacity:.6;font:600 9px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;padding:6px 9px;border-radius:99px;cursor:pointer}" +
    ":where(.s-btog) button[aria-checked=true]{opacity:1;background:color-mix(in srgb,currentColor 14%,transparent)}";
  function css() { if (document.getElementById("sbd-css")) return; var s = document.createElement("style"); s.id = "sbd-css"; s.textContent = CSS; (document.head || document.documentElement).prepend(s); }
  function radios(el, opts, get, set, mk) {
    var sync = function () { var g = String(get()); [].forEach.call(el.children, function (b) { b.setAttribute("aria-checked", String(b.dataset.v === g)); b.tabIndex = b.dataset.v === g ? 0 : -1; }); };
    opts.forEach(function (o) {
      var b = mk(o); b.type = "button"; b.setAttribute("role", "radio"); b.dataset.v = String(o[0]); if (o[2]) b.setAttribute("aria-label", o[2]);
      b.onclick = function () { set(o[0]); sync(); };
      b.onkeydown = function (e) { var k = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0; if (!k) return; e.preventDefault();
        var bs = [].slice.call(el.children), i = bs.indexOf(b), n = bs[(i + k + bs.length) % bs.length]; n.click(); n.focus(); };
      el.appendChild(b);
    });
    el.sync = sync; sync(); return el;
  }
  function row(o) {
    css(); var g = document.createElement("div"); g.className = "s-beads" + (o.cls ? " " + o.cls : ""); g.setAttribute("role", "radiogroup"); if (o.label) g.setAttribute("aria-label", o.label);
    return radios(g, o.values, o.get, o.set, function (v) { var b = document.createElement("button"); b.className = "s-bead" + (o.beadCls ? " " + o.beadCls : ""); b.innerHTML = v[1]; return b; });
  }
  function toggle(o) {
    css(); var g = document.createElement("div"); g.className = "s-btog" + (o.cls ? " " + o.cls : ""); g.setAttribute("role", "radiogroup"); if (o.label) g.setAttribute("aria-label", o.label);
    return radios(g, o.options, o.get, o.set, function (v) { var b = document.createElement("button"); b.textContent = v[1]; return b; });
  }
  function head(text, tog, cls) {
    css(); var h = document.createElement("div"); h.className = "s-beadsh" + (cls ? " " + cls : ""); var t = document.createElement("span"); t.className = "s-beadst"; t.textContent = text;
    h.appendChild(t); if (tog) h.appendChild(tog); return h;
  }
  window.SurfaceBeads = { row: row, toggle: toggle, head: head, svg: svg, ICONS: ICONS };
})();
