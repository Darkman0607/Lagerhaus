import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/escape.js';
import { repository } from '../data/store.js';
export async function articlesView(){
 const articles=await repository.articles();
 const content=articles.length?
 `<div class="readonly-list">${articles.map(a=>`<div class="readonly-item"><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.unit||'Stück')} · ${escapeHtml(a.id)}</small></div>`).join('')}</div>`:
 `<div class="large-empty"><span class="large-empty-icon">${icon('box',36)}</span><h2>Dein Artikellager ist noch leer</h2><p>In Update 3 kannst du Artikel erfassen. Die lokale Datenbank ist bereits vorbereitet.</p><span class="planned-tag">Artikelanlage geplant für V0.3.0</span></div>`;
 return `<section class="page-heading"><div><p class="eyebrow">STAMMDATEN / ARTIKEL</p><h1>Artikel</h1><p>Dein zentraler Artikelbestand – privat und beruflich.</p></div><span class="chip">Erfassung · V0.3</span></section>
 <article class="panel"><div class="toolbar"><div class="search-look">${icon('search',19)} Artikel suchen <span>Ab Update 7</span></div><span class="chip quiet">${articles.length} Artikel</span></div><div class="table-head"><span>ARTIKEL</span><span>KATEGORIE</span><span>BESTAND</span><span>LAGERORT</span></div>${content}</article>`;
}
