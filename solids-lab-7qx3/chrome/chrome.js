/* Surface · Chrome — the studio's chrome for a tool, lifted from Current (18 Oct 2026; CONVENTIONS).
   One call gives a tool what Current wears:
   - THE LAUNCH COVER: the tool's name in FFF Minnerva at the exact centre, Dimitry's lockup above, the duck-rabbit below
     filling with the tool's colours as the page loads, LAUNCH under its feet, BETA · v<version> at the foot.
     Off with ?cover=0, and for an automated browser.
   - THE MARKS: the namemark top right on arrival, fading away; the duck-rabbit top left with the word INDEX beside it.
   - THE INDEX PANE: the duck-rabbit opens a drawer on the left. It opens on the name in Minnerva with the Beta pill,
     two lines of space, the intro, the Codex toolbar (Surface sections.js), the tool's sections, and the Colophon at
     the foot (about the artist, approach, open source with every license, AI ratio, privacy, contact, license,
     version), then the CHAMY·XYZ word. The namemark at the drawer's top right closes it.
   Plain script, window.SurfaceChrome. Needs marks.js (window.SurfaceMarks); sections.js if present.
   The tool supplies the typeface "Minnerva Title" (it is not shipped in sys until its license is settled).

   SurfaceChrome.mount({
     name: 'Strand Kit',                 // the tool's name (the cover sets it in capitals)
     sub: 'Business model',              // optional: a line under the cover's title, in the sans (21 Oct 2026: a document
                                         // built for a tool keeps the tool's name as the title and says what it is here)
     version: '0.4.0',                   // shown on the cover's foot and in the colophon
     intro: '<p>…</p>',                   // the index's opening paragraph(s), first person
     drawer: '#panel',                   // optional: an existing element to become the drawer (its content is kept, under the sections)
     sections: [{ id, title, html|el, lead, open }],   // the tool's index sections, above its own drawer content
                                         // or rows: [{ title, html, icons: ['#btnId','ic:name'], pill, drop: {'#btnId':'.part'}, hold }]
     icon: name => '<path…/>',           // optional: the tool's icon set, for rows that name 'ic:name' (resolved after load)
     colophon: { about, approach, openSource, foundations: [{group,name,by,label,url,for}], credits: [{name,version,licence,copyright,url,text,kind,for}],
                 ai: { human: 70, note, statement }, privacy, contact: { lead, email, links: [{label,url}] }, license, version },
     start: { folded, focus },          // optional: how a FIRST visit opens the index (sections.js start), as Current does
     noKey: true,                        // optional: the tool runs p and i through keys.js, so the chrome leaves them alone
     onLaunch,                           // optional: called when the cover's Launch is pressed (release a held deep link)
     duckFill: 'data:image/…',          // optional: the coloured duck on the cover; otherwise it fills with the accent
     onOpen, onClose,                    // the tool's own reactions (e.g. pause the stage behind)
     key: 'strand-kit'                   // where the index's arrangement is kept
   }) → { open(), close(), toggle(), isOpen(), drawer }
*/
(function () {
  "use strict";
  var CSS = [
    ":where(:root){--sc-gut:16px;--sc-nmh:64px;--sc-u:calc(var(--sc-nmh) * 19.5 / 133);--sc-fg:#fff;--sc-muted:#a8a8a8;--sc-line:#2e2e2e;--sc-panel:rgba(8,8,8,.94);--sc-acc:#FF9900;--sc-sans:'Archivo',system-ui,sans-serif;--sc-mono:'IBM Plex Mono',ui-monospace,Menlo,monospace}",   /* zero specificity: a tool's own :root sets these */
    ".sc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
    /* the cover */
    "#sc-launch{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;font-family:var(--sc-sans)}",
    "#sc-launch .lc-frost{position:absolute;inset:0;background:rgba(10,13,16,.38);-webkit-backdrop-filter:blur(24px) saturate(1.15);backdrop-filter:blur(24px) saturate(1.15);transition:opacity 1.1s ease .15s,backdrop-filter 1.1s ease,-webkit-backdrop-filter 1.1s ease}",
    "#sc-launch .lc-body{position:absolute;inset:0;display:grid;grid-template-rows:minmax(0,1fr) auto minmax(0,1fr);justify-items:center;padding:0 16px;transition:opacity .7s ease,filter .7s ease,transform 1.1s ease}",
    "#sc-launch .lc-above{align-self:end;padding-bottom:clamp(18px,4.5vh,40px);display:flex;justify-content:center}",
    "#sc-launch .lc-below{align-self:start;padding-top:clamp(20px,5vh,44px);display:flex;flex-direction:column;align-items:center;gap:clamp(18px,3.4vh,32px)}",
    "#sc-launch .lc-sub{margin:0;font:600 11px/1.3 var(--sc-mono);letter-spacing:.28em;margin-right:-.28em;text-transform:uppercase;color:#fff;opacity:.82;text-align:center;text-shadow:0 1px 6px rgba(0,0,0,.35)}",
    "#sc-launch .sc-lockup{height:clamp(30px,6.5vh,60px);width:auto;fill:#fff;filter:drop-shadow(0 1px 6px rgba(0,0,0,.35))}",
    "#sc-launch .lc-title{margin:0;align-self:center;text-align:center;font:700 clamp(34px,11vw,96px)/1 'Minnerva Title','Minnerva','Anton',ui-sans-serif,system-ui,sans-serif;letter-spacing:.14em;margin-right:-.14em;color:#fff;text-shadow:0 0 40px rgba(0,0,0,.35)}",
    "#sc-launch .lc-go{padding:6px 10px;border:0;border-radius:0;background:none;color:#fff;display:flex;flex-direction:column;align-items:center;gap:clamp(10px,1.8vh,16px);font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;filter:drop-shadow(0 0 14px rgba(0,0,0,.35));transition:transform .2s ease,opacity .2s ease;opacity:.92}",
    "#sc-launch .lc-go:hover{transform:scale(1.06);opacity:1}#sc-launch .lc-go:focus-visible{outline:none}#sc-launch.kbd .lc-go:focus-visible{outline:2px solid #fff;outline-offset:4px}",
    "#sc-launch .lc-duck{position:relative;display:block;height:clamp(40px,9vh,74px);aspect-ratio:504.8/568.09}",
    "#sc-launch .lc-duck svg,#sc-launch .lc-duck img{position:absolute;inset:0;width:100%;height:100%;display:block}",
    "#sc-launch .lc-duck .sc-duck path{fill:#fff}",
    "#sc-launch .lc-duck .lc-duck-c{object-fit:fill;clip-path:inset(100% 0 0 0);transition:clip-path 1.6s cubic-bezier(.45,.05,.25,1)}",
    "#sc-launch .lc-duck img.lc-duck-c{inset:auto;left:2.45%;top:2.28%;width:94.97%;height:95.43%}",
    "#sc-launch .lc-duck svg.lc-duck-c path{fill:var(--sc-acc)}",
    "#sc-launch.ready .lc-duck-c{clip-path:inset(0 0 0 0)}",
    "#sc-launch .lc-word{font:600 12px/1 var(--sc-sans);letter-spacing:.32em;margin-right:-.32em;text-transform:uppercase;color:#fff;opacity:.9}",
    "#sc-launch .lc-foot{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom,0px));margin:0;text-align:center;font:500 10px/1 var(--sc-mono);letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.62);transition:opacity .7s ease}",
    "@media (max-height:460px){#sc-launch .lc-foot{bottom:calc(8px + env(safe-area-inset-bottom,0px))}#sc-launch .lc-below{padding-top:14px}#sc-launch .lc-above{padding-bottom:12px}}",
    "#sc-launch.going{pointer-events:none}#sc-launch.going .lc-foot{opacity:0}",
    "#sc-launch.going .lc-frost{opacity:0;backdrop-filter:blur(0);-webkit-backdrop-filter:blur(0)}",
    "#sc-launch.going .lc-body{opacity:0;filter:blur(10px);transform:scale(1.06)}",
    /* the marks */
    ".sc-nm{display:inline-block;vertical-align:top;height:100%;width:auto;aspect-ratio:188/133;background:currentColor;-webkit-mask:var(--sc-nm-img) center/contain no-repeat;mask:var(--sc-nm-img) center/contain no-repeat}",
    "#sc-mark{position:fixed;z-index:24;top:calc(var(--sc-gut) + env(safe-area-inset-top,0px));right:max(var(--sc-gut),env(safe-area-inset-right,0px));height:var(--sc-nmh);color:#fff;filter:drop-shadow(0 1px 4px rgba(0,0,0,.55));pointer-events:none;transition:opacity 1.2s ease}",
    "#sc-mark.tucked,html.sc-open #sc-mark{opacity:0}",
    "#sc-duckBtn{position:fixed;z-index:25;top:calc(10px + env(safe-area-inset-top,0px));left:max(10px,env(safe-area-inset-left,0px));width:48px;height:52px;display:grid;place-items:center;padding:0;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}",
    "#sc-duckBtn svg{width:34px;height:auto;display:block;filter:drop-shadow(0 1px 3px rgba(0,0,0,.55))}",
    "#sc-duckBtn .dk-base{fill:#fff}#sc-duckBtn .dk-fill{fill:#fff;transition:fill .15s}",
    "#sc-duckBtn:hover .dk-fill{fill:#a8a8a8}",
    "html.sc-open #sc-duckBtn .dk-base,html.sc-open #sc-duckBtn .dk-fill{fill:var(--sc-fg)}html.sc-open #sc-duckBtn svg{filter:none}",
    "#sc-duckBtn:focus-visible{outline:2px solid var(--sc-acc);outline-offset:2px}",
    "#sc-duckLab{position:fixed;z-index:24;top:calc(10px + env(safe-area-inset-top,0px));left:calc(max(10px,env(safe-area-inset-left,0px)) + 50px);height:52px;display:flex;align-items:center;font:600 12px/1 var(--sc-mono);letter-spacing:.16em;text-transform:uppercase;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.55);pointer-events:none;transition:opacity .45s ease,transform .6s cubic-bezier(.5,0,.78,.3)}",
    "#sc-duckLab.tucked,html.sc-open #sc-duckLab{opacity:0;transform:translateX(-1.4rem)}",
    "#sc-duckBtn:hover~#sc-duckLab.tucked,#sc-duckBtn:focus-visible~#sc-duckLab.tucked{opacity:1;transform:none;transition:opacity .2s ease,transform .3s cubic-bezier(.2,.7,.2,1)}",
    "html.sc-open #sc-duckBtn~#sc-duckLab{opacity:0!important;transform:translateX(-1.4rem)!important}",   /* open, the drawer's own head names it */
    /* the drawer */
    ".sc-drawer{position:fixed;z-index:20;top:0;left:0;bottom:0;right:auto;width:min(380px,92vw);height:auto;max-height:none;display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain;",
    "  background:var(--sc-panel);color:var(--sc-fg);border:0;border-right:1px solid var(--sc-line);padding:0 var(--sc-gut) 0 max(var(--sc-gut),env(safe-area-inset-left,0px));",
    "  transform:translateX(-102%);visibility:hidden;transition:transform .32s cubic-bezier(.2,.7,.2,1),visibility 0s .32s;font-family:var(--sc-sans);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}",
    "html.sc-open .sc-drawer{transform:none;visibility:visible;transition:transform .32s cubic-bezier(.2,.7,.2,1)}",
    ".sc-top{position:sticky;top:0;z-index:3;flex:none;display:flex;justify-content:flex-end;align-items:flex-start;height:calc(var(--sc-gut) + var(--sc-nmh) + 14px + env(safe-area-inset-top,0px));margin:0 calc(-1 * var(--sc-gut));padding:calc(var(--sc-gut) + env(safe-area-inset-top,0px)) var(--sc-gut) 0;background:linear-gradient(var(--sc-panel) 82%,transparent)}",
    ".sc-close{position:relative;height:var(--sc-nmh);min-width:44px;padding:0;border:0;background:none;color:var(--sc-fg);cursor:pointer}",
    ".sc-close:hover{opacity:.7}.sc-close:focus-visible{outline:2px solid var(--sc-acc);outline-offset:2px}",
    ".sc-idx{display:flex;flex-direction:column}",
    ".sc-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
    ".sc-name{margin:0;font:700 34px/1 'Minnerva Title','Minnerva','Anton',sans-serif;letter-spacing:.1em;color:var(--sc-fg);text-transform:uppercase}",
    ".sc-beta{display:inline-flex;align-items:center;height:22px;padding:0 9px;border:1.5px solid var(--sc-acc);border-radius:999px;color:var(--sc-acc);font:700 11px/1 var(--sc-mono);letter-spacing:.14em;text-transform:uppercase;flex:none}",
    ".sc-say{margin:3em 0 8px}.sc-say p{margin:0 0 8px;font-size:14px;line-height:1.5;max-width:38ch}",
    /* the Codex list */
    ".sc-idx .cx-grp{border-top:1px solid var(--sc-line);margin-top:14px}",
    ".sc-idx .cx-grpbtn{display:flex;align-items:center;gap:6px;width:100%;min-height:44px;padding:0;border:0;background:none;color:var(--sc-fg);cursor:pointer;font:600 13px/1 var(--sc-sans);text-align:left}",
    ".sc-idx .cx-ch{width:12px;height:12px;fill:none;stroke:var(--sc-muted);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s ease}",
    ".sc-idx .cx-grpbtn[aria-expanded=false] .cx-ch{transform:rotate(-90deg)}",
    ".sc-idx .cx-grp.cx-shut>.cx-gbody{display:none}",
    ".sc-idx .cx-lead,.sc-idx .cx-gbody>p{margin:0 0 8px;font-size:13px;line-height:1.45;max-width:38ch}",
    ".sc-idx .cx-gbody>.cx-lead:first-child,.sc-idx .cx-gbody>p:first-child{margin-top:2.9em}",
    ".sc-idx .cx-list{list-style:none;margin:0;padding:0}",
    ".sc-idx .cx-row{border-bottom:1px solid var(--sc-line)}",
    ".sc-idx .cx-go{display:grid;grid-template-columns:2.2em minmax(0,1fr) auto;align-items:baseline;width:100%;min-height:44px;padding:10px 0;border:0;background:none;color:var(--sc-fg);cursor:pointer;text-align:left}",
    ".sc-idx .cx-go i{font:500 11px/1 var(--sc-mono);font-style:normal;color:var(--sc-muted);font-variant-numeric:tabular-nums}",
    ".sc-idx .cx-go span{font:700 16px/1.2 var(--sc-sans)}",
    ".sc-idx .cx-f::before{content:'\\2212';font:500 13px/1 var(--sc-mono);color:var(--sc-muted)}",
    ".sc-idx .cx-row.cx-shut .cx-f::before{content:'+'}.sc-idx .cx-row.cx-shut .cx-body{display:none}",
    ".sc-idx .cx-body{padding:0 0 12px 2.2em}.sc-idx .cx-body p{margin:0 0 6px;font-size:13px;line-height:1.45;max-width:36ch}",
    ".sc-idx .cx-body a{color:inherit;text-underline-offset:3px}",
    ".sc-idx .cx-go:focus-visible,.sc-idx .cx-grpbtn:focus-visible{outline:2px solid var(--sc-acc);outline-offset:2px}",
    /* a guide row names a control: the control's own icon sits beside its name (copied from the button, so it cannot drift) */
    ".sc-idx .cx-go .cx-t{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}",
    ".sc-idx .cx-go .cx-gis{display:inline-flex;gap:4px;flex:none}",
    ".sc-idx .cx-row:has(.cx-gis) .cx-go{align-items:center}",
    ".sc-idx .cx-gi{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:rgb(var(--ui-g,14 14 16));color:var(--sc-fg);border:1px solid rgb(var(--ui-hi,255 255 255) / .14);flex:none}",
    ".sc-idx .cx-gi svg{width:18px;height:18px;display:block;overflow:visible}",
    ".sc-idx .cx-gi.t svg{fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}",
    ".sc-idx .cx-gpill{display:inline-flex;align-items:stretch;height:30px;border-radius:999px;overflow:hidden;background:rgb(var(--ui-g,14 14 16));border:1px solid rgb(var(--ui-hi,255 255 255) / .14);flex:none}",
    ".sc-idx .cx-gpill .cx-gi{border:0;border-radius:0;background:none;width:30px;height:28px}.sc-idx .cx-gpill .cx-gi+.cx-gi{border-left:1px solid rgb(var(--ui-hi,255 255 255) / .12)}",
    /* what a long press reveals, under the row's text */
    ".sc-idx .cx-body .lp{display:flex;align-items:baseline;gap:7px;margin:6px 0 4px;font-size:13px;line-height:1.4;max-width:36ch}",
    ".sc-idx .cx-body .lp::before{content:'';flex:none;width:7px;height:7px;border-radius:50%;background:var(--sc-acc);transform:translateY(-1px)}",
    ".sc-idx .cx-body .lp b{flex:none;color:var(--sc-acc)}",
    /* the colophon */
    ".sc-idx .cx-grp.sc-colo{border-top:2px solid var(--sc-fg);margin-top:auto}",
    ".sc-ratio{display:flex;height:4px;margin:6px 0;background:var(--sc-line)}.sc-ratio i{display:block;background:var(--sc-fg)}",
    ".sc-made{list-style:none;margin:0;padding:0}",
    ".sc-made li{display:flex;justify-content:space-between;align-items:baseline;gap:8px;min-height:26px;font-size:13px}",
    ".sc-made small{font:inherit;color:var(--sc-muted);white-space:nowrap}",
    ".sc-made li.sc-gh{display:block;min-height:0;margin:14px 0 2px;font:500 10px/1.2 var(--sc-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--sc-muted)}",
    ".sc-made li.sc-gh:first-child{margin-top:4px}",
    ".sc-made .sc-by{display:block;margin:1px 0 4px;font-size:12px;line-height:1.35;color:var(--sc-muted)}",
    ".sc-made a{color:inherit;text-underline-offset:3px}",
    ".sc-lic{margin:6px 0 4px;font-size:12px;color:var(--sc-muted)}",
    ".sc-lic summary{display:flex;align-items:center;gap:6px;min-height:32px;cursor:pointer;list-style:none;font-size:13px}",
    ".sc-lic summary::-webkit-details-marker{display:none}.sc-lic summary::before{content:'+';font:500 12px/1 var(--sc-mono);width:1ch}",
    ".sc-lic[open]>summary::before,.sc-lic section details[open]>summary::before{content:'\\2212'}",
    ".sc-lic pre{margin:4px 0 8px;white-space:pre-wrap;font:400 10.5px/1.45 var(--sc-mono);color:var(--sc-muted)}",
    ".sc-end{display:flex;flex-direction:column;align-items:flex-start;padding:14px 0 calc(16px + env(safe-area-inset-bottom,0px))}",
    ".sc-word{height:calc(var(--sc-u) * 132 / 114.75);width:auto;display:block;fill:var(--sc-fg);margin:12px 0 8px}",
    ".sc-own{margin-top:14px}",
    ".sl-pick{display:flex;align-items:center;gap:10px;min-height:44px}.sl-cap{font:500 10px/1 var(--sc-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--sc-muted)}",
    ".sl-pick select{min-height:44px;padding:0 8px;background:transparent;color:var(--sc-fg);border:1px solid var(--sc-line);border-radius:0;font:400 14px var(--sc-sans)}",
    "@media (prefers-reduced-motion:reduce){#sc-launch .lc-frost,#sc-launch .lc-body{transition:opacity .2s ease}#sc-launch.going .lc-body{filter:none;transform:none}#sc-launch .lc-duck-c{transition:none}#sc-mark,.sc-drawer{transition:none}#sc-duckLab{transition:opacity .3s}#sc-duckLab.tucked{transform:none}}"
  ].join("\n");

  var CH = '<svg class="cx-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function link(h, t) { var a = el("a", null, t); a.href = h; a.target = "_blank"; a.rel = "noopener"; return a; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* a section in the Codex list: a header button with its chevron, and a body */
  function section(id, title, body, shut) {
    var s = el("section", "cx-grp" + (shut ? " cx-shut" : "")); s.id = id;
    var b = el("button", "cx-grpbtn"); b.type = "button"; b.setAttribute("aria-expanded", String(!shut));
    b.innerHTML = "<span>" + esc(title) + "</span>" + CH;
    var g = el("div", "cx-gbody"); g.id = id + "-body"; b.setAttribute("aria-controls", g.id);
    if (typeof body === "string") g.innerHTML = body; else if (body) g.append(body);
    b.addEventListener("click", function () { var on = s.classList.toggle("cx-shut"); b.setAttribute("aria-expanded", String(!on)); });
    s.append(b, g); return s;
  }
  /* a numbered row in a section, folding on its name */
  /* r (optional): { icons: ['#buttonId', 'ic:name', '<svg…>'], pill: true, hold: 'what a long press reveals' } */
  var PENDING = [];
  function row(n, title, body, shut, r) {
    r = r || {};
    var li = el("li", "cx-row" + (shut ? " cx-shut" : ""));
    var b = el("button", "cx-go"); b.type = "button"; b.setAttribute("aria-expanded", String(!shut));
    b.innerHTML = "<i>" + String(n).padStart(2, "0") + "</i><span class=\"cx-t\"><span>" + esc(title) + "</span></span><b class=\"cx-f\" aria-hidden=\"true\"></b>";
    if (r.icons && r.icons.length) PENDING.push({ host: b.querySelector(".cx-t"), icons: r.icons, pill: !!r.pill, drop: r.drop || {} });
    var d = el("div", "cx-body"); if (typeof body === "string") d.innerHTML = body; else d.append(body);
    if (r.hold) { var lp = el("p", "lp"); lp.innerHTML = "<b>Hold</b> <span>" + r.hold + "</span>"; d.append(lp); }
    b.addEventListener("click", function () { var on = li.classList.toggle("cx-shut"); b.setAttribute("aria-expanded", String(!on)); });
    li.append(b, d); return li;
  }

  /* the guide's icons, filled in once the page has its buttons and the tool its icon set:
     '#id' copies that button's svg (ids stripped, resting state only: drop[id] names parts to remove),
     'ic:name' asks the tool (mount option icon: name → svg inner markup, drawn as strokes), '<svg' is used as given */
  function fillIcons(src) {
    PENDING.splice(0).forEach(function (p) {
      var cells = [];
      p.icons.forEach(function (k) {
        var svg = null, stroke = false;
        if (k.charAt(0) === "#") { var btn = document.querySelector(k); var o = btn && btn.querySelector("svg"); if (o) { svg = o.cloneNode(true); if (p.drop[k]) svg.querySelectorAll(p.drop[k]).forEach(function (x) { x.remove(); }); } }
        else if (k.indexOf("ic:") === 0 && src) { var m = src(k.slice(3)); if (m) { var w = el("span"); w.innerHTML = '<svg viewBox="0 0 24 24">' + m + "</svg>"; svg = w.firstChild; stroke = true; } }
        else if (/^\s*<svg/.test(k)) { var w2 = el("span"); w2.innerHTML = k; svg = w2.firstChild; }
        if (!svg) return;
        svg.removeAttribute("id"); svg.querySelectorAll("[id]").forEach(function (x) { x.removeAttribute("id"); });
        svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false"); svg.removeAttribute("style");
        var c = el("span", "cx-gi" + (stroke ? " t" : "")); c.setAttribute("aria-hidden", "true"); c.append(svg); cells.push(c);
      });
      if (!cells.length) return;
      var box = el("span", p.pill ? "cx-gpill" : "cx-gis"); box.setAttribute("aria-hidden", "true"); cells.forEach(function (c) { box.append(c); });
      p.host.insertBefore(box, p.host.firstChild);
    });
  }

  /* the colophon, from data: the essentials first (Dimitry, 17 Oct: credit the foundations, not only code and fonts) */
  function colophon(c, name, version) {
    var ol = el("ol", "cx-list"), n = 0;
    if (c.about) ol.append(row(++n, "About the artist", c.about, true));
    if (c.approach) ol.append(row(++n, "Approach", c.approach, true));
    if ((c.foundations && c.foundations.length) || (c.credits && c.credits.length) || c.openSource) {
      var box = el("div");
      if (c.openSource) { var p = el("p"); p.innerHTML = c.openSource; box.append(p); }
      var ul = el("ul", "sc-made"), g = "";
      var head = function (t) { var h = el("li", "sc-gh", t); h.setAttribute("role", "presentation"); ul.append(h); };
      (c.foundations || []).forEach(function (f) {
        if (f.group !== g) { g = f.group; head(g); }
        var li = el("li"), b = el("b"); b.style.fontWeight = "400"; b.append(f.url ? link(f.url, f.name) : f.name);
        b.append(el("span", "sc-by", f.by + (f["for"] ? " — " + f["for"] : ""))); li.append(b, el("small", null, f.label)); ul.append(li);
      });
      var full = el("details", "sc-lic"); full.append(el("summary", null, "The licenses, in full"));
      (c.credits || []).forEach(function (k) {
        var kind = k.kind === "code" ? "Code" : k.kind === "type" ? "Type" : (k.kind || "Code");
        if (kind !== g) { g = kind; head(kind); }
        var t = k.name + (k.version ? " " + k.version : ""), li = el("li"), b = el("b"); b.style.fontWeight = "400";
        b.append(k.url ? link(k.url, t) : t); if (k["for"]) b.append(el("span", "sc-by", k["for"]));
        li.append(b, el("small", null, k.licence)); ul.append(li);
        var sec = el("section"), d = el("details"); d.setAttribute("name", "sc-lic"); d.append(el("summary", null, t + " · " + k.licence));
        if (k.copyright && (!k.text || k.text.indexOf(k.copyright) < 0)) d.append(el("p", null, k.copyright));
        if (k.text) d.append(el("pre", null, k.text)); sec.append(d); full.append(sec);
      });
      box.append(ul); if ((c.credits || []).length) box.append(full);
      ol.append(row(++n, "Open source", box, true));
    }
    if (c.ai) {
      var a = el("div"), h = Math.max(0, Math.min(100, c.ai.human || 0));
      a.append(el("p", null, h + "% human, " + (100 - h) + "% AI, by the artist’s own estimate."));
      var bar = el("div", "sc-ratio"); bar.setAttribute("aria-hidden", "true"); var i = el("i"); i.style.width = h + "%"; bar.append(i); a.append(bar);
      /* the studio's position, the same in every tool (Dimitry, 18 Oct 2026): tools with AI, not art with AI.
         Off with ai.statement: false; the tool's own note follows it. */
      if (c.ai.statement !== false) {
        var st = el("p"); st.append(el("b", null, "I make tools with AI, not art with AI."), document.createTextNode(" "),
          document.createTextNode(fill(AI_SAY, { name: name || "This tool" }))); a.append(st);
      }
      if (c.ai.note) { var q = el("p"); q.innerHTML = c.ai.note; a.append(q); }
      ol.append(row(++n, "AI ratio", a, true));
    }
    if (c.privacy) ol.append(row(++n, "Your work stays with you, on your device", c.privacy, true));
    if (c.contact) {
      var ct = el("div");
      if (c.contact.lead) { var l = el("p", "sfs-prose"); l.innerHTML = c.contact.lead; ct.append(l); }
      if (c.contact.email) { var e = el("p"), m = el("a", null, c.contact.email); m.href = "mailto:" + c.contact.email; m.setAttribute("aria-label", "Email " + c.contact.email); e.append(m); ct.append(e); }
      (c.contact.links || []).forEach(function (x) { var p = el("p"); p.append(link(x.url, x.label)); ct.append(p); });
      ol.append(row(++n, "Contact", ct, true));
    }
    /* accessibility and accommodations, in every colophon (Dimitry, 18 Oct): we try our best, tell us, ADA on request.
       It states an aim, not a conformance claim: nothing here has been audited. The words are in lang/chrome.csv. */
    var mail = (c.contact && c.contact.email) || "hi@chamy.xyz";
    if (c.access !== false) {
      var ax = el("div");
      ax.append(el("p", "sfs-prose", "We try our best to make this work for everyone: by keyboard, by screen reader and by touch, aiming to meet WCAG 2.2 at level AA. It is a work in progress, and some parts may still fall short."));
      ax.append(el("p", "sfs-prose", "If something does not work for you, or you need an accommodation under the Americans with Disabilities Act (ADA), write to " + mail + " and we will do what we can, as quickly as we can."));
      var ap = el("p"), am = el("a", null, mail); am.href = "mailto:" + mail + "?subject=Accessibility"; am.setAttribute("aria-label", "Email " + mail); ap.append(am); ax.append(ap);
      if (typeof c.access === "string") { var ex = el("div"); ex.innerHTML = c.access; ax.append(ex); }
      ol.append(row(++n, "Accessibility", ax, true));
    }
    if (c.license || c.disclaimer !== false) {
      var lc = el("div"); if (c.license) lc.innerHTML = c.license;
      if (c.disclaimer !== false) lc.append(el("p", null, "Offered in good faith, as is: we test it and fix what we find, but cannot promise it is free of faults. If something goes wrong, tell us."));
      ol.append(row(++n, "License", lc, true));
    }
    if (window.SurfaceLang && c.language !== false) { var lw = el("div"); window.SurfaceLang.picker(lw); ol.append(row(++n, "Language", lw, true)); }
    if (version) ol.append(row(++n, "Version", "<p>" + esc(name) + " " + esc(version) + " beta</p>", true));
    var s = section("sc-colo", "Colophon", ol, true); s.classList.add("sc-colo"); return s;
  }

  var AI_SAY = "{name} was built in conversation with Claude (Anthropic): AI scaffolds the tool, and the tool makes the art possible. Nothing it makes, no image, sound or motion, comes from a generative model. The concept, the direction, the questions and the testing on real phones, tablets and computers are human, and so are the foundations credited here. Part of this work is to show that AI need not make people less capable or stand in for the artist: used this way, it asks more of us, not less.";
  function fill(t, v) { return t.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }

  function mount(o) {
    o = o || {};
    var M = window.SurfaceMarks || {};
    if (!document.getElementById("sc-css")) { var st = document.createElement("style"); st.id = "sc-css"; st.textContent = CSS; document.head.appendChild(st); }
    var root = document.documentElement;
    if (M.namemark) root.style.setProperty("--sc-nm-img", 'url("' + M.namemark + '")');

    /* marks: duck-rabbit + INDEX top left, namemark top right */
    var duck = el("button"); duck.id = "sc-duckBtn"; duck.type = "button"; duck.innerHTML = M.duck || "";
    duck.setAttribute("aria-expanded", "false"); duck.setAttribute("aria-label", "Index: what " + (o.name || "this tool") + " is, its settings and how it is made. Opens the drawer on the left (p)");
    var lab = el("span", null, "Index"); lab.id = "sc-duckLab"; lab.setAttribute("aria-hidden", "true");
    var mark = el("div"); mark.id = "sc-mark"; mark.setAttribute("aria-hidden", "true"); mark.setAttribute("translate", "no"); mark.append(el("span", "sc-nm"));
    document.body.append(duck, lab, mark);

    /* the drawer: an existing element the tool names, or a new one */
    var drawer = typeof o.drawer === "string" ? document.querySelector(o.drawer) : o.drawer;
    var own = null;
    if (drawer) { own = el("div", "sc-own"); while (drawer.firstChild) own.append(drawer.firstChild); }
    else { drawer = el("aside"); document.body.append(drawer); }
    drawer.classList.add("sc-drawer"); drawer.setAttribute("aria-label", (o.name || "Tool") + ": index and settings"); drawer.id = drawer.id || "sc-drawer";
    duck.setAttribute("aria-controls", drawer.id);
    var close = el("button", "sc-close"); close.type = "button"; close.append(el("span", "sc-nm")); close.setAttribute("aria-label", "Dimitry Saïd Chamy. Closes the drawer");
    var idx = el("div", "sc-idx"); idx.id = "sc-idx";
    var head = el("div", "sc-head"), h = el("h2", "sc-name", o.name || ""); h.setAttribute("translate", "no"); head.append(h);
    var beta = el("span", "sc-beta", "Beta"); beta.title = "Beta: still changing, and some things may not work yet"; head.append(beta);
    idx.append(head);
    if (o.intro) { var say = el("div", "sc-say"); say.innerHTML = o.intro; idx.append(say); }
    (o.sections || []).forEach(function (x) {
      var body = x.el || x.html || "";
      if (x.rows) {   /* numbered rows, the Codex list: [{ title, html }] */
        var f = document.createDocumentFragment();
        if (x.lead) { var ld = el("p", "cx-lead"); ld.innerHTML = x.lead; f.append(ld); }
        var ol = el("ol", "cx-list"); x.rows.forEach(function (r, i) { ol.append(row(i + 1, r.title, r.html, !!r.shut, r)); }); f.append(ol); body = f;
      }
      idx.append(section(x.id, x.title, body, x.open === false));
    });
    var top = el("div", "sc-top"); top.append(close); drawer.append(top, idx);
    if (own) idx.append(o.ownTitle ? section("sc-own", o.ownTitle, own, false) : own);   /* the tool's own controls: under its sections, above the colophon */
    if (o.colophon) idx.append(colophon(o.colophon, o.name || "", o.version || o.colophon.version));
    var end = el("div", "sc-end"); end.setAttribute("translate", "no"); end.innerHTML = M.word || ""; drawer.append(end);
    if (window.SurfaceSections) try { window.SurfaceSections.mount({ root: idx, key: o.key || "tool", section: ".cx-grp", fixed: ".sc-colo", label: "Index", briefScope: drawer, start: o.start }); } catch (e) { console.warn("sections", e); }

    /* open and close */
    var isOpen = function () { return root.classList.contains("sc-open"); };
    /* o.openClass: a class the tool already reads on its drawer ("open"); kept in step both ways, so its own code needs no change */
    var oc = o.openClass, syncing = false;
    var set = function (v) {
      v = !!v; if (v === isOpen() && (!oc || drawer.classList.contains(oc) === v)) return;
      syncing = true; root.classList.toggle("sc-open", v); if (oc) drawer.classList.toggle(oc, v); syncing = false;
      duck.setAttribute("aria-expanded", String(v));
      if (v) { if (o.onOpen) o.onOpen(); } else if (o.onClose) o.onClose();
    };
    if (oc) {
      if (drawer.classList.contains(oc)) set(true);
      new MutationObserver(function () { if (!syncing && drawer.classList.contains(oc) !== isOpen()) set(drawer.classList.contains(oc)); }).observe(drawer, { attributes: true, attributeFilter: ["class"] });
    }
    duck.addEventListener("click", function () { set(!isOpen()); });
    close.addEventListener("click", function () { set(false); duck.focus(); });
    addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) { set(false); duck.focus(); }
      if ((e.key === "p" || e.key === "P") && !e.metaKey && !e.ctrlKey && !e.altKey && !/input|textarea|select/i.test((e.target.tagName || "")) && !e.target.isContentEditable && !o.noKey) set(!isOpen());
    });

    /* the marks on arrival: there as the work opens, then they step away */
    var tuck = function () { mark.classList.add("tucked"); lab.classList.add("tucked"); }, untuck = function () { mark.classList.remove("tucked"); lab.classList.remove("tucked"); };
    setTimeout(tuck, 2800);

    /* the launch cover */
    var want = true;
    try { var q = new URLSearchParams(location.search).get("cover"); if (q === "0" || (q !== "1" && navigator.webdriver)) want = false; } catch (e) {}
    if (want && o.cover !== false) {
      var lc = el("div"); lc.id = "sc-launch"; lc.setAttribute("role", "dialog"); lc.setAttribute("aria-modal", "true"); lc.setAttribute("aria-label", o.name || "Launch");
      var fill = o.duckFill ? '<img class="lc-duck-c" alt="" src="' + o.duckFill + '">' : (M.duck || "").replace('class="sc-duck"', 'class="sc-duck lc-duck-c"');
      lc.innerHTML = '<div class="lc-frost"></div><div class="lc-body"><div class="lc-above">' + (M.lockup || "") + '</div>' +
        '<h1 class="lc-title" aria-hidden="true" translate="no">' + esc((o.name || "").toUpperCase()) + '</h1>' +
        '<div class="lc-below">' + (o.sub ? '<p class="lc-sub">' + esc(o.sub) + '</p>' : '') + '<button type="button" class="lc-go" aria-label="Launch ' + esc(o.name || "") + '"><span class="lc-duck" aria-hidden="true">' + (M.duck || "") + fill + '</span><span class="lc-word">Launch</span></button></div></div>' +
        (o.version ? '<p class="lc-foot" aria-hidden="true">Beta · v' + esc(o.version) + '</p>' : "");
      lc.querySelectorAll("svg").forEach(function (s) { s.setAttribute("aria-hidden", "true"); s.setAttribute("focusable", "false"); });
      document.body.append(lc);
      for (var i = 0; i < document.body.children.length; i++) { var c = document.body.children[i]; if (c !== lc && c.tagName !== "SCRIPT") c.setAttribute("inert", ""); }
      ["keydown", "keyup"].forEach(function (t) { lc.addEventListener(t, function (e) { e.stopPropagation(); }); });
      lc.addEventListener("keydown", function () { lc.classList.add("kbd"); }, { once: true });
      var go = lc.querySelector(".lc-go"); try { go.focus({ preventScroll: true }); } catch (e) {}
      var up = function () { requestAnimationFrame(function () { requestAnimationFrame(function () { lc.classList.add("ready"); }); }); };
      if (document.readyState === "complete") up(); else addEventListener("load", up, { once: true });
      go.addEventListener("click", function () {
        for (var i = 0; i < document.body.children.length; i++) document.body.children[i].removeAttribute("inert");
        lc.classList.add("going"); untuck(); setTimeout(tuck, 2800);
        var slow = !matchMedia("(prefers-reduced-motion: reduce)").matches;
        setTimeout(function () { lc.remove(); }, slow ? 1500 : 250);
        if (o.onLaunch) o.onLaunch();
      });
    }
    /* the guide's icons wait for the page: the tool's own script draws some of them (o.icon: name → svg markup) */
    var icons = function () { fillIcons(typeof o.icon === "function" ? o.icon : null); };
    if (document.readyState === "complete") setTimeout(icons, 0); else addEventListener("load", icons, { once: true });
    return { open: function () { set(true); }, close: function () { set(false); }, toggle: function () { set(!isOpen()); }, isOpen: isOpen, drawer: drawer, index: idx };
  }
  window.SurfaceChrome = { mount: mount };
})();
