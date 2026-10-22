/* Surface · Install — "keep this tool as an app" for every hosted CHAMY·XYZ web app.
   One file, no dependencies. It
   - works out the device and browser (iPhone/iPad Safari, iPhone Chrome/Edge/Firefox, Android, Mac Safari,
     Chrome/Edge on a computer, Firefox),
   - uses the browser's own install button when it offers one (beforeinstallprompt),
   - otherwise shows the steps as a short looping drawn animation with a numbered list beside it,
   - says "installed" when the app is already running on its own (any manifest display mode, fullscreen included),
     and in a browser tab when it is already installed on this device (Chrome/Edge report it; elsewhere it is remembered
     from installing in this browser; Safari can't tell), with the steps one tap away; inside claude.ai points to the public link
     (installing there would save claude.ai, not the tool),
   - can show a one-time hint after a while of use,
   - tells a tool whether it is installed: SurfaceInstall.installed(), SurfaceInstall.onChange(f) (Current's cover drops its
     install button for share).
   Mount: SurfaceInstall.mount({app:'Current', icon:'icons/icon-192.png', url:'https://works.chamy.xyz/current/', into:el, before:el,
            open:()=>{...open the drawer...}, hint:true, link:true})
   link:true adds "send someone straight here" with a copy-link button (links.js); the section's id is install, so #install opens it.
   Styling follows the host's Codex list (.cx-grp/.cx-row) and its CSS variables; it carries fallbacks of its own. */
(function(){
'use strict';
const ua=navigator.userAgent||'',touchMac=/Macintosh/.test(ua)&&navigator.maxTouchPoints>1;
const IOS=/iPhone|iPod/.test(ua),IPAD=/iPad/.test(ua)||touchMac,APPLE_MOBILE=IOS||IPAD;
const ANDROID=/Android/.test(ua),OTHER_IOS=/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
const FIREFOX=/Firefox|FxiOS/.test(ua),EDGE=/Edg\//.test(ua),CHROME=/Chrome\//.test(ua)&&!EDGE;
const MAC=/Macintosh/.test(ua)&&!touchMac,WIN=/Windows/.test(ua);
const MAC_SAFARI=MAC&&/Safari\//.test(ua)&&!/Chrome|Chromium|Edg|Firefox/.test(ua);
/* an installed app reports the display mode its manifest asked for: standalone, minimal-ui, window-controls-overlay or fullscreen.
   fullscreen is also what a browser tab reports while it is in full screen, so it only counts when no element holds full screen */
const standalone=()=>navigator.standalone===true||['standalone','minimal-ui','window-controls-overlay'].some(m=>matchMedia('(display-mode: '+m+')').matches)||
  (matchMedia('(display-mode: fullscreen)').matches&&!document.fullscreenElement&&!document.webkitFullscreenElement);
const embedded=()=>{let t=false;try{t=window.top!==window.self}catch(_){t=true}return t||/(^|\.)claude(usercontent)?\.(ai|com)$/.test(location.hostname)};
let BIP=null;const bipWaiters=[];
let RELATED=false;
const mark=v=>{try{if(v)localStorage.setItem('surface-install:installed','true');else localStorage.removeItem('surface-install:installed')}catch(_){}};
const marked=()=>{try{return localStorage.getItem('surface-install:installed')==='true'}catch(_){return false}};
addEventListener('beforeinstallprompt',e=>{e.preventDefault();BIP=e;RELATED=false;mark(false);bipWaiters.forEach(f=>f())});
addEventListener('appinstalled',()=>{BIP=null;mark(true);bipWaiters.forEach(f=>f())});
/* Chrome and Edge can say whether this web app is installed, when the manifest lists itself under related_applications */
if(navigator.getInstalledRelatedApps)navigator.getInstalledRelatedApps().then(a=>{if(a&&a.some(x=>x.platform==='webapp')){RELATED=true;mark(true);bipWaiters.forEach(f=>f())}}).catch(()=>{});
/* installed on this device, seen from a browser tab: known for sure in Chrome/Edge, remembered where it was installed from this browser; Safari can't tell */
const installedHere=()=>!BIP&&(RELATED||marked());

function guess(){
  if(APPLE_MOBILE)return OTHER_IOS?'ios-other':'ios-safari';
  if(ANDROID)return FIREFOX?'android-firefox':'android';
  if(MAC_SAFARI)return 'mac-safari';
  if(FIREFOX)return 'firefox';
  return 'desktop';
}

/* ---------- the drawn guides ----------
   A scene is a device outline, layers of drawn screen states, and steps. Each step shows some layers,
   puts a tap ring somewhere, and has a caption. Everything is plain SVG so it themes, scales and works offline. */
const C={bez:'#1b1f21',edge:'#2f3639',scr:'#050708',ui:'#15191b',row:'#1e2427',txt:'#c9d2d5',dim:'#6b7578',acc:'var(--sfi-acc,#55b8c9)'};
const T=(x,y,s,o)=>`<text x="${x}" y="${y}" font-size="${(o&&o.fs)||7}" fill="${(o&&o.c)||C.txt}" ${o&&o.a?'text-anchor="'+o.a+'"':''} ${o&&o.b?'font-weight="700"':''}>${s}</text>`;
const R=(x,y,w,h,r,f,st)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}"${st?` stroke="${st}" stroke-width="1"`:''}/>`;
const flowArt=(x,y,w,h)=>{let s='';for(let i=0;i<6;i++){const yy=y+h*(.25+i*.1);s+=`<path d="M${x+6} ${yy} C ${x+w*.35} ${yy-14+i*4}, ${x+w*.6} ${yy+16-i*3}, ${x+w-6} ${yy-4}" fill="none" stroke="${C.acc}" stroke-opacity="${.25+i*.1}" stroke-width="1" stroke-dasharray="1 2.5"/>`}return s};
let ICON='',CLIP=0;
const appIcon=(x,y,s,pop)=>ICON?(()=>{const id='sfi-c'+(CLIP++);return `<g${pop?' class="sfi-pop"':''} style="transform-origin:${x+s/2}px ${y+s/2}px"><clipPath id="${id}"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s*.24}"/></clipPath><image href="${ICON}" x="${x}" y="${y}" width="${s}" height="${s}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/></g>`})():`<g${pop?' class="sfi-pop"':''} style="transform-origin:${x+s/2}px ${y+s/2}px">${R(x,y,s,s,s*.24,'#0b0b0c',C.edge)}<path d="M${x+s*.2} ${y+s*.62} C ${x+s*.4} ${y+s*.3}, ${x+s*.6} ${y+s*.8}, ${x+s*.8} ${y+s*.38}" fill="none" stroke="${C.acc}" stroke-width="${s*.09}" stroke-linecap="round"/></g>`;
const homeGrid=(x0,y0,cols,rows,s,gap,skip)=>{let g='';for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){if(skip&&skip[0]===c&&skip[1]===r)continue;g+=R(x0+c*(s+gap),y0+r*(s+gap+7),s,s,s*.24,'#242a2d')}return g};

