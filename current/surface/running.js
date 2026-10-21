/* Surface · Running — canon for "this is what is animating right now" (Dimitry, 20 Oct 2026: "the dotted sequence
   animation below the icon works perfectly ... definitely canon").

   Four signs, one meaning:
   1. THE CHAIN, on the thing itself: a row of small dots under it, in the accent, with a light running along them
      left to right. Any control that is driving an animation at this moment carries it (a word sequence, a gesture
      loop, an auto mode, a recording …). Several at once is fine: each shows its own.
   2. THE WAVE, on the button that holds it: when something animating lives inside a shelf or panel, the button that
      opens it sends out a ring, over and over, so you know to look inside; the chain there says which.
   3. THE SWEEP, on a round button showing the animating thing's own icon: an arc of light circling its rim
      (Dimitry, 20 Oct: "a sweep circle around any active icon").
   4. THE CHASE, when that button shows a row of dots instead (the "…" default): its own dots light one after another,
      left to right, the chain's rhythm ("if it's the 3 dot default then sequence the dots in the same way").
   With reduced motion the chain's and the chase's dots stay still, the wave is a still ring, the sweep a still arc.

     SurfaceRunning.mark(el, on)         the chain on el (class s-running); el must be able to hold an absolute child
     SurfaceRunning.wave(btn, on)        the wave on a button (class s-wave)
     SurfaceRunning.sweep(btn, on)       the sweep (class s-sweep; uses btn::before, btn must be position:relative)
     SurfaceRunning.chase(el, on)        the chase (class s-chase) over el's .s-dot children, each with --i: 0, 1, 2 …
     or set the classes yourself; the module only brings the CSS (injected once, zero specificity, so a tool may move
     the chain with its own rule: e.g. .myBtn.s-running::after{bottom:3px})
   Colors: --acc (the accent) and --acc-rgb ("r g b"), with fallbacks. Plain script, window.SurfaceRunning. */
(function () {
  "use strict";
  if (window.SurfaceRunning) return;
  var CSS =
    ":where(.s-running){position:relative}" +
    ":where(.s-running)::after{content:'';position:absolute;left:50%;bottom:1px;width:29px;height:4px;translate:-50% 0;pointer-events:none;" +
    "background:radial-gradient(circle at 2px 2px,var(--acc,#55b8c9) 1.45px,transparent 1.95px) 0 0/6px 4px repeat-x;" +
    "-webkit-mask:linear-gradient(90deg,rgba(0,0,0,.38) 0 35%,#000 47% 53%,rgba(0,0,0,.38) 65% 100%) 0 0/300% 100% no-repeat;" +
    "mask:linear-gradient(90deg,rgba(0,0,0,.38) 0 35%,#000 47% 53%,rgba(0,0,0,.38) 65% 100%) 0 0/300% 100% no-repeat;" +
    "animation:sRunChain 1.15s linear infinite}" +
    "@keyframes sRunChain{from{-webkit-mask-position:100% 0;mask-position:100% 0}to{-webkit-mask-position:0 0;mask-position:0 0}}" +
    ":where(.s-wave){animation:sRunWave 1.8s ease-out infinite}" +
    "@keyframes sRunWave{0%{box-shadow:0 0 0 0 rgb(var(--acc-rgb,85 184 201) / .6)}70%,100%{box-shadow:0 0 0 13px rgb(var(--acc-rgb,85 184 201) / 0)}}" +
    ":where(.s-sweep)::before{content:'';position:absolute;inset:-6px;border-radius:50%;pointer-events:none;" +
    "background:conic-gradient(from 0turn,transparent 0 50%,rgb(var(--acc-rgb,85 184 201) / .25) 62%,var(--acc,#55b8c9) 90%,color-mix(in srgb,var(--acc,#55b8c9) 35%,#fff) 100%);" +
    "-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3.5px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 3.5px),#000 calc(100% - 3px));" +
    "animation:sRunSweep 1.4s linear infinite}" +
    "@keyframes sRunSweep{to{rotate:1turn}}" +
    ":where(.s-chase) .s-dot{animation:sRunDot 1.15s ease-in-out infinite;animation-delay:calc(var(--i,0) * .19s)}" +
    "@keyframes sRunDot{0%,70%,100%{opacity:.32}30%{opacity:1}}" +
    "@media (prefers-reduced-motion:reduce){:where(.s-running)::after{animation:none;-webkit-mask:none;mask:none}" +
    ":where(.s-wave){animation:none;box-shadow:0 0 0 3px rgb(var(--acc-rgb,85 184 201) / .55)}" +
    ":where(.s-sweep)::before{animation:none}:where(.s-chase) .s-dot{animation:none}}";
  function css() { if (document.getElementById("srun-css")) return; var s = document.createElement("style"); s.id = "srun-css"; s.textContent = CSS; (document.head || document.documentElement).prepend(s); }
  css();
  function tog(el, cls, on) { if (el && el.classList) el.classList.toggle(cls, !!on); return el; }
  window.SurfaceRunning = {
    mark: function (el, on) { css(); return tog(el, "s-running", on); },
    wave: function (btn, on) { css(); return tog(btn, "s-wave", on); },
    sweep: function (btn, on) { css(); return tog(btn, "s-sweep", on); },
    chase: function (el, on) { css(); return tog(el, "s-chase", on); },
    css: CSS
  };
})();
