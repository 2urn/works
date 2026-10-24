/* Surface · Touch — one touch layer every tool can listen to: the fingers on this screen, and the fingers on other
   screens (Dimitry, 23 Oct 2026: "Interesting touch interface, multiple screens and fingers" … "a Surface touch module,
   a phone-to-projector test, audience phones adding fingers to a piece on one screen. Audience participants wow!").

   THE METHOD (Codex entry "Multitouch to another screen"). Pointer Events give each finger its own pointerId for as
   long as it is down (W3C Pointer Events). A phone sends a BUNDLE that restates every finger down now, with its place
   on the phone's pad (0..1, y down): the alive rule of TUIO 1.1 (Kaltenbrunner et al.), so a lost or late message
   heals on the next one. A finger missing from a bundle has lifted. Nothing else travels: no video, no sound.
   The receiving screen eases each finger toward where it was last said to be, so 30 messages a second look smooth at
   60 frames, and holds a phone that has said nothing for 4 s as lifted (it went to sleep mid-touch).

   THREE PARTS
     SurfaceTouch.capture(el, {max, onChange})  the fingers on an element, by pointerId, in 0..1 of its box
         → { fingers() [{sid, x, y}], stop() }
     SurfaceTouch.play(code, {url, name})       a phone (or any page) that sends its fingers to a room
         → { bind(el), control(v), rename(n), leave(), on(ev, f), state(), color, look }
         events: state ("connecting" | "open" | "closed" | "full" | "removed" | "reconnecting" | "refused"),
                 hello {p, color, open, look, n}, look (the screen's {title, controls…}), open (bool), clear
     SurfaceTouch.host(code, {url, key})        the screen that listens (a projector, a piece, any tool)
         → { fingers() [{id, p, sid, x, y, vx, vy, color, c, name, age}], people(), on(ev, f), open(v), cap(n),
             look(d), kick(p), clear(), drive(el), leave(), state() }
         events: state, people [{p, name, color, c}], join {p, name, color, c}, leave {p},
                 down {id, p, sid, x, y, color, c, name} (a finger arrived), up {id, p} (it lifted)
         fingers() is read once a frame; x, y are eased, vx, vy are per second (both 0..1 of the phone's pad).
         drive(el) turns every remote finger into pointer events on el (pointerType "touch", pointerId from 9001),
         so a tool that already listens to fingers is steered with no change: "a phone steers any tool".
     SurfaceTouch.code()  a fresh 6-letter code: no vowels and no Y (so it never spells a word), no 0, 1 or L
     SurfaceTouch.joinUrl(code, page?)  the link a phone opens (page defaults to the kit's own touch page, ../../touch/)
     SurfaceTouch.live()  false while no relay is deployed: every room then rehearses between windows of one browser
     SurfaceTouch.rehearse(code, page?)  inside a tap: a phone-sized window on this computer holding the phone page

   TRANSPORTS (the url)
     "wss://…"   the Touch relay (sys/tools/touchrelay: one Cloudflare Durable Object per room, PartyServer, nothing stored)
     "tab:"      BroadcastChannel: windows of one browser on one computer (the projector window and a phone-sized
                 window side by side, to rehearse without the internet). The host plays the relay's part.
   Test hook: localStorage "surface.touch.url" points every room at another relay (a local `wrangler dev`).

   RATES: a phone sends at most 30 bundles a second while its fingers move, one every half second while they rest,
   and one at once when a finger lifts. The relay sends a screen one message a frame (33 ms) carrying only the phones
   that changed. Plain script, window.SurfaceTouch, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceTouch) return;
  var ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  var HERE = (document.currentScript && document.currentScript.src) || location.href;
  var RELAY = "";   // the deployed relay's wss:// address; empty until it is deployed, and then every room rehearses ("tab:")
  var COLORS = ["#ff4fb0", "#55b8c9", "#f2c14e", "#7bd389", "#b48cff", "#ff8a5b", "#5b8cff", "#e8e8e8", "#f08a9c", "#6ad6b6", "#e8d86a", "#4f8df0"];
  var STALE = 4000, SEND = 33, REST = 500;
  function rnd(n, a) { a = a || ALPHA; var s = "", u = new Uint32Array(n); crypto.getRandomValues(u); for (var i = 0; i < n; i++) s += a[u[i] % a.length]; return s; }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function r3(v) { return Math.round(clamp(v) * 1000) / 1000; }
  function clean(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); }
  function relayUrl(o) { var u = o && o.url; try { var t = localStorage.getItem("surface.touch.url"); if (t) u = t; } catch (e) {} return u || RELAY || "tab:"; }
  function emitter() { var L = {}; return { on: function (ev, f) { (L[ev] = L[ev] || []).push(f); }, emit: function (ev, d) { (L[ev] || []).forEach(function (f) { try { f(d); } catch (e) { console.warn("touch " + ev, e); } }); } }; }

  /* ---------- the fingers on an element ---------- */
  function capture(el, o) {
    o = o || {}; var max = o.max || 10, F = new Map(), next = 1;
    var prevTA = el.style.touchAction; el.style.touchAction = "none";
    function at(e) { var r = el.getBoundingClientRect(); return [clamp((e.clientX - r.left) / Math.max(1, r.width)), clamp((e.clientY - r.top) / Math.max(1, r.height))]; }
    function changed() { if (o.onChange) o.onChange(list()); }
    function down(e) { if (F.size >= max) return; try { el.setPointerCapture(e.pointerId); } catch (_) {} var p = at(e); F.set(e.pointerId, { sid: next++, x: p[0], y: p[1] }); e.preventDefault(); changed(); }
    function move(e) { var f = F.get(e.pointerId); if (!f) return; var p = at(e); f.x = p[0]; f.y = p[1]; changed(); }
    function up(e) { if (F.delete(e.pointerId)) changed(); }
    function list() { var a = []; F.forEach(function (f) { a.push({ sid: f.sid, x: f.x, y: f.y }); }); return a; }
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); el.addEventListener("lostpointercapture", up);
    return { fingers: list, stop: function () { el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); el.removeEventListener("lostpointercapture", up); el.style.touchAction = prevTA; F.clear(); } };
  }

  /* ---------- a socket that comes back (or a BroadcastChannel that behaves like one) ---------- */
  function link(url, query, on) {
    var ws = null, closed = false, wait = 1000, t = 0, bc = null, me = rnd(10);
    if (url === "tab:") {
      bc = new BroadcastChannel("surface-touch-" + query.code);
      bc.onmessage = function (e) { var d = e.data || {}; if (d.to === me || (d.to === "*" && query.role === "play") || (query.role === "host" && d.from && !d.to)) on.msg(d.m, d.from); };
      setTimeout(function () { on.open(); }, 0);
      return { me: me, send: function (m, to) { try { bc.postMessage(query.role === "host" ? { to: to || "*", m: m } : { from: me, m: m }); } catch (e) {} },
        close: function () { closed = true; try { bc.postMessage({ from: me, m: { t: "bye" } }); bc.close(); } catch (e) {} } };
    }
    function open() {
      if (closed) return;
      var q = []; for (var k in query) if (k !== "code" && query[k] != null) q.push(k + "=" + encodeURIComponent(query[k]));
      try { ws = new WebSocket(url.replace(/\/+$/, "") + "/parties/touch/" + query.code + "?" + q.join("&")); } catch (e) { retry(); return; }
      ws.onopen = function () { wait = 1000; on.open(); };
      ws.onmessage = function (e) { var m; try { m = JSON.parse(e.data); } catch (_) { return; } on.msg(m); };
      ws.onclose = function (e) {
        ws = null; if (closed) return;
        var c = e.code;
        if (c === 4003 || c === 4004) { closed = true; on.end(c === 4004 ? "removed" : "refused"); return; }
        if (c === 4001) { on.end(e.reason === "room full" ? "full" : "closed"); t = setTimeout(open, 5000); return; }
        on.drop(); retry();
      };
      ws.onerror = function () {};
    }
    function retry() { if (closed) return; t = setTimeout(open, wait); wait = Math.min(wait * 1.6, 6000); }
    open();
    return { me: me, send: function (m) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(m)); return true; } catch (e) {} } return false; },
      close: function () { closed = true; clearTimeout(t); var s = ws; ws = null; try { s && s.close(1000, "bye"); } catch (e) {} } };
  }

  /* ---------- a phone: send my fingers to the room ---------- */
  function play(code, o) {
    o = o || {}; code = clean(code);
    var E = emitter(), url = relayUrl(o), st = "connecting", cap = null, last = 0, lastS = "", lastN = 0, timer = 0, ctrl = null;
    var self = { color: null, look: null, p: null, on: E.on, state: function () { return st; } };
    function setState(s) { if (s !== st) { st = s; E.emit("state", s); } }
    var L = link(url, { code: code, role: "play", name: String(o.name || "").slice(0, 24) }, {
      open: function () { if (url === "tab:") L.send({ t: "hi", name: o.name || "" }); else setState("open"); lastS = ""; flush(true); if (ctrl != null) L.send({ t: "c", v: ctrl }); },
      msg: function (m) {
        if (!m || typeof m !== "object") return;
        if (m.t === "hello") { self.p = m.p; self.color = m.color; self.look = m.look || null; setState(m.open === false ? "closed" : "open"); E.emit("hello", m); if (m.look) E.emit("look", m.look); if (ctrl != null) L.send({ t: "c", v: ctrl }); }
        else if (m.t === "look") { self.look = m.d; E.emit("look", m.d); }
        else if (m.t === "open") { setState(m.v ? "open" : "closed"); E.emit("open", !!m.v); }
        else if (m.t === "clear") E.emit("clear");
      },
      drop: function () { setState("reconnecting"); },
      end: function (why) { setState(why); }
    });
    function bundle() { return cap ? cap.fingers().map(function (f) { return [f.sid, r3(f.x), r3(f.y)]; }) : []; }
    function flush(force) {
      var now = performance.now(), f = bundle(), s = JSON.stringify(f);
      if (!force && s === lastS && (!f.length || now - last < REST)) return;
      if (!force && s !== lastS && now - last < SEND && f.length >= lastN) return;   // the timer sends it; a lift goes at once
      L.send({ t: "f", f: f }); last = now; lastS = s; lastN = f.length;
    }
    timer = setInterval(function () { flush(false); }, SEND);
    self.bind = function (el) { if (cap) cap.stop(); cap = capture(el, { max: o.max || 5, onChange: function () { flush(false); } }); return cap; };
    self.control = function (v) { ctrl = v; L.send({ t: "c", v: v }); };
    self.rename = function (n) { L.send({ t: "n", v: String(n || "").slice(0, 24) }); };
    self.leave = function () { clearInterval(timer); try { L.send({ t: "f", f: [] }); } catch (e) {} if (cap) cap.stop(); L.close(); setState("left"); };
    return self;
  }

  /* ---------- the screen: everyone's fingers, eased ---------- */
  function host(code, o) {
    o = o || {}; code = clean(code);
    var E = emitter(), url = relayUrl(o), st = "connecting", key = o.key, people = new Map(), lastT = 0, isOpen = true, capN = 80, look = null, seq = 0;
    if (!key) { try { key = localStorage.getItem("surface.touch.key." + code); } catch (e) {} if (!key) { key = rnd(24, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789"); try { localStorage.setItem("surface.touch.key." + code, key); } catch (e) {} } }
    function setState(s) { if (s !== st) { st = s; E.emit("state", s); } }
    function list() { var a = []; people.forEach(function (q) { a.push({ p: q.p, name: q.name, color: q.color, c: q.c, n: q.F.size }); }); return a; }
    function person(m) {
      var q = people.get(m.p), fresh = !q;
      if (!q) { q = { p: m.p, F: new Map(), at: performance.now() }; people.set(m.p, q); }
      if (m.name != null) q.name = m.name; if (m.color) q.color = m.color; if (m.c !== undefined) q.c = m.c;
      if (fresh || m.c !== undefined) { E.emit("join", { p: q.p, name: q.name, color: q.color, c: q.c, fresh: fresh }); E.emit("people", list()); }
      return q;
    }
    function lift(q, sid) { var f = q.F.get(sid); if (!f) return; q.F.delete(sid); E.emit("up", { id: f.id, p: q.p }); }
    function gone(p) { var q = people.get(p); if (!q) return; q.F.forEach(function (f, sid) { lift(q, sid); }); people.delete(p); E.emit("leave", { p: p }); E.emit("people", list()); }
    function fingersOf(p, arr) {
      var q = people.get(p); if (!q) return; var now = performance.now(), seen = {};
      q.at = now;
      (arr || []).forEach(function (s) {
        var sid = s[0], x = clamp(+s[1] || 0), y = clamp(+s[2] || 0), f = q.F.get(sid); seen[sid] = 1;
        if (!f) { f = { id: p + ":" + sid, p: p, sid: sid, x: x, y: y, tx: x, ty: y, vx: 0, vy: 0, t: now, born: now }; q.F.set(sid, f); E.emit("down", { id: f.id, p: p, sid: sid, x: x, y: y, color: q.color, c: q.c, name: q.name }); }
        else { var dt = Math.max(16, now - f.t) / 1000; f.vx = f.vx * .5 + .5 * (x - f.tx) / dt; f.vy = f.vy * .5 + .5 * (y - f.ty) / dt; f.tx = x; f.ty = y; f.t = now; }
      });
      q.F.forEach(function (f, sid) { if (!seen[sid]) lift(q, sid); });   // the alive rule
    }
    /* the tab transport: this page plays the relay's part */
    function relayLite(m, from) {
      if (!from) return;
      if (m.t === "hi") {
        if (!isOpen) { L.send({ t: "hello", role: "play", open: false, look: look }, from); return; }
        var q = people.get(from) || person({ p: from, name: String(m.name || "guest").slice(0, 24), color: COLORS[seq++ % COLORS.length], c: null });
        L.send({ t: "hello", role: "play", p: from, color: q.color, open: isOpen, look: look, n: people.size }, from); return;
      }
      if (m.t === "bye") { gone(from); return; }
      if (!people.has(from) || !isOpen) return;
      if (m.t === "f" && Array.isArray(m.f)) fingersOf(from, m.f.slice(0, 10));
      else if (m.t === "c") person({ p: from, c: m.v });
      else if (m.t === "n") person({ p: from, name: String(m.v || "").slice(0, 24) });
    }
    var L = link(url, { code: code, role: "host", key: key }, {
      open: function () { setState("open"); if (look) L.send({ t: "look", d: look }); },
      msg: function (m, from) {
        if (url === "tab:") { relayLite(m, from); return; }
        if (!m || typeof m !== "object") return;
        if (m.t === "hello") { isOpen = m.open !== false; capN = m.cap || capN; var was = {}; people.forEach(function (q, p) { was[p] = 1; }); (m.people || []).forEach(function (q) { delete was[q.p]; person(q); }); for (var p in was) gone(p); E.emit("people", list()); }
        else if (m.t === "j") person(m);
        else if (m.t === "l") gone(m.p);
        else if (m.t === "F") (m.d || []).forEach(function (d) { if (!people.has(d[0])) person({ p: d[0] }); fingersOf(d[0], d[1]); });
        else if (m.t === "state") { isOpen = !!m.open; capN = m.cap; }
      },
      drop: function () { setState("reconnecting"); },
      end: function (why) { setState(why); }
    });
    function fingers() {
      var now = performance.now(), dt = lastT ? Math.min(.1, (now - lastT) / 1000) : 0, k = Math.min(1, dt * 18), a = []; lastT = now;
      people.forEach(function (q) {
        if (q.F.size && now - q.at > STALE) { q.F.forEach(function (f, sid) { lift(q, sid); }); return; }
        q.F.forEach(function (f) { f.x += (f.tx - f.x) * k; f.y += (f.ty - f.y) * k; f.vx *= Math.exp(-dt * 2); f.vy *= Math.exp(-dt * 2);
          a.push({ id: f.id, p: q.p, sid: f.sid, x: f.x, y: f.y, vx: f.vx, vy: f.vy, color: q.color, c: q.c, name: q.name, age: (now - f.born) / 1000 }); });
      });
      return a;
    }
    var self = { on: E.on, fingers: fingers, people: list, state: function () { return st; }, key: key, code: code,
      open: function (v) { isOpen = !!v; if (url === "tab:") { L.send({ t: "open", v: isOpen }); if (!isOpen) people.forEach(function (q) { fingersOf(q.p, []); }); } else L.send({ t: "open", v: isOpen }); },
      isOpen: function () { return isOpen; },
      cap: function (n) { capN = n; L.send({ t: "cap", n: n }); },
      look: function (d) { look = d; L.send({ t: "look", d: d }); },
      kick: function (p) { if (url === "tab:") gone(p); L.send({ t: "kick", p: p }); },
      clear: function () { people.forEach(function (q) { q.F.forEach(function (f, sid) { lift(q, sid); }); }); L.send({ t: "clear" }); },
      leave: function () { if (drv) drv.stop(); L.close(); setState("left"); } };

    /* drive(el): every remote finger becomes pointer events on el, so any tool that listens to fingers is steered */
    var drv = null;
    self.drive = function (el) {
      if (drv) drv.stop();
      var ids = {}, nextId = 9001, raf = 0;
      function fire(type, f, pid) { var r = el.getBoundingClientRect(); var ev = new PointerEvent(type, { pointerId: pid, pointerType: "touch", isPrimary: false, bubbles: true, cancelable: true, clientX: r.left + f.x * r.width, clientY: r.top + f.y * r.height, pressure: type === "pointerup" ? 0 : .5, buttons: type === "pointerup" ? 0 : 1 }); el.dispatchEvent(ev); }
      function step() {
        var seen = {}, a = fingers();
        a.forEach(function (f) { var d = ids[f.id]; if (!d) { d = ids[f.id] = { pid: nextId++, x: f.x, y: f.y }; fire("pointerdown", f, d.pid); } else fire("pointermove", f, d.pid); d.x = f.x; d.y = f.y; seen[f.id] = 1; });
        for (var id in ids) if (!seen[id]) { fire("pointerup", ids[id], ids[id].pid); delete ids[id]; }
        raf = requestAnimationFrame(step);
      }
      raf = requestAnimationFrame(step);
      drv = { stop: function () { cancelAnimationFrame(raf); for (var id in ids) fire("pointerup", ids[id], ids[id].pid); ids = {}; } };
      return drv;
    };
    return self;
  }

  /* rehearse(code, page): a phone-sized window on this computer, in this page's own origin (so "tab:" reaches it),
     holding the kit's phone page. Call it inside a tap: the window must open before anything is awaited. */
  function rehearse(code, page) {
    var w = window.open("", "touchphone" + clean(code), "width=390,height=760"); if (!w) return null;
    var src = page || new URL("../../touch/", HERE).href;
    fetch(src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (html) {
      var head = '<base href="' + src + '"><script>window.__TOUCH_Q="?room=' + clean(code) + '&via=tab"<\/script>';
      w.document.open(); w.document.write(html.replace(/<head>/i, "<head>" + head)); w.document.close();
    }).catch(function (e) { try { w.document.body.textContent = "The phone page did not load (" + e.message + ")."; } catch (_) {} });
    return w;
  }
  function joinUrl(code, page) { var u = new URL(page || new URL("../../touch/", HERE).href, location.href); u.searchParams.set("room", clean(code)); return u.href; }
  window.SurfaceTouch = { capture: capture, play: play, host: host, code: function (n) { return rnd(Math.max(6, n || 6), "BCDFGHJKMNPQRSTVWXZ23456789"); }, joinUrl: joinUrl, rehearse: rehearse, live: function () { return !!relayUrl() && relayUrl() !== "tab:"; }, clean: clean, COLORS: COLORS, version: "1.0.0" };
})();
