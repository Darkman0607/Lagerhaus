/** U04: atomic, local classification catalog (no stock records are modified). */
import {openDatabase,StorageError,DATABASE_VERSION} from './store.js';
export const ARTICLE_KINDS=Object.freeze([
 ['consumable','Verbrauchsmaterial'],['reusable','Wiederverwendbar'],
 ['device','Gerät / Maschine'],['food','Lebensmittel / Getränk']
]);
const now=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID();
export function checkedCategoryName(value){
 if(typeof value!=='string'||!value.trim()||value.trim().length>70)throw new StorageError('Kategoriename: 1 bis 70 Zeichen erforderlich.','VALIDATION');
 return value.trim();
}
export function categoryPath(row,all){
 const parts=[row.name];let p=row.parentId;const seen=new Set([row.id]);
 while(p){if(seen.has(p))break;seen.add(p);const parent=all.find(x=>x.id===p);if(!parent)break;parts.unshift(parent.name);p=parent.parentId;}
 return parts.join(' / ');
}
function run(names,operation){return openDatabase().then(db=>new Promise((resolve,reject)=>{
 const tx=db.transaction(names,'readwrite');let result,reason;
 tx.oncomplete=()=>resolve(result);
 tx.onabort=()=>reject(reason||tx.error||new StorageError('Kategorieänderung zurückgesetzt.','TRANSACTION'));
 const fail=e=>{reason=e;tx.abort();};
 try{operation(tx,value=>result=value,fail);}catch(e){fail(e);}
}));}
const equal=(a,b)=>a.toLocaleLowerCase('de')===b.toLocaleLowerCase('de');
function assertParent(rows,id,parentId){
 if(!parentId)return;
 if(!rows.some(x=>x.id===parentId))throw new StorageError('Übergeordnete Kategorie nicht vorhanden.','VALIDATION');
 let cursor=parentId;const visited=new Set([id]);
 while(cursor){if(visited.has(cursor))throw new StorageError('Kategorien dürfen keinen Kreis bilden.','VALIDATION');visited.add(cursor);cursor=rows.find(x=>x.id===cursor)?.parentId||null;}
}
export async function listCategories(){const db=await openDatabase();return new Promise((resolve,reject)=>{
 const tx=db.transaction(['categories'],'readonly');let rows=[];
 tx.objectStore('categories').getAll().onsuccess=e=>rows=e.target.result;
 tx.oncomplete=()=>resolve(rows.sort((a,b)=>a.position-b.position||a.name.localeCompare(b.name,'de')));
 tx.onabort=()=>reject(tx.error);
});}
export function createCategory({name,parentId=null}){
 name=checkedCategoryName(name);
 return run(['categories','audit'],(tx,done,fail)=>{
  tx.objectStore('categories').getAll().onsuccess=e=>{
   const rows=e.target.result;if(rows.some(x=>equal(x.name,name)))return fail(new StorageError('Kategorienamen müssen eindeutig sein.','VALIDATION'));
   assertParent(rows,'new',parentId);
   const at=now(),row={id:uid(),name,parentId:parentId||null,position:rows.filter(x=>x.parentId===(parentId||null)).reduce((m,x)=>Math.max(m,x.position),-1)+1,createdAt:at,updatedAt:at,schemaVersion:DATABASE_VERSION};
   tx.objectStore('categories').add(row);tx.objectStore('audit').add({id:uid(),type:'category-created',entityId:row.id,source:'manual',createdAt:at,name});done(row);
  };
 });
}
export function editCategory(id,{name,parentId}){
 if(!id)throw new StorageError('Kategorie-ID fehlt.','VALIDATION');
 if(name!==undefined)name=checkedCategoryName(name);
 return run(['categories','articles','audit'],(tx,done,fail)=>{
  tx.objectStore('categories').getAll().onsuccess=e=>{
   const rows=e.target.result,row=rows.find(x=>x.id===id);if(!row)return fail(new StorageError('Kategorie nicht gefunden.','VALIDATION'));
   const newName=name??row.name,p=parentId===undefined?row.parentId:(parentId||null);
   if(rows.some(x=>x.id!==id&&equal(x.name,newName)))return fail(new StorageError('Dieser Kategoriename existiert bereits.','VALIDATION'));
   assertParent(rows,id,p);
   const at=now(),updated={...row,name:newName,parentId:p,updatedAt:at};
   if(p!==row.parentId)updated.position=rows.filter(x=>x.parentId===p).reduce((m,x)=>Math.max(m,x.position),-1)+1;
   tx.objectStore('categories').put(updated);
   tx.objectStore('articles').getAll().onsuccess=ev=>{
    // Denormalized readable category names are only a compatibility snapshot.
    // Never alter stock, photo, movement or the primary article identity.
    for(const a of ev.target.result)if(a.categoryId===id){a.category=newName;a.updatedAt=at;tx.objectStore('articles').put(a);}
    tx.objectStore('audit').add({id:uid(),type:'category-updated',entityId:id,source:'manual',createdAt:at,oldName:row.name,newName,parentId:p});done(updated);
   };
  };
 });
}
export function reorderCategory(id,direction){
 if(![-1,1].includes(direction))throw new StorageError('Unbekannte Sortierreihenfolge.','VALIDATION');
 return run(['categories','audit'],(tx,done,fail)=>{
  tx.objectStore('categories').getAll().onsuccess=e=>{
   const rows=e.target.result,current=rows.find(x=>x.id===id);
   if(!current)return fail(new StorageError('Kategorie nicht gefunden.','VALIDATION'));
   const siblings=rows.filter(x=>x.parentId===current.parentId).sort((a,b)=>a.position-b.position||a.name.localeCompare(b.name,'de'));
   const index=siblings.findIndex(x=>x.id===id),swap=siblings[index+direction];
   if(!swap){done(false);return;}
   // Re-number siblings to also repair historical equal/duplicated positions.
   [siblings[index],siblings[index+direction]]=[siblings[index+direction],siblings[index]];
   siblings.forEach((x,i)=>tx.objectStore('categories').put({...x,position:i,updatedAt:now()}));
   tx.objectStore('audit').add({id:uid(),type:'category-reordered',entityId:id,source:'manual',createdAt:now()});done(true);
  };
 });
}
