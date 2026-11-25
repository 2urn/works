/* Surface · Code — a tool's settings as one line of code, to copy out and paste back (Dimitry, 25 Nov 2026, 10:39:
   "There should be a copy paste current settings </> for testing and preset creation"; first built in Water Kit v0.30).

   A round </> button opens a box with the current settings written as a preset line: only what differs from the
   defaults, ready to paste into the tool's PRESETS, or to send to someone (or to Claude) for testing. The line is named
   with the next free number for the loaded preset, so Save keeps versions rather than overwriting.

     'Glass Words 001': {...base0, mode:'ripple', bview:'side', bub:45, wtext:'DEEP / BREATH'},

   SHARE, three ways (Dimitry, 25 Nov 10:58: "a share function in three modes: copy code, copy a link, download a file"):
     Code  copies the line (where the clipboard is blocked it selects the text)
     Link  copies a link that opens the tool with these settings: the tool's own (opts.link, e.g. a d.chamy.xyz short
           link), else this page's address with #code=…, which mount() reads back on arrival; opts.link:false greys it
     File  downloads the line as a text file named by the studio's rule (SurfaceFiles: CHAMY·XYZ_<Tool>_App_000012.txt);
           a file dropped on the box is read into it
   Then Apply (reads the box and hands the values to the tool, which morphs to them), Save (keeps the box as one of the
   person's own presets under the name on the line), Refresh (rewrites the box from what is running) and Forget
   (removes one of theirs; asks again within 3 s before it does).

   SAFE TO PASTE: nothing in the box is ever run. The reader tries strict JSON first (a nested scene is written as a JSON
   body), else takes key:value pairs only (numbers as typed, 'strings', "strings", true, false), only for keys the tool
   knows (opts.keys, or the defaults' own; opts.keys:'*' takes any top-level key), and ignores everything else.

     SurfaceCode.mount(host, {
       tool: 'water-kit',                  // the storage name for the person's presets ('<tool>.mine' in localStorage)
       defaults: {...},                    // what the line is measured against (only differences are written)
       get: () => ({...}),                 // the settings running now
       name: () => 'Glass Words',          // the preset loaded now (the line is named '<name> · edit')
       apply: (values, name) => {},        // set these (already merged over defaults); morph, don't cut
       spread: '...base0',                 // optional: written first inside the braces, as the tool's PRESETS write it
       keys: ['mode', ...],                // optional: extra keys allowed beyond the defaults' own
       maxName: 32,                        // optional: the longest name the tool keeps; numbering cuts the name, never the number
       names: () => [...],                 // optional: every preset name the tool lists (for numbering: 'Name 001', 'Name 002'…)
       builtIn: name => bool,              // optional: is this one of the tool's own presets (saving under it adds " (mine)")
       mine: { added(name, values), removed(name) },   // optional: so the tool can list the person's presets with its own
       save: (name, values) => {},         // optional: the tool keeps it in its own list instead (then isMine, forget);
                                           //   return false when refused, or the name it really kept
                                           // apply and link may return false too: no success message then
       isMine: name => bool, forget: name => {},
       link: (values, name) => url | Promise<url>,     // optional: the tool's own link; false = no link (greyed)
       file: { tool: 'Current' },          // optional: the name for SurfaceFiles; false = no file (greyed)
       download: (name, blob) => msg,      // optional: the tool's own file saver (returns or promises its message)
       untitled: 'Scene',                  // optional: what an unnamed stage's line is called ('Scene 001'); name() returns ''
       list: true,                         // optional: a tool with no preset list of its own gets one row of chips, the
                                           //   person's saved ones (tap opens); then name() may be left out (the kit keeps
                                           //   the last one opened or saved; fallback: opts.untitled, else 'Look')
       say: msg => {}                      // optional: the tool's own toast; otherwise a status line under the buttons
     }) → { refresh(), open(bool), el }
     SurfaceCode.line(values, defaults, name, spread)   → the line (string)
     SurfaceCode.read(text, allowedKeys)                 → {name, values, n} | null
     SurfaceCode.numbered(name, names, max)              → 'Name 003' (the next free number for that name, within max)
     SurfaceCode.mine(tool)                              → {name: values, ...}  (the person's presets, merged over nothing)

   The person's presets come back on the next visit: call SurfaceCode.mine(tool) at boot and add each to the tool's
   list, marked "mine". A built-in name is never overwritten: saving under one adds " (mine)". */
