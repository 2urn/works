/* Surface · Self-test — a tool checks itself on load and says so when something is down (Dimitry, 20 Oct 2026:
   "There should be a check system self test on load. If field doesn't play, a system down message appears
   automatically ... loading index, gcode, settings, field presets etc.").

   1. CHECKS. The tool names its parts (the index, the G-code, settings, presets, sound …) and gives each a test that
      returns true, false or a short reason string. They run once the tool says it has booted, and again a few seconds
      later for anything still failing (some parts finish loading late).
   2. THE HEARTBEAT. The tool calls SurfaceSelfTest.beat() from its frame loop after a frame is drawn (or beat('paused')
      when it is paused on purpose). If no beat arrives within `within` ms of load, or beats stop for `stall` ms while
      the page is visible, that is the most important failure: the stage is not playing.
   3. ERRORS. Uncaught errors, rejected promises and console.warn lines are kept (the last 12) for the report.
   4. THE MESSAGE. Any failure brings up a card, automatically: "Something isn't working", the list of checks with a
      tick or a cross, the first error, and three buttons: reload, copy report, email report. When everything passes,
      nothing shows. #selftest (or SurfaceSelfTest.show()) opens the card on demand with every check, pass or fail.
   If the tool never calls start() (its own script died first), the kit shows the card anyway 12 s after load.
   Once the stage has played, a stall is never a card: it is logged, O.recover() is tried, then O.resume() (the tool
   reloads straight back to its state, no cover), at most once a minute; the card shows only if that fails too.
   Start-up failures (the stage never played) still show the card.
   False alarms (20 Oct): a failure must hold on a second look 2.5 s later; coming back from the background restarts
   the heartbeat's clock; a slow start passes once it finishes. The last report shown is kept on the device, and
   #selftest offers "copy last report", so a card closed too soon can still be sent.
   5. THE MASCOT (Dimitry, 20 Oct: "a glitch character of the duck-rabbit as the mascot for the error page ... say
      something congratulatory: you found a bad thing, help us fix it"). The card turns the tool's own mark into
      glitching ASCII: it rasterizes the SVG the page already carries (`mascot: selector`, or any element marked
      data-selftest-mascot), samples its ink into characters and lets a few rows slip and a few glyphs break. It is
      his file, sampled at run time, never a drawing. Still under reduced motion.
   Counting: when window.cxCount exists, a failure sends the check's built-in name only ("selftest: field"), never error
   text or anything a person typed.

   Plain script, window.SurfaceSelfTest, no dependencies.
     SurfaceSelfTest.start({
       tool: 'Current', version: '0.26.8',
       ready: () => booted,                    // the tool has finished booting (checks wait for it; default: load)
       within: 9000, stall: 4000,              // ms: first beat after load; longest gap between beats
       email: 'hi@chamy.xyz',
       recover: () => …,                      // try to get the frames going again without a reload
       resume: () => …,                       // save state, reload straight back to it (no cover, no opening)
       mascot: '#duckBtn svg',                // the mark to glitch (default: [data-selftest-mascot])
       checks: [{ id: 'index', name: 'Index', test: () => !!document.getElementById('idx') }, …]
     })
     SurfaceSelfTest.beat()  beat('paused')  show()  run() → results  report() → text */
