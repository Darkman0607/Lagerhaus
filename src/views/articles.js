import {icon} from '../core/icons.js';
import {escapeHtml as esc} from '../core/escape.js';
import {repository,StorageError} from '../data/store.js';
import {listCategories,createCategory,editCategory,reorderCategory,categoryPath,ARTICLE_KINDS} from '../data/categories.js';
import {locationPath} from '../data/locations.js';
import {articleContext, filterAndSort, normalizePreferences} from '../data/article-query.js';
import {bookStock} from '../data/bookings.js';
import {UNITS,convertQuantity,createCatalogArticle,updateCatalogArticle,duplicateCatalogArticle,deleteCatalogArticle,restoreArchivedArticle,articleImages,setArticleImage,setArticleFavorite} from '../data/catalog.js';
let knownArticles=[],knownLocations=[],knownStocks=[],knownPhotos=[],knownCategories=[],urls=[];
const safe=v=>esc(v??'');
const options=(values,selected)=>values.map(v=>`<option value="${safe(v)}" ${v===selected?'selected':''}>${safe(v)}</option>`).join('');
const displaySection={privat:'Privat',arbeit:'Arbeit',gemeinsam:'Gemeinsam'};
const categoryTitle=id=>{const x=knownCategories.find(c=>c.id===id);return x?categoryPath(x,knownCategories):'Ohne Kategorie';};
const fmt=n=>new Intl.NumberFormat('de-AT',{maximumFractionDigits:3}).format(n);
const total=id=>knownStocks.filter(s=>s.articleId===id).reduce((t,s)=>t+s.quantity,0);
const loc=id=>locationPath(id,knownLocations)||'Nicht zugewiesen';
const imageFor=id=>knownPhotos.find(m=>m.ownerId===id);
const thumb=id=>{const photo=imageFor(id);if(!photo?.blob||!['image/jpeg','image/png','image/webp'].includes(photo.blob.type))return `<div class="catalog-thumb">${icon('box',25)}</div>`;const url=URL.createObjectURL(photo.blob);urls.push(url);return `<img class="catalog-thumb" src="${url}" alt="Artikelfoto">`;};
export function clearArticleMediaUrls(){urls.forEach(u=>URL.revokeObjectURL(u));urls=[];}
const PREF_KEY='lagerhaus.catalog.preferences.v07';
function loadPreferences(){try{return normalizePreferences(JSON.parse(localStorage.getItem(PREF_KEY)||'{}'))}catch{return normalizePreferences()}}
let preferences=loadPreferences(),contexts=[];
function persistPreferences(){try{localStorage.setItem(PREF_KEY,JSON.stringify(preferences))}catch{/* browser storage disabled: session still works */}}
const statusName={rot:'Fehlbestand',orange:'Mindestbestand',gruen:'Ausreichend'};
const statusBadge=s=>`<span class="u07-status u07-${safe(s)}">${safe(statusName[s])}</span>`;
const ref=x=>x.id.slice(0,8).toUpperCase();
const dateLabel=x=>x?new Date(x).toLocaleDateString('de-AT'):'—';
function card(x){return `<article class="catalog-card u07-article-card" data-article-entry data-id="${safe(x.id)}" data-section="${safe(x.section||'privat')}" data-search="${safe(x.search)}">
 ${thumb(x.id)}<div class="catalog-detail"><div class="catalog-name">${safe(x.name)} ${x.favorite?'<span class="favorite-mark">★</span>':''}</div><div class="u07-sku">ART-${safe(ref(x))}${x.tags?.length?` · ${safe(x.tags.join(', '))}`:''}</div><div class="catalog-tags"><span>${safe(categoryTitle(x.categoryId))}</span><span>${safe(displaySection[x.section]||'Privat')}</span><span>${safe(loc(x.primaryLocationId))}</span></div>${statusBadge(x.status)}</div>
 <div class="catalog-location-quantities">${knownStocks.filter(z=>z.articleId===x.id&&z.quantity>0).map(z=>`<span>${safe(loc(z.locationId))}: ${fmt(z.quantity)}</span>`).join('')}</div><div class="catalog-quantity"><strong>${fmt(x.quantity)}</strong><small>${safe(x.unit||'Stück')}</small></div>
 <div class="catalog-actions"><button data-catalog="detail" data-id="${safe(x.id)}" type="button">Details</button><button data-catalog="favorite" data-id="${safe(x.id)}" type="button" aria-label="Favorit umschalten">${x.favorite?'★':'☆'}</button><button data-catalog="edit" data-id="${safe(x.id)}" type="button">Bearbeiten</button></div></article>`;}
