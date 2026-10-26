/** U12: local equipment register. Never changes article stock merely by linking a part. */
import {openDatabase,StorageError,DATABASE_VERSION} from './store.js';
const uid=()=>crypto.randomUUID();
const date=()=>new Date().toISOString().slice(0,10);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const error=(message)=>new StorageError(message,'VALIDATION');
function id(value){if(typeof value!=='string'||!uuid.test(value))throw error('Ungültige Datensatz-ID.');return value;}
function txt(value,label,max=160,required=false){const v=String(value??'').trim();if((required&&!v)||v.length>max)throw error(`${label}: ${required?'Pflichtfeld, ':''}höchstens ${max} Zeichen.`);return v;}
function day(value,label='Datum',required=false){const v=String(value||'');if(!v){if(required)throw error(`${label} ist erforderlich.`);return null;}if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||(!Number.isFinite(Date.parse(v+'T00:00:00.000Z'))||new Date(v+'T00:00:00.000Z').toISOString().slice(0,10)!==v))throw error(`${label} ist ungültig.`);return v;}
function positiveInt(v,label,max=100000){if(v===''||v===undefined||v===null)return null;const n=Number(v);if(!Number.isSafeInteger(n)||n<1||n>max)throw error(`${label}: positive ganze Zahl bis ${max} erforderlich.`);return n;}
function decimal(v,label,max=1e9,optional=true){if(v===''||v===undefined||v===null){if(optional)return null;throw error(`${label} fehlt.`);}const n=Number(v);if(!Number.isFinite(n)||n<0||n>max||Math.abs(n*100-Math.round(n*100))>1e-7)throw error(`${label}: 0 bis ${max}, maximal zwei Nachkommastellen.`);return n;}
function plusDays(input,count){const d=new Date(input+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10);}
function transact(db,names,mode,fn){return new Promise((resolve,reject)=>{const tx=db.transaction(names,mode);let out,thrown;tx.oncomplete=()=>resolve(out);tx.onabort=()=>reject(thrown||tx.error||error('Änderung wurde zurückgesetzt.'));try{fn(tx,v=>out=v,e=>{thrown=e;tx.abort();});}catch(e){thrown=e;try{tx.abort();}catch{}reject(e);}});}
export async function equipmentData(){const db=await openDatabase();return transact(db,['devices','maintenancePlans','maintenanceEvents','deviceParts','articles','locations','stocks'],'readonly',(tx,done)=>{const names=['devices','maintenancePlans','maintenanceEvents','deviceParts','articles','locations','stocks'],out={};let left=names.length;for(const n of names){const r=tx.objectStore(n).getAll();r.onsuccess=()=>{out[n]=r.result;if(!--left)done(out);};}});}
export async function saveDevice(input){const articleId=id(input.articleId),locationId=input.locationId?id(input.locationId):null;
 const serial=txt(input.serialNumber,'Seriennummer',100),condition=txt(input.condition,'Zustand',60),notes=txt(input.notes,'Notizen',1000),purchasedOn=day(input.purchasedOn,'Kaufdatum');
 const meterHours=decimal(input.meterHours,'Betriebsstunden',1e7)??0;const type=txt(input.deviceType,'Gerätetyp',90);
 const db=await openDatabase(),at=new Date().toISOString();return transact(db,['devices','articles','locations','audit'],'readwrite',(tx,done,fail)=>{
  tx.objectStore('articles').get(articleId).onsuccess=e=>{const article=e.target.result;if(!article||article.archivedAt||article.articleKind!=='device')return fail(error('Bitte einen aktiven Geräteartikel auswählen.'));
   const finish=()=>{const devices=tx.objectStore('devices');const rid=input.id?id(input.id):uid();devices.get(rid).onsuccess=e=>{
    const prior=e.target.result;if(input.id&&(!prior||prior.articleId!==articleId))return fail(error('Geräteprofil wurde nicht gefunden oder Artikelwechsel ist nicht erlaubt.'));
    if(prior&&meterHours<Number(prior.meterHours||0))return fail(error('Betriebsstundenzähler darf nicht rückwärts laufen.'));
    const row={id:rid,articleId,locationId:locationId||article.primaryLocationId||null,serialNumber:serial,condition,notes,purchasedOn,meterHours,deviceType:type||article.type||article.category||'Gerät',createdAt:prior?.createdAt||at,updatedAt:at,schemaVersion:DATABASE_VERSION};
    devices.put(row);tx.objectStore('audit').add({id:uid(),type:prior?'device-updated':'device-created',entityId:rid,source:'manual',createdAt:at});done(row);
   };};
   if(locationId){tx.objectStore('locations').get(locationId).onsuccess=e=>{if(!e.target.result||e.target.result.archivedAt)return fail(error('Lagerort ist nicht vorhanden.'));finish();};}else finish();
  };
 });}
