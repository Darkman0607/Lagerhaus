/** Tiny deterministic IndexedDB test double (not a replacement for browser E2E). */
const databases=new Map();
const names=list=>({contains:n=>list.includes(n),[Symbol.iterator]:function*(){yield* list;}});
const cloneRow=v=>structuredClone(v);
class FakeStore {
 constructor(tx,name){this.tx=tx;this.name=name;}
 get state(){return this.tx.working[this.name];}
 get indexNames(){return names([...this.state.indexes.keys()]);}
 createIndex(name,keyPath,options={}){this.state.indexes.set(name,{keyPath,options});return new FakeIndex(this.tx,this.name,name);}
 index(name){if(!this.state.indexes.has(name))throw Error(`Missing index ${name}`);return new FakeIndex(this.tx,this.name,name);}
 add(value){return this.tx.queue(()=>{const key=value[this.state.keyPath];if(this.state.data.has(key))throw new DOMException('duplicate','ConstraintError');this.state.data.set(key,cloneRow(value));return key;});}
 put(value){return this.tx.queue(()=>{const key=value[this.state.keyPath];this.state.data.set(key,cloneRow(value));return key;});}
 get(key){return this.tx.queue(()=>{const value=this.state.data.get(key);return value===undefined?undefined:cloneRow(value);});}
 getAll(){return this.tx.queue(()=>[...this.state.data.values()].map(cloneRow));}
 delete(key){return this.tx.queue(()=>this.state.data.delete(key));}
}
class FakeIndex{
 constructor(tx,store,name){this.tx=tx;this.store=store;this.name=name;}
 config(){return this.tx.working[this.store].indexes.get(this.name);}
 get(key){return this.tx.queue(()=>[...this.tx.working[this.store].data.values()].find(v=>JSON.stringify(v[this.config().keyPath]??this.pathValue(v))===JSON.stringify(key)));}
 pathValue(v){const k=this.config().keyPath;return Array.isArray(k)?k.map(x=>v[x]):v[k];}
 getAll(key){return this.tx.queue(()=>[...this.tx.working[this.store].data.values()].filter(v=>JSON.stringify(this.pathValue(v))===JSON.stringify(key)).map(cloneRow));}
 openCursor(_query,_direction){
   const req={onsuccess:null,onerror:null};let list=[...this.tx.working[this.store].data.values()].sort((a,b)=>String(this.pathValue(a)).localeCompare(String(this.pathValue(b)))).reverse(),idx=0;
   const next=()=>{const cur=idx<list.length?{value:cloneRow(list[idx++]),continue:()=>queueMicrotask(next)}:null;req.result=cur;req.onsuccess?.();if(!cur){this.tx.pending--;this.tx.check();}};
   this.tx.pending++;queueMicrotask(next);return req;
 }
}
class FakeTransaction{
 constructor(db,storeNames,mode,upgrade=false){this.db=db;this.mode=mode;this.upgrade=upgrade;this.pending=0;this.finished=false;this.aborted=false;this.onerror=null;this.onabort=null;this.oncomplete=null;this.working={};for(const n of storeNames){this.working[n]=copyStore(db.stores[n]);}}
 objectStore(name){if(!this.working[name])throw Error(`Missing transaction store ${name}`);return new FakeStore(this,name);}
 queue(task){const req={onsuccess:null,onerror:null,result:null,error:null};this.pending++;queueMicrotask(()=>{
    if(this.aborted){this.pending--;this.check();return;}
    try{req.result=task();req.onsuccess?.({target:req});}
    catch(e){req.error=e;req.onerror?.({target:req});this.abort(e);}
    finally{this.pending--;this.check();}
   });return req;
 }
 check(){if(this.pending!==0||this.finished)return;queueMicrotask(()=>{if(this.pending||this.finished)return;this.finished=true;if(!this.aborted){if(this.mode==='readwrite'||this.upgrade){for(const n in this.working)this.db.stores[n]=copyStore(this.working[n]);}this.oncomplete?.();}});}
 abort(error=new DOMException('aborted','AbortError')){if(this.finished)return;this.aborted=true;this.error=error;this.finished=true;queueMicrotask(()=>this.onabort?.({target:this}));}
}
function copyStore(store){return {keyPath:store.keyPath,data:new Map([...store.data].map(([k,v])=>[k,cloneRow(v)])),indexes:new Map(store.indexes)};}
class FakeDatabase{
 constructor(name,version=0){this.name=name;this.version=version;this.stores={};this.onversionchange=null;}
 get objectStoreNames(){return names(Object.keys(this.stores));}
 createObjectStore(name,{keyPath='id'}={}){this.stores[name]={keyPath,data:new Map(),indexes:new Map()};if(this.upgradeTx)this.upgradeTx.working[name]=copyStore(this.stores[name]);return this.upgradeTx.objectStore(name);}
 transaction(storeNames,mode='readonly'){if(typeof storeNames==='string')storeNames=[storeNames];const tx=new FakeTransaction(this,storeNames,mode);return tx;}
 close(){}
}
export function installFakeIndexedDB(){
 globalThis.indexedDB={open:(name,version)=>{
   const req={result:null,error:null,transaction:null,onsuccess:null,onerror:null,onupgradeneeded:null,onblocked:null};
   queueMicrotask(()=>{
    const db=databases.get(name)||new FakeDatabase(name);const oldVersion=db.version;
    if(version<oldVersion){req.error=new DOMException('older version','VersionError');req.onerror?.();return;}
    databases.set(name,db);req.result=db;
    if(version>oldVersion){db.upgradeTx=new FakeTransaction(db,Object.keys(db.stores),'readwrite',true);req.transaction=db.upgradeTx;req.onupgradeneeded?.({oldVersion});db.version=version;const tx=db.upgradeTx;db.upgradeTx=null;const prev=tx.oncomplete;tx.oncomplete=()=>{prev?.();req.onsuccess?.();};tx.check();}
    else req.onsuccess?.();
   });return req;
 }};
}
export function resetFakeDatabases(){databases.clear();}
