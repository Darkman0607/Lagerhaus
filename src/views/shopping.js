/** U08 shopping cockpit — industrial list as pictured; no invented inventory. */
import {icon} from '../core/icons.js';
import {escapeHtml} from '../core/escape.js';
import {shoppingData,addPurchase,editPurchase,completePurchase,reopenPurchase,archivePurchase} from '../data/purchases.js';
import {UNITS} from '../data/catalog.js';
const esc=v=>escapeHtml(String(v??''));
const fmt=v=>new Intl.NumberFormat('de-AT',{maximumFractionDigits:3}).format(v);
const titles={dringend:'Dringend',normal:'Normal',später:'Später'};
const areas={privat:'Privat',arbeit:'Arbeit',gemeinsam:'Gemeinsam'};
let snapshot=null,filter='open',areaFilter='all',priorityFilter='all',search='';
const options=(values,current)=>values.map(([value,label])=>`<option value="${esc(value)}" ${current===value?'selected':''}>${esc(label)}</option>`).join('');
const units=u=>options(UNITS.map(x=>[x,x]),u);
const badge=p=>`<span class="u08-priority p-${p.priority||'normal'}">${esc(titles[p.priority]||'Normal')}</span>`;
const articleFor=id=>snapshot?.articles.find(a=>a.id===id);
const whereFor=id=>snapshot?.locations.find(l=>l.id===id);
function row(p){const done=p.status!=='open';return `<li class="u08-item ${done?'is-done':''}" data-shopping-row data-id="${esc(p.id)}" data-status="${esc(p.status)}" data-area="${esc(p.area)}" data-priority="${esc(p.priority)}" data-query="${esc(`${p.name} ${p.shop||''}`.toLocaleLowerCase('de'))}">
  <span class="u08-product-icon">${icon(p.articleId?'box':'shopping',24)}</span>
  <div class="u08-item-info"><strong>${esc(p.name)}</strong><small>${esc(p.articleId?'Lagerartikel':'Freier Einkauf')} · ${esc(areas[p.area]||p.area)}${p.shop?' · '+esc(p.shop):''}</small><div class="u08-item-meta">${badge(p)}<span>${fmt(p.quantity)} ${esc(p.unit)}</span>${done?'<span class="u08-done-pill">Erledigt</span>':''}</div></div>
  <div class="u08-row-actions">${done?`<button type="button" class="secondary-btn" data-shopping-action="reopen" data-id="${esc(p.id)}" title="Erledigung rückgängig">${icon('arrow',15)} Wieder öffnen</button><button type="button" class="secondary-btn" data-shopping-action="archive" data-id="${esc(p.id)}">Archivieren</button>`:`<button type="button" class="u08-cart-btn" data-shopping-action="complete" data-id="${esc(p.id)}" title="Kauf bestätigen">${icon('shopping',18)} <span>Gekauft</span></button><button type="button" class="secondary-btn" data-shopping-action="edit" data-id="${esc(p.id)}">Ändern</button>`}</div>
 </li>`;}
