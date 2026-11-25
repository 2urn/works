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
  /* THE STAMP (Dimitry, 20 Oct): every saved image says where it came from, invisibly, in its metadata (XMP, the
     standard Photoshop and Lightroom read): made with <tool> by <brand>, the version, the tool's address, the file's
     own name. Nothing about the person who made it. It travels with the file through downloads, AirDrop and email;
     Instagram, Facebook, X and WhatsApp strip it on upload, and LinkedIn keeps it.
       SurfaceFiles.stamp(blob, {tool, brand?, version, source, id}) -> Promise<Blob>   (JPEG and PNG; anything else
       comes back unchanged) */
  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function xmp(o) {
    var brand = o.brand || "CHAMY·XYZ";
    return '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"' +
      ' xmp:CreatorTool="' + esc(o.tool + (o.version ? " " + o.version : "") + " · " + brand) + '" xmp:CreateDate="' + new Date().toISOString() + '"' +
      ' photoshop:Source="' + esc(o.source || "") + '" photoshop:Credit="' + esc("Made with " + o.tool + " by " + brand) + '">' +
      '<dc:description><rdf:Alt><rdf:li xml:lang="x-default">' + esc("Made with " + o.tool + " by " + brand + (o.source ? " · " + o.source : "")) + '</rdf:li></rdf:Alt></dc:description>' +
      (o.id ? '<dc:identifier>' + esc(o.id) + '</dc:identifier>' : "") + (o.source ? '<dc:source>' + esc(o.source) + '</dc:source>' : "") +
      '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
  }
  var CRC = null;
  function crc32(b) {
    if (!CRC) { CRC = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    var x = 0xffffffff; for (var i = 0; i < b.length; i++) x = CRC[(x ^ b[i]) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0;
  }
  function u32(n) { return [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255]; }
  function stamp(blob, o) {
    if (!blob || !o || !/^image\/(jpeg|png)$/.test(blob.type)) return Promise.resolve(blob);
    return blob.arrayBuffer().then(function (ab) {
      var d = new Uint8Array(ab), x = new TextEncoder().encode(xmp(o));
      if (blob.type === "image/jpeg") {
        if (d[0] !== 0xff || d[1] !== 0xd8) return blob;
        var ns = new TextEncoder().encode("http://ns.adobe.com/xap/1.0/\0"), len = 2 + ns.length + x.length;
        if (len > 65535) return blob;
        var at = 2; if (d[2] === 0xff && d[3] === 0xe0) at = 4 + (d[4] << 8 | d[5]);   // after JFIF, where XMP belongs
        var seg = new Uint8Array(4 + ns.length + x.length); seg.set([0xff, 0xe1, len >> 8, len & 255]); seg.set(ns, 4); seg.set(x, 4 + ns.length);
        return new Blob([d.subarray(0, at), seg, d.subarray(at)], { type: blob.type });
      }
      if (d[1] !== 0x50 || d[2] !== 0x4e || d[3] !== 0x47) return blob;
      var key = new TextEncoder().encode("XML:com.adobe.xmp"), data = new Uint8Array(key.length + 5 + x.length);   // iTXt: keyword, 0, no compression, 0, '' lang, 0, '' translated, 0, text
      data.set(key, 0); data.set([0, 0, 0, 0, 0], key.length); data.set(x, key.length + 5);
      var type = new TextEncoder().encode("iTXt"), body = new Uint8Array(4 + data.length); body.set(type, 0); body.set(data, 4);
      var chunk = new Uint8Array(12 + data.length); chunk.set(u32(data.length), 0); chunk.set(body, 4); chunk.set(u32(crc32(body)), 8 + data.length);
      var ih = 8 + 12 + (d[8] << 24 | d[9] << 16 | d[10] << 8 | d[11]);   // right after IHDR
      return new Blob([d.subarray(0, ih), chunk, d.subarray(ih)], { type: blob.type });
    }).catch(function () { return blob; });
  }
  window.SurfaceFiles = { name: name, stamp: stamp, peek: function (tool) { return pad(read(tool) + 1); } };
})();
