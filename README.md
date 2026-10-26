# Lagerhaus – U12 · V1.2.0-beta.1 (26.10.2026)

**Status:** U12 ist eine testbare Vorabversion. Verifiziertes Android-/Chrome-/GitHub-Pages-Deployment steht weiterhin aus. Alle Daten bleiben lokal im jeweiligen Browserprofil; keine Live-Synchronisierung.

## Fünf U12-Funktionen

1. **Einzelgeräteprofile** – beliebig viele physische Geräte pro Geräteartikel, eigene Seriennummer, Zustand, Gerätetyp, Kaufdatum, Lagerort, Betriebsstunden, Foto und Notizen.
2. **Wartungsintervalle** – separate Pläne nach Kalendertagen und/oder Nutzungsstunden mit erster Fälligkeit. Angaben sind individuelle Erinnerungen, keine rechtlich verbindlichen Prüfpflichten.
3. **Wartungshistorie** – Arbeitsart, Datum, Betriebsstunden, Kosten, Foto und Notiz; erfolgreicher Abschluss verschiebt wiederkehrende Fälligkeiten.
4. **Ersatzteile und Verbrauchsartikel** – manuelle Verknüpfung mit vorhandenen Lagerartikeln und Anzeige des tatsächlichen Bestands; **keine automatische Abbuchung oder technische Kompatibilitätsgarantie**.
5. **Wartungsübersicht mit Ampeln** – fällig, bald fällig, im Zeitplan; Bereichs- und Gerätetypfilter. Erledigte Einträge erscheinen in Historie und Kennzahlen.

## Bedienung

Im Seiten- und Mobilmenü **Wartung** öffnen. Geräteartikel zunächst unter **Artikel** als **Gerät** erfassen, dann in **Wartung → Neues Einzelgerät** ein eigenes Profil anlegen. Jedes physische Gerät einzeln erfassen. Wartung in **Wartungsintervalle** planen, danach unter **Erledigte Wartung dokumentieren** bestätigen.

## Daten & Migration

IndexedDB Schema 6 → 7: vier additive Stores (`devices`, `maintenancePlans`, `maintenanceEvents`, `deviceParts`); vorhandene Bestände werden nicht absichtlich gelöscht. Backups aus U10 (Schema 5), U11 (Schema 6) und U12 (Schema 7) werden akzeptiert, einschließlich lokal gespeicherter Fotos. Vor Update unter Mehr eine Kopie exportieren und den tatsächlichen Download überprüfen; Browserdaten **nicht löschen**. Backup ist **nicht verschlüsselt**. Fehlende echte Installations-, Touch- und Offline-Endgerätenachweise verhindern weiterhin die stabile Freigabe.

## Tests

`npm test` führt 13 automatische Testsuiten inklusive U12-Funktionen und Backup-Regressionen aus. Ein Fake-IndexedDB-Test ersetzt **keinen** echten Chrome-Test.

---

## Die fünf U09-Funktionen
1. **U09-F01 – 3D-Grundszene:** stilisiertes Lager mit Wänden, Bodenraster, plastischen Regalen/Boxen und klaren Callouts statt vollflächiger 3D-Oberflächen in anderen App-Modulen.
2. **U09-F02 – Anklickbare Lagerorte:** Regal/Raum/Box auswählen, Orts-Pfad, echte Artikelanzahl und tatsächliche Artikelpositionen im Detailbereich sehen; direkte Verknüpfung in die Artikelliste.
3. **U09-F03 – Steuerung:** 360° Rotation durch Wischbewegung oder +/-30°-Schaltflächen, Zwei-Finger-Zoom/Schieben, Mausrad-Zoom, Verschiebungsbuttons, Kamera zurücksetzen. Zoom und Pan begrenzt. Android-Gesten noch nicht auf echtem Gerät abgenommen.
4. **U09-F04 – Warnungen:** fehlend (Bestandszeile mit Menge 0), niedrig (Menge > 0 mit bestehender Bestandswarnung), sonst grün. Zahlen kommen aus dem gleichen `locationOverview()` wie die Lagerkarten; keine zusätzlichen Scheindaten.
5. **U09-F05 – 2D-Plan/Liste:** gleicher Datenbestand für Ansichten 3D, 2D und vollständige Liste. Die Szene beschränkt die Geometrie aus Performancegründen auf 28 Orte und die Callouts auf 10; alle Orte bleiben in der Liste verfügbar.

**Tests:** `npm test` (zehn Suites inkl. U09) und `node --check` bestanden. Statische SVG-Bildprüfung durchgeführt. **Offen:** echter Chromium-Websiteaufruf (`ERR_BLOCKED_BY_ADMINISTRATOR` in der Umgebung), Android-Chrome/Touch/PWA/Offline-Wiederanlauf und tatsächlicher GitHub-Pages-UI-Check. Datenschema bleibt Version 5; keine Migration, keine Bestandsdaten beim Release in der ZIP. Vollbackup erst für U10 vorgesehen – Browserdaten keinesfalls löschen.

