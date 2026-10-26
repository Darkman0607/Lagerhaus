/** U09 / schematic interactive axonometric warehouse scene.
 * Geometry is purely a presentation of real locations; it never changes stocks.
 * Native SVG (not WebGL): responsive/offline and accessible with a 2D/list fallback.
 */
import {escapeHtml as esc} from '../core/escape.js';
import {icon} from '../core/icons.js';
const safe=v=>esc(String(v??''));
const KNOWN=['standort','raum','regal','fach','box'];
const LABELS={standort:'Standort',raum:'Raum',regal:'Regal',fach:'Fach',box:'Box'};
const MAX_SCENE=28;
const DEG=Math.PI/180;
const initial=()=>({mode:'3d',angle:325,zoom:1,panX:0,panY:0,selected:null});
const state=initial();
let locations=[];
export const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export const turnAngle=n=>((n%360)+360)%360;
export function cameraProject(x,y,z,camera=state){
 const angle=camera.angle*DEG,c=Math.cos(angle),s=Math.sin(angle);
 const xr=x*c-z*s,zr=x*s+z*c;
 return {x:450+camera.panX+xr*45*camera.zoom,y:331+camera.panY+(zr*23-y*49)*camera.zoom,depth:zr};
}
export function sceneStatus(place){
 const rows=Array.isArray(place?.items)?place.items:[];
 const missing=rows.filter(a=>a.quantity===0).length;
 const low=rows.filter(a=>a.quantity>0&&a.lowStock).length;
 return {count:Number(place?.articleCount)||0,missing,low,warnings:missing+low,level:missing?'missing':low?'low':'ok'};
}
export function layoutScene(places){
 const sorted=[...places].sort((a,b)=>String(a.path||a.name).localeCompare(String(b.path||b.name),'de'));
 const visible=sorted.slice(0,MAX_SCENE);
 const columns=clamp(Math.ceil(Math.sqrt(Math.max(visible.length,1)*1.4)),2,6);
 const rows=Math.max(1,Math.ceil(visible.length/columns));
 return {slots:visible.map((p,i)=>({...p,ix:i%columns,iz:Math.floor(i/columns),x:(i%columns-(columns-1)/2)*1.95,z:(Math.floor(i/columns)-(rows-1)/2)*1.95})),columns,rows,omitted:Math.max(0,sorted.length-MAX_SCENE)};
}
function polygon(points,paint,attributes=''){return `<polygon points="${points.map(q=>`${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')}" fill="${paint}" ${attributes}/>`;}
function cuboid(x,z,width,depth,height,style,camera,baseY=0){
 const p=(i,j,k)=>cameraProject(i,j,k,camera);
 const A=p(x,baseY,z),B=p(x+width,baseY,z),C=p(x+width,baseY,z+depth),D=p(x,baseY,z+depth);
 const E=p(x,baseY+height,z),F=p(x+width,baseY+height,z),G=p(x+width,baseY+height,z+depth),H=p(x,baseY+height,z+depth);
 const edge='stroke="#50636b" stroke-width="1.1" stroke-linejoin="round"';
 return `<g>${polygon([D,C,G,H],style.front,edge)}${polygon([B,C,G,F],style.side,edge)}${polygon([A,B,F,E],style.back,edge)}${polygon([E,F,G,H],style.top,edge)}</g>`;
}
function shelfGeometry(loc,camera){
 const {x,z}=loc,baseX=x-.66,baseZ=z-.54;
 const h=loc.kind==='box'?.68:loc.kind==='fach'?.87:1.88;
 const scale=loc.kind==='box'?.65:loc.kind==='fach'?.80:1;
 const w=1.28*scale,d=.96*scale;
 let markup=`<ellipse cx="${cameraProject(x,0,z,camera).x.toFixed(1)}" cy="${(cameraProject(x,0,z,camera).y+4).toFixed(1)}" rx="${(48*camera.zoom).toFixed(1)}" ry="${(18*camera.zoom).toFixed(1)}" fill="#020908" opacity=".46"/>`;
 if(loc.kind==='box'||loc.kind==='fach'){
   markup+=cuboid(baseX,baseZ,w,d,h,{front:'#425b64',side:'#233a41',back:'#3f5860',top:'#79949a'},camera);
   const q=cameraProject(x,h+.06,z,camera);
   markup+=`<circle cx="${q.x}" cy="${q.y}" r="${6*camera.zoom}" fill="#d9ad58" stroke="#10262d" stroke-width="2"/>`;
   return markup;
 }
 // Real shelves, not a flat illustration: depth, elevated shelves and stock cartons.
 markup+=cuboid(baseX,baseZ,w,d,.07,{front:'#465962',side:'#273e46',back:'#465962',top:'#79929a'},camera,0);
 const levels=[.25,.75,1.25,1.77];
 for(const y of levels){markup+=cuboid(baseX,baseZ,w,d,.09,{front:'#526f7b',side:'#344b54',back:'#546d78',top:'#8ba3aa'},camera,y);}
 const palette=['#d39d51','#b65a3d','#4a9b88','#c4b487','#6794ac'];
 for(let j=0;j<3;j++)for(let k=0;k<2;k++){
   const bx=baseX+.12+k*.58*scale,bz=baseZ+.10+(j%2)*.25*scale;
   const boxY=levels[j]+.10;
   markup+=cuboid(bx,bz,.43*scale,.38*scale,.34,{front:palette[(j*2+k)%palette.length],side:'#3c4a48',back:'#b5a274',top:'#e0be78'},camera,boxY);
 }
 for(const [xx,zz] of [[baseX,baseZ],[baseX+w,baseZ],[baseX,baseZ+d],[baseX+w,baseZ+d]]){
   const a=cameraProject(xx,0,zz,camera),b=cameraProject(xx,h,zz,camera);
   markup+=`<path d="M${a.x},${a.y} L${b.x},${b.y}" stroke="#a1bdc4" stroke-width="${(3.2*camera.zoom).toFixed(2)}" stroke-linecap="square"/>`;
 }
 return markup;
}
function floorScene(camera,layout){
 const spanX=Math.max(4.4,layout.columns*1.95),spanZ=Math.max(3.8,layout.rows*1.95),sx=spanX/2+.8,sz=spanZ/2+.8;
 const p=(x,y,z)=>cameraProject(x,y,z,camera);
 let r=`<defs><linearGradient id="lh-u09-floor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#384b4f"/><stop offset=".58" stop-color="#24383d"/><stop offset="1" stop-color="#13272b"/></linearGradient><linearGradient id="lh-u09-wall"><stop stop-color="#25383f"/><stop offset="1" stop-color="#52676a"/></linearGradient><filter id="lh-u09-glow"><feGaussianBlur stdDeviation="8"/></filter></defs>`;
 const base=[p(-sx,0,-sz),p(sx,0,-sz),p(sx,0,sz),p(-sx,0,sz)];
 r+=polygon(base,'url(#lh-u09-floor)','stroke="#7e999a" stroke-width="2"');
 // Two translucent rear wall sections and wall columns indicate spatial volume.
 const wallA=[p(-sx,0,-sz),p(sx,0,-sz),p(sx,2.2,-sz),p(-sx,2.2,-sz)];
 const wallB=[p(-sx,0,-sz),p(-sx,0,sz),p(-sx,2.2,sz),p(-sx,2.2,-sz)];
 r+=polygon(wallA,'url(#lh-u09-wall)','fill-opacity=".29" stroke="#71888b" stroke-opacity=".4"')+polygon(wallB,'#30464f','fill-opacity=".34" stroke="#71888b" stroke-opacity=".4"');
 for(let x=-sx+1;x<sx;x+=1){r+=`<path d="M${p(x,0,-sz).x},${p(x,0,-sz).y} L${p(x,0,sz).x},${p(x,0,sz).y}" stroke="#759296" stroke-opacity=".17" stroke-width=".9"/>`;}
 for(let z=-sz+1;z<sz;z+=1){r+=`<path d="M${p(-sx,0,z).x},${p(-sx,0,z).y} L${p(sx,0,z).x},${p(sx,0,z).y}" stroke="#759296" stroke-opacity=".17" stroke-width=".9"/>`;}
 return r;
}
function sceneSvg(places=locations,camera=state){
 const layout=layoutScene(places);
 const centered=layout.slots.slice().sort((a,b)=>cameraProject(a.x,0,a.z,camera).depth-cameraProject(b.x,0,b.z,camera).depth);
 let svg=floorScene(camera,layout),labels='';
 const labelled=centered.slice(0,10);
 // Labels are stationed in collision-free CAD callout columns, not floating over shelves.
 for(const p of centered){
  const status=sceneStatus(p),selected=p.id===camera.selected;
  const xy=cameraProject(p.x,0,p.z,camera),label=cameraProject(p.x,2.02,p.z,camera);
  const accent=status.missing?'#ff7378':status.low?'#f0b45c':'#43f5a3';
  svg+=`<g class="u09-shelf ${selected?'u09-is-selected':''}" data-u09-select="${safe(p.id)}" role="button" tabindex="0" aria-label="${safe(p.path||p.name)}: ${status.count} Artikel, ${status.missing} fehlen, ${status.low} niedrig"><title>${safe(p.path||p.name)} · ${status.count} Artikel</title>`;
  svg+=`<ellipse cx="${xy.x}" cy="${xy.y}" rx="${42*camera.zoom}" ry="${18*camera.zoom}" fill="${accent}" fill-opacity="${selected?.28:.09}"/>`;
  svg+=shelfGeometry(p,camera)+`</g>`;
  let idx=labelled.findIndex(q=>q.id===p.id);
  if(idx<0&&selected){idx=10;}
  if(idx<0)continue;
  const right=idx%2===1,sideIndex=Math.floor(idx/2);
  const bx=right?731:33,by=83+sideIndex*82; // 132 × 46, no overlaps for the first 10
  const anchorX=right?bx:bx+136,anchorY=by+24;
  const name=p.name.length>18?p.name.slice(0,17)+'…':p.name;
  labels+=`<path d="M${label.x.toFixed(1)},${(label.y+4).toFixed(1)} L${(right?anchorX-15:anchorX+15)},${anchorY} L${anchorX},${anchorY}" fill="none" stroke="${accent}" stroke-opacity=".67" stroke-width="1.35" stroke-dasharray="4 3"/>`;
  labels+=`<g data-u09-select="${safe(p.id)}" class="u09-callout" aria-label="${safe(p.path||p.name)}"><rect class="u09-label-card" x="${bx}" y="${by}" width="136" height="48" rx="9" fill="${selected?'#195044':'#0a1c22'}" fill-opacity=".96" stroke="${accent}" stroke-width="${selected?2.4:1.15}"/><text x="${bx+68}" y="${by+18}" text-anchor="middle" class="u09-svg-title">${safe(name)}</text><text x="${bx+68}" y="${by+35}" text-anchor="middle" class="u09-svg-sub">${status.count} Artikel${status.warnings?' · '+status.warnings+' ⚠':''}</text></g>`;
 }
 svg+=labels;
 if(layout.slots.length>10){svg+=`<text x="450" y="527" text-anchor="middle" font-size="11" fill="#b2d3c7">${layout.slots.length-10} weitere Orte direkt am Regal oder über die Liste wählen</text>`;}
 if(!layout.slots.length)svg+=`<g><text x="450" y="252" text-anchor="middle" fill="#d5efe0" font-size="22" font-weight="740">Dein Lager ist noch leer</text><text x="450" y="282" text-anchor="middle" fill="#9fbcb4" font-size="14">Lege unten einen Lagerort an. Es werden keine Demodaten erzeugt.</text></g>`;
 return `<svg id="u09-svg" role="group" aria-label="Schematische drehbare 3D-Lageransicht mit ${places.length} echten Lagerorten" viewBox="0 0 900 560" preserveAspectRatio="xMidYMid meet">${svg}</svg>`;
}
function selectedDetails(){const p=locations.find(x=>x.id===state.selected);
 if(!p)return `<div class="u09-selected u09-selected-empty"><strong>Ort auswählen</strong><p>Regal oder Bereich antippen – echte Bestände und Status erscheinen hier.</p></div>`;
 const s=sceneStatus(p);
 return `<div class="u09-selected"><div class="u09-selected-head"><span class="u09-kicker">AUSGEWÄHLTER LAGERORT</span><strong>${safe(p.path||p.name)}</strong><span class="u09-selected-stats"><b>${s.count} Artikel</b> <span class="${s.missing?'u09-status-missing':s.low?'u09-status-low':'u09-status-good'}">${s.missing?`${s.missing} fehlt`:s.low?`${s.low} wenig`:'Bestand OK'}</span></span></div><div class="u09-detail-items">${p.items.length?p.items.map(a=>`<a href="#/articles/location/${safe(p.id)}">${safe(a.name)} <span>${safe(a.quantity)} ${safe(a.unit)}${a.lowStock?' ⚠':''}</span></a>`).join(''):'<span>Noch keine Artikel hier.</span>'}</div><a class="secondary-btn u09-open" href="#/articles/location/${safe(p.id)}">Alle Artikel des Orts öffnen</a></div>`;
}
function twoDView(){const {slots,omitted}=layoutScene(locations);
 return `<div class="u09-2d-grid">${slots.map(p=>{const s=sceneStatus(p);return `<button type="button" class="u09-plan-tile ${p.id===state.selected?'active':''} u09-level-${s.level}" data-u09-action="select" data-id="${safe(p.id)}"><span>${safe(LABELS[p.kind]||'Ort')}</span><strong>${safe(p.name)}</strong><small>${s.count} Artikel</small>${s.warnings?`<em>${s.warnings} Warnungen</em>`:''}</button>`;}).join('')||'<p>Keine Lagerorte vorhanden.</p>'}</div>${omitted?`<p class="u09-footnote">Weitere ${omitted} Lagerorte sind über die Liste erreichbar.</p>`:''}`;
}
function listView(){return `<div class="u09-list">${locations.map(p=>{const s=sceneStatus(p);return `<div class="u09-list-row"><button type="button" data-u09-action="select" data-id="${safe(p.id)}"><strong>${safe(p.path||p.name)}</strong><small>${safe(LABELS[p.kind]||'Lagerort')} · ${s.count} Artikel · ${s.missing} fehlend · ${s.low} wenig</small></button><a class="secondary-btn" href="#/articles/location/${safe(p.id)}">Artikel öffnen</a></div>`;}).join('')||'<div class="location-empty">Keine Lagerorte vorhanden.</div>'}</div>`;}
function sceneContent(){if(state.mode==='2d')return twoDView();if(state.mode==='list')return listView();return sceneSvg();}
function controls(){return `<div class="u09-scene-actions"><button data-u09-action="left" type="button" aria-label="Links drehen">↶ 30°</button><button data-u09-action="right" type="button" aria-label="Rechts drehen">30° ↷</button><button data-u09-action="zoom-in" type="button" aria-label="Vergrößern">+</button><button data-u09-action="zoom-out" type="button" aria-label="Verkleinern">−</button><button data-u09-action="pan-left" type="button" aria-label="Ansicht nach links verschieben">←</button><button data-u09-action="pan-right" type="button" aria-label="Ansicht nach rechts verschieben">→</button><button data-u09-action="reset" type="button" aria-label="Ansicht zurücksetzen">⤾</button></div>`;}
export function warehouse3DPanel(places){locations=[...places];if(state.selected&&!locations.some(x=>x.id===state.selected))state.selected=null;
 const s=locations.reduce((out,p)=>{const row=sceneStatus(p);return {count:out.count+row.count,warnings:out.warnings+row.warnings};},{count:0,warnings:0});
 return `<section class="panel u09-panel" id="u09-panel" aria-labelledby="u09-title"><div class="u09-head"><div><p class="eyebrow">LAGERHAUS / VISUELLE LAGERPLANUNG</p><h2 id="u09-title">Interaktive Lageransicht</h2><p>Industrie-Optik nach Vorlage · echte Lagerorte und Bestände</p></div><div class="u09-overview"><span><b>${locations.length}</b> Orte</span><span><b>${s.count}</b> Positionen</span><span class="${s.warnings?'u09-status-low':''}"><b>${s.warnings}</b> Warnungen</span></div></div>
 <div class="u09-toolbar" role="group" aria-label="Lageransicht wählen">${[['3d','3D-Ansicht'],['2d','2D-Plan'],['list','Liste']].map(([mode,label])=>`<button type="button" data-u09-action="mode" data-mode="${mode}" class="${state.mode===mode?'active':''}" aria-pressed="${state.mode===mode}">${label}</button>`).join('')}<span class="u09-mode-note">Schematisch · keine echten Raummaße</span></div>
 <div class="u09-layout"><div class="u09-stage-wrap"><div id="u09-stage" class="u09-stage ${state.mode==='3d'?'u09-active':''}" aria-live="off">${sceneContent()}</div>${state.mode==='3d'?controls():''}<div class="u09-footnote">${state.mode==='3d'?'Mit einem Finger drehen, mit zwei Fingern verschieben und zoomen. Alternativ: Schaltflächen.':'Die Darstellung greift auf dieselben echten Daten zu wie die Lagerortliste.'}${locations.length>MAX_SCENE&&state.mode!=='list'?` · ${locations.length-MAX_SCENE} weitere Orte in der Liste.`:''}</div></div><div id="u09-selected-region">${selectedDetails()}</div></div></section>`;
}
function redraw(stage=true){if(typeof document==='undefined')return;
 const panel=document.getElementById('u09-panel');if(!panel)return;
 const el=panel.querySelector('#u09-stage');if(el&&stage){el.innerHTML=sceneContent();el.classList.toggle('u09-active',state.mode==='3d');}
 const info=panel.querySelector('#u09-selected-region');if(info)info.innerHTML=selectedDetails();
}
export function getSceneCamera(){return {...state};}
export function sceneAction(action,{id=null,mode=null}={}){
 switch(action){case 'mode':if(!['3d','2d','list'].includes(mode))return false;state.mode=mode;break;
 case 'select':if(!locations.some(p=>p.id===id))return false;state.selected=id;break;
 case 'left':state.angle=turnAngle(state.angle-30);break;
 case 'right':state.angle=turnAngle(state.angle+30);break;
 case 'zoom-in':state.zoom=clamp(state.zoom*1.18,.58,1.8);break;
 case 'zoom-out':state.zoom=clamp(state.zoom/1.18,.58,1.8);break;
 case 'pan-left':state.panX=clamp(state.panX-40,-220,220);break;
 case 'pan-right':state.panX=clamp(state.panX+40,-220,220);break;
 case 'reset':Object.assign(state,{angle:325,zoom:1,panX:0,panY:0});break;
 default:return false;}
 return true;
}
export function handleSceneClick(button){if(sceneAction(button.dataset.u09Action,{id:button.dataset.id,mode:button.dataset.mode})){
 const panel=document.getElementById('u09-panel');if(button.dataset.u09Action==='mode'&&panel){
 panel.querySelector('.u09-stage-wrap').innerHTML=`<div id="u09-stage" class="u09-stage ${state.mode==='3d'?'u09-active':''}">${sceneContent()}</div>${state.mode==='3d'?controls():''}<div class="u09-footnote">${state.mode==='3d'?'Mit einem Finger drehen, mit zwei Fingern verschieben und zoomen. Alternativ: Schaltflächen.':'Alle Orte nutzen dieselben Bestandsdaten.'}</div>`;
 panel.querySelectorAll('.u09-toolbar button').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));});
 installWarehouseGestures();}
 else redraw();}}
