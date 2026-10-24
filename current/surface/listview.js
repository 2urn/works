/* Surface · List view — show, sort and star any list a person keeps (Dimitry, 20 Oct 2026: the preset list "needs
   ways to sort the list in different ways and maybe to select favorites the same way that we do with other
   controls"). One rule for every list, first written for Current's Randomize list of settings:

   - SHOW: all, starred (★), and whatever subsets the list has (yours, in the matrix …).
   - SORT: hand (your own order, the only one you can drag), a–z, used (most used first), new (newest first) …
   - STARS: a star on each row. Starred rows come first in every sort but your own order, where the order is yours.
   - ROW: the star leads on the left, the drag handle ends on the right (Dimitry, 20 Oct), in every list.
   - The choice is remembered by the tool (it owns the storage); the kit only says what it means.

     SurfaceListView.bar({show:[[v, html, aria]...], sort:[[v, html, aria]...], get:()=>({show, sort}),
                          set:(patch)=>{}, label:'Presets', sortNames:{v:'Menu name'}})  → element: ONE row, the show
                          filter as equal segments (.segs / .sg) and the sort as one "Sort: Hand ▾" button with a menu
                          (role=menu, ↑ ↓ Home End, Esc; sortAs:'segs' keeps the old radio row)
     SurfaceListView.order(keys, {show, sort, fav:{k:true}, label:k=>text, used:k=>n, time:k=>ms,
                                  filters:{name: k=>bool}})  → keys to draw, in order
     SurfaceListView.star(on, name, onToggle)  → a star button (class s-star, aria-pressed)
     SurfaceListView.STAR, .GRIP  → the icons (SVG strings)
   Plain script, window.SurfaceListView. Default looks at zero specificity: the tool's rules win. */
