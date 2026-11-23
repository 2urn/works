/* Surface · Meta: the page's description of itself, and the access checks under every tool (Dimitry, 18 Oct 2026).
   Plain script, window.SurfaceMeta, no dependencies. Works with lang.js: every string written here is a source
   string, so a language set translates it.

     SurfaceMeta.apply({ title, description, image, url, siteName: 'CHAMY·XYZ', themeColor: '#000', author })
       writes <title>, description, author, Open Graph, Twitter card, theme-color, color-scheme
     SurfaceMeta.announce('Preset saved')           polite live region (screen readers hear it; nothing shows)
     SurfaceMeta.announce('Sound blocked', true)    assertive
     SurfaceMeta.skip('#main', 'Skip to the work')  the first Tab lands on a link to the work
     SurfaceMeta.audit(root)  → [{ el, rule, say }]  what a screen reader, a keyboard or a finger would trip on:
       a control with no name · an image with no alt · an svg shown as an image with no title · a tap target under
       44px · a positive tabindex · aria-controls / aria-labelledby pointing at nothing · something focusable inside
       aria-hidden · a duplicate id · a page with no lang · a form field with no label
     ?audit=1 on any page runs it after load and prints a table to the console.
*/
(function () {
  "use strict";
  function head() { return document.head || document.documentElement; }
  function meta(attr, key, val) {
    if (val == null || val === "") return;
    var m = head().querySelector("meta[" + attr + '="' + key + '"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute(attr, key); head().appendChild(m); }
    m.setAttribute("content", val);
  }
  function apply(o) {
    o = o || {};
    if (o.title) document.title = o.title;
    meta("name", "description", o.description);
    meta("name", "author", o.author);
    meta("name", "theme-color", o.themeColor);
    meta("name", "color-scheme", o.colorScheme || "dark light");
    meta("property", "og:type", o.type || "website");
    meta("property", "og:title", o.title);
    meta("property", "og:description", o.description);
    meta("property", "og:site_name", o.siteName);
    meta("property", "og:image", o.image);
    meta("property", "og:image:alt", o.imageAlt);
    meta("property", "og:url", o.url);
    meta("name", "twitter:card", o.image ? "summary_large_image" : "summary");
    meta("name", "twitter:title", o.title);
    meta("name", "twitter:description", o.description);
    if (o.url) { var c = head().querySelector('link[rel="canonical"]'); if (!c) { c = document.createElement("link"); c.rel = "canonical"; head().appendChild(c); } c.href = o.url; }
    if (!document.documentElement.getAttribute("lang")) document.documentElement.setAttribute("lang", o.lang || "en");
  }

  var regions = {};
  function region(kind) {
    if (regions[kind] && regions[kind].isConnected) return regions[kind];
    var r = document.createElement("div");
    r.setAttribute("aria-live", kind); r.setAttribute("aria-atomic", "true"); r.setAttribute("role", kind === "assertive" ? "alert" : "status");
    r.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;margin:-1px";
    document.body.appendChild(r); return (regions[kind] = r);
  }
  function announce(msg, loud) {
    var r = region(loud ? "assertive" : "polite");
    var say = window.SurfaceLang ? window.SurfaceLang.t(msg) : msg;
    r.textContent = ""; setTimeout(function () { r.textContent = say; }, 40);
  }
  function skip(target, text) {
    if (document.getElementById("sm-skip")) return;
    var a = document.createElement("a"); a.id = "sm-skip"; a.href = target || "#main"; a.textContent = text || "Skip to the work";
    a.style.cssText = "position:fixed;left:8px;top:-60px;z-index:10000;padding:10px 14px;background:#000;color:#fff;font:600 14px/1 system-ui,sans-serif;transition:top .15s";
    a.addEventListener("focus", function () { a.style.top = "8px"; }); a.addEventListener("blur", function () { a.style.top = "-60px"; });
    document.body.insertBefore(a, document.body.firstChild);
  }

  function name(el) {
    var n = el.getAttribute("aria-label");
    if (n && n.trim()) return n.trim();
    var lb = el.getAttribute("aria-labelledby");
    if (lb) return lb.split(/\s+/).map(function (id) { var x = document.getElementById(id); return x ? x.textContent : ""; }).join(" ").trim();
    if (el.labels && el.labels.length) return Array.from(el.labels).map(function (l) { return l.textContent; }).join(" ").trim();
    if (el.tagName === "IMG") return (el.getAttribute("alt") || "").trim();
    var t = (el.textContent || "").trim(); if (t) return t;
    var img = el.querySelector && el.querySelector("img[alt]"); if (img && img.alt.trim()) return img.alt.trim();
    var st = el.querySelector && el.querySelector("svg title"); if (st) return st.textContent.trim();
    return (el.getAttribute("title") || "").trim();
  }
  function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; }
  function audit(root, o) {
    root = root || document; o = o || {};
    var out = [], push = function (el, rule, say) { out.push({ el: el, rule: rule, say: say }); };
    if (!document.documentElement.getAttribute("lang")) push(document.documentElement, "lang", "The page does not say what language it is in");
    var ctl = root.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button],[role=link],[role=slider],[role=switch],[role=checkbox],[role=tab],[role=menuitem],[tabindex]:not([tabindex="-1"])');
    ctl.forEach(function (el) {
      if (el.closest("[inert],[hidden]")) return;   /* not exposed to anyone, so not a fault (a hidden file input) */
      if (!name(el)) push(el, "name", "A control with no name: a screen reader says only “button”");
      if (o.targets !== false && visible(el)) {
        var r = el.getBoundingClientRect();
        if ((r.width < 44 || r.height < 44) && !el.matches('input[type=range],a:not([class])') && !el.closest("p,li>a")) push(el, "target", "Tap target " + Math.round(r.width) + "×" + Math.round(r.height) + "px, under 44px");
      }
      if (+el.getAttribute("tabindex") > 0) push(el, "tabindex", "A positive tabindex reorders the keyboard path");
      if (el.closest('[aria-hidden="true"]')) push(el, "hidden-focus", "Focusable, but hidden from screen readers");
    });
    root.querySelectorAll("img").forEach(function (el) { if (!el.hasAttribute("alt")) push(el, "alt", "An image with no alt (alt=\"\" if it is decoration)"); });
    root.querySelectorAll('svg[role="img"]').forEach(function (el) { if (!el.getAttribute("aria-label") && !el.querySelector("title") && !el.getAttribute("aria-labelledby")) push(el, "svg", "An svg shown as an image, with no title"); });
    root.querySelectorAll("svg:not([role]):not([aria-hidden])").forEach(function (el) { if (!el.closest("[aria-hidden=true],button,a,[role=img]")) push(el, "svg-quiet", "An svg neither named nor hidden: add aria-hidden=\"true\" or role=\"img\" with a title"); });
    root.querySelectorAll("[aria-controls],[aria-labelledby],[aria-describedby]").forEach(function (el) {
      ["aria-controls", "aria-labelledby", "aria-describedby"].forEach(function (a) {
        var v = el.getAttribute(a); if (v) v.split(/\s+/).forEach(function (id) { if (id && !document.getElementById(id)) push(el, "ref", a + " points at #" + id + ", which is not on the page"); });
      });
    });
    var ids = {}; root.querySelectorAll("[id]").forEach(function (el) { (ids[el.id] = ids[el.id] || []).push(el); });
    Object.keys(ids).forEach(function (k) { if (ids[k].length > 1) push(ids[k][1], "id", "The id “" + k + "” is used " + ids[k].length + " times"); });
    return out;
  }
  function report() {
    var r = audit(); if (!r.length) { console.info("SurfaceMeta.audit: nothing to report"); return r; }
    console.table(r.map(function (x) { return { rule: x.rule, say: x.say, el: x.el.tagName.toLowerCase() + (x.el.id ? "#" + x.el.id : "") + (x.el.className && typeof x.el.className === "string" ? "." + x.el.className.trim().split(/\s+/).join(".") : "") }; }));
    return r;
  }
  try { if (/[?&]audit=1\b/.test(location.search)) addEventListener("load", function () { setTimeout(report, 800); }); } catch (e) {}

  window.SurfaceMeta = { apply: apply, announce: announce, skip: skip, audit: audit, report: report, name: name };
})();
