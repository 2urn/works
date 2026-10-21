/* Surface · Trim — cut the start and end off a video you just recorded, right in the viewer (Dimitry, 20 Oct 2026:
   "I miss-timed it when I recorded ... a way, once we are in the video viewing section, to trim the video?").

   A strip under the video: the clip's whole length, two handles (in and out), the part you keep lit. The video loops
   just that part while you choose; dragging a handle shows its frame. Done makes the trimmed file; cancel leaves the
   original as it was.

   HOW IT CUTS (his choice, 20 Oct: "Mediabunny + replay fallback"):
   1. Mediabunny (Vanilagy, MPL-2.0; a subset bundled as vendor/mediabunny-trim.min.js, loaded only when you trim):
      opens the MP4 or WebM in the browser and cuts it, copying what it can and re-encoding only what it must (with the
      browser's own codecs, WebCodecs). Seconds, full quality.
   2. Where that can't run, it replays the chosen part and records it again (canvas + MediaRecorder, the sound through
      Web Audio). Works wherever recording works; takes as long as the part; a little quality is lost.

     SurfaceTrim.open({
       host:  element,            // where the strip goes (the viewer); appended at its end
       video: element,            // the <video> showing the clip
       blob:  Blob,               // the recorded file (video/mp4 or video/webm)
       lib:   'vendor/mediabunny-trim.min.js',   // where the library is (default: vendor/ next to this script)
       onDone(blob, {start, end, how}) {},       // the trimmed file ('mediabunny' or 'replay')
       onCancel() {}
     }) → { close() }
   SurfaceTrim.cut(blob, start, end, {lib, video}) → Promise<Blob>   the cut alone, no strip
   Plain script, window.SurfaceTrim. Reads --acc / --acc-rgb; every other color comes from the text color of where it sits. */
