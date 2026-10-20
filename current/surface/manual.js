/* Surface · Manual — a tool's index, printed as a manual (Dimitry, 19–20 Oct 2026: "pane export as pdf manual").
   One tap builds a clean, printable copy of the index (a cover, then each section opened out, in the order the
   person has arranged them, without the ones they hid or the controls), and opens the browser's print dialog, where
   "Save as PDF" makes the file. The copy is built fresh each time from the live index and taken away afterwards, so
   the manual always matches the version in hand. Nothing to download: CSS paged media and the browser's own PDF.

   Plain script, window.SurfaceManual, no dependencies.
     SurfaceManual.print({
       title: 'Current',                       // the cover's name
       sub: 'G-code in. …',                    // a line under it
       about: '#idx .idx-say',                 // a paragraph (selector or text) for the cover
       mark: '<svg…>' | () => node,            // the maker's mark for the cover (optional)
       meta: ['Version 0.26.0', 'works.chamy.xyz/current'],   // small lines at the cover's foot
       sections: () => [elements],             // what to print, in order (default: '.cx-grp' in root, not hidden)
       skip: '#display,#bbGroup',              // sections left out (controls with no reading in them)
       root: '#idx',
       file: 'CHAMY·XYZ_Current_manual'        // the PDF's suggested name (browsers take it from the page title)
     })
   Sections use the Codex list's markup (.cx-grp > .cx-grpbtn + .cx-gbody; rows .cx-row > .cx-go + .cx-body).
   Headers become headings, folded parts open, buttons and sliders go, links print their address. */
