/* Surface · Notice — now and then, when there is no update, a word from the studio in the update pill's place
   (Dimitry, 22 Oct 2026, 14:32): FEEDBACK (a question with answers to pick, one or several, an optional short text),
   NEWS (good news, a new product, something in the world near the tool, an optional link) and CALL (for volunteers, or
   for artists to bring work to a show: a link, or a short form with name, email, link to the work and consent).

   Never annoying, never mid-performance: only when no update pill is showing and none came this visit; at most one
   notice every 4 days on a device, and each notice once (remembered when it is answered or closed with ×); never in the
   first minute of a visit, never while the tool says it is busy (the robot, a recording, the bare stage...), never on a
   phone in fullscreen. A switch turns them off altogether (SurfaceNotice.enable(false), "Studio news & questions").

     SurfaceNotice.init({
       tool: 'current',                       // which notices are for this tool ('*' are for all)
       version: '0.29.56',                    // this build's version (a notice's minVersion is compared with it)
       feed: 'https://works.chamy.xyz/notices.json',    // a URL to the JSON, OR an async function returning the array
       supabase: { url: 'https://<ref>.supabase.co', key: 'sb_publishable_…', table: 'notice_responses' },
       busy: () => bool,                      // the tool is in the middle of something: wait
       quiet: () => bool,                     // optional, the tool's own off switch (the kit's own is enable())
       delay: 60000, gap: 4                   // first minute of a visit; days between notices
     })
     SurfaceNotice.enabled() / enable(bool)   // the device's switch, shared by every studio tool on this site
     SurfaceNotice.show(id)                   // show one notice now (what ?notice=<id> does), for review
     SurfaceNotice.check()                    // look again now (the kit looks every 20 s and when the page returns)
     SurfaceNotice.validate(n)                // the cleaned notice, or null: what the feed may hold
     SurfaceNotice.KINDS                      // { feedback|news|call: { name, color, svg } }

   THE FEED is swappable (Dimitry, 22 Oct 14:33: a real CMS is coming, a Supabase table with an admin page): today a
   JSON file, later a function that reads a `notices` table. One notice is one flat row, the same in both:
     id          'which-next-oct'           lower case, digits, dashes; never reused
     kind        'feedback' | 'news' | 'call'
     tool        '*' | 'current' | ...
     title       up to 80 characters        body   up to 600, plain text (never HTML)
     options     [{id,label}]  2 to 8       (feedback)   multi: bool (pick several)   other: bool (a short text box)
     placeholder up to 80, the text box's hint
     link        {label, url}               https only
     form        {fields:['name','email','link','text'], required:['email'], consent:'the line they agree to'}  (call)
     thanks      up to 120, the line after Send
     starts, ends ISO dates                 minVersion '0.29.56'   priority 0-100 (higher first)   draft: bool
   Everything is checked; a notice with one bad field is left out whole. Text is set with textContent only.

   THE ANSWERS go to one insert-only table (no reading from the browser): tool, version, notice_id, choice (jsonb, the
   option ids), text (≤ 500), name, email, link, consent. A preview's answers carry version 'preview-<version>'.
   Plain script, window.SurfaceNotice, no dependencies; borrows SurfaceFresh.STAR when it is there. */
