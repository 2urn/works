/* Surface · Perform — while a show is on, nothing reloads by itself and the screen stays awake.
   CONVENTIONS.md › Performing. Plain script, no dependencies; window.SurfacePerform.

   PERFORMING has two sources: the person's own switch (a named control the tool shows, "Performing"), and holds the
   tool sets for as long as something show-like is going on (a room is joined; auto play runs in fullscreen). While
   either is on:
     - the kit's updater (sys/export/v1/build.mjs) never reloads the page and keeps its "newer version" pill hidden;
       a newer version waits and the pill comes back when Performing ends;
     - an offline worker that takes over mid-show does not reload the page either;
     - the screen is kept awake (Screen Wake Lock), and taken again whenever the page comes back into view.
   The switch lasts for the tab (sessionStorage), so a rescue reload in the middle of a show comes back performing.

   WAKE also has holds of its own, for things that should keep the screen on without blocking updates (the field playing
   in fullscreen, a capture). The kit holds it in fullscreen by itself.

   THE CALLS
     SurfacePerform.on()               true while performing (the switch, or any hold)
     SurfacePerform.manual()           the switch alone
     SurfacePerform.set(on)            the switch
     SurfacePerform.hold(reason, on)   a hold the tool sets and clears ("room", "autoplay")
     SurfacePerform.wake(reason, on)   keep the screen awake for this reason (does not block updates)
     SurfacePerform.awake()            true while the wake lock is held
     SurfacePerform.why()              the reasons now, for a label ("room", "autoplay", "switch")
   Event: document "surfaceperform", detail {on, manual, awake}. The root carries data-performing while on.

   THE SHOW LOCK (29 Oct 2026, for a performance): while locked, the tool hides its editing and lets only its show
   controls through (the tool decides which, keyed off the root's data-locked). Locking also performs. It lasts for
   the tab, like the switch, so a rescue reload comes back locked.
     SurfacePerform.lock(on)           lock or unlock
     SurfacePerform.locked()           true while locked
   Event: document "surfaceperform" (detail.locked), as for the rest.
*/
(function () {
  "use strict";
  if (window.SurfacePerform) return;
  var KEY = "surface.performing", LKEY = "surface.locked", locked = false, man = false, holds = {}, wakes = {}, lock = null, asking = false, wasOn = null;
  try { man = sessionStorage.getItem(KEY) === "1"; locked = sessionStorage.getItem(LKEY) === "1"; } catch (e) {}
  function any(o) { for (var k in o) if (o[k]) return true; return false; }
  function on() { return man || locked || any(holds); }
  function wantAwake() { return on() || any(wakes); }
  function emit() {
    var h = on();
    try { if (h) document.documentElement.setAttribute("data-performing", ""); else document.documentElement.removeAttribute("data-performing"); if (locked) document.documentElement.setAttribute("data-locked", ""); else document.documentElement.removeAttribute("data-locked"); } catch (e) {}
    syncWake();
    if (h === wasOn) { tell(); return; }
    wasOn = h; tell();
  }
  function tell() { try { document.dispatchEvent(new CustomEvent("surfaceperform", { detail: { on: on(), manual: man, awake: !!lock, locked: locked } })); } catch (e) {} }
  function syncWake() {
    var want = wantAwake() && !document.hidden;
    if (want && !lock && !asking) take();
    else if (!want && lock) { var l = lock; lock = null; try { l.release().catch(function () {}); } catch (e) {} tell(); }
  }
  function take() {
    if (!navigator.wakeLock || !navigator.wakeLock.request) return;
    asking = true;
    navigator.wakeLock.request("screen").then(function (l) {
      asking = false;
      if (!wantAwake() || document.hidden) { l.release().catch(function () {}); return; }
      lock = l; tell();
      l.addEventListener("release", function () { if (lock === l) { lock = null; tell(); } });   // the system lets go when the page hides
    }, function () { asking = false; });
  }
  document.addEventListener("visibilitychange", syncWake);   // taken again when the page comes back into view
  var fs = function () { var f = !!(document.fullscreenElement || document.webkitFullscreenElement); if (!!wakes.fullscreen !== f) { if (f) wakes.fullscreen = 1; else delete wakes.fullscreen; syncWake(); } };
  document.addEventListener("fullscreenchange", fs); document.addEventListener("webkitfullscreenchange", fs);

  window.SurfacePerform = {
    on: on,
    manual: function () { return man; },
    set: function (v) { man = !!v; try { sessionStorage.setItem(KEY, man ? "1" : "0"); } catch (e) {} emit(); },
    hold: function (reason, v) { v = !!v; if (!!holds[reason] === v) return; if (v) holds[reason] = 1; else delete holds[reason]; emit(); },
    wake: function (reason, v) { v = !!v; if (!!wakes[reason] === v) return; if (v) wakes[reason] = 1; else delete wakes[reason]; syncWake(); },
    awake: function () { return !!lock; },
    lock: function (v) { locked = !!v; try { sessionStorage.setItem(LKEY, locked ? "1" : "0"); } catch (e) {} wasOn = null; emit(); },
    locked: function () { return locked; },
    why: function () { var r = Object.keys(holds); if (man) r.unshift("switch"); if (locked) r.unshift("lock"); return r; }
  };
  if (man || locked) emit();
})();
