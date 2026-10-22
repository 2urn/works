/* Surface · Undo — every delete can be undone (Dimitry, 22 Oct 2026, 00:01: he deleted a beat grid and there was no way
   back). One rule for every tool:

   - A delete shows a line at the top: deleted "name" · Undo, for 8 seconds, in one fixed slot (one line, ellipsis). The
     Undo button can be reached by keyboard, and Cmd/Ctrl+Z undoes the last delete while the line is up. Undo puts the
     thing back exactly: the same place, the same data, selected again if it was.
   - Whatever was deleted is also kept on the device in "Recently deleted" (the last 10, for 7 days), reachable from the
     tool's Settings, so a missed line is never fatal.

     SurfaceUndo.init({ tool: 'current' })
     SurfaceUndo.kind('beat', { restore: data => {...}, name: 'Beat' })   // how a kind comes back from Recently deleted
     SurfaceUndo.deleted({ kind: 'beat', label: 'My grid', data: {...}, restore: () => {...} })
        data: what Recently deleted keeps (JSON); restore: the exact undo for the line (falls back to the kind's restore)
     SurfaceUndo.list() → [{ id, kind, label, t }]   SurfaceUndo.recover(id)   SurfaceUndo.forget(id)
     SurfaceUndo.panel(el) → draws Recently deleted into el (a list with Restore buttons); redraws on change

   Plain script, window.SurfaceUndo. Colours from the theme tokens (--ui-*). Storage: localStorage surface.trash.<tool>. */
