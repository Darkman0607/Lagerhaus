# Lagerhaus — V0.3.0 · Update U03

Offlinefähige, lokal speichernde Lagerverwaltung für **Privat und Arbeit**, entworfen nach der im Masterplan festgelegten Industrie-Designreferenz. Die grafische 3D-Lageransicht ist **ausschließlich für das Modul Lager/Lagerorte** vorgesehen und gehört zu einem späteren Update.

## Neu mit U03 · Artikelstamm

1. **Schnellerfassung:** Artikelname, Kategorie, Lagerort und Anfangsbestand; Bereich Privat/Arbeit/Gemeinsam wird vorbelegt. Bestehende Lagerorte auswählen oder einfachen neuen Namen anlegen. Eine umfassende Lagerortverwaltung folgt erst mit U05.
2. **Weitere Details:** Marke, Modell, Typ, Hersteller, Seriennummer, Notizen, Farbe, Zustand und Favoriten-Kennzeichnung sind optional.
3. **Einheiten und Packungsinhalt:** Stück, Paar, Packung, ml, l, g, kg, m. Für Gebinde kann ein separater Inhalt gespeichert werden, etwa Packung 750 ml. Der integrierte Rechner wandelt ausschließlich kompatible Messeinheiten um (1 l = 1000 ml); Stück, Paar und Packung werden nicht vermischt.
4. **Artikelfotos:** JPG, PNG oder WEBP bis 5 MB. Lokale Speicherung in IndexedDB, Foto ersetzen/entfernen. Ohne Bild erscheint eine neutrale Kachel. Beschädigte Fotos blockieren den Artikel nicht.
5. **Bearbeiten, Kopieren, Löschen:** Bearbeiten inklusive Bestandskorrektur mit Buchungsprotokoll. Duplikate erhalten neue UUID und starten mit Bestand 0. Vor dem Löschen erscheint eine Nachfrage mit Artikelname. Ein Artikel mit Bestand > 0 kann nicht gelöscht werden. Mit vorhandener Buchungshistorie wird ein Artikel bei Bestand 0 aus Beweissicherungsgründen archiviert und kann wiederhergestellt werden. Ohne Buchungshistorie wird er endgültig gelöscht.

Artikel und Anfangsbestand werden innerhalb **einer IndexedDB-Transaktion** angelegt. Die bestehende Datenbankversion **2 bleibt unverändert**; ältere Lagerhaus-Daten werden nicht gelöscht. Die Kachelwerte auf dem Dashboard stammen weiterhin aus dem echten lokalen Datenspeicher.

## Bereits enthalten (U01/U02)

- Modulares Projekt, responsive Seitenleiste/Bottom-Navigation, dunkles Industrie-Design.
- Progressive Web App mit Manifest, PNG-Icons und Offline-App-Shell.
- IndexedDB mit acht Stores, UUIDs, Buchungs- und Änderungsprotokoll, atomare Bestandsbuchungen und Schreibdiagnose unter „Mehr“.

## Installation auf Android

1. GitHub Pages im Repository unter **Settings → Pages → Deploy from a branch → main / (root)** einstellen.
2. `https://darkman0607.github.io/Lagerhaus/` in Google Chrome öffnen.
3. Menü → „App installieren“ beziehungsweise „Zum Startbildschirm hinzufügen“ (browserabhängig).
4. Für den Offline-Betrieb zunächst mit Netzwerk öffnen und das vollständige Laden abwarten, anschließend offline neu starten und ausprobieren.

Zum lokalen Start (sicherer `localhost`-Kontext): `python -m http.server 8000` im App-Ordner und `http://localhost:8000` öffnen. `file://` ist nicht für Service Worker geeignet.

## Testen

`npm test` führt die vorhandenen U01/U02-Regressionen sowie zusätzliche U03-Verhaltenstests mit simulierter IndexedDB aus. Die Tests decken Pflichtfelder, Kategorien, Einheitentrennung, Bilder, Lagerort-Wiederverwendung, Bestandskorrekturen, Transaktionsabbruch, Duplikate, Archivierung und Wiederherstellung ab. Die Simulation ist **kein Nachweis** für echtes Android-Chrome, Installation oder Browser-Persistenz.

## Wichtige Grenzen

- **Keine Sicherung/Import-/Restore-Funktion vor Update U10.** Die Daten liegen allein im lokalen Browserprofil des Geräts. Das Löschen von Website- oder Browserdaten kann die Artikel und Fotos dauerhaft entfernen. Kein automatischer Cloud-Abgleich.
- Bestände mit mehreren realen Lagerorten lassen sich in U03 nicht über den einfachen Artikel-Editor umverteilen; die gezielte Lagerort-/Umbuchungsverwaltung ist für U05 geplant.
- Eine vollständige Kategorienverwaltung (U04), Suche/Filterausbau (U07), 3D-Lager (U09) und Backup (U10) folgen gemäß Checkliste.
- Quellcode auf GitHub enthält **keine privaten Lager- oder Fotodaten**.
