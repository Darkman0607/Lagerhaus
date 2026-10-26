/** U08 — shopping list, shortage suggestions and atomic receipt/reversal. Schema 5, local only. */
import {openDatabase,StorageError,validateQuantity,DATABASE_VERSION} from './store.js';
import {convertQuantity,UNITS} from './catalog.js';
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const LIMIT=1_000_000_000;
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const checkedId=(v,label)=>{if(typeof v!=='string'||!ID.test(v))throw new StorageError(`${label} ungültig.`,'VALIDATION');return v;};
const text=(v,label,max=160,required=false)=>{if(typeof v!=='string'||v.trim().length>max||required&&!v.trim())throw new StorageError(`${label} ungültig (max. ${max} Zeichen).`,'VALIDATION');return v.trim();};
const quantity=(v,label='Menge',positive=true)=>{if(v==null||v==='')throw new StorageError(`${label} fehlt.`,'VALIDATION');const n=Number(v);validateQuantity(n);if(positive&&n<=0||n<0||n>LIMIT)throw new StorageError(`${label} muss größer als 0 sein.`,'VALIDATION');return n;};
const rounded=n=>Math.round(n*1000)/1000;
function txWrite(db,names,handler){return new Promise((resolve,reject)=>{
 const tx=db.transaction(names,'readwrite');let response,issue;
 tx.oncomplete=()=>resolve(response);tx.onabort=()=>reject(issue||tx.error||new StorageError('Einkauf wurde vollständig zurückgesetzt.','TRANSACTION'));
 const fail=e=>{issue=e;try{tx.abort();}catch{}};
 try{handler(tx,v=>{response=v;},fail);}catch(e){fail(e);}
});}
const select=['dringend','normal','später'];
const areaOptions=['privat','arbeit','gemeinsam'];
const checkAttrs=input=>{
 const articleId=input.articleId?checkedId(input.articleId,'Artikel-ID'):null;
 const name=text(input.name||'','Bezeichnung',160,!articleId);
 const area=input.area||'privat',priority=input.priority||'normal',shop=text(input.shop??'','Geschäft',100);
 if(!areaOptions.includes(area)||!select.includes(priority))throw new StorageError('Bereich oder Priorität ungültig.','VALIDATION');
 const amount=quantity(input.quantity),unit=input.unit||'Stück';
 if(!UNITS.includes(unit))throw new StorageError('Unbekannte Einheit.','VALIDATION');
 return {articleId,name,area,priority,shop,quantity:amount,unit};
};
export function shortageSuggestions(articles,stocks,purchases){
 const totals=new Map();for(const stock of stocks)if(stock.quantity>0)totals.set(stock.articleId,rounded((totals.get(stock.articleId)||0)+stock.quantity));
 const requested=new Set(purchases.filter(p=>p.articleId&&p.status==='open').map(p=>p.articleId));
 return articles.filter(a=>!a.archivedAt&&!requested.has(a.id)&&Number.isFinite(a.minQuantity)&&a.minQuantity>0)
  .map(a=>{const stock=totals.get(a.id)||0;return {...a,stock,need:rounded(Math.max(0,a.minQuantity-stock)),severity:stock<=0?'fehlt':'wenig'};})
  .filter(x=>x.need>0).sort((a,b)=>(a.stock<=0?0:1)-(b.stock<=0?0:1)||a.name.localeCompare(b.name,'de'));
}
export async function shoppingData(){const db=await openDatabase();return new Promise((resolve,reject)=>{
 const tx=db.transaction(['purchases','articles','stocks','locations'],'readonly');let data={};
 tx.oncomplete=()=>resolve({...data,suggestions:shortageSuggestions(data.articles,data.stocks,data.purchases)});
 tx.onabort=()=>reject(tx.error||new StorageError('Einkaufsdaten nicht lesbar.'));
 for(const name of ['purchases','articles','stocks','locations']){const r=tx.objectStore(name).getAll();r.onsuccess=()=>{data[name]=r.result;};}
});}
export async function addPurchase(input){const f=checkAttrs(input),at=now(),db=await openDatabase();return txWrite(db,['articles','purchases','audit'],(tx,done,fail)=>{
 const create=article=>{
  if(article?.archivedAt)return fail(new StorageError('Der Artikel ist archiviert.','VALIDATION'));
  const name=article?.name||f.name;const unit=article?.unit||f.unit;
  if(article)try{convertQuantity(f.quantity,f.unit,unit);}catch(e){return fail(e);}
  const row={id:uuid(),articleId:f.articleId,name,quantity:f.quantity,unit:f.unit,area:input.area||article?.section||f.area,priority:f.priority,shop:f.shop,status:'open',source:input.source==='suggestion'?'suggestion':'manual',createdAt:at,updatedAt:at,schemaVersion:DATABASE_VERSION};
  if(!areaOptions.includes(row.area))row.area='privat';
  tx.objectStore('purchases').add(row);tx.objectStore('audit').add({id:uuid(),type:'purchase-created',entityId:row.id,source:row.source,createdAt:at,name});done(row);
 };
 if(!f.articleId)return create(null);
 const r=tx.objectStore('articles').get(f.articleId);r.onsuccess=()=>{
  if(!r.result)return fail(new StorageError('Artikel nicht gefunden.','VALIDATION'));
  const all=tx.objectStore('purchases').getAll();all.onsuccess=()=>{
   if(all.result.some(p=>p.articleId===f.articleId&&p.status==='open'))return fail(new StorageError('Der Artikel steht bereits auf der offenen Einkaufsliste.','DUPLICATE'));
   create(r.result);
  };
 };
});}
export async function editPurchase(purchaseId,input){checkedId(purchaseId,'Einkaufs-ID');const f=checkAttrs(input),db=await openDatabase(),at=now();return txWrite(db,['purchases','articles','audit'],(tx,done,fail)=>{
 const purchases=tx.objectStore('purchases'),r=purchases.get(purchaseId);r.onsuccess=()=>{
  const original=r.result;if(!original||original.status!=='open')return fail(new StorageError('Nur offene Positionen können geändert werden.','VALIDATION'));
  if(original.articleId!==f.articleId)return fail(new StorageError('Artikelzuordnung lässt sich nicht nachträglich ändern.','VALIDATION'));
  const save=a=>{if(a)try{convertQuantity(f.quantity,f.unit,a.unit);}catch(e){return fail(e);}const row={...original,...f,name:a?.name||f.name,updatedAt:at};purchases.put(row);tx.objectStore('audit').add({id:uuid(),type:'purchase-updated',entityId:purchaseId,source:'manual',createdAt:at});done(row);};
  if(!original.articleId)return save(null);const a=tx.objectStore('articles').get(original.articleId);a.onsuccess=()=>{if(!a.result||a.result.archivedAt)return fail(new StorageError('Artikel nicht mehr verfügbar.','VALIDATION'));save(a.result);};
 };
});}
/** Complete a list entry. Linked stock receipt and status are one IndexedDB transaction. */
export async function completePurchase(purchaseId,{actualQuantity,actualUnit,locationId,packCount}={}){
 checkedId(purchaseId,'Einkaufs-ID');const db=await openDatabase(),at=now();
 return txWrite(db,['purchases','articles','locations','stocks','movements','audit'],(tx,done,fail)=>{
  const ps=tx.objectStore('purchases'),r=ps.get(purchaseId);r.onsuccess=()=>{
   const p=r.result;if(!p||p.status!=='open')return fail(new StorageError('Bereits erledigt oder Position nicht gefunden. Keine zweite Buchung.','ALREADY_DONE'));
   const amount=quantity(actualQuantity??p.quantity,'Tatsächlich gekaufte Menge');const unit=actualUnit||p.unit;
   if(!UNITS.includes(unit))return fail(new StorageError('Unbekannte Einheit.','VALIDATION'));
   const finish=(movementId=null,actualBaseAmount=null)=>{
    const row={...p,status:'done',actualQuantity:amount,actualUnit:unit,completedAt:at,updatedAt:at,receiptMovementId:movementId,actualBaseAmount,locationId:movementId?locationId:null};
    ps.put(row);tx.objectStore('audit').add({id:uuid(),type:'purchase-completed',entityId:p.id,source:'shopping',createdAt:at,articleId:p.articleId||null,movementId});done(row);
   };
   if(!p.articleId){if(packCount!=null&&packCount!=='')return fail(new StorageError('Gebinde nur für Lagerartikel möglich.','VALIDATION'));return finish();}
   if(!locationId||!ID.test(locationId))return fail(new StorageError('Für Lagerzugang Ziel-Lagerort auswählen.','VALIDATION'));
   const ar=tx.objectStore('articles').get(p.articleId);ar.onsuccess=()=>{
    const article=ar.result;if(!article||article.archivedAt)return fail(new StorageError('Lagerartikel nicht verfügbar.','VALIDATION'));
    const lr=tx.objectStore('locations').get(locationId);lr.onsuccess=()=>{
     if(!lr.result||lr.result.archivedAt)return fail(new StorageError('Ziel-Lagerort nicht verfügbar.','VALIDATION'));
     let base;
     try{
      if(packCount!=null&&packCount!==''){
       const n=quantity(packCount,'Gebindeanzahl');if(!Number.isSafeInteger(n))throw new StorageError('Gebindeanzahl muss ganzzahlig sein.','VALIDATION');
       if(!article.packageSize||!article.packageUnit)throw new StorageError('Für diesen Artikel ist keine Gebindegröße hinterlegt.','VALIDATION');
       base=rounded(n*convertQuantity(article.packageSize,article.packageUnit,article.unit));validateQuantity(base);
      }else base=convertQuantity(amount,unit,article.unit);
      if(base<=0)throw new StorageError('Zugang muss positiv sein.','VALIDATION');
     }catch(e){return fail(e);}
     const st=tx.objectStore('stocks').index('by_article_location').get([article.id,locationId]);st.onsuccess=()=>{
      const old=st.result,before=old?.quantity||0,after=rounded(before+base);
      try{validateQuantity(after);}catch(e){return fail(e);}
      const stock={...(old||{}),id:old?.id||uuid(),articleId:article.id,locationId,quantity:after,createdAt:old?.createdAt||at,updatedAt:at,schemaVersion:DATABASE_VERSION};
      if(stock.packageState){const cap=stock.packageState.capacity;if(cap>0){const full=Math.floor(rounded(after/cap)+1e-9);stock.packageState={...stock.packageState,sealedPacks:full,openQuantity:rounded(after-full*cap),estimated:true};}}
      tx.objectStore('stocks').put(stock);
      const movement={id:uuid(),articleId:article.id,locationId,before,after,delta:base,source:'receipt',bookType:'receipt',purchaseId:p.id,note:`Einkauf: ${p.name}`,createdAt:at,schemaVersion:DATABASE_VERSION,undoneAt:null};
      tx.objectStore('movements').add(movement);
      tx.objectStore('audit').add({id:uuid(),type:'stock-adjusted',entityId:article.id,source:'receipt',createdAt:at,movementId:movement.id,locationId,before,after,delta:base});
      finish(movement.id,base);
     };
    };
   };
  };
});}
/** Undo the receipt as a separate movement, never silently subtract stock. */
export async function reopenPurchase(purchaseId){checkedId(purchaseId,'Einkaufs-ID');const db=await openDatabase(),at=now();return txWrite(db,['purchases','articles','stocks','movements','audit'],(tx,done,fail)=>{
 const ps=tx.objectStore('purchases'),r=ps.get(purchaseId);r.onsuccess=()=>{
  const p=r.result;if(!p||p.status!=='done')return fail(new StorageError('Nur erledigte Einkäufe lassen sich wieder öffnen.','VALIDATION'));
  const finish=()=>{const row={...p,status:'open',updatedAt:at,reopenedAt:at,receiptMovementId:null,completedAt:null};ps.put(row);tx.objectStore('audit').add({id:uuid(),type:'purchase-reopened',entityId:p.id,source:'manual',createdAt:at});done(row);};
  if(!p.receiptMovementId)return finish();
  const movements=tx.objectStore('movements'),mr=movements.get(p.receiptMovementId);mr.onsuccess=()=>{
   const mv=mr.result;if(!mv||mv.purchaseId!==p.id||mv.undoneAt)return fail(new StorageError('Zugangsbuchung nicht mehr reversibel.','VALIDATION'));
   const a=tx.objectStore('articles').get(mv.articleId);a.onsuccess=()=>{
    if(!a.result)return fail(new StorageError('Artikel für Storno fehlt.','VALIDATION'));
    const sr=tx.objectStore('stocks').index('by_article_location').get([mv.articleId,mv.locationId]);sr.onsuccess=()=>{
     const s=sr.result,before=s?.quantity||0,after=rounded(before-mv.delta);
     if(after<0)return fail(new StorageError('Wiederöffnen nicht möglich: gekaufter Bestand wurde bereits verbraucht.','INSUFFICIENT'));
     const stock={...s,quantity:after,updatedAt:at};if(stock.packageState?.capacity>0){const cap=stock.packageState.capacity,full=Math.floor(rounded(after/cap)+1e-9);stock.packageState={...stock.packageState,sealedPacks:full,openQuantity:rounded(after-full*cap),estimated:true};}
     tx.objectStore('stocks').put(stock);
     const reversal={id:uuid(),articleId:mv.articleId,locationId:mv.locationId,before,after,delta:-mv.delta,source:'correction',bookType:'reversal',undoOf:mv.id,purchaseId:p.id,note:'Einkauf rückgängig: '+p.name,createdAt:at,schemaVersion:DATABASE_VERSION};
     movements.add(reversal);movements.put({...mv,undoneAt:at,undoMovementId:reversal.id});
     tx.objectStore('audit').add({id:uuid(),type:'stock-adjusted',entityId:mv.articleId,source:'correction',createdAt:at,movementId:reversal.id,delta:reversal.delta,locationId:mv.locationId,before,after});
     finish();
    };
   };
  };
 };
});}
export async function archivePurchase(purchaseId){checkedId(purchaseId,'Einkaufs-ID');const db=await openDatabase(),at=now();return txWrite(db,['purchases','audit'],(tx,done,fail)=>{
 const ps=tx.objectStore('purchases'),r=ps.get(purchaseId);r.onsuccess=()=>{
  const p=r.result;if(!p||p.status!=='done')return fail(new StorageError('Nur erledigte Einkäufe archivieren.','VALIDATION'));
  const row={...p,status:'archived',archivedAt:at,updatedAt:at};ps.put(row);tx.objectStore('audit').add({id:uuid(),type:'purchase-archived',entityId:p.id,source:'manual',createdAt:at});done(row);
 };
});}