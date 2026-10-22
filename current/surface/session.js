/* Surface · Session — several laptops in one room play in time (Dimitry, 22 Oct 2026: "If there are 4-5 musicians
   playing together on laptops how could we sync them?" ... "a switch in [the] master laptop" ... "same room via Link").

   One laptop is the CONDUCTOR, the others FOLLOW. The conductor's switch decides what they follow:
     free    each laptop runs on its own (the session only keeps them connected)
     tempo   everyone shares the conductor's tempo and beat one
     scenes  tempo, and the conductor's scene changes too: the screens move as one piece
   A follower can always step out (stays in the room, stops following) and step back in.

   How the time is shared: nothing audio crosses the network. The conductor says "the tempo is B and beat one was at T"
   in its own clock; each follower measures how far its clock is from the conductor's (round trips, the quickest of the
   last few counts, as NTP does) and places beat one in its own time. Each laptop then plays its own beats.

   LINK: the conductor can take its tempo and beat from an Ableton Link session (the musicians' own apps), through a
   small helper on that laptop (sys/tools/linkbridge: Carabiner + linkbridge.mjs) at ws://127.0.0.1:17001. A browser
   cannot join Link by itself (Link speaks UDP on the local network); the native apps will speak it directly.

     var S = SurfaceSession.mount({
       tool: 'current', name: 'Current',
       relay: { url: 'https://<ref>.supabase.co', key: '<publishable key>' },   // Supabase Realtime broadcast
       tempo:    function (bpm, beatOneSec) {},    // follow: bpm, and beat one in performance.now() seconds; (null) lets go
       myTempo:  function () { return { bpm, beatOneSec } | null },           // conductor: its own tempo when no Link
       scene:    function () { return data },       // conductor: what to send when the scene changes (small JSON)
       applyScene: function (data) {},              // follower: show it
       canConduct: function () { return true },     // e.g. Pro
       onChange: function (state) {}                // role, mode, peers, link... changed: update the tool's own UI
     });
     S.open()            the sheet: start, join with a code, the switch, Link
     S.sceneChanged()    conductor: call after the scene changes (sent when mode is 'scenes')
     S.state()           { role: null|'conductor'|'follower', code, mode, following, peers:[{id,name,role}], link, offsetMs, rttMs }
     S.join(code) / S.host() / S.leave() / S.setMode(m) / S.follow(bool) / S.setLink(bool)
   A page opened with ?session=CODE joins that session (after a tap, so sound can start).
   Plain script, window.SurfaceSession, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceSession) return;
  var NOW = function () { return performance.timeOrigin + performance.now(); };   // ms, monotonic within the page
  var ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function code4() { var s = ""; for (var i = 0; i < 4; i++) s += ALPH[(Math.random() * ALPH.length) | 0]; return s; }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------- transports: connect(topic, onMessage, onStatus) → { send(msg), close() } ---------- */
  /* Supabase Realtime, protocol 1.0.0 (JSON objects): join a public broadcast channel, send and receive 'broadcast'
     events, heartbeat every 20 s, reconnect with a growing pause. https://supabase.com/docs/guides/realtime/protocol */
  function supabase(o) {
    return function (topic, onMsg, onStatus) {
      var ws = null, ref = 0, joinRef = null, hb = 0, closed = false, wait = 500, joined = false, queue = [];
      var t = "realtime:" + topic;
      function url() { return o.url.replace(/^http/, "ws").replace(/\/$/, "") + "/realtime/v1/websocket?apikey=" + encodeURIComponent(o.key) + "&vsn=1.0.0"; }
      function raw(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
      function open() {
        if (closed) return; joined = false; onStatus && onStatus("connecting");
        try { ws = new WebSocket(url()); } catch (e) { retry(); return; }
        ws.onopen = function () {
          wait = 500; joinRef = String(++ref);
          raw({ topic: t, event: "phx_join", ref: joinRef, join_ref: joinRef, payload: { config: { broadcast: { ack: false, self: false }, presence: { enabled: false }, private: false } } });
          clearInterval(hb); hb = setInterval(function () { raw({ topic: "phoenix", event: "heartbeat", payload: {}, ref: String(++ref) }); }, 20000);
        };
        ws.onmessage = function (e) {
          var m; try { m = JSON.parse(e.data); } catch (_) { return; }
          if (m.event === "phx_reply" && m.ref === joinRef) {
            if (m.payload && m.payload.status === "ok") { joined = true; onStatus && onStatus("live"); while (queue.length) send(queue.shift()); }
            else { onStatus && onStatus("refused"); }
            return;
          }
          if (m.event === "broadcast" && m.payload && m.payload.event === "m") onMsg(m.payload.payload);
          if (m.event === "phx_error" || m.event === "phx_close") { try { ws.close(); } catch (_) {} }
        };
        ws.onclose = function () { clearInterval(hb); joined = false; if (!closed) { onStatus && onStatus("connecting"); retry(); } };
        ws.onerror = function () {};
      }
      function retry() { setTimeout(open, wait); wait = Math.min(wait * 2, 8000); }
      function send(msg) {
        if (!joined) { if (queue.length < 20) queue.push(msg); return; }
        raw({ topic: t, event: "broadcast", ref: String(++ref), join_ref: joinRef, payload: { type: "broadcast", event: "m", payload: msg } });
      }
      open();
      return { send: send, close: function () { closed = true; clearInterval(hb); try { ws && ws.close(); } catch (e) {} onStatus && onStatus("off"); } };
    };
  }
  /* the same browser, other tabs: for trying it alone and for tests */
  function local() {
    return function (topic, onMsg, onStatus) {
      var bc = new BroadcastChannel("surface-session:" + topic);
      bc.onmessage = function (e) { onMsg(e.data); };
      setTimeout(function () { onStatus && onStatus("live"); }, 0);
      return { send: function (m) { bc.postMessage(m); }, close: function () { bc.close(); onStatus && onStatus("off"); } };
    };
  }

  /* ---------- the Link helper on this laptop ---------- */
  function linkClient(onState) {
    var ws = null, closed = false, wait = 1000, st = { up: false, peers: 0, bpm: null, z: null };
    function open() {
      if (closed) return;
      try { ws = new WebSocket("ws://127.0.0.1:17001"); } catch (e) { retry(); return; }
      ws.onmessage = function (e) {
        var m; try { m = JSON.parse(e.data); } catch (_) { return; }
        if (m.type !== "link" || !(m.bpm > 0)) return;
        /* beat zero of Link's timeline in this page's clock: the helper stamps when it read the beat (wall clock, same
           machine), and the page converts to its own clock once */
        var lag = Date.now() - m.at, localAt = NOW() - lag;
        st = { up: true, peers: m.peers || 0, bpm: m.bpm, z: localAt - m.beat * 60000 / m.bpm, playing: m.playing };
        onState(st);
      };
      ws.onopen = function () { wait = 1000; };
      ws.onclose = function () { if (st.up) { st = { up: false, peers: 0, bpm: null, z: null }; onState(st); } retry(); };
      ws.onerror = function () {};
    }
    function retry() { if (!closed) setTimeout(open, wait); wait = Math.min(wait * 1.6, 6000); }
    open();
    return {
      state: function () { return st; },
      bpm: function (b) { try { ws && ws.readyState === 1 && ws.send(JSON.stringify({ bpm: b })); } catch (e) {} },
      close: function () { closed = true; try { ws && ws.close(); } catch (e) {} }
    };
  }

  /* ---------- the session ---------- */
  function mount(O) {
    O = O || {};
    var me = { id: uid(), name: lsGet("surface.session.name", "") };
    var S = { role: null, code: null, mode: "tempo", following: true, peers: {}, conductor: null, link: false, linkSt: null,
      status: "off", offset: 0, rtt: null, samples: [], tick: null, sceneSeq: 0, lastScene: -1, lastTempo: null };
    var tx = null, timers = [], lk = null;
    var transport = O.transport || (O.relay && O.relay.url && O.relay.key ? supabase(O.relay) : local());
    function fire() { try { O.onChange && O.onChange(state()); } catch (e) {} render(); }
    function state() {
      var peers = Object.keys(S.peers).map(function (k) { return S.peers[k]; });
      return { role: S.role, code: S.code, mode: S.mode, following: S.following, peers: peers, status: S.status,
        conductor: S.conductor, link: S.link ? (S.linkSt || { up: false }) : null, offsetMs: S.role === "follower" ? Math.round(S.offset) : 0,
        rttMs: S.rtt == null ? null : Math.round(S.rtt) };
    }
    function send(type, body) { if (!tx) return; body = body || {}; body.type = type; body.from = me.id; body.name = me.name || "laptop"; tx.send(body); }
    function clear() { timers.forEach(clearInterval); timers = []; }
    function every(ms, f) { timers.push(setInterval(f, ms)); }

    /* the conductor's tempo: Link when it is on and up, else the tool's own */
    function conductorTempo() {
      if (S.link && S.linkSt && S.linkSt.up && S.linkSt.bpm) return { bpm: S.linkSt.bpm, z: S.linkSt.z };
      var t = null; try { t = O.myTempo && O.myTempo(); } catch (e) {}
      if (!t || !(t.bpm > 0)) return null;
      return { bpm: t.bpm, z: t.beatOneSec == null ? null : performance.timeOrigin + t.beatOneSec * 1000 };
    }
    function tick() {
      if (S.role !== "conductor") return;
      var t = conductorTempo();
      send("tick", { mode: S.mode, bpm: t ? t.bpm : null, z: t ? t.z : null, now: NOW(), scene: S.sceneSeq });
    }
    /* a follower applies the conductor's tempo in its own clock */
    function applyTempo(m) {
      if (S.role !== "follower" || !S.following || S.mode === "free" || S.samples.length < 2) return;
      if (!(m.bpm > 0) || m.z == null) return;
      var zLocal = m.z - S.offset, beatOneSec = (zLocal - performance.timeOrigin) / 1000, L = S.lastTempo;
      /* only when it moved: a tempo change, or beat one drifted more than 12 ms */
      if (L && Math.abs(L.bpm - m.bpm) < 0.05) {
        var bl = 60 / m.bpm, d = ((beatOneSec - L.s) % bl + bl) % bl; d = Math.min(d, bl - d);
        if (d < 0.012) return;
      }
      S.lastTempo = { bpm: m.bpm, s: beatOneSec };
      try { O.tempo && O.tempo(m.bpm, beatOneSec); } catch (e) {}
    }
    function letGo() { if (S.lastTempo) { S.lastTempo = null; try { O.tempo && O.tempo(null); } catch (e) {} } }

    function onMsg(m) {
      if (!m || m.from === me.id) return;
      var now = NOW();
      if (m.type === "hello" || m.type === "tick") {
        S.peers[m.from] = { id: m.from, name: m.name, role: m.type === "tick" ? "conductor" : (m.role || "follower"), seen: now };
      }
      if (m.type === "tick" && S.role === "follower") {
        S.conductor = { id: m.from, name: m.name };
        var modeChanged = S.mode !== m.mode; S.mode = m.mode;
        if (S.mode === "free") letGo(); else applyTempo(m);
        if (modeChanged) fire();
        if (S.mode === "scenes" && S.following && m.scene !== S.lastScene) send("want", { to: m.from });   // missed one: ask
      }
      if (m.type === "ping" && S.role === "conductor") send("pong", { to: m.from, a: m.a, b: NOW() });
      if (m.type === "pong" && m.to === me.id) {
        var rtt = now - m.a; if (rtt < 0 || rtt > 5000) return;
        S.samples.push({ rtt: rtt, off: m.b + rtt / 2 - now }); if (S.samples.length > 10) S.samples.shift();
        var best = S.samples.reduce(function (x, y) { return y.rtt < x.rtt ? y : x; });
        var was = S.rtt; S.offset = best.off; S.rtt = best.rtt; if (was == null) fire();
      }
      if (m.type === "scene" && S.role === "follower" && (!m.to || m.to === me.id)) {
        S.lastScene = m.seq;
        if (S.following && S.mode === "scenes") { try { O.applyScene && O.applyScene(m.data); } catch (e) { try { console.warn("[session] scene", e); } catch (_) {} } }
      }
      if (m.type === "want" && S.role === "conductor" && m.to === me.id) sendScene(m.from);
      if (m.type === "bye") { delete S.peers[m.from]; fire(); }
    }
    function sendScene(to) {
      var d = null; try { d = O.scene && O.scene(); } catch (e) {}
      if (d == null) return;
      var body = { seq: S.sceneSeq, data: d }; if (to) body.to = to;
      send("scene", body);
    }
    function start(role, code) {
      leave(true);
      S.role = role; S.code = code; S.samples = []; S.rtt = null; S.offset = 0; S.peers = {}; S.conductor = null; S.lastScene = -1;
      S.following = true; S.mode = role === "conductor" ? lsGet("surface.session.mode", "tempo") : S.mode;
      tx = transport("surface-" + (O.tool || "tool") + "-" + code.toLowerCase(), onMsg, function (st) { S.status = st; fire(); });
      send("hello", { role: role });
      every(5000, function () { send("hello", { role: S.role }); var n = NOW(); Object.keys(S.peers).forEach(function (k) { if (n - S.peers[k].seen > 16000) delete S.peers[k]; }); fire(); });
      if (role === "conductor") { every(1000, tick); tick(); }
      else {
        var burst = 0, ping = function () { send("ping", { a: NOW() }); };
        timers.push(setInterval(function () { if (burst < 8) { burst++; ping(); } }, 200));
        every(2500, ping);
      }
      try { var u = new URL(location.href); u.searchParams.set("session", code); history.replaceState(history.state, "", u); } catch (e) {}
      fire();
    }
    function host() {
      if (O.canConduct && !O.canConduct()) { fire(); return false; }
      start("conductor", code4()); return S.code;
    }
    function join(code) {
      code = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      if (code.length !== 4) return false;
      start("follower", code); return true;
    }
    function leave(quiet) {
      if (tx) { send("bye"); var t = tx; tx = null; setTimeout(function () { t.close(); }, 50); }
      clear(); letGo(); S.role = null; S.code = null; S.peers = {}; S.conductor = null; S.status = "off";
      try { var u = new URL(location.href); if (u.searchParams.has("session")) { u.searchParams.delete("session"); history.replaceState(history.state, "", u); } } catch (e) {}
      if (!quiet) fire();
    }
    function setMode(m) {
      if (["free", "tempo", "scenes"].indexOf(m) < 0 || S.role !== "conductor") return;
      S.mode = m; lsSet("surface.session.mode", m); tick(); if (m === "scenes") sceneChanged(); fire();
    }
    function follow(on) {
      if (S.role !== "follower") return; S.following = !!on;
      if (!on) letGo(); else { S.lastTempo = null; S.lastScene = -1; }
      fire();
    }
    function sceneChanged() { if (S.role !== "conductor") return; S.sceneSeq++; if (S.mode === "scenes") sendScene(); }
    function setLink(on) {
      S.link = !!on; lsSet("surface.session.link", on ? "1" : "0");
      if (on && !lk) lk = linkClient(function (st) {
        var was = S.linkSt && S.linkSt.up; S.linkSt = st;
        /* the conductor (or a laptop alone) plays on Link's beat itself */
        if (st.up && st.bpm) { S.lastTempo = null; try { O.tempo && O.tempo(st.bpm, (st.z - performance.timeOrigin) / 1000); } catch (e) {} }
        if (was !== st.up) fire(); tick();
      });
      if (!on && lk) { lk.close(); lk = null; S.linkSt = null; try { O.tempo && O.tempo(null); } catch (e) {} }
      fire();
    }

    /* ---------- the sheet ---------- */
    var box = null, veil = null;
    var CSS =
      ".sss-veil{position:fixed;inset:0;z-index:80;background:rgba(5,7,9,.55);opacity:0;transition:opacity .3s}.sss-veil.on{opacity:1}" +
      ".sss{position:fixed;z-index:81;left:50%;top:calc(env(safe-area-inset-top,0px) + 12px);translate:-50% 0;width:min(380px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow-y:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:16px;background:rgba(10,13,16,.95);color:#fff;border:1px solid rgba(255,255,255,.14);box-shadow:0 20px 60px rgba(0,0,0,.5);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);opacity:0;transition:opacity .3s;font:400 13px/1.4 var(--sans,system-ui)}" +
      "@media (min-width:900px) and (hover:hover){.sss{top:50%;translate:-50% -50%}}" +
      ".sss.on{opacity:1}.sss[hidden],.sss-veil[hidden]{display:none}" +
      ".sss h2{display:flex;align-items:center;justify-content:space-between;margin:0;font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.18em;text-transform:uppercase}" +
      ".sss .x{width:32px;height:32px;margin:-6px -6px -6px 0;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font:16px/1 system-ui;cursor:pointer}" +
      ".sss p{margin:0;color:rgba(255,255,255,.75);font-size:12px}" +
      ".sss .row{display:flex;gap:8px;align-items:center}" +
      ".sss button.b{height:38px;padding:0 14px;border:0;border-radius:19px;background:rgba(255,255,255,.1);color:#fff;font:600 10px/1 var(--mono,monospace);letter-spacing:.16em;text-transform:uppercase;cursor:pointer;flex:none}" +
      ".sss button.go{background:#fff;color:#0b0f10}.sss button.b:disabled{opacity:.45;cursor:default}" +
      ".sss input{flex:1;min-width:0;height:38px;box-sizing:border-box;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:#fff;font:16px/1 var(--sans,system-ui);padding:0 12px}" +
      ".sss input.code{font:600 20px/1 var(--mono,monospace);letter-spacing:.3em;text-transform:uppercase;text-align:center}" +
      ".sss .big{font:600 34px/1 var(--mono,monospace);letter-spacing:.3em;text-align:center;padding:6px 0 2px}" +
      ".sss .seg{display:flex;border:1px solid rgba(255,255,255,.2);border-radius:12px;overflow:hidden}" +
      ".sss .seg button{flex:1;height:44px;border:0;background:none;color:rgba(255,255,255,.75);font:600 10px/1.2 var(--mono,monospace);letter-spacing:.14em;text-transform:uppercase;cursor:pointer}" +
      ".sss .seg button+button{border-left:1px solid rgba(255,255,255,.2)}.sss .seg button[aria-checked=true]{background:#fff;color:#0b0f10}" +
      ".sss .seg small{display:block;font:400 10px/1.2 var(--sans,system-ui);letter-spacing:0;text-transform:none;opacity:.7;margin-top:3px}" +
      ".sss .peers{display:flex;flex-wrap:wrap;gap:6px}.sss .peers span{padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.08);font-size:11px}" +
      ".sss .st{font:500 10px/1.3 var(--mono,monospace);letter-spacing:.06em;color:rgba(255,255,255,.55)}" +
      ".sss .ok{color:var(--acc,#55b8c9)}.sss .bad{color:#ff8a80}" +
      ".sss label.sw{display:flex;align-items:center;gap:10px;cursor:pointer}" +
      ".sss label.sw input{-webkit-appearance:none;appearance:none;flex:none;width:38px;height:22px;padding:0;border-radius:11px;border:0;background:rgba(255,255,255,.2);position:relative;cursor:pointer;transition:background .15s}" +
      ".sss label.sw input::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}" +
      ".sss label.sw input:checked{background:var(--acc,#55b8c9)}.sss label.sw input:checked::after{transform:translateX(16px)}" +
      ".sss a{color:inherit}";
    function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function ensure() {
      if (box) return;
      if (!document.getElementById("sss-css")) { var st = el("style"); st.id = "sss-css"; st.textContent = CSS; document.head.appendChild(st); }
      veil = el("div", "sss-veil"); box = el("div", "sss"); veil.hidden = box.hidden = true;
      box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Session");
      veil.onclick = close; box.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
      document.body.append(veil, box);
    }
    function statusLine() {
      var s = S.status === "live" ? '<span class="ok">connected</span>' : S.status === "refused" ? '<span class="bad">the relay refused the room</span>' : S.status === "connecting" ? "connecting…" : "";
      if (S.role === "follower") s += S.rtt == null ? " · finding the clock…" : " · clock within ±" + Math.max(1, Math.round(S.rtt / 2)) + " ms";
      return s;
    }
    function linkLine() {
      if (!S.link) return "";
      var L = S.linkSt;
      /* the helper, from here (Dimitry, 22 Oct: "exportable from session control center?"): our bridge file downloads
         directly; Carabiner (Deep Symmetry, GPL) comes from its own releases page, the current build for each system */
      if (!L || !L.up) return '<span class="bad">no Link helper on this laptop</span><br>Get it: <a href="https://sys.chamy.xyz/tools/linkbridge/linkbridge.mjs" download>the Link bridge</a> · <a href="https://github.com/Deep-Symmetry/carabiner/releases" target="_blank" rel="noopener">Carabiner</a> · <a href="https://sys.chamy.xyz/tools/linkbridge/" target="_blank" rel="noopener">how to start it</a>';
      return '<span class="ok">Link · ' + L.peers + " app" + (L.peers === 1 ? "" : "s") + " · " + L.bpm.toFixed(1) + " bpm</span>";
    }
    function render() {
      if (!box || box.hidden) return;
      var h = '<h2><span>Session</span><button type="button" class="x" aria-label="Close">✕</button></h2>';
      var peers = Object.keys(S.peers).map(function (k) { return S.peers[k]; });
      var pl = '<div class="peers">' + peers.map(function (p) { return "<span>" + esc(p.name || "laptop") + (p.role === "conductor" ? " · conducts" : "") + "</span>"; }).join("") + "</div>";
      var nameRow = '<div class="row"><input class="nm" maxlength="24" placeholder="this laptop’s name (Bass, Keys…)" value="' + esc(me.name) + '" aria-label="This laptop’s name"></div>';
      var linkRow = '<label class="sw"><input type="checkbox" class="lk"' + (S.link ? " checked" : "") + '><span>Ableton Link</span></label><p class="st">' + linkLine() + "</p>";
      if (!S.role) {
        var can = !O.canConduct || O.canConduct();
        h += "<p>Laptops in one room play in time. One conducts: its switch decides whether the others follow its tempo, or its tempo and its scenes.</p>" + nameRow +
          '<div class="row"><button type="button" class="b go host"' + (can ? "" : " disabled") + ">Start a session</button></div>" +
          (can ? "" : '<p class="st">Conducting comes with Pro. Joining is free.</p>') +
          '<div class="row"><input class="code jc" maxlength="4" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="CODE" aria-label="Session code"><button type="button" class="b join">Join</button></div>' +
          linkRow;
      } else if (S.role === "conductor") {
        var M = [["free", "Free", "each its own"], ["tempo", "Tempo", "my beat"], ["scenes", "Scenes", "beat + scenes"]];
        h += '<p>You conduct. On the other laptops: Session › Join</p><div class="big" aria-label="Session code">' + S.code + "</div>" +
          '<div class="seg" role="radiogroup" aria-label="What the others follow">' + M.map(function (x) { return '<button type="button" role="radio" data-m="' + x[0] + '" aria-checked="' + (S.mode === x[0]) + '">' + x[1] + "<small>" + x[2] + "</small></button>"; }).join("") + "</div>" +
          (peers.length ? pl : '<p class="st">nobody has joined yet</p>') + '<p class="st">' + statusLine() + "</p>" + linkRow + nameRow +
          '<div class="row"><button type="button" class="b end">End the session</button></div>';
      } else {
        var c = S.conductor ? esc(S.conductor.name) : "the conductor";
        var what = S.mode === "free" ? "not following (the conductor set Free)" : S.mode === "scenes" ? "following " + c + "’s beat and scenes" : "following " + c + "’s beat";
        h += '<div class="big">' + S.code + "</div><p>" + (S.following ? what : "stepped out: playing on your own") + '</p><p class="st">' + statusLine() + "</p>" + pl + nameRow +
          '<div class="row"><button type="button" class="b go fol">' + (S.following ? "Step out" : "Follow again") + '</button><button type="button" class="b end">Leave</button></div>';
      }
      box.innerHTML = h;
      var q = function (s) { return box.querySelector(s); };
      q(".x").onclick = close;
      var nm = q(".nm"); if (nm) nm.onchange = function () { me.name = nm.value.trim().slice(0, 24); lsSet("surface.session.name", me.name); send("hello", { role: S.role }); };
      var ho = q(".host"); if (ho) ho.onclick = function () { host(); };
      var jc = q(".jc"), jb = q(".join"); if (jb) { jb.onclick = function () { if (!join(jc.value)) { jc.focus(); } }; jc.addEventListener("keydown", function (e) { if (e.key === "Enter") jb.click(); }); }
      box.querySelectorAll(".seg button").forEach(function (b) { b.onclick = function () { setMode(b.dataset.m); }; });
      var fo = q(".fol"); if (fo) fo.onclick = function () { follow(!S.following); };
      var en = q(".end"); if (en) en.onclick = function () { leave(); };
      var lkb = q(".lk"); if (lkb) lkb.onchange = function () { setLink(lkb.checked); };
    }
    function open() { ensure(); box.hidden = veil.hidden = false; render(); requestAnimationFrame(function () { box.classList.add("on"); veil.classList.add("on"); }); }
    function close() { if (!box) return; box.classList.remove("on"); veil.classList.remove("on"); setTimeout(function () { box.hidden = veil.hidden = true; }, 300); }

    /* restore: Link stays as it was; ?session=CODE joins after the first tap (sound needs a touch to start) */
    if (lsGet("surface.session.link", "0") === "1") setLink(true);
    try {
      var qc = new URL(location.href).searchParams.get("session");
      if (qc) { var once = function () { window.removeEventListener("pointerup", once, true); if (!S.role) join(qc); }; window.addEventListener("pointerup", once, true); }
    } catch (e) {}
    window.addEventListener("pagehide", function () { if (tx) send("bye"); });

    return { open: open, close: close, host: host, join: join, leave: function () { leave(); }, setMode: setMode, follow: follow,
      setLink: setLink, sceneChanged: sceneChanged, state: state };
  }
  window.SurfaceSession = { mount: mount, transports: { supabase: supabase, local: local } };
})();
