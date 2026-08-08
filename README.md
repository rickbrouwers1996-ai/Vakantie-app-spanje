# Spanje 2026 — Dagplanning

Mobiele web-app met de dag-voor-dag planning voor de reis naar Barcelona, Valencia, Sevilla en Málaga (30 augustus t/m 15 september 2026). Per dag staan de highlights met uitleg, de kosten en een routekaart op Google Maps.

Geen build-stap nodig — het is een statische site (HTML/CSS/JS) die alle data uit `data/trip.json` leest.

## Gebruiken

Open `index.html` via een webserver (niet als `file://`, want de data wordt met `fetch()` geladen):

```bash
python3 -m http.server 8000
```

en ga naar `http://localhost:8000`.

## Hosten (gratis, met een link voor onderweg)

De makkelijkste manier is **GitHub Pages**:

1. Zorg dat deze bestanden op de `main`-branch staan.
2. Ga naar **Settings → Pages** in deze repository.
3. Kies bij "Source": **Deploy from a branch**, branch **main**, map **/ (root)**.
4. Na een minuut is de app bereikbaar op `https://<gebruikersnaam>.github.io/<repo-naam>/`.

Open die link op de iPhone in Safari en kies **Deel-icoon → Zet op beginscherm** — dan werkt de app als een gewone app-icoon, met eigen scherm zonder Safari-balken.

De app werkt ook offline (op basis van eerder bezochte pagina's) dankzij een service worker — handig als het mobiele netwerk in Spanje even hapert. Alleen de ingesloten Google Maps-kaarten hebben internet nodig.

## Data aanpassen

Alle inhoud (dagen, stops, tickets, kosten) staat in [`data/trip.json`](data/trip.json). Wijzigingen daar zijn direct zichtbaar, zonder verdere code aan te passen.
