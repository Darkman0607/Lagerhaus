import {icon} from '../core/icons.js';
import {escapeHtml as esc} from '../core/escape.js';
import {bookStock,undoBooking,setLocationThreshold,setArticleThreshold,setPackageBreakdown,stockLedger} from '../data/bookings.js';
import {locationPath} from '../data/locations.js';
const safe=v=>esc(v??'');
const format=n=>new Intl.NumberFormat('de-AT',{maximumFractionDigits:3}).format(n);
const STATUS={rot:['Bestand fehlt','red'],orange:['Mindestbestand','amber'],gruen:['Ausreichend','green']};
const bookLabels={receipt:'Wareneingang',issue:'Entnahme',usage:'Verbrauch',correction:'Inventurkorrektur',package:'Gebindebestand',reversal:'Storno',initial:'Anfangsbestand',transfer:'Umlagerung', 'transfer-undo':'Umlagerung storniert',manual:'Manuelle Buchung',inventory:'Inventur',receipt:'Wareneingang',usage:'Verbrauch'};
const date=v=>{try{return new Date(v).toLocaleString('de-AT')}catch{return v}};
const selectOptions=(items,blank,label)=>`<option value="">${blank}</option>`+items.map(i=>`<option value="${safe(i.id)}">${safe(label(i))}</option>`).join('');
let cached;
export async function bookingPanel(){cached=await stockLedger();const {articles,locations,rows,history}=cached;
 const articlesOptions=selectOptions(articles.slice().sort((a,b)=>a.name.localeCompare(b.name,'de')),'Artikel auswählen',a=>`${a.name} (${a.unit})`);
 const locOptions=selectOptions(locations,'Lagerort auswählen',l=>locationPath(l,locations));
 const levelRows=rows.slice().sort((a,b)=>a.status.localeCompare(b.status)||a.article.name.localeCompare(b.article.name,'de'));
 const productBreakdown=row=>{const st=row.packageState;return st?`<small class="booking-packs">${format(st.sealedPacks)} verschlossen + ${format(st.openQuantity)} ${safe(st.unit)} offen ${st.estimated?'<strong>· SCHÄTZUNG</strong>':'· gezählt'}</small>`:''};
 return `<article class="panel booking-panel" id="stock-bookings"><div class="list-heading"><div>${icon('clipboard',18)} <strong>Bestandsführung · Buchungen</strong></div><span class="chip success">U06 · Lokal & nachvollziehbar</span></div>
 <p class="booking-hint">Buche am konkreten Lagerort. Jede Änderung wird als eigene Bewegung protokolliert. Inventurkorrekturen brauchen einen Grund; Stornos bleiben in der Historie.</p>
 <form id="stock-book-form" class="booking-grid">
  <label>Artikel<select name="articleId" required>${articlesOptions}</select></label>
  <label>Lagerort<select name="locationId" required>${locOptions}</select></label>
  <label>Vorgang<select name="type"><option value="receipt">+ Wareneingang</option><option value="issue">− Entnahme</option><option value="usage">− Verbrauch</option><option value="correction">= Inventurkorrektur (absoluter Wert)</option></select></label>
  <label>Menge / neuer Bestand<input type="number" name="quantity" min="0" max="1000000000" step="0.001" required placeholder="0"></label>
  <label>Einheit<select name="unit"><option value="">Wie im Artikel</option><option>Stück</option><option>Paar</option><option>Packung</option><option>ml</option><option>l</option><option>g</option><option>kg</option><option>m</option></select></label>
  <label class="booking-wide">Grund / Notiz (bei Inventur Pflicht)<input name="note" maxlength="500" placeholder="z. B. 3 Stück verbraucht oder Inventur gezählt"></label>
  <button type="submit" class="primary-btn">${icon('plus',17)} Bestand buchen</button>
 </form><p class="booking-error" id="stock-book-error" role="alert" hidden></p>
 <details class="booking-options"><summary>Mindestbestand je Lagerort festlegen</summary><p>Artikelweit oder nur für den gewählten Lagerort. Bei ortsbezogener Einstellung bedeutet leer: Artikelwert verwenden. Nullbestand ist immer Rot.</p>
  <form id="stock-threshold-form" class="booking-grid"><label>Gültig für<select name="scope"><option value="location">Diesen Lagerort</option><option value="article">Artikel allgemein</option></select></label><label>Artikel<select required name="articleId">${articlesOptions}</select></label><label>Lagerort<select required name="locationId">${locOptions}</select></label><label>Mindestmenge (leer = Artikelwert)<input type="number" min="0" max="1000000000" step="0.001" name="minQuantity" placeholder="Artikelwert verwenden"></label><button class="secondary-btn" type="submit">Grenzwert speichern</button></form><p class="booking-error" id="stock-threshold-error" role="alert" hidden></p>
 </details>
 <details class="booking-options"><summary>Geschlossene und angebrochene Gebinde erfassen</summary><p>Nur für Verbrauchsartikel oder Lebensmittel mit bekanntem Packungsinhalt. Gesamtbestand = geschlossene × Inhalt + angebrochene Menge. Werte in der Lager-Einheit, Schätzungen werden sichtbar gekennzeichnet. Bei normalen Buchungen wird eine Gebindeaufteilung neu geschätzt.</p>
  <form id="stock-package-form" class="booking-grid"><label>Artikel<select name="articleId" required>${articlesOptions}</select></label><label>Lagerort<select name="locationId" required>${locOptions}</select></label><label>Verschlossene Gebinde<input name="sealedPacks" type="number" min="0" max="1000000000" step="1" required value="0"></label><label>Offene Menge (in Artikeleinheit)<input name="openQuantity" type="number" min="0" max="1000000000" step="0.001" required value="0"></label><label class="booking-checkbox"><input type="checkbox" name="estimated"> Füllstand nur geschätzt</label><label class="booking-wide">Inventurgrund *<input name="note" required maxlength="500" placeholder="z. B. 2 volle Flaschen + 250 ml offen gezählt"></label><button type="submit" class="secondary-btn">Gebinde & Gesamtbestand speichern</button></form><p class="booking-error" id="stock-package-error" role="alert" hidden></p>
 </details>
 <div class="booking-section-header"><h3>Bestandsampel pro Lagerort</h3><span>${rows.length} Bestandspositionen</span></div>
 ${levelRows.length?`<div class="booking-table-wrapper"><table class="booking-table"><thead><tr><th>Artikel / Lagerort</th><th>Bestand</th><th>Grenzwert</th><th>Ampel</th></tr></thead><tbody>${levelRows.slice(0,150).map(r=>`<tr><td><strong>${safe(r.article.name)}</strong><small>${safe(locationPath(r.location,locations))}</small>${productBreakdown(r)}</td><td>${format(r.quantity)} ${safe(r.article.unit||'Stück')}</td><td>${format(r.threshold)} ${safe(r.article.unit||'Stück')}</td><td><span class="stock-light ${STATUS[r.status][1]}"><i aria-hidden="true"></i>${STATUS[r.status][0]}</span></td></tr>`).join('')}</tbody></table></div>${levelRows.length>150?'<p class="booking-hint">Es werden die ersten 150 Bestandspositionen angezeigt.</p>':''}`:'<p class="booking-empty">Noch keine Bestandspositionen. Bitte zuerst einen Artikel mit Lagerort erfassen.</p>'}
 <div class="booking-section-header"><h3>Prüfbare Buchungshistorie</h3><span>Letzte 40 Buchungen</span></div>
 ${history.length?`<div class="booking-history">${history.slice(0,40).map(m=>{const a=articles.find(a=>a.id===m.articleId),l=locations.find(l=>l.id===m.locationId);const label=bookLabels[m.bookType||m.source]||m.bookType||m.source||'Buchung';
 return `<div class="booking-history-row"><div><strong>${safe(label)} · ${safe(a?.name||'Artikel')}</strong><small>${safe(l?locationPath(l,locations):'Früherer Ort')} · ${safe(date(m.createdAt))}</small><span>${format(m.before)} → ${format(m.after)} ${safe(a?.unit||'')} (${m.delta>=0?'+':''}${format(m.delta)})</span>${m.note?`<small>Grund: ${safe(m.note)}</small>`:''}${m.undoOf?'<small>Gegenbuchung · Original bleibt erhalten</small>':''}</div>${m.undoneAt?'<span class="chip quiet">Storniert</span>':m.bookType==='reversal'?'<span class="chip quiet">Gegenbuchung</span>':!['receipt','issue','usage','correction','package'].includes(m.bookType)?'<span class="chip quiet">Alte Buchung</span>':`<button type="button" data-stock-action="undo" data-id="${safe(m.id)}" class="secondary-btn">Stornieren</button>`}</div>`;}).join('')}</div>`:'<p class="booking-empty">Noch keine Buchungen über die Bestandsführung vorhanden.</p>'}
 </article>`;
}
const writeError=(form,msg)=>{const el=document.getElementById(`${form.id.replace('-form','')}-error`);if(el){el.textContent=msg;el.hidden=false;}};
export async function handleStockSubmit(form,refresh){const button=form.querySelector('[type="submit"]');button.disabled=true;try{
 const data=Object.fromEntries(new FormData(form).entries());
 if(form.id==='stock-book-form')await bookStock(data);
 else if(form.id==='stock-threshold-form'){if(data.scope==='article')await setArticleThreshold(data);else await setLocationThreshold(data);}
 else if(form.id==='stock-package-form')await setPackageBreakdown({...data,estimated:new FormData(form).has('estimated')});
 else return;
 await refresh();
 }catch(e){writeError(form,e.message||'Buchung konnte nicht gespeichert werden.');}finally{button.disabled=false;}}
export async function handleStockClick(button,refresh){if(button.dataset.stockAction!=='undo')return;
 if(!confirm('Diese Buchung stornieren? Es wird eine Gegenbuchung mit vollständiger Historie erstellt.'))return;
 try{await undoBooking(button.dataset.id);await refresh();}catch(e){alert(e.message||'Storno nicht möglich.');}}