export function handleSceneKey(event){const target=event.target.closest?.('[data-u09-select]');if(!target||!['Enter',' '].includes(event.key))return;event.preventDefault();if(sceneAction('select',{id:target.dataset.u09Select}))redraw();}
let dispose=null;
export function installWarehouseGestures(){if(dispose){dispose();dispose=null;}if(state.mode!=='3d'||typeof document==='undefined')return;
 const el=document.getElementById('u09-stage');if(!el)return;
 const pointers=new Map();let prevDist=0,prevCenter=null,dragged=false;
 function start(e){if(!e.isPrimary&&e.pointerType==='mouse')return;if(e.pointerType==='mouse'&&e.button!==0)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});prevDist=0;prevCenter=null;dragged=false;el.setPointerCapture?.(e.pointerId);}
 function move(e){if(!pointers.has(e.pointerId))return;
  const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){const dx=e.clientX-old.x;if(Math.abs(dx)>1||Math.abs(e.clientY-old.y)>1){dragged=true;state.angle=turnAngle(state.angle+dx*.7);redraw();}}
  else if(pointers.size===2){const [a,b]=[...pointers.values()];const dist=Math.hypot(a.x-b.x,a.y-b.y),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(prevDist>0){state.zoom=clamp(state.zoom*dist/prevDist,.58,1.8);}if(prevCenter){state.panX=clamp(state.panX+(mid.x-prevCenter.x)*.75,-220,220);state.panY=clamp(state.panY+(mid.y-prevCenter.y)*.75,-150,150);}prevDist=dist;prevCenter=mid;dragged=true;redraw();}
 }
 function end(e){pointers.delete(e.pointerId);prevDist=0;prevCenter=null;if(dragged){el.dataset.dragged='true';setTimeout(()=>delete el.dataset.dragged,90);}}
 function wheel(e){e.preventDefault();state.zoom=clamp(state.zoom*(e.deltaY<0?1.07:1/1.07),.58,1.8);redraw();}
 el.addEventListener('pointerdown',start);el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('wheel',wheel,{passive:false});
 dispose=()=>{el.removeEventListener('pointerdown',start);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);el.removeEventListener('wheel',wheel);pointers.clear();};
}
export function chooseSceneFromSVG(node){const id=node?.dataset?.u09Select;if(!id)return;if(sceneAction('select',{id}))redraw();}
export function detachWarehouseGestures(){if(dispose){dispose();dispose=null;}}
