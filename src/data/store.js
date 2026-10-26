/**
 * Lagerhaus U02 – local-only, versioned IndexedDB repository.
 * No demo inventory, no network/database telemetry.
 */
export const DATABASE_NAME = 'lagerhaus-local';
export const DATABASE_VERSION = 2;
export const STORE_NAMES = Object.freeze(['articles','locations','stocks','movements','media','purchases','audit','meta']);
const VALID_SOURCES = new Set(['manual','receipt','usage','correction','inventory','initial']);
const MAX_QUANTITY = 1_000_000_000;

export class StorageError extends Error {
  constructor(message, code = 'STORAGE_ERROR', cause) {
    super(message, {cause});
    this.name = 'StorageError';
    this.code = code;
  }
}

export function friendlyStorageError(error) {
  if (error instanceof StorageError) return error;
  const kind = error?.name || '';
  if (kind === 'QuotaExceededError') return new StorageError('Der Gerätespeicher ist voll oder das Browserkontingent wurde erreicht. Bitte Speicherplatz freigeben; bestehende App-Daten nicht löschen.', 'QUOTA', error);
  if (kind === 'SecurityError' || kind === 'NotAllowedError') return new StorageError('Der Browser verweigert den lokalen Speicherzugriff. Öffne die App in Chrome außerhalb des privaten Modus und prüfe die Website-Berechtigungen.', 'DENIED', error);
  if (kind === 'VersionError') return new StorageError('Die vorhandene Datenbank wurde mit einer neueren App-Version erstellt. Bitte die App aktualisieren; die gespeicherten Daten nicht löschen.', 'NEWER_SCHEMA', error);
  if (kind === 'AbortError' || kind === 'ConstraintError' || kind === 'DataError') return new StorageError('Die Speicherung wurde abgebrochen. Es wurden keine unvollständigen Bestandsbuchungen übernommen.', 'TRANSACTION', error);
  return new StorageError('Der lokale Datenspeicher konnte nicht gelesen oder beschrieben werden. Bitte die App neu öffnen und keine Browserdaten löschen.', 'STORAGE_ERROR', error);
}
function validateText(value, label, max=160) {
  if (typeof value !== 'string' || !value.trim()) throw new StorageError(`${label} ist ein Pflichtfeld.`, 'VALIDATION');
  const result=value.trim();
  if(result.length>max)throw new StorageError(`${label} darf höchstens ${max} Zeichen enthalten.`, 'VALIDATION');
  return result;
}
export function validateQuantity(quantity) {
  if(typeof quantity!=='number'||!Number.isFinite(quantity)||Math.abs(quantity)>MAX_QUANTITY||Math.abs(quantity-Math.round(quantity*1000)/1000)>1e-9){
    throw new StorageError('Mengen müssen endliche Zahlen mit maximal drei Nachkommastellen und einem Betrag bis 1 Milliarde sein.','VALIDATION');
  }
  return quantity;
}
function makeId(){
  if(!globalThis.crypto?.randomUUID)throw new StorageError('Sichere UUIDs sind nicht verfügbar. Bitte die App über HTTPS oder localhost öffnen.','UNSUPPORTED');
  return crypto.randomUUID();
}
function ensureId(value,label='ID'){
  if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)){
    throw new StorageError(`${label} ist ungültig.`,'VALIDATION');
  }
  return value;
}
const iso=()=>new Date().toISOString();
function makeStore(db,tx,name,keyPath='id'){
  return db.objectStoreNames.contains(name)?tx.objectStore(name):db.createObjectStore(name,{keyPath});
}
function makeIndex(store,name,keyPath,options={}){if(!store.indexNames.contains(name))store.createIndex(name,keyPath,options);}
function migrate(db,tx,oldVersion){
  // All migrations are additive and execute inside the native versionchange transaction.
  // In particular, existing data is never cleared during an upgrade.
  if(oldVersion<1){for(const name of STORE_NAMES)makeStore(db,tx,name,name==='meta'?'key':'id');}
  if(oldVersion<2){
    // Also accept sparse legacy v1 databases (e.g. early private betas).
    for(const name of STORE_NAMES)makeStore(db,tx,name,name==='meta'?'key':'id');
    makeIndex(makeStore(db,tx,'articles'),'by_name','name');
    makeIndex(makeStore(db,tx,'locations'),'by_name','name');
    makeIndex(makeStore(db,tx,'stocks'),'by_article_location',['articleId','locationId'],{unique:true});
    makeIndex(makeStore(db,tx,'stocks'),'by_article','articleId');
    makeIndex(makeStore(db,tx,'movements'),'by_article','articleId');
    makeIndex(makeStore(db,tx,'movements'),'by_created','createdAt');
    makeIndex(makeStore(db,tx,'media'),'by_owner',['ownerType','ownerId']);
    makeIndex(makeStore(db,tx,'audit'),'by_created','createdAt');
  }
}
let openPromise;
export function openDatabase(){
  if(openPromise)return openPromise;
  openPromise = new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new StorageError('IndexedDB wird in diesem Browser nicht unterstützt oder ist deaktiviert.','UNSUPPORTED'));return;}
    let req;try{req=indexedDB.open(DATABASE_NAME,DATABASE_VERSION);}catch(error){reject(friendlyStorageError(error));return;}
    let finished=false;
    const watchdog=setTimeout(()=>{if(!finished){finished=true;reject(new StorageError('Datenbankzugriff blockiert. Bitte andere geöffnete Lagerhaus-Tabs schließen und die Seite neu laden.','BLOCKED'));}},12000);
    const fail=e=>{if(!finished){finished=true;clearTimeout(watchdog);reject(friendlyStorageError(e));}};
    req.onupgradeneeded=event=>{try{migrate(req.result,req.transaction,event.oldVersion);}catch(e){try{req.transaction.abort();}catch{}fail(e);}};
    req.onblocked=()=>fail(new StorageError('Eine andere App-Registerkarte blockiert das Datenbank-Upgrade. Bitte andere Lagerhaus-Fenster schließen.','BLOCKED'));
    req.onerror=()=>fail(req.error);
    req.onsuccess=()=>{const db=req.result;
      if(finished){db.close();return;}
      finished=true;clearTimeout(watchdog);
      db.onversionchange=()=>{db.close();openPromise=undefined;globalThis.dispatchEvent?.(new Event('lagerhaus:database-upgrade'));};
      resolve(db);
    };
  }).catch(e=>{openPromise=undefined;throw friendlyStorageError(e);});
  return openPromise;
}
function transact(db,names,mode,operation){
  return new Promise((resolve,reject)=>{
    let tx;try{tx=db.transaction(names,mode);}catch(error){reject(friendlyStorageError(error));return;}
    let result,committed=false;
    tx.oncomplete=()=>{committed=true;resolve(result);};
    tx.onabort=()=>reject(friendlyStorageError(tx.error||new DOMException('Buchung abgebrochen','AbortError')));
    tx.onerror=()=>{}; // onabort is the single rejection channel
    try{operation(tx, value=>{result=value;});}catch(error){
      try{tx.abort();}catch{}
      if(!committed)reject(friendlyStorageError(error));
    }
  });
}
const findAll=(store,done)=>{const req=store.getAll();req.onsuccess=()=>done(req.result);};
const getRecord=(store,id,done)=>{const req=store.get(id);req.onsuccess=()=>done(req.result);};
const activity=(id,type,entityId,source,at,details={})=>({id,type,entityId,source,createdAt:at,...details});

