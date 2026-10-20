/* Surface · Files — what the studio's tools call the files they save (Dimitry, 20 Oct 2026):

     CHAMY·XYZ_Current_App_000001.jpg
     <brand>_<tool>_<kind>_<six-digit number>.<ext>

   The number runs per tool and per browser, one sequence for everything that tool saves (cards, stills, videos),
   kept in localStorage so it keeps counting across visits. If storage is blocked it counts for the visit only.

     SurfaceFiles.name({tool:'Current', ext:'jpg'})                 → "CHAMY·XYZ_Current_App_000001.jpg"
     SurfaceFiles.name({tool:'Current', kind:'App', ext:'mp4'})     → the next number
     SurfaceFiles.peek('Current')                                   → the next number, without taking it
   brand defaults to CHAMY·XYZ, kind to App. Plain script, window.SurfaceFiles, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceFiles) return;
  var mem = {};
  function key(tool) { return "surface.files." + String(tool || "tool").toLowerCase(); }
  function read(tool) {
    var k = key(tool), v = mem[k] || 0;
    try { var s = parseInt(localStorage.getItem(k), 10); if (s > v) v = s; } catch (e) {}
    return v;
  }
  function take(tool) {
    var k = key(tool), n = read(tool) + 1;
    mem[k] = n; try { localStorage.setItem(k, String(n)); } catch (e) {}
    return n;
  }
  function pad(n) { return String(n).padStart(6, "0"); }
  function name(o) {
    o = o || {};
    var brand = o.brand || "CHAMY·XYZ", tool = o.tool || "Tool", kind = o.kind || "App";
    var ext = String(o.ext || "jpg").replace(/^\./, "");
    return brand + "_" + tool + "_" + kind + "_" + pad(take(tool)) + "." + ext;
  }
  window.SurfaceFiles = { name: name, peek: function (tool) { return pad(read(tool) + 1); } };
})();