export async function addPlan(input){const deviceId=id(input.deviceId),title=txt(input.title,'Wartungsaufgabe',120,true),kind=txt(input.kind,'Wartungsart',80,true);
 const intervalDays=positiveInt(input.intervalDays,'Kalenderintervall',36500),intervalHours=positiveInt(input.intervalHours,'Betriebsstundenintervall',100000);
 const dueDate=day(input.dueDate,'Fälligkeitsdatum'),dueHours=decimal(input.dueHours,'Fälligkeitsstunden',1e7);
 if(!intervalDays&&!intervalHours&&!dueDate&&dueHours===null)throw error('Mindestens ein Termin oder Betriebsstundenwert ist notwendig.');
 if(intervalHours&&!Number.isFinite(dueHours))throw error('Für den Stundenintervall bitte einen ersten Fälligkeitsstundenstand angeben.');
 const db=await openDatabase(),at=new Date().toISOString();return transact(db,['devices','maintenancePlans','audit'],'readwrite',(tx,done,fail)=>{tx.objectStore('devices').get(deviceId).onsuccess=e=>{
  if(!e.target.result)return fail(error('Gerät nicht gefunden.'));
  const plan={id:uid(),deviceId,title,kind,intervalDays,intervalHours,dueDate:dueDate||(intervalDays?plusDays(date(),intervalDays):null),dueHours,createdAt:at,updatedAt:at,schemaVersion:DATABASE_VERSION};
  tx.objectStore('maintenancePlans').add(plan);tx.objectStore('audit').add({id:uid(),type:'maintenance-planned',entityId:deviceId,source:'manual',createdAt:at});done(plan);
 };});}
export async function recordService(input){const planId=id(input.planId),performedOn=day(input.performedOn,'Wartungsdatum',true),meterHours=decimal(input.meterHours,'Betriebsstunden',1e7),cost=decimal(input.cost,'Kosten',1e7)??0,notes=txt(input.notes,'Notiz',1000);
 if(performedOn>date())throw error('Wartung darf nicht in der Zukunft dokumentiert werden.');
 const db=await openDatabase(),at=new Date().toISOString();return transact(db,['devices','maintenancePlans','maintenanceEvents','audit'],'readwrite',(tx,done,fail)=>{
  const plans=tx.objectStore('maintenancePlans');plans.get(planId).onsuccess=e=>{const plan=e.target.result;if(!plan)return fail(error('Wartungsplan nicht gefunden.'));
   tx.objectStore('devices').get(plan.deviceId).onsuccess=e=>{const dev=e.target.result;if(!dev)return fail(error('Gerät wurde nicht gefunden.'));
    if(plan.lastCompletedAt&&performedOn<plan.lastCompletedAt)return fail(error('Wartungsdatum darf nicht vor der letzten dokumentierten Wartung liegen.'));
    if(plan.intervalHours&&meterHours===null)return fail(error('Für einen Stundenplan ist ein Betriebsstundenstand erforderlich.'));
    if(meterHours!==null&&meterHours<Number(dev.meterHours||0))return fail(error('Betriebsstundenstand darf nicht rückwärts laufen.'));
    const row={id:uid(),deviceId:dev.id,planId,performedOn,meterHours,cost,notes,title:plan.title,kind:plan.kind,createdAt:at,schemaVersion:DATABASE_VERSION};
    tx.objectStore('maintenanceEvents').add(row);
    if(meterHours!==null){dev.meterHours=meterHours;dev.updatedAt=at;tx.objectStore('devices').put(dev);}
    if(plan.intervalDays)plan.dueDate=plusDays(performedOn,plan.intervalDays);else plan.dueDate=null;
    if(plan.intervalHours)plan.dueHours=meterHours+plan.intervalHours;else plan.dueHours=null;
    plan.lastCompletedAt=performedOn;plan.updatedAt=at;plans.put(plan);
    tx.objectStore('audit').add({id:uid(),type:'maintenance-completed',entityId:dev.id,source:'manual',createdAt:at,planId});done(row);
   };
  };
 });}