(function () {
  "use strict";
  if (window.SurfaceManual) return;
  var CSS = [
    "#sm-print{display:none}",
    "@media print{",
    "  @page{size:auto;margin:16mm 16mm 18mm}",
    "  @page{@bottom-center{content:counter(page);font:8pt ui-monospace,Menlo,monospace;color:#777}}",
    "  @page:first{@bottom-center{content:none}}",
    "  html,body{background:#fff!important;color:#111!important;height:auto!important;min-height:0!important;overflow:visible!important}",
    "  html.sm-printing body>*:not(#sm-print){display:none!important}",
    "  html.sm-printing #sm-print{display:block!important}",
    "}",
    "#sm-print{color:#111;background:#fff;font:10.5pt/1.5 var(--sans,'Instrument Sans',system-ui,sans-serif);-webkit-print-color-adjust:exact;print-color-adjust:exact}",
    "#sm-print *{color:#111!important;background:transparent!important;text-shadow:none!important;box-shadow:none!important;border-color:#bbb!important;max-height:none!important;overflow:visible!important;opacity:1!important;transform:none!important;filter:none!important;backdrop-filter:none!important}",
    "#sm-print .sm-cover{height:240mm;display:flex;flex-direction:column;justify-content:center;gap:10mm;break-after:page}",
    "#sm-print .sm-cover h1{margin:0;font:700 44pt/1 'Minnerva Title','Minnerva','Anton',system-ui,sans-serif;letter-spacing:.14em}",
    "#sm-print .sm-cover .sm-sub{margin:0;font-size:13pt;max-width:120mm}",
    "#sm-print .sm-cover .sm-about{margin:0;font-size:10.5pt;max-width:120mm;color:#333!important}",
    "#sm-print .sm-cover .sm-mark{height:22mm;width:auto;align-self:flex-start}",
    "#sm-print .sm-cover .sm-mark svg,#sm-print .sm-cover .sm-mark img{height:100%;width:auto;display:block}",
    "#sm-print .sm-cover .sm-mark svg *{fill:#111!important}",
    "#sm-print .sm-meta{margin-top:auto;font:8.5pt/1.6 ui-monospace,Menlo,monospace;letter-spacing:.06em;color:#555!important}",
    "#sm-print .sm-toc{break-after:page}#sm-print .sm-toc h2{border:0;padding:0}",
    "#sm-print .sm-toc ol{margin:0;padding:0 0 0 6mm;font-size:11pt;line-height:1.9}",
    "#sm-print .sm-sec{break-before:page}",
    "#sm-print h2{margin:0 0 5mm;padding-bottom:2mm;border-bottom:1.5pt solid #111!important;font:600 18pt/1.2 var(--sans,system-ui,sans-serif)}",
    "#sm-print h3{margin:6mm 0 2mm;font:600 12.5pt/1.3 var(--sans,system-ui,sans-serif);break-after:avoid}",
    "#sm-print h3 i{font:500 9pt ui-monospace,Menlo,monospace;font-style:normal;color:#777!important;margin-right:3mm}",
    "#sm-print p,#sm-print li,#sm-print dd{orphans:3;widows:3}",
    "#sm-print dl{display:grid;grid-template-columns:32mm 1fr;gap:2mm 5mm;margin:2mm 0}",
    "#sm-print dl.stack{grid-template-columns:1fr}",
    "#sm-print dt{font-weight:600}#sm-print dd{margin:0}",
    "#sm-print dt,#sm-print dd{break-inside:avoid}",
    "#sm-print a{text-decoration:underline}",
    "#sm-print a[href^='http']::after{content:' (' attr(href) ')';font:8pt ui-monospace,Menlo,monospace;color:#666!important;word-break:break-all}",
    "#sm-print pre{white-space:pre-wrap;font:7.5pt/1.35 ui-monospace,Menlo,monospace}",
    "#sm-print details>*{display:block!important}#sm-print summary{font-weight:600;list-style:none;margin-top:3mm}",
    "#sm-print svg:not(.sm-keep){display:none}",
    "#sm-print img{max-width:100%}",
    "#sm-print ul,#sm-print ol{padding-left:5mm}",
    "#sm-print .sp-box{display:inline-block;width:3.2mm;height:3.2mm;border:.8pt solid #111!important;margin-right:2mm;vertical-align:-.4mm}",
    "#sm-print .sm-foot{margin-top:10mm;font:8.5pt ui-monospace,Menlo,monospace;color:#666!important}"
  ].join("\n");
  function css() { if (document.getElementById("sm-css")) return; var s = document.createElement("style"); s.id = "sm-css"; s.textContent = CSS; document.head.appendChild(s); }
  function q(s, r) { return typeof s === "string" ? (r || document).querySelector(s) : s; }
  function text(n) { return (n && n.textContent || "").replace(/\s+/g, " ").trim(); }

  var DROP = "button:not(.cx-go):not(.cx-grpbtn),input:not([type=checkbox]),select,textarea,canvas,video,audio,iframe,script,noscript,template,[hidden],.sfs-gone,.sfs-bar,.sfs-keep,.sfs-grip,.sfs-hide,.sfs-live,.sp-foot,.sp-where,.sp-b,.cx-ch,.cx-f,.sf-grip,.sf-pin,[aria-hidden=true]:not(.sp-box):not(.sm-keep)";
  function clean(sec) {
    var c = sec.cloneNode(true);
    /* headers become headings */
    var gb = c.querySelector(":scope>.cx-grpbtn");
    var h2 = document.createElement("h2"); h2.textContent = gb ? text(gb.querySelector("span")) || text(gb) : (sec.id || "");
    if (gb) gb.replaceWith(h2); else c.insertBefore(h2, c.firstChild);
    c.querySelectorAll(".cx-go").forEach(function (b) {
      var h3 = document.createElement("h3"), n = b.querySelector("i"), t = b.querySelector("span");
      if (n) { var i = document.createElement("i"); i.textContent = text(n); h3.appendChild(i); }
      h3.appendChild(document.createTextNode(t ? text(t) : text(b)));
      b.replaceWith(h3);
    });
    c.querySelectorAll(DROP).forEach(function (n) { n.remove(); });
    c.querySelectorAll("a").forEach(function (n) { if (!text(n)) n.remove(); });   // icon-only links are actions, not reading
    c.querySelectorAll("input[type=checkbox]").forEach(function (n) { n.disabled = true; });
    c.querySelectorAll("details").forEach(function (d) { d.open = true; });
    /* open everything the person folded, and take off what the tool's own animations left inline */
    [c].concat([].slice.call(c.querySelectorAll("*"))).forEach(function (n) {
      n.classList && n.classList.remove("cx-shut", "sfs-brief");
      ["height", "max-height", "overflow", "display", "opacity", "visibility", "transform", "transition", "content-visibility"].forEach(function (p) { if (n.style) n.style.removeProperty(p); });
      if (n.id) n.removeAttribute("id");
      ["aria-controls", "aria-labelledby", "aria-expanded", "tabindex"].forEach(function (a) { n.removeAttribute && n.removeAttribute(a); });
    });
    c.className = "sm-sec";
    return c;
  }

  function build(o) {
    var root = q(o.root || "#idx");
    var secs = o.sections ? o.sections() : [].slice.call((root || document).querySelectorAll(":scope>.cx-grp"));
    secs = secs.filter(function (s) { return s && !s.classList.contains("sfs-gone") && !s.hidden && !(o.skip && s.matches(o.skip)); });
    var out = document.createElement("div"); out.id = "sm-print"; out.setAttribute("aria-hidden", "true");
    /* the cover */
    var cov = document.createElement("section"); cov.className = "sm-cover";
    if (o.mark) {
      var m = document.createElement("div"); m.className = "sm-mark";
      var mk = typeof o.mark === "function" ? o.mark() : o.mark;
      if (typeof mk === "string") m.innerHTML = mk; else if (mk) m.appendChild(mk);
      m.querySelectorAll("svg").forEach(function (s) { s.classList.add("sm-keep"); });
      cov.appendChild(m);
    }
    var h1 = document.createElement("h1"); h1.textContent = (o.title || document.title).toUpperCase(); cov.appendChild(h1);
    if (o.sub) { var sb = document.createElement("p"); sb.className = "sm-sub"; sb.textContent = o.sub; cov.appendChild(sb); }
    var ab = o.about && (typeof o.about === "string" && /^[#.]/.test(o.about) ? text(q(o.about)) : o.about);
    if (ab) { var ap = document.createElement("p"); ap.className = "sm-about"; ap.textContent = ab; cov.appendChild(ap); }
    var meta = document.createElement("div"); meta.className = "sm-meta";
    (o.meta || []).concat(["Printed " + new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })]).forEach(function (l) { var d = document.createElement("div"); d.textContent = l; meta.appendChild(d); });
    cov.appendChild(meta); out.appendChild(cov);
    /* contents */
    var cleaned = secs.map(clean);
    var toc = document.createElement("section"); toc.className = "sm-toc";
    toc.innerHTML = "<h2>Contents</h2><ol></ol>";
    cleaned.forEach(function (c) { var li = document.createElement("li"); li.textContent = text(c.querySelector("h2")); toc.querySelector("ol").appendChild(li); });
    out.appendChild(toc);
    cleaned.forEach(function (c) { out.appendChild(c); });
    if (o.foot) { var f = document.createElement("p"); f.className = "sm-foot"; f.textContent = o.foot; out.appendChild(f); }
    return out;
  }

  function print(o) {
    o = o || {}; css();
    var old = document.getElementById("sm-print"); if (old) old.remove();
    var out = build(o); document.body.appendChild(out);
    var H = document.documentElement, t0 = document.title;
    H.classList.add("sm-printing");
    if (o.file) document.title = o.file;
    var done = false;
    function after() { if (done) return; done = true; H.classList.remove("sm-printing"); document.title = t0; out.remove(); removeEventListener("afterprint", after); }
    addEventListener("afterprint", after);
    /* give the fonts a moment, then the dialog; afterprint tidies up (and the print media query ending, for browsers that skip it) */
    var go = function () { try { window.print(); } catch (e) { console.warn("manual", e); after(); } };
    try { var mq = matchMedia("print"); mq.addEventListener("change", function f(e) { if (!e.matches) { mq.removeEventListener("change", f); setTimeout(after, 300); } }); } catch (_) {}
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(go, 60); }); else setTimeout(go, 60);
    return out;
  }
  window.SurfaceManual = { print: print, build: build, css: css };
})();
