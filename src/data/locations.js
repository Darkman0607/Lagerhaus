/** U05: Hierarchical warehouse locations and lossless atomic stock transfers. */
import {openDatabase,StorageError,validateQuantity,DATABASE_VERSION} from './store.js';
export const LOCATION_KINDS=Object.freeze([['standort','Standort'],['raum','Raum'],['regal','Regal'],['fach','Fach'],['box','Box']]);
const uid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const MAX_DEPTH=12;
function nameOf(value){if(typeof value!=='string'||!value.trim()||value.trim().length>100)throw new StorageError('Lagerortname: 1 bis 100 Zeichen erforderlich.','VALIDATION');return value.trim();}
function noteOf(value){if(typeof value!=='string'||value.length>500)throw new StorageError('Notiz: höchstens 500 Zeichen.','VALIDATION');return value.trim();}
function uuid(value,label='ID'){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new StorageError(`${label} ist ungültig.`,'VALIDATION');return value;}
function transaction(db,stores,fn){return new Promise((resolve,reject)=>{
 const tx=db.transaction(stores,'readwrite');let value,error;
 tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(error||tx.error||new StorageError('Transaktion vollständig zurückgesetzt.','TRANSACTION'));
 const fail=e=>{error=e;tx.abort();};
 try{fn(tx,v=>{value=v;},fail);}catch(e){fail(e);}
});}
function indexLocations(locations){return new Map(locations.map(l=>[l.id,l]));}
export function locationPath(location,all){const map=indexLocations(all);let row=typeof location==='string'?map.get(location):location;const labels=[],seen=new Set();
 while(row){if(seen.has(row.id)){labels.unshift('⚠ Kreis');break;}seen.add(row.id);labels.unshift(row.name);row=row.parentId?map.get(row.parentId):null;}
 return labels.join(' / ')||'Unbekannter Ort';}
export function locationDepth(parentId,all,editingId=null){const map=indexLocations(all);let id=parentId,depth=0;const seen=new Set(editingId?[editingId]:[]);
 while(id){if(seen.has(id))throw new StorageError('Ein Lagerort darf kein eigenes Unterelement sein (Kreis).','VALIDATION');seen.add(id);const row=map.get(id);if(!row||row.archivedAt)throw new StorageError('Übergeordneter Lagerort ist ungültig oder archiviert.','VALIDATION');depth++;if(depth>MAX_DEPTH)throw new StorageError('Maximal zwölf Ebenen erlaubt.','VALIDATION');id=row.parentId||null;}
 return depth;}
