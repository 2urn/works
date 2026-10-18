/* Surface · Hints — first-run hints, and how much a tool explains itself (Dimitry, 18 Oct 2026).

   1. START HERE. Sound in a browser waits for a tap, so a sound-driven tool points at its speaker the first time it
      is opened: once the cover has gone and the namemark has faded, "start here" and an arrow sit over the sound
      button, which pulses three times in the accent, then everything fades. Once per tool, per device. Turning the
      sound on, or a tap anywhere, ends it early. Skipped when the sound is already on or hints are off.
   2. THE HINT LEVEL, one setting shared by every tool on the same site:
        all     every hint (the default)
        titles  preset names still show as the looks change; no start-here or other coach marks
        none    a clean stage: no titles either
      Hover and long-press tooltips (tips.js) stay at every level: they only show when asked for.
      The level is written on <html data-hints="…">. A tool marks its preset-name caption with the class
      sh-title and it hides at "none"; anything marked sh-coach hides below "all".
   3. THE DISPLAY CONTROLS, for the index: the three levels and "show hints again" (replays the first-run hints).

   Plain script, window.SurfaceHints, no dependencies.
     SurfaceHints.start({
       key: 'strand',                       // which tool (first-run memory is per tool)
       target: '#pSnd',                     // the sound button
       isOn: () => SND.on,                  // sound already on? then no hint
       wait: () => !document.getElementById('sc-launch'),   // ready once the cover has gone (default: no cover on the page)
       after: 3200,                         // ms after ready: the namemark's fade
       text: 'Start here'
     })
     SurfaceHints.controls(host)           // the Display controls, into the index
     SurfaceHints.level / SurfaceHints.set('titles') / SurfaceHints.replay()
   Events: 'surface:hints' on document, detail { level }. */
