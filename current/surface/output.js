/* Surface · Output — the stage alone on a second screen (Dimitry, 22 Oct 2026: "We also need clean HDMI for
   performance session"; his pick: second-screen output, laptop keeps the controls; Mac, Windows, iPad/iPhone).

   A tap opens a window that shows only the stage: no bar, no drawer, no toasts, no cursor. The tool draws into it every
   frame (the same compositing it records with), so what the projector shows is what a recording would.
   - Chrome and Edge: with the multi-screen permission (Window Management API) the window moves itself onto the other
     display. Elsewhere it opens beside the tool and is dragged across.
   - A browser only goes full screen from a click inside that window, so the window says "click to fill this screen"
     until it does; Esc or the tool's button closes it.
   - iPhone and iPad can only mirror over a cable (a page can't address the external display): there the clean stage
     is the tool's bare mode.

     var O = SurfaceOutput.mount({
       name: 'Current',
       draw: function (canvas, w, h) {},   // draw the stage into canvas at w × h device pixels
       fps: 60,                             // optional cap
       onChange: function (open) {}
     });
     O.open() (inside a tap) · O.close() · O.isOpen() · SurfaceOutput.supported → false on iPhone/iPad
   Plain script, window.SurfaceOutput, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceOutput) return;
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent || "") || (/Mac/.test(navigator.platform || "") && navigator.maxTouchPoints > 1);
  function mount(O) {
    O = O || {};
    var win = null, cv = null, raf = 0, last = 0, poll = 0;
    var gap = 1000 / Math.max(10, Math.min(120, O.fps || 60));
    function changed() { try { O.onChange && O.onChange(!!win); } catch (e) {} }
    function page(w) {
      var d = w.document;
      d.open();
      d.write('<!doctype html><html><head><meta charset="utf-8"><title>' + (O.name || "Stage") + ' · output</title><style>' +
        'html,body{margin:0;height:100%;background:#000;overflow:hidden}canvas{position:fixed;inset:0;width:100%;height:100%;display:block}' +
        '#go{position:fixed;left:50%;top:50%;translate:-50% -50%;padding:14px 20px;border:1px solid rgba(255,255,255,.3);border-radius:999px;background:rgba(0,0,0,.6);color:#fff;font:600 12px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;cursor:pointer}' +
        '#go small{display:block;margin-top:6px;font:400 11px/1.3 system-ui,sans-serif;letter-spacing:0;text-transform:none;opacity:.7}' +
        'body.fs #go{display:none}body.idle{cursor:none}' +
        '</style></head><body><canvas></canvas><button id="go" type="button">Click to fill this screen<small>Esc leaves full screen · close this window to stop the output</small></button></body></html>');
      d.close();
      cv = d.querySelector("canvas");
      var go = d.getElementById("go"), b = d.body, t = 0;
      go.onclick = function () { var el = d.documentElement; try { (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) {} };
      d.addEventListener("fullscreenchange", function () { b.classList.toggle("fs", !!d.fullscreenElement); });
      d.addEventListener("webkitfullscreenchange", function () { b.classList.toggle("fs", !!d.webkitFullscreenElement); });
      var wake = function () { b.classList.remove("idle"); clearTimeout(t); t = setTimeout(function () { b.classList.add("idle"); }, 1500); };
      d.addEventListener("pointermove", wake); wake();
      w.addEventListener("keydown", function (e) { if (e.key === "Escape" && !d.fullscreenElement) close(); });
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!win || win.closed) { close(); return; }
      if (now - last < gap - 1) return; last = now;
      var dpr = win.devicePixelRatio || 1, w = Math.round(win.innerWidth * dpr), h = Math.round(win.innerHeight * dpr);
      if (!w || !h) return;
      /* cap the pixels at 4K so a large projector doesn't slow the laptop's own stage */
      var k = Math.min(1, Math.sqrt(3840 * 2160 / (w * h))); w = Math.round(w * k); h = Math.round(h * k);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      try { O.draw && O.draw(cv, w, h); } catch (e) { try { console.warn("[output]", e); } catch (_) {} }
    }
    /* the other screen: the window opens at once (the tap's permission to open a window is short) and moves there when
       the browser says where it is */
    function place() {
      if (!("getScreenDetails" in window)) return;
      window.getScreenDetails().then(function (sd) {
        var here = sd.currentScreen, other = sd.screens.filter(function (s) { return s !== here; })[0];
        if (!other || !win || win.closed) return;
        try { win.moveTo(other.availLeft, other.availTop); win.resizeTo(other.availWidth, other.availHeight); } catch (e) {}
      }, function () {});
    }
    function open() {
      if (win && !win.closed) { try { win.focus(); } catch (e) {} return true; }
      win = window.open("", "surface-output-" + (O.name || "stage").toLowerCase().replace(/\W+/g, "-"), "popup,width=960,height=540");
      if (!win) return false;
      page(win); place();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
      clearInterval(poll); poll = setInterval(function () { if (!win || win.closed) close(); }, 1000);   // the frame loop sleeps in a hidden tab; this doesn't
      window.addEventListener("pagehide", close);
      changed(); return true;
    }
    function close() {
      cancelAnimationFrame(raf); clearInterval(poll);
      var w = win; win = null; cv = null;
      if (w && !w.closed) { try { w.close(); } catch (e) {} }
      if (w) changed();
    }
    return { open: open, close: close, isOpen: function () { return !!(win && !win.closed); } };
  }
  window.SurfaceOutput = { mount: mount, supported: !IOS };
})();
