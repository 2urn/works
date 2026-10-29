/* Surface · Pack — open a whole content pack (a .zip) in the browser, no unzipping (Dimitry, 20 Oct 2026).

   A pack is an ordinary zip a tool hands out (Current's founding pack, the Paths pack): G-code, looks, beats,
   formulas, whatever the tool makes. The person never unzips it. They drop the zip on the tool, or pick it with the
   tool's open file, and the tool takes in everything it recognises at once.

   A pack may carry pack.json at its root, which says what it is:
     {"kind":"surface.pack","v":1,"tool":"current","id":"founding","name":"The founding pack","files":{...}}
   A zip without one is still read; the tool decides by file names.

     SurfacePack.isZip(file)            → true for a .zip (by name or type)
     SurfacePack.read(blobOrFile)       → Promise<{files: Map<path, Uint8Array>, text(path), json(path), manifest}>
                                           stored and deflated entries (deflate through the browser's own
                                           DecompressionStream: Chrome, Edge, Firefox, Safari 16.4+); folders skipped
     SurfacePack.zip([[path, text|Uint8Array], ...])  → Blob, stored (no compression), UTF-8 names

   Plain script, window.SurfacePack, no dependencies. */
(function () {
  "use strict";
  if (window.SurfacePack) return;
  function isZip(f) { return !!f && (/\.zip$/i.test(f.name || "") || /zip/.test(f.type || "")); }
  var CRC = null;
  function crc32(b) {
    if (!CRC) { CRC = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    var x = 0xffffffff; for (var i = 0; i < b.length; i++) x = CRC[(x ^ b[i]) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0;
  }
  function inflate(u8) {
    if (typeof DecompressionStream === "undefined") return Promise.reject(new Error("This browser can't open compressed zips"));
    var s = new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(s).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }
  function read(blob) {
    return blob.arrayBuffer().then(function (ab) {
      var d = new Uint8Array(ab), v = new DataView(ab), eocd = -1;
      for (var i = d.length - 22; i >= Math.max(0, d.length - 22 - 65535); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      if (eocd < 0) throw new Error("not a zip");
      var count = v.getUint16(eocd + 10, true), at = v.getUint32(eocd + 16, true), jobs = [], td = new TextDecoder();
      for (var e = 0; e < count; e++) {
        if (v.getUint32(at, true) !== 0x02014b50) throw new Error("broken zip");
        var flags = v.getUint16(at + 8, true), method = v.getUint16(at + 10, true), csize = v.getUint32(at + 20, true),
          nlen = v.getUint16(at + 28, true), xlen = v.getUint16(at + 30, true), clen = v.getUint16(at + 32, true), loc = v.getUint32(at + 42, true);
        var nameB = d.subarray(at + 46, at + 46 + nlen), name = (flags & 0x800) ? td.decode(nameB) : String.fromCharCode.apply(null, nameB);
        at += 46 + nlen + xlen + clen;
        if (/\/$/.test(name) || /(^|\/)(__MACOSX\/|\.DS_Store$)/.test(name)) continue;   // folders, and what a Mac adds when it re-zips
        var start = loc + 30 + v.getUint16(loc + 26, true) + v.getUint16(loc + 28, true), raw = d.subarray(start, start + csize);
        jobs.push((function (name, method, raw) {
          var p = method === 0 ? Promise.resolve(raw) : method === 8 ? inflate(raw) : Promise.reject(new Error(name + ": unsupported compression"));
          return p.then(function (u) { return [name.replace(/^\.?\//, ""), u]; });
        })(name, method, raw));
      }
      return Promise.all(jobs);
    }).then(function (list) {
      var files = new Map(), td = new TextDecoder();
      /* a zip made by re-zipping a folder puts everything one level down: strip a single shared top folder */
      var tops = new Set(list.map(function (x) { return x[0].split("/")[0]; }));
      var strip = tops.size === 1 && list.every(function (x) { return x[0].indexOf("/") > 0; }) ? [...tops][0].length + 1 : 0;
      list.forEach(function (x) { files.set(x[0].slice(strip), x[1]); });
      var text = function (p) { var u = files.get(p); return u ? td.decode(u) : null; };
      var json = function (p) { var t = text(p); if (t == null) return null; try { return JSON.parse(t); } catch (e) { return null; } };
      var m = json("pack.json");
      return { files: files, text: text, json: json, manifest: m && m.kind === "surface.pack" ? m : null };
    });
  }
  function zip(entries) {
    var enc = new TextEncoder(), parts = [], cen = [], off = 0;
    entries.forEach(function (en) {
      var nb = enc.encode(en[0]), db = typeof en[1] === "string" ? enc.encode(en[1]) : en[1], c = crc32(db);
      var h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, c, true); h.setUint32(18, db.length, true); h.setUint32(22, db.length, true); h.setUint16(26, nb.length, true);
      var ce = new DataView(new ArrayBuffer(46)); ce.setUint32(0, 0x02014b50, true); ce.setUint16(4, 20, true); ce.setUint16(6, 20, true); ce.setUint16(8, 0x0800, true); ce.setUint32(16, c, true); ce.setUint32(20, db.length, true); ce.setUint32(24, db.length, true); ce.setUint16(28, nb.length, true); ce.setUint32(42, off, true);
      parts.push(h, nb, db); cen.push(ce, nb); off += 30 + nb.length + db.length;
    });
    var cs = cen.reduce(function (a, x) { return a + (x.byteLength || x.length); }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(cen, [e]), { type: "application/zip" });
  }
  window.SurfacePack = { isZip: isZip, read: read, zip: zip };
})();
