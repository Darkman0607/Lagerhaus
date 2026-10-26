import {icon} from '../core/icons.js';
import {escapeHtml as esc} from '../core/escape.js';
import {repository} from '../data/store.js';
import {createLocation,updateLocation,archiveLocation,locationOverview,recentTransfers,transferStock,undoTransfer,locationPath,LOCATION_KINDS} from '../data/locations.js';
const safe=v=>esc(v??'');
const fmt=n=>new Intl.NumberFormat('de-AT',{maximumFractionDigits:3}).format(n);
let places=[],items=[],stocks=[],history=[];
const levels=new Map(LOCATION_KINDS);
function placeOptions(chosen='',exclude=''){
 return `<option value="">Oberste Ebene</option>`+places.filter(p=>p.id!==exclude).map(p=>`<option value="${safe(p.id)}" ${p.id===chosen?'selected':''}>${safe(p.path)}</option>`).join('');
}
function articleOptions(){return items.filter(a=>!a.archivedAt&&stocks.some(s=>s.articleId===a.id&&s.quantity>0)).sort((a,b)=>a.name.localeCompare(b.name,'de')).map(a=>`<option value="${safe(a.id)}">${safe(a.name)}</option>`).join('');}
function hierarchy(p){const depth=p.path.split(' / ').length-1;return `<div class="location-card" data-location-id="${safe(p.id)}" style="--loc-depth:${Math.min(8,depth)}"><div class="location-card-head"><div><div class="location-eyebrow">${safe(levels.get(p.kind)||'Raum')} · ${safe(p.path)}</div><h3>${safe(p.name)}</h3></div><span class="location-count">${p.articleCount} Artikel</span></div>
 <div class="location-indicators"><span>${icon('box',15)} ${p.articleCount} belegte Positionen</span><span>★ ${p.favorites} Favoriten</span><span class="${p.warnings?'location-warning':''}">● ${p.warnings} Bestandswarnungen</span></div>
 ${p.items.length?`<div class="location-items">${p.items.map(s=>`<div class="location-item"><strong>${safe(s.name)}</strong><span>${fmt(s.quantity)} ${safe(s.unit)} ${s.favorite?'★':''}${s.lowStock?' ⚠':''}</span></div>`).join('')}</div>`:'<div class="location-empty">Noch kein Bestand zugeordnet.</div>'}
 <div class="location-actions"><a href="#/articles/location/${safe(p.id)}" class="secondary-btn location-link">Artikel ansehen</a><button type="button" data-location-action="edit" data-id="${safe(p.id)}">Umbenennen / ändern</button><button type="button" data-location-action="archive" data-id="${safe(p.id)}" class="location-danger">Archivieren</button></div></div>`;}
function transferOptions(selected,all=false){return places.map(p=>`<option value="${safe(p.id)}" ${p.id===selected?'selected':''}>${safe(p.path)}</option>`).join('');}
export async function warehouseView(){const [p,a,s,t]=await Promise.all([locationOverview(),repository.articles(),repository.stocks(),recentTransfers()]);places=p;items=a;stocks=s;history=t;
 return `<section class="page-heading"><div><p class="eyebrow">STRUKTUR / LAGERORTE</p><h1>Lager</h1><p>Standorte, Räume, Regale, Fächer und Boxen mit echten Ortsbeständen.</p></div><span class="chip">3D-Ansicht folgt in U09</span></section>
 <article class="panel location-panel"><div class="list-heading"><div>${icon('layers',18)} <strong>Ortsverwaltung</strong></div><span class="chip quiet">${places.length} aktive Orte</span></div>
 <p class="location-hint">Jeder Ort hat eine eindeutige ID. Du kannst ihn ohne Bestandsverlust umbenennen oder verschachteln. Mehrere Orte pro Artikel sind möglich.</p>
 <form id="location-form" class="location-create-form"><label>Name des Lagerorts<input name="name" required maxlength="100" placeholder="z. B. Garage, Regal A, Box Technik"></label><label>Typ<select name="kind">${LOCATION_KINDS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label>Untergeordnet unter<select name="parentId">${placeOptions()}</select></label><button type="submit" class="primary-btn">${icon('plus',16)} Ort hinzufügen</button></form>
 <p class="location-error" id="location-error" role="alert" hidden></p>
 ${places.length?`<div class="location-grid">${places.slice().sort((x,y)=>x.path.localeCompare(y.path,'de')).map(hierarchy).join('')}</div>`:`<div class="large-empty">${icon('layers',30)}<h2>Keine Lagerorte vorhanden</h2><p>Lege einen Standort oder Raum an und ordne anschließend deine Artikel zu.</p></div>`}
 </article>
 <article class="panel location-transfer-panel"><div class="list-heading"><div>${icon('arrow-left-right',18)} <strong>Bestand umlagern</strong></div></div><p class="location-hint">Die Summe bleibt erhalten: Menge wird atomar am Quellort abgezogen und am Ziel hinzugefügt. Jede Umlagerung ist nachvollziehbar.</p>
 <form id="location-transfer-form" class="location-transfer-form"><label>Artikel<select name="articleId" required><option value="">Artikel auswählen</option>${articleOptions()}</select></label><label>Von<select name="sourceLocationId" required><option value="">Quelle wählen</option>${transferOptions()}</select></label><label>Nach<select name="targetLocationId" required><option value="">Ziel wählen</option>${transferOptions()}</select></label><label>Menge<input type="number" name="quantity" required min="0.001" step="0.001" max="1000000000"></label><label class="wide">Notiz (optional)<input name="note" maxlength="500" placeholder="z. B. ins Kellerregal umgeräumt"></label><button type="submit" class="primary-btn">Umlagern</button></form><p id="location-transfer-error" class="location-error" hidden role="alert"></p>
 <h3 class="location-subtitle">Letzte Umlagerungen</h3><div class="location-history">${history.length?history.map(t=>{const item=items.find(a=>a.id===t.articleId);const source=places.find(p=>p.id===t.sourceLocationId),target=places.find(p=>p.id===t.targetLocationId);
 return `<div class="location-history-row"><div><strong>${safe(item?.name||'Artikel')}</strong><small>${safe(source?.path||'Alter Ort')} → ${safe(target?.path||'Alter Ort')} · ${fmt(t.quantity)} ${safe(item?.unit||'')} · ${safe(new Date(t.createdAt).toLocaleString('de-AT'))}</small>${t.note?`<small>${safe(t.note)}</small>`:''}</div>${t.undoneAt?'<span class="chip quiet">Rückgängig</span>':`<button type="button" data-location-action="undo" data-id="${safe(t.id)}">Rückgängig</button>`}</div>`;}).join(''):'<div class="location-empty">Noch keine Umlagerung durchgeführt.</div>'}</div></article>
 <dialog class="catalog-dialog" id="location-editor" aria-labelledby="location-editor-title"></dialog>
 <article class="panel warehouse-future"><div class="future-caption"><span class="chip success">Bereits geplant · U09</span><h2>Isometrische Lageransicht</h2><p>Die geplante 3D-Ansicht nutzt exakt diese Lagerorte und Ortsbestände. Sie zeigt keine erfundenen Regale oder Mengen.</p></div></article>`;
}
function err(id,message){const e=document.getElementById(id);if(e){e.textContent=message;e.hidden=false;}}
export async function handleLocationSubmit(form,refresh){const submit=form.querySelector('[type="submit"]');submit.disabled=true;try{
 const data=Object.fromEntries(new FormData(form).entries());if(form.id==='location-form')await createLocation(data);
 else if(form.id==='location-transfer-form'){data.quantity=Number(data.quantity);await transferStock(data);}
 else if(form.id==='location-edit-form'){await updateLocation(form.dataset.id,{name:data.name,parentId:data.parentId||null,kind:data.kind});const dlg=document.getElementById('location-editor');if(dlg?.open)dlg.close();}else return;
 await refresh();
 }catch(e){err(form.id==='location-transfer-form'?'location-transfer-error':form.id==='location-edit-form'?'location-edit-error':'location-error',e.message||'Änderung fehlgeschlagen.');}finally{submit.disabled=false;}}
