/* Surface · Keys — named actions, the keys that trigger them, one sheet that shows them all, and the settings that
   make a tool usable without a mouse or a steady hand (Dimitry, 18 Oct 2026).

   1. ACTIONS, NOT KEYS. A tool registers what it can do as named actions ({ id, d, keys, run }). A key is one way to
      trigger an action; MIDI notes and OSC addresses will be others, bound to the same ids (SurfaceKeys.run(id) is
      the entry point, SurfaceKeys.actions() the list). Studio-wide ids mean the same thing in every tool: 'hide',
      'fullscreen', 'sound', 'capture', 'random', 'prev', 'next', 'auto', 'preset1'…'preset9', 'save', 'saveas',
      'index', 'keys', 'close'. A combination is written 'mod+s' (Cmd on a Mac, Ctrl elsewhere) or 'shift+mod+s'; the
      browser's own (copy, paste, undo, new tab, reload…) can never be taken.
   2. REMAPPING. On the sheet, tap a key cap, then press the key you want. If another action had that key, the two
      swap. Actions with no default key can be given one. Remaps are kept per site (localStorage surface.keymap),
      so a studio-wide action keeps its key across tools. "Reset keys" puts every default back.
   3. THE SHEET: every action and its keys in large caps, from the bar's keys button or ?. Esc, ?, the X or a tap
      outside closes it; the focus stays inside while it is open and goes back where it was.
   4. THE SWITCH. Single-character shortcuts can be turned off (WCAG 2.2, 2.1.4): speech input arrives as keystrokes,
      and a spoken "c" should not take a photo. Off, single printable characters are stopped; space, the arrows, Esc
      and Cmd/Ctrl/Alt combinations keep working, and actions can still be run from the bar and, later, MIDI or OSC.
   5. HOLD TIME. How long a press must last to count as a hold (short / normal / long), for anyone whose press is
      slow, or whose dwell clicker or switch holds longer than a tap. SurfaceKeys.holdMs; 'surface:keys' fires on change.
   6. THE BAR AS ONE TOOLBAR (SurfaceKeys.toolbar(el)): one Tab stop; left and right, Home and End move along it;
      Enter or space taps; the context-menu key or Shift+F10 opens a button's hold menu (as a right-click does). That
      is the ARIA toolbar pattern, and it makes a switch-access or keyboard user's path through the bar short.

   Plain script, window.SurfaceKeys, no dependencies. Load it in <head>, so its listener runs first.
     SurfaceKeys.mount({ button: '#pKeys', title: 'Keys', groups: [{ name, actions: [{ id, d, keys: ['f'], run }] }] })
   An action with no run is shown but handled by the tool's own listener (Esc, space): if it is remapped, the new key
   is sent on as the old one. Colours come from the theme tokens (--ui-*), with the dark values as fallbacks. */
