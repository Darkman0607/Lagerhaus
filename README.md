# Lagerhaus – V0.1.0 (Update U01)

Professionelles Grundgerüst einer **privaten und beruflichen Lagerverwaltungs-PWA**. Design nach der verbindlichen, im Masterplan eingebetteten Industrie-Referenz; **räumliches 3D ausschließlich im späteren Modul Lagerorte**.

## Enthalten

- U01-F01: Modularer Projektaufbau, getrennte View-, Core- und Datenschichten.
- U01-F02: Einheitliches anthrazit-/smaragdgrünes Designsystem.
- U01-F03: Responsive Navigation – mobile Bottom-Bar, große Screens mit Sidebar.
- U01-F04: Dashboard mit echten leeren Ausgangswerten (keine Fake-Bestände).
- U01-F05: Android-PWA mit Manifest, echten PNG-Icons und Offline-App-Shell.

**Wichtig:** Diese Version enthält noch **keine Artikelerfassung, Datenbank, Einkaufserfassung, Backups oder 3D-Funktion**. Die entsprechenden Bereiche zeigen eindeutige Platzhalter und Roadmap-Hinweise. Keine Nutzerdaten werden mit GitHub synchronisiert.

## Nutzung / Installation

1. GitHub Pages auf Branch `main`, Verzeichnis `/ (root)` setzen.
2. App im **Google Chrome** auf Android über `https://darkman0607.github.io/Lagerhaus/` öffnen (HTTPS erforderlich).
3. Chrome-Menü → **App installieren** / **Zum Startbildschirm hinzufügen**, falls vom Browser angeboten. Die Installationsoption hängt u. a. von Browser, Gerät und Aufrufkontext ab.
4. Zur Offline-Nutzung die App einmal mit Internet öffnen, danach erneut öffnen und testen.

Lokal: Statischen Webserver im App-Verzeichnis starten, z. B. `python -m http.server 8000`, dann `http://localhost:8000` in Chrome öffnen. **Nicht** per `file://` laden, da ein Service Worker einen sicheren Ursprung benötigt.

## Architektur

- `index.html` – Einstiegspunkt
- `assets/styles.css` – responsive Designbibliothek
- `src/core/` – Navigation und Icons
- `src/data/store.js` – leerer Datenadapter, wird in U02 durch IndexedDB ersetzt
- `src/views/` – voneinander getrennte Hauptansichten
- `manifest.webmanifest`, `sw.js`, `assets/icons` – installierbare Offline-PWA

## Testnotizen

In `tests/` dokumentierte automatische Tests prüfen Navigation, Nullwerte, Mobile/Desktop und Offline-Verhalten. Echtes Android-Chrome und ein Live-GitHub-Pages-Deployment sind getrennt zu prüfen; lokale Browsertests ersetzen diese nicht.
