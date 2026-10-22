/* Surface · Fresh — a tiny sparkle on a control that does something new (Dimitry, 22 Oct 2026: "a way for people to
   know that there are new features ... just like we have the pro button with the lock, something on the top right, a
   tiny icon that indicates a new feature"). A four-point star in the accent colour, 13 px, round-pointed, on the corner of the control's box (outside a round
   button's rim); it pulses twice when it appears, then holds still
   (Pro's padlock corner; the path dots keep the lower right, so a plain dot would read as one of them).

   It shows only to people who used the tool before the feature came (a first visit is all new; marking everything
   would be noise), and goes once they have used that control, or once `keep` newer features have come (or, without keep,
   two releases after the feature came).

     SurfaceFresh.init({
       tool: 'current',                 // the storage key's prefix
       version: '0.29.37',              // this build's version
       feats: { offbar: { sel: '#pSnd', since: '0.29.36', name: 'Sound off fades' }, ... },
       // a feat may add pro: 'session' (its Pro id): no sparkle, and not counted, while that Pro feature is in beta
       keep: 8                          // a sparkle lives until 8 newer features have come (list feats oldest first, keep old ones)
       life: 2                          // without keep: releases a sparkle lives (patch steps; a new minor ends it)
     })
     SurfaceFresh.seen(id)              // mark one used by hand (a shortcut or a menu reached it)
     SurfaceFresh.list()                // [{ id, name }] showing now, for a version line
     SurfaceFresh.kind('new'|'fix'|'change', {label})   // the icon of a kind of change + its word (NEW / FIX / CHANGE), HTML: two cells (16 px, auto)
     SurfaceFresh.KINDS                 // { new|fix|change: { name, color, svg } }
   Plain script, window.SurfaceFresh, no dependencies. Default looks at zero specificity: the tool's rules win. */