export class WarehouseRepository {
  async ready(){return openDatabase();}
  async health(){const db=await this.ready();return {name:db.name,version:db.version,stores:Array.from(db.objectStoreNames),persistent:false};}
  async summary(){
    const db=await this.ready();
    return transact(db,['articles','stocks','purchases'],'readonly',(tx,done)=>{
      let pending=3,articles=[],stocks=[],purchases=[];
      const finish=()=>{
        if(--pending!==0)return;
        const totals=new Map();
        for(const s of stocks)totals.set(s.articleId,(totals.get(s.articleId)||0)+s.quantity);
        const trackable=articles.filter(a=>Number.isFinite(a.minQuantity)&&a.minQuantity>0);
        done({
          articles:articles.length,
          lowStock:trackable.filter(a=>(totals.get(a.id)||0)>0&&(totals.get(a.id)||0)<a.minQuantity).length,
          outOfStock:trackable.filter(a=>(totals.get(a.id)||0)===0).length,
          openPurchases:purchases.filter(p=>p.status!=='done').length
        });
      };
      const a=tx.objectStore('articles').getAll();a.onsuccess=()=>{articles=a.result;finish();};
      const s=tx.objectStore('stocks').getAll();s.onsuccess=()=>{stocks=s.result;finish();};
      const p=tx.objectStore('purchases').getAll();p.onsuccess=()=>{purchases=p.result;finish();};
    });
  }
  async articles(){const db=await this.ready();return transact(db,['articles'],'readonly',(tx,done)=>findAll(tx.objectStore('articles'),done));}
  async locations(){const db=await this.ready();return transact(db,['locations'],'readonly',(tx,done)=>findAll(tx.objectStore('locations'),done));}
  async purchases(){const db=await this.ready();return transact(db,['purchases'],'readonly',(tx,done)=>findAll(tx.objectStore('purchases'),done));}
  async stocks(){const db=await this.ready();return transact(db,['stocks'],'readonly',(tx,done)=>findAll(tx.objectStore('stocks'),done));}
  async recentActivity(limit=12){const db=await this.ready();return transact(db,['audit'],'readonly',(tx,done)=>{const r=tx.objectStore('audit').index('by_created').openCursor(null,'prev');const rows=[];r.onsuccess=()=>{const c=r.result;if(c&&rows.length<limit){rows.push(c.value);c.continue();}else done(rows);};});}
  async addArticle(input){
    const name=validateText(input?.name,'Artikelname');const minQuantity=input?.minQuantity===undefined?null:validateQuantity(input.minQuantity);
    if(minQuantity!==null&&minQuantity<0)throw new StorageError('Mindestbestand darf nicht negativ sein.','VALIDATION');
    const at=iso();const row={id:makeId(),name,unit:input?.unit||'Stück',minQuantity,createdAt:at,updatedAt:at,schemaVersion:DATABASE_VERSION};
    const db=await this.ready();await transact(db,['articles','audit'],'readwrite',tx=>{tx.objectStore('articles').add(row);tx.objectStore('audit').add(activity(makeId(),'article-created',row.id,'manual',at,{name}));});
    return row;
  }
  async addLocation(input){
    const name=validateText(input?.name,'Lagerort');const at=iso();const row={id:makeId(),name,createdAt:at,updatedAt:at,schemaVersion:DATABASE_VERSION};
    const db=await this.ready();await transact(db,['locations','audit'],'readwrite',tx=>{tx.objectStore('locations').add(row);tx.objectStore('audit').add(activity(makeId(),'location-created',row.id,'manual',at,{name}));});return row;
  }
  async applyMovement({articleId,locationId,delta,source='manual',note=''}){
    ensureId(articleId,'Artikel-ID');ensureId(locationId,'Lagerort-ID');validateQuantity(delta);
    if(delta===0)throw new StorageError('Eine Bestandsänderung muss ungleich 0 sein.','VALIDATION');
    if(!VALID_SOURCES.has(source))throw new StorageError('Die Buchungsquelle ist unbekannt.','VALIDATION');
    if(typeof note!=='string'||note.length>500)throw new StorageError('Buchungsnotiz darf höchstens 500 Zeichen enthalten.','VALIDATION');
    const db=await this.ready();const at=iso(),movementId=makeId();
    return transact(db,['articles','locations','stocks','movements','audit'],'readwrite',(tx,done)=>{
      const articles=tx.objectStore('articles'),locations=tx.objectStore('locations'),stocks=tx.objectStore('stocks');
      const a=articles.get(articleId);
      a.onsuccess=()=>{
        if(!a.result){tx.abort();return;}
        const l=locations.get(locationId);
        l.onsuccess=()=>{
          if(!l.result){tx.abort();return;}
          const lookup=stocks.index('by_article_location').get([articleId,locationId]);
          lookup.onsuccess=()=>{
            const existing=lookup.result;const before=existing?.quantity||0;
            const after=Math.round((before+delta)*1000)/1000;
            if(after<0||!Number.isFinite(after)||after>MAX_QUANTITY){tx.abort();return;}
            const current={id:existing?.id||makeId(),articleId,locationId,quantity:after,createdAt:existing?.createdAt||at,updatedAt:at,schemaVersion:DATABASE_VERSION};
            stocks.put(current);
            const movement={id:movementId,articleId,locationId,delta,before,after,source,note:note.trim(),createdAt:at,schemaVersion:DATABASE_VERSION};
            tx.objectStore('movements').add(movement);
            tx.objectStore('audit').add(activity(makeId(),'stock-adjusted',articleId,source,at,{movementId,locationId,delta,before,after}));
            done(movement);
          };
        };
      };
    });
  }
  async movements(articleId){
    ensureId(articleId,'Artikel-ID');const db=await this.ready();return transact(db,['movements'],'readonly',(tx,done)=>{
      const req=tx.objectStore('movements').index('by_article').getAll(articleId);req.onsuccess=()=>done(req.result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
    });
  }
  async saveMedia({ownerType,ownerId,name,blob}){
    if(!['article','location'].includes(ownerType))throw new StorageError('Ungültiger Medientyp.','VALIDATION');
    ensureId(ownerId);const title=validateText(name,'Dateiname',200);
    if(!(blob instanceof Blob)||blob.size<=0||blob.size>10_000_000)throw new StorageError('Dateigröße muss zwischen 1 Byte und 10 MB liegen.','VALIDATION');
    const at=iso();const row={id:makeId(),ownerType,ownerId,name:title,blob,createdAt:at,updatedAt:at};const db=await this.ready();
    await transact(db,['media'],'readwrite',tx=>tx.objectStore('media').add(row));return {id:row.id,name:row.name,createdAt:at};
  }
  async checkWriteAccess(){
    const db=await this.ready();const key=`health-${makeId()}`,value={key,createdAt:iso()};
    await transact(db,['meta'],'readwrite',tx=>tx.objectStore('meta').put(value));
    try{
      const found=await transact(db,['meta'],'readonly',(tx,done)=>getRecord(tx.objectStore('meta'),key,done));
      if(!found||found.key!==key)throw new StorageError('Schreibprüfung konnte den Testdatensatz nicht lesen.','VERIFY');
      return {ok:true,version:db.version};
    }finally{await transact(db,['meta'],'readwrite',tx=>tx.objectStore('meta').delete(key));}
  }
}
export const repository = new WarehouseRepository();