(function () {
  "use strict";
  if (window.SurfaceNotice) return;
  var O = null, FEED = null, T0 = Date.now(), EL = null, CUR = null, PREVIEW = "", timer = 0, hiddenBusy = false, sent = false;
  var LS = "surface.notices", SS = "surface.notice.shown", DAY = 864e5;

  /* the kinds, in fresh.js's KINDS style: quiet 14 px line icons (the sparkle 12 px, it is solid) and a word beside */
  var LINE = 'viewBox="0 0 16 16" aria-hidden="true" focusable="false" style="display:block;width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round"';
  var STAR = (window.SurfaceFresh && SurfaceFresh.STAR) || '<svg viewBox="-.6 -.6 13.2 13.2" aria-hidden="true" focusable="false" style="display:block;width:100%;height:100%;margin:0;fill:currentColor;stroke:none"><path d="M6 .6C6.5 3.9 8.1 5.5 11.4 6 8.1 6.5 6.5 8.1 6 11.4 5.5 8.1 3.9 6.5.6 6 3.9 5.5 5.5 3.9 6 .6z" style="fill:currentColor;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round"/></svg>';
  var KINDS = {
    /* a speech bubble with a question in it */
    feedback: { name: "Feedback", color: "#a9b7ff", svg: "<svg " + LINE + '><path d="M3.2 2.8h9.6A1.7 1.7 0 0 1 14.5 4.5v5.6a1.7 1.7 0 0 1-1.7 1.7H7.4L4.4 14.2v-2.4H3.2a1.7 1.7 0 0 1-1.7-1.7V4.5a1.7 1.7 0 0 1 1.7-1.7z"/><path d="M6.4 5.9a1.6 1.6 0 1 1 2.3 1.5c-.5.2-.7.6-.7 1.1"/><path d="M8 10h.01"/></svg>' },
    /* the kit's sparkle: something good has come */
    news: { name: "News", color: "var(--acc,var(--accent,#55b8c9))", svg: '<span style="display:block;width:12px;height:12px">' + STAR + "</span>" },
    /* a megaphone: the studio is asking for people */
    call: { name: "Call", color: "#8fd4a6", svg: "<svg " + LINE + '><path d="M2 6.4v3.2h2.3l6.2 3.6V2.8L4.3 6.4z"/><path d="M4.6 9.8l.9 3.6h1.7l-.7-3.2"/><path d="M12.6 5.6a3 3 0 0 1 0 4.8"/></svg>' }
  };
  var COLLAPSED = { feedback: "A question from the studio" };

  /* memory: one record per device, shared by every studio tool on this site, so the 4 days are the device's */
  function mem() { var d = null; try { d = JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) {} d = d && typeof d === "object" ? d : {}; d.done = d.done || {}; d.later = d.later || {}; return d; }
  function keep(d) { try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) {} }

  function num(v) { var p = String(v || "0").split(".").map(function (x) { return parseInt(x, 10) || 0; }); return [p[0] || 0, p[1] || 0, p[2] || 0]; }
  function before(a, b) { a = num(a); b = num(b); for (var i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; }

  /* VALIDATION: strict, and whole-notice. Anything unknown is ignored (a table may grow columns); anything known and
     wrong drops the notice. Returns a clean copy holding only what the renderer uses. */
  var ID = /^[a-z0-9][a-z0-9-]{0,63}$/, TOOL = /^(\*|[a-z0-9-]{1,32})$/, VER = /^\d{1,4}\.\d{1,4}\.\d{1,5}$/;
  function str(v, max, req) { if (v == null || v === "") return req ? undefined : ""; if (typeof v !== "string") return undefined; v = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim(); if (req && !v) return undefined; return v.length <= max ? v : undefined; }
  function https(u) { if (typeof u !== "string" || u.length > 500) return null; try { var x = new URL(u); return x.protocol === "https:" && !x.username && !x.password ? x.href : null; } catch (e) { return null; } }
  function date(v) { if (v == null || v === "") return 0; if (typeof v !== "string") return NaN; var t = Date.parse(v); return isFinite(t) ? t : NaN; }
  function validate(n) {
    if (!n || typeof n !== "object" || Array.isArray(n)) return null;
    var o = {};
    if (typeof n.id !== "string" || !ID.test(n.id)) return null; o.id = n.id;
    if (!KINDS.hasOwnProperty(n.kind)) return null; o.kind = n.kind;
    o.tool = n.tool == null ? "*" : n.tool; if (typeof o.tool !== "string" || !TOOL.test(o.tool)) return null;
    if ((o.title = str(n.title, 80, true)) === undefined) return null;
    if ((o.body = str(n.body, 600)) === undefined) return null;
    if ((o.thanks = str(n.thanks, 120)) === undefined) return null;
    if ((o.placeholder = str(n.placeholder, 80)) === undefined) return null;
    if (n.draft != null && typeof n.draft !== "boolean") return null; o.draft = !!n.draft;
    if (n.multi != null && typeof n.multi !== "boolean") return null; o.multi = !!n.multi;
    if (n.other != null && typeof n.other !== "boolean") return null; o.other = !!n.other;
    o.priority = n.priority == null ? 0 : n.priority; if (typeof o.priority !== "number" || !isFinite(o.priority) || o.priority < 0 || o.priority > 100) return null;
    if (n.minVersion != null && n.minVersion !== "") { if (typeof n.minVersion !== "string" || !VER.test(n.minVersion)) return null; o.minVersion = n.minVersion; }
    o.starts = date(n.starts); o.ends = date(n.ends); if (isNaN(o.starts) || isNaN(o.ends)) return null;
    if (o.ends && o.starts && o.ends <= o.starts) return null;
    if (n.link != null) {
      if (typeof n.link !== "object" || Array.isArray(n.link)) return null;
      var lu = https(n.link.url), ll = str(n.link.label, 40); if (!lu || ll === undefined) return null;
      o.link = { url: lu, label: ll || "Open" };
    }
    if (n.options != null) {
      if (!Array.isArray(n.options) || n.options.length < 2 || n.options.length > 8) return null;
      var seen = {}; o.options = [];
      for (var i = 0; i < n.options.length; i++) { var q = n.options[i]; if (!q || typeof q !== "object") return null;
        var lab = str(q.label, 60, true); if (typeof q.id !== "string" || !/^[a-z0-9-]{1,32}$/.test(q.id) || seen[q.id] || lab === undefined) return null;
        seen[q.id] = 1; o.options.push({ id: q.id, label: lab }); }
    }
    if (n.form != null) {
      var f = n.form; if (typeof f !== "object" || Array.isArray(f) || !Array.isArray(f.fields) || !f.fields.length) return null;
      var OK = { name: 1, email: 1, link: 1, text: 1 }, fs = [];
      for (var j = 0; j < f.fields.length; j++) { if (!OK[f.fields[j]] || fs.indexOf(f.fields[j]) >= 0) return null; fs.push(f.fields[j]); }
      var rq = f.required == null ? [] : f.required; if (!Array.isArray(rq)) return null;
      for (var k = 0; k < rq.length; k++) if (fs.indexOf(rq[k]) < 0) return null;
      var cs = str(f.consent, 200); if (cs === undefined) return null;
      /* a form that asks for a name, an email or a link asks for consent too: the table refuses them without it */
      if (!cs && (fs.indexOf("name") >= 0 || fs.indexOf("email") >= 0 || fs.indexOf("link") >= 0)) return null;
      o.form = { fields: fs, required: rq.slice(), consent: cs };
    }
    /* what each kind needs, and may not have */
    if (o.kind === "feedback" && !o.options && !o.other) return null;
    if (o.kind === "news" && (o.options || o.form)) return null;
    if (o.kind === "call" && (o.options || (!o.form && !o.link))) return null;
    return o;
  }

  function load() {
    if (FEED) return FEED;
    var src = O.feed;
    FEED = Promise.resolve().then(function () {
      if (typeof src === "function") return src();
      if (typeof src !== "string" || !src) return [];
      return fetch(src, { cache: "no-cache", credentials: "omit" }).then(function (r) { return r.ok ? r.json() : []; });
    }).then(function (d) {
      var arr = Array.isArray(d) ? d : d && Array.isArray(d.notices) ? d.notices : [];
      return arr.map(validate).filter(Boolean);
    }).catch(function () { return []; });
    /* a failed or empty feed is asked again on a later visit, not on every check */
    return FEED;
  }

  function enabled() { var d = mem(); return !d.off && !(O && O.quiet && safe(O.quiet)); }
  function enable(on) { var d = mem(); d.off = !on; keep(d); if (!on) hide(); document.dispatchEvent(new CustomEvent("surface:notices", { detail: { on: !!on } })); }
  function safe(f) { try { return !!f(); } catch (e) { return false; } }
  function updating() {
    try { if (sessionStorage.getItem("upd:shown") || sessionStorage.getItem("upd:from")) return true; } catch (e) {}
    return !!document.querySelector("[data-upd]");
  }
  function phoneFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement) && matchMedia("(pointer:coarse)").matches; }
  function busyNow() { return document.hidden || phoneFull() || (O.busy && safe(O.busy)); }
  function shownThisVisit() { try { return !!sessionStorage.getItem(SS); } catch (e) { return false; } }

  function eligible(n, d, now) {
    if (n.draft) return false;
    if (n.tool !== "*" && n.tool !== O.tool) return false;
    if (n.starts && now < n.starts) return false;
    if (n.ends && now >= n.ends) return false;
    if (n.minVersion && before(O.version, n.minVersion)) return false;
    if (d.done[n.id]) return false;
    if (d.later[n.id] && now - d.later[n.id] < (O.gap || 4) * DAY) return false;
    return true;
  }

  function check() {
    if (!O) return Promise.resolve(null);
    if (EL) { /* showing: step aside for an update, or while the tool gets busy, untouched */
      if (!PREVIEW && (updating() || (!sent && busyNow() && !EL.contains(document.activeElement) && !EL.classList.contains("snt-open")))) { hide(); hiddenBusy = !updating(); }
      return Promise.resolve(CUR);
    }
    if (hiddenBusy && CUR && !busyNow() && !updating() && enabled()) { hiddenBusy = false; render(CUR); return Promise.resolve(CUR); }
    if (!enabled() || updating() || shownThisVisit() || Date.now() - T0 < (O.delay == null ? 60000 : O.delay) || busyNow()) return Promise.resolve(null);
    var d = mem(), now = Date.now();
    if (d.last && now - d.last < (O.gap || 4) * DAY) return Promise.resolve(null);
    return load().then(function (list) {
      if (EL || shownThisVisit() || busyNow() || updating() || !enabled()) return null;
      var c = list.filter(function (n) { return eligible(n, d, now); })
        .sort(function (a, b) { return b.priority - a.priority || (b.starts || 0) - (a.starts || 0); })[0];
      if (!c) return null;
      d.last = now; keep(d); try { sessionStorage.setItem(SS, c.id); } catch (e) {}
      render(c); return c;
    });
  }

  function show(id) {
    return load().then(function (list) {
      var n = list.filter(function (x) { return x.id === id; })[0];
      if (!n) { console.warn("SurfaceNotice: no valid notice '" + id + "' in the feed"); return null; }
      PREVIEW = id; hide(); render(n); return n;
    });
  }

  /* LOOK: the update pill's, exactly (dark glass, 24 px radius, top centre, the same width rule), above it in nothing:
     the pill is z 99, a notice 98, and a notice leaves when a pill comes */
  function css() {
    if (document.getElementById("snt-css")) return;
    var st = document.createElement("style"); st.id = "snt-css";
    st.textContent =
      ".snt{position:fixed;z-index:98;left:50%;top:calc(12px + env(safe-area-inset-top,0px));transform:translateX(-50%);width:min(372px,calc(100vw - 24px));box-sizing:border-box;border-radius:24px;background:rgba(14,14,16,.92);color:#eef1f2;border:1px solid rgba(255,255,255,.18);font:500 12px/1.35 system-ui,sans-serif;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);overflow:hidden;transition:opacity .5s ease;text-align:left;-webkit-tap-highlight-color:transparent}" +
      ".snt.snt-in{animation:snt-in .5s cubic-bezier(.16,1,.3,1)}@keyframes snt-in{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}" +
      ".snt.snt-out{opacity:0;pointer-events:none}" +
      ".snt *{box-sizing:border-box}" +
      ".snt-row{display:flex;align-items:center;gap:4px;padding:4px 4px 4px 12px;white-space:nowrap;min-height:38px}" +
      ".snt-k{display:inline-flex;flex:none;width:16px;height:16px;align-items:center;justify-content:center}" +
      ".snt-kw{flex:none;font:600 9px/16px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;margin:0 6px 0 4px}" +
      ".snt-t{flex:1;min-width:0;display:flex;align-items:center;gap:6px;min-height:32px;padding:0 4px 0 0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}" +
      ".snt-t span{overflow:hidden;text-overflow:ellipsis;min-width:0}" +
      ".snt-t i{font-style:normal;color:#b9c2c5;flex:none}" +
      ".snt-x{margin-left:auto;flex:none;width:32px;height:32px;padding:0;border:0;background:none;color:#8a9396;font:16px/1 system-ui;cursor:pointer;border-radius:50%}" +
      ".snt button:focus-visible,.snt input:focus-visible,.snt textarea:focus-visible,.snt a:focus-visible{outline:2px solid var(--accent,#55b8c9);outline-offset:2px}" +
      ".snt-b{padding:4px 10px 14px 16px;max-height:min(calc(100dvh - 110px - env(safe-area-inset-top,0px)),560px);overflow-x:hidden;overflow-y:auto;scrollbar-gutter:stable;white-space:normal;border-top:1px solid rgba(255,255,255,.1);display:grid;gap:10px;align-content:start}" +
      ".snt-b[hidden]{display:none}" +
      ".snt-h{margin:10px 0 0;font:600 13px/1.3 system-ui,sans-serif;color:#fff}" +
      ".snt-p{margin:0;color:#c9d0d2;font:400 12.5px/1.45 system-ui,sans-serif;white-space:pre-line}" +
      ".snt-o{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;border:0}" +
      ".snt-o legend{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}" +
      ".snt-o label{position:relative;display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.22);color:#dfe5e7;cursor:pointer;font:500 12px/1.2 system-ui,sans-serif}" +
      ".snt-o input{position:absolute;opacity:0;width:1px;height:1px;margin:0}" +
      ".snt-o label:has(input:checked){background:var(--accent,#55b8c9);border-color:var(--accent,#55b8c9);color:#04181c}" +
      ".snt-o label:has(input:focus-visible){outline:2px solid var(--accent,#55b8c9);outline-offset:2px}" +
      ".snt-f{display:grid;gap:4px;font:500 11px/1.2 system-ui,sans-serif;color:#9aa5a8}" +
      ".snt-f input,.snt-f textarea{width:100%;min-height:34px;padding:7px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#fff;font:400 13px/1.3 system-ui,sans-serif}" +
      ".snt-f textarea{min-height:56px;resize:vertical}" +
      ".snt-c{display:flex;gap:8px;align-items:flex-start;color:#c9d0d2;font:400 12px/1.4 system-ui,sans-serif;cursor:pointer}" +
      ".snt-c input{flex:none;width:16px;height:16px;margin:1px 0 0;accent-color:var(--accent,#55b8c9)}" +
      ".snt-a{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:2px}" +
      ".snt-go,.snt-lk{display:inline-flex;align-items:center;min-height:32px;padding:0 14px;border-radius:999px;border:0;background:var(--accent,#55b8c9);color:#04181c;font:600 12px/1 system-ui,sans-serif;text-decoration:none;cursor:pointer}" +
      ".snt-go[disabled]{opacity:.45;cursor:default}" +
      ".snt-lt{min-height:32px;padding:0 8px;border:0;background:none;color:#9aa5a8;font:500 12px/1 system-ui,sans-serif;cursor:pointer}" +
      ".snt-er{margin:0;color:#ffb4a8;font:400 12px/1.35 system-ui,sans-serif}" +
      ".snt-er:empty{display:none}" +
      "@media (pointer:coarse){.snt-f input,.snt-f textarea{font-size:16px}}" +   /* under 16 px an iPhone zooms the page on focus */
      "@media (prefers-reduced-motion:reduce){.snt.snt-in{animation:none}.snt{transition:opacity .2s}}";
    (document.head || document.documentElement).appendChild(st);
  }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function render(n) {
    css(); CUR = n; sent = false;
    var d = el("aside", "snt snt-in"); d.setAttribute("aria-label", "From the studio: " + KINDS[n.kind].name.toLowerCase()); d.dataset.notice = n.id; d.dataset.kind = n.kind;
    /* the stage listens for presses on the window: a press on the notice is the notice's (Current's #hudX does the same) */
    ["pointerdown", "touchstart", "mousedown", "wheel"].forEach(function (t) { d.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true }); });
    /* typing goes into the notice, not to the tool's single-key shortcuts; Escape folds it */
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (open()) { e.stopPropagation(); fold(false); tg.focus(); } return; }
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.key === " " || e.key === "Enter") e.stopPropagation(); });
    var row = el("div", "snt-row"), K = KINDS[n.kind];
    var ic = el("span", "snt-k"); ic.innerHTML = K.svg; ic.style.color = K.color; ic.setAttribute("aria-hidden", "true"); row.appendChild(ic);
    var kw = el("span", "snt-kw", K.name); kw.style.color = K.color; kw.setAttribute("aria-hidden", "true"); row.appendChild(kw);
    var tg = el("button", "snt-t"); tg.type = "button"; tg.setAttribute("aria-expanded", "false");
    var tt = el("span", null, COLLAPSED[n.kind] || n.title), ch = el("i", null, "▾"); ch.setAttribute("aria-hidden", "true");
    tg.appendChild(tt); tg.appendChild(ch); tg.setAttribute("aria-label", K.name + ": " + (COLLAPSED[n.kind] || n.title));
    row.appendChild(tg);
    var x = el("button", "snt-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Close, and don’t show this again"); x.title = "Close (it won’t come back)";
    row.appendChild(x); d.appendChild(row);

    var b = el("div", "snt-b"); b.hidden = true; b.id = "snt-b-" + n.id; tg.setAttribute("aria-controls", b.id);
    if (n.kind === "feedback" || n.body) b.appendChild(el("p", "snt-h", n.title));
    if (n.body) b.appendChild(el("p", "snt-p", n.body));
    var picks = [], fields = {}, consent = null;
    if (n.options) {
      var fsx = el("fieldset", "snt-o"); fsx.appendChild(el("legend", null, n.title + (n.multi ? " (pick any)" : "")));
      n.options.forEach(function (q) { var l = el("label"), i = el("input"); i.type = n.multi ? "checkbox" : "radio"; i.name = "snt-" + n.id; i.value = q.id;
        l.appendChild(i); l.appendChild(document.createTextNode(q.label)); fsx.appendChild(l); picks.push(i); i.addEventListener("change", ready); });
      b.appendChild(fsx);
    }
    var LAB = { name: ["Name", "text", "name", 120], email: ["Email", "email", "email", 254], link: ["Link to your work", "url", "url", 500], text: ["A few words", "", "off", 500] };
    function field(key, label, ph) {
      var L = LAB[key], w = el("label", "snt-f"), s = el("span", null, label || L[0]), i = key === "text" ? el("textarea") : el("input");
      if (key !== "text") { i.type = L[1]; i.autocomplete = L[2]; } i.maxLength = L[3]; if (ph) i.placeholder = ph;
      if (key === "link") i.placeholder = "https://";
      if (n.form && n.form.required.indexOf(key) >= 0) { i.required = true; s.textContent += " *"; }
      w.appendChild(s); w.appendChild(i); b.appendChild(w); fields[key] = i; i.addEventListener("input", ready); return i;
    }
    if (n.other) field("text", n.options ? "Something else" : "Your answer", n.placeholder);
    if (n.form) n.form.fields.forEach(function (k) { if (!fields[k]) field(k, null, k === "text" ? n.placeholder : ""); });
    if (n.form && n.form.consent) { var cl = el("label", "snt-c"); consent = el("input"); consent.type = "checkbox"; consent.addEventListener("change", ready);
      cl.appendChild(consent); cl.appendChild(el("span", null, n.form.consent)); b.appendChild(cl); }
    var er = el("p", "snt-er"); er.setAttribute("role", "alert"); b.appendChild(er);
    var acts = el("div", "snt-a"), go = null;
    var asks = n.kind !== "news" && (n.options || n.other || n.form);
    if (asks) { go = el("button", "snt-go", "Send"); go.type = "button"; go.disabled = true; acts.appendChild(go); }
    if (n.link) { var a = el("a", asks ? "snt-lt" : "snt-lk", n.link.label); a.href = n.link.url; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.addEventListener("click", function () { if (!asks) { done(n, "open"); setTimeout(function () { close(true); }, 300); } }); acts.appendChild(a); }
    var lt = el("button", "snt-lt", "Remind me later"); lt.type = "button"; acts.appendChild(lt);
    b.appendChild(acts); d.appendChild(b);

    function open() { return !b.hidden; }
    function fold(on) { b.hidden = !on; d.classList.toggle("snt-open", on); tg.setAttribute("aria-expanded", String(on)); ch.textContent = on ? "▴" : "▾"; }
    function val(k) { return fields[k] ? fields[k].value.trim() : ""; }
    function ready() {
      if (!go) return; er.textContent = "";
      var any = picks.some(function (i) { return i.checked; }) || (!!fields.text && !!val("text"));
      if (n.form) { any = n.form.required.every(function (k) { return !!val(k); }) && (n.form.required.length || Object.keys(fields).some(function (k) { return !!val(k); }));
        if (n.options) any = any && picks.some(function (i) { return i.checked; }); }
      if (consent && !consent.checked && (val("name") || val("email") || val("link"))) any = false;
      go.disabled = !any;
    }
    tg.onclick = function () { fold(!open()); if (open()) { var f = b.querySelector("input,textarea,a,button"); if (f && !matchMedia("(pointer:coarse)").matches) f.focus({ preventScroll: true }); } };
    x.onclick = function () { done(n, "closed"); close(true); };
    lt.onclick = function () { if (!PREVIEW) { var m = mem(); m.later[n.id] = Date.now(); keep(m); } close(true); };
    if (go) go.onclick = function () {
      var body = { tool: O.tool, version: String((PREVIEW ? "preview-" : "") + (O.version || "")).slice(0, 32) || null, notice_id: n.id };
      var ch2 = picks.filter(function (i) { return i.checked; }).map(function (i) { return i.value; }); if (ch2.length) body.choice = ch2;
      if (val("text")) body.text = val("text").slice(0, 500);
      if (val("name")) body.name = val("name").slice(0, 120);
      if (val("email")) { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val("email"))) { er.textContent = "That email doesn’t look right."; fields.email.focus(); return; } body.email = val("email"); }
      if (val("link")) { var u = https(val("link")) || (/^http:\/\//i.test(val("link")) ? null : https("https://" + val("link").replace(/^\/+/, ""))); if (!u) { er.textContent = "The link should start with https://"; fields.link.focus(); return; } body.link = u; }
      body.consent = !!(consent && consent.checked);
      if ((body.name || body.email || body.link) && !body.consent) { er.textContent = "Please tick the box to agree first."; return; }
      var S = O.supabase; if (!S || !S.url || !S.key) { er.textContent = "Answers can’t be sent from here."; return; }
      go.disabled = true; go.textContent = "Sending…";
      fetch(S.url.replace(/\/+$/, "") + "/rest/v1/" + (S.table || "notice_responses"), { method: "POST", credentials: "omit",
        headers: { apikey: S.key, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(body) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); sent = true; done(n, "answered"); thank(); })
        .catch(function () { go.disabled = false; go.textContent = "Send"; er.textContent = "Couldn’t send. Check the connection and try again."; });
    };
    function thank() {
      b.hidden = true; d.classList.remove("snt-open"); tg.disabled = true; tg.style.cursor = "default"; ch.textContent = "";
      tt.textContent = n.thanks || "Thank you. It reached the studio."; tg.setAttribute("aria-label", tt.textContent);
      d.setAttribute("role", "status");
      setTimeout(function () { close(true); }, 3200);
    }
    EL = d; document.body.appendChild(d);
  }
  function done(n, how) { if (PREVIEW) return; var m = mem(); m.done[n.id] = how + " " + new Date().toISOString().slice(0, 10); delete m.later[n.id]; keep(m); }
  function hide() { if (EL) { EL.remove(); EL = null; } }
  function close(fade) {
    var d = EL; if (!d) return; EL = null; CUR = null; hiddenBusy = false; PREVIEW = "";
    if (!fade || matchMedia("(prefers-reduced-motion:reduce)").matches) { d.remove(); return; }
    d.classList.add("snt-out"); setTimeout(function () { d.remove(); }, 600);
  }

  function init(o) {
    O = o || {}; FEED = null; T0 = Date.now();
    var q = ""; try { q = new URLSearchParams(location.search).get("notice") || ""; } catch (e) {}
    if (q && ID.test(q)) { var go = function () { show(q); }; if (document.readyState === "complete") setTimeout(go, 400); else addEventListener("load", function () { setTimeout(go, 400); }); }
    clearInterval(timer); timer = setInterval(check, 20000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) setTimeout(check, 1500); else if (EL && !sent && !PREVIEW) check(); });
    /* an update pill came (export/v1/build.mjs says so): the notice steps aside at once */
    document.addEventListener("surface:update", function () { if (EL && !PREVIEW) { hide(); hiddenBusy = false; } });
    setTimeout(check, Math.max(0, (O.delay == null ? 60000 : O.delay) + 500));
    return api;
  }
  var api = { init: init, check: check, show: show, validate: validate, enabled: function () { return !mem().off; }, enable: enable, KINDS: KINDS,
    current: function () { return EL ? CUR : null; } };
  window.SurfaceNotice = api;
})();
