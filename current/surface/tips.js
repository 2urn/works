/* Surface · Tips — discreet tooltips for a tool's buttons.
   On a computer (a mouse that hovers): rest on a button for a moment and a small label appears above it: the button's
   name, what holding it does (hold or right-click), and its key if it has one.
   On touch: a long press on a shelf button that has no hold action of its own shows the same label (and that press
   does not count as a tap). The bar's own buttons keep their hold actions; their labels are in the Guide.
   The label comes from the button's data-tip, else from its aria-label: the first sentence is the name, a sentence
   starting "Hold" or "Press and hold" becomes the hold line.
   Mount: SurfaceTips.mount({scope:'#playbar button, .shelf .si', keys:{pPrev:'←'}, noHold:'.dot,.mag,[data-hold]'}) */
(function(){
'use strict';
const CSS=`.sft{position:fixed;z-index:60;left:0;top:0;max-width:min(260px,calc(100vw - 16px));padding:6px 9px;pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .14s,transform .14s;
  background:rgba(10,12,13,.92);color:#eef1f2;border:1px solid rgba(255,255,255,.14);border-radius:8px;font:500 14px/1.35 var(--sans,system-ui,sans-serif);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.sft.show{opacity:1;transform:none}
.sft small{display:block;margin-top:3px;font:400 12.5px/1.35 var(--mono,ui-monospace,monospace);color:#8a9396;letter-spacing:.02em}
.sft kbd{display:inline-block;min-width:1.4em;margin-left:6px;padding:0 4px;border:1px solid rgba(255,255,255,.22);border-radius:4px;font:600 13px/1.5 var(--mono,ui-monospace,monospace);color:#eef1f2;text-align:center}
@media (prefers-reduced-motion:reduce){.sft{transition:none}}`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function parse(el,keys){
  const raw=(el.dataset.tip||el.getAttribute('aria-label')||el.title||'').trim();if(!raw)return null;
  const parts=raw.split(/(?<=[.!?])\s+/);let name=parts[0].replace(/[.:]$/,'');
  const ci=name.indexOf(': ');if(ci>0&&ci<28)name=name.slice(0,ci);
  if(name.length>60)name=name.slice(0,58).replace(/\s+\S*$/,'')+'…';
  const hold=parts.find(p=>/^(press and )?hold\b/i.test(p));
  const k=keys&&el.id&&keys[el.id];
  return {name,hold:hold?hold.replace(/^(press and )?hold( for)?\s*/i,'').replace(/\.$/,''):'',key:k||''};
}
function mount(o){
  o=Object.assign({scope:'button[aria-label]',keys:{},noHold:'.dot,.mag,[data-hold]',delay:450},o||{});
  if(!document.getElementById('sft-css')){const st=document.createElement('style');st.id='sft-css';st.textContent=CSS;document.head.appendChild(st)}
  const tip=document.createElement('div');tip.className='sft';tip.setAttribute('role','tooltip');tip.id='sft';document.body.appendChild(tip);
  let cur=null,t=0;
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  function place(el){const r=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
    let x=r.left+r.width/2-w/2,y=r.top-h-8;if(y<6)y=r.bottom+8;x=Math.max(8,Math.min(innerWidth-w-8,x));tip.style.left=x+'px';tip.style.top=y+'px'}
  function show(el,touch){const p=parse(el,o.keys);if(!p)return;cur=el;
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
