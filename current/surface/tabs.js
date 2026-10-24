/* Surface · Tabs — a panel with tabs across its head (Dimitry, 19–20 Oct 2026; first built in Current, moved here so
   every tool's panels carry tabs the same way).

     var T = SurfaceTabs.mount(listEl, [{ id, name, icon, title, pane, onShow }, …], storageKey);
     T.show(id) · T.last() · T.current() · T.step(±1) → false at an end · T.ids()
   Builds a button per tab (the WAI-ARIA tabs pattern: arrows, Home, End; aria-selected, aria-controls), shows one pane,
   remembers the last tab, and fires 'sftab' on the list ({detail:{id, pane}}).

   THE THRESHOLD (Dimitry, 20 Oct: "maybe we don't need the titles... a threshold... the icon stays white, and the
   title is in the second line, or in the container"): the open tab shows its name beside its icon while that fits.
   When it doesn't (the head reads TOU), every tab shows its icon only, the open one lit, and the open tab's name moves
   to a caption just under the head (.sfTabCap). Measured on every show and resize, so it holds for any number of tabs,
   any language, any head. Names stay for screen readers. Icons follow the line-weight scale (CONVENTIONS).

   Styling: default rules with zero specificity (:where), so a tool's own .sfTab / .sfTabCap rules always win.
   Plain script, window.SurfaceTabs, no dependencies. */
(function () {
  "use strict";
  if (window.SurfaceTabs) return;
  var CSS = ":where(.sfTabs){display:flex;align-self:stretch;gap:0;min-width:0;overflow-x:auto;scrollbar-width:none}:where(.sfTabs)::-webkit-scrollbar{display:none}" +
    ":where(.sfTab){display:inline-flex;align-items:center;gap:6px;padding:0 9px;min-height:36px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--ui-dim,#8a9396);font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.16em;text-transform:uppercase;cursor:pointer;white-space:nowrap}" +
    ":where(.sfTab) svg{width:14px;height:14px;flex:none;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}" +
    ":where(.sfTab):hover,:where(.sfTab[aria-selected=true]){color:var(--ui-ink,#eef1f2)}:where(.sfTab[aria-selected=true]){border-bottom-color:var(--acc,#55b8c9)}" +
    ":where(.sfPaneH){margin:0;padding:14px 16px 2px;font:600 15px/1.25 var(--sans,system-ui,sans-serif);letter-spacing:0;text-transform:none;color:var(--ui-ink,#eef1f2)}:where(.sfPaneH[hidden]){display:none}" +
    ":where(.sfTab):focus-visible{outline:2px solid var(--acc,#55b8c9);outline-offset:-2px}" +
    ":where(.sfTab[aria-selected=false]) span,:where(.sfTabs.icons .sfTab) span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}" +
    ":where(.sfTabCap){margin:12px 16px 0;font:600 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.16em;text-transform:uppercase;color:var(--ui-ink,#eef1f2)}:where(.sfTabCap[hidden]){display:none}";
  function css() { if (document.getElementById("sftab-css")) return; var st = document.createElement("style"); st.id = "sftab-css"; st.textContent = CSS; (document.head || document.documentElement).prepend(st); }
  window.SurfaceTabs = {mount: function (list, tabs, key, opt) { css(); return M(list, tabs, key, opt || {}); }};
  /* HEADS (Dimitry, 24 Oct 2026: "the word batch needs to be up there as a sort of title inside the page, the H2 equivalent
     ... the bottom is the menu, but the page still has a normal page structure where important identifying information is
     at the top"): with {heads:true} each pane gets its tab's name as a heading just above it (an h2, .sfPaneH), shown and
     hidden with the pane, outside it, so a pane that redraws itself never loses its title. The small caption under the
     tabs (.sfTabCap) is not needed then. */
  var M = function (list,tabs,key,opt){const btns={};let cur=null;opt=opt||{};
  if(opt.heads)tabs.forEach(t=>{if(!t.pane||t.head)return;const h=document.createElement(opt.tag||'h2');h.className='sfPaneH';h.textContent=t.name;h.hidden=!!t.pane.hidden;t.pane.before(h);t.head=h;   /* the head follows its pane's hidden however the pane is shown */
    try{new MutationObserver(()=>{h.hidden=!!t.pane.hidden}).observe(t.pane,{attributes:true,attributeFilter:['hidden']})}catch(_){}});
  const cap=document.createElement('p');cap.className='sfTabCap';cap.setAttribute('aria-hidden','true');cap.hidden=true;(list.parentElement||list).after(cap);
  const fit=()=>{list.classList.remove('icons');const tight=list.scrollWidth>list.clientWidth+1;list.classList.toggle('icons',tight);const t=tabs.find(t=>t.id===cur);cap.textContent=t?t.name:'';if(opt.heads){cap.hidden=true;return}cap.hidden=!tight};
  try{new ResizeObserver(()=>fit()).observe(list)}catch(_){addEventListener('resize',fit)}
  const get=()=>{try{const v=localStorage.getItem(key);return tabs.some(t=>t.id===v)?v:tabs[0].id}catch(_){return tabs[0].id}};
  const show=id=>{if(!tabs.some(t=>t.id===id))id=tabs[0].id;cur=id;for(const t of tabs){const on=t.id===id,b=btns[t.id];b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;t.pane.hidden=!on;if(t.head)t.head.hidden=!on}
    try{localStorage.setItem(key,id)}catch(_){}fit();const t=tabs.find(t=>t.id===id);if(t.onShow)t.onShow();list.dispatchEvent(new CustomEvent('sftab',{detail:{id,pane:t.pane}}))};
  tabs.forEach((t,i)=>{const b=document.createElement('button');b.type='button';b.className='sfTab';b.setAttribute('role','tab');b.id=list.id+'-'+t.id;
    b.setAttribute('aria-controls',t.pane.id);t.pane.setAttribute('aria-labelledby',b.id);b.innerHTML=(t.icon||'')+'<span></span>';b.querySelector('span').textContent=t.name;
    if(t.title)b.title=t.title;b.onclick=()=>show(t.id);
    b.onkeydown=e=>{const k=e.key;let j=-1;if(k==='ArrowRight')j=(i+1)%tabs.length;else if(k==='ArrowLeft')j=(i-1+tabs.length)%tabs.length;else if(k==='Home')j=0;else if(k==='End')j=tabs.length-1;
      if(j<0)return;e.preventDefault();show(tabs[j].id);btns[tabs[j].id].focus()};btns[t.id]=b;list.appendChild(b)});
  /* step(±1): the next or previous tab, false at either end (no wrap), so a swipe can bounce there (sheetnav.js) */
  const step=d=>{const i=tabs.findIndex(t=>t.id===cur),j=i+d;if(i<0||j<0||j>=tabs.length)return false;show(tabs[j].id);return true};
  return {show,last:get,current:()=>cur,step,ids:()=>tabs.map(t=>t.id),list}};
})();