(function () {
  "use strict";
  if (window.SurfaceFresh) return;
  var O = null, LS = "", seen = {}, first = "";
  /* the points are rounded (a round-joined stroke of the same colour), so it reads as a twinkle, not a blade (Dimitry, 22 Oct).
     Size and paint are inline: a tool's own "button svg" rule (Current's bar: 28 px, by id) outranks any class rule here,
     and turned the 9 px star into a 28 px one */
  var STAR = '<svg viewBox="-.6 -.6 13.2 13.2" aria-hidden="true" focusable="false" style="display:block;width:100%;height:100%;margin:0;fill:currentColor;stroke:none"><path d="M6 .6C6.5 3.9 8.1 5.5 11.4 6 8.1 6.5 6.5 8.1 6 11.4 5.5 8.1 3.9 6.5.6 6 3.9 5.5 5.5 3.9 6 .6z" style="fill:currentColor;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round"/></svg>';
  function num(v) { var p = String(v || "0").split(".").map(function (x) { return parseInt(x, 10) || 0; }); return [p[0] || 0, p[1] || 0, p[2] || 0]; }
  function before(a, b) { a = num(a); b = num(b); for (var i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; }
  /* Pro in beta wears its padlock, not a sparkle, and is not counted among the eight, until it leaves beta (Dimitry,
     22 Oct: "that doesn't include pro trials, they stay with locks until they are released from beta").
     A feat says pro: '<Pro feature id>'; a control already wearing an open padlock is skipped too */
  function inBeta(f) { return !!(f.pro && window.SurfacePro && SurfacePro.state && SurfacePro.state(f.pro) === "beta"); }
  function fresh(f, id) {
    /* keep: n (Dimitry, 22 Oct: "make it last 8 new features, not releases"): a sparkle lives until n newer features have
       come. feats are listed oldest first, and old ones stay in the list (they are what is counted) */
    if (inBeta(f)) return false;
    if (O.keep) { var ks = Object.keys(O.feats).filter(function (k) { return !inBeta(O.feats[k]); }), i = ks.indexOf(id); return !before(O.version, f.since) && ks.length - 1 - i < O.keep; }
    var v = num(O.version), s = num(f.since);
    if (v[0] !== s[0] || v[1] !== s[1]) return false;          // a new minor ends every sparkle
    return v[2] - s[2] < (O.life || 2) && v[2] >= s[2];
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify({ first: first, seen: seen })); } catch (e) {} }
  function showing(id) { var f = O.feats[id]; return !!f && !seen[id] && fresh(f, id) && first && before(first, f.since); }
  function css() {
    if (document.getElementById("sfresh-css")) return;
    var st = document.createElement("style"); st.id = "sfresh-css";
    /* 13 px (half of the 28 px he saw, see STAR), centred on the corner of the control box: a four-point star there keeps
       its arms along the box edges, so on a round button it stays outside the rim
       and never sits on the button. Two gentle pulses when it appears, then still (Dimitry, 22 Oct: "way too
       aggressive ... about 50% of that size ... barely move ... once or twice and then it doesn't do anything") */
    st.textContent = ":where(.sf-new){position:absolute;top:0;right:0;width:13px;height:13px;transform:translate(50%,-50%);pointer-events:none;color:var(--acc,var(--accent,#55b8c9));z-index:2;filter:drop-shadow(0 0 .75px var(--ui-solid,#000))}" +
      ":where(.sf-new) svg{animation:sf-tw 1.4s ease-in-out .6s 2}" +
      "@keyframes sf-tw{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.2);opacity:.75}}" +
      "@media (prefers-reduced-motion:reduce){:where(.sf-new) svg{animation:none}}";
    (document.head || document.documentElement).appendChild(st);
  }
  function paint() {
    if (!O) return;
    Object.keys(O.feats).forEach(function (id) {
      var f = O.feats[id], on = showing(id);
      document.querySelectorAll(f.sel).forEach(function (el) {
        var m = el.querySelector(":scope>.sf-new");
        if (el.querySelector(".proOpen")) on = false;
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
  /* KINDS OF CHANGE (Dimitry, 22 Oct 13:39): the update pill and every list of versions mark an item by its kind, with an
     icon in a fixed 16 px slot so the text lines up: new = this sparkle, in the accent; fix = a squashed bug; change = two
     turning arrows. 14 px line icons (the sparkle 12 px, it is solid). A screen reader hears the kind as a word ("New:").
     kind(k, {label:false}) leaves the word out (the pill's own leading sparkle). Plain strings, so export/v1/build.mjs
     reads them from this file at build time: one drawing for the pill and the Version section alike. */
  var LINE = 'viewBox="0 0 16 16" aria-hidden="true" focusable="false" style="display:block;width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round"';
  var KINDS = {
    "new": { name: "New", color: "var(--acc,var(--accent,#55b8c9))", svg: '<span style="display:block;width:12px;height:12px">' + STAR + "</span>" },
    /* a bug flattened: a wide low body, legs splayed flat, a small burst where it was hit */
    fix: { name: "Fix", color: "#e8b04a", svg: "<svg " + LINE + '><ellipse cx="8" cy="11.4" rx="4.3" ry="2.1"/><path d="M6.5 9.4a1.6 1.1 0 0 1 3 0M3.9 10.6 1.5 9.8M3.9 12.2 1.4 13M12.1 10.6l2.4-.8M12.1 12.2l2.5.8M8 2v2.4M4.6 3.3l1.2 1.7M11.4 3.3l-1.2 1.7"/></svg>' },
    /* two arrows turning round each other: something that was there works differently now */
    change: { name: "Change", color: "#9aa5a8", svg: "<svg " + LINE + '><path d="M12.8 6.4A5 5 0 0 0 3.5 5.2M3.2 9.6a5 5 0 0 0 9.3 1.2M3.3 2.6v2.8h2.8M12.7 13.4v-2.8H9.9"/></svg>' }
  };
  function kind(k, o) {
    var K = KINDS[k]; if (!K) return '<span style="display:inline-block;flex:none;width:16px;height:16px"></span><span></span>';   // two cells, like a kind
    var lab = !(o && o.label === false);
    return '<span class="sf-kind" data-kind="' + k + '" aria-hidden="true" style="display:inline-flex;flex:none;width:16px;height:16px;align-items:center;justify-content:center;vertical-align:-3px;color:' + K.color + '">' + K.svg + "</span>" +
      /* the word is shown too (Dimitry, 22 Oct 14:23: "we should still have those labels"): small capitals in the kind's
         colour, in its own column after the icon, so notes read NEW / FIX / CHANGE at a glance as well as by icon */
      (lab ? '<span class="sf-kindw" style="flex:none;align-self:baseline;font:600 9px/16px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;color:' + K.color + '">' + K.name + '<span style="position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0)">:</span></span>' : "");
  }
  window.SurfaceFresh = {
    init: init, seen: mark, paint: paint, STAR: STAR, KINDS: KINDS, kind: kind,
    list: function () { return O ? Object.keys(O.feats).filter(showing).map(function (id) { return { id: id, name: O.feats[id].name || id }; }) : []; }
  };
})();
