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
  /* THE TIME SCALE (Dimitry, 26 Oct 21:17-21:45: "all of the time beads interfaces have completely different settings
     for beat, bar and seconds"; then his picks on the Time Ring mock). One rule for every beads row that counts time:
     a row states its RANGE per unit; the kit makes its beads from the unit and the COUNTS (pair, fibo, prime), at most
     eight, spread evenly on a log scale. Pair in seconds is the clock ladder, so a minute is always a bead.
     - TIME.values(range, unit, set, {max}) → [numbers]   range: {sec:[lo,hi], beat:[lo,hi], bar:[lo,hi]}
     - TIME.near(list, v) → the bead nearest v (log distance), for carrying a value across units and counts
     - TIME.clock(seconds) → compact clock time: 15s, 3m, 12m 35s (number then letter; a space only between parts)
     - TIME.count(n, unit) → 6 beats, 1 bar, 15s (beats and bars keep their words: b could be either)
     - TIME.ICON.{sec, beat, bar} → <svg> marks, symbols only on a unit switch (his drawing: the stopwatch; beat = three
       thick ticks on a thin line; bar = three thin ticks on a thick line). The word goes to aria-label and title.
     - TIME.SETS, TIME.UNITS: names for labels. */
  var TS = {
    pair: [1, 2, 4, 8, 16, 32, 64, 128],
    clock: [1, 2, 4, 5, 10, 15, 30, 60, 90, 180, 300, 600],
    fibo: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233],
    prime: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179]
  };
  var TIME = {
    SETS: { pair: { name: "pair", long: "doublings" }, fibo: { name: "fibo", long: "Fibonacci" }, prime: { name: "prime", long: "primes" } },
    UNITS: { sec: { name: "seconds", one: "second" }, beat: { name: "beats", one: "beat" }, bar: { name: "bars", one: "bar" } },
    ICON: {
      sec: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V10M10 3.5h4M12 3.5v3M18 7l1.4-1.4"/></svg>',
      /* (26 Oct 22:05) one drawing, two emphases: three ticks over a line, spaced so they never read as a comb;
         beat = the ticks thick, the line thin; bar = the ticks thin, the line thick. Weight only, the same on both. */
      beat: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 5v11M12 5v11M18 5v11" stroke-width="2.8"/><path d="M3.5 20h17" stroke-width="1.1"/></svg>',
      bar: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 5v11M12 5v11M18 5v11" stroke-width="1.1"/><path d="M3.5 20h17" stroke-width="2.8"/></svg>'
    },
    values: function (range, unit, set, o) {
      var r = range && range[unit]; if (!r) return [];
      var lo = r[0], hi = r[1], max = (o && o.max) || 8;
      var src = set === "fibo" || set === "prime" ? TS[set] : unit === "sec" ? TS.clock : TS.pair;
      var v = src.filter(function (x) { return x >= lo && x <= hi; });
      if (v.length <= max) return v;
      var out = [], L0 = Math.log(lo), L1 = Math.log(hi);
      for (var i = 0; i < max; i++) { var t = L0 + (L1 - L0) * i / (max - 1), b = TIME.near(v, Math.exp(t)); if (out.indexOf(b) < 0) out.push(b); }
      return out.sort(function (a, b) { return a - b; });
    },
    near: function (list, v) {
      var best = null, d = Infinity; (list || []).forEach(function (x) { if (x <= 0 || v <= 0) { var e = Math.abs(x - v); if (e < d) { d = e; best = x; } return; }
        var e2 = Math.abs(Math.log(x) - Math.log(v)); if (e2 < d) { d = e2; best = x; } }); return best;
    },
    clock: function (s) {
      s = Math.max(0, +s || 0); if (s < 10 && s % 1) return (Math.round(s * 10) / 10) + "s";
      s = Math.round(s); if (s < 60) return s + "s";
      var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
      return (h ? h + "h " : "") + (m || h ? m + "m" : "") + (r ? " " + r + "s" : "");
    },
    count: function (n, unit) { if (unit === "sec") return TIME.clock(n); var U = TIME.UNITS[unit] || TIME.UNITS.beat; return n === 1 ? "1 " + U.one : n + " " + U.name; }
  };
  /* THE STEPPED DIAL (Dimitry, 26 Oct 22:20: "the number is a slider that just stops at the specific moment … an arc that
     has measures at the different stops, but there's one number indicator when you slide it. The arc sticks at the
     specific intervals while the number updates"). One circle for a row of beads: each bead is a tick round the edge,
     the arc fills to the chosen stop, a drag across it (right or up raises) steps from tick to tick, the number inside.
     The same part a ring's dot is, so a time row wraps round a ring unchanged.
       SurfaceBeads.dial({ stops: () => [v...], get: () => v, set: v => {}, label, aria: v => '…',
         face: v => html (what the dial shows at rest; default the number), busy: v => html (while dragged; default the
         number), tip: v => '…' (a word above while dragged, or ''), cls, px: 18 (drag distance per stop) })
       → element (.s-dial, role slider); el.sync() repaints it */
  var DCSS = ":where(.s-dial){position:relative;flex:none;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;padding:0;cursor:pointer;touch-action:none;color:inherit;-webkit-tap-highlight-color:transparent;font:600 13px/1 ui-monospace,monospace;font-variant-numeric:tabular-nums}" +
    ":where(.s-dial) svg.s-darc{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);pointer-events:none;overflow:visible}" +
    ":where(.s-darc) circle{fill:none;stroke-width:3;stroke-linecap:round}:where(.s-darc) .t{stroke:currentColor;opacity:.14}:where(.s-darc) .v{stroke:var(--acc,#55b8c9)}" +
    ":where(.s-darc) line{stroke:currentColor;stroke-width:1.4;opacity:.45}:where(.s-darc) line.on{opacity:1;stroke:var(--acc,#55b8c9)}" +
    ":where(.s-dtip){position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);padding:4px 7px;border-radius:7px;background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c);font:700 11px/1 ui-monospace,monospace;white-space:nowrap;pointer-events:none}" +
    ":where(.s-dial):focus-visible{outline:2px solid var(--acc,#55b8c9);outline-offset:2px}";
  function dcss() { if (document.getElementById("sbd-dial-css")) return; var s = document.createElement("style"); s.id = "sbd-dial-css"; s.textContent = DCSS; (document.head || document.documentElement).prepend(s); }
  function dial(o) {
    dcss(); var d = document.createElement("div"); d.className = "s-dial" + (o.cls ? " " + o.cls : ""); d.tabIndex = 0; d.setAttribute("role", "slider");
    var px = o.px || 18, g = null, pk = 0, tip = document.createElement("span"); tip.className = "s-dtip"; tip.hidden = true;
    var stops = function () { var s = o.stops() || []; return s.length ? s : [0]; };
    var idx = function () { var s = stops(), v = o.get(), i = s.indexOf(v); if (i < 0) { var b = 0, dd = Infinity; s.forEach(function (x, k) { var e = Math.abs(x - v); if (e < dd) { dd = e; b = k; } }); i = b; } return i; };
    var arc = function (i, n) {
      var R = 21, L = 2 * Math.PI * R, f = n > 1 ? i / (n - 1) : 1, ticks = "";
      for (var k = 0; k < n; k++) { var a = (n > 1 ? k / (n - 1) : 1) * 2 * Math.PI * .999, c = Math.cos(a), sn = Math.sin(a);
        ticks += '<line' + (k === i ? ' class="on"' : "") + ' x1="' + (24 + c * 16.5).toFixed(2) + '" y1="' + (24 + sn * 16.5).toFixed(2) + '" x2="' + (24 + c * 18.5).toFixed(2) + '" y2="' + (24 + sn * 18.5).toFixed(2) + '"/>'; }
      return '<svg class="s-darc" viewBox="0 0 48 48" aria-hidden="true"><circle class="t" cx="24" cy="24" r="' + R + '"/>' +
        (f > 0 ? '<circle class="v" cx="24" cy="24" r="' + R + '" stroke-dasharray="' + (f * L).toFixed(1) + " " + L.toFixed(1) + '"/>' : "") + ticks + "</svg>";
    };
    var paint = function (busy) {
      var s = stops(), i = idx(), v = s[i];
      d.innerHTML = '<span class="s-dface">' + (busy ? (o.busy ? o.busy(v) : String(v)) : (o.face ? o.face(v) : String(v))) + "</span>" + arc(i, s.length);
      d.appendChild(tip); var t = busy && o.tip ? o.tip(v) : ""; tip.hidden = !t; tip.textContent = t || "";
      d.classList.toggle("s-dbusy", !!busy);
      d.setAttribute("aria-valuemin", "0"); d.setAttribute("aria-valuemax", String(s.length - 1)); d.setAttribute("aria-valuenow", String(i));
      var w = o.aria ? o.aria(v) : String(v); d.setAttribute("aria-valuetext", w); d.setAttribute("aria-label", o.label || "Value"); d.title = (o.label ? o.label + ": " : "") + w;
    };
    var go = function (i) { var s = stops(); i = Math.max(0, Math.min(s.length - 1, i)); if (s[i] !== o.get()) o.set(s[i]); };
    d.addEventListener("pointerdown", function (e) { e.stopPropagation(); try { d.setPointerCapture(e.pointerId); } catch (er) {} g = { x: e.clientX, y: e.clientY, i: idx(), moved: false }; });
    d.addEventListener("pointermove", function (e) { if (!g) return; var dd = (e.clientX - g.x) * .5 - (e.clientY - g.y); if (!g.moved && Math.abs(dd) < 6) return; g.moved = true; go(g.i + Math.round(dd / px)); paint(true); });
    var end = function () { if (!g) return; var m = g.moved; g = null; clearTimeout(pk); paint(true); pk = setTimeout(function () { paint(false); }, m ? 900 : 1100); if (m && o.done) o.done(o.get()); };
    d.addEventListener("pointerup", end); d.addEventListener("pointercancel", function () { g = null; paint(false); });
    d.addEventListener("keydown", function (e) { var k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key], s = stops();
      var j = e.key === "Home" ? 0 : e.key === "End" ? s.length - 1 : k != null ? idx() + k : null; if (j == null) return; e.preventDefault(); go(j); paint(true); clearTimeout(pk); pk = setTimeout(function () { paint(false); if (o.done) o.done(o.get()); }, 900); });
    d.sync = function () { if (!g) paint(false); }; paint(false); return d;
  }
  window.SurfaceBeads = { row: row, toggle: toggle, head: head, svg: svg, ICONS: ICONS, time: TIME, dial: dial };
})();
