/* Surface · Pattern set: Astrology (17 Nov 2026)

   Dimitry (17 Nov, 00:00–00:06): "the first 12 should be very geometric, simplified, or maybe accurate … signs of the
   zodiac"; "the G-code patterns come in in the same way that sound sets do… an astrology set comprising two groups,
   constellations and signs."

   A pattern set is a named collection of G-code patterns in groups, the way a sound set is a collection of sounds.
   Each pattern is real G-code (G0 travel with the pen up, G1 drawing with the pen down, "; frame W H"), so any tool
   that reads G-code (SurfaceToolpath, Current) can load it, and so can a plotter.

     SurfacePatternSets.astrology → { id, name, groups: [{ id, name, patterns: [{ id, name, glyph, gcode, strokes }] }] }
     strokes: the same drawing as polylines in −1 … 1 (y up), for tools that want the points without parsing

   Signs: the twelve glyphs as clean geometric line drawings (arcs, bars, loops), drawn on a 2 × 2 frame.
   Constellations: the stick figures of the twelve constellations as most star atlases join them, stars placed from
   their sky positions and simplified to fit the same frame; a line between two stars is a pen-down move, so the stars
   are the pattern's vertices.

   Foundations: the twelve signs and their glyphs (Hellenistic astrology; the glyph forms as set in Unicode's
   Miscellaneous Symbols, U+2648–U+2653); the constellation figures as joined in the IAU's 88 constellations and the
   stick figures of H. A. Rey's "The Stars" (1952); G-code (RS-274, EIA, 1960s). Plain script, no dependencies. */
