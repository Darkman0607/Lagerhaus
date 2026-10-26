/** U11 — local lot allocations, expiry, consumption insight, and product variants.
 * Stock remains authoritative in `stocks`; lots only annotate allocated parts of stock.
 */
import {openDatabase,StorageError,validateQuantity,DATABASE_VERSION} from './store.js';
import {convertQuantity,createCatalogArticle} from './catalog.js';
const uid=()=>crypto.randomUUID();
const at=()=>new Date().toISOString();
const idRx=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const num=n=>{const q=Number(n);validateQuantity(q);if(!(q>0))throw new StorageError('Menge muss größer als 0 sein.','VALIDATION');return q;};
const round=n=>Math.round(n*1000)/1000;
export function validDate(day){return typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;}
export function expiryStatus(day,warningDays=14,today=new Date().toISOString().slice(0,10)){
 if(!validDate(day))return 'unbekannt';
 const days=Math.round((Date.parse(day+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
 return days<0?'abgelaufen':days<=warningDays?'bald':'ok';
}
export function lotWarnings(lots,warningDays=14,today){return lots.filter(x=>x.quantity>0).map(x=>({...x,expiry:expiryStatus(x.bestBefore,warningDays,today)})).filter(x=>['bald','abgelaufen'].includes(x.expiry));}
export function groupVariants(articles,stocks,articleId){
 const root=articles.find(x=>x.id===articleId);if(!root)return null;
 const group=root.productGroupId||root.id;
 const variants=articles.filter(x=>!x.archivedAt&&(x.productGroupId||x.id)===group);
 const rows=variants.map(x=>({...x,quantity:round(stocks.filter(s=>s.articleId===x.id).reduce((sum,s)=>sum+s.quantity,0))}));
 let total=0,unit=root.unit,comparable=true;
 for(const row of rows){try{total=round(total+convertQuantity(row.quantity,row.unit,unit));}catch{comparable=false;}}
 return {rows,total:comparable?total:null,unit:comparable?unit:null};
}
function txn(db,names,fn){return new Promise((resolve,reject)=>{const tx=db.transaction(names,'readwrite');let value,problem;tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(problem||tx.error||new StorageError('Änderung zurückgerollt.','TRANSACTION'));const fail=e=>{problem=e;try{tx.abort()}catch{}};try{fn(tx,v=>value=v,fail)}catch(e){fail(e);}});}
export async function listLots(articleId=null){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(['lots'],'readonly');const r=articleId?tx.objectStore('lots').index('by_article').getAll(articleId):tx.objectStore('lots').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function setExpiryWarningDays(days){const n=Number(days);if(!Number.isSafeInteger(n)||n<0||n>365)throw new StorageError('Vorwarnzeit: 0 bis 365 Tage.','VALIDATION');const db=await openDatabase();return txn(db,['meta'],(tx,done)=>{tx.objectStore('meta').put({key:'expiryWarningDays',value:n,updatedAt:at()});done(n);});}
export async function getExpiryWarningDays(){const db=await openDatabase();return new Promise((resolve,reject)=>{const r=db.transaction('meta').objectStore('meta').get('expiryWarningDays');r.onsuccess=()=>resolve(Number.isSafeInteger(r.result?.value)?r.result.value:14);r.onerror=()=>reject(r.error);});}
/** Allocates only existing, unassigned stock. Does not book more stock. */
export async function assignLot({articleId,locationId,quantity,bestBefore,label=''}={}){
 if(!idRx.test(articleId||'')||!idRx.test(locationId||''))throw new StorageError('Artikel oder Lagerort ungültig.','VALIDATION');
 const q=num(quantity);if(!validDate(bestBefore))throw new StorageError('Bitte ein gültiges MHD angeben.','VALIDATION');
 if(typeof label!=='string'||label.length>80)throw new StorageError('Chargenname ist zu lang.','VALIDATION');
 const db=await openDatabase(),createdAt=at();
 return txn(db,['articles','stocks','lots','audit'],(tx,done,fail)=>{
  const ar=tx.objectStore('articles').get(articleId);ar.onsuccess=()=>{
   if(!ar.result||ar.result.archivedAt||!['food','consumable'].includes(ar.result.articleKind))return fail(new StorageError('Chargen sind nur für Lebensmittel und Verbrauchsartikel vorgesehen.','VALIDATION'));
   const sr=tx.objectStore('stocks').index('by_article_location').get([articleId,locationId]);sr.onsuccess=()=>{
    if(!sr.result)return fail(new StorageError('Hier ist noch kein Bestand vorhanden.','VALIDATION'));
    const lr=tx.objectStore('lots').index('by_article_location').getAll([articleId,locationId]);lr.onsuccess=()=>{
     const assigned=round(lr.result.reduce((s,x)=>s+x.quantity,0));
     if(round(assigned+q)>sr.result.quantity)return fail(new StorageError('Charge größer als verfügbarer, noch nicht zugeordneter Bestand.','INSUFFICIENT'));
     const row={id:uid(),articleId,locationId,quantity:q,bestBefore,label:label.trim(),createdAt,updatedAt:createdAt,schemaVersion:DATABASE_VERSION};tx.objectStore('lots').add(row);
     tx.objectStore('audit').add({id:uid(),type:'lot-assigned',entityId:articleId,source:'manual',createdAt,locationId,quantity:q,bestBefore});done(row);
    };
   };
  };
 });
}
/** Remove a lot tag without changing any real stock. Does not silently delete stock. */
export async function removeLot(lotId){if(!idRx.test(lotId||''))throw new StorageError('Ungültige Chargen-ID.','VALIDATION');const db=await openDatabase();return txn(db,['lots','audit'],(tx,done,fail)=>{const r=tx.objectStore('lots').get(lotId);r.onsuccess=()=>{if(!r.result)return fail(new StorageError('Charge nicht gefunden.','VALIDATION'));tx.objectStore('lots').delete(lotId);tx.objectStore('audit').add({id:uid(),type:'lot-removed',entityId:r.result.articleId,source:'manual',createdAt:at(),locationId:r.result.locationId,quantity:r.result.quantity});done(true);};});}
export function usageSummary(movements){const used=movements.filter(m=>m.bookType==='usage'&&!m.undoneAt&&m.delta<0).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));const sum=round(used.reduce((s,m)=>s-m.delta,0));return {count:used.length,quantity:sum,average:used.length?round(sum/used.length):null,lastAt:used.at(-1)?.createdAt||null,estimated:true};}
/** Clone the inventory SKU with zero opening stock; parent and variant remain independent. */
export async function addVariant(parent,{packageSize,packageUnit}={}){
 if(!parent||!idRx.test(parent.id)||parent.archivedAt||!['food','consumable'].includes(parent.articleKind))throw new StorageError('Nur aktive Lebensmittel und Verbrauchsartikel können Varianten erhalten.','VALIDATION');
 const size=num(packageSize);if(!packageUnit)throw new StorageError('Einheit des Gebindes fehlt.','VALIDATION');
 convertQuantity(size,packageUnit,parent.unit); // never invent conversions
 return createCatalogArticle({...parent,name:parent.name,quantity:0,locationId:parent.primaryLocationId,packageSize:size,packageUnit,variantOf:parent.id,image:null,bestBefore:''});
}
