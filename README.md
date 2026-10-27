# Володарі солі — сімейна аудіоекскурсія Піраном

Публічний статичний PWA: карта Leaflet + OSM, GPS, **11 аудіозупинок** українською за порядком друкованої туристичної карти.

**Live:** https://piran-family-audio-tour.netlify.app

## Маршрут (11 зупинок)

1. Trg bratstva — 45.52637, 13.56905
2. Obzidje nad mestom — 45.52796, 13.57204
3. Kompleks sv. Jurija — 45.52967, 13.56830
4. Svetilnik - Punta — 45.53022, 13.56321
5. Prvomajski trg — 45.52937, 13.56602
6. Židovski trg — 45.52937, 13.56671
7. Obzidna ulica in vrata sv. Jurija — 45.52881, 13.56688
8. Tartinijev trg — 45.52853, 13.56842
9. Cankarjevo nabrežje — 45.52815, 13.56805
10. Trg sv. Frančiška — 45.52874, 13.56985
11. Ulica svobode — 45.52748, 13.56918

Довжина треку ~2,4 км пішки (FOSSGIS OSRM foot).

### Google Maps (walking)

https://www.google.com/maps/dir/?api=1&origin=45.52637,13.56905&destination=45.52748,13.56918&waypoints=45.52796,13.57204|45.52967,13.5683|45.53022,13.56321|45.52937,13.56602|45.52937,13.56671|45.52881,13.56688|45.52853,13.56842|45.52815,13.56805|45.52874,13.56985&travelmode=walking

GPX: `data/piran-family-audio-tour.gpx` (також у репо `/workspace/piran-tour/piran-family-audio-tour.gpx`).

## Як працює

1. Відкрийте сайт на телефоні (потрібен **HTTPS** для геолокації).
2. Натисніть **«Увімкнути звук і геолокацію»** — один дотик розблоковує автоплей і запитує GPS.
3. Ідіть маршрутом. Коли ви входите в радіус ~50 м біля зупинки, аудіо запускається **один раз за сесію**.
4. Будь-яку зупинку можна слухати вручну з маркера на карті або зі списку внизу.

## Локальний перегляд

```bash
npx --yes serve -l 4173 .
# або
python3 -m http.server 4173
```

Відкрийте http://localhost:4173

## Деплой (Netlify)

- Site id: `3e5a4b94-9f03-4826-bdf8-9d62bfeb3941`
- `netlify.toml` уже налаштований: `publish = "."`
- `npx netlify-cli@17 deploy --prod --dir=.`

## Структура

- `data/stops.json` — 11 зупинок у порядку карти
- `data/route.geojson` — пішохідний трек
- `audio/*.mp3` — озвучка (Pani Yulya / ElevenLabs)
- `js/` — карта, геозона, плеєр
- `sw.js` + `manifest.webmanifest` — PWA
