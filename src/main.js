import { icon } from './core/icons.js';
import { routes,routeFromHash,navigate } from './core/router.js';
import { dashboardView } from './views/dashboard.js';
import { warehouseView } from './views/warehouse.js';
import { articlesView } from './views/articles.js';
import { shoppingView } from './views/shopping.js';
import { moreView } from './views/more.js';

const app=document.getElementById('app');
const views={dashboard:dashboardView, warehouse:warehouseView, articles:articlesView, shopping:shoppingView, more:moreView};
let run=0;
const navItems=Object.entries(routes).map(([key,item])=>`<button class="nav-item" data-route="${key}" data-nav="${key}" aria-label="${item.label}">${icon(item.icon,20)}<span>${item.label}</span></button>`).join('');
app.innerHTML=`<aside class="sidebar"><div class="brand"><span class="brand-mark"><span class="brand-tower"></span></span><div><strong>Lager<span>haus</span></strong><small>ORDNUNG. IM SYSTEM.</small></div></div><div class="side-group-title">ARBEITSPLATZ</div><nav class="side-nav" aria-label="Hauptnavigation">${navItems}</nav><div class="sidebar-bottom"><div class="sidebar-status"><span class="status-pulse"></span><div><strong>System bereit</strong><small>Version 0.1.0</small></div></div><span class="sidebar-meta">LAGERHAUS / 2026</span></div></aside>
 <div class="main-column"><header class="topbar"><div class="topbar-left"><span class="topbar-section">LAGERHAUS <span>/</span> <span id="topbar-current">ÜBERSICHT</span></span></div><div class="topbar-right"><span class="topbar-app-tag">PRIVATE · WORK</span><span class="topbar-online" id="network-indicator" aria-live="polite"></span><span class="avatar" aria-label="Lokale App">LH</span></div></header>
 <main id="main-content" tabindex="-1"></main><footer class="desktop-footer">LAGERHAUS <span>•</span> PROFESSIONELLE LAGER- UND INVENTARVERWALTUNG <span class="footer-version">V0.1.0</span></footer></div>
 <nav class="bottom-nav" aria-label="Mobile Hauptnavigation">${navItems}</nav>
 <div id="toast" role="status" aria-live="polite"></div>`;
const main=document.getElementById('main-content');
function networkUpdate(){ const online=navigator.onLine;const el=document.getElementById('network-indicator'); el.innerHTML=`<span class="status-pulse ${online?'':'offline'}"></span>${online?'Online':'Offline'}`;}
window.addEventListener('online',networkUpdate);window.addEventListener('offline',networkUpdate);networkUpdate();
async function render(){const seq=++run;const route=routeFromHash();document.querySelectorAll('[data-nav]').forEach(b=>{const active=b.dataset.nav===route;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});document.getElementById('topbar-current').textContent=routes[route].eyebrow.toUpperCase();document.title=`Lagerhaus | ${routes[route].label}`;const content=await views[route]();if(seq!==run)return;main.innerHTML=content;window.scrollTo({top:0,behavior:'instant'});}
window.addEventListener('hashchange',()=>render().catch(report));
app.addEventListener('click', e=>{const target=e.target.closest('[data-route]');if(target)navigate(target.dataset.route);});
function report(err){console.error('Lagerhaus rendering error',err);main.innerHTML='<div class="panel error-panel">Die Ansicht konnte nicht geladen werden. Bitte die Seite neu laden.</div>';}
render().catch(report);
if('serviceWorker'in navigator){window.addEventListener('load',async()=>{try{await navigator.serviceWorker.register('./sw.js',{scope:'./'});}catch(err){console.warn('Offline-Modus nicht verfügbar',err);}});}
