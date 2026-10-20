/* Surface · Float — panels that leave their place (Dimitry, 19–20 Oct 2026). Two things, one module:

   1. FLOATING POPOVERS, on desktop and iPad (a window at least 700px wide; on a phone the popovers stay sheets).
      A popover gets a grip at the left of its head and a pin beside its close button.
        - DRAG by the grip, or by any empty part of the head. Let go near a window edge (within 32px) and it snaps there,
          magnetically, on the tool's gutter; it stays anchored to that edge when the window is resized.
        - PIN keeps it open: taps on the stage, the bar or another popover no longer close it. Its own close button,
          the button that opened it, and Escape still do. The pin is remembered per popover.
        - Double-tap the grip (or the head's empty space) to send it home, where the tool places it.
      Where it was put, and whether it is pinned, are kept on this device.
   2. POP OUT a pane (desktop): the pane moves into its own window, which stays on top where the browser can
      (Document Picture-in-Picture, Chrome and Edge 116+); elsewhere an ordinary window. It stays live: every control
      in it still drives the tool. Closing the window, or opening the pane from the tool, brings it home.

   Plain script, window.SurfaceFloat, no dependencies.
     SurfaceFloat.attach(el, {
       key: 'current.plist',            // where its place and pin are kept (localStorage 'surface.float.<key>')
       head: '.mxh',                    // the head: grip, drag and pin live here (default: the first child)
       close: () => closePlist(),       // the tool's own close, called by Escape
       owner: '#pTrans',                // taps here may still close it while pinned (the button that opens it)
       closers: ['closePlist'],         // the tool's global close functions: wrapped so a pinned popover ignores
                                        //   closes that come from a tap somewhere else
       gut: 16                          // the margin it snaps to
     })
     SurfaceFloat.popout(el, {title, width, onOut, onHome, sync: [html attributes to mirror]}) → Promise<bool>
     SurfaceFloat.home()  ·  SurfaceFloat.popped  ·  SurfaceFloat.canPopout()
   While a pane is out, document.getElementById / querySelector / querySelectorAll also look in its window, so a
   tool's code that finds its controls by id keeps working. */
