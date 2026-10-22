/* Surface · Ripple — a water surface over any canvas (Dimitry, 21 Oct 2026, for the Frost ensemble piece, theme water:
   "a water surface feature, like a water distortion ... that goes with the water sounds, like the dripping").

   The method is Water Kit's (2urn/water-kit, its Ripple mode): the wave equation by finite differences on a height
   field, on the GPU, two textures in turn (after Hugo Elias's classic "2D water" and the GPU water demos that followed,
   e.g. Evan Wallace's WebGL Water). Light bends by the surface's slope (refraction), gathers where it curves (caustics)
   and glints where it faces the light (Phong specular). Drops are Gaussian bumps added to the field.

   It lays a WebGL2 canvas over the tool's own canvas and redraws that canvas through the water each frame. The tool
   keeps drawing as before; while the water is on, its canvas is hidden (opacity 0, still drawable and recordable),
   and the water canvas shows it bent. Captures take the water canvas (draw(): render now, then drawImage it).

     var w = SurfaceRipple.attach(srcCanvas, {preset:'drip', res:.5, hideSource:true, parent, zIndex})
     w.ok                         false when this browser has no WebGL2 or no float targets: then nothing shows
     w.enabled(true|false)        show the water (and hide the source) or put it away; returns the state
     w.drop(x, y, size, strength) x, y 0..1 of the canvas (top left 0,0); size 0..1 of the short side (≈.015);
                                  strength ≈1 (negative pulls the surface down: a bubble's pop is a small up then down)
     w.stir(x, y, vx, vy)         a finger or a particle moving: a short wake of small drops along its path (px/frame)
     w.rain(perSecond)            drops at random, on their own
     w.preset(id) / w.set({c2, damp, refr, spec, caus, size, rain, stir}) / w.get()
     w.tick(dt)                   advance (fixed 60 steps a second, at most 4 per call) and draw: call once a frame
     w.draw()                     draw now without stepping (for a capture: then drawImage(w.canvas))
     w.calm()                     a flat surface again (switching on starts calm)
     w.resize()                   after the source canvas changes size (tick checks too)
     w.destroy()
     SurfaceRipple.PRESETS        [{id, name, note, ...params}]

   A MATERIAL (Dimitry, 23 Oct 00:39: "the water ripple becomes a material", a displacement layer over the stage, apart
   from a tool's pattern, style and sound). Additive; with none of these set, the picture is exactly as before.
     w.colors({tint, glint, caustic, tintAmt})   each null (as before), a hex, or a name the host resolves through
                                  o.palette(name) → hex, asked every frame (so 'line', 'line2', 'ground' follow a
                                  palette that animates). tint: the depth color, laid over troughs and crests (tintAmt,
                                  default .35); glint: the color of the highlights (as before: white); caustic: the
                                  color of the light gathered where the surface curves (as before: the picture brightened)
     w.path(segs)                 the pattern the material follows: [[x0,y0,x1,y1],...] 0..1 of the canvas, y down
     w.drive({path, current})     path: drops per second along the path (0 off; scaled by w.flow), at most 2 a frame;
                                  current: how far the field carries the surface, in field cells a step (0 off)
     w.flow(v)                    0..1, how busy the tool's own motion is (scales the path's drops)
     w.current(data, gw, gh)      the tool's vector field, gw × gh pairs (vx, vy; y down), uploaded once per change
     SurfaceRipple.cost(w, n)     the GPU time of one frame in ms when the browser can time it (else CPU ms), over n
                                  frames: {ms, how}

   Cost: one small simulation (half the CSS pixels, at most 512 on a side) and one full-screen pass that samples the
   source canvas. Plain script, window.SurfaceRipple, no dependencies, loads nothing. */
