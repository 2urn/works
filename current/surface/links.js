/* Surface · Links — deep links into a tool (Dimitry, 18 Oct 2026: someone wanted to keep Current on their phone; the
   install steps are in the index, but there was no way to send them straight there, so he talked them through it).

   A link ending in #name opens the tool on that place: works.chamy.xyz/current/#install opens the drawer on the install
   steps. Works on first load and when the hash changes while the tool is open.

     SurfaceLinks.mount({
       open: () => {},                       // opens the drawer (the index), so a section inside it can be shown
       base: 'https://works.chamy.xyz/current/',   // the public address links are made from (default: this page)
       names: { install: () => guide.open(), keys: () => SurfaceKeys.open() }   // names with their own action
     })
     SurfaceLinks.url('install')  → 'https://works.chamy.xyz/current/#install'
     SurfaceLinks.copy('install') → copies that link (or shares it, on a phone), resolves to true when done
     SurfaceLinks.button(name, label?) → a small "copy link" button for a section head

   A name without an action of its own falls back to an element with that id inside the drawer: the drawer opens,
   the section unfolds (SurfaceSections) and scrolls into view. Unknown names do nothing. */
(function () {
  "use strict";
  if (window.SurfaceLinks) return;
  var O = { open: null, base: null, names: {} };
  var LINK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>';
  var CSS = ".slk{display:inline-grid;place-items:center;width:32px;height:32px;padding:0;border:0;background:none;color:var(--ui-dim,#8a9396);cursor:pointer;vertical-align:middle;border-radius:8px}" +
    ".slk:hover{color:var(--ui-ink,#fff)}.slk svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
    ".slk.done{color:var(--cap-acc,var(--sc-acc,#55b8c9))}";
  function base() { return O.base || (location.origin + location.pathname); }
  function url(name) { return base().replace(/#.*$/, "") + "#" + encodeURIComponent(name); }
  function go(name) {
    if (!name) return false;
    var f = O.names[name];
    if (typeof f === "function") { try { f(); } catch (e) { console.warn("link " + name, e); } return true; }
    var el = document.getElementById(name);
    if (!el) return false;
    if (typeof O.open === "function") try { O.open(); } catch (_) {}
    try { if (window.SurfaceSections) SurfaceSections.open(name); } catch (_) {}
    el.classList.remove("cx-shut");
    setTimeout(function () { el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }, 340);
    return true;
  }
  function fromHash() { var h = decodeURIComponent((location.hash || "").slice(1)); if (h) go(h); }
  function copy(name, label) {
    var u = url(name), t = (label || document.title || "").trim();
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      return navigator.share({ title: t, url: u }).then(function () { return true; }, function () { return false; });
    }
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(u).then(function () { return true; }, function () { return false; });
    try { var ta = document.createElement("textarea"); ta.value = u; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); return Promise.resolve(true); } catch (_) { return Promise.resolve(false); }
  }
  function button(name, label) {
    if (!document.getElementById("slk-css")) { var st = document.createElement("style"); st.id = "slk-css"; st.textContent = CSS; document.head.appendChild(st); }
    var b = document.createElement("button"); b.type = "button"; b.className = "slk"; b.innerHTML = LINK;
    var what = label || name;
    b.setAttribute("aria-label", "Copy a link straight to " + what); b.title = "Link to " + what;
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      copy(name, what).then(function (ok) {
        if (!ok) return; b.classList.add("done"); b.title = "Link copied"; setTimeout(function () { b.classList.remove("done"); b.title = "Link to " + what; }, 1600);
        try { document.dispatchEvent(new CustomEvent("surface:link", { detail: { name: name, url: url(name) } })); } catch (_) {}
      });
    });
    return b;
  }
  function mount(o) {
    o = o || {}; O.open = o.open || O.open; O.base = o.base || O.base;
    for (var k in (o.names || {})) O.names[k] = o.names[k];
    if (!mount.done) { mount.done = true; addEventListener("hashchange", fromHash); }
    if (document.readyState === "complete") setTimeout(fromHash, 400); else addEventListener("load", function () { setTimeout(fromHash, 400); });
  }
  window.SurfaceLinks = { mount: mount, url: url, go: go, copy: copy, button: button };
})();
