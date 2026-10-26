import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/escape.js';
import { repository } from '../data/store.js';
const metric=(symbol,name,value,tone,subtitle)=>`<article class="metric"><div class="metric-top"><span class="metric-symbol ${tone}">${icon(symbol,21)}</span><span class="metric-label">${name}</span></div><div class="metric-value">${value}</div><div class="metric-description">${subtitle}</div></article>`;
function activityLabel(entry){
 const names={'article-created':'Artikel angelegt','location-created':'Lagerort angelegt','stock-adjusted':'Bestand gebucht'};
 return names[entry.type]||'Änderung protokolliert';
}
export async function dashboardView(){
 const [s,activity]=await Promise.all([repository.summary(),repository.recentActivity(5)]);
 const hasArticles=s.articles>0;
 const history=activity.length?`<div class="activity-list">${activity.map(entry=>`<div class="activity-item"><strong>${activityLabel(entry)}</strong><small>${escapeHtml(entry.name||entry.source||'Lokale Aktion')} · ${new Date(entry.createdAt).toLocaleString('de-AT')}</small></div>`).join('')}</div>`:`<div class="empty-panel">${icon('clipboard',30)}<h3>Keine Aktivitäten vorhanden</h3><p>Artikeländerungen und Bestandsbuchungen werden hier automatisch protokolliert.</p></div>`;
 return `<section class="page-heading"><div><p class="eyebrow">ÜBERBLICK / BESTAND</p><h1>Dashboard</h1><p>Alles Wichtige für dein Lager auf einen Blick.</p></div><button class="primary-btn" data-route="articles">${icon('plus',18)} Artikel erfassen </button></section>
 <section class="metrics-grid" aria-label="Lagerkennzahlen">
 ${metric('box','Artikel gesamt',s.articles,'green',hasArticles?'Aus lokaler Datenbank':'Noch keine Artikel angelegt')}
 ${metric('trend','Niedriger Bestand',s.lowStock,'amber',s.lowStock?'Unter Mindestbestand':'Keine Warnungen')}
 ${metric('alert','Fehlbestand',s.outOfStock,'red',s.outOfStock?'Mindestbestand unterschritten':'Keine fehlenden Artikel')}
 ${metric('shopping','Offener Einkauf',s.openPurchases,'blue',s.openPurchases?'Einkaufspositionen offen':'Keine Einkaufspositionen')}
 </section>
 <section class="dashboard-grid">
   <article class="panel stock-panel"><div class="panel-heading"><div><span class="eyebrow">LAGERANALYSE</span><h2>Bestandsverteilung</h2></div><span class="chip quiet">Lokale Daten</span></div><div class="blank-analytics"><div class="ring-empty"><span>${s.articles}<strong>Artikel</strong></span></div><div><h3>${hasArticles?'Artikelbestand erfasst':'Noch keine Bestandsdaten'}</h3><p>${hasArticles?'Detaildiagramme nach Kategorien folgen in einer späteren Version.':'Sobald du Artikel anlegst, erscheint hier die Bestandsverteilung nach Kategorien.'}</p><button class="text-action" data-route="articles">Zu Artikeln ${icon('arrow',16)}</button></div></div></article>
   <article class="panel"><div class="panel-heading"><div><span class="eyebrow">PROTOKOLL</span><h2>Letzte Aktivitäten</h2></div>${icon('clock',19)}</div>${history}</article>
 </section>
 <section class="quick-panel"><div class="quick-copy"><span class="chip success">V0.5.0 · Lagerorte</span><h2>Dein Lager. Übersichtlich erfasst.</h2><p>Artikel können an mehreren hierarchischen Lagerorten liegen. Bestände bleiben beim Umlagern erhalten; der 3D-Lagerplan folgt in Update 9.</p></div><div class="quick-buttons"><button class="secondary-btn" data-route="warehouse">${icon('warehouse',18)} Lager ansehen</button><button class="secondary-btn" data-route="more">${icon('shield',18)} Speicher prüfen</button></div></section>`;
}
