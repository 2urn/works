/* Surface · Surround — the stage all around you, on a headset (Dimitry, 13 Nov 2026: "a full screen 360 browser view
   ... so that it's not just in a browser window in the Vision Pro, but actually fills the visual field").

   What a web page can and cannot do (Apple, June 2026): Safari on Apple Vision Pro, and Quest and other headsets, run
   WebXR "immersive-vr": the page replaces the room and draws all around you. "immersive-ar" (the room showing through
   behind the page) is NOT offered by Safari on visionOS, so a page cannot show the room. This module does the first and
   is honest about the second: the tool's button appears only where immersive-vr exists, and the room is not shown.

   The stage is drawn into a canvas by the tool (the same compositing it records with, like SurfaceOutput), uploaded as
   a texture every frame and hung on the inside of a cylinder around the head:
     wall  — a curved screen, `arc` degrees wide (default 150°), straight ahead
     wrap  — the picture repeated all the way round, so there is no back of the room

   Input: a pinch (visionOS: the eyes aim, the fingers press) or a controller trigger hits the wall; the module turns
   the hit into pointer events at the stage's place on the page, so the tool's own touch and drag handling runs
   unchanged. Only a press has a ray on visionOS (the browser hides where the eyes rest), so hover does not exist there.

     var S = SurfaceSurround.mount({
       name: 'Current',
       draw: function (canvas, w, h) {},     // draw the stage into canvas at w × h pixels
       target: function () { return element }, // optional: the element the stage's pointer events go to (default: elementFromPoint)
       rect: function () { return DOMRect }, // optional: where the stage sits on the page, for mapping the pinch to page pixels
       button: element | selector,           // optional: shown only when immersive-vr exists, toggles the mode
       fps: 60, mode: 'wall', arc: 150, radius: 2.6, size: 2048,
       onChange: function (active) {}
     });
     S.ready → Promise<boolean>   S.enter() (inside a tap)   S.exit()   S.active()   S.set({mode, arc})
   Plain script, window.SurfaceSurround, no dependencies. Untested on a headset by the author: tested against a
   simulated WebXR session only; the test card of the tool says so. */
