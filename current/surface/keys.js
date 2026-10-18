/* Surface · Keys — every keyboard shortcut a tool has, on one big sheet, and the switch that turns them off
   (Dimitry, 18 Oct 2026).

   1. THE SHEET. A button on the player bar (and the ? key) lays every shortcut over the stage in large key caps,
      grouped: the ones every studio tool shares first, then the tool's own. Esc, ?, the button, or a tap outside
      closes it. Built from data, so the sheet and the guide's Keys list can be fed from one list.
   2. THE SWITCH. Single-character shortcuts must be possible to turn off (WCAG 2.2, 2.1.4 Character Key Shortcuts):
      speech input arrives as keystrokes, and a spoken "c" should not take a photo. "Single-key shortcuts: on / off"
      sits on the sheet and is shared by every tool on the site (localStorage surface.keys). When it is off, this
      module swallows single printable characters (letters, numbers, punctuation) before the tool sees them. Space,
      the arrows, Esc and anything with Cmd, Ctrl or Alt keep working; so does typing in a field.
   3. THE BUTTON shows on devices with a keyboard-and-pointer (hover and a fine pointer), and on any device the
      moment a key is pressed (an iPad with a keyboard, a phone with a Bluetooth one). Touch-only, it stays out of
      the way: there are no keys to show.

   Plain script, window.SurfaceKeys, no dependencies.
     SurfaceKeys.mount({
       button: '#pKeys',                  // optional: the bar button that opens the sheet
       title: 'Keys',
       groups: [{ name: 'Every studio tool', keys: [{ k: ['f'], d: 'Full screen' }, …] }, { name: 'Current', keys: […] }],
       note: 'optional line at the foot'
     })
     SurfaceKeys.open() / .close() / .enabled
   Events: 'surface:keys' on document, detail { enabled }. Colours come from the theme tokens (--ui-*), with the
   dark values as fallbacks. */