function sameSibling(all,name,parentId,exceptId){return all.some(l=>!l.archivedAt&&l.id!==exceptId&&(l.parentId||null)===(parentId||null)&&l.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'));}
function typeOf(value){const kind=value||'raum';if(!LOCATION_KINDS.some(([key])=>key===kind))throw new StorageError('Ungültiger Lagerorttyp.','VALIDATION');return kind;}
export async function createLocation({name,parentId=null,kind='raum'}={}){
 name=nameOf(name);kind=typeOf(kind);if(parentId)uuid(parentId,'Eltern-ID');const db=await openDatabase(),at=now();
 return transaction(db,['locations','audit'],(tx,done,fail)=>{
 const store=tx.objectStore('locations'),r=store.getAll();r.onsuccess=()=>{try{const all=r.result;locationDepth(parentId,all);if(sameSibling(all,name,parentId))throw new StorageError('Der Name existiert bereits in diesem Lagerort.','VALIDATION');
 const row={id:uid(),name,parentId,kind,createdAt:at,updatedAt:at,schemaVersion:DATABASE_VERSION};store.add(row);
 tx.objectStore('audit').add({id:uid(),type:'location-created',entityId:row.id,source:'manual',createdAt:at,name,parentId});done(row);
 }catch(e){fail(e);}};
 });}
export async function updateLocation(id,{name,parentId,kind}={}){
 uuid(id);const db=await openDatabase(),at=now();return transaction(db,['locations','audit'],(tx,done,fail)=>{
 const store=tx.objectStore('locations'),r=store.getAll();r.onsuccess=()=>{try{const all=r.result,original=all.find(x=>x.id===id);if(!original||original.archivedAt)throw new StorageError('Lagerort nicht gefunden oder archiviert.','VALIDATION');
 const nextName=name===undefined?original.name:nameOf(name),nextParent=parentId===undefined?(original.parentId||null):parentId||null,nextKind=kind===undefined?(original.kind||'raum'):typeOf(kind);
 if(nextParent)uuid(nextParent,'Eltern-ID');locationDepth(nextParent,all,id);if(sameSibling(all,nextName,nextParent,id))throw new StorageError('Dieser Lagerortname existiert bereits unter demselben Elternort.','VALIDATION');
 const modified={...original,name:nextName,parentId:nextParent,kind:nextKind,updatedAt:at,schemaVersion:DATABASE_VERSION};store.put(modified);
 tx.objectStore('audit').add({id:uid(),type:'location-updated',entityId:id,source:'manual',createdAt:at,before:{name:original.name,parentId:original.parentId||null},after:{name:nextName,parentId:nextParent}});done(modified);
 }catch(e){fail(e);}};
 });}
export async function archiveLocation(id){uuid(id);const db=await openDatabase(),at=now();return transaction(db,['locations','stocks','articles','audit'],(tx,done,fail)=>{
 let locations,stocks,articles,pending=3;const ready=()=>{if(--pending)return;try{const target=locations.find(x=>x.id===id);if(!target||target.archivedAt)throw new StorageError('Lagerort ist bereits archiviert oder fehlt.','VALIDATION');
 if(locations.some(l=>!l.archivedAt&&l.parentId===id))throw new StorageError('Vor dem Archivieren zuerst die Unterorte archivieren oder verschieben.','IN_USE');
 if(stocks.some(s=>s.locationId===id&&s.quantity>0))throw new StorageError('Der Ort enthält noch Bestände. Bitte zuerst umlagern.','IN_USE');
 if(articles.some(a=>!a.archivedAt&&a.primaryLocationId===id))throw new StorageError('Der Ort ist noch bei einem Artikel als Standardort ausgewählt. Bitte Artikel zuerst einem anderen Standardort zuordnen.','IN_USE');
 const result={...target,archivedAt:at,updatedAt:at};tx.objectStore('locations').put(result);
 tx.objectStore('audit').add({id:uid(),type:'location-archived',entityId:id,source:'manual',createdAt:at,name:target.name});done(result);
 }catch(e){fail(e);}};
 for(const [store,key] of [['locations','locations'],['stocks','stocks'],['articles','articles']]){const r=tx.objectStore(store).getAll();r.onsuccess=()=>{if(key==='locations')locations=r.result;else if(key==='stocks')stocks=r.result;else articles=r.result;ready();};}
 });}
export async function locationOverview(){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(['locations','articles','stocks'],'readonly'),r={},names=['locations','articles','stocks'];let wait=3;tx.onerror=()=>reject(tx.error);for(const name of names){const req=tx.objectStore(name).getAll();req.onsuccess=()=>{r[name]=req.result;if(!--wait){const a=indexLocations(r.articles);const result=r.locations.filter(x=>!x.archivedAt).map(l=>{
 const stocks=r.stocks.filter(s=>s.locationId===l.id&&s.quantity>0&&a.has(s.articleId)&&!a.get(s.articleId).archivedAt);
 const items=stocks.map(s=>{const article=a.get(s.articleId);const allQty=r.stocks.filter(t=>t.articleId===article.id).reduce((n,t)=>n+t.quantity,0);return {id:article.id,name:article.name,quantity:s.quantity,unit:article.unit||'Stück',favorite:!!article.favorite,lowStock:article.minQuantity>0&&allQty<article.minQuantity,section:article.section};});
 return {...l,path:locationPath(l,r.locations),articleCount:items.length,favorites:items.filter(x=>x.favorite).length,warnings:items.filter(x=>x.lowStock).length,items};});resolve(result);}};}
 });}