(function () {
  "use strict";
  if (window.SurfaceSurround) return;
  var XR = typeof navigator !== "undefined" ? navigator.xr : null;

  function supported() {
    if (!XR || !XR.isSessionSupported) return Promise.resolve(false);
    return XR.isSessionSupported("immersive-vr").then(function (v) { return !!v; }, function () { return false; });
  }

  var VS = "attribute vec3 p;attribute vec2 t;uniform mat4 V,P;varying vec2 u;void main(){u=t;gl_Position=P*V*vec4(p,1.);}";
  var FS = "precision mediump float;uniform sampler2D s;uniform float k;varying vec2 u;void main(){vec4 c=texture2D(s,u);gl_FragColor=vec4(c.rgb*k,1.);}";

  function mount(O) {
    O = O || {};
    var mode = O.mode === "wrap" ? "wrap" : "wall", arc = O.arc || 150, R = O.radius || 2.6, SZ = O.size || 2048;
    var fps = Math.max(10, Math.min(90, O.fps || 60)), gap = 1000 / fps;
    var ses = null, gl = null, ref = null, src = null, sctx = null, tex = null, prog = null, buf = null, ibuf = null, nidx = 0;
    var loc = {}, lastDraw = 0, aspect = 16 / 9, W = 0, H = 0, downs = [], cursor = null, ok = false, btn = null, wallH = 1, ang = 0, reps = 1, strip = 1, nextId = 1, entering = null, lastWin = 0, winRaf = 0, tickGap = 120;

    function changed() { try { O.onChange && O.onChange(!!ses); } catch (e) {} paintBtn(); }
    function paintBtn() {
      if (!btn) return;
      btn.hidden = !ok;
      btn.setAttribute("aria-pressed", ses ? "true" : "false");
    }

    function sh(type, text) { var s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s); return s; }

    function geometry() {
      /* the cylinder's inside, radius R. The picture keeps its shape: when the wall would be taller than a room (3.4 m)
         it gets narrower, not stretched. wrap repeats the picture a whole number of times all the way round. */
      var per = (mode === "wrap" ? 2 * Math.PI / 3 : Math.min(260, Math.max(40, arc)) * Math.PI / 180);
      wallH = R * per / aspect;
      if (wallH > 3.4) { wallH = 3.4; per = wallH * aspect / R; }
      var n = 1;
      if (mode === "wrap") { n = Math.max(1, Math.round(2 * Math.PI / per)); per = 2 * Math.PI / n; wallH = R * per / aspect; }
      ang = mode === "wrap" ? 2 * Math.PI : per;
      var seg = 48, v = [], idx = [], i, j, a, c = 0;
      for (j = 0; j < n; j++) {
        var a0 = mode === "wrap" ? -Math.PI + j * per : -ang / 2;
        for (i = 0; i <= seg; i++) {
          a = a0 + per * i / seg;
          var x = R * Math.sin(a), z = -R * Math.cos(a), uu = i / seg;
          v.push(x, wallH / 2, z, uu, 0, x, -wallH / 2, z, uu, 1);
          if (i < seg) { idx.push(c, c + 1, c + 2, c + 1, c + 3, c + 2); }
          c += 2;
        }
      }
      reps = n; strip = per;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
      nidx = idx.length;
    }

    function ray(frame, srcI) {
      var pose = srcI.targetRaySpace && frame.getPose(srcI.targetRaySpace, ref);
      if (!pose) return null;
      var m = pose.transform.matrix;                          // column-major; ray goes down -z
      return { o: [m[12], m[13], m[14]], d: [-m[8], -m[9], -m[10]] };
    }
    /* hit on the cylinder's inside: where (u 0..1 across the picture, v 0..1 down), or null */
    function hit(r) {
      var ox = r.o[0], oz = r.o[2], dx = r.d[0], dz = r.d[2];
      var A = dx * dx + dz * dz; if (A < 1e-9) return null;
      var B = 2 * (ox * dx + oz * dz), C = ox * ox + oz * oz - R * R, D = B * B - 4 * A * C;
      if (D < 0) return null;
      var t = (-B + Math.sqrt(D)) / (2 * A);                  // the far root: the wall behind the ray's start
      if (t <= 0) return null;
      var x = ox + dx * t, z = oz + dz * t, y = r.o[1] + r.d[1] * t;
      if (Math.abs(y) > wallH / 2) return null;
      var a = Math.atan2(x, -z);                              // 0 straight ahead
      var u;
      if (mode === "wrap") { u = (((a + Math.PI) % strip) + strip) % strip / strip; }
      else { if (Math.abs(a) > ang / 2) return null; u = (a + ang / 2) / ang; }
      return { u: u, v: 0.5 - y / wallH };
    }

    /* the pinch becomes pointer events on the page where the stage is */
    function toPage(h) {
      var r = O.rect && O.rect(); if (!r || !r.width || !r.height) r = { left: 0, top: 0, width: innerWidth, height: innerHeight };
      return { x: r.left + h.u * r.width, y: r.top + h.v * r.height };
    }
    function fire(type, id, h) {
      var p = toPage(h), el = (O.target && O.target()) || document.elementFromPoint(p.x, p.y) || document.body;
      var init = { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, pointerId: 40 + id, pointerType: "touch", isPrimary: true,
        width: 8, height: 8, pressure: type === "pointerdown" || type === "pointermove" ? 0.5 : 0, button: type === "pointermove" ? -1 : 0,
        buttons: type === "pointerdown" || type === "pointermove" ? 1 : 0 };
      try { el.dispatchEvent(new PointerEvent(type, init)); } catch (e) {}
      return p;
    }
    function find(si) { for (var i = 0; i < downs.length; i++) if (downs[i].src === si) return i; return -1; }
    function release(i, cancel) {
      var d = downs[i]; downs.splice(i, 1); cursor = null;
      var p = fire(cancel ? "pointercancel" : "pointerup", d.id, d.h);
      /* a tap (hardly moved) is a click too; a drag is not, as with a finger */
      if (!cancel && Math.abs(p.x - d.p0.x) < 8 && Math.abs(p.y - d.p0.y) < 8) {
        try { (((O.target && O.target()) || document.elementFromPoint(p.x, p.y) || document.body)).dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: p.x, clientY: p.y })); } catch (e) {}
      }
    }
    function onSelect(type, e) {
      var i = find(e.inputSource);
      if (type === "start") {
        var r = e.frame && ray(e.frame, e.inputSource), h = r && hit(r);
        if (h && i < 0) { var d = { src: e.inputSource, id: nextId++, h: h, p0: toPage(h) }; downs.push(d); cursor = h; fire("pointerdown", d.id, h); }
      } else if (i >= 0) {
        var r2 = e.frame && ray(e.frame, e.inputSource), h2 = r2 && hit(r2);
        if (h2) downs[i].h = h2;
        release(i, false);
      }
    }

    function frameFn(t, frame) {
      if (!ses) return;
      ses.requestAnimationFrame(frameFn);
      var layer = ses.renderState.baseLayer; if (!layer) return;
      /* the page's own frames may stop while the headset has the screen: then the tool is stepped from here */
      if (O.tick && performance.now() - lastWin > tickGap) { try { O.tick(performance.now()); } catch (e) {} }
      /* drags: keep sending moves for presses that are held; a source that has gone ends its press */
      for (var k = downs.length - 1; k >= 0; k--) {
        var d = downs[k], still = false;
        for (var q = 0; q < ses.inputSources.length; q++) if (ses.inputSources[q] === d.src) still = true;
        if (!still) { release(k, true); continue; }
        var r = ray(frame, d.src), h = r && hit(r);
        if (h) { d.h = h; cursor = h; fire("pointermove", d.id, h); }
      }
      if (t - lastDraw >= gap - 6 /* on a 72 or 90 Hz headset this draws every frame; the fps option only caps faster ones */) {
        lastDraw = t;
        try { O.draw && O.draw(src, W, H); } catch (e) {}
        if (cursor) { sctx.save(); sctx.fillStyle = "rgba(255,255,255,.85)"; sctx.strokeStyle = "rgba(0,0,0,.5)"; sctx.lineWidth = 2;
          sctx.beginPath(); sctx.arc(cursor.u * W, cursor.v * H, Math.max(6, W / 160), 0, 7); sctx.fill(); sctx.stroke(); sctx.restore(); }
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      }
      var pose = frame.getViewerPose(ref); if (!pose) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
      gl.clearColor(0.015, 0.015, 0.02, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
      gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(loc.t); gl.vertexAttribPointer(loc.t, 2, gl.FLOAT, false, 20, 12);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc.s, 0); gl.uniform1f(loc.k, 1);
      for (var i = 0; i < pose.views.length; i++) {
        var v = pose.views[i], vp = layer.getViewport(v);
        gl.viewport(vp.x, vp.y, vp.width, vp.height);
        gl.uniformMatrix4fv(loc.V, false, v.transform.inverse.matrix);
        gl.uniformMatrix4fv(loc.P, false, v.projectionMatrix);
        gl.drawElements(gl.TRIANGLES, nidx, gl.UNSIGNED_SHORT, 0);
      }
    }

    function watchWin() { lastWin = performance.now(); if (ses) winRaf = requestAnimationFrame(watchWin); }
    function cleanup() {
      ses = null; while (downs.length) release(0, true); cursor = null;
      try { cancelAnimationFrame(winRaf); } catch (e) {}
      try { if (gl) { var x = gl.getExtension("WEBGL_lose_context"); x && x.loseContext(); } } catch (e) {}
      gl = null; src = null; sctx = null; tex = null; prog = null; buf = null; ibuf = null;
      changed();
    }
    function enter() {
      if (ses) return Promise.resolve(true);
      if (entering) return entering;
      if (!XR) return Promise.resolve(false);
      var mine = null;
      /* called straight from the tap (Safari wants the user gesture on the same call stack); a throw becomes a rejection */
      var req; try { req = XR.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] }); } catch (e) { req = Promise.reject(e); }
      entering = req.then(function (s) {
        mine = s;
        src = document.createElement("canvas");
        var main = null;
        try { main = O.rect && O.rect(); } catch (e) {}
        aspect = main && main.width && main.height ? main.width / main.height : 16 / 9;
        aspect = Math.max(0.6, Math.min(3, aspect));
        W = SZ; H = Math.max(256, Math.round(SZ / aspect)); if (H > SZ) { H = SZ; W = Math.round(SZ * aspect); }
        src.width = W; src.height = H; sctx = src.getContext("2d");
        var gc = document.createElement("canvas");
        gl = gc.getContext("webgl", { xrCompatible: true, antialias: true, alpha: false }) || gc.getContext("experimental-webgl", { xrCompatible: true });
        if (!gl) throw new Error("no webgl");
        prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("shader");
        loc = { p: gl.getAttribLocation(prog, "p"), t: gl.getAttribLocation(prog, "t"), V: gl.getUniformLocation(prog, "V"), P: gl.getUniformLocation(prog, "P"),
          s: gl.getUniformLocation(prog, "s"), k: gl.getUniformLocation(prog, "k") };
        buf = gl.createBuffer(); ibuf = gl.createBuffer(); geometry();
        tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.disable(gl.CULL_FACE); gl.disable(gl.DEPTH_TEST);
        s.addEventListener("end", function () { if (ses === s) cleanup(); });
        s.addEventListener("selectstart", function (e) { onSelect("start", e); });
        s.addEventListener("selectend", function (e) { onSelect("end", e); });
        return Promise.resolve(gl.makeXRCompatible ? gl.makeXRCompatible() : null).then(function () {
          s.updateRenderState({ baseLayer: new XRWebGLLayer(s, gl) });
          return s.requestReferenceSpace("local");
        }).then(function (r) {
          ref = r; ses = s; lastDraw = -1e9; lastWin = performance.now(); watchWin(); s.requestAnimationFrame(frameFn); changed(); return true;
        });
      }).catch(function (e) {
        try { console.warn("surround", e); } catch (_) {}
        if (mine) { try { mine.end(); } catch (_) {} }
        if (ses === mine) ses = null;
        if (!ses) cleanup();
        return false;
      }).then(function (v) { entering = null; return v; });
      return entering;
    }
    function exit() { if (ses) { try { ses.end(); } catch (e) {} } }

    var api = {
      ready: supported().then(function (v) { ok = v; paintBtn(); return v; }),
      enter: enter, exit: exit, active: function () { return !!ses; },
      supported: function () { return ok; },
      set: function (o) { o = o || {}; if (o.mode) mode = o.mode === "wrap" ? "wrap" : "wall"; if (o.arc) arc = o.arc; if (ses && gl) geometry(); },
      hit: hit
    };
    if (O.button) {
      btn = typeof O.button === "string" ? document.querySelector(O.button) : O.button;
      if (btn) { btn.hidden = true; btn.addEventListener("click", function () { if (ses) exit(); else enter(); }); }
    }
    return api;
  }
  window.SurfaceSurround = { mount: mount, supported: supported };
})();
