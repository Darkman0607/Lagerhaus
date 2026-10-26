import {icon} from '../core/icons.js';
import {escapeHtml as esc} from '../core/escape.js';
import {repository,StorageError} from '../data/store.js';
import {listCategories,createCategory,editCategory,reorderCategory,categoryPath,ARTICLE_KINDS} from '../data/categories.js';
import {UNITS,convertQuantity,createCatalogArticle,updateCatalogArticle,duplicateCatalogArticle,deleteCatalogArticle,restoreArchivedArticle,articleImages,setArticleImage} from '../data/catalog.js';
let knownArticles=[],knownLocations=[],knownStocks=[],knownPhotos=[],knownCategories=[],urls=[];
const safe=v=>esc(v??'');
const options=(values,selected)=>values.map(v=>`<option value="${safe(v)}" ${v===selected?'selected':''}>${safe(v)}</option>`).join('');
const displaySection={privat:'Privat',arbeit:'Arbeit',gemeinsam:'Gemeinsam'};
const categoryTitle=id=>{const x=knownCategories.find(c=>c.id===id);return x?categoryPath(x,knownCategories):'Ohne Kategorie';};
const fmt=n=>new Intl.NumberFormat('de-AT',{maximumFractionDigits:3}).format(n);
const total=id=>knownStocks.filter(s=>s.articleId===id).reduce((t,s)=>t+s.quantity,0);
const loc=id=>knownLocations.find(l=>l.id===id)?.name||'Nicht zugewiesen';
const imageFor=id=>knownPhotos.find(m=>m.ownerId===id);
const thumb=id=>{const photo=imageFor(id);if(!photo?.blob||!['image/jpeg','image/png','image/webp'].includes(photo.blob.type))return `<div class="catalog-thumb">${icon('box',25)}</div>`;const url=URL.createObjectURL(photo.blob);urls.push(url);return `<img class="catalog-thumb" src="${url}" alt="Artikelfoto">`;};
export function clearArticleMediaUrls(){urls.forEach(u=>URL.revokeObjectURL(u));urls=[];}
export async function articlesView(){
 const [a,l,s,c]=await Promise.all([repository.articles(),repository.locations(),repository.stocks(),listCategories()]);
 knownArticles=a;knownLocations=l;knownStocks=s;knownCategories=c;
 try{knownPhotos=await articleImages(a.map(x=>x.id));}catch{knownPhotos=[];}
 const live=a.filter(x=>!x.archivedAt),arch=a.filter(x=>x.archivedAt);
 const cards=live.map(x=>`<article class="catalog-card" data-article-entry data-section="${safe(x.section||'privat')}" data-search="${safe([x.name,x.category,categoryTitle(x.categoryId),x.brand,x.model,loc(x.primaryLocationId),...(x.tags||[]),...Object.entries(x.attributes||{}).flat()].join(' ').toLocaleLowerCase('de'))}">
 ${thumb(x.id)}<div class="catalog-detail"><div class="catalog-name">${safe(x.name)} ${x.favorite?'<span class="favorite-mark" title="Favorit">★</span>':''}</div><div class="catalog-tags"><span>${safe(categoryTitle(x.categoryId)||x.category)}</span><span>${safe(displaySection[x.section]||'Privat')}</span><span>${safe(ARTICLE_KINDS.find(([k])=>k===x.articleKind)?.[1]||'Wiederverwendbar')}</span><span>${safe(loc(x.primaryLocationId))}</span></div></div>
 <div class="catalog-quantity"><strong>${fmt(total(x.id))}</strong><small>${safe(x.unit||'Stück')}</small></div>
 <div class="catalog-actions"><button type="button" data-catalog="edit" data-id="${safe(x.id)}" title="Bearbeiten">Bearbeiten</button><button type="button" data-catalog="duplicate" data-id="${safe(x.id)}" title="Kopieren">Kopieren</button><button class="danger-action" type="button" data-catalog="delete" data-id="${safe(x.id)}" title="Artikel löschen">Löschen</button></div></article>`).join('');
 const archive=arch.map(x=>`<div class="catalog-archive-row"><span>${safe(x.name)} <small>archiviert · Bestand 0 · Buchungshistorie bleibt erhalten</small></span><button data-catalog="restore" data-id="${safe(x.id)}" type="button">Wiederherstellen</button></div>`).join('');
 return `<section class="page-heading"><div><p class="eyebrow">STAMMDATEN / ARTIKEL</p><h1>Artikel</h1><p>Bestände und Bilder bleiben lokal auf diesem Gerät.</p></div><button class="primary-btn" data-catalog="new" type="button">${icon('plus',18)} Artikel anlegen</button></section>
 <article class="panel catalog-panel"><div class="catalog-toolbar"><label class="catalog-search">${icon('search',17)}<input data-catalog-search type="search" placeholder="Artikel, Tags, Merkmale suchen" aria-label="Artikel suchen"></label><label class="catalog-section-filter">Bereich <select data-catalog-section aria-label="Bereich filtern"><option value="alle">Alle Bereiche</option><option value="privat">Privat + Gemeinsam</option><option value="arbeit">Arbeit + Gemeinsam</option><option value="gemeinsam">Nur gemeinsam</option></select></label><span class="chip quiet">${live.length} aktive Artikel</span><button type="button" class="secondary-btn category-open-btn" data-category-action="open">Kategorien verwalten</button></div>
 <div id="catalog-list">${cards||`<div class="large-empty">${icon('box',38)}<h2>Dein Lager ist noch leer</h2><p>Lege jetzt deinen ersten Artikel an. Du benötigst nur Name, Kategorie, Lagerort und Menge.</p><button class="primary-btn" data-catalog="new" type="button">${icon('plus',17)} Ersten Artikel anlegen</button></div>`}</div><p id="catalog-search-empty" hidden>Keine Artikel zu dieser Suche gefunden.</p></article>
 ${arch.length?`<details class="panel catalog-archived"><summary>Archivierte Artikel (${arch.length})</summary>${archive}</details>`:''}
 <p class="catalog-data-note">Hinweis: Fotos und Bestände sind nur in diesem Browserprofil gespeichert. Eine Backup-Funktion folgt in Update 10. Lösche bis dahin keine Browserdaten.</p>
 <dialog id="catalog-dialog" class="catalog-dialog" aria-labelledby="catalog-dialog-title"></dialog><dialog id="categories-dialog" class="catalog-dialog" aria-labelledby="categories-dialog-title"></dialog>`;
}
function editor(id){
 const x=knownArticles.find(v=>v.id===id),editing=!!x,unit=x?.unit||'Stück',unitOptions=options(UNITS,unit),location=x?.primaryLocationId||'';
 const catOptions=knownCategories.map(c=>`<option value="${safe(c.id)}" ${c.id===(x?.categoryId||knownCategories[0]?.id)?'selected':''}>${safe(categoryPath(c,knownCategories))}</option>`).join('');
 const locOptions=knownLocations.map(l=>`<option value="${safe(l.id)}" ${l.id===location?'selected':''}>${safe(l.name)}</option>`).join('');
 const qty=editing?total(x.id):0;
 return `<form id="catalog-form" class="catalog-form" method="dialog" data-edit-id="${safe(id||'')}"><div class="catalog-dialog-head"><span class="eyebrow">LAGERHAUS / ARTIKELSTAMM</span><button type="button" class="modal-close" data-catalog="close" aria-label="Schließen">${icon('x',20)}</button></div><h2 id="catalog-dialog-title">${editing?'Artikel bearbeiten':'Neuen Artikel erfassen'}</h2><p class="form-subtitle">Vier Pflichtangaben – alles Weitere ist optional.</p>
 <div class="catalog-form-grid"><label class="wide">Artikelname *<input required maxlength="160" name="name" value="${safe(x?.name)}" placeholder="z. B. WC-Reiniger"></label>
 <label>Kategorie *<select required name="categoryId">${catOptions}</select></label>
 <label>Bereich<select name="section">${options(['privat','arbeit','gemeinsam'],x?.section||'privat')}</select></label><label>Artikeltyp<select name="articleKind" id="article-kind">${ARTICLE_KINDS.map(([v,label])=>`<option value="${v}" ${v===(x?.articleKind||'reusable')?'selected':''}>${label}</option>`).join('')}</select></label>
 <label>Lagerort *<select name="locationId" id="catalog-location-choice"><option value="">Neuen Lagerort eingeben</option>${locOptions}</select></label>
 <label>Neuer Lagerort<input maxlength="100" name="locationName" placeholder="z. B. Keller / Regal A" value="${location?'':'Garage'}"></label>
 <label>Menge *<input type="number" name="quantity" min="0" max="1000000000" step="0.001" required value="${qty}"></label>
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
 if(e.target.matches('[data-catalog-search], [data-catalog-section]')){
  const q=document.querySelector('[data-catalog-search]')?.value.trim().toLocaleLowerCase('de')||'';
  const area=document.querySelector('[data-catalog-section]')?.value||'alle';let shown=0;
  for(const row of document.querySelectorAll('[data-article-entry]')){
   const matchArea=area==='alle'||row.dataset.section===area||(area!=='gemeinsam'&&row.dataset.section==='gemeinsam');
   row.hidden=!matchArea||!row.dataset.search.includes(q);if(!row.hidden)shown++;
  }
  const msg=document.getElementById('catalog-search-empty');if(msg)msg.hidden=shown!==0;
 }
 if(e.target.id==='article-kind'){
  document.querySelectorAll('[data-kind-only]').forEach(el=>el.hidden=el.dataset.kindOnly!==e.target.value);
 }
 if(['convert-input','convert-from','convert-to'].includes(e.target.id)){
  const output=document.getElementById('convert-output');if(!output)return;try{const q=Number(document.getElementById('convert-input').value),a=document.getElementById('convert-from').value,b=document.getElementById('convert-to').value;output.textContent=`${fmt(convertQuantity(q,a,b))} ${b}`;}catch(e){output.textContent=e.message;}
 }
}
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
