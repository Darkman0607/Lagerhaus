import { icon } from '../core/icons.js';
const tools = [
 ['Wartung','wrench','Geräte und geplante Wartungen','V1.2'],
 ['Statistik','chart','Kennzahlen und Bestandsverlauf','V1.4'],
 ['Einstellungen','settings','Darstellung und Datenverwaltung','schrittweise'],
 ['Sicherung','shield','Lokale Backup- und Wiederherstellung','V1.0'],
];
export function moreView(){return `<section class="page-heading"><div><p class="eyebrow">SYSTEM / WEITERE BEREICHE</p><h1>Mehr</h1><p>Verwaltung, Wartung und Informationen zur App.</p></div></section><section class="tools-grid">${tools.map(([label,ico,sub,ver])=>`<article class="panel tool-card"><div class="tool-icon">${icon(ico,25)}</div><h2>${label}</h2><p>${sub}</p><span class="chip quiet">${ver}</span></article>`).join('')}</section><article class="panel about-panel"><div><span class="eyebrow">SYSTEMSTATUS</span><h2>Lagerhaus V0.1.0</h2><p>Installierbares Offline-Grundgerüst. Es werden in dieser Version keine Bestandsdaten erfasst oder übertragen.</p></div><div class="about-tags"><span>${icon('shield',17)} Keine Cloud-Verbindung</span><span>${icon('wifi',17)} Offline-Shell nach Erstaufruf</span></div></article>`;}
