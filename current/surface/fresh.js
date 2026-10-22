/* Surface · Fresh — a tiny sparkle on a control that does something new (Dimitry, 22 Oct 2026: "a way for people to
   know that there are new features ... just like we have the pro button with the lock, something on the top right, a
   tiny icon that indicates a new feature"). A four-point star in the accent colour, 9 px, centred on the control's top right corner (8% in, so a round button's
   rim carries it)
   (Pro's padlock corner; the path dots keep the lower right, so a plain dot would read as one of them).

   It shows only to people who used the tool before the feature came (a first visit is all new; marking everything
   would be noise), and goes once they have used that control, or two releases after the feature came.

     SurfaceFresh.init({
       tool: 'current',                 // the storage key's prefix
       version: '0.29.37',              // this build's version
       feats: { offbar: { sel: '#pSnd', since: '0.29.36', name: 'Sound off fades' }, ... },
       life: 2                          // releases a sparkle lives (patch steps; a new minor ends it)
     })
     SurfaceFresh.seen(id)              // mark one used by hand (a shortcut or a menu reached it)
     SurfaceFresh.list()                // [{ id, name }] showing now, for a version line
   Plain script, window.SurfaceFresh, no dependencies. Default looks at zero specificity: the tool's rules win. */
(function () {
  "use strict";
  if (window.SurfaceFresh) return;
  var O = null, LS = "", seen = {}, first = "";
  var STAR = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M6 .6C6.5 3.9 8.1 5.5 11.4 6 8.1 6.5 6.5 8.1 6 11.4 5.5 8.1 3.9 6.5.6 6 3.9 5.5 5.5 3.9 6 .6z"/></svg>';
  function num(v) { var p = String(v || "0").split(".").map(function (x) { return parseInt(x, 10) || 0; }); return [p[0] || 0, p[1] || 0, p[2] || 0]; }
  function before(a, b) { a = num(a); b = num(b); for (var i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; }
  function fresh(f) {
    var v = num(O.version), s = num(f.since);
    if (v[0] !== s[0] || v[1] !== s[1]) return false;          // a new minor ends every sparkle
    return v[2] - s[2] < (O.life || 2) && v[2] >= s[2];
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify({ first: first, seen: seen })); } catch (e) {} }
  function showing(id) { var f = O.feats[id]; return !!f && !seen[id] && fresh(f) && first && before(first, f.since); }
  function css() {
    if (document.getElementById("sfresh-css")) return;
    var st = document.createElement("style"); st.id = "sfresh-css";
    st.textContent = ":where(.sf-new){position:absolute;top:14.6%;right:14.6%;width:9px;height:9px;transform:translate(50%,-50%);pointer-events:none;color:var(--acc,var(--accent,#55b8c9));z-index:2;filter:drop-shadow(0 0 1px var(--ui-solid,#000)) drop-shadow(0 0 1px var(--ui-solid,#000))}" +
      ":where(.sf-new) svg{display:block;width:100%;height:100%;fill:currentColor;animation:sf-tw 3.6s ease-in-out infinite}" +
      "@keyframes sf-tw{0%,70%,100%{transform:scale(1) rotate(0)}80%{transform:scale(1.35) rotate(45deg)}90%{transform:scale(.9) rotate(45deg)}}" +
      "@media (prefers-reduced-motion:reduce){:where(.sf-new) svg{animation:none}}";
    (document.head || document.documentElement).appendChild(st);
  }
  function paint() {
    if (!O) return;
    Object.keys(O.feats).forEach(function (id) {
      var f = O.feats[id], on = showing(id);
      document.querySelectorAll(f.sel).forEach(function (el) {
        var m = el.querySelector(":scope>.sf-new");
        if (on && !m) {
          m = document.createElement("span"); m.className = "sf-new"; m.setAttribute("aria-hidden", "true"); m.innerHTML = STAR;
          if (getComputedStyle(el).position === "static") el.style.position = "relative";
          el.appendChild(m);
          if (!el.dataset.sfLab) { el.dataset.sfLab = "1"; var l = el.getAttribute("aria-label"); if (l) el.setAttribute("aria-label", l + " (new)"); }
          if (!el.dataset.sfWired) { el.dataset.sfWired = "1"; el.addEventListener("click", function () { mark(id); }); }
        } else if (!on && m) { m.remove(); var l2 = el.getAttribute("aria-label"); if (l2) el.setAttribute("aria-label", l2.replace(/ \(new\)$/, "")); }
      });
    });
  }
  function mark(id) { if (seen[id]) return; seen[id] = 1; save(); paint(); }
  function init(o) {
    O = o || {}; O.feats = O.feats || {}; LS = (O.tool || "surface") + ":fresh";
    var d = null; try { d = JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) {}
    seen = (d && d.seen) || {};
    /* first: the version this browser first ran. A browser that ran the tool before Fresh came has no record, so it
       counts as an old friend when the tool says so (o.known: the tool's own sign of a past visit) */
    first = (d && d.first) || (O.known ? "0.0.0" : O.version);
    save(); css(); paint();
    if (window.MutationObserver) { var due = 0; new MutationObserver(function () { if (!due) due = requestAnimationFrame(function () { due = 0; paint(); }); }).observe(document.body, { childList: true, subtree: true }); }
  }
  window.SurfaceFresh = {
    init: init, seen: mark, paint: paint, STAR: STAR,
    list: function () { return O ? Object.keys(O.feats).filter(showing).map(function (id) { return { id: id, name: O.feats[id].name || id }; }) : []; }
  };
})();
