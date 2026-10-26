/** Lagerhaus U06 — auditable stock bookings with local, atomic IndexedDB transactions. */
import {openDatabase, StorageError, validateQuantity, DATABASE_VERSION} from './store.js';
import {convertQuantity} from './catalog.js';

const uid=()=>crypto.randomUUID();
const stamp=()=>new Date().toISOString();
const MAX=1_000_000_000;
const ID=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const id=(v,label)=>{if(typeof v!=='string'||!ID.test(v))throw new StorageError(`${label} ist ungültig.`,'VALIDATION');return v;};
const reason=(v,required=false)=>{if(typeof v!=='string'||v.trim().length>500||required&&!v.trim())throw new StorageError('Begründung erforderlich (höchstens 500 Zeichen).','VALIDATION');return v.trim();};
const qty=(v,label='Menge')=>{const n=Number(v);if(v===''||v===null||v===undefined||!Number.isFinite(n))throw new StorageError(`${label} ist keine gültige Zahl.`,'VALIDATION');validateQuantity(n);return n;};
const round=n=>Math.round(n*1000)/1000;
const thresholdStatus=(quantity,limit)=>quantity<=0?'rot':limit>0&&quantity<=limit?'orange':'gruen';
export {thresholdStatus};
function transaction(db,names,action){return new Promise((resolve,reject)=>{
 const tx=db.transaction(names,'readwrite');let value,issue;
 tx.oncomplete=()=>resolve(value);
 tx.onabort=()=>reject(issue||tx.error||new StorageError('Die Buchung wurde komplett zurückgesetzt.','TRANSACTION'));
 const fail=error=>{issue=error;try{tx.abort();}catch{};};
 try{action(tx,v=>{value=v;},fail);}catch(e){fail(e);}
});}
function getContext(tx,articleId,locationId,fail,next){
 const a=tx.objectStore('articles').get(articleId);a.onsuccess=()=>{
  if(!a.result||a.result.archivedAt)return fail(new StorageError('Artikel fehlt oder ist archiviert.','VALIDATION'));
  const l=tx.objectStore('locations').get(locationId);l.onsuccess=()=>{
   if(!l.result||l.result.archivedAt)return fail(new StorageError('Lagerort fehlt oder ist archiviert.','VALIDATION'));
   const s=tx.objectStore('stocks').index('by_article_location').get([articleId,locationId]);s.onsuccess=()=>next(a.result,l.result,s.result);
  };
 };
}
function updateStock(tx,existing,articleId,locationId,quantity,at,more={}){
 const state=existing?.packageState;
 let packageState=state;
 if(state?.capacity>0){
  const packs=Math.floor(round(quantity/state.capacity+1e-9));
  const open=round(quantity-packs*state.capacity);
  packageState={capacity:state.capacity,sealedPacks:packs,openQuantity:open,unit:state.unit,estimated:true};
 }
 const row={...(existing||{}),id:existing?.id||uid(),articleId,locationId,quantity,createdAt:existing?.createdAt||at,updatedAt:at,schemaVersion:DATABASE_VERSION,...more};
 if(packageState)row.packageState=packageState;
 tx.objectStore('stocks').put(row);return row;
}
function ledger(tx,article,locationId,before,after,at,details){
 const movement={id:uid(),articleId:article.id,locationId,before,after,delta:round(after-before),createdAt:at,schemaVersion:DATABASE_VERSION,...details};
 tx.objectStore('movements').add(movement);
 tx.objectStore('audit').add({id:uid(),type:'stock-adjusted',entityId:article.id,source:details.source,createdAt:at,movementId:movement.id,locationId,before,after,delta:movement.delta,note:details.note||'',action:details.bookType});
 return movement;
}
/** Types receipt, issue, usage and correction. Correction enters an absolute target quantity. */
export async function bookStock({articleId,locationId,type,quantity,unit,note=''}={}){
 id(articleId,'Artikel-ID');id(locationId,'Lagerort-ID');
 if(!['receipt','issue','usage','correction'].includes(type))throw new StorageError('Unbekannte Buchungsart.','VALIDATION');
 const amount=qty(quantity,type==='correction'?'Neuer Bestand':'Buchungsmenge');
 if(type!=='correction'&&amount<=0||amount<0)throw new StorageError('Die Buchungsmenge muss positiv sein.','VALIDATION');
 note=reason(note,type==='correction');const db=await openDatabase(),at=stamp();
 return transaction(db,['articles','locations','stocks','movements','audit'],(tx,done,fail)=>{
  getContext(tx,articleId,locationId,fail,(article,location,stock)=>{
   try{
    const actualUnit=unit||article.unit||'Stück';
    const converted=convertQuantity(amount,actualUnit,article.unit||'Stück');
    const before=stock?.quantity||0;
    const after=type==='correction'?converted:round(before+(type==='receipt'?converted:-converted));
    if(after<0)throw new StorageError('Nicht genügend Bestand am gewählten Lagerort.','INSUFFICIENT');
    validateQuantity(after);
    if(type==='correction'&&after===before)throw new StorageError('Der korrigierte Bestand ist unverändert.','VALIDATION');
    const updated=updateStock(tx,stock,articleId,locationId,after,at);
    const mv=ledger(tx,article,locationId,before,after,at,{source:type==='receipt'?'receipt':type==='correction'?'inventory':'usage',bookType:type,note,enteredQuantity:amount,enteredUnit:actualUnit,undoneAt:null});
    done({...mv,stock:updated});
   }catch(e){fail(e);}
  });
 });
}
export async function undoBooking(movementId){id(movementId,'Buchungs-ID');const db=await openDatabase(),at=stamp();
 return transaction(db,['articles','locations','stocks','movements','audit'],(tx,done,fail)=>{
  const moves=tx.objectStore('movements'),r=moves.get(movementId);r.onsuccess=()=>{
   const original=r.result;
   if(!original||!['receipt','issue','usage','correction','package'].includes(original.bookType)||original.undoneAt||original.undoOf)return fail(new StorageError('Diese Buchung ist nicht stornierbar oder wurde bereits storniert.','VALIDATION'));
   getContext(tx,original.articleId,original.locationId,fail,(article,location,stock)=>{
    try{
     const before=stock?.quantity||0,after=round(before-original.delta);
     if(after<0)throw new StorageError('Storno nicht möglich: Der eingebuchte Bestand wurde bereits verwendet.','INSUFFICIENT');
     validateQuantity(after);
     updateStock(tx,stock,article.id,location.id,after,at);
     const reversal=ledger(tx,article,location.id,before,after,at,{source:'correction',bookType:'reversal',undoOf:movementId,note:`Storno von Buchung ${movementId}`});
     moves.put({...original,undoneAt:at,undoMovementId:reversal.id});
     done(reversal);
    }catch(e){fail(e);}
   });
  };
 });
}
/** Null means article-wide threshold; explicit 0 removes the location warning while 0 stock stays red. */
export async function setLocationThreshold({articleId,locationId,minQuantity}={}){
 id(articleId,'Artikel-ID');id(locationId,'Lagerort-ID');
 const limit=minQuantity===''||minQuantity==null?null:qty(minQuantity,'Mindestbestand');
 if(limit!==null&&limit<0)throw new StorageError('Mindestbestand darf nicht negativ sein.','VALIDATION');
 const db=await openDatabase(),at=stamp();
 return transaction(db,['articles','locations','stocks','audit'],(tx,done,fail)=>{
  getContext(tx,articleId,locationId,fail,(article,location,stock)=>{
   const row={...(stock||{}),id:stock?.id||uid(),articleId,locationId,quantity:stock?.quantity||0,createdAt:stock?.createdAt||at,updatedAt:at,schemaVersion:DATABASE_VERSION,lowThreshold:limit};
   tx.objectStore('stocks').put(row);
   tx.objectStore('audit').add({id:uid(),type:'stock-threshold',entityId:articleId,createdAt:at,source:'manual',locationId,before:stock?.lowThreshold??null,after:limit});done(row);
  });
 });
}
/** Global article threshold; an explicit location threshold takes priority. */
export async function setArticleThreshold({articleId,minQuantity}={}){
 id(articleId,'Artikel-ID');const limit=qty(minQuantity,'Mindestbestand');
 if(limit<0)throw new StorageError('Mindestbestand darf nicht negativ sein.','VALIDATION');
 const db=await openDatabase(),at=stamp();
 return transaction(db,['articles','audit'],(tx,done,fail)=>{
  const store=tx.objectStore('articles'),r=store.get(articleId);r.onsuccess=()=>{
   if(!r.result||r.result.archivedAt)return fail(new StorageError('Artikel nicht vorhanden.','VALIDATION'));
   const updated={...r.result,minQuantity:limit,updatedAt:at};store.put(updated);
   tx.objectStore('audit').add({id:uid(),type:'article-threshold',entityId:articleId,createdAt:at,source:'manual',before:r.result.minQuantity??null,after:limit});done(updated);
  };
 });
}
/** A breakdown is possible only if content unit converts to inventory base unit. No double counting. */
export async function setPackageBreakdown({articleId,locationId,sealedPacks,openQuantity,estimated=false,note=''}={}){
 id(articleId,'Artikel-ID');id(locationId,'Lagerort-ID');const sealed=qty(sealedPacks,'Verschlossene Gebinde');
 if(!Number.isSafeInteger(sealed)||sealed<0)throw new StorageError('Verschlossene Gebinde müssen eine ganze Zahl ab 0 sein.','VALIDATION');
 const open=qty(openQuantity,'Angebrochenes Gebinde');if(open<0)throw new StorageError('Offene Menge darf nicht negativ sein.','VALIDATION');
 note=reason(note,true);const db=await openDatabase(),at=stamp();
 return transaction(db,['articles','locations','stocks','movements','audit'],(tx,done,fail)=>{
  getContext(tx,articleId,locationId,fail,(article,location,stock)=>{
   try{
    if(!['consumable','food'].includes(article.articleKind))throw new StorageError('Gebindeverwaltung ist für Verbrauchsartikel und Lebensmittel vorgesehen.','VALIDATION');
    if(!(article.packageSize>0)||!article.packageUnit)throw new StorageError('Zuerst beim Artikel den Packungsinhalt mit Einheit eintragen.','VALIDATION');
    const capacity=convertQuantity(article.packageSize,article.packageUnit,article.unit);
    if(open>=capacity)throw new StorageError('Angebrochene Menge muss kleiner als ein volles Gebinde sein.','VALIDATION');
    const after=round(capacity*sealed+open);validateQuantity(after);
    const before=stock?.quantity||0;
    const packageState={capacity,unit:article.unit,sealedPacks:sealed,openQuantity:open,estimated:!!estimated};
    const row=updateStock(tx,stock,articleId,locationId,after,at,{packageState});
    const movement=ledger(tx,article,locationId,before,after,at,{source:'inventory',bookType:'package',note,undoneAt:null,packageState});
    done({...movement,stock:row});
   }catch(e){fail(e);}
  });
 });
}
export async function stockLedger(){const db=await openDatabase();return new Promise((resolve,reject)=>{
 const tx=db.transaction(['articles','locations','stocks','movements'],'readonly');const data={},names=['articles','locations','stocks','movements'];let pending=names.length;
 tx.onabort=()=>reject(tx.error||new StorageError('Bestandsdaten nicht lesbar.'));
 for(const name of names){const req=tx.objectStore(name).getAll();req.onsuccess=()=>{
  data[name]=req.result;if(--pending===0){
   const articleMap=new Map(data.articles.map(a=>[a.id,a]));const locationMap=new Map(data.locations.map(l=>[l.id,l]));
   const rows=data.stocks.filter(s=>articleMap.has(s.articleId)&&locationMap.has(s.locationId)&&!articleMap.get(s.articleId).archivedAt&&!locationMap.get(s.locationId).archivedAt).map(s=>({
    ...s,article:articleMap.get(s.articleId),location:locationMap.get(s.locationId),threshold:s.lowThreshold??articleMap.get(s.articleId).minQuantity??0,status:thresholdStatus(s.quantity,s.lowThreshold??articleMap.get(s.articleId).minQuantity??0)}));
   for(const article of data.articles){
    if(article.archivedAt||!article.primaryLocationId||!locationMap.has(article.primaryLocationId)||locationMap.get(article.primaryLocationId).archivedAt)continue;
    if(!rows.some(r=>r.articleId===article.id&&r.locationId===article.primaryLocationId)){
     rows.push({id:null,articleId:article.id,locationId:article.primaryLocationId,quantity:0,article,location:locationMap.get(article.primaryLocationId),threshold:article.minQuantity??0,status:'rot',isUnbooked:true});
    }
   }
   const history=data.movements.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
   resolve({articles:data.articles.filter(a=>!a.archivedAt),locations:data.locations.filter(l=>!l.archivedAt),rows,history});
  }
 };}
 });}
