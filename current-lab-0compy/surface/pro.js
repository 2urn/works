/* Surface · Pro — signed Pro keys for every studio tool (Dimitry, 21 Oct 2026: "call things a pro feature, but give me a
   special pass so that I have all the pro features automatically and they're working ... or a temporary pro license
   input").

   A key is a signed note: who it is for, which tool (or every tool, "*"), what it unlocks ("*": all of Pro), when it was
   issued and until when (null: no end). Only the studio holds the private key that signs; a tool carries the public key
   that checks, so a key can't be written by hand or edited (change a letter and it stops being valid).

     CXP1.<payload>.<signature>        payload = base64url(JSON {v:1, w, t, f, i, u}), signature = ECDSA P-256 / SHA-256
                                       over the payload segment's exact ASCII bytes (IEEE P1363, 64 bytes), base64url

     SurfacePro.init({tool, publicKey, onChange})   publicKey: a JWK object, or raw (65-byte uncompressed point) as base64url
                                                     → Promise (resolves once a stored key or a #pro= link is checked)
     SurfacePro.is(feature)        → true when a valid key covers this tool and this feature (synchronous after init)
     SurfacePro.info()             → {who, until, tool} | null
     SurfacePro.enter(key)         → Promise<{ok, who, until, error}>   (error: a sentence a person can read)
     SurfacePro.clear()            removes the key
     document 'surface:pro'        detail {on, info}, on every change

   A link that ends #pro=<key> enters the key once, then takes it out of the address bar (history.replaceState); in a
   built player the exporter has already moved the fragment to window.__LINK__, and it is read there.
   Honest limits: this runs in the page, so it keeps honest people honest; it is not a lock against someone editing the
   tool's own code. It is the shape a real licence service (2urn Key) can sit behind later: same keys, checked server-side.
   Plain script, window.SurfacePro, no dependencies (WebCrypto). */
