/* claude-web.js — run a claude.ai artifact on the open web.
 *
 * WHAT IT DOES
 * A claude.ai artifact reaches its platform features through one door:
 *     const db = await claude.use("db")      // or "downloads", "user", "room", ...
 * and every artifact is written to cope with that door returning null.
 * This file puts the same door on an ordinary web page, so the artifact's
 * own code runs unchanged on sys.chamy.xyz, on a phone home screen, offline.
 * Behind each name sits an ADAPTER, picked by config:
 *
 *   downloads   real file save (share sheet on iPhone/iPad, download elsewhere)
 *   db          "local"  : this browser only (IndexedDB), live across tabs
 *               "supabase": shared, live, across devices (see supabase.sql)
 *   user        local: one anonymous person who owns everything
 *               supabase: the signed-in Supabase user, if any
 *   room        local: tabs on this device; supabase: everyone online
 *   assets      local: blobs in IndexedDB; supabase: a Storage bucket
 *   sample      only with a proxy endpoint you run (the API key never ships)
 *   artifact, comments, mcp, files   -> null: claude.ai-only, pages hide them
 *
 * CONFIG (the export builder writes this; you can also set it by hand,
 * before this script):
 *   <script>window.CLAUDE_WEB = { app: "toolpath-field", backend: "local" }</script>
 *   backend "supabase" also needs { supabase: { url, anonKey } } — the anon key
 *   is public by design; Row Level Security in supabase.sql is what protects data.
 *
 * RULES IT KEEPS
 * - If a real claude.ai runtime is present, this file does nothing.
 * - use() resolves, never rejects; unknown or unsupported names resolve null.
 * - Error codes match claude.ai's, so the artifact's existing branches work.
 *
 * Part of sys/export/v1. MIT-style studio infrastructure; no third-party code
 * except supabase-js (MIT), loaded only when backend is "supabase".
 */
