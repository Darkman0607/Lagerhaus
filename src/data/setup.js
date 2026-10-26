import {openDatabase,StorageError} from './store.js';
const KEY='u10.setup';
const validSections=['privat','arbeit','gemeinsam'];
export async function readSetup(){const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction('meta','readonly');const r=tx.objectStore('meta').get(KEY);tx.oncomplete=()=>resolve(r.result?.value||{section:'privat',completed:false});tx.onabort=()=>reject(tx.error);});}
export async function saveSetup({section='privat',completed=true}={}){if(!validSections.includes(section))throw new StorageError('Ungültiger Standardbereich','VALIDATION');const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction('meta','readwrite');tx.objectStore('meta').put({key:KEY,value:{section,completed:!!completed},updatedAt:new Date().toISOString()});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});}
