/* Surface · Tips — discreet tooltips for a tool's buttons.
   On a computer (a mouse that hovers): rest on a button for a moment and a small label appears above it: the button's
   name, what holding it does (hold or right-click), and its key if it has one.
   On touch: a long press on a shelf button that has no hold action of its own shows the same label (and that press
   does not count as a tap). The bar's own buttons keep their hold actions; their labels are in the Guide.
   The label comes from the button's data-tip, else from its aria-label: the first sentence is the name, a sentence
   starting "Hold" or "Press and hold" becomes the hold line.
   avoid: selectors of captions a label must never cover (a preset name, a toast). While one is showing, the label
   stacks above it (or below, if there is no room above), and moves at once when a caption appears or leaves.
   anchor (+ anchorFor): on a computer, labels for anchorFor (default: scope) appear above one element, the keys
   button, so names and keys are read in the place they are set; never over the button being pointed at.
   anchorAt:'right' puts that label just right of the anchor, on its line, as one plain line: the name and its key,
   or the name alone (no hold line: the Guide has it). keyFor(el) returns a button's key when keys:{} is not enough.
   Mount: SurfaceTips.mount({scope:'#playbar button, .shelf .si', keys:{pPrev:'←'}, noHold:'.dot,.mag,[data-hold]', avoid:'#playname,#toast'}) */
