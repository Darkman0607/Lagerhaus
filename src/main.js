import { icon } from './core/icons.js';
import { routes,routeFromHash,navigate } from './core/router.js';
import { dashboardView } from './views/dashboard.js';
import { warehouseView } from './views/warehouse.js';
import { articlesView,handleCatalogClick,handleCatalogSubmit,handleCatalogInput,clearArticleMediaUrls,handleCategoryClick,handleCategorySubmit } from './views/articles.js';
import {handleLocationClick,handleLocationSubmit,handleLocationInput} from './views/warehouse.js';
import {handleStockSubmit,handleStockClick} from './views/bookings.js';
import { shoppingView } from './views/shopping.js';
import { moreView,runStorageDiagnostic } from './views/more.js';
import { friendlyStorageError } from './data/store.js';
import { escapeHtml } from './core/escape.js';

const app=document.getElementById('app');
const views={dashboard:dashboardView, warehouse:warehouseView, articles:articlesView, shopping:shoppingView, more:moreView};
let run=0;
const navItems=Object.entries(routes).map(([key,item])=>`<button class="nav-item" data-route="${key}" data-nav="${key}" aria-label="${item.label}">${icon(item.icon,20)}<span>${item.label}</span></button>`).join('');
app.innerHTML=`<aside class="sidebar"><div class="brand"><span class="brand-mark"><span class="brand-tower"></span></span><div><strong>Lager<span>haus</span></strong><small>ORDNUNG. IM SYSTEM.</small></div></div><div class="side-group-title">ARBEITSPLATZ</div><nav class="side-nav" aria-label="Hauptnavigation">${navItems}</nav><div class="sidebar-bottom"><div class="sidebar-status"><span class="status-pulse"></span><div><strong>System bereit</strong><small>Version 0.6.0</small></div></div><span class="sidebar-meta">LAGERHAUS / 2026</span></div></aside>
 <div class="main-column"><header class="topbar"><div class="topbar-left"><span class="topbar-section">LAGERHAUS <span>/</span> <span id="topbar-current">ÜBERSICHT</span></span></div><div class="topbar-right"><span class="topbar-app-tag">PRIVATE · WORK</span><span class="topbar-online" id="network-indicator" aria-live="polite"></span><span class="avatar" aria-label="Lokale App">LH</span></div></header>
 <main id="main-content" tabindex="-1"></main><footer class="desktop-footer">LAGERHAUS <span>•</span> PROFESSIONELLE LAGER- UND INVENTARVERWALTUNG <span class="footer-version">V0.6.0</span></footer></div>
 <nav class="bottom-nav" aria-label="Mobile Hauptnavigation">${navItems}</nav>
 <div id="toast" role="status" aria-live="polite"></div>`;
const main=document.getElementById('main-content');
function networkUpdate(){ const online=navigator.onLine;const el=document.getElementById('network-indicator'); el.innerHTML=`<span class="status-pulse ${online?'':'offline'}"></span>${online?'Online':'Offline'}`;}
window.addEventListener('online',networkUpdate);window.addEventListener('offline',networkUpdate);networkUpdate();
async function render(){const seq=++run;const route=routeFromHash();document.querySelectorAll('[data-nav]').forEach(b=>{const active=b.dataset.nav===route;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});document.getElementById('topbar-current').textContent=routes[route].eyebrow.toUpperCase();document.title=`Lagerhaus | ${routes[route].label}`;clearArticleMediaUrls();const content=await views[route]();if(seq!==run)return;main.innerHTML=content;window.scrollTo({top:0,behavior:'instant'});}
window.addEventListener('hashchange',()=>render().catch(report));
app.addEventListener('click', async e=>{
 const target=e.target.closest('[data-route]');if(target)navigate(target.dataset.route);
 const stockClick=e.target.closest('[data-stock-action]');if(stockClick){await handleStockClick(stockClick,()=>render().catch(report));return;}
 const place=e.target.closest('[data-location-action]');if(place){await handleLocationClick(place,()=>render().catch(report));return;}
 const category=e.target.closest('[data-category-action]');if(category){await handleCategoryClick(category,()=>render().catch(report));return;}
 const catalog=e.target.closest('[data-catalog]');if(catalog){await handleCatalogClick(catalog,()=>render().catch(report));return;}
 const diagnostic=e.target.closest('#run-storage-check');if(!diagnostic)return;
 const result=document.getElementById('storage-test-result');if(!result)return;
 diagnostic.disabled=true;result.textContent='Schreib- und Lesetest läuft …';
 try{await runStorageDiagnostic();result.textContent='Erfolgreich: Testdatensatz geschrieben, gelesen und wieder entfernt. Dein tatsächlicher Bestand wurde nicht verändert.';result.className='diagnostic-result diagnostic-success';}
 catch(error){const safe=friendlyStorageError(error);result.textContent=`Fehler: ${safe.message} Backups werden erst mit V1.0 unterstützt.`;result.className='diagnostic-result diagnostic-error';}
 finally{diagnostic.disabled=false;}
});
app.addEventListener('submit',event=>{if(['stock-book-form','stock-threshold-form','stock-package-form'].includes(event.target.id)){event.preventDefault();handleStockSubmit(event.target,()=>render().catch(report));return;}if(['location-form','location-transfer-form','location-edit-form'].includes(event.target.id)){event.preventDefault();handleLocationSubmit(event.target,()=>render().catch(report));return;}if(event.target.id==='catalog-form'){event.preventDefault();handleCatalogSubmit(event.target,()=>render().catch(report));}else if(event.target.id==='category-new-form'){event.preventDefault();handleCategorySubmit(event.target);}});
app.addEventListener('error',event=>{if(event.target.matches?.('img.catalog-thumb')){event.target.outerHTML='<div class="catalog-thumb" aria-label="Kein gültiges Artikelfoto">📦</div>'; }},true);
app.addEventListener('input',handleCatalogInput);app.addEventListener('change',handleCatalogInput);app.addEventListener('change',handleLocationInput);
function report(err){
 console.error('Lagerhaus storage/rendering error',err);
 const safe=friendlyStorageError(err);
 main.innerHTML=`<section class="panel error-panel" role="alert"><h2>Speicherung nicht verfügbar</h2><p>${escapeHtml(safe.message)}</p><p>Bitte andere Lagerhaus-Tabs schließen, Speicherplatz und Browserberechtigungen prüfen. Browserdaten NICHT löschen; vollständige Backups werden in Version 1.0 eingeführt.</p><button class="secondary-btn" type="button" data-retry-render>Erneut versuchen</button></section>`;
}
app.addEventListener('click',e=>{if(e.target.closest('[data-retry-render]'))render().catch(report);});
window.addEventListener('lagerhaus:database-upgrade',()=>report(new Error('Die Datenbank wurde in einem anderen Tab aktualisiert. Bitte neu laden.')));
render().catch(report);
if('serviceWorker'in navigator){window.addEventListener('load',async()=>{try{await navigator.serviceWorker.register('./sw.js',{scope:'./'});}catch(err){console.warn('Offline-Modus nicht verfügbar',err);}});}