(function () {
  "use strict";
  if (window.SurfaceFloat) return;
  var CSS = [
    ".sf-on>.sf-head{touch-action:none;cursor:grab;justify-content:flex-start!important;gap:2px}",
    ".sf-on.sf-drag>.sf-head{cursor:grabbing}",
    ".sf-grip,.sf-pin{flex:none;width:32px;height:32px;display:none;place-items:center;padding:0;border:0;background:none;color:var(--ui-dim,#8a9396);cursor:inherit;-webkit-tap-highlight-color:transparent}",
    ".sf-on .sf-grip,.sf-on .sf-pin{display:grid}",
    ".sf-pin{cursor:pointer;margin-left:auto}",
    ".sf-grip{margin:0 2px 0 -6px}",
    ".sf-grip svg{width:14px;height:14px;fill:currentColor}",
    ".sf-pin svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
    ".sf-pin:hover,.sf-grip:hover{color:var(--ui-ink,#fff)}",
    ".sf-pin[aria-pressed=true]{color:var(--accent,#55b8c9)}",
    ".sf-pin[aria-pressed=true] svg{fill:currentColor}",
    ".sf-pin:focus-visible,.sf-grip:focus-visible{outline:2px solid var(--accent,#55b8c9);outline-offset:1px;border-radius:8px}",
    ".sf-free{transition:box-shadow .2s ease}",
    ".sf-drag{box-shadow:0 18px 50px rgba(0,0,0,.45)!important;transition:none!important}",
    ".sf-pinned{box-shadow:0 0 0 1px color-mix(in srgb,var(--accent,#55b8c9) 55%,transparent),0 12px 34px rgba(0,0,0,.3)}",
    ".sf-ghost{position:fixed;z-index:9998;pointer-events:none;border:1.5px dashed var(--accent,#55b8c9);border-radius:16px;opacity:0;transition:opacity .12s}",
    ".sf-ghost.on{opacity:.8}",
    "@media (prefers-reduced-motion:reduce){.sf-free{transition:none}}"
  ].join("\n");
  var GRIP = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="5.5" cy="3.5" r="1.4"/><circle cx="10.5" cy="3.5" r="1.4"/><circle cx="5.5" cy="8" r="1.4"/><circle cx="10.5" cy="8" r="1.4"/><circle cx="5.5" cy="12.5" r="1.4"/><circle cx="10.5" cy="12.5" r="1.4"/></svg>';
  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 3.5h6l-1 6 3.5 3.5h-11L10 9.5z"/><path d="M12 13v7.5"/></svg>';
  var WIDE = "(min-width:700px)";
  function css() { if (document.getElementById("sf-css")) return; var s = document.createElement("style"); s.id = "sf-css"; s.textContent = CSS; document.head.appendChild(s); }
  function load(k) { try { return JSON.parse(localStorage.getItem("surface.float." + k)) || {}; } catch (e) { return {}; } }
  function save(k, v) { try { localStorage.setItem("surface.float." + k, JSON.stringify(v)); } catch (e) {} }
  var wide = function () { try { return matchMedia(WIDE).matches; } catch (e) { return true; } };

  /* the last thing the person did: a tap (and where) or a key. A pinned popover ignores a close that follows a tap
     somewhere else; a close that follows a key (Escape), a tap inside it or on its owner, or nothing at all, goes through */
  var last = { t: 0, target: null, key: false };
  addEventListener("pointerdown", function (e) { last = { t: performance.now(), target: e.target, key: false }; }, true);
  addEventListener("keydown", function () { last = { t: performance.now(), target: null, key: true }; }, true);
  var FLOATS = [], topZ = 40;

  function attach(el, o) {
    if (typeof el === "string") el = document.querySelector(el);
    if (!el || el.__sf) return null;
    css(); o = o || {};
    var key = o.key || el.id || "float", gut = o.gut == null ? 16 : o.gut;
    var head = typeof o.head === "string" ? el.querySelector(o.head) : (o.head || el.firstElementChild);
    if (!head) return null;
    var st = load(key), F = { el: el, o: o };
    el.__sf = F; FLOATS.push(F);
    head.classList.add("sf-head");
    var grip = document.createElement("button"); grip.type = "button"; grip.className = "sf-grip"; grip.innerHTML = GRIP;
    grip.setAttribute("aria-label", "Move this panel. Drag it anywhere; near an edge it snaps there. Double-tap to send it back");
    grip.title = "Drag to move · double-tap to send back";
    var pin = document.createElement("button"); pin.type = "button"; pin.className = "sf-pin"; pin.innerHTML = PIN;
    head.insertBefore(grip, head.firstChild);
    var x = head.querySelector(":scope>.tb,:scope>button[aria-label^='Close']");
    head.insertBefore(pin, x || null);

    function on() { return wide(); }
    function lead() { if (head.firstChild !== grip) head.insertBefore(grip, head.firstChild); }   // the tool may add its own icon first, later
    function syncPin() {
      lead();
      var p = !!st.pin && on();
      pin.setAttribute("aria-pressed", String(!!st.pin));
      pin.setAttribute("aria-label", st.pin ? "Pinned: it stays open while you work elsewhere. Tap to unpin" : "Pin: keep it open while you work elsewhere");
      pin.title = st.pin ? "Pinned · tap to unpin" : "Pin open";
      el.classList.toggle("sf-pinned", p); el.classList.toggle("sf-on", on());
    }
    pin.addEventListener("click", function (e) { e.stopPropagation(); st.pin = !st.pin; save(key, st); syncPin(); });

    /* placement: free (x, y) with an optional anchor to an edge per axis: ax 'l' | 'r', ay 't' | 'b' */
    var PROPS = ["left", "top", "right", "bottom", "transform", "translate"];
    function clear() { PROPS.forEach(function (p) { el.style.removeProperty(p); }); el.classList.remove("sf-free"); }
    function place() {
      if (!on() || st.x == null || el.hidden) { if (!on() || st.x == null) clear(); return; }
      var w = el.offsetWidth, h = el.offsetHeight, W = innerWidth, H = innerHeight;
      var X = st.ax === "l" ? gut : st.ax === "r" ? W - w - gut : st.x * W;
      var Y = st.ay === "t" ? gut : st.ay === "b" ? H - h - gut : st.y * H;
      X = Math.max(gut / 2, Math.min(W - w - gut / 2, X)); Y = Math.max(gut / 2, Math.min(H - Math.min(h, 80) - gut / 2, Y));
      el.classList.add("sf-free");
      el.style.setProperty("left", X + "px", "important"); el.style.setProperty("top", Y + "px", "important");
      el.style.setProperty("right", "auto", "important"); el.style.setProperty("bottom", "auto", "important");
      el.style.setProperty("transform", "none", "important"); el.style.setProperty("translate", "none", "important");
    }
    function home() { delete st.x; delete st.y; delete st.ax; delete st.ay; save(key, st); clear(); }
    function raise() { el.style.zIndex = String(++topZ); }

    /* drag */
    var ghost = null, lastTap = 0;
    function snapOf(X, Y, w, h) {
      var W = innerWidth, H = innerHeight, M = 32;
      return { ax: X < M ? "l" : X + w > W - M ? "r" : null, ay: Y < M ? "t" : Y + h > H - M ? "b" : null };
    }
    function down(e) {
      if (!on() || e.button > 0) return;
      if (e.target !== grip && !grip.contains(e.target) && e.target.closest("button,a,input,select,textarea,[role=tab],[role=tablist],[contenteditable]")) return;
      var now = performance.now();
      if (now - lastTap < 380) { lastTap = 0; home(); e.preventDefault(); return; }
      lastTap = now;
      e.preventDefault(); raise();
      var r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top, moved = false, X = r.left, Y = r.top;
      try { head.setPointerCapture(e.pointerId); } catch (_) {}
      if (!ghost) { ghost = document.createElement("div"); ghost.className = "sf-ghost"; document.body.appendChild(ghost); }
      function mv(ev) {
        X = ev.clientX - dx; Y = ev.clientY - dy;
        if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return;
        if (!moved) { moved = true; el.classList.add("sf-drag", "sf-free"); }
        var w = el.offsetWidth, h = el.offsetHeight;
        X = Math.max(0, Math.min(innerWidth - w, X)); Y = Math.max(0, Math.min(innerHeight - 40, Y));
        el.style.setProperty("left", X + "px", "important"); el.style.setProperty("top", Y + "px", "important");
        el.style.setProperty("right", "auto", "important"); el.style.setProperty("bottom", "auto", "important");
        el.style.setProperty("transform", "none", "important"); el.style.setProperty("translate", "none", "important");
        var s = snapOf(X, Y, w, h);
        if (s.ax || s.ay) {
          var gx = s.ax === "l" ? gut : s.ax === "r" ? innerWidth - w - gut : X, gy = s.ay === "t" ? gut : s.ay === "b" ? innerHeight - h - gut : Y;
          ghost.style.cssText = "left:" + gx + "px;top:" + gy + "px;width:" + w + "px;height:" + h + "px"; ghost.classList.add("on");
        } else ghost.classList.remove("on");
      }
      function up() {
        head.removeEventListener("pointermove", mv); head.removeEventListener("pointerup", up); head.removeEventListener("pointercancel", up);
        el.classList.remove("sf-drag"); if (ghost) ghost.classList.remove("on");
        if (!moved) return;
        lastTap = 0;
        var s = snapOf(X, Y, el.offsetWidth, el.offsetHeight);
        st.x = X / innerWidth; st.y = Y / innerHeight; st.ax = s.ax; st.ay = s.ay; save(key, st); place();
      }
      head.addEventListener("pointermove", mv); head.addEventListener("pointerup", up); head.addEventListener("pointercancel", up);
    }
    head.addEventListener("pointerdown", down);
    grip.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 40 : 10, r = el.getBoundingClientRect(), X = r.left, Y = r.top;
      if (e.key === "ArrowLeft") X -= step; else if (e.key === "ArrowRight") X += step; else if (e.key === "ArrowUp") Y -= step; else if (e.key === "ArrowDown") Y += step;
      else if (e.key === "Home") { home(); return; } else return;
      e.preventDefault(); st.x = X / innerWidth; st.y = Y / innerHeight; st.ax = st.ay = null; save(key, st); place();
    });
    el.addEventListener("pointerdown", raise);
    el.addEventListener("keydown", function (e) { if (e.key === "Escape" && o.close && !el.hidden) { e.stopPropagation(); o.close(); } });

    /* follow the tool opening and closing it, and the window changing size */
    new MutationObserver(function () { if (!el.hidden) { lead(); place(); raise(); } }).observe(el, { attributes: true, attributeFilter: ["hidden"] });
    addEventListener("resize", place);
    try { matchMedia(WIDE).addEventListener("change", function () { place(); syncPin(); }); } catch (_) {}

    /* the tool's closers: a pinned popover ignores a close that came from a tap elsewhere */
    F.blocks = function () {
      if (!st.pin || !on() || el.hidden) return false;
      if (last.key || !last.target || performance.now() - last.t > 1500) return false;
      if (el.contains(last.target)) return false;
      if (o.owner && last.target.closest && last.target.closest(o.owner)) return false;
      return true;
    };
    (o.closers || []).forEach(function (name) {
      var f = window[name]; if (typeof f !== "function" || f.__sfWrapped) return;
      var w = function () { for (var i = 0; i < FLOATS.length; i++) if (FLOATS[i].closes === name && FLOATS[i].blocks()) return; return f.apply(this, arguments); };
      w.__sfWrapped = true; window[name] = w;
    });
    F.closes = (o.closers || [])[0];
    syncPin(); place();
    F.home = home; F.place = place;
    return F;
  }

  /* ---------- 2. pop out ---------- */
  var P = null;   // { el, mark, win, mo, restore }
  function hasPiP() { try { return !!(window.documentPictureInPicture && documentPictureInPicture.requestWindow) && window.top === window; } catch (_) { return false; } }
  function canPopout() {
    try { if (!matchMedia("(min-width:900px) and (hover:hover) and (pointer:fine)").matches) return false; } catch (_) { return false; }
    return hasPiP() || typeof window.open === "function";
  }
  function patchFind(doc) {
    var D = document, gi = D.getElementById, qs = D.querySelector, qsa = D.querySelectorAll;
    D.getElementById = function (id) { return gi.call(D, id) || (P && P.win && !P.win.closed ? doc.getElementById(id) : null); };
    D.querySelector = function (s) { var r = qs.call(D, s); if (r || !P || !P.win || P.win.closed) return r; try { return doc.querySelector(s); } catch (_) { return null; } };
    D.querySelectorAll = function (s) {
      var a = qsa.call(D, s); if (!P || !P.win || P.win.closed) return a;
      var b; try { b = doc.querySelectorAll(s); } catch (_) { return a; }
      if (!b.length) return a; return Array.prototype.slice.call(a).concat(Array.prototype.slice.call(b));
    };
    return function () { D.getElementById = gi; D.querySelector = qs; D.querySelectorAll = qsa; };
  }
  function copyStyles(doc) {
    var head = doc.head;
    document.querySelectorAll("link[rel=stylesheet],style").forEach(function (n) {
      if (n.tagName === "LINK") { var l = doc.createElement("link"); l.rel = "stylesheet"; l.href = n.href; head.appendChild(l); }
      else { var s = doc.createElement("style"); s.textContent = n.textContent; head.appendChild(s); }
    });
  }
  function popout(el, o) {
    o = o || {};
    if (typeof el === "string") el = document.querySelector(el);
    if (!el) return Promise.resolve(false);
    if (P) { try { P.win.focus(); } catch (_) {} return Promise.resolve(true); }
    var W = o.width || 400, H = Math.min(o.height || 900, (screen.availHeight || 900) - 60);
    var open = hasPiP()
      ? documentPictureInPicture.requestWindow({ width: W, height: H }).catch(function () { return null; })
      : Promise.resolve(window.open("", "sf-pop-" + (el.id || "pane"), "popup,width=" + W + ",height=" + H));
    return open.then(function (win) {
      if (!win) return false;
      var doc = win.document;
      if (!doc.body) { doc.open(); doc.write("<!doctype html><html><head><meta charset=utf-8></head><body></body></html>"); doc.close(); }
      doc.title = o.title || document.title;
      copyStyles(doc);
      var ov = doc.createElement("style");
      ov.textContent = "html,body{margin:0;height:100%;background:var(--panel,#111)}body{overflow:hidden}" +
        (el.id ? "#" + el.id : ".sf-out") + "{position:static!important;inset:auto!important;transform:none!important;translate:none!important;visibility:visible!important;opacity:1!important;" +
        "width:auto!important;max-width:none!important;height:100vh!important;max-height:none!important;box-sizing:border-box;box-shadow:none!important;border:0!important;background:var(--panel,#111)!important;" +
        "-webkit-backdrop-filter:none!important;backdrop-filter:none!important;padding-top:16px!important;scroll-padding-top:16px!important}" +
        ".sfs-bar button[data-name='pop out']{display:none!important}" + (o.css || "");
      doc.head.appendChild(ov);
      var H0 = document.documentElement, sync = function () {
        for (var i = 0; i < H0.attributes.length; i++) { var a = H0.attributes[i]; if (a.name === "class" || a.name.indexOf("data-") === 0 || a.name === "lang") doc.documentElement.setAttribute(a.name, a.value); }
        doc.documentElement.classList.add("sf-popwin");
      };
      sync();
      var mo = new MutationObserver(sync); mo.observe(H0, { attributes: true });
      var mark = document.createComment("sf-home"); el.parentNode.insertBefore(mark, el);
      el.classList.add("sf-out");
      doc.body.appendChild(el);
      P = { el: el, mark: mark, win: win, mo: mo, o: o, restore: patchFind(doc) };
      H0.classList.add("sf-popped");
      win.addEventListener("pagehide", function () { home(); });
      if (o.onOut) try { o.onOut(win); } catch (e) { console.warn("popout", e); }
      return true;
    });
  }
  function home() {
    if (!P) return false;
    var p = P; P = null;
    try { p.mark.parentNode.insertBefore(p.el, p.mark); p.mark.remove(); } catch (e) { console.warn("pop home", e); }
    p.el.classList.remove("sf-out");
    try { p.mo.disconnect(); } catch (_) {}
    try { p.restore(); } catch (_) {}
    document.documentElement.classList.remove("sf-popped");
    try { if (!p.win.closed) p.win.close(); } catch (_) {}
    if (p.o.onHome) try { p.o.onHome(); } catch (e) { console.warn("pop home", e); }
    return true;
  }

  window.SurfaceFloat = { attach: attach, popout: popout, home: home, canPopout: canPopout, get popped() { return !!P; }, all: FLOATS };
})();