export async function shoppingView(){snapshot=await shoppingData();const rows=snapshot.purchases.filter(p=>p.status!=='archived').sort((a,b)=>(a.status==='open'?0:1)-(b.status==='open'?0:1)||['dringend','normal','später'].indexOf(a.priority)-['dringend','normal','später'].indexOf(b.priority)||b.createdAt.localeCompare(a.createdAt));
 const count=rows.filter(p=>p.status==='open').length,done=rows.length-count;
 const suggestions=snapshot.suggestions;
 const candidates=snapshot.articles.filter(a=>!a.archivedAt).sort((a,b)=>a.name.localeCompare(b.name,'de'));
 return `<section class="page-heading"><div><p class="eyebrow">LAGERHAUS / EINKAUF</p><h1>Einkaufsliste</h1><p>Geplant kaufen. Tatsächlich einbuchen. Immer nachvollziehbar.</p></div><button class="primary-btn" type="button" data-shopping-action="new">${icon('plus',17)} Neuer Einkauf</button></section>
 <section class="u08-summary" aria-label="Einkaufsübersicht"><div><small>Offene Positionen</small><strong>${count}</strong></div><div><small>Erledigt</small><strong>${done}</strong></div><div><small>Nachkauf-Vorschläge</small><strong>${suggestions.length}</strong></div></section>
 <section class="panel u08-panel"><div class="panel-heading"><div><span class="eyebrow">SCHNELL · ÜBERSICHTLICH</span><h2>Meine Einkaufsliste</h2></div><span class="chip quiet">${count} offen</span></div>
 <div class="u08-toolbar"><label class="catalog-search">${icon('search',17)}<input type="search" id="u08-search" placeholder="Einkauf suchen …" value="${esc(search)}" aria-label="Einkauf suchen"></label><label><span>Status</span><select id="u08-status">${options([['open','Offen'],['done','Erledigt'],['all','Alle']],filter)}</select></label><label><span>Bereich</span><select id="u08-area">${options([['all','Alle Bereiche'],['privat','Privat'],['arbeit','Arbeit'],['gemeinsam','Gemeinsam']],areaFilter)}</select></label><label><span>Priorität</span><select id="u08-priority">${options([['all','Alle Prioritäten'],['dringend','Dringend'],['normal','Normal'],['später','Später']],priorityFilter)}</select></label></div>
 <ul class="u08-list">${rows.map(row).join('')}</ul><p id="u08-list-empty" class="u08-empty" hidden>Keine Positionen mit diesen Filtern.</p>
 <details class="u08-archive"><summary>Archivierte Einkäufe (${snapshot.purchases.filter(p=>p.status==='archived').length})</summary><p>Abgeschlossene Buchungen bleiben in der Historie erhalten.</p>${snapshot.purchases.filter(p=>p.status==='archived').map(p=>`<div class="u08-archived-row"><span>${esc(p.name)}</span><small>${esc(p.completedAt?.slice(0,10)||'')}</small></div>`).join('')}</details></section>
 <section class="panel u08-suggest"><div class="panel-heading"><div><span class="eyebrow">LAGERBESTAND / MINDESTGRENZEN</span><h2>Automatisch nachkaufen</h2></div><span class="chip ${suggestions.length?'':'success'}">${suggestions.length} Vorschläge</span></div>
 <p>Diese Vorschläge sind <strong>noch keine Bestellungen</strong>. Einmal auf die Liste übernehmen; wiederholte Warnungen erzeugen keine Duplikate.</p><div class="u08-suggestion-grid">${suggestions.map(a=>`<div class="u08-suggestion"><span class="u08-severity ${a.severity}">${esc(a.severity==='fehlt'?'Fehlt':'Wenig')}</span><div><strong>${esc(a.name)}</strong><small>Ist ${fmt(a.stock)} · Mindestwert ${fmt(a.minQuantity)} ${esc(a.unit)}</small></div><button class="secondary-btn" type="button" data-shopping-action="suggest" data-id="${esc(a.id)}">+ Übernehmen</button></div>`).join('')||'<div class="u08-empty">Keine offenen Bestandswarnungen mit Mindestwert.</div>'}</div></section>
 <dialog id="u08-modal" class="catalog-dialog u08-modal" aria-labelledby="u08-dialog-title"></dialog>
 <template id="u08-article-options">${options([['','Freie Einkaufsposition'],...candidates.map(a=>[a.id,`${a.name} (${a.unit})`])],'')}</template>`;
}
function dialog(html){const d=document.getElementById('u08-modal');if(!d)return;d.innerHTML=`<div class="catalog-dialog-head"><span class="eyebrow">EINKAUF / LAGERHAUS</span><button class="modal-close" type="button" data-shopping-action="close" aria-label="Schließen">${icon('x',22)}</button></div>${html}`;if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');}
function errorBox(){return '<p class="form-error" id="u08-error" role="alert" hidden></p>';}
const formValues=f=>Object.fromEntries(new FormData(f).entries());
function openEditor(p){const existing=Boolean(p),a=articleFor(p?.articleId),values=p||{quantity:1,unit:'Stück',area:'privat',priority:'normal',shop:'',name:''};
 const articles=snapshot.articles.filter(a=>!a.archivedAt).sort((x,y)=>x.name.localeCompare(y.name,'de'));
 dialog(`<h2 id="u08-dialog-title">${existing?'Einkauf bearbeiten':'Einkauf hinzufügen'}</h2><p class="form-subtitle">Eine freie Position ist auch ohne Lagerartikel möglich.</p><form id="u08-editor-form" class="catalog-form-grid"><input type="hidden" name="purchaseId" value="${esc(p?.id||'')}">
 <label class="wide">Lagerartikel (optional)<select name="articleId" id="u08-article" ${existing?'disabled':''}>${options([['','Freie Einkaufsposition'],...articles.map(x=>[x.id,`${x.name} (${x.unit})`])],p?.articleId||'')}</select>${existing?`<input type="hidden" name="articleId" value="${esc(p.articleId||'')}">`:''}</label>
 <label class="wide">Name der Position<input name="name" id="u08-name" required maxlength="160" value="${esc(values.name)}" placeholder="z. B. Kaffee oder Schrauben"></label>
 <label>Wunschmenge<input name="quantity" type="number" step="0.001" min="0.001" required value="${esc(values.quantity)}"></label><label>Einheit<select name="unit" id="u08-unit">${units(values.unit)}</select></label>
 <label>Bereich<select name="area">${options(Object.entries(areas),values.area)}</select></label><label>Priorität<select name="priority">${options(Object.entries(titles),values.priority)}</select></label>
 <label class="wide">Geschäft (optional)<input name="shop" maxlength="100" value="${esc(values.shop)}" placeholder="z. B. Baumarkt, Lebensmittelgeschäft"></label>${errorBox()}
 <div class="catalog-form-actions wide"><button type="button" class="secondary-btn" data-shopping-action="close">Abbrechen</button><button class="primary-btn" type="submit">${existing?'Änderung speichern':'Zur Einkaufsliste'}</button></div></form>`);
}
function openPurchase(p){const article=articleFor(p.articleId),places=snapshot.locations.filter(l=>!l.archivedAt);const preferred=places.some(l=>l.id===article?.primaryLocationId)?article.primaryLocationId:places[0]?.id;
 dialog(`<h2 id="u08-dialog-title">Gekauften Bestand bestätigen</h2><p class="form-subtitle">${esc(p.name)} · Einmalige Buchung. Erst nach deiner Bestätigung wird der Bestand geändert.</p>
 <form id="u08-complete-form" class="catalog-form-grid"><input name="purchaseId" type="hidden" value="${esc(p.id)}"><label>Tatsächliche Menge<input type="number" name="actualQuantity" step="0.001" min="0.001" required value="${esc(p.quantity)}"></label><label>Einheit<select name="actualUnit">${units(p.unit)}</select></label>
 ${article?`<label class="wide">Ziel-Lagerort<select name="locationId" required>${options([['','Lagerort auswählen'],...places.map(l=>[l.id,l.name])],preferred)}</select></label>${article.packageSize>0&&article.packageUnit?`<label class="wide">Gebinde (optional)<input name="packCount" type="number" min="1" step="1" placeholder="z. B. 2 ganze Gebinde"><small>Falls angegeben, gilt: Anzahl × ${fmt(article.packageSize)} ${esc(article.packageUnit)}; nicht zusätzlich zur Mengenangabe.</small></label>`:''}`:'<p class="u08-note wide">Freie Position: als gekauft markieren, ohne Lagerbestand zu verändern.</p>'}
 ${errorBox()}<div class="catalog-form-actions wide"><button type="button" data-shopping-action="close" class="secondary-btn">Abbrechen</button><button class="primary-btn" type="submit">Gekauft bestätigen</button></div></form>`);
}
function displayError(e){const out=document.getElementById('u08-error');if(out){out.textContent=e?.message||'Änderung fehlgeschlagen.';out.hidden=false;}else window.alert(e?.message||'Aktion fehlgeschlagen.');}
export function filterShopping(){const list=document.querySelectorAll('[data-shopping-row]');let visible=0;for(const el of list){const shown=(filter==='all'||el.dataset.status===filter)&&(areaFilter==='all'||el.dataset.area===areaFilter)&&(priorityFilter==='all'||el.dataset.priority===priorityFilter)&&el.dataset.query.includes(search.toLocaleLowerCase('de'));el.hidden=!shown;if(shown)visible++;}const empty=document.getElementById('u08-list-empty');if(empty)empty.hidden=visible!==0;}
export function handleShoppingFilter(e){const t=e.target;if(t.id==='u08-status')filter=t.value;else if(t.id==='u08-area')areaFilter=t.value;else if(t.id==='u08-priority')priorityFilter=t.value;else if(t.id==='u08-search')search=t.value;else if(t.id==='u08-article'){const a=articleFor(t.value),form=t.closest('form');if(a){form.elements.name.value=a.name;form.elements.unit.value=a.unit;form.elements.area.value=a.section||'privat';}}else return;filterShopping();}
export async function handleShoppingClick(btn,refresh){const action=btn.dataset.shoppingAction,id=btn.dataset.id,p=snapshot?.purchases.find(x=>x.id===id);
 if(action==='new')return openEditor(null);if(action==='edit'&&p)return openEditor(p);if(action==='complete'&&p)return openPurchase(p);
 if(action==='close'){const d=document.getElementById('u08-modal');if(d?.close)d.close();else d?.removeAttribute('open');return;}
 try{
  if(action==='suggest'){
   const a=snapshot.suggestions.find(x=>x.id===id);if(!a)return;
   await addPurchase({articleId:id,quantity:a.need,unit:a.unit,area:a.section||'privat',priority:a.stock<=0?'dringend':'normal',source:'suggestion'});
  }else if(action==='reopen'&&p){if(!confirm(`„${p.name}“ wieder öffnen? Falls Lagerbestand eingebucht wurde, wird der Zugang nachvollziehbar storniert.`))return;await reopenPurchase(p.id);
  }else if(action==='archive'&&p){if(!confirm(`„${p.name}“ archivieren?`))return;await archivePurchase(p.id);
  }else return;
  await refresh();filterShopping();
 }catch(e){displayError(e);}
}
export async function handleShoppingSubmit(form,refresh){const button=form.querySelector('[type="submit"]');if(button)button.disabled=true;
 try{const data=formValues(form);if(form.id==='u08-editor-form'){if(data.purchaseId)await editPurchase(data.purchaseId,data);else await addPurchase(data);}else if(form.id==='u08-complete-form'){await completePurchase(data.purchaseId,data);}else return;
  const d=document.getElementById('u08-modal');if(d?.close)d.close();await refresh();filterShopping();
 }catch(e){displayError(e);}finally{if(button)button.disabled=false;}
}
