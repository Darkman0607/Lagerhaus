# Lagerhaus — V0.7.0 · Update U07

U07 baut auf V0.6.0 auf: Desktop-Tabellen und mobile Kacheln, Wortsuche nach Feldern einschließlich stabiler Artikel-ID, kombinierbare Filter, persistente Sortierung und Favoriten, Artikeldetail-Dialog mit Allgemein/Bilder/Verlauf und eine prüfbare Bestandsbuchung.

- Filter: Bereich, Kategorie (auch Unterkategorien), Ort, Typ, Ampel, Änderung innerhalb von 7/30 Tagen, Favorit.
- Suche: Tokenbasiert und ohne Groß-/Kleinschreibung; unterstützt Name, Marke, Modell, Tags, Seriennummer, Standorte und ART-Kurzreferenz.
- Artikelreferenz `ART-XXXXXXXX` wird aus den ersten acht Zeichen der unveränderlichen UUID abgeleitet. Keine neue Geschäftsvorgangsnummer.
- Sortierung und Ansicht werden lokal via Browser-Lokalspeicher gespeichert (funktioniert ohne Anmeldung); bei blockiertem Speicher bleibt der Zustand bis zum erneuten Öffnen erhalten.
- Favoriten werden über eine transaktionale Änderung des Stammdatensatzes gesetzt; kein Bestandsverlust.
- Bestandsänderungen aus der Detailansicht erzeugen echte Buchungen mit Bewegungsprotokoll, nicht nur visuelle Mengenkorrekturen.
- Keine Änderungen am Datenbankschema (weiterhin Schema 5). Eine bestehende V0.6.0-Datenbank wird unverändert verwendet.
- `npm test`: acht Testsuiten. Android/Pages/PWA-Installation und Offline-Neustart sind weiterhin am echten Gerät abzunehmen.
- Vor U10 keine Browserdaten löschen! Vollständiges Backup/Restore ist noch nicht vorhanden.

## Bisherige Funktionen

## Neu in U06 · Fünf Funktionen

1. **U06-F01 Ein-/Ausbuchungen:** Wareneingang, Entnahme und Verbrauch mit Artikel, konkretem Lagerort, positiver Menge, kompatibler Einheit und optionaler Notiz. Einheitentausch wie `0,5 l ↔ 500 ml` wird exakt umgerechnet; negative Ortsbestände sind untersagt. Eingabefeld für Dezimalwerte bitte mit der vom Browser akzeptierten Schreibweise benutzen.
2. **U06-F02 Inventurkorrektur:** Tatsächlich gezählte **neue Gesamtmenge** am Ort und obligatorischer Grund. Alte Menge, neue Menge, Zeit, Quelle und Buchungs-ID werden in einer neuen Bewegung gespeichert. Es erfolgt keine stille Überschreibung.
3. **U06-F03 Bestandsampel:** Grün ausreichend, Orange bei positivem Bestand bis einschließlich Mindestgrenze, Rot bei Nullbestand. Grenzwert kann pro Artikel und als spezifische Ausnahme am Lagerort gespeichert werden. Artikel ohne bisherige Bestandszeile zeigen am primären Lagerort Nullbestand rot.
4. **U06-F04 Storno:** Kontrollierte Gegenbuchung mit `undoOf`-Verweis und Status am Original. Verhindert doppeltes Stornieren und einen negativen Zielbestand. Alte U01–U05-Buchungen bleiben sichtbar, werden aber nicht durch U06-Stornos freigegeben; Umlagerungen werden weiterhin im U05-Bereich rückgängig gemacht.
5. **U06-F05 Gebindeaufteilung:** Für Verbrauchsmaterial und Lebensmittel können ganze geschlossene Gebinde und die Menge **eines** angebrochenen Gebindes am Ort erfasst werden. Voraussetzung: Packungsinhalt und Artikeleinheit sind kompatibel (z. B. 750 ml zu ml). `geschlossene × Packungsinhalt + offen` ergibt einen **einzigen** Ortsbestand, nicht zwei konkurrierende Mengenzähler. Geschätzte Füllstände sind klar markiert; nach normaler Buchung wird die Gebindeaufteilung als Schätzung weitergeführt. Unterschiedliche offene Packungen werden derzeit nicht einzeln verwaltet.

### Bedienung

In **Lager → Bestandsführung · Buchungen** sind die drei aufklappbaren Bereiche für Buchungen, Mindestmengen und Gebindebestand; darunter Ampel, Ortsbestände und Historie. Für bestehende Artikel dürfen **Mengen nicht im Artikel-Stammdatenformular** geändert werden; dafür die Buchungsmaske mit dem nachvollziehbaren Buchungsgrund verwenden. Die übrigen Artikelstammdaten sind weiterhin editierbar.

### Verifikation

- `npm test` führt **sieben** Testsuiten U01–U06 durch, inklusive Fake-IndexedDB, Migration Schema 4 → 5, negativer Buchungen, 1× Storno, Grenzwerten, Einheitentransfer und Fotoerhalt.
- Alle JavaScript-Module mit `node --check` kontrollieren.
- Es gibt noch **keinen bestätigten realen Chromium-, Android-, GitHub-Pages- oder Offline-Neustart-Test**. Der lokale Chromium-Versuch wurde durch `net::ERR_BLOCKED_BY_ADMINISTRATOR` blockiert. Android-Touch, Installation und GitHub Pages müssen am Gerät abgenommen werden.
- Die vollständige Backup-/Restore-Funktion folgt erst mit **U10**. Website-/Browserdaten **nicht löschen**: das könnte Bestände und Artikelbilder unwiederbringlich zerstören.

### GitHub und Installation

Repository: https://github.com/Darkman0607/Lagerhaus  
Pages: https://darkman0607.github.io/Lagerhaus/ (nur wenn Pages in GitHub unter Settings → Pages → Deploy from branch → main / root aktiviert wurde). Chrome auf Android: Menü → „App installieren“ oder „Zum Startbildschirm hinzufügen“.

**U07 folgt:** Artikelübersicht, Suche, Filter und Sortierung. U09: 3D-Lageransicht. U10: erster stabiler Release mit überprüfter Backup- und Wiederherstellung.
