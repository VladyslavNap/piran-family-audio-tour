/**
 * Geolocation helpers: haversine distance + watchPosition wrapper.
 */
(function (global) {
  'use strict';

  var EARTH_RADIUS_M = 6371000;

  function toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  /** Great-circle distance in metres between two WGS84 points. */
  function haversine(lat1, lon1, lat2, lon2) {
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
  }

  /**
   * Among stops within their radius_m of (lat, lon), return the nearest.
   * If several overlap (e.g. Tartini square cluster), nearest wins.
   */
  function findNearestInRadius(lat, lon, stops) {
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < stops.length; i++) {
      var s = stops[i];
      var d = haversine(lat, lon, s.lat, s.lon);
      var radius = typeof s.radius_m === 'number' ? s.radius_m : 50;
      if (d <= radius && d < bestDist) {
        bestDist = d;
        best = { stop: s, distance: d };
      }
    }
    return best;
  }

  /**
   * Start watching position. Returns a cancel function.
   * opts: { onUpdate(position), onError(err) }
   */
  function watchUser(opts) {
    if (!navigator.geolocation) {
      if (opts.onError) {
        opts.onError(new Error('Геолокація недоступна в цьому браузері'));
      }
      return function () {};
    }
    var id = navigator.geolocation.watchPosition(
      function (pos) {
        if (opts.onUpdate) opts.onUpdate(pos);
      },
      function (err) {
        if (opts.onError) opts.onError(err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000,
      }
    );
    return function cancel() {
      navigator.geolocation.clearWatch(id);
    };
  }

  global.TourGeo = {
    haversine: haversine,
    findNearestInRadius: findNearestInRadius,
    watchUser: watchUser,
  };
})(window);
