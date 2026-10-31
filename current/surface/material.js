/* Surface · Material — a material's colors as LOOKS and PARTS (Dimitry, 25 Oct 2026, the Water panel: "colors look
   ugly … How would this generalize to any pack? … an appreciable commitment to the way that the material works").

   Every material (water today; glass, smoke, sand later) declares two things:
     parts  the few places its color lives, each named for what it physically is, with one plain line
            (water: Tint, the water itself; Glint, the sparkle on the highlights; Caustic, the net of gathered light)
     looks  named presets that set every part at once, each with its author (a pack can bring more)
   The panel shows the looks first (one tap, a name you can read, a preview of the parts' colors), and under a
   "fine-tune" the parts, each with every choice visible as a dot: nothing hides behind repeated taps.

   The choices are the scene's own colors, never fixed hex: 'line', 'line2' (the second color), 'ground', or null
   (none), so any look fits any scene. A tool may still store a hex; it shows as its own dot.

     const up = SurfaceMaterial.colors(box, {
       material: { id: 'water', name: 'Water', by: 'Dimitry Saïd Chamy',
         parts: [{ id: 'tint', name: 'Tint', says: 'the water itself, in its dips and crests' }, …],
         looks: [{ id: 'clear', name: 'Clear', says: 'no color: the water as it is', colors: { tint: null, … } }, …] },
       choices: [[null, 'none'], ['line', 'lines'], ['line2', 'second color'], ['ground', 'ground']],
       hex: v => '#…',            // what a choice looks like in this scene (for the dots)
       get: () => ({ tint: 'line', … }), set: (colors, how) => {…},   // how: 'look:<id>' or 'part:<id>'
       gate: () => true,          // optional: return false to refuse a change (a Pro gate opens its own sheet)
       detail: true,              // show the fine-tune (false on a narrow shelf)
       label: 'Colors' });
     up();                        // redraw from get() and hex() (a scene changed)
     SurfaceMaterial.add('water', [{ name, colors, says }], 'by …')   // looks a pack brings, kept in this browser
     SurfaceMaterial.looks(material)                                  // the material's looks plus the added ones
     SurfaceMaterial.define({...}) · SurfaceMaterial.ring({...})      // the materials ring: select | adjust (see THE MATERIALS RING)

   Plain script, window.SurfaceMaterial, no dependencies. Styles at zero specificity (:where), so the tool's rules win;
   colours come from currentColor and --acc. Every target is 40 px for a finger. */
