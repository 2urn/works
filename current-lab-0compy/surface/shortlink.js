/* Surface · Short links — one short address for anything a tool shares (Dimitry, 22 Oct 2026, 23:08: "a studio-wide
   short-link utility", after Current's scene links).

   A link is d.chamy.xyz/<code> (forwarded to works.chamy.xyz/c/<code>): seven characters from an alphabet with no look-alikes (no 0/O, 1/l/I). The code
   is a row in the studio's existing shared_looks table (Supabase: id, tool, look, version; insert-only, read one by id,
   public by design: anyone with the code can open what it holds). No new table.

     SurfaceShort.make({tool: 'current', payload: {...}, version: '0.29.3'}) → Promise<'https://d.chamy.xyz/AbC3dEf' | null>
     SurfaceShort.open(code) → Promise<{tool, look} | null>       (old 10-character codes open too)
     SurfaceShort.code(url or code) → the code, or null
     SurfaceShort.configure({db: {url, key}, base}) → another table or address (a fork, a test)

   works.chamy.xyz/c/<code> is resolved by the works site's 404.html (GitHub Pages serves it for any unknown path; this
   repo keeps its source in works/404.html): it reads the row's tool and goes to that tool's page with ?l=<code>, where
   the tool opens it as it already opens a card's link. A code that is not there gets a plain "expired or wrong" page. */
(function () {
  "use strict";
  if (window.SurfaceShort) return;
  var A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  var LEN = 7;    /* shared_looks_id_check allows {7,10} since 23 Oct 2026 (it asked for 10 before; the 400 fallback below stays) */
  var O = {
    db: { url: "https://ofvwgdniibxpuncdzjhm.supabase.co/rest/v1/shared_looks", key: "sb_publishable_7ihrmtQig6LMpHfNdhMhoQ_ow4quDUp" },
    base: "https://d.chamy.xyz/"   /* d.chamy.xyz/<code> forwards to works.chamy.xyz/c/<code> (live, HTTPS, 23 Oct 2026) */
  };
  function rnd(n) {
    var r = new Uint8Array(n), o = "";
    (window.crypto || window.msCrypto).getRandomValues(r);
    for (var i = 0; i < n; i++) o += A[r[i] % A.length];
    return o;
  }
  function code(s) {
    if (!s) return null;
    var m = /(?:\/c\/|[?&]l=|^https?:\/\/d\.chamy\.xyz\/)([A-Za-z0-9]{4,16})\b/.exec(String(s)) || /^([A-Za-z0-9]{4,16})$/.exec(String(s));
    return m ? m[1] : null;
  }
  function make(o) {
    o = o || {};
    var tries = 0;
    function go() {
      var id = rnd(LEN);
      return fetch(O.db.url, {
        method: "POST",
        headers: { apikey: O.db.key, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ id: id, tool: o.tool || "", look: o.payload, version: o.version || null })
      }).then(function (r) {
        if (r.ok) return O.base + id;
        if (r.status === 409 && ++tries < 4) return go();   // the code was taken: draw again
        /* the table's check constraint still asks for 10 characters (22 Oct 2026: 400, code 23514, shared_looks_id_check):
           draw a 10-character code, and keep doing so this visit. Relax the constraint to {7,10} and 7 comes back. */
        if (r.status === 400 && LEN < 10 && ++tries < 4) return r.text().then(function (t) { if (/23514|check constraint/.test(t)) { LEN = 10; return go(); } return null; });
        return null;
      }, function () { return null; });
    }
    return go();
  }
  function open(c) {
    c = code(c);
    if (!c) return Promise.resolve(null);
    return fetch(O.db.url + "?id=eq." + c + "&select=tool,look", { headers: { apikey: O.db.key } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { return rows && rows[0] ? rows[0] : null; }, function () { return null; });
  }
  function configure(o) { o = o || {}; if (o.db) O.db = o.db; if (o.base) O.base = o.base; }
  /* the short address lives in ONE place: SurfaceShort.base: d.chamy.xyz/ (Dimitry, 22 Oct 23:11;
     live 23 Oct, forwarding /<code> to works.chamy.xyz/c/<code>). Codes of 4 to 16 characters are read, so a short or
     mistyped one reaches the "expired or wrong" page rather than "nothing here". */
  /* THE RESOLVER, shared by every page that receives a short link (works.chamy.xyz's 404.html and c/index.html, and the
     planned d.chamy.xyz): finds the code in the address (/c/<code>, /c/?<code>, or /<code> on a host of its own), reads its
     row, and goes on to the tool with ?l=<code>. show(kind, tool) is called when there is nothing to go to:
     'none' (no code in the address), 'gone' (no such code, or the network failed; tool when the row named one). */
  var TOOLS = { current: { path: "https://works.chamy.xyz/current/", name: "Current" } };
  function inPath(loc, ownHost) {
    var p = loc.pathname, m = /^\/c\/([A-Za-z0-9]{4,16})\/?$/.exec(p);
    if (m) return m[1];
    if (/^\/c\/?$/.test(p) || (ownHost && /^\/?$/.test(p))) { m = /^\?([A-Za-z0-9]{4,16})$/.exec(loc.search) || /[?&](?:c|l)=([A-Za-z0-9]{4,16})\b/.exec(loc.search); if (m) return m[1]; }
    if (ownHost) { m = /^\/([A-Za-z0-9]{4,16})\/?$/.exec(p); if (m) return m[1]; }
    return null;
  }
  function resolve(o) {
    o = o || {};
    var loc = o.location || location, show = o.show || function () {}, tools = o.tools || TOOLS;
    var ownHost = o.ownHost != null ? o.ownHost : !/(^|\.)works\.chamy\.xyz$|^localhost$|^127\./.test(loc.hostname);
    var c = inPath(loc, ownHost);
    if (!c) { show("none"); return Promise.resolve(null); }
    var done = false, tm = setTimeout(function () { if (!done) { done = true; show("gone"); } }, o.timeout || 9000);
    return fetch(O.db.url + "?id=eq." + c + "&select=tool", { headers: { apikey: O.db.key } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (done) return null; done = true; clearTimeout(tm);
        var row = rows && rows[0], T = row && tools[row.tool];
        if (!T) { show("gone", row && row.tool); return null; }
        var to = (ownHost ? T.path : T.path.replace(/^https:\/\/works\.chamy\.xyz/, "")) + "?l=" + encodeURIComponent(c);   // on works itself (or a test server) stay on this origin
        (o.go || function (u) { loc.replace(u); })(to);
        return to;
      }, function () { if (!done) { done = true; clearTimeout(tm); show("gone"); } return null; });
  }
  var api = { make: make, open: open, code: code, configure: configure, resolve: resolve, tools: TOOLS, alphabet: A };
  Object.defineProperty(api, "base", { get: function () { return O.base; }, set: function (v) { O.base = String(v); }, enumerable: true });
  window.SurfaceShort = api;
})();