(function () {
  "use strict";
  if (window.SurfaceTrim) return;
  var HERE = (document.currentScript && document.currentScript.src) || location.href;
  var DEF_LIB = new URL("vendor/mediabunny-trim.min.js", HERE).href;
  var CSS =
    ".strim{display:grid;gap:10px;padding:12px 4px 4px;color:inherit;font:500 11px/1.2 var(--mono,ui-monospace,monospace);letter-spacing:.06em}" +
    ".strim-bar{position:relative;height:44px;touch-action:none;-webkit-user-select:none;user-select:none}" +
    ".strim-all{position:absolute;left:0;right:0;top:14px;height:16px;border-radius:8px;background:color-mix(in srgb,currentColor 16%,transparent)}" +
    ".strim-keep{position:absolute;top:14px;height:16px;background:rgb(var(--acc-rgb,85 184 201) / .45);border-top:2px solid var(--acc,#55b8c9);border-bottom:2px solid var(--acc,#55b8c9);box-sizing:border-box}" +
    ".strim-h{position:absolute;top:4px;width:22px;height:36px;margin-left:-11px;border:0;border-radius:7px;background:var(--acc,#55b8c9);cursor:ew-resize;padding:0;touch-action:none;box-shadow:0 2px 8px rgb(0 0 0 / .35)}" +
    ".strim-h::after{content:'';position:absolute;left:50%;top:10px;bottom:10px;width:2px;margin-left:-1px;border-radius:1px;background:rgb(0 0 0 / .45)}" +
    ".strim-h:focus-visible{outline:2px solid #fff;outline-offset:2px}" +
    ".strim-ph{position:absolute;top:10px;width:2px;height:24px;margin-left:-1px;background:#fff;border-radius:1px;pointer-events:none;opacity:.9}" +
    ".strim-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 14px}" +
    ".strim-t{opacity:.72;white-space:nowrap}.strim-t b{font-weight:600}" +
    ".strim-btns{display:flex;gap:6px}" +
    ".strim button.strim-b{height:32px;padding:0 14px;border-radius:16px;border:1px solid color-mix(in srgb,currentColor 35%,transparent);background:none;color:inherit;font:600 10px/1 var(--mono,monospace);letter-spacing:.16em;text-transform:uppercase;cursor:pointer}" +
    ".strim button.strim-b.go{background:var(--acc,#55b8c9);border-color:var(--acc,#55b8c9);color:var(--acc-ink,#04181c)}" +
    ".strim button.strim-b:disabled{opacity:.5;cursor:default}" +
    ".strim-msg{min-height:1em;color:var(--acc,#55b8c9)}";
  function css() { if (document.getElementById("strim-css")) return; var s = document.createElement("style"); s.id = "strim-css"; s.textContent = CSS; document.head.appendChild(s); }
  function fmt(t) { t = Math.max(0, t); var m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); }

  /* a WebM straight from MediaRecorder often says its length is Infinity: seek far past the end and the browser
     works it out */
  function duration(v) {
    return new Promise(function (res) {
      var d = v.duration; if (isFinite(d) && d > 0) { res(d); return; }
      var done = false, t0 = v.currentTime;
      var fix = function () { if (done || !isFinite(v.duration)) return; done = true; v.removeEventListener("durationchange", fix); v.removeEventListener("timeupdate", fix); var d2 = v.duration; try { v.currentTime = t0 || 0; } catch (_) {} res(d2); };
      v.addEventListener("durationchange", fix); v.addEventListener("timeupdate", fix);
      try { v.currentTime = 1e9; } catch (_) {}
      setTimeout(function () { if (!done) { done = true; res(isFinite(v.duration) ? v.duration : 0); } }, 3000);
    });
  }

  var libP = null;
  function loadLib(src) {
    if (window.Mediabunny) return Promise.resolve(window.Mediabunny);
    if (libP) return libP;
    libP = new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src || DEF_LIB; s.onload = function () { window.Mediabunny ? res(window.Mediabunny) : rej(new Error("no library")); }; s.onerror = function () { libP = null; rej(new Error("library did not load")); }; document.head.appendChild(s); });
    return libP;
  }
  function viaLib(blob, start, end, lib, onP) {
    if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return Promise.reject(new Error("no WebCodecs"));
    return loadLib(lib).then(function (M) {
      var mp4 = /mp4|quicktime/.test(blob.type);
      var input = new M.Input({ source: new M.BlobSource(blob), formats: [M.MP4, M.QTFF, M.WEBM, M.MATROSKA] });
      var target = new M.BufferTarget();
      var output = new M.Output({ format: mp4 ? new M.Mp4OutputFormat({ fastStart: "in-memory" }) : new M.WebMOutputFormat(), target: target });
      return M.Conversion.init({ input: input, output: output, trim: { start: start, end: end } }).then(function (conv) {
        if (!conv.isValid) throw new Error("cannot convert: " + (conv.discardedTracks || []).map(function (d) { return d.reason; }).join(", "));
        if (onP) conv.onProgress = onP;
        return conv.execute().then(function () { return new Blob([target.buffer], { type: mp4 ? "video/mp4" : "video/webm" }); });
      });
    });
  }
  /* the fallback: play the part, draw each frame to a canvas, record the canvas and the sound */
  function viaReplay(blob, start, end, video, onP) {
    return new Promise(function (res, rej) {
      if (typeof MediaRecorder === "undefined") { rej(new Error("no MediaRecorder")); return; }
      var v = document.createElement("video"); v.playsInline = true; v.muted = false; v.preload = "auto"; v.src = URL.createObjectURL(blob);
      v.onloadedmetadata = function () {
        var c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; var g = c.getContext("2d");
        var stream = c.captureStream(30), ac = null;
        try { var AC = window.AudioContext || window.webkitAudioContext; ac = new AC(); var src = ac.createMediaElementSource(v), dst = ac.createMediaStreamDestination(); src.connect(dst); dst.stream.getAudioTracks().forEach(function (t) { stream.addTrack(t); }); } catch (_) {}
        var mime = [blob.type, "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find(function (m) { try { return m && MediaRecorder.isTypeSupported(m); } catch (_) { return false; } });
        var rec; try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12e6 } : {}); } catch (e) { rej(e); return; }
        var chunks = []; rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () { try { ac && ac.close(); } catch (_) {} URL.revokeObjectURL(v.src); res(new Blob(chunks, { type: (mime || "video/webm").split(";")[0] })); };
        var draw = function () { if (rec.state !== "recording") return; g.drawImage(v, 0, 0, c.width, c.height); if (onP) onP(Math.min(1, (v.currentTime - start) / (end - start))); if (v.currentTime >= end || v.ended) { v.pause(); rec.stop(); return; } requestAnimationFrame(draw); };
        v.onseeked = function () { v.onseeked = null; rec.start(250); v.play().then(function () { requestAnimationFrame(draw); }, rej); };
        v.currentTime = start;
      };
      v.onerror = function () { rej(new Error("the clip would not play")); };
    });
  }
  function cut(blob, start, end, o) {
    o = o || {};
    return viaLib(blob, start, end, o.lib, o.onProgress).then(function (b) { return { blob: b, how: "mediabunny" }; }, function (e) {
      console.warn("[trim] mediabunny: " + (e && e.message) + "; replaying instead");
      return viaReplay(blob, start, end, o.video, o.onProgress).then(function (b) { return { blob: b, how: "replay" }; });
    });
  }

  function open(o) {
    css(); o = o || {};
    var v = o.video, host = o.host; if (!v || !host || !o.blob) return null;
    var box = document.createElement("div"); box.className = "strim"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "Trim the video");
    box.innerHTML = '<div class="strim-bar"><div class="strim-all"></div><div class="strim-keep"></div><div class="strim-ph"></div>' +
      '<button type="button" class="strim-h a" role="slider" aria-label="Start"></button><button type="button" class="strim-h b" role="slider" aria-label="End"></button></div>' +
      '<div class="strim-row"><span class="strim-t"></span><span class="strim-btns"><button type="button" class="strim-b cx">cancel</button><button type="button" class="strim-b go">done</button></span></div>' +
      '<div class="strim-msg" role="status" aria-live="polite"></div>';
    host.appendChild(box);
    var bar = box.querySelector(".strim-bar"), keep = box.querySelector(".strim-keep"), ph = box.querySelector(".strim-ph"), ha = box.querySelector(".strim-h.a"), hb = box.querySelector(".strim-h.b"),
      tx = box.querySelector(".strim-t"), go = box.querySelector(".go"), cx = box.querySelector(".cx"), msg = box.querySelector(".strim-msg");
    var D = 0, A = 0, B = 0, busy = false, raf = 0, wasLoop = v.loop, closed = false;
    var MIN = 0.3;
    function pct(t) { return (D ? t / D * 100 : 0) + "%"; }
    function paint() {
      ha.style.left = pct(A); hb.style.left = pct(B); keep.style.left = pct(A); keep.style.width = (D ? (B - A) / D * 100 : 0) + "%";
      ha.setAttribute("aria-valuemin", "0"); ha.setAttribute("aria-valuemax", B.toFixed(1)); ha.setAttribute("aria-valuenow", A.toFixed(1)); ha.setAttribute("aria-valuetext", fmt(A));
      hb.setAttribute("aria-valuemin", A.toFixed(1)); hb.setAttribute("aria-valuemax", D.toFixed(1)); hb.setAttribute("aria-valuenow", B.toFixed(1)); hb.setAttribute("aria-valuetext", fmt(B));
      tx.innerHTML = "<b>" + fmt(A) + "</b> – <b>" + fmt(B) + "</b> · keep " + (B - A).toFixed(1) + " s of " + D.toFixed(1);
    }
    function loop() {
      if (closed) return;
      var t = v.currentTime; ph.style.left = pct(t);
      if (!busy && !v.paused && (t >= B - 0.03 || t < A - 0.05)) { try { v.currentTime = A; } catch (_) {} }
      raf = requestAnimationFrame(loop);
    }
    function drag(h, e) {
      if (busy) return; e.preventDefault(); try { h.setPointerCapture(e.pointerId); } catch (_) {}
      var playing = !v.paused; v.pause();
      var mv = function (ev) { var r = bar.getBoundingClientRect(), t = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * D;
        if (h === ha) A = Math.min(t, B - MIN); else B = Math.max(t, A + MIN); paint(); try { v.currentTime = h === ha ? A : B; } catch (_) {} };
      var up = function () { h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); try { v.currentTime = A; } catch (_) {} if (playing) v.play().catch(function () {}); };
      h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up); mv(e);
    }
    function key(h, e) {
      var step = e.shiftKey ? 1 : 0.1, d = e.key === "ArrowRight" || e.key === "ArrowUp" ? step : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : 0;
      if (!d) return; e.preventDefault(); if (h === ha) A = Math.max(0, Math.min(A + d, B - MIN)); else B = Math.min(D, Math.max(B + d, A + MIN)); paint(); try { v.currentTime = h === ha ? A : Math.max(A, B - 0.5); } catch (_) {}
    }
    ha.addEventListener("pointerdown", function (e) { drag(ha, e); }); hb.addEventListener("pointerdown", function (e) { drag(hb, e); });
    ha.addEventListener("keydown", function (e) { key(ha, e); }); hb.addEventListener("keydown", function (e) { key(hb, e); });
    var onEnd = function () { if (closed || busy) return; try { v.currentTime = A; } catch (_) {} v.play().catch(function () {}); };   // the part runs to the clip's end: go round again
    v.addEventListener("ended", onEnd);
    function close(cancelled) { if (closed) return; closed = true; cancelAnimationFrame(raf); v.removeEventListener("ended", onEnd); v.loop = wasLoop; if (wasLoop) v.play().catch(function () {}); box.remove(); if (cancelled && o.onCancel) o.onCancel(); }
    cx.onclick = function () { if (!busy) close(true); };
    go.onclick = function () {
      if (busy) return;
      if (A < 0.05 && B > D - 0.05) { close(true); return; }   // nothing cut
      busy = true; go.disabled = cx.disabled = true; v.pause(); msg.textContent = "trimming…";
      cut(o.blob, A, B, { lib: o.lib, video: v, onProgress: function (p) { msg.textContent = "trimming… " + Math.round(p * 100) + "%"; } }).then(function (r) {
        msg.textContent = ""; var s = A, e = B; close(false); if (o.onDone) o.onDone(r.blob, { start: s, end: e, how: r.how });
      }, function (err) { busy = false; go.disabled = cx.disabled = false; msg.textContent = "That didn’t work here (" + ((err && err.message) || "unknown") + ")."; });
    };
    v.loop = false;
    duration(v).then(function (d) { D = d || 0; A = 0; B = D; if (!D) { msg.textContent = "Can’t read this clip’s length."; go.disabled = true; } paint(); try { v.currentTime = 0; } catch (_) {} v.play().catch(function () {}); raf = requestAnimationFrame(loop); });
    return { close: function () { close(true); } };
  }
  window.SurfaceTrim = { open: open, cut: cut };
})();
