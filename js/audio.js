/**
 * Audio player + unlock (AudioContext resume for autoplay policy).
 */
(function (global) {
  'use strict';

  function createTourAudio(audioEl) {
    var unlocked = false;
    var audioCtx = null;
    var currentSrc = null;
    var onState = null;

    function emit(state) {
      if (onState) onState(state);
    }

    function setOnState(fn) {
      onState = fn;
    }

    /** First user gesture: unlock autoplay + prepare silent context. */
    function unlock() {
      if (unlocked) return Promise.resolve(true);
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          audioCtx = new AC();
          if (audioCtx.state === 'suspended') {
            return audioCtx.resume().then(function () {
              unlocked = true;
              emit({ type: 'unlocked' });
              return true;
            });
          }
        }
      } catch (e) {
        /* ignore — HTMLAudioElement play() on unlock tap is enough */
      }
      unlocked = true;
      emit({ type: 'unlocked' });
      return Promise.resolve(true);
    }

    function isUnlocked() {
      return unlocked;
    }

    function load(src) {
      if (currentSrc === src && audioEl.src) return;
      currentSrc = src;
      audioEl.src = src;
      audioEl.load();
    }

    function play(src) {
      if (src) load(src);
      var p = audioEl.play();
      if (p && typeof p.then === 'function') {
        return p
          .then(function () {
            emit({ type: 'playing', src: currentSrc });
            return true;
          })
          .catch(function (err) {
            emit({ type: 'error', error: err });
            return false;
          });
      }
      emit({ type: 'playing', src: currentSrc });
      return Promise.resolve(true);
    }

    function pause() {
      audioEl.pause();
      emit({ type: 'paused' });
    }

    function toggle() {
      if (audioEl.paused) return play();
      pause();
      return Promise.resolve(true);
    }

    function seek(ratio) {
      if (!isFinite(audioEl.duration) || audioEl.duration <= 0) return;
      audioEl.currentTime = Math.max(0, Math.min(1, ratio)) * audioEl.duration;
    }

    function formatTime(sec) {
      if (!isFinite(sec) || sec < 0) return '0:00';
      var s = Math.floor(sec);
      var m = Math.floor(s / 60);
      var r = s % 60;
      return m + ':' + (r < 10 ? '0' : '') + r;
    }

    audioEl.addEventListener('timeupdate', function () {
      emit({
        type: 'time',
        current: audioEl.currentTime,
        duration: audioEl.duration || 0,
      });
    });
    audioEl.addEventListener('ended', function () {
      emit({ type: 'ended', src: currentSrc });
    });
    audioEl.addEventListener('loadedmetadata', function () {
      emit({
        type: 'meta',
        duration: audioEl.duration || 0,
      });
    });
    audioEl.addEventListener('play', function () {
      emit({ type: 'playing', src: currentSrc });
    });
    audioEl.addEventListener('pause', function () {
      if (!audioEl.ended) emit({ type: 'paused' });
    });

    return {
      unlock: unlock,
      isUnlocked: isUnlocked,
      load: load,
      play: play,
      pause: pause,
      toggle: toggle,
      seek: seek,
      formatTime: formatTime,
      setOnState: setOnState,
      el: audioEl,
    };
  }

  global.TourAudio = { create: createTourAudio };
})(window);
