import assert from 'node:assert/strict';
import {installFakeIndexedDB,resetFakeDatabases} from './fake-indexeddb.mjs';
installFakeIndexedDB();resetFakeDatabases();
const olderId='11111111-1111-4111-8111-111111111111',olderLoc='22222222-2222-4222-8222-222222222222';
// Realistic schema v3 fixture: U04 article + same IDs/stocks/media/movements survive U05 upgrade.
await new Promise((resolve,reject)=>{
 const req=indexedDB.open('lagerhaus-local',3);req.onupgradeneeded=()=>{
  const db=req.result,tx=req.transaction;for(const n of ['articles','locations','stocks','movements','media','audit','categories','purchases','meta'])db.createObjectStore(n,{keyPath:n==='meta'?'key':'id'});
  tx.objectStore('stocks').createIndex('by_article','articleId');tx.objectStore('stocks').createIndex('by_article_location',['articleId','locationId'],{unique:true});
  tx.objectStore('movements').createIndex('by_article','articleId');tx.objectStore('audit').createIndex('by_created','createdAt');
  tx.objectStore('articles').add({id:olderId,name:'Hammer',category:'Werkzeug',unit:'Stück',primaryLocationId:olderLoc,minQuantity:3,section:'privat',tags:['Altbestand'],createdAt:'2026-10-01'});
  tx.objectStore('locations').add({id:olderLoc,name:'Garage',createdAt:'2026-10-01'});
  tx.objectStore('stocks').add({id:'33333333-3333-4333-8333-333333333333',articleId:olderId,locationId:olderLoc,quantity:5});
  tx.objectStore('movements').add({id:'44444444-4444-4444-8444-444444444444',articleId:olderId,locationId:olderLoc,delta:5,source:'initial',createdAt:'2026-10-01'});
  tx.objectStore('media').add({id:'55555555-5555-4555-8555-555555555555',ownerType:'article',ownerId:olderId,blob:new Blob(['photo'],{type:'image/png'})});
 };req.onsuccess=resolve;req.onerror=()=>reject(req.error);
});
const {repository,DATABASE_VERSION,openDatabase}=await import('../src/data/store.js');
const {createLocation,updateLocation,archiveLocation,locationOverview,locationPath,locationDepth,transferStock,undoTransfer,recentTransfers}=await import('../src/data/locations.js');
const {updateCatalogArticle,articleImages}=await import('../src/data/catalog.js');
const {warehouseView}=await import('../src/views/warehouse.js');
const {articlesView,clearArticleMediaUrls}=await import('../src/views/articles.js');
assert.equal(DATABASE_VERSION,4);assert.equal((await repository.health()).version,4);
let old=(await repository.locations()).find(p=>p.id===olderLoc);assert.equal(old.name,'Garage');assert.equal(old.parentId,null);assert.equal(old.kind,'raum');
assert.equal((await repository.stocks())[0].quantity,5);assert.equal((await repository.movements(olderId)).length,1);assert.equal((await articleImages([olderId])).length,1);
// U05-F01: arbitrary user-defined hierarchy; cycle and duplicate sibling protection.
const workshop=await createLocation({name:'Haus',kind:'standort'});
const room=await createLocation({name:'Keller',kind:'raum',parentId:workshop.id});
const shelf=await createLocation({name:'Regal A',kind:'regal',parentId:room.id});
const section=await createLocation({name:'Fach 2',kind:'fach',parentId:shelf.id});
const bin=await createLocation({name:'Box Technik',kind:'box',parentId:section.id});
assert.equal(locationPath(bin,await repository.locations()),'Haus / Keller / Regal A / Fach 2 / Box Technik');
assert.equal(locationDepth(bin.id,await repository.locations()),5);
await assert.rejects(()=>updateLocation(workshop.id,{parentId:bin.id}),{code:'VALIDATION'});
await assert.rejects(()=>createLocation({name:'keller',parentId:workshop.id}),{code:'VALIDATION'});
// U05-F02: multiple real places per article, stocks independent and aggregated.
const t1=await transferStock({articleId:olderId,sourceLocationId:olderLoc,targetLocationId:bin.id,quantity:2,note:'Zwei in die Box'});
let stocks=(await repository.stocks()).filter(s=>s.articleId===olderId);
assert.equal(stocks.find(s=>s.locationId===olderLoc).quantity,3);assert.equal(stocks.find(s=>s.locationId===bin.id).quantity,2);
assert.equal(stocks.reduce((n,s)=>n+s.quantity,0),5,'transfer must conserve total');
assert.equal((await repository.movements(olderId)).length,3,'both moves in transaction');
const overview=await locationOverview();assert.equal(overview.find(x=>x.id===bin.id).articleCount,1);
assert.equal(overview.find(x=>x.id===bin.id).items[0].quantity,2);
// User can still edit catalog metadata but cannot corrupt multi-place quantity or silently swap default location.
const source=(await repository.articles()).find(x=>x.id===olderId);
const editable={...source,locationId:olderLoc,quantity:5,category:'Werkzeug',name:'Hammer 2'};
await updateCatalogArticle(olderId,editable);
assert.equal((await repository.articles()).find(x=>x.id===olderId).name,'Hammer 2');
await assert.rejects(()=>updateCatalogArticle(olderId,{...editable,quantity:8}),{code:'VALIDATION'});
await assert.rejects(()=>updateCatalogArticle(olderId,{...editable,locationId:bin.id}),{code:'VALIDATION'});
assert.equal((await repository.stocks()).filter(s=>s.articleId===olderId).reduce((n,s)=>n+s.quantity,0),5);
// U05-F03: rename and reparent retain location IDs and linked movement IDs.
const previousMovementIds=(await repository.movements(olderId)).map(x=>x.id);
await updateLocation(bin.id,{name:'Box Kleinmaterial'});
assert.equal(locationPath(bin.id,await repository.locations()),'Haus / Keller / Regal A / Fach 2 / Box Kleinmaterial');
assert.deepEqual((await repository.movements(olderId)).map(x=>x.id),previousMovementIds);
await assert.rejects(()=>archiveLocation(bin.id),{code:'IN_USE'},'cannot archive filled place');
await assert.rejects(()=>archiveLocation(section.id),{code:'IN_USE'},'cannot archive parent with active children');
// U05-F04: atomic failures + reverse transfer and double undo guard.
await assert.rejects(()=>transferStock({articleId:olderId,sourceLocationId:bin.id,targetLocationId:olderLoc,quantity:20}),{code:'VALIDATION'});
await assert.rejects(()=>transferStock({articleId:olderId,sourceLocationId:olderLoc,targetLocationId:olderLoc,quantity:1}),{code:'VALIDATION'});
assert.equal((await repository.movements(olderId)).length,3,'invalid transfers write no log');
assert.equal((await recentTransfers()).length,1);
await undoTransfer(t1.id);
stocks=(await repository.stocks()).filter(s=>s.articleId===olderId);
assert.equal(stocks.find(s=>s.locationId===olderLoc).quantity,5);assert.equal(stocks.find(s=>s.locationId===bin.id).quantity,0);
assert.equal(stocks.reduce((n,s)=>n+s.quantity,0),5);
await assert.rejects(()=>undoTransfer(t1.id),{code:'VALIDATION'});
await archiveLocation(bin.id);
assert.ok((await repository.locations()).find(x=>x.id===bin.id).archivedAt,'empty, unused bin can be archived');
// U05-F05: warehouse view exposes real counts, transfer, linked article list and undo history.
const markup=await warehouseView();assert.match(markup,/data-location-action="edit"/);assert.match(markup,/location-transfer-form/);assert.match(markup,/Haus \/ Keller/);assert.match(markup,/Rückgängig/);assert.match(markup,/href="#\/articles\/location\//);
const aHtml=await articlesView();assert.match(aHtml,/catalog-location-quantities/);assert.match(aHtml,/data-catalog-location/);clearArticleMediaUrls();
assert.ok((await repository.locations()).length>=6);
console.log('PASS U05: v3→v4 migration, parent paths, cycles, multi-location, archive protection, atomic transfers, undo, UI integration');
