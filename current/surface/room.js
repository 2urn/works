/* Surface · Room — play in time with other people over the internet, no MIDI (Dimitry, 22 Oct 2026: the Frost
   Electronic Music Ensemble, five performers, each on their own phone or laptop with their own sound out).

   One room per code. One LEADER: the leader's clock is the room's clock. Everyone else follows TIME (tempo and the
   phase of beat one) and, if they choose, the SCENE. Sound never travels: each performer keeps their own sources.

   Transport: Supabase Realtime BROADCAST + PRESENCE on the channel `<prefix><CODE>` (no table, nothing stored). The
   Phoenix websocket protocol is spoken directly (about 60 lines here), so no client library is loaded.

     const room = SurfaceRoom.join("K7QX", { name: "Ana", url: "wss://<ref>.supabase.co/realtime/v1/websocket", key: "<publishable key>", prefix: "current-room-" });
     room.on("tempo", e => …)   // { bpm, bar0, bpb, src }   bar0 = beat one of a bar, in LOCAL performance.now() ms
     room.on("scene", e => …)   // { scene, at, morph, part, n } at = when to land it, LOCAL performance.now() ms
     room.on("peers", list => …) // [{ id, name, color, lead, me, err, rtt }]
     room.on("state", s => …)   // "connecting" | "joined" | "reconnecting" | "offline" | "left"
     room.on("leader", e => …)  // { id, me }
     room.on("sync", e => …)    // { offset, err, rtt } (followers): the clock estimate after each pong
     room.on("hello", e => …)   // a peer arrived (the leader answers with its state: room.state(...))
     SurfaceRoom.join(code, { …, make: "take" })   // joins and takes the lead from whoever holds it
     SurfaceRoom.join(code, { …, noLead: true })   // never claims the lead when nobody leads: it waits for a leader
     room.on("touch", e => …)   // { id, part, name, path: [[x, y, ms], …], up } a player's finger, sent with SurfaceRoom.post
     SurfaceRoom.post(code, type, payload, {url, key, prefix, from})   // send without joining (REST broadcast) → Promise<bool>
     room.tempo({ bpm, bar0, bpb, src })     // leader: announce (bar0 local ms); re-sent by the tool as a heartbeat
     room.scene(scene, atLocalMs, { morph, part })   // leader: a scene change landing at a local time
     room.state({ to, tempo, scene })        // leader: everything at once, for a late joiner (lands at once)
     room.handover(peerId); room.leave(); room.isLeader(); room.now(); room.toLocal(roomMs); room.toRoom(localMs)
     SurfaceRoom.code()   // a fresh code: 6 letters/digits (crypto.getRandomValues) from an alphabet without 0/O, 1/I/L
     SurfaceRoom.link(onState)   // Ableton Link through the helper on this laptop (sys/tools/linkbridge, ws://127.0.0.1:17001)
                                 // onState({ up, peers, bpm, z }): z = Link's beat zero in this page's own clock (epoch ms)

   THE CLOCK. Every peer's own clock is performance.timeOrigin + performance.now() (ms). Room time is the leader's own
   clock. A follower estimates offset = leader − self by NTP-style ping/pong through the channel: offset = r − (s+c)/2
   (s: sent, r: leader's reply time, c: received). Sixteen samples are kept; the estimate is the median offset of the
   trips within 1.5x + 20 ms of the quickest (queues, jitter and a busy page only ever make a trip longer, so the
   quickest are the truest). err = their spread (median absolute deviation, at least 1 ms), or half the quickest trip
   while fewer than three agree: what "±18 ms" shows. Pings: six at start, quarter-second apart, then every 3 s.

   LEADER. Each peer's presence meta carries { id, name, color, joined, lead }. lead is an epoch: 0 follows, n>0
   claims the lead. The highest epoch leads (tie: the earliest joined). The maker claims epoch 1. A handover sends
   `lead` and the new leader claims epoch+1. When no one claims (the leader left, or has been silent 8 s), the
   earliest-joined peer still here claims max epoch+1, so the next joiner in line takes over.

   MESSAGES (broadcast event "m", JSON, every one { v: 1, t, f: senderId, to?: peerId }; times are ROOM ms):
     hello  { name, color }                         a peer arrived or came back; the leader answers with `state`
     tempo  { bpm, bar0, bpb, src, mode }           leader, on change and every 2 s (a heartbeat even with bpm null);
                                                    mode = what the leader lets the room follow (Current: free | tempo | scenes)
     scene  { scene, at, morph, part, n }           leader; at = when to land it (a quantized beat, ahead of now)
     state  { to, tempo, scene }                    leader → one late joiner: snap to now
     ping   { to, s }      pong { to, s, r, w }     clock estimate (followers ask the leader; r received, w answered)
     q      { err, rtt }                            everyone, every 3 s: still here (a follower adds its sync quality)
     lead   { next, epoch }                         handover, from the leader only (everyone hears who is next)
     bye    {}                                      leaving on purpose
   `scene` is the tool's own object (Current: { name } for a built-in scene, { look } for anything else).

   A BRIDGE (Ableton Link, Max, OSC) joins the same channel as just another peer: open the websocket, phx_join the
   topic "realtime:current-room-<CODE>", track presence { id, name: "Link", joined, lead }, answer `ping` with `pong`
   when leading, and send `tempo` from Link's tempo and beat phase (bar0 = the wall-clock ms of the last bar line,
   bpb = Link's quantum). As a follower it turns `tempo` back into Link's tempo and phase. Same messages, no change here.

   Test hook: localStorage "surface.room.url" points every room at another Realtime server (a local mock). */
