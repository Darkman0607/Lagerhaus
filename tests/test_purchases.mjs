import assert from 'node:assert/strict';
import {installFakeIndexedDB,resetFakeDatabases} from './fake-indexeddb.mjs';
installFakeIndexedDB();resetFakeDatabases();
const {repository,DATABASE_VERSION}=await import('../src/data/store.js');
const {shoppingData,shortageSuggestions,addPurchase,editPurchase,completePurchase,reopenPurchase,archivePurchase}=await import('../src/data/purchases.js');
const {bookStock}=await import('../src/data/bookings.js');
const {shoppingView}=await import('../src/views/shopping.js');
assert.equal(DATABASE_VERSION,6,'U08 must not reset/migrate DB');
const article=await repository.addArticle({name:'Kaffee',unit:'Stück',minQuantity:5});
const other=await repository.addArticle({name:'Schrauben',unit:'Stück',minQuantity:3});
const place=await repository.addLocation({name:'Küche'});
// F02: warning only once, persists until open purchase exists, disappears once restocked.
let info=await shoppingData();assert.equal(info.suggestions.length,2);
const free=await addPurchase({name:'Milch',quantity:2,unit:'l',area:'privat',priority:'normal',shop:'Supermarkt'});
assert.equal(free.articleId,null);assert.equal((await repository.purchases()).length,1);
const proposed=await addPurchase({articleId:article.id,quantity:5,unit:'Stück',area:'privat',priority:'dringend',source:'suggestion'});
await assert.rejects(()=>addPurchase({articleId:article.id,quantity:1,unit:'Stück'}),{code:'DUPLICATE'});
info=await shoppingData();assert.equal(info.suggestions.length,1);assert.equal(info.suggestions[0].id,other.id);
// F03: edit unit / area / priority / shop and keep linkage.
await editPurchase(free.id,{name:'Milch fettarm',quantity:3,unit:'l',area:'arbeit',priority:'später',shop:'Großmarkt'});
assert.equal((await repository.purchases()).find(p=>p.id===free.id).priority,'später');
// F04: free purchase never books stock, linked purchase commits once atomically, with provenance.
await completePurchase(free.id,{actualQuantity:2,actualUnit:'l'});
assert.equal((await repository.stocks()).length,0);
await assert.rejects(()=>completePurchase(proposed.id,{actualQuantity:5,actualUnit:'Stück',locationId:'00000000-0000-4000-8000-000000000000'}),{code:'VALIDATION'});
assert.equal((await repository.purchases()).find(p=>p.id===proposed.id).status,'open');
const completed=await completePurchase(proposed.id,{actualQuantity:5,actualUnit:'Stück',locationId:place.id});
assert.ok(completed.receiptMovementId);assert.equal(completed.actualBaseAmount,5);
assert.equal((await repository.stocks()).find(x=>x.articleId===article.id).quantity,5);
await assert.rejects(()=>completePurchase(proposed.id,{actualQuantity:5,locationId:place.id}),{code:'ALREADY_DONE'});
assert.equal((await repository.movements(article.id)).filter(m=>m.purchaseId===proposed.id&&m.bookType==='receipt').length,1);
assert.equal((await shoppingData()).suggestions.filter(s=>s.id===article.id).length,0);
// F05: reopen creates reversal; repeat safely; refuse undo if purchase was consumed.
await reopenPurchase(proposed.id);assert.equal((await repository.stocks()).find(x=>x.articleId===article.id).quantity,0);
assert.ok((await repository.movements(article.id)).some(m=>m.undoOf===completed.receiptMovementId));
await assert.rejects(()=>reopenPurchase(proposed.id),{code:'VALIDATION'});
await completePurchase(proposed.id,{actualQuantity:2,actualUnit:'Stück',locationId:place.id});
await bookStock({articleId:article.id,locationId:place.id,type:'usage',quantity:1});
await assert.rejects(()=>reopenPurchase(proposed.id),{code:'INSUFFICIENT'});
assert.equal((await repository.stocks()).find(s=>s.articleId===article.id).quantity,1);
assert.equal((await repository.purchases()).find(x=>x.id===proposed.id).status,'done');
await reopenPurchase(free.id);assert.equal((await repository.purchases()).find(x=>x.id===free.id).status,'open');
await completePurchase(free.id,{actualQuantity:3,actualUnit:'l'});
await archivePurchase(free.id);assert.equal((await repository.summary()).openPurchases,0);
assert.equal((await repository.purchases()).find(p=>p.id===free.id).status,'archived');
assert.equal((await shoppingData()).suggestions.filter(a=>a.id===article.id).length,1);
let markup=await shoppingView();assert.match(markup,/Meine Einkaufsliste/);assert.match(markup,/Automatisch nachkaufen/);assert.match(markup,/data-shopping-action="suggest"/);assert.match(markup,/Wieder öffnen/);
// F03: verify filter controls without needing a live browser.
const {handleShoppingFilter}=await import('../src/views/shopping.js');
const rows=[{dataset:{status:'open',area:'privat',priority:'dringend',query:'kaffee'},hidden:false},{dataset:{status:'open',area:'arbeit',priority:'normal',query:'reiniger'},hidden:false}];
const empty={hidden:true};globalThis.document={querySelectorAll:()=>rows,getElementById:()=>empty};
handleShoppingFilter({target:{id:'u08-area',value:'privat'}});assert.equal(rows[0].hidden,false);assert.equal(rows[1].hidden,true);
handleShoppingFilter({target:{id:'u08-priority',value:'normal'}});assert.equal(rows[0].hidden,true);assert.equal(empty.hidden,false);
handleShoppingFilter({target:{id:'u08-priority',value:'dringend'}});assert.equal(rows[0].hidden,false);
delete globalThis.document;
// Package booking: multiply only packaged content, never add planned amount again.
const packaged=await repository.addArticle({name:'Reiniger',unit:'ml',minQuantity:1});
const db=await repository.ready();await new Promise((resolve,reject)=>{const tx=db.transaction(['articles'],'readwrite');const r=tx.objectStore('articles').get(packaged.id);r.onsuccess=()=>tx.objectStore('articles').put({...r.result,packageSize:750,packageUnit:'ml'});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
const pack=await addPurchase({articleId:packaged.id,quantity:750,unit:'ml'});
const result=await completePurchase(pack.id,{actualQuantity:750,actualUnit:'ml',locationId:place.id,packCount:2});assert.equal(result.actualBaseAmount,1500);assert.equal((await repository.stocks()).find(s=>s.articleId===packaged.id).quantity,1500);
console.log('PASS U08: free/manual entries, deduped warnings, editing, atomic receipt/rollback, reopen/undo, archive, packages, shopping screen');
