/* Surface · Show — the buttons for putting a tool in front of people, one vocabulary for every tool (Dimitry, 14 Nov
   2026: "integrating the full screen, second screen auto switch to full screen ... into the canon of the chrome system.
   Stay awake ... wasn't made visible as an icon in Current"; and of Battanboo's floating awake symbol: "it often
   crashes into the finger drawing icon").

   THREE ICONS, drawn on the kit's 24 px grid so they sit with the bar's others:
     SurfaceShow.icon.awake   a sun: the screen is kept awake while the tool plays
     SurfaceShow.icon.full    four corners: the stage fills the screen
     SurfaceShow.icon.second  two frames: the stage alone on another screen (see output.js)

   STAY AWAKE is a button in the bar, never a symbol floating over the stage (it sat on top of the hand button).
     var a = SurfaceShow.awake({
       button:  el | selector,   // an existing button to adopt, or
       into:    el | selector,   // where to append a new one (before `before` when given)
       before:  el | selector,
       playing: () => boolean,   // the tool is making sound or picture right now
       key:     'battanboo.awake', // remembers the choice on this device; default "surface.awake"
       say:     (text) => void   // optional: a status line or toast
     }) → { el, want(), held(), set(on), refresh() }
   Pressed (default on) means "keep the screen awake while playing". Lit means the lock is held this second. Taking the
   choice away lets the screen sleep at once. The lock is taken again whenever the page comes back into view.
   Where perform.js is loaded the lock is its (SurfacePerform.wake), so a show's lock and this one never fight.

   FULL SCREEN:  SurfaceShow.fullscreen(el?, on?) → Promise<boolean>   the Fullscreen API with the WebKit prefix, never throws;
     el defaults to the page; on omitted toggles. SurfaceShow.isFull() tells. (A tool's own "full" layout, such as
     hiding rails, stays the tool's: it listens to the "surfaceshow" event, detail {full}.)
   Plain script, window.SurfaceShow, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceShow) return;
  var S = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  var icon = {
    awake: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ' + S + '><circle cx="12" cy="12" r="3.4"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ' + S + '><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>',
    second: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ' + S + '><rect x="2.5" y="5" width="11" height="8" rx="1.4"/><rect x="10.5" y="9" width="11" height="8" rx="1.4"/></svg>'
  };
  function $(x) { return typeof x === "string" ? document.querySelector(x) : x; }
  function css() {
    if (document.getElementById("shw-css")) return;
    var s = document.createElement("style"); s.id = "shw-css";
    s.textContent = ".shw-awake{position:relative}.shw-awake[aria-pressed=false]{opacity:.55}.shw-awake.shw-held::after{content:'';position:absolute;right:20%;top:18%;width:6px;height:6px;border-radius:50%;background:var(--acc,var(--accent,#55b8c9))}";
    (document.head || document.documentElement).appendChild(s);
  }
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function fullscreen(el, on) {
    el = el || document.documentElement;
    var want = on == null ? !isFull() : !!on;
    return new Promise(function (res) {
      try {
        var p;
        if (want) { var go = el.requestFullscreen || el.webkitRequestFullscreen; p = go && go.call(el); }
        else if (isFull()) { var out = document.exitFullscreen || document.webkitExitFullscreen; p = out && out.call(document); }
        if (p && p.then) p.then(function () { res(isFull()); }, function () { res(isFull()); }); else res(isFull());
      } catch (e) { res(isFull()); }
    });
  }
  function tell() { try { document.dispatchEvent(new CustomEvent("surfaceshow", { detail: { full: isFull() } })); } catch (e) {} }
  document.addEventListener("fullscreenchange", tell); document.addEventListener("webkitfullscreenchange", tell);

  function awake(o) {
    o = o || {}; css();
    var key = o.key || "surface.awake", want = true, lock = null, b = $(o.button);
    try { want = localStorage.getItem(key) !== "0"; } catch (e) {}
    if (!b) { b = document.createElement("button"); b.type = "button"; var host = $(o.into) || document.body, bf = $(o.before); if (bf && bf.parentNode === host) host.insertBefore(b, bf); else host.appendChild(b); }
    b.classList.add("shw-awake"); b.innerHTML = icon.awake;
    var P = window.SurfacePerform, reason = "show-" + key;
    function label() {
      var t = want ? "The screen stays awake while playing. Tap to let it sleep" : "The screen may sleep. Tap to keep it awake while playing";
      b.setAttribute("aria-pressed", String(want)); b.setAttribute("aria-label", t); b.title = t;
    }
    function get() {
      if (P && P.wake) { P.wake(reason, true); return; }
      if (lock || !navigator.wakeLock) return;
      try { navigator.wakeLock.request("screen").then(function (l) { lock = l; l.addEventListener("release", function () { lock = null; paint(); }); paint(); }, function () { lock = null; }); } catch (e) { lock = null; }
    }
    function drop() { if (P && P.wake) { P.wake(reason, false); return; } if (lock) { try { lock.release(); } catch (e) {} lock = null; } }
    function held() { return P && P.awake ? !!(P.awake() && want && o.playing && o.playing()) : !!lock; }
    function paint() { b.classList.toggle("shw-held", held()); }
    function refresh() { var hold = want && !document.hidden && (!o.playing || o.playing()); if (hold) get(); else drop(); paint(); }
    var api = {
      el: b, want: function () { return want; }, held: held, refresh: refresh,
      set: function (on) { want = !!on; try { localStorage.setItem(key, want ? "1" : "0"); } catch (e) {} label(); refresh(); if (o.say) o.say(want ? "The screen stays awake while you play." : "The screen may go to sleep."); }
    };
    b.addEventListener("click", function () { api.set(!want); });
    document.addEventListener("visibilitychange", refresh);
    setInterval(refresh, 1000); label(); refresh();
    return api;
  }
  window.SurfaceShow = { icon: icon, awake: awake, fullscreen: fullscreen, isFull: isFull };
})();