function tableRow(x){return `<tr data-article-entry data-id="${safe(x.id)}"><td data-search="${safe(x.search)}"><div class="u07-table-name">${safe(x.name)}</div><small>ART-${safe(ref(x))} · ${safe(x.brand||'')} · ${safe(Object.keys(x.attributes||{}).join(', '))}</small></td><td>${safe(categoryTitle(x.categoryId))}</td><td>${safe(loc(x.primaryLocationId))}</td><td>${fmt(x.quantity)} ${safe(x.unit)}</td><td>${statusBadge(x.status)}</td><td>${dateLabel(x.updatedAt)}</td><td class="u07-table-actions"><button type="button" data-catalog="detail" data-id="${safe(x.id)}">Details</button><button type="button" data-catalog="favorite" data-id="${safe(x.id)}" aria-label="Favorit umschalten">${x.favorite?'★':'☆'}</button><button type="button" data-catalog="edit" data-id="${safe(x.id)}">Bearbeiten</button></td></tr>`;}
function select(label,key,items){return `<label class="u07-field">${label}<select data-catalog-filter="${key}" ${key==='location'?'data-catalog-location':key==='section'?'data-catalog-section':''} aria-label="${label}">${items.map(([value,name])=>`<option value="${safe(value)}" ${preferences[key]===value?'selected':''}>${safe(name)}</option>`).join('')}</select></label>`;}
export async function articlesView(){
 const [a,l,s,c]=await Promise.all([repository.articles(),repository.locations(),repository.stocks(),listCategories()]);
 knownArticles=a;knownLocations=l;knownStocks=s;knownCategories=c;
 try{knownPhotos=await articleImages(a.map(x=>x.id));}catch{knownPhotos=[];}
 const live=a.filter(x=>!x.archivedAt),arch=a.filter(x=>x.archivedAt);
 contexts=live.map(x=>articleContext(x,s,l,c));
 const selectedLocation=(globalThis.location?.hash||'').match(/^#\/articles\/location\/([0-9a-f-]{36})/i)?.[1]||'';
 if(selectedLocation)preferences.location=selectedLocation;
 if((globalThis.location?.hash||'').startsWith('#/articles/favorites'))preferences.favorite=true;
 const visible=filterAndSort(contexts,preferences);const all=filterAndSort(contexts,{sort:preferences.sort});
 const categoryFilter=c.map(x=>[x.id,categoryPath(x,c)]);
 const layout=preferences.layout;
 const archive=arch.map(x=>`<div class="catalog-archive-row"><span>${safe(x.name)} <small>Archiviert · Bewegungsverlauf erhalten</small></span><button data-catalog="restore" data-id="${safe(x.id)}" type="button">Wiederherstellen</button></div>`).join('');
 return `<section class="page-heading"><div><p class="eyebrow">ARTIKEL / U07</p><h1>Artikelübersicht</h1><p>Alle Bestände und Fotos bleiben lokal auf diesem Gerät.</p></div><button class="primary-btn" data-catalog="new" type="button">${icon('plus',18)} Artikel anlegen</button></section>
 <article class="panel catalog-panel u07-catalog" data-catalog-layout="${safe(layout)}">
 <div class="u07-topline"><label class="catalog-search">${icon('search',17)}<input data-catalog-filter="query" type="search" value="${safe(preferences.query)}" placeholder="Name, USB-C, Marke, Standort, ART-ID …" aria-label="Artikel suchen" autocomplete="off"></label><label class="u07-field">Ansicht<select data-catalog-filter="layout"><option value="auto" ${layout==='auto'?'selected':''}>Automatisch</option><option value="table" ${layout==='table'?'selected':''}>Tabelle</option><option value="cards" ${layout==='cards'?'selected':''}>Kacheln</option></select></label><button type="button" class="secondary-btn" data-category-action="open">Kategorien verwalten</button></div>
 <div class="u07-filter-grid">${select('Bereich','section',[['alle','Alle Bereiche'],['privat','Privat + Gemeinsam'],['arbeit','Arbeit + Gemeinsam'],['gemeinsam','Nur Gemeinsam']])}
 ${select('Kategorie','category',[['','Alle Kategorien'],...categoryFilter])}
 ${select('Lagerort','location',[['','Alle Lagerorte'],...l.filter(x=>!x.archivedAt).map(x=>[x.id,loc(x.id)])])}
 ${select('Artikeltyp','kind',[['','Alle Typen'],...ARTICLE_KINDS])}
 ${select('Bestand','status',[['','Alle Bestände'],['rot','Fehlbestand'],['orange','Mindestbestand'],['gruen','Ausreichend']])}
 ${select('Geändert','changed',[['','Jederzeit'],['7','Letzte 7 Tage'],['30','Letzte 30 Tage']])}
 ${select('Sortieren','sort',[['name','Name A–Z'],['quantity','Menge (absteigend)'],['location','Lagerort'],['changed','Zuletzt geändert'],['status','Bestandsstatus']])}
 <label class="u07-checkbox"><input type="checkbox" data-catalog-filter="favorite" ${preferences.favorite?'checked':''}> Nur Favoriten</label>
 <button type="button" data-catalog="reset-filters" class="secondary-btn u07-reset">Filter zurücksetzen</button></div>
 <div class="u07-results"><strong id="catalog-count">${visible.length} / ${live.length} Artikel</strong><span>Suche und Filter lassen sich kombinieren.</span></div>
 <div class="u07-table-scroll"><table class="u07-table"><thead><tr><th>Artikel</th><th>Kategorie</th><th>Lagerort</th><th>Bestand</th><th>Status</th><th>Geändert</th><th>Aktion</th></tr></thead><tbody id="catalog-table-body">${all.map(x=>tableRow(x)).join('')}</tbody></table></div>
 <div id="catalog-card-list" class="u07-cards">${all.map(x=>card(x)).join('')}</div>
 <p id="catalog-search-empty" ${visible.length?'hidden':''}>Keine passenden Artikel. Passe deine Filter an oder setze sie zurück.</p>
 ${!live.length?`<div class="large-empty">${icon('box',34)}<h2>Dein Lager ist noch leer</h2><p>Lege den ersten Artikel an.</p><button class="primary-btn" type="button" data-catalog="new">Ersten Artikel anlegen</button></div>`:''}
 </article>
 ${arch.length?`<details class="panel catalog-archived"><summary>Archivierte Artikel (${arch.length})</summary>${archive}</details>`:''}
 <p class="catalog-data-note">Achtung: Ohne vollständiges Backup bleiben Artikel und Fotos ausschließlich in diesem Browserprofil gespeichert. Browserdaten nicht löschen.</p>
 <dialog id="catalog-dialog" class="catalog-dialog" aria-labelledby="catalog-dialog-title"></dialog><dialog id="categories-dialog" class="catalog-dialog" aria-labelledby="categories-dialog-title"></dialog><dialog id="catalog-details" class="catalog-dialog u07-detail-dialog" aria-labelledby="u07-detail-title"></dialog>`;
}
function updateCatalogRows(){
 const panel=document.querySelector('.u07-catalog');if(!panel)return;
 panel.dataset.catalogLayout=preferences.layout;
 const visible=filterAndSort(contexts,preferences),all=filterAndSort(contexts,{sort:preferences.sort});const ids=new Set(visible.map(x=>x.id));
 for(const containerId of ['catalog-card-list','catalog-table-body']){
  const parent=document.getElementById(containerId);if(!parent)continue;
  const nodes=new Map([...parent.querySelectorAll('[data-article-entry]')].map(e=>[e.dataset.id,e]));
  for(const x of all){const node=nodes.get(x.id);if(node){node.hidden=!ids.has(x.id);parent.appendChild(node);}}
 }
 const count=document.getElementById('catalog-count');if(count)count.textContent=`${visible.length} / ${contexts.length} Artikel`;
 const empty=document.getElementById('catalog-search-empty');if(empty)empty.hidden=visible.length>0;
}
function editor(id){
 const x=knownArticles.find(v=>v.id===id),editing=!!x,unit=x?.unit||'Stück',unitOptions=options(UNITS,unit),location=x?.primaryLocationId||'';
 const catOptions=knownCategories.map(c=>`<option value="${safe(c.id)}" ${c.id===(x?.categoryId||knownCategories[0]?.id)?'selected':''}>${safe(categoryPath(c,knownCategories))}</option>`).join('');
 const locOptions=knownLocations.filter(l=>!l.archivedAt).map(l=>`<option value="${safe(l.id)}" ${l.id===location?'selected':''}>${safe(loc(l.id))}</option>`).join('');
 const qty=editing?total(x.id):0;const multiple=editing&&knownStocks.filter(s=>s.articleId===id&&s.quantity>0).some(s=>s.locationId!==location);
 return `<form id="catalog-form" class="catalog-form" method="dialog" data-edit-id="${safe(id||'')}"><div class="catalog-dialog-head"><span class="eyebrow">LAGERHAUS / ARTIKELSTAMM</span><button type="button" class="modal-close" data-catalog="close" aria-label="Schließen">${icon('x',20)}</button></div><h2 id="catalog-dialog-title">${editing?'Artikel bearbeiten':'Neuen Artikel erfassen'}</h2><p class="form-subtitle">Vier Pflichtangaben – alles Weitere ist optional.</p>
 <div class="catalog-form-grid"><label class="wide">Artikelname *<input required maxlength="160" name="name" value="${safe(x?.name)}" placeholder="z. B. WC-Reiniger"></label>
 <label>Kategorie *<select required name="categoryId">${catOptions}</select></label>
 <label>Bereich<select name="section">${options(['privat','arbeit','gemeinsam'],x?.section||'privat')}</select></label><label>Artikeltyp<select name="articleKind" id="article-kind">${ARTICLE_KINDS.map(([v,label])=>`<option value="${v}" ${v===(x?.articleKind||'reusable')?'selected':''}>${label}</option>`).join('')}</select></label>
 <label>Lagerort *<select name="locationId" id="catalog-location-choice"><option value="">Neuen Lagerort eingeben</option>${locOptions}</select></label>
 <label>Neuer Lagerort<input maxlength="100" name="locationName" placeholder="z. B. Keller / Regal A" value="${location?'':'Garage'}"></label>
 <label>Menge *<input type="number" name="quantity" min="0" max="1000000000" step="0.001" required value="${qty}" ${editing?'readonly title="Mengen nur über Lager / Bestandsführung buchen"':''}>${editing?'<small class="catalog-quantity-note">Bestand nur unter Lager → Bestandsführung ändern.</small>':''}</label>
 <label>Einheit<select name="unit">${unitOptions}</select></label></div>
 <details class="catalog-extra"><summary>Weitere Artikeldetails und Packungsinhalt</summary><div class="catalog-form-grid">
 ${[['brand','Marke',70],['model','Modell',80],['type','Typ',80],['manufacturer','Hersteller',100],['serialNumber','Seriennummer',100],['color','Farbe',60],['condition','Zustand',60]].map(([key,label,max])=>`<label>${label}<input name="${key}" maxlength="${max}" value="${safe(x?.[key])}"></label>`).join('')}
 <label>Packungsinhalt (optional)<input type="number" name="packageSize" min="0.001" max="1000000000" step="0.001" value="${safe(x?.packageSize)}" placeholder="z. B. 750"></label>
 <label>Einheit des Inhalts<select name="packageUnit"><option value="">Bitte wählen</option>${options(UNITS,x?.packageUnit||'')}</select></label>
 <label class="wide">Notizen<textarea name="notes" maxlength="1000" rows="3">${safe(x?.notes)}</textarea></label><label class="checkbox-label"><input type="checkbox" name="favorite" ${x?.favorite?'checked':''}> Als Favorit markieren</label>
 <div class="wide catalog-converter"><span>Einheitenrechner (nur kompatible Einheiten)</span><div><input id="convert-input" type="number" min="0" step="0.001" value="1" aria-label="Umrechnungsmenge"><select id="convert-from">${options(UNITS,'l')}</select><span>in</span><select id="convert-to">${options(UNITS,'ml')}</select><output id="convert-output">1000 ml</output></div></div>
 <label class="wide">Schlagwörter (durch Komma getrennt, max. 12)<input name="tags" maxlength="440" value="${safe((x?.tags||[]).join(', '))}" placeholder="z. B. USB-C, Akku 18 V, Saison"></label>
 <label class="wide">Eigene Merkmale (Name: Wert, je Zeile)<textarea name="attributesText" rows="3" placeholder="Größe: 8 mm&#10;Anschluss: USB-C">${safe(Object.entries(x?.attributes||{}).map(([k,v])=>k+': '+v).join('\n'))}</textarea></label>
 <label class="wide" data-kind-only="food" ${x?.articleKind==='food'?'':'hidden'}>Mindesthaltbarkeitsdatum<input type="date" name="bestBefore" value="${safe(x?.bestBefore)}"></label>
 <label class="wide" data-kind-only="device" ${x?.articleKind==='device'?'':'hidden'}>Wartung alle X Tage (optional)<input type="number" min="1" max="36500" step="1" name="maintenanceIntervalDays" value="${safe(x?.maintenanceIntervalDays)}"></label>
 </div></details>
 <div class="catalog-photo-field"><label for="catalog-image">${icon('box',18)} ${editing?'Foto ersetzen':'Artikelfoto hinzufügen'} (JPG/PNG/WEBP, max. 5 MB)</label><input type="file" accept="image/png,image/jpeg,image/webp" id="catalog-image" name="image"><small>${editing&&imageFor(id)?'Vorhandenes Foto bleibt erhalten, wenn du kein neues auswählst.':'Ohne Foto erscheint eine neutrale Artikelkachel.'}</small>${editing&&imageFor(id)?'<button type="button" class="link-danger" data-catalog="remove-photo" data-id="'+safe(id)+'">Vorhandenes Foto entfernen</button>':''}</div>
 <div id="catalog-error" class="form-error" role="alert" hidden></div><div class="catalog-form-actions"><button type="button" class="secondary-btn" data-catalog="close">Abbrechen</button><button type="submit" class="primary-btn">${editing?'Änderungen speichern':'Artikel speichern'}</button></div></form>`;
}
export function openCatalogEditor(id){const dialog=document.getElementById('catalog-dialog');if(!dialog)return;dialog.innerHTML=editor(id);if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');dialog.querySelector('[name="name"]')?.focus();}
function close(){const d=document.getElementById('catalog-dialog');if(!d)return;if(typeof d.close==='function')d.close();else d.removeAttribute('open');}
function showError(error){const out=document.getElementById('catalog-error');if(out){out.textContent=error?.message||'Speichern fehlgeschlagen.';out.hidden=false;}}
export async function handleCatalogClick(button,refresh){const action=button.dataset.catalog,id=button.dataset.id;try{
 if(action==='new'){openCatalogEditor();return;}
 if(action==='reset-filters'){preferences=normalizePreferences({sort:preferences.sort,layout:preferences.layout});persistPreferences();
  document.querySelectorAll('[data-catalog-filter]').forEach(el=>{const k=el.dataset.catalogFilter;el.type==='checkbox'?el.checked=false:el.value=preferences[k]??'';});updateCatalogRows();return;}
 if(action==='detail'){await openArticleDetail(id);return;}
 if(action==='detail-close'){closeArticleDetail();return;}
 if(action==='detail-tab'){openDetailTab(button.dataset.tab);return;}
 if(action==='detail-edit'){closeArticleDetail();openCatalogEditor(id);return;}
 if(action==='detail-step'){const input=document.querySelector('#u07-book-amount');if(input)input.value=String(Math.max(0.001,Math.round((Number(input.value||0)+(button.dataset.direction==='add'?1:-1))*1000)/1000));return;}
 if(action==='favorite'){const x=knownArticles.find(a=>a.id===id);if(!x)return;await setArticleFavorite(id,!x.favorite);await refresh();return;}
 if(action==='edit'){openCatalogEditor(id);return;}
 if(action==='close'){close();return;}
 if(action==='duplicate'){const target=knownArticles.find(a=>a.id===id);if(!target||!confirm(`Artikel „${target.name}“ mit Bestand 0 kopieren?`))return;await duplicateCatalogArticle(id);await refresh();return;}
 if(action==='delete'){const target=knownArticles.find(a=>a.id===id);if(!target||!confirm(`Artikel „${target.name}“ wirklich löschen?\n\nBei vorhandener Buchungshistorie wird er aus Sicherheitsgründen archiviert. Bestehender Bestand muss zuerst auf 0 gesetzt werden.`))return;await deleteCatalogArticle(id);await refresh();return;}
 if(action==='restore'){await restoreArchivedArticle(id);await refresh();return;}
 if(action==='remove-photo'){if(!confirm('Artikelfoto endgültig entfernen?'))return;await setArticleImage(id,null);knownPhotos=knownPhotos.filter(m=>m.ownerId!==id);const b=document.querySelector('[data-catalog="remove-photo"]');b?.remove();return;}
 }catch(error){if(document.getElementById('catalog-form'))showError(error);else alert(error.message||'Aktion fehlgeschlagen.');}}
export async function handleCatalogSubmit(form,refresh){const button=form.querySelector('[type="submit"]');button.disabled=true;const error=document.getElementById('catalog-error');error.hidden=true;try{
 const data=new FormData(form),obj=Object.fromEntries(data.entries());obj.favorite=data.has('favorite');obj.quantity=Number(obj.quantity);obj.category=knownCategories.find(x=>x.id===obj.categoryId)?.name||'';
 const file=data.get('image');obj.image=file?.size?file:null;const id=form.dataset.editId;
 if(id){await updateCatalogArticle(id,obj);if(obj.image)await setArticleImage(id,obj.image);}else await createCatalogArticle(obj);
 close();await refresh();
 }catch(e){showError(e);}finally{button.disabled=false;}}
export function handleCatalogInput(e){
 if(e.target.matches('[data-catalog-filter]')){
  const key=e.target.dataset.catalogFilter;
  preferences[key]=e.target.type==='checkbox'?e.target.checked:e.target.value;
  preferences=normalizePreferences(preferences);persistPreferences();updateCatalogRows();
 }
 if(e.target.id==='article-kind'){
  document.querySelectorAll('[data-kind-only]').forEach(el=>el.hidden=el.dataset.kindOnly!==e.target.value);
 }
 if(['convert-input','convert-from','convert-to'].includes(e.target.id)){
  const output=document.getElementById('convert-output');if(!output)return;try{const q=Number(document.getElementById('convert-input').value),a=document.getElementById('convert-from').value,b=document.getElementById('convert-to').value;output.textContent=`${fmt(convertQuantity(q,a,b))} ${b}`;}catch(e){output.textContent=e.message;}
 }
}
let detailArticle=null,detailTab='allgemein';
function closeArticleDetail(){const dialog=document.getElementById('catalog-details');if(!dialog)return;if(dialog.open&&typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');detailArticle=null;}
function openDetailTab(tab){if(!['allgemein','bilder','verlauf'].includes(tab))return;detailTab=tab;const target=document.getElementById('u07-detail-content');if(target)target.innerHTML=detailTabHtml();document.querySelectorAll('[data-catalog="detail-tab"]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));}
let detailHistory=[];
function detailTabHtml(){const x=detailArticle;if(!x)return '';
 const stocks=knownStocks.filter(s=>s.articleId===x.id);const totalQuantity=total(x.id);
 if(detailTab==='bilder')return `<div class="u07-detail-photo">${thumb(x.id)}</div><p>Das gespeicherte Artikelfoto wird ausschließlich lokal auf deinem Gerät verwaltet.</p><button type="button" data-catalog="detail-edit" data-id="${safe(x.id)}" class="secondary-btn">Foto im Artikel-Editor ändern</button>`;
 if(detailTab==='verlauf')return detailHistory.length?`<ol class="u07-history">${detailHistory.map(m=>`<li><strong>${safe(m.bookType||m.source||'Bestandsbuchung')}</strong> <span>${dateLabel(m.createdAt)}</span><p>${fmt(m.before??0)} → ${fmt(m.after??0)} ${safe(x.unit)} ${m.note?`· ${safe(m.note)}`:''}</p></li>`).join('')}</ol>`:'<p>Noch keine Buchungen zu diesem Artikel vorhanden.</p>';
 return `<dl class="u07-specs"><div><dt>Marke · Modell</dt><dd>${safe([x.brand,x.model].filter(Boolean).join(' · ')||'–')}</dd></div><div><dt>Kategorie</dt><dd>${safe(categoryTitle(x.categoryId))}</dd></div><div><dt>Artikelnummer / Referenz</dt><dd>ART-${safe(ref(x))}</dd></div><div><dt>Seriennummer</dt><dd>${safe(x.serialNumber||'–')}</dd></div><div><dt>Zuletzt geändert</dt><dd>${safe(dateLabel(x.updatedAt))}</dd></div><div><dt>Tags</dt><dd>${safe((x.tags||[]).join(', ')||'–')}</dd></div></dl>
 <h3>Lagerort-Bestände</h3><div class="u07-detail-stocks">${stocks.length?stocks.map(s=>`<div><span>${safe(loc(s.locationId))}</span><strong>${fmt(s.quantity)} ${safe(x.unit)}</strong></div>`).join(''):'<p>Bestand derzeit 0.</p>'}</div>
 ${stocks.length?`<form id="u07-detail-book-form" class="u07-detail-book"><h3>Bestand nachvollziehbar buchen</h3><input type="hidden" name="articleId" value="${safe(x.id)}"><label>Lagerort<select name="locationId">${stocks.map(s=>`<option value="${safe(s.locationId)}">${safe(loc(s.locationId))}</option>`).join('')}</select></label><label>Vorgang<select name="type"><option value="receipt">+ Wareneingang</option><option value="issue">− Entnahme</option></select></label><label>Menge<div class="u07-amount"><button type="button" data-catalog="detail-step" data-direction="subtract" aria-label="Menge reduzieren">−</button><input id="u07-book-amount" name="quantity" value="1" type="number" min="0.001" step="0.001" required><button type="button" data-catalog="detail-step" data-direction="add" aria-label="Menge erhöhen">+</button></div></label><label>Notiz<input name="note" maxlength="500" placeholder="Optionaler Buchungsgrund"></label><button type="submit" class="primary-btn">Buchung speichern</button><p id="u07-detail-error" class="form-error" hidden role="alert"></p></form>`:'<p>Erfasse eine erste Bestandsposition unter Lager → Bestandsführung.</p>'}`;
}
async function openArticleDetail(id){detailArticle=knownArticles.find(x=>x.id===id);if(!detailArticle)return;detailTab='allgemein';detailHistory=await repository.movements(id);const dialog=document.getElementById('catalog-details');if(!dialog)return;
 const a=detailArticle,model=contexts.find(x=>x.id===id);
 dialog.innerHTML=`<div class="catalog-dialog-head"><span class="eyebrow">LAGERHAUS / ARTIKELDETAILS</span><button class="modal-close" data-catalog="detail-close" type="button" aria-label="Schließen">${icon('x',20)}</button></div>
 <div class="u07-detail-head">${thumb(a.id)}<div><small>ART-${safe(ref(a))}</small><h2 id="u07-detail-title">${safe(a.name)}</h2><p>${safe(loc(a.primaryLocationId))}</p>${statusBadge(model?.status||'gruen')}<strong class="u07-detail-quantity">${fmt(total(a.id))} ${safe(a.unit)}</strong></div></div>
 <div class="u07-tabs" role="tablist" aria-label="Artikeldetails">${[['allgemein','Allgemein'],['bilder','Bilder'],['verlauf','Verlauf']].map(([key,label])=>`<button type="button" role="tab" data-catalog="detail-tab" data-tab="${key}" aria-selected="${key==='allgemein'}">${label}</button>`).join('')}</div>
 <div id="u07-detail-content">${detailTabHtml()}</div><div class="catalog-form-actions"><button type="button" class="secondary-btn" data-catalog="detail-close">Schließen</button><button type="button" class="primary-btn" data-catalog="detail-edit" data-id="${safe(a.id)}">Bearbeiten</button></div>`;
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
export async function handleDetailBooking(form,refresh){const btn=form.querySelector('[type="submit"]');if(btn)btn.disabled=true;try{await bookStock(Object.fromEntries(new FormData(form).entries()));closeArticleDetail();await refresh();}catch(e){const out=document.getElementById('u07-detail-error');if(out){out.textContent=e.message||'Buchung fehlgeschlagen.';out.hidden=false;}}finally{if(btn)btn.disabled=false;}}
function categoryManagerMarkup(){
 const parentChoices=(active,exclude)=>`<option value="">Oberste Ebene</option>`+knownCategories.filter(x=>x.id!==exclude).map(x=>`<option value="${safe(x.id)}" ${active===x.id?'selected':''}>${safe(categoryPath(x,knownCategories))}</option>`).join('');
 return `<div class="catalog-dialog-head"><span class="eyebrow">LAGERHAUS / KLASSIFIKATION</span><button class="modal-close" type="button" data-category-action="close" aria-label="Schließen">${icon('x',20)}</button></div>
 <h2 id="categories-dialog-title">Kategorien verwalten</h2><p class="form-subtitle">Unterkategorien anlegen, sortieren und ohne Bestandsverlust umbenennen. Jede Kategorie hat einen eindeutigen Namen.</p>
 <form id="category-new-form" class="category-create-form"><label>Neue Kategorie<input name="name" maxlength="70" required placeholder="z. B. Akkus & Batterien"></label><label>Übergeordnet<select name="parentId">${parentChoices('','')}</select></label><button class="primary-btn" type="submit">Hinzufügen</button></form>
 <div id="category-manager-error" class="form-error" role="alert" hidden></div>
 <div class="category-manager-list">${knownCategories.map(c=>`<div class="category-manager-row"><strong>${safe(categoryPath(c,knownCategories))}</strong><div class="category-actions"><button type="button" data-category-action="rename" data-id="${safe(c.id)}">Umbenennen</button><button type="button" data-category-action="up" data-id="${safe(c.id)}" title="Nach oben">↑</button><button type="button" data-category-action="down" data-id="${safe(c.id)}" title="Nach unten">↓</button></div><div class="category-move"><select aria-label="Kategorie verschieben" data-category-parent="${safe(c.id)}">${parentChoices(c.parentId,c.id)}</select><button type="button" data-category-action="move" data-id="${safe(c.id)}">Verschieben</button></div></div>`).join('')}</div>`;
}
export function openCategoryManager(){const d=document.getElementById('categories-dialog');if(!d)return;d.innerHTML=categoryManagerMarkup();if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');}
const showCategoryError=e=>{const out=document.getElementById('category-manager-error');if(out){out.textContent=e.message||'Kategorieänderung fehlgeschlagen.';out.hidden=false;}};
export async function handleCategoryClick(button,refresh){
 const action=button.dataset.categoryAction,id=button.dataset.id;
 if(action==='open'){openCategoryManager();return;}
 if(action==='close'){const d=document.getElementById('categories-dialog');if(typeof d.close==='function')d.close();else d.removeAttribute('open');await refresh();return;}
 try{
  if(action==='rename'){
   const original=knownCategories.find(x=>x.id===id);if(!original)return;
   const name=prompt(`Kategorie „${original.name}“ umbenennen:`,original.name);
   if(name===null||name===original.name)return;await editCategory(id,{name});
  }else if(action==='move'){
   const parentId=document.querySelector(`[data-category-parent="${id}"]`)?.value||null;
   await editCategory(id,{parentId});
  }else if(action==='up'||action==='down'){
   await reorderCategory(id,action==='up'?-1:1);
  }else return;
  knownCategories=await listCategories();openCategoryManagerRefresh();
 }catch(e){showCategoryError(e);}
}
function openCategoryManagerRefresh(){const d=document.getElementById('categories-dialog');if(d)d.innerHTML=categoryManagerMarkup();}
export async function handleCategorySubmit(form){
 const data=new FormData(form);try{
  await createCategory({name:data.get('name'),parentId:data.get('parentId')||null});
  knownCategories=await listCategories();openCategoryManagerRefresh();
 }catch(e){showCategoryError(e);}
}
