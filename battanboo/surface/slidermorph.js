/* Surface · Slider morph — a slider whose handle carries a +. Hold the handle and the slider stays put while a section
   opens below with how it moves by itself: Motion (Still, Ping-pong, Sweep, Drift), Speed (Slow, Medium, Fast) and
   Span (Small, Wide, Full). The handle shows a − while the section is open. Canon (Dimitry, 16 Nov 2026).

   His rules, as built:
   - The mark on the handle is neutral (grey) and turns to the accent while the slider is set to move. The readout
     already turns to the accent when the value is not the default (CONVENTIONS › Changed vs. preset): both can show.
   - Two dots on the track mark the reach of the swing; a faint one marks its centre (where the slider sits).
   - Speed is a number of beats, never seconds: a faster tempo gives a shorter swing, a slower tempo a longer one.
     Slow 32 beats, Medium 8, Fast 2 (a swing is one full there-and-back, or one sweep).
   - The swing is around where the slider sits. Dragging it, or gliding it home with the double-tap, re-centres it.
   - Only continuous parameters carry it (a level, an amount). Counts, sizes and tempo itself do not: a morph on those
     would rebuild the instrument 60 times a second.
   - Hold = 520 ms on the handle with under 6 px of movement. Shift+Enter on a focused slider does the same.
   - The settings are kept (localStorage, one key per tool).
   - Touching any other control closes the open section (a press on a button, field or slider outside it).
   - Copy and Paste icons in the section carry one slider's settings (motion, speed, span) to another, across tools too.

   Plain script, window.SurfaceSliderMorph, no dependencies. The slider keeps whatever chrome the tool gives it; this
   only adds the handle mark, the dots and the section, all keyed on the attribute [data-morph].

     SurfaceSliderMorph.attach(rangeInput, {
       store: "mytool.morph",          // localStorage key for the settings (default "surface.morph")
       bpm:   () => 120,               // beats per minute, read every frame; without it the tempo is 60
       row:   ".ctl",                  // the row the section is inserted after (default the nearest .ctl, .arow or .hrow)
     });
     SurfaceSliderMorph.stop(rangeInput)   // back to Still, without touching the stored value

   A drift or a swing sets the slider's value and fires a bubbling `input` event (not trusted), so the tool's own
   handler runs as for a drag. A tool that must tell the two apart reads event.isTrusted. */
