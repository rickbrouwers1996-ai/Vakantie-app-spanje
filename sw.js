const CACHE = "spanje-2026-v9";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./data/trip.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./images/breakfast.png",
  "./images/bar.png",
  "./images/dinner.png",
  "./images/highlights/sagrada-familia.png",
  "./images/highlights/sant-pau.png",
  "./images/highlights/park-guell.png",
  "./images/highlights/casa-vicens.png",
  "./images/highlights/tibidabo.png",
  "./images/highlights/palau-musica.png",
  "./images/highlights/casa-batllo.png",
  "./images/highlights/la-pedrera.png",
  "./images/highlights/font-magica.png",
  "./images/highlights/boqueria.png",
  "./images/highlights/barri-gotic.png",
  "./images/highlights/torres-serranos.png",
  "./images/highlights/san-nicolas.png",
  "./images/highlights/valencia-cathedral.png",
  "./images/highlights/mercado-central.png",
  "./images/highlights/ciudad-artes.png",
  "./images/highlights/oceanografic.png",
  "./images/highlights/catedral-sevilla.png",
  "./images/highlights/real-alcazar.png",
  "./images/highlights/casa-pilatos.png",
  "./images/highlights/metropol-parasol.png",
  "./images/highlights/plaza-espana.png",
  "./images/highlights/macarena.png",
  "./images/highlights/torre-oro.png",
  "./images/highlights/alcazaba-malaga.png",
  "./images/highlights/teatro-romano.png",
  "./images/highlights/gibralfaro.png",
  "./images/highlights/caminito-del-rey.png",
  "./images/highlights/catedral-malaga.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
