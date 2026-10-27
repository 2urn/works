/* Surface · Ring — a ring of round choices around a point (a pie menu), opened where the finger is.
   (Dimitry, 24 Oct 2026, 19:31: "the pie menu … is the model for something that's missing and will be needed in this app
   anyway … a ring of dots … invoked on the stage … why don't we start with a touchable pie menu"; opened by a double-tap.)

   The ring is the studio's answer to choices made on the stage itself, without reaching for the bar: what a finger does
   (Current's Touch ring, first), and later the random ring and the colour-and-sound chips. One rule for all of them:

   - It opens centred on the point, pulled in from the edges so every dot is on screen, its centre the ring's name.
   - Each dot is a round button (at least 44 px, a finger's size) with an icon; the lit one is the current choice.
   - A tap on a dot chooses and closes (unless the item says stay); a tap anywhere else, Esc, or a second open closes.
   - The arrow keys walk round the ring, Enter chooses; focus comes back to where it was. role=menu, items menuitemradio
     or menuitemcheckbox, so a screen reader hears what each is and whether it is on.
   - Everything on a ring is also somewhere else in the tool (a ring is a short way, never the only way).

   MOTION (Dimitry, 24 Oct 20:14: "pop out like a flower … start small from where you touched … two or three steps, pop
   pop pop … as the labels and icons become visible"; and on a choice "it should grow bigger … the other buttons disappear
   first and that button disappears last, it slides back into the center, and then the label"): the dots open in three
   quick pops from the point, the labels arrive with the last; a chosen dot swells, the others fold away first, it slides
   home last, then the name goes. Reduced motion: it simply appears and goes.

   SEVERAL RINGS (same note: "a grab bar on one side and a drop-down … on the other … swap between different ring menus,
   and whichever one you used last is the one that shows up the next time"): rings are defined once by id; the name in the
   middle carries a grip (drag to move the ring) and, with more than one ring, a switch that lists them. The last one
   used is remembered (per tool key) and opens next time.

     SurfaceRing.define(id, { title, menu, items: () => [ … ], power, level })   // menu: its name in the switch's list (else title)   // items as below, built fresh each time it opens
     var R = SurfaceRing.open({ x, y,                                // client px: where it centres
       rings: ['touch', 'play'], ring: 'touch', key: 'current',      // defined rings to switch between; which; where the last is kept
       hub: 'label' | 'mark',                                        // the name as a word, or as the ring's mark (aria keeps the name)
       title, items,                                                 // or a one-off ring without define()
       a value item may carry idle: () => bool (set but not heard: its arc dims), lit: () => true | "dark" | false (heard: the accent; playing but muted: dark),
       iconOff: the icon while idle;
       wake: () => void (idle and touched: turns its sound on instead of changing the amount),
       bg: (canvas, lit) => void (painted behind its icon every frame, e.g. the sound's wave); a go item roll: true turns its icon over;
       items may carry at: "top" | "bottom-left" | "bottom-right" (the panel up top, back and next below),
       center: "bar" | "ball" (the middle as a bar, the default, or a round button like the bar button the ring came from;
       with define({icon}) the ball shows that icon over a small name), per ring in define, or per open,
       define({icon, iconOff}): a round centre that is a switch shows iconOff while off;
       pin: true (the pin; false hides it), pinned: false (open pinned),
       power: { on: () => bool, set: (v) => {} },                   // the name is the ring's switch (see THE CENTRE below)
       level: () => 0..1,                                            // what a live dot pulses with (a sound's level); none: it breathes
       onClose: (why) => {}, onSwitch: (id) => {}, onPin: (on) => {} })
     items: [{ id, icon: '<svg…>', label: 'push', aria: 'Push: …', on: bool, kind: 'radio'|'check'|'go', stay: bool, pick: () => {},
              live: bool,                                            // playing: its edge pulses (THE PULSE)
              level: () => 0..1,                                     // this dot's own level: only it pulses with it (a ring's level drives them all)
              more: { on: bool, set: (v) => {}, aria } }]            // a second page on a radio dot (TWO PAGES)
     a value: { id, kind: 'value', icon, label, aria, get: () => n, set: (n) => {}, min: 0, max: 100, step: 1, fmt: n => '50%' }
       (Dimitry, 24 Oct 20:15: "where you drag and a number changes, that number could happen inside the button that you
       pressed, or it could take over the name of the ring … like a 0 to 100 slider"): drag across the dot and the number
       shows inside it; tap it and the ring's name becomes that value's slider, with a tick to come back.
     a dot may carry ring: 'id' (a defined ring) or { title, icon, items: () => [ … ] }: the dot is a door to its own ring
       (DOTS THAT ARE RINGS, below); a check dot that is off is turned on (pick) on the way in
     SurfaceRing.labels() · SurfaceRing.labels('learn' | 'always' | 'never')   // the dots' words (LABELS); kept per device
     R.close() · SurfaceRing.isOpen() · SurfaceRing.close() · SurfaceRing.last(key) · SurfaceRing.MARK (the six-dot mark)
     SurfaceRing.doubleTap(el, (x, y, e) => {}, { ms: 320, px: 24, when: e => bool })   // a one-finger double-tap on el

   THE FRAME (Dimitry, 25 Oct 06:22, drawn on the ring: "the top of the frame is the panel caret and the bottom of the frame
   is the little grab bar so those things don't have to actually take up space as an actual button"): an item at "top"
   that goes somewhere (kind go: the way to the ring's panel) is a caret tab notched into the top edge of the name, not a
   dot; the grip is a lozenge notched into its bottom edge. The pin is an outline leaning over when loose and stands up
   solid when pinned, with no fill of its own to compete with the dots.

   THE CENTRE (same note: "how do we indicate that it's a master switch whereas the other buttons are its children"): with
   power, the name is the ring's switch. On, a lit point before the word; off, a hollow one and every dot dims but keeps
   its choice. A dot chosen while off turns the ring back on with it. Lit always means happening now: nothing that says
   off is ever lit, so a ring has no "off" dot of its own.

   TWO PAGES ("a double dot at the bottom that suggests two modes like in a picture gallery … framed to hug the edge"): a
   radio dot with more shows two small points in a tab on its bottom edge while it is the choice. A tap on the chosen dot
   turns the page: the second point lights and the dot goes live. Another tap turns it back.

   THE PULSE ("their edge is doing something interesting … vibrating in and out"): a live dot's edge breathes; given a
   level, it pulses with it instead. Reduced motion: a steady second ring.

   LABELS ("show and then fade … once you know what they are maybe you don't need them"): learn (the default) shows the
   words as the ring opens, holds them, then lets them fade; the first five opens hold longer. always keeps them; never
   shows them only under a finger, a pointer or the focus. The name and any value never fade.

   DOTS THAT ARE RINGS (Dimitry, 27 Oct 06:27: the camera "turns on, blinks ... then starts to get bigger and move downwards
   to replace the original input central button, and as it does ... the ring buttons vanish ... when the camera icon replaces
   the center its new ring buttons appear with all of its controls"; 06:30: "a return arrow ... at the top that indicates
   that we are in a sub menu of a dot, but some of these menus could be full menus ... called the Camera menu"): a dot with
   ring swells into the middle while the others fold, and its ring blooms from there with the dot's icon as its centre. A
   ring reached this way has no switch; its top tab is a return arrow, and a tap on the centre also goes back up (he chose
   it, 27 Oct). The same defined ring opened on its own keeps its caret to its panel: only how you arrived differs.

   Plain script, window.SurfaceRing, no dependencies. Loads its own styles; a tool's rules win (:where). */
