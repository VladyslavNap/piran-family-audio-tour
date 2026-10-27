/* Service worker — cache shell + audio for installable offline-ish PWA */
var CACHE_NAME = 'piran-tour-v2-map11';

var SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/geo.js',
  './js/audio.js',
  './data/stops.json',
  './data/route.geojson',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
];

var AUDIO = [
  './audio/01-trg-bratstva.mp3',
  './audio/02-obzidje.mp3',
  './audio/03-sv-jurij.mp3',
  './audio/04-punta-svetilnik.mp3',
  './audio/05-prvomajski.mp3',
  './audio/06-zidovski-trg.mp3',
  './audio/07-obzidna-vrata.mp3',
  './audio/08-tartinijev-trg.mp3',
  './audio/09-cankarjevo.mp3',
  './audio/10-trg-sv-franciska.mp3',
  './audio/11-ulica-svobode.mp3',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(SHELL.concat(AUDIO));
      })
      .then(function () {
        return self.skipWaiting();
      })
      .catch(function (err) {
        console.warn('SW install cache partial fail', err);
        // Still activate; runtime fetch will fill gaps
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k !== CACHE_NAME;
            })
            .map(function (k) {
              return caches.delete(k);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Always try network for OSM tiles; don't cache map tiles heavily
  if (url.hostname.indexOf('tile.openstreetmap.org') !== -1) {
    return;
  }

  // CDN Leaflet — cache falling back to network
  if (url.hostname.indexOf('unpkg.com') !== -1) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(req).then(function (cached) {
          var fetched = fetch(req)
            .then(function (res) {
              if (res && res.ok) cache.put(req, res.clone());
              return res;
            })
            .catch(function () {
              return cached;
            });
          return cached || fetched;
        });
      })
    );
    return;
  }

  // Same-origin: cache-first for audio & shell
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req)
          .then(function (res) {
            if (res && res.ok && (url.pathname.indexOf('/audio/') !== -1 || SHELL.some(function (p) {
              return url.pathname.endsWith(p.replace('./', '/')) || url.pathname.endsWith(p.replace('./', ''));
            }))) {
              var clone = res.clone();
              caches.open(CACHE_NAME).then(function (c) {
                c.put(req, clone);
              });
            }
            return res;
          })
          .catch(function () {
            if (req.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return cached;
          });
      })
    );
  }
});
