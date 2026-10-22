/* Surface · Paths — learning paths: numbered checklists of features that work well together (Dimitry, 19 Oct 2026).

   1. A SECTION IN THE INDEX. One row per path, numbered 01, 02 … and ordered from the first thing to try to the
      deepest. Each row is a checklist. The steps tick themselves when the person actually does the thing: the tool
      calls SurfacePaths.done('step-id') from its own code, so nobody ticks a box without learning it.
      Each path has a color; its number in the index is a pill in that color, its steps are circles in it, empty
      until done, filled once done. Every step ends with a link: "take me there" goes to the control that does it.
      The link is a real deep link (#go-step), so it can be copied and sent; #path-01 opens a path in the index.
   2. BADGES ON THE INTERFACE. The same numbers, in the same colors, sit on the controls each path teaches, so the
      checklist points at the interface and the interface points back. A finished path's badge turns to a tick.
      Controls inside o.below (Current: the bar) carry theirs as a small dot off the control's lower right (22 Oct; it was a pill
      centred on the bar's bottom line); those badges are buttons: a tap opens a hint (the path, its
      steps as circles, the next step) with "take me there" (the path in the index) and "show me" (the next step's
      control). Everywhere else the badge sits on the control's corner, a mark only.
      Badges hide with the controls (the tool's bare mode) and whenever the marks are off.
   3. SUGGESTIONS (after BakerBacker's setup to-do, Dimitry, 19 Oct 2026). SurfacePaths.nag() after the tool opens:
      once a visit, from the second visit or the first tick, a small card above the bar with the progress and the
      next step or two, each one tap away; it goes by itself unless touched. SurfacePaths.meter(host) puts the
      progress, one segment per path in its color, under a launch cover's start button.
   4. SWITCHES. "Paths", On or Off, and "Suggestions", On or Off: rows in the tool's Settings, remembered on this device.
      Off hides the badges and the section (progress is kept); Suggestions off stops the card and the meter.
   5. REWARDS. A path can give something when its last step ticks (Current: a bonus look); every path walked can give a
      finale (Current: a downloadable pack). Progress lives in this browser only: no accounts, so a reward is a gift,
      never a credit with value. Save progress / load progress carry it to another browser (Safari can clear a site's
      storage after about a week without a visit).
   6. THE FIRST DISCOVERY (Dimitry, 20 Oct 2026). The very first step anyone ticks, on a device with no progress yet, is
      a moment: instead of a toast, a card above the bar says they found their first path step and, in a few lines,
      what the paths are (the checklists, the numbers on the controls, the rewards), with "see the paths" one tap away.
      Shown once per tool, per device. A tool steers that first tick by making its "start here" control (Current: the
      speaker) step one of path 01, so following the hint is the discovery.

   Plain script, window.SurfacePaths, no dependencies (uses SurfaceLinks and SurfaceSections when present).
     SurfacePaths.mount({
       key: 'current',                          // progress is kept per tool
       after: '#guide',                         // the index section the Paths section follows
       settings: '#displayL',                   // where the switch rows go (before its last note)
       below: '#playbar',                       // badges on controls in here sit under them, as buttons
       nagAbove: '#playbar',                    // the suggestion card sits above this
       title: 'Paths', lead: '…',
       icon: 'hat',                             // beside the word Paths: 'hat' (default: it is about learning),
                                                //   'ribbon' (what you win), 'earn' (the hat, and the ribbon once every path is walked), or false
       paths: [{ id: '01', title: 'First current', color: '#55b8c9', note: '…', advanced: false,
                 steps: [{ id: 'look', label: 'Change the look with ‹ or ›', go: '#pNext' }, …],
                 badges: ['#pPrev', '#pNext'],  // where the number sits
                 reward: { label: 'a bonus look', give: () => …, given: 'Unlocked: … (in your looks)' } }, …],
       front: (step, path) => …,                // bring the tool forward (and open the shelf a step's control is on)
       finale: { label: 'the pack', give: () => …, button: 'download the pack' },
       save: (name, blob) => …,                 // how the tool saves a file (progress export)
       toast: msg => …                          // how the tool speaks (a tick, a finished path)
       first: { title: '…', body: '…html…', open: 'see the paths', stay: 24000 }   // the first-discovery card (6)
     })
     step.go: a selector (the control), a function, or { link: 'name' } (a SurfaceLinks name); default: the path's
       first badge. The control is outlined in the path's color for a moment, and focused.
     SurfacePaths.done('look')  isDone('look')  on / set('off')  open('01')  go('look')  nag()  meter(host, {go})
   Events: 'surface:paths' on document, detail { step, path, all }. */
(function () {
  "use strict";
  var PAL = ["#55b8c9", "#ff6fa5", "#e8b04a", "#a78bfa", "#6fd08c", "#ff8a5c", "#7fb2ff", "#f2d36b"];
  var MONO = "var(--mono,ui-monospace,Menlo,monospace)";
  var CSS = [
    /* corner badge: a mark on a control */
    ".sp-b{position:absolute;top:-5px;right:-5px;z-index:3;min-width:17px;height:17px;padding:0 3px;box-sizing:border-box;border-radius:9px;display:grid;place-items:center;",
    "  font:700 9px/1 " + MONO + ";letter-spacing:0;color:#0b0f10;background:var(--sp-c,#55b8c9);box-shadow:0 0 0 1.5px rgba(0,0,0,.55);pointer-events:none;",
    "  transition:transform .3s ease,opacity .3s ease}",
    ".sp-b.done{background:rgba(14,14,16,.72);color:var(--sp-c,#55b8c9);box-shadow:inset 0 0 0 1.5px var(--sp-c,#55b8c9),0 0 0 1.5px rgba(0,0,0,.55);font-size:10px}",
    /* under-badge: a button centred under its control, on the row's bottom line */
    /* two :not(#…) give these the weight of two ids, so a row's own button rule (#playbar>button) cannot size them */
    /* (Dimitry, 22 Oct: the pills under the bar were obtrusive) a small dot: filled with one digit while the path is open,
       a ring with a tiny tick once it is walked, in the path's color; off the control's lower right, never touching it */
    ".sp-b.sp-bb:not(#sp-0):not(#sp-1){top:0;right:auto;left:0;width:13px;height:13px;min-width:0;padding:0;margin:0;border:0;border-radius:50%;translate:-50% 0;transform:none;flex:none;",
    "  display:grid;place-items:center;background:var(--sp-c,#55b8c9);color:#0b0f10;box-shadow:0 0 0 1px rgba(0,0,0,.5);backdrop-filter:none;-webkit-backdrop-filter:none;",
    "  pointer-events:auto;cursor:pointer;-webkit-tap-highlight-color:transparent;font:700 8px/1 " + MONO + ";letter-spacing:0}",
    ".sp-b.sp-bb.done:not(#sp-0):not(#sp-1){background:rgba(14,14,16,.7);color:var(--sp-c,#55b8c9);box-shadow:inset 0 0 0 1.25px var(--sp-c,#55b8c9),0 0 0 1px rgba(0,0,0,.5)}",
    ".sp-b.sp-bb:not(#sp-0):not(#sp-1) svg{width:8px;height:8px;min-width:0;margin:0;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}",
    ".sp-bb::before{content:\"\";position:absolute;inset:-8px}",
    ".sp-bb:not(#sp-0):not(#sp-1):hover{filter:brightness(1.12)}.sp-bb:focus-visible{outline:2px solid #fff;outline-offset:2px}",
    ".sp-bb[hidden]:not(#sp-0){display:none}",
    "html:not([data-paths=on]) .sp-b,html.bare .sp-b{display:none!important}",
    ".sp-flash .sp-b,.sp-b.flash{animation:sp-flash .9s ease-in-out 3}",
    "@keyframes sp-flash{0%,100%{transform:scale(1)}50%{transform:scale(1.55)}}",
    "html:not([data-paths=on]) .sp-sec{display:none!important}",
    /* the index */
    ".sp-row>.cx-go{grid-template-columns:auto minmax(0,1fr) auto auto;column-gap:10px;align-items:center}",
    ".sp-row>.cx-body{padding-left:34px}",
    ".sp-row>.cx-go>i.sp-num{display:inline-grid;place-items:center;min-width:24px;height:16px;padding:0 5px;box-sizing:border-box;border-radius:8px;background:var(--c);color:#0b0f10;font:700 9.5px/1 " + MONO + ";letter-spacing:.04em}",
    ".sp-row.sp-full>.cx-go>i.sp-num{background:none;color:var(--fg,inherit);box-shadow:inset 0 0 0 1.5px var(--c)}",
    ".sp-row.sp-hl{animation:sp-hl 1.6s ease}",
    "@keyframes sp-hl{0%,40%{background:color-mix(in srgb,var(--c) 16%,transparent)}100%{background:transparent}}",
    ".sp-c{margin-left:auto;padding-left:0;font:500 10px/1 " + MONO + ";letter-spacing:.08em;color:var(--muted,#888);font-style:normal;white-space:nowrap}",
    ".sp-row.sp-full .sp-c{color:var(--fg,inherit)}",
    ".sp-adv{margin-left:8px;font:600 9px/1 " + MONO + ";letter-spacing:.14em;text-transform:uppercase;color:var(--path,#ff6a3d)}",
    ".sp-list{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:2px}",
    ".sp-step{display:grid;grid-template-columns:18px minmax(0,1fr) 30px;gap:9px;align-items:center;font-size:13px;line-height:1.4;color:var(--fg,inherit);min-height:30px}",
    ".sp-box{width:13px;height:13px;border:1.5px solid var(--c);border-radius:50%;box-sizing:border-box;transition:background .3s ease}",
    ".sp-step.done .sp-box{background:var(--c)}",
    ".sp-step.done .sp-lab{color:var(--muted,#888)}",
    ".sp-step.fresh .sp-box{animation:sp-pop .5s ease}",
    "@keyframes sp-pop{0%{transform:scale(.6)}60%{transform:scale(1.35)}100%{transform:scale(1)}}",
    ".sp-go{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;color:var(--muted,#888);text-decoration:none}",
    ".sp-go:hover,.sp-go:focus-visible{color:var(--fg,inherit);background:color-mix(in srgb,var(--c) 18%,transparent)}",
    ".sp-go svg,.sp-ln svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
    ".sp-note{margin:0 0 4px;font-size:12px;line-height:1.45;color:var(--muted,#888)}",
    ".sp-gift{margin:10px 0 0;font-size:12px;line-height:1.45;color:var(--muted,#888)}",
    ".sp-gift b{color:var(--fg,inherit);font-weight:600}",
    ".sp-where{margin-top:8px;padding:0;border:0;background:none;color:var(--accent,#1f7a8c);cursor:pointer;font:500 10.5px/1 " + MONO + ";letter-spacing:.1em;text-transform:uppercase;min-height:32px}",
    ".sp-foot{display:flex;flex-wrap:wrap;align-items:center;gap:4px 16px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line,#ddd)}",
    ".sp-tot{font:500 10.5px/1 " + MONO + ";letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#888);margin-right:auto}",
    ".sp-foot button{min-height:32px;padding:0;border:0;background:none;color:var(--muted,#888);cursor:pointer;font:500 10.5px/1 " + MONO + ";letter-spacing:.1em;text-transform:uppercase}",
    ".sp-foot button:hover,.sp-foot button:focus-visible,.sp-where:hover{color:var(--fg,inherit)}",
    ".sp-fin{margin:12px 0 0;padding:10px 12px;border:1px solid var(--accent,#1f7a8c);font-size:12.5px;line-height:1.45}",
    ".sp-fin button{margin-top:8px;font:600 12px var(--sans,inherit);padding:8px 12px;border:1px solid var(--fg,#000);background:var(--fg,#000);color:var(--bg,#fff);cursor:pointer}",
    ".sp-ic{display:inline-block;width:1.35em;height:1.35em;margin:-.3em .45em -.3em 0;vertical-align:middle;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}",
    ".sp-icw{display:contents;font-style:normal}",
    ".sp-cover .sp-ic{width:14px;height:14px;margin:-3px 6px -3px 0}",
    /* the meter: one segment per path, filled in its color */
    ".sp-meter{display:flex;gap:3px;height:4px}.sp-meter>i{position:relative;flex:var(--n) 1 0;border-radius:2px;overflow:hidden;background:rgb(var(--ui-hi,255 255 255) / .16)}",
    ".sp-meter>i>b{position:absolute;inset:0 auto 0 0;width:var(--f);background:var(--c);border-radius:inherit;transition:width .6s cubic-bezier(.2,.8,.2,1)}",
    /* hint and suggestion cards: Surface's panel chrome (pop.js), drawn here so they stand alone */
    ".sp-pop,.sp-nag{position:fixed;z-index:61;box-sizing:border-box;width:min(300px,calc(100vw - 24px));border-radius:18px;overflow:hidden;background:rgb(var(--ui-g,14 14 16) / .9);",
    "  border:1px solid rgb(var(--ui-hi,255 255 255) / .14);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);color:var(--ui-ink,#eef1f2);font:14px/1.4 var(--sans,system-ui,sans-serif)}",
    ".sp-pop[hidden],.sp-nag[hidden]{display:none}",
    ".sp-hd{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 4px 0 14px;border-bottom:1px solid rgb(var(--ui-hi,255 255 255) / .08);font:500 10px/1.2 " + MONO + ";letter-spacing:.16em;text-transform:uppercase;color:var(--ui-dim,#a8a8a8)}",
    ".sp-hd>span{flex:1;min-width:0}.sp-hd b{color:var(--ui-ink,#fff);font-weight:500}",
    ".sp-x{width:36px;height:36px;display:grid;place-items:center;padding:0;border:0;background:none;color:var(--ui-dim,#8f8f8f);cursor:pointer}",
    ".sp-x:hover{color:var(--ui-ink,#fff)}.sp-x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}",
    ".sp-pip{flex:none;display:inline-grid;place-items:center;min-width:22px;height:15px;padding:0 5px;box-sizing:border-box;border-radius:8px;background:var(--c);color:#0b0f10;font:700 8.5px/1 " + MONO + ";letter-spacing:.04em}",
    ".sp-bd{padding:12px 14px 14px;display:grid;gap:10px}",
    ".sp-dots{display:flex;align-items:center;gap:6px;font:500 10px/1 " + MONO + ";letter-spacing:.1em;color:var(--ui-dim,#a8a8a8)}",
    ".sp-dots i{width:10px;height:10px;border-radius:50%;box-sizing:border-box;border:1.5px solid var(--c)}.sp-dots i.d{background:var(--c)}.sp-dots span{margin-left:4px}",
    ".sp-nx{margin:0;font-size:14px}.sp-nx small{display:block;margin-bottom:3px;font:500 9.5px/1 " + MONO + ";letter-spacing:.16em;text-transform:uppercase;color:var(--ui-dim,#a8a8a8)}",
    ".sp-acts{display:flex;flex-wrap:wrap;gap:8px}",
    ".sp-acts button{min-height:36px;padding:0 12px;border-radius:10px;border:1px solid rgb(var(--ui-hi,255 255 255) / .2);background:none;color:var(--ui-ink,#fff);cursor:pointer;font:600 10.5px/1 " + MONO + ";letter-spacing:.12em;text-transform:uppercase}",
    ".sp-acts button.pri{background:var(--c);border-color:var(--c);color:#0b0f10}",
    ".sp-acts button:focus-visible,.sp-ln:focus-visible{outline:2px solid #fff;outline-offset:2px}",
    ".sp-nag .sp-meter{margin:2px 0 2px}",
    /* the first discovery: the suggestion card, ringed in the path's color, a headline and a few lines */
    ".sp-first{width:min(340px,calc(100vw - 24px));border-color:var(--c);box-shadow:0 0 0 1px var(--c),0 14px 48px color-mix(in srgb,var(--c) 38%,transparent)}",
    ".sp-first .sp-hd{color:var(--c)}.sp-first .sp-hd b{color:var(--c);font-weight:700}",
    ".sp-fh{margin:0;font:600 18px/1.25 var(--sans,system-ui,sans-serif);letter-spacing:-.01em}",
    ".sp-fb{margin:0;font-size:13.5px;line-height:1.45;color:var(--ui-mid,#c9cfd1)}.sp-fb b{color:var(--ui-ink,#fff);font-weight:600}",
    "@media (prefers-reduced-motion:no-preference){.sp-first .sp-fst{display:inline-block;animation:sp-spark 1.4s ease-in-out 3}}",
    "@keyframes sp-spark{0%,100%{scale:1;rotate:0deg}50%{scale:1.35;rotate:20deg}}",
    ".sp-nl{list-style:none;margin:0;padding:0;display:grid;gap:2px}",
    ".sp-ln{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) 20px;gap:10px;align-items:center;min-height:40px;padding:4px 6px;margin:0 -6px;box-sizing:content-box;border:0;border-radius:10px;background:none;color:var(--ui-ink,#fff);cursor:pointer;text-align:left;font:inherit;font-size:13.5px}",
    ".sp-ln:hover{background:rgb(var(--ui-hi,255 255 255) / .07)}.sp-ln b{font-weight:600}.sp-ln svg{color:var(--ui-dim,#a8a8a8)}",
    ".sp-nf{display:flex;justify-content:space-between;gap:12px}.sp-nf button{min-height:32px;padding:0;border:0;background:none;color:var(--ui-dim,#a8a8a8);cursor:pointer;font:500 10px/1 " + MONO + ";letter-spacing:.14em;text-transform:uppercase}",
    ".sp-nf button:hover,.sp-nf button:focus-visible{color:var(--ui-ink,#fff)}",
    /* the cover's meter */
    ".sp-cover{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:clamp(14px,2.6vh,22px);padding:8px 12px;border:0;background:none;color:rgba(255,255,255,.7);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:opacity .7s ease}",
    ".sp-cover .sp-meter{width:clamp(120px,30vw,168px);--ui-hi:255 255 255}",
    ".sp-cover span{font:500 9px/1 " + MONO + ";letter-spacing:.18em;text-transform:uppercase}",
    ".sp-cover:hover,.sp-cover:focus-visible{color:#fff}.sp-cover:focus-visible{outline:2px solid #fff;outline-offset:2px;border-radius:10px}",
    /* take me there: the control, outlined in the path's color for a moment */
    ".sp-ring{position:fixed;z-index:62;pointer-events:none;border:2px solid var(--c);border-radius:16px;box-shadow:0 0 0 4px color-mix(in srgb,var(--c) 30%,transparent);animation:sp-ring 1s ease-in-out 3}",
    "@keyframes sp-ring{0%,100%{opacity:1;scale:1}50%{opacity:.55;scale:1.06}}",
    "@media (prefers-reduced-motion:no-preference){.sp-pop,.sp-nag{transition:opacity .45s ease,translate .5s cubic-bezier(.2,.8,.2,1),display .5s allow-discrete}",
    "  .sp-pop[hidden],.sp-nag[hidden]{opacity:0;translate:0 12px}@starting-style{.sp-pop:not([hidden]),.sp-nag:not([hidden]){opacity:0;translate:0 12px}}}",
    "@media (prefers-reduced-motion:reduce){.sp-b,.sp-flash .sp-b,.sp-b.flash,.sp-step.fresh .sp-box,.sp-ring,.sp-row.sp-hl{animation:none;transition:none}}"
  ].join("\n");
  var LINK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>';
  /* THE MARK BESIDE "PATHS" (Dimitry, 21 Oct: "a little scholar's hat next to that word, so people understand the
     paths are about learning"; then "or a little trophy ribbon, what you win"). Both are drawn; the tool picks. */
  var HAT = '<svg class="sp-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 9.5 12 5l10 4.5-10 4.5z"/><path d="M6 11.3v4.4c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8v-4.4"/><path d="M22 9.5v5"/></svg>';
  var RIBBON = '<svg class="sp-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="9" r="5.5"/><circle cx="12" cy="9" r="2.2"/><path d="M8.6 13.3 7 21l5-2.6 5 2.6-1.6-7.7"/></svg>';
  function ic() { var k = O && O.icon != null ? O.icon : "hat"; if (!k) return ""; if (k === "earn") k = allFull() ? "ribbon" : "hat"; return k === "ribbon" ? RIBBON : HAT; }
  var X = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  function css() { if (document.getElementById("sp-css")) return; var s = document.createElement("style"); s.id = "sp-css"; s.textContent = CSS; document.head.appendChild(s); }
  function q(s, r) { return typeof s === "string" ? (r || document).querySelector(s) : s; }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function plain(t) { return String(t || "").replace(/<[^>]+>/g, "").replace(/&rsaquo;/g, "›").replace(/&lsaquo;/g, "‹").replace(/&rsquo;/g, "’").replace(/&amp;/g, "&"); }
  function shown(el) { if (!el || !el.isConnected || !el.getClientRects().length) return false; var c = getComputedStyle(el); return c.visibility !== "hidden" && c.display !== "none"; }

  var O = null, S = { on: "on", nag: "on", done: {}, given: {}, fin: false, visits: 0, first: 0 }, SK = "", sec = null, badgeMO = null;
  function load() { try { var v = JSON.parse(localStorage.getItem(SK)); if (v && typeof v === "object") { S.on = v.on === "off" ? "off" : "on"; S.nag = v.nag === "off" ? "off" : "on"; S.done = v.done || {}; S.given = v.given || {}; S.fin = !!v.fin; S.visits = +v.visits || 0; S.first = +v.first || 0; } } catch (e) {} }
  function persist() { try { localStorage.setItem(SK, JSON.stringify(S)); } catch (e) {} }
  function col(p) { return p.color || PAL[O.paths.indexOf(p) % PAL.length]; }
  function byId(id) { return O.paths.filter(function (x) { return x.id === id; })[0] || null; }
  function stepOf(id) { for (var i = 0; i < O.paths.length; i++) for (var j = 0; j < O.paths[i].steps.length; j++) if (O.paths[i].steps[j].id === id) return [O.paths[i], O.paths[i].steps[j]]; return null; }
  function count(p) { var n = 0; p.steps.forEach(function (s) { if (S.done[s.id]) n++; }); return n; }
  function full(p) { return count(p) === p.steps.length; }
  function allFull() { return O.paths.every(full); }
  function total() { var n = 0, t = 0; O.paths.forEach(function (p) { n += count(p); t += p.steps.length; }); return [n, t]; }
  function nextOf(p) { return p.steps.filter(function (s) { return !S.done[s.id]; })[0] || null; }
  function tell(m) { if (O && O.toast && S.on === "on") try { O.toast(m); } catch (e) {} }
  function emit(d) { try { document.dispatchEvent(new CustomEvent("surface:paths", { detail: d })); } catch (e) {} }
  function meterHTML() {
    return '<div class="sp-meter" aria-hidden="true">' + O.paths.map(function (p) {
      return '<i style="--n:' + p.steps.length + ';--c:' + col(p) + ';--f:' + Math.round(count(p) / p.steps.length * 100) + '%"><b></b></i>'; }).join("") + "</div>";
  }

  /* ---- badges ---- */
  var BB = [];   // under-badges: {el, p, b, c}
  function underBadge(el, p, c) {
    for (var i = 0; i < BB.length; i++) if (BB[i].el === el && BB[i].p === p) return BB[i].b;
    var b = document.createElement("button"); b.type = "button"; b.className = "sp-b sp-bb";
    if (getComputedStyle(c).position === "static") c.style.position = "relative";
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); hint(p, b); });
    c.appendChild(b); BB.push({ el: el, p: p, b: b, c: c }); watchSize(el); watchSize(c);
    return b;
  }
  function badges() {
    if (!O) return;
    O.paths.forEach(function (p) {
      var f = full(p), txt = f ? "✓" : p.id, c = col(p);
      (p.badges || []).forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
          var row = O.below && el.closest(O.below), b;
          if (row && row !== el) {
            b = underBadge(el, p, row);
            var lab = "Path " + p.id + " · " + plain(p.title) + ": " + (f ? "walked" : count(p) + " of " + p.steps.length + " done") + ".";
            if (b.dataset.tip !== lab) { b.dataset.tip = lab; b.setAttribute("aria-label", lab + " Show the path"); }
          } else {
            b = el.querySelector(":scope>.sp-b");
            if (!b) {
              b = document.createElement("span"); b.className = "sp-b"; b.setAttribute("aria-hidden", "true");
              if (getComputedStyle(el).position === "static") el.style.position = "relative";
              el.appendChild(b);
            }
          }
          if (row && row !== el) {   // the dot: one digit, no leading zero; walked, a tiny tick
            var k = f ? "tick" : String(/^\d+$/.test(p.id) ? parseInt(p.id, 10) : p.id).slice(0, 2);
            if (b.dataset.k !== k) { b.dataset.k = k; if (f) b.innerHTML = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2.4 5.3l1.8 1.8 3.6-3.9"/></svg>'; else b.textContent = k; }
          } else if (b.textContent !== txt) b.textContent = txt;
          b.classList.toggle("done", f); b.dataset.path = p.id; b.style.setProperty("--sp-c", c);
        });
      });
    });
    layout();
  }
  /* every under-badge on its row's bottom line, centred under its control; two paths on one control sit side by side */
  var due = 0;
  function layout() { if (due) return; due = requestAnimationFrame(function () { due = 0; place(); }); }
  function place() {
    BB = BB.filter(function (x) { if (x.el.isConnected && x.c.isConnected) return true; x.b.remove(); return false; });
    var groups = new Map();
    BB.forEach(function (x) { var g = groups.get(x.el); if (!g) groups.set(x.el, g = []); g.push(x); });
    groups.forEach(function (g, el) {
      var vis = shown(el);
      g.forEach(function (x) { x.b.hidden = !vis; });
      if (!vis) return;
      var c = g[0].c, cr = c.getBoundingClientRect(), er = el.getBoundingClientRect();
      /* off the control's lower right: the first dot's centre 3 px in from its right edge, its top 2 px below it;
         a second path on the same control sits further right */
      /* a control wider than tall (a group: back · Auto · next) takes the square at its centre */
      /* measured without the control's own transform (Dimitry, 22 Oct: pressing a bar button made its dots jiggle toward
         it and back): a press scales the button about its centre, so the centre holds and the size comes from the
         untransformed box */
      var w = el.offsetWidth || er.width, h = el.offsetHeight || er.height, mx = er.left + er.width / 2, my = er.top + er.height / 2;
      var half = Math.min(w, h) / 2, at = mx + half - cr.left - c.clientLeft - 3, top = my + h / 2 - cr.top - c.clientTop + 2;
      g.forEach(function (x) { x.b.style.left = Math.round(at) + "px"; x.b.style.top = Math.round(top) + "px"; at += x.b.offsetWidth + 3; });
    });
  }
  var RO = window.ResizeObserver ? new ResizeObserver(layout) : null, seen = new WeakSet();
  function watchSize(el) { if (RO && !seen.has(el)) { seen.add(el); RO.observe(el); } }
  function watchBadges() {
    if (badgeMO || !window.MutationObserver) return;
    var due2 = 0;
    badgeMO = new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var t = ms[i].target; if (t.classList && t.classList.contains("sp-b")) continue;
        if (ms[i].addedNodes.length || ms[i].removedNodes.length) { if (!due2) due2 = requestAnimationFrame(function () { due2 = 0; badges(); }); return; }
      }
    });
    badgeMO.observe(document.body, { childList: true, subtree: true });
    /* inside the rows that carry under-badges, a control shown, hidden or restyled moves the badges along */
    if (O.below) document.querySelectorAll(O.below).forEach(function (row) {
      new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) if (!(ms[i].target.classList && ms[i].target.classList.contains("sp-b"))) { layout(); return; } })
        .observe(row, { subtree: true, attributes: true, attributeFilter: ["hidden", "class", "style"] });
    });
    addEventListener("resize", layout);
  }
  function flash(p) {
    var bs = [].slice.call(document.querySelectorAll('.sp-b[data-path="' + p.id + '"]')).filter(shown);
    bs.forEach(function (b) { b.classList.remove("flash"); void b.offsetWidth; b.classList.add("flash"); setTimeout(function () { b.classList.remove("flash"); }, 2800); });
    return bs.length;
  }

  /* ---- the hint: a tap on an under-badge ---- */
  var pop = null, popFor = null;
  function closePop() { if (pop && !pop.hidden) { pop.hidden = true; popFor = null; } }
  function hint(p, b) {
    if (!pop) {
      pop = document.createElement("div"); pop.className = "sp-pop"; pop.setAttribute("role", "dialog"); pop.hidden = true; document.body.appendChild(pop);
      document.addEventListener("pointerdown", function (e) { if (pop && !pop.hidden && !pop.contains(e.target) && !(e.target.closest && e.target.closest(".sp-bb"))) closePop(); }, true);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && pop && !pop.hidden) { e.stopPropagation(); var f = popFor; closePop(); if (f && f.b) f.b.focus({ preventScroll: true }); } }, true);
    }
    if (!pop.hidden && popFor && popFor.p === p) { closePop(); return; }
    var n = count(p), t = p.steps.length, nx = nextOf(p), c = col(p);
    pop.style.setProperty("--c", c); pop.setAttribute("aria-label", "Path " + p.id + ", " + plain(p.title));
    pop.innerHTML = '<div class="sp-hd"><i class="sp-pip">' + esc(p.id) + '</i><span>Path · <b>' + esc(plain(p.title)) + '</b></span><button type="button" class="sp-x" aria-label="Close">' + X + "</button></div>" +
      '<div class="sp-bd"><div class="sp-dots" role="img" aria-label="' + n + " of " + t + ' done">' + p.steps.map(function (s) { return "<i" + (S.done[s.id] ? ' class="d"' : "") + "></i>"; }).join("") + "<span>" + n + " / " + t + "</span></div>" +
      (nx ? '<p class="sp-nx"><small>next</small>' + nx.label + "</p>" : '<p class="sp-nx">Walked. ' + (p.reward && S.given[p.id] ? (p.reward.given || "") : "") + "</p>") +
      '<div class="sp-acts">' + (nx ? '<button type="button" class="pri" data-a="show">show me</button>' : "") + '<button type="button" data-a="there"' + (nx ? "" : ' class="pri"') + ">take me there</button></div></div>";
    pop.querySelector(".sp-x").onclick = closePop;
    pop.querySelector('[data-a="there"]').onclick = function () { closePop(); open(p.id); };
    var sh = pop.querySelector('[data-a="show"]'); if (sh) sh.onclick = function () { closePop(); go(nx.id); };
    popFor = { p: p, b: b }; pop.hidden = false;
    var r = b.getBoundingClientRect(), host = (BB.filter(function (x) { return x.b === b; })[0] || {}).el, hr = host ? host.getBoundingClientRect() : r;
    var w = pop.offsetWidth, h = pop.offsetHeight, x = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)), y = Math.min(hr.top, r.top) - h - 12;
    if (y < 8) y = r.bottom + 10;
    pop.style.left = Math.round(x) + "px"; pop.style.top = Math.round(y) + "px";
    var f = pop.querySelector(".sp-acts .pri"); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  }

  /* ---- take me there ---- */
  /* a path, in the index: the drawer opens, the section, the path's row unfolds and comes into view */
  function open(id) {
    var p = byId(id); if (!p || !sec) return false;
    var row = sec.querySelector('.sp-row[data-path="' + id + '"]');
    if (window.SurfaceLinks && SurfaceLinks.go) SurfaceLinks.go(sec.id); else { if (O.open) try { O.open(); } catch (e) {} sec.classList.remove("cx-shut"); }
    setTimeout(function () {
      if (!row) return; row.classList.remove("cx-shut"); var g = row.querySelector(".cx-go"); if (g) g.setAttribute("aria-expanded", "true");
      if (window.SurfaceLinks && SurfaceLinks.reveal) SurfaceLinks.reveal(row); else row.scrollIntoView({ block: "start" });
      row.classList.remove("sp-hl"); void row.offsetWidth; row.classList.add("sp-hl");
      try { g.focus({ preventScroll: true }); } catch (e) {}
    }, 420);
    return true;
  }
  /* a step: the control that does it, outlined in the path's color */
  function go(id) {
    var ps = stepOf(id); if (!ps) return false;
    var p = ps[0], s = ps[1], g = s.go || (p.badges || [])[0];
    closePop(); if (nag.el) nag.el.hidden = true;
    if (typeof g === "function") { try { g(s, p); } catch (e) { console.warn("paths go", e); } return true; }
    if (g && typeof g === "object" && g.link) { if (window.SurfaceLinks) SurfaceLinks.go(g.link); return true; }   /* typeof: every string has a .link (String.prototype.link, a relic of 1995) */
    if (!g) return open(p.id);
    if (O.front) try { O.front(s, p); } catch (e) {}
    setTimeout(function () {
      var el = [].slice.call(document.querySelectorAll(g)).filter(shown)[0];
      if (!el) { tell(plain(s.label)); return; }
      point(el, p); tell("→ " + plain(s.label));
    }, O.front ? 420 : 0);
    return true;
  }
  function point(el, p) {
    /* a control in a scrolling shelf comes into view sideways, never by scrolling the page */
    var t = el.parentElement;
    while (t && t !== document.body) { var o = getComputedStyle(t).overflowX; if ((o === "auto" || o === "scroll") && t.scrollWidth > t.clientWidth + 1) { var tr = t.getBoundingClientRect(), er = el.getBoundingClientRect(); t.scrollLeft += er.left + er.width / 2 - (tr.left + tr.width / 2); break; } t = t.parentElement; }
    var ring = document.createElement("div"); ring.className = "sp-ring"; ring.style.setProperty("--c", col(p)); document.body.appendChild(ring);
    var t0 = performance.now(), br = getComputedStyle(el).borderRadius;
    (function f() { if (!ring.isConnected) return; var r = el.getBoundingClientRect(); ring.style.left = r.left - 5 + "px"; ring.style.top = r.top - 5 + "px"; ring.style.width = r.width + 10 + "px"; ring.style.height = r.height + 10 + "px";
      if (br && br !== "0px") ring.style.borderRadius = "calc(" + br + " + 5px)";
      if (performance.now() - t0 < 3000) requestAnimationFrame(f); else ring.remove(); })();
    try { el.focus({ preventScroll: true }); } catch (e) {}
  }
  function linkNames() {
    if (!window.SurfaceLinks || !SurfaceLinks.mount) return;
    var names = {};
    O.paths.forEach(function (p) {
      names["path-" + p.id] = function () { open(p.id); };
      p.steps.forEach(function (s) { names["go-" + s.id] = function () { go(s.id); }; });
    });
    try { SurfaceLinks.mount({ names: names }); } catch (e) {}
  }
  function href(name) { try { return window.SurfaceLinks && SurfaceLinks.url ? SurfaceLinks.url(name) : "#" + name; } catch (e) { return "#" + name; } }

  /* ---- the section ---- */
  function rowHTML(p) {
    var n = count(p), t = p.steps.length, c = col(p);
    return '<li class="cx-row sp-row' + (n === t ? " sp-full" : "") + (O.open === false ? " cx-shut" : "") + '" data-path="' + esc(p.id) + '" style="--c:' + c + '"><button type="button" class="cx-go" aria-expanded="' + (O.open === false ? "false" : "true") + '"><i class="sp-num">' + esc(p.id) + "</i><span>" + esc(p.title) +
      (p.advanced ? '<em class="sp-adv">advanced</em>' : "") + '</span><em class="sp-c" aria-label="' + n + " of " + t + ' done">' + (n === t ? "✓ " : "") + n + "/" + t + '</em><b class="cx-f" aria-hidden="true"></b></button><div class="cx-body">' +
      (p.note ? '<p class="sp-note">' + p.note + "</p>" : "") +
      '<ul class="sp-list">' + p.steps.map(function (s) {
        var d = !!S.done[s.id], can = !!(s.go || (p.badges || []).length);
        return '<li class="sp-step' + (d ? " done" : "") + '" data-step="' + esc(s.id) + '"><span class="sp-box" role="img" aria-label="' + (d ? "done" : "not yet") + '"></span><span class="sp-lab">' + s.label + "</span>" +
          (can ? '<a class="sp-go" href="' + esc(href("go-" + s.id)) + '" data-go="' + esc(s.id) + '" aria-label="Take me there: ' + esc(plain(s.label)) + '" title="Take me there">' + LINK + "</a>" : "<span></span>") + "</li>";
      }).join("") + "</ul>" +
      (p.reward ? '<p class="sp-gift">' + (S.given[p.id] ? (p.reward.given || "Unlocked.") : "Walk it all: <b>" + p.reward.label + "</b>") + "</p>" : "") +
      ((p.badges || []).length ? '<button type="button" class="sp-where" data-where="' + esc(p.id) + '">show where →</button>' : "") +
      "</div></li>";
  }
  function paint() {
    if (!sec) return;
    var ol = sec.querySelector(".sp-ol"), shut = {};
    ol.querySelectorAll(".sp-row").forEach(function (r) { shut[r.dataset.path] = r.classList.contains("cx-shut"); });
    ol.innerHTML = O.paths.map(rowHTML).join("");
    ol.querySelectorAll(".sp-row").forEach(function (r) { if (r.dataset.path in shut) { r.classList.toggle("cx-shut", shut[r.dataset.path]); r.querySelector(".cx-go").setAttribute("aria-expanded", String(!shut[r.dataset.path])); } });
    ol.querySelectorAll(".cx-go").forEach(function (b) { b.onclick = function () { var r = b.closest(".cx-row"), on = r.classList.toggle("cx-shut"); b.setAttribute("aria-expanded", String(!on)); }; });
    ol.querySelectorAll(".sp-go").forEach(function (a) { a.onclick = function (e) { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return; e.preventDefault(); go(a.dataset.go); }; });
    ol.querySelectorAll(".sp-where").forEach(function (b) {
      b.onclick = function () { var p = byId(b.dataset.where); if (!p) return; if (O.showWhere) O.showWhere(p); setTimeout(function () { if (!flash(p)) tell("its buttons show while the tool is in front"); }, O.showWhere ? 420 : 0); };
    });
    var tt = total(), foot = sec.querySelector(".sp-tot"); if (foot) foot.textContent = tt[0] + " of " + tt[1] + " done";
    var fin = sec.querySelector(".sp-fin");
    if (O.finale) {
      fin.hidden = false;
      var ok = allFull();
      fin.innerHTML = ok ? "<b>Every path walked.</b> " + (O.finale.done || "") + (O.finale.button ? '<br><button type="button" class="sp-finbtn">' + esc(O.finale.button) + "</button>" : "")
        : "Walk every path: <b>" + O.finale.label + "</b>.";
      var fb = fin.querySelector(".sp-finbtn"); if (fb) fb.onclick = function () { try { O.finale.give(); } catch (e) { console.warn("paths finale", e); } };
    }
    var hw = sec.querySelector(".cx-grpbtn .sp-icw"); if (hw) hw.innerHTML = ic();
    meters.forEach(function (m) { m(); });
  }
  function build() {
    var after = q(O.after); if (!after) return;
    sec = document.createElement("section"); sec.className = "cx-grp sp-sec"; sec.id = O.id || "paths";
    sec.innerHTML = '<button type="button" class="cx-grpbtn" aria-expanded="true" aria-controls="' + sec.id + 'L"><i class="sp-icw">' + ic() + '</i><span>' + esc(O.title || "Paths") +
      '</span><svg class="cx-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button><div class="cx-gbody" id="' + sec.id + 'L">' +
      (O.lead ? '<p class="cx-lead">' + O.lead + "</p>" : "") + '<ol class="cx-list sp-ol"></ol><div class="sp-fin" hidden></div>' +
      '<div class="sp-foot"><span class="sp-tot"></span><button type="button" data-a="save">save progress</button><button type="button" data-a="load">load progress</button><button type="button" data-a="reset">start over</button></div></div>';
    after.after(sec);
    var gb = sec.querySelector(".cx-grpbtn"); gb.onclick = function () { var on = sec.classList.toggle("cx-shut"); gb.setAttribute("aria-expanded", String(!on)); };
    sec.querySelector('[data-a=save]').onclick = exportProgress;
    sec.querySelector('[data-a=load]').onclick = importProgress;
    sec.querySelector('[data-a=reset]').onclick = function () {
      if (!confirm("Start every path over? Rewards you already have stay.")) return;
      S.done = {}; persist(); paint(); badges(); emit({ all: false }); tell("paths: starting over");
    };
    paint();
  }

  /* ---- the switches ---- */
  function applyOn() { document.documentElement.setAttribute("data-paths", S.on); }
  function set(v) { S.on = v === "off" ? "off" : "on"; persist(); applyOn(); syncSwitch(); emit({ on: S.on }); if (S.on === "off") { closePop(); if (nag.el) nag.el.hidden = true; } layout(); }
  function setNag(v) { S.nag = v === "off" ? "off" : "on"; persist(); syncSwitch(); if (S.nag === "off" && nag.el) nag.el.hidden = true; meters.forEach(function (m) { m(); }); }
  var sws = [];
  function syncSwitch() { sws.forEach(function (sw) { var cur = sw.dataset.row === "paths" ? S.on : S.nag; sw.querySelectorAll("[role=radio]").forEach(function (b) { var on = b.dataset.v === cur; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; }); }); }
  function radioRow(host, key, label, aOn, aOff, act) {
    var sw = document.createElement("div"); sw.className = "dsp-row"; sw.dataset.row = key;
    sw.innerHTML = '<span class="dsp-lab" id="dsp-' + key + '">' + esc(label) + '</span><div class="dsp-seg" role="radiogroup" aria-labelledby="dsp-' + key + '">' +
      '<button type="button" role="radio" data-v="on" aria-label="' + esc(aOn) + '">On</button><button type="button" role="radio" data-v="off" aria-label="' + esc(aOff) + '">Off</button></div>';
    var note = host.querySelector(":scope>.dsp-note");
    host.insertBefore(sw, note || null);
    sw.querySelectorAll("[role=radio]").forEach(function (b) {
      b.onclick = function () { act(b.dataset.v); };
      b.onkeydown = function (e) { if (!/Arrow/.test(e.key)) return; e.preventDefault(); var o = sw.querySelector('[data-v="' + (b.dataset.v === "on" ? "off" : "on") + '"]'); o.click(); o.focus(); };
    });
    sws.push(sw);
  }
  function switchRows() {
    var host = q(O.settings); if (!host) return;
    radioRow(host, "paths", O.switchLabel || "Paths", "Learning marks on: the Paths checklists, and their numbers on the controls they teach", "Learning marks off: no numbers on the controls, no Paths section. Your progress is kept",
      function (v) { set(v); tell(S.on === "on" ? "learning marks on" : "learning marks off · progress kept"); });
    radioRow(host, "pathtips", O.nagLabel || "Suggestions", "Suggestions on: the next steps on your paths when you open the tool, and your progress on the cover", "Suggestions off: no next steps when you open the tool",
      function (v) { setNag(v); tell(S.nag === "on" ? "suggestions on" : "suggestions off"); });
    syncSwitch();
  }

  /* ---- suggestions: the next steps when the tool opens (BakerBacker's setup to-do, in Surface's glass) ---- */
  function nagOK() { return O && S.on === "on" && S.nag === "on" && !allFull() && (total()[0] > 0 || S.visits > 1); }
  function nag(opt) {
    opt = opt || {};
    if (!nagOK()) return false;
    if (!opt.force) {
      if (window.SurfaceLinks && SurfaceLinks.opened) return false;
      /* a first-visit hint (hints.js, "start here") speaks first; the suggestions wait for it to go */
      var h = document.querySelector(".sh-here.show");
      if (h && shown(h)) { if ((opt.tries = (opt.tries || 0) + 1) < 8) setTimeout(function () { nag(opt); }, 4000); return false; }
      try { if (sessionStorage.getItem("sp-nag." + O.key)) return false; sessionStorage.setItem("sp-nag." + O.key, "1"); } catch (e) {}
    }
    var next = [];
    O.paths.forEach(function (p) { var s = nextOf(p); if (s && next.length < (opt.max || 2)) next.push([p, s]); });
    if (!next.length) return false;
    var el = nag.el;
    if (!el) {
      el = nag.el = document.createElement("div"); el.className = "sp-nag"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Next on your paths"); el.hidden = true; document.body.appendChild(el);
      var keep = false; el.addEventListener("pointerenter", function () { keep = true; }); el.addEventListener("focusin", function () { keep = true; });
      nag.keep = function () { return keep; };
      document.addEventListener("pointerdown", function (e) { if (!el.hidden && !el.contains(e.target)) el.hidden = true; }, true);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !el.hidden) el.hidden = true; }, true);
    }
    var tt = total();
    el.innerHTML = '<div class="sp-hd"><span>' + ic() + 'Paths · <b>' + tt[0] + " of " + tt[1] + '</b></span><button type="button" class="sp-x" aria-label="Close">' + X + "</button></div>" +
      '<div class="sp-bd">' + meterHTML() + '<ul class="sp-nl">' + next.map(function (x) {
        return '<li><button type="button" class="sp-ln" data-go="' + esc(x[1].id) + '" style="--c:' + col(x[0]) + '"><i class="sp-pip">' + esc(x[0].id) + "</i><span>" + x[1].label + "</span>" + LINK + "</button></li>"; }).join("") +
      '</ul><div class="sp-nf"><button type="button" data-a="all">all paths</button><button type="button" data-a="off">no suggestions</button></div></div>';
    el.querySelector(".sp-x").onclick = function () { el.hidden = true; };
    el.querySelectorAll(".sp-ln").forEach(function (b) { b.onclick = function () { el.hidden = true; go(b.dataset.go); }; });
    el.querySelector('[data-a="all"]').onclick = function () { el.hidden = true; open(next[0][0].id); };
    el.querySelector('[data-a="off"]').onclick = function () { el.hidden = true; setNag("off"); tell("no suggestions · Settings › " + (O.nagLabel || "Suggestions") + " brings them back"); };
    var above = q(O.nagAbove), ar = above && shown(above) ? above.getBoundingClientRect() : null;
    el.style.left = "50%"; el.style.transform = "translateX(-50%)";
    el.style.bottom = (ar ? Math.round(innerHeight - ar.top + 14) : 96) + "px";
    el.hidden = false;
    clearTimeout(nag.t); nag.t = setTimeout(function wait() { if (nag.keep && nag.keep()) return; el.hidden = true; }, opt.stay || 14000);
    return true;
  }

  /* ---- the first discovery: the first step ever ticked on this device (6) ---- */
  function firstCard(p, s) {
    var f = O.first || {}, c = col(p);
    if (nag.el) nag.el.hidden = true;
    var el = firstCard.el;
    if (!el) {
      el = firstCard.el = document.createElement("div"); el.className = "sp-nag sp-first"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", f.title || "Your first path discovery"); el.hidden = true; document.body.appendChild(el);
      var keep = false; el.addEventListener("pointerenter", function () { keep = true; }); el.addEventListener("focusin", function () { keep = true; });
      firstCard.keep = function () { return keep; };
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !el.hidden) el.hidden = true; }, true);
    }
    var dots = p.steps.map(function (x) { return "<i" + (S.done[x.id] ? ' class="d"' : "") + "></i>"; }).join("");
    el.style.setProperty("--c", c);
    el.innerHTML = '<div class="sp-hd"><span><span class="sp-fst" aria-hidden="true">✦</span> <b>First discovery</b></span><button type="button" class="sp-x" aria-label="Close">' + X + "</button></div>" +
      '<div class="sp-bd"><p class="sp-fh">' + (f.title || "You found your first path step") + "</p>" +
      '<div class="sp-dots" style="--c:' + c + '"><i class="sp-pip" style="--c:' + c + '">' + esc(p.id) + "</i>" + dots + "<span>" + esc(plain(p.title)) + " · " + count(p) + " of " + p.steps.length + "</span></div>" +
      '<p class="sp-fb">' + (f.body || "") + "</p>" + meterHTML() +
      '<div class="sp-acts"><button type="button" class="pri" data-a="see">' + esc(f.open || "see the paths") + '</button><button type="button" data-a="ok">keep playing</button></div></div>';
    var shut = function () { el.hidden = true; };
    el.querySelector(".sp-x").onclick = shut; el.querySelector('[data-a="ok"]').onclick = shut;
    el.querySelector('[data-a="see"]').onclick = function () { shut(); open(p.id); };
    var above = q(O.nagAbove), ar = above && shown(above) ? above.getBoundingClientRect() : null;
    el.style.left = "50%"; el.style.transform = "translateX(-50%)";
    el.style.bottom = (ar ? Math.round(innerHeight - ar.top + 14) : 96) + "px";
    el.hidden = false;
    try { flash(p); } catch (e) {}
    clearTimeout(firstCard.t); firstCard.t = setTimeout(function () { if (firstCard.keep && firstCard.keep()) return; el.hidden = true; }, f.stay || 24000);
    return el;
  }

  /* ---- the meter under a launch cover's start button ---- */
  var meters = [];
  function meter(host, opt) {
    host = q(host); if (!host || !O) return null; opt = opt || {};
    var b = document.createElement("button"); b.type = "button"; b.className = "sp-cover";
    var draw = function () {
      var tt = total(), ok = S.on === "on" && S.nag === "on" && (tt[0] > 0 || S.visits > 1);
      b.hidden = !ok; if (!ok) return;
      b.innerHTML = meterHTML() + "<span>" + ic() + esc(O.title || "Paths") + " · " + tt[0] + " / " + tt[1] + "</span>";
      b.setAttribute("aria-label", (O.title || "Paths") + ": " + tt[0] + " of " + tt[1] + " steps done. Open them");
    };
    b.onclick = function (e) { e.stopPropagation(); var p = O.paths.filter(function (x) { return !full(x); })[0] || O.paths[0]; if (opt.go) opt.go("path-" + p.id); else open(p.id); };
    draw(); host.appendChild(b); meters.push(draw);
    return b;
  }

  /* ---- progress in and out ---- */
  function exportProgress() {
    var blob = new Blob([JSON.stringify({ kind: "surface.paths", tool: O.key, saved: new Date().toISOString(), done: S.done, given: S.given, fin: S.fin }, null, 2)], { type: "application/json" });
    var name = (O.filePrefix || "") + "paths-progress.json";
    if (O.save) O.save(name, blob); else { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  }
  function importProgress() {
    var i = document.createElement("input"); i.type = "file"; i.accept = "application/json,.json";
    i.onchange = function () {
      var f = i.files && i.files[0]; if (!f) return;
      f.text().then(function (t) {
        var v = JSON.parse(t); if (!v || v.kind !== "surface.paths" || v.tool !== O.key) throw new Error("not a " + O.key + " progress file");
        var known = {}; O.paths.forEach(function (p) { p.steps.forEach(function (s) { known[s.id] = 1; }); });
        Object.keys(v.done || {}).forEach(function (k) { if (known[k] && !S.done[k]) S.done[k] = v.done[k]; });
        persist(); O.paths.forEach(reward); paint(); badges(); tell("progress loaded: " + total()[0] + " of " + total()[1]);
      }).catch(function (e) { tell("could not load that file: " + (e.message || e)); });
    };
    i.click();
  }

  /* ---- ticking ---- */
  function reward(p) {
    if (!full(p) || S.given[p.id] || !p.reward) return false;
    S.given[p.id] = Date.now(); persist();
    try { p.reward.give(); } catch (e) { console.warn("paths reward", e); }
    return true;
  }
  function done(id) {
    if (!O || S.done[id]) return false;
    var ps = stepOf(id); if (!ps) return false;
    var p = ps[0], s = ps[1], none = total()[0] === 0;
    S.done[id] = Date.now();
    var first = !!(O.first && !S.first && none && S.on === "on"); if (first || none) S.first = S.first || Date.now();
    persist();
    var gave = reward(p), all = allFull();
    paint(); badges();
    if (sec) { var li = sec.querySelector('[data-step="' + id + '"]'); if (li) li.classList.add("fresh"); }
    if (first) firstCard(p, s);
    else if (all && !S.fin) { S.fin = true; persist(); tell("✓ every path walked" + (O.finale ? " · " + (O.finale.toast || "your reward is in the index, under " + (O.title || "Paths")) : "")); }
    else if (gave) tell("✓ path " + p.id + " walked · " + (p.reward.toast || p.reward.label));
    else if (full(p)) tell("✓ path " + p.id + " walked");
    else tell("✓ " + p.id + " · " + plain(s.label));
    emit({ step: id, path: p.id, all: all });
    return true;
  }

  function mount(o) {
    css(); O = o || {}; SK = "surface.paths." + (O.key || "tool"); load();
    try { if (!sessionStorage.getItem("sp-v." + O.key)) { sessionStorage.setItem("sp-v." + O.key, "1"); S.visits++; persist(); } } catch (e) {}
    applyOn(); build(); switchRows(); badges(); watchBadges(); linkNames();
    return api;
  }
  var api = { mount: mount, done: done, firstCard: function (id) { var p = O && byId(id || O.paths[0].id); return p ? firstCard(p, p.steps[0]) : null; }, set: set, setNag: setNag, open: open, go: go, nag: nag, meter: meter, layout: layout,
    flash: function (id) { var p = O && byId(id); return p ? flash(p) : 0; },
    isDone: function (id) { return !!S.done[id]; }, get on() { return S.on; }, get suggest() { return S.nag; }, get progress() { return total(); } };
  window.SurfacePaths = api;
})();
