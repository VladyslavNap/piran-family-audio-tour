/**
 * Piran family audio tour PWA — map, geofence, player UI.
 */
(function () {
  'use strict';

  var PIRAN_CENTER = [45.5285, 13.5683];
  var DEFAULT_ZOOM = 16;

  var stops = [];
  var autoPlayed = Object.create(null); // id -> true, once per session
  var currentStop = null;
  var geoUnlocked = false;
  var cancelWatch = null;

  var map;
  var routeLayer;
  var userMarker;
  var accuracyCircle;
  var stopMarkers = {};

  var els = {};
  var tourAudio;

  function $(id) {
    return document.getElementById(id);
  }

  function cacheEls() {
    els = {
      map: $('map'),
      unlockBanner: $('unlock-banner'),
      unlockBtn: $('unlock-btn'),
      playBtn: $('play-btn'),
      progress: $('progress'),
      timeCurrent: $('time-current'),
      timeTotal: $('time-total'),
      nowOrder: $('now-order'),
      nowName: $('now-name'),
      nowStatus: $('now-status'),
      stopsList: $('stops-list'),
      player: $('player'),
    };
  }

  function initMap() {
    map = L.map(els.map, {
      zoomControl: false,
      attributionControl: true,
    }).setView(PIRAN_CENTER, DEFAULT_ZOOM);

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Leave room for bottom sheet when fitting bounds
    map.getContainer().style.bottom = '0';
  }

  function numberIcon(order, extraClass) {
    var cls = 'stop-marker' + (extraClass ? ' ' + extraClass : '');
    return L.divIcon({
      className: '',
      html: '<div class="' + cls + '">' + order + '</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -16],
    });
  }

  function addStopsToMap() {
    stops.forEach(function (stop) {
      var marker = L.marker([stop.lat, stop.lon], {
        icon: numberIcon(stop.order),
        title: stop.order + '. ' + stop.name,
      }).addTo(map);

      var popupHtml =
        '<strong>' +
        stop.order +
        '. ' +
        escapeHtml(stop.name) +
        '</strong><br>' +
        '<button type="button" class="popup-play" data-stop-id="' +
        escapeHtml(stop.id) +
        '">▶ Слухати</button>';

      marker.bindPopup(popupHtml);
      marker.on('popupopen', function () {
        var btn = document.querySelector(
          '.popup-play[data-stop-id="' + stop.id + '"]'
        );
        if (btn) {
          btn.addEventListener('click', function () {
            playStop(stop, { manual: true });
            marker.closePopup();
          });
        }
      });

      stopMarkers[stop.id] = marker;
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function loadRoute(geojson) {
    routeLayer = L.geoJSON(geojson, {
      style: {
        color: '#0e5a6e',
        weight: 5,
        opacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round',
      },
    }).addTo(map);

    var bounds = routeLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.12), {
        paddingBottomRight: [0, 180],
        paddingTopLeft: [0, 70],
      });
    }
  }

  function renderStopsList() {
    els.stopsList.innerHTML = '';
    stops.forEach(function (stop) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'stop-item';
      btn.dataset.stopId = stop.id;
      btn.innerHTML =
        '<span class="stop-item__order">' +
        stop.order +
        '</span>' +
        '<span class="stop-item__name">' +
        escapeHtml(stop.name) +
        '</span>' +
        '<span class="stop-item__play">▶</span>';
      btn.addEventListener('click', function () {
        playStop(stop, { manual: true });
        if (stopMarkers[stop.id]) {
          map.panTo([stop.lat, stop.lon]);
          stopMarkers[stop.id].openPopup();
        }
      });
      li.appendChild(btn);
      els.stopsList.appendChild(li);
    });
  }

  function updateListHighlight() {
    var items = els.stopsList.querySelectorAll('.stop-item');
    items.forEach(function (el) {
      var id = el.dataset.stopId;
      el.classList.toggle('is-active', currentStop && currentStop.id === id);
      el.classList.toggle('is-played', !!autoPlayed[id]);
    });
  }

  function updateMarkerStyles() {
    stops.forEach(function (stop) {
      var marker = stopMarkers[stop.id];
      if (!marker) return;
      var extra = '';
      if (currentStop && currentStop.id === stop.id) extra = 'is-active';
      else if (autoPlayed[stop.id]) extra = 'is-played';
      marker.setIcon(numberIcon(stop.order, extra));
    });
  }

  function setNowPlaying(stop, statusText) {
    currentStop = stop || null;
    if (stop) {
      els.nowOrder.textContent = String(stop.order);
      els.nowName.textContent = stop.name;
      els.playBtn.disabled = false;
    } else {
      els.nowOrder.textContent = '—';
      els.nowName.textContent = 'Оберіть зупинку';
      els.playBtn.disabled = true;
    }
    if (statusText) els.nowStatus.textContent = statusText;
    updateListHighlight();
    updateMarkerStyles();
  }

  function playStop(stop, opts) {
    opts = opts || {};
    // Mark early so rapid watchPosition ticks do not queue auto-plays.
    autoPlayed[stop.id] = true;
    setNowPlaying(stop, opts.manual ? 'Відтворення…' : 'Автозапуск…');
    tourAudio.play(stop.audio).then(function (ok) {
      if (ok) {
        els.nowStatus.textContent = opts.manual
          ? 'Слухаєте вручну'
          : 'Автозапуск біля зупинки';
        updateListHighlight();
        updateMarkerStyles();
      } else {
        // Allow retry on failure (user can still tap manually).
        if (!opts.manual) delete autoPlayed[stop.id];
        els.nowStatus.textContent = 'Не вдалося відтворити — натисніть ще раз';
        updateListHighlight();
        updateMarkerStyles();
      }
    });
  }

  function onGeoUpdate(pos) {
    var lat = pos.coords.latitude;
    var lon = pos.coords.longitude;
    var acc = pos.coords.accuracy || 30;

    if (!userMarker) {
      var userIcon = L.divIcon({
        className: '',
        html: '<div class="user-dot"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      userMarker = L.marker([lat, lon], {
        icon: userIcon,
        zIndexOffset: 1000,
        interactive: false,
      }).addTo(map);
      accuracyCircle = L.circle([lat, lon], {
        radius: acc,
        color: '#2b7fff',
        weight: 1,
        fillColor: '#2b7fff',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
    } else {
      userMarker.setLatLng([lat, lon]);
      accuracyCircle.setLatLng([lat, lon]);
      accuracyCircle.setRadius(acc);
    }

    var hit = TourGeo.findNearestInRadius(lat, lon, stops);
    if (hit) {
      var items = els.stopsList.querySelectorAll('.stop-item');
      items.forEach(function (el) {
        el.classList.toggle('is-nearby', el.dataset.stopId === hit.stop.id);
      });

      if (tourAudio.isUnlocked() && !autoPlayed[hit.stop.id]) {
        // Auto-play once per session when entering radius (nearest if overlap).
        playStop(hit.stop, { manual: false });
      } else if (!currentStop) {
        setNowPlaying(
          hit.stop,
          'Ви біля зупинки (~' + Math.round(hit.distance) + ' м)'
        );
      } else if (currentStop.id === hit.stop.id) {
        els.nowStatus.textContent =
          'Ви біля зупинки (~' + Math.round(hit.distance) + ' м)';
      }
    } else {
      var items2 = els.stopsList.querySelectorAll('.stop-item');
      items2.forEach(function (el) {
        el.classList.remove('is-nearby');
      });
      if (!els.player || els.player.paused) {
        if (!currentStop) {
          els.nowStatus.textContent = 'Йдіть маршрутом до наступної зупинки';
        }
      }
    }
  }

  function onGeoError(err) {
    var msg = 'Геолокацію відхилено';
    if (err && err.code === 1) msg = 'Доступ до GPS відхилено в налаштуваннях';
    else if (err && err.code === 2) msg = 'Позицію не визначено';
    else if (err && err.code === 3) msg = 'Таймаут геолокації';
    els.nowStatus.textContent = msg + ' — можна слухати вручну зі списку';
  }

  function startGeolocation() {
    if (cancelWatch) return;
    geoUnlocked = true;
    cancelWatch = TourGeo.watchUser({
      onUpdate: onGeoUpdate,
      onError: onGeoError,
    });
    els.nowStatus.textContent = 'Шукаємо вашу позицію…';
  }

  function bindUi() {
    els.unlockBanner.hidden = false;

    els.unlockBtn.addEventListener('click', function () {
      tourAudio.unlock().then(function () {
        els.unlockBanner.hidden = true;
        startGeolocation();
        els.nowStatus.textContent = 'Звук увімкнено. Шукаємо GPS…';
      });
    });

    els.playBtn.addEventListener('click', function () {
      if (!currentStop) return;
      if (!tourAudio.isUnlocked()) {
        tourAudio.unlock().then(function () {
          els.unlockBanner.hidden = true;
          startGeolocation();
          playStop(currentStop, { manual: true });
        });
        return;
      }
      if (els.player.src && currentStop) {
        // If same track loaded, toggle; else play current stop
        var abs = new URL(currentStop.audio, location.href).href;
        if (els.player.src === abs || els.player.src.endsWith(currentStop.audio)) {
          tourAudio.toggle();
        } else {
          playStop(currentStop, { manual: true });
        }
      } else {
        playStop(currentStop, { manual: true });
      }
    });

    els.progress.addEventListener('input', function () {
      tourAudio.seek(Number(els.progress.value) / 100);
    });

    tourAudio.setOnState(function (state) {
      if (state.type === 'playing') {
        els.playBtn.classList.add('is-playing');
        els.playBtn.setAttribute('aria-label', 'Пауза');
        els.playBtn.querySelector('.play-btn__icon').textContent = '⏸';
        els.progress.disabled = false;
      } else if (state.type === 'paused' || state.type === 'ended') {
        els.playBtn.classList.remove('is-playing');
        els.playBtn.setAttribute('aria-label', 'Відтворити');
        els.playBtn.querySelector('.play-btn__icon').textContent = '▶';
        if (state.type === 'ended') {
          els.nowStatus.textContent = 'Завершено — оберіть наступну зупинку';
          els.progress.value = 100;
        }
      } else if (state.type === 'time' || state.type === 'meta') {
        var dur = state.duration || 0;
        var cur = state.current || 0;
        if (state.type === 'meta' || dur) {
          els.timeTotal.textContent = tourAudio.formatTime(dur);
        }
        if (state.type === 'time') {
          els.timeCurrent.textContent = tourAudio.formatTime(cur);
          if (dur > 0) {
            els.progress.value = String((cur / dur) * 100);
          }
        }
      }
    });
  }

  function registerSw() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {
        /* offline / file:// — ignore */
      });
    });
  }

  function boot() {
    cacheEls();
    tourAudio = TourAudio.create(els.player);
    initMap();
    bindUi();
    registerSw();

    Promise.all([
      fetch('data/stops.json').then(function (r) {
        return r.json();
      }),
      fetch('data/route.geojson').then(function (r) {
        return r.json();
      }),
    ])
      .then(function (pair) {
        stops = pair[0].slice().sort(function (a, b) {
          return a.order - b.order;
        });
        loadRoute(pair[1]);
        addStopsToMap();
        renderStopsList();
        els.nowStatus.textContent =
          'Натисніть «Увімкнути звук і геолокацію», щоб почати';
      })
      .catch(function (err) {
        console.error(err);
        els.nowStatus.textContent = 'Помилка завантаження даних маршруту';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