(function () {
  "use strict";
  var O = null, ERR = [], last = 0, first = 0, t0 = Date.now(), el = null, shown = false, dismissed = false, results = [];
  var CSS = [
    ".st-card{position:fixed;z-index:9000;left:50%;top:50%;transform:translate(-50%,-50%);box-sizing:border-box;width:min(380px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;scrollbar-gutter:stable;",
    "  border-radius:18px;background:rgb(var(--ui-g,14 14 16) / .94);border:1px solid #ff6a3d;box-shadow:0 0 0 1px #ff6a3d,0 18px 60px rgba(0,0,0,.6);",
    "  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);color:var(--ui-ink,#eef1f2);font:14px/1.45 var(--sans,system-ui,sans-serif)}",
    ".st-card.ok{border-color:rgb(var(--ui-hi,255 255 255) / .2);box-shadow:0 18px 60px rgba(0,0,0,.6)}",
    ".st-card[hidden]{display:none}",
    ".st-hd{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 4px 0 14px;border-bottom:1px solid rgb(var(--ui-hi,255 255 255) / .08);font:500 10px/1.2 var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.16em;text-transform:uppercase;color:#ff6a3d}",
    ".st-card.ok .st-hd{color:var(--ui-dim,#a8a8a8)}.st-hd span{flex:1}",
    ".st-x{width:36px;height:36px;padding:0;border:0;background:none;color:var(--ui-dim,#8f8f8f);cursor:pointer;font-size:18px}",
    ".st-bd{padding:12px 14px 14px;display:grid;gap:10px}",
    ".st-h{margin:0;font:600 18px/1.25 var(--sans,system-ui,sans-serif)}",
    ".st-p{margin:0;font-size:13.5px;color:var(--ui-mid,#c9cfd1)}",
    ".st-l{list-style:none;margin:0;padding:0;display:grid;gap:4px;font:12px/1.35 var(--mono,ui-monospace,Menlo,monospace)}",
    ".st-l li{display:grid;grid-template-columns:18px minmax(0,1fr);gap:6px}.st-l i{font-style:normal;color:#6fd08c}.st-l li.f i{color:#ff6a3d}.st-l small{display:block;color:var(--ui-dim,#a8a8a8)}",
    ".st-e{margin:0;padding:8px;border-radius:8px;background:rgb(var(--ui-hi,255 255 255) / .06);font:11px/1.4 var(--mono,ui-monospace,Menlo,monospace);white-space:pre-wrap;word-break:break-word;max-height:7.5em;overflow:auto;color:var(--ui-mid,#c9cfd1)}",
    ".st-a{display:flex;flex-wrap:wrap;gap:8px}",
    ".st-m{margin:2px auto 0;font:700 7.5px/7px var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.5px;color:var(--ui-ink,#fff);white-space:pre;text-align:left;",
    "  text-shadow:-1.5px 0 rgba(255,60,90,.85),1.5px 0 rgba(60,220,255,.85);user-select:none;min-height:1em}",
    ".st-k{margin:0;font:500 10px/1.2 var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.16em;text-transform:uppercase;color:#ff6a3d}",
    ".st-a button{min-height:36px;padding:0 12px;border-radius:10px;border:1px solid rgb(var(--ui-hi,255 255 255) / .2);background:none;color:var(--ui-ink,#fff);cursor:pointer;font:600 10.5px/1 var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.12em;text-transform:uppercase}",
    ".st-a button.pri{background:#ff6a3d;border-color:#ff6a3d;color:#0b0f10}",
    ".st-a button:focus-visible,.st-x:focus-visible{outline:2px solid #fff;outline-offset:2px}"
  ].join("\n");

  function keep(kind, msg) { ERR.push(kind + ": " + String(msg).slice(0, 300)); if (ERR.length > 12) ERR.shift(); }
  addEventListener("error", function (e) { keep("error", (e.message || e.error || "unknown") + (e.filename ? " (" + e.filename.split("/").pop().split("?")[0] + ":" + e.lineno + ")" : "")); }, true);
  addEventListener("unhandledrejection", function (e) { var r = e.reason; keep("promise", r && (r.stack || r.message) || r); });
  var cw = console.warn; console.warn = function () { try { keep("warn", Array.prototype.map.call(arguments, function (a) { return a && a.message ? a.message : String(a); }).join(" ")); } catch (e) {} return cw.apply(console, arguments); };

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function beat(state) { last = Date.now(); if (!first) first = last; if (state === "paused") beat.paused = true; else beat.paused = false; }
  /* back from the background (another app, the lock screen, the back-forward cache): the frames have not had a chance
     to run yet, so the clock starts again rather than calling a stall (20 Oct: a false alarm on iPhone) */
  var wake = function () { if (document.hidden) return; var n = Date.now(); if (!first) t0 = n; else last = n; };
  addEventListener("visibilitychange", wake); addEventListener("pageshow", wake); addEventListener("focus", wake);
  /* the browser's own frame clock (Dimitry, 21 Oct: the claude.ai preview "stalled" and reloaded itself). A frame from
     another site that is scrolled off screen, a collapsed pane or a covered window gets no frames at all while
     document.hidden stays false. The kit keeps one tiny frame of its own: while it doesn't run either, the browser is
     not drawing, which is not the tool's stall. When frames come back the clocks start again, like a return. */
  var drawn = Date.now();
  (function tick() { var n = Date.now(); if (n - drawn > 1000) { if (!first) t0 = n; else last = n; } drawn = n; requestAnimationFrame(tick); })();
  function asleep() { return document.hidden || Date.now() - drawn > 1000; }
  function heart() {
    var now = Date.now();
    if (asleep()) return first ? true : null;
    if (!first) return now - t0 > (O.within || 9000) ? "no frame has played since the page loaded" : null;
    if (!document.hidden && now - last > (O.stall || 4000)) return "the frames stopped " + Math.round((now - last) / 1000) + " s ago";
    return true;
  }
  function run() {
    results = [];
    var all = [{ id: "field", name: O.heartName || "Stage playing", test: function () { var h = heart(); return h === null ? "still starting" : (first && h !== true && !unhealed) ? "still starting" : h; } }].concat(O.checks || []);
    all.forEach(function (c) {
      var r; try { r = c.test(); } catch (e) { r = "threw: " + (e && e.message || e); }
      results.push({ id: c.id, name: c.name, ok: r === true, why: r === true ? "" : r === false ? "failed" : String(r) });
    });
    return results;
  }
  /* ---- the log: what went wrong and what was done about it, kept on the device (last 20) ---- */
  var LOGK = "surface.selftest.log", unhealed = false;
  function logGet() { try { return JSON.parse(localStorage.getItem(LOGK + "." + ((O && O.tool) || "tool")) || "[]") || []; } catch (e) { return []; } }
  function log(what) {
    var l = logGet(); l.push({ at: new Date().toISOString(), what: what, err: ERR.slice(-2) });
    try { localStorage.setItem(LOGK + "." + ((O && O.tool) || "tool"), JSON.stringify(l.slice(-20))); } catch (e) {}
  }
  function report() {
    var lines = [(O.tool || "Tool") + " self-test", "version " + (O.version || "?") + (window.__BUILD__ ? " · build " + window.__BUILD__ : ""), location.href.split("#")[0], navigator.userAgent, ""];
    /* Display (24 Oct 2026): what this device saw, so a report from any device says how big things were there */
    try { lines.push("Display: " + (window.SurfaceSize ? SurfaceSize.line() : "window " + innerWidth + "×" + innerHeight + " · screen " + screen.width + "×" + screen.height + " · pixel ratio " + (Math.round(devicePixelRatio * 100) / 100) + " · " + (matchMedia("(pointer:coarse)").matches ? "finger" : "mouse")), ""); } catch (e) {}
    results.forEach(function (r) { lines.push((r.ok ? "ok   " : "FAIL ") + r.name + (r.why ? ": " + r.why : "")); });
    if (ERR.length) { lines.push("", "Errors and warnings:"); ERR.forEach(function (e) { lines.push(e); }); }
    var lg = logGet(); if (lg.length) { lines.push("", "Log (this device):"); lg.forEach(function (e) { lines.push(e.at + "  " + e.what + (e.err && e.err.length ? "  [" + e.err.join(" / ") + "]" : "")); }); }
    return lines.join("\n");
  }
  /* ---- the mascot: the page's own mark, sampled into ASCII, glitching ---- */
  var RAMP = " .:-=+*#%@", GL = "░▒▓█/\\|<>_~#%", mt = 0;
  function mascot(pre) {
    var src = null; try { src = document.querySelector(O.mascot || "[data-selftest-mascot]"); } catch (e) {}
    if (!src || !pre) { if (pre) pre.remove(); return; }
    var svg = src.closest && src.tagName.toLowerCase() !== "svg" ? src.querySelector("svg") : src; if (!svg) { pre.remove(); return; }
    var c = svg.cloneNode(true); c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    var vb = (c.getAttribute("viewBox") || "0 0 100 100").split(/[\s,]+/).map(Number), ar = vb[3] / vb[2] || 1;
    var cols = 34, rows = Math.max(8, Math.round(cols * ar * 0.5)), W = cols * 4, H = Math.round(W * ar);
    c.setAttribute("width", W); c.setAttribute("height", H); c.removeAttribute("class"); c.setAttribute("style", "fill:#000;color:#000");
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement("canvas"); cv.width = W; cv.height = H; var g = cv.getContext("2d"); g.drawImage(img, 0, 0, W, H);
      var d; try { d = g.getImageData(0, 0, W, H).data; } catch (e) { pre.remove(); return; }
      var base = [];
      for (var y = 0; y < rows; y++) {
        var line = "";
        for (var x = 0; x < cols; x++) {
          var a = 0, n = 0, x0 = Math.floor(x * W / cols), x1 = Math.floor((x + 1) * W / cols), y0 = Math.floor(y * H / rows), y1 = Math.floor((y + 1) * H / rows);
          for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) { a += d[(yy * W + xx) * 4 + 3]; n++; }
          var v = n ? a / n / 255 : 0; line += RAMP[Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1)))];
        }
        base.push(line.replace(/\s+$/, ""));
      }
      while (base.length && !base[0].trim()) base.shift(); while (base.length && !base[base.length - 1].trim()) base.pop();
      var still = matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      var draw = function () {
        if (!pre.isConnected) return;
        var out = base.map(function (l) {
          if (still) return l;
          var s = l;
          if (Math.random() < .12) { var k = (Math.random() * 4 | 0) - 2; s = k > 0 ? new Array(k + 1).join(" ") + s : s.slice(-k); }
          if (Math.random() < .2) s = s.replace(/[^ ]/g, function (ch) { return Math.random() < .08 ? GL[Math.random() * GL.length | 0] : ch; });
          return s;
        });
        pre.textContent = out.join("\n");
        if (!still) mt = setTimeout(draw, Math.random() < .2 ? 60 : 180 + Math.random() * 420);
      };
      clearTimeout(mt); draw();
    };
    img.onerror = function () { pre.remove(); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(c));
  }
  function card(force) {
    var bad = results.filter(function (r) { return !r.ok; }), LAST = lastReport();
    if (!el) {
      var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s);
      el = document.createElement("div"); el.className = "st-card"; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-live", "assertive"); document.body.appendChild(el);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && el && !el.hidden) { el.hidden = true; dismissed = true; } }, true);
    }
    el.classList.toggle("ok", !bad.length);
    el.setAttribute("aria-label", bad.length ? "You found a bad thing. Help us fix it" : "Self-test passed");
    el.innerHTML = '<div class="st-hd"><span>' + (bad.length ? "System check · " + bad.length + " down" : "System check · all clear") + '</span><button type="button" class="st-x" aria-label="Close">×</button></div>' +
      '<div class="st-bd">' + (bad.length ? '<pre class="st-m" aria-hidden="true"></pre><p class="st-k">✦ Congratulations</p>' : "") +
      '<p class="st-h">' + (bad.length ? "You found a bad thing. Help us fix it!" : "Everything is running") + "</p>" +
      (bad.length ? '<p class="st-p">' + esc(O.tool || "The tool") + " checked itself and something is broken. Send the report: it says exactly what failed, and that is how it gets fixed. Reload usually gets you playing again.</p>" : "") +
      '<ul class="st-l">' + results.map(function (r) { return '<li class="' + (r.ok ? "" : "f") + '"><i>' + (r.ok ? "✓" : "✕") + "</i><span>" + esc(r.name) + (r.why ? "<small>" + esc(r.why) + "</small>" : "") + "</span></li>"; }).join("") + "</ul>" +
      (bad.length && ERR.length ? '<pre class="st-e">' + esc(ERR.slice(-3).join("\n")) + "</pre>" : "") +
      (!bad.length && LAST ? '<p class="st-p">The last problem was ' + esc(new Date(LAST.at).toLocaleString()) + '. Its report is kept here so you can still send it.</p>' : "") +
      '<div class="st-a">' + (bad.length ? '<button type="button" class="pri" data-a="reload">reload</button>' : "") + (!bad.length && LAST ? '<button type="button" class="pri" data-a="last">copy last report</button>' : "") + '<button type="button" data-a="copy">copy report</button>' + (O.email ? '<button type="button" data-a="mail">email report</button>' : "") + "</div></div>";
    el.querySelector(".st-x").onclick = function () { el.hidden = true; dismissed = true; };
    var lb = el.querySelector('[data-a="last"]'); if (lb) lb.onclick = function () { var t = LAST.text; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { lb.textContent = "copied"; }, function () { window.prompt("Copy the report:", t); }); };
    var rl = el.querySelector('[data-a="reload"]'); if (rl) rl.onclick = function () { location.reload(); };
    el.querySelector('[data-a="copy"]').onclick = function (e) { var b = e.currentTarget, t = report(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = "copied"; }, function () { window.prompt("Copy the report:", t); }); };
    var m = el.querySelector('[data-a="mail"]'); if (m) m.onclick = function () { location.href = "mailto:" + O.email + "?subject=" + encodeURIComponent((O.tool || "Tool") + " self-test " + (O.version || "")) + "&body=" + encodeURIComponent(report().slice(0, 1800)); };
    if (bad.length) mascot(el.querySelector(".st-m"));
    el.hidden = false; shown = true;
  }
  /* a failure has to hold for a second look 2.5 s later before the card shows: one late frame is not a broken tool */
  var LASTK = "surface.selftest.last";
  function check(confirmed) {
    run();
    var bad = results.filter(function (r) { return !r.ok && r.why !== "still starting"; });
    if (bad.length && !confirmed) { setTimeout(function () { if (!dismissed && !shown) check(true); }, 2500); return bad.length; }
    if (bad.length && !dismissed && !shown) {
      card();
      /* kept, so a report closed too soon can still be sent: #selftest shows it */
      try { localStorage.setItem(LASTK + "." + (O.tool || "tool"), JSON.stringify({ at: new Date().toISOString(), text: report() })); } catch (e) {}
      if (window.cxCount) bad.forEach(function (r) { try { cxCount("selftest: " + r.id, 1); } catch (e) {} });
    }
    return bad.length;
  }
  function start(o) {
    O = o || {};
    var waited = 0, go = function () {
      var ready = true; try { ready = O.ready ? !!O.ready() : true; } catch (e) { ready = false; }
      waited += 500;
      if (!ready && waited < (O.within || 9000)) return setTimeout(go, 500);
      /* a slow start is only a failure while it lasts: the check asks again each time */
      if (!ready) { (O.checks = O.checks || []).unshift({ id: "boot", name: "Start-up", test: function () { try { return !!O.ready() || "the tool did not finish starting"; } catch (e) { return "the tool did not finish starting"; } } }); }
      /* a first pass once ready, a second a few seconds later; then the heartbeat alone, every two seconds */
      setTimeout(function () {
        var h0 = heart(); if (first && h0 !== true && h0 !== null) heal(h0); else check();
        var watch = function () {
          var h = heart();
          /* once the stage has played, a stall never interrupts with a card (Dimitry, 20 Oct: a performer on HDMI must
             not see one): it is logged, the tool is asked to recover, and if the frames don't come back, the tool
             resumes itself (a reload straight back to where it was). The card only shows when that fails too. */
          if (first && h !== true && h !== null) { heal(h); return; }
          run(); var f = results[0]; if (f && !f.ok && f.why !== "still starting" && !dismissed && !shown) check();
          if (!shown && !dismissed) setTimeout(watch, 2000);
        };
        setTimeout(watch, 2000);
        function heal(why) {
          log("stall: " + why); if (window.cxCount) try { cxCount("selftest: stall", 1); } catch (e) {}
          var before = last;
          try { if (O.recover) O.recover(); } catch (e) { keep("recover", e && e.message || e); }
          setTimeout(function () {
            if (last > before && Date.now() - last < 1500) { log("recovered by itself"); return setTimeout(watch, 2000); }
            if (asleep()) return setTimeout(watch, 2000);   // the browser stopped drawing meanwhile: never reload a page nobody sees
            var k = "surface.selftest.resumed." + (O.tool || "tool"), prev = 0; try { prev = +sessionStorage.getItem(k) || 0; } catch (e) {}
            if (O.resume && Date.now() - prev > 60000) {
              log("resumed: reloaded back to where it was");
              try { sessionStorage.setItem(k, String(Date.now())); } catch (e) {}
              try { return O.resume(); } catch (e) { keep("resume", e && e.message || e); }
            }
            log("could not recover"); unhealed = true; check(true);
          }, 3000);
        }
      }, Math.max(0, (O.within || 9000) - (Date.now() - t0)));
    };
    if (document.readyState === "complete") go(); else addEventListener("load", go);
    if (/^#selftest$/.test(location.hash) || window.__LINK__ === "selftest") setTimeout(function () { run(); card(true); }, (O.within || 9000) + 500);
    return api;
  }
  /* if the tool's own script died before it could call start(), the kit still speaks: 12 s after load, a card */
  addEventListener("load", function () { setTimeout(function () { if (O) return; O = { tool: document.title || "This tool", version: window.__VERSION__ || "", email: "hi@chamy.xyz", checks: [{ id: "boot", name: "Start-up", test: function () { return "the tool did not finish starting"; } }] }; check(); }, 12000); });
  function lastReport() { try { return JSON.parse(localStorage.getItem(LASTK + "." + ((O && O.tool) || "tool")) || "null"); } catch (e) { return null; } }
  var api = { start: start, beat: beat, run: run, report: report, last: lastReport, log: logGet, show: function () { run(); card(true); }, get errors() { return ERR.slice(); } };
  window.SurfaceSelfTest = api;
})();
