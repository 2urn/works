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

     SurfaceRing.define(id, { title, items: () => [ … ], power, level })   // items as below, built fresh each time it opens
     var R = SurfaceRing.open({ x, y,                                // client px: where it centres
       rings: ['touch', 'play'], ring: 'touch', key: 'current',      // defined rings to switch between; which; where the last is kept
       hub: 'label' | 'mark',                                        // the name as a word, or as the ring's mark (aria keeps the name)
       title, items,                                                 // or a one-off ring without define()
       items may carry at: "top" | "bottom-left" | "bottom-right" (the panel up top, back and next below),
       center: "bar" | "ball" (the middle as a bar, the default, or a round button like the bar button the ring came from;
       with define({icon}) the ball shows that icon over a small name), per ring in define, or per open,
       pin: true (the pin; false hides it), pinned: false (open pinned),
       power: { on: () => bool, set: (v) => {} },                   // the name is the ring's switch (see THE CENTRE below)
       level: () => 0..1,                                            // what a live dot pulses with (a sound's level); none: it breathes
       onClose: (why) => {}, onSwitch: (id) => {}, onPin: (on) => {} })
     items: [{ id, icon: '<svg…>', label: 'push', aria: 'Push: …', on: bool, kind: 'radio'|'check'|'go', stay: bool, pick: () => {},
              live: bool,                                            // playing: its edge pulses (THE PULSE)
              more: { on: bool, set: (v) => {}, aria } }]            // a second page on a radio dot (TWO PAGES)
     a value: { id, kind: 'value', icon, label, aria, get: () => n, set: (n) => {}, min: 0, max: 100, step: 1, fmt: n => '50%' }
       (Dimitry, 24 Oct 20:15: "where you drag and a number changes, that number could happen inside the button that you
       pressed, or it could take over the name of the ring … like a 0 to 100 slider"): drag across the dot and the number
       shows inside it; tap it and the ring's name becomes that value's slider, with a tick to come back.
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

   Plain script, window.SurfaceRing, no dependencies. Loads its own styles; a tool's rules win (:where). */
(function () {
  "use strict";
  if (window.SurfaceRing) return;
  var MARK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="4.6" r="2"/><circle cx="18.4" cy="8.3" r="2"/><circle cx="18.4" cy="15.7" r="2"/><circle cx="12" cy="19.4" r="2"/><circle cx="5.6" cy="15.7" r="2"/><circle cx="5.6" cy="8.3" r="2"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>';
  var GRIP = '<svg viewBox="0 0 6 20" aria-hidden="true" focusable="false"><circle cx="1.5" cy="5" r="1.1"/><circle cx="1.5" cy="10" r="1.1"/><circle cx="1.5" cy="15" r="1.1"/><circle cx="4.5" cy="5" r="1.1"/><circle cx="4.5" cy="10" r="1.1"/><circle cx="4.5" cy="15" r="1.1"/></svg>';
  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 3.5h6l-1 5 3 3.5H7l3-3.5z"/><path d="M12 12v8.5"/></svg>';
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
    /* THE CENTRE: the name as the ring's switch, a point before the word, lit or hollow */
    ":where(.sr-hub) .sr-pow{display:flex;align-items:center;gap:7px;height:30px;padding:0 10px 0 9px;font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.16em;text-transform:uppercase}" +
    ":where(.sr-hub) .sr-pow i{flex:none;width:8px;height:8px;border-radius:50%;box-shadow:inset 0 0 0 1.5px currentColor;opacity:.7}" +
    ":where(.sr-hub) .sr-pow[aria-pressed=true] i{background:var(--acc,#55b8c9);box-shadow:0 0 6px var(--acc,#55b8c9);opacity:1}" +
    ".sr-ring.sr-off .sr-dot{opacity:.45}.sr-ring.sr-off .sr-dot:hover,.sr-ring.sr-off .sr-dot:focus-visible{opacity:.8}" +
    /* TWO PAGES: two points in a tab on the chosen dot's bottom edge */
    ":where(.sr-pg){position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);display:none;gap:4px;padding:3px 5px;border-radius:999px;background:rgb(var(--ui-g,12 14 16) / .94);box-shadow:0 0 0 1px rgb(var(--ui-hi,255 255 255) / .18);pointer-events:none}" +
    ":where(.sr-pg) i{width:5px;height:5px;border-radius:50%;background:var(--ui-ink,#eef1f2);opacity:.35}" +
    ".sr-dot[aria-checked=true] .sr-pg{display:flex}.sr-dot .sr-pg i:first-child,.sr-dot.sr-p2 .sr-pg i:last-child{opacity:1}.sr-dot.sr-p2 .sr-pg i:first-child{opacity:.35}" +
    ".sr-dot.sr-pgd .sr-lab{top:calc(100% + 9px)}" +
    /* THE PULSE: a live dot's edge breathes, or follows the level it was given */
    "@keyframes srLive{0%,100%{box-shadow:0 0 0 2px rgb(255 255 255 / .5),0 0 0 3px var(--acc,#55b8c9),0 6px 20px rgb(0 0 0 / .35)}50%{box-shadow:0 0 0 2px rgb(255 255 255 / .5),0 0 0 9px rgb(var(--acc-rgb,85 184 201) / .28),0 6px 20px rgb(0 0 0 / .35)}}" +
    ".sr-ring .sr-dot.sr-live{animation:srLive 1.4s ease-in-out infinite}" +
    ".sr-ring.sr-lv .sr-dot.sr-live{animation:none;box-shadow:0 0 0 2px rgb(255 255 255 / .5),0 0 0 calc(3px + var(--lv,0) * 9px) rgb(var(--acc-rgb,85 184 201) / calc(.75 - var(--lv,0) * .45)),0 6px 20px rgb(0 0 0 / .35)}" +
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
    ":where(.sr-list){position:absolute;left:0;top:38px;transform:translateX(-50%);display:flex;flex-direction:column;gap:4px;padding:4px;border-radius:16px;background:rgb(var(--ui-g,12 14 16) / .94);box-shadow:0 0 0 1px rgb(var(--ui-hi,255 255 255) / .14),0 10px 30px rgb(0 0 0 / .4);pointer-events:auto;z-index:2}" +
    ":where(.sr-list) button{min-height:40px;padding:0 16px;border:0;border-radius:12px;background:none;color:var(--ui-ink,#eef1f2);font:600 10.5px/1 var(--mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;text-align:left;cursor:pointer;white-space:nowrap}" +
    ":where(.sr-list) button[aria-checked=true]{background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c)}" +
    ":where(.sr-dot){position:absolute;left:0;top:0;width:var(--sr-d,52px);height:var(--sr-d,52px);margin:calc(var(--sr-d,52px) / -2) 0 0 calc(var(--sr-d,52px) / -2);padding:0;border:0;border-radius:50%;display:grid;place-items:center;background:rgb(var(--ui-g,12 14 16) / .86);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--ui-ink,#eef1f2);box-shadow:0 0 0 1px rgb(var(--ui-hi,255 255 255) / .16),0 6px 20px rgb(0 0 0 / .35);cursor:pointer;pointer-events:auto;transform:translate(var(--x),var(--y));-webkit-tap-highlight-color:transparent}" +
    ":where(.sr-dot) svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
    ":where(.sr-dot)[aria-checked=true]{background:var(--acc,#55b8c9);color:var(--acc-ink,#04181c);box-shadow:0 0 0 2px rgb(255 255 255 / .5),0 6px 20px rgb(0 0 0 / .35)}" +
    ":where(.sr-dot):focus-visible{outline:2px solid #fff;outline-offset:3px}" +
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
    ".sr-ring .sr-hub.sr-ball{transition:width .2s cubic-bezier(.4,0,.2,1),padding .2s,gap .2s;overflow:hidden;gap:0}" +
    ".sr-ring .sr-hub.sr-ball>*{transition:opacity .12s ease-in;opacity:0}" +
    ".sr-ring .sr-hub.sr-ball.sr-gone{transition:transform .2s cubic-bezier(.5,0,.75,0),opacity .2s ease-in;transform:translate(-50%,-50%) scale(.2)}" +
    "@media (prefers-reduced-motion:reduce){.sr-ring .sr-dot.sr-live{animation:none;box-shadow:0 0 0 2px rgb(255 255 255 / .5),0 0 0 5px var(--acc,#55b8c9),0 6px 20px rgb(0 0 0 / .35)}.sr-ring.pop .sr-dot,.sr-ring.pop .sr-dot svg,.sr-ring.pop .sr-lab,.sr-ring.pop .sr-hub{animation:none}.sr-ring .sr-dot.sr-fold,.sr-ring .sr-dot.sr-chosen,.sr-ring .sr-hub.sr-gone{transition:none}}";
  function css() { if (document.getElementById("sring-css")) return; var st = document.createElement("style"); st.id = "sring-css"; st.textContent = CSS; (document.head || document.documentElement).prepend(st); }
  var RINGS = {}, cur = null;
  var calm = function () { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  var lastKey = function (k) { return "surface.ring.last." + (k || "tool"); };
  function last(k) { try { return localStorage.getItem(lastKey(k)) || null; } catch (e) { return null; } }
  function remember(k, id) { try { localStorage.setItem(lastKey(k), id); } catch (e) {} }
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
    else if (calm() || why === "again" || !c.ring.isConnected) gone();
    else {
      c.ring.classList.remove("pop"); void c.ring.offsetWidth;   // settle without the opening animation first: a transition never starts from a style an animation was holding, so the petals blinked out instead of folding
      var dots = [].slice.call(c.ring.querySelectorAll(".sr-dot")), hub = c.ring.querySelector(".sr-hub"), list = c.ring.querySelector(".sr-list");
      if (list) list.remove();
      dots.forEach(function (d) { if (d !== chosen) d.classList.add("sr-fold"); });
      if (chosen) { chosen.classList.add("sr-chosen"); setTimeout(function () { chosen.classList.add("sr-home"); }, 220 + hold); setTimeout(function () { if (hub) hub.classList.add("sr-gone"); }, 400 + hold); setTimeout(gone, 600 + hold); }
      else {
        var k = dots.length, step = Math.max(34, Math.round(210 / Math.max(1, k)));   // a small ring (three dots) folds slower, so it still reads one petal at a time
        dots.forEach(function (d, i) { d.style.setProperty("--fd", (k - 1 - i) * step + "ms"); d.classList.remove("sr-fold"); d.classList.add("sr-fold1"); });
        var t1 = Math.max(0, (k - 2) * step);
        if (hub) {
          var hr = hub.getBoundingClientRect(); hub.style.boxSizing = "border-box"; hub.style.width = hr.width + "px"; void hub.offsetWidth;
          setTimeout(function () { hub.classList.add("sr-ball"); hub.style.width = hr.height + "px"; }, t1);
          setTimeout(function () { hub.classList.add("sr-gone"); }, t1 + 200);
        }
        setTimeout(gone, t1 + 420);
      }
    }
    try { if (c.back && c.back.focus && why !== "pick") c.back.focus({ preventScroll: true }); } catch (e) {}
    try { c.o.onClose && c.o.onClose(why); } catch (e) {}
  }
  function open(o) {
    css(); close("again"); o = o || {};
    var rings = (o.rings || []).filter(function (id) { return RINGS[id]; });
    var rid = o.ring && RINGS[o.ring] ? o.ring : rings.length ? (rings.indexOf(last(o.key)) >= 0 ? last(o.key) : rings[0]) : null;
    var def = rid ? RINGS[rid] : { title: o.title, items: function () { return o.items || []; } };
    var items = (typeof def.items === "function" ? def.items() : def.items || []).filter(Boolean), n = items.length; if (!n) return null;
    var upIt = null; items = items.filter(function (it) { if (!upIt && it.at === "top" && it.kind === "go") { upIt = it; return false; } return true; }); n = items.length; if (!n && !upIt) return null;
    items = place(items); n = items.length;
    if (rid) remember(o.key, rid);
    var PW = def.power || (rid ? null : o.power) || null, LV = def.level || o.level || null;   // a defined ring brings its own switch and level
    var d = Math.max(44, o.dot || 52), gap = 10;
    /* the radius: the dots sit round the circle with a gap between them, room for each label, clear of the hub */
    /* tighter (Dimitry, 25 Oct 08:06: "as long as there's space between the top button and the middle, that gap could be
       fairly smaller … so the ring in general can be quite a bit tighter"): the ball is 88, the top dot's word just clears it */
    var R = Math.max(o.r || 0, (def.center || o.center) === "ball" ? 90 : 92, (n * (d + gap + 8)) / (2 * Math.PI));
    var lab = 14, pad = R + d / 2 + lab + 8, W = innerWidth, H = innerHeight;
    var clampX = function (v) { return Math.max(pad, Math.min(W - pad, v)); }, clampY = function (v) { return Math.max(pad, Math.min(H - pad, v)); };
    var x = clampX(o.x == null ? W / 2 : o.x), y = clampY(o.y == null ? H / 2 : o.y);
    var veil = document.createElement("div"); veil.className = "sr-veil";
    var ring = document.createElement("div"); ring.className = "sr-ring" + (calm() ? "" : " pop"); ring.setAttribute("role", "menu"); ring.setAttribute("aria-label", def.title || "Choices");
    ring.style.left = x + "px"; ring.style.top = y + "px"; ring.style.setProperty("--sr-d", d + "px");
    /* the hub: pin · name · grip; the panel a bump above, the switch a bump below (or all four round a ball) */
    var BALL = (def.center || o.center) === "ball";
    var hub = document.createElement("div"); hub.className = "sr-hub" + (BALL ? " sr-round" : "");   // not sr-ball: that is the closing fold's class
    var grip = document.createElement("button"); grip.type = "button"; grip.className = "sr-grip"; grip.innerHTML = GRIP; grip.setAttribute("aria-label", "Move the ring (drag)"); grip.title = "Drag to move the ring";
    var name = document.createElement("span"), pow = null; name.className = "sr-name";
    if (PW) { pow = document.createElement("button"); pow.type = "button"; pow.className = "sr-pow"; pow.innerHTML = "<i></i><span></span>"; pow.lastChild.textContent = def.title || ""; name = pow;
      pow.onclick = function (e) { e.stopPropagation(); if (e.detail > 0 && cur && performance.now() - cur.t0 < 350) return;   /* the tap that opened the ring lands on the name, in the middle: not a switch (CLAUDE.md) */
        try { PW.set(!PW.on()); } catch (er) { console.warn("[ring]", er); } refresh(); }; }
    else if ((def.center || o.center) === "ball" && def.icon) { name.className = "sr-name sr-ic"; name.innerHTML = def.icon + "<span></span>"; name.lastChild.textContent = def.title || ""; }   // the bar button the ring came from: its icon, its word small under it
    else if (o.hub === "mark") { name.innerHTML = MARK; name.setAttribute("aria-label", def.title || ""); name.title = def.title || ""; } else name.textContent = def.title || "";
    var mid = document.createElement("span"); mid.className = "sr-mid"; mid.append(name);
    if (rings.length > 1) {
      var sw = document.createElement("button"); sw.type = "button"; sw.className = "sr-sw"; sw.innerHTML = CARET; sw.setAttribute("aria-haspopup", "menu"); sw.setAttribute("aria-label", "Switch ring: " + rings.map(function (r) { return RINGS[r].title; }).join(", ")); sw.title = "Switch ring";
      sw.onclick = function (e) { e.stopPropagation(); var L = ring.querySelector(".sr-list"); if (L) { L.remove(); return; }
        L = document.createElement("div"); L.className = "sr-list"; L.setAttribute("role", "menu"); L.setAttribute("aria-label", "Rings");
        rings.forEach(function (id) { var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitemradio"); b.setAttribute("aria-checked", String(id === rid)); b.textContent = RINGS[id].title;
          b.onclick = function (ev) { ev.stopPropagation(); if (id === rid) { L.remove(); return; } var oo = Object.assign({}, o, { ring: id, x: parseFloat(ring.style.left), y: parseFloat(ring.style.top), pinned: !!(cur && cur.pinned) });
            remember(o.key, id); try { o.onSwitch && o.onSwitch(id); } catch (er) {} open(oo); }; L.appendChild(b); });
        ring.appendChild(L); var f = L.querySelector("[aria-checked=true]") || L.firstChild; try { f.focus({ preventScroll: true }); } catch (er) {} };
    }
    var pin = null;
    if (o.pin !== false) {
      pin = document.createElement("button"); pin.type = "button"; pin.className = "sr-pin"; pin.innerHTML = PIN; pin.setAttribute("aria-pressed", "false"); pin.setAttribute("aria-label", "Pin the ring: it stays open while you play"); pin.title = "Pin: keep the ring open";
      pin.onclick = function (e) { e.stopPropagation(); setPin(!(cur && cur.pinned)); };
      hub.appendChild(pin);
    }
    hub.appendChild(mid); hub.appendChild(grip); if (sw) hub.appendChild(sw);   // pin · name · grip, the switch a bump below
    if (upIt) { var up = document.createElement("button"); up.type = "button"; up.className = "sr-up"; up.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 14l6-6 6 6"/></svg>';
      up.setAttribute("aria-label", upIt.aria || upIt.label || "Panel"); up.title = upIt.aria || upIt.label || "Panel";
      up.onclick = function (e) { e.stopPropagation(); if (e.detail > 0 && cur && performance.now() - cur.t0 < 350) return; try { upIt.pick && upIt.pick(); } catch (er) { console.warn("[ring]", er); } if (!(cur && cur.pinned)) close("pick"); };
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
        /* TWO PAGES: the chosen dot, tapped again while the ring is on, turns its page */
        if (I.more && I.kind === "radio" && b.getAttribute("aria-checked") === "true" && !(PW && !PW.on())) {
          try { I.more.set(!I.more.on); } catch (er) { console.warn("[ring]", er); } refresh();
          if (cur && cur.pinned) return; close("pick", b, 650); return; }
        if (it.kind === "check") b.setAttribute("aria-checked", String(b.getAttribute("aria-checked") !== "true")); else if (it.kind !== "go") dots.forEach(function (x) { if (x.getAttribute("role") === "menuitemradio") x.setAttribute("aria-checked", String(x === b)); });
        try { I.pick && I.pick(); } catch (er) { console.warn("[ring]", er); }
        if (PW || I.more) refresh();
        if (cur && cur.pinned) { b.classList.add("sr-tap"); setTimeout(function () { b.classList.remove("sr-tap"); }, 180); return; }
        if (!(keep && cur)) close("pick", b, it.kind === "go" ? 0 : 650); });   /* a switch lingers lit (or unlit) so its new state shows (Dimitry, 25 Oct 00:25: "you don't really know if you've actually triggered the button") */
      ring.appendChild(b); return b;
    });
    /* each dot's state from its item: chosen, its page, live; the centre's switch */
    function dress(b, it) {
      if (it.kind !== "go" && it.kind !== "value") b.setAttribute("aria-checked", String(!!it.on));
      /* a label or icon that follows the state (still / move) follows it here too */
      var lb = b.querySelector(".sr-lab"); if (lb && it.label != null && lb.textContent !== it.label) lb.textContent = it.label;
      if (it.icon && b._ic !== it.icon) { if (b._ic != null) { var sv = b.querySelector("svg:not(.sr-pg svg)"); if (sv) { var t = document.createElement("span"); t.innerHTML = it.icon; if (t.firstElementChild) sv.replaceWith(t.firstElementChild); } } b._ic = it.icon; }
      if (it.aria && !it.more) b.setAttribute("aria-label", it.aria);
      var p2 = !!(it.more && it.more.on); b.classList.toggle("sr-p2", p2); b.classList.toggle("sr-live", !!it.live || (p2 && !!it.on));
      if (it.more) b.setAttribute("aria-label", (it.aria || it.label || it.id) + (it.on ? (p2 ? ". Its second page is on: " : ". Tap again for its second page: ") + (it.more.aria || "") : ""));
    }
    function refresh() {
      if (!cur || cur.ring !== ring) return;
      if (rid || def.items) { var fresh = (typeof def.items === "function" ? def.items() : def.items || []).filter(Boolean);
        dots.forEach(function (b) { var f = fresh.filter(function (x) { return (x.id || "") === b.dataset.id; })[0]; if (f && f.kind !== "value") { b._it = f; dress(b, f); } }); }
      if (pow) { var on = !!PW.on(); pow.setAttribute("aria-pressed", String(on)); ring.classList.toggle("sr-off", !on);
        pow.setAttribute("aria-label", (def.title || "Ring") + (on ? ": on. Tap to turn it off" : ": off. Tap to turn it on, or choose any dot")); pow.title = on ? "On: tap to turn off" : "Off: tap to turn on"; }
    }
    /* a value dot: drag across it (left to right, or down to up) and its number shows inside; a tap hands the hub its slider */
    function valueDot(b, it) {
      var mn = it.min == null ? 0 : it.min, mx = it.max == null ? 100 : it.max, st = it.step || 1, fmt = it.fmt || function (v) { return String(Math.round(v)); };
      var clampV = function (v) { return Math.max(mn, Math.min(mx, Math.round(v / st) * st)); }, icon = b.innerHTML, g = null;
      b.setAttribute("role", "menuitem"); b.style.touchAction = "none"; b.setAttribute("aria-label", (it.aria || it.label || it.id) + ": " + fmt(it.get()) + ". Drag to change, or tap for a slider");
      var show = function (v) { b.innerHTML = '<span class="sr-num">' + fmt(v) + '</span><span class="sr-lab" aria-hidden="true"></span>'; b.querySelector(".sr-lab").textContent = it.label || ""; };
      b.addEventListener("pointerdown", function (e) { e.stopPropagation(); if (performance.now() - (cur ? cur.t0 : 0) < 350) return; try { b.setPointerCapture(e.pointerId); } catch (er) {} g = { x: e.clientX, y: e.clientY, v: +it.get(), moved: false }; });
      b.addEventListener("pointermove", function (e) { if (!g) return; var dd = (e.clientX - g.x) - (e.clientY - g.y); if (!g.moved && Math.abs(dd) < 6) return; g.moved = true; b.classList.add("sr-busy");
        var v = clampV(g.v + dd * (mx - mn) / 220); it.set(v); show(v); });
      var end = function () { if (!g) return; var m = g.moved; g = null; b.classList.remove("sr-busy"); if (m) { setTimeout(function () { b.innerHTML = icon; }, 700); } else slider(it, fmt, clampV); };
      b.addEventListener("pointerup", end); b.addEventListener("pointercancel", function () { g = null; b.classList.remove("sr-busy"); b.innerHTML = icon; });
      b.addEventListener("click", function (e) { e.stopPropagation(); if (e.detail === 0) slider(it, fmt, clampV); });
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
      if (!cur) return; if (cur.pinned && !ring.contains(document.activeElement)) { if (e.key === "Escape") { stop(e); close("esc"); } return; }   // pinned, the app keeps its keys but Esc
      var L = ring.querySelector(".sr-list"); if (L && L.contains(document.activeElement)) { if (e.key === "Escape") { stop(e); L.remove(); try { sw.focus(); } catch (er) {} } return; }
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
    if (typeof LV === "function") { ring.classList.add("sr-lv"); var lv = 0, tick = function () { if (!ring.isConnected) return; var v = 0; try { v = Math.max(0, Math.min(1, +LV() || 0)); } catch (e) {} lv += (v - lv) * .35; ring.style.setProperty("--lv", lv.toFixed(3)); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    requestAnimationFrame(function () { var f = dots.filter(function (b) { return b.getAttribute("aria-checked") === "true"; })[0] || dots[0]; try { f.focus({ preventScroll: true }); } catch (e) {} });
    return { close: function () { close("api"); }, el: ring, ring: rid };
  }
  /* a one-finger double-tap: two quick taps near each other, no drag between (the stage's own drag still pushes) */
  function doubleTap(el, fn, o) {
    o = o || {}; var ms = o.ms || 380, px = o.px || 44, lastT = null, down = null;
    /* times are the events' own (e.timeStamp: when the finger touched), not when a busy page got round to them */
    var ts = function (e) { return e.timeStamp || performance.now(); };
    el.addEventListener("pointerdown", function (e) { if (e.button > 0 || !e.isPrimary) { down = null; return; } down = { x: e.clientX, y: e.clientY, t: ts(e), id: e.pointerId }; }, true);
    el.addEventListener("pointerup", function (e) {
      if (!down || e.pointerId !== down.id) return; var d = down; down = null;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14 || ts(e) - d.t > 280) { lastT = null; return; }   // a drag or a hold is not a tap
      /* (25 Oct, Dimitry: "I would tap faster than it's expecting, so I have to slow down"): a quick thumb lands its
         second tap further off and rolls a little, so 380 ms, 44 px apart and 14 px of roll still make a double-tap */
      var now = ts(e);
      if (lastT && now - lastT.t < ms && Math.hypot(e.clientX - lastT.x, e.clientY - lastT.y) < px) { lastT = null; if (o.when && !o.when(e)) return; fn(e.clientX, e.clientY, e); return; }
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
  window.SurfaceRing = { refresh: function () { try { cur && cur.ring && cur.ring._refresh && cur.ring._refresh(); } catch (e) {} }, labels: labels, pinned: function () { return !!(cur && cur.pinned); }, open: open, define: define, last: last, MARK: MARK, close: function () { close("api"); }, isOpen: function () { return !!cur; }, current: function () { return cur && cur.id; }, doubleTap: doubleTap };
})();
