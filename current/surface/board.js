/* Surface · Board — a performance board (Dimitry, 22 Oct 2026: "the computer screen [should] mimic the output … anchors
   itself to the top of the screen … the panels stay open unless they are closed … unless another panel replaces them
   … most of the things you would want to control during a performance … visible all at once … saved and memorized";
   then: "the stage is a top right or top left corner … a longer strip below it"; the strip: "pinned single controls,
   customizable like iOS edit home screen mode").

   While the board is on:
     - the STAGE takes the output's shape (or 16:9) in a top corner, left or right;
     - beside it, a column of SLOTS: each panel the tool opens takes a slot and stays there; a click elsewhere, or
       opening another panel, no longer closes it. Its own close, its own bar button and Esc still do. When every
       slot is full, a newly opened panel replaces the one opened longest ago;
     - under the stage, the STRIP: pinned single controls (buttons that run named actions, and sliders). Hold one, or
       tap the pencil, to edit it the way an iPhone home screen is edited: everything jiggles, drag to reorder, × takes
       one off, + adds from the list, Done keeps it;
     - BOARDS are saved by name on this device: side, shape, the pins and the panels that were open. The tool ships
       a few; "Save board" adds yours;
     - Performing is held (kit perform.js): nothing reloads, the screen stays awake.
   The bar and the shelf under it never move. Below 900 × 560 (a phone, a small window) the board does not open.

     var B = SurfaceBoard.mount({
       tool: 'current',
       stage: '#stage',                       // the element the stage lives in; its box is moved and sized
       aspect: function () { return 16 / 9; },  // the stage's shape (the output window's, when one is open)
       bottom: function () { return px; },      // where the bar's room starts (the top of the bar)
       left: function () { return px; },        // a drawer beside, if any
       catalog: function () { return [          // what can be pinned
         { id, label, group, kind: 'action', run: function () {} },
         { id, label, group, kind: 'range', min, max, step, get: function () {}, set: function (v) {}, fmt: function (v) {} } ] },
       panels: { plist: { el: '#plist', open: fn, close: fn, owners: '#pAuto,#pNext' }, ... },
       boards: [ { name: 'Color', side: 'left', pins: [...], panels: ['colorPop'] }, ... ],
       onChange: function (on) {}
     });
     B.on() · B.set(on) · B.toggle() · B.side('left'|'right') · B.relayout() · B.load(name) · B.save(name) · B.list()
     B.mayClose(panelElement) → false while the board keeps that panel (call it at the top of the tool's close function)
   Plain script, window.SurfaceBoard, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceBoard) return;
  var CSS = [
    "html.sb-on {stage}{position:fixed!important;left:var(--sb-sx)!important;top:var(--sb-sy)!important;width:var(--sb-sw)!important;height:var(--sb-sh)!important;right:auto!important;bottom:auto!important;inset:auto;border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px rgb(var(--ui-hi,255 255 255) / .14);transition:none!important}",
    "html.sb-on [data-sb-slot]{position:fixed!important;left:var(--sb-x)!important;top:var(--sb-y)!important;width:var(--sb-w)!important;height:var(--sb-h)!important;max-width:none!important;max-height:none!important;right:auto!important;bottom:auto!important;transform:none!important;translate:none!important;margin:0!important;box-sizing:border-box}",
    ".sb-strip{position:fixed;z-index:8;display:flex;align-items:stretch;gap:8px;box-sizing:border-box;padding:6px;border-radius:14px;background:rgb(var(--ui-g,14 14 16) / .72);border:1px solid rgb(var(--ui-hi,255 255 255) / .14);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);color:var(--ui-ink,#fff);overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-x}",
    ".sb-strip::-webkit-scrollbar{display:none}.sb-strip[hidden]{display:none}",
    ".sb-it{position:relative;flex:none;min-width:64px;display:grid;place-items:center;align-content:center;gap:4px;padding:6px 10px;border-radius:10px;border:1px solid rgb(var(--ui-hi,255 255 255) / .18);background:rgb(var(--ui-hi,255 255 255) / .05);color:inherit;cursor:pointer;font:600 9.5px/1.15 var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.1em;text-transform:uppercase;text-align:center;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}",
    ".sb-it:active{transform:scale(.97)}.sb-it svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}",
    ".sb-it.sb-rg{min-width:150px;grid-template-columns:1fr auto;align-items:center;justify-items:start;cursor:default}.sb-rg .sb-v{justify-self:end;color:var(--acc,#55b8c9);letter-spacing:.04em}",
    ".sb-rg input{grid-column:1/-1;width:100%;margin:0;accent-color:var(--acc,#55b8c9)}",
    ".sb-tool{flex:none;width:44px;display:grid;place-items:center;border:0;border-radius:10px;background:none;color:var(--ui-dim,#9aa3a6);cursor:pointer}.sb-tool:hover{color:var(--ui-ink,#fff)}.sb-tool svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}",
    ".sb-empty{align-self:center;padding:0 10px;font:400 12.5px/1.35 var(--sans,system-ui,sans-serif);color:var(--ui-dim,#9aa3a6)}",
    ".sb-strip.sb-ed .sb-it{animation:sbJig .26s ease-in-out infinite alternate;cursor:grab}.sb-strip.sb-ed .sb-it:nth-child(2n){animation-delay:-.13s}",
    ".sb-strip.sb-ed .sb-it.sb-drag{animation:none;opacity:.85;z-index:2;cursor:grabbing;box-shadow:0 6px 18px rgb(0 0 0 / .4)}",
    "@keyframes sbJig{from{transform:rotate(-1.2deg)}to{transform:rotate(1.2deg)}}",
    "@media (prefers-reduced-motion:reduce){.sb-strip.sb-ed .sb-it{animation:none;outline:1px dashed rgb(var(--ui-hi,255 255 255) / .4)}}",
    ".sb-x{display:none;position:absolute;top:-7px;left:-7px;width:22px;height:22px;padding:0;border-radius:50%;border:0;background:var(--ui-ink,#fff);color:rgb(var(--ui-g,14 14 16));cursor:pointer;z-index:3;place-items:center}.sb-x svg{width:12px;height:12px;stroke-width:2.6}",
    ".sb-strip.sb-ed .sb-x{display:grid}.sb-strip.sb-ed .sb-rg input{pointer-events:none}",
    ".sb-add{flex:none;min-width:64px;display:none;place-items:center;border-radius:10px;border:1px dashed rgb(var(--ui-hi,255 255 255) / .4);background:none;color:inherit;cursor:pointer;font:600 9.5px/1 var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.1em;text-transform:uppercase}.sb-strip.sb-ed .sb-add{display:grid}",
    ".sb-done{display:none;flex:none;align-self:center;height:34px;padding:0 14px;border-radius:17px;border:0;background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c);font:600 10px/1 var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.14em;text-transform:uppercase;cursor:pointer}.sb-strip.sb-ed .sb-done{display:block}.sb-strip.sb-ed .sb-pen{display:none}",
    ".sb-pick{position:fixed;z-index:30;width:min(360px,calc(100vw - 24px));max-height:min(60vh,520px);overflow:auto;box-sizing:border-box;padding:10px 12px 12px;border-radius:16px;background:rgb(var(--ui-g,14 14 16) / .96);border:1px solid rgb(var(--ui-hi,255 255 255) / .16);color:var(--ui-ink,#fff);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}",
    ".sb-pick h4{margin:10px 2px 6px;font:600 9.5px/1 var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.16em;text-transform:uppercase;color:var(--ui-dim,#9aa3a6)}.sb-pick h4:first-child{margin-top:2px}",
    ".sb-pick button{display:flex;width:100%;align-items:center;gap:10px;padding:8px 6px;border:0;border-radius:8px;background:none;color:inherit;text-align:left;font:400 13px/1.3 var(--sans,system-ui,sans-serif);cursor:pointer}.sb-pick button:hover{background:rgb(var(--ui-hi,255 255 255) / .07)}",
    ".sb-pick button[aria-disabled=true]{opacity:.4;cursor:default}.sb-pick button b{font-weight:600}.sb-pick button i{margin-left:auto;font-style:normal;font:600 9px/1 var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.1em;color:var(--ui-dim,#9aa3a6);text-transform:uppercase}",
    ".sb-pick .sb-boards{display:flex;flex-wrap:wrap;gap:6px}.sb-pick .sb-boards button{width:auto;padding:7px 12px;border-radius:15px;border:1px solid rgb(var(--ui-hi,255 255 255) / .22);font:600 10px/1 var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.1em;text-transform:uppercase}",
    ".sb-pick .sb-boards button.sb-cur{border-color:var(--acc,#55b8c9);color:var(--acc,#55b8c9)}",
    ".sb-pick .sb-name{display:flex;gap:6px;width:100%}.sb-pick .sb-name input{flex:1;min-width:0;height:32px;padding:0 10px;border-radius:8px;border:1px solid var(--acc,#55b8c9);background:transparent;color:inherit;font:400 13px/1 var(--sans,system-ui,sans-serif)}.sb-pick .sb-name button{width:auto;padding:0 14px;border-radius:16px;background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c);font:600 10px/1 var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.12em;text-transform:uppercase}"
  ].join("\n");
  var PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 7.5l3 3"/></svg>';
  var X = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var MIN_W = 900, MIN_H = 560, M = 12, G = 12, STRIP_H = 76, SLOT_MIN = 280, COL_MIN = 340, COL_MAX = 560;

  function mount(O) {
    O = O || {};
    var KEY = "surface.board." + (O.tool || "tool");
    var st = { on: false, side: "left", pins: null, saved: [], cur: "" };
    try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v && typeof v === "object") { st.side = v.side === "right" ? "right" : "left"; if (Array.isArray(v.pins)) st.pins = v.pins.slice(0, 40); if (Array.isArray(v.saved)) st.saved = v.saved.slice(0, 30); st.cur = String(v.cur || ""); st.on = !!v.on; } } catch (e) {}
    if (!st.pins) st.pins = (O.boards && O.boards[0] && O.boards[0].pins || []).slice();
    function save() { try { localStorage.setItem(KEY, JSON.stringify({ on: st.on, side: st.side, pins: st.pins, saved: st.saved, cur: st.cur })); } catch (e) {} }
    var root = document.documentElement, stageSel = O.stage || "#stage", ed = false, L = null, evicting = null, order = [];
    if (!document.getElementById("sb-css")) { var s = document.createElement("style"); s.id = "sb-css"; s.textContent = CSS.split("{stage}").join(stageSel); document.head.appendChild(s); }

    /* ---------- the layout ---------- */
    function fits() { return innerWidth >= MIN_W && innerHeight >= MIN_H; }
    function compute() {
      var dw = O.left ? +O.left() || 0 : 0, a = O.aspect ? +O.aspect() || 16 / 9 : 16 / 9;
      a = Math.max(.4, Math.min(3, a));
      var x0 = dw + M, x1 = innerWidth - M, y0 = M, y1 = (O.bottom ? +O.bottom() || innerHeight : innerHeight) - G;
      var AW = x1 - x0, AH = y1 - y0;
      var col = Math.max(COL_MIN, Math.min(COL_MAX, Math.round(AW * .34)));
      var sw = Math.floor(Math.min(AW - col - G, (AH - STRIP_H - G) * a));
      if (sw < 320 || AH < 300) return null;
      var sh = Math.round(sw / a); col = AW - sw - G;
      var left = st.side !== "right", sx = left ? x0 : x1 - sw, cx = left ? x0 + sw + G : x0;
      var cols = col >= 2 * COL_MIN + G ? 2 : 1, rows = AH >= 2 * SLOT_MIN + G ? 2 : 1;
      var cw = (col - (cols - 1) * G) / cols, rh = (AH - (rows - 1) * G) / rows, slots = [];
      for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++) slots.push({ x: Math.round(cx + c * (cw + G)), y: Math.round(y0 + r * (rh + G)), w: Math.floor(cw), h: Math.floor(rh) });
      var sy = y0 + sh + G;
      return { stage: { x: sx, y: y0, w: sw, h: sh }, strip: { x: sx, y: sy, w: sw, h: Math.max(0, Math.min(STRIP_H, y1 - sy)) }, slots: slots };
    }
    function apply() {
      if (!st.on) return;
      L = compute();
      if (!L) { set(false, true); try { O.say && O.say("the board needs a bigger window"); } catch (e) {} return; }
      var S = L.stage;
      root.style.setProperty("--sb-sx", S.x + "px"); root.style.setProperty("--sb-sy", S.y + "px");
      root.style.setProperty("--sb-sw", S.w + "px"); root.style.setProperty("--sb-sh", S.h + "px");
      var T = L.strip; strip.style.left = T.x + "px"; strip.style.top = T.y + "px"; strip.style.width = T.w + "px"; strip.style.height = T.h + "px"; strip.hidden = T.h < 52;
      seat();
      try { O.onLayout && O.onLayout(L); } catch (e) {}
    }
    var rq = 0; function relayout() { if (!st.on) return; cancelAnimationFrame(rq); rq = requestAnimationFrame(apply); }

    /* ---------- the panels in their slots ---------- */
    var P = O.panels || {};
    function pel(id) { var p = P[id]; if (!p) return null; return typeof p.el === "string" ? document.querySelector(p.el) : p.el; }
    function shown(el) { return !!el && !el.hidden && getComputedStyle(el).display !== "none"; }
    function seat() {
      if (!L) return;
      order = order.filter(function (id) { return shown(pel(id)); });
      Object.keys(P).forEach(function (id) { var el = pel(id); if (shown(el) && order.indexOf(id) < 0) order.push(id); });
      while (order.length > L.slots.length) { var old = order.shift(), oe = pel(old); evicting = oe; try { P[old].close(); } catch (e) {} evicting = null; if (oe) oe.removeAttribute("data-sb-slot"); }
      var used = {};
      order.forEach(function (id) { var el = pel(id), k = +el.getAttribute("data-sb-slot"); if (el.hasAttribute("data-sb-slot") && k < L.slots.length && !used[k]) used[k] = id; else el.removeAttribute("data-sb-slot"); });
      order.forEach(function (id) { var el = pel(id); if (el.hasAttribute("data-sb-slot")) return; for (var k = 0; k < L.slots.length; k++) if (!used[k]) { used[k] = id; el.setAttribute("data-sb-slot", k); break; } });
      order.forEach(function (id) { var el = pel(id), k = +el.getAttribute("data-sb-slot"), r = L.slots[k]; if (!r) return;
        el.style.setProperty("--sb-x", r.x + "px"); el.style.setProperty("--sb-y", r.y + "px"); el.style.setProperty("--sb-w", r.w + "px"); el.style.setProperty("--sb-h", r.h + "px"); });
      Object.keys(P).forEach(function (id) { var el = pel(id); if (el && !shown(el)) el.removeAttribute("data-sb-slot"); });
    }
    var mo = new MutationObserver(function () { if (st.on) { seat(); } });
    function watch() { Object.keys(P).forEach(function (id) { var el = pel(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ["hidden", "class"] }); }); }
    /* a close the board allows: the panel's own controls, its own bar button, Esc, or a replacement by the board */
    function mayClose(el) {
      if (!st.on || !el || !L) return true;
      if (evicting === el) return true;
      var e = window.event;
      if (!e) return false;
      if (e.type === "keydown") return e.key === "Escape";
      var t = e.target && e.target.closest ? e.target : null; if (!t) return false;
      if (el.contains(t)) return true;
      for (var id in P) { if (pel(id) === el && P[id].owners && t.closest(P[id].owners)) return true; }
      return false;
    }

    /* ---------- the strip ---------- */
    var strip = document.createElement("div"); strip.className = "sb-strip"; strip.hidden = true; strip.setAttribute("role", "toolbar"); strip.setAttribute("aria-label", "Board: your pinned controls");
    document.body.appendChild(strip);
    function cat() { try { return O.catalog ? O.catalog() : []; } catch (e) { return []; } }
    function find(id) { var C = cat(); for (var i = 0; i < C.length; i++) if (C[i].id === id) return C[i]; return null; }
    function draw() {
      strip.textContent = "";
      var any = false;
      st.pins.forEach(function (id) {
        var c = find(id); if (!c) return; any = true;
        var it;
        if (c.kind === "range") {
          it = document.createElement("div"); it.className = "sb-it sb-rg"; it.setAttribute("role", "group"); it.setAttribute("aria-label", c.label);
          var lb = document.createElement("span"); lb.textContent = c.label; var vv = document.createElement("span"); vv.className = "sb-v";
          var inp = document.createElement("input"); inp.type = "range"; inp.min = c.min; inp.max = c.max; inp.step = c.step || "any"; inp.setAttribute("aria-label", c.label);
          var show = function () { var x = +c.get(); if (document.activeElement !== inp) inp.value = x; vv.textContent = c.fmt ? c.fmt(x) : String(Math.round(x * 100) / 100); };
          inp.oninput = function () { c.set(+inp.value); show(); }; inp.onchange = function () { c.set(+inp.value, true); show(); };
          it.append(lb, vv, inp); it._sync = show; show();
        } else {
          it = document.createElement("button"); it.type = "button"; it.className = "sb-it"; it.setAttribute("aria-label", c.label);
          it.innerHTML = (c.icon || "") + "<span></span>"; it.querySelector("span").textContent = c.short || c.label;
          it.onclick = function () { if (ed || it._moved) return; try { c.run(); } catch (e) { console.warn("[board]", e); } };
        }
        it.dataset.pin = id;
        var x = document.createElement("button"); x.type = "button"; x.className = "sb-x"; x.innerHTML = X; x.setAttribute("aria-label", "Take " + c.label + " off the strip");
        x.onclick = function (e) { e.stopPropagation(); st.pins = st.pins.filter(function (p) { return p !== id; }); save(); draw(); };
        it.appendChild(x); hold(it); strip.appendChild(it);
      });
      if (!any) { var em = document.createElement("span"); em.className = "sb-empty"; em.textContent = "Pin the controls you play: tap the pencil, then +"; strip.appendChild(em); }
      var add = document.createElement("button"); add.type = "button"; add.className = "sb-add"; add.textContent = "+ add"; add.setAttribute("aria-label", "Add a control to the strip"); add.onclick = function () { pick(add); };
      var pen = document.createElement("button"); pen.type = "button"; pen.className = "sb-tool sb-pen"; pen.innerHTML = PEN; pen.setAttribute("aria-label", "Edit the strip and the board"); pen.title = "Edit the strip (or hold any control)"; pen.onclick = function () { edit(true); };
      var done = document.createElement("button"); done.type = "button"; done.className = "sb-done"; done.textContent = "done"; done.onclick = function () { edit(false); };
      var sp = document.createElement("span"); sp.style.flex = "1 0 0";
      strip.append(add, sp, pen, done);
      strip.classList.toggle("sb-ed", ed);
    }
    function sync() { strip.querySelectorAll(".sb-rg").forEach(function (r) { r._sync && r._sync(); }); }
    setInterval(function () { if (st.on && !strip.hidden && !document.hidden) sync(); }, 400);
    /* hold to edit; in edit, drag to reorder */
    function hold(it) {
      var t = 0, g = null;
      it.addEventListener("pointerdown", function (e) {
        if (e.button > 0) return; it._moved = false;
        if (ed) { if (e.target.closest(".sb-x")) return; e.preventDefault(); g = { id: e.pointerId, x: e.clientX, x0: it.offsetLeft }; try { it.setPointerCapture(e.pointerId); } catch (_) {} it.classList.add("sb-drag"); return; }
        if (e.target.tagName === "INPUT") return;
        t = setTimeout(function () { it._moved = true; if (navigator.vibrate) navigator.vibrate(10); edit(true); }, 520);
      });
      it.addEventListener("pointermove", function (e) {
        if (!g) { if (t && Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) > 6) { clearTimeout(t); t = 0; } return; }
        if (e.pointerId !== g.id) return;
        var dx = e.clientX - g.x; it.style.transform = "translateX(" + dx + "px)";
        var mid = g.x0 + it.offsetWidth / 2 + dx, sib = [].slice.call(strip.querySelectorAll(".sb-it")).filter(function (s) { return s !== it; });
        for (var i = 0; i < sib.length; i++) { var s = sib[i], c = s.offsetLeft + s.offsetWidth / 2;
          if (dx > 0 && c > g.x0 + it.offsetWidth / 2 && mid > c && s.nextElementSibling !== it) { strip.insertBefore(it, s.nextElementSibling); g.x0 = it.offsetLeft; g.x = e.clientX; it.style.transform = ""; break; }
          if (dx < 0 && c < g.x0 + it.offsetWidth / 2 && mid < c && it.nextElementSibling !== s) { strip.insertBefore(it, s); g.x0 = it.offsetLeft; g.x = e.clientX; it.style.transform = ""; break; } }
      });
      var end = function () { clearTimeout(t); t = 0; if (!g) return; g = null; it.style.transform = ""; it.classList.remove("sb-drag");
        st.pins = [].slice.call(strip.querySelectorAll(".sb-it")).map(function (s) { return s.dataset.pin; }); save(); };
      it.addEventListener("pointerup", end); it.addEventListener("pointercancel", end);
    }
    function edit(on) { ed = !!on; strip.classList.toggle("sb-ed", ed); if (!ed) closePick(); }
    /* + : the list of everything pinnable, by group, and the boards */
    var pk = null;
    function closePick() { if (pk) { pk.remove(); pk = null; } }
    function pick(from) {
      closePick(); pk = document.createElement("div"); pk.className = "sb-pick"; pk.setAttribute("role", "dialog"); pk.setAttribute("aria-label", "Add to the strip");
      var C = cat(), groups = {};
      C.forEach(function (c) { (groups[c.group || "More"] = groups[c.group || "More"] || []).push(c); });
      var bh = document.createElement("h4"); bh.textContent = "Boards"; pk.appendChild(bh);
      var bw = document.createElement("div"); bw.className = "sb-boards"; pk.appendChild(bw);
      list().forEach(function (b) { var x = document.createElement("button"); x.type = "button"; x.textContent = b.name; if (b.name === st.cur) x.className = "sb-cur"; x.title = (b.mine ? "Yours" : "Comes with the tool") + ": " + (b.pins || []).length + " controls" + ((b.panels || []).length ? ", " + b.panels.length + " panels" : "");
        x.onclick = function () { load(b.name); closePick(); }; bw.appendChild(x); });
      var sv = document.createElement("button"); sv.type = "button"; sv.textContent = "save board…";
      sv.onclick = function () { var f = document.createElement("form"); f.className = "sb-name"; f.innerHTML = '<input maxlength="24" aria-label="Name this board" enterkeyhint="done"><button type="submit">save</button>';
        var i = f.querySelector("input"); i.value = st.cur && !isBuiltIn(st.cur) ? st.cur : "My board"; sv.replaceWith(f); i.focus(); i.select();
        f.onsubmit = function (e) { e.preventDefault(); var n = i.value.trim().slice(0, 24); if (n) { saveAs(n); closePick(); } }; };
      bw.appendChild(sv);
      var sd = document.createElement("button"); sd.type = "button"; sd.textContent = "stage " + (st.side === "left" ? "left" : "right") + " ⇄"; sd.title = "Put the stage in the other corner"; sd.onclick = function () { side(st.side === "left" ? "right" : "left"); closePick(); }; bw.appendChild(sd);
      Object.keys(groups).forEach(function (g) {
        var h = document.createElement("h4"); h.textContent = g; pk.appendChild(h);
        groups[g].forEach(function (c) { var b = document.createElement("button"), has = st.pins.indexOf(c.id) >= 0; b.type = "button";
          b.innerHTML = "<b></b><span></span><i></i>"; b.querySelector("b").textContent = c.label; b.querySelector("i").textContent = has ? "on the strip" : (c.kind === "range" ? "slider" : "");
          if (c.d) b.querySelector("span").textContent = ""; b.title = c.d || c.label; b.setAttribute("aria-disabled", String(has));
          b.onclick = function () { if (has) return; st.pins.push(c.id); save(); draw(); edit(true); pick(); }; pk.appendChild(b); });
      });
      document.body.appendChild(pk);
      var r = strip.getBoundingClientRect(), w = pk.offsetWidth, h = pk.offsetHeight;
      pk.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width - w - 8)) + "px";
      pk.style.top = Math.max(12, r.top - h - 8) + "px";
    }
    document.addEventListener("pointerdown", function (e) { if (pk && !pk.contains(e.target) && !e.target.closest(".sb-add")) closePick(); if (ed && !strip.contains(e.target) && !(pk && pk.contains(e.target))) edit(false); }, true);

    /* ---------- boards ---------- */
    function isBuiltIn(n) { return (O.boards || []).some(function (b) { return b.name === n; }); }
    function list() { return (O.boards || []).map(function (b) { return Object.assign({ mine: false }, b); }).concat(st.saved.map(function (b) { return Object.assign({ mine: true }, b); })); }
    function openPanels() { return order.filter(function (id) { return shown(pel(id)); }); }
    function saveAs(n) { var b = { name: n, side: st.side, pins: st.pins.slice(), panels: openPanels() }; st.saved = st.saved.filter(function (x) { return x.name !== n; }); st.saved.push(b); st.cur = n; save(); try { O.say && O.say("board saved: " + n); } catch (e) {} }
    function load(n) { var b = list().filter(function (x) { return x.name === n; })[0]; if (!b) return false;
      st.cur = n; st.side = b.side === "right" ? "right" : "left"; st.pins = (b.pins || []).slice(); save(); draw();
      if (!st.on) set(true); else apply();
      Object.keys(P).forEach(function (id) { if ((b.panels || []).indexOf(id) < 0 && shown(pel(id))) { evicting = pel(id); try { P[id].close(); } catch (e) {} evicting = null; } });
      (b.panels || []).forEach(function (id, i) { if (P[id] && !shown(pel(id))) setTimeout(function () { try { P[id].open(); } catch (e) {} }, 60 * (i + 1)); });
      try { O.say && O.say("board: " + n); } catch (e) {} return true; }

    /* ---------- on and off ---------- */
    function set(on, quiet) {
      on = !!on; if (on && !fits()) { try { O.say && O.say("the board needs a window at least " + MIN_W + " × " + MIN_H); } catch (e) {} on = false; }
      if (on === st.on && (on ? root.classList.contains("sb-on") : !root.classList.contains("sb-on"))) return st.on;
      st.on = on; if (!quiet) save();
      root.classList.toggle("sb-on", on);
      try { window.SurfacePerform && SurfacePerform.hold("board", on); } catch (e) {}
      if (on) { draw(); watch(); apply(); }
      else { strip.hidden = true; edit(false); document.querySelectorAll("[data-sb-slot]").forEach(function (el) { el.removeAttribute("data-sb-slot"); }); order = []; }
      try { O.onChange && O.onChange(on); } catch (e) {}
      return on;
    }
    function side(v) { st.side = v === "right" ? "right" : "left"; save(); relayout(); }
    addEventListener("resize", function () { if (st.on && !fits()) set(false, true); else relayout(); });
    if (st.on) setTimeout(function () { if (fits()) set(true, true); else st.on = false; }, 0);
    return { on: function () { return st.on; }, set: set, toggle: function () { return set(!st.on); }, side: side, relayout: relayout, load: load, save: saveAs, list: list,
      mayClose: mayClose, edit: edit, layout: function () { return L; }, strip: strip, fits: fits };
  }
  window.SurfaceBoard = { mount: mount };
})();
