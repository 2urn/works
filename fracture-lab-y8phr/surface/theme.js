/* Surface · Theme — Auto | Light | Dark for a tool's interface (Dimitry, 18 Oct 2026, after the studio's first Theme row).

   One choice for every tool on the same site, kept per device (localStorage "surface.theme"), written on
   <html data-theme="auto|light|dark"> as soon as this file runs, so load it in <head> before the tool's styles paint.

   What it gives a tool:
     - the stage-glass tokens (CONVENTIONS › Theme tokens): --ui-g, --ui-hi (as "R G B" for rgb(var(--ui-g) / a)),
       --ui-ink, --ui-solid, --ui-line, --ui-dim, --ui-mid, dark by default, light on Light or on Auto with a light device.
       Surface's capture panel, tips and the chrome's guide pills read them; a tool's own glass should too.
     - SurfaceTheme.controls(host)  a labelled Auto | Light | Dark row for the tool's Settings
     - SurfaceTheme.set(v), .level, .effective ("light" | "dark"), and a "surface:theme" event on every change
       (also when the device flips while on Auto), detail { level, effective }.

   The tool decides what its own light set is (its drawer tokens under :root[data-theme=light] and
   @media (prefers-color-scheme:light){:root[data-theme=auto]...}). The stage is the work: Surface never repaints it. */
(function () {
  "use strict";
  if (window.SurfaceTheme) return;
  var KEY = "surface.theme";
  var LEVELS = [["auto", "Auto", "Follows this device: light or dark as it is set"], ["light", "Light", "Light interface: ink on paper"], ["dark", "Dark", "Dark interface"]];
  function read() { try { var v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "auto"; } catch (e) { return "auto"; } }
  var level = read(), root = document.documentElement;
  root.dataset.theme = level;
  var mq = window.matchMedia ? matchMedia("(prefers-color-scheme: light)") : null;
  function effective() { return level === "auto" ? (mq && mq.matches ? "light" : "dark") : level; }

  var DARK = "--ui-g:14 14 16;--ui-hi:255 255 255;--ui-ink:#eef1f2;--ui-solid:#0f1213;--ui-line:#23292b;--ui-dim:#8a9396;--ui-mid:#b9c2c5";
  var LIGHT = "--ui-g:246 247 248;--ui-hi:0 0 0;--ui-ink:#0d0f10;--ui-solid:#f4f5f5;--ui-line:#d9dddf;--ui-dim:#5d6568;--ui-mid:#3a4144";
  var st = document.createElement("style"); st.id = "surface-theme";
  st.textContent = [
    ":root{" + DARK + "}",
    ":root[data-theme=light]{" + LIGHT + "}",
    "@media (prefers-color-scheme:light){:root[data-theme=auto]{" + LIGHT + "}}",
    ".st-row{display:flex;align-items:center;gap:0 14px;min-height:40px}",
    ".st-lab{flex:none;width:5.5em;font:500 10px/1 var(--sc-mono,ui-monospace,Menlo,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--sc-muted,#a8a8a8)}",
    ".st-seg{display:flex;flex-wrap:wrap;gap:0 14px;flex:1}",
    ".st-seg button{min-height:36px;padding:0;border:0;background:none;color:var(--sc-muted,#a8a8a8);cursor:pointer;font:500 10.5px/1 var(--sc-mono,ui-monospace,Menlo,monospace);letter-spacing:.1em;text-transform:uppercase}",
    ".st-seg button:hover{color:var(--sc-fg,#fff)}",
    ".st-seg button[aria-checked=true]{color:var(--sc-acc,#fff);font-weight:700}",
    ".st-seg button:focus-visible{outline:2px solid var(--sc-acc,#fff);outline-offset:2px}"
  ].join("\n");
  (document.head || root).appendChild(st);

  function fire() { try { document.dispatchEvent(new CustomEvent("surface:theme", { detail: { level: level, effective: effective() } })); } catch (e) {} }
  function set(v) {
    level = v === "light" || v === "dark" ? v : "auto"; root.dataset.theme = level;
    try { localStorage.setItem(KEY, level); } catch (e) {}
    fire();
  }
  if (mq) { var on = function () { if (level === "auto") fire(); }; if (mq.addEventListener) mq.addEventListener("change", on); else if (mq.addListener) mq.addListener(on); }

  function controls(host, o) {
    o = o || {};
    var h = typeof host === "string" ? document.querySelector(host) : host; if (!h) return null;
    var row = document.createElement("div"); row.className = "st-row";
    var lab = document.createElement("span"); lab.className = "st-lab"; lab.id = "st-lab-" + Math.random().toString(36).slice(2, 7); lab.textContent = o.label || "Theme";
    var seg = document.createElement("div"); seg.className = "st-seg"; seg.setAttribute("role", "radiogroup"); seg.setAttribute("aria-labelledby", lab.id);
    function draw() {
      seg.innerHTML = "";
      LEVELS.forEach(function (l) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = l[1]; b.title = l[2];
        b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(level === l[0])); b.tabIndex = level === l[0] ? 0 : -1;
        b.setAttribute("aria-label", "Theme: " + l[1] + ". " + l[2]);
        b.onclick = function () { set(l[0]); };
        b.onkeydown = function (e) {
          if (!/Arrow(Left|Right|Up|Down)/.test(e.key)) return; e.preventDefault();
          var i = LEVELS.findIndex(function (x) { return x[0] === level; }), n = LEVELS[(i + (/Right|Down/.test(e.key) ? 1 : LEVELS.length - 1)) % LEVELS.length];
          set(n[0]); var f = seg.querySelector('[aria-checked="true"]'); if (f) f.focus();
        };
        seg.appendChild(b);
      });
    }
    draw(); document.addEventListener("surface:theme", draw);
    row.append(lab, seg); h.appendChild(row); return row;
  }

  window.SurfaceTheme = { set: set, controls: controls, LEVELS: LEVELS, KEY: KEY, get level() { return level; }, get effective() { return effective(); } };
})();