(function () {
  "use strict";
  if (window.SurfaceCode) return;

  var CSS_ID = "scode-css";
  var ICON = {
    code: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 4 1.8 8l3.7 4M10.5 4l3.7 4-3.7 4M9.2 2.8 6.8 13.2"/></svg>',
    copy: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5v-.8A1.2 1.2 0 0 0 9.3 1.5H3.2A1.2 1.2 0 0 0 2 2.7v6.1a1.2 1.2 0 0 0 1.2 1.2h.8"/></svg>',
    ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5"/></svg>',
    link: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-.9.9M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.1 9.2a2.6 2.6 0 0 0 3.7 3.7l.9-.9"/></svg>',
    file: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8.5M4.6 7.2 8 10.6l3.4-3.4M2.5 13.5h11"/></svg>'
  };
  var CSS =
    ".scode-h{display:flex;align-items:center;gap:8px;margin:10px 0 2px}" +
    ".scode-h span{font-size:12px;opacity:.7}" +
    ".scode-b{width:var(--s-hit,34px);height:var(--s-hit,34px);max-width:40px;max-height:40px;min-width:34px;min-height:34px;border-radius:50%;display:grid;place-items:center;background:none;border:1px solid var(--s-line,rgba(127,127,127,.4));color:inherit;cursor:pointer;padding:0}" +
    ".scode-b[aria-expanded=true]{color:var(--s-accent,var(--accent,currentColor));border-color:var(--s-accent,var(--accent,currentColor))}" +
    ".scode-b svg,.scode-cp svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}" +
    ".scode-box{position:relative;margin:6px 0 10px}" +
    ".scode-box[hidden]{display:none}" +
    ".scode-box textarea{display:block;width:100%;box-sizing:border-box;min-height:9.5em;background:var(--s-sunk,rgba(127,127,127,.12));color:inherit;border:1px solid var(--s-line,rgba(127,127,127,.35));border-radius:8px;padding:8px 10px;font:11.5px/1.4 var(--s-font-data,ui-monospace,Menlo,Consolas,monospace);resize:vertical}" +
    ".scode-share{display:flex;gap:4px;margin:0 0 6px}" +
    ".scode-cp{display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:4px 10px 4px 8px;border-radius:16px;background:none;border:1px solid transparent;color:inherit;opacity:.75;cursor:pointer;font:12.5px var(--s-font-ui,-apple-system,BlinkMacSystemFont,sans-serif)}" +
    ".scode-cp:hover{opacity:1;border-color:var(--s-line,rgba(127,127,127,.35))}.scode-cp:disabled{opacity:.3;cursor:default;border-color:transparent}" +
    ".scode-cp.ok{opacity:1;color:var(--s-accent,var(--accent,currentColor))}.scode-cp.ok svg{animation:scodeok .5s ease}" +
    ".scode-box textarea.drop{border-color:var(--s-accent,var(--accent,currentColor))}" +
    "@keyframes scodeok{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.2);opacity:1}100%{transform:scale(1)}}" +
    ".scode-row{display:flex;gap:6px;align-items:center;flex-wrap:nowrap}" +
    ".scode-row button{margin:6px 0;padding:8px 12px;border-radius:18px;border:1px solid var(--s-line,rgba(127,127,127,.45));background:var(--s-sunk,rgba(127,127,127,.14));color:inherit;font:600 13px var(--s-font-ui,-apple-system,BlinkMacSystemFont,sans-serif);cursor:pointer;min-width:0}" +
    ".scode-row button:disabled{opacity:.35;cursor:default}" +
    ".scode-list{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:2px 0 4px;padding:2px 0}.scode-list::-webkit-scrollbar{display:none}" +
    ".scode-list button{flex:none;padding:6px 12px;border-radius:16px;border:1px solid var(--s-line,rgba(127,127,127,.4));background:none;color:inherit;font:12.5px var(--s-font-ui,-apple-system,BlinkMacSystemFont,sans-serif);cursor:pointer;opacity:.8}" +
    ".scode-list button[aria-pressed=true]{opacity:1;color:var(--s-accent,var(--accent,currentColor));border-color:var(--s-accent,var(--accent,currentColor))}" +
    "@media (pointer:coarse){.scode-list button{min-height:40px}}" +
    ".scode-say{min-height:1.4em;font-size:12px;opacity:.7;margin:0}" +   /* reserved height: a status line never moves the layout */
    "@media (pointer:coarse){.scode-b{width:40px;height:40px}.scode-cp,.scode-row button{min-height:40px}}" +   /* finger targets 40 px (review b8e0c1a4c7 r-3) */
    "@media (prefers-reduced-motion: reduce){.scode-cp.ok svg{animation:none}}";

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { e.append(c); });
    return e;
  }
  function same(a, b) { return typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-6 : a === b; }
  function lit(v) {
    if (typeof v === "number") return String(+v.toFixed(4));
    if (typeof v === "string") return "'" + v.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n") + "'";
    return String(v);
  }

  /* the settings as one preset line: name, optional spread, then only what differs from the defaults */
  function line(values, defaults, name, spread) {
    var nested = Object.keys(values).some(function (k) { return values[k] && typeof values[k] === "object"; });
    if (nested) {                                   /* a nested scene: a JSON body, read back by JSON.parse */
      var o = {}; Object.keys(values).forEach(function (k) { var v = values[k]; if (v === undefined || typeof v === "function") return;
        if (k in defaults && same(v, defaults[k])) return; o[k] = v; });
      return "'" + String(name || "Settings").replace(/'/g, "\\'") + "': " + JSON.stringify(o) + ",";
    }
    var parts = spread ? [spread] : [], seen = {};
    if ("mode" in values && !("mode" in defaults)) { parts.push("mode:" + lit(values.mode)); seen.mode = 1; }
    Object.keys(defaults).concat(Object.keys(values)).forEach(function (k) {
      if (seen[k]) return; seen[k] = 1;
      var v = values[k]; if (v === undefined || v === null || typeof v === "object" || typeof v === "function") return;
      if (k in defaults && same(v, defaults[k])) return;
      parts.push(k + ":" + lit(v));
    });
    return "'" + String(name || "Settings").replace(/'/g, "\\'") + "': {" + parts.join(", ") + "},";
  }

  /* read a line (or JSON) back: key:value pairs for allowed keys only; nothing is evaluated */
  function read(text, allowed) {
    text = String(text || "");
    var a = text.indexOf("{"), b = text.lastIndexOf("}"), body = a >= 0 && b > a ? text.slice(a + 1, b) : text;
    var anyKey = allowed === "*";
    if (a >= 0 && b > a) {                          /* strict JSON first: nested scenes come this way; JSON.parse runs nothing */
      try { var J = JSON.parse(text.slice(a, b + 1));
        if (J && typeof J === "object" && !Array.isArray(J)) { var jv = {}, jn = 0;
          for (var jk in J) if (anyKey || !allowed || allowed.indexOf(jk) >= 0) { if (J[jk] === null) continue; jv[jk] = J[jk]; jn++; }
          var nm0 = nameOf(text.slice(0, a));
          if (jn) return { name: nm0 || (typeof J.name === "string" ? J.name : ""), values: jv, n: jn }; } } catch (e) {}
    }
    var re = /["']?([A-Za-z_]\w*)["']?\s*:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|true|false|null|-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
    var ok = allowed && !anyKey ? function (k) { return allowed.indexOf(k) >= 0; } : function () { return true; };
    var values = {}, n = 0, m;
    while ((m = re.exec(body))) {
      var k = m[1], r = m[2], v;
      if (!ok(k)) continue;
      try {
        if (r[0] === "'") v = JSON.parse('"' + r.slice(1, -1).replace(/\\'/g, "'").replace(/(^|[^\\])"/g, '$1\\"') + '"');
        else if (r === "true" || r === "false" || r === "null") v = JSON.parse(r);
        else v = parseFloat(r);                        /* .9 and 1. as people type them, which JSON refuses */
      } catch (e) { continue; }
      if (typeof v === "number" && !isFinite(v)) continue;
      if (v === null) continue;
      values[k] = v; n++;
    }
    if (!n) return null;
    return { name: nameOf(text.slice(0, Math.max(0, a))), values: values, n: n };
  }

  /* saved presets are numbered like everything the studio saves (Dimitry, 25 Nov: "001, 002 etc"): the base name without
     its number, then one more than the highest number already taken for it, three digits */
  function numbered(name, names, max) {
    var base = String(name || "Mine").replace(/\s*\(mine\)$/, "").replace(/\s*·\s*edit$/, "").replace(/\s+\d{3,}$/, "").trim() || "Mine";
    if (max > 4 && base.length > max - 4) base = base.slice(0, max - 4).trim();   /* a tool that cuts names (Current: 32) keeps the number, loses the end of the name (review b8e0c1a4c7 r-1) */
    var re = new RegExp("^" + base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " (\\d{3,})$"), top = 0;
    (names || []).forEach(function (n) { var m = re.exec(n); if (m) top = Math.max(top, +m[1]); });
    var num = ("00" + (top + 1)).slice(-Math.max(3, String(top + 1).length));
    if (max > 4 && (base + " " + num).length > max) base = base.slice(0, max - num.length - 1).trim();
    return base + " " + num;
  }
  /* the line's name: 'It\'s mine': or "It's mine": (escapes undone; review d2ef65e3d4 r-3) */
  function nameOf(head) {
    var m = /'((?:[^'\\]|\\.)*)'\s*:?\s*$/.exec(head) || /"((?:[^"\\]|\\.)*)"\s*:?\s*$/.exec(head);
    return m ? m[1].replace(/\\(.)/g, "$1").trim() : "";
  }
  function store(tool) { return (tool || "surface") + ".mine"; }
  function mine(tool) { try { var o = JSON.parse(localStorage.getItem(store(tool)) || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
  function putMine(tool, name, diff) { try { var o = mine(tool); if (diff) o[name] = diff; else delete o[name]; localStorage.setItem(store(tool), JSON.stringify(o)); return true; } catch (e) { return false; } }

  function mount(host, O) {
    O = O || {};
    if (!document.getElementById(CSS_ID)) { var st = el("style", { id: CSS_ID }); st.textContent = CSS; document.head.append(st); }
    var defaults = O.defaults || {}, allowed = O.keys === "*" ? "*" : Object.keys(defaults).concat(O.keys || ["mode"]);
    var allow = function (k) { return allowed === "*" || allowed.indexOf(k) >= 0; };
    var isMine = function (n) { return O.isMine ? !!O.isMine(n) : n in mine(O.tool); };
    var loadedFrom = "", pastedName = "";          // a pasted line's name carries through until another preset is loaded
    var kitName = "";                               /* the kit's own name for what is on stage, for tools that have none */
    var rawName = function () { return O.name ? O.name() || "" : kitName; };   /* what is really on stage ('' for an unnamed one) */
    var curName = function () { return rawName() || O.untitled || "Look"; };   /* what the line is named after */
    var allNames = function () { var o = O.names ? O.names() : []; return O.save ? o : o.concat(Object.keys(mine(O.tool))); };
    var lineName = function () { var n = curName(); return pastedName && loadedFrom === n ? pastedName : numbered(n || "Mine", allNames(), O.maxName); };
    var diff = function (vals) { var d = {}; for (var k in vals) if (allow(k) && !(k in defaults && same(vals[k], defaults[k]))) d[k] = vals[k]; return d; };

    var tb = el("button", { type: "button", "class": "scode-b", "aria-expanded": "false", "aria-label": "Settings as code: copy them out or paste some in", title: "Settings as code" });
    tb.innerHTML = ICON.code;
    var box = el("div", { "class": "scode-box", hidden: "" });
    var ta = el("textarea", { rows: "7", spellcheck: "false", "aria-label": "Current settings as a preset line. Edit or paste settings here, then Apply or Save." });
    function shareBtn(icon, word, label) { var b = el("button", { type: "button", "class": "scode-cp", "aria-label": label, title: label }); b.innerHTML = ICON[icon] + "<span>" + word + "</span>"; b._icon = icon; return b; }
    var cp = shareBtn("copy", "Code", "Copy the settings as code");
    var lk = shareBtn("link", "Link", "Copy a link that opens these settings");
    var fl = shareBtn("file", "File", "Download the settings as a file");
    if (O.link === false) { lk.disabled = true; lk.title = "No link for this tool yet"; }
    if (O.file === false) { fl.disabled = true; fl.title = "No file for this tool yet"; }
    var bApply = el("button", { type: "button", "aria-label": "Apply the settings in the box" }); bApply.textContent = "Apply";
    var bSave = el("button", { type: "button", "aria-label": "Save the settings in the box as your own preset, named as in the box" }); bSave.textContent = "Save";
    var bFresh = el("button", { type: "button", "aria-label": "Refresh the box from the current settings" }); bFresh.textContent = "Refresh";
    var bForget = el("button", { type: "button", "aria-label": "Forget this preset of yours" }); bForget.textContent = "Forget";
    var sayEl = el("p", { "class": "scode-say", role: "status", "aria-live": "polite" });
    var listEl = O.list && !O.save ? el("div", { "class": "scode-list", role: "group", "aria-label": "Your saved ones: tap one to open it" }) : null;
    box.append(el("div", { "class": "scode-share", role: "group", "aria-label": "Share the settings" }, [cp, lk, fl]), ta, el("div", { "class": "scode-row" }, [bApply, bSave, bFresh, bForget]));
    if (listEl) box.append(listEl);
    if (!O.say) box.append(sayEl);
    var head = el("div", { "class": "scode-h" }, [tb, el("span", {}, [document.createTextNode("Settings as code")])]);
    host.append(head, box);

    var sayT = 0;
    function say(m) { if (O.say) return O.say(m); sayEl.textContent = m; clearTimeout(sayT); sayT = setTimeout(function () { sayEl.textContent = ""; }, 3500); }
    function syncForget() { var n = rawName(); bForget.disabled = !n || !isMine(n); }   /* an unnamed stage never points at a saved one (review d2ef65e3d4 r-3) */
    function drawList() {
      if (!listEl) return; var all = mine(O.tool), names = Object.keys(all), on = curName(); listEl.innerHTML = "";
      if (!names.length) { listEl.hidden = true; return; } listEl.hidden = false;
      names.forEach(function (n) { var b = el("button", { type: "button", "aria-pressed": String(n === rawName()), title: "Open " + n }); b.textContent = n;
        b.onclick = function () { var v = {}, k; for (k in defaults) v[k] = defaults[k]; for (k in all[n]) v[k] = all[n][k];
          if (O.apply) O.apply(v, n); kitName = n; loadedFrom = curName(); pastedName = ""; refresh(); say("Opened “" + n + "”"); };
        listEl.append(b); });
    }
    function refresh() { ta.value = line(O.get ? O.get() : {}, defaults, lineName(), O.spread); syncForget(); drawList(); }
    function open(on) { box.hidden = !on; tb.setAttribute("aria-expanded", String(!!on)); if (on) refresh(); }

    tb.addEventListener("click", function () { open(box.hidden); });
    bFresh.addEventListener("click", refresh);
    function tick(b, msg) { var sv = b.querySelector("svg"); b.classList.add("ok"); if (sv) sv.outerHTML = ICON.ok; if (msg) say(msg);
      setTimeout(function () { b.classList.remove("ok"); var s2 = b.querySelector("svg"); if (s2) s2.outerHTML = ICON[b._icon]; }, 1400); }
    function copyOut(txt, b, what) {
      var old = function () {                       /* blocked clipboard: put it in the box, selected, for ⌘C */
        if (ta.value !== txt) ta.value = txt; ta.focus(); ta.select();
        try { if (document.execCommand("copy")) { tick(b, what + " copied"); return; } } catch (e) {}
        say("Selected: copy it with ⌘C / Ctrl+C"); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { tick(b, what + " copied"); }, old); else old();
    }
    cp.addEventListener("click", function () { copyOut(ta.value, cp, "Code"); });
    function hashLink(txt) {
      var b64 = btoa(unescape(encodeURIComponent(txt))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      return String(location.href).split("#")[0] + "#code=" + b64;
    }
    lk.addEventListener("click", function () {
      if (lk.disabled) return;
      var P = read(ta.value, allowed); if (!P) { say("No settings found in the box"); return; }
      var vals = {}; for (var k in defaults) vals[k] = defaults[k]; for (var j in P.values) vals[j] = P.values[j];
      if (!O.link) { copyOut(hashLink(ta.value), lk, "Link"); return; }
      var r; try { r = O.link(vals, P.name || curName()); } catch (e) { r = null; }
      if (r === false) return;                     /* refused, already said why */
      if (r && typeof r.then === "function") {
        say("Making the link…");
        if (navigator.clipboard && window.ClipboardItem) {   /* Safari wants the clipboard promised inside the tap */
          var got = r.then(function (u) { if (!u) throw new Error("no link"); return u; });
          navigator.clipboard.write([new ClipboardItem({ "text/plain": got.then(function (u) { return new Blob([u], { type: "text/plain" }); }) })])
            .then(function () { tick(lk, "Link copied"); }, function () { got.then(function (u) { copyOut(u, lk, "Link"); }, function () { say("Could not make a link just now (offline?)"); }); });
        } else r.then(function (u) { if (u) copyOut(u, lk, "Link"); else say("Could not make a link just now (offline?)"); }, function () { say("Could not make a link just now (offline?)"); });
      } else if (r) copyOut(String(r), lk, "Link"); else say("Could not make a link just now");
    });
    fl.addEventListener("click", function () {
      if (fl.disabled) return;
      var P = read(ta.value, allowed), nm = P && P.name || curName() || "Settings";
      var fname = window.SurfaceFiles && O.file && O.file.tool ? SurfaceFiles.name({ tool: O.file.tool, ext: "txt" }) : String(nm).replace(/[^\w .·-]+/g, "").trim().replace(/\s+/g, "_") + ".txt";
      var blob = new Blob([ta.value + "\n"], { type: "text/plain;charset=utf-8" });
      if (O.download) {                             /* the tool's own saver (e.g. one that knows the claude.ai preview's downloads) */
        Promise.resolve(O.download(fname, blob)).then(function (m) { if (m && /^(Not|Could)/.test(m)) say(m); else tick(fl, m || "Saved " + fname); }, function () { say("Could not save the file"); });
        return;
      }
      var url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = fname;
      document.body.append(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      tick(fl, "Saved " + fname);
    });
    /* a file dropped on the box is read into it (then Apply or Save) */
    ta.addEventListener("dragover", function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], "Files") >= 0) { e.preventDefault(); ta.classList.add("drop"); } });
    ta.addEventListener("dragleave", function () { ta.classList.remove("drop"); });
    ta.addEventListener("drop", function (e) { var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; ta.classList.remove("drop"); if (!f) return;
      e.preventDefault(); if (f.size > 2e6) { say("That file is too big to be settings"); return; }
      f.text().then(function (t) { ta.value = t.trim(); say("Read " + f.name + ": Apply or Save"); }); });
    function applyBox(asName) {
      var P = read(ta.value, allowed); if (!P) { say("No settings found in the box"); return null; }
      var vals = {}; for (var k in defaults) vals[k] = defaults[k]; for (var j in P.values) vals[j] = P.values[j];
      if (O.apply && O.apply(vals, asName || P.name || "") === false) return null;   /* refused: no success message */
      if (!O.name) { kitName = asName || P.name || kitName; loadedFrom = curName(); pastedName = ""; return { P: P, vals: vals }; }
      loadedFrom = curName(); pastedName = asName ? "" : (P.name || "Pasted");
      return { P: P, vals: vals };
    }
    bApply.addEventListener("click", function () { var r = applyBox(); if (r) say("Applied " + r.P.n + " setting" + (r.P.n === 1 ? "" : "s")); });
    bSave.addEventListener("click", function () {
      var P = read(ta.value, allowed); if (!P) { say("No settings found in the box"); return; }
      var name = (P.name || "").replace(/\s*·\s*edit$/, "").trim() || numbered("Mine", allNames(), O.maxName);
      if (O.maxName && name.length > O.maxName) name = numbered(name, allNames(), O.maxName);   /* too long for the tool: cut, then numbered, never cut into an existing name */
      if (O.builtIn && O.builtIn(name) && !isMine(name)) name = numbered(name, allNames(), O.maxName);   /* never over a built-in */
      if (isMine(name)) name = numbered(name, allNames(), O.maxName);   /* nor over one of theirs: Save always adds, Forget removes (review d2ef65e3d4 r-1) */
      if (O.save) { var P2 = read(ta.value, allowed), v2 = {}; for (var k2 in defaults) v2[k2] = defaults[k2]; for (var j2 in P2.values) v2[j2] = P2.values[j2];
        var got = O.save(name, v2); if (got === false) return;   /* the tool refused and said why (review 297303db12 r-2) */
        if (typeof got === "string") name = got;                  /* the name the tool really kept */
        loadedFrom = curName(); pastedName = ""; refresh(); say("Saved as “" + name + "”"); return; }
      var r = applyBox(name); if (!r) return;
      var d = diff(r.vals); if (!("mode" in d) && "mode" in r.vals) d.mode = r.vals.mode;
      if (!putMine(O.tool, name, d)) { say("This browser would not keep it"); return; }
      if (O.mine && O.mine.added) O.mine.added(name, r.vals);
      if (!O.name) kitName = name;
      refresh(); say("Saved as “" + name + "” in your presets");
    });
    var armed = 0, armT = 0;                       // forgetting asks twice: tap, then tap again within 3 s
    bForget.addEventListener("click", function () {
      var name = rawName(); if (!name || !isMine(name)) return;
      if (Date.now() - armed > 3000) { armed = Date.now(); bForget.textContent = "Sure?"; clearTimeout(armT); armT = setTimeout(function () { bForget.textContent = "Forget"; }, 3000); return; }
      armed = 0; bForget.textContent = "Forget"; if (O.forget) O.forget(name); else putMine(O.tool, name, null);
      if (O.mine && O.mine.removed) O.mine.removed(name);
      if (!O.name && kitName === name) kitName = "";
      syncForget(); drawList(); say("Forgot “" + name + "”");
    });
    setInterval(function () { if (!box.hidden) syncForget(); }, 600);
    syncForget();
    if (O.openLink !== false) {                     /* arrived by a #code= link: apply it, then take it off the address */
      var hm = /[#&]code=([A-Za-z0-9_-]+)/.exec(location.hash || "");
      if (hm) setTimeout(function () {
        try { var t = decodeURIComponent(escape(atob(hm[1].replace(/-/g, "+").replace(/_/g, "/")))); ta.value = t;
          if (applyBox()) say("Opened settings from a link");
          history.replaceState(null, "", String(location.href).split("#")[0]); } catch (e) {} }, 300);
    }
    return { refresh: refresh, open: open, el: head };
  }

  window.SurfaceCode = { mount: mount, line: line, read: read, mine: mine, numbered: numbered, ICON: ICON };
})();