(function () {
  "use strict";
  if (window.SurfaceListView) return;
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/></svg>';
  var GRIP = '<svg viewBox="0 0 10 16" aria-hidden="true"><circle cx="3" cy="3" r="1.3"/><circle cx="7" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="7" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="7" cy="13" r="1.3"/></svg>';
  /* THE HEAD (Dimitry, 23 Oct 00:21: at desktop width the filter and the sort stood one segment per row, ~220 px, because
     a host's "#list button{width:100%}" beat the kit's low-specificity segments). One row, always: the show filter as
     equal segments on the left, the sort as ONE compact button on the right ("Sort: Hand ▾") that opens a small real
     menu. The few properties that make it a row are !important, so no host rule for its own rows can stack it again. */
  var CSS = ":where(.s-lvbar){display:flex;justify-content:space-between;align-items:center;flex-wrap:nowrap;gap:0 10px;position:relative;min-width:0}" +
    ".s-lvbar>.segs{display:inline-flex!important;flex-direction:row!important;flex-wrap:nowrap!important;width:auto!important;flex:0 1 auto;min-width:0}" +
    ".s-lvbar>.segs>.sg{width:auto!important;flex:1 1 0!important;display:inline-grid!important;margin:0!important}" +
    ".s-lvsort{position:relative;flex:0 0 auto;margin-left:auto}" +
    ".s-lvbar .s-lvsortb{width:auto!important;display:inline-flex!important;align-items:center;gap:6px;min-height:var(--s-seg-h,36px);padding:0 10px!important;border:0;background:none;color:inherit;font:inherit;cursor:pointer;white-space:nowrap}" +
    ".s-lvsortb .v{color:var(--s-fg,currentColor)}.s-lvsortb svg{width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:1.8;transition:transform .15s}" +
    ".s-lvsortb[aria-expanded=true] svg{transform:rotate(180deg)}" +
    ".s-lvmenu{position:absolute;right:0;top:100%;z-index:30;min-width:150px;margin:2px 0 0;padding:4px;box-sizing:border-box;border-radius:var(--s-radius,10px);" +
    "background:var(--s-surface,#16191b);color:var(--s-text,inherit);border:1px solid var(--s-line,rgba(127,127,127,.3));box-shadow:0 8px 28px rgba(0,0,0,.35)}" +
    ".s-lvmenu[hidden]{display:none!important}" +
    ".s-lvbar .s-lvmenu button{width:100%!important;display:flex!important;align-items:center;justify-content:space-between;gap:12px;min-height:var(--s-hit,40px);padding:0 10px!important;border:0;border-radius:calc(var(--s-radius,10px) - 4px);background:none;color:inherit;font:inherit;text-transform:none;letter-spacing:0;text-align:left;cursor:pointer}" +
    ".s-lvmenu button:hover,.s-lvmenu button:focus-visible{background:var(--s-sunk,rgba(127,127,127,.14));outline:none}" +
    ".s-lvmenu button[aria-checked=true]{color:var(--s-accent,var(--acc-tx,var(--acc,#55b8c9)))}.s-lvmenu button[aria-checked=true]::after{content:'\\2713'}" +
    ":where(.s-star){width:36px;height:36px;padding:0;display:grid;place-items:center;border:0;background:none;color:color-mix(in srgb,currentColor 45%,transparent);cursor:pointer}" +
    ":where(.s-star) svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round}" +
    ":where(.s-star[aria-pressed=true]){color:var(--acc-tx,var(--acc,#55b8c9))}:where(.s-star[aria-pressed=true]) svg{fill:currentColor}" +
    /* every segment the same target (Dimitry, 22 Oct 23:58: the ★ was a sliver): the segment token tall, at least 44 px
       wide, the star glyph as big as the words look (15 px) */
    ".s-lvbar .segs{gap:0}.s-lvbar .sg,.s-seg-even .sg{min-width:44px;min-height:var(--s-seg-h,36px);display:inline-grid;place-items:center;padding:0 6px;box-sizing:border-box}" +
    ".s-sgstar{font-size:15px;line-height:1;letter-spacing:0}" +
    /* COLUMN-MAJOR TWO COLUMNS (23:58): a list laid in two columns reads down the first, then down the second. flow() sets
       --lv-rows and pins the list's own heads across both columns; a list wearing .s-lvcols goes to two columns, column
       by column, once its container (a panel spanning the bar, pop.js span) is 560 px or wider. DOM order stays the
       reading order, so drag and ↑ ↓ follow it unchanged. */
    "@container (min-width:560px){.s-lvcols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:12px;align-content:start;grid-auto-flow:column;" +
    "grid-template-rows:var(--lv-tpl,auto)}.s-lvcols>.s-lvhead,.s-lvcols>.s-lvfoot{grid-column:1/-1}}";
  function css() { if (document.getElementById("slv-css")) return; var s = document.createElement("style"); s.id = "slv-css"; s.textContent = CSS; (document.head || document.documentElement).prepend(s); }
  /* MULTI (Dimitry, 24 Oct 2026, Current 0.30.7: "there's no way to select more than one collection. They should actually
     be toggles ... and all obviously would select all of them"). bar({ multi: true }): the show row is checkboxes; get().show
     is an array of keys, [] meaning all. Tapping all clears to all; tapping a key while all is lit picks that key alone;
     after that each tap adds or removes it, and removing the last goes back to all. The first option is the all key. */
  function group(name, opts, get, set, multi) {
    var g = document.createElement("div"); g.className = "segs"; g.setAttribute("role", multi ? "group" : "radiogroup"); g.setAttribute("aria-label", name);
    var ALL = opts.length ? opts[0][0] : "all";
    var on = function (k) { if (!multi) return k === get(); var a = get() || []; return k === ALL ? !a.length : a.indexOf(k) >= 0; };
    var pick = function (k) { if (!multi) { set(k); return; } var a = (get() || []).slice();
      if (k === ALL) a = []; else { var i = a.indexOf(k); if (i >= 0) a.splice(i, 1); else a.push(k); if (a.length >= opts.length - 1) a = []; }
      set(a); };
    var sync = function () { [].forEach.call(g.children, function (y, i) { y.setAttribute("aria-checked", String(on(opts[i][0]))); }); };
    opts.forEach(function (o) {
      var x = document.createElement("button"); x.type = "button"; x.className = "sg"; x.innerHTML = starLabel(o[1]); x.setAttribute("role", multi ? "checkbox" : "radio"); x.setAttribute("aria-label", o[2] || o[0]);
      x.onclick = function () { pick(o[0]); sync(); }; g.appendChild(x);
    });
    sync(); return g;
  }
  /* a lone star as a label is drawn at the words' visual size */
  function starLabel(t) { return /^(&#9733;|\u2605|★)$/.test(String(t)) ? '<span class="s-sgstar" aria-hidden="true">\u2605</span>' : t; }
  /* lay a list in column-major order: items are el's children matching item; anything else is a head, pinned to its own
     row across the columns (in DOM order). Call after every build; a MutationObserver keeps it right after reorders. */
  function flow(el, o) {
    o = o || {}; var item = o.item || ".lk", foot = o.foot || null, cols = o.cols || 2; css(); el.classList.add("s-lvcols");
    /* FEET (Dimitry, 22 Oct 00:15: "the master mixer level needs to be across the bottom, full width of the panel"): a
       child matching o.foot sits under both columns, across the whole width, so a master or a total reads as one */
    function set() {
      var heads = 0, n = 0, feet = [];
      [].forEach.call(el.children, function (c) {
        if (foot && c.matches(foot)) { feet.push(c); c.classList.add("s-lvfoot"); }
        else if (c.matches(item)) { n++; c.style.gridRow = ""; }
        else { heads++; c.classList.add("s-lvhead"); c.style.gridRow = String(heads); } });
      var rows = Math.max(1, Math.ceil(n / cols));   /* repeat(0, …) is invalid CSS, so the template is written whole */
      feet.forEach(function (c, i) { c.style.gridRow = String(heads + rows + i + 1); });
      el.style.setProperty("--lv-head", String(heads)); el.style.setProperty("--lv-rows", String(rows));
      el.style.setProperty("--lv-tpl", (heads ? "repeat(" + heads + ",auto) " : "") + "repeat(" + rows + ",auto)" + (feet.length ? " repeat(" + feet.length + ",auto)" : ""));
    }
    set();
    if (!el.__lvflow) { el.__lvflow = true; try { new MutationObserver(function (m) { if (m.some(function (x) { return x.type === "childList"; })) set(); }).observe(el, { childList: true }); } catch (e) {} }
    return set;
  }
  /* the sort's names in its menu: o.sortNames, else the studio's usual four, else the option's own label */
  var SORTN = { hand: "Hand", az: "A\u2013Z", used: "Most used", new: "Newest" }, SORTS = { used: "Used", new: "New" };
  function txt(h) { var d = document.createElement("div"); d.innerHTML = h; return d.textContent; }
  function sortMenu(o) {
    var name = (o.label ? o.label + ": " : "") + "sort", names = o.sortNames || {};
    var full = function (x) { return names[x[0]] || SORTN[x[0]] || txt(x[1]); }, short = function (x) { return (o.sortShort || {})[x[0]] || SORTS[x[0]] || full(x); };
    var w = document.createElement("div"); w.className = "s-lvsort";
    var b = document.createElement("button"); b.type = "button"; b.className = "s-lvsortb"; b.setAttribute("aria-haspopup", "menu"); b.setAttribute("aria-expanded", "false");
    var m = document.createElement("div"); m.className = "s-lvmenu"; m.setAttribute("role", "menu"); m.setAttribute("aria-label", name); m.hidden = true;
    var id = "slvm" + Math.random().toString(36).slice(2, 8); m.id = id; b.setAttribute("aria-controls", id);
    var items = o.sort.map(function (x) {
      var it = document.createElement("button"); it.type = "button"; it.setAttribute("role", "menuitemradio"); it.tabIndex = -1; it.textContent = full(x);
      if (x[2]) it.title = x[2];
      it.onclick = function () { close(true); o.set({ sort: x[0] }); sync(); }; m.appendChild(it); return it; });
    function cur() { var v = o.get().sort; for (var i = 0; i < o.sort.length; i++) if (o.sort[i][0] === v) return i; return 0; }
    function sync() { var i = cur(); b.innerHTML = '<span>Sort:</span> <span class="v">' + short(o.sort[i]).replace(/</g, "&lt;") + '</span><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 3.5L5 7l3.5-3.5"/></svg>';
      b.setAttribute("aria-label", name + ": " + full(o.sort[i]) + ". Opens a menu");
      items.forEach(function (it, j) { it.setAttribute("aria-checked", String(j === i)); }); }
    function out(e) { if (!w.contains(e.target)) close(false); }
    function open() { m.hidden = false; b.setAttribute("aria-expanded", "true"); var i = cur(); items[i].focus({ preventScroll: true });
      document.addEventListener("pointerdown", out, true); }
    function close(focus) { if (m.hidden) return; m.hidden = true; b.setAttribute("aria-expanded", "false"); document.removeEventListener("pointerdown", out, true); if (focus) b.focus({ preventScroll: true }); }
    b.onclick = function () { if (m.hidden) open(); else close(true); };
    b.onkeydown = function (e) { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); } };
    m.onkeydown = function (e) {
      var i = items.indexOf(document.activeElement), n = items.length;
      if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % n].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + n) % n].focus(); }
      else if (e.key === "Home") { e.preventDefault(); items[0].focus(); }
      else if (e.key === "End") { e.preventDefault(); items[n - 1].focus(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (e.key === "Tab") close(false);
    };
    w.appendChild(b); w.appendChild(m); sync(); w.sync = sync; return w;
  }
  function bar(o) {
    css(); var b = document.createElement("div"); b.className = "s-lvbar";
    if (o.show && o.show.length) b.appendChild(group((o.label ? o.label + ": " : "") + "show", o.show, function () { return o.get().show; }, function (v) { o.set({ show: v }); }, !!o.multi));
    if (o.sort && o.sort.length) b.appendChild(o.sortAs === "segs" ? group((o.label ? o.label + ": " : "") + "sort", o.sort, function () { return o.get().sort; }, function (v) { o.set({ sort: v }); }) : sortMenu(o));
    return b;
  }
  function order(keys, o) {
    o = o || {}; var fav = o.fav || {}, ks = keys.slice(), lab = o.label || String;
    var n = function (f, k) { var v = f ? +f(k) : 0; return isFinite(v) ? v : 0; };
    if (o.sort === "az") ks.sort(function (x, y) { return String(lab(x)).localeCompare(String(lab(y)), undefined, { sensitivity: "base", numeric: true }); });
    else if (o.sort === "used") ks.sort(function (x, y) { return n(o.used, y) - n(o.used, x); });
    else if (o.sort === "new") ks.sort(function (x, y) { return n(o.time, y) - n(o.time, x); });
    if (o.show === "fav") ks = ks.filter(function (k) { return fav[k]; });
    else if (o.show && o.show !== "all" && o.filters && o.filters[o.show]) ks = ks.filter(o.filters[o.show]);
    if (o.sort && o.sort !== "hand") { var at = new Map(ks.map(function (k, i) { return [k, i]; })); ks.sort(function (x, y) { return ((fav[y] ? 1 : 0) - (fav[x] ? 1 : 0)) || at.get(x) - at.get(y); }); }
    return ks;
  }
  function star(on, name, onToggle) {
    css(); var x = document.createElement("button"); x.type = "button"; x.className = "s-star"; x.innerHTML = STAR;
    x.setAttribute("aria-pressed", String(!!on)); x.setAttribute("aria-label", "Star " + name); x.title = on ? "Starred" : "Star";
    x.onclick = function (e) { e.stopPropagation(); onToggle(x.getAttribute("aria-pressed") !== "true"); };
    return x;
  }
  window.SurfaceListView = { bar: bar, order: order, star: star, flow: flow, starLabel: starLabel, STAR: STAR, GRIP: GRIP };
})();
