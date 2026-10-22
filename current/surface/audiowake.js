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
   2. On iOS, coming back after the app was away while sound played: the sound is checked a second later, and marked
      lost only if the context is not running, its clock stood still, or (with `level`) the output is not measurably
      playing. (22 Oct, Dimitry's iPhone, 0.29.26: sound that kept playing in the background "died on return": the old
      rule marked every return and the first touch, a drag on the stage included, closed the live context.)
   3. While visible and playing: a context whose clock stops, or that leaves 'running', or an audio session
      (navigator.audioSession) that reports 'interrupted', is marked, and a line asks for a touch.
   Rebuild means: the tool closes its context, makes a new one and starts again what was playing. Only the tool
   knows its graph, so it supplies that.

     SurfaceAudioWake.watch({
       ctx:     () => AudioContext | null,   // the live context (it changes after a rebuild)
       playing: () => boolean,               // the tool believes sound is on
       rebuild: () => void,                  // close, make a new context, restart what played (runs inside a touch)
       say:     (text) => void,              // optional: a toast
       away:    2000,                        // ms in the background before a return counts (iOS rule 2)
       level:   () => number,                // optional: the output's loudness 0..1 (an analyser's RMS); exact
                                             //   silence for `silence` ms while playing counts as dead (rule 4)
       silence: 6000,
       change:  (suspect, why) => void,      // optional: called when the sound is marked lost, and when it is back
       rescue:  { reload, report },          // optional: the rescue chip (rule 5)
       alive:   () => boolean                // optional: the tool's own word that sound really plays (rule 7)
     }) → { state(), wake() }                // wake(): rebuild now (a "restart sound" button can call it)

   4. (22 Oct) The clock runs but nothing comes out: `level` reads exact zero for `silence` ms while the tool says it
      plays. Exact zero, not quiet: a room or a soft passage is never 0.000.
   5. THE RESCUE CHIP (Dimitry, 22 Oct: "a refresh button when sound completely dies without any change to the sound
      settings and a reset button in the top right that refreshes the app live and bypasses the home screen"). With
      `rescue`, a lost sound shows a chip top right: Sound (rebuild the sound now), Reset (rescue.reload: the tool saves
      where it is and reloads straight back, no cover) and, with rescue.report, the bug (report it from where it
      happened). Taps on the chip never count as the "tap anywhere" of rules 1–3. It goes when the sound is back.
   A rebuild runs only on a click or a key (or the chip's Sound), never on pointerup/touchend alone: a drag ends in a
   touchend that iOS does not count as a gesture, and a context made there starts suspended (22 Oct, same report).
   6. A marked sound that is running, ticking and measurably playing for 2 s clears itself (with `level`).
   7. After a rebuild the sound is checked before the chip says so; still silent, Reset becomes the white button.
   When the sound comes back, by a rebuild or by itself, the chip says "Sound back" for a moment and goes (no toast).
   Plain script, window.SurfaceAudioWake, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceAudioWake) return;
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent || "") || (/Mac/.test(navigator.platform || "") && navigator.maxTouchPoints > 1);
  function watch(o) {
    o = o || {};
    var suspect = false, why = "", hiddenAt = 0, wasPlaying = false, bound = null, lastT = -1, still = 0, busy = 0, rebuilds = 0, resumes = 0, said = 0;
    var away = o.away == null ? 2000 : o.away, quiet = 0, chip = null, alive = 0, backT = 0, checking = false, checks = 0;
    function setS(v, w) { var was = suspect; suspect = v; if (v) why = w || why; if (was !== v) { try { o.change && o.change(v, why); } catch (e) {} show(v); } }
    function ctx() { try { return o.ctx && o.ctx(); } catch (e) { return null; } }
    function playing() { try { return !!(o.playing && o.playing()); } catch (e) { return false; } }
    function say(t) { if (o.rescue && suspect) return;   // the chip says it
      var n = Date.now(); if (n - said < 4000) return; said = n; try { o.say && o.say(t); } catch (e) {} }
    function mark(w) { if (!playing()) return; if (!suspect) { setS(true, w); say(o.rescue ? "the sound stopped · tap Sound, or Reset" : "sound paused by the phone · tap anywhere to bring it back"); } }
    var SVG = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
    function show(v) {
      if (!o.rescue) return;
      if (!chip) {
        if (!document.getElementById("saw-css")) { var st = document.createElement("style"); st.id = "saw-css"; st.textContent =
          ".saw{position:fixed;z-index:70;top:calc(env(safe-area-inset-top,0px) + 12px);right:calc(max(12px,env(safe-area-inset-right,0px)));display:flex;gap:6px;padding:5px;border-radius:24px;background:rgba(10,13,16,.9);border:1px solid rgba(255,255,255,.16);box-shadow:0 10px 30px rgba(0,0,0,.45);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);opacity:0;translate:0 -8px;transition:opacity .3s ease,translate .4s cubic-bezier(.16,1,.3,1)}" +
          ".saw.on{opacity:1;translate:0 0}.saw[hidden]{display:none}" +
          ".saw .back{display:none;align-items:center;gap:6px;height:36px;padding:0 14px;color:#fff;font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.16em;text-transform:uppercase}" +
          ".saw.is-back button{display:none}.saw.is-back .back{display:flex}" +
          ".saw.try-reset button.go{background:rgba(255,255,255,.1);color:#fff}.saw.try-reset button.rs{background:#fff;color:#0b0f10}" +
          ".saw button{display:flex;align-items:center;gap:6px;height:36px;min-width:36px;padding:0 12px;border:0;border-radius:18px;background:rgba(255,255,255,.1);color:#fff;font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.16em;text-transform:uppercase;cursor:pointer;touch-action:manipulation}" +
          ".saw button.go{background:#fff;color:#0b0f10}.saw button.bug{padding:0;justify-content:center}" +
          ".saw svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}" +
          "@media (prefers-reduced-motion:reduce){.saw{transition:opacity .2s}}"; document.head.appendChild(st); }
        chip = document.createElement("div"); chip.className = "saw"; chip.hidden = true; chip.setAttribute("role", "group"); chip.setAttribute("aria-label", "The sound stopped");
        var b1 = document.createElement("button"); b1.type = "button"; b1.className = "go"; b1.title = "Restart the sound";
        b1.innerHTML = '<svg ' + SVG + '><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4.5h-4.5"/></svg>Sound';
        b1.onclick = function () { rebuild("Sound button"); };
        chip.appendChild(b1);
        if (o.rescue.reload) { var b2 = document.createElement("button"); b2.type = "button"; b2.className = "rs"; b2.title = "Reload the app straight back to where you are";
          b2.innerHTML = '<svg ' + SVG + '><path d="M4 12a8 8 0 0 1 13.7-5.6L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15"/><path d="M4 20v-5h5"/></svg>Reset';
          b2.onclick = function () { try { console.info("[audiowake] reset (" + why + ")"); } catch (_) {} try { o.rescue.reload(); } catch (e) { location.reload(); } };
          chip.appendChild(b2); }
        if (o.rescue.report) { var b3 = document.createElement("button"); b3.type = "button"; b3.className = "bug"; b3.title = "Report it"; b3.setAttribute("aria-label", "Report it");
          b3.innerHTML = (window.SurfaceReport && SurfaceReport.ICON) || '<svg ' + SVG + '><path d="M12 8v5M12 16.5h.01"/><circle cx="12" cy="12" r="9"/></svg>';
          b3.onclick = function () { try { o.rescue.report("the sound stopped (" + why + ")"); } catch (e) {} };
          chip.appendChild(b3); }
        var bk = document.createElement("span"); bk.className = "back"; bk.setAttribute("role", "status");
        bk.innerHTML = '<svg ' + SVG + '><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Sound back'; chip.appendChild(bk);
        document.body.appendChild(chip);
      }
      clearTimeout(backT);
      if (v) { chip.classList.remove("is-back"); chip.hidden = false; requestAnimationFrame(function () { requestAnimationFrame(function () { chip.classList.add("on"); }); }); }
      /* (Dimitry, 22 Oct) the chip says "sound back" itself, then goes, instead of a caption under it that can clash */
      else if (chip.classList.contains("on")) { chip.classList.add("is-back");
        backT = setTimeout(function () { chip.classList.remove("on"); backT = setTimeout(function () { if (!suspect) { chip.hidden = true; chip.classList.remove("is-back"); } }, 350); }, 1400); }
      else chip.hidden = true;
    }
    function bind() {
      var c = ctx(); if (c === bound) return; bound = c; lastT = -1; still = 0;
      if (c && c.addEventListener) c.addEventListener("statechange", function () { if (c === ctx() && c.state !== "running" && !document.hidden) mark("context " + c.state); });
    }
    function rebuild(w) {
      rebuilds++; quiet = 0;
      try { o.rebuild && o.rebuild(); }
      catch (e) {   /* a failed rebuild keeps the chip up (Dimitry, 22 Oct: "sound back didn't stay on screen or work"):
                       Reset still works when a rebuild can't */
        try { console.warn("[audiowake] rebuild failed: " + (e && e.message)); } catch (_) {}
        bind(); suspect = false; setS(true, "rebuild failed"); return; }
      /* 7. CHECKED, NOT ASSUMED (Dimitry, 22 Oct, 0.29.33: after dictating, Sound said "Sound back" and nothing played; only
         a restart helped). The chip stays while the new sound is checked (1.2 s): its context running, its clock moving,
         and the tool's alive() if it has one. Back: "Sound back", then the chip goes. Not back: the chip stays and Reset
         becomes the white button, because a reload is what still works then. */
      bind(); var c = ctx(), t0 = c ? c.currentTime : 0, n = ++checks; checking = true;
      try { console.info("[audiowake] rebuilt (" + w + "), checking"); } catch (_) {}
      setTimeout(function () { if (n !== checks) return; checking = false;
        var c2 = ctx(), ok = !!c2 && c2.state === "running" && c2.currentTime > t0 + 0.4;
        if (ok && o.alive) { try { ok = !!o.alive(); } catch (e) { ok = false; } }
        try { console.info("[audiowake] after rebuild: " + (ok ? "playing" : "still silent (" + (c2 ? c2.state : "no context") + ")")); } catch (_) {}
        if (ok) { if (chip) chip.classList.remove("try-reset"); setS(false); if (!o.rescue) say("sound back"); return; }
        why = "still silent after a restart"; if (!suspect) setS(true, why);
        if (chip) chip.classList.add("try-reset"); else say("still no sound · reload the page");
      }, 1200);
    }
    function unlock(c) {
      try { c.resume(); } catch (e) {}
      try { var s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch (e) {}
    }
    /* one tap fires pointerup, touchend and click; which of them iOS counts as the gesture varies, so the decision is
       taken once per tap and every later event of the same tap unlocks again */
    function touch(e) {
      if (chip && e && e.target && chip.contains(e.target)) return;   // the chip's own buttons decide
      if (e && e.isTrusted === false) return;   // a tool's own .click() (Auto play) is not a touch: iOS won't start sound from it
      bind(); var c = ctx(); if (!c || !playing()) { setS(false); return; }
      if (suspect) {   // only a real tap (click) or key rebuilds: a drag's touchend is no gesture on iOS
        if (checking) return;
        if (e && (e.type === "click" || (e.type === "keydown" && !(e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || "")))))) { busy = Date.now(); rebuild(why); }
        return; }
      var n = Date.now(); if (n - busy < 350) { if (c.state !== "running") unlock(c); return; } busy = n;
      if (c.state !== "running") {
        resumes++; unlock(c);
        setTimeout(function () { if (ctx() === c && c.state !== "running" && playing()) { setS(true, "resume refused"); say(o.rescue ? "the sound stopped · tap Sound, or Reset" : "tap again to restart the sound"); } }, 600);
      }
    }
    ["pointerup", "touchend", "keydown", "click"].forEach(function (t) { window.addEventListener(t, touch, true); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { hiddenAt = Date.now(); wasPlaying = playing(); return; }
      var gone = hiddenAt ? Date.now() - hiddenAt : 0; hiddenAt = 0; bind(); var c = ctx();
      if (!wasPlaying || !c || !playing()) return;
      try { if (c.state !== "running") c.resume(); } catch (e) {}   // a desktop browser takes this without a touch
      if (IOS && gone >= away) {   /* rule 2: check, then mark only a sound that is not playing */
        var w = "back after " + Math.round(gone / 1000) + " s away", t0 = c.currentTime;
        setTimeout(function () {
          if (document.hidden || ctx() !== c || !playing() || suspect) return;
          var l = null; if (o.level) { try { l = o.level(); } catch (e) {} }
          var alive = c.state === "running" && c.currentTime > t0 + 0.5 && (o.level ? l > 0 : true);
          if (alive) { try { console.info("[audiowake] " + w + ": still playing"); } catch (_) {} return; }
          setS(true, w); say(o.rescue ? "the sound stopped · tap Sound, or Reset" : "tap anywhere to bring the sound back");
        }, 1200);
        return; }
      setTimeout(function () { if (ctx() === c && c.state !== "running") mark("not running after return"); }, 700);
    });
    try {
      var as = navigator.audioSession;
      if (as && as.addEventListener) as.addEventListener("statechange", function () { if (as.state === "interrupted" && !document.hidden) mark("audio session interrupted"); });
    } catch (e) {}
    /* the clock: a running context whose time stands still is not playing */
    setInterval(function () {
      if (document.hidden) return; bind(); var c = ctx();
      if (!c || !playing()) { still = 0; lastT = -1; quiet = 0; if (suspect && !playing()) setS(false); return; }
      if (c.state !== "running") { mark("context " + c.state); return; }
      var t = c.currentTime; if (lastT >= 0 && t === lastT) { if (++still >= 2) mark("clock stopped"); } else still = 0; lastT = t;
      var l = null; if (o.level) { try { l = o.level(); } catch (e) {} if (l === 0) { quiet += 1000; if (quiet >= (o.silence || 6000)) mark("silent output"); } else quiet = 0; }
      /* 6. it came back by itself (22 Oct, Dimitry: dictating in another app ducked the sound, it came back, the chip
         stayed, and tapping anything to clear it restarted the sound). Marked, but running, ticking and measurably
         playing for 2 s: the chip goes. Without `level` the page can't tell, so the chip stays. */
      if (suspect && o.level && why !== "rebuild failed" && still === 0 && l > 0) { if (++alive >= 2) { alive = 0; setS(false); try { console.info("[audiowake] came back by itself"); } catch (_) {} } } else alive = 0;
    }, 1000);
    return {
      state: function () { var c = ctx(); return { ctx: c ? c.state : "none", suspect: suspect, why: why, rebuilds: rebuilds, resumes: resumes, ios: IOS }; },
      wake: function () { rebuild("asked"); }
    };
  }
  window.SurfaceAudioWake = { watch: watch, ios: IOS };
})();
