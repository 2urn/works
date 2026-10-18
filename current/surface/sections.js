/* Surface · Sections — a mini Codex for a player's index.
   The index of a player is a column of foldable sections (Guide, Sound, Bytebeat, Install, Display, Colophon…),
   the way a Codex document is a column of foldable chapters. This module gives any such column the Codex's
   reading tools, with no dependencies:

   - REORDER: each movable section has a grip at the right of its header. Drag it (finger, pen or mouse); while you
     drag, every section folds to its header so the whole list fits, and unfolds as it was when you let go. The grip
     is also a button: arrow keys move the section up or down, Home/End to the top or bottom.
   - FOLD ALL / OPEN ALL, one button.
   - FOCUS: one section open at a time. Opening one folds the others; the headers stay as a menu.
   - KEEP (the Codex's pin): the pin on a header keeps that section open when the rest fold, by fold all or by focus,
     so a few working sections can stay in view while everything else is put away.
   - LESS TEXT: hides the explanations (intros, notes, descriptions, lesson text) and keeps the headings and every
     control, so someone who knows the text sees only the tools.
   - Everything is remembered on the device: the order, which sections are folded or kept, focus and less text.
     "Reset" returns the order the tool shipped with.

   Markup it expects (the Codex list's own): sections with a header button and a body —
     <section class="cx-grp" id="sound"><button class="cx-grpbtn" aria-expanded="true">…</button><div class="cx-gbody">…</div></section>
   A section with class "cx-shut" is folded. The tool keeps its own fold handler on the header; this module listens
   after it, so the two never disagree.

   Mount:
     SurfaceSections.mount({
       root: '#idx',                    // the column that holds the sections
       key: 'current',                  // where its state is kept (localStorage 'surface.sections.<key>')
       section: '.cx-grp',              // what a section is (direct children of root only)
       fixed: '.colo',                  // sections that fold with the rest but keep their place
       prose: '.cx-lead,...',           // what LESS TEXT hides (see PROSE below for the default)
       label: 'Index',                  // the toolbar's accessible name
       briefScope: '#panel',            // optional: where LESS TEXT applies, if wider than root
       links: [{label, aria, run}]      // optional: the tool's own jumps in the toolbar (Current: licenses)
     })
   API: SurfaceSections.open(id) opens one section (respecting focus) and returns it. */
