/* Surface · Lang: every word a tool shows or speaks, translatable (Dimitry, 18 Oct 2026).
   Plain script, window.SurfaceLang, no dependencies.

   The source text IS the key, the way gettext works, so a tool needs no tagging: English is written once, in place,
   and a language set maps it. What gets translated, across the whole page and anything added later:
     - text on screen (each text node, keeping its surrounding spaces)
     - aria-label, aria-description, aria-roledescription, aria-placeholder, aria-valuetext
     - title (hover text), alt, placeholder, the label of an <input type=button|submit>
     - the page: <title>, meta description, og:title, og:description, twitter:title, twitter:description
     - <html lang> and <html dir> (right to left for Arabic, Hebrew, Persian, Urdu)
   Left alone: anything inside translate="no" or .notranslate (the artist's name, the marks, code, a bytebeat
   formula), <script>, <style>, <code>, <pre>, <textarea>, [contenteditable], and the values people type.

     SurfaceLang.start({ tables: ['surface/lang/languages.csv', 'surface/lang/chrome.csv', 'lang/tool.csv'] })
     SurfaceLang.add('es', { 'Index': 'Índice', 'Open {name}': 'Abrir {name}' }, { name: 'Español', draft: true })   // or in code
     SurfaceLang.use('es')          // or ?lang=es, or the visitor's browser languages; remembered on the device
     SurfaceLang.t('Open {name}', { name: 'Strand Kit' })   // for strings a script builds (announcements, canvas text)
     SurfaceLang.picker(host)       // a labelled language menu (each language named in itself)
     SurfaceLang.strings()          // every source string this page has shown, for a translator
     SurfaceLang.template('fr')     // { source: existing translation or '' }, as JSON text, ready to fill in
     SurfaceLang.csv()              // the same as a table (source,context,es,…): what Modules/strings.py writes
     SurfaceLang.missing('es')      // what the Spanish set does not cover yet
   An entry with {braces} is a pattern: 'Opens {what}' also translates 'Opens the drawer', and the captured part is
   itself looked up, so 'the drawer' can be translated on its own.
   Events: 'surface:lang' on document, detail {lang, dir}.
*/
(function () {
  "use strict";
  var SETS = { en: { dict: {}, name: "English" } }, cur = "en", KEY = "surface.lang";
  var RTL = /^(ar|he|fa|ur|ps|sd|yi|dv|ug|ku-arab)\b/i;
  var ATTRS = ["aria-label", "aria-description", "aria-roledescription", "aria-placeholder", "aria-valuetext", "title", "alt", "placeholder"];
  var META = ['meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[name="twitter:title"]', 'meta[name="twitter:description"]'];
  var SKIP = "script,style,code,pre,textarea,noscript,[translate=no],.notranslate,[contenteditable]:not([contenteditable=false])";
  var textSrc = new WeakMap(), attrSrc = new WeakMap(), seen = new Set(), pats = {}, busy = false, docTitle = null;

  function compile(lang) {
    var d = SETS[lang] && SETS[lang].dict, out = [];
    if (d) Object.keys(d).forEach(function (k) {
      if (k.indexOf("{") < 0) return;
      var names = [], re = "^" + k.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\w+)\}/g, function (_, n) { names.push(n); return "(.+?)"; }) + "$";
      out.push({ re: new RegExp(re), names: names, to: d[k] });
    });
    pats[lang] = out;
  }
  function fill(s, vars) { return vars ? s.replace(/\{(\w+)\}/g, function (m, n) { return vars[n] != null ? vars[n] : m; }) : s; }
  /* translate one source string into the current language; English (or anything unmatched) passes through */
  function tr(src, lang, depth) {
    lang = lang || cur; var set = SETS[lang];
    if (!set || lang === "en" || !src) return src;
    var d = set.dict;
    if (Object.prototype.hasOwnProperty.call(d, src) && d[src]) return d[src];
    if ((depth || 0) > 2) return src;
    var p = pats[lang] || (compile(lang), pats[lang]);
    for (var i = 0; i < p.length; i++) {
      var m = p[i].re.exec(src); if (!m) continue;
      var v = {}; p[i].names.forEach(function (n, j) { v[n] = tr(m[j + 1], lang, (depth || 0) + 1); });
      return fill(p[i].to, v);
    }
    return src;
  }
  function t(src, vars) { seen.add(src); return fill(tr(src), vars); }

  function skipped(el) { return !!(el && el.closest && el.closest(SKIP)); }
  function doText(n) {
    var s = textSrc.get(n);
    if (s == null || (n.nodeValue !== s.out)) { s = { src: n.nodeValue }; textSrc.set(n, s); }
    var raw = s.src, core = raw.trim(); if (!core || !/[A-Za-zÀ-￿]/.test(core)) return;
    seen.add(core);
    var lead = raw.slice(0, raw.indexOf(core)), tail = raw.slice(raw.indexOf(core) + core.length);
    var out = lead + tr(core) + tail; s.out = out;
    if (n.nodeValue !== out) n.nodeValue = out;
  }
  function doAttrs(el) {
    var m = attrSrc.get(el); if (!m) { m = {}; attrSrc.set(el, m); }
    var list = ATTRS;
    if (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type)) list = ATTRS.concat("value");
    if (el.tagName === "META") list = ["content"];
    for (var i = 0; i < list.length; i++) {
      var a = list[i]; if (!el.hasAttribute(a)) continue;
      var v = el.getAttribute(a), r = m[a];
      if (!r || v !== r.out) { r = m[a] = { src: v }; }
      var core = r.src.trim(); if (!core) continue;
      seen.add(core); r.out = tr(core);
      if (v !== r.out) el.setAttribute(a, r.out);
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (!skipped(root.parentNode)) doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (skipped(root)) return; doAttrs(root); }
    var w = document.createTreeWalker(root, 5, { acceptNode: function (n) {
      if (n.nodeType === 1) return n.matches(SKIP) ? 2 : 1;
      return 1;
    } });
    for (var n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  function page() {
    if (docTitle == null || document.title !== docTitle.out) docTitle = { src: document.title };
    if (docTitle.src) { seen.add(docTitle.src); docTitle.out = tr(docTitle.src); if (document.title !== docTitle.out) document.title = docTitle.out; }
    META.forEach(function (q) { var m = document.head && document.head.querySelector(q); if (m) doAttrs(m); });
    var h = document.documentElement, dir = RTL.test(cur) ? "rtl" : "ltr";
    h.setAttribute("lang", cur); h.setAttribute("dir", (SETS[cur] && SETS[cur].dir) || dir);
  }
  function apply(root) {
    busy = true;
    try { page(); walk(root || document.body); } finally { busy = false; }
  }
  var mo = null;
  function watch() {
    if (mo || !window.MutationObserver || !document.body) return;
    mo = new MutationObserver(function (recs) {
      if (busy) return; busy = true;
      try {
        for (var i = 0; i < recs.length; i++) {
          var r = recs[i];
          if (r.type === "childList") r.addedNodes.forEach(function (n) { walk(n); });
          else if (r.type === "characterData") { if (!skipped(r.target.parentNode)) doText(r.target); }
          else if (r.type === "attributes") { if (!skipped(r.target)) doAttrs(r.target); }
        }
      } finally { busy = false; }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat("value") });
    var tt = document.querySelector("title"); if (tt) new MutationObserver(function () { if (!busy) { busy = true; try { page(); } finally { busy = false; } } }).observe(tt, { childList: true, characterData: true, subtree: true });
  }

  function add(lang, dict, info) {
    lang = String(lang).toLowerCase(); info = info || {};
    var s = SETS[lang] || (SETS[lang] = { dict: {}, name: info.name || lang });
    Object.keys(dict || {}).forEach(function (k) { s.dict[k] = dict[k]; });
    if (info.name) s.name = info.name; if (info.dir) s.dir = info.dir; if (info.draft != null) s.draft = !!info.draft;
    delete pats[lang];
    if (lang === cur) apply();
    return s;
  }
  function pick() {
    var want = [];
    try { var q = new URLSearchParams(location.search).get("lang"); if (q) want.push(q); } catch (e) {}
    try { var k = localStorage.getItem(KEY); if (k) want.push(k); } catch (e) {}
    (navigator.languages || [navigator.language || "en"]).forEach(function (l) { want.push(l); });
    for (var i = 0; i < want.length; i++) {
      var l = String(want[i]).toLowerCase(); if (SETS[l]) return l;
      var b = l.split("-")[0]; if (SETS[b]) return b;
    }
    return "en";
  }
  function use(lang, keep) {
    lang = String(lang || "en").toLowerCase(); if (!SETS[lang]) lang = lang.split("-")[0]; if (!SETS[lang]) lang = "en";
    cur = lang;
    if (keep !== false) try { localStorage.setItem(KEY, lang); } catch (e) {}
    apply(); if (cur !== "en") watch();   /* English is the source: nothing to watch until another language is chosen */
    var dir = document.documentElement.getAttribute("dir");
    try { document.dispatchEvent(new CustomEvent("surface:lang", { detail: { lang: cur, dir: dir } })); } catch (e) {}
    return cur;
  }
  function picker(host, o) {
    o = o || {};
    var wrap = document.createElement("label"); wrap.className = "sl-pick";
    var cap = document.createElement("span"); cap.className = "sl-cap"; cap.textContent = o.label || "Language"; wrap.appendChild(cap);
    var s = document.createElement("select"); s.setAttribute("aria-label", o.label || "Language"); s.title = o.title || "Language of the interface";
    Object.keys(SETS).forEach(function (l) {
      var op = document.createElement("option"); op.value = l; op.lang = l; op.setAttribute("translate", "no");
      op.textContent = SETS[l].name + (SETS[l].draft ? " (draft)" : ""); if (l === cur) op.selected = true; s.appendChild(op);
    });
    s.addEventListener("change", function () { use(s.value); });
    document.addEventListener("surface:lang", function (e) { s.value = e.detail.lang; });
    wrap.appendChild(s); if (host) (typeof host === "string" ? document.querySelector(host) : host).appendChild(wrap);
    return wrap;
  }
  function strings() { return Array.from(seen).sort(); }
  function missing(lang) { var d = (SETS[lang] || {}).dict || {}; return strings().filter(function (s) { return !d[s] && tr(s, lang) === s; }); }
  function template(lang) {
    var d = (SETS[lang] || {}).dict || {}, o = {};
    strings().forEach(function (s) { o[s] = d[s] || ""; });
    Object.keys(d).forEach(function (k) { if (!(k in o)) o[k] = d[k]; });
    return JSON.stringify(o, null, 2);
  }
  /* THE TABLES: translations live in CSV files beside the code, so they can be opened in a spreadsheet, handed to a
     translator, diffed, cloned into another project. One row per source string; one column per language:
       source,context,es,fr
       Index,the drawer's name,Índice,Index
     A cell left empty falls back to English. languages.csv names each language: code,name,dir,status (status "draft"
     shows in the menu). Paths are relative to the page, or absolute. */
  function parseCSV(text) {
    var rows = [], row = [], f = "", q = false, i = 0, c;
    text = String(text).replace(/^\uFEFF/, "");
    for (; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); f = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
      else f += c;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  function csvCell(v) { v = v == null ? "" : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function table(text) {
    var rows = parseCSV(text), head = rows.shift() || [], si = head.indexOf("source"), added = [];
    if (si < 0) throw new Error("SurfaceLang: a table needs a 'source' column");
    head.forEach(function (h, j) {
      if (j === si || h === "context" || h === "note" || !h) return;
      var d = {}; rows.forEach(function (r) { if (r[si] && r[j]) d[r[si]] = r[j]; });
      add(h, d); added.push(h);
    });
    return added;
  }
  function languages(text) {
    var rows = parseCSV(text), head = rows.shift() || [];
    rows.forEach(function (r) { var o = {}; head.forEach(function (h, j) { o[h] = r[j]; }); if (o.code) add(o.code, {}, { name: o.name, dir: o.dir, draft: o.status === "draft" }); });
  }
  function load(urls) {
    return Promise.all([].concat(urls).filter(Boolean).map(function (u) {
      return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.text(); })
        .then(function (t) { return /(^|\/)languages\.csv(\?|$)/.test(u) ? languages(t) : table(t); })
        .catch(function (e) { console.warn("SurfaceLang: could not load", u, e.message); });
    }));
  }
  /* every string this page has shown, as a table: existing translations kept, new strings with empty cells */
  function csv(langs) {
    apply();
    langs = langs || Object.keys(SETS).filter(function (l) { return l !== "en"; });
    var all = new Set(strings()); langs.forEach(function (l) { Object.keys(SETS[l] ? SETS[l].dict : {}).forEach(function (k) { all.add(k); }); });
    var out = [["source", "context"].concat(langs).map(csvCell).join(",")];
    Array.from(all).sort().forEach(function (s) { out.push([s, ""].concat(langs.map(function (l) { return (SETS[l] && SETS[l].dict[s]) || ""; })).map(csvCell).join(",")); });
    return out.join("\n") + "\n";
  }

  /* numbers, dates and lists in the visitor's own conventions */
  function num(n, opt) { try { return new Intl.NumberFormat(cur, opt).format(n); } catch (e) { return String(n); } }
  function date(d, opt) { try { return new Intl.DateTimeFormat(cur, opt).format(d); } catch (e) { return String(d); } }

  window.SurfaceLang = {
    add: add, use: use, t: t, apply: apply, picker: picker, strings: strings, missing: missing, template: template,
    num: num, date: date, load: load, table: table, languages: languages, csv: csv, parseCSV: parseCSV, get lang() { return cur; }, get langs() { return Object.keys(SETS); }, sets: SETS,
    /* start({ tables: ['surface/lang/languages.csv', 'surface/lang/chrome.csv', 'lang/strand-kit.csv'] })
       English is applied at once (it is the source); the chosen language follows as soon as its tables arrive. */
    start: function (o) {
      o = o || {};
      var go = function () { use(pick(), false); };
      var ready = function () { if (o.tables) { use("en", false); load(o.tables).then(go); } else go(); };
      if (document.body) ready(); else document.addEventListener("DOMContentLoaded", ready, { once: true });
    }
  };
})();
