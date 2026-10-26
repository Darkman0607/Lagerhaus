/** U10: offline, full-store, checked backup and transactional restore. No network requests. */
import {openDatabase,STORE_NAMES,DATABASE_VERSION,StorageError} from './store.js';
export const BACKUP_FORMAT='lagerhaus-backup';
export const BACKUP_VERSION=1;
export const MAX_BACKUP_BYTES=150_000_000;
const MAX_ROWS=100_000;
const fail=(message)=>new StorageError(message,'BACKUP');
const bytes=new TextEncoder();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hex=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
const encode64=array=>{let out='';for(let i=0;i<array.length;i+=32768)out+=String.fromCharCode(...array.subarray(i,i+32768));return btoa(out);};
function decode64(s){if(typeof s!=='string'||s.length>14_000_000||s.length%4===1||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw fail('Ungültige Bilddaten in der Sicherung.');try{const raw=atob(s),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;}catch{throw fail('Bilddaten konnten nicht decodiert werden.');}}
function readStores(db){return new Promise((resolve,reject)=>{
 const stores={},tx=db.transaction(STORE_NAMES,'readonly');let remaining=STORE_NAMES.length;
 tx.onabort=()=>reject(tx.error||fail('Die Sicherung konnte nicht gelesen werden.'));
 tx.onerror=()=>{};
 tx.oncomplete=()=>resolve(stores);
 for(const name of STORE_NAMES){const req=tx.objectStore(name).getAll();req.onsuccess=()=>{stores[name]=req.result;remaining--;};}
 });}
async function toPortable(stores){
 const out={};for(const name of STORE_NAMES){out[name]=[];
 for(const row of stores[name]){
  if(name==='media'){if(!(row.blob instanceof Blob))throw fail('Ein gespeichertes Medium enthält keine lesbaren Binärdaten. Export abgebrochen.');if(row.blob.size>10_000_000)throw fail('Ein Medium ist größer als 10 MB und kann nicht sicher exportiert werden.');
   const {blob,...rest}=row;out[name].push({...rest,backupBlob:{type:blob.type,bytes:blob.size,base64:encode64(new Uint8Array(await blob.arrayBuffer()))}});
  }else out[name].push(row);
 }}return out;
}
export async function createBackup(){
 if(!crypto?.subtle)throw fail('Sichere Prüfsummen brauchen HTTPS oder localhost.');
 const db=await openDatabase();const portable=await toPortable(await readStores(db));
 const payload={format:BACKUP_FORMAT,formatVersion:BACKUP_VERSION,schemaVersion:DATABASE_VERSION,appVersion:'1.2.0-beta.1',exportedAt:new Date().toISOString(),stores:portable};
 const body=JSON.stringify(payload);const checksum=await hex(body);const file=new Blob([JSON.stringify({payload,checksum})],{type:'application/json'});
 if(file.size>MAX_BACKUP_BYTES)throw fail('Sicherung zu groß (maximal 150 MB).');
 return {blob:file,checksum,counts:Object.fromEntries(STORE_NAMES.map(n=>[n,portable[n].length])),filename:`lagerhaus-backup-${new Date().toISOString().slice(0,10)}.json`};
}
function validRow(name,row,ids){
 if(!row||typeof row!=='object'||Array.isArray(row))throw fail(`Datensatz in ${name} ist ungültig.`);
 const key=name==='meta'?'key':'id';if(typeof row[key]!=='string'||!row[key]||row[key].length>200)throw fail(`Ungültiger Schlüssel in ${name}.`);
 if(name!=='meta'&&!uuid.test(row.id))throw fail(`Ungültige Datensatz-ID in ${name}.`);
 if(ids.has(row[key]))throw fail(`Doppelte Schlüssel in ${name}.`);ids.add(row[key]);
 if(name==='stocks'&&(!uuid.test(row.articleId||'')||!uuid.test(row.locationId||'')||!Number.isFinite(row.quantity)||row.quantity<0||row.quantity>1e9))throw fail('Ungültiger Lagerbestand in der Sicherung.');
 if(name==='devices'&&(!uuid.test(row.articleId||'')||!Number.isFinite(row.meterHours)||row.meterHours<0||row.meterHours>1e7))throw fail('Geräteprofil ungültig.');
 if(name==='maintenancePlans'&&(!uuid.test(row.deviceId||'')||typeof row.title!=='string'||!row.title.trim()||row.title.length>120))throw fail('Wartungsplan ungültig.');
 if(name==='maintenanceEvents'&&(!uuid.test(row.deviceId||'')||!uuid.test(row.planId||'')||typeof row.performedOn!=='string'||Number.isNaN(Date.parse(row.performedOn))||!Number.isFinite(row.cost)||row.cost<0))throw fail('Wartungsereignis ungültig.');
 if(name==='deviceParts'&&(!uuid.test(row.deviceId||'')||!uuid.test(row.articleId||'')))throw fail('Ersatzteilverknüpfung ungültig.');
 if(name==='lots'&&(!uuid.test(row.articleId||'')||!uuid.test(row.locationId||'')||!Number.isFinite(row.quantity)||row.quantity<0||row.quantity>1e9||!/^\d{4}-\d{2}-\d{2}$/.test(row.bestBefore||'')||Number.isNaN(Date.parse(row.bestBefore))))throw fail('Ungültige Charge in der Sicherung.');
}
function validateStructure(payload){
 if(!payload||payload.format!==BACKUP_FORMAT||payload.formatVersion!==BACKUP_VERSION)throw fail('Dies ist keine unterstützte Lagerhaus-Sicherung.');
 if(![5,6,DATABASE_VERSION].includes(payload.schemaVersion))throw fail(`Backup-Schema ${payload.schemaVersion} wird nicht unterstützt. Benötigt wird Schema 5, 6 oder ${DATABASE_VERSION}.`);
 if(!payload.stores||typeof payload.stores!=='object'||Array.isArray(payload.stores)||Object.keys(payload.stores).sort().join(',')!==STORE_NAMES.filter(n=>!(n==='lots'&&payload.schemaVersion<6)&&!(['devices','maintenancePlans','maintenanceEvents','deviceParts'].includes(n)&&payload.schemaVersion<7)).sort().join(','))throw fail('Die Sicherung enthält nicht alle erforderlichen Datenbereiche.');
 if(!payload.exportedAt||!Number.isFinite(Date.parse(payload.exportedAt)))throw fail('Sicherungsdatum ist ungültig.');
 const idsByStore={};for(const name of STORE_NAMES){const rows=(name==='lots'&&payload.schemaVersion===5)||(['devices','maintenancePlans','maintenanceEvents','deviceParts'].includes(name)&&payload.schemaVersion<7)?[]:payload.stores[name];if(!Array.isArray(rows)||rows.length>MAX_ROWS)throw fail(`Datenbereich ${name} ist ungültig oder zu groß.`);
 const ids=new Set();for(const row of rows)validRow(name,row,ids);idsByStore[name]=ids;
 }
 for(const stock of payload.stores.stocks){if(!idsByStore.articles.has(stock.articleId)||!idsByStore.locations.has(stock.locationId))throw fail('Bestand verweist auf einen fehlenden Artikel oder Lagerort.');}
 const stockByPair=new Map(payload.stores.stocks.map(s=>[s.articleId+'|'+s.locationId,s.quantity]));
 const lotTotal=new Map();for(const lot of payload.stores.lots||[]){const pair=lot.articleId+'|'+lot.locationId;if(!stockByPair.has(pair))throw fail('Charge ohne zugehörigen Bestand.');lotTotal.set(pair,(lotTotal.get(pair)||0)+lot.quantity);if(lotTotal.get(pair)>stockByPair.get(pair)+0.000001)throw fail('Chargen überschreiten den Artikelbestand.');}
 const pairs=new Set();for(const s of payload.stores.stocks){const pair=s.articleId+'|'+s.locationId;if(pairs.has(pair))throw fail('Doppelter Artikelbestand am selben Lagerort.');pairs.add(pair);}
 for(const d of payload.stores.devices||[]){if(!idsByStore.articles.has(d.articleId)||(d.locationId&&!idsByStore.locations.has(d.locationId)))throw fail('Gerät verweist auf fehlenden Artikel/Lagerort.');}
 for(const plan of payload.stores.maintenancePlans||[]){if(!idsByStore.devices.has(plan.deviceId))throw fail('Wartungsplan verweist auf fehlendes Gerät.');}
 for(const event of payload.stores.maintenanceEvents||[]){const plan=(payload.stores.maintenancePlans||[]).find(x=>x.id===event.planId);if(!idsByStore.devices.has(event.deviceId)||!plan||plan.deviceId!==event.deviceId)throw fail('Wartungshistorie verweist auf fehlenden oder falschen Plan.');}
 const links=new Set();for(const link of payload.stores.deviceParts||[]){if(!idsByStore.devices.has(link.deviceId)||!idsByStore.articles.has(link.articleId)||links.has(link.deviceId+'|'+link.articleId))throw fail('Ersatzteilverknüpfung verweist auf fehlende Daten oder ist doppelt.');links.add(link.deviceId+'|'+link.articleId);}
 for(const media of payload.stores.media){if(media.ownerType==='device'&&!idsByStore.devices.has(media.ownerId)||media.ownerType==='maintenance'&&!idsByStore.maintenanceEvents.has(media.ownerId))throw fail('Wartungsfoto ohne zugehörigen Datensatz.');if(media.backupBlob){const b=media.backupBlob;if(!Number.isSafeInteger(b.bytes)||b.bytes<0||b.bytes>10_000_000||typeof b.type!=='string'||b.type.length>150)throw fail('Ungültige Medien-Metadaten.');if(!['image/png','image/jpeg','image/webp','application/pdf'].includes(b.type))throw fail('Unsicherer Medientyp.');if(typeof b.base64!=='string'||b.base64.length>Math.ceil(b.bytes/3)*4+4)throw fail('Ungültige Mediendaten.');}else if('blob'in media)throw fail('Sicherung enthält ein nicht portables Medium.');}
 return payload;
}
export async function inspectBackup(text){
 if(typeof text!=='string'||bytes.encode(text).length>MAX_BACKUP_BYTES)throw fail('Datei fehlt oder ist größer als 150 MB.');
 let doc;try{doc=JSON.parse(text);}catch{throw fail('Die Datei ist kein gültiges JSON-Backup.');}
 if(!doc||typeof doc.checksum!=='string'||!/^[a-f0-9]{64}$/.test(doc.checksum))throw fail('Die Prüfsumme fehlt.');
 const current=await hex(JSON.stringify(doc.payload));
 if(doc.checksum!==current)throw fail('Prüfsummenfehler: Das Backup wurde verändert oder ist beschädigt.');
 const payload=validateStructure(doc.payload);
 const counts=Object.fromEntries(STORE_NAMES.map(n=>[n,(payload.stores[n]||[]).length]));
 return {payload,counts,exportedAt:payload.exportedAt,checksum:current};
}
async function nativeRecords(payload){const result={};for(const name of STORE_NAMES){result[name]=[];for(const row of payload.stores[name]||[]){
 if(name==='media'&&row.backupBlob){const {backupBlob,...rest}=row;const raw=decode64(backupBlob.base64);if(raw.byteLength!==backupBlob.bytes)throw fail('Bilddaten passen nicht zur angegebenen Länge.');result[name].push({...rest,blob:new Blob([raw],{type:backupBlob.type})});}
 else result[name].push(row);
 }}return result;}
/** Restore is all-or-nothing: one readwrite transaction across every store. */
export async function restoreBackup(inspection){
 if(!inspection?.payload)throw fail('Backup muss vor dem Wiederherstellen geprüft werden.');
 const check=await hex(JSON.stringify(inspection.payload));if(check!==inspection.checksum)throw fail('Prüfsumme seit der Vorschau verändert.');
 validateStructure(inspection.payload);const records=await nativeRecords(inspection.payload);
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{
  let tx;try{tx=db.transaction(STORE_NAMES,'readwrite');}catch(e){reject(e);return;}
  tx.oncomplete=()=>resolve({counts:inspection.counts});
  tx.onabort=()=>reject(tx.error||fail('Wiederherstellung wurde vollständig zurückgerollt.'));
  tx.onerror=()=>{};
  try{for(const name of STORE_NAMES){const os=tx.objectStore(name);os.clear();for(const row of records[name])os.add(row);}}catch(e){try{tx.abort();}catch{}reject(e);}
 });
}