(function () {
  "use strict";
  var LIVE = new Set();   /* every drawn colors panel: { root, id, draw } */
  if (window.SurfaceMaterial) return;
  var LS = "surface.material.looks.";
  var CSS =
    ":where(.smat){display:flex;flex-direction:column;gap:10px;min-width:0;width:100%;flex:1 1 100%;box-sizing:border-box;container-type:inline-size}" +   /* a size container has no width of its own: it takes its row's */
    ":where(.smat-looks){display:flex;flex-wrap:wrap;gap:8px}" +
    ":where(.smat-look){display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 14px 0 10px;border-radius:999px;border:1px solid rgb(var(--ui-hi,255 255 255) / .22);background:none;color:inherit;font:600 11px/1 var(--mono,ui-monospace,monospace);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;white-space:nowrap}" +
    ":where(.smat-look)[aria-checked=true]{background:var(--acc,#55b8c9);border-color:var(--acc,#55b8c9);color:var(--acc-ink,#04181c)}" +
    ":where(.smat-look):focus-visible,:where(.smat-dot):focus-visible,:where(.smat-more):focus-visible{outline:2px solid var(--acc,#55b8c9);outline-offset:2px}" +
    /* the look's preview: one small dot per part, in a row, centred on the pill's text */
    ":where(.smat-pv){display:inline-flex;gap:3px;align-items:center}" +
    ":where(.smat-pv i){display:block;width:9px;height:9px;border-radius:50%;box-sizing:border-box;border:1px solid rgb(var(--ui-hi,255 255 255) / .35)}" +
    /* none in a preview: a faint speck, so it never reads as a pale color */
    ":where(.smat-pv i.none){width:9px;height:9px;border:0;background:radial-gradient(circle,currentColor 0 1.5px,transparent 2px);opacity:.45}" +
    ":where(.smat-more){align-self:flex-start;display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0;border:0;background:none;color:inherit;opacity:.7;font:500 12px/1 var(--sans,system-ui);cursor:pointer}" +
    ":where(.smat-more):hover{opacity:1}:where(.smat-more) svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;transition:rotate .2s}" +
    ":where(.smat-more)[aria-expanded=true] svg{rotate:180deg}" +
    ":where(.smat-parts){display:flex;flex-direction:column;gap:6px}:where(.smat-parts)[hidden]{display:none}" +
    ":where(.smat-part){display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:2px 12px}" +
    ":where(.smat-part b){font:600 12px/1.2 var(--sans,system-ui)}:where(.smat-part small){display:block;font:400 11.5px/1.35 var(--sans,system-ui);opacity:.65}" +
    ":where(.smat-dots){display:flex;gap:0}" +
    /* narrow (a phone's panel): the part's name and line above, its dots below, so the words keep their width */
    "@container (max-width:400px){:where(.smat-part){grid-template-columns:minmax(0,1fr)}:where(.smat-part small){display:inline;margin-left:6px}:where(.smat-dots){margin-left:-10px}}" +
    ":where(.smat-dot){width:40px;height:40px;padding:0;margin:0;border:0;background:none;display:grid;place-items:center;cursor:pointer;color:inherit}" +
    ":where(.smat-dot) i{display:block;width:18px;height:18px;border-radius:50%;box-sizing:border-box;border:1px solid rgb(var(--ui-hi,255 255 255) / .35);position:relative}" +
    /* none: an empty ring with a slash, so it reads as "no color", not as an unticked box */
    ":where(.smat-dot.none) i::after{content:'';position:absolute;left:50%;top:1px;bottom:1px;width:1.5px;margin-left:-.75px;background:currentColor;opacity:.55;rotate:45deg}" +
    ":where(.smat-dot)[aria-checked=true] i{outline:2px solid var(--acc,#55b8c9);outline-offset:2px}";
  function css() {
    if (document.getElementById("smat-css")) return;
    var s = document.createElement("style"); s.id = "smat-css"; s.textContent = CSS;
    (document.head || document.documentElement).insertBefore(s, (document.head || document.documentElement).firstChild);
  }
  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "look"; }
  function ok(v) { return v === null || (typeof v === "string" && (/^#[0-9a-f]{6}$/i.test(v) || v === "line" || v === "line2" || v === "ground")); }

  /* looks a pack brought, per material, kept in this browser */
  function added(id) { try { var a = JSON.parse(localStorage.getItem(LS + id)); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function add(id, looks, by) {
    if (!id || !Array.isArray(looks)) return 0;
    var have = added(id), n = 0;
    looks.forEach(function (L) {
      if (!L || !L.name || !L.colors || typeof L.colors !== "object") return;
      var c = {}; for (var k in L.colors) if (ok(L.colors[k])) c[k] = L.colors[k];
      var x = { id: "pk-" + slug(L.name) + "-" + slug(L.by || by), name: String(L.name).slice(0, 32), says: L.says ? String(L.says).slice(0, 120) : "", by: String(L.by || by || "").slice(0, 60), colors: c };
      have = have.filter(function (y) { return y.id !== x.id; }); have.push(x); n++;
    });
    try { localStorage.setItem(LS + id, JSON.stringify(have.slice(-24))); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent("surface:material", { detail: { id: id } })); } catch (e) {}
    return n;
  }
  function looks(m) { return (m.looks || []).concat(added(m.id)); }
  function same(a, parts, b) { return parts.every(function (p) { var x = a[p.id] == null ? null : a[p.id], y = b[p.id] == null ? null : b[p.id]; return x === y; }); }

  function colors(box, o) {
    css(); o = o || {};
    var M = o.material, parts = M.parts || [], choices = o.choices || [[null, "none"], ["line", "lines"], ["line2", "second color"], ["ground", "ground"]];
    var hex = function (v) { if (v == null) return null; if (v[0] === "#") return v; try { return o.hex ? o.hex(v) : null; } catch (e) { return null; } };
    var name = function (v) { for (var i = 0; i < choices.length; i++) if (choices[i][0] === v) return choices[i][1]; return v || "none"; };
    var root = el("div", "smat"); root.setAttribute("role", "group"); root.setAttribute("aria-label", (o.label || "Colors") + " of " + (M.name || "the material"));
    var lk = el("div", "smat-looks"); lk.setAttribute("role", "radiogroup"); lk.setAttribute("aria-label", "Looks"); root.appendChild(lk);
    var more = null, pw = null, open = false;
    try { open = localStorage.getItem(LS + M.id + ".open") === "1"; } catch (e) {}
    if (o.detail !== false && parts.length) {
      more = el("button", "smat-more", "<span>Fine-tune the " + esc(parts.map(function (p) { return p.name.toLowerCase(); }).join(", ").replace(/, ([^,]*)$/, " and $1")) + '</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>');
      more.type = "button"; root.appendChild(more);
      pw = el("div", "smat-parts"); pw.id = "smat-" + M.id + "-" + Math.random().toString(36).slice(2, 7); more.setAttribute("aria-controls", pw.id); root.appendChild(pw);
      more.onclick = function () { open = !open; try { localStorage.setItem(LS + M.id + ".open", open ? "1" : "0"); } catch (e) {} draw(); };
    }
    box.appendChild(root);
    var put = function (c, how) { if (o.gate && !o.gate()) return; o.set(c, how); draw(); };
    function dotI(v) { var h = hex(v); return "<i" + (h ? ' style="background:' + h + '"' : "") + "></i>"; }
    function draw() {
      var cur = o.get() || {};
      lk.textContent = "";
      looks(M).forEach(function (L) {
        var on = same(cur, parts, L.colors || {});
        var pv = '<span class="smat-pv" aria-hidden="true">' + parts.map(function (p) { var v = (L.colors || {})[p.id]; var h = hex(v == null ? null : v); return '<i class="' + (h ? "" : "none") + '"' + (h ? ' style="background:' + h + '"' : "") + "></i>"; }).join("") + "</span>";
        var b = el("button", "smat-look", pv + "<span>" + esc(L.name) + "</span>"); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(on));
        var t = L.name + (L.says ? ": " + L.says : "") + (L.by ? " · by " + L.by : ""); b.title = t; b.setAttribute("aria-label", t);
        b.onclick = function () { var c = {}; parts.forEach(function (p) { var v = (L.colors || {})[p.id]; c[p.id] = v == null ? null : v; }); put(c, "look:" + (L.id || slug(L.name))); };
        lk.appendChild(b);
      });
      if (!pw) return;
      more.setAttribute("aria-expanded", String(open)); pw.hidden = !open; pw.textContent = "";
      parts.forEach(function (p) {
        var row = el("div", "smat-part"); row.appendChild(el("span", null, "<b>" + esc(p.name) + "</b>" + (p.says ? "<small>" + esc(p.says) + "</small>" : "")));
        var ds = el("div", "smat-dots"); ds.setAttribute("role", "radiogroup"); ds.setAttribute("aria-label", p.name);
        var v0 = cur[p.id] == null ? null : cur[p.id], list = choices.slice();
        if (v0 && !list.some(function (c) { return c[0] === v0; })) list.push([v0, "its own color"]);
        list.forEach(function (c) {
          var d = el("button", "smat-dot" + (c[0] == null ? " none" : ""), dotI(c[0])); d.type = "button"; d.setAttribute("role", "radio");
          d.setAttribute("aria-checked", String(v0 === c[0])); d.title = p.name + ": " + c[1]; d.setAttribute("aria-label", p.name + ": " + c[1]);
          d.onclick = function () { var n = Object.assign({}, cur); n[p.id] = c[0]; put(n, "part:" + p.id); };
          ds.appendChild(d);
        });
        row.appendChild(ds); pw.appendChild(row);
      });
    }
    /* ONE LISTENER FOR ALL PANELS (review, 25 Oct): a panel is rebuilt on every open, so a listener per draw piled up for
       the session. The live panels sit in one set; a new draw prunes the ones no longer on the page */
    LIVE.forEach(function (x) { if (!x.root.isConnected) LIVE.delete(x); });
    LIVE.add({ root: root, id: M.id, draw: draw });
    if (!LIVE.on) { LIVE.on = true; document.addEventListener("surface:material", function (e) { LIVE.forEach(function (x) { if (!x.root.isConnected) { LIVE.delete(x); return; } if (e.detail && e.detail.id === x.id) x.draw(); }); }); }
    draw();
    return draw;
  }
  /* THE MATERIALS RING (Dimitry, 31 Oct 07:21-07:41: "a dedicated 2-part materials ring menu to select | adjust materials",
     water and watercolor now, "room for future ones", and "a flexible architecture"). A tool defines each material once:
       SurfaceMaterial.define({ id, name, icon, says,
         active: () => bool,                 // is it on the stage now
         hidden: () => bool,                 // not offered here (a tier this person does not have)
         choose: () => [ring items],         // part 1, SELECT: its variants as dots (radio), lit when chosen
         adjust: () => [ring items] })       // part 2, ADJUST: doors and values for the material on the stage
     SurfaceMaterial.ring({ panel, panelIcon, adjustIcon }) → items for SurfaceRing: every material's choices, in the order
     defined, then one "adjust" door (at the foot) to the active material's own ring; with several active, the adjust ring
     starts with a dot for each. A new material (glass, smoke, sand) is one define() call: the ring needs no change. */
  var DEFS = [];
  function define(d) { if (!d || !d.id) return; DEFS = DEFS.filter(function (x) { return x.id !== d.id; }); DEFS.push(d); }
  function shown() { return DEFS.filter(function (d) { try { return !(d.hidden && d.hidden()); } catch (e) { return false; } }); }
  function ring(o) {
    o = o || {}; var items = [], on = shown().filter(function (d) { try { return !!(d.active && d.active()); } catch (e) { return false; } });
    if (o.panel) items.push({ id: "mat-panel", kind: "go", at: "top", label: "panel", aria: o.panelAria || "The materials' panel", icon: o.panelIcon, pick: o.panel });
    shown().forEach(function (d) { var c = []; try { c = d.choose ? d.choose() : []; } catch (e) {} c.forEach(function (x) { items.push(x); }); });
    if (on.length) {
      var adj = function (d) { return { title: "Adjust · " + d.name, icon: d.icon, items: function () { try { return d.adjust ? d.adjust() : []; } catch (e) { return []; } } }; };
      items.push(on.length === 1
        ? { id: "mat-adjust", kind: "go", at: "bottom-right", label: "adjust", aria: "Adjust " + on[0].name + ": its looks, colors, what drives it and more", icon: o.adjustIcon || on[0].icon, ring: adj(on[0]) }
        : { id: "mat-adjust", kind: "go", at: "bottom-right", label: "adjust", aria: "Adjust a material on the stage", icon: o.adjustIcon, ring: { title: "Adjust", icon: o.adjustIcon, items: function () { return on.map(function (d) { return { id: "adj-" + d.id, kind: "go", label: d.name.toLowerCase(), aria: "Adjust " + d.name, icon: d.icon, ring: adj(d) }; }); } } });
    }
    return items;
  }
  window.SurfaceMaterial = { colors: colors, add: add, looks: looks, added: added, define: define, defined: shown, ring: ring };
})();
