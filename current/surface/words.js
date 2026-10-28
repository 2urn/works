/* Surface · Words — how much the interface says in words (Dimitry, 28 Oct 2026 07:39–07:41: "should there be a labels
   only, icon only mode in settings, or a show but fade?"; his pick: three modes, Learn the default).

     always   every icon keeps its word
     learn    words show at first; a control's word fades once it has been used a few times, and comes back the moment a
              finger presses it or the focus rests on it (and on hover, where there is a real pointer)
     never    icons only (for small children, or once everything is known); the words stay for screen readers

   Only words that sit beside an icon that tells the controls apart take part. Never: a word that IS the control (a pill
   that says BEATS), a value (anything with a digit: 120 bpm, 45%, 14s), a name, or a word whose control is marked
   data-words="keep" (e.g. a row of buttons that share one icon). The tool lists its icon words as selectors; the kit
   tags the ones that qualify with .sw-w and the learned ones with .sw-known.

     SurfaceWords.init({ words: ['.shelf .si .lab', …], uses: 5, rings: true })
     SurfaceWords.mode()            → 'always' | 'learn' | 'never'
     SurfaceWords.mode(v)           sets it (kept per device; the rings' labels follow when rings: true) and fires
                                    'surface:words' on document, so every control showing the setting repaints
     SurfaceWords.reset()           forgets what was learned

   Plain script, window.SurfaceWords. */
(function () {
  "use strict";
  if (window.SurfaceWords) return;
  var KEY = "surface.words", SEEN = "surface.words.seen", O = { words: [], uses: 5, rings: true }, seen = {}, sel = "";
  function load() { try { seen = JSON.parse(localStorage.getItem(SEEN) || "{}") || {}; } catch (e) { seen = {}; } }
  function save() { try { localStorage.setItem(SEEN, JSON.stringify(seen)); } catch (e) {} }
  function mode(v) {
    if (v === "always" || v === "learn" || v === "never") {
      try { localStorage.setItem(KEY, v); } catch (e) {}
      document.documentElement.dataset.words = v;
      if (O.rings && window.SurfaceRing && SurfaceRing.labels) try { SurfaceRing.labels(v); } catch (e) {}
      try { document.dispatchEvent(new CustomEvent("surface:words", { detail: { mode: v } })); } catch (e) {}
      mark();
      return v;
    }
    var m; try { m = localStorage.getItem(KEY); } catch (e) {}
    if (m !== "always" && m !== "learn" && m !== "never") {
      /* first time: a ring choice of "always" carries over; "never" there meant only the rings, so it does not hide
         every word in the interface without a word of warning */
      var r = "learn"; try { r = window.SurfaceRing && SurfaceRing.labels ? SurfaceRing.labels() : "learn"; } catch (e) {}
      m = r === "always" ? "always" : "learn";
    }
    return m;
  }
  function control(el) { return el && el.closest ? el.closest("button,[role=button],[role=radio],[role=switch],a") : null; }
  /* a key that does not change with the control's state: its id, its value, else its word */
  function keyOf(c, w) { var g = c.closest && c.closest("[role=radiogroup],[role=group],[role=toolbar]"), pre = g ? (g.id || g.getAttribute("aria-label") || "") + "|" : "";   /* a value means something inside its group (r-2) */
    return c.id || pre + ((c.dataset && (c.dataset.p || c.dataset.v || c.dataset.src || c.dataset.k)) || ((w && w.textContent) || "").trim().slice(0, 40)); }
  function eligible(w, c) { var t = (w.textContent || "").trim(); return !!t && !/\d/.test(t) && !(c && c.closest("[data-words=keep]")); }
  function mark() {
    if (!sel || !document.body) return;
    var ws = document.querySelectorAll(sel);
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i], c = control(w), ok = !!c && eligible(w, c);
      w.classList.toggle("sw-w", ok);
      w.classList.toggle("sw-known", ok && (seen[keyOf(c, w)] || 0) >= O.uses);
    }
  }
  function css() {
    if (document.getElementById("sw-css")) return;
    var st = document.createElement("style"); st.id = "sw-css";
    st.textContent =
      "html[data-words=never] .sw-w{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important}\n" +
      "html[data-words=learn] .sw-w.sw-known{opacity:0!important;transition:opacity .5s ease!important}\n" +
      "html[data-words=learn] :is(:focus-visible,:active) .sw-w.sw-known{opacity:1!important;transition:opacity .12s ease!important}\n" +
      /* hover only where there is a real pointer: a touch screen keeps the last tapped control "hovered" */
      "@media (hover:hover){html[data-words=learn] :hover>.sw-known,html[data-words=learn] :hover>*>.sw-known{opacity:1!important;transition:opacity .12s ease!important}}\n" +
      "@media (prefers-reduced-motion:reduce){html[data-words=learn] .sw-known{transition:none!important}}";
    document.head.appendChild(st);
  }
  function init(o) {
    for (var k in o || {}) O[k] = o[k];
    O.words = (O.words || []).filter(Boolean); sel = O.words.join(",");
    load(); var m0 = mode(); try { if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, m0); } catch (e) {}
    document.documentElement.dataset.words = m0;
    if (O.rings && window.SurfaceRing && SurfaceRing.labels) try { if (SurfaceRing.labels() !== m0) SurfaceRing.labels(m0); } catch (e) {}   /* one setting from the first load (review 6e53bf3660 r-1) */
    css(); mark();
    /* a use: a tap that ends on a control with a qualifying word */
    window.addEventListener("click", function (e) {
      if (!sel || document.documentElement.dataset.words !== "learn") return;
      var c = control(e.target), w = c && c.querySelector(".sw-w"); if (!w) return;
      var k = keyOf(c, w); seen[k] = (seen[k] || 0) + 1; save();
      if (seen[k] === O.uses) setTimeout(mark, 1600);   // it fades a moment after, not under the finger
    }, true);
    /* controls are drawn again often (shelves, panels): mark what arrives. Text updates (a clock, a readout) add only text
       nodes and are skipped, so a ticking HUD costs nothing */
    var q = 0;
    try { new MutationObserver(function (recs) {
      if (q) return;
      for (var i = 0; i < recs.length; i++) { var a = recs[i].addedNodes; for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1) { q = setTimeout(function () { q = 0; mark(); }, 120); return; } }
    }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }
  function reset() { seen = {}; save(); mark(); }
  window.SurfaceWords = { init: init, mode: mode, reset: reset };
})();