(function () {
  "use strict";
  var ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  var COLORS = ["#ff4fb0", "#55b8c9", "#f2c14e", "#7bd389", "#b48cff", "#ff8a5b", "#5b8cff", "#e8e8e8"];
  /* codes and ids from crypto.getRandomValues only (31 symbols: 6 of them is 887 million rooms) */
  function rnd(n) { var s = "", a = new Uint32Array(n); crypto.getRandomValues(a); for (var i = 0; i < n; i++) s += ALPHA[a[i] % ALPHA.length]; return s; }
  function own() { return performance.timeOrigin + performance.now(); }
  function med(a) { var b = a.slice().sort(function (x, y) { return x - y; }), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
  function clean(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); }

  /* ABLETON LINK through the helper on this laptop (sys/tools/linkbridge: Carabiner + linkbridge.mjs). A browser cannot
     speak Link itself (UDP on the local network). Same client and protocol as session.js, which this module replaces. */
  function link(onState) {
    var ws = null, closed = false, wait = 1000, st = { up: false, peers: 0, bpm: null, z: null };
    function open() {
      if (closed) return;
      try { ws = new WebSocket("ws://127.0.0.1:17001"); } catch (e) { retry(); return; }
      ws.onmessage = function (e) {
        var m; try { m = JSON.parse(e.data); } catch (_) { return; }
        if (m.type !== "link" || !(m.bpm > 0) || !isFinite(m.beat) || !isFinite(m.at)) return;
        var lag = Date.now() - m.at, localAt = own() - lag;   // the helper stamps when it read the beat (same machine)
        st = { up: true, peers: m.peers | 0, bpm: +m.bpm, z: localAt - m.beat * 60000 / m.bpm, playing: !!m.playing };
        onState(st);
      };
      ws.onopen = function () { wait = 1000; };
      ws.onclose = function () { if (st.up) { st = { up: false, peers: 0, bpm: null, z: null }; onState(st); } retry(); };
      ws.onerror = function () {};
    }
    function retry() { if (!closed) setTimeout(open, wait); wait = Math.min(wait * 1.6, 6000); }
    open();
    return { state: function () { return st; }, bpm: function (b) { try { ws && ws.readyState === 1 && ws.send(JSON.stringify({ bpm: b })); } catch (e) {} },
      close: function () { closed = true; try { ws && ws.close(); } catch (e) {} } };
  }

  function join(code, o) {
    o = o || {};
    code = clean(code);
    var url = o.url, key = o.key || "";
    try { var u2 = localStorage.getItem("surface.room.url"); if (u2) url = u2; } catch (e) {}
    var topic = "realtime:" + (o.prefix || "room-") + code;
    var me = { id: o.id || rnd(8), name: String(o.name || "player").slice(0, 24), color: o.color || COLORS[(Math.random() * COLORS.length) | 0], joined: own(), lead: o.make ? 1 : 0 };
    var L = {}, peers = {}, ws = null, ref = 0, jref = "1", hb = 0, pingT = 0, qT = 0, settleT = 0, back = 1000, st = "connecting", left = false;
    var samples = [], offset = 0, err = null, rtt = null, leaderId = null, lastFromLeader = 0, stale = {};
    function emit(ev, d) { (L[ev] || []).forEach(function (f) { try { f(d); } catch (e) { console.warn("room " + ev, e); } }); }
    function setState(s) { if (st === s) return; st = s; emit("state", s); }
    function raw(m) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(m)); return true; } catch (e) {} } return false; }
    function send(t, p) { p = p || {}; p.v = 1; p.t = t; p.f = me.id; return raw({ topic: topic, event: "broadcast", payload: { type: "broadcast", event: "m", payload: p }, ref: String(++ref), join_ref: jref }); }
    function track() { raw({ topic: topic, event: "presence", payload: { type: "presence", event: "track", payload: me }, ref: String(++ref), join_ref: jref }); }
    function leading() { return leaderId === me.id; }

    /* WHO LEADS, PINNED (security review, 22 Oct): once a leader is known it stays the leader while it is here. Only
       its own handover moves the lead (a `lead` message FROM the leader, naming the next one), or its going: it left
       (presence), fell silent 8 s, or dropped its claim. Then the one it handed to, else the claimant with the highest
       epoch, else the earliest joined claims max epoch + 1. Tempo, scene and state are taken from the leader only. A
       leader that comes back to find a higher epoch (it was offline and the room moved on) steps down. */
    var handed = null, claimAt = 0, prevLeader = null;
    function list() { var a = [me]; for (var k in peers) if (k !== me.id && !stale[k]) a.push(peers[k]); return a; }
    /* a peer just handed the lead counts as leading for 6 s, before its own presence says so (messages can cross) */
    function promised(p) { return !!(p && p.promised && performance.now() - p.promised < 6000); }
    function here(id) { return id === me.id ? me.lead > 0 || promised(me) : !!(peers[id] && !stale[id] && (peers[id].lead > 0 || promised(peers[id]))); }
    function elect() {
      var a = list(), maxE = me.lead || 0, id = leaderId, top = null;
      for (var k in peers) maxE = Math.max(maxE, peers[k].lead || 0);
      a.forEach(function (p) { if ((p.lead || 0) > 0 && (!top || p.lead > top.lead || (p.lead === top.lead && p.joined < top.joined))) top = p; });
      if (handed && (handed.from === id || handed.from === prevLeader) && (handed.to === me.id || (peers[handed.to] && !stale[handed.to]))) id = handed.to;
      else if (id === me.id && top && top.id !== me.id && top.lead > me.lead) { me.lead = 0; track(); id = top.id; }   // the room moved on while I was away
      else if (!id || !here(id)) {
        id = top ? top.id : null;
        if (!id && st === "joined" && !settleT && !o.noLead) {   // o.noLead: a player who only ever follows (29 Oct: the ensemble, led by its screen)   // nobody leads: wait 1.5 s (a handover's claim may be on its way), then claim
          if (!claimAt) { claimAt = performance.now() + 1500; setTimeout(elect, 1600); }
          else if (performance.now() >= claimAt) {
            var first = a.slice().sort(function (x, y) { return x.joined - y.joined; })[0];
            if (first && first.id === me.id) { me.lead = maxE + 1; track(); id = me.id; }
          }
        }
      }
      if (id) claimAt = 0;
      if (id === me.id && me.lead <= 0) { me.lead = maxE + 1; track(); }
      handed = null;
      if (id !== leaderId) {
        if (leaderId) prevLeader = leaderId;
        leaderId = id; lastFromLeader = performance.now();
        lastTempo = null; usedOff = null;
        if (id === me.id) { offset = 0; err = 0; samples = []; }
        else { samples = []; err = null; if (id) burst(); }
        emit("leader", { id: id, me: id === me.id });
      }
      /* two people, one colour: the later joiner takes the first colour nobody here wears */
      var clash = list().some(function (p) { return p.id !== me.id && p.color === me.color && p.joined < me.joined; });
      if (clash) { var used = {}; list().forEach(function (p) { if (p.id !== me.id) used[p.color] = 1; }); for (var c = 0; c < COLORS.length; c++) if (!used[COLORS[c]]) { me.color = COLORS[c]; track(); break; } }
      emit("peers", peerList());
    }
    function peerList() { return list().map(function (p) { return { id: p.id, name: p.name, color: p.color, lead: p.id === leaderId, me: p.id === me.id, err: p.id === me.id ? err : p.err, rtt: p.id === me.id ? rtt : p.rtt }; }); }

    /* the clock */
    function ping() { if (leaderId && !leading()) send("ping", { to: leaderId, s: own() }); }
    function burst() { var n = 0; clearTimeout(pingT); (function go() { ping(); n++; pingT = setTimeout(go, n < 6 ? 250 : 3000); })(); }
    /* the estimate: only the trips close to the quickest count (within 1.5x + 20 ms: a busy page or a queue only ever
       makes a trip longer), their median offset. err is their spread, or half the quickest trip while fewer than three
       agree (the honest bound). Tempo waits for two good trips, and is re-placed when the estimate moves by 3 ms. */
    var lastTempo = null, usedOff = null;
    function pong(m, at) {
      /* four times, as NTP: s sent, r the leader got it, w the leader answered, c it came back. The receive times are
         the events' own time stamps, so a page busy drawing does not count its own delay as network */
      var c = at || own(), rr = m.r, w = m.w == null ? m.r : m.w, r = (c - m.s) - (w - rr); if (r < 0 || r > 8000) return;
      samples.push({ rtt: r, off: ((rr - m.s) + (w - c)) / 2 }); if (samples.length > 16) samples.shift();
      var minR = Math.min.apply(null, samples.map(function (x) { return x.rtt; }));
      var good = samples.filter(function (x) { return x.rtt <= minR * 1.5 + 20; }), offs = good.map(function (x) { return x.off; }), mo = med(offs);
      offset = mo; rtt = Math.round(minR);
      err = good.length >= 3 ? Math.max(1, Math.round(med(offs.map(function (x) { return Math.abs(x - mo); })))) : Math.max(1, Math.round(minR / 2));
      emit("sync", { offset: offset, err: err, rtt: rtt, n: samples.length, good: good.length });
      if (lastTempo && ready() && (usedOff == null || Math.abs(offset - usedOff) > 3)) tempoOut(lastTempo);
    }
    function ready() { if (leading()) return true; var minR = Math.min.apply(null, samples.map(function (y) { return y.rtt; })); return samples.length >= 2 && minR < 1500; }   // a page too busy to answer in 1.5 s has not found the clock yet
    function tempoOut(t) { lastTempo = t; if (!ready()) return; usedOff = offset; emit("tempo", { bpm: t.bpm, bar0: t.bar0 == null ? null : toLocal(t.bar0), bpb: t.bpb || 4, src: t.src, mode: t.mode, snap: t.snap }); }
    function now() { return own() + offset; }                                        // room ms
    function toLocal(roomMs) { return roomMs - offset - performance.timeOrigin; }   // → performance.now() ms
    function toRoom(localMs) { return localMs + performance.timeOrigin + offset; }

    function onMsg(m, at) {
      if (!m || m.v !== 1 || m.f === me.id) return;
      if (m.to && m.to !== me.id) return;
      var p = peers[m.f]; if (p) { p.seen = performance.now(); if (stale[m.f]) { delete stale[m.f]; elect(); } }
      if (m.f === leaderId) lastFromLeader = performance.now();
      switch (m.t) {
        case "ping": if (leading()) send("pong", { to: m.f, s: m.s, r: at || own(), w: own() }); break;
        case "pong": if (m.f === leaderId) pong(m, at); break;
        case "hello": if (leading()) emit("hello", { id: m.f, name: m.name }); break;
        case "q": if (p) { p.err = m.err; p.rtt = m.rtt; emit("peers", peerList()); } break;
        case "lead": if ((m.f === leaderId || m.f === prevLeader) && m.next) { if (peers[m.next]) peers[m.next].promised = performance.now(); if (m.next === me.id) me.promised = performance.now(); handed = { from: m.f, to: m.next }; if (p) p.lead = 0; if (m.next === me.id) { me.lead = Math.max(me.lead, m.epoch || 1); track(); } else if (peers[m.next]) peers[m.next].lead = Math.max(peers[m.next].lead || 0, m.epoch || 1); elect(); } break;
        case "tempo": if (m.f === leaderId) tempoOut({ bpm: m.bpm, bar0: m.bar0, bpb: m.bpb, src: m.src, mode: m.mode }); break;
        case "scene": if (m.f === leaderId) emit("scene", { scene: m.scene, at: toLocal(m.at), morph: m.morph, part: m.part, n: m.n }); break;
        case "state": if (m.f === leaderId) {
            if (m.tempo) tempoOut({ bpm: m.tempo.bpm, bar0: m.tempo.bar0, bpb: m.tempo.bpb, src: m.tempo.src, mode: m.tempo.mode, snap: true });
            if (m.scene) emit("scene", { scene: m.scene.scene, at: performance.now(), morph: 0, part: m.scene.part, n: m.scene.n, snap: true });
          } break;
        case "touch": emit("touch", { id: String(m.f).slice(0, 16), part: String(m.part || "").slice(0, 16), name: String(m.name || "").slice(0, 24), path: Array.isArray(m.path) ? m.path.slice(0, 24) : [], up: !!m.up }); break;   // a player's finger, posted (SurfaceRoom.post)
        case "bye": if (peers[m.f]) { delete peers[m.f]; elect(); } break;
      }
    }
    function presence(ev, pl) {
      function add(k, metas) { var x = metas && metas[metas.length - 1]; if (!x || !x.id) return; peers[x.id] = Object.assign(peers[x.id] || {}, x, { seen: performance.now() }); delete stale[x.id]; }
      if (ev === "presence_state") { var keep = {}; for (var k in pl) { add(k, pl[k].metas); var mm = pl[k].metas; if (mm && mm.length) keep[mm[mm.length - 1].id] = 1; } for (var q in peers) if (!keep[q] && q !== me.id) delete peers[q]; }
      else { var j = pl.joins || {}, lv = pl.leaves || {}; for (var a in lv) { var ms = lv[a].metas || []; ms.forEach(function (x) { if (x.id && !(j[a])) delete peers[x.id]; }); } for (var b in j) add(b, j[b].metas); }
      elect();
    }

    function connect() {
      if (left) return;
      setState(st === "joined" || st === "reconnecting" ? "reconnecting" : "connecting");
      try { ws = new WebSocket(url + (url.indexOf("?") < 0 ? "?" : "&") + "apikey=" + encodeURIComponent(key) + "&vsn=1.0.0"); } catch (e) { retry(); return; }
      var sock = ws;
      sock.onopen = function () {
        jref = String(++ref);
        raw({ topic: topic, event: "phx_join", payload: { config: { broadcast: { self: false, ack: false }, presence: { key: me.id, enabled: true }, postgres_changes: [], private: false } }, ref: jref, join_ref: jref });
        clearInterval(hb); hb = setInterval(function () { raw({ topic: "phoenix", event: "heartbeat", payload: {}, ref: String(++ref) }); }, 25000);
      };
      sock.onmessage = function (e) {
        var m; try { m = JSON.parse(e.data); } catch (x) { return; }
        if (m.topic !== topic) return;
        if (m.event === "phx_reply" && m.ref === jref) {
          if (m.payload && m.payload.status === "ok") {
            back = 1000; track(); setState("joined");
            clearTimeout(settleT); settleT = setTimeout(function () { settleT = 0;
              /* make: "take" (29 Oct, the ensemble's screen): once it has seen who is here, claim an epoch above every one,
                 so a sitting leader steps down on every peer (the "room moved on" rule in elect) */
              if (o.make === "take" && !leading()) { var mx = me.lead || 0; for (var k in peers) mx = Math.max(mx, peers[k].lead || 0); me.lead = mx + 1; track(); }
              elect(); }, 1400);   // wait for who is here before claiming the lead
            send("hello", { name: me.name, color: me.color });
            if (leaderId && !leading()) burst();
          } else { try { sock.close(); } catch (x) {} }
        } else if (m.event === "broadcast" && m.payload && m.payload.event === "m") onMsg(m.payload.payload, e.timeStamp > 0 && e.timeStamp < 1e12 ? performance.timeOrigin + e.timeStamp : 0);
        else if (m.event === "presence_state" || m.event === "presence_diff") presence(m.event, m.payload || {});
        else if (m.event === "phx_error" || m.event === "phx_close") { try { sock.close(); } catch (x) {} }
      };
      sock.onclose = function () { if (sock !== ws) return; clearInterval(hb); if (!left) retry(); };
      sock.onerror = function () {};
    }
    function retry() { if (left) return; setState(navigator.onLine === false ? "offline" : "reconnecting"); clearTimeout(retry.t); retry.t = setTimeout(connect, back); back = Math.min(8000, back * 2); }
    function onOff() { if (left) return; try { ws && ws.close(); } catch (e) {} setState("offline"); }
    function onOn() { if (left) return; back = 500; clearTimeout(retry.t); try { if (ws && ws.readyState === 1) return; } catch (e) {} connect(); }
    addEventListener("offline", onOff); addEventListener("online", onOn);
    /* the leader gone quiet (a closed lid, a dead phone): presence can take a while to notice, so after 8 s without a
       word it no longer counts, and the line moves on */
    var watch = setInterval(function () {
      if (st !== "joined") return;
      var t = performance.now(), ch = false;
      for (var k in peers) if (k !== me.id && !stale[k] && t - (peers[k].seen || 0) > 12000) { stale[k] = 1; ch = true; }
      if (leaderId && !leading() && t - lastFromLeader > 8000) { stale[leaderId] = 1; ch = true; }
      if (ch) elect();
    }, 1000);
    /* everyone says "still here" every 3 s (a follower with its sync quality), so a silent peer can be told from a quiet one */
    qT = setInterval(function () { if (st === "joined") send("q", leading() ? { err: 0, rtt: 0 } : { err: err, rtt: rtt }); }, 3000);
    connect();

    var room = {
      code: code, me: me,
      on: function (ev, f) { (L[ev] = L[ev] || []).push(f); return room; },
      off: function (ev, f) { L[ev] = (L[ev] || []).filter(function (g) { return g !== f; }); return room; },
      isLeader: leading, leader: function () { return leaderId; }, peers: peerList, state: function (x) {
        if (x === undefined) return st;
        if (!leading()) return false;
        return send("state", { to: x.to, tempo: x.tempo ? { bpm: x.tempo.bpm, bar0: x.tempo.bar0 == null ? null : toRoom(x.tempo.bar0), bpb: x.tempo.bpb || 4, src: x.tempo.src, mode: x.tempo.mode } : null, scene: x.scene || null });
      },
      sync: function () { return { offset: offset, err: err, rtt: rtt, n: samples.length }; },
      now: now, toLocal: toLocal, toRoom: toRoom,
      tempo: function (t) { if (!leading()) return false; return send("tempo", { bpm: t.bpm || null, bar0: t.bar0 == null ? null : toRoom(t.bar0), bpb: t.bpb || 4, src: t.src || "", mode: t.mode }); },
      scene: function (scene, atLocal, x) { if (!leading()) return false; x = x || {}; room._n = (room._n || 0) + 1; return send("scene", { scene: scene, at: toRoom(atLocal), morph: x.morph, part: x.part, n: room._n }); },
      handover: function (id) { if (!leading() || !peers[id] || stale[id]) return false; var e = Math.max(me.lead, peers[id].lead || 0) + 1; send("lead", { next: id, epoch: e }); peers[id].lead = e; peers[id].promised = performance.now(); handed = { from: me.id, to: id }; me.lead = 0; track(); elect(); return true; },
      rename: function (n) { me.name = String(n || "player").slice(0, 24); track(); emit("peers", peerList()); },
      send: send,
      leave: function () {
        if (left) return; send("bye", {}); left = true;
        clearInterval(hb); clearInterval(watch); clearInterval(qT); clearTimeout(pingT); clearTimeout(settleT); clearTimeout(retry.t);
        removeEventListener("offline", onOff); removeEventListener("online", onOn);
        var s = ws; ws = null; setTimeout(function () { try { s && s.close(); } catch (e) {} }, 60);
        setState("left");
      }
    };
    return room;
  }
  /* POST WITHOUT JOINING (29 Oct 2026, one screen that shows every player's finger): a message sent to a room over
     Realtime's REST broadcast (POST /realtime/v1/api/broadcast), so the sender is not subscribed and is not sent
     everyone else's. Realtime counts every message sent and every one delivered against the project's quota (Free: 100
     a second), so fingers go to a room of their own that only the screen joins. o: {url (the wss:// or https://
     address), key, prefix, from}. → a promise of true (sent) or false. */
  function post(code, t, payload, o) {
    o = o || {}; var base = String(o.url || "").replace(/^wss:/, "https:").replace(/\/realtime\/v1\/websocket.*$/, "");
    var p = Object.assign({}, payload || {}, { v: 1, t: t, f: o.from || "post" });
    if (!base || typeof fetch !== "function") return Promise.resolve(false);
    var body = JSON.stringify({ messages: [{ topic: (o.prefix || "room-") + clean(code), event: "m", payload: p, private: false }] });
    function go(bearer) { var h = { "Content-Type": "application/json", apikey: o.key || "" }; if (bearer) h.Authorization = "Bearer " + (o.key || "");
      return fetch(base + "/realtime/v1/api/broadcast", { method: "POST", headers: h, body: body }); }
    /* the gateway takes the key as apikey; if one is refused, the same post goes once more with the key as a bearer too,
       and the bearer is kept only once it has worked (review 61235c2e48 r-3) */
    return go(post.bearer).then(function (r) {
      if (r.ok) return true;
      if (r.status === 401 || r.status === 403) return go(!post.bearer).then(function (q) { if (q.ok) post.bearer = !post.bearer; return q.ok; }, function () { return false; });
      return false;
    }, function () { return false; });
  }
  window.SurfaceRoom = { join: join, post: post, code: function (n) { return rnd(Math.max(6, n || 6)); }, link: link, clean: clean, COLORS: COLORS, version: "1.0.0" };
})();
