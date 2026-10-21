/* Surface · Audio wake — bring the sound back after the phone took it away (Dimitry, 20 Oct 2026: "I left the app
   and did other things and when I came back the sound was off, the controls were all still acting like it was
   playing ... I couldn't get the sound to come back. I had to restart the app." Current, home-screen copy, iPhone).

   What happens on iOS: another app's sound, a call, Siri or the app going to the background interrupts the page's
   AudioContext. When the interruption ends, WebKit is meant to hand it back; often it doesn't. The context sits
   'interrupted' or 'suspended' and resume() is refused, or it says 'running' with its clock stopped or its output
   gone. Nothing in the page knows, so every control still says playing.

   This module watches for that and mends it on the next touch, because iOS only lets sound start inside one:
   1. A touch while the context is not running: resume() inside the touch. Still not running a moment later, and
      the next touch rebuilds.
   2. On iOS, coming back after the app was away while sound played: the first touch rebuilds outright. A context
      that only looks alive can't be told from a live one, and a rebuild costs a bar's restart.
   3. While visible and playing: a context whose clock stops, or that leaves 'running', or an audio session
      (navigator.audioSession) that reports 'interrupted', is marked, and a line asks for a touch.
   Rebuild means: the tool closes its context, makes a new one and starts again what was playing. Only the tool
   knows its graph, so it supplies that.

     SurfaceAudioWake.watch({
       ctx:     () => AudioContext | null,   // the live context (it changes after a rebuild)
       playing: () => boolean,               // the tool believes sound is on
       rebuild: () => void,                  // close, make a new context, restart what played (runs inside a touch)
       say:     (text) => void,              // optional: a toast
       away:    2000                         // ms in the background before a return counts (iOS rule 2)
     }) → { state(), wake() }                // wake(): rebuild now (a "restart sound" button can call it)
   Plain script, window.SurfaceAudioWake, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceAudioWake) return;
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent || "") || (/Mac/.test(navigator.platform || "") && navigator.maxTouchPoints > 1);
  function watch(o) {
    o = o || {};
    var suspect = false, why = "", hiddenAt = 0, wasPlaying = false, bound = null, lastT = -1, still = 0, busy = 0, rebuilds = 0, resumes = 0, said = 0;
    var away = o.away == null ? 2000 : o.away;
    function ctx() { try { return o.ctx && o.ctx(); } catch (e) { return null; } }
    function playing() { try { return !!(o.playing && o.playing()); } catch (e) { return false; } }
    function say(t) { var n = Date.now(); if (n - said < 4000) return; said = n; try { o.say && o.say(t); } catch (e) {} }
    function mark(w) { if (!playing()) return; if (!suspect) { suspect = true; why = w; say("sound paused by the phone · tap anywhere to bring it back"); } }
    function bind() {
      var c = ctx(); if (c === bound) return; bound = c; lastT = -1; still = 0;
      if (c && c.addEventListener) c.addEventListener("statechange", function () { if (c === ctx() && c.state !== "running" && !document.hidden) mark("context " + c.state); });
    }
    function rebuild(w) {
      suspect = false; rebuilds++;
      try { o.rebuild && o.rebuild(); } catch (e) { try { console.warn("[audiowake] rebuild failed: " + (e && e.message)); } catch (_) {} }
      bind(); say("sound back"); try { console.info("[audiowake] rebuilt (" + w + ")"); } catch (_) {}
    }
    function unlock(c) {
      try { c.resume(); } catch (e) {}
      try { var s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch (e) {}
    }
    /* one tap fires pointerup, touchend and click; which of them iOS counts as the gesture varies, so the decision is
       taken once per tap and every later event of the same tap unlocks again */
    function touch() {
      bind(); var c = ctx(); if (!c || !playing()) { suspect = false; return; }
      var n = Date.now(); if (n - busy < 350) { if (c.state !== "running") unlock(c); return; } busy = n;
      if (suspect) { rebuild(why); return; }
      if (c.state !== "running") {
        resumes++; unlock(c);
        setTimeout(function () { if (ctx() === c && c.state !== "running" && playing()) { suspect = true; why = "resume refused"; say("tap again to restart the sound"); } }, 600);
      }
    }
    ["pointerup", "touchend", "keydown", "click"].forEach(function (t) { window.addEventListener(t, touch, true); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { hiddenAt = Date.now(); wasPlaying = playing(); return; }
      var gone = hiddenAt ? Date.now() - hiddenAt : 0; hiddenAt = 0; bind(); var c = ctx();
      if (!wasPlaying || !c || !playing()) return;
      try { if (c.state !== "running") c.resume(); } catch (e) {}   // a desktop browser takes this without a touch
      if (IOS && gone >= away) { suspect = true; why = "back after " + Math.round(gone / 1000) + " s away"; setTimeout(function () { if (suspect) say("tap anywhere to bring the sound back"); }, 400); return; }
      setTimeout(function () { if (ctx() === c && c.state !== "running") mark("not running after return"); }, 700);
    });
    try {
      var as = navigator.audioSession;
      if (as && as.addEventListener) as.addEventListener("statechange", function () { if (as.state === "interrupted" && !document.hidden) mark("audio session interrupted"); });
    } catch (e) {}
    /* the clock: a running context whose time stands still is not playing */
    setInterval(function () {
      if (document.hidden) return; bind(); var c = ctx();
      if (!c || !playing()) { still = 0; lastT = -1; return; }
      if (c.state !== "running") { mark("context " + c.state); return; }
      var t = c.currentTime; if (lastT >= 0 && t === lastT) { if (++still >= 2) mark("clock stopped"); } else still = 0; lastT = t;
    }, 1000);
    return {
      state: function () { var c = ctx(); return { ctx: c ? c.state : "none", suspect: suspect, why: why, rebuilds: rebuilds, resumes: resumes, ios: IOS }; },
      wake: function () { rebuild("asked"); }
    };
  }
  window.SurfaceAudioWake = { watch: watch, ios: IOS };
})();
