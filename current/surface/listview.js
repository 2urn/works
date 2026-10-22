/* Surface · List view — show, sort and star any list a person keeps (Dimitry, 20 Oct 2026: the preset list "needs
   ways to sort the list in different ways and maybe to select favorites the same way that we do with other
   controls"). One rule for every list, first written for Current's Randomize list of settings:

   - SHOW: all, starred (★), and whatever subsets the list has (yours, in the matrix …).
   - SORT: hand (your own order, the only one you can drag), a–z, used (most used first), new (newest first) …
   - STARS: a star on each row. Starred rows come first in every sort but your own order, where the order is yours.
   - ROW: the star leads on the left, the drag handle ends on the right (Dimitry, 20 Oct), in every list.
   - The choice is remembered by the tool (it owns the storage); the kit only says what it means.

     SurfaceListView.bar({show:[[v, html, aria]...], sort:[[v, html, aria]...], get:()=>({show, sort}),
                          set:(patch)=>{}, label:'Presets'})  → element: two radio groups (.segs / .sg)
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
  var CSS = ":where(.s-lvbar){display:flex;justify-content:space-between;flex-wrap:wrap;gap:0 10px}" +
    ":where(.s-star){width:36px;height:36px;padding:0;display:grid;place-items:center;border:0;background:none;color:color-mix(in srgb,currentColor 45%,transparent);cursor:pointer}" +
    ":where(.s-star) svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round}" +
    ":where(.s-star[aria-pressed=true]){color:var(--acc,#55b8c9)}:where(.s-star[aria-pressed=true]) svg{fill:currentColor}" +
    /* every segment the same target (Dimitry, 22 Oct 23:58: the ★ was a sliver): the segment token tall, at least 44 px
       wide, the star glyph as big as the words look (15 px) */
    ".s-lvbar .segs{gap:0}.s-lvbar .sg,.s-seg-even .sg{min-width:44px;min-height:var(--s-seg-h,36px);display:inline-grid;place-items:center;padding:0 6px;box-sizing:border-box}" +
    ".s-sgstar{font-size:15px;line-height:1;letter-spacing:0}" +
    /* COLUMN-MAJOR TWO COLUMNS (23:58): a list laid in two columns reads down the first, then down the second. flow() sets
       --lv-rows and pins the list's own heads across both columns; a list wearing .s-lvcols goes to two columns, column
       by column, once its container (a panel spanning the bar, pop.js span) is 560 px or wider. DOM order stays the
       reading order, so drag and ↑ ↓ follow it unchanged. */
    "@container (min-width:560px){.s-lvcols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:12px;align-content:start;grid-auto-flow:column;" +
    "grid-template-rows:var(--lv-tpl,auto)}.s-lvcols>.s-lvhead{grid-column:1/-1}}";
  function css() { if (document.getElementById("slv-css")) return; var s = document.createElement("style"); s.id = "slv-css"; s.textContent = CSS; (document.head || document.documentElement).prepend(s); }
  function group(name, opts, get, set) {
    var g = document.createElement("div"); g.className = "segs"; g.setAttribute("role", "radiogroup"); g.setAttribute("aria-label", name);
    var sync = function () { [].forEach.call(g.children, function (y, i) { y.setAttribute("aria-checked", String(opts[i][0] === get())); }); };
    opts.forEach(function (o) {
      var x = document.createElement("button"); x.type = "button"; x.className = "sg"; x.innerHTML = starLabel(o[1]); x.setAttribute("role", "radio"); x.setAttribute("aria-label", o[2] || o[0]);
      x.onclick = function () { set(o[0]); sync(); }; g.appendChild(x);
    });
    sync(); return g;
  }
  /* a lone star as a label is drawn at the words' visual size */
  function starLabel(t) { return /^(&#9733;|\u2605|★)$/.test(String(t)) ? '<span class="s-sgstar" aria-hidden="true">\u2605</span>' : t; }
  /* lay a list in column-major order: items are el's children matching item; anything else is a head, pinned to its own
     row across the columns (in DOM order). Call after every build; a MutationObserver keeps it right after reorders. */
  function flow(el, o) {
    o = o || {}; var item = o.item || ".lk", cols = o.cols || 2; css(); el.classList.add("s-lvcols");
    function set() {
      var heads = 0, n = 0;
      [].forEach.call(el.children, function (c) { if (c.matches(item)) { n++; c.style.gridRow = ""; } else { heads++; c.classList.add("s-lvhead"); c.style.gridRow = String(heads); } });
      var rows = Math.max(1, Math.ceil(n / cols));   /* repeat(0, …) is invalid CSS, so the template is written whole */
      el.style.setProperty("--lv-head", String(heads)); el.style.setProperty("--lv-rows", String(rows));
      el.style.setProperty("--lv-tpl", (heads ? "repeat(" + heads + ",auto) " : "") + "repeat(" + rows + ",auto)");
    }
    set();
    if (!el.__lvflow) { el.__lvflow = true; try { new MutationObserver(function (m) { if (m.some(function (x) { return x.type === "childList"; })) set(); }).observe(el, { childList: true }); } catch (e) {} }
    return set;
  }
  function bar(o) {
    css(); var b = document.createElement("div"); b.className = "s-lvbar";
    if (o.show && o.show.length) b.appendChild(group((o.label ? o.label + ": " : "") + "show", o.show, function () { return o.get().show; }, function (v) { o.set({ show: v }); }));
    if (o.sort && o.sort.length) b.appendChild(group((o.label ? o.label + ": " : "") + "sort", o.sort, function () { return o.get().sort; }, function (v) { o.set({ sort: v }); }));
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