(function () {
  "use strict";
  if (window.SurfaceUndo) return;
  var O = { tool: "tool", keep: 10, days: 7, ms: 8000 }, KINDS = {}, cur = null, bar = null, tm = 0, panels = [];
  var CSS = ".s-undo{position:fixed;left:50%;top:calc(16px + env(safe-area-inset-top,0px));z-index:80;transform:translate(-50%,-12px);display:flex;align-items:center;gap:6px;" +
    "width:min(360px,calc(100vw - 32px));height:40px;box-sizing:border-box;padding:0 4px 0 14px;border-radius:999px;background:var(--ui-solid,#0f1213);color:var(--ui-ink,#eef1f2);" +
    "border:1px solid var(--ui-line,#23292b);box-shadow:0 8px 24px rgb(0 0 0 / .35);font:500 12px/1 var(--mono,ui-monospace,Menlo,monospace);letter-spacing:.02em;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}" +
    ".s-undo.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}" +
    ".s-undo .s-undo-t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".s-undo button{flex:none;height:32px;min-width:64px;padding:0 14px;border-radius:999px;border:0;background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c);font:700 11px/1 var(--mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;cursor:pointer}" +
    ".s-undo button:focus-visible{outline:2px solid var(--ui-ink,#fff);outline-offset:2px}" +
    ".s-trash{display:flex;flex-direction:column;gap:2px;margin:6px 0 0;padding:0;list-style:none}" +
    ".s-trash li{display:flex;align-items:center;gap:8px;min-height:36px;font:400 13px/1.2 var(--sans,system-ui);color:var(--ui-mid,#b9c2c5)}" +
    ".s-trash li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.s-trash li small{flex:none;font:500 10px var(--mono,monospace);color:var(--ui-dim,#8a9396)}" +
    ".s-trash li button{flex:none;height:30px;padding:0 10px;border-radius:999px;border:1px solid var(--acc,#55b8c9);background:none;color:var(--acc,#55b8c9);font:600 10px/1 var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}" +
    ".s-trash-none{font:400 12px var(--sans,system-ui);color:var(--ui-dim,#8a9396);margin:6px 0 0}" +
    "@media (prefers-reduced-motion:reduce){.s-undo{transition:none}}";
  function css() { if (document.getElementById("s-undo-css")) return; var s = document.createElement("style"); s.id = "s-undo-css"; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }
  function key() { return "surface.trash." + O.tool; }
  function load() { try { var a = JSON.parse(localStorage.getItem(key())) || []; var cut = Date.now() - O.days * 864e5; return a.filter(function (x) { return x && x.t > cut; }); } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(key(), JSON.stringify(a.slice(-O.keep))); } catch (e) { try { localStorage.setItem(key(), JSON.stringify(a.slice(-3))); } catch (_) {} } redraw(); }
  function init(o) { o = o || {}; for (var k in o) O[k] = o[k]; save(load()); }
  function kind(k, o) { KINDS[k] = o || {}; redraw(); }
  function ensureBar() {
    if (bar) return bar; css();
    bar = document.createElement("div"); bar.className = "s-undo"; bar.setAttribute("role", "status"); bar.setAttribute("aria-live", "polite");
    var t = document.createElement("span"); t.className = "s-undo-t";
    var b = document.createElement("button"); b.type = "button"; b.textContent = "Undo";
    b.onclick = function () { undo(); };
    bar.append(t, b); document.body.appendChild(bar);
    document.addEventListener("keydown", function (e) {
      if (!cur || !(e.metaKey || e.ctrlKey) || e.shiftKey || String(e.key).toLowerCase() !== "z") return;
      var a = e.target; if (a && a.closest && a.closest("input,textarea,[contenteditable=''],[contenteditable=true]")) return;
      e.preventDefault(); e.stopPropagation(); undo();
    }, true);
    return bar;
  }
  function hide() { clearTimeout(tm); if (bar) bar.classList.remove("on"); cur = null; }
  function deleted(o) {
    o = o || {}; var b = ensureBar(), id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    var a = load(); a.push({ id: id, kind: o.kind || "", label: String(o.label || "item").slice(0, 80), data: o.data === undefined ? null : o.data, t: Date.now() }); save(a);
    cur = { id: id, restore: o.restore, kind: o.kind, data: o.data };
    var t = b.querySelector(".s-undo-t"), txt = "deleted “" + String(o.label || "item") + "”"; t.textContent = txt; t.title = txt;
    b.querySelector("button").setAttribute("aria-label", "Undo: bring back " + String(o.label || "it") + " (Cmd or Ctrl+Z)");
    b.classList.add("on"); clearTimeout(tm); tm = setTimeout(hide, O.ms);
    return id;
  }
  function drop(id) { save(load().filter(function (x) { return x.id !== id; })); }
  function undo() {
    if (!cur) return false; var c = cur; hide();
    try { if (typeof c.restore === "function") c.restore(); else if (KINDS[c.kind] && KINDS[c.kind].restore) KINDS[c.kind].restore(c.data); } catch (e) { console.warn("[undo]", e); return false; }
    drop(c.id); return true;
  }
  function list() { return load().map(function (x) { return { id: x.id, kind: x.kind, label: x.label, t: x.t }; }).reverse(); }
  function recover(id) {
    var x = load().find(function (y) { return y.id === id; }); if (!x) return false;
    var K = KINDS[x.kind]; if (!K || !K.restore) return false;
    try { K.restore(x.data); } catch (e) { console.warn("[undo]", e); return false; }
    if (cur && cur.id === id) hide(); drop(id); return true;
  }
  function forget(id) { drop(id); }
  function ago(t) { var m = Math.round((Date.now() - t) / 60000); return m < 1 ? "now" : m < 60 ? m + " min" : m < 1440 ? Math.round(m / 60) + " h" : Math.round(m / 1440) + " d"; }
  function draw(el) {
    css(); el.innerHTML = ""; var L = list();
    if (!L.length) { var p = document.createElement("p"); p.className = "s-trash-none"; p.textContent = "Nothing deleted in the last " + O.days + " days."; el.appendChild(p); return; }
    var ul = document.createElement("ul"); ul.className = "s-trash"; ul.setAttribute("aria-label", "Recently deleted");
    L.forEach(function (x) {
      var li = document.createElement("li"), n = document.createElement("span"), k = KINDS[x.kind], s = document.createElement("small"), b = document.createElement("button");
      n.textContent = (k && k.name ? k.name + ": " : "") + x.label; n.title = n.textContent; s.textContent = ago(x.t);
      b.type = "button"; b.textContent = "restore"; b.setAttribute("aria-label", "Restore " + x.label); b.disabled = !(k && k.restore);
      b.onclick = function () { recover(x.id); };
      li.append(n, s, b); ul.appendChild(li);
    });
    el.appendChild(ul);
  }
  function panel(el) { if (panels.indexOf(el) < 0) panels.push(el); draw(el); }
  function redraw() { panels.forEach(function (el) { if (el.isConnected) draw(el); }); }
  window.SurfaceUndo = { init: init, kind: kind, deleted: deleted, undo: undo, list: list, recover: recover, forget: forget, panel: panel, hide: hide };
})();
