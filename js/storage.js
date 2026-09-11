/* پی‌نما — لایه امن localStorage (با تحمل حالت private-mode/خطا) */
(function () {
  'use strict';

  var PREFIX = PiNama.config.PREFIX;

  function memoryFallback() {
    var mem = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; }
    };
  }

  var store;
  try {
    var probe = PREFIX + '__probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    store = window.localStorage;
  } catch (e) {
    store = memoryFallback();
  }

  PiNama.storage = {
    get: function (key, fallback) {
      try {
        var raw = store.getItem(PREFIX + key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        store.setItem(PREFIX + key, JSON.stringify(value));
      } catch (e) {
        /* حافظه پر است یا دسترسی نداریم — بی‌صدا رد شو */
      }
    },
    remove: function (key) {
      try { store.removeItem(PREFIX + key); } catch (e) { /* noop */ }
    },
    clearAll: function () {
      try {
        var doomed = [];
        for (var i = 0; i < store.length; i++) {
          var k = store.key(i);
          if (k && k.indexOf(PREFIX) === 0) doomed.push(k);
        }
        doomed.forEach(function (k) { store.removeItem(k); });
      } catch (e) { /* noop */ }
    }
  };
})();
