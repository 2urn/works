/* The studio's chrome on this fork: the launch cover, the duck-rabbit index and the colophon (Surface chrome, sys 819d8fb).
   CascadeStudio's own top bar stays as it is; only its name gives way to the duck. */
(function () {
  "use strict";
  var rows = function (r) { return "<table class='mk-tbl'>" + r.map(function (x) { return "<tr><th>" + x[0] + "</th><td>" + x[1] + "</td></tr>"; }).join("") + "</table>"; };
  window.addEventListener("load", function () {
    if (!window.SurfaceChrome) return;
    SurfaceChrome.mount({
      name: "Solids", sub: "Objects, contours and clouds for Pullula", version: "0.1.0-lab.1", key: "solids", noKey: true,
      intro: "<p>Real solids, made in the browser on the same geometry kernel industrial CAD uses, then turned into what the studio's tools play: contours as G-code, point clouds, and later instances. Pullula and Current receive the results; they never have to do CAD themselves.</p>",
      sections: [
        { id: "start", title: "Start here", open: true, html: rows([
          ["Objects…", "Pick a starting object: Vase, Tower, Spindle, Knot or Stones. Each is a few named numbers; move them in the Cascade Control Panel (top right of the view)."],
          ["Slice", "Cuts the solid into contours, as many layers as you ask, across Z, X or Y. The cuts are exact: a circle stays a circle."],
          ["Save G-code", "One file, every layer in order, each at its own height. Current plays it as a pattern; a plotter or laser can draw it."],
          ["Scatter", "Scatters points over the surface, more where there is more surface."],
          ["Save points", "Two files: .xyz for any 3D tool, and points.json for Point Generator and Pullula."]]) },
        { id: "code", title: "The code is the model", html: "<p>Everything on the left is the object. Change a number there, or name one with <code>Slider(\"Name\", value, min, max)</code> and it becomes a slider. The standard library is CascadeStudio's: Box, Sphere, Sketch, Extrude, Revolve, Loft, Pipe, Union, Difference, Fillet and more. Save STEP, STL or OBJ for other tools and for 3D printing.</p>" },
        { id: "next", title: "Coming", html: "<p>Instances: one object repeated by a rule (a grid, along a path, on a cloud), saved as positions, turns and sizes. Points through the volume, not only on the surface. And a Pullula pack that carries the results.</p>" }
      ],
      colophon: {
        about: "<p>Dimitry Saïd Chamy is a Miami-based artist, designer and cultural producer with roots in Haiti and Lebanon.</p>",
        openSource: "This tool is a fork of CascadeStudio. It stands on the open-source work below, the foundations first.",
        foundations: [
          { group: "Foundations", name: "CascadeStudio", by: "Johnathon Selstad (zalo)", label: "MIT", url: "https://github.com/zalo/CascadeStudio", for: "the whole application this is forked from: editor, viewport, standard library" },
          { group: "Foundations", name: "Open CASCADE Technology (OCCT)", by: "Open Cascade SAS", label: "LGPL 2.1 with the OCCT exception", url: "https://github.com/Open-Cascade-SAS/OCCT", for: "the geometry kernel: solids, booleans, sections" },
          { group: "Foundations", name: "opencascade.js", by: "Sebastian Alff and contributors; build by Johnathon Selstad", label: "LGPL 2.1", url: "https://github.com/donalffons/opencascade.js", for: "OCCT compiled to WebAssembly" },
          { group: "Ideas and methods", name: "Plane sections for slicing", by: "the 3D-printing slicer tradition", label: "method", for: "contours as layers" },
          { group: "Ideas and methods", name: "Area-weighted surface sampling", by: "standard geometry", label: "method", for: "the point clouds" },
          { group: "Standards", name: "G-code (RS-274)", by: "EIA / ISO 6983", label: "format", for: "the contours" },
          { group: "Sister tools", name: "Current, Pullula, Point Generator, the Open Source Codex", by: "CHAMY·XYZ", label: "studio", for: "where the results go" },
          { group: "Inspiration", name: "ChiselCAD", by: "Brennan (LTKMN)", label: "reference only: its additions are non-commercial", url: "https://github.com/LTKMN/ChiselCAD", for: "the idea that the code is the model; none of its code is used" }
        ],
        credits: [
          { kind: "code", name: "three.js", licence: "MIT", url: "https://threejs.org", for: "the 3D view" },
          { kind: "code", name: "Monaco Editor", licence: "MIT", url: "https://github.com/microsoft/monaco-editor", for: "the code editor" },
          { kind: "code", name: "Dockview", licence: "MIT", url: "https://dockview.dev", for: "the panels" },
          { kind: "code", name: "Tweakpane", licence: "MIT", url: "https://tweakpane.github.io/docs/", for: "the sliders" },
          { kind: "code", name: "opentype.js", licence: "MIT", url: "https://opentype.js.org", for: "Text3D" },
          { kind: "code", name: "fflate, potpack", licence: "MIT, ISC", for: "project links and texture packing" }
        ],
        privacy: "<p>Everything happens in this browser. Your models, files and exports never leave the device unless you share them.</p>",
        contact: { lead: "For questions, workshops or collaborations, I’d love to hear from you.", email: "hi@chamy.xyz" },
        license: "<p>The fork's additions © Dimitry Saïd Chamy / CHAMY·XYZ. CascadeStudio's code stays MIT, and its notice is kept in the source.</p>"
      }
    });
  });
})();