// phone 140×260, screen 8..132 × 8..252
const PHONE={vb:'0 0 140 260',body:R(1,1,138,258,22,C.bez,C.edge)+R(8,8,124,244,16,C.scr)};
// computer 320×208: screen 14..306 × 10..186, base below
const LAPTOP={vb:'0 0 320 214',body:R(10,4,300,186,10,C.bez,C.edge)+R(16,10,288,174,4,C.scr)+`<path d="M2 196 h316 l-10 14 h-296 z" fill="${C.bez}" stroke="${C.edge}"/>`};

function iosShareSheet(hl){return `${R(8,112,124,140,14,C.ui)}${R(56,117,28,3,1.5,C.dim)}${T(20,134,'works.chamy.xyz',{c:C.dim,fs:6})}
  ${['Copy','Add to Reading List','Add to Home Screen','Add Bookmark'].map((n,i)=>R(16,142+i*22,108,19,5,i===2&&hl?'#1f4f58':C.row)+T(24,154+i*22,n,{b:i===2&&hl})+(i===2?`<path d="M112 147 v8 M108 151 h8" stroke="${C.txt}" stroke-width="1"/>`+R(106,145,12,12,2.5,'none',C.txt):'')).join('')}`}
function iosAddSheet(){return `${R(8,8,124,244,16,C.ui)}${T(16,30,'Cancel',{c:C.acc,fs:6})}${T(72,30,'Add to Home Screen',{a:'middle',b:1,fs:5.6})}${T(122,30,'Add',{a:'end',b:1,c:C.acc})}
  ${R(16,42,108,44,8,C.row)}${appIcon(22,48,32)}${T(62,62,'Current',{b:1,fs:8})}${T(62,74,'works.chamy.xyz',{c:C.dim,fs:5.5})}
  ${R(16,94,108,22,8,C.row)}${T(24,108,'Open as Web App',{fs:6.5})}${R(100,99,20,12,6,C.acc)}<circle cx="114" cy="105" r="4.6" fill="#fff"/>`}
function iosHome(){return `${R(8,8,124,244,16,'#0d1a1d')}${homeGrid(20,30,4,4,20,8,[3,3])}${appIcon(104,111,20,true)}${T(114,139,'Current',{a:'middle',fs:5})}`}
function bigCaption(){return ''}

