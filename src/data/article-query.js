/** U07: deterministic search/filter/sort for the local catalog. No stock mutations. */
import {thresholdStatus} from './bookings.js';
const norm=v=>String(v??'').toLocaleLowerCase('de').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
export const DEFAULT_PREFERENCES=Object.freeze({query:'',section:'alle',category:'',location:'',kind:'',status:'',favorite:false,changed:'',expiry:'',sort:'name',layout:'auto'});
export const SORTS=['name','quantity','location','changed','status'];
export const LAYOUTS=['auto','table','cards'];
export function normalizePreferences(raw={}){
 const r={...DEFAULT_PREFERENCES};
 for(const k of ['query','section','category','location','kind','status','changed','expiry'])if(typeof raw[k]==='string')r[k]=raw[k].slice(0,160);
 r.favorite=raw.favorite===true;
 r.sort=SORTS.includes(raw.sort)?raw.sort:'name';r.layout=LAYOUTS.includes(raw.layout)?raw.layout:'auto';return r;
}
export function articleContext(article,stocks=[],locations=[],categories=[]){
 const positions=stocks.filter(s=>s.articleId===article.id),quantity=positions.reduce((n,s)=>n+(Number(s.quantity)||0),0);
 const activeIds=positions.filter(s=>s.quantity>0).map(s=>s.locationId);
 if(!activeIds.length&&article.primaryLocationId)activeIds.push(article.primaryLocationId);
 const placeIds=new Set();
 for(const id of activeIds){let current=locations.find(l=>l.id===id),visited=new Set();while(current&&!visited.has(current.id)){placeIds.add(current.id);visited.add(current.id);current=locations.find(l=>l.id===current.parentId);}}
 const places=locations.filter(l=>placeIds.has(l.id));
 const category=categories.find(c=>c.id===article.categoryId);
 const categoryChildren=[];if(category){let p=category,seen=new Set();while(p&&!seen.has(p.id)){categoryChildren.push(p.id);seen.add(p.id);p=categories.find(x=>x.id===p.parentId)}}
 const effective=positions.filter(s=>s.quantity>0);
 // Zero inventory always red; if any stocked location is under its own limit then warn.
 const status=quantity<=0?'rot':effective.some(s=>thresholdStatus(s.quantity,s.lowThreshold??article.minQuantity??0)==='orange')|| (article.minQuantity>0&&quantity<=article.minQuantity)?'orange':'gruen';
 const search=[article.id,article.id.slice(0,8),article.name,article.brand,article.model,article.serialNumber,article.manufacturer,article.category,category?.name,...categoryChildren.map(id=>categories.find(c=>c.id===id)?.name),...places.map(l=>l.name),...article.tags||[],...Object.entries(article.attributes||{}).flat()].join(' ');
 return {...article,section:article.section||'privat',articleKind:article.articleKind||'reusable',quantity,status,placeIds:[...placeIds],placeLabel:places.map(l=>l.name).join(' · '),categoryIds:categoryChildren,search:norm(search)};
}
export function filterAndSort(items,pref,now=Date.now()){
 const p=normalizePreferences(pref),words=norm(p.query).trim().split(/\s+/).filter(Boolean);
 const results=items.filter(a=>{
  if(words.some(w=>!a.search.includes(w)))return false;
  if(p.section!=='alle'&&a.section!==p.section&&!(p.section!=='gemeinsam'&&a.section==='gemeinsam'))return false;
  if(p.category&&!a.categoryIds.includes(p.category))return false;
  if(p.location&&!a.placeIds.includes(p.location))return false;
  if(p.kind&&a.articleKind!==p.kind)return false;
  if(p.status&&a.status!==p.status)return false;
  if(p.favorite&&!a.favorite)return false;
  if(p.expiry&&p.expiry!=='alle'&&a.expiry!==p.expiry)return false;
  if(p.expiry==='alle'&&!['bald','abgelaufen'].includes(a.expiry))return false;
  if(p.changed){const days=Number(p.changed),date=Date.parse(a.updatedAt);if(!Number.isFinite(days)||!Number.isFinite(date)||date<now-days*86400000)return false;}
  return true;
 });
 const collator=new Intl.Collator('de-AT',{numeric:true,sensitivity:'base'});
 const statusRank={rot:0,orange:1,gruen:2};
 const compare=(a,b)=>{
  switch(p.sort){
   case 'quantity':return b.quantity-a.quantity;
   case 'location':return collator.compare(a.placeLabel,b.placeLabel);
   case 'changed':return (Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0);
   case 'status':return statusRank[a.status]-statusRank[b.status];
   default:return collator.compare(a.name,b.name);
  }
 };
 return results.sort((a,b)=>compare(a,b)||collator.compare(a.name,b.name)||collator.compare(a.id,b.id));
}
