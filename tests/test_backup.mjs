import assert from 'node:assert/strict';
import {installFakeIndexedDB,resetFakeDatabases} from './fake-indexeddb.mjs';
installFakeIndexedDB();resetFakeDatabases();
const {repository,openDatabase}=await import('../src/data/store.js');
const {readSetup,saveSetup}=await import('../src/data/setup.js');
const {createBackup,inspectBackup,restoreBackup}=await import('../src/data/backup.js');
assert.equal((await readSetup()).completed,false);
await saveSetup({section:'arbeit'});assert.equal((await readSetup()).section,'arbeit');
await assert.rejects(()=>saveSetup({section:'bad'}),{code:'VALIDATION'});
const place=await repository.addLocation({name:'Keller'});
const article=await repository.addArticle({name:'Akkuschrauber',minQuantity:2});
await repository.applyMovement({articleId:article.id,locationId:place.id,delta:2,source:'initial'});
const media=await repository.saveMedia({ownerType:'article',ownerId:article.id,name:'Foto.png',blob:new Blob([Uint8Array.from([137,80,78,71,13,10])],{type:'image/png'})});
let backup=await createBackup();assert.ok(backup.blob.size>0&&backup.filename.endsWith('.json'));
const full=await backup.blob.text(),inspection=await inspectBackup(full);
assert.equal(inspection.counts.articles,1);assert.equal(inspection.counts.stocks,1);assert.equal(inspection.counts.media,1);assert.equal(inspection.counts.meta,1);assert.equal(inspection.counts.movements,1);
const doc=JSON.parse(full);assert.equal(doc.payload.stores.media[0].backupBlob.bytes,6);
await assert.rejects(()=>inspectBackup(full.replace('Akkuschrauber','AkkuschraubeX')),{code:'BACKUP'});
await assert.rejects(()=>inspectBackup('kein JSON'),{code:'BACKUP'});
await assert.rejects(()=>inspectBackup(JSON.stringify({...doc,payload:{...doc.payload,schemaVersion:8}})),{code:'BACKUP'});
const second=await repository.addArticle({name:'Versehentlich hinzugefügt'});
assert.equal((await repository.articles()).length,2);
await restoreBackup(inspection);
assert.deepEqual((await repository.articles()).map(x=>x.id),[article.id]);
assert.equal((await repository.stocks())[0].quantity,2);
const db=await openDatabase();
const blobs=await new Promise((res,rej)=>{const tx=db.transaction('media','readonly'),r=tx.objectStore('media').getAll();r.onsuccess=()=>res(r.result);tx.onabort=()=>rej(tx.error);});
assert.equal(blobs[0].id,media.id);assert.equal(blobs[0].blob.type,'image/png');assert.deepEqual([...new Uint8Array(await blobs[0].blob.arrayBuffer())],[137,80,78,71,13,10]);
assert.equal((await readSetup()).section,'arbeit');
const reexport=await createBackup();assert.equal((await inspectBackup(await reexport.blob.text())).counts.articles,1);
const previous=await repository.articles();
const invalid={...inspection,payload:{...inspection.payload,stores:{...inspection.payload.stores,stocks:[{...inspection.payload.stores.stocks[0],articleId:'11111111-1111-4111-8111-111111111111'}]}}};
await assert.rejects(()=>restoreBackup(invalid),{code:'BACKUP'});
assert.deepEqual(await repository.articles(),previous,'rejected restore did not change current DB');
console.log('PASS: U10 empty setup, preferences, complete backup, SHA-256 integrity, media bytes, 9-store restore and reject rollback');
// Force a failure after a transaction starts; original data must remain intact.
const originalTx=db.transaction.bind(db);
db.transaction=(names,mode)=>{
 const tx=originalTx(names,mode);
 if(mode==='readwrite'&&Array.isArray(names)&&names.length===9){const store=tx.objectStore.bind(tx);tx.objectStore=(name)=>{
  const s=store(name);if(name==='media')s.add=()=>{throw new DOMException('simulated quota error','QuotaExceededError');};return s;
 };}
 return tx;
};
await assert.rejects(()=>restoreBackup(inspection));
db.transaction=originalTx;
assert.deepEqual(await repository.articles(),previous,'transaction failure rolled back all store clears');
console.log('PASS: atomic transaction failure rolls back even after clear calls');