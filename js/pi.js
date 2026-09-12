/* پی‌نما — لایه اتصال به Pi SDK (مستندات: github.com/pi-apps/pi-platform-docs) */
(function () {
  'use strict';

  var S = PiNama.storage;
  var K = PiNama.config.KEYS;

  PiNama.pi = {
    sdkReady: false,
    inPiBrowser: /PiBrowser/i.test(navigator.userAgent || ''),
    user: null,

    init: function () {
      this.user = S.get(K.USER, null);
      if (window.Pi && typeof window.Pi.init === 'function') {
        try {
          window.Pi.init({ version: PiNama.config.SDK_VERSION || '2.0' });
          this.sdkReady = true;
        } catch (e) {
          this.sdkReady = false;
        }
      }
    },

    /**
     * ورود با Pi — فقط اسکوپ username (این اپ فعلاً پرداخت ندارد).
     * خروجی: { ok: true, user } یا { ok: false, error: 'sdk'|'browser'|'failed'|... }
     */
    authenticate: function () {
      var self = this;
      if (!this.sdkReady) return Promise.resolve({ ok: false, error: 'sdk' });
      if (!this.inPiBrowser) return Promise.resolve({ ok: false, error: 'browser' });

      return window.Pi.authenticate(['username'], function (payment) {
        // پرداخت ناتمام از قبل — این اپ هنوز جریان پرداخت ندارد، پس فقط لاگ می‌کنیم
        console.warn('Incomplete payment found:', payment && payment.identifier);
      }).then(function (auth) {
        var user = auth && auth.user
          ? { uid: auth.user.uid, username: auth.user.username }
          : null;
        if (!user || !user.username) return { ok: false, error: 'failed' };
        self.user = user;
        S.set(K.USER, user);
        return { ok: true, user: user };
      }).catch(function (err) {
        console.warn('Pi.authenticate failed:', err);
        return { ok: false, error: 'failed', detail: err };
      });
    },

    logout: function () {
      this.user = null;
      S.remove(K.USER);
    },

    /** آیا مرورگر Pi قابلیت ad_network را فعال دارد؟ */
    hasAdNetwork: function () {
      if (!this.sdkReady || !window.Pi.nativeFeaturesList) {
        return Promise.resolve(false);
      }
      return window.Pi.nativeFeaturesList().then(function (features) {
        return Array.isArray(features) && features.indexOf('ad_network') !== -1;
      }).catch(function () {
        return false;
      });
    },

    share: function () {
      var title = 'پی‌نما — ردیاب قیمت Pi';
      var message = 'قیمت لحظه‌ای Pi، نمودار، ماشین‌حساب تومانی و هشدار قیمت همه در یک اپ فارسی 👇';
      if (this.sdkReady && typeof window.Pi.openShareDialog === 'function') {
        try {
          window.Pi.openShareDialog(title, message);
          return;
        } catch (e) { /* ادامه با Web Share */ }
      }
      if (navigator.share) {
        navigator.share({ title: title, text: message }).catch(function () { /* لغو شد */ });
      } else {
        var url = location.origin + location.pathname;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(title + ' — ' + url).then(function () {
            PiNama.toast('نشانی اپ کپی شد 📋', 'gold');
          }).catch(function () { /* noop */ });
        }
      }
    }
  };
})();