(function () {
  "use strict";
  if (window.SurfaceSliderMorph) return;

  var CSS =
    "input[type=range][data-morph]{--gc:var(--muted,#888);--gv:2px}" +
    "input[type=range][data-morph][data-mm]{--gc:var(--accent,#fc3)}" +
    "input[type=range][data-morph][data-open]{--gv:0px}" +
    "input[type=range][data-morph]::-webkit-slider-thumb{width:20px!important;height:20px!important;margin-top:-9px!important;" +
    "background:linear-gradient(var(--gc),var(--gc)) center/9px 2px no-repeat,linear-gradient(var(--gc),var(--gc)) center/var(--gv) 9px no-repeat,var(--surface,#fff)!important;box-shadow:0 0 0 1.5px var(--gc)!important;border:0!important}" +
    "input[type=range][data-morph]::-moz-range-thumb{width:20px!important;height:20px!important;" +
    "background:linear-gradient(var(--gc),var(--gc)) center/9px 2px no-repeat,linear-gradient(var(--gc),var(--gc)) center/var(--gv) 9px no-repeat,var(--surface,#fff)!important;box-shadow:0 0 0 1.5px var(--gc)!important;border:0!important}" +
    "@media (pointer:coarse){input[type=range][data-morph]::-webkit-slider-thumb{width:26px!important;height:26px!important;margin-top:-12px!important}input[type=range][data-morph]::-moz-range-thumb{width:26px!important;height:26px!important}}" +
    "input[type=range][data-morph][data-run]{animation:ssmRun 2.4s ease-in-out infinite}@keyframes ssmRun{50%{--gc:color-mix(in srgb,var(--accent,#fc3) 55%,var(--muted,#888))}}" +
    "@media (prefers-reduced-motion:reduce){input[type=range][data-morph][data-run]{animation:none}}" +
    ".ssm-dots{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none}" +
    ".ssm-dots i{position:absolute;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:var(--accent,#fc3);opacity:.9}" +
    ".ssm-dots i.c{opacity:.35;width:4px;height:4px;margin:-2px 0 0 -2px}" +
    ".ssm-sec{grid-column:1/-1;display:grid;gap:6px;padding:8px 0 4px;border-top:1px solid var(--line,#8884)}" +
    ".ssm-sec[hidden]{display:none}" +
    ".ssm-sec .ssm-r{display:flex;flex-wrap:wrap;gap:5px;align-items:center}" +
    ".ssm-sec .ssm-t{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#888);min-width:46px}" +
    ".ssm-sec .ssm-n{font-size:10px;color:var(--muted,#888);margin:0;flex:1;min-width:0}" +
    ".ssm-sec .ssm-f{display:flex;align-items:center;gap:6px}" +
    ".ssm-sec button.ssm-i{width:28px;height:24px;min-height:24px;padding:0;flex:none;display:inline-grid;place-items:center}" +
    ".ssm-sec button.ssm-i svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}" +
    ".ssm-sec button.ssm-i:disabled{opacity:.35;cursor:default}" +
    ".ssm-sec button{min-height:26px;padding:0 10px;border-radius:13px;border:1px solid var(--line,#8884);background:transparent;color:var(--fg,#222);font:600 11px var(--ui,system-ui);cursor:pointer}" +
    ".ssm-sec button[aria-pressed=\"true\"]{background:var(--accent,#fc3);border-color:var(--accent,#fc3);color:var(--accent-ink,#000)}";

  function css() {
    if (document.getElementById("ssm-css")) return;
    var s = document.createElement("style"); s.id = "ssm-css"; s.textContent = CSS; (document.head || document.documentElement).appendChild(s);
  }

  var BEATS = { slow: 32, mid: 8, fast: 2 };
  var SPAN = { s: 0.12, w: 0.35, f: 1 };
  var P0 = { still: 0, pingpong: 0.25, sweep: 0.5, drift: 0 };
  var MM = new Map();
  var CLIP = "surface.morph.clip", clip = null;
  try { clip = JSON.parse(localStorage.getItem(CLIP) || "null"); } catch (e) {}
  var running = false, last = 0;

  function load(key) { try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) { return {}; } }
  function save(key) {
    var o = {};
    MM.forEach(function (q, r) { if (q.key === key && r.id && q.m !== "still") o[r.id] = { m: q.m, sp: q.sp, w: q.w }; });
    try { localStorage.setItem(key, JSON.stringify(o)); } catch (e) {}
  }
  function num(v) { return +v; }
  function reach(r, q) {
    var mn = num(r.min), mx = num(r.max), rng = mx - mn, w = SPAN[q.w] * rng;
    if (q.w === "f") return [mn, mx];
    var lo = Math.max(mn, Math.min(mx - w, q.anchor - w / 2));
    return [lo, lo + w];
  }
  function dots(r, q) {
    var c = q.row; if (!c) return;
    var d = q.dots, show = q.open || q.m !== "still";
    if (!show) { if (d) d.hidden = true; return; }
    if (!d) {
      d = q.dots = document.createElement("div"); d.className = "ssm-dots"; d.setAttribute("aria-hidden", "true");
      for (var i = 0; i < 3; i++) { var e = document.createElement("i"); if (i === 2) e.className = "c"; d.appendChild(e); }
      c.appendChild(d); if (getComputedStyle(c).position === "static") c.style.position = "relative";
    }
    d.hidden = false;
    var tw = matchMedia("(pointer:coarse)").matches ? 26 : 20, mn = num(r.min), rng = (num(r.max) - mn) || 1, rc = reach(r, q);
    var x = function (v) { return r.offsetLeft + tw / 2 + ((v - mn) / rng) * (r.offsetWidth - tw); }, y = r.offsetTop + r.offsetHeight / 2;
    [rc[0], rc[1], q.anchor].forEach(function (v, i) { var e = d.children[i]; e.style.left = x(v) + "px"; e.style.top = y + "px"; });
  }
  function flags(r, q) {
    r.toggleAttribute("data-mm", q.m !== "still"); r.toggleAttribute("data-run", q.m !== "still"); r.toggleAttribute("data-open", !!q.open);
    dots(r, q);
  }
  function mark(q) {
    if (!q.box) return;
    q.box.querySelectorAll("button").forEach(function (k) { k.setAttribute("aria-pressed", String(q[k.dataset.k] === k.dataset.v)); });
  }
  function panel(r, q) {
    var b = q.box;
    if (!b) {
      b = q.box = document.createElement("div"); b.className = "ssm-sec"; b.setAttribute("role", "group");
      b.setAttribute("aria-label", "Morph: " + ((q.row.textContent || "").trim().split(/\s{2,}|:/)[0]));
      var row = function (t, key, opts) {
        var d = document.createElement("div"); d.className = "ssm-r";
        var l = document.createElement("span"); l.className = "ssm-t"; l.textContent = t; d.appendChild(l);
        opts.forEach(function (o) {
          var k = document.createElement("button"); k.type = "button"; k.textContent = o[1]; k.dataset.k = key; k.dataset.v = o[0];
          k.onclick = function () {
            if (key === "m" && o[0] !== "still" && q.m === "still") { q.anchor = num(r.value); q.p0 = P0[o[0]]; q.ph = q.p0; }
            q[key] = o[0]; flags(r, q); mark(q); save(q.key);
          };
          d.appendChild(k);
        });
        b.appendChild(d);
      };
      row("Motion", "m", [["still", "Still"], ["pingpong", "Ping-pong"], ["sweep", "Sweep"], ["drift", "Drift"]]);
      row("Speed", "sp", [["slow", "Slow"], ["mid", "Medium"], ["fast", "Fast"]]);
      row("Span", "w", [["s", "Small"], ["w", "Wide"], ["f", "Full"]]);
      var f = document.createElement("div"); f.className = "ssm-f";
      var n = document.createElement("p"); n.className = "ssm-n"; n.setAttribute("aria-live", "polite"); f.appendChild(n);
      var NOTE = "Speed follows the tempo: 32, 8 or 2 beats a swing.";
      n.textContent = NOTE;
      var say = function (t) { n.textContent = t; clearTimeout(q.nt); q.nt = setTimeout(function () { n.textContent = NOTE; }, 1400); };
      var ic = function (label, svg, fn) {
        var k = document.createElement("button"); k.type = "button"; k.className = "ssm-i"; k.title = label; k.setAttribute("aria-label", label);
        k.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true">' + svg + "</svg>"; k.onclick = fn; f.appendChild(k); return k;
      };
      var pb;
      ic("Copy these morph settings", '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5v-.5A1 1 0 0 0 9.5 2h-6A1 1 0 0 0 2.5 3v6a1 1 0 0 0 1 1h.5"/>', function () {
        clip = { m: q.m, sp: q.sp, w: q.w };
        try { localStorage.setItem(CLIP, JSON.stringify(clip)); } catch (e) {}
        MM.forEach(function (qq) { if (qq.paste) qq.paste.disabled = false; });
        say("Copied");
      });
      pb = q.paste = ic("Paste morph settings here", '<rect x="3" y="3.5" width="10" height="10" rx="1.5"/><path d="M6 3.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v.5M6 8h4M6 10.5h4"/>', function () {
        if (!clip) return;
        if (clip.m !== "still" && q.m === "still") { q.anchor = num(r.value); q.p0 = P0[clip.m]; q.ph = q.p0; }
        else if (clip.m !== q.m && clip.m !== "still") q.ph = P0[clip.m] || 0;
        q.m = clip.m; q.sp = clip.sp; q.w = clip.w; flags(r, q); mark(q); save(q.key); say("Pasted");
      });
      pb.disabled = !clip;
      b.appendChild(f);
      q.row.after(b); mark(q);
    }
    return b;
  }
  function toggle(r) {
    var q = MM.get(r); if (!q) return;
    q.open = !q.open;
    if (q.open) { if (q.m === "still") q.anchor = num(r.value); panel(r, q).hidden = false; }
    else if (q.box) q.box.hidden = true;
    flags(r, q);
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
  }
  document.addEventListener("pointerdown", function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest("button,input,select,textarea,a,summary,label,[role=button],[role=slider],[role=switch]")) return;
    MM.forEach(function (q, r) {
      if (!q.open || t === r || (q.box && q.box.contains(t)) || (q.row && q.row.contains(t))) return;
      toggle(r);
    });
  }, true);
  function tick(now) {
    var dt = Math.min(0.25, (now - last) / 1000); last = now;
    MM.forEach(function (q, r) {
      if (q.m === "still" || q.drag || !r.isConnected) return;
      var bpm = 60; try { bpm = q.bpm() || 60; } catch (e) {}
      q.ph += dt * bpm / 60 / BEATS[q.sp];
      var rc = reach(r, q), ph = q.ph, fr = ph - Math.floor(ph), u;
      if (q.m === "pingpong") u = 1 - Math.abs(1 - 2 * fr);
      else if (q.m === "sweep") u = fr;
      else { var t = ph * 4.4 / 3.2; u = 0.5 + 0.5 * (Math.sin(t + 1) * 0.5 + Math.sin(t * 1.61 + 2.3) * 0.3 + Math.sin(t * 0.43) * 0.2); }
      var v = rc[0] + u * (rc[1] - rc[0]), st = num(r.step);
      if (st > 0) v = Math.round((v - num(r.min)) / st) * st + num(r.min);
      v = Math.max(num(r.min), Math.min(num(r.max), v));
      if (Math.abs(v - num(r.value)) > 1e-9) { r.value = v; r.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    requestAnimationFrame(tick);
  }

  function attach(r, o) {
    if (!r || r.type !== "range" || MM.has(r)) return;
    o = o || {}; css();
    var key = o.store || "surface.morph", sv = load(key)[r.id] || {};
    var q = {
      key: key, bpm: o.bpm || function () { return 60; },
      m: sv.m || "still", sp: sv.sp || "mid", w: sv.w || "w",
      anchor: num(r.value), ph: 0, open: false,
      row: (o.row ? r.closest(o.row) : (r.closest(".ctl") || r.closest(".arow") || r.closest(".hrow"))) || r.parentElement
    };
    q.ph = P0[q.m] || 0;
    MM.set(r, q);
    r.setAttribute("data-morph", ""); r.setAttribute("aria-description", "Hold the handle to open its morph controls");
    flags(r, q);
    var h = null;
    r.addEventListener("pointerdown", function (e) {
      q.drag = true;
      var rc = r.getBoundingClientRect(), tw = e.pointerType === "mouse" ? 20 : 26, f = (num(r.value) - num(r.min)) / ((num(r.max) - num(r.min)) || 1), cx = rc.left + tw / 2 + f * (rc.width - tw);
      if (Math.abs(e.clientX - cx) > tw * 0.8) return;
      h = { x: e.clientX, y: e.clientY, t: setTimeout(function () { if (h) { h.fired = true; toggle(r); } }, 520) };
    });
    var up = function () { q.drag = false; if (h) { clearTimeout(h.t); h = null; } };
    r.addEventListener("pointerup", up); r.addEventListener("pointercancel", up);
    r.addEventListener("pointermove", function (e) { if (h && !h.fired && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 6) { clearTimeout(h.t); h = null; } });
    r.addEventListener("change", function () { q.anchor = num(r.value); dots(r, q); });
    r.addEventListener("input", function (e) { if (e.isTrusted) { q.anchor = num(r.value); dots(r, q); } });
    r.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); toggle(r); } });
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); addEventListener("resize", function () { MM.forEach(function (qq, rr) { dots(rr, qq); }); }); }
  }
  function stop(r) { var q = MM.get(r); if (!q) return; q.m = "still"; flags(r, q); mark(q); save(q.key); }

  window.SurfaceSliderMorph = { attach: attach, stop: stop };
})();