function buildScenes(){return {
'ios-safari':{name:'iPhone & iPad · Safari',short:'iPhone · Safari',dev:PHONE,
  layers:{
    app:R(8,8,124,244,16,C.scr)+flowArt(8,20,124,180),
    bar:`${R(14,214,92,24,12,C.ui,C.edge)}${T(60,229,'works.chamy.xyz',{a:'middle',fs:6})}<circle cx="119" cy="226" r="12" fill="${C.ui}" stroke="${C.edge}"/>${T(119,229,'•••',{a:'middle',fs:6})}`,
    menu:`${R(50,128,82,80,12,C.ui,C.edge)}${['Share','Add to Bookmarks','New Tab','Find on Page'].map((n,i)=>(i===0?R(54,132,74,18,6,'#1f4f58'):'')+T(60,144+i*19,n,{b:i===0,fs:6.5})).join('')}<path d="M115 136 v8 M111 140 l4-4 4 4" stroke="${C.txt}" fill="none" stroke-width="1"/>`,
    share:iosShareSheet(true),add:iosAddSheet(),home:iosHome()},
  steps:[
    {show:['app','bar'],tap:[119,226],cap:'Tap the ••• button next to the address'},
    {show:['app','bar','menu'],tap:[90,141],cap:'Tap Share'},
    {show:['app','share'],tap:[70,193],cap:'Scroll and tap Add to Home Screen'},
    {show:['add'],tap:[110,105],cap:'Keep Open as Web App on'},
    {show:['add'],tap:[118,27],cap:'Tap Add'},
    {show:['home'],tap:null,cap:'It opens full screen from its own icon'}],
  note:'On older iOS the Share button sits in the toolbar itself: tap it, then Add to Home Screen. Safari only shows Open as Web App on iOS 26 and later.'},
'ios-other':{name:'iPhone & iPad · Chrome, Edge, Firefox',short:'iPhone · Chrome',dev:PHONE,
  layers:{
    app:R(8,8,124,244,16,C.scr)+flowArt(8,40,124,180),
    bar:`${R(14,14,112,22,11,C.ui,C.edge)}${T(60,28,'works.chamy.xyz',{a:'middle',fs:6})}<path d="M114 29 v-8 M110 24 l4-4 4 4" stroke="${C.txt}" fill="none" stroke-width="1.1"/>${R(108,23,12,9,2,'none',C.txt)}`,
    share:iosShareSheet(true),add:iosAddSheet(),home:iosHome()},
  steps:[
    {show:['app','bar'],tap:[114,25],cap:'Tap Share in the address bar'},
    {show:['app','share'],tap:[70,193],cap:'Tap Add to Home Screen'},
    {show:['add'],tap:[118,27],cap:'Tap Add'},
    {show:['home'],tap:null,cap:'It opens full screen from its own icon'}],
  note:'Needs iOS 16.4 or later. In Firefox the Share button is in the ••• menu.'},
'android':{name:'Android · Chrome, Edge, Samsung',short:'Android',dev:PHONE,
  layers:{
    app:R(8,8,124,244,16,C.scr)+flowArt(8,40,124,180),
    bar:`${R(14,14,100,22,11,C.ui,C.edge)}${T(64,28,'works.chamy.xyz',{a:'middle',fs:6})}<circle cx="124" cy="21" r="1.3" fill="${C.txt}"/><circle cx="124" cy="25" r="1.3" fill="${C.txt}"/><circle cx="124" cy="29" r="1.3" fill="${C.txt}"/>`,
    menu:`${R(56,14,74,104,6,C.ui,C.edge)}${['New tab','History','Downloads','Install app','Settings'].map((n,i)=>(i===3?R(58,77,70,18,4,'#1f4f58'):'')+T(64,32+i*19,n,{b:i===3,fs:6.5})).join('')}`,
    dlg:`${R(8,8,124,244,16,'rgba(0,0,0,.55)')}${R(18,90,104,76,10,C.ui,C.edge)}${T(28,108,'Install app',{b:1,fs:8})}${appIcon(28,116,20)}${T(54,126,'Current',{fs:7})}${T(54,135,'works.chamy.xyz',{c:C.dim,fs:5})}${T(70,158,'Cancel',{c:C.acc,a:'end',fs:6.5})}${T(112,158,'Install',{c:C.acc,a:'end',b:1,fs:6.5})}`,
    home:iosHome()},
  steps:[
    {show:['app','bar'],tap:[124,25],cap:'Tap ⋮ at the top right'},
    {show:['app','bar','menu'],tap:[92,85],cap:'Tap Install app (or Add to home screen)'},
    {show:['app','bar','dlg'],tap:[104,155],cap:'Tap Install'},
    {show:['home'],tap:null,cap:'It opens full screen from its own icon'}],
  note:'Samsung Internet: ☰ menu, then Add page to, then Home screen.'},
'mac-safari':{name:'Mac · Safari',short:'Mac · Safari',dev:LAPTOP,
  layers:{
    win:`${R(16,10,288,174,4,'#0b0d0e')}${R(16,10,288,11,0,C.ui)}${T(24,18,'',{fs:6})}${['Safari','File','Edit','View','History'].map((n,i)=>T(30+i*26,18,n,{fs:6,b:i===0}))}${R(40,30,240,16,4,C.ui)}${T(160,41,'works.chamy.xyz',{a:'middle',fs:6})}${flowArt(40,50,240,130)}`,
    menu:`${R(54,21,92,72,4,C.ui,C.edge)}${['New Window','New Tab','Open File…','Add to Dock…','Close Window'].map((n,i)=>(i===3?R(56,64,88,12,3,'#1f4f58'):'')+T(62,32+i*13,n,{fs:6,b:i===3})).join('')}`,
    dlg:`${R(16,10,288,174,4,'rgba(0,0,0,.5)')}${R(100,50,120,82,8,C.ui,C.edge)}${T(160,66,'Add to Dock',{a:'middle',b:1,fs:7})}${appIcon(112,74,24)}${R(142,78,68,14,3,C.row)}${T(146,88,'Current',{fs:6.5})}${R(112,112,44,13,4,C.row)}${T(134,121,'Cancel',{a:'middle',fs:6})}${R(164,112,44,13,4,C.acc)}${T(186,121,'Add',{a:'middle',b:1,fs:6,c:'#04181c'})}`,
    dock:`${R(16,10,288,174,4,'#0d1a1d')}${R(86,160,148,20,6,'rgba(255,255,255,.08)')}${[0,1,2,3,4].map(i=>R(92+i*22,163,15,15,4,'#2a3134')).join('')}${appIcon(204,163,15,true)}`},
  steps:[
    {show:['win'],tap:[56,16],cap:'In the menu bar, open File'},
    {show:['win','menu'],tap:[100,70],cap:'Choose Add to Dock…'},
    {show:['win','dlg'],tap:[186,118],cap:'Click Add'},
    {show:['dock'],tap:null,cap:'It lives in the Dock and opens in its own window'}],
  note:'Needs macOS Sonoma (14) or later. The Share button in the toolbar has Add to Dock too.'},
'desktop':{name:'Computer · Chrome, Edge, Brave, Arc',short:'Chrome · Edge',dev:LAPTOP,
  layers:{
    win:`${R(16,10,288,174,4,'#0b0d0e')}${R(16,10,288,12,0,C.ui)}${R(22,13,70,9,3,C.row)}${T(28,20,'Current',{fs:5.5})}${R(22,26,276,14,7,C.ui)}${T(34,36,'works.chamy.xyz',{fs:6})}
      <g transform="translate(276 27)"><rect x="0" y="1" width="10" height="7" rx="1.2" fill="none" stroke="${C.txt}" stroke-width=".8"/><path d="M5 2.5 v3.5 M3.4 4.6 L5 6.2 6.6 4.6" stroke="${C.acc}" fill="none" stroke-width=".9"/></g>${flowArt(40,46,240,130)}`,
    dlg:`${R(176,40,124,66,6,C.ui,C.edge)}${T(186,54,'Install app?',{b:1,fs:7})}${appIcon(186,61,18)}${T(210,70,'Current',{fs:6.5})}${T(210,78,'works.chamy.xyz',{c:C.dim,fs:5})}${R(212,88,40,12,4,C.acc)}${T(232,96,'Install',{a:'middle',b:1,fs:6,c:'#04181c'})}${R(256,88,38,12,4,C.row)}${T(275,96,'Cancel',{a:'middle',fs:6})}`,
    own:`${R(16,10,288,174,4,'#0d1a1d')}${R(60,24,200,140,6,'#0b0d0e',C.edge)}${R(60,24,200,12,0,C.ui)}${appIcon(64,26,8)}${T(76,33,'Current',{fs:6})}${flowArt(64,40,192,120)}`},
  steps:[
    {show:['win'],tap:[281,31],cap:'Click the install icon at the right of the address bar'},
    {show:['win','dlg'],tap:[232,94],cap:'Click Install'},
    {show:['own'],tap:null,cap:'It opens in its own window, with its own icon'}],
  note:'No icon? Open the browser menu: in Chrome, Cast, save and share, then Install page as app; in Edge, Apps, then Install this site as an app.'},
'android-firefox':{name:'Android · Firefox',dev:PHONE,steps:null,text:'Firefox: open the ⋮ menu and tap Add app to Home screen (or Install).'},
'firefox':{name:'Computer · Firefox',short:'Firefox',dev:LAPTOP,steps:null,text:'Firefox on Windows can pin a site to the taskbar as a web app (Firefox 143 and later) from the address bar. On a Mac or Linux, Firefox has no install yet: open this page in Safari, Chrome or Edge to install it.'}
}}
let SCENES=buildScenes();