(function () {
  "use strict";
  var KEY = "surface.keys";
  var on = true; try { on = localStorage.getItem(KEY) !== "off"; } catch (e) {}
  var CSS = "\
.sk-btn[hidden]{display:none!important}\
.sk-ov{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top,0px)) 16px max(16px,env(safe-area-inset-bottom,0px));background:rgb(var(--ui-g,14 14 16) / .78);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:var(--ui-ink,#eef1f2);opacity:0;transition:opacity .2s ease}\
.sk-ov.on{opacity:1}.sk-ov[hidden]{display:none}\
.sk-box{width:min(920px,100%);max-height:100%;overflow:auto;padding:22px 24px 18px;border:1px solid var(--ui-line,#23292b);background:var(--ui-solid,#0f1213);border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.45)}\
.sk-hd{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px}\
.sk-hd h2{margin:0;font:600 13px/1 var(--mono,ui-monospace,monospace);letter-spacing:.16em;text-transform:uppercase}\
.sk-x{width:40px;height:40px;border:0;border-radius:50%;background:none;color:inherit;cursor:pointer;font:400 22px/1 var(--sans,system-ui)}\
.sk-x:hover{background:rgb(var(--ui-hi,255 255 255) / .08)}\
.sk-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:6px 34px}\
.sk-g h3{margin:14px 0 6px;font:500 11px/1.2 var(--mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--ui-dim,#8a9396)}\
.sk-row{display:flex;align-items:center;gap:14px;min-height:46px;border-top:1px solid var(--ui-line,#23292b)}\
.sk-caps{flex:none;display:flex;gap:6px;min-width:96px}\
.sk-caps kbd{display:inline-grid;place-items:center;min-width:40px;height:40px;padding:0 10px;border:1.5px solid rgb(var(--ui-hi,255 255 255) / .55);border-bottom-width:3px;border-radius:7px;font:600 17px/1 var(--mono,ui-monospace,monospace);color:var(--ui-ink,#eef1f2);box-sizing:border-box}\
.sk-row span{font:400 15px/1.35 var(--sans,system-ui)}\
.sk-ft{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 18px;margin-top:16px;padding-top:12px;border-top:1px solid var(--ui-line,#23292b);font:400 12px/1.5 var(--sans,system-ui);color:var(--ui-dim,#8a9396)}\
.sk-sw{display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0 4px;border:0;background:none;color:var(--ui-ink,#eef1f2);cursor:pointer;font:500 13px/1 var(--sans,system-ui)}\
.sk-sw i{position:relative;width:40px;height:24px;border-radius:12px;background:rgb(var(--ui-hi,255 255 255) / .2);transition:background .15s}\
.sk-sw i::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .15s}\
.sk-sw[aria-checked=true] i{background:var(--sk-acc,#55b8c9)}.sk-sw[aria-checked=true] i::after{transform:translateX(16px)}\
.sk-sw:focus-visible,.sk-x:focus-visible{outline:2px solid var(--sk-acc,#55b8c9);outline-offset:2px}\
.sk-off .sk-caps kbd.sk-ch{opacity:.35}\
@media (prefers-reduced-motion:reduce){.sk-ov,.sk-sw i,.sk-sw i::after{transition:none}}";

  var ov = null, box = null, opts = null, lastFocus = null, btn = null;
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function isChar(k) { return typeof k === "string" && k.length === 1 && k !== " "; }
  function typing(t) { return t && t.closest && t.closest("input,select,textarea,[contenteditable=''],[contenteditable=true]"); }

  /* the switch: swallow single printable characters before the tool's own handlers see them */
  window.addEventListener("keydown", function (e) {
    if (btn && btn.hidden && !e.metaKey && !e.ctrlKey) btn.hidden = false;   // a keyboard has spoken: show the way to the sheet
    if (on || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    if (isChar(e.key)) { e.stopImmediatePropagation(); }
  }, true);

  function build() {
    if (!document.getElementById("sk-css")) { var st = el("style"); st.id = "sk-css"; st.textContent = CSS; document.head.appendChild(st); }
    ov = el("div", "sk-ov"); ov.hidden = true; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-labelledby", "sk-title");
    box = el("div", "sk-box"); ov.appendChild(box);
    ov.addEventListener("pointerdown", function (e) { if (e.target === ov) close(); });
    ov.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.key === "?") { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === "Tab") {   // keep the focus inside the sheet
        var f = box.querySelectorAll("button"); if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
      e.stopPropagation();     // the tool's shortcuts rest while the sheet is open
    });
    document.body.appendChild(ov);
  }
  function render() {
    box.textContent = "";
    var hd = el("div", "sk-hd"), h = el("h2", null, opts.title || "Keys"); h.id = "sk-title";
    var x = el("button", "sk-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Close the keys"); x.onclick = close;
    hd.append(h, x); box.appendChild(hd);
    var cols = el("div", "sk-cols");
    (opts.groups || []).forEach(function (g) {
      var sec = el("section", "sk-g"); sec.appendChild(el("h3", null, g.name));
      (g.keys || []).forEach(function (r) {
        var row = el("div", "sk-row"), caps = el("span", "sk-caps");
        (r.k || []).forEach(function (k) { var kb = el("kbd", isChar(k) ? "sk-ch" : null, k); caps.appendChild(kb); });
        caps.setAttribute("aria-label", (r.k || []).join(" or ")); row.append(caps, el("span", null, r.d)); sec.appendChild(row);
      });
      cols.appendChild(sec);
    });
    box.appendChild(cols);
    var ft = el("div", "sk-ft"), sw = el("button", "sk-sw"); sw.type = "button"; sw.setAttribute("role", "switch");
    sw.append(el("i"), el("span", null, "Single-key shortcuts"));
    var sync = function () { sw.setAttribute("aria-checked", String(on)); box.classList.toggle("sk-off", !on); };
    sw.onclick = function () { set(!on); sync(); };
    sync();
    ft.append(sw, el("span", null, opts.note || "Turn them off if you control the page by voice, so a spoken word does not trigger a key. Space, the arrows and Esc keep working."));
    box.appendChild(ft);
  }
  function set(v) {
    on = !!v; try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) {}
    document.dispatchEvent(new CustomEvent("surface:keys", { detail: { enabled: on } }));
  }
  function open() {
    if (!ov) build(); render(); lastFocus = document.activeElement;
    ov.hidden = false; requestAnimationFrame(function () { ov.classList.add("on"); });
    if (btn) btn.setAttribute("aria-expanded", "true");
    var c = box.querySelector(".sk-x"); if (c) c.focus({ preventScroll: true });
  }
  function close() {
    if (!ov || ov.hidden) return; ov.classList.remove("on"); ov.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
    try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  function mount(o) {
    opts = o || {};
    btn = typeof opts.button === "string" ? document.querySelector(opts.button) : opts.button || null;
    if (btn) {
      btn.classList.add("sk-btn"); btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-expanded", "false");
      if (!btn.getAttribute("aria-label")) btn.setAttribute("aria-label", "Keys");
      btn.setAttribute("aria-keyshortcuts", "Shift+?");
      btn.hidden = !matchMedia("(hover:hover) and (pointer:fine)").matches;
      btn.addEventListener("click", function () { ov && !ov.hidden ? close() : open(); });
    }
    window.addEventListener("keydown", function (e) {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !typing(e.target) && on) { e.preventDefault(); ov && !ov.hidden ? close() : open(); }
    });
  }
  window.SurfaceKeys = { mount: mount, open: open, close: close, set: set, get enabled() { return on; } };
})();