export async function transferStock({articleId,sourceLocationId,targetLocationId,quantity,note=''}={}){
 uuid(articleId,'Artikel-ID');uuid(sourceLocationId,'Quellort-ID');uuid(targetLocationId,'Zielort-ID');
 if(sourceLocationId===targetLocationId)throw new StorageError('Quelle und Ziel müssen unterschiedlich sein.','VALIDATION');validateQuantity(quantity);if(quantity<=0)throw new StorageError('Umlagerungsmenge muss größer als 0 sein.','VALIDATION');note=noteOf(note);
 const db=await openDatabase(),at=now(),transferId=uid();return transaction(db,['articles','locations','stocks','movements','audit'],(tx,done,fail)=>{
 const articles=tx.objectStore('articles'),locations=tx.objectStore('locations'),stocks=tx.objectStore('stocks');
 const a=articles.get(articleId);a.onsuccess=()=>{if(!a.result||a.result.archivedAt)return fail(new StorageError('Artikel fehlt oder ist archiviert.','VALIDATION'));
 const l=locations.getAll();l.onsuccess=()=>{const from=l.result.find(x=>x.id===sourceLocationId),to=l.result.find(x=>x.id===targetLocationId);if(!from||!to||from.archivedAt||to.archivedAt)return fail(new StorageError('Quelle oder Ziel fehlt oder ist archiviert.','VALIDATION'));
 const r=stocks.index('by_article').getAll(articleId);r.onsuccess=()=>{const current=r.result,origin=current.find(x=>x.locationId===sourceLocationId),dest=current.find(x=>x.locationId===targetLocationId),beforeFrom=origin?.quantity||0,beforeTo=dest?.quantity||0;
 const afterFrom=Math.round((beforeFrom-quantity)*1000)/1000,afterTo=Math.round((beforeTo+quantity)*1000)/1000;
 if(afterFrom<0||afterTo>1_000_000_000)return fail(new StorageError('Umlagerung nicht möglich: unzureichender Quellbestand oder Zielbestand zu groß.','VALIDATION'));
 stocks.put({id:origin.id,articleId,locationId:sourceLocationId,quantity:afterFrom,createdAt:origin.createdAt||at,updatedAt:at,schemaVersion:DATABASE_VERSION});
 stocks.put({id:dest?.id||uid(),articleId,locationId:targetLocationId,quantity:afterTo,createdAt:dest?.createdAt||at,updatedAt:at,schemaVersion:DATABASE_VERSION});
 const moves=tx.objectStore('movements');for(const [locationId,delta,before,after] of [[sourceLocationId,-quantity,beforeFrom,afterFrom],[targetLocationId,quantity,beforeTo,afterTo]])moves.add({id:uid(),articleId,locationId,delta,before,after,source:'transfer',transferId,note,createdAt:at,schemaVersion:DATABASE_VERSION});
 // Keep the default place stable when stock is split. If completely moved, set destination as default.
 if(a.result.primaryLocationId===sourceLocationId&&afterFrom===0){articles.put({...a.result,primaryLocationId:targetLocationId,updatedAt:at});}
 tx.objectStore('audit').add({id:transferId,type:'location-transfer',entityId:articleId,articleId,source:'transfer',createdAt:at,sourceLocationId,targetLocationId,quantity,note,undoneAt:null});
 done({id:transferId,articleId,sourceLocationId,targetLocationId,quantity,createdAt:at});
 };};};
 });}
export async function recentTransfers(limit=15){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(['audit'],'readonly'),req=tx.objectStore('audit').getAll();tx.onerror=()=>reject(tx.error);req.onsuccess=()=>resolve(req.result.filter(x=>x.type==='location-transfer').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,limit));});}
export async function undoTransfer(id){uuid(id,'Umlagerungs-ID');const db=await openDatabase(),at=now();return transaction(db,['audit','stocks','articles','movements','locations'],(tx,done,fail)=>{
 const audit=tx.objectStore('audit'),r=audit.get(id);r.onsuccess=()=>{const t=r.result;if(!t||t.type!=='location-transfer'||t.undoneAt)return fail(new StorageError('Umlagerung existiert nicht oder ist bereits rückgängig gemacht.','VALIDATION'));
 const l=tx.objectStore('locations').getAll();l.onsuccess=()=>{if([t.sourceLocationId,t.targetLocationId].some(id=>!l.result.some(x=>x.id===id&&!x.archivedAt)))return fail(new StorageError('Ein beteiligter Lagerort ist archiviert.','VALIDATION'));
 const stocks=tx.objectStore('stocks'),sr=stocks.index('by_article').getAll(t.articleId);sr.onsuccess=()=>{const all=sr.result,source=all.find(x=>x.locationId===t.sourceLocationId),dest=all.find(x=>x.locationId===t.targetLocationId),beforeSource=source?.quantity||0,beforeTarget=dest?.quantity||0;
 const afterSource=Math.round((beforeSource+t.quantity)*1000)/1000,afterTarget=Math.round((beforeTarget-t.quantity)*1000)/1000;
 if(afterTarget<0||afterSource>1_000_000_000)return fail(new StorageError('Rückgängig nicht möglich: Bestand am Ziel wurde inzwischen verwendet oder reicht nicht mehr aus.','IN_USE'));
 for(const [old,loc,before,after,delta] of [[source,t.sourceLocationId,beforeSource,afterSource,t.quantity],[dest,t.targetLocationId,beforeTarget,afterTarget,-t.quantity]]){
 stocks.put({id:old?.id||uid(),articleId:t.articleId,locationId:loc,quantity:after,createdAt:old?.createdAt||at,updatedAt:at,schemaVersion:DATABASE_VERSION});
 tx.objectStore('movements').add({id:uid(),articleId:t.articleId,locationId:loc,delta,before,after,source:'transfer-undo',transferId:id,note:'Umlagerung rückgängig gemacht',createdAt:at,schemaVersion:DATABASE_VERSION});
 }
 const a=tx.objectStore('articles').get(t.articleId);a.onsuccess=()=>{if(a.result&&a.result.primaryLocationId===t.targetLocationId&&afterTarget===0)tx.objectStore('articles').put({...a.result,primaryLocationId:t.sourceLocationId,updatedAt:at});};
 audit.put({...t,undoneAt:at});audit.add({id:uid(),type:'location-transfer-undone',entityId:t.articleId,source:'manual',createdAt:at,transferId:id});done({id,undoneAt:at});
 };};};
 });}
