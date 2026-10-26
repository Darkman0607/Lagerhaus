import { icon } from '../core/icons.js';
import { repository } from '../data/store.js';
const tools=[
 ['Wartung','wrench','Geräte und geplante Wartungen','V1.2'],
 ['Statistik','chart','Kennzahlen und Bestandsverlauf','V1.4'],
 ['Einstellungen','settings','Darstellung und Datenverwaltung','schrittweise'],
 ['Sicherung','shield','Vollständiges Backup und Wiederherstellung','V1.0'],
];
export async function moreView(){
 const health=await repository.health();
 return `<section class="page-heading"><div><p class="eyebrow">SYSTEM / WEITERE BEREICHE</p><h1>Mehr</h1><p>Verwaltung, Wartung und Informationen zur App.</p></div></section>
 <section class="tools-grid">${tools.map(([label,ico,sub,ver])=>`<article class="panel tool-card"><div class="tool-icon">${icon(ico,25)}</div><h2>${label}</h2><p>${sub}</p><span class="chip quiet">${ver}</span></article>`).join('')}</section>
 <article class="panel data-status-panel"><div class="panel-heading"><div><span class="eyebrow">DATENSCHUTZ / LOKAL</span><h2>Speicherdiagnose</h2></div><span class="chip success">IndexedDB · Schema ${health.version}</span></div>
 <p>Speicherung ausschließlich in diesem Browserprofil. ${health.stores.length} getrennte Datenbereiche: Artikel, Lagerorte, Bestände, Buchungen, Medien, Einkäufe, Protokoll, Kategorien und Systemdaten.</p>
 <div class="storage-detail"><span>${icon('shield',17)} Keine Cloud-Synchronisierung</span><span>${icon('box',17)} Daten bleiben nach normalem Neustart im Profil</span></div>
 <button class="secondary-btn" id="run-storage-check" type="button">${icon('wrench',17)} Schreiben und Lesen testen</button><div id="storage-test-result" class="diagnostic-result" role="status" aria-live="polite">Keine Prüfung durchgeführt.</div>
 <p class="safety-tip">Hinweis: Browser- oder Websitedaten nicht löschen. Ein vollständiges Backup/Restore wird erst für V1.0 eingeführt. Wenn der Browser Speicherzugriff verweigert, Chrome-Berechtigungen und freien Speicherplatz prüfen.</p></article>
 <article class="panel about-panel"><div><span class="eyebrow">SYSTEMSTATUS</span><h2>Lagerhaus V0.4.0</h2><p>Lokale Datenbank mit Schema-Upgrade, UUIDs, atomaren Buchungen und Änderungsprotokoll. Artikelverwaltung mit Bereichen, Kategorien, Artikeltypen und Tags (U04).</p></div><div class="about-tags"><span>${icon('shield',17)} Kein Online-Konto</span><span>${icon('wifi',17)} Offline nach Erstaufruf</span></div></article>`;
}
export async function runStorageDiagnostic(){return repository.checkWriteAccess();}