(function(){
'use strict';
const CSS=`.sft{position:fixed;z-index:60;left:0;top:0;max-width:min(260px,calc(100vw - 16px));padding:6px 9px;pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .14s,transform .14s;
  background:rgb(var(--ui-g,14 14 16) / .92);color:var(--ui-ink,#eef1f2);border:1px solid rgb(var(--ui-hi,255 255 255) / .14);border-radius:8px;font:500 14px/1.35 var(--sans,system-ui,sans-serif);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.sft.show{opacity:1;transform:none}
.sft.side{transform:translateX(-4px);white-space:nowrap;padding:4px 8px}.sft.side.show{transform:none}
.sft small{display:block;margin-top:3px;font:400 12.5px/1.35 var(--mono,ui-monospace,monospace);color:var(--ui-dim,#8a9396);letter-spacing:.02em}
.sft kbd{display:inline-block;min-width:1.4em;margin-left:6px;padding:0 4px;border:1px solid rgb(var(--ui-hi,255 255 255) / .22);border-radius:4px;font:600 13px/1.5 var(--mono,ui-monospace,monospace);color:var(--ui-ink,#eef1f2);text-align:center}
@media (prefers-reduced-motion:reduce){.sft{transition:none}}`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function parse(el,keys,kf){
  const raw=(el.dataset.tip||el.getAttribute('aria-label')||el.title||'').trim();if(!raw)return null;
  const parts=raw.split(/(?<=[.!?])\s+/);let name=parts[0].replace(/[.:]$/,'');
  const ci=name.indexOf(': ');if(ci>0&&ci<28)name=name.slice(0,ci);
  if(name.length>60)name=name.slice(0,58).replace(/\s+\S*$/,'')+'…';
  const hold=parts.find(p=>/^(press and )?hold\b/i.test(p));
  const k=keys&&el.id&&keys[el.id]||kf&&kf(el)||'';
  return {name,hold:hold?hold.replace(/^(press and )?hold( for)?\s*/i,'').replace(/\.$/,''):'',key:k||''};
}
function mount(o){
  o=Object.assign({scope:'button[aria-label]',keys:{},noHold:'.dot,.mag,[data-hold]',delay:450},o||{});
  if(!document.getElementById('sft-css')){const st=document.createElement('style');st.id='sft-css';st.textContent=CSS;document.head.appendChild(st)}
  const tip=document.createElement('div');tip.className='sft';tip.setAttribute('role','tooltip');tip.id='sft';document.body.appendChild(tip);
  let cur=null,t=0;
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  // anchor: on a computer, labels for o.anchorFor gather above one place (the keys button: where every key is set)
  function home(el){if(!o.anchor||!fine.matches||!el.matches(o.anchorFor||o.scope))return null;const a=document.querySelector(o.anchor);
    if(!a||a.hidden||a===el)return null;const q=a.getBoundingClientRect();return q.width>0&&q.height>0?q:null}
  const side=el=>o.anchorAt==='right'&&!!home(el);
  function place(el){const r=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
    if(side(el)){const q=home(el);tip.style.left=Math.min(q.right+10,innerWidth-w-8)+'px';tip.style.top=Math.round(q.top+q.height/2-h/2)+'px';return}
    let x=r.left+r.width/2-w/2,y=r.top-h-8;if(y<6)y=r.bottom+8;
    const q=home(el);if(q){const ax=Math.min(q.right,innerWidth-8)-w,ay=q.top-h-8;
      // never over the thing being pointed at: if the gathered place would cover it, stay beside it instead
      if(ay>=6&&!(ax<r.right&&ax+w>r.left&&ay<r.bottom&&ay+h>r.top)){x=ax;y=ay}}
    x=Math.max(8,Math.min(innerWidth-w-8,x));
    // never cover a caption that is showing (o.avoid): stack above it, or below it if there is no room above
    for(let pass=0;pass<3;pass++){let moved=false;
      for(const a of avoids()){const q=inkBox(a);
        if(x<q.right+4&&x+w>q.left-4&&y<q.bottom+6&&y+h>q.top-6){const up=q.top-h-6;y=up>=6?up:q.bottom+6;moved=true}}
      if(!moved)break}
    tip.style.left=x+'px';tip.style.top=y+'px'}
  // the caption's words, not its box: a full-width caption only gets in the way where its text is
  function inkBox(a){try{const g=document.createRange();g.selectNodeContents(a);const q=g.getBoundingClientRect();if(q.width>0)return q}catch(_){}return a.getBoundingClientRect()}
  function avoids(){if(!o.avoid)return [];return [...document.querySelectorAll(o.avoid)].filter(a=>{if(!a.textContent.trim())return false;const s=getComputedStyle(a);if(s.display==='none'||s.visibility==='hidden'||+s.opacity<.05&&!a.classList.contains('show'))return false;
      const q=a.getBoundingClientRect();return q.width>0&&q.height>0})}
  // a caption that appears (or leaves) while a label is up moves the label at once
  if(o.avoid)new MutationObserver(()=>{if(cur&&tip.classList.contains('show'))requestAnimationFrame(()=>{if(cur)place(cur)})}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class'],childList:true,characterData:true});
  function show(el,touch){const p=parse(el,o.keys,o.keyFor);if(!p)return;cur=el;const sd=!touch&&side(el);tip.classList.toggle('side',sd);if(sd)p.hold='';
    tip.innerHTML=esc(p.name)+(p.key?'<kbd>'+esc(p.key)+'</kbd>':'')+(p.hold?'<small>'+(touch?'hold':'hold or right-click')+' · '+esc(p.hold)+'</small>':'');
    tip.classList.add('show');place(el)}
  function hide(){clearTimeout(t);cur=null;tip.classList.remove('show')}
  const match=e=>e.target.closest&&e.target.closest(o.scope);
  // computer: hover
  document.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse'||!fine.matches)return;const el=match(e);if(!el||el===cur)return;hide();t=setTimeout(()=>{if(el.isConnected&&el.matches(':hover'))show(el,false)},o.delay)});
  document.addEventListener('pointerout',e=>{if(e.pointerType!=='mouse')return;const el=match(e);if(el&&!el.contains(e.relatedTarget))hide()});
  ['pointerdown','wheel','keydown','scroll'].forEach(ev=>addEventListener(ev,e=>{if(e.type!=='pointerdown'||e.pointerType==='mouse')hide()},{capture:true,passive:true}));
  // touch: long press on buttons without a hold of their own
  let lp=null,swallow=null;
  document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;const el=match(e);if(!el||el.matches(o.noHold)||el.closest('#playbar'))return;
    lp={el,x:e.clientX,y:e.clientY,t:setTimeout(()=>{show(el,true);swallow=el;if(navigator.vibrate)try{navigator.vibrate(8)}catch(_){} },520)}},true);
  document.addEventListener('pointermove',e=>{if(lp&&Math.hypot(e.clientX-lp.x,e.clientY-lp.y)>10){clearTimeout(lp.t);lp=null}},true);
  const up=()=>{if(lp){clearTimeout(lp.t);lp=null}if(swallow){const w=swallow;setTimeout(()=>{hide();if(swallow===w)swallow=null},1400)}};
  document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
  document.addEventListener('click',e=>{if(swallow&&swallow.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();swallow=null}},true);
  document.addEventListener('contextmenu',e=>{if(swallow&&e.pointerType!=='mouse'&&swallow.contains(e.target))e.preventDefault()},true);
  return {hide,show};
}
window.SurfaceTips={mount};
})();