(function () {
  "use strict";
  if (window.SurfaceRing) return;
  var MARK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="4.6" r="2"/><circle cx="18.4" cy="8.3" r="2"/><circle cx="18.4" cy="15.7" r="2"/><circle cx="12" cy="19.4" r="2"/><circle cx="5.6" cy="15.7" r="2"/><circle cx="5.6" cy="8.3" r="2"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>';
  var GRIP = '<svg viewBox="0 0 6 20" aria-hidden="true" focusable="false"><circle cx="1.5" cy="5" r="1.1"/><circle cx="1.5" cy="10" r="1.1"/><circle cx="1.5" cy="15" r="1.1"/><circle cx="4.5" cy="5" r="1.1"/><circle cx="4.5" cy="10" r="1.1"/><circle cx="4.5" cy="15" r="1.1"/></svg>';
  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 3.5h6l-1 5 3 3.5H7l3-3.5z"/><path d="M12 12v8.5"/></svg>';
  var BACK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 7 6 11l4 4"/><path d="M6 11h8.5a4 4 0 0 1 4 4v2"/></svg>';
  var CARET = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 10l5 5 5-5"/></svg>';
  /* three pops: a third of the way, three quarters, home; each step overshoots a little and settles */
  var POP = "cubic-bezier(.2,1.7,.45,1)";
  var CSS =
    ":where(.sr-veil){position:fixed;inset:0;z-index:70;background:transparent}" +
    ":where(.sr-ring){position:fixed;z-index:71;width:0;height:0;pointer-events:none}" +
    ":where(.sr-hub){position:absolute;left:0;top:0;transform:translate(-50%,-50%);display:flex;align-items:center;gap:2px;padding:3px;border-radius:999px;background:rgb(var(--ui-g,12 14 16) / .86);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--ui-ink,#eef1f2);pointer-events:auto;box-shadow:0 0 0 1px rgb(var(--ui-hi,255 255 255) / .14);z-index:1;white-space:nowrap}" +
    ":where(.sr-hub) .sr-name{padding:6px 8px;font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.16em;text-transform:uppercase}" +
    ":where(.sr-hub) .sr-name svg{display:block;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6}" +
    ":where(.sr-hub) button{display:grid;place-items:center;min-width:30px;height:30px;padding:0 4px;border:0;border-radius:999px;background:none;color:inherit;cursor:pointer;touch-action:none}" +
    ":where(.sr-hub) button:hover{background:rgb(var(--ui-hi,255 255 255) / .1)}" +
    /* 25 Oct, his redraw of the hub: pin · name over its grip · switch, one row high. The grip sits under the word; the pin drags too */
    ":where(.sr-mid){display:flex;flex-direction:column;align-items:center}" +
    /* THE FRAME, canon (Dimitry, 25 Oct 07:57, drawn on the iPad: "since the menu comes from the bottom that's where the caret
       down should be, so this follows the model we're using in the bar … putting the gripper on the right-hand side,
       definitely canon"): the centre reads like a bar button turned into a ring's middle. Pin on the left, the grip's
       dots on the right, the panel's caret a bump on the top edge, the ring switch a bump on the bottom edge, the bumps
       part of the outline, not lozenges laid on it. The switch's list drops from the bottom bump. */
    ":where(.sr-hub) .sr-grip{width:22px;min-width:22px;padding:0;cursor:grab}:where(.sr-hub) .sr-grip svg{width:6px;height:18px;fill:currentColor;opacity:.65}" +
    ":where(.sr-hub) .sr-up,:where(.sr-hub) .sr-sw{position:absolute;left:50%;transform:translateX(-50%);min-width:0;width:46px;height:15px;padding:0;background:rgb(var(--ui-g,12 14 16) / .86);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}" +
    ":where(.sr-hub) .sr-up{top:-15px;border-radius:15px 15px 0 0;box-shadow:0 -1px 0 rgb(var(--ui-hi,255 255 255) / .14),-1px 0 0 rgb(var(--ui-hi,255 255 255) / .14),1px 0 0 rgb(var(--ui-hi,255 255 255) / .14)}" +
    ":where(.sr-hub) .sr-sw{bottom:-15px;border-radius:0 0 15px 15px;box-shadow:0 1px 0 rgb(var(--ui-hi,255 255 255) / .14),-1px 0 0 rgb(var(--ui-hi,255 255 255) / .14),1px 0 0 rgb(var(--ui-hi,255 255 255) / .14)}" +
    ":where(.sr-hub) .sr-up svg,:where(.sr-hub) .sr-sw svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}" +
    ":where(.sr-hub) .sr-up svg{margin-top:3px}:where(.sr-hub) .sr-sw svg{margin-top:-3px}" +
    /* a finger's reach around each bump, outward only, without growing what you see */
    ":where(.sr-hub) .sr-up::after,:where(.sr-hub) .sr-sw::after{content:'';position:absolute;left:-6px;right:-6px}:where(.sr-hub) .sr-up::after{top:-14px;bottom:0}:where(.sr-hub) .sr-sw::after{top:0;bottom:-14px}" +
    ":where(.sr-hub) .sr-up:hover,:where(.sr-hub) .sr-sw:hover{background:rgb(var(--ui-g,12 14 16) / .86);color:var(--acc,#55b8c9)}" +
    /* THE BALL (his second option): the centre as a round button, a small name inside, the same four parts at its four
       edges. Off unless a tool asks (center: "ball"); a slider in the middle turns it back into a bar while it shows */
    ".sr-hub.sr-round:not(:has(.sr-val)){width:88px;height:88px;padding:0;justify-content:center}" +
    ".sr-hub.sr-round:not(:has(.sr-val)) .sr-name{padding:0;font-size:8.5px;letter-spacing:.12em}" +
    ":where(.sr-hub) .sr-ic{display:flex;flex-direction:column;align-items:center;gap:4px}:where(.sr-hub) .sr-ic svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
    ".sr-hub.sr-round:not(:has(.sr-val)) .sr-pin{position:absolute;left:3px;top:50%;transform:translateY(-50%);min-width:26px;width:26px}" +
    ".sr-hub.sr-round:not(:has(.sr-val)) .sr-grip{position:absolute;right:3px;top:50%;transform:translateY(-50%)}" +
    ".sr-hub.sr-round:not(:has(.sr-val)) .sr-up{top:3px;width:34px;height:24px;border-radius:999px;box-shadow:none;background:none}" +
    ".sr-hub.sr-round:not(:has(.sr-val)) .sr-sw{bottom:3px;width:34px;height:24px;border-radius:999px;box-shadow:none;background:none}" +
    ".sr-hub.sr-round:not(:has(.sr-val)) .sr-up svg,.sr-hub.sr-round:not(:has(.sr-val)) .sr-sw svg{margin:0}" +
    ".sr-hub.sr-round:not(:has(.sr-val)) .sr-up::after,.sr-hub.sr-round:not(:has(.sr-val)) .sr-sw::after{display:none}" +
    ".sr-hub.sr-round:not(:has(.sr-val)) :is(.sr-up,.sr-sw){-webkit-backdrop-filter:none;backdrop-filter:none}" +   /* their blur drew a pale pill inside the ball */
    /* (Dimitry, 25 Oct 08:40–08:41) no hard-edged highlight inside the middle ("I don't want the ring within the ring"):
       the parts round the edge rest at 65% and come to full under a finger or the pointer, nothing drawn behind them; the
       middle itself only brightens. The edge icons sit 7 px nearer the rim, their touch areas where they were, so the
       icon and the word in the middle get more room. */
    ".sr-hub.sr-round:not(:has(.sr-val)) button:hover,.sr-hub.sr-round:not(:has(.sr-val)) .sr-up:hover,.sr-hub.sr-round:not(:has(.sr-val)) .sr-sw:hover{background:none;color:inherit}" +
    ".sr-hub.sr-round:not(:has(.sr-val)) :is(.sr-pin,.sr-grip,.sr-up,.sr-sw)>svg{opacity:.65;transition:opacity .15s}" +
    ".sr-hub.sr-round:not(:has(.sr-val)) :is(.sr-pin,.sr-grip,.sr-up,.sr-sw):is(:hover,:active,:focus-visible)>svg,.sr-hub.sr-round .sr-pin[aria-pressed=true]>svg{opacity:1}" +
    ".sr-hub.sr-round:not(:has(.sr-val)) .sr-name,.sr-hub.sr-round:not(:has(.sr-val)) .sr-pow{opacity:.9;transition:opacity .15s}.sr-hub.sr-round:not(:has(.sr-val)) :is(.sr-name,.sr-pow):is(:hover,:active,:focus-visible){opacity:1}" +
    ".sr-hub.sr-round:not(:has(.sr-val)) .sr-pin>svg{translate:-7px 0}.sr-hub.sr-round:not(:has(.sr-val)) .sr-grip>svg{translate:7px 0}" +
    ".sr-hub.sr-round:not(:has(.sr-val)) .sr-up>svg{translate:0 -7px}.sr-hub.sr-round:not(:has(.sr-val)) .sr-sw>svg{translate:0 7px}" +
    /* THE CENTRE: the name as the ring's switch, a point before the word, lit or hollow */
    ":where(.sr-hub) .sr-pow{display:flex;align-items:center;gap:7px;height:30px;padding:0 10px 0 9px;font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.16em;text-transform:uppercase}" +
    ":where(.sr-hub) .sr-pow i{flex:none;width:8px;height:8px;border-radius:50%;box-shadow:inset 0 0 0 1.5px currentColor;opacity:.7}" +
    ":where(.sr-hub) .sr-pow[aria-pressed=true] i{background:var(--acc,#55b8c9);box-shadow:0 0 6px var(--acc,#55b8c9);opacity:1}" +
    ":where(.sr-hub) .sr-pow.sr-ic{flex-direction:column;height:auto;padding:0;gap:4px}:where(.sr-hub) .sr-pow.sr-ic svg{opacity:.45;transition:opacity .15s,color .15s}:where(.sr-hub) .sr-pow.sr-ic[aria-pressed=true] svg{opacity:1;color:var(--acc,#55b8c9)}" +
    ".sr-ring.sr-off .sr-dot{opacity:.45}.sr-ring.sr-off .sr-dot:hover,.sr-ring.sr-off .sr-dot:focus-visible{opacity:.8}" +
    /* TWO PAGES: two points in a tab on the chosen dot's bottom edge */
    /* (Dimitry, 25 Oct 08:24: "over represented … no frame around the dots, no contrasting color … simply inside the circle
       near the bottom, like the pin and the caret … two little dots, one filled and the other not") */
    ":where(.sr-pg){position:absolute;left:50%;bottom:7px;transform:translateX(-50%);display:none;gap:3px;pointer-events:none}" +
    ":where(.sr-pg) i{width:4px;height:4px;border-radius:50%;box-sizing:border-box;box-shadow:inset 0 0 0 1px currentColor;background:none}" +
    ".sr-dot[aria-checked=true] .sr-pg{display:flex}.sr-dot .sr-pg i:first-child,.sr-dot.sr-p2 .sr-pg i:last-child{background:currentColor}.sr-dot.sr-p2 .sr-pg i:first-child{background:none}" +
    /* THE PULSE: a live dot's edge breathes, or follows the level it was given */
    /* (Dimitry, 25 Oct 09:09: the swelling accent edge "looks just like a bigger button … it does need a pulsing inside of it,
       a white circle inside it pulsing from the inner circumference outward, to the sound"): a live dot keeps its own edge;
       a thin white ring starts just inside its rim and swells out past it with the level, fading as it goes. Without a
       level it breathes slowly. */
    ".sr-ring .sr-dot.sr-live::after{content:'';position:absolute;inset:3px;border-radius:50%;border:2px solid #fff;pointer-events:none;opacity:.35;transform:scale(1);animation:srLive 1.6s ease-in-out infinite}" +
    "@keyframes srLive{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.16);opacity:.12}}" +
    /* (Dimitry, 25 Oct 08:51: "it's not actually pulsing to the sound, so it could be a lot thinner … it needs to pump in
       and out with the sound, or change opacity with the sound, or both"): with a level, the edge is a thin line at rest
       and swells and brightens with every sound, so a beat reads as a beat without a word */
    ".sr-ring.sr-lv .sr-dot.sr-live::after,.sr-ring .sr-dot.sr-live.sr-lvd::after{animation:none;transform:scale(calc(1 + var(--lv,0) * .34));opacity:calc(.3 + var(--lv,0) * .7 - var(--lv,0) * var(--lv,0) * .5)}" +
    /* LABELS: they fade after the opening (learn), stay (always), or wait for a finger (never) */
    ".sr-ring.sr-labfade .sr-dot .sr-lab{animation:srHide .5s ease both}@keyframes srHide{from{opacity:1}to{opacity:0}}" +
    ".sr-ring.sr-labfade .sr-dot:hover .sr-lab,.sr-ring.sr-labfade .sr-dot:focus-visible .sr-lab,.sr-ring.sr-labfade .sr-dot:active .sr-lab,.sr-ring.sr-labfade .sr-dot.sr-busy .sr-lab{animation:none;opacity:1}" +
    ":where(.sr-hub) .sr-pin{cursor:grab}:where(.sr-hub){touch-action:none;cursor:grab}:where(.sr-moving) .sr-hub,:where(.sr-moving) .sr-hub *{cursor:grabbing}" +
    /* PIN (Dimitry, 25 Oct 00:29: "the ring might be desired as a sort of floating thing … the disclosure triangle could share
       vertical space with a pin button to pin the menu, prevent it from closing"): the switch and the pin stacked at the
       name's right. Pinned, the ring floats: no veil, the stage plays under it, a choice keeps it open, Esc or the pin lets go */
    ":where(.sr-hub) .sr-pin svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;transform:rotate(40deg);opacity:.7;transition:transform .18s,opacity .18s}" +
    /* pinned: the pin stands up, solid, in the accent; no round fill to compete with the dots (25 Oct 06:22) */
    ":where(.sr-hub) .sr-pin[aria-pressed=true] svg{transform:none;fill:var(--acc,#55b8c9);stroke:var(--acc,#55b8c9);opacity:1}" +
    ".sr-ring .sr-dot.sr-tap{transition:transform .14s " + POP + ";transform:translate(var(--x),var(--y)) scale(1.18)}" +
    ":where(.sr-hub) .sr-sw svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ":where(.sr-hub) button:focus-visible{outline:2px solid #fff;outline-offset:1px}" +
    /* the switch's list (Dimitry, 26 Oct 05:50, iPad, drawn on it: "less vertical space and icon"): each ring's own icon
       before its name, rows 40 px, a finger's target (he asked for 40, 05:58), and touching (no gap); a ring may give the list a
       fuller name than its centre carries (define({menu})) */
    /* THE WHEEL (Dimitry, 26 Oct 05:59-06:01: "a vertical scroll with magnifying glass … magnifying effect"): the switch's list
       is a short vertical wheel, three rows showing, a lens across the middle; the row in the lens is magnified and the
       others shrink and fade with their distance from it (the Dock's magnification, an iOS picker's wheel). Scroll it with
       a finger, a trackpad or the arrow keys; a tap on any row switches. Rows 40 px (05:58). Web standards only: CSS
       scroll snapping, and a scale worked out from each row's distance to the lens on scroll. */
    ":where(.sr-list){position:absolute;left:0;top:38px;transform:translateX(-50%);padding:0;overflow:hidden;border-radius:16px;background:rgb(var(--ui-g,12 14 16) / .94);box-shadow:0 0 0 1px rgb(var(--ui-hi,255 255 255) / .14),0 10px 30px rgb(0 0 0 / .4);pointer-events:auto;z-index:2}" +
    ":where(.sr-list)::before{content:'';position:absolute;left:5px;right:5px;top:40px;height:40px;border-radius:12px;background:rgb(var(--ui-hi,255 255 255) / .07);box-shadow:inset 0 0 0 1px rgb(var(--ui-hi,255 255 255) / .26);pointer-events:none}" +
    ":where(.sr-list) .sr-wh{position:relative;height:120px;box-sizing:border-box;padding:40px 0;overflow-y:auto;overscroll-behavior:contain;scroll-snap-type:y mandatory;scrollbar-width:none;touch-action:pan-y;-webkit-mask-image:linear-gradient(transparent,#000 30%,#000 70%,transparent);mask-image:linear-gradient(transparent,#000 30%,#000 70%,transparent)}" +
    ":where(.sr-list) .sr-wh::-webkit-scrollbar{display:none}" +
    ":where(.sr-list) button{display:flex;align-items:center;justify-content:center;width:100%;min-height:40px;height:40px;padding:0 26px;border:0;border-radius:12px;background:none;color:var(--ui-ink,#eef1f2);font:600 10.5px/1 var(--mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;cursor:pointer;white-space:nowrap;scroll-snap-align:center}" +
    ":where(.sr-list) .sr-mg{display:inline-flex;align-items:center;gap:9px;transform-origin:center;will-change:transform}" +
    ":where(.sr-list) button svg{flex:none;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}" +
    ":where(.sr-list) button[aria-checked=true]{color:var(--acc-tx,var(--acc,#55b8c9))}" +
    ":where(.sr-list) button[aria-checked=true] .sr-mg::after{content:'';width:5px;height:5px;border-radius:50%;background:currentColor;margin-left:1px}" +   /* the current ring: a dot as well as the colour (review 28e047e-r-2) */
    ":where(.sr-list) button:focus-visible{outline:none}:where(.sr-list) button:focus-visible .sr-mg{text-decoration:underline;text-underline-offset:4px}" +
    ":where(.sr-dot){position:absolute;left:0;top:0;width:var(--sr-d,52px);height:var(--sr-d,52px);margin:calc(var(--sr-d,52px) / -2) 0 0 calc(var(--sr-d,52px) / -2);padding:0;border:0;border-radius:50%;display:grid;place-items:center;background:rgb(var(--ui-g,12 14 16) / .86);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--ui-ink,#eef1f2);box-shadow:0 0 0 1px rgb(var(--ui-hi,255 255 255) / .16),0 6px 20px rgb(0 0 0 / .35);cursor:pointer;pointer-events:auto;transform:translate(var(--x),var(--y));-webkit-tap-highlight-color:transparent}" +
    ":where(.sr-dot) svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
    /* (Dimitry, 25 Oct 09:19: tapping the dice or an arrow "nothing happens … there's no indicator that it has been pressed …
       a pulse of activity … it needs to go blue, and the dice could animate"): a one-shot dot flashes lit and swells, a
       roll item's icon turns over once. A value item may be lit (heard: the accent) and may paint a canvas behind its
       icon (a wave), so the ring's volume shows what the bar's speaker shows. */
    ".sr-ring .sr-pin.sr-flash>svg{animation:srPinFlash .85s ease-in-out}@keyframes srPinFlash{0%,100%{transform:none;opacity:1}20%,60%{transform:scale(1.55);opacity:1;filter:drop-shadow(0 0 4px var(--acc,#55b8c9))}40%,80%{transform:scale(1.1)}}" +
    ".sr-ring:not(.pop) .sr-dot{transition:transform .35s cubic-bezier(.3,.7,.4,1),opacity .25s}" +
    ".sr-ring.sr-mini .sr-dot{transform:translate(0,0) scale(.3);opacity:0;pointer-events:none}" +
    ".sr-ring .sr-dot.sr-hit{background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c);transition:none}" +
    ".sr-ring .sr-dot.sr-roll>svg:not(.sr-arc){animation:srRoll .55s cubic-bezier(.3,.7,.4,1)}@keyframes srRoll{0%{transform:rotate(0) scale(1)}40%{transform:rotate(200deg) scale(.8)}100%{transform:rotate(360deg) scale(1)}}" +
    ".sr-ring .sr-dot.sr-lit{background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c)}" +
    ".sr-ring .sr-dot.sr-dark{background:var(--acc-ink,#04181c);color:#fff}.sr-ring .sr-dot.sr-dark .sr-arc .t{stroke:#fff;opacity:.18}" +
    ".sr-ring .sr-dot.sr-lit .sr-arc .v{stroke:var(--acc-ink,#04181c)}.sr-ring .sr-dot.sr-lit .sr-arc .t{stroke:var(--acc-ink,#04181c);opacity:.2}" +
    ".sr-ring .sr-dot canvas.sr-bg{position:absolute;inset:4px;width:calc(100% - 8px);height:calc(100% - 8px);border-radius:50%;pointer-events:none}" +
    ".sr-ring .sr-dot>svg:not(.sr-arc),.sr-ring .sr-dot>.sr-num{position:relative}" +
    ":where(.sr-dot)[aria-checked=true]{background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c);box-shadow:0 0 0 2px rgb(255 255 255 / .5),0 6px 20px rgb(0 0 0 / .35)}" +
    ":where(.sr-dot):focus-visible{outline:2px solid #fff;outline-offset:3px}" +
    /* QUANTITY WITHOUT A BAR (Dimitry, 25 Oct 08:34: "a systematic way of showing a quantity without bringing in horizontal
       elements … the level in the dot as a percentage of a ring, the way we do the dice"): a value dot wears its level as
       an arc round its own edge, at rest and while dragged; a tap turns the ring's middle into a dial. */
    ".sr-ring .sr-dot svg.sr-arc,.sr-ring .sr-dial svg.sr-arc{position:absolute;inset:0;width:100%;height:100%;margin:0;transform:rotate(-90deg);pointer-events:none;overflow:visible;fill:none;stroke:none;animation:none}" +   /* weight enough to beat the dot's own icon size */
    ":where(.sr-arc) circle{fill:none;stroke-width:3;stroke-linecap:round}:where(.sr-arc) .t{stroke:currentColor;opacity:.14}:where(.sr-arc) .v{stroke:var(--acc,#55b8c9)}" +
    ".sr-dot.sr-idle:not(.sr-busy) .sr-arc .v{opacity:.35}" +
    ".sr-dot.sr-busy .sr-arc .v{stroke:#fff}.sr-dot.sr-busy .sr-arc .t{opacity:.3}" +
    ":where(.sr-dial){position:absolute;left:0;top:0;width:88px;height:88px;transform:translate(-50%,-50%);border-radius:50%;display:grid;place-items:center;background:rgb(var(--ui-g,12 14 16) / .9);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--ui-ink,#eef1f2);box-shadow:0 0 0 1px rgb(var(--ui-hi,255 255 255) / .14);pointer-events:auto;touch-action:none;cursor:ns-resize;z-index:2;outline:none}" +
    ":where(.sr-dial):focus-visible{box-shadow:0 0 0 2px #fff}" +
    ".sr-ring .sr-dial svg.sr-arc{inset:5px;width:calc(100% - 10px);height:calc(100% - 10px)}:where(.sr-dial) .sr-arc circle{stroke-width:4}" +
    ":where(.sr-dial) .dv{display:flex;flex-direction:column;align-items:center;gap:3px}:where(.sr-dial) b{font:700 16px/1 var(--mono,ui-monospace,monospace)}" +
    ":where(.sr-dial) small{font:600 8px/1 var(--mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;opacity:.75}" +
    ".sr-ring.sr-dialing .sr-hub{visibility:hidden}" +
    ":where(.sr-dot) .sr-num{font:700 13px/1 var(--mono,ui-monospace,monospace)}:where(.sr-dot.sr-busy){background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c)}" +
    ":where(.sr-hub) .sr-val{display:flex;align-items:center;gap:8px;padding:0 6px}:where(.sr-hub) .sr-val span{font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.16em;text-transform:uppercase}:where(.sr-hub) .sr-val b{min-width:44px;font:700 12px/1 var(--mono,ui-monospace,monospace);text-align:right}" +
    ":where(.sr-hub) .sr-val input[type=range]{flex:none;width:140px;min-width:100px;margin:0;accent-color:var(--acc,#55b8c9)}" +
    ":where(.sr-lab){position:absolute;left:50%;top:calc(100% + 4px);transform:translateX(-50%);white-space:nowrap;font:600 9.5px/1 var(--mono,ui-monospace,monospace);letter-spacing:.12em;text-transform:uppercase;color:#fff;text-shadow:0 1px 3px rgb(0 0 0 / .9),0 0 8px rgb(0 0 0 / .7);pointer-events:none}" +
    /* opening: pop, pop, pop; the icon and the label arrive with the last pop */
    ".sr-ring.pop .sr-dot{animation:srPop .46s both;animation-delay:calc(var(--i) * 22ms)}" +
    ".sr-ring.pop .sr-dot svg,.sr-ring.pop .sr-lab{animation:srShow .2s ease-out both;animation-delay:calc(.26s + var(--i) * 22ms)}" +
    ".sr-ring.pop .sr-hub{animation:srHub .3s " + POP + " both}" +
    "@keyframes srPop{0%{transform:translate(0,0) scale(.15);opacity:0;animation-timing-function:" + POP + "}" +
    "33%{transform:translate(calc(var(--x) * .34),calc(var(--y) * .34)) scale(.5);opacity:1;animation-timing-function:" + POP + "}" +
    "66%{transform:translate(calc(var(--x) * .74),calc(var(--y) * .74)) scale(.8);animation-timing-function:" + POP + "}" +
    "100%{transform:translate(var(--x),var(--y)) scale(1)}}" +
    "@keyframes srShow{from{opacity:0}to{opacity:1}}" +
    "@keyframes srHub{from{transform:translate(-50%,-50%) scale(.6);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}" +
    /* closing: the others fold home first; a chosen dot swells, then slides home; the name goes last */
    ".sr-ring .sr-dot.sr-fold{transition:transform .18s ease-in,opacity .18s ease-in;transform:translate(0,0) scale(.3);opacity:0}" +
    ".sr-ring .sr-dot.sr-chosen{z-index:1;transition:transform .2s " + POP + ";transform:translate(var(--x),var(--y)) scale(1.28)}" +
    ".sr-ring .sr-dot.sr-chosen.sr-live,.sr-ring .sr-dot.sr-fold.sr-live,.sr-ring .sr-dot.sr-fold1.sr-live{animation:none}" +
    ".sr-ring .sr-dot.sr-chosen.sr-home{transition:transform .22s cubic-bezier(.5,0,.3,1),opacity .22s ease-in .08s;transform:translate(0,0) scale(.7);opacity:0}" +
    ".sr-ring .sr-hub.sr-gone{transition:opacity .16s ease-in,transform .16s ease-in;opacity:0;transform:translate(-50%,-50%) scale(.85)}" +
    /* sent away (a tap off the ring, Esc): the petals fold home one at a time, last first, and the name becomes a dot
       that sinks into the middle (Dimitry, 25 Oct: "it just disappears ... I do like when it shrinks back in one petal at a
       time ... I wonder if the title bar should just become a circle") */
    ".sr-ring .sr-dot.sr-fold1{transition:transform .2s cubic-bezier(.5,0,.75,0),opacity .2s ease-in;transition-delay:var(--fd,0ms);transform:translate(0,0) scale(.3);opacity:0}" +
    ".sr-ring .sr-dot.sr-fold2{transition:transform .45s cubic-bezier(.5,0,.3,1) var(--fd,0ms),opacity .45s ease-in var(--fd,0ms);transform:translate(0,0) scale(.3);opacity:0;pointer-events:none}" +
    ".sr-ring .sr-dot.sr-fold2.sr-live{animation:none}.sr-ring .sr-dot.sr-dive{z-index:3;transition:transform .42s cubic-bezier(.3,.7,.2,1);transform:translate(0,0) scale(1.7);pointer-events:none}.sr-ring .sr-dot.sr-dive .sr-lab{opacity:0}.sr-ring.sr-diving .sr-hub{transition:opacity .2s;opacity:0}" +
    ".sr-ring .sr-hub.sr-linger{transition:opacity 1.5s ease-in;opacity:0}" +
    ".sr-ring .sr-hub.sr-linger:hover{opacity:.6;transition:opacity .2s}" +
    ".sr-ring .sr-hub.sr-ball{transition:width .2s cubic-bezier(.4,0,.2,1),padding .2s,gap .2s;overflow:hidden;gap:0}" +
    ".sr-ring .sr-hub.sr-ball>*{transition:opacity .12s ease-in;opacity:0}" +
    ".sr-ring .sr-hub.sr-ball.sr-gone{transition:transform .2s cubic-bezier(.5,0,.75,0),opacity .2s ease-in;transform:translate(-50%,-50%) scale(.2)}" +
    "@media (prefers-reduced-motion:reduce){.sr-ring .sr-dot.sr-live::after{animation:none;transform:none;opacity:.6}.sr-ring.pop .sr-dot,.sr-ring.pop .sr-dot svg,.sr-ring.pop .sr-lab,.sr-ring.pop .sr-hub{animation:none}.sr-ring .sr-dot.sr-fold,.sr-ring .sr-dot.sr-chosen,.sr-ring .sr-hub.sr-gone{transition:none}}";
  function css() { if (document.getElementById("sring-css")) return; var st = document.createElement("style"); st.id = "sring-css"; st.textContent = CSS; (document.head || document.documentElement).prepend(st); }
  var RINGS = {}, cur = null;
  var calm = function () { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  var lastKey = function (k) { return "surface.ring.last." + (k || "tool"); };
  function last(k) { try { return localStorage.getItem(lastKey(k)) || null; } catch (e) { return null; } }
  function remember(k, id) { try { localStorage.setItem(lastKey(k), id); } catch (e) {} }
  var REOPEN = -1e9;
  function define(id, def) { RINGS[id] = def; }
  var LABK = "surface.ring.labels", SEENK = "surface.ring.seen";
  function labels(v) { if (v === "learn" || v === "always" || v === "never") { try { localStorage.setItem(LABK, v); } catch (e) {} return v; }
    var m; try { m = localStorage.getItem(LABK); } catch (e) {} return m === "always" || m === "never" ? m : "learn"; }
  function seen(add) { var k = 0; try { k = +localStorage.getItem(SEENK) || 0; if (add) localStorage.setItem(SEENK, String(k + 1)); } catch (e) {} return k; }
  /* the end: what = 'pick' (a dot was chosen, the effect already done), anything else folds everything at once */
  function close(why, chosen, hold) {
    hold = hold || 0;
    if (!cur) return; var c = cur; cur = null;
    document.removeEventListener("keydown", c.key, true);
    try { c.veil.remove(); } catch (e) {}
    var gone = function () { try { c.ring.remove(); } catch (e) {} };
    if (calm() && chosen && hold && why === "pick") { chosen.style.zIndex = "2"; setTimeout(gone, hold); }
    else if (calm() || why === "again" || why === "api" || !c.ring.isConnected) gone();
    else {
      /* THE LINGER (Dimitry, 25 Oct 08:56: "I don't think the ring menu should disappear immediately … the buttons should pop
         back into the menu in one second, not super fast; if the menu has not been pinned it then slowly fades over a second
         and a half, giving the user time to see what they've done, and for the menu to linger in case they want to go back to
         it and maybe pin it"). The petals fold home over about a second (a chosen one holds lit first), then the middle stays
         and fades over 1.5 s; a tap on it while it fades opens the ring again where it was (on the pin: opened pinned). */
      c.ring.classList.remove("pop"); void c.ring.offsetWidth;   // settle without the opening animation first: a transition never starts from a style an animation was holding
      var dots = [].slice.call(c.ring.querySelectorAll(".sr-dot")), hub = c.ring.querySelector(".sr-hub");
      c.ring.querySelectorAll(".sr-list,.sr-dial").forEach(function (x) { x.remove(); }); c.ring.classList.remove("sr-dialing");
      var others = dots.filter(function (d) { return d !== chosen; }), k = others.length, step = k > 1 ? Math.round(520 / (k - 1)) : 0;
      others.forEach(function (d, i) { d.style.setProperty("--fd", (k - 1 - i) * step + "ms"); d.classList.add("sr-fold2"); });
      var foldEnd = (k ? (k - 1) * step : 0) + 450;
      if (chosen) { chosen.classList.add("sr-chosen"); var ch = Math.max(hold, 300); setTimeout(function () { chosen.style.setProperty("--fd", "0ms"); chosen.classList.add("sr-fold2"); }, ch); foldEnd = Math.max(foldEnd, ch + 450); }
      if (!hub) { setTimeout(gone, foldEnd); }
      else {
        var again = function (e) { e.stopPropagation(); e.preventDefault(); if (!c.ring.isConnected) return;
          var pinIt = !!(e.target && e.target.closest && e.target.closest(".sr-pin")), x = parseFloat(c.ring.style.left), y = parseFloat(c.ring.style.top);
          gone(); open(Object.assign({}, c.o, { ring: c.id || c.o.ring, x: x, y: y, pinned: pinIt })); };
        hub.addEventListener("pointerdown", again, true); hub.addEventListener("click", function (e) { e.stopPropagation(); }, true);
        hub.setAttribute("aria-label", "Open the ring again");
        setTimeout(function () { if (c.ring.isConnected) hub.classList.add("sr-linger"); }, foldEnd);
        setTimeout(gone, foldEnd + 1500);
      }
    }
    try { if (c.back && c.back.focus && why !== "pick") c.back.focus({ preventScroll: true }); } catch (e) {}
    try { c.o.onClose && c.o.onClose(why); } catch (e) {}
  }
  /* the wheel: bring a row into the lens; magnify by distance from it (1.3 in the lens, down to 0.78; fading to 0.3) */
  function wheelTo(wh, b, smooth) { if (!wh || !b) return; var top = b.offsetTop - (wh.clientHeight - b.offsetHeight) / 2;
    try { wh.scrollTo({ top: top, behavior: smooth && !calm() ? "smooth" : "auto" }); } catch (e) { wh.scrollTop = top; } }
  function magnify(wh) { var r = wh.getBoundingClientRect(), c = r.top + r.height / 2;
    Array.prototype.forEach.call(wh.children, function (b) { var q = b.getBoundingClientRect(), d = Math.abs((q.top + q.height / 2 - c) / (q.height || 40));
      var m = b.firstChild; if (m && m.style) m.style.transform = "scale(" + Math.max(0.78, 1.3 - 0.3 * d).toFixed(3) + ")"; b.style.opacity = Math.max(0.3, 1 - 0.45 * d).toFixed(2); }); }
  function open(o) {
    o = o || {};
    /* PINNED STAYS PUT (Dimitry, 25 Oct 10:02: a double-tap elsewhere "makes a new ring there and the old one disappears, which
       defeats the purpose of pinning … instead the pin should flash, revealing that it's locked and has to be moved by hand"):
       while a ring is pinned, opening another (a double-tap, a key) only flashes its pin; switching rings from its own list
       still replaces it. */
    if (cur && cur.pinned && !o._own) { flashPin(); return { close: function () { close("api"); }, el: cur.ring, ring: cur.id }; }
    css(); close("again");
    var PAR = o._parent || null;   /* DOTS THAT ARE RINGS: reached through a dot, this ring goes back up instead of switching */
    /* THE LAST RING, EVEN A DOT'S (Dimitry, 27 Oct 07:51: a double tap "should return to the last menu that it was on ... it
       shouldn't be the sound menu if the last thing you were working on was the image menu unless you directly invoked
       that menu"): a ring reached through a dot is remembered as parent>dot, and opening with no ring named goes straight
       back into it, its return arrow to the parent; if that dot is gone or no longer a door (the picture removed), the parent */
    if (!PAR && !o.ring && !o._dive) { var L = last(o.key); if (L && L.indexOf(">") > 0) { var pr = L.split(">")[0], via = L.split(">")[1];
      if ((o.rings || []).indexOf(pr) >= 0 && RINGS[pr]) { var its = []; try { its = (typeof RINGS[pr].items === "function" ? RINGS[pr].items() : RINGS[pr].items || []).filter(Boolean); } catch (er) {}
        var dot = its.filter(function (x) { return x.id === via && x.ring && !(x.kind === "check" && !x.on); })[0],   /* a check dot that is off (the camera removed) reopens its parent */ po = Object.assign({}, o, { ring: pr, _dive: true });
        if (dot) { var sb = typeof dot.ring === "string" ? { ring: dot.ring } : { ring: null, title: dot.ring.title || dot.label, icon: dot.ring.icon || dot.icon, items: dot.ring.items };
          return open(Object.assign({ key: o.key, hub: o.hub, pin: o.pin, onClose: o.onClose, onPin: o.onPin, dot: o.dot }, sb, { x: o.x, y: o.y, pinned: o.pinned, center: "ball", _parent: { o: po, title: RINGS[pr].menu || RINGS[pr].title || "" } })); }
        return open(po); } } }
    var rings = PAR ? [] : (o.rings || []).filter(function (id) { return RINGS[id]; });
    var rid = o.ring && RINGS[o.ring] ? o.ring : rings.length ? (rings.indexOf(last(o.key)) >= 0 ? last(o.key) : rings[0]) : null;
    var def = rid ? RINGS[rid] : { title: o.title, icon: o.icon, center: o.center, items: function () { return (typeof o.items === "function" ? o.items() : o.items) || []; } };
    var items = (typeof def.items === "function" ? def.items() : def.items || []).filter(Boolean), n = items.length; if (!n) return null;
    var upIt = null; items = items.filter(function (it) { if (!upIt && it.at === "top" && it.kind === "go") { upIt = it; return false; } return true; }); n = items.length; if (!n && !upIt) return null;
    var back = PAR ? function () { var bx = parseFloat(ring.style.left), by = parseFloat(ring.style.top), pn = !!(cur && cur.pinned);
      open(Object.assign({}, PAR.o, { _own: true, _dive: true, x: bx, y: by, pinned: pn })); } : null;   /* _dive: back lands on the parent, never the remembered dot's ring again (review fe08e54684 r-1) */
    if (PAR) upIt = { kind: "go", label: "back", aria: "Back to the " + (PAR.title || "first") + " ring", _back: true, pick: back };
    items = place(items); n = items.length;
    if (rid && !PAR) remember(o.key, rid);
    var PW = PAR ? null : def.power || (rid ? null : o.power) || null, LV = def.level || o.level || null;   // a defined ring brings its own switch and level
    var d = Math.max(44, o.dot || 52), gap = 10;
    /* the radius: the dots sit round the circle with a gap between them, room for each label, clear of the hub */
    /* tighter (Dimitry, 25 Oct 08:06: "as long as there's space between the top button and the middle, that gap could be
       fairly smaller … so the ring in general can be quite a bit tighter"): the ball is 88, the top dot's word just clears it */
    var R = Math.max(o.r || 0, (def.center || o.center) === "ball" ? 90 : 92, (n * (d + gap + 8)) / (2 * Math.PI));
    var lab = 14, pad = R + d / 2 + lab + 8, W = innerWidth, H = innerHeight;
    var clampX = function (v) { return Math.max(pad, Math.min(W - pad, v)); }, clampY = function (v) { return Math.max(pad, Math.min(H - pad, v)); };
    var x = clampX(o.x == null ? W / 2 : o.x), y = clampY(o.y == null ? H / 2 : o.y);
    var veil = document.createElement("div"); veil.className = "sr-veil";
    var ring = document.createElement("div"); ring.className = "sr-ring" + (calm() || o._quiet ? "" : " pop");
    /* the opening plays once: a later class change (sr-live off) let the pop animation start over, and the dot dived into the
       middle and came back (Dimitry, 25 Oct 09:09, "the push button still disappears behind the main button") */
    if (!calm()) setTimeout(function () { ring.classList.remove("pop"); }, 900); ring.setAttribute("role", "menu"); ring.setAttribute("aria-label", def.title || "Choices");
    ring.style.left = x + "px"; ring.style.top = y + "px"; ring.style.setProperty("--sr-d", d + "px");
    /* the hub: pin · name · grip; the panel a bump above, the switch a bump below (or all four round a ball) */
    var BALL = (def.center || o.center) === "ball";
    var hub = document.createElement("div"); hub.className = "sr-hub" + (BALL ? " sr-round" : "");   // not sr-ball: that is the closing fold's class
    var grip = document.createElement("button"); grip.type = "button"; grip.className = "sr-grip"; grip.innerHTML = GRIP; grip.setAttribute("aria-label", "Move the ring (drag)"); grip.title = "Drag to move the ring";
    var name = document.createElement("span"), pow = null; name.className = "sr-name";
    if (PW) { pow = document.createElement("button"); pow.type = "button"; pow.className = "sr-pow"; pow.innerHTML = "<i></i><span></span>";
      if (BALL && def.icon) { pow.className = "sr-pow sr-ic"; pow.innerHTML = def.icon + "<span></span>"; }   // a round centre with a switch: the bar button's icon is the switch, lit when on (25 Oct)
      pow.lastChild.textContent = def.title || ""; name = pow;
      pow.onclick = function (e) { e.stopPropagation(); if (e.detail > 0 && cur && performance.now() - cur.t0 < 350) return;   /* the tap that opened the ring lands on the name, in the middle: not a switch (CLAUDE.md) */
        /* the state as the finger came down: the same touch can wake what the switch reports (a browser's sound starts on
           the first touch), and reading it at the click turned the sound off the moment it woke (25 Oct, the speaker) */
        var was = (pow._was && performance.now() - pow._was.t < 1500) ? pow._was.on : !!PW.on(); pow._was = null;
        try { PW.set(!was); } catch (er) { console.warn("[ring]", er); } refresh(); };
      pow.addEventListener("pointerdown", function () { try { pow._was = { on: !!PW.on(), t: performance.now() }; } catch (er) {} }, true); }
    else if ((def.center || o.center) === "ball" && def.icon) { name.className = "sr-name sr-ic"; name.innerHTML = def.icon + "<span></span>"; name.lastChild.textContent = def.title || ""; }
    else if (o.hub === "mark") { name.innerHTML = MARK; name.setAttribute("aria-label", def.title || ""); name.title = def.title || ""; } else name.textContent = def.title || "";
    /* define({tap}): the middle does one thing when touched without being a switch (the Sound ring: wake the sound, 25 Oct 09:46) */
    if (!PW && typeof def.tap === "function") { name.setAttribute("role", "button"); name.tabIndex = 0; name.style.cursor = "pointer";
      var nt = function (e) { e.stopPropagation(); if (e.detail > 0 && cur && performance.now() - cur.t0 < 350) return; try { def.tap(); } catch (er) { console.warn("[ring]", er); } };
      name.addEventListener("click", nt); name.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nt(e); } }); }   // the bar button the ring came from: its icon, its word small under it
    if (PAR) { name.setAttribute("role", "button"); name.tabIndex = 0; name.style.cursor = "pointer"; name.setAttribute("aria-label", (def.title || "") + ". Back to the " + (PAR.title || "first") + " ring");
      var nb = function (e) { e.stopPropagation(); if (e.detail > 0 && cur && performance.now() - cur.t0 < 350) return; back(); };
      name.addEventListener("click", nb); name.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nb(e); } }); }
    var mid = document.createElement("span"); mid.className = "sr-mid"; mid.append(name);
    if (rings.length > 1) {
      var sw = document.createElement("button"); sw.type = "button"; sw.className = "sr-sw"; sw.innerHTML = CARET; sw.setAttribute("aria-haspopup", "menu"); sw.setAttribute("aria-label", "Switch ring: " + rings.map(function (r) { return RINGS[r].menu || RINGS[r].title; }).join(", ")); sw.title = "Switch ring";
      sw.onclick = function (e) { e.stopPropagation(); var L = ring.querySelector(".sr-list"); if (L) { L.remove(); return; }
        L = document.createElement("div"); L.className = "sr-list"; L.setAttribute("role", "menu"); L.setAttribute("aria-label", "Rings");
        var wh = document.createElement("div"); wh.className = "sr-wh"; L.appendChild(wh);
        rings.forEach(function (id) { var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitemradio"); b.setAttribute("aria-checked", String(id === rid)); var mg = document.createElement("span"); mg.className = "sr-mg"; if (RINGS[id].icon) mg.innerHTML = RINGS[id].icon; var bt = document.createElement("span"); bt.textContent = RINGS[id].menu || RINGS[id].title; mg.appendChild(bt); b.appendChild(mg);
          b.onclick = function (ev) { ev.stopPropagation(); if (id === rid) { L.remove(); return; } var oo = Object.assign({}, o, { _own: true, ring: id, x: parseFloat(ring.style.left), y: parseFloat(ring.style.top), pinned: !!(cur && cur.pinned) });
            remember(o.key, id); try { o.onSwitch && o.onSwitch(id); } catch (er) {} open(oo); }; b.addEventListener("focus", function () { var kv = false; try { kv = b.matches(":focus-visible"); } catch (er) {} if (kv) wheelTo(wh, b, true); });   /* keys only: a mouse focuses on press, and sliding the row then lost its click (review 28e047e-r-1) */ wh.appendChild(b); });
        ring.appendChild(L); var f = wh.querySelector("[aria-checked=true]") || wh.firstChild;
        var mr = 0; wh.addEventListener("scroll", function () { if (!mr) mr = requestAnimationFrame(function () { mr = 0; magnify(wh); }); }, { passive: true });
        var wmax = 0; Array.prototype.forEach.call(wh.children, function (x) { wmax = Math.max(wmax, x.firstChild.offsetWidth); }); wh.style.minWidth = Math.ceil(wmax * 1.3 + 28) + "px";   /* room for a magnified name (review 28e047e-r-3) */
        wheelTo(wh, f, false); magnify(wh); try { f.focus({ preventScroll: true }); } catch (er) {} };
    }
    var pin = null;
    if (o.pin !== false) {
      pin = document.createElement("button"); pin.type = "button"; pin.className = "sr-pin"; pin.innerHTML = PIN; pin.setAttribute("aria-pressed", "false"); pin.setAttribute("aria-label", "Pin the ring: it stays open while you play"); pin.title = "Pin: keep the ring open";
      pin.onclick = function (e) { e.stopPropagation(); setPin(!(cur && cur.pinned)); };
      hub.appendChild(pin);
    }
    hub.appendChild(mid); hub.appendChild(grip); if (sw) hub.appendChild(sw);   // pin · name · grip, the switch a bump below
    if (upIt) { var up = document.createElement("button"); up.type = "button"; up.className = "sr-up" + (upIt._back ? " sr-back" : ""); up.innerHTML = upIt._back ? BACK : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 14l6-6 6 6"/></svg>';
      up.setAttribute("aria-label", upIt.aria || upIt.label || "Panel"); up.title = upIt.aria || upIt.label || "Panel";
      up.onclick = function (e) { e.stopPropagation(); if (e.detail > 0 && cur && performance.now() - cur.t0 < 350) return; if (upIt._back) { back(); return; } try { upIt.pick && upIt.pick(); } catch (er) { console.warn("[ring]", er); } if (!(cur && cur.pinned)) close("pick"); };
      hub.appendChild(up); }
    ring.appendChild(hub);
    function setPin(on) { if (!cur || cur.ring !== ring) return; cur.pinned = !!on; ring.classList.toggle("sr-pinned", cur.pinned); veil.style.display = cur.pinned ? "none" : "";
      if (pin) { pin.setAttribute("aria-pressed", String(cur.pinned)); pin.setAttribute("aria-label", cur.pinned ? "Unpin: the ring closes after a choice again" : "Pin the ring: it stays open while you play"); }
      try { o.onPin && o.onPin(cur.pinned); } catch (er) {} }
    /* THE WHOLE HUB MOVES THE RING (Dimitry, 25 Oct: "the active touch area for dragging the ring can really be anywhere
       except for the drop-down menu and the panel caret ... the pin ... including the name"): a drag that starts anywhere
       on the hub (grip, name, pin, the space between) moves the ring, kept on screen; the switch's list, the panel's caret
       and a value's slider keep their own drags. A tap is still a tap: the pointer is captured only once the finger has
       travelled 6 px, so the name's switch and the pin get their clicks, and the click that ends a drag is swallowed. */
    var NODRAG = ".sr-sw,.sr-up,.sr-list,.sr-val,.sr-ok,input,select,textarea";
    hub.addEventListener("pointerdown", function (e) {
      if (e.button > 0 || (e.target.closest && e.target.closest(NODRAG))) return;
      if (e.target.closest && e.target.closest(".sr-grip")) e.preventDefault();
      e.stopPropagation(); var sx = e.clientX, sy = e.clientY, ox = parseFloat(ring.style.left), oy = parseFloat(ring.style.top), id = e.pointerId; hub._moved = false;
      var mv = function (ev) { if (ev.pointerId !== id) return; var dx = ev.clientX - sx, dy = ev.clientY - sy; if (!hub._moved) { if (dx * dx + dy * dy < 36) return; hub._moved = true; ring.classList.add("sr-moving"); try { hub.setPointerCapture(id); } catch (er) {} }
        ev.preventDefault(); ring.style.left = clampX(ox + dx) + "px"; ring.style.top = clampY(oy + dy) + "px"; };
      var up = function (ev) { if (ev.pointerId !== id) return; removeEventListener("pointermove", mv, true); removeEventListener("pointerup", up, true); removeEventListener("pointercancel", up, true); ring.classList.remove("sr-moving");
        if (hub._moved) setTimeout(function () { hub._moved = false; }, 300); };
      addEventListener("pointermove", mv, true); addEventListener("pointerup", up, true); addEventListener("pointercancel", up, true); });
    /* SHRINK TO ITS MIDDLE (25 Oct 10:02: "if we double tap the menu itself, bring in its small buttons and just remain the round
       button where it's located … a performer could put a ring in a place and have it shrink when it's not needed"): a
       double-tap on the middle folds the dots in (sr-mini) and another brings them out; the pin and the two carets keep their
       own taps. */
    doubleTap(hub, function () { ring.classList.toggle("sr-mini"); var m = ring.classList.contains("sr-mini"); dots.forEach(function (d) { d.tabIndex = -1; d.setAttribute("aria-hidden", String(m)); }); hub.setAttribute("aria-label", m ? "Folded: double-tap to open the ring again" : ""); },
      { when: function (e) { return !(e.target && e.target.closest && e.target.closest(".sr-pin,.sr-sw,.sr-up,.sr-list,.sr-val,.sr-dial")); } });
    hub.addEventListener("click", function (e) { if (hub._moved) { e.stopPropagation(); e.preventDefault(); hub._moved = false; } }, true);   // the click that ends a drag is not a tap
    grip.addEventListener("keydown", function (e) { var k = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[e.key]; if (!k) return; e.preventDefault(); e.stopPropagation();
      ring.style.left = clampX(parseFloat(ring.style.left) + k[0]) + "px"; ring.style.top = clampY(parseFloat(ring.style.top) + k[1]) + "px"; });
    var dots = items.map(function (it, i) {
      var a = -Math.PI / 2 + (i / n) * Math.PI * 2, b = document.createElement("button");
      b.type = "button"; b.className = "sr-dot"; b.dataset.id = it.id || ""; b.style.setProperty("--i", String(i));
      b.setAttribute("role", it.kind === "check" ? "menuitemcheckbox" : it.kind === "go" ? "menuitem" : "menuitemradio");
      if (it.kind !== "go") b.setAttribute("aria-checked", String(!!it.on));
      b.setAttribute("aria-label", it.aria || it.label || it.id); if (it.aria) b.title = it.aria;
      b.innerHTML = (it.icon || "") + '<span class="sr-lab" aria-hidden="true"></span>'; b.querySelector(".sr-lab").textContent = it.label || "";
      if (it.more && it.kind === "radio") { b.classList.add("sr-pgd"); b.insertAdjacentHTML("beforeend", '<span class="sr-pg" aria-hidden="true"><i></i><i></i></span>'); }
      b._it = it; dress(b, it);
      b.style.setProperty("--x", (Math.cos(a) * R).toFixed(1) + "px"); b.style.setProperty("--y", (Math.sin(a) * R).toFixed(1) + "px");
      b.tabIndex = -1;
      if (it.kind === "value") { valueDot(b, it); ring.appendChild(b); return b; }
      b.addEventListener("click", function (e) { e.stopPropagation(); if (e.detail > 0 && cur && performance.now() - cur.t0 < 350) return;   /* the click that ends the opening tap lands where the dots start, in the middle: not a choice */
        var keep = !!it.stay, I = b._it || it;
        if (I.kind === "go" || I.stay) { b.classList.remove("sr-hit", "sr-roll"); void b.offsetWidth; b.classList.add("sr-hit"); if (I.roll) b.classList.add("sr-roll"); setTimeout(function () { b.classList.remove("sr-hit", "sr-roll"); }, 600); }
        if (I.ring) { var wasOn = b.getAttribute("aria-checked") === "true";
          if (I.kind === "check" && !wasOn) { try { I.pick && I.pick(); } catch (er) { console.warn("[ring]", er); } }   /* a door dot goes in; only a check that is off is turned on (a go dot's own pick, a file picker, is not run: review cb6b74d5e3 r-1) */
          if (I.kind === "check") b.setAttribute("aria-checked", "true"); dive(b, I); return; }
        /* TWO PAGES: the chosen dot, tapped again while the ring is on, turns its page */
        if (I.more && I.kind === "radio" && b.getAttribute("aria-checked") === "true" && !(PW && !PW.on())) {
          try { I.more.set(!I.more.on); } catch (er) { console.warn("[ring]", er); } refresh();
          /* (Dimitry, 25 Oct 08:51: tapped twice "the button disappears and then pops up again, so you don't really realize
             what has happened"): turning a page keeps the ring open, the dot bumps once, and its edge starts or stops
             moving with the sound, so the change shows where the finger is */
          b.classList.add("sr-tap"); setTimeout(function () { b.classList.remove("sr-tap"); }, 180); return; }
        if (it.kind === "check") b.setAttribute("aria-checked", String(b.getAttribute("aria-checked") !== "true")); else if (it.kind !== "go") dots.forEach(function (x) { if (x.getAttribute("role") === "menuitemradio") x.setAttribute("aria-checked", String(x === b)); });
        try { I.pick && I.pick(); } catch (er) { console.warn("[ring]", er); }
        if (PW || I.more) refresh();
        if (cur && cur.pinned) { b.classList.add("sr-tap"); setTimeout(function () { b.classList.remove("sr-tap"); }, 180); return; }
        if (!(keep && cur)) close("pick", b, it.kind === "go" ? 0 : 650); });   /* a switch lingers lit (or unlit) so its new state shows (Dimitry, 25 Oct 00:25: "you don't really know if you've actually triggered the button") */
      ring.appendChild(b); return b;
    });
    /* DOTS THAT ARE RINGS: the dot swells into the middle, the others fold, then its ring blooms from there */
    function dive(b, I) {
      var x0 = parseFloat(ring.style.left), y0 = parseFloat(ring.style.top), pn = !!(cur && cur.pinned);
      var sub = typeof I.ring === "string" ? { ring: I.ring } : { ring: null, title: I.ring.title || I.label, icon: I.ring.icon || I.icon, items: I.ring.items };
      if (rid && I.id && !PAR) remember(o.key, rid + ">" + I.id);   /* only a top ring's dot (r-2) */   /* the next double tap comes back here (Dimitry, 27 Oct 07:51) */
      var go = function () { open(Object.assign({ key: o.key, hub: o.hub, pin: o.pin, onClose: o.onClose, onPin: o.onPin, dot: o.dot }, sub,
        { _own: true, x: x0, y: y0, pinned: pn, center: "ball", _parent: { o: rid ? Object.assign({}, o, { ring: rid }) : o, title: def.menu || def.title || "" } })); };   /* the parent named: back reopens exactly the ring it came from (review 7299ef1f9e r-1) */
      if (calm()) { go(); return; }
      ring.classList.remove("pop"); void ring.offsetWidth; ring.classList.add("sr-diving");
      var k = 0; dots.forEach(function (d) { if (d !== b) { d.style.setProperty("--fd", (k++ * 30) + "ms"); d.classList.add("sr-fold2"); } });
      b.classList.add("sr-dive"); setTimeout(go, 430); }
    /* each dot's state from its item: chosen, its page, live; the centre's switch */
    function dress(b, it) {
      if (it.kind !== "go" && it.kind !== "value") b.setAttribute("aria-checked", String(!!it.on));
      /* a label or icon that follows the state (still / move) follows it here too */
      var lb = b.querySelector(".sr-lab"); if (lb && it.label != null && lb.textContent !== it.label) lb.textContent = it.label;
      if (it.icon && b._ic !== it.icon) { if (b._ic != null) { var sv = b.querySelector("svg:not(.sr-pg svg)"); if (sv) { var t = document.createElement("span"); t.innerHTML = it.icon; if (t.firstElementChild) sv.replaceWith(t.firstElementChild); } } b._ic = it.icon; }
      if (it.aria && !it.more) b.setAttribute("aria-label", it.aria);
      var p2 = !!(it.more && it.more.on); b.classList.toggle("sr-p2", p2); b.classList.toggle("sr-live", !!it.live || (p2 && !!it.on));
      /* a dot's own level (review 7fb3afe3e2 r-1: the Input ring's mic level made the camera's dot pump with the mic) */
      if (typeof it.level === "function" && !b._lvt) { b.classList.add("sr-lvd"); var dl = 0; b._lvt = function () { if (!b.isConnected) return; var v = 0; try { v = Math.max(0, Math.min(1, +it.level() || 0)); } catch (e) {} dl += (v - dl) * (v > dl ? .6 : .18); b.style.setProperty("--lv", dl.toFixed(3)); requestAnimationFrame(b._lvt); }; requestAnimationFrame(b._lvt); }
      if (it.more) b.setAttribute("aria-label", (it.aria || it.label || it.id) + (it.on ? (p2 ? ". Its second page is on: " : ". Tap again for its second page: ") + (it.more.aria || "") : ""));
    }
    function refresh() {
      /* the set of dots can change while a ring is open (the camera comes on after its ring has opened, a source is removed):
         then the ring opens again in place, quietly, with the new set (review cb6b74d5e3 r-2) */
      try { var ids = (typeof def.items === "function" ? def.items() : def.items || []).filter(Boolean).filter(function (x) { return !(x.at === "top" && x.kind === "go"); }).map(function (x) { return x.id || ""; }).sort().join("|");
        var have = dots.map(function (b) { return b.dataset.id; }).sort().join("|");
        if (ids !== have && cur && cur.ring === ring && !ring.querySelector(".sr-list,.sr-dial,.sr-val,.sr-busy") && !ring.classList.contains("sr-diving") && !ring.classList.contains("sr-mini") && performance.now() - REOPEN > 300) {
          REOPEN = performance.now();   /* at most one quiet reopen per 300 ms: a ring whose ids differ on every call must not rebuild itself without end (review 7adcb0b543 r-2) */
          if (!ids) { close("api"); return; }
          open(Object.assign({}, o, { _own: true, _quiet: true, x: parseFloat(ring.style.left), y: parseFloat(ring.style.top), pinned: !!cur.pinned })); return; } } catch (er) {}
      if (!cur || cur.ring !== ring) return;
      if (rid || def.items) { var fresh = (typeof def.items === "function" ? def.items() : def.items || []).filter(Boolean);
        dots.forEach(function (b) { var f = fresh.filter(function (x) { return (x.id || "") === b.dataset.id; })[0]; if (f && f.kind !== "value") { b._it = f; dress(b, f); } else if (b._arc) b._arc(); }); }
      if (pow) { var on = !!PW.on(); pow.setAttribute("aria-pressed", String(on)); ring.classList.toggle("sr-off", !on);
        if (def.iconOff && pow.classList.contains("sr-ic")) { var want = on ? def.icon : def.iconOff; if (pow._ic !== want) { var sv = pow.querySelector("svg"), t = document.createElement("span"); t.innerHTML = want; if (sv && t.firstElementChild) sv.replaceWith(t.firstElementChild); pow._ic = want; } }   // a switch that looks off when off: the speaker with its cross
        pow.setAttribute("aria-label", (def.title || "Ring") + (on ? ": on. Tap to turn it off" : ": off. Tap to turn it on, or choose any dot")); pow.title = on ? "On: tap to turn off" : "Off: tap to turn on"; }
    }
    /* a value dot: drag across it (left to right, or down to up) and its number shows inside; a tap hands the hub its slider */
    function valueDot(b, it) {
      var mn = it.min == null ? 0 : it.min, mx = it.max == null ? 100 : it.max, st = it.step || 1, fmt = it.fmt || function (v) { return String(Math.round(v)); };
      var clampV = function (v) { return Math.max(mn, Math.min(mx, Math.round(v / st) * st)); }, icon = b.innerHTML, g = null, fr = function (v) { return (v - mn) / ((mx - mn) || 1); };
      b.setAttribute("role", "menuitem"); b.style.touchAction = "none";
      /* at rest: the icon, its level round the edge; dragged: the number inside, the level still round the edge */
      var idle = function () { var x = false, l = false; try { x = !!(it.idle && it.idle()); l = it.lit ? it.lit() : false; } catch (e) {} b.classList.toggle("sr-idle", x); b.classList.toggle("sr-lit", l === true); b.classList.toggle("sr-dark", l === "dark"); };   // lit: true (heard), "dark" (playing, muted), false
      var bgc = null; if (typeof it.bg === "function") { bgc = document.createElement("canvas"); bgc.className = "sr-bg"; bgc.setAttribute("aria-hidden", "true");
        var paintBg = function () { if (!b.isConnected) return; if (bgc.parentNode !== b) b.insertBefore(bgc, b.firstChild); try { it.bg(bgc, b.classList.contains("sr-lit")); } catch (e) {} requestAnimationFrame(paintBg); }; requestAnimationFrame(paintBg); }   // the amount is set but not heard: its arc dims
      /* iconOff: what the dot shows while idle (the speaker crossed out when nothing can be heard, 25 Oct 09:45) */
      var rest = function () { var v = +it.get(); idle(); b._icx = b.classList.contains("sr-idle") && it.iconOff ? 1 : 0; b.innerHTML = (b._icx ? it.iconOff : icon) + ARC(fr(v), 24); b.setAttribute("aria-label", (it.aria || it.label || it.id) + ": " + fmt(v) + ". Drag up or down to change; tap to see it"); };
      var show = function (v) { b.innerHTML = '<span class="sr-num">' + fmt(v) + '</span><span class="sr-lab" aria-hidden="true"></span>' + ARC(fr(v), 24); b.querySelector(".sr-lab").textContent = it.label || ""; };
      /* a tap shows the amount in the dot for a moment; the middle no longer turns into a dial (Dimitry, 25 Oct 09:30: "a big
         dial on the middle button … I don't think it's necessary now that we have the side buttons … it lingers from the
         last thing pressed and creates sync issues"). dial() stays in the file for a tool that asks for it. */
      var pk = 0, peek = function () { clearTimeout(pk); show(+it.get()); pk = setTimeout(function () { if (!g) rest(); }, 1100); };
      rest(); b._arc = function () { idle(); if (g || b.classList.contains("sr-busy")) return; if ((b.classList.contains("sr-idle") && it.iconOff ? 1 : 0) !== b._icx) { rest(); return; } var v = +it.get(), c = b.querySelector(".sr-arc .v"); if (!c) return; var f = Math.max(0, Math.min(1, fr(v))), L = 2 * Math.PI * 24;   // only the arc moves: rebuilding the dot would replay its label
        c.setAttribute("stroke-dasharray", (f * L).toFixed(1) + " " + L.toFixed(1)); c.style.display = f ? "" : "none"; };
      /* the finger may leave the dot: the dot keeps the drag (pointer capture) until it lifts; up raises, down lowers */
      b.addEventListener("pointerdown", function (e) { e.stopPropagation(); if (performance.now() - (cur ? cur.t0 : 0) < 350) return;
        /* (Dimitry, 25 Oct 09:34: "I can adjust the volume, but there's still no sound playing … tapping it needs to activate it
           before you can adjust the volume"): an idle amount with a wake turns its sound on first; the next touch sets it */
        var asleep = false; try { asleep = !!(it.idle && it.idle() && it.wake); } catch (er) {}
        if (asleep) { g = null; b.classList.remove("sr-hit"); void b.offsetWidth; b.classList.add("sr-hit"); setTimeout(function () { b.classList.remove("sr-hit"); }, 600); try { it.wake(); } catch (er) { console.warn("[ring]", er); } b._woke = performance.now(); return; }
        try { b.setPointerCapture(e.pointerId); } catch (er) {} g = { x: e.clientX, y: e.clientY, v: +it.get(), moved: false }; });
      b.addEventListener("pointermove", function (e) { if (!g) return; var dd = (e.clientX - g.x) * .35 - (e.clientY - g.y); if (!g.moved && Math.abs(dd) < 6) return; g.moved = true; b.classList.add("sr-busy");
        var v = clampV(g.v + dd * (mx - mn) / 200); it.set(v); show(v); });
      var end = function () { if (!g) return; var m = g.moved; g = null; if (m) { setTimeout(function () { b.classList.remove("sr-busy"); rest(); }, 700); } else { b.classList.remove("sr-busy"); peek(); } };
      b.addEventListener("pointerup", end); b.addEventListener("pointercancel", function () { g = null; b.classList.remove("sr-busy"); rest(); });
      b.addEventListener("click", function (e) { e.stopPropagation(); if (b._woke && performance.now() - b._woke < 800) return; if (e.detail === 0) peek(); });
    }
    /* THE DIAL: the middle turns into the value's knob, its level round its edge, the number inside. Drag up or down
       anywhere (the dial keeps the finger), arrows step, a tap without a drag (or Enter, Esc) gives the middle back */
    function dial(it, fmt, clampV, fr, from) {
      ring.querySelectorAll(".sr-dial").forEach(function (x) { x.remove(); });
      var d = document.createElement("div"), st = it.step || 1, mn = it.min == null ? 0 : it.min, mx = it.max == null ? 100 : it.max, g = null;
      d.className = "sr-dial"; d.tabIndex = 0; d.setAttribute("role", "slider"); d.setAttribute("aria-label", it.aria || it.label || "value"); d.setAttribute("aria-valuemin", mn); d.setAttribute("aria-valuemax", mx);
      var paint = function () { var v = +it.get(); d.innerHTML = ARC(fr(v), 38) + '<span class="dv"><small></small><b></b></span>'; d.querySelector("small").textContent = it.label || ""; d.querySelector("b").textContent = fmt(v); d.setAttribute("aria-valuenow", v); d.setAttribute("aria-valuetext", fmt(v)); };
      var set = function (v) { it.set(clampV(v)); paint(); if (from && from._arc) from._arc(); };
      var back = function () { d.remove(); ring.classList.remove("sr-dialing"); try { from.focus({ preventScroll: true }); } catch (er) {} };
      d.addEventListener("pointerdown", function (e) { e.stopPropagation(); try { d.setPointerCapture(e.pointerId); } catch (er) {} g = { y: e.clientY, x: e.clientX, v: +it.get(), moved: false }; });
      d.addEventListener("pointermove", function (e) { if (!g) return; var dd = (e.clientX - g.x) * .35 - (e.clientY - g.y); if (!g.moved && Math.abs(dd) < 5) return; g.moved = true; set(g.v + dd * (mx - mn) / 200); });
      d.addEventListener("pointerup", function (e) { e.stopPropagation(); if (!g) return; var m = g.moved; g = null; if (!m) back(); });
      d.addEventListener("pointercancel", function () { g = null; });
      d.addEventListener("click", function (e) { e.stopPropagation(); });
      d.addEventListener("keydown", function (e) { var k = e.key, v = +it.get(), big = Math.max(st, (mx - mn) / 10);
        if (k === "ArrowUp" || k === "ArrowRight") set(v + st); else if (k === "ArrowDown" || k === "ArrowLeft") set(v - st); else if (k === "PageUp") set(v + big); else if (k === "PageDown") set(v - big);
        else if (k === "Home") set(mn); else if (k === "End") set(mx); else if (k === "Enter" || k === "Escape" || k === " ") back(); else return;
        e.preventDefault(); e.stopPropagation(); });
      paint(); ring.classList.add("sr-dialing"); ring.appendChild(d); try { d.focus({ preventScroll: true }); } catch (er) {}
    }
    /* the hub becomes the value's slider; the tick (or Esc) gives the name back */
    function slider(it, fmt, clampV) {
      var nm = hub.querySelector(".sr-mid") || hub.querySelector(".sr-name"), old = null; hub.querySelectorAll(".sr-val,.sr-ok").forEach(function (x) { x.remove(); });   /* one slider, one tick: each tap on the dot used to add a tick (25 Oct) */
      var v = document.createElement("label"); v.className = "sr-val"; var t = document.createElement("span"); t.textContent = it.label || ""; var bb = document.createElement("b");
      var r = document.createElement("input"); r.type = "range"; r.min = it.min == null ? 0 : it.min; r.max = it.max == null ? 100 : it.max; r.step = it.step || 1; r.value = it.get(); r.setAttribute("aria-label", it.aria || it.label || "value");
      var ok = document.createElement("button"); ok.type = "button"; ok.className = "sr-ok"; ok.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'; ok.setAttribute("aria-label", "Done");
      var paint = function () { bb.textContent = fmt(+r.value); }; paint();
      r.oninput = function () { it.set(clampV(+r.value)); paint(); };
      var back = function () { v.remove(); ok.remove(); nm.hidden = false; hub.style.left = ""; try { (dots.filter(function (x) { return x.dataset.id === (it.id || ""); })[0] || dots[0]).focus(); } catch (er) {} };
      ok.onclick = function (e) { e.stopPropagation(); back(); }; r.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); back(); } });
      v.append(t, r, bb); nm.hidden = true; nm.after(v, ok); keepOn(); try { r.focus(); } catch (er) {}
    }
    /* the widened middle stays on screen: it slides along, the dots stay where they are */
    function keepOn() {
      hub.style.left = ""; var h = hub.getBoundingClientRect(), vw = document.documentElement.clientWidth || innerWidth, m = 6, dx = 0;
      if (h.left < m) dx = m - h.left; else if (h.right > vw - m) dx = vw - m - h.right;
      if (dx) hub.style.left = Math.round(dx) + "px";
    }
    var stop = function (e) { e.stopPropagation(); e.preventDefault(); };
    veil.addEventListener("pointerdown", function (e) { stop(e); if (cur && performance.now() - cur.t0 < 250) return; close("outside"); });
    ["pointerup", "click", "touchstart", "touchend"].forEach(function (t) { veil.addEventListener(t, stop, { passive: false }); });
    var key = function (e) {
      if (PAR && e.key === "Escape" && !ring.querySelector(".sr-list,.sr-dial,.sr-val")) { e.preventDefault(); e.stopPropagation(); back(); return; }   /* Escape in a ring reached through a dot goes back up one (review cb6b74d5e3 r-5) */
      if (!cur) return; if (cur.pinned && !ring.contains(document.activeElement)) { if (e.key === "Escape") { stop(e); close("esc"); } return; }   // pinned, the app keeps its keys but Esc
      var L = ring.querySelector(".sr-list"); if (L && L.contains(document.activeElement)) { if (e.key === "Escape") { stop(e); L.remove(); try { sw.focus(); } catch (er) {} }
        else if (/^(ArrowUp|ArrowDown|Home|End)$/.test(e.key)) { stop(e); var bs = Array.prototype.slice.call(L.querySelectorAll("button")), k = bs.indexOf(document.activeElement);
          k = e.key === "Home" ? 0 : e.key === "End" ? bs.length - 1 : Math.max(0, Math.min(bs.length - 1, k + (e.key === "ArrowDown" ? 1 : -1))); try { bs[k].focus({ preventScroll: true }); } catch (er) {} }
        return; }
      if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("sr-dial")) return;   // the dial keeps its keys
      var ae = document.activeElement; if (ae && ae.type === "range" && ring.contains(ae)) { if (e.key === "Escape") { stop(e); var okb = hub.querySelector(".sr-val + button"); if (okb) okb.click(); } return; }   // the slider keeps its arrows
      var i = dots.indexOf(document.activeElement);
      if (e.key === "Escape") { stop(e); close("esc"); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { if (document.activeElement === grip) return; stop(e); dots[(i + 1 + n) % n].focus(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { if (document.activeElement === grip) return; stop(e); dots[(i - 1 + n) % n].focus(); }
      else if (e.key === "Home") { stop(e); dots[0].focus(); } else if (e.key === "End") { stop(e); dots[n - 1].focus(); }
    };
    document.addEventListener("keydown", key, true);
    document.body.append(veil, ring);
    cur = { o: o, veil: veil, ring: ring, key: key, back: o.back || document.activeElement, t0: performance.now(), id: rid, pinned: false };
    if (o.pinned) setPin(true);
    refresh();
    /* LABELS: learn holds them longer for the first five opens, then briefly; never lets them go at once */
    var lm = labels(), hold = lm === "never" ? 0 : seen(true) < 5 ? 1700 : 650;
    if (lm !== "always") setTimeout(function () { if (ring.isConnected) ring.classList.add("sr-labfade"); }, calm() ? hold : hold + (lm === "never" ? 0 : 420));
    /* IN STEP WITH THE BAR (Dimitry, 25 Oct 08:06: "coordinate any ring indicators with the matching indicators on the bar
       and anywhere else"): while the ring is open (pinned, above all) each dot re-reads its item, so a change made on the
       bar, a key or a shelf shows here at once. SurfaceRing.refresh() does it on demand. */
    var syncT = setInterval(function () { if (!ring.isConnected) { clearInterval(syncT); return; } try { refresh(); } catch (e) {} }, 400);
    ring._refresh = refresh;
    /* THE PULSE with a level: the live dots follow it while the ring is open */
    if (typeof LV === "function") { ring.classList.add("sr-lv"); var lv = 0, tick = function () { if (!ring.isConnected) return; var v = 0; try { v = Math.max(0, Math.min(1, +LV() || 0)); } catch (e) {} lv += (v - lv) * (v > lv ? .6 : .18); /* up fast with a hit, down slower: a pump, not a flicker */ ring.style.setProperty("--lv", lv.toFixed(3)); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    if (!o._quiet) requestAnimationFrame(function () { var f = dots.filter(function (b) { return b.getAttribute("aria-checked") === "true"; })[0] || dots[0]; try { f.focus({ preventScroll: true }); } catch (e) {} });
    return { close: function () { close("api"); }, el: ring, ring: rid };
  }
  /* a one-finger double-tap: two quick taps near each other, no drag between (the stage's own drag still pushes) */
  /* a level as an arc (hoisted: the dots are built before the code that follows them) */
  function ARC(f, r) { var c = 2 * Math.PI * r; f = Math.max(0, Math.min(1, f || 0)); return '<svg class="sr-arc" viewBox="0 0 ' + (2 * r + 6) + ' ' + (2 * r + 6) + '" aria-hidden="true"><circle class="t" cx="' + (r + 3) + '" cy="' + (r + 3) + '" r="' + r + '"/><circle class="v" cx="' + (r + 3) + '" cy="' + (r + 3) + '" r="' + r + '" stroke-dasharray="' + (f * c).toFixed(1) + ' ' + c.toFixed(1) + '"' + (f ? "" : ' style="display:none"') + '/></svg>'; }
  function doubleTap(el, fn, o) {
    o = o || {}; var ms = o.ms || 380, px = o.px || 44, lastT = null, down = null, fired = -1e9;
    /* THE PENCIL (Dimitry, 25 Oct 08:24: "double tapping with a pencil should also trigger the ring; right now only my finger
       does"): a pen's tap rests longer and lands further off than a finger's, so it gets more room; and Safari may hand a
       Pencil tap over as touches (touchType "stylus") without the pointer pair, so those count too. One gesture opens once. */
    var fire = function (x, y, e) { var t = performance.now(); if (t - fired < 500) return; fired = t; fn(x, y, e); };
    var sl = { t: null };
    el.addEventListener("touchend", function (e) { var c = e.changedTouches && e.changedTouches[0]; if (!c || c.touchType !== "stylus" || e.touches.length) return;
      var now = e.timeStamp || performance.now();
      if (sl.t && now - sl.t.t < 500 && Math.hypot(c.clientX - sl.t.x, c.clientY - sl.t.y) < 60) { sl.t = null; if (o.when && !o.when(e)) return; fire(c.clientX, c.clientY, e); return; }
      sl.t = { x: c.clientX, y: c.clientY, t: now }; }, { capture: true, passive: true });
    /* times are the events' own (e.timeStamp: when the finger touched), not when a busy page got round to them */
    var ts = function (e) { return e.timeStamp || performance.now(); };
    el.addEventListener("pointerdown", function (e) { if (e.button > 0 || !e.isPrimary) { down = null; return; } down = { x: e.clientX, y: e.clientY, t: ts(e), id: e.pointerId }; }, true);
    el.addEventListener("pointerup", function (e) {
      if (!down || e.pointerId !== down.id) return; var d = down; down = null;
      var pen = e.pointerType === "pen";
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > (pen ? 24 : 14) || ts(e) - d.t > (pen ? 450 : 280)) { lastT = null; return; }   // a drag or a hold is not a tap
      /* (25 Oct, Dimitry: "I would tap faster than it's expecting, so I have to slow down"): a quick thumb lands its
         second tap further off and rolls a little, so 380 ms, 44 px apart and 14 px of roll still make a double-tap */
      var now = ts(e);
      if (lastT && now - lastT.t < (pen ? Math.max(ms, 500) : ms) && Math.hypot(e.clientX - lastT.x, e.clientY - lastT.y) < (pen ? Math.max(px, 60) : px)) { lastT = null; if (o.when && !o.when(e)) return; fire(e.clientX, e.clientY, e); return; }
      lastT = { x: e.clientX, y: e.clientY, t: now };
    }, true);
    el.addEventListener("pointercancel", function () { down = null; }, true);
  }
  /* FIXED PLACES (Dimitry, 25 Oct 01:01: "the panel button with the upwards arrow at the top of the ring, just like the
     previous and next arrows at the bottom left and right … that should be convention"). An item may ask for a place:
     at: "top" (the way up to a panel), "bottom-left" (back), "bottom-right" (next). The rest keep their order round the
     ring. Dots start at the top and go clockwise, so bottom-right is the slot nearest 4:30 and bottom-left nearest 7:30. */
  function place(items) {
    var n = items.length, slot = { top: 0, "bottom-right": Math.round(n * 135 / 360) % n, "bottom-left": Math.round(n * 225 / 360) % n };
    if (slot["bottom-left"] === slot["bottom-right"]) slot["bottom-left"] = (slot["bottom-right"] + 1) % n;
    var out = new Array(n), rest = [];
    items.forEach(function (it) { var k = it.at && slot[it.at]; if (k != null && !out[k]) out[k] = it; else rest.push(it); });
    for (var i = 0; i < n; i++) if (!out[i]) out[i] = rest.shift();
    return out;
  }
  function flashPin() { if (!cur) return; var p = cur.ring.querySelector(".sr-pin"); if (!p) return; p.classList.remove("sr-flash"); void p.offsetWidth; p.classList.add("sr-flash"); setTimeout(function () { p.classList.remove("sr-flash"); }, 900); }
  window.SurfaceRing = { refresh: function () { try { cur && cur.ring && cur.ring._refresh && cur.ring._refresh(); } catch (e) {} }, labels: labels, pinned: function () { return !!(cur && cur.pinned); }, open: open, define: define, last: last, MARK: MARK, close: function () { close("api"); }, isOpen: function () { return !!cur; }, current: function () { return cur && cur.id; }, doubleTap: doubleTap };
})();