export async function linkPart(input){const deviceId=id(input.deviceId),articleId=id(input.articleId),note=txt(input.note,'Teilehinweis',200);
 const db=await openDatabase(),at=new Date().toISOString();return transact(db,['deviceParts','devices','articles','audit'],'readwrite',(tx,done,fail)=>{
  tx.objectStore('devices').get(deviceId).onsuccess=e=>{const device=e.target.result;if(!device)return fail(error('Geräteprofil nicht gefunden.'));
   if(articleId===device.articleId)return fail(error('Ein Gerät kann nicht sein eigenes Ersatzteil sein.'));
   tx.objectStore('articles').get(articleId).onsuccess=e=>{const article=e.target.result;if(!article||article.archivedAt)return fail(error('Verknüpfter Artikel ist nicht aktiv.'));
    tx.objectStore('deviceParts').index('by_device').getAll(deviceId).onsuccess=e=>{
     if(e.target.result.some(l=>l.articleId===articleId))return fail(error('Dieser Artikel ist bereits verknüpft.'));
     const row={id:uid(),deviceId,articleId,note,createdAt:at,schemaVersion:DATABASE_VERSION};tx.objectStore('deviceParts').add(row);
     tx.objectStore('audit').add({id:uid(),type:'device-part-linked',entityId:deviceId,source:'manual',createdAt:at,articleId});done(row);
    };
   };
  };
 });}
export async function removePart(linkId){id(linkId);const db=await openDatabase();return transact(db,['deviceParts'],'readwrite',(tx,done,fail)=>{tx.objectStore('deviceParts').get(linkId).onsuccess=e=>{if(!e.target.result)return fail(error('Verknüpfung nicht gefunden.'));tx.objectStore('deviceParts').delete(linkId);done(true);};});}
export async function saveMaintenancePhoto({ownerType,ownerId,file}){if(!['device','maintenance'].includes(ownerType))throw error('Ungültiger Bildbereich.');id(ownerId);
 if(!(file instanceof Blob)||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size===0||file.size>5_000_000)throw error('Foto muss JPG, PNG oder WEBP und maximal 5 MB groß sein.');
 const db=await openDatabase(),at=new Date().toISOString();return transact(db,['devices','maintenanceEvents','media'],'readwrite',(tx,done,fail)=>{
  tx.objectStore(ownerType==='device'?'devices':'maintenanceEvents').get(ownerId).onsuccess=e=>{if(!e.target.result)return fail(error('Fotoziel nicht gefunden.'));
   const row={id:uid(),ownerType,ownerId,name:'Wartungsfoto',blob:file,createdAt:at,updatedAt:at};tx.objectStore('media').add(row);done(row.id);
  };
 });}
export async function maintenancePhotos(ids){const db=await openDatabase();return transact(db,['media'],'readonly',(tx,done)=>{tx.objectStore('media').getAll().onsuccess=e=>done(e.target.result.filter(x=>['device','maintenance'].includes(x.ownerType)&&ids.includes(x.ownerId)));});}
export function planStatus(plan,device,now=date(),warningDays=30){const time=plan.dueDate?Math.round((new Date(plan.dueDate+'T00:00:00Z')-new Date(now+'T00:00:00Z'))/86400000):null;
 const hours=plan.dueHours!==null&&plan.dueHours!==undefined?plan.dueHours-Number(device.meterHours||0):null;
 if((time!==null&&time<=0)||(hours!==null&&hours<=0))return 'offen';
 if((time!==null&&time<=warningDays)||(hours!==null&&hours<=Math.min(25,Math.max(1,Math.ceil(Number(plan.intervalHours||50)*0.1)))))return 'bald';
 return 'ok';}
export function maintenanceSummary(data,section='alle',type='alle',now=date()){const devices=data.devices.filter(d=>{
 const article=data.articles.find(a=>a.id===d.articleId);return article&&!article.archivedAt&&(section==='alle'||article.section===section)&&(type==='alle'||d.deviceType===type);
 });const keep=new Set(devices.map(x=>x.id));const plans=data.maintenancePlans.filter(p=>keep.has(p.deviceId));return {devices,plans,events:data.maintenanceEvents.filter(e=>keep.has(e.deviceId)),parts:data.deviceParts.filter(p=>keep.has(p.deviceId)),statuses:plans.map(p=>({...p,status:planStatus(p,devices.find(d=>d.id===p.deviceId),now)}))};}