(function () {
  "use strict";
  var KEY = "surface.hints", LEVELS = [["all", "all hints", "Every hint, for a first visit"], ["titles", "titles only", "Preset names only: no start-here hints"], ["none", "none", "A clean stage: no hints or titles"]];
  var CSS = [
    "[data-hints=none] .sh-title,[data-hints=none] .sh-coach,[data-hints=titles] .sh-coach{display:none!important}",
    ".sh-here{position:fixed;z-index:40;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none;",
    "  font:600 11px/1 var(--sc-mono,ui-monospace,Menlo,monospace);letter-spacing:.2em;text-transform:uppercase;color:#fff;text-shadow:0 1px 6px #000;",
    "  opacity:0;transition:opacity .5s ease}",
    ".sh-here.show{opacity:1}",
    ".sh-here span{display:block;white-space:nowrap;text-align:center}",
    ".sh-here svg{width:18px;height:22px;fill:none;stroke:var(--sh-acc,var(--sc-acc,#fff));stroke-width:2;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 4px #000);animation:sh-bob 1.1s ease-in-out infinite}",
    "@keyframes sh-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}",
    ".sh-pulse{animation:sh-pulse 1.3s ease-out 3}",
    "@keyframes sh-pulse{0%{box-shadow:0 0 0 0 var(--sh-ring,rgba(255,255,255,.7))}100%{box-shadow:0 0 0 18px rgba(0,0,0,0)}}",
    "@media (prefers-reduced-motion:reduce){.sh-here svg,.sh-pulse{animation:none}.sh-here{transition:none}}",
    ".sh-ctl{display:grid;gap:10px;padding:4px 0 8px}",
    ".sh-row{display:flex;align-items:center;gap:0 14px}",
    ".sh-seg{display:flex;flex-wrap:wrap;gap:0 14px;flex:1}",
    ".sh-re{flex:none;width:36px;height:36px;margin-left:auto;display:grid;place-items:center;padding:0;border:0;background:none;color:var(--sc-muted,#a8a8a8);cursor:pointer}",
    ".sh-re:hover,.sh-re:focus-visible{color:var(--sc-fg,#fff)}",
    ".sh-re svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
    ".sh-list{list-style:none;margin:0;padding:0;display:grid;gap:8px;max-width:38ch}",
    ".sh-list li{font-size:12.5px;line-height:1.45;color:var(--sc-muted,#a8a8a8)}",
    ".sh-list b{color:var(--sc-fg,#fff);font-weight:700}",
    ".sh-seg button,.sh-again{min-height:36px;padding:0;border:0;background:none;color:var(--sc-muted,#a8a8a8);cursor:pointer;font:500 10.5px/1 var(--sc-mono,ui-monospace,Menlo,monospace);letter-spacing:.1em;text-transform:uppercase}",
    ".sh-seg button:hover,.sh-again:hover{color:var(--sc-fg,#fff)}",
    ".sh-seg button[aria-checked=true]{color:var(--sh-acc,var(--sc-acc,#fff));font-weight:700}",
    ".sh-note{margin:0;font-size:12px;line-height:1.4;color:var(--sc-muted,#a8a8a8);max-width:36ch}"
  ].join("\n");
  function css() { if (document.getElementById("sh-css")) return; var s = document.createElement("style"); s.id = "sh-css"; s.textContent = CSS; document.head.appendChild(s); }
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  };
  var level = store.get(KEY); if (!LEVELS.some(function (l) { return l[0] === level; })) level = "all";
  document.documentElement.setAttribute("data-hints", level);
  var opts = null, live = null;

  function say(msg) {
    if (window.SurfaceMeta && window.SurfaceMeta.announce) { window.SurfaceMeta.announce(msg); return; }
    var r = document.getElementById("sh-live");
    if (!r) { r = document.createElement("div"); r.id = "sh-live"; r.setAttribute("aria-live", "polite"); r.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"; document.body.appendChild(r); }
    r.textContent = ""; setTimeout(function () { r.textContent = msg; }, 40);
  }
  function set(v) {
    if (!LEVELS.some(function (l) { return l[0] === v; })) return;
    level = v; store.set(KEY, v); document.documentElement.setAttribute("data-hints", v);
    if (v !== "all" && live) live.end();
    try { document.dispatchEvent(new CustomEvent("surface:hints", { detail: { level: v } })); } catch (e) {}
  }
  function seenKey() { return "surface.hints.seen." + ((opts && opts.key) || "tool"); }

  /* the start-here hint */
  function show() {
    if (!opts || level !== "all" || live) return;
    var t = typeof opts.target === "string" ? document.querySelector(opts.target) : opts.target;
    if (!t) return;
    var r = t.getBoundingClientRect();
    if (!r.width || !r.height || (opts.isOn && opts.isOn())) return;
    store.set(seenKey(), "1");
    var el = document.createElement("div"); el.className = "sh-here sh-coach"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = "<span></span><svg viewBox=\"0 0 18 22\"><path d=\"M9 2v17M3 13l6 6 6-6\"/></svg>";
    el.firstChild.textContent = opts.text || "Start here";
    document.body.appendChild(el);
    /* the arrow sits on the button's centre; the words stay on one line, centred over it, and slide in from the
       screen's edge only as far as they must (Dimitry, 18 Oct: "align better") */
    var lab = el.firstChild;
    var place = function () {
      var b = t.getBoundingClientRect(); el.style.left = (b.left + b.width / 2) + "px"; el.style.top = (b.top - el.offsetHeight - 8) + "px";
      lab.style.transform = ""; var r = lab.getBoundingClientRect(), pad = 10, dx = 0;
      if (r.right > innerWidth - pad) dx = innerWidth - pad - r.right; else if (r.left < pad) dx = pad - r.left;
      if (dx) lab.style.transform = "translateX(" + dx.toFixed(1) + "px)";
    };
    place();
    t.classList.add("sh-pulse");
    requestAnimationFrame(function () { el.classList.add("show"); });
    say((opts.text || "Start here") + ": turn on the sound.");
    var done = false, poll = 0, timer = 0;
    function end() {
      if (done) return; done = true; live = null; clearInterval(poll); clearTimeout(timer);
      t.classList.remove("sh-pulse"); el.classList.remove("show"); setTimeout(function () { el.remove(); }, 600);
      removeEventListener("pointerdown", end, true); removeEventListener("keydown", end, true); removeEventListener("resize", place);
    }
    live = { end: end };
    addEventListener("pointerdown", end, true); addEventListener("keydown", end, true); addEventListener("resize", place);
    poll = setInterval(function () { if (opts.isOn && opts.isOn()) end(); else place(); }, 250);
    timer = setTimeout(end, opts.hold || 6500);
  }
  function arm(force) {
    if (!opts) return;
    if (!force && store.get(seenKey())) return;
    var wait = opts.wait || function () { return true; }, n = 0;
    var seen = function () { var t = typeof opts.target === "string" ? document.querySelector(opts.target) : opts.target; if (!t) return false; var r = t.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    (function tick() {
      if (wait() && seen()) { setTimeout(show, opts.after == null ? 3200 : opts.after); return; }
      if (++n < 1500) setTimeout(tick, 200);   // up to five minutes: on the cover, or in the builder with the bar hidden
    })();
  }
  function start(o) {
    css(); opts = o || {};
    if (document.readyState === "complete") arm(); else addEventListener("load", function () { arm(); }, { once: true });
  }
  function replay() {
    set("all");
    var keys = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("surface.hints.seen.") === 0) keys.push(k); } } catch (e) {}
    keys.forEach(function (k) { store.set(k, null); });
    arm(true);
  }

  /* the Settings controls */
  var RESET = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.5 12a6.5 6.5 0 1 0 2-4.7"/><path d="M5 3.8v4.4h4.4"/></svg>';
  var NOTES = "<li><b>Titles</b> keeps the preset names as the looks change.</li><li><b>None</b> is a clean stage for performing.</li>" +
    "<li><b>Hover and hold</b> labels stay either way.</li><li><b>\u21BA</b> shows the first-visit hints again.</li>";
  function controls(host, o) {
    css(); o = o || {};
    var h = typeof host === "string" ? document.querySelector(host) : host; if (!h) return null;
    var w = document.createElement("div"); w.className = "sh-ctl";
    var seg = document.createElement("div"); seg.className = "sh-seg"; seg.setAttribute("role", "radiogroup"); seg.setAttribute("aria-label", "Hints");
    function draw() {
      seg.innerHTML = "";
      LEVELS.forEach(function (l) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = l[1];
        b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(level === l[0])); b.setAttribute("aria-label", "Hints: " + l[1] + ". " + l[2]); b.title = l[2];
        b.onclick = function () { set(l[0]); draw(); say("Hints: " + l[1]); };
        seg.appendChild(b);
      });
    }
    draw();
    /* show the hints again: a reset icon at the row's end (Dimitry, 18 Oct) */
    var again = document.createElement("button"); again.type = "button"; again.className = "sh-re"; again.innerHTML = RESET;
    again.setAttribute("aria-label", "Show the first-run hints again"); again.title = "Show the hints again";
    again.onclick = function () { if (o.onReplay) o.onReplay(); replay(); draw(); say("Hints will show again"); };
    var row = document.createElement("div"); row.className = "sh-row"; row.append(seg, again);
    var list = document.createElement("ul"); list.className = "sh-list"; list.innerHTML = NOTES;
    w.append(row, list); h.appendChild(w);
    document.addEventListener("surface:hints", draw);
    return w;
  }

  window.SurfaceHints = { start: start, set: set, replay: replay, controls: controls, LEVELS: LEVELS, RESET: RESET, NOTES: NOTES, get level() { return level; } };
})();