(function () {
  'use strict';
  const PROSE = '.cx-lead,.cx-body>p:not(.cx-acts):not(:has(a,button,input)),.cx-body dd,.cx-body .lp,.note,.sfs-prose';   // a paragraph holding a link or a control is a tool, not prose (Contact)
  const CSS = `
.sfs-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:0 2px;margin:14px 0 2px;padding:0}
/* the Codex's page tools, as icons (from Pullula's page settings): the name shows in the hint as each is pointed at */
.sfs-bar button{width:36px;height:36px;padding:0;display:grid;place-items:center;border:0;background:none;color:var(--muted,#8a9396);cursor:pointer;-webkit-tap-highlight-color:transparent}
.sfs-bar button svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.sfs-bar .sfs-name{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sfs-hint{margin-right:auto;font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#8a9396);opacity:0;transition:opacity .15s;pointer-events:none;white-space:nowrap}
.sfs-hint.on{opacity:1}
.sfs-bar button:hover{color:var(--fg,#eef1f2)}
.sfs-bar button[aria-pressed="true"]{color:var(--accent,#55b8c9)}
.sfs-bar button[hidden]{display:none}
.sfs-bar button:focus-visible,.sfs-grip:focus-visible{outline:2px solid var(--accent,#55b8c9);outline-offset:2px}
@media (pointer:coarse){.sfs-bar button{width:44px;height:44px}}
.sfs-root>.sfs-sec{position:relative;border-top:2px solid var(--fg,#eef1f2)}
.sfs-root>.sfs-sec>.cx-grpbtn{padding-right:88px}
.sfs-keep{position:absolute;top:0;right:34px;width:44px;height:44px;display:grid;place-items:center;border:0;background:none;color:var(--muted,#8a9396);cursor:pointer;opacity:.55;font-size:16px;-webkit-tap-highlight-color:transparent}
.sfs-keep:hover{opacity:1;color:var(--fg,#eef1f2)}.sfs-keep[aria-pressed="true"]{opacity:1;color:var(--accent,#55b8c9)}
.sfs-keep:focus-visible{outline:2px solid var(--accent,#55b8c9);outline-offset:2px;opacity:1}
@media (hover:none){.sfs-keep{opacity:.8}}
/* the pin, after the Codex's: a solid dot and a short stem tapering to a point, one x-height tall; kept or not is the colour */
.sfs-pin{--pm:1ex;--ps:max(1.2px,calc(var(--pm) * .2));display:inline-block;position:relative;width:var(--pm);height:var(--pm);pointer-events:none}
.sfs-pin::before,.sfs-pin::after{content:"";position:absolute;background:currentColor}
.sfs-pin::before{left:calc(50% - var(--pm) * .26);top:0;width:calc(var(--pm) * .52);height:calc(var(--pm) * .52);border-radius:50%}
.sfs-pin::after{left:calc(50% - var(--ps) / 2);top:calc(var(--pm) * .44);width:var(--ps);height:calc(var(--pm) * .56);clip-path:polygon(0 0,100% 0,50% 100%)}
.sfs-grip{position:absolute;top:0;right:-6px;width:44px;height:44px;display:grid;place-items:center;border:0;background:none;color:var(--muted,#8a9396);cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
.sfs-grip:hover{color:var(--fg,#eef1f2)}
.sfs-grip svg{width:16px;height:16px;fill:currentColor}
.sfs-root.sfs-dragging{-webkit-user-select:none;user-select:none}
.sfs-root.sfs-dragging .sfs-grip{cursor:grabbing}
.sfs-root>.sfs-sec.sfs-fixed>.cx-grpbtn{padding-right:48px}.sfs-fixed>.sfs-keep{right:-6px}
.sfs-sec.sfs-lift{z-index:5;background:var(--panel,#0f1213);box-shadow:0 10px 30px rgba(0,0,0,.35);transition:box-shadow .15s}
.sfs-root.sfs-dragging>.sfs-sec:not(.sfs-lift){transition:transform .14s ease}
.sfs-brief ${PROSE.split(',').map(s => s.trim()).join(',.sfs-brief ')}{display:none!important}
.sfs-brief .cx-body dl{grid-template-columns:minmax(0,1fr)!important;gap:4px!important}
.sfs-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.sfs-root.sfs-dragging>.sfs-sec{transition:none!important}}`;
  const GRIP = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="5.5" cy="3.5" r="1.4"/><circle cx="10.5" cy="3.5" r="1.4"/><circle cx="5.5" cy="8" r="1.4"/><circle cx="10.5" cy="8" r="1.4"/><circle cx="5.5" cy="12.5" r="1.4"/><circle cx="10.5" cy="12.5" r="1.4"/></svg>';
  const ROOTS = [];

  function load(k) { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  const nameOf = s => ((s.querySelector(':scope>.cx-grpbtn span') || {}).textContent || s.id || 'section').trim();

  function mount(o) {
    o = Object.assign({ section: '.cx-grp', fixed: '', prose: PROSE, label: 'Index' }, o || {});
    const root = typeof o.root === 'string' ? document.querySelector(o.root) : o.root;
    if (!root) return null;
    if (!document.getElementById('sfs-css')) {
      const st = document.createElement('style'); st.id = 'sfs-css';
      st.textContent = o.prose === PROSE ? CSS : CSS.replace(PROSE.split(',').map(s => '.sfs-brief ' + s.trim()).join(','), o.prose.split(',').map(s => '.sfs-brief ' + s.trim()).join(','));
      document.head.appendChild(st);
    }
    const KEY = 'surface.sections.' + (o.key || 'default');
    const briefScope = o.briefScope ? (typeof o.briefScope === 'string' ? document.querySelector(o.briefScope) : o.briefScope) : null;   // less text can reach past the column (a colophon below it)
    const secs = () => [...root.children].filter(c => c.matches(o.section));
    const isFixed = s => !!(o.fixed && s.matches(o.fixed));
    const movable = () => secs().filter(s => !isFixed(s));
    const DEFAULT = movable().map(s => s.id);
    let st = load(KEY);
    root.classList.add('sfs-root');
    const live = document.createElement('div'); live.className = 'sfs-live'; live.setAttribute('aria-live', 'polite'); root.appendChild(live);
    const say = t => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };

    /* the order: saved ids first, then anything new in its shipped place */
    function applyOrder(ids) {
      const ms = movable(); if (!ms.length) return;
      const byId = Object.fromEntries(ms.map(s => [s.id, s]));
      const want = ids.filter(id => byId[id]).concat(DEFAULT.filter(id => byId[id] && ids.indexOf(id) < 0));
      const anchor = ms[0].previousSibling, parent = ms[0].parentNode;
      let ref = anchor ? anchor.nextSibling : parent.firstChild;
      for (const id of want) { const s = byId[id]; if (s !== ref) parent.insertBefore(s, ref); else ref = ref.nextSibling; ref = s.nextSibling; }
    }
    if (Array.isArray(st.order)) applyOrder(st.order);

    const setShut = (s, shut) => { s.classList.toggle('cx-shut', shut); const b = s.querySelector(':scope>.cx-grpbtn'); if (b) b.setAttribute('aria-expanded', String(!shut)); };
    const persist = () => { st.order = movable().map(s => s.id); st.shut = secs().filter(s => s.classList.contains('cx-shut')).map(s => s.id); save(KEY, st); sync(); };
    if (Array.isArray(st.shut)) for (const s of secs()) setShut(s, st.shut.indexOf(s.id) >= 0);

    /* the toolbar */
    const bar = document.createElement('div'); bar.className = 'sfs-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', o.label + ': sections');
    /* icons from the Codex's page settings (Pullula): fold (−), open (+), one at a time, explanations; reset is a turn-back arrow.
       Each button carries its name three ways: aria-label for screen readers, title for a desktop hover, and the hint at the
       left of the row while it is pointed at or focused (and briefly after a tap, for touch). */
    const ICO = { fold: '<path d="M5 12h14"/>', open: '<path d="M5 12h14M12 5v14"/>', one: '<path d="M5 5h14M5 19h14"/><rect x="5" y="9" width="14" height="6" rx="1"/>',
      why: '<path d="M5 7h14M5 12h14M5 17h9"/>', reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5v3.8h3.8"/>', link: '<path d="M14 5h5v5M19 5l-8 8"/><path d="M17 14v5H5V7h5"/>' };
    const hint = document.createElement('span'); hint.className = 'sfs-hint'; hint.setAttribute('aria-hidden', 'true'); bar.appendChild(hint);
    let ht = 0;
    const show = (b, ms) => { clearTimeout(ht); hint.textContent = b.dataset.name; hint.classList.add('on'); if (ms) ht = setTimeout(() => hint.classList.remove('on'), ms); };
    const hide = () => { clearTimeout(ht); hint.classList.remove('on'); };
    const mk = (txt, aria, fn, ico) => { const b = document.createElement('button'); b.type = 'button';
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICO[ico] || ICO.link) + '</svg><span class="sfs-name">' + txt + '</span>';
      b.dataset.name = txt; b.title = aria; b.setAttribute('aria-label', aria);
      b.onclick = e => { fn(e); if (e.pointerType === 'touch' || !e.detail) show(b, 1400); };
      b.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') show(b); });
      b.addEventListener('pointerleave', hide); b.addEventListener('focus', () => show(b)); b.addEventListener('blur', hide);
      bar.appendChild(b); return b; };
    const setIco = (b, ico, txt) => { b.querySelector('svg').innerHTML = ICO[ico]; b.dataset.name = txt; b.querySelector('.sfs-name').textContent = txt; };
    const kept = s => (st.keep || []).indexOf(s.id) >= 0;
    const bFold = mk('fold all', 'Fold every section that is not kept open', () => { const all = secs().filter(s => !kept(s)).every(s => s.classList.contains('cx-shut')); secs().forEach(s => { if (!kept(s)) setShut(s, !all); }); persist(); say(all ? 'All sections open' : 'Sections folded, kept ones stay open'); }, 'fold');
    const bFocus = mk('one at a time', 'One at a time: opening a section folds the others', () => {
      st.focus = !st.focus;
      if (st.focus) { const open = secs().filter(s => !s.classList.contains('cx-shut') && !kept(s)); open.slice(1).forEach(s => setShut(s, true)); }
      persist(); say(st.focus ? 'Focus on: one section at a time' : 'Focus off');
    }, 'one');
    const bBrief = mk('less text', 'Less text: hide the explanations, keep the tools', () => { st.brief = !st.brief; persist(); say(st.brief ? 'Showing the tools only' : 'Showing the explanations'); }, 'why');
    for (const l of (o.links || [])) mk(l.label, l.aria || l.label, l.run, l.icon || 'link');   // the tool's own jumps (e.g. licenses)
    const bReset = mk('reset order', 'Put the sections back in their first order', () => { applyOrder(DEFAULT); persist(); say('Order reset'); }, 'reset');
    const first = movable()[0] || secs()[0];
    root.insertBefore(bar, first);
    function sync() {
      const loose = secs().filter(s => !kept(s)), all = loose.length && loose.every(s => s.classList.contains('cx-shut'));
      setIco(bFold, all ? 'open' : 'fold', all ? 'open all' : 'fold all');
      const fl = all ? 'Open every section' : 'Fold every section that is not kept open'; bFold.setAttribute('aria-label', fl); bFold.title = fl;
      bFocus.setAttribute('aria-pressed', String(!!st.focus)); bBrief.setAttribute('aria-pressed', String(!!st.brief));
      (briefScope || root).classList.toggle('sfs-brief', !!st.brief);
      bReset.hidden = movable().map(s => s.id).join() === DEFAULT.join();
    }

    /* folding: the tool's own handler runs on the button first; this follows it */
    root.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('.cx-grpbtn'); if (!b) return;
      const s = b.parentNode; if (!s || s.parentNode !== root || !s.matches(o.section)) return;
      if (st.focus && !s.classList.contains('cx-shut')) secs().forEach(x => { if (x !== s && !kept(x)) setShut(x, true); });
      persist();
    });

    /* grips */
    for (const s of movable()) {
      s.classList.add('sfs-sec');
      const g = document.createElement('button'); g.type = 'button'; g.className = 'sfs-grip'; g.innerHTML = GRIP;
      g.setAttribute('aria-label', 'Move ' + nameOf(s) + '. Drag, or use the arrow keys');
      s.appendChild(g);
      g.addEventListener('keydown', e => {
        const ms = movable(), i = ms.indexOf(s); let j = -1;
        if (e.key === 'ArrowUp') j = i - 1; else if (e.key === 'ArrowDown') j = i + 1; else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = ms.length - 1; else return;
        e.preventDefault(); if (j < 0 || j >= ms.length || j === i) return;
        const ref = j < i ? ms[j] : ms[j].nextSibling; s.parentNode.insertBefore(s, ref); g.focus(); persist();
        say(nameOf(s) + ', ' + (j + 1) + ' of ' + ms.length);
      });
      g.addEventListener('pointerdown', e => drag(e, s, g));
    }
    for (const s of secs()) if (isFixed(s)) s.classList.add('sfs-sec', 'sfs-fixed');
    /* keep pins, on every section */
    for (const s of secs()) {
      const k = document.createElement('button'); k.type = 'button'; k.className = 'sfs-keep'; k.innerHTML = '<span class="sfs-pin" aria-hidden="true"></span>';
      const syncK = () => { k.setAttribute('aria-pressed', String(kept(s))); k.setAttribute('aria-label', (kept(s) ? 'Kept open: ' : 'Keep open: ') + nameOf(s) + (kept(s) ? '. Tap to let it fold with the rest' : '. It stays open when the rest fold')); };
      k.onclick = () => { st.keep = (st.keep || []).filter(id => id !== s.id); if (k.getAttribute('aria-pressed') !== 'true') { st.keep.push(s.id); setShut(s, false); } syncK(); persist(); say(nameOf(s) + (kept(s) ? ' kept open' : ' folds with the rest')); };
      syncK(); s.insertBefore(k, s.querySelector(':scope>.sfs-grip') || null);
    }

    /* drag: fold everything to its header, let the section follow the pointer, swap as it passes a neighbour's middle */
    function drag(e, s, g) {
      if (e.button > 0) return;
      e.preventDefault();
      try { g.setPointerCapture(e.pointerId); } catch (_) {}
      const was = secs().map(x => [x, x.classList.contains('cx-shut')]);
      const y0 = e.clientY, top0 = s.getBoundingClientRect().top;
      secs().forEach(x => setShut(x, true));
      // keep the grabbed header under the finger after the column shrinks
      const scroller = (() => { let p = root; while (p && p !== document.body) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) return p; p = p.parentElement; } return document.scrollingElement; })();
      scroller.scrollTop += s.getBoundingClientRect().top - top0;
      const grab = y0 - s.getBoundingClientRect().top;
      let y = y0, dy = 0, raf = 0, moved = false;
      root.classList.add('sfs-dragging'); s.classList.add('sfs-lift');
      function place() {
        const nat = s.getBoundingClientRect().top - dy;
        dy = (y - grab) - nat; s.style.transform = 'translateY(' + dy + 'px)';
        const want = y - grab, h = s.offsetHeight;
        const ms = movable(), i = ms.indexOf(s), prev = ms[i - 1], next = ms[i + 1];
        if (prev) { const r = prev.getBoundingClientRect(); if (want < r.top + r.height / 2) { s.parentNode.insertBefore(s, prev); moved = true; } }
        if (next) { const r = next.getBoundingClientRect(); if (want + h > r.top + r.height / 2) { s.parentNode.insertBefore(next, s); moved = true; } }
        const nat2 = s.getBoundingClientRect().top - dy; dy = (y - grab) - nat2; s.style.transform = 'translateY(' + dy + 'px)';
      }
      function tick() {   // scroll the column when the finger nears its top or bottom
        raf = 0; const r = scroller === document.scrollingElement ? { top: 0, bottom: innerHeight } : scroller.getBoundingClientRect(), edge = 56;
        let v = 0; if (y < r.top + edge) v = -Math.ceil((r.top + edge - y) / 6); else if (y > r.bottom - edge) v = Math.ceil((y - (r.bottom - edge)) / 6);
        if (v) { scroller.scrollTop += v; place(); raf = requestAnimationFrame(tick); }
      }
      const mv = ev => { y = ev.clientY; place(); if (!raf) raf = requestAnimationFrame(tick); };
      const up = () => {
        g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
        if (raf) cancelAnimationFrame(raf);
        s.style.transform = ''; s.classList.remove('sfs-lift'); root.classList.remove('sfs-dragging');
        was.forEach(([x, shut]) => setShut(x, shut));
        persist();
        const ms = movable(); if (moved) say(nameOf(s) + ' moved to ' + (ms.indexOf(s) + 1) + ' of ' + ms.length);
        try { s.querySelector(':scope>.cx-grpbtn').scrollIntoView({ block: 'nearest' }); } catch (_) {}
      };
      g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    }

    const api = {
      root,
      open(id) { const s = document.getElementById(id); if (!s) return null; setShut(s, false); if (st.focus) secs().forEach(x => { if (x !== s && !kept(x)) setShut(x, true); }); persist(); return s; },
      state: () => JSON.parse(JSON.stringify(st))
    };
    ROOTS.push(api); sync();
    return api;
  }
  window.SurfaceSections = { mount, open: id => { for (const r of ROOTS) { const s = r.open(id); if (s) return s; } return null; } };
})();
