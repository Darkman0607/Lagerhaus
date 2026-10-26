import assert from 'node:assert/strict';
import {installFakeIndexedDB,resetFakeDatabases} from './fake-indexeddb.mjs';
installFakeIndexedDB();resetFakeDatabases();
// Seed version 4 (U05) database: upgrade to v5 must retain IDs, photos, movements and balances.
const articleId='77777777-7777-4777-8777-777777777777',locId='88888888-8888-4888-8888-888888888888';
const photoId='99999999-9999-4999-8999-999999999999',initialMove='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
await new Promise((resolve,reject)=>{
 const req=indexedDB.open('lagerhaus-local',4);req.onupgradeneeded=()=>{
  const db=req.result,tx=req.transaction;
  for(const n of ['articles','locations','stocks','movements','media','audit','categories','purchases','meta'])db.createObjectStore(n,{keyPath:n==='meta'?'key':'id'});
  tx.objectStore('stocks').createIndex('by_article_location',['articleId','locationId'],{unique:true});tx.objectStore('stocks').createIndex('by_article','articleId');
  tx.objectStore('movements').createIndex('by_article','articleId');tx.objectStore('movements').createIndex('by_created','createdAt');
  tx.objectStore('audit').createIndex('by_created','createdAt');
  tx.objectStore('articles').add({id:articleId,name:'WC Reiniger',unit:'ml',articleKind:'consumable',packageSize:750,packageUnit:'ml',minQuantity:300,primaryLocationId:locId,createdAt:'2026-10-01'});
  tx.objectStore('locations').add({id:locId,name:'Badschrank',kind:'raum'});
  tx.objectStore('stocks').add({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',articleId,locationId:locId,quantity:1250});
  tx.objectStore('movements').add({id:initialMove,articleId,locationId:locId,before:0,after:1250,delta:1250,source:'initial',createdAt:'2026-10-01'});
  tx.objectStore('media').add({id:photoId,ownerType:'article',ownerId:articleId,blob:new Blob(['photo'],{type:'image/png'})});
 };req.onsuccess=resolve;req.onerror=()=>reject(req.error);
});
const {repository,DATABASE_VERSION,openDatabase}=await import('../src/data/store.js');
const {bookStock,undoBooking,setLocationThreshold,setArticleThreshold,setPackageBreakdown,stockLedger,thresholdStatus}=await import('../src/data/bookings.js');
const {bookingPanel}=await import('../src/views/bookings.js');
const {articleImages}=await import('../src/data/catalog.js');
assert.equal(DATABASE_VERSION,7);assert.equal((await repository.health()).version,7);
const old=(await repository.stocks()).find(s=>s.articleId===articleId);assert.equal(old.quantity,1250);
assert.equal((await articleImages([articleId])).length,1);assert.equal((await repository.movements(articleId)).find(m=>m.id===initialMove).delta,1250);
// U06-F01: precise location bookings; inputs with compatible units, no overdraft, atomic failure.
let received=await bookStock({articleId,locationId:locId,type:'receipt',quantity:0.5,unit:'l',note:'Neue Flasche'});
assert.equal(received.delta,500);assert.equal(received.after,1750);
let used=await bookStock({articleId,locationId:locId,type:'usage',quantity:250,unit:'ml',note:'WC geputzt'});
assert.equal(used.after,1500);
const rejected=await repository.movements(articleId);await assert.rejects(()=>bookStock({articleId,locationId:locId,type:'issue',quantity:5000,unit:'ml'}),{code:'INSUFFICIENT'});
assert.equal((await repository.movements(articleId)).length,rejected.length,'failed booking must not write a movement');
await assert.rejects(()=>bookStock({articleId,locationId:locId,type:'receipt',quantity:1,unit:'kg'}),{code:'VALIDATION'});
// U06-F02: correction logs old, new, reason and source; missing reason rejected.
await assert.rejects(()=>bookStock({articleId,locationId:locId,type:'correction',quantity:900,note:''}),{code:'VALIDATION'});
let corrected=await bookStock({articleId,locationId:locId,type:'correction',quantity:900,note:'Inventur 26.10.: 900 ml gemessen'});
assert.equal(corrected.before,1500);assert.equal(corrected.after,900);assert.equal(corrected.source,'inventory');
// U06-F03: article-wide and location-specific threshold; null inherits; zero red regardless of threshold.
await setArticleThreshold({articleId,minQuantity:950});
let overview=await stockLedger();assert.equal(overview.rows[0].status,'orange');
await setLocationThreshold({articleId,locationId:locId,minQuantity:800});
overview=await stockLedger();assert.equal(overview.rows[0].status,'gruen');assert.equal(overview.rows[0].threshold,800);
assert.equal(thresholdStatus(0,0),'rot');assert.equal(thresholdStatus(1,2),'orange');assert.equal(thresholdStatus(3,2),'gruen');
// U06-F04: protected reversal; repeat forbidden, prevent undo when received qty already consumed.
await assert.rejects(()=>undoBooking(initialMove),{code:'VALIDATION'});
await undoBooking(used.id);assert.equal((await repository.stocks())[0].quantity,1150);
await assert.rejects(()=>undoBooking(used.id),{code:'VALIDATION'});
const reversal=(await stockLedger()).history.find(m=>m.undoOf===used.id);assert.ok(reversal&&reversal.delta===250);
// Undo large receipt after further consumption -> must fail with no changes.
await bookStock({articleId,locationId:locId,type:'correction',quantity:100,note:'Körperlich 100 ml nachgezählt'});
await assert.rejects(()=>undoBooking(received.id),{code:'INSUFFICIENT'});
assert.equal((await repository.stocks())[0].quantity,100);
// U06-F05: pack count (1 full + 250 ml open) updates total without doubling; estimate visibly flagged.
const pack=await setPackageBreakdown({articleId,locationId:locId,sealedPacks:1,openQuantity:250,estimated:true,note:'Flaschen gezählt, Rest geschätzt'});
assert.equal(pack.after,1000);assert.equal(pack.stock.packageState.sealedPacks,1);assert.equal(pack.stock.packageState.estimated,true);
let ui=await bookingPanel();assert.match(ui,/SCHÄTZUNG/);assert.match(ui,/Bestandsampel/);assert.match(ui,/data-stock-action="undo"/);
await bookStock({articleId,locationId:locId,type:'usage',quantity:25,unit:'ml',note:'Einsatz'});
let row=(await stockLedger()).rows[0];assert.equal(row.quantity,975);assert.equal(row.packageState.estimated,true);assert.equal(row.packageState.sealedPacks,1);assert.equal(row.packageState.openQuantity,225);
await assert.rejects(()=>setPackageBreakdown({articleId,locationId:locId,sealedPacks:1.5,openQuantity:0,note:'x'}),{code:'VALIDATION'});
await assert.rejects(()=>setPackageBreakdown({articleId,locationId:locId,sealedPacks:1,openQuantity:750,note:'x'}),{code:'VALIDATION'});
assert.equal((await articleImages([articleId])).length,1,'migration preserves image');
console.log('PASS U06: v4→v5 migration, 5 features, book/undo, limits, estimate markings, atomic errors, photos');
