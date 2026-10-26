import { icon } from '../core/icons.js';
import { repository } from '../data/store.js';

const metric=(symbol, name, value, tone, subtitle)=>`<article class="metric"><div class="metric-top"><span class="metric-symbol ${tone}">${icon(symbol,21)}</span><span class="metric-label">${name}</span></div><div class="metric-value">${value}</div><div class="metric-description">${subtitle}</div></article>`;
export async function dashboardView(){
 const s=await repository.summary();
 return `<section class="page-heading"><div><p class="eyebrow">ÜBERBLICK / BESTAND</p><h1>Dashboard</h1><p>Alles Wichtige für dein Lager auf einen Blick.</p></div><button class="primary-btn" data-route="articles">${icon('plus',18)} Artikel erfassen <span class="pill-mini">ab V0.3</span></button></section>
 <section class="metrics-grid" aria-label="Lagerkennzahlen">
 ${metric('box','Artikel gesamt',s.articles,'green','Noch keine Artikel angelegt')}
 ${metric('trend','Niedriger Bestand',s.lowStock,'amber','Keine Warnungen')}
 ${metric('alert','Fehlbestand',s.outOfStock,'red','Keine fehlenden Artikel')}
 ${metric('shopping','Offener Einkauf',s.openPurchases,'blue','Keine Einkaufspositionen')}
 </section>
 <section class="dashboard-grid">
   <article class="panel stock-panel"><div class="panel-heading"><div><span class="eyebrow">LAGERANALYSE</span><h2>Bestandsverteilung</h2></div><span class="chip quiet">Live-Daten</span></div><div class="blank-analytics"><div class="ring-empty"><span>0<strong>Artikel</strong></span></div><div><h3>Noch keine Bestandsdaten</h3><p>Sobald du Artikel anlegst, erscheint hier die Bestandsverteilung nach Kategorien.</p><button class="text-action" data-route="articles">Zu Artikeln ${icon('arrow',16)}</button></div></div></article>
   <article class="panel"><div class="panel-heading"><div><span class="eyebrow">PROTOKOLL</span><h2>Letzte Aktivitäten</h2></div>${icon('clock',19)}</div><div class="empty-panel">${icon('clipboard',30)}<h3>Keine Aktivitäten vorhanden</h3><p>Änderungen an Artikeln und Beständen werden hier später angezeigt.</p></div></article>
 </section>
 <section class="quick-panel"><div class="quick-copy"><span class="chip success">V0.1.0 · Grundgerüst</span><h2>Dein Lager. Klar organisiert.</h2><p>Die Arbeitsbereiche sind vorbereitet. Bestandsführung, Datenspeicherung und der interaktive 3D-Lagerplan werden schrittweise ergänzt.</p></div><div class="quick-buttons"><button class="secondary-btn" data-route="warehouse">${icon('warehouse',18)} Lager ansehen</button><button class="secondary-btn" data-route="shopping">${icon('shopping',18)} Einkauf öffnen</button></div></section>`;
}
