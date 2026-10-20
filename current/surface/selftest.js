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
   Counting: when window.cxCount exists, a failure sends the check's built-in name only ("selftest: field"), never error
   text or anything a person typed.

   Plain script, window.SurfaceSelfTest, no dependencies.
     SurfaceSelfTest.start({
       tool: 'Current', version: '0.26.8',
       ready: () => booted,                    // the tool has finished booting (checks wait for it; default: load)
       within: 9000, stall: 4000,              // ms: first beat after load; longest gap between beats
       email: 'hi@chamy.xyz',
       checks: [{ id: 'index', name: 'Index', test: () => !!document.getElementById('idx') }, …]
     })
     SurfaceSelfTest.beat()  beat('paused')  show()  run() → results  report() → text */
(function () {
  "use strict";
  var O = null, ERR = [], last = 0, first = 0, t0 = Date.now(), el = null, shown = false, dismissed = false, results = [];
  var CSS = [
    ".st-card{position:fixed;z-index:9000;left:50%;top:50%;transform:translate(-50%,-50%);box-sizing:border-box;width:min(380px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;",
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
  addEventListener("visibilitychange", function () { if (!document.hidden && !first) t0 = Date.now(); });
  function heart() {
    var now = Date.now();
    if (!first && document.hidden) return null;
    if (!first) return now - t0 > (O.within || 9000) ? "no frame has played since the page loaded" : null;
    if (!document.hidden && now - last > (O.stall || 4000)) return "the frames stopped " + Math.round((now - last) / 1000) + " s ago";
    return true;
  }
  function run() {
    results = [];
    var all = [{ id: "field", name: O.heartName || "Stage playing", test: function () { var h = heart(); return h === null ? "still starting" : h; } }].concat(O.checks || []);
    all.forEach(function (c) {
      var r; try { r = c.test(); } catch (e) { r = "threw: " + (e && e.message || e); }
      results.push({ id: c.id, name: c.name, ok: r === true, why: r === true ? "" : r === false ? "failed" : String(r) });
    });
    return results;
  }
  function report() {
    var lines = [(O.tool || "Tool") + " self-test", "version " + (O.version || "?") + (window.__BUILD__ ? " · build " + window.__BUILD__ : ""), location.href.split("#")[0], navigator.userAgent, ""];
    results.forEach(function (r) { lines.push((r.ok ? "ok   " : "FAIL ") + r.name + (r.why ? ": " + r.why : "")); });
    if (ERR.length) { lines.push("", "Errors and warnings:"); ERR.forEach(function (e) { lines.push(e); }); }
    return lines.join("\n");
  }
  function card(force) {
    var bad = results.filter(function (r) { return !r.ok; });
    if (!el) {
      var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s);
      el = document.createElement("div"); el.className = "st-card"; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-live", "assertive"); document.body.appendChild(el);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && el && !el.hidden) { el.hidden = true; dismissed = true; } }, true);
    }
    el.classList.toggle("ok", !bad.length);
    el.setAttribute("aria-label", bad.length ? "Something isn't working" : "Self-test passed");
    el.innerHTML = '<div class="st-hd"><span>' + (bad.length ? "System check · " + bad.length + " down" : "System check · all clear") + '</span><button type="button" class="st-x" aria-label="Close">×</button></div>' +
      '<div class="st-bd"><p class="st-h">' + (bad.length ? "Something isn’t working" : "Everything is running") + "</p>" +
      (bad.length ? '<p class="st-p">' + esc(O.tool || "The tool") + " checked itself and found a problem. Reload usually fixes it. If it comes back, send the report: it says what failed.</p>" : "") +
      '<ul class="st-l">' + results.map(function (r) { return '<li class="' + (r.ok ? "" : "f") + '"><i>' + (r.ok ? "✓" : "✕") + "</i><span>" + esc(r.name) + (r.why ? "<small>" + esc(r.why) + "</small>" : "") + "</span></li>"; }).join("") + "</ul>" +
      (bad.length && ERR.length ? '<pre class="st-e">' + esc(ERR.slice(-3).join("\n")) + "</pre>" : "") +
      '<div class="st-a">' + (bad.length ? '<button type="button" class="pri" data-a="reload">reload</button>' : "") + '<button type="button" data-a="copy">copy report</button>' + (O.email ? '<button type="button" data-a="mail">email report</button>' : "") + "</div></div>";
    el.querySelector(".st-x").onclick = function () { el.hidden = true; dismissed = true; };
    var rl = el.querySelector('[data-a="reload"]'); if (rl) rl.onclick = function () { location.reload(); };
    el.querySelector('[data-a="copy"]').onclick = function (e) { var b = e.currentTarget, t = report(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = "copied"; }, function () { window.prompt("Copy the report:", t); }); };
    var m = el.querySelector('[data-a="mail"]'); if (m) m.onclick = function () { location.href = "mailto:" + O.email + "?subject=" + encodeURIComponent((O.tool || "Tool") + " self-test " + (O.version || "")) + "&body=" + encodeURIComponent(report().slice(0, 1800)); };
    el.hidden = false; shown = true;
  }
  function check() {
    run();
    var bad = results.filter(function (r) { return !r.ok && r.why !== "still starting"; });
    if (bad.length && !dismissed && !shown) {
      card();
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
      if (!ready) { (O.checks = O.checks || []).unshift({ id: "boot", name: "Start-up", test: function () { return "the tool did not finish starting"; } }); }
      /* a first pass once ready, a second a few seconds later; then the heartbeat alone, every two seconds */
      setTimeout(function () {
        if (check()) return;
        setTimeout(function watch() { run(); var f = results[0]; if (f && !f.ok && f.why !== "still starting" && !dismissed && !shown) check(); else setTimeout(watch, 2000); }, 2000);
      }, Math.max(0, (O.within || 9000) - (Date.now() - t0)));
    };
    if (document.readyState === "complete") go(); else addEventListener("load", go);
    if (/^#selftest$/.test(location.hash) || window.__LINK__ === "selftest") setTimeout(function () { run(); card(true); }, (O.within || 9000) + 500);
    return api;
  }
  /* if the tool's own script died before it could call start(), the kit still speaks: 12 s after load, a card */
  addEventListener("load", function () { setTimeout(function () { if (O) return; O = { tool: document.title || "This tool", version: window.__VERSION__ || "", email: "hi@chamy.xyz", checks: [{ id: "boot", name: "Start-up", test: function () { return "the tool did not finish starting"; } }] }; check(); }, 12000); });
  var api = { start: start, beat: beat, run: run, report: report, show: function () { run(); card(true); }, get errors() { return ERR.slice(); } };
  window.SurfaceSelfTest = api;
})();
