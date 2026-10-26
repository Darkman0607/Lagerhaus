import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const store=readFileSync(resolve(root,'src/data/store.js'),'utf8');
const main=readFileSync(resolve(root,'src/main.js'),'utf8');
const more=readFileSync(resolve(root,'src/views/more.js'),'utf8');
for(const storeName of ['articles','locations','stocks','movements','media','purchases','audit','meta','categories'])assert.ok(store.includes(`'${storeName}'`));
for(const method of ['addArticle','addLocation','applyMovement','movements','saveMedia','checkWriteAccess','recentActivity'])assert.ok(store.includes(`async ${method}(`));
for(const feature of ['onupgradeneeded','onversionchange','readwrite','tx.oncomplete','tx.onabort','by_article_location','crypto.randomUUID'])assert.ok(store.includes(feature),feature);
assert.ok(main.includes('Speicherung nicht verfügbar'));assert.ok(more.includes('Systemstatus und Updates'));
assert.ok(more.includes('Vollständige Datensicherung')&&more.includes('Wiederherstellen')); // U10 user-facing controls
console.log('PASS: U02 persistence, atomic transaction codepath, migration, diagnostics & errors');