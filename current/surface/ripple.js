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

   WEATHER (Dimitry, 22 Oct 13:36: "it's like a procedural material, and it does end if you stop the signal. It just sort
   of peters out ... signal off. And then when the new scene ... has settled, it becomes signal on ... like the weather").
   Additive; nothing changes unless a host calls these.
     w.signal(on)                 the surface's sources on or off: rain and the path's drops thin out over ~1.2 s (and
                                  thicken over ~1.6 s), drop() and stir() are let through less and less; waves already
                                  there are left alone to calm by the simulation's own damping. Returns the target
     w.energy()                   how much the surface is moving now: the mean of 4·|height − last height| + 4·|curvature|
                                  over a 16 × 16 × 64 sample of the field (ripples: what is seen; a level offset or a
                                  slow tilt is not), read back from a 16 × 16 target (cached 80 ms; 0 when off). Rain or a
                                  stirred wake reads ≈ .01–.1; a flat surface 0
     w.handover({swap, ready, thr, rel, max, delay})   a change of material like weather: signal off, wait until
                                  the energy falls under thr (.004) or to rel (.15) of its peak since the signal went
                                  off, or max seconds pass (6, of the surface's own time), then swap() (the host
                                  puts in the new preset, colors, drive, or switches the surface off); then wait until
                                  ready() is true (the scene has settled) plus a random delay ([.5, 2] s), then signal
                                  on. Called while the surface is off, swap() runs at once (it switches the surface on,
                                  flat) and the new sources wait for ready() + delay. A second handover mid-way takes
                                  over (its swap and ready replace the first's). enabled(false) ends it. A swap that
                                  switches the surface off lets what is left fade out over the picture (.9 s)
     w.weather()                  null, or {phase: 'calm' | 'gap', t, energy}

   RAIN FILLS THE POOL (Dimitry, 29 Oct 00:18: "the first drops of water seemingly fall on solid ground, splash a lot
   more ... a hard floor that leaves water drops everywhere until more and more water falls, eventually creating the pool
   so that the entire surface is covered in water and it can then have the waves", "one setting, not a replacement").
   Additive; nothing changes unless a host calls fill(). Seen from above: the floor is dry and hard, with a gentle relief
   (a fixed value noise, the same here and on the GPU) whose hollows fill first. level 0 is dry, 1 is a full pool.
     w.fill(level)                0..1 turns the floor on and sets how full it is (null: off, the surface as before).
                                  Where the floor is dry a drop does not ring: it SPLASHES (a crown of droplets thrown
                                  out in a ring that land and stay; beads that touch merge, as on glass). Where the water stands, drops
                                  ring as always; waves stop at the water's edge. As level rises, puddles open in the
                                  hollows, join, and at 1 the whole surface is water
     w.splash(x, y, size)         a splash where you say (x, y 0..1, y down), whatever is under it
     w.wetAt(x, y)                0..1: is the floor under water here (the relief and the level; beads not counted)
     w.dry()                      a dry floor again: no beads, no waves (the host sets the level back to 0)
     w.pour(k)                    each drop brings k times its own water (1); poured() all water ever poured (before k),
                                  volume() the water standing now, capacity(c) the water it takes to cover c (0.8) of the floor
     w.tilt(dx, dy, slope, offset) / tilt(null)   the level tilts (draining): water stands where level + slope*(p.dir -
                                  offset) is above the floor (p from the middle, field units, y up); drain() hands the
                                  water to the level (empties the pool grid); beadsFade(f) shrinks the beads by a share
     w.walls(on)                  the pattern (path()) holds the surface still along its lines: waves reflect off them
     w.vibrate(amp, hz)           shallow water does not ring, it trembles: amp 0..1, its pattern's wavelength from hz
     o.onSplash(x, y, size, k)    called for every splash on dry floor, so the host can make it heard
     w.light({c1, c2, round, a, stops, amt, mode, ground})   mode filter | wash | glow: the light is laid here, not by the host;
                                  ground {c1, c2, round, a, stops}: it falls only on what differs from that ground
     w.passOnly(on)               the surface as a pass: no drops or rings, the picture as it is (for a light that keeps the ground)
     w.light({c1, c2, round, a, stops: [s0, s1], amt})   a light over the water: its glints and rim take its color, a tilted
                                  surface reflects a little of it (a: degrees, 90 is top to bottom); null: none

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
  /* THE FLOOR'S RELIEF: integer-hashed value noise, three octaves, identical in GLSL and in JS (floorJS) so the CPU
     knows where a drop lands on dry floor. p is in field units: x across scaled by the aspect, y up, both 0..1 */
  /* THE FLOOR'S RELIEF is baked once per field size (floorBake, in JS: integer-hashed value noise, three octaves) into a
     byte texture the same size as the field, so the GPU reads one value where it would compute 36 hashes (review
     92666bcfcb r-1), and wetAt reads the same bytes: the CPU and the GPU agree on where the floor is dry */
  /* the floor read smoothly (29 Oct 14:33, "a better formula"): floorAt is a cubic B-spline over the baked relief (four
     bilinear taps, Sigg & Hadwiger 2005), used where the wave step decides wet or dry; the draw pass reads the same float
     floor bilinearly (the rim's line comes from that, at half a cell) and wetAt its nearest texel: all within half a cell */
  /* DRAINING (Dimitry, 30 Oct 18:12: "an effect ... to drain the water ... drop suddenly from one direction to another,
     or fall as if suddenly gravity had taken over ... a wall of water and it fell ... or just a gentle evaporation"):
     the level gains a tilt, uTilt = (direction x, y in field units, slope, offset): the water stands where
     level + slope*(p.dir - offset) is above the floor. No slope and a sinking level is evaporation (the hollows last);
     a growing slope is a tray tipped; a steep slope whose offset runs down the screen is a wall of water falling */
  var GL_FLOOR = "uniform vec4 uTilt;\n" +
    "float tiltAt(vec2 uv){ return uTilt.z*(dot(uv-0.5, uTilt.xy) - uTilt.w); }\n" +
    "float floorWet(float n, float lv){ float L = lv*1.15-0.08; return smoothstep(n-0.06, n+0.06, L); }\n" +
    /* water meets water in a smooth union (a polynomial smooth max), so a bead near the pool's edge is joined to it by a
       fillet, the way a meniscus bridges, never two outlines side by side */
    "float wetMix(float f, float b){ float k = 0.2, h = max(k-abs(f-b), 0.0)/k; return max(f, b) + h*h*k*0.25; }\n" +
    "float bsamp(sampler2D T, vec2 uv){ vec2 sz = vec2(textureSize(T,0)), p = uv*sz-0.5, i = floor(p), f = p-i, f2 = f*f, f3 = f2*f;\n" +
    "  vec2 w0 = (1.0-3.0*f+3.0*f2-f3)/6.0, w1 = (4.0-6.0*f2+3.0*f3)/6.0, w2 = (1.0+3.0*f+3.0*f2-3.0*f3)/6.0, w3 = f3/6.0;\n" +
    "  vec2 g0 = w0+w1, g1 = w2+w3, h0 = (i-0.5+w1/g0)/sz, h1 = (i+1.5+w3/g1)/sz;\n" +
    "  return g0.y*(g0.x*texture(T,h0).r + g1.x*texture(T,vec2(h1.x,h0.y)).r) + g1.y*(g0.x*texture(T,vec2(h0.x,h1.y)).r + g1.x*texture(T,h1).r); }\n" +
    "float floorAt(vec2 uv){ return bsamp(uFloor, uv); }\n" +
    /* WATER WHERE IT FELL (Dimitry, 29 Oct 16:04: "water should accumulate where the water is being sprinkled…. not
       elsewhere"): uPool holds the standing water's surface (the floor plus what has collected there, lower than the
       floor where none has), read smoothly; a place is wet where that surface is above its floor. uGK is how much of the
       old, everywhere-at-once level still counts (none when the water only falls where a finger is). */
    "float wetAtF(vec2 uv, float n){ return max(floorWet(n, uLevel*uGK + tiltAt(uv)), smoothstep(n-0.012, n+0.012, bsamp(uPool, uv))); }\n" +
    /* HOW DEEP (Dimitry, 29 Oct 23:45: "ripples are way too much for an 8th inch of water"): the water over the floor here,
       in the relief's units; under uDeep it is a film, which rings hardly at all (the wave step damps it hard) and instead
       trembles with the sound (the show pass's vibration) */
    "float depthAt(vec2 uv, float n){ return max((uLevel*uGK + tiltAt(uv))*1.15-0.08-n, bsamp(uPool, uv)-n); }\n";
  /* the wave step (Water Kit's FS_WAVE): r = height now, g = height a step ago; with the floor on (uFill), b = the beads
     of water a splash left (they stay), a = a splash's flash (it fades in a few frames) */
  var FS_WAVE = HEAD +
    "uniform sampler2D uState, uCur; uniform float uC2, uDamp, uAdv; uniform vec4 uDrops[16]; uniform int uCount; uniform float uAsp;\n" +
    "uniform float uFill, uLevel, uGK, uDeep, uShal; uniform sampler2D uFloor, uBeads, uPool;\n" +
    "uniform sampler2D uWalls; uniform float uWall;\n" +
    "out vec4 o;\n" + GL_FLOOR +
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
    "  vec4 ba = texelFetch(uState,p,0); float m = 1.0;\n" +
    "  if (uFill > 0.5) { vec2 q0 = (vec2(p)+0.5)/vec2(n); float n0 = floorAt(q0); m = smoothstep(0.45, 0.9, wetMix(wetAtF(q0, n0), texture(uBeads,q0).r*0.6));\n" +
    /* a film damps its rings within a few cells; deep water rings as before */
    "    m *= mix(uShal, 1.0, smoothstep(0.0, uDeep, depthAt(q0, n0))); }\n" +
    "  for (int i=0;i<16;i++){ if(i>=uCount) break; vec4 d = uDrops[i]; vec2 dd = c - d.xy*vec2(n); nh += d.w*exp(-dot(dd,dd)/(d.z*d.z)); }\n" +
    /* a hard floor: no wave where no water stands; it calms toward flat at the edge instead of ringing off it */
    "  nh *= m;\n" +
    /* THE PATTERN AS WALLS (Dimitry, 30 Oct 18:13: "letting the water react to patterns as if they were barriers to
       waves"): where the pattern's lines are, the surface is held still, so a wave meets them and comes back, and passes
       only through the gaps between them (a held edge reflects, as at a harbor wall) */
    "  if (uWall > 0.5) nh *= 1.0 - 0.92*texture(uWalls, (vec2(p)+0.5)/vec2(n)).r;\n" +   /* nearly all of a wave comes back; a little seeps through, as through a breakwater */
    "  o = vec4(clamp(nh,-8.0,8.0), h, 0.0, 1.0);\n" +
    "}";
  /* the look: the source seen through the surface */
  var FS_SHOW = HEAD +
    "in vec2 vUv; out vec4 o;\n" +
    "uniform sampler2D uWave, uSrc; uniform float uRefr, uSpec, uCaus, uQ; uniform vec2 uPx;\n" +
    "uniform vec3 uTint, uGlint, uCausC; uniform float uTintA, uCausA; uniform float uFill, uLevel, uDark, uGK, uDeep; uniform sampler2D uFloor, uBeads, uPool;\n" +
    "uniform float uVib, uVibL, uTime;\n" +
    /* LIGHT over the water (Current's Light, 30 Oct): two colors in a gradient (uLD: direction, z = 1 from the middle out),
       its stops and strength; the glints and the rim's sheen take its color where they are, and a tilted surface reflects a
       little of it, as water reflects the sky */
    "uniform vec3 uL1, uL2, uLD; uniform vec2 uLS; uniform float uLA, uAspS;\n" +
    /* THE LIGHT ITSELF, here instead of over the page, when the host asks (uLM: 1 filter, 2 wash, 3 glow): so that it can
       KEEP THE GROUND (uKG; Dimitry, 30 Oct 20:21): it falls on what differs from the ground under it (the ground's own
       gradient, uG*), so the particles take it and the ground stays as it is */
    "uniform float uLM, uKG; uniform vec3 uG1, uG2, uGD; uniform vec2 uGS;\n" +
    "vec3 skyAt(vec2 uv){ float t; vec2 q = vec2((uv.x-0.5)*uAspS, 0.5-uv.y); if (uLD.z > 0.5) t = length(q)/(0.5*length(vec2(uAspS,1.0))); else t = dot(q, uLD.xy)/(abs(uAspS*uLD.x)+abs(uLD.y)) + 0.5;\n" +
    "  return mix(uL1, uL2, clamp((t-uLS.x)/max(uLS.y-uLS.x, 0.001), 0.0, 1.0)); }\n" +
    "vec3 groundAt(vec2 uv){ float t; vec2 q = vec2((uv.x-0.5)*uAspS, 0.5-uv.y); if (uGD.z > 0.5) t = length(q)/(0.5*length(vec2(uAspS,1.0))); else t = dot(q, uGD.xy)/(abs(uAspS*uGD.x)+abs(uGD.y)) + 0.5;\n" +
    "  return mix(uG1, uG2, clamp((t-uGS.x)/max(uGS.y-uGS.x, 0.001), 0.0, 1.0)); }\n" + GL_FLOOR +
    /* with the floor on, what bends the light is the water there is: the waves where it stands, a dome over each bead,
       and a meniscus at a puddle's rim */
    "float wetM(vec2 uv, float b){ return smoothstep(0.45, 0.9, wetMix(wetAtF(uv, texture(uFloor,uv).r), b*0.6)); }\n" +
    /* the waves where the water stands (hAt), and the meniscus at a puddle's rim (menAt), apart: the rim is read at half a
       field cell, so its line is as fine as the floor and the beads it comes from, not the field's steps (Dimitry, 29 Oct
       14:33: "water fill needs more resolution or a better formula") */
    "float hAt(vec2 uv){ vec4 s = texture(uWave,uv); if (uFill < 0.5) return s.r; return s.r*wetM(uv, texture(uBeads,uv).r); }\n" +
    "float menAt(vec2 uv){ float m = wetM(uv, texture(uBeads,uv).r); return 0.5*m*(1.0-m); }\n" +
    /* a bead's own lens, read at the beads' own resolution so a small drop is a clean dome, not a speckle */
    "vec2 beadGrad(vec2 uv){ vec2 t = 1.0/vec2(textureSize(uBeads,0)); float l = texture(uBeads,uv-vec2(t.x,0)).r, r = texture(uBeads,uv+vec2(t.x,0)).r, d = texture(uBeads,uv-vec2(0,t.y)).r, u = texture(uBeads,uv+vec2(0,t.y)).r;\n" +
    "  return vec2(r-l, u-d)*0.5*vec2(textureSize(uBeads,0))/vec2(textureSize(uWave,0)); }\n" +
    "void main(){\n" +
    "  vec2 uv = vUv; vec2 t = 1.0/vec2(textureSize(uWave,0));\n" +
    "  float hc = hAt(uv), hl = hAt(uv-vec2(t.x,0)), hr = hAt(uv+vec2(t.x,0)),\n" +
    "        hd = hAt(uv-vec2(0,t.y)), hu = hAt(uv+vec2(0,t.y));\n" +
    "  vec2 grad = vec2(hr-hl, hu-hd)*0.5*uQ;\n" +   /* uQ: per cell of the old field, so a finer field bends the light as much */
    /* the caustics' curvature with the diagonals too, so its light follows the rings, round, not the grid's squares */
    "  float lap = 0.5*(hl+hr+hd+hu-4.0*hc) + 0.125*(hAt(uv+t)+hAt(uv-t)+hAt(uv+vec2(t.x,-t.y))+hAt(uv+vec2(-t.x,t.y))-4.0*hc); lap *= uQ*uQ;\n" +
    "  float rim = 0.0, wbS = -1.0;\n" +
    "  if (uFill > 0.5) { float b1 = texture(uBeads,uv).r; grad += beadGrad(uv)*0.2*(1.0-wetM(uv, b1));\n" +   /* a bead's lens: faint read as glass at .3 (29 Oct 23:45) and as nothing at .08 (30 Oct 18:12: "I don't see the little splash droplets anymore"); .2 catches the light */
    /* THE FILM TREMBLES WITH THE SOUND: shallow water does not ring, it shivers in a standing pattern (Faraday's, three
       waves at 60 degrees), its wavelength from the sound's pitch (capillary waves: wavelength ~ frequency^-2/3), its
       strength from the sound's level, only where the water is a film */
    "    if (uVib > 0.001) { float n1 = texture(uFloor,uv).r, sh = smoothstep(0.75, 1.0, wetM(uv, b1))*(1.0-smoothstep(0.0, uDeep, depthAt(uv, n1)));\n" +
    /* NO GRID (Dimitry, 30 Oct 18:09: on the beat the water got "goosebumps ... a fine moire grid ... repeating on a grid"):
       three waves at 60 degrees ARE a lattice, and a loud short beat made it stand out. Now seven waves, each its own
       direction (the golden angle apart), its own length (within a third of the pitch's) and its own slow drift, and the
       floor's relief bends their phase: a tremble with no repeat, as rain-stirred shallow water has */
    "      if (sh > 0.002) { vec2 q = uv*vec2(textureSize(uWave,0))*(6.2832/uVibL); float ph = n1*23.0, s = 0.6 + 0.4*sin(uTime*5.0); vec2 g = vec2(0.0);\n" +
    "        for (int k=0;k<7;k++){ float fk = float(k), a = fk*2.39996+0.3, sc = 1.0 + 0.33*sin(fk*1.7+0.5); vec2 d = vec2(cos(a), sin(a)); g -= d*sc*sin(dot(d,q)*sc + ph*(0.6+0.13*fk) + uTime*(0.7+0.23*fk) + fk*1.3); }\n" +
    "        grad += g*0.38*s*uVib*sh*(6.2832/uVibL)*0.04; } }\n" +
    /* THE RIM IS A SOFT LENS (Dimitry, 30 Oct 13:54: the edges of the openings, where the water thins, read "frosted ... glass
       or sandblasted"; he wants them "blurred ... like a lens but one that is smooth that's just happens to be catching the
       light in a soft way", light at a raking angle). The water's edge is read from eight taps on a ring a few cells wide:
       their mean is a blurred shore (Wb) and their spread its slope; the meniscus is the bump Wb(1-Wb), so its slope is
       (1-2Wb) times the shore's: a broad smooth swell that bends the light gently and has no line of its own. It adds no
       caustic (the old rim's curvature made the crisp bright line); rim says where it is, for the raking sheen below */
    "    { vec2 R = t*2.6; float wc = wetAtF(uv, texture(uFloor,uv).r), ws = 0.0; vec2 gw = vec2(0.0);\n" +
    "      for (int k=0;k<8;k++){ float a = float(k)*0.7854; vec2 dr = vec2(cos(a), sin(a)); vec2 u2 = uv+dr*R; float w = smoothstep(0.45, 0.9, wetAtF(u2, texture(uFloor,u2).r)); ws += w; gw += dr*w; }\n" +
    "      float wb = (ws + smoothstep(0.45, 0.9, wc))/9.0; gw *= 0.25/2.6; rim = 4.0*wb*(1.0-wb); wbS = wb;\n" +
    "      grad += (1.0-2.0*wb)*gw*0.9*uQ; hc += 0.25*rim; } }\n" +
    "  vec2 ruv = clamp(uv - grad*uPx*uRefr, vec2(0.0), vec2(1.0));\n" +
    "  vec4 c = texture(uSrc, ruv);\n" +
    /* wet floor reads a touch darker than dry; a splash's flash is light thrown up off the floor */
    "  if (uFill > 0.5) { float b0 = texture(uBeads,uv).r, wv = max(wbS >= 0.0 ? wbS : wetM(uv, b0), smoothstep(0.02, 0.25, b0)); c.rgb *= 1.0 - uDark*wv; }\n" +
    "  float caus = clamp(-lap*3.0, -0.5, 1.0)*uCaus;\n" +
    "  c.rgb *= 1.0 + caus*0.6*(1.0-uCausA);\n" +
    /* the material's colors: light gathered in the caustic's color; the depth color over troughs and crests */
    "  float gl = max(caus,0.0)*0.9*uCausA; c.rgb += uCausC*gl; c.a = max(c.a, gl);\n" +
    "  float dep = clamp(abs(hc)*0.9, 0.0, 1.0)*uTintA; c.rgb = mix(c.rgb, c.rgb*uTint, dep*0.6) + uTint*dep*0.25; c.a = max(c.a, dep*0.25);\n" +
    "  vec3 nrm = normalize(vec3(-grad*6.0, 1.0)); vec3 L = normalize(vec3(-0.45,0.55,1.0));\n" +
    "  float sp = pow(max(dot(reflect(-L,nrm),vec3(0,0,1)),0.0),60.0)*uSpec*0.9;\n" +
    "  sp *= smoothstep(0.004, 0.04, length(grad));\n" +
    /* the rim's sheen: light from low across the water, caught broadly by the swell, soft (a low power, no threshold) */
    "  if (rim > 0.001) { vec3 Lr = normalize(vec3(-0.75,0.55,0.38)); sp += pow(max(dot(reflect(-Lr,nrm),vec3(0,0,1)),0.0),6.0)*uSpec*0.35*rim; }\n" +
    "  vec3 gc = uGlint; if (uLA > 0.0) { vec3 sk = skyAt(uv); gc = mix(uGlint, sk*1.15, uLA); c.rgb = mix(c.rgb, sk, clamp(length(grad)*1.6, 0.0, 0.3)*uLA); }\n" +
  "  if (uLM > 0.5 && uLA > 0.0) { vec3 sk = skyAt(uv); float ob = 1.0; if (uKG > 0.5) ob = c.a < 0.99 ? c.a : smoothstep(0.035, 0.2, length(c.rgb - groundAt(uv)));\n" +
    "    vec3 lit = uLM < 1.5 ? c.rgb*sk : (uLM < 2.5 ? (1.0-2.0*sk)*c.rgb*c.rgb + 2.0*sk*c.rgb : 1.0-(1.0-c.rgb)*(1.0-sk)); c.rgb = mix(c.rgb, lit, uLA*ob); }\n" +
  "  o = vec4(c.rgb + gc*sp, max(c.a, clamp(sp,0.0,1.0)));\n" +
    "}";
  /* the energy readback: a 16 × 16 target, each texel the mean of 8 × 8 taps of its share of the field, in three
     ranges (b fine, g middle, r coarse) so a byte target keeps the small values. It reads motion and curvature, never the
     height or a plain tilt: the wave conserves its mean, so drops leave a level offset and slow tilts that are not
     waves; ripples and the caustics are curvature */
  var FS_EN = HEAD +
    "uniform sampler2D uState; out vec4 o;\n" +
    "void main(){ ivec2 n = textureSize(uState,0); vec2 cell = vec2(n)/16.0; vec2 q = floor(gl_FragCoord.xy); float s = 0.0;\n" +
    "  for (int j=0;j<8;j++) for (int i=0;i<8;i++) { ivec2 p = clamp(ivec2((q + (vec2(i,j)+0.5)/8.0)*cell), ivec2(0), n-1);\n" +
    "    vec2 v = texelFetch(uState,p,0).rg; float lap = texelFetch(uState,clamp(p+ivec2(1,0),ivec2(0),n-1),0).r + texelFetch(uState,clamp(p-ivec2(1,0),ivec2(0),n-1),0).r\n" +
    "      + texelFetch(uState,clamp(p+ivec2(0,1),ivec2(0),n-1),0).r + texelFetch(uState,clamp(p-ivec2(0,1),ivec2(0),n-1),0).r - 4.0*v.r;\n" +
    "    s += abs(v.r - v.g)*4.0 + abs(lap)*4.0; }\n" +
    "  s /= 64.0; o = vec4(clamp(s*4.0,0.0,1.0), clamp(s*64.0,0.0,1.0), clamp(s*1024.0,0.0,1.0), 1.0); }";

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
    var gl = null, prog = {}, buf, tex = [], fbo = [], srcTex, cur = 0, N = [0, 0], fmt = null, drops = [], acc = 0, rainAcc = 0, quiet = 1e9, res = o.res || 0.7, CAP = o.max || 960, Q = 1, slowT = 0;   // finer than it was (0.5, 512): small drops rang as squares (Dimitry, 29 Oct: "very low rez")
    var SW = 0, SH = 0, lastMove = null;
    var LIGHT = null, PASS = false;   // light({c1, c2, round, a, stops, amt}) or null
    var COL = { tint: null, glint: null, caustic: null, tintAmt: 0.35 }, DRV = { path: 0, current: 0 }, PATH = [], PLEN = [], PTOT = 0, FLOW = 0.5, pathAcc = 0, curTex = null, curOk = false;
    var DEEP = 0.2, VIB = { a: 0, t: 0, l: 8 }, POUR = 1, POURED = 0;   // how deep is a film; the film's tremble; how much water a drop brings
    var WALL = { on: false, tex: null, cv: null, key: '' };   // the pattern as walls
    var TILT = [0, 0, 0, 0];   // the level's tilt while draining (dir x, dir y, slope, offset)
    var GK = 1, PL = null, plTex = null, plDirty = true, plAt = 0;   // the pool where the water fell (pourAt, poolStep)
    var FILL = null, FLB = null, flTex = null, fullT = 0, BEADS = [], FLY = [], bdCv = null, bdCx = null, bdTex = null, bdDirty = true, SPRB = null;
    var offFade = 0, fadeT = 0, sig = 1, sigT = 1, HO = null, enTex = null, enFbo = null, enBuf = new Uint8Array(16 * 16 * 4), enAt = -1e9, enVal = 0;

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
        prog.wave = program(FS_WAVE); prog.show = program(FS_SHOW); try { prog.en = program(FS_EN); } catch (_) { prog.en = null; } enTex = enFbo = null; bdTex = flTex = null; FLB = null; plTex = null; poolUpload.need = true; bdDirty = true;   /* a restored context owns none of the old textures (review bc62d0e r-1) */
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
      /* the field: a share of the CSS pixels, at most CAP (960) on its long side */
      /* a small screen (a phone, a tablet held up) keeps a lower cap: the finer field is for the big ones (review cfd0d1b7fd r-3) */
      var css = src.clientWidth || w, cssH = src.clientHeight || h, cap = o.max || (Math.max(css, cssH) < 1100 ? Math.min(640, CAP) : CAP), k = Math.min(res, cap / Math.max(css, cssH));
      var fw = Math.max(16, Math.round(css * k)), fh = Math.max(16, Math.round(cssH * k));
      /* Q: how many cells this field has for each one the old field (half the CSS pixels, at most 512) had. A wave moves
         a cell a step, so the field steps Q times as often, and damps and drifts 1/Q as much each step: the rings keep
         the size, speed and life they had, only drawn finer. */
      Q = Math.max(1, Math.max(fw, fh) / Math.max(16, Math.min(0.5 * Math.max(css, cssH), 512)));
      if (fw !== N[0] || fh !== N[1]) field(fw, fh);
    }
    function step() {
      var pw = prog.wave; gl.useProgram(pw.p); gl.viewport(0, 0, N[0], N[1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1 - cur]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[cur]); gl.uniform1i(pw.u.uState, 0);
      gl.uniform1f(pw.u.uC2, Math.min(0.5, P.c2)); gl.uniform1f(pw.u.uDamp, Math.pow(P.damp, 1 / Q));
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, curTex); gl.uniform1i(pw.u.uCur, 2); gl.uniform1f(pw.u.uAdv, curOk ? Math.max(0, +DRV.current || 0) : 0); gl.activeTexture(gl.TEXTURE0);
      var d = drops.splice(0, 16), a = new Float32Array(64);
      for (var i = 0; i < d.length; i++) a.set(d[i], i * 4);
      gl.uniform4fv(pw.u.uDrops, a); gl.uniform1i(pw.u.uCount, d.length);
      var fo = floorOn(); if (fo) { floorBake(); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, flTex); gl.uniform1i(pw.u.uFloor, 3); gl.activeTexture(gl.TEXTURE0); }
      if (fo) poolBind(pw, 5); gl.uniform1f(pw.u.uFill, fo ? 1 : 0); gl.uniform1f(pw.u.uLevel, FILL || 0); gl.uniform1f(pw.u.uGK, GK); gl.uniform4f(pw.u.uTilt, TILT[0], TILT[1], TILT[2], TILT[3]); gl.uniform1f(pw.u.uDeep, DEEP); gl.uniform1f(pw.u.uShal, Math.pow(0.8, 1 / Q));
      gl.uniform1f(pw.u.uWall, WALL.on && wallTex() ? 1 : 0); if (WALL.on && WALL.tex) { gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, WALL.tex); gl.uniform1i(pw.u.uWalls, 6); gl.activeTexture(gl.TEXTURE0); }
      if (fo) { beadTex(); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, bdTex); gl.uniform1i(pw.u.uBeads, 4); gl.activeTexture(gl.TEXTURE0); }
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
      gl.uniform1f(ps.u.uRefr, P.refr); gl.uniform1f(ps.u.uSpec, P.spec); gl.uniform1f(ps.u.uCaus, P.caus); gl.uniform1f(ps.u.uQ, Q);
      var fo = floorOn(); if (fo) { floorBake(); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, flTex); gl.uniform1i(ps.u.uFloor, 3); gl.activeTexture(gl.TEXTURE0); }
      if (fo) { beadTex(); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, bdTex); gl.uniform1i(ps.u.uBeads, 4); gl.activeTexture(gl.TEXTURE0); }
      if (fo) poolBind(ps, 5); gl.uniform1f(ps.u.uFill, fo ? 1 : 0); gl.uniform1f(ps.u.uLevel, FILL || 0); gl.uniform1f(ps.u.uGK, GK); gl.uniform4f(ps.u.uTilt, TILT[0], TILT[1], TILT[2], TILT[3]); gl.uniform1f(ps.u.uDeep, DEEP); gl.uniform1f(ps.u.uVib, fo ? VIB.a : 0); gl.uniform1f(ps.u.uVibL, VIB.l); gl.uniform1f(ps.u.uTime, (performance.now() / 1000) % 1000);
      /* wet floor reads darker than dry; the darkening fades out as the pool fills, so a full pool looks as before */
      { var LG = LIGHT; gl.uniform1f(ps.u.uLA, LG ? LG.amt : 0); gl.uniform1f(ps.u.uLM, LG ? LG.mode : 0); if (LG) { gl.uniform3fv(ps.u.uL1, LG.c1); gl.uniform3fv(ps.u.uL2, LG.c2); gl.uniform3f(ps.u.uLD, LG.dx, LG.dy, LG.round ? 1 : 0); gl.uniform2f(ps.u.uLS, LG.s0, LG.s1); gl.uniform1f(ps.u.uAspS, N[0] / Math.max(1, N[1]));
          var G = LG.ground; gl.uniform1f(ps.u.uKG, G ? 1 : 0); if (G) { gl.uniform3fv(ps.u.uG1, G.c1); gl.uniform3fv(ps.u.uG2, G.c2); gl.uniform3f(ps.u.uGD, G.dx, G.dy, G.round ? 1 : 0); gl.uniform2f(ps.u.uGS, G.s0, G.s1); } } }
      gl.uniform1f(ps.u.uDark, 0.1 * (1 - sstep(0.8, 1, FILL || 0)));
      var tc = rgb(COL.tint), gc = rgb(COL.glint), cc = rgb(COL.caustic);
      gl.uniform3fv(ps.u.uTint, tc || [1, 1, 1]); gl.uniform1f(ps.u.uTintA, tc ? Math.max(0, Math.min(1, +COL.tintAmt || 0)) : 0);
      gl.uniform3fv(ps.u.uGlint, gc || [1, 1, 1]); gl.uniform3fv(ps.u.uCausC, cc || [1, 1, 1]); gl.uniform1f(ps.u.uCausA, cc ? 1 : 0);
      /* refraction: a share of the picture, the same in pixels across and down */
      gl.uniform2f(ps.u.uPx, 0.1, 0.1 * N[0] / N[1]);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function energy() {
      if (!ok || !on || !fbo.length || !prog.en) return 0;
      var now = performance.now(); if (now - enAt < 80) return enVal; enAt = now;
      if (!enFbo) { enTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, enTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 16, 16, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        enFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, enFbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, enTex, 0); }
      var pe = prog.en; gl.useProgram(pe.p); gl.bindFramebuffer(gl.FRAMEBUFFER, enFbo); gl.viewport(0, 0, 16, 16);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[cur]); gl.uniform1i(pe.u.uState, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      try { gl.readPixels(0, 0, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, enBuf); } catch (_) {}
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      var s = 0; for (var i = 0; i < 256; i++) { var r = enBuf[i * 4], g = enBuf[i * 4 + 1], b = enBuf[i * 4 + 2]; s += b < 255 ? b / 255 / 1024 : g < 255 ? g / 255 / 64 : r / 255 / 4; }
      enVal = s / 256 * Q; return enVal;   // per old cell, so a calm threshold means what it meant (review cfd0d1b7fd r-4)
    }
    function rnd(d) { d = d || [0.5, 2]; return d[0] + Math.random() * (d[1] - d[0]); }
    function handover(h) {
      h = h || {};
      if (!ok) { try { h.swap && h.swap(); } catch (_) {} return; }
      if (!on) { HO = null; try { h.swap && h.swap(); } catch (_) {} if (!on) return;
        sig = sigT = 0; HO = { phase: "gap", t: 0, ready: h.ready, delay: rnd(h.delay), at: null, e: 0 }; return; }
      sigT = 0; var t0 = HO && HO.phase === "calm" ? HO.t : 0;   // a new handover mid-calm keeps the clock: max is from the first
      var e0 = HO && HO.phase === "calm" && HO.e0 != null ? HO.e0 : null;
      HO = { phase: "calm", t: t0, m: -1, e: null, e0: e0, thr: h.thr || 0.004, rel: h.rel || 0.15, max: h.max || 6, swap: h.swap, ready: h.ready, delay: rnd(h.delay), at: null };
    }
    function weatherTick(dt) {
      var g = dt / (sigT > sig ? 1.6 : 1.2); sig = sigT > sig ? Math.min(sigT, sig + g) : Math.max(sigT, sig - g);
      if (!HO) return;
      HO.t += dt;
      if (HO.phase === "calm") {
        if (HO.t - HO.m >= 0.1) { HO.m = HO.t; HO.e = energy(); if (HO.e0 == null || HO.e > HO.e0) HO.e0 = HO.e; }
        if ((sig <= 0.02 && HO.e != null && (HO.e < HO.thr || HO.e < HO.e0 * HO.rel)) || HO.t >= HO.max) {
          var h = HO; HO = { phase: "gap", t: 0, ready: h.ready, delay: h.delay, at: null, e: h.e }; sig = 0;
          offFade = 900; try { h.swap && h.swap(); } catch (e) { try { console.warn("[ripple] swap " + (e && e.message)); } catch (_) {} } offFade = 0;
        }
      } else {
        var rd = true; try { rd = !HO.ready || !!HO.ready(); } catch (_) {}
        if (rd && HO.at == null) HO.at = HO.t; else if (!rd) HO.at = null;
        if (HO.at != null && HO.t - HO.at >= HO.delay) { HO = null; sigT = 1; }
      }
    }
    function calm() { if (!ok || !fbo.length) return; for (var i = 0; i < 2; i++) { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } gl.bindFramebuffer(gl.FRAMEBUFFER, null); drops.length = 0; }
    function addDrop(x, y, size, strength, own) {
      if (!ok || !on) return;
      if (PASS) return;
      if (!own && sig < 1 && Math.random() >= sig) return;   // signal off: a drop from outside is let through less and less
      var shortPx = Math.min(N[0], N[1]), r = Math.max(2.6, (size == null ? P.size : size) * shortPx);   // under ~2.5 cells a drop's rings are finer than the grid can hold and read as a checkerboard
      if (FILL != null && wetAt(x, y) < 0.5) { splash(x, y, size, strength); return; }
      if (FILL != null && FILL < 1) { var sz1 = size == null ? P.size : size; pourAt(x, y, 0.015 * Math.pow(Math.max(0.004, sz1) / 0.01, 2), sz1 * 2); }   // rain into a puddle feeds it
      if (drops.length >= 48) drops.shift();
      /* field y runs up; the caller's y runs down */
      drops.push([x, 1 - y, r, (strength == null ? 1 : strength) * 0.9]); quiet = 0;
    }
    /* the floor's relief, baked: one byte a field cell, x across scaled by the aspect, y up */
    function hsh(x, y, sd) { var h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(sd, 2246822519 | 0)) >>> 0; h = Math.imul((h ^ (h >>> 13)) >>> 0, 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; }
    function vn(px, py, sd) { var ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); ix += 4096; iy += 4096;
      var a = (hsh(ix, iy, sd) & 65535) / 65535, b = (hsh(ix + 1, iy, sd) & 65535) / 65535, c = (hsh(ix, iy + 1, sd) & 65535) / 65535, d = (hsh(ix + 1, iy + 1, sd) & 65535) / 65535;
      return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy; }
    function floorN(px, py) { px *= 5; py *= 5; var f = 0.55 * vn(px, py, 1) + 0.3 * vn(px * 2.1, py * 2.1, 2) + 0.15 * vn(px * 4.3, py * 4.3, 3); return Math.max(0, Math.min(1, (f - 0.2) / 0.6)); }
    function floorBake() {
      /* baked at twice the field, in floats, so a puddle's rim is a smooth line, not the field's steps (Dimitry, 29 Oct 11:47: "the
         low resolution border on the water edges") */
      if (!ok || !N[0]) return; var w = Math.round(N[0] * 2), h = Math.round(N[1] * 2); if (FLB && FLB.w === w && FLB.h === h) return;
      var a = new Float32Array(w * h);   // floats, not bytes: a byte's steps showed as dots along a rim
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) a[y * w + x] = floorN((x + 0.5) / h, (y + 0.5) / h);
      if (!flTex) { flTex = gl.createTexture(); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, flTex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, flTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, w, h, 0, gl.RED, gl.FLOAT, a); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.activeTexture(gl.TEXTURE0);   /* uploads keep off unit 0, where the wave sits (review 47ee r-1) */
      FLB = { w: w, h: h, a: a };
    }
    function sstep(a, b, v) { var t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); }
    function wetAt(x, y) { if (FILL == null) return 1; floorBake(); if (!FLB) return 1;
      var ix = Math.max(0, Math.min(FLB.w - 1, Math.floor(x * FLB.w))), iy = Math.max(0, Math.min(FLB.h - 1, Math.floor((1 - y) * FLB.h))), n = FLB.a[iy * FLB.w + ix], L = (FILL * GK + TILT[2] * (((x - 0.5) * TILT[0] + ((1 - y) - 0.5) * TILT[1]) - TILT[3])) * 1.15 - 0.08;
      return Math.max(sstep(n - 0.06, n + 0.06, L), sstep(n - 0.012, n + 0.012, poolSurf(x, y))); }
    /* the floor is on while it is filling, and while a full pool still has splashes to finish; a full, settled pool takes
       the old path (no floor reads at all) */
    /* the pool: a coarse grid of how much water stands where, poured in by every drop and splash, running downhill on the
       floor's relief to the hollows near where it fell, never across the room */
    function poolInit() { if (!N[0]) return null; var w = Math.max(32, Math.round(N[0] / 8)), h = Math.max(18, Math.round(N[1] / 8));
      if (PL && PL.w === w && PL.h === h) return PL; var old = PL;
      var f = new Float32Array(w * h); for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) f[y * w + x] = floorN((x + 0.5) / h, (y + 0.5) / h);
      PL = { w: w, h: h, d: new Float32Array(w * h), f: f, m: new Float32Array(w * h), up: new Float32Array(w * h) };
      if (old) for (var y2 = 0; y2 < h; y2++) for (var x2 = 0; x2 < w; x2++) PL.d[y2 * w + x2] = old.d[Math.min(old.h - 1, Math.floor(y2 * old.h / h)) * old.w + Math.min(old.w - 1, Math.floor(x2 * old.w / w))];   /* a resize keeps the puddles (review 47ee r-4) */
      plDirty = true; return PL; }
    function pourAt(x, y, vol, rad) { var P2 = poolInit(); if (!P2 || !(vol > 0)) return; POURED += vol; vol *= POUR; var cx = x * P2.w, cy = (1 - y) * P2.h, R = Math.max(0.8, rad * P2.h), R2 = 2 * R * R, sum = 0, i, j, c = Math.ceil(R * 2.2);
      var x0 = Math.max(0, Math.floor(cx - c)), x1 = Math.min(P2.w - 1, Math.ceil(cx + c)), y0 = Math.max(0, Math.floor(cy - c)), y1 = Math.min(P2.h - 1, Math.ceil(cy + c));
      for (j = y0; j <= y1; j++) for (i = x0; i <= x1; i++) sum += Math.exp(-((i + 0.5 - cx) * (i + 0.5 - cx) + (j + 0.5 - cy) * (j + 0.5 - cy)) / R2);
      if (!(sum > 0)) return; for (j = y0; j <= y1; j++) for (i = x0; i <= x1; i++) P2.d[j * P2.w + i] += vol * Math.exp(-((i + 0.5 - cx) * (i + 0.5 - cx) + (j + 0.5 - cy) * (j + 0.5 - cy)) / R2) / sum;
      plDirty = true; }
    function poolStep() { var P2 = PL; if (!P2 || !plDirty) return; var w = P2.w, h = P2.h, d = P2.d, f = P2.f, m = P2.m, moved = 0;
      for (var it = 0; it < 2; it++) { m.fill(0);
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var c = y * w + x, dc = d[c]; if (dc <= 0.012) continue;   /* a film this thin holds (surface tension): water runs to hollows, not across the floor */ var hc = f[c] + dc, best = -1, hb = hc;
          if (x > 0 && f[c - 1] + d[c - 1] < hb) { hb = f[c - 1] + d[c - 1]; best = c - 1; } if (x < w - 1 && f[c + 1] + d[c + 1] < hb) { hb = f[c + 1] + d[c + 1]; best = c + 1; }
          if (y > 0 && f[c - w] + d[c - w] < hb) { hb = f[c - w] + d[c - w]; best = c - w; } if (y < h - 1 && f[c + w] + d[c + w] < hb) { hb = f[c + w] + d[c + w]; best = c + w; }
          if (best < 0) continue; var mv = Math.min(dc - 0.012, (hc - hb) * 0.45); if (mv > 1e-6) { m[c] -= mv; m[best] += mv; moved += mv; } }
        for (var k = 0; k < d.length; k++) d[k] = Math.max(0, d[k] + m[k]); }
      if (moved < 1e-5) plDirty = false; poolUpload.need = true; }
    function poolUpload() { var P2 = PL; if (!P2) return; var now = performance.now(); if (!poolUpload.need || now - plAt < 66) return; plAt = now; poolUpload.need = false;
      for (var k = 0; k < P2.d.length; k++) P2.up[k] = P2.d[k] > 0.006 ? P2.f[k] + P2.d[k] : P2.f[k] - 0.06;   // no water: the surface sits below the floor
      if (!plTex) { plTex = gl.createTexture(); gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, plTex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, plTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, P2.w, P2.h, 0, gl.RED, gl.FLOAT, P2.up); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.activeTexture(gl.TEXTURE0); }
    function poolBind(pr, unit) { poolInit(); if (!plTex) { poolUpload.need = true; plAt = 0; poolUpload(); } gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, plTex); gl.uniform1i(pr.u.uPool, unit); gl.activeTexture(gl.TEXTURE0); }
    function poolSurf(x, y) { var P2 = PL; if (!P2) return -1; var i = Math.max(0, Math.min(P2.w - 1, Math.floor(x * P2.w))), j = Math.max(0, Math.min(P2.h - 1, Math.floor((1 - y) * P2.h))), c = j * P2.w + i; return P2.d[c] > 0.006 ? P2.f[c] + P2.d[c] : -1; }
    function cover() { var P2 = PL; if (!P2) return 0; var n = 0; for (var k = 0; k < P2.d.length; k++) if (P2.d[k] > 0.004) n++; return n / P2.d.length; }
    function floorOn() { return FILL != null && (FILL < 1 || FLY.length > 0 || fullT < 0.6); }
    /* BEADS, AS RAIN ON GLASS HAS THEM (Dimitry, 29 Oct 07:32: the flashes "don't look like raindrops ... little individual
       droplets that sort of explode out from a center in a radial formation ... those patterns should stay on the ground in
       that sort of ring formation and just keep adding up"; "we do have ... a water on glass effect ... the water actually
       gloms together at individual droplet level"). The method is Rain on Glass's (after Lucas Bebber's Codrops
       experiments): every bead is a real drop on the CPU, {x, y, r} in bead pixels; two that touch merge into one with
       their area added, so the floor's water gathers bead by bead into puddles; each is drawn as a small dome into a
       height map the GPU bends the light through. A splash throws a crown of droplets out from where it struck, in a
       ring, that fly for a moment and land, and stay. */
    var BK = 2;   // bead pixels per field pixel
    function beadCanvas() { var w = N[0] * BK, h = N[1] * BK; if (!bdCv) { bdCv = document.createElement("canvas"); bdCx = bdCv.getContext("2d"); }
      if (bdCv.width !== w || bdCv.height !== h) { var ow = bdCv.width, oh = bdCv.height;
        if (ow && oh) { var kx = w / ow, ky = h / oh, kr = Math.sqrt(kx * ky); BEADS.forEach(function (b) { b.x *= kx; b.y *= ky; b.r *= kr; }); FLY.forEach(function (f) { f.x0 *= kx; f.x1 *= kx; f.y0 *= ky; f.y1 *= ky; f.r *= kr; }); }   /* the beads keep their place when the field resizes (review r-2) */
        bdCv.width = w; bdCv.height = h; bdDirty = true; } }
    /* the dome: a little irregular at its edge, so a field of beads is not a field of circles; four variants */
    function beadSprites() { if (SPRB) return SPRB; SPRB = []; var S = 48;
      for (var v = 0; v < 4; v++) { var c = document.createElement("canvas"); c.width = c.height = S; var x = c.getContext("2d"), im = x.createImageData(S, S), d = im.data, ph = [], am = [];
        for (var k = 0; k < 3; k++) { ph.push(Math.random() * 6.283); am.push((0.03 + Math.random() * 0.05) / (k + 1)); }
        for (var py = 0; py < S; py++) for (var px = 0; px < S; px++) { var sx = (px + 0.5) / S * 2 - 1, sy = (py + 0.5) / S * 2 - 1, a = Math.atan2(sy, sx), irr = 0;
          for (var k2 = 0; k2 < 3; k2++) irr += am[k2] * Math.sin((k2 + 2) * a + ph[k2]);
          var q = Math.hypot(sx, sy) / (1 + irr), h = q < 1 ? Math.sqrt(1 - q * q) : 0, i4 = (py * S + px) * 4;
          d[i4] = d[i4 + 1] = d[i4 + 2] = Math.round(h * 255); d[i4 + 3] = h > 0 ? 255 : 0; }
        x.putImageData(im, 0, 0); SPRB.push(c); }
      return SPRB; }
    function bead(x, y, r) { if (BEADS.length >= 3500) { var mi = 0; for (var i = 1; i < BEADS.length; i += 7) if (BEADS[i].r < BEADS[mi].r) mi = i; BEADS.splice(mi, 1); }
      BEADS.push({ x: x, y: y, r: r, v: Math.random() * 4 | 0 }); bdDirty = true; }
    function splash(x, y, size, strength) {
      if (!ok || !on || FILL == null) return;
      beadCanvas();
      var W2 = bdCv.width, H2 = bdCv.height, sp = Math.min(W2, H2), sz = Math.max(0.004, size == null ? P.size : size), r = Math.max(3, sz * sp * 1.3), k = Math.min(1.4, Math.max(0.4, strength == null ? 1 : strength));
      var cx = x * W2, cy = y * H2;
      pourAt(x, y, 0.03 * Math.pow(sz / 0.01, 2) * k, sz * 2.2);   // the water it brought stays here, and runs to the nearest hollow
      bead(cx, cy, r);                                                    // where it struck
      /* the crown: droplets thrown out evenly round, a little uneven in angle, reach and size; a few go farther */
      var n = 5 + Math.round(Math.random() * 4 * k), a0 = Math.random() * 6.283;
      for (var i = 0; i < n; i++) { var a = a0 + i / n * 6.283 + (Math.random() - 0.5) * 0.35, far = Math.random() < 0.25, d = r * (far ? 4.5 + Math.random() * 4 : 2.2 + Math.random() * 1.6) * k, rr = r * (far ? 0.22 + Math.random() * 0.18 : 0.3 + Math.random() * 0.3);
        FLY.push({ x0: cx, y0: cy, x1: cx + Math.cos(a) * d, y1: cy + Math.sin(a) * d, r: Math.max(1.6, rr), t: 0, T: 0.1 + Math.random() * 0.12 + (far ? 0.06 : 0), v: Math.random() * 4 | 0 }); }
      if (FLY.length > 900) FLY.splice(0, FLY.length - 900);
      quiet = 0; bdDirty = true;
      if (o.onSplash) { try { o.onSplash(x, y, sz, k); } catch (_) {} }   // the host makes it heard (Dimitry, 29 Oct 23:45: "doesn't make a sound")
    }
    /* droplets in the air land; beads that touch merge (area kept, the bigger one barely moves); beads under standing
       water are taken in by it */
    var BGRID = new Map();
    function beadsStep(dt) {
      if (FLY.length) { for (var i = FLY.length - 1; i >= 0; i--) { var f = FLY[i]; f.t += dt / f.T; if (f.t >= 1) { bead(f.x1, f.y1, f.r); FLY.splice(i, 1); } } bdDirty = true; }
      if (BEADS.length && FILL != null && Math.abs(FILL - (beadsStep.lf || 0)) > 0.004) { beadsStep.lf = FILL; bdDirty = true; }   // the pool rising reaches beads: look again
      if (!BEADS.length || !bdDirty) return;
      BGRID.clear(); var CS = 16, i2, j2;
      for (i2 = 0; i2 < BEADS.length; i2++) { var b = BEADS[i2], key = ((b.x / CS | 0) + 2000) * 8192 + ((b.y / CS | 0) + 2000), L = BGRID.get(key); if (!L) BGRID.set(key, L = []); L.push(i2); }
      var dead = new Uint8Array(BEADS.length);
      var maxR = 0; for (i2 = 0; i2 < BEADS.length; i2++) if (BEADS[i2].r > maxR) maxR = BEADS[i2].r;
      outer: for (i2 = 0; i2 < BEADS.length; i2++) { if (dead[i2]) continue; var A = BEADS[i2], gx = A.x / CS | 0, gy = A.y / CS | 0, reach = Math.min(3, Math.ceil((A.r + maxR) * 0.8 / CS));   /* a big puddle meets a bead at its rim, cells away (review r-3) */
        for (var ox = -reach; ox <= reach; ox++) for (var oy = -reach; oy <= reach; oy++) { var LL = BGRID.get((gx + ox + 2000) * 8192 + (gy + oy + 2000)); if (!LL) continue;
          for (var q = 0; q < LL.length; q++) { j2 = LL[q]; if (j2 <= i2 || dead[j2]) continue; var B = BEADS[j2], dx = A.x - B.x, dy = A.y - B.y, rr2 = (A.r + B.r) * 0.8;
            if (dx * dx + dy * dy < rr2 * rr2) { var big = A.r >= B.r ? A : B, sm = big === A ? B : A, a1 = big.r * big.r, a2 = sm.r * sm.r, t = a2 / (a1 + a2);
              big.x += (sm.x - big.x) * t; big.y += (sm.y - big.y) * t; big.r = Math.sqrt(a1 + a2);
              if (big === A) dead[j2] = 1; else { dead[i2] = 1; continue outer; } } } } }
      /* A BEAD THAT TOUCHES THE POOL JOINS IT (Dimitry, 29 Oct 15:27: dry and wet "cant share an edge without water creating a
         smooth bridge across"): surface tension pulls a drop into the puddle it touches, so a bead goes as soon as its rim
         meets standing water (its centre or any of four points on its edge), and the shader's smooth union draws the bridge */
      var keep = [], W0 = bdCv.width, H0 = bdCv.height;
      for (i2 = 0; i2 < BEADS.length; i2++) { if (dead[i2]) continue; var Bd = BEADS[i2], rr = Bd.r * 0.95, wet = wetAt(Bd.x / W0, Bd.y / H0) >= 0.5 || wetAt((Bd.x + rr) / W0, Bd.y / H0) >= 0.5 || wetAt((Bd.x - rr) / W0, Bd.y / H0) >= 0.5 || wetAt(Bd.x / W0, (Bd.y + rr) / H0) >= 0.5 || wetAt(Bd.x / W0, (Bd.y - rr) / H0) >= 0.5;
        if (!wet) keep.push(Bd); }
      BEADS = keep;
    }
    function beadTex() {
      if (!bdTex) { bdTex = gl.createTexture(); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, bdTex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); bdDirty = true; }
      if (!bdDirty) return; var now = performance.now(); if (now - (beadTex.at || 0) < 33 && FLY.length) return; beadTex.at = now; bdDirty = false; beadCanvas();   /* at most 30 redraws a second while drops are in the air */
      var x = bdCx, spr = beadSprites(); x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, bdCv.width, bdCv.height); x.fillStyle = "#000"; x.fillRect(0, 0, bdCv.width, bdCv.height);
      x.globalCompositeOperation = "lighten";
      /* a big bead is flatter: a puddle is a film with a rounded edge, not a ball */
      for (var i = 0; i < BEADS.length; i++) { var b = BEADS[i], R = b.r; x.globalAlpha = Math.min(1, 7 / Math.max(7, R)) * 0.95 + 0.05; x.drawImage(spr[b.v], b.x - R, b.y - R, R * 2, R * 2); }
      for (var j = 0; j < FLY.length; j++) { var f = FLY[j], e = 1 - Math.pow(1 - Math.min(1, f.t), 2.2), fx = f.x0 + (f.x1 - f.x0) * e, fy = f.y0 + (f.y1 - f.y0) * e, fr = f.r * (0.7 + 0.3 * e);
        x.globalAlpha = 0.9; x.drawImage(spr[f.v], fx - fr, fy - fr, fr * 2, fr * 2); }
      x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, bdTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bdCv); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.activeTexture(gl.TEXTURE0);
    }
    function tick(dt) {
      if (!ok || !on || destroyed) return;
      dt = Math.min(0.1, Math.max(0, +dt || 0));
      weatherTick(dt); if (!on) return;
      if (P.rain > 0 && sig > 0) { rainAcc += P.rain * sig * dt; while (rainAcc >= 1) { rainAcc -= 1; addDrop(Math.random(), Math.random(), P.size * (0.6 + Math.random() * 0.8), 0.6 + Math.random() * 0.6, true); } if (Math.random() < rainAcc) { rainAcc = 0; addDrop(Math.random(), Math.random(), P.size, 0.8, true); } }
      if (DRV.path > 0 && PTOT > 0 && sig > 0) { pathAcc += DRV.path * sig * (0.25 + FLOW) * dt; var k = 0; while (pathAcc >= 1 && k < 2) { pathAcc -= 1; k++; var pt = along(Math.random() * PTOT); addDrop(pt[0], pt[1], P.size * 0.6, 0.45 + Math.random() * 0.3, true); } if (pathAcc > 2) pathAcc = 2; }
      if (DRV.current > 0 && curOk) quiet = Math.min(quiet, 19);   // a current keeps the surface moving
      /* a device that cannot keep up (frames slower than 30 a second for three seconds) goes back to the old field once */
      if (!o.res && !o.max && res > 0.5) { slowT = dt > 1 / 30 && dt < 0.5 ? slowT + dt : Math.max(0, slowT - dt * 0.5); if (slowT > 3) { res = 0.5; CAP = 512; SW = SH = 0; slowT = 0; } }
      acc += dt; quiet += dt; var n = 0;
      /* a still surface (nothing dropped for 20 s) needs no steps, only the picture */
      if (FILL != null && FILL >= 1) fullT += dt; else fullT = 0;
      if (floorOn()) quiet = Math.min(quiet, 19);   // a floor that is filling keeps its flashes moving
      VIB.a += (VIB.t - VIB.a) * Math.min(1, dt * (VIB.t > VIB.a ? 3 : 1.5));   // rises over a third of a second: a beat does not slap a pattern on
      if (FILL != null) { beadsStep(dt); if (floorOn()) { poolStep(); poolUpload(); } }
      var hz = 60 * Q, most = Math.min(5, Math.ceil(2 * Q));   // at most 5 steps in a slow frame; a slower device drops time, not frames
      while (acc >= 1 / hz && n < most) { acc -= 1 / hz; if (!PASS && (quiet < 20 || drops.length || FLY.length)) step();   /* the light alone needs no waves (review efde r-1) */ n++; }
      if (n === most) acc = 0;
      draw();
    }
    /* a handover that ends in off lets what is left of the surface fade (.9 s) over the picture, instead of vanishing */
    function enabled(v) {
      if (v === undefined) return on;
      clearTimeout(fadeT); cv.style.transition = ""; cv.style.opacity = "";
      if (!v && on && offFade > 0) { var ms = offFade; HO = null; sig = sigT = 0; if (o.hideSource !== false) src.style.opacity = "";
        cv.style.transition = "opacity " + ms + "ms ease"; cv.style.opacity = "0";
        fadeT = setTimeout(function () { cv.style.transition = ""; cv.style.opacity = ""; enabled(false); }, ms); return true; }
      var was = on; on = !!v && ok;
      cv.style.visibility = on ? "visible" : "hidden";
      if (o.hideSource !== false) src.style.opacity = on ? "0" : "";
      if (on) { resize(); if (!was) { calm(); sig = sigT = 1; } quiet = 0; } else { drops.length = 0; HO = null; sig = sigT = 1; }
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
    /* the walls: the pattern's lines drawn once into a texture the field's size (again when the pattern or the field changes) */
    function wallTex() { if (!PATH.length || !N[0]) return false; var k = N[0] + "x" + N[1] + ":" + (WALL.gen || 0); if (WALL.key === k && WALL.tex) return true; var now = performance.now(); if (WALL.tex && now - (WALL.at || 0) < 120) return true; WALL.at = now;   /* every new path (a pan, a fit, another drawing: review 5081 r-1), at most about eight rebuilds a second while it moves (r-3) */
      var c = WALL.cv || (WALL.cv = document.createElement("canvas")); c.width = N[0]; c.height = N[1]; var x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height);
      x.strokeStyle = "#fff"; x.lineWidth = Math.max(1.1, N[0] / 520); x.lineCap = "round"; x.beginPath(); for (var i = 0; i < PATH.length; i++) { var q = PATH[i]; x.moveTo(q[0] * c.width, q[1] * c.height); x.lineTo(q[2] * c.width, q[3] * c.height); } x.stroke();
      if (!WALL.tex) { WALL.tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, WALL.tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
      gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, WALL.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.activeTexture(gl.TEXTURE0);
      WALL.key = k; return true; }
    function setPath(segs) { WALL.gen = (WALL.gen || 0) + 1; PATH = []; PLEN = []; PTOT = 0; (segs || []).forEach(function (q) { var l = Math.hypot(q[2] - q[0], q[3] - q[1]); if (!(l > 1e-6)) return; PATH.push(q); PTOT += l; PLEN.push(PTOT); }); }
    function along(d) { var lo = 0, hi = PLEN.length - 1; while (lo < hi) { var m = (lo + hi) >> 1; if (PLEN[m] < d) lo = m + 1; else hi = m; } var q = PATH[lo], s0 = lo ? PLEN[lo - 1] : 0, t = (d - s0) / ((PLEN[lo] - s0) || 1); return [q[0] + (q[2] - q[0]) * t, q[1] + (q[3] - q[1]) * t]; }
    function setCurrent(data, gw, gh) { if (!ok || !data || !(gw > 0) || !(gh > 0)) { curOk = false; return; }
      var a = data instanceof Float32Array ? data : new Float32Array(data);
      gl.bindTexture(gl.TEXTURE_2D, curTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, gw, gh, 0, gl.RG, gl.FLOAT, a.subarray(0, gw * gh * 2)); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); curOk = true; }
    cv.addEventListener("webglcontextlost", function (e) { e.preventDefault(); ok = false; if (o.hideSource !== false) src.style.opacity = ""; cv.style.visibility = "hidden"; try { o.onLost && o.onLost(); } catch (_) {} });
    cv.addEventListener("webglcontextrestored", function () { WALL.tex = null; WALL.key = ""; var was = on; init(); if (was) enabled(true); });
    init();
    if (o.preset) setPreset(o.preset);
    function setPreset(id) { var p = PRESETS.filter(function (x) { return x.id === id; })[0]; if (p) { Object.assign(P, p); } return P.id; }
    return {
      get ok() { return ok; }, canvas: cv,
      enabled: enabled, drop: addDrop, stir: stir,
      fill: function (v) { if (v !== undefined) { var nf = v == null || v === false ? null : Math.max(0, Math.min(1, +v || 0)); if (nf !== FILL) bdDirty = true; FILL = nf; if (FILL == null) { BEADS = []; FLY = []; } quiet = 0; } return FILL; },
      splash: splash, wetAt: wetAt, dry: function () { calm(); BEADS = []; FLY = []; bdDirty = true; quiet = 0; if (PL) { PL.d.fill(0); plDirty = true; poolUpload.need = true; plAt = 0; } },
      /* how much of the old everywhere-at-once level still counts, 0..1 (0: water only where it fell), and how much of the
         floor holds water (0..1) */
      /* the water a drop brings (k times its own; the host sets it so the rain it shows fills the floor as fast as it says),
         all the water ever poured (before k), the water standing now, and the water it takes to cover a share of the floor */
      pour: function (k) { if (k !== undefined) POUR = Math.max(0, +k || 0); return POUR; }, poured: function () { return POURED; },
      volume: function () { var P2 = PL; if (!P2) return 0; var v = 0; for (var i = 0; i < P2.d.length; i++) v += P2.d[i]; return v; },
      capacity: function (c) { var P2 = poolInit(); if (!P2) return 0; if (!P2.srt) P2.srt = Float32Array.from(P2.f).sort(); var s = P2.srt, L = s[Math.min(s.length - 1, Math.floor((c == null ? 0.8 : c) * s.length))] + 0.02, v = 0; for (var i = 0; i < s.length; i++) if (s[i] < L) v += L - s[i]; return v; },
      /* the film's tremble: amp 0..1, at a sound's frequency in hz (its wavelength on screen follows) */
      vibrate: function (amp, hz) { VIB.t = Math.max(0, Math.min(1, +amp || 0)); if (hz > 0) { var now, lam = Math.max(10, Math.min(48, 24 * Math.pow(hz / 100, -2 / 3))), now = performance.now(); if (!VIB.cw || now - (VIB.cwAt || 0) > 1000) { VIB.cw = cv.clientWidth || SW || 1; VIB.cwAt = now; } var cw = VIB.cw; VIB.l = Math.max(2.6, lam * N[0] / cw); } return VIB.t; },
      /* draining: tilt(dx, dy, slope, offset) or tilt(null); drain() lets the level carry the water from here (the pool
         grid's own puddles are emptied); beadsFade(f) shrinks every bead by a share f, and lets the smallest go */
      walls: function (v) { if (v !== undefined) { WALL.on = !!v; quiet = 0; } return WALL.on; },
      tilt: function (dx, dy, sl, off) { if (dx == null) TILT = [0, 0, 0, 0]; else TILT = [+dx || 0, +dy || 0, +sl || 0, +off || 0]; quiet = 0; return TILT.slice(); },
      drain: function () { if (PL) { PL.d.fill(0); plDirty = true; poolUpload.need = true; plAt = 0; } quiet = 0; },
      beadsFade: function (f) { f = Math.max(0, Math.min(1, +f || 0)); if (!f || !BEADS.length) return; var keep = []; for (var i = 0; i < BEADS.length; i++) { var b = BEADS[i]; b.r *= (1 - f); if (b.r > 0.9) keep.push(b); } BEADS = keep; bdDirty = true; },
      spread: function (k) { if (k !== undefined) GK = Math.max(0, Math.min(1, +k || 0)); return GK; }, cover: cover, beads: function () { return BEADS.length; },
      rain: function (r) { P.rain = Math.max(0, +r || 0); },
      preset: setPreset,
      set: function (x) { Object.assign(P, x || {}); }, get: function () { return Object.assign({}, P); },
      tick: tick, draw: draw, resize: resize, calm: calm,
      field: function () { return N.slice(); },
      light: function (L) { if (!L) { LIGHT = null; quiet = Math.min(quiet, 19); return null; } var c1 = rgb(L.c1), c2 = rgb(L.c2); if (!c1 || !c2) { LIGHT = null; return null; } var r = (+L.a || 0) * Math.PI / 180, st = L.stops || [0, 1];
        var G = null, g = L.ground; if (g) { var g1 = rgb(g.c1), g2 = rgb(g.c2 || g.c1), gr = (+g.a || 0) * Math.PI / 180, gs = g.stops || [0, 1]; if (g1 && g2) G = { c1: g1, c2: g2, round: !!g.round, dx: Math.cos(gr), dy: Math.sin(gr), s0: +gs[0] || 0, s1: +gs[1] || 1 }; }
        LIGHT = { c1: c1, c2: c2, round: !!L.round, dx: Math.cos(r), dy: Math.sin(r), s0: +st[0] || 0, s1: +st[1] || 1, amt: Math.max(0, Math.min(1, +L.amt || 0)), mode: { filter: 1, wash: 2, glow: 3 }[L.mode] || 0, ground: L.mode ? G : null }; quiet = Math.min(quiet, 19); return LIGHT; },
      /* the surface as a pass only (the light keeping the ground with no water): no drops, no rings, the picture as it is */
      passOnly: function (v) { if (v !== undefined) { PASS = !!v; if (PASS) { drops.length = 0; calm(); } } return PASS; },
      colors: function (c) { if (c) Object.assign(COL, c); return Object.assign({}, COL); },
      path: setPath, flow: function (v) { FLOW = Math.max(0, Math.min(1, +v || 0)); },
      drive: function (d) { if (d) { if (d.path != null) DRV.path = Math.max(0, +d.path || 0); if (d.current != null) DRV.current = Math.max(0, +d.current || 0); } return Object.assign({}, DRV); },
      current: setCurrent,
      signal: function (v) { if (v !== undefined) sigT = v ? 1 : 0; return !!sigT; }, energy: energy, handover: handover,
      weather: function () { return HO ? { phase: HO.phase, t: HO.t, energy: HO.e, signal: sig } : null; },
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
