/* Surface · Power — a tool that rests when nobody needs it (Dimitry, 31 Oct 2026, 11:03, on an older iPad Pro: "it does seem
   to be eating a battery far faster than I'm used to ... check what happens when the iPad is not ... focused on the app
   ... is there a way ... it would pause itself if it's not in performance mode and conserve energy in the background ...
   a button that says ... restarting automatically ... alongside the sound reset strip").

   Two rests, both skipped while the tool says it must keep going (keep(): a show, Performing):
   AWAY    the page hidden for a moment (another app, the screen locked): sleep() runs (the tool stops its sound and anything
           that keeps the device awake in the background); coming back runs wake() and says so in a short line.
   STILL   on screen, no touch, key, wheel or pointer for idleMs (two minutes): slow(true) (the tool draws less often);
           the first touch runs slow(false).

     SurfacePower.watch({ keep: () => bool, sleep: () => {}, wake: () => {}, slow: (on) => {}, idleMs: 120000,
                          awayMs: 1500, say: (text) => {} })   → { asleep: () => bool, slow: () => bool, poke: () => {} }
     SurfacePower.mode('save' | 'full')   // full: never rests (kept per device, 'surface.power'); returns the mode

   Plain script, window.SurfacePower, no dependencies. */
(function () {
  "use strict";
  if (window.SurfacePower) return;
  var LS = "surface.power";
  function mode(v) { if (v === "save" || v === "full") { try { localStorage.setItem(LS, v); } catch (e) {} } var m = "save"; try { m = localStorage.getItem(LS) || "save"; } catch (e) {} return m === "full" ? "full" : "save"; }
  function watch(o) {
    o = o || {}; var idleMs = o.idleMs || 120000, awayMs = o.awayMs == null ? 1500 : o.awayMs, asleep = false, slow = false, last = Date.now(), awayT = 0;
    var keep = function () { if (mode() === "full") return true; try { return !!(o.keep && o.keep()); } catch (e) { return false; } };
    var call = function (f, a) { try { f && f(a); } catch (e) { try { console.warn("[power]", e); } catch (_) {} } };
    var unslow = function () { if (slow) { slow = false; call(o.slow, false); } };
    var poke = function () { last = Date.now(); unslow(); };
    ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"].forEach(function (t) { window.addEventListener(t, poke, { capture: true, passive: true }); });
    document.addEventListener("visibilitychange", function () {
      clearTimeout(awayT);
      if (document.hidden) { awayT = setTimeout(function () { if (document.hidden && !asleep && !keep()) { asleep = true; call(o.sleep); } }, awayMs); return; }
      poke();
      if (asleep) { asleep = false; call(o.wake); call(o.say, "back from power save"); }
    });
    setInterval(function () { if (document.hidden) return; if (keep()) { unslow(); return; } if (slow) return; if (Date.now() - last >= idleMs) { slow = true; call(o.slow, true); } }, 5000);
    return { asleep: function () { return asleep; }, slow: function () { return slow; }, poke: poke };
  }
  window.SurfacePower = { watch: watch, mode: mode };
})();
