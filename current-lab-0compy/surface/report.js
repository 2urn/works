/* Surface · Report — "report a bug" for every tool (Dimitry, 20 Oct 2026: "should we have a bug icon to trigger bug
   reports?"; on a computer it sits lower left; the top bar stays the brand's).

   One short question ("what happened?"), an email only if the person wants a reply, and what the tool knows about the
   moment attached by itself: the self-test report (version, browser, checks, recent errors and warnings, the log) and
   whatever the tool adds with state() (the look, the sound, the touch presets…). "What's sent" shows all of it before
   sending. Nothing about the person unless they type it. It goes to a Supabase table the browser can add to and never
   read (bug_reports), so nobody has to copy or email anything.

     var R = SurfaceReport.mount({
       tool: 'current', name: 'Current', version: () => APP_VERSION,   // a string, or a function read at send time
       endpoint: 'https://<project>.supabase.co/rest/v1/bug_reports', key: '<publishable key>',
       state: () => ({ look: …, sound: … }),   // optional: a small object about the moment
       email: 'hi@chamy.xyz',                   // optional: a contact line under the form ("Rather write?")
       icon: true                               // optional: SurfaceReport.ICON is the bug, for the tool's own buttons
     });
     R.open('button')      // open the sheet; how: 'button' | 'offer' | 'selftest' | 'key'; R.open(how, {feedback:true}) opens it ticked
     R.offer('the sound had to be restarted')   // a quiet line with "report it", for when the tool caught something
     R.corner(button)      // phones: puts the tool's bug button exactly where the sheet's close appears (returns its frame);
                           //   tablets: the sheet and the frame both open in the top right corner
   Plain script, window.SurfaceReport, no dependencies; reads SurfaceSelfTest when it is there. */
