/* Surface · Auto — a control that moves by itself. One language for every tool (CONVENTIONS.md › Auto).

   Plain script, no dependencies: load it before the tool's own script and use window.SurfaceAuto.

   WHAT IT LOOKS LIKE
   - The symbol is the half-wave with a dot on its crest (from Strand Kit). Grey at rest, accent while Auto runs,
     and then the dot rides the crest (still under reduced motion).
   - On the slider row, while Auto runs: the thumb goes hollow, an accent band marks the range it moves through,
     and a small dot rides the live value. Dragging the thumb moves the whole range, because the range is stored
     relative to where the control is set. Accent only: Auto has no colour of its own.
   - The editor opens under the row, ruled on its left in the accent: shape buttons in families (motion, sound,
     finger, and the tool's own followers), then low, high, period and phase, spread where the tool has many
     copies of a thing, and remove.

   THE MODEL (what a tool stores per control, plain JSON, safe in presets and saved looks)
     { shape, lo, hi, per, ph, sp }
       shape  'sine' 'tri' 'square' 'saw' 'noise' 'random', or a signal name the tool supplies (bass, x, flow…)
       lo,hi  where it moves, as offsets from the set value in normalised units (-1…1 of the control's range).
              A swinging shape sweeps lo→hi and back; a signal rests at lo and rises to hi.
       per    seconds per cycle (motion shapes only)
       ph     phase, 0…1
       sp     spread, 0…1: how far apart copies start (tools with many of a thing; 0 elsewhere)
   SurfaceAuto.migrate() turns the older {shape, per, depth} (Current's "~" modulators) into this, exactly:
   the same depth gives the same movement.

   THE CALLS
     SurfaceAuto.ICON                       the symbol, as SVG markup
     SurfaceAuto.migrate(m, isSignal)       old → new model (returns a new object; leaves new ones alone)
     SurfaceAuto.shape(m, t, seed, signals) 0…1 at time t (seconds); seed keeps noise/random distinct per control
     SurfaceAuto.apply(m, baseN, v)         the moved value, normalised 0…1 and clamped
     SurfaceAuto.decorate(track)            adds the band and the riding dot to a slider's track; returns painter
       painter.paint({on, baseN, liveN})    on: Auto (or a mapping) is moving it; baseN/liveN normalised
     SurfaceAuto.editor(host, opts)         renders the editor into host (see the function for opts)
     SurfaceAuto.button(label)              the row's Auto button (aria-pressed = running, aria-expanded = open)
     SurfaceAuto.lead(row, button)          puts it first in its row, left of the name (CONVENTIONS › Auto)
     SurfaceAuto.icon(value)                a source's picture (sine, tri, square, saw, noise, random, bass, mid, high,
                                            level, beat, fx, fy, touch, flow) as SVG markup, or '' when it has none
*/
(function () {
  "use strict";
  var ICON = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M2.5 13.5C5.5 13.5 6.5 6 10 6S14.5 13.5 17.5 13.5"/><circle cx="10" cy="6" r="2"/></svg>';
  var MOTION = [["sine", "sin"], ["tri", "tri"], ["square", "sqr"], ["saw", "saw"], ["noise", "noise"], ["random", "rand"]];
  var MOTION_SET = { sine: 1, tri: 1, square: 1, saw: 1, noise: 1, random: 1 };
  /* THE SOURCES AS PICTURES (Dimitry, 28 Oct 00:08-00:13: "icons for things like sine and cosine and square and sawtooth
     and all of that stuff that's pretty common symbolism"; a child of two plays this and learns the words later; "bass, mid
     and high … as equalizer bars … the frequency band would just be bolder, just like for the beats and bars"). One family:
     24-unit strokes; the motions are their wave; the bands are three equalizer bars with theirs bold (level: all three), on
     the baseline the beat and bar units use; beat is the beat unit's ticks; the finger is an arrow or the hand; flow is
     the field's flow lines. A tool's own signal without a picture keeps its word. */
  var B = ' stroke-width="2.8"', T = ' stroke-width="1.1"';
  var EQ = function (k) { var h = ["M6 7v12", "M12 10v9", "M18 13v6"]; return h.map(function (d, i) { return '<path d="' + d + '"' + (k === i || k === 3 ? B : T) + "/>"; }).join(""); };
  var AICON = {
    sine: '<path d="M2.5 12C5 4.5 7.5 4.5 10 12s5 7.5 7.5 0 2.7-6 4-4"/>',
    tri: '<path d="M2.5 16l4.75-8 4.75 8 4.75-8 4.75 8"/>',
    square: '<path d="M2.5 16h3.5V8h6v8h6V8h3.5"/>',
    saw: '<path d="M2.5 16l6-8v8l6-8v8l6-8v8"/>',
    noise: '<path d="M2.5 13c1.6-4 3-4.5 4.3-1.5s2.4 3.5 3.8.5 2-6.5 3.9-5 1.8 6.5 3.7 6 2-3.5 3.3-4"/>',   /* a smooth wander, as noise moves (review 7f3ba62015 r-2) */
    random: '<path d="M2.5 14h3.2V9h3.2v8h3.2v-6h3.2v4h3.2V8h2.5"/>',
    bass: EQ(0), mid: EQ(1), high: EQ(2), level: EQ(3),
    beat: '<path d="M6 5v11M12 5v11M18 5v11"' + B + '/><path d="M3.5 20h17"' + T + "/>",
    fx: '<path d="M4 12h16M7.5 8.5 4 12l3.5 3.5M16.5 8.5 20 12l-3.5 3.5"/>',
    fy: '<path d="M12 4v16M8.5 7.5 12 4l3.5 3.5M8.5 16.5 12 20l3.5-3.5"/>',
    touch: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.6 14.6a1.5 1.5 0 0 1 2.4-1.8L9 15.5"/>',
    flow: '<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>'
  };
  var AWORD = { sine: "sine", tri: "triangle", square: "square", saw: "saw", noise: "noise", random: "random", level: "level", fx: "across", fy: "up" };
  function aIcon(v) { var d = AICON[v]; return d ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + d + "</svg>" : ""; }

  var CSS = [
    /* the symbol */
    ".sa-btn{flex:none;width:26px;height:28px;padding:0;display:grid;place-items:center;border:0;background:none;color:var(--sa-quiet,currentColor);opacity:.75;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    ".sa-btn:hover,.sa-btn:focus-visible,.sa-btn[aria-expanded=true]{opacity:1}",
    ".sa-btn svg{width:18px;height:18px;overflow:visible}",
    ".sa-led>.sa-btn{margin-left:-6px}",
    ".sa-btn path{fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round}",
    ".sa-btn circle{fill:currentColor}",
    ".sa-btn[aria-pressed=true]{color:var(--sa-acc);opacity:1}",
    ".sa-btn[aria-pressed=true] circle{animation:sa-ride 1.6s ease-in-out infinite alternate}",
    "@keyframes sa-ride{0%{transform:translate(-5px,4.5px)}50%{transform:translate(0,0)}100%{transform:translate(5px,4.5px)}}",
    "@media (prefers-reduced-motion:reduce){.sa-btn[aria-pressed=true] circle{animation:none}}",
    /* the band and the riding dot on the track */
    ".sa-trk{position:relative}",
    ".sa-trk .sa-seg{position:absolute;top:50%;height:2px;margin-top:-1px;background:var(--sa-acc);pointer-events:none;display:none;z-index:2}",
    ".sa-trk .sa-dot{position:absolute;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--sa-acc);pointer-events:none;display:none;z-index:3}",
    ".sa-trk.sa-on .sa-seg,.sa-trk.sa-on .sa-dot{display:block}",
    ".sa-trk.sa-on input[type=range]::-webkit-slider-thumb{background:transparent!important;box-shadow:inset 0 0 0 1.5px var(--sa-acc)}",
    ".sa-trk.sa-on input[type=range]::-moz-range-thumb{background:transparent!important;box-shadow:inset 0 0 0 1.5px var(--sa-acc)}",
    /* the editor */
    ".sa-ed{border-left:1px solid var(--sa-acc);margin:2px 0 10px 4px;padding:6px 0 6px 10px;display:grid;gap:6px}",
    ".sa-ed[hidden]{display:none}",
    ".sa-fam{display:flex;flex-wrap:wrap;align-items:center;gap:2px}",
    ".sa-fam>i{font:500 9px/1 var(--sa-mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--sa-quiet,currentColor);opacity:.7;font-style:normal;width:46px;flex:none}",
    ".sa-fam button{font:12px var(--sa-mono,ui-monospace,monospace);padding:4px 7px;min-height:26px;background:transparent;border:0;border-radius:0;color:var(--sa-quiet,currentColor);cursor:pointer}",
    ".sa-fam button[aria-pressed=true]{color:var(--sa-acc)}",
    ".sa-fam button:hover{color:inherit}",
    /* a source with a picture: the icon over its word (28 Oct) */
    ".sa-fam button.sa-ic{display:inline-grid;justify-items:center;align-content:center;gap:3px;min-width:44px;min-height:46px;padding:5px 4px;border-radius:10px}",
    ".sa-fam button.sa-ic svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;overflow:visible}",
    ".sa-fam button.sa-ic span{font:600 9px/1 var(--sa-mono,ui-monospace,monospace);letter-spacing:.06em;text-transform:uppercase}",
    ".sa-fam button.sa-ic[aria-pressed=true]{background:color-mix(in srgb,var(--sa-acc) 16%,transparent);box-shadow:inset 0 0 0 1px var(--sa-acc)}",
    ".sa-rm{justify-self:start;font:12px var(--sa-mono,ui-monospace,monospace);padding:4px 0;border:0;background:none;color:var(--sa-quiet,currentColor);cursor:pointer;text-decoration:underline;text-underline-offset:3px}",
    "@media (pointer:coarse){.sa-btn{width:40px;height:40px}.sa-fam button{min-height:36px;padding:6px 9px}}"
  ].join("\n");
  function injectCSS() {
    if (typeof document === "undefined" || document.getElementById("sa-css")) return;
    var st = document.createElement("style"); st.id = "sa-css"; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---- the motion ---- */
  function hash1(n) { n = (n << 13) ^ n; return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff; }
  function seedOf(k) { var h = 7, s = String(k); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function shape(m, t, seed, signals) {
    if (!m) return 0;
    if (!MOTION_SET[m.shape]) { var sv = signals && signals[m.shape]; return sv > 0 ? Math.min(1, sv) : 0; }
    var sd = typeof seed === "number" ? seed : seedOf(seed || "");
    var x = t / Math.max(0.05, m.per || 1) + (m.ph || 0), ph = x - Math.floor(x);
    switch (m.shape) {
      case "tri": return 1 - Math.abs(2 * ph - 1);
      case "square": return ph < 0.5 ? 1 : 0;
      case "saw": return ph;
      case "noise": { var i = Math.floor(x), f = x - i, a = hash1(sd + i * 7919), b = hash1(sd + (i + 1) * 7919), u = f * f * (3 - 2 * f); return a + (b - a) * u; }
      case "random": return hash1(sd + Math.floor(x) * 7919);
    }
    return 0.5 - 0.5 * Math.cos(ph * 6.2832);   // sine
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function apply(m, baseN, v) { return clamp01(baseN + m.lo + (m.hi - m.lo) * v); }
  function migrate(m, isSignal) {
    if (!m || typeof m !== "object") return m;
    if (typeof m.lo === "number" && typeof m.hi === "number") return m;
    var d = typeof m.depth === "number" ? m.depth : 0.5;
    var sig = typeof isSignal === "function" ? isSignal(m.shape) : (isSignal != null ? !!isSignal : !MOTION_SET[m.shape]);
    return { shape: m.shape, lo: sig ? 0 : -d / 2, hi: d / 2, per: m.per || 4, ph: m.ph || 0, sp: m.sp || 0 };
  }

  /* ---- the row ---- */
  function button(label) {
    injectCSS();
    var b = document.createElement("button"); b.type = "button"; b.className = "sa-btn"; b.innerHTML = ICON;
    b.setAttribute("aria-pressed", "false"); b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-label", "Auto: " + label); b.title = "Auto: " + label + " moves by itself";
    return b;
  }
  /* WHERE IT SITS (Dimitry, 19 Oct 2026): the symbol leads its row, left of the parameter's name. At the row's far end
     it read as the next control's. lead() puts it first in the DOM too, so the tab order and a screen reader meet it in
     the order it is seen; the row gets .sa-led, and the tool's grid gives that row a leading auto column, e.g.
       .row.sa-led{grid-template-columns:auto 88px minmax(0,1fr) 44px} */
  function lead(row, b) {
    injectCSS(); row.classList.add("sa-led"); row.insertBefore(b, row.firstChild); return b;
  }
  function decorate(track) {
    injectCSS(); track.classList.add("sa-trk");
    var seg = document.createElement("span"); seg.className = "sa-seg";
    var dot = document.createElement("span"); dot.className = "sa-dot";
    track.appendChild(seg); track.appendChild(dot);
    var TH = 7;   // half the thumb, so band and dot line up with where the thumb sits
    function at(f) { return "calc(" + TH + "px + (100% - " + 2 * TH + "px) * " + clamp01(f).toFixed(4) + ")"; }
    return {
      paint: function (o) {
        track.classList.toggle("sa-on", !!o.on);
        if (!o.on) return;
        if (o.m) {
          var a = clamp01(o.baseN + Math.min(o.m.lo, o.m.hi)), b = clamp01(o.baseN + Math.max(o.m.lo, o.m.hi));
          seg.style.display = ""; seg.style.left = at(a); seg.style.width = "calc((100% - " + 2 * TH + "px) * " + (b - a).toFixed(4) + ")";
        } else seg.style.display = "none";   // moved by a mapping: the dot alone
        dot.style.left = at(o.liveN);
      }
    };
  }

  /* ---- the editor ----
     opts: { label, get: () => model|null, set: model|null → void, families: [[name, [[value,label],…]],…] extra families
             (sound, finger, the tool's followers), spread: bool, fmt: n => text (shows lo/hi in the control's units),
             onChange: () => void } */
  function editor(host, opts) {
    injectCSS(); host.classList.add("sa-ed");
    var stash = null;
    function draw() {
      var m = opts.get(), cur = m || stash || { shape: "sine", lo: -0.25, hi: 0.25, per: 4, ph: 0, sp: 0 };
      host.innerHTML = "";
      var fams = [["move", MOTION]].concat(opts.families || []);
      fams.forEach(function (f) {
        var row = document.createElement("div"); row.className = "sa-fam"; row.setAttribute("role", "group");
        row.setAttribute("aria-label", opts.label + " Auto, " + f[0]);
        var i = document.createElement("i"); i.textContent = f[0]; row.appendChild(i);
        f[1].forEach(function (p) {
          var b = document.createElement("button"); b.type = "button"; var ic = aIcon(p[0]);
          if (ic) { b.className = "sa-ic"; b.innerHTML = ic + "<span>" + (AWORD[p[0]] || p[1]) + "</span>"; } else b.textContent = p[1];
          b.setAttribute("aria-pressed", String(!!m && m.shape === p[0]));
          b.setAttribute("aria-label", opts.label + " Auto: " + (p[2] || AWORD[p[0]] || p[0]));   /* says the word it shows (r-1) */
          b.onclick = function () {
            var was = opts.get() || stash, sigNow = !MOTION_SET[p[0]], sigWas = was && !MOTION_SET[was.shape];
            var n = was ? { shape: p[0], lo: was.lo, hi: was.hi, per: was.per || 4, ph: was.ph || 0, sp: was.sp || 0 } : { shape: p[0], lo: sigNow ? 0 : -0.25, hi: 0.25, per: 4, ph: 0, sp: 0 };
            if (was && sigNow !== sigWas) { var w = Math.abs(n.hi - n.lo); n.lo = sigNow ? 0 : -w / 2; n.hi = sigNow ? w : w / 2; }
            opts.set(n); draw(); opts.onChange && opts.onChange();
          };
          row.appendChild(b);
        });
        host.appendChild(row);
      });
      function sub(name, min, max, step, val, put, show, aria) {
        var r = document.createElement("div"); r.className = "row sa-sub";
        var l = document.createElement("label"); l.textContent = name;
        var w = document.createElement("div"); w.className = "rw";
        var s = document.createElement("input"); s.type = "range"; s.min = min; s.max = max; s.step = step; s.value = val; s.setAttribute("aria-label", opts.label + " Auto " + aria);
        var o = document.createElement("span"); o.className = "val"; o.textContent = show(+s.value);
        s.oninput = function () { o.textContent = show(+s.value); var t = opts.get(); if (t) { put(t, +s.value); opts.onChange && opts.onChange(); } else if (stash) put(stash, +s.value); };
        w.appendChild(s); r.appendChild(l); r.appendChild(w); r.appendChild(o); host.appendChild(r); return r;
      }
      var fmt = opts.fmt || function (n) { return (n >= 0 ? "+" : "") + Math.round(n * 100) + "%"; };
      sub("low", -1, 1, 0.01, cur.lo, function (t, v) { t.lo = v; }, fmt, "low end of the range");
      sub("high", -1, 1, 0.01, cur.hi, function (t, v) { t.hi = v; }, fmt, "high end of the range");
      var motion = MOTION_SET[cur.shape];
      if (motion) {
        /* period on a log scale, 0.1 to 60 seconds, so short and long are both easy to reach */
        var lp = function (s) { return Math.log(Math.max(0.1, s)) ; };
        sub("period", Math.log(0.1).toFixed(4), Math.log(60).toFixed(4), 0.001, lp(cur.per || 4), function (t, v) { t.per = +Math.exp(v).toFixed(2); }, function (v) { var s = Math.exp(v); return (s < 10 ? s.toFixed(1) : Math.round(s)) + "s"; }, "period in seconds");
        sub("phase", 0, 1, 0.01, cur.ph || 0, function (t, v) { t.ph = v; }, function (v) { return Math.round(v * 360) + "°"; }, "phase");
      }
      if (opts.spread) sub("spread", 0, 1, 0.01, cur.sp || 0, function (t, v) { t.sp = v; }, function (v) { return Math.round(v * 100) + "%"; }, "spread between copies");
      if (m) {
        var rm = document.createElement("button"); rm.type = "button"; rm.className = "sa-rm"; rm.textContent = "remove Auto";
        rm.setAttribute("aria-label", "Remove Auto from " + opts.label);
        rm.onclick = function () { stash = opts.get(); opts.set(null); draw(); opts.onChange && opts.onChange(); };
        host.appendChild(rm);
      }
    }
    draw();
    return { redraw: draw };
  }

  window.SurfaceAuto = { ICON: ICON, MOTION: MOTION, icon: aIcon, ICONS: AICON, isMotion: function (s) { return !!MOTION_SET[s]; },
    shape: shape, apply: apply, migrate: migrate, seed: seedOf, button: button, lead: lead, decorate: decorate, editor: editor, css: injectCSS };
})();