(function () {
  "use strict";
  var KEY = "surface.keys", MAP = "surface.keymap", HOLD = "surface.hold";
  var HOLDS = { "short": 320, "normal": 520, "long": 950 };
  function load(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var on = load(KEY, "on") !== "off";
  var hold = HOLDS[load(HOLD, "normal")] ? load(HOLD, "normal") : "normal";
  var map = {}; try { map = JSON.parse(load(MAP, "{}")) || {}; } catch (e) { map = {}; }
  var ACTS = [], BYID = {}, opts = { groups: [] }, ov = null, box = null, btn = null, lastFocus = null, listening = null, BARS = [];

  /* key names: what a person reads on a key cap */
  var NAMES = { " ": "space", "Escape": "esc", "ArrowLeft": "←", "ArrowRight": "→", "ArrowUp": "↑", "ArrowDown": "↓", "Enter": "return", "Backspace": "delete", "Delete": "del" };
  var RESERVED = { "esc": 1, "Tab": 1, "return": 1, "?": 1 };   // these keep their meaning, so the page can always be left
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  /* a combination is written mod+s (Cmd on a Mac, Ctrl elsewhere), shift+mod+s with Shift; shown as ⌘S or Ctrl+S */
  function nameOf(e) {
    var base = NAMES[e.key] || e.key;
    if (e.metaKey || e.ctrlKey) return (e.shiftKey ? "shift+" : "") + "mod+" + String(base).toLowerCase();
    return base;
  }
  function show(k) {
    if (!/mod\+/.test(k)) return k;
    var sh = /shift\+/.test(k), b = k.replace(/^(shift\+)?mod\+/, "").toUpperCase();
    return MAC ? (sh ? "\u21e7" : "") + "\u2318" + b : "Ctrl+" + (sh ? "Shift+" : "") + b;
  }
  /* the browser's and the system's own combinations stay theirs */
  var TAKEN = { "mod+c": 1, "mod+v": 1, "mod+x": 1, "mod+z": 1, "shift+mod+z": 1, "mod+a": 1, "mod+w": 1, "mod+q": 1, "mod+t": 1, "mod+n": 1, "mod+r": 1, "mod+l": 1, "mod+f": 1, "mod+p": 1, "mod+h": 1, "mod+m": 1, "mod+tab": 1 };
  function isChar(n) { return typeof n === "string" && n.length === 1; }
  function typing(t) { return t && t.closest && t.closest("input,select,textarea,[contenteditable=''],[contenteditable=true]"); }
  function keysOf(a) { return map[a.id] !== undefined ? (map[a.id] ? [map[a.id]] : []) : (a.keys || []); }
  function boundTo(n) { for (var i = 0; i < ACTS.length; i++) if (keysOf(ACTS[i]).indexOf(n) >= 0) return ACTS[i]; return null; }
  function fire() { document.dispatchEvent(new CustomEvent("surface:keys", { detail: { enabled: on, hold: hold, holdMs: HOLDS[hold] } })); }
  function announce(t) { var s = document.getElementById("toast"); if (s && s.getAttribute("aria-live")) { s.textContent = t; s.classList.add("show"); setTimeout(function () { s.classList.remove("show"); }, 1600); } }

  /* every key goes through here first */
  window.addEventListener("keydown", function (e) {
    if (e.__surface) return;
    if (btn && btn.hidden && !e.metaKey && !e.ctrlKey) btn.hidden = false;   // a keyboard has spoken: show the way to the sheet
    if (listening) { e.preventDefault(); e.stopImmediatePropagation(); assign(e); return; }
    var n = nameOf(e);
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {   // combinations: only those an action claims; the rest belong to the browser
      var c = boundTo(n); if (c && c.run && !typing(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) c.run(e); }
      return;
    }
    if (e.altKey || typing(e.target)) return;
    /* inside the toolbar, the arrows move along it */
    for (var b = 0; b < BARS.length; b++) if (BARS[b].contains(e.target) && barKey(BARS[b], e)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (!on && isChar(n) && n !== " ") { e.stopImmediatePropagation(); return; }
    var a = boundTo(n);
    if (a) {
      if (a.run) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat || a.repeat) a.run(e); return; }
      var def = (a.keys || [])[0];
      if (def && def !== n) { e.preventDefault(); e.stopImmediatePropagation(); resend(def, e); }   // remapped legacy action: send it on as its own key
      return;
    }
    /* a default key that was given away, and now belongs to nothing: it does nothing */
    for (var i = 0; i < ACTS.length; i++) if ((ACTS[i].keys || []).indexOf(n) >= 0 && map[ACTS[i].id] !== undefined) { e.stopImmediatePropagation(); return; }
  }, true);
  var BACK = { "space": [" ", "Space"], "esc": ["Escape", "Escape"], "←": ["ArrowLeft", "ArrowLeft"], "→": ["ArrowRight", "ArrowRight"] };
  function resend(def, src) {
    var k = BACK[def] || [def, ""], ev = new KeyboardEvent("keydown", { key: k[0], code: k[1], bubbles: true, cancelable: true, shiftKey: src.shiftKey, repeat: src.repeat });
    ev.__surface = true; (document.activeElement && document.activeElement !== document.body ? document.activeElement : document.body).dispatchEvent(ev);
  }

  /* toolbar */
  function items(bar) { return Array.prototype.filter.call(bar.querySelectorAll("button"), function (x) { return !x.hidden && !x.disabled && x.offsetParent !== null && !x.closest("[hidden]"); }); }
  function rove(bar, to) { items(bar).forEach(function (x) { x.tabIndex = x === to ? 0 : -1; }); if (to) to.focus(); }
  function barKey(bar, e) {
    var list = items(bar), i = list.indexOf(document.activeElement); if (i < 0) return false;
    if (e.key === "ArrowRight") { rove(bar, list[(i + 1) % list.length]); return true; }
    if (e.key === "ArrowLeft") { rove(bar, list[(i - 1 + list.length) % list.length]); return true; }
    if (e.key === "Home") { rove(bar, list[0]); return true; }
    if (e.key === "End") { rove(bar, list[list.length - 1]); return true; }
    if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
      var r = list[i].getBoundingClientRect();
      list[i].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      return true;
    }
    return false;
  }
  function toolbar(bar, label) {
    if (typeof bar === "string") bar = document.querySelector(bar); if (!bar) return;
    bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-orientation", "horizontal"); if (label) bar.setAttribute("aria-label", label);
    BARS.push(bar);
    var first = items(bar); first.forEach(function (x, i) { x.tabIndex = i ? -1 : 0; });
    /* short names (WCAG 2.5.3): a voice-control user says "tap Sound", so the name is what the button is; how it works
       moves to its description. A label like "Capture. Press and hold for mode" becomes the name "Capture" and the
       description "Press and hold for mode", and stays split when the tool changes the label later. */
    var desc = document.createElement("div"); desc.hidden = true; bar.appendChild(desc);
    Array.prototype.forEach.call(bar.querySelectorAll("button"), function (b, i) {
      var d = document.createElement("span"); d.id = "sk-d-" + (b.id || i); desc.appendChild(d);
      var split = function () {
        var l = (b.getAttribute("aria-label") || "").replace(/\s*\([^)]{1,8}\)/g, ""); var m = l.match(/^(.{2,40}?)[.:]\s+(.+)$/);
        if (!m) return; var head = m[1].trim(), tail = m[2].trim();
        d.textContent = tail; b.setAttribute("aria-describedby", d.id);
        if (head !== l) b.setAttribute("aria-label", head);
      };
      split(); new MutationObserver(split).observe(b, { attributes: true, attributeFilter: ["aria-label"] });
    });
    bar.addEventListener("focusin", function (e) { if (e.target.tagName === "BUTTON") items(bar).forEach(function (x) { x.tabIndex = x === e.target ? 0 : -1; }); });
  }

  /* remapping */
  function listen(a, cap) { listening = { a: a, cap: cap }; cap.classList.add("sk-wait"); cap.textContent = "press a key"; say("Press the key for " + a.d + ". Esc to cancel."); }
  function assign(e) {
    var L = listening; listening = null; if (!L) return;
    var n = nameOf(e);
    if (e.key === "Escape") { render(); say("Unchanged"); return; }
    if (e.key === "Shift" || e.key === "Meta" || e.key === "Control" || e.key === "Alt") { listening = L; return; }
    if (RESERVED[n] || e.key === "Tab" || TAKEN[n]) { render(); say(show(n) + " keeps its own job. Choose another key."); return; }
    var mine = keysOf(L.a), other = boundTo(n);
    if (other && other !== L.a) { map[other.id] = mine[0] || ""; }   // swap: the other action takes this one's old key
    map[L.a.id] = n;
    for (var i = 0; i < ACTS.length; i++) { var x = ACTS[i]; if (map[x.id] === (x.keys || [])[0] && (x.keys || []).length < 2) delete map[x.id]; }   // back to its default: forget it
    save(MAP, JSON.stringify(map)); render(); fire();
    say(L.a.d + ": " + show(n) + (other && other !== L.a ? ". " + other.d + " now " + (mine[0] || "has no key") : ""));
  }
  function resetKeys() { map = {}; save(MAP, "{}"); render(); fire(); say("Every key is back to its default"); }

  /* the sheet */
  var CSS = "\
.sk-btn[hidden]{display:none!important}\
.sk-ov{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top,0px)) 16px max(16px,env(safe-area-inset-bottom,0px));background:rgb(var(--ui-g,14 14 16) / .78);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:var(--ui-ink,#eef1f2);opacity:0;transition:opacity .2s ease}\
.sk-ov.on{opacity:1}.sk-ov[hidden]{display:none}\
.sk-box{width:min(960px,100%);max-height:100%;overflow:auto;padding:22px 24px 18px;border:1px solid var(--ui-line,#23292b);background:var(--ui-solid,#0f1213);border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.45);box-sizing:border-box}\
.sk-hd{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 4px}\
.sk-hd h2{margin:0;font:600 13px/1 var(--mono,ui-monospace,monospace);letter-spacing:.16em;text-transform:uppercase}\
.sk-sub{margin:0 0 6px;font:400 12.5px/1.5 var(--sans,system-ui);color:var(--ui-dim,#8a9396)}\
.sk-x{width:44px;height:44px;border:0;border-radius:50%;background:none;color:inherit;cursor:pointer;font:400 24px/1 var(--sans,system-ui)}\
.sk-x:hover{background:rgb(var(--ui-hi,255 255 255) / .08)}\
.sk-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:4px 34px}\
.sk-g h3{margin:14px 0 6px;font:500 11px/1.2 var(--mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--ui-dim,#8a9396)}\
.sk-row{display:flex;align-items:center;gap:14px;min-height:48px;border-top:1px solid var(--ui-line,#23292b)}\
.sk-caps{flex:none;display:flex;gap:6px;min-width:104px}.sk-caps.sk-wrap{flex:1 1 100%;flex-wrap:wrap;padding:6px 0}.sk-row:has(.sk-wrap){flex-wrap:wrap}\
.sk-cap{display:inline-grid;place-items:center;min-width:44px;height:44px;padding:0 10px;border:1.5px solid rgb(var(--ui-hi,255 255 255) / .55);border-bottom-width:3px;border-radius:7px;background:none;font:600 17px/1 var(--mono,ui-monospace,monospace);color:var(--ui-ink,#eef1f2);box-sizing:border-box;cursor:pointer}\
.sk-cap:hover{border-color:var(--sk-acc,#55b8c9)}\
.sk-cap.sk-none{font-size:12px;font-weight:500;color:var(--ui-dim,#8a9396);border-style:dashed}\
.sk-cap.sk-wait{border-color:var(--sk-acc,#55b8c9);color:var(--sk-acc,#55b8c9);font-size:12px;animation:sk-pulse 1s ease-in-out infinite alternate}\
.sk-cap.sk-fixed{cursor:default;border-color:rgb(var(--ui-hi,255 255 255) / .3)}\
.sk-cap.sk-moved{border-color:var(--sk-acc,#55b8c9)}\
@keyframes sk-pulse{to{opacity:.55}}\
.sk-row>span{font:400 15px/1.35 var(--sans,system-ui)}\
.sk-ft{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px;margin-top:16px;padding-top:12px;border-top:1px solid var(--ui-line,#23292b);font:400 12px/1.5 var(--sans,system-ui);color:var(--ui-dim,#8a9396)}\
.sk-sw,.sk-txt{display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0 4px;border:0;background:none;color:var(--ui-ink,#eef1f2);cursor:pointer;font:500 13px/1 var(--sans,system-ui)}\
.sk-txt{text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgb(var(--ui-hi,255 255 255) / .35)}\
.sk-sw i{position:relative;width:40px;height:24px;border-radius:12px;background:rgb(var(--ui-hi,255 255 255) / .2);transition:background .15s}\
.sk-sw i::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .15s}\
.sk-sw[aria-checked=true] i{background:var(--sk-acc,#55b8c9)}.sk-sw[aria-checked=true] i::after{transform:translateX(16px)}\
.sk-seg{display:inline-flex;align-items:center;gap:2px}.sk-seg b{font:500 13px/1 var(--sans,system-ui);color:var(--ui-ink,#eef1f2);margin-right:8px}\
.sk-seg button{min-height:44px;padding:0 10px;border:0;background:none;color:var(--ui-dim,#8a9396);cursor:pointer;font:500 13px/1 var(--sans,system-ui)}\
.sk-seg button[aria-checked=true]{color:var(--ui-ink,#eef1f2);text-decoration:underline;text-decoration-color:var(--sk-acc,#55b8c9);text-decoration-thickness:2px;text-underline-offset:5px}\
.sk-note{flex-basis:100%}\
.sk-sw:focus-visible,.sk-x:focus-visible,.sk-cap:focus-visible,.sk-seg button:focus-visible,.sk-txt:focus-visible{outline:2px solid var(--sk-acc,#55b8c9);outline-offset:2px}\
.sk-off .sk-cap.sk-ch{opacity:.35}\
.sk-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}\
@media (prefers-reduced-motion:reduce){.sk-ov,.sk-sw i,.sk-sw i::after{transition:none}.sk-cap.sk-wait{animation:none}}";

  var live = null;
  function say(t) { if (!live) return; live.textContent = ""; setTimeout(function () { live.textContent = t; }, 30); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function build() {
    if (!document.getElementById("sk-css")) { var st = el("style"); st.id = "sk-css"; st.textContent = CSS; document.head.appendChild(st); }
    ov = el("div", "sk-ov"); ov.hidden = true; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "sk-title");
    box = el("div", "sk-box"); ov.appendChild(box);
    live = el("div", "sk-live"); live.setAttribute("aria-live", "polite"); ov.appendChild(live);
    ov.addEventListener("pointerdown", function (e) { if (e.target === ov) close(); });
    ov.addEventListener("keydown", function (e) {
      if (listening) return;
      if (e.key === "Escape" || e.key === "?") { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === "Tab") {
        var f = box.querySelectorAll("button:not([disabled])"); if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
      e.stopPropagation();
    });
    document.body.appendChild(ov);
  }
  function render() {
    if (!box) return; var keep = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.sk : null;
    box.textContent = "";
    var hd = el("div", "sk-hd"), h = el("h2", null, opts.title || "Keys"); h.id = "sk-title";
    var x = el("button", "sk-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Close the keys"); x.onclick = close; x.dataset.sk = "x";
    hd.append(h, x); box.appendChild(hd);
    box.appendChild(el("p", "sk-sub", "Tap a key to change it, then press the key you want. If another action had it, the two swap."));
    var cols = el("div", "sk-cols");
    (opts.groups || []).forEach(function (g) {
      var sec = el("section", "sk-g"); sec.appendChild(el("h3", null, g.name));
      if (g.compact) {   // a run of actions read as one row (presets 1 to 9): one cap each, every one its own key
        var row = el("div", "sk-row"), caps = el("span", "sk-caps sk-wrap");
        (g.actions || []).forEach(function (a) { var k = keysOf(a)[0] || "";
          var c = el("button", "sk-cap" + (isChar(k) ? " sk-ch" : "") + (!k ? " sk-none" : "") + (map[a.id] !== undefined ? " sk-moved" : ""), k || "add");
          c.type = "button"; c.dataset.sk = a.id + ":0"; c.setAttribute("aria-label", (k || "No key") + " \u2014 " + a.d + ". Change the key");
          c.onclick = function () { listen(a, c); }; caps.appendChild(c); });
        row.append(caps); if (g.d) row.appendChild(el("span", null, g.d)); sec.appendChild(row); cols.appendChild(sec); return;
      }
      (g.actions || []).forEach(function (a) {
        var row = el("div", "sk-row"), caps = el("span", "sk-caps"), ks = keysOf(a);
        if (!ks.length) ks = [""];
        ks.forEach(function (k, i) {
          var c = el("button", "sk-cap" + (isChar(k) ? " sk-ch" : "") + (a.fixed ? " sk-fixed" : "") + (!k ? " sk-none" : "") + (map[a.id] !== undefined ? " sk-moved" : ""), k ? show(k) : "add");
          c.type = "button"; c.dataset.sk = a.id + ":" + i;
          c.setAttribute("aria-label", (k ? show(k) : "No key") + " — " + a.d + (a.fixed ? "" : ". Change the key"));
          if (a.fixed) c.disabled = true; else c.onclick = function () { listen(a, c); };
          caps.appendChild(c);
        });
        row.append(caps, el("span", null, a.d)); sec.appendChild(row);
      });
      cols.appendChild(sec);
    });
    box.appendChild(cols);
    var ft = el("div", "sk-ft");
    var sw = el("button", "sk-sw"); sw.type = "button"; sw.setAttribute("role", "switch"); sw.dataset.sk = "sw";
    sw.append(el("i"), el("span", null, "Single-key shortcuts")); sw.setAttribute("aria-checked", String(on)); box.classList.toggle("sk-off", !on);
    sw.onclick = function () { setEnabled(!on); render(); };
    var seg = el("span", "sk-seg"); seg.setAttribute("role", "radiogroup"); seg.setAttribute("aria-label", "Hold to open a menu");
    seg.appendChild(el("b", null, "Hold"));
    ["short", "normal", "long"].forEach(function (v) {
      var b = el("button", null, v); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(v === hold)); b.dataset.sk = "h:" + v;
      b.title = v === "short" ? "A third of a second" : v === "normal" ? "Half a second" : "Nearly a second: for a slow press, a dwell clicker or a switch";
      b.onclick = function () { setHold(v); render(); }; seg.appendChild(b);
    });
    var rs = el("button", "sk-txt", "Reset keys"); rs.type = "button"; rs.dataset.sk = "reset"; rs.onclick = resetKeys; if (!Object.keys(map).length) rs.disabled = true;
    ft.append(sw, seg, rs, el("span", "sk-note", opts.note || "Turn single-key shortcuts off if you control the page by voice, so a spoken word does not trigger a key. Space, the arrows and Esc keep working. On the bar, left and right move between buttons, and the menu key or Shift+F10 opens what a long press opens."));
    box.appendChild(ft);
    if (keep) { var k = box.querySelector('[data-sk="' + keep + '"]'); if (k) k.focus({ preventScroll: true }); }
  }
  function setEnabled(v) { on = !!v; save(KEY, on ? "on" : "off"); fire(); announce(on ? "single-key shortcuts on" : "single-key shortcuts off"); }
  function setHold(v) { if (!HOLDS[v]) return; hold = v; save(HOLD, v); fire(); }
  function open() {
    if (!ov) build(); render(); lastFocus = document.activeElement;
    ov.hidden = false; requestAnimationFrame(function () { ov.classList.add("on"); });
    if (btn) btn.setAttribute("aria-expanded", "true");
    var c = box.querySelector(".sk-x"); if (c) c.focus({ preventScroll: true });
  }
  function close() {
    if (!ov || ov.hidden) return; listening = null; ov.classList.remove("on"); ov.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
    try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  function mount(o) {
    opts = o || {}; ACTS = []; BYID = {};
    (opts.groups || []).forEach(function (g) { (g.actions || []).forEach(function (a) { ACTS.push(a); BYID[a.id] = a; }); });   // groups: { name, actions, compact, d }
    btn = typeof opts.button === "string" ? document.querySelector(opts.button) : opts.button || null;
    if (btn) {
      btn.classList.add("sk-btn"); btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-keyshortcuts", "Shift+?");
      btn.hidden = !matchMedia("(hover:hover) and (pointer:fine)").matches;
      btn.addEventListener("click", function () { ov && !ov.hidden ? close() : open(); });
    }
    window.addEventListener("keydown", function (e) {
      if (e.key === "?" && on && !e.metaKey && !e.ctrlKey && !typing(e.target)) { e.preventDefault(); ov && !ov.hidden ? close() : open(); }
    });
    fire();
  }
  window.SurfaceKeys = {
    mount: mount, open: open, close: close, toolbar: toolbar, set: setEnabled, setHold: setHold, reset: resetKeys,
    run: function (id, e) { var a = BYID[id]; if (a && a.run) { a.run(e || {}); return true; } return false; },   // MIDI and OSC call this
    actions: function () { return ACTS.map(function (a) { return { id: a.id, d: a.d, keys: keysOf(a) }; }); },
    keyFor: function (id) { var a = BYID[id]; return a ? keysOf(a).map(show) : []; },   // as a cap shows it: ⌘S on a Mac, Ctrl+S elsewhere
    keyName: show,
    get enabled() { return on; }, get holdMs() { return HOLDS[hold]; }, get hold() { return hold; }
  };
})();