(function () {
  "use strict";
  var W = window.SurfacePatternSets = window.SurfacePatternSets || {};
  if (W.astrology) return;
  var PI = Math.PI;

  /* ---- drawing helpers, all in −1 … 1 with y up ---- */
  function arc(cx, cy, r, a0, a1, n, ry) { var p = []; n = n || 24; ry = ry == null ? r : ry;
    for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; p.push([cx + r * Math.cos(a), cy + ry * Math.sin(a)]); } return p; }
  function circle(cx, cy, r, n) { return arc(cx, cy, r, 0, 2 * PI, n || 40); }
  function cat() { var o = []; for (var i = 0; i < arguments.length; i++) o = o.concat(i && o.length ? arguments[i].slice(1) : arguments[i]); return o; }

  /* ---- the twelve signs ---- */
  var SIGNS = [
    ['aries', 'Aries', '♈', [cat(arc(-0.42, 0.38, 0.36, 0, PI * 1.15, 20).reverse(), [[0, -0.85]]).slice(0).reverse().concat([]),
      cat([[0, -0.85]], arc(0.42, 0.38, 0.36, PI, -0.15 * PI, 20))]],
    ['taurus', 'Taurus', '♉', [circle(0, -0.3, 0.45, 40), arc(0, 0.55, 0.62, PI * 1.08, PI * 1.92, 24).map(function (q) { return [q[0], q[1] + 0.05]; })]],
    ['gemini', 'Gemini', '♊', [arc(0, 0.95, 0.75, PI * 1.2, PI * 1.8, 16), arc(0, -0.95, 0.75, PI * 0.2, PI * 0.8, 16).reverse(),
      [[-0.32, 0.36], [-0.32, -0.36]], [[0.32, 0.36], [0.32, -0.36]]]],
    ['cancer', 'Cancer', '♋', [cat(circle(-0.42, 0.28, 0.2, 24), arc(0.05, 0.05, 0.72, PI * 0.82, PI * 0.25, 18)),
      cat(circle(0.42, -0.28, 0.2, 24).map(function (q) { return q; }), arc(-0.05, -0.05, 0.72, PI * 1.82, PI * 1.25, 18))]],
    ['leo', 'Leo', '♌', [cat(circle(-0.45, -0.3, 0.26, 28).reverse(), arc(-0.05, 0.25, 0.5, PI * 1.05, -0.1 * PI, 24),
      arc(0.62, -0.3, 0.28, PI * 0.95, PI * 1.9, 14))]],
    ['virgo', 'Virgo', '♍', [[[-0.8, 0.6], [-0.8, -0.7]], cat([[-0.8, 0.25]], arc(-0.55, 0.3, 0.25, PI, 0, 10), [[-0.3, -0.7]]),
      cat([[-0.3, 0.25]], arc(-0.05, 0.3, 0.25, PI, 0, 10), [[0.2, -0.45]], arc(0.4, -0.35, 0.22, PI * 1.1, PI * 2.6, 18), [[0.1, -0.9]])]],
    ['libra', 'Libra', '♎', [[[-0.85, -0.55], [0.85, -0.55]], cat([[-0.85, -0.1], [-0.38, -0.1]], arc(0, 0.12, 0.42, PI * 1.2, -0.2 * PI, 24).reverse().reverse(), [[0.38, -0.1], [0.85, -0.1]])]],
    ['scorpio', 'Scorpio', '♏', [[[-0.85, 0.6], [-0.85, -0.6]], cat([[-0.85, 0.25]], arc(-0.6, 0.3, 0.25, PI, 0, 10), [[-0.35, -0.6]]),
      cat([[-0.35, 0.25]], arc(-0.1, 0.3, 0.25, PI, 0, 10), [[0.15, -0.6], [0.6, -0.6]]), [[0.42, -0.42], [0.62, -0.6], [0.42, -0.78]]]],
    ['sagittarius', 'Sagittarius', '♐', [[[-0.75, -0.75], [0.75, 0.75]], [[0.2, 0.75], [0.75, 0.75], [0.75, 0.2]], [[-0.45, 0.05], [0.05, -0.45]]]],
    ['capricorn', 'Capricorn', '♑', [cat([[-0.85, 0.55], [-0.5, -0.55], [-0.15, 0.55], [0.1, -0.45]], arc(0.4, -0.3, 0.3, PI * 1.05, PI * 2.85, 26), [[0.05, -0.85]])]],
    ['aquarius', 'Aquarius', '♒', [[[-0.85, 0.2], [-0.55, 0.45], [-0.25, 0.2], [0.05, 0.45], [0.35, 0.2], [0.65, 0.45], [0.85, 0.25]],
      [[-0.85, -0.3], [-0.55, -0.05], [-0.25, -0.3], [0.05, -0.05], [0.35, -0.3], [0.65, -0.05], [0.85, -0.25]]]],
    ['pisces', 'Pisces', '♓', [arc(-1.05, 0, 0.75, -0.3 * PI, 0.3 * PI, 18), arc(1.05, 0, 0.75, 0.7 * PI, 1.3 * PI, 18), [[-0.6, 0], [0.6, 0]]]]
  ];

  /* ---- the twelve constellations: stars (approximate sky positions, flattened to the frame) and the joins ---- */
  function fig(stars, joins) { return joins.map(function (j) { return j.map(function (k) { return stars[k]; }); }); }
  var CONST = [
    ['aries', 'Aries', '♈', fig([[0.85, 0.3], [0.1, 0.05], [-0.45, -0.2], [-0.8, -0.45]], [[0, 1, 2, 3]])],
    ['taurus', 'Taurus', '♉', fig([[0.05, -0.1], [0.25, 0.0], [0.15, -0.3], [0.45, 0.15], [0.9, 0.45], [0.5, -0.45], [0.9, -0.2], [-0.55, -0.6], [-0.85, -0.75]],
      [[4, 3, 1, 0, 2, 5, 6], [0, 7, 8]])],
    ['gemini', 'Gemini', '♊', fig([[-0.55, 0.85], [-0.35, 0.3], [-0.2, -0.3], [-0.05, -0.85], [0.1, 0.8], [0.3, 0.2], [0.5, -0.35], [0.7, -0.8], [-0.1, 0.55]],
      [[0, 1, 2, 3], [4, 5, 6, 7], [1, 8, 5]])],
    ['cancer', 'Cancer', '♋', fig([[0, 0.05], [-0.05, 0.85], [-0.6, -0.75], [0.65, -0.7], [0.1, -0.25]], [[1, 0, 4, 2], [4, 3]])],
    ['leo', 'Leo', '♌', fig([[0.75, -0.2], [0.45, 0.15], [0.55, 0.55], [0.3, 0.75], [0.0, 0.6], [0.2, 0.1], [-0.35, 0.0], [-0.85, -0.2], [-0.4, -0.35]],
      [[0, 1, 2, 3, 4], [1, 5, 6, 7, 8, 5]])],
    ['virgo', 'Virgo', '♍', fig([[-0.9, 0.55], [-0.5, 0.3], [-0.1, 0.2], [0.25, 0.4], [0.7, 0.75], [0.0, -0.2], [0.35, -0.6], [-0.45, -0.75], [0.85, 0.15]],
      [[0, 1, 2, 3, 4], [2, 5, 6], [5, 7], [3, 8]])],
    ['libra', 'Libra', '♎', fig([[0, 0.8], [-0.6, 0.15], [0.55, 0.05], [-0.4, -0.7], [0.45, -0.75]], [[0, 1, 2, 0], [1, 3], [2, 4]])],
    ['scorpio', 'Scorpio', '♏', fig([[0.75, 0.85], [0.85, 0.55], [0.6, 0.65], [0.4, 0.35], [0.25, 0.05], [0.15, -0.3], [0.0, -0.6], [-0.3, -0.8], [-0.65, -0.7], [-0.8, -0.4], [-0.6, -0.25]],
      [[0, 2, 1], [2, 3, 4, 5, 6, 7, 8, 9, 10]])],
    ['sagittarius', 'Sagittarius', '♐', fig([[-0.75, 0.0], [-0.35, 0.25], [-0.05, 0.6], [0.3, 0.25], [0.6, 0.45], [0.3, -0.2], [-0.2, -0.3], [0.65, -0.6], [-0.55, -0.55]],
      [[0, 1, 2, 3, 1], [3, 4], [3, 5, 6, 1], [5, 7], [6, 8]])],
    ['capricorn', 'Capricorn', '♑', fig([[0.85, 0.5], [0.55, 0.15], [0.2, -0.45], [-0.25, -0.55], [-0.85, 0.15], [-0.4, 0.2], [0.2, 0.3]],
      [[0, 1, 2, 3, 4, 5, 6, 0]])],
    ['aquarius', 'Aquarius', '♒', fig([[0.85, 0.55], [0.45, 0.4], [0.15, 0.55], [-0.15, 0.3], [-0.35, -0.05], [-0.7, -0.2], [0.05, -0.3], [0.3, -0.75], [-0.15, -0.8], [-0.6, 0.55]],
      [[0, 1, 2, 3, 4, 5], [3, 9], [4, 6, 7], [6, 8]])],
    ['pisces', 'Pisces', '♓', fig([[-0.85, 0.75], [-0.6, 0.55], [-0.35, 0.3], [-0.05, 0.0], [0.15, -0.55], [0.45, -0.45], [0.75, -0.55], [0.9, -0.3], [0.65, -0.15], [0.4, -0.25], [-0.75, 0.45]],
      [[0, 1, 10, 0], [1, 2, 3, 4, 5, 6, 7, 8, 9, 5]])]
  ];

  /* ---- polylines → G-code ---- */
  function gcode(name, strokes) {
    var f = function (v) { return (Math.round(v * 1000) / 1000).toFixed(3); }, o = ['; ' + name, '; frame 2 2', 'G21', 'G90', 'F1200'];
    strokes.forEach(function (s) { if (!s.length) return;
      o.push('G0 Z1', 'G0 X' + f(s[0][0] + 1) + ' Y' + f(s[0][1] + 1), 'G1 Z0');
      for (var i = 1; i < s.length; i++) o.push('G1 X' + f(s[i][0] + 1) + ' Y' + f(s[i][1] + 1)); });
    o.push('G0 Z1'); return o.join('\n'); }
  function make(group, rows) { return rows.map(function (r) {
    return { id: group + '-' + r[0], name: r[1], glyph: r[2], strokes: r[3], gcode: gcode(r[1] + ' (' + group + ')', r[3]) }; }); }

  W.astrology = { id: 'astrology', name: 'Astrology', groups: [
    { id: 'signs', name: 'Signs', patterns: make('signs', SIGNS) },
    { id: 'constellations', name: 'Constellations', patterns: make('constellations', CONST) }
  ] };
})();
