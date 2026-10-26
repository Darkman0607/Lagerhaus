/** Lagerhaus U03 — article catalog operations, all records stay in local IndexedDB. */
import { openDatabase, StorageError, validateQuantity, DATABASE_VERSION } from './store.js';
export const UNITS=['Stück','Paar','Packung','ml','l','g','kg','m'];
const SCALE={ml:['volume',1],l:['volume',1000],g:['mass',1],kg:['mass',1000],m:['length',1],Stück:['pieces',1],Paar:['pairs',1],Packung:['packs',1]};
const MAX=1_000_000_000;
const uid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
export function convertQuantity(value,from,to){
 validateQuantity(value);
 if(!SCALE[from]||!SCALE[to]||SCALE[from][0]!==SCALE[to][0])throw new StorageError('Nur Einheiten derselben Messart sind umrechenbar (z. B. l ↔ ml, kg ↔ g).','VALIDATION');
 const converted=Math.round(value*SCALE[from][1]/SCALE[to][1]*1000)/1000;
 if(!Number.isFinite(converted)||Math.abs(converted)>MAX)throw new StorageError('Der umgerechnete Wert ist zu groß.','VALIDATION');
 return converted;
}
const text=(v,label,max=150,required=false)=>{
 if(v===undefined||v===null)v='';
 if(typeof v!=='string')throw new StorageError(`${label} ist ungültig.`,'VALIDATION');
 const out=v.trim();if(out.length>max||required&&!out)throw new StorageError(`${label}: ${required?'Angabe erforderlich; ':''}maximal ${max} Zeichen.`,'VALIDATION');return out;
};
function fields(input){
 const name=text(input?.name,'Artikelname',160,true),category=text(input?.category,'Kategorie',70,true);
 const section=input?.section||'privat';if(!['privat','arbeit','gemeinsam'].includes(section))throw new StorageError('Ungültiger Bereich.','VALIDATION');
 const unit=input?.unit||'Stück';if(!UNITS.includes(unit))throw new StorageError('Ungültige Einheit.','VALIDATION');
 const quantity=validateQuantity(input?.quantity??0);if(quantity<0)throw new StorageError('Der Anfangsbestand darf nicht negativ sein.','VALIDATION');
 const packageSize=input?.packageSize===''||input?.packageSize==null?null:validateQuantity(Number(input.packageSize));
 const packageUnit=input?.packageUnit||'';
 if(packageSize!==null&&(packageSize<=0||!UNITS.includes(packageUnit)))throw new StorageError('Packungsinhalt benötigt einen positiven Wert und eine gültige Einheit.','VALIDATION');
 const optional={brand:70,model:80,type:80,manufacturer:100,serialNumber:100,notes:1000,color:60,condition:60};
 const f={name,category,section,unit,packageSize,packageUnit,favorite:input?.favorite===true};
 for(const [k,max] of Object.entries(optional))f[k]=text(input?.[k],k,max);
 return {fields:f,quantity};
}
function txPromise(db,names,handler){
 return new Promise((resolve,reject)=>{
  let tx;try{tx=db.transaction(names,'readwrite');}catch(e){reject(e);return;}
  let result,thrown;
  tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(thrown||tx.error||new StorageError('Die Änderung wurde vollständig zurückgesetzt.','TRANSACTION'));
  try{handler(tx,value=>{result=value;},error=>{thrown=error;tx.abort();});}catch(e){thrown=e;try{tx.abort();}catch{}reject(e);}
 });
}
const checkLocation=(tx,input,at,fail,then)=>{
 const locations=tx.objectStore('locations'),name=text(input?.locationName,'Lagerort',100);
 if(input?.locationId){const r=locations.get(input.locationId);r.onsuccess=()=>{
  if(!r.result)return fail(new StorageError('Ausgewählter Lagerort existiert nicht.','VALIDATION'));
  then(r.result.id,r.result.name);
 };return;}
 if(!name)return fail(new StorageError('Bitte einen Lagerort auswählen oder neu eingeben.','VALIDATION'));
 const existing=locations.getAll();existing.onsuccess=()=>{
  const match=existing.result.find(x=>x.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'));
  if(match){then(match.id,match.name);return;}
  const row={id:uid(),name,createdAt:at,updatedAt:at,schemaVersion:DATABASE_VERSION};locations.add(row);
  tx.objectStore('audit').add({id:uid(),type:'location-created',entityId:row.id,source:'manual',createdAt:at,name});then(row.id,name);
 };
};
const addStock=(tx,articleId,locationId,quantity,at,source)=>{
 if(quantity<=0)return;
 const stock={id:uid(),articleId,locationId,quantity,createdAt:at,updatedAt:at,schemaVersion:DATABASE_VERSION};tx.objectStore('stocks').add(stock);
 tx.objectStore('movements').add({id:uid(),articleId,locationId,delta:quantity,before:0,after:quantity,source,note:'Bestand bei Artikelerfassung',createdAt:at,schemaVersion:DATABASE_VERSION});
 tx.objectStore('audit').add({id:uid(),type:'stock-adjusted',entityId:articleId,source,createdAt:at,locationId,delta:quantity,before:0,after:quantity});
};
function validImage(blob){if(blob==null)return;if(!(blob instanceof Blob)||!['image/png','image/jpeg','image/webp'].includes(blob.type)||blob.size>5_000_000||blob.size<1)throw new StorageError('Foto muss JPG, PNG oder WEBP mit maximal 5 MB sein.','VALIDATION');}
function insertImage(tx,id,image,at){if(!image)return;const row={id:uid(),ownerType:'article',ownerId:id,name:'Artikelfoto',blob:image,createdAt:at,updatedAt:at};tx.objectStore('media').add(row);}
export async function createCatalogArticle(input){
 const {fields:f,quantity}=fields(input);validImage(input?.image);const at=now(),db=await openDatabase();
 const id=uid();return txPromise(db,['articles','locations','stocks','movements','audit','media'],(tx,done,fail)=>{
  checkLocation(tx,input,at,fail,(locationId,locationName)=>{
   const row={id,...f,primaryLocationId:locationId,createdAt:at,updatedAt:at,schemaVersion:DATABASE_VERSION};
   tx.objectStore('articles').add(row);addStock(tx,id,locationId,quantity,at,'initial');insertImage(tx,id,input?.image,at);
   tx.objectStore('audit').add({id:uid(),type:'article-created',entityId:id,source:'manual',createdAt:at,name:f.name});
   done({...row,quantity,locationName});
  });
 });
}
export async function updateCatalogArticle(articleId,input){
 const {fields:f,quantity}=fields(input);const at=now(),db=await openDatabase();
 return txPromise(db,['articles','locations','stocks','movements','audit'],(tx,done,fail)=>{
  const articles=tx.objectStore('articles'),request=articles.get(articleId);
  request.onsuccess=()=>{
   const original=request.result;if(!original||original.archivedAt)return fail(new StorageError('Artikel nicht gefunden oder archiviert.','VALIDATION'));
   checkLocation(tx,input,at,fail,(locationId)=>{
    const stocks=tx.objectStore('stocks').index('by_article').getAll(articleId);
    stocks.onsuccess=()=>{
     const all=stocks.result,positive=all.filter(x=>x.quantity>0),previous=all.reduce((v,x)=>v+x.quantity,0);
     if(original.unit!==f.unit&&previous>0)return fail(new StorageError('Einheit bei vorhandenem Bestand nicht ändern. Bitte Bestand zuerst auf 0 setzen.','VALIDATION'));
     if(positive.some(x=>x.locationId!==locationId))return fail(new StorageError('Lagerortwechsel bei vorhandenem Bestand ist gesperrt. Zuerst Bestand auf 0 setzen.','VALIDATION'));
     if(positive.length>1)return fail(new StorageError('Mehrere Lagerort-Bestände: Bitte spätere Bestandsverwaltung verwenden.','VALIDATION'));
     const current=all.find(x=>x.locationId===locationId);
     const delta=Math.round((quantity-(current?.quantity||0))*1000)/1000;
     if(positive.length===0&&previous>0)return fail(new StorageError('Mehrere Bestände vorhanden.','VALIDATION'));
     if(delta!==0){
      tx.objectStore('stocks').put({id:current?.id||uid(),articleId,locationId,quantity,createdAt:current?.createdAt||at,updatedAt:at,schemaVersion:DATABASE_VERSION});
      tx.objectStore('movements').add({id:uid(),articleId,locationId,delta,before:current?.quantity||0,after:quantity,source:'correction',note:'Korrektur im Artikel-Editor',createdAt:at,schemaVersion:DATABASE_VERSION});
      tx.objectStore('audit').add({id:uid(),type:'stock-adjusted',entityId:articleId,source:'correction',createdAt:at,locationId,delta,before:current?.quantity||0,after:quantity});
     }
     const updated={...original,...f,primaryLocationId:locationId,updatedAt:at};articles.put(updated);
     tx.objectStore('audit').add({id:uid(),type:'article-updated',entityId:articleId,source:'manual',createdAt:at,name:f.name});done(updated);
    };
   });
  };
 });
}
export async function duplicateCatalogArticle(id){
 const db=await openDatabase(),source=await new Promise((resolve,reject)=>{const tx=db.transaction(['articles'],'readonly'),r=tx.objectStore('articles').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 if(!source||source.archivedAt)throw new StorageError('Artikel nicht vorhanden.','VALIDATION');
 const locationId=source.primaryLocationId;if(!locationId)throw new StorageError('Artikel hat keinen Lagerort; bitte zunächst bearbeiten.','VALIDATION');
 return createCatalogArticle({...source,name:(source.name.slice(0,150)+' (Kopie)'),locationId,quantity:0,image:null});
}
export async function deleteCatalogArticle(id){
 const db=await openDatabase(),at=now();return txPromise(db,['articles','stocks','movements','media','audit'],(tx,done,fail)=>{
  const articles=tx.objectStore('articles'),req=articles.get(id);req.onsuccess=()=>{
   const article=req.result;if(!article)return fail(new StorageError('Artikel nicht vorhanden.','VALIDATION'));
   const s=tx.objectStore('stocks').index('by_article').getAll(id),m=tx.objectStore('movements').index('by_article').getAll(id);
   let stocks,movements;const finalize=()=>{if(!stocks||!movements)return;
    if(stocks.some(x=>x.quantity>0))return fail(new StorageError('Artikel hat noch Bestand. Setze ihn vor dem Löschen auf 0.','IN_USE'));
    if(movements.length){article.archivedAt=at;article.updatedAt=at;articles.put(article);done({archived:true});}
    else{articles.delete(id);for(const x of stocks)tx.objectStore('stocks').delete(x.id);const media=tx.objectStore('media').index('by_owner').getAll(['article',id]);media.onsuccess=()=>{for(const x of media.result)tx.objectStore('media').delete(x.id);};done({archived:false});}
    tx.objectStore('audit').add({id:uid(),type:movements.length?'article-archived':'article-deleted',entityId:id,source:'manual',createdAt:at,name:article.name});
   };
   s.onsuccess=()=>{stocks=s.result;finalize();};m.onsuccess=()=>{movements=m.result;finalize();};
  };
 });
}
export async function restoreArchivedArticle(id){const db=await openDatabase(),at=now();return txPromise(db,['articles','audit'],(tx,done,fail)=>{
 const store=tx.objectStore('articles'),req=store.get(id);req.onsuccess=()=>{const a=req.result;if(!a||!a.archivedAt)return fail(new StorageError('Archivierter Artikel nicht gefunden.','VALIDATION'));delete a.archivedAt;a.updatedAt=at;store.put(a);tx.objectStore('audit').add({id:uid(),type:'article-restored',entityId:id,source:'manual',createdAt:at,name:a.name});done(a);};
});}
export async function articleImages(ids){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(['media'],'readonly'),req=tx.objectStore('media').getAll();req.onsuccess=()=>resolve(req.result.filter(m=>m.ownerType==='article'&&ids.includes(m.ownerId)));req.onerror=()=>reject(req.error);});}
export async function setArticleImage(id,blob){validImage(blob);const db=await openDatabase(),at=now();return txPromise(db,['articles','media','audit'],(tx,done,fail)=>{
 const a=tx.objectStore('articles').get(id);a.onsuccess=()=>{if(!a.result||a.result.archivedAt)return fail(new StorageError('Artikel nicht vorhanden.','VALIDATION'));
  const media=tx.objectStore('media'),req=media.index('by_owner').getAll(['article',id]);req.onsuccess=()=>{for(const row of req.result)media.delete(row.id);insertImage(tx,id,blob,at);tx.objectStore('audit').add({id:uid(),type:blob?'article-photo-updated':'article-photo-removed',entityId:id,source:'manual',createdAt:at});done({hasPhoto:!!blob});};
 };
});}