(function () {
  "use strict";
  if (window.SurfacePro) return;
  var LS = "surface.pro", st = { tool: null, pub: null, on: false, info: null, feats: "*", cb: null }, ready = null;
  function b64u(s) { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function fire() { try { document.dispatchEvent(new CustomEvent("surface:pro", { detail: { on: st.on, info: st.info } })); } catch (e) {} try { st.cb && st.cb(st.on, st.info); } catch (e) {} }
  function importKey(k) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error("This browser can't check keys (it needs a secure page, https)."));
    var alg = { name: "ECDSA", namedCurve: "P-256" };
    return typeof k === "string" ? crypto.subtle.importKey("raw", b64u(k), alg, false, ["verify"]) : crypto.subtle.importKey("jwk", k, alg, false, ["verify"]);
  }
  function check(key) {
    key = String(key || "").trim().replace(/\s+/g, "");
    var parts = key.split(".");
    if (parts.length !== 3 || parts[0] !== "CXP1") return Promise.resolve({ ok: false, error: "That isn't a Pro key: a key starts with CXP1 and has three parts." });
    var p; try { p = JSON.parse(new TextDecoder().decode(b64u(parts[1]))); } catch (e) { return Promise.resolve({ ok: false, error: "That key is damaged: check it was copied whole." }); }
    var sig; try { sig = b64u(parts[2]); } catch (e) { return Promise.resolve({ ok: false, error: "That key is damaged: check it was copied whole." }); }
    return (st.pub || Promise.reject(new Error("no public key"))).then(function (pub) {
      return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, sig, new TextEncoder().encode(parts[1]));
    }).then(function (good) {
      if (!good) return { ok: false, error: "That key doesn't check out: it wasn't issued by the studio, or it was changed." };
      if (!p || p.v !== 1) return { ok: false, error: "That key is for a newer version: reload the page and try again." };
      if (p.t !== "*" && p.t !== st.tool) return { ok: false, error: "That key is for another tool (" + p.t + ")." };
      if (p.u && Date.parse(p.u) < Date.now()) return { ok: false, error: "That key ended on " + String(p.u).slice(0, 10) + "." };
      return { ok: true, who: p.w || "", until: p.u || null, tool: p.t, feats: p.f || "*", key: key };
    }, function (e) { return { ok: false, error: (e && e.message && /secure|browser/.test(e.message)) ? e.message : "This page couldn't check the key." }; });
  }
  function apply(r) {
    if (r.ok) { st.on = true; st.feats = r.feats; st.info = { who: r.who, until: r.until, tool: r.tool }; try { localStorage.setItem(LS, r.key); } catch (e) {} }
    else { st.on = false; st.info = null; }
    fire(); return r;
  }
  function init(o) {
    o = o || {}; st.tool = o.tool || null; st.cb = o.onChange || null;
    st.pub = importKey(o.publicKey); st.pub.catch(function () {});
    var fromLink = null;
    try { var m = /(?:^#|&)pro=([^&]+)/.exec(location.hash || ""); if (m) { fromLink = decodeURIComponent(m[1]); var h = location.hash.replace(/(^#|&)pro=[^&]+/, "$1").replace(/^#&/, "#").replace(/^#$/, ""); history.replaceState(null, "", location.pathname + location.search + h); } } catch (e) {}
    /* a built player has already taken the fragment (the exporter keeps it as window.__LINK__ and clears the bar): read it
       there, and hand the rest back so a deep link that came with the key still works */
    try { if (!fromLink && typeof window.__LINK__ === "string") { var m2 = /(?:^|&)pro=([^&]+)/.exec(window.__LINK__); if (m2) { fromLink = decodeURIComponent(m2[1]); window.__LINK__ = window.__LINK__.replace(/(^|&)pro=[^&]+/, "").replace(/^&/, "") || null; } } } catch (e) {}
    var stored = null; try { stored = localStorage.getItem(LS); } catch (e) {}
    ready = (fromLink ? check(fromLink).then(function (r) { r.fromLink = true; if (r.ok) return apply(r); return stored ? check(stored).then(function (r2) { if (r2.ok) apply(r2); return r; }) : r; })
      : stored ? check(stored).then(function (r) { if (!r.ok) { try { localStorage.removeItem(LS); } catch (e) {} } return apply(r); }) : Promise.resolve({ ok: false }));
    return ready;
  }
  /* PRO IN BETA (Dimitry, 22 Oct 2026: Pro features "currently unlocked for beta testers"; the mark is an open padlock).
     A tool names the Pro features it is testing; they work for everyone until the tool stops listing them, and they wear
     the open lock instead of the closed one. A key still covers everything else.
       SurfacePro.beta({ session: { name: "Session", note: "laptops in one room in time" }, ... })
       SurfacePro.state(f)   → "key" (a key covers it) | "beta" (open for testing) | "locked"
       SurfacePro.mark(f)    → the mark's SVG: closed lock + bolt, open lock + bolt, or "" when a key covers it
       SurfacePro.testing()  → [{ id, name, note }] for a version line's disclosure */
  var BETA = {};
  var SHUT = '<path class="shC" d="M8 10V7.5a4 4 0 0 1 8 0V10"/>', OPEN = '<path class="shO" d="M8 10V7a4 4 0 0 1 7.6-1.7"/>';
  var BODY = '<rect x="4.5" y="10" width="15" height="11.5" rx="2.4"/><path class="bolt" d="M13.2 11.9 9.6 16.4h2.7l-1.4 3.4 3.9-4.8h-2.8z"/>';
  /* the open padlock breathes (Dimitry, 22 Oct: "a subtle animation of the lock popping open, just the top part
     pulsing up and down"): only the shackle lifts and tilts a little, every few seconds; still under reduced motion.
     Never call the open state "beta" in CSS: tools already use .beta for the Founders pill. */
  (function css() {
    if (typeof document === "undefined" || document.getElementById("spro-css")) return;
    var st = document.createElement("style"); st.id = "spro-css";
    st.textContent = ".proOpen .shO,.proMk.proOpen .shO,.proOpen>.proMk .shO{transform-box:fill-box;transform-origin:0% 100%;animation:spro-lift 3.2s ease-in-out infinite}" +
      "@keyframes spro-lift{0%,46%,100%{transform:none}18%{transform:translateY(-2.2px) rotate(-7deg)}30%{transform:translateY(-1px) rotate(-3deg)}}" +
      "@media (prefers-reduced-motion:reduce){.proOpen .shO,.proMk.proOpen .shO{animation:none}}";
    (document.head || document.documentElement).appendChild(st);
  })();
  function keyed(f) { return st.on && (st.feats === "*" || (Array.isArray(st.feats) && st.feats.indexOf(f) >= 0)); }
  function stateOf(f) { return keyed(f || "*") ? "key" : (f && BETA[f]) ? "beta" : "locked"; }
  window.SurfacePro = {
    beta: function (map) { BETA = map || {}; fire(); },
    state: stateOf,
    mark: function (f, cls) { var s2 = stateOf(f); if (s2 === "key") return "";
      return '<svg class="proMk' + (s2 === "beta" ? " proOpen" : "") + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (s2 === "beta" ? OPEN : SHUT) + BODY + "</svg>"; },
    testing: function () { return Object.keys(BETA).filter(function (k) { return !keyed(k); }).map(function (k) { var b = BETA[k] || {}; return { id: k, name: b.name || k, note: b.note || "" }; }); },
    SHUT: SHUT, OPEN: OPEN, BODY: BODY,
    init: init,
    ready: function () { return ready || Promise.resolve({ ok: false }); },
    is: function (feature) { if (feature && feature !== "*" && BETA[feature]) return true; if (!st.on) return false; return st.feats === "*" || (Array.isArray(st.feats) && st.feats.indexOf(feature) >= 0); },
    info: function () { return st.on ? st.info : null; },
    enter: function (key) { return check(key).then(function (r) { if (r.ok) apply(r); return { ok: r.ok, who: r.who, until: r.until, error: r.error }; }); },
    clear: function () { try { localStorage.removeItem(LS); } catch (e) {} st.on = false; st.info = null; fire(); }
  };
})();
