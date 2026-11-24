# Idre Julen 2026

Reseguide för julen på Idre Fjäll 20–27 december 2026 (Nedre Hjelmbackevägen 17A): huset, väder, pistkarta, 3D-karta, restauranger och events.

Statisk sajt utan byggsteg. Netlify publicerar roten av repot automatiskt vid varje push.

- `index.html` – hela appen (vädret hämtas live från Open-Meteo)
- `data.json` – terräng, liftar, pister och rutter för kartorna (OpenStreetMap, Mapzen Terrain)
- `netlify/functions/notes.mjs` – API för de gemensamma listorna (sparas i Netlify Blobs)
- `sw.js`, `manifest.webmanifest`, `icons/` – installerbar app och offline-stöd
- `house/` – bilder på huset (Idre Fjäll och egna bilder)
