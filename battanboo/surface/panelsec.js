/* Surface · Panel sections — one rhythm for everything inside a panel (Dimitry, 17 Nov 2026: "each major subsection of a
   heads-up display should have its own icon, a title, a descriptor in smaller text below it, and then its control groups").

     [icon]  Title                 <- a subtitle of the panel's own name; 15-16 px, bold
             one small line saying what this group is for   <- 12-13 px, muted
     LABEL  control   LABEL  control ...   <- the groups' own labels stay small caps

   The icon is the control's own icon wherever one exists (CONVENTIONS: a word that names something with an icon on the interface
   carries that same icon): icon: 'btn:<button id>' copies that button's svg. Otherwise inner svg markup (24 x 24, stroke) or a whole <svg>.
   Sections are separated by a hairline; the first one in a panel has none.

   SurfacePanelSec.head({icon,title,desc})           -> a <header> element
   SurfacePanelSec.wrap(nodes,{id,icon,title,desc})  -> a <section> that takes the nodes (they move; ids and handlers keep working)
   SurfacePanelSec.adopt(el,{icon,title,desc,drop})  -> el becomes a section; its old title nodes (drop: selector) are removed
   SurfacePanelSec.first(root)                       -> marks the first section of each panel (call after building)
   Never put a head inside a node a tool rebuilds with innerHTML: wrap it instead. Classes are all psx-*; style id psx-css. */
(function(){ if(window.SurfacePanelSec) return;
  const CSS='.psx{display:flex;flex-direction:column;gap:10px;min-width:0;margin-top:22px;padding-top:18px;border-top:1px solid var(--line)}'
    +'.psx.psx-first{margin-top:0;padding-top:0;border-top:0}'
    +'.psx-h{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:10px;row-gap:2px;align-items:center}'
    +'.psx-i{display:grid;place-items:center;width:26px;height:26px;color:var(--fg)}.psx-i svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}'
    +'.psx-t{margin:0;font:700 15px/1.25 var(--ui);letter-spacing:.02em;color:var(--fg)}'
    +'.psx-d{grid-column:2;margin:0;font:400 12px/1.4 var(--ui);color:var(--muted);text-wrap:pretty}'
    +'@media (min-width:900px){.psx-t{font-size:16px}.psx-d{font-size:13px}}';
  function css(){ if(document.getElementById('psx-css')) return; const s=document.createElement('style'); s.id='psx-css'; s.textContent=CSS; document.head.appendChild(s); }
  const svg=m=>'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+m+'</svg>';
  function icon(i){ const w=document.createElement('span'); w.className='psx-i'; w.setAttribute('aria-hidden','true'); if(!i) return w;
    if(typeof i==='string'&&i.indexOf('btn:')===0){ const b=document.getElementById(i.slice(4)), v=b&&b.querySelector('svg'); if(v){ const k=v.cloneNode(true); k.removeAttribute('id'); k.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id')); w.appendChild(k); } return w; }
    w.innerHTML=String(i).trim().indexOf('<svg')===0?i:svg(i); return w; }
  function head(o){ css(); const h=document.createElement('header'); h.className='psx-h'; h.appendChild(icon(o.icon)); const t=document.createElement('h3'); t.className='psx-t'; t.textContent=o.title||''; h.appendChild(t);
    if(o.desc){ const d=document.createElement('p'); d.className='psx-d'; d.textContent=o.desc; h.appendChild(d); } return h; }
  function wrap(nodes,o){ css(); nodes=(nodes||[]).filter(Boolean); if(!nodes.length) return null; const s=document.createElement('section'); s.className='psx'+(o.cls?' '+o.cls:''); if(o.id) s.id=o.id; s.setAttribute('aria-label',o.title||''); nodes[0].before(s); s.appendChild(head(o)); nodes.forEach(n=>s.appendChild(n)); return s; }
  function adopt(el,o){ css(); if(!el) return null; if(o.drop) el.querySelectorAll(o.drop).forEach(n=>{ if(n.parentNode===el) n.remove(); }); el.classList.add('psx'); if(o.cls) el.classList.add(o.cls); el.setAttribute('aria-label',o.title||''); el.prepend(head(o)); return el; }
  function first(root){ (root||document).querySelectorAll('.psx.psx-first').forEach(e=>e.classList.remove('psx-first')); const seen=new Set(); (root||document).querySelectorAll('.psx').forEach(s=>{ const p=s.parentNode; if(!seen.has(p)){ seen.add(p); if(![...p.children].some(c=>c!==s&&c.classList.contains('psx')&&c.compareDocumentPosition(s)&4)) s.classList.add('psx-first'); } }); }
  window.SurfacePanelSec={head,wrap,adopt,first,svg};
})();