---

# Lagerhaus — V0.8.0 · Update U08

U08 setzt das Einkaufspanel nach der verbindlichen Designreferenz um. Dunkles industrielles Layout, smaragdgrüne Aktionen, übersichtliche Liste, Status- und Prioritätsfilter. **Die 3D-Lageransicht ist separat für U09 geplant.**

### Fünf Funktionen U08
1. **Manuelle Einkaufsliste:** Lagerartikel oder freie Positionen mit Menge und Einheit; freie Positionen benötigen keinen Lagerartikel.
2. **Nachkauf-Vorschläge:** Nur Artikel mit `minQuantity > 0` und Istbestand unter Grenzwert; durch vorhandene offene Positionen entdoppelt. Vorschläge selbst buchen keinen Einkauf.
3. **Privat/Arbeit, Geschäft, Priorität:** Dringend/Normal/Später, Filter, Suchfeld, editierbare Positionen.
4. **Gekauft = Lagerzugang:** Dialog mit tatsächlicher Menge, Einheit, optional ganzen Gebinden und Zielort. Eine einzige IndexedDB-Transaktion speichert Wareneingang **und** erledigte Einkaufsposition; die Buchung trägt `purchaseId`. Wiederholte Bestätigungen werden verweigert. Freie Positionen ändern den Lagerbestand nicht.
5. **Ändern, wieder öffnen, archivieren:** Ein „Gekauft“ lässt sich wieder öffnen; die Eingangsbuchung wird nur bei ausreichendem aktuellem Bestand als getrennte Gegenbuchung storniert. Andernfalls bleibt die Position erledigt und eine konkrete Warnung erscheint. Archivierte Einträge bleiben in der Historie.

**Wichtig:** Kein Datenbank-Schemasprung (weiterhin Schema 5); keine Cloud-Verbindung, keine Demo-Bestände. `npm test` umfasst neun Prüfskripte, einschließlich U08. Echte Android-/Offline-/GitHub-Pages-Prüfung weiterhin separat. Vor U10 existiert noch kein zuverlässiges Vollbackup. Bitte Browserdaten **nicht löschen**.

---

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

**U07 ist umgesetzt:** Artikelübersicht, Suche, Filter und Sortierung. U09: 3D-Lageransicht. U10: erster stabiler Release mit überprüfter Backup- und Wiederherstellung.


## U10 Release Candidate · V1.0.0-rc.1

Das Projekt enthält jetzt eine **vollständige lokale Datensicherung** unter **Mehr → Backup herunterladen**. Der JSON-Export umfasst alle neun IndexedDB-Datenbereiche, einschließlich Medien und Bild-Bytes. SHA-256 erkennt nachträgliche Änderungen; es handelt sich **nicht** um eine verschlüsselte Datei. Dateien daher geschützt aufbewahren. Bevor du Browserdaten löschst, exportiere und prüfe einen Backup-Download.

**Import:** Unter Mehr die `.json`-Datei auswählen. Daten und Checksumme werden vor dem Import geprüft. Anschließend eine neue Sicherheitskopie des aktuell gespeicherten Bestands herunterladen und deren Speicherung ausdrücklich bestätigen; erst danach ist Restore freigegeben. Alle Stores werden in **einer** IndexedDB-Transaktion ersetzt. Ein fehlschlagender Import darf keine Teildaten übernehmen. Der Import ersetzt vollständig, er führt Daten nicht zusammen. Exportdateien sind auf 150 MB begrenzt. Foto- und Lagerdaten bleiben lokal.

**Ersteinrichtung:** Standardbereich Privat / Arbeit / Gemeinsam und optionalen Lagerort festlegen. Keine erzwungenen Demoartikel; neues Lager bleibt leer nutzbar. **Updates:** Im Menü Mehr können Service-Worker-Updates geprüft und bewusst aktiviert werden. Bei App-Wechsel bleiben die IndexedDB-Stores bestehen, sofern Nutzer/Brower sie nicht separat löschen.

**QA-Status:** elf automatisierte Node-Testsuiten und Syntaxkontrolle bestanden. Die reale lokale Chromium-Ausführung wurde mit `net::ERR_BLOCKED_BY_ADMINISTRATOR` blockiert. Deshalb sind Live-GitHub-Pages, echte Android-Bedienung, PWA-Installation, Offline-Neustart und ein echter Browser-Backup/Restore-Durchlauf **noch offen**. Version `1.0.0-rc.1` ist ausdrücklich eine **Vorabversion**, keine freigegebene stabile 1.0.0.