(function () {
  "use strict";
  if (window.claude && typeof window.claude.use === "function") return;

  var CFG = Object.assign({ app: "app", backend: "local" }, window.CLAUDE_WEB || {});
  var APP = String(CFG.app).replace(/[^a-z0-9_-]/gi, "-");
  var err = function (code, message) { var e = new Error(message || code); e.code = code; return e; };
  var memo = {};

  /* ---------- small shared pieces ---------- */

  function idb(name) {
    return new Promise(function (res, rej) {
      var r = indexedDB.open("claude-web:" + APP + ":" + name, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(db, mode, fn) {
    return new Promise(function (res, rej) {
      var t = db.transaction("kv", mode), s = t.objectStore("kv"), out = fn(s);
      t.oncomplete = function () { res(out && "result" in out ? out.result : out); };
      t.onerror = function () { rej(t.error); };
    });
  }
  function localId() {
    var k = "claude-web:" + APP + ":uid", v;
    try { v = localStorage.getItem(k); } catch (_) {}
    if (!v) { v = "u_local_" + Math.random().toString(36).slice(2, 12); try { localStorage.setItem(k, v); } catch (_) {} }
    return v;
  }
  function freeze(o) { return Object.freeze(o); }
  function snap(id, data, meta) {
    var body = data == null ? undefined : freeze(JSON.parse(JSON.stringify(data)));
    return freeze({ id: id, exists: data != null, data: function () { return body; },
      metadata: freeze(meta || { fromCache: false, hasPendingWrites: false }) });
  }
  function checkPath(path, wantDoc) {
    var segs = String(path).split("/").filter(Boolean);
    var ok = segs.length && segs.every(function (s) { return /^[A-Za-z0-9_\-.~:@+]+$/.test(s) && s !== "." && s !== ".."; });
    if (!ok) throw new TypeError("claude-web: bad path " + path);
    if (wantDoc && segs.length % 2) throw new TypeError("claude-web: document paths need an even number of segments: " + path);
    if (!wantDoc && !(segs.length % 2)) throw new TypeError("claude-web: collection paths need an odd number of segments: " + path);
    return segs.join("/");
  }
  function parentOf(path) { return path.split("/").slice(0, -1).join("/"); }
  function cmp(a, op, b) {
    switch (op) {
      case "==": return a === b; case "!=": return a !== b;
      case "<": return a < b; case "<=": return a <= b; case ">": return a > b; case ">=": return a >= b;
      case "in": return Array.isArray(b) && b.indexOf(a) >= 0;
      case "not-in": return Array.isArray(b) && b.indexOf(a) < 0;
      case "array-contains": return Array.isArray(a) && a.indexOf(b) >= 0;
    }
    throw err("invalid_argument", "unknown operator " + op);
  }
  function runQuery(rows, q) {
    var out = rows.filter(function (r) { return q.where.every(function (w) { return cmp(r.data[w[0]], w[1], w[2]); }); });
    if (q.order) {
      var f = q.order[0], d = q.order[1] === "desc" ? -1 : 1;
      out.sort(function (x, y) { var a = x.data[f], b = y.data[f];
        if (a === undefined) return 1; if (b === undefined) return -1; return a < b ? -d : a > b ? d : 0; });
    } else out.sort(function (x, y) { return x.id < y.id ? -1 : 1; });
    return q.limit ? out.slice(0, q.limit) : out;
  }
  function querySnap(rows, prev) {
    var docs = rows.map(function (r) { return snap(r.id, r.data); });
    var prevIds = prev ? prev.map(function (d) { return d.id; }) : [];
    var changes = [];
    docs.forEach(function (d, i) {
      var j = prevIds.indexOf(d.id);
      if (j < 0) changes.push({ type: "added", doc: d, oldIndex: -1, newIndex: i });
      else if (JSON.stringify(prev[j].data()) !== JSON.stringify(d.data())) changes.push({ type: "modified", doc: d, oldIndex: j, newIndex: i });
    });
    (prev || []).forEach(function (d, j) {
      if (!docs.some(function (x) { return x.id === d.id; })) changes.push({ type: "removed", doc: d, oldIndex: j, newIndex: -1 });
    });
    return freeze({ docs: docs, size: docs.length, empty: !docs.length,
      docChanges: function () { return changes; }, metadata: freeze({ fromCache: false, hasPendingWrites: false }) });
  }
  function merge(a, b) {
    var o = Object.assign({}, a);
    Object.keys(b).forEach(function (k) {
      var v = b[k];
      o[k] = v && typeof v === "object" && !Array.isArray(v) && o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) ? merge(o[k], v) : v;
    });
    return o;
  }

  /* ---------- a store = get/put/del/all + change events; db is built on top ---------- */

  function makeDb(store) {
    var listeners = new Set();
    store.onChange(function () { listeners.forEach(function (fn) { fn(); }); });

    function docRef(path) {
      path = checkPath(path, true);
      var id = path.split("/").pop();
      return {
        id: id, path: path,
        get: function () { return store.get(path).then(function (d) { return snap(id, d); }); },
        set: function (data) {
          if (!data || typeof data !== "object" || Array.isArray(data)) return Promise.reject(err("invalid_argument", "body must be an object"));
          return store.put(path, data);
        },
        update: function (data) {
          return store.get(path).then(function (cur) {
            if (cur == null) throw err("invalid_argument", "update needs an existing document");
            return store.put(path, merge(cur, data));
          });
        },
        delete: function () { return store.del(path); },
        acquire: function (o) {   // single-device lease: good enough locally, honest about it
          return store.get(path).then(function (cur) {
            var now = Date.now(), lease = cur && cur.__lease;
            if (lease && lease.until > now && lease.holder !== o.holder) return { acquired: false, expiresAt: new Date(lease.until).toISOString() };
            var until = now + Math.min(600000, Math.max(1000, o.ttlMs || 30000));
            var body = merge(cur || {}, Object.assign({}, o.data || {}, { __lease: { holder: o.holder, until: until } }));
            return store.put(path, body).then(function () { return { acquired: true, version: until, expiresAt: new Date(until).toISOString(), holder: o.holder }; });
          });
        },
        onSnapshot: function (next, onErr) {
          var live = true, last;
          function pull() { store.get(path).then(function (d) {
            var s = JSON.stringify(d); if (!live || s === last) return; last = s; next(snap(id, d)); }, function (e) { onErr && onErr(err("unavailable", String(e))); }); }
          listeners.add(pull); pull();
          return function () { live = false; listeners.delete(pull); };
        },
        collection: function (sub) { return colRef(path + "/" + sub); }
      };
    }
    function colRef(path, q) {
      path = checkPath(path, false);
      q = q || { where: [], order: null, limit: 0 };
      function rows() { return store.all(path).then(function (list) { return runQuery(list, q); }); }
      var self = {
        path: path,
        where: function (f, op, v) { if (q.where.length >= 10) throw err("invalid_argument", "at most 10 filters"); return colRef(path, Object.assign({}, q, { where: q.where.concat([[f, op, v]]) })); },
        orderBy: function (f, d) { return colRef(path, Object.assign({}, q, { order: [f, d || "asc"] })); },
        limit: function (n) { return colRef(path, Object.assign({}, q, { limit: n })); },
        get: function () { return rows().then(function (r) { return querySnap(r); }); },
        onSnapshot: function (next, onErr) {
          var live = true, prev = null, last;
          function pull() { rows().then(function (r) {
            var s = JSON.stringify(r); if (!live || s === last) return; last = s;
            var qs = querySnap(r, prev); prev = qs.docs; next(qs); }, function (e) { onErr && onErr(err("unavailable", String(e))); }); }
          listeners.add(pull); pull();
          return function () { live = false; listeners.delete(pull); };
        },
        doc: function (id) { return docRef(path + "/" + (id || Math.random().toString(36).slice(2, 12) + Date.now().toString(36))); },
        add: function (data) { var r = self.doc(); return r.set(data).then(function () { return r; }); }
      };
      return self;
    }
    return freeze({ doc: docRef, collection: function (p) { return colRef(p); } });
  }

  /* local store: IndexedDB + BroadcastChannel so other tabs see writes live */
  function localStore() {
    var dbp = idb("db"), cbs = [], bc = null;
    try { bc = new BroadcastChannel("claude-web:" + APP + ":db"); bc.onmessage = fire; } catch (_) {}
    function fire() { cbs.forEach(function (f) { f(); }); }
    function changed() { fire(); if (bc) bc.postMessage(1); }
    return {
      onChange: function (f) { cbs.push(f); },
      get: function (p) { return dbp.then(function (db) { return tx(db, "readonly", function (s) { return s.get(p); }); }).then(function (v) { return v == null ? null : v; }); },
      put: function (p, d) { return dbp.then(function (db) { return tx(db, "readwrite", function (s) { s.put(JSON.parse(JSON.stringify(d)), p); }); }).then(changed); },
      del: function (p) { return dbp.then(function (db) { return tx(db, "readwrite", function (s) { s.delete(p); }); }).then(changed); },
      all: function (col) {
        return dbp.then(function (db) { return new Promise(function (res, rej) {
          var out = [], t = db.transaction("kv"), c = t.objectStore("kv").openCursor(IDBKeyRange.bound(col + "/", col + "/￿"));
          c.onsuccess = function () { var cur = c.result; if (!cur) return res(out);
            var key = String(cur.key); if (parentOf(key) === col) out.push({ id: key.split("/").pop(), data: cur.value }); cur.continue(); };
          c.onerror = function () { rej(c.error); };
        }); });
      }
    };
  }

  /* supabase store: one table, docs(app, path, collection, data, owner, updated_at) — see supabase.sql */
  var sbp = null;
  function supabase() {
    if (!sbp) {
      var s = CFG.supabase || {};
      if (!s.url || !s.anonKey) return Promise.resolve(null);
      sbp = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
        .then(function (m) {
          var sb = m.createClient(s.url, s.anonKey);
          if (s.anonymous === false) return sb;   // the page signs people in itself
          // default: a silent anonymous account per browser, so Row Level Security has an owner
          return sb.auth.getSession().then(function (r) {
            return r.data && r.data.session ? sb : sb.auth.signInAnonymously().then(function () { return sb; });
          });
        })
        .catch(function (e) { console.warn("claude-web: Supabase did not load", e); return null; });
    }
    return sbp;
  }
  function supabaseStore(sb) {
    var cbs = [], T = "docs";
    function fire() { cbs.forEach(function (f) { f(); }); }
    sb.channel("docs:" + APP)
      .on("postgres_changes", { event: "*", schema: "public", table: T, filter: "app=eq." + APP }, fire)
      .subscribe();
    function fail(e) { throw err(e && e.code === "42501" ? "invalid_argument" : "unavailable", e && e.message); }
    return {
      onChange: function (f) { cbs.push(f); },
      get: function (p) { return sb.from(T).select("data").eq("app", APP).eq("path", p).maybeSingle()
        .then(function (r) { if (r.error) fail(r.error); return r.data ? r.data.data : null; }); },
      put: function (p, d) { return sb.from(T).upsert({ app: APP, path: p, collection: parentOf(p), data: d, updated_at: new Date().toISOString() })
        .then(function (r) { if (r.error) fail(r.error); fire(); }); },
      del: function (p) { return sb.from(T).delete().eq("app", APP).eq("path", p)
        .then(function (r) { if (r.error) fail(r.error); fire(); }); },
      all: function (col) { return sb.from(T).select("path,data").eq("app", APP).eq("collection", col).limit(1000)
        .then(function (r) { if (r.error) fail(r.error); return r.data.map(function (x) { return { id: x.path.split("/").pop(), data: x.data }; }); }); }
    };
  }

  /* ---------- the capabilities ---------- */

  var caps = {
    downloads: function () {
      return freeze({
        save: function (o) {
          if (!o || typeof o.filename !== "string" || !o.filename || o.filename.length > 512 || o.data == null) return Promise.reject(err("bad_request"));
          var blob = o.data instanceof Blob ? o.data : new Blob([o.data]);
          var file; try { file = new File([blob], o.filename, { type: blob.type }); } catch (_) {}
          var touch = matchMedia("(pointer:coarse)").matches;
          if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
            return navigator.share({ files: [file] }).then(function () { return { status: "saved" }; },
              function (e) { throw err(e && e.name === "AbortError" ? "declined" : "unavailable", e && e.message); });
          }
          var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = o.filename; a.rel = "noopener";
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
          return Promise.resolve({ status: "saved" });
        }
      });
    },

    db: function () {
      if (CFG.backend === "supabase") return supabase().then(function (sb) { return sb ? makeDb(supabaseStore(sb)) : null; });
      if (!window.indexedDB) return null;
      return makeDb(localStore());
    },

    user: function () {
      function viewer(id, name, email) {
        var me = freeze({ id: id, name: name || "", email: email || null, isOwner: true, canEdit: true,
          color: "#c4127a", avatarUrl: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#c4127a"/></svg>') });
        return freeze({
          isOwner: function () { return Promise.resolve(true); },
          canEdit: function () { return Promise.resolve(true); },
          can: function () { return Promise.resolve(true); },
          me: function () { return Promise.resolve(me); },
          id: function () { return Promise.resolve(id); },
          name: function () { return Promise.resolve(me.name); },
          email: function () { return Promise.resolve(me.email); },
          avatarUrl: function () { return Promise.resolve(me.avatarUrl); },
          profiles: function (ids) { var o = {}; [].concat(ids).forEach(function (x) {
            o[x] = freeze({ id: x, name: x === id ? me.name : "", email: null, avatarUrl: me.avatarUrl, color: me.color, isMe: x === id, guest: false }); });
            return Promise.resolve(o); },
          search: function () { return Promise.resolve([]); }
        });
      }
      if (CFG.backend === "supabase") return supabase().then(function (sb) {
        if (!sb) return viewer(localId());
        return sb.auth.getUser().then(function (r) { var u = r.data && r.data.user;
          return u ? viewer(u.id, (u.user_metadata && u.user_metadata.name) || "", u.email) : viewer(localId()); });
      });
      return viewer(localId());
    },

    room: function () {
      var me = localId(), handlers = {}, peerFns = [], peers = {}, mine = {};
      function deliver(m) { if (m.from === me) return;
        if (m.t === "p") { peers[m.from] = m.state; peerFns.forEach(function (f) { f(list()); }); }
        else (handlers[m.topic] || []).forEach(function (f) { f(m.data, { id: m.from, guest: false, kind: "user" }); }); }
      function list() { return [{ id: me, you: true, state: mine }].concat(Object.keys(peers).map(function (k) { return { id: k, you: false, state: peers[k] }; })); }
      function api(send) {
        return freeze({
          emit: function (topic, data) { send({ t: "e", topic: topic, data: data, from: me }); },
          on: function (topic, fn) { (handlers[topic] = handlers[topic] || []).push(fn); return function () { handlers[topic] = handlers[topic].filter(function (f) { return f !== fn; }); }; },
          presence: function (patch) { mine = Object.assign({}, mine, patch); send({ t: "p", state: mine, from: me }); },
          onPeers: function (fn) { peerFns.push(fn); fn(list()); return function () { peerFns = peerFns.filter(function (f) { return f !== fn; }); }; },
          join: function () { return api(send); }, leave: function () {}
        });
      }
      if (CFG.backend === "supabase") return supabase().then(function (sb) {
        if (!sb) return null;
        var ch = sb.channel("room:" + APP, { config: { broadcast: { self: false } } });
        ch.on("broadcast", { event: "m" }, function (p) { deliver(p.payload); }).subscribe();
        return api(function (m) { ch.send({ type: "broadcast", event: "m", payload: m }); });
      });
      try { var bc = new BroadcastChannel("claude-web:" + APP + ":room"); bc.onmessage = function (e) { deliver(e.data); };
        return api(function (m) { bc.postMessage(m); }); } catch (_) { return null; }
    },

    assets: function () {
      if (CFG.backend === "supabase") return supabase().then(function (sb) {
        if (!sb) return null;
        var B = sb.storage.from(CFG.bucket || "assets");
        return freeze({
          upload: function (blob) { var id = Math.random().toString(36).slice(2) + Date.now().toString(36);
            return B.upload(APP + "/" + id, blob, { contentType: blob.type }).then(function (r) { if (r.error) throw err("unavailable", r.error.message);
              return { id: id, url: B.getPublicUrl(APP + "/" + id).data.publicUrl, sizeBytes: blob.size, contentType: blob.type }; }); },
          list: function () { return B.list(APP).then(function (r) { return { assets: (r.data || []).map(function (f) { return { id: f.name, url: B.getPublicUrl(APP + "/" + f.name).data.publicUrl }; }), usage: null }; }); },
          delete: function (id) { return B.remove([APP + "/" + id]).then(function () {}); }
        });
      });
      var dbp = idb("assets"), urls = {};
      return freeze({
        upload: function (blob) { var id = Math.random().toString(36).slice(2) + Date.now().toString(36);
          return dbp.then(function (db) { return tx(db, "readwrite", function (s) { s.put(blob, id); }); })
            .then(function () { urls[id] = URL.createObjectURL(blob); return { id: id, url: urls[id], sizeBytes: blob.size, contentType: blob.type }; }); },
        list: function () { return dbp.then(function (db) { return tx(db, "readonly", function (s) { return s.getAllKeys(); }); })
          .then(function (keys) { return { assets: keys.map(function (k) { return { id: k, url: urls[k] || null }; }), usage: null }; }); },
        delete: function (id) { return dbp.then(function (db) { return tx(db, "readwrite", function (s) { s.delete(id); }); }); }
      });
    },

    sample: function () {
      if (!CFG.sampleEndpoint) return null;   // a server you run holds the API key; never the page
      function call(input, opts) {
        return fetch(CFG.sampleEndpoint, { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ app: APP, input: input, modelTier: (opts && opts.modelTier) || "default" }), signal: opts && opts.signal })
          .then(function (r) { if (r.status === 429) throw err("rate_limited"); if (!r.ok) throw err("unavailable", "HTTP " + r.status); return r.json(); })
          .then(function (j) { if (opts && opts.onText) opts.onText({ text: j.text, delta: j.text }); return { text: j.text, truncated: !!j.truncated }; });
      }
      call.json = function (input, opts) { return call(input, opts).then(function (r) { return JSON.parse(r.text); }); };
      call.limits = function () { return Promise.resolve({ images: false }); };
      return call;
    }
  };
  caps.self = function () { return null; };       // claude.ai-only: the page itself is not republishable here
  ["artifact", "comments", "mcp", "files"].forEach(function (n) { caps[n] = function () { return null; }; });

  var permissions = freeze({
    state: function (name) { return Promise.resolve(name ? "granted" : {}); },
    request: function () { return Promise.resolve({}); },
    manage: function () { return Promise.reject(err("unavailable")); }
  });

  window.claude = freeze({
    web: true,   // pages can check claude.web to know they are exported
    use: function (name) {
      if (name === "permissions") return Promise.resolve(permissions);
      if (!(name in memo)) {
        memo[name] = new Promise(function (r) { setTimeout(r, 0); })   // like claude.ai: never inside the first run
          .then(function () { var f = caps[name]; return f ? f() : null; })
          .then(function (v) { return v || null; }, function (e) { console.warn("claude-web:", name, e); return null; });
      }
      return memo[name];
    }
  });
})();