(function () {
  "use strict";
  if (window.SurfaceRipple) return;

  var PRESETS = [
    { id: "still", name: "Still pond", note: "only what you and the sound drop in; long, slow rings", c2: 0.45, damp: 0.996, refr: 0.55, spec: 0.45, caus: 0.5, size: 0.018, rain: 0, stir: 0.6 },
    { id: "drip", name: "Drip", note: "a drop now and then from above, clean rings", c2: 0.42, damp: 0.993, refr: 0.6, spec: 0.5, caus: 0.6, size: 0.012, rain: 0.5, stir: 0.6 },
    { id: "rain", name: "Rain", note: "many small drops, short rings that cross", c2: 0.4, damp: 0.984, refr: 0.5, spec: 0.55, caus: 0.5, size: 0.007, rain: 16, stir: 0.5 },
    { id: "wake", name: "Wake", note: "no rain; every gesture leaves a long wake", c2: 0.45, damp: 0.995, refr: 0.65, spec: 0.4, caus: 0.55, size: 0.014, rain: 0, stir: 1.4 },
    { id: "glass", name: "Glass", note: "water on glass: beads that bend the light and fade", c2: 0.14, damp: 0.965, refr: 0.95, spec: 0.75, caus: 0.25, size: 0.022, rain: 1.5, stir: 0.8 }
  ];
  var DEF = PRESETS[1];

  var VS = "#version 300 es\nin vec2 p; out vec2 vUv; void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }";
  var HEAD = "#version 300 es\nprecision highp float; precision highp int; precision highp sampler2D;\n";
  /* the wave step (Water Kit's FS_WAVE): r = height now, g = height a step ago */
  var FS_WAVE = HEAD +
    "uniform sampler2D uState, uCur; uniform float uC2, uDamp, uAdv; uniform vec4 uDrops[16]; uniform int uCount; uniform float uAsp;\n" +
    "out vec4 o;\n" +
    "ivec2 cl(ivec2 p, ivec2 n){ return clamp(p, ivec2(0), n-1); }\n" +
    "void main(){\n" +
    "  ivec2 p = ivec2(gl_FragCoord.xy); ivec2 n = textureSize(uState,0);\n" +
    "  vec2 s; float sum;\n" +
    /* currents: the whole stencil is read from upstream (semi-Lagrangian), so the surface drifts with the tool's field */
    "  if (uAdv > 0.0) { vec2 fn = vec2(n), q = vec2(p)+0.5; vec2 uv = q/fn; vec2 v = texture(uCur, vec2(uv.x, 1.0-uv.y)).rg*vec2(1.0,-1.0);\n" +
    "    vec2 b = (q - v*uAdv)/fn, t = 1.0/fn; s = texture(uState,b).rg;\n" +
    "    sum = texture(uState,b+vec2(t.x,0)).r + texture(uState,b-vec2(t.x,0)).r + texture(uState,b+vec2(0,t.y)).r + texture(uState,b-vec2(0,t.y)).r; }\n" +
    "  else { s = texelFetch(uState,p,0).rg;\n" +
    "  sum = texelFetch(uState,cl(p+ivec2(1,0),n),0).r + texelFetch(uState,cl(p-ivec2(1,0),n),0).r\n" +
    "            + texelFetch(uState,cl(p+ivec2(0,1),n),0).r + texelFetch(uState,cl(p-ivec2(0,1),n),0).r; }\n" +
    "  float h = s.r, hp = s.g;\n" +
    "  float nh = h + (h - hp)*uDamp + uC2*(sum - 4.0*h);\n" +
    "  nh *= 0.9995 + 0.0005*uDamp;\n" +
    "  vec2 c = vec2(p)+0.5;\n" +
    "  for (int i=0;i<16;i++){ if(i>=uCount) break; vec4 d = uDrops[i]; vec2 dd = c - d.xy*vec2(n); nh += d.w*exp(-dot(dd,dd)/(d.z*d.z)); }\n" +
    "  o = vec4(clamp(nh,-8.0,8.0), h, 0.0, 1.0);\n" +
    "}";
  /* the look: the source seen through the surface */
  var FS_SHOW = HEAD +
    "in vec2 vUv; out vec4 o;\n" +
    "uniform sampler2D uWave, uSrc; uniform float uRefr, uSpec, uCaus; uniform vec2 uPx;\n" +
    "uniform vec3 uTint, uGlint, uCausC; uniform float uTintA, uCausA;\n" +
    "void main(){\n" +
    "  vec2 uv = vUv; vec2 t = 1.0/vec2(textureSize(uWave,0));\n" +
    "  float hc = texture(uWave,uv).r, hl = texture(uWave,uv-vec2(t.x,0)).r, hr = texture(uWave,uv+vec2(t.x,0)).r,\n" +
    "        hd = texture(uWave,uv-vec2(0,t.y)).r, hu = texture(uWave,uv+vec2(0,t.y)).r;\n" +
    "  vec2 grad = vec2(hr-hl, hu-hd)*0.5; float lap = hl+hr+hd+hu-4.0*hc;\n" +
    "  vec2 ruv = clamp(uv - grad*uPx*uRefr, vec2(0.0), vec2(1.0));\n" +
    "  vec4 c = texture(uSrc, ruv);\n" +
    "  float caus = clamp(-lap*3.0, -0.5, 1.0)*uCaus;\n" +
    "  c.rgb *= 1.0 + caus*0.6*(1.0-uCausA);\n" +
    /* the material's colors: light gathered in the caustic's color; the depth color over troughs and crests */
    "  float gl = max(caus,0.0)*0.9*uCausA; c.rgb += uCausC*gl; c.a = max(c.a, gl);\n" +
    "  float dep = clamp(abs(hc)*0.9, 0.0, 1.0)*uTintA; c.rgb = mix(c.rgb, c.rgb*uTint, dep*0.6) + uTint*dep*0.25; c.a = max(c.a, dep*0.25);\n" +
    "  vec3 nrm = normalize(vec3(-grad*6.0, 1.0)); vec3 L = normalize(vec3(-0.45,0.55,1.0));\n" +
    "  float sp = pow(max(dot(reflect(-L,nrm),vec3(0,0,1)),0.0),60.0)*uSpec*0.9;\n" +
    "  sp *= smoothstep(0.004, 0.04, length(grad));\n" +
    "  o = vec4(c.rgb + uGlint*sp, max(c.a, clamp(sp,0.0,1.0)));\n" +
    "}";

  function attach(src, o) {
    o = o || {};
    var P = Object.assign({}, DEF), on = false, ok = false, destroyed = false;
    var cv = o.canvas || document.createElement("canvas");
    cv.setAttribute("aria-hidden", "true");
    if (!o.canvas) {
      cv.className = "s-ripple";
      cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;visibility:hidden" + (o.zIndex != null ? ";z-index:" + o.zIndex : "");
      var par = o.parent || src.parentNode; if (par) { if (o.parent) par.appendChild(cv); else par.insertBefore(cv, src.nextSibling); }
    }
    var gl = null, prog = {}, buf, tex = [], fbo = [], srcTex, cur = 0, N = [0, 0], fmt = null, drops = [], acc = 0, rainAcc = 0, quiet = 1e9, res = o.res || 0.5;
    var SW = 0, SH = 0, lastMove = null;
    var COL = { tint: null, glint: null, caustic: null, tintAmt: 0.35 }, DRV = { path: 0, current: 0 }, PATH = [], PLEN = [], PTOT = 0, FLOW = 0.5, pathAcc = 0, curTex = null, curOk = false;

    function sh(type, s) { var x = gl.createShader(type); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; }
    function program(fs) {
      var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var a = gl.getActiveUniform(p, i), nm = a.name.replace(/\[0\]$/, ""); u[nm] = gl.getUniformLocation(p, a.name); }
      return { p: p, u: u };
    }
    function testFmt(ifmt, type) {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, 4, 4, 0, gl.RGBA, type, null);
      var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      var good = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(f); gl.deleteTexture(t); return good;
    }
    function init() {
      ok = false;
      try {
        gl = cv.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
        if (!gl) return;
        /* half floats: linear filtering is built into WebGL2 for them, and they are enough for a wave */
        var cbf = gl.getExtension("EXT_color_buffer_float"), cbh = gl.getExtension("EXT_color_buffer_half_float");
        if ((cbf || cbh) && testFmt(gl.RGBA16F, gl.HALF_FLOAT)) fmt = [gl.RGBA16F, gl.HALF_FLOAT];
        else if (cbf && gl.getExtension("OES_texture_float_linear") && testFmt(gl.RGBA32F, gl.FLOAT)) fmt = [gl.RGBA32F, gl.FLOAT];
        else return;
        prog.wave = program(FS_WAVE); prog.show = program(FS_SHOW);
        buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        srcTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, srcTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        curTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, curTex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, 1, 1, 0, gl.RG, gl.FLOAT, new Float32Array(2)); curOk = false;
        tex = []; fbo = []; N = [0, 0]; SW = SH = 0;
        ok = true; resize();
      } catch (e) { ok = false; try { console.warn("[ripple] " + (e && e.message)); } catch (_) {} }
    }
    function field(w, h) {
      for (var i = 0; i < 2; i++) { if (tex[i]) gl.deleteTexture(tex[i]); if (fbo[i]) gl.deleteFramebuffer(fbo[i]); }
      tex = []; fbo = [];
      for (var j = 0; j < 2; j++) {
        var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, fmt[0], w, h, 0, gl.RGBA, fmt[1], null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        tex.push(t); fbo.push(f);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); N = [w, h]; cur = 0;
    }
    function resize() {
      if (!ok) return;
      var w = src.width || 1, h = src.height || 1;
      if (w === SW && h === SH) return; SW = w; SH = h;
      cv.width = w; cv.height = h;
      /* the field: a share of the CSS pixels, at most 512 on its long side */
      var css = src.clientWidth || w, cssH = src.clientHeight || h, k = Math.min(res, 512 / Math.max(css, cssH));
      var fw = Math.max(16, Math.round(css * k)), fh = Math.max(16, Math.round(cssH * k));
      if (fw !== N[0] || fh !== N[1]) field(fw, fh);
    }
    function step() {
      var pw = prog.wave; gl.useProgram(pw.p); gl.viewport(0, 0, N[0], N[1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1 - cur]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[cur]); gl.uniform1i(pw.u.uState, 0);
      gl.uniform1f(pw.u.uC2, Math.min(0.5, P.c2)); gl.uniform1f(pw.u.uDamp, P.damp);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, curTex); gl.uniform1i(pw.u.uCur, 2); gl.uniform1f(pw.u.uAdv, curOk ? Math.max(0, +DRV.current || 0) : 0); gl.activeTexture(gl.TEXTURE0);
      var d = drops.splice(0, 16), a = new Float32Array(64);
      for (var i = 0; i < d.length; i++) a.set(d[i], i * 4);
      gl.uniform4fv(pw.u.uDrops, a); gl.uniform1i(pw.u.uCount, d.length);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); cur = 1 - cur;
    }
    function draw() {
      if (!ok || destroyed) return;
      resize();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (e) {}
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      var ps = prog.show; gl.useProgram(ps.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
      gl.uniform1i(ps.u.uWave, 0); gl.uniform1i(ps.u.uSrc, 1);
      gl.uniform1f(ps.u.uRefr, P.refr); gl.uniform1f(ps.u.uSpec, P.spec); gl.uniform1f(ps.u.uCaus, P.caus);
      var tc = rgb(COL.tint), gc = rgb(COL.glint), cc = rgb(COL.caustic);
      gl.uniform3fv(ps.u.uTint, tc || [1, 1, 1]); gl.uniform1f(ps.u.uTintA, tc ? Math.max(0, Math.min(1, +COL.tintAmt || 0)) : 0);
      gl.uniform3fv(ps.u.uGlint, gc || [1, 1, 1]); gl.uniform3fv(ps.u.uCausC, cc || [1, 1, 1]); gl.uniform1f(ps.u.uCausA, cc ? 1 : 0);
      /* refraction: a share of the picture, the same in pixels across and down */
      gl.uniform2f(ps.u.uPx, 0.1, 0.1 * N[0] / N[1]);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function calm() { if (!ok || !fbo.length) return; for (var i = 0; i < 2; i++) { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } gl.bindFramebuffer(gl.FRAMEBUFFER, null); drops.length = 0; }
    function addDrop(x, y, size, strength) {
      if (!ok || !on) return;
      var shortPx = Math.min(N[0], N[1]), r = Math.max(1.2, (size == null ? P.size : size) * shortPx);
      if (drops.length >= 48) drops.shift();
      /* field y runs up; the caller's y runs down */
      drops.push([x, 1 - y, r, (strength == null ? 1 : strength) * 0.9]); quiet = 0;
    }
    function tick(dt) {
      if (!ok || !on || destroyed) return;
      dt = Math.min(0.1, Math.max(0, +dt || 0));
      if (P.rain > 0) { rainAcc += P.rain * dt; while (rainAcc >= 1) { rainAcc -= 1; addDrop(Math.random(), Math.random(), P.size * (0.6 + Math.random() * 0.8), 0.6 + Math.random() * 0.6); } if (Math.random() < rainAcc) { rainAcc = 0; addDrop(Math.random(), Math.random(), P.size, 0.8); } }
      if (DRV.path > 0 && PTOT > 0) { pathAcc += DRV.path * (0.25 + FLOW) * dt; var k = 0; while (pathAcc >= 1 && k < 2) { pathAcc -= 1; k++; var pt = along(Math.random() * PTOT); addDrop(pt[0], pt[1], P.size * 0.6, 0.45 + Math.random() * 0.3); } if (pathAcc > 2) pathAcc = 2; }
      if (DRV.current > 0 && curOk) quiet = Math.min(quiet, 19);   // a current keeps the surface moving
      acc += dt; quiet += dt; var n = 0;
      /* a still surface (nothing dropped for 20 s) needs no steps, only the picture */
      while (acc >= 1 / 60 && n < 4) { acc -= 1 / 60; if (quiet < 20 || drops.length) step(); n++; }
      if (n === 4) acc = 0;
      draw();
    }
    function enabled(v) {
      if (v === undefined) return on;
      var was = on; on = !!v && ok;
      cv.style.visibility = on ? "visible" : "hidden";
      if (o.hideSource !== false) src.style.opacity = on ? "0" : "";
      if (on) { resize(); if (!was) calm(); quiet = 0; } else drops.length = 0;
      return on;
    }
    function stir(x, y, vx, vy) {
      if (!ok || !on) return;
      var sp = Math.hypot(vx || 0, vy || 0); if (sp < 0.5 || P.stir <= 0) return;
      var now = performance.now();
      if (lastMove && now - lastMove < 30) return; lastMove = now;
      addDrop(x, y, P.size * 0.55, Math.min(1.2, sp / 20) * P.stir * 0.5);
    }
    /* a color spec: null, a hex, or a name the host resolves (o.palette) */
    function rgb(c) { if (!c) return null; if (c[0] !== "#" && o.palette) { try { c = o.palette(c); } catch (_) { c = null; } } if (!c || !/^#[0-9a-f]{6}$/i.test(c)) return null;
      var v = parseInt(c.slice(1), 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; }
    function setPath(segs) { PATH = []; PLEN = []; PTOT = 0; (segs || []).forEach(function (q) { var l = Math.hypot(q[2] - q[0], q[3] - q[1]); if (!(l > 1e-6)) return; PATH.push(q); PTOT += l; PLEN.push(PTOT); }); }
    function along(d) { var lo = 0, hi = PLEN.length - 1; while (lo < hi) { var m = (lo + hi) >> 1; if (PLEN[m] < d) lo = m + 1; else hi = m; } var q = PATH[lo], s0 = lo ? PLEN[lo - 1] : 0, t = (d - s0) / ((PLEN[lo] - s0) || 1); return [q[0] + (q[2] - q[0]) * t, q[1] + (q[3] - q[1]) * t]; }
    function setCurrent(data, gw, gh) { if (!ok || !data || !(gw > 0) || !(gh > 0)) { curOk = false; return; }
      var a = data instanceof Float32Array ? data : new Float32Array(data);
      gl.bindTexture(gl.TEXTURE_2D, curTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, gw, gh, 0, gl.RG, gl.FLOAT, a.subarray(0, gw * gh * 2)); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); curOk = true; }
    cv.addEventListener("webglcontextlost", function (e) { e.preventDefault(); ok = false; if (o.hideSource !== false) src.style.opacity = ""; cv.style.visibility = "hidden"; try { o.onLost && o.onLost(); } catch (_) {} });
    cv.addEventListener("webglcontextrestored", function () { var was = on; init(); if (was) enabled(true); });
    init();
    if (o.preset) setPreset(o.preset);
    function setPreset(id) { var p = PRESETS.filter(function (x) { return x.id === id; })[0]; if (p) { Object.assign(P, p); } return P.id; }
    return {
      get ok() { return ok; }, canvas: cv,
      enabled: enabled, drop: addDrop, stir: stir,
      rain: function (r) { P.rain = Math.max(0, +r || 0); },
      preset: setPreset,
      set: function (x) { Object.assign(P, x || {}); }, get: function () { return Object.assign({}, P); },
      tick: tick, draw: draw, resize: resize, calm: calm,
      field: function () { return N.slice(); },
      colors: function (c) { if (c) Object.assign(COL, c); return Object.assign({}, COL); },
      path: setPath, flow: function (v) { FLOW = Math.max(0, Math.min(1, +v || 0)); },
      drive: function (d) { if (d) { if (d.path != null) DRV.path = Math.max(0, +d.path || 0); if (d.current != null) DRV.current = Math.max(0, +d.current || 0); } return Object.assign({}, DRV); },
      current: setCurrent,
      destroy: function () { destroyed = true; enabled(false); try { cv.remove(); } catch (_) {} try { var l = gl && gl.getExtension("WEBGL_lose_context"); l && l.loseContext(); } catch (_) {} }
    };
  }
  /* the cost of a frame: GPU time where the browser can measure it (EXT_disjoint_timer_query_webgl2), else CPU time
     around tick (which only queues GPU work, so it reads low); resolves {ms, how} */
  function cost(w, n) { n = n || 60; var gl = w && w.canvas && w.canvas.getContext("webgl2"); return new Promise(function (res) {
    var ext = gl && gl.getExtension("EXT_disjoint_timer_query_webgl2"), out = [], i = 0;
    function one() { if (i++ >= n) { out.sort(function (a, b) { return a - b; }); return res({ ms: out.length ? +out[out.length >> 1].toFixed(3) : null, how: ext ? "gpu" : "cpu" }); }
      if (ext) { var q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); w.tick(1 / 60); gl.endQuery(ext.TIME_ELAPSED_EXT);
        var poll = function () { if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return requestAnimationFrame(poll); if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) out.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); requestAnimationFrame(one); }; requestAnimationFrame(poll); }
      else { var t = performance.now(); w.tick(1 / 60); gl && gl.finish(); out.push(performance.now() - t); requestAnimationFrame(one); } }
    one(); }); }
  window.SurfaceRipple = { attach: attach, PRESETS: PRESETS, cost: cost };
})();
