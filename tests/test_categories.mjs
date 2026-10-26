import assert from 'node:assert/strict';
import {installFakeIndexedDB,resetFakeDatabases} from './fake-indexeddb.mjs';
installFakeIndexedDB();resetFakeDatabases();
// Realistic U03->U04 migration fixture, including image, stock and movements.
await new Promise((resolve,reject)=>{
 const req=indexedDB.open('lagerhaus-local',2);
 req.onupgradeneeded=()=>{
  for(const name of ['articles','stocks','movements','media','locations','audit','meta','purchases'])req.result.createObjectStore(name,{keyPath:name==='meta'?'key':'id'});
  // Simulate U03 indexes built by schema v2.
  req.transaction.objectStore('articles').createIndex('by_name','name');
  req.transaction.objectStore('stocks').createIndex('by_article_location',['articleId','locationId'],{unique:true});
  req.transaction.objectStore('stocks').createIndex('by_article','articleId');
  req.transaction.objectStore('movements').createIndex('by_article','articleId');
  req.transaction.objectStore('movements').createIndex('by_created','createdAt');
  req.transaction.objectStore('media').createIndex('by_owner',['ownerType','ownerId']);
  req.transaction.objectStore('audit').createIndex('by_created','createdAt');
  const tx=req.transaction,catId='11111111-1111-4111-8111-111111111111';
  tx.objectStore('articles').add({id:catId,name:'Alter WC-Reiniger',category:'Putzen',unit:'Stück',section:'gemeinsam',createdAt:'2026-10-25'});
  tx.objectStore('stocks').add({id:'22222222-2222-4222-8222-222222222222',articleId:catId,locationId:'33333333-3333-4333-8333-333333333333',quantity:6});
  tx.objectStore('movements').add({id:'44444444-4444-4444-8444-444444444444',articleId:catId,delta:6,createdAt:'2026-10-25'});
  tx.objectStore('media').add({id:'55555555-5555-4555-8555-555555555555',ownerType:'article',ownerId:catId,blob:new Blob(['pic'],{type:'image/png'})});
  tx.objectStore('locations').add({id:'33333333-3333-4333-8333-333333333333',name:'Abstellraum'});
 };
 req.onsuccess=resolve;req.onerror=()=>reject(req.error);
});
const {repository,DATABASE_VERSION}=await import('../src/data/store.js');
const {createCatalogArticle,updateCatalogArticle,articleImages}=await import('../src/data/catalog.js');
const {createCategory,editCategory,reorderCategory,listCategories,categoryPath}=await import('../src/data/categories.js');
const {articlesView,clearArticleMediaUrls}=await import('../src/views/articles.js');
assert.equal(DATABASE_VERSION,3);
let cats=await listCategories();assert.ok(cats.length>=10);
let migrated=(await repository.articles()).find(x=>x.name==='Alter WC-Reiniger');
assert.equal(migrated.category,'Putzen');assert.equal(migrated.section,'gemeinsam');
assert.equal(migrated.categoryId,cats.find(c=>c.name==='Putzen').id);
assert.equal((await repository.stocks())[0].quantity,6);
assert.equal((await repository.movements(migrated.id)).length,1);
assert.equal((await articleImages([migrated.id])).length,1);
// U04-F01: separate views refer to same shared article record; section may change without movement.
let fresh=await createCatalogArticle({name:'Bohrer 8 mm',category:'Werkzeug',locationName:'Garage',quantity:4,section:'arbeit',articleKind:'device',tags:['Akku 18 V','8 mm'],attributes:{Spannung:'18 V'},maintenanceIntervalDays:180});
let shared=await createCatalogArticle({name:'Schrauben',category:'Werkzeug',locationId:fresh.primaryLocationId,quantity:10,section:'gemeinsam',articleKind:'consumable'});
assert.equal((await repository.articles()).length,3);
assert.equal(shared.section,'gemeinsam');
let html=await articlesView();assert.match(html,/data-catalog-section/);assert.match(html,/data-section="gemeinsam"/);
// U04-F02: add, sort, rename, move subcategory.
const sub=await createCategory({name:'Bits & Aufsätze',parentId:cats.find(c=>c.name==='Werkzeug').id});
assert.match(categoryPath(sub,await listCategories()),/Werkzeug \/ Bits/);
await assert.rejects(()=>createCategory({name:'putzen'}),{code:'VALIDATION'});
await assert.rejects(()=>editCategory(cats.find(c=>c.name==='Werkzeug').id,{parentId:sub.id}),{code:'VALIDATION'},'hierarchy cycle');
const other=await createCategory({name:'Elektro-Zubehör',parentId:sub.parentId});
assert.equal(await reorderCategory(other.id,-1),true);
await editCategory(sub.id,{parentId:cats.find(c=>c.name==='Elektronik').id});
assert.match(categoryPath((await listCategories()).find(c=>c.id===sub.id),await listCategories()),/Elektronik \/ Bits/);
// U04-F03 + F04: kind-specific fields, search tags and attributes, input validation.
assert.equal(fresh.articleKind,'device');assert.equal(fresh.maintenanceIntervalDays,180);
assert.deepEqual(fresh.tags,['Akku 18 V','8 mm']);assert.deepEqual(fresh.attributes,{Spannung:'18 V'});
await assert.rejects(()=>createCatalogArticle({name:'x',category:'Putzen',locationId:fresh.primaryLocationId,tags:'a,a,a,b,'}),{code:'VALIDATION'});
await assert.rejects(()=>createCatalogArticle({name:'x',category:'Putzen',locationId:fresh.primaryLocationId,attributesText:'Ungültig'}),{code:'VALIDATION'});
const food=await createCatalogArticle({name:'Kaffee',category:'Getränke',locationId:fresh.primaryLocationId,articleKind:'food',bestBefore:'2027-10-01',maintenanceIntervalDays:50,quantity:0});
assert.equal(food.bestBefore,'2027-10-01');assert.equal(food.maintenanceIntervalDays,null);
await assert.rejects(()=>createCatalogArticle({name:'Kaffee',category:'Getränke',locationId:fresh.primaryLocationId,articleKind:'food',bestBefore:'2027-02-30'}),{code:'VALIDATION'});
const source=(await repository.articles()).find(x=>x.id===fresh.id);
await updateCatalogArticle(fresh.id,{...source,locationId:fresh.primaryLocationId,quantity:4,category:'Werkzeug',tags:'USB-C, 8 mm',attributesText:'Länge: 8 mm'});
html=await articlesView();assert.match(html,/usb-c/);assert.match(html,/länge/);
clearArticleMediaUrls();
// U04-F05: category rename updates category name snapshots, without touching stocks and movements.
const originalQty=(await repository.stocks()).find(x=>x.articleId===fresh.id).quantity;
const oldMovement=(await repository.movements(fresh.id)).length;
const oldMedia=(await articleImages([migrated.id])).length;
const toolCategory=(await listCategories()).find(c=>c.name==='Werkzeug');
await editCategory(toolCategory.id,{name:'Werkstattbedarf'});
let updated=(await repository.articles()).find(x=>x.id===fresh.id);
assert.equal(updated.category,'Werkstattbedarf');assert.equal(updated.categoryId,toolCategory.id);
assert.equal((await repository.stocks()).find(x=>x.articleId===fresh.id).quantity,originalQty);
assert.equal((await repository.movements(fresh.id)).length,oldMovement);
assert.equal((await articleImages([migrated.id])).length,oldMedia);
await assert.rejects(()=>editCategory(toolCategory.id,{name:'Putzen'}),{code:'VALIDATION'});
assert.equal((await repository.articles()).find(x=>x.id===fresh.id).category,'Werkstattbedarf','failed rename rolled back');
// Simulated DOM interaction checks (Chromium is blocked by administrator policy here).
const {handleCatalogInput}=await import('../src/views/articles.js');
const rows=[{dataset:{section:'privat',search:'bohrer 8 mm usb-c'},hidden:false},{dataset:{section:'arbeit',search:'bohrer akku 18 v'},hidden:false},{dataset:{section:'gemeinsam',search:'putzen feuchtigkeit'},hidden:false}];
let query='',section='privat',msg={hidden:true};
const previousDocument=globalThis.document;
globalThis.document={querySelector:s=>s==='[data-catalog-search]'?{value:query}:s==='[data-catalog-section]'?{value:section}:null,querySelectorAll:()=>rows,getElementById:()=>msg};
try{
 handleCatalogInput({target:{matches:s=>s.includes('data-catalog')}});
 assert.deepEqual(rows.map(r=>r.hidden),[false,true,false],'Privat includes shared without duplicate');
 section='arbeit';handleCatalogInput({target:{matches:s=>s.includes('data-catalog')}});
 assert.deepEqual(rows.map(r=>r.hidden),[true,false,false],'Arbeit includes shared');
 query='akku 18 v';handleCatalogInput({target:{matches:s=>s.includes('data-catalog')}});
 assert.deepEqual(rows.map(r=>r.hidden),[true,false,true],'tag search and section intersect');
 section='gemeinsam';query='';handleCatalogInput({target:{matches:s=>s.includes('data-catalog')}});
 assert.deepEqual(rows.map(r=>r.hidden),[true,true,false],'gemeinsam lists one row');
}finally{globalThis.document=previousDocument;}
console.log('PASS U04: v2→v3 migration, legacy media/movements, area filters, CRUD/sort/nesting, cycle guard, kinds, tags/attrs, category rename preservation');