(function () {
  "use strict";
  if (window.SurfaceReport) return;
  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 7.5a3 3 0 0 1 6 0"/><rect x="7" y="7.5" width="10" height="12" rx="5"/><path d="M12 11v8.5"/><path d="M7 12H3.5M20.5 12H17M7.3 16.5l-3 2M16.7 16.5l3 2M7.6 9 4.5 6.5M16.4 9l3.1-2.5"/></svg>';
  var CSS =
    ".srp-veil{position:fixed;inset:0;z-index:80;background:rgba(5,7,9,.62);opacity:0;transition:opacity .35s ease}.srp-veil.on{opacity:1}" +
    ".srp{position:fixed;z-index:81;left:50%;top:calc(env(safe-area-inset-top,0px) + 12px);translate:-50% 0;width:min(380px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow-y:auto;scrollbar-gutter:stable;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:16px;background:rgba(10,13,16,.94);color:#fff;border:1px solid rgba(255,255,255,.14);box-shadow:0 20px 60px rgba(0,0,0,.5);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);opacity:0;transition:opacity .35s ease,translate .5s cubic-bezier(.16,1,.3,1)}" +
    "@media (min-width:900px) and (hover:hover){.srp{top:50%;translate:-50% -46%}.srp.on{translate:-50% -50%}}" +
    ".srp.on{opacity:1}.srp[hidden],.srp-veil[hidden]{display:none}" +
    ".srp-hd{display:flex;align-items:center;justify-content:space-between;gap:8px}" +
    ".srp-h{display:flex;align-items:center;gap:10px;margin:0;font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.18em;text-transform:uppercase}" +
    ".srp-h svg,.srp-x svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
    ".srp-x{width:32px;height:32px;margin:-6px -6px -6px 0;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;cursor:pointer}" +
    ".srp p{margin:0;font:400 12px/1.45 var(--sans,system-ui);color:rgba(255,255,255,.78)}" +
    ".srp textarea,.srp input{width:100%;box-sizing:border-box;border-radius:9px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:#fff;font:16px/1.35 var(--sans,system-ui);padding:8px 10px}" +
    ".srp textarea{min-height:92px;resize:vertical}.srp input{height:36px}.srp ::placeholder{color:rgba(255,255,255,.45)}" +
    ".srp details{font:400 11px/1.4 var(--sans,system-ui);color:rgba(255,255,255,.7)}.srp summary{cursor:pointer;font:600 10px/1 var(--mono,monospace);letter-spacing:.14em;text-transform:uppercase;padding:4px 0}" +
    ".srp pre{margin:6px 0 0;max-height:160px;overflow:auto;scrollbar-gutter:stable;white-space:pre-wrap;word-break:break-word;font:10px/1.4 var(--mono,monospace);color:rgba(255,255,255,.6);background:rgba(255,255,255,.04);border-radius:8px;padding:8px}" +
    ".srp-go{height:34px;border:0;border-radius:17px;background:#fff;color:#0b0f10;font:600 10px/1 var(--mono,monospace);letter-spacing:.18em;text-transform:uppercase;cursor:pointer}.srp-go:disabled{opacity:.5;cursor:default}" +
    ".srp-alt a{color:inherit;text-decoration:underline;text-underline-offset:3px}.srp-alt{font-size:11px!important;color:rgba(255,255,255,.6)!important}" +
    ".srp-fb{display:flex;align-items:center;gap:9px;margin:-2px 0 0;font:400 12px/1.3 var(--sans,system-ui);color:rgba(255,255,255,.82);cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    ".srp .srp-fb input{-webkit-appearance:none;appearance:none;width:20px;height:20px;margin:0;padding:0;flex:none;border-radius:6px;border:1.5px solid rgba(255,255,255,.45);background:transparent no-repeat center / 14px 14px;cursor:pointer;transition:background-color .15s,border-color .15s}" +
    ".srp .srp-fb input:checked{background-color:#fff;border-color:#fff;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230b0f10' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E\")}" +
    ".srp .srp-fb input:focus-visible{outline:2px solid #fff;outline-offset:2px}" +
    ".srp-fb small{color:rgba(255,255,255,.5);font-size:11px}" +
    ".srp-msg{min-height:1em;color:var(--acc-tx,var(--acc,#55b8c9))!important}.srp-msg.bad{color:#ff8a80!important}" +
    ".srp :focus-visible{outline:2px solid #fff;outline-offset:2px}" +
    /* THE CORNER (Dimitry, 22 Oct: "make it a part of the sheet itself for iPhone so it can't misalign"): an empty copy
       of the sheet's own frame and header, made with the same classes, so the button sits exactly where the sheet's
       close appears, at every width and after any change to the sheet. Phones only; a computer has its own button. */
    ".srp.srp-frame{z-index:24;background:none;border-color:transparent;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none;opacity:1;overflow:visible;max-height:none;pointer-events:none;transition:opacity .4s ease,visibility 0s}" +
    ".srp-frame .srp-h{visibility:hidden}.srp-frame .srp-x{pointer-events:auto;background:rgba(0,0,0,.28);color:rgba(255,255,255,.6)}.srp-frame .srp-x svg{fill:none;stroke:currentColor;stroke-width:1.7}" +
    "@media (min-width:900px) and (hover:hover){.srp.srp-frame{display:none}}" +
    /* a tablet (Dimitry, 22 Oct, iPad: the bug sat mid-screen, where the centred sheet's close is; "it could just move the
       panel to the top right"): on a screen at least 600 px each way without a mouse, the sheet and its frame open in the
       top right corner, so the bug is in the corner and is still the sheet's close */
    "@media (min-width:600px) and (min-height:600px) and (not ((min-width:900px) and (hover:hover))){.srp{left:auto;right:max(12px,env(safe-area-inset-right,0px));translate:0 -8px}.srp.on,.srp.srp-frame{translate:none}}" +
    ".srp-offer{position:fixed;z-index:79;left:50%;bottom:calc(96px + env(safe-area-inset-bottom,0px));translate:-50% 8px;display:flex;align-items:center;gap:12px;padding:8px 8px 8px 14px;border-radius:999px;background:rgba(10,13,16,.92);color:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.14);font:400 12px/1.3 var(--sans,system-ui);opacity:0;transition:opacity .3s,translate .4s cubic-bezier(.16,1,.3,1);max-width:calc(100vw - 24px)}" +
    ".srp-offer.on{opacity:1;translate:-50% 0}.srp-offer button{border:0;border-radius:999px;padding:7px 12px;background:#fff;color:#0b0f10;font:600 10px/1 var(--mono,monospace);letter-spacing:.14em;text-transform:uppercase;cursor:pointer;white-space:nowrap}" +
    ".srp-offer .srp-ox{background:none;color:rgba(255,255,255,.6);padding:7px 6px}" +
    "@media (prefers-reduced-motion:reduce){.srp,.srp-veil,.srp-offer{transition:opacity .2s}}";
  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function device() {
    var n = navigator, s = screen || {};
    return (n.userAgent || "").slice(0, 220) + " · " + (s.width || "?") + "x" + (s.height || "?") + "@" + (window.devicePixelRatio || 1) + " · " + innerWidth + "x" + innerHeight +
      (matchMedia("(display-mode: standalone)").matches || n.standalone ? " · app" : " · tab");
  }
  function mount(O) {
    O = O || {};
    var ver = function () { try { return String((typeof O.version === 'function' ? O.version() : O.version) || ''); } catch (e) { return ''; } };
    if (!document.getElementById("srp-css")) { var st = el("style"); st.id = "srp-css"; st.textContent = CSS; document.head.appendChild(st); }
    var veil = el("div", "srp-veil"), box = el("div", "srp"), how = "button", sent = false, last = null;
    veil.hidden = box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "srpH");
    box.innerHTML = '<div class="srp-hd"><p class="srp-h" id="srpH">' + ICON + '<span class="srp-t">Report a bug</span></p><button type="button" class="srp-x" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
      '<p><span class="srp-lead">Something not right? Say what you did and what happened.</span> ' + (O.name || "The tool") + ' adds what it knows about this moment (version, browser, what was playing, recent errors); nothing about you unless you type it.</p>' +
      '<label class="srp-sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)" for="srpN">What happened?</label><textarea id="srpN" maxlength="2000" placeholder="what happened?"></textarea>' +
      '<label class="srp-fb"><input type="checkbox" class="srp-fbx"><span>Feedback only <small>an idea or a wish, nothing broken</small></span></label>' +
      '<label style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)" for="srpE">Email (optional)</label><input id="srpE" type="email" maxlength="254" autocomplete="email" inputmode="email" placeholder="email, if you’d like a reply (optional)">' +
      '<details><summary>what’s sent</summary><pre></pre></details>' +
      (O.email ? '<p class="srp-alt">Rather write? <a href="mailto:' + O.email + '?subject=' + encodeURIComponent((O.name || "Tool") + " bug") + '">' + O.email + '</a></p>' : '') +
      '<button type="button" class="srp-go">send</button><p class="srp-msg" role="status" aria-live="polite"></p>';
    document.body.append(veil, box);
    var ta = box.querySelector("textarea"), em = box.querySelector("input[type=email]"), pre = box.querySelector("pre"), go = box.querySelector(".srp-go"), msg = box.querySelector(".srp-msg");
    /* FEEDBACK ONLY (Dimitry, 22 Oct): ideas and wishes go in the same box, marked kind 'feedback', so they are read as
       requests and never sent to be reproduced and fixed as bugs */
    var fbx = box.querySelector(".srp-fbx"), ttl = box.querySelector(".srp-t"), lead = box.querySelector(".srp-lead");
    function mode() { var f = fbx.checked; ttl.textContent = f ? "Send feedback" : "Report a bug"; ta.placeholder = f ? "your idea, or what you wish it did" : "what happened?";
      lead.textContent = f ? "An idea, a wish, something that could work better? Say it here." : "Something not right? Say what you did and what happened."; }
    fbx.onchange = mode;
    var say = function (t, bad) { msg.textContent = t; msg.classList.toggle("bad", !!bad); };
    function gather() {
      var T = window.SurfaceSelfTest, text = "";
      try { if (T) { T.run(); text = T.report(); } } catch (e) { text = "self-test unavailable: " + (e && e.message); }
      var s = null; try { s = O.state ? O.state() : null; } catch (e) { s = { error: String(e && e.message || e) }; }
      var log = { selftest: String(text || "").slice(0, 30000), state: s, at: new Date().toISOString() };
      return log;
    }
    function close() { box.classList.remove("on"); veil.classList.remove("on"); setTimeout(function () { box.hidden = veil.hidden = true; }, 360); if (last && last.focus) try { last.focus(); } catch (e) {} }
    function open(h, o2) {
      fbx.checked = !!(o2 && o2.feedback); mode();
      how = h || "button"; sent = false; last = document.activeElement; go.disabled = false; go.textContent = "send"; say("");
      var g = gather(); pre.textContent = "version " + (ver() || "?") + "\n" + device() + "\n\n" + (g.state ? JSON.stringify(g.state, null, 1) + "\n\n" : "") + g.selftest;
      box.hidden = veil.hidden = false; requestAnimationFrame(function () { box.classList.add("on"); veil.classList.add("on"); });
      setTimeout(function () { try { ta.focus({ preventScroll: true }); } catch (e) {} }, 60);
      if (window.cxCount) try { cxCount("report: open (" + how + ")", 1); } catch (e) {}
    }
    box.querySelector(".srp-x").onclick = close; veil.onclick = close;
    box.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); close(); } });
    go.onclick = function () {
      if (sent) { close(); return; }
      var note = ta.value.replace(/\s+$/, "").trim(), mail = em.value.trim();
      if (!note) { say(fbx.checked ? "Say a few words first." : "Say a few words about what happened.", 1); ta.focus(); return; }
      if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { say("That email doesn’t look complete (or leave it empty).", 1); em.focus(); return; }
      if (!O.endpoint || !O.key) { say("Reports aren’t set up here yet.", 1); return; }
      go.disabled = true; say("sending…");
      var body = { tool: O.tool || "tool", version: ver().slice(0, 24) || null, note: note.slice(0, 2000), log: gather(), device: device().slice(0, 300), page: location.pathname.slice(0, 300), email: mail || null, how: how, kind: fbx.checked ? "feedback" : "bug" };
      fetch(O.endpoint, { method: "POST", headers: { apikey: O.key, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(body) })
        .then(function (r) {
          if (!r.ok) throw r.status;
          sent = true; ta.value = ""; say(body.kind === "feedback" ? "Thank you. Your idea is in." : "Thank you. It’s on the list to be fixed, with everything needed to find it."); go.disabled = false; go.textContent = "close";
          if (window.cxCount) try { cxCount("report: sent", 1); } catch (e) {}
          setTimeout(function () { if (sent && !box.hidden) close(); }, 3500);
        })
        .catch(function (s) { go.disabled = false; say("That didn’t go through" + (typeof s === "number" ? " (" + s + ")" : "") + ". Try again in a moment.", 1); });
    };
    var ofr = null, ofT = 0;
    function offer(t) {
      if (!ofr) { ofr = el("div", "srp-offer"); ofr.setAttribute("role", "status"); ofr.innerHTML = '<span></span><button type="button" class="srp-oy">report it</button><button type="button" class="srp-ox" aria-label="Dismiss">✕</button>'; document.body.appendChild(ofr);
        ofr.querySelector(".srp-oy").onclick = function () { hideOffer(); open("offer"); }; ofr.querySelector(".srp-ox").onclick = hideOffer; }
      ofr.querySelector("span").textContent = t || "Something went wrong."; ofr.hidden = false;
      requestAnimationFrame(function () { ofr.classList.add("on"); }); clearTimeout(ofT); ofT = setTimeout(hideOffer, 9000);
    }
    function hideOffer() { if (!ofr) return; ofr.classList.remove("on"); clearTimeout(ofT); setTimeout(function () { if (ofr && !ofr.classList.contains("on")) ofr.hidden = true; }, 320); }
    function corner(btn) {
      var f = el("div", "srp srp-frame"); f.setAttribute("role", "presentation");
      var hd = el("div", "srp-hd", '<p class="srp-h" aria-hidden="true">' + ICON + "<span>Report a bug</span></p>");
      btn.classList.add("srp-x"); if (!btn.innerHTML.trim()) btn.innerHTML = ICON; hd.appendChild(btn); f.appendChild(hd); document.body.appendChild(f);
      return f;
    }
    return { open: open, close: close, offer: offer, gather: gather, corner: corner };
  }
  window.SurfaceReport = { mount: mount, ICON: ICON };
})();