export async function handleLocationClick(button,refresh){const action=button.dataset.locationAction,id=button.dataset.id;
 try{if(action==='edit'){
 const p=places.find(p=>p.id===id);if(!p)return;const d=document.getElementById('location-editor');if(!d)return;
 d.innerHTML=`<div class="catalog-dialog-head"><span class="eyebrow">LAGERHAUS / ORTSDATEN</span><button type="button" class="modal-close" data-location-action="close" aria-label="Schließen">${icon('x',18)}</button></div><h2 id="location-editor-title">Lagerort bearbeiten</h2><p class="form-subtitle">Umbenennen oder verschieben – Bestände und Buchungen behalten ihre IDs.</p>
 <form id="location-edit-form" data-id="${safe(p.id)}" class="location-create-form location-edit-form"><label>Name<input required name="name" maxlength="100" value="${safe(p.name)}"></label><label>Typ<select name="kind">${LOCATION_KINDS.map(([v,label])=>`<option value="${v}" ${p.kind===v?'selected':''}>${label}</option>`).join('')}</select></label><label>Übergeordnet<select name="parentId">${placeOptions(p.parentId,p.id)}</select></label><div class="location-dialog-actions"><button type="button" class="secondary-btn" data-location-action="close">Abbrechen</button><button type="submit" class="primary-btn">Speichern</button></div></form><p id="location-edit-error" class="location-error" hidden role="alert"></p>`;
 if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');return;
 }else if(action==='close'){const d=document.getElementById('location-editor');if(d?.close)d.close();else d?.removeAttribute('open');return;
 }else if(action==='archive'){const p=places.find(p=>p.id===id);if(!p||!confirm(`Ort „${p.path}“ archivieren? Bestände, Unterorte und aktive Artikelverknüpfungen müssen vorher entfernt sein.`))return;await archiveLocation(id);
 }else if(action==='undo'){if(!confirm('Diese Umlagerung wirklich rückgängig machen?'))return;await undoTransfer(id);}else return;await refresh();
 }catch(e){alert(e.message||'Lagerortaktion fehlgeschlagen.');}}

export function handleLocationInput(event){
 if(!event.target.matches('[name="articleId"]')||event.target.closest('#location-transfer-form')===null)return;
 const id=event.target.value,source=document.querySelector('#location-transfer-form [name="sourceLocationId"]');if(!source)return;
 const prior=source.value;source.innerHTML='<option value="">Quelle wählen</option>'+stocks.filter(s=>s.articleId===id&&s.quantity>0).map(s=>{const p=places.find(l=>l.id===s.locationId);return p?`<option value="${safe(p.id)}">${safe(p.path)} · ${fmt(s.quantity)} verfügbar</option>`:'';}).join('');
 if([...source.options].some(x=>x.value===prior))source.value=prior;
}