const ORDER=['ios-safari','ios-other','android','mac-safari','desktop','firefox'];

/* ---------- styles ---------- */
const CSS=`
.sfi{--sfi-acc:var(--accent,#55b8c9);--sfi-fg:var(--fg,#eef1f2);--sfi-mut:var(--muted,#8a9396);--sfi-line:var(--line,#23292b);font-family:var(--sans,system-ui,sans-serif)}
.sfi-lead{margin:0 0 10px;font-size:13px;line-height:1.45;max-width:38ch}
.sfi-state{margin:0 0 10px;font-size:13px;line-height:1.45;max-width:38ch;color:var(--sfi-fg)}
.sfi-state b{color:var(--sfi-acc)}
.sfi-go{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 16px;margin:0 0 12px;border:1px solid var(--sfi-acc);background:var(--sfi-acc);color:#04181c;font:600 11px/1 var(--mono,ui-monospace,monospace);letter-spacing:.12em;text-transform:uppercase;cursor:pointer;border-radius:0}
.sfi-go.ghost{background:transparent;color:var(--sfi-fg);border-color:var(--sfi-line)}
.sfi-go svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.sfi-plats{display:flex;flex-wrap:wrap;gap:0 12px;margin:0 0 8px}
.sfi-plats button{min-height:30px;padding:0;border:0;background:none;color:var(--sfi-mut);font:500 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.sfi-plats button[aria-pressed=true]{color:var(--sfi-acc);font-weight:700}
.sfi-plats button:focus-visible,.sfi-steps button:focus-visible,.sfi-go:focus-visible,.sfi-hint button:focus-visible{outline:2px solid var(--sfi-acc);outline-offset:2px}
.sfi-stage{position:relative;display:grid;place-items:center;padding:10px 0;margin:0 0 6px;background:#08090a;border:1px solid var(--sfi-line)}
.sfi-stage svg{display:block;width:100%;height:auto;font-family:var(--sans,system-ui,sans-serif)}
.sfi-stage.phone svg{max-width:190px}.sfi-stage.laptop svg{max-width:340px}
.sfi-stage [data-l]{opacity:0;transition:opacity .28s ease}
.sfi-stage [data-l].on{opacity:1}
.sfi-tap{opacity:0}
.sfi-tap.on{animation:sfi-tap 1.1s ease-out .35s both}
@keyframes sfi-tap{0%{opacity:0;r:2}25%{opacity:.95;r:5}100%{opacity:0;r:13}}
.sfi-pop{animation:none}
.sfi-stage [data-l].on .sfi-pop{animation:sfi-pop .55s cubic-bezier(.2,1.6,.4,1) .2s both}
@keyframes sfi-pop{from{transform:scale(.2);opacity:0}to{transform:none;opacity:1}}
.sfi-cap{min-height:2.6em;margin:0 0 6px;font:600 13px/1.3 var(--sans,system-ui,sans-serif);color:var(--sfi-fg)}
.sfi-steps{list-style:none;margin:0 0 6px;padding:0;counter-reset:s}
.sfi-steps li{counter-increment:s}
.sfi-steps button{display:grid;grid-template-columns:2.2em minmax(0,1fr);align-items:baseline;width:100%;padding:5px 0;border:0;background:none;color:var(--sfi-mut);font:400 13px/1.35 var(--sans,system-ui,sans-serif);text-align:left;cursor:pointer}
.sfi-steps button::before{content:counter(s,decimal-leading-zero);font:500 11px/1 var(--mono,ui-monospace,monospace);color:var(--sfi-mut)}
.sfi-steps button[aria-current=step]{color:var(--sfi-fg)}.sfi-steps button[aria-current=step]::before{color:var(--sfi-acc)}
.sfi-ctl{display:flex;gap:12px;margin:0 0 8px}
.sfi-ctl button{min-height:30px;padding:0;border:0;background:none;color:var(--sfi-mut);font:500 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.sfi-ctl button:hover{color:var(--sfi-fg)}
.sfi-note{margin:0 0 4px;font-size:12px;line-height:1.45;color:var(--sfi-mut);max-width:40ch}
.sfi-hint{position:fixed;z-index:30;left:50%;top:calc(14px + env(safe-area-inset-top,0px));transform:translate(-50%,-14px);opacity:0;pointer-events:none;display:flex;align-items:center;gap:2px;max-width:calc(100vw - 24px);
  background:rgba(14,14,16,.82);border:1px solid rgba(255,255,255,.16);border-radius:999px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);transition:opacity .25s,transform .25s}
.sfi-hint.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}
.sfi-hint .o{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 6px 0 14px;border:0;background:none;color:#eef1f2;font:500 12px/1 var(--sans,system-ui,sans-serif);cursor:pointer;white-space:nowrap}
.sfi-hint .o svg{width:16px;height:16px;fill:none;stroke:#55b8c9;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.sfi-hint .x{width:36px;height:40px;border:0;background:none;color:#8a9396;cursor:pointer;font:400 16px/1 var(--sans,system-ui,sans-serif)}
@media (prefers-reduced-motion:reduce){.sfi-stage [data-l]{transition:none}.sfi-tap.on,.sfi-stage [data-l].on .sfi-pop{animation:none}.sfi-hint{transition:none}}
`;
const ICON_DL='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/></svg>';
/* inside Claude the button leaves for the public page, so it wears the external-link mark; on the web, installing keeps the download mark */
const ICON_EXT='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store={get(k){try{return JSON.parse(localStorage.getItem('surface-install:'+k))}catch(_){return null}},set(k,v){try{localStorage.setItem('surface-install:'+k,JSON.stringify(v))}catch(_){}}};

