import {icon} from '../core/icons.js';
import {repository,friendlyStorageError} from '../data/store.js';
import {readSetup,saveSetup} from '../data/setup.js';
import {createBackup,inspectBackup,restoreBackup,MAX_BACKUP_BYTES} from '../data/backup.js';
const tools=[['Statistik','chart','Kennzahlen und Bestandsverlauf','V1.4']];
let pendingRestore=null;
const countsLabel=c=>`${c.articles} Artikel · ${c.locations} Lagerorte · ${c.stocks} Bestände · ${c.movements} Buchungen · ${c.media} Medien · ${c.purchases} Einkäufe · ${c.lots||0} MHD-Chargen`;
function status(msg,error=false){const el=document.getElementById('u10-result');if(el){el.textContent=msg;el.className='diagnostic-result '+(error?'diagnostic-error':'diagnostic-success');}}
export function downloadBackup(file){const url=URL.createObjectURL(file.blob);const a=document.createElement('a');a.href=url;a.download=file.filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export async function moreView(){
 pendingRestore=null;const [health,setup,summary]=await Promise.all([repository.health(),readSetup(),repository.summary()]);
 return `<section class="page-heading"><div><p class="eyebrow">SYSTEM / VERWALTUNG</p><h1>Mehr</h1><p>Sichern, wiederherstellen, einrichten und die App prüfen.</p></div><span class="chip success">V1.2.0 BETA 1 · U12</span></section>
 <section class="u10-grid"><article class="panel u10-card"><div class="panel-heading"><div><span class="eyebrow">DATEN / OFFLINE</span><h2>Vollständige Datensicherung</h2></div>${icon('shield',25)}</div><p>Alle vierzehn lokalen Datenbereiche einschließlich Fotos und Verlauf als eine prüfsummengeschützte JSON-Datei exportieren. Keine Cloud, keine automatische Übertragung.</p><button class="primary-btn" data-u10="export" type="button">${icon('box',17)} Backup herunterladen</button><small>Nach dem Download bitte kontrollieren, ob die Datei tatsächlich gespeichert wurde.</small></article>
 <article class="panel u10-card"><div class="panel-heading"><div><span class="eyebrow">DATEN / IMPORT</span><h2>Wiederherstellen</h2></div>${icon('wrench',25)}</div><p>Backup wählen und erst prüfen. Vor dem Überschreiben muss eine neue Sicherheitskopie des aktuellen Bestandes heruntergeladen werden.</p><label class="u10-file-label" for="u10-backup-file">Sicherungsdatei auswählen</label><input id="u10-backup-file" type="file" accept=".json,application/json"><div id="u10-preview" class="u10-preview" role="status">Noch keine Datei geprüft.</div>
 <button class="secondary-btn" type="button" data-u10="safety" id="u10-safety" disabled>Sicherheitskopie herunterladen</button><label class="u10-ack"><input id="u10-ack" type="checkbox" disabled> Ich habe die Sicherheitskopie tatsächlich gespeichert und überprüft.</label><button class="u10-danger" type="button" data-u10="restore" id="u10-restore" disabled>Geprüfte Sicherung wiederherstellen</button></article></section>
 <article class="panel u10-setup"><div class="panel-heading"><div><span class="eyebrow">START / EINRICHTUNG</span><h2>Ersteinrichtung</h2></div><span class="chip ${setup.completed?'success':'quiet'}">${setup.completed?'Eingerichtet':'Optional'}</span></div><p>Dein Lager funktioniert auch komplett leer. Demoartikel werden nicht automatisch angelegt.</p>
 <form id="u10-setup-form" class="u10-setup-form"><label>Standardbereich für neue Artikel<select name="section"><option value="privat" ${setup.section==='privat'?'selected':''}>Privat</option><option value="arbeit" ${setup.section==='arbeit'?'selected':''}>Arbeit</option><option value="gemeinsam" ${setup.section==='gemeinsam'?'selected':''}>Gemeinsam</option></select></label><label>Erster Lagerort (optional)<input name="locationName" maxlength="160" placeholder="z. B. Garage" autocomplete="off"></label><button class="primary-btn" type="submit">${icon('shield',17)} Einrichtung speichern</button></form><p class="u10-hint">${summary.articles} Artikel und ${ (await repository.locations()).filter(x=>!x.archivedAt).length} Lagerorte vorhanden. Weitere Lagerorte unter „Lager“, Artikel unter „Artikel“ anlegen.</p></article>
 <section class="tools-grid">${tools.map(([label,ico,sub,ver])=>`<article class="panel tool-card"><div class="tool-icon">${icon(ico,25)}</div><h2>${label}</h2><p>${sub}</p><span class="chip quiet">${ver}</span></article>`).join('')}</section>
 <article class="panel data-status-panel"><div class="panel-heading"><div><span class="eyebrow">DIAGNOSE</span><h2>Systemstatus und Updates</h2></div><span class="chip success">IndexedDB Schema ${health.version}</span></div><p>${health.stores.length} lokale Datenbereiche. Speicherinhalt wird bei App-Updates nicht absichtlich gelöscht. Ein Backup ist trotzdem notwendig; Browserdaten können verloren gehen.</p><div class="storage-detail"><span>${icon('shield',17)} Keine Cloud-Synchronisierung</span><span>${icon('wifi',17)} Offline-Modus nach erstmaliger Installation</span></div>
 <div class="u10-actions"><button class="secondary-btn" type="button" id="run-storage-check">${icon('wrench',17)} Speicher testen</button><button class="secondary-btn" type="button" data-u10="update">${icon('wifi',17)} Auf App-Update prüfen</button><button class="secondary-btn" type="button" data-u10="apply-update" id="u10-apply" disabled>Update installieren / Neu laden</button></div><div id="u10-result" class="diagnostic-result" role="status" aria-live="polite">Keine Prüfung durchgeführt.</div><p class="safety-tip">Wichtig: Vor dem Import muss die Sicherheitskopie als Datei auf dem Gerät liegen. Browserdaten nicht löschen. Wichtige Daten nie ausschließlich in der App aufbewahren.</p></article>`;
}
export async function runStorageDiagnostic(){return repository.checkWriteAccess();}
export async function handleMoreClick(button,rerender){
 const act=button.dataset.u10;
 if(!act)return;button.disabled=true;
 try{
  if(act==='export'){const b=await createBackup();downloadBackup(b);status(`Download ausgelöst: ${b.filename} (${(b.blob.size/1048576).toFixed(2)} MB). Enthalten: ${countsLabel(b.counts)}. Bitte die Datei im Download-Ordner prüfen.`);}
  if(act==='safety'){
   if(!pendingRestore)throw Error('Zuerst eine gültige Datei auswählen.');const b=await createBackup();downloadBackup({...b,filename:b.filename.replace('.json','-VOR-WIEDERHERSTELLUNG.json')});
   document.getElementById('u10-ack').disabled=false;status('Sicherheitskopie angefordert. Bitte im Download-Ordner auf Vorhandensein prüfen, dann das Kontrollkästchen aktivieren.');
  }
  if(act==='restore'){
   if(!pendingRestore||!document.getElementById('u10-ack')?.checked)throw Error('Sicherheitskopie wurde nicht bestätigt.');
   if(!confirm('ACHTUNG: Alle aktuellen Lagerhaus-Daten einschließlich Fotos werden durch die geprüfte Sicherung ersetzt. Sicherheitskopie bereits gespeichert?'))return;
   const result=await restoreBackup(pendingRestore);pendingRestore=null;await rerender();status('Wiederherstellung abgeschlossen: '+countsLabel(result.counts)+'. Neue Daten sind aktiv.');
  }
  if(act==='update'){
   if(!('serviceWorker'in navigator)){status('Service-Worker-Updates werden von diesem Browser nicht unterstützt.',true);return;}
   const reg=await navigator.serviceWorker.getRegistration('./');if(!reg){status('Kein Service Worker registriert. Starte die App über HTTPS.',true);return;}
   await reg.update();const waiting=reg.waiting;if(waiting){document.getElementById('u10-apply').disabled=false;status('Neue App-Version geladen. Zum Aktivieren „Update installieren / Neu laden“ wählen. Lokale Bestände bleiben gespeichert.');}
   else status('Update-Prüfung abgeschlossen. Kein wartendes Update erkannt. Neuere Versionen können je nach Browser bereits beim nächsten Öffnen aktiv sein.');
  }
  if(act==='apply-update'){
   const reg=await navigator.serviceWorker.getRegistration('./');if(!reg?.waiting){status('Kein wartendes Update vorhanden. Bitte zuerst „Auf App-Update prüfen“ wählen.',true);return;}
   reg.waiting.postMessage({type:'SKIP_WAITING'});status('Update wird aktiviert. Die App wird nach dem Wechsel neu geladen.');
  }
 }catch(e){status(e?.message||friendlyStorageError(e).message,true);}finally{if(button.isConnected&&act!=='apply-update')button.disabled=false;}
}
export async function handleBackupSelection(input){pendingRestore=null;const preview=document.getElementById('u10-preview'),safety=document.getElementById('u10-safety'),restore=document.getElementById('u10-restore'),ack=document.getElementById('u10-ack');
 safety.disabled=true;restore.disabled=true;ack.disabled=true;ack.checked=false;
 const file=input.files?.[0];if(!file){preview.textContent='Noch keine Datei gewählt.';return;}
 if(file.size>MAX_BACKUP_BYTES){preview.textContent='Datei ist größer als 150 MB.';return;}
 preview.textContent='Prüfsumme und Datenstruktur werden kontrolliert …';
 try{pendingRestore=await inspectBackup(await file.text());preview.textContent=`Gültiges Backup vom ${new Date(pendingRestore.exportedAt).toLocaleString('de-AT')}. ${countsLabel(pendingRestore.counts)}. SHA-256 geprüft.`;safety.disabled=false;}
 catch(e){preview.textContent=`Import abgelehnt – nichts verändert: ${e.message}`;}
}
export function handleBackupAcknowledgement(checked){const button=document.getElementById('u10-restore');if(button)button.disabled=!(checked&&pendingRestore);}
export async function handleSetup(form,rerender){const button=form.querySelector('[type=submit]');button.disabled=true;try{
 const data=new FormData(form),section=data.get('section'),name=String(data.get('locationName')||'').trim();
 if(name){const locations=await repository.locations();if(!locations.some(x=>!x.archivedAt&&!x.parentId&&x.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de')))await repository.addLocation({name});}
 await saveSetup({section,completed:true});await rerender();status('Einrichtung gespeichert. Du kannst jederzeit weitere Lagerorte und Artikel hinzufügen.');
 }catch(e){status(e.message||'Einrichtung fehlgeschlagen.',true);button.disabled=false;}
}
