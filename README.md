# Lagerhaus — V0.4.0 · Update U04

Offlinefähige, lokal speichernde Lagerverwaltung für **Privat und Arbeit** mit industriell-professioneller Oberfläche nach der festgelegten Designreferenz. Die interaktive isometrische **3D-Lageransicht** ist ausschließlich für den Bereich Lager/Lagerorte vorgesehen (geplant für U09).

## Neu mit U04 · Kategorien und Privat/Arbeit

1. **Drei Verwendungsbereiche:** Privat, Arbeit oder Gemeinsam. Die Artikelliste lässt sich nach Privat inkl. Gemeinsam, Arbeit inkl. Gemeinsam oder ausschließlich Gemeinsam filtern; gemeinsamer Bestand wird nicht dupliziert.
2. **Kategorien & Unterkategorien:** Zehn Startkategorien aus dem privaten/beruflichen Alltag; eigene Kategorien im Artikeldialog unter „Kategorien verwalten“ anlegen, hierarchisch zuordnen, nach oben/unten sortieren oder umbenennen. Bezeichnungen müssen eindeutig sein; kreisförmige Unterkategorien sind gesperrt.
3. **Artikeltypen:** Verbrauchsmaterial, wiederverwendbar, Gerät/Maschine und Lebensmittel/Getränk. Das MHD-Feld ist nur bei Lebensmittel/Getränk relevant; der Wartungsintervall nur bei Geräten/Maschinen. Das bestehende freie Artikelmerkmal „Typ“ bleibt als Text erhalten.
4. **Schlagwörter und Merkmale:** Bis zu 12 Tags und 10 frei definierte Merkmale („Name: Wert“) pro Artikel. Namen, Kategorien, Tag-Inhalte und Merkmalswerte sind über die Artikel-Suchleiste auffindbar.
5. **Migration und Datenintegrität:** Schema v2→v3 migriert vorhandene Kategorie-Namen in eindeutige Kategorie-IDs, ohne Bestände/Buchungen/Bilder zu löschen. Umbenennungen laufen atomar mit Änderung der sichtbaren Artikel-Kategorie; Stamm-IDs und Bestände bleiben identisch.

## Vorhandene Funktionen U01–U03

- PWA-Grundgerüst, dunkles responsives Design, lokale IndexedDB, Manifest/Service Worker/Offline-Shell.
- Schnellerfassung mit Artikelname, Kategorie, Lagerort, Menge, Privat/Arbeit/Gemeinsam; optionale Hersteller-/Marken-/Modell-/Seriennummernfelder.
- Sichere Messumrechnung ml/l, g/kg; lokale Produktbilder; Bearbeiten, Kopieren, Archivieren mit Bewegungsprotokoll.
- Automatische Tests für Datenspeicherung, Rollback, U03-Regressionen und Kategorien-Migration.

## Installation und Bedienung

Repository: https://github.com/Darkman0607/Lagerhaus

GitHub Pages unter **Settings → Pages → Deploy from a branch → main / (root)** einstellen. Die PWA unter https://darkman0607.github.io/Lagerhaus/ in Android Chrome öffnen und über das Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“ auswählen. Installation und vollständiges Offline-Neustarten müssen **auf dem echten Android-Gerät** separat geprüft werden.

Zum lokalen Testen `python -m http.server 8000` im App-Ordner starten und `http://localhost:8000` öffnen. `file://` unterstützt den Service Worker nicht. `npm test` führt sämtliche Node-/Fake-IndexedDB-Tests aus. Ein kontrollierter Chromium-End-to-End-Test war in der Entwicklungsumgebung aufgrund einer Administrator-Netzwerksperre nicht möglich; Android-Chrome- und GitHub-Pages-Livetest sind offen.

## Sicherheits- und Funktionsgrenzen

**Noch keine Backup-/Restore-Funktion vor U10.** Die Daten liegen ausschließlich im lokalen Browserprofil; das Löschen von Website-/Browserdaten kann alle Artikel und Fotos unwiederbringlich entfernen. Kein Konto, keine Cloud-Synchronisation. Vor der Nutzung mit wichtigen Echtbeständen muss die Datensicherung nachgerüstet und am Gerät abgenommen werden.

Die 3D-Lageransicht folgt erst U09; U05 bringt die Lagerorthierarchie, U06 Bestandsumbuchungen, U07 weitere Listenfilter. Bestehende Mengen dürfen nicht still verändert werden. Die Kategorieverwaltung arbeitet deshalb nur auf Kategorie- und Artikelstammdaten, nicht auf Bewegungen oder Ortsbeständen.