function mount(o){
  o=Object.assign({app:document.title||'this app',url:location.href,hint:true,hintAfter:25000},o||{});
  if(!document.getElementById('sfi-css')){const st=document.createElement('style');st.id='sfi-css';st.textContent=CSS;document.head.appendChild(st)}
  const app=esc(o.app);if(o.icon){ICON=esc(o.icon);SCENES=buildScenes()}
  // the section, in the host's Codex list shape
  const sec=document.createElement('section');sec.className='cx-grp sfi';sec.id='install';
  sec.innerHTML=`<button type="button" class="cx-grpbtn" aria-expanded="true" aria-controls="installL"><span>Install</span><svg class="cx-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button><div class="cx-gbody" id="installL"></div>`;
  const body=sec.querySelector('.cx-gbody');
  const gb=sec.querySelector('.cx-grpbtn');gb.onclick=()=>{const on=sec.classList.toggle('cx-shut');gb.setAttribute('aria-expanded',String(!on))};
  if(o.before&&o.before.parentNode)o.before.parentNode.insertBefore(sec,o.before);else (o.into||document.body).appendChild(sec);
  let plat=guess(),timer=0,step=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,steps=false;
  const label=t=>{const l=gb.querySelector('span');if(l)l.textContent=t};

  function render(){
    clearTimeout(timer);
    /* ver and wireVer are declared before the installed branch uses them (they were after it, which threw and left the section empty in the installed app) */
    const ver=()=>window.__BUILD__?`<p class="sfi-note" style="margin-top:10px">Version ${window.__VERSION__?esc(String(window.__VERSION__))+' \u00b7 ':''}${esc(String(window.__BUILD__).replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d).*/,'$1-$2-$3 $4:$5'))} · <button type="button" class="sfi-chk" style="padding:0;border:0;background:none;color:var(--sfi-acc);font:inherit;text-decoration:underline;cursor:pointer">check for updates</button></p>`+notesHere():'';
    /* what this version brought (whatsnew.md, written in by export/v1/build.mjs as window.__NOTES__) */
    const notesHere=()=>{const n=(window.__NOTES__||[])[0];if(!n||!n.items||!n.items.length)return'';const K={new:'New',fix:'Fixed',change:'Changed'};
      return `<details class="sfi-new" style="margin-top:6px"><summary style="cursor:pointer;color:var(--sfi-acc)">What\u2019s new in ${esc(n.v)}</summary><ul style="margin:8px 0 0;padding:0;list-style:none;display:grid;gap:6px">`+
        n.items.map(it=>window.SurfaceFresh&&SurfaceFresh.kind   /* the kind's icon (kit fresh.js: sparkle, squashed bug, turning arrows), a 16 px slot */
          ?`<li style="display:grid;grid-template-columns:16px 50px 1fr;gap:8px;align-items:start;position:relative">${SurfaceFresh.kind(it.kind)}<span>${esc(it.text)}</span></li>`
          :`<li style="display:grid;grid-template-columns:58px 1fr;gap:8px;align-items:baseline"><span style="font:600 9px/1 var(--mono,ui-monospace,monospace);letter-spacing:.12em;text-transform:uppercase;opacity:.7">${K[it.kind]||''}</span><span>${esc(it.text)}</span></li>`).join('')+'</ul></details>'};
    /* the button is wired whether or not the update checker has loaded yet: the guide is built before the end of the page,
       where the checker lives, so testing for it here left the button dead (Dimitry, 18 Oct 2026). It looks at click time. */
    const wireVer=()=>{const b=body.querySelector('.sfi-chk');if(!b)return;const idle='check for updates';
      b.onclick=()=>{if(b.dataset.busy)return;b.dataset.busy='1';b.textContent='checking\u2026';
        const done=t=>{b.textContent=t;b.setAttribute('aria-live','polite');setTimeout(()=>{delete b.dataset.busy;b.textContent=idle},5000)};
        if(typeof window.checkForUpdate!=='function'){done('updates are checked on the published app');return}
        window.checkForUpdate(false).then(r=>done(r==='current'?'\u2713 you have the newest'+(window.__VERSION__?' ('+window.__VERSION__+')':''):r==='new'?'a newer version is ready: see the top of the screen':r==='busy'?'still checking\u2026':'could not check (offline?)'),()=>done('could not check (offline?)'))}};
    label(standalone()||(!embedded()&&installedHere())?'Installed':'Install');
    if(standalone()){body.innerHTML=`<p class="sfi-state"><b>Installed.</b> You are in ${app} as an app. It opens from its own icon and keeps working offline once it has loaded.</p>`+ver();wireVer();linkRow();return}
    if(embedded()){body.innerHTML=`<p class="sfi-lead">${app} can live on your phone or computer as its own app: full screen, its own icon, and it keeps working offline.</p>
      <p class="sfi-state">Here inside Claude, installing would save Claude, not ${app}. Open the public version and install it from there:</p>
      <a class="sfi-go" href="${esc(o.url)}" target="_blank" rel="noopener">${ICON_EXT}Open ${app}</a> <button type="button" class="sfi-go ghost" data-copy>Copy link</button>`;
      const cp=body.querySelector('[data-copy]');cp.onclick=()=>{(navigator.clipboard?navigator.clipboard.writeText(o.url):Promise.reject()).then(()=>{cp.textContent='Copied'},()=>{cp.textContent=o.url})};return}
    if(installedHere()&&!steps){body.innerHTML=`<p class="sfi-state"><b>Installed on this device.</b> Open ${app} from its own icon for full screen and offline use.</p>
      <p class="sfi-note">On another device, or removed it? <button type="button" data-steps style="padding:0;border:0;background:none;color:var(--sfi-acc);font:inherit;text-decoration:underline;cursor:pointer">show the install steps</button></p>`+ver();
      body.querySelector('[data-steps]').onclick=()=>{steps=true;render()};wireVer();linkRow();return}
    const sc=SCENES[plat];
    let h=`<p class="sfi-lead">Keep ${app} as its own app: full screen, its own icon, and it keeps working offline.</p>`;
    if(BIP)h+=`<button type="button" class="sfi-go" data-bip>${ICON_DL}Install ${app}</button>`;
    h+=`<div class="sfi-plats" role="group" aria-label="Device and browser">${ORDER.map(k=>`<button type="button" data-p="${k}" aria-pressed="${k===plat||(plat==='android-firefox'&&k==='android')}">${esc(SCENES[k].short||SCENES[k].name)}</button>`).join('')}</div>`;
    if(!sc.steps){h+=`<p class="sfi-state">${esc(sc.text)}</p>`;body.innerHTML=h;wire();return}
    const dev=sc.dev===PHONE?'phone':'laptop';h+=`<p class="sfi-note" style="margin-bottom:6px">${esc(sc.name)}</p>`;
    const layers=Object.entries(sc.layers).map(([k,v])=>`<g data-l="${k}">${v}</g>`).join('');
    h+=`<div class="sfi-stage ${dev}" aria-hidden="true"><svg viewBox="${sc.dev.vb}">${sc.dev.body}${layers}<circle class="sfi-tap" r="5" fill="none" stroke="#fff" stroke-width="1.6"/></svg></div>
      <p class="sfi-cap" aria-live="polite"></p>
      <div class="sfi-ctl"><button type="button" data-pp>${playing?'Pause':'Play'}</button><button type="button" data-rs>From the start</button></div>
      <ol class="sfi-steps">${sc.steps.map((s,i)=>`<li><button type="button" data-s="${i}">${esc(s.cap)}</button></li>`).join('')}</ol>
      ${sc.note?`<p class="sfi-note">${esc(sc.note)}</p>`:''}`+ver();
    body.innerHTML=h;wire();wireVer();show(0);linkRow();
  }
  // link:true (needs links.js): a line to copy a link straight to these steps, for sending to someone
  function linkRow(){if(!o.link||!window.SurfaceLinks)return;const p=document.createElement('p');p.className='sfi-link';
    p.style.cssText='display:flex;align-items:center;gap:6px;margin:10px 0 0;font:500 10px/1.3 var(--mono,ui-monospace,monospace);letter-spacing:.12em;text-transform:uppercase;color:var(--ui-dim,#8a9396)';
    p.append('Send someone straight here',SurfaceLinks.button('install','the install steps'));body.appendChild(p)}
  function show(i){
    const sc=SCENES[plat];if(!sc||!sc.steps)return;step=(i+sc.steps.length)%sc.steps.length;const s=sc.steps[step];
    body.querySelectorAll('[data-l]').forEach(g=>g.classList.toggle('on',s.show.includes(g.dataset.l)));
    // restart the pop on the step it belongs to
    body.querySelectorAll('.sfi-pop').forEach(p=>{p.style.animation='none';void p.getBBox;requestAnimationFrame(()=>p.style.animation='')});
    const tp=body.querySelector('.sfi-tap');if(tp){tp.classList.remove('on');if(s.tap){tp.setAttribute('cx',s.tap[0]);tp.setAttribute('cy',s.tap[1]);void tp.getBoundingClientRect();tp.classList.add('on')}}
    const cap=body.querySelector('.sfi-cap');if(cap)cap.textContent=String(step+1).padStart(2,'0')+'  '+s.cap;
    body.querySelectorAll('[data-s]').forEach(b=>{if(+b.dataset.s===step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});
    clearTimeout(timer);if(playing&&sec.isConnected)timer=setTimeout(()=>show(step+1),step===sc.steps.length-1?2600:1900);
  }
  function wire(){
    body.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{plat=b.dataset.p;render()});
    body.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{playing=false;show(+b.dataset.s);const pp=body.querySelector('[data-pp]');if(pp)pp.textContent='Play'});
    const pp=body.querySelector('[data-pp]');if(pp)pp.onclick=()=>{playing=!playing;pp.textContent=playing?'Pause':'Play';show(step)};
    const rs=body.querySelector('[data-rs]');if(rs)rs.onclick=()=>{show(0)};
    const bi=body.querySelector('[data-bip]');if(bi)bi.onclick=async()=>{const e=BIP;if(!e)return;BIP=null;e.prompt();try{await e.userChoice}catch(_){}render()};
  }
  bipWaiters.push(()=>render());
  ['standalone','fullscreen','minimal-ui'].forEach(m=>matchMedia('(display-mode: '+m+')').addEventListener?.('change',render));
  render();

  // the one-time hint: after a while of use, only where installing works and it isn't installed; twice at most
  let hintEl=null;
  function hint(){
    if(!o.hint||standalone()||embedded()||installedHere()||(store.get('hint')||0)>=2||store.get('installed'))return;
    const can=BIP||APPLE_MOBILE||MAC_SAFARI||ANDROID;if(!can)return;
    hintEl=document.createElement('div');hintEl.className='sfi-hint';hintEl.setAttribute('role','status');
    hintEl.innerHTML=`<button type="button" class="o">${ICON_DL}Keep ${app} as an app</button><button type="button" class="x" aria-label="Not now">×</button>`;
    document.body.appendChild(hintEl);requestAnimationFrame(()=>hintEl.classList.add('show'));
    store.set('hint',(store.get('hint')||0)+1);
    const close=()=>{hintEl.classList.remove('show');setTimeout(()=>hintEl&&hintEl.remove(),300)};
    hintEl.querySelector('.x').onclick=()=>{store.set('hint',9);close()};
    hintEl.querySelector('.o').onclick=()=>{close();if(BIP&&!APPLE_MOBILE){const e=BIP;BIP=null;e.prompt();return}openGuide()};
    setTimeout(close,14000);
  }
  function openGuide(){if(typeof o.open==='function')o.open();sec.classList.remove('cx-shut');gb.setAttribute('aria-expanded','true');
    setTimeout(()=>{if(window.SurfaceLinks&&SurfaceLinks.reveal)SurfaceLinks.reveal(sec);else sec.scrollIntoView({block:'start'});show(0)},320)}
  addEventListener('appinstalled',()=>{store.set('installed',true);render()});
  if(o.hint)setTimeout(hint,o.hintAfter);
  return {section:sec,open:openGuide,render,platform:()=>plat,setPlatform:p=>{if(SCENES[p]){plat=p;render()}}};
}
/* installed() (20 Oct, additive): true when running as the app, or when this browser knows it is installed on this
   device (Chrome/Edge say so; elsewhere remembered from installing here; Safari can't tell, so it stays false there).
   onChange(f) runs f whenever that may have changed (the browser offers install, an install finishes, the check returns). */
const installed=()=>standalone()||installedHere();
const onChange=f=>{if(typeof f==='function'){bipWaiters.push(f);try{matchMedia('(display-mode: standalone)').addEventListener('change',f)}catch(_){}}};
window.SurfaceInstall={mount,guess,standalone,embedded,installed,onChange,scenes:()=>SCENES};
})();
