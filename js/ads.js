/* پی‌نما — ماژول تبلیغات Pi Ad Network
 * توضیح سیاستی: نمایش تبلیغ برای اپ‌های تأییدشده در Ecosystem مجاز است.
 * interstitial: در تعویض تب‌ها (با فاصله حداقل ۳ دقیقه) — rewarded: دکمه حمایتی تنظیمات.
 * جایگزینی/جعل نتیجه تبلیغ سمت کلاینت ممکن است؛ adId در نسخه دارای بک‌اند باید سمت سرور تأیید شود.
 */
(function () {
  'use strict';

  var S = PiNama.storage;
  var K = PiNama.config.KEYS;

  PiNama.ads = {
    supported: false,

    init: function () {
      var self = this;
      return PiNama.pi.hasAdNetwork().then(function (ok) {
        self.supported = ok;
        return ok;
      });
    },

    _canShow: function () {
      return this.supported && PiNama.pi.user != null;
    },

    /** تبلیغ بینابینی حداکثر یک‌بار هر چند دقیقه؛ خطاها بی‌صدا نادیده گرفته می‌شوند */
    maybeShowInterstitial: function () {
      var self = this;
      if (!this._canShow() || !window.Pi.Ads || typeof window.Pi.Ads.showAd !== 'function') {
        return Promise.resolve(false);
      }
      var last = S.get(K.LAST_INTERSTITIAL, 0);
      if (Date.now() - last < PiNama.config.INTERSTITIAL_MIN_GAP_MS) {
        return Promise.resolve(false);
      }

      return Promise.resolve()
        .then(function () {
          return window.Pi.Ads.isAdReady('interstitial').catch(function () { return null; });
        })
        .then(function (st) {
          if (st && st.ready === true) return null;
          if (typeof window.Pi.Ads.requestAd === 'function') {
            return window.Pi.Ads.requestAd('interstitial').catch(function () { return null; });
          }
        })
        .then(function () {
          return window.Pi.Ads.showAd('interstitial');
        })
        .then(function (res) {
          S.set(K.LAST_INTERSTITIAL, Date.now());
          return !!(res && String(res.result).indexOf('ERROR') === -1);
        })
        .catch(function () {
          return false;
        });
    },

    /**
     * تبلیغ جایزه‌دار (حمایتی).
     * onResult('AD_REWARDED' | 'AD_CLOSED' | 'AD_NOT_AVAILABLE' | 'ADS_NOT_SUPPORTED' | 'USER_UNAUTHENTICATED' | 'ERROR')
     */
    watchRewarded: function (onResult) {
      if (!this._canShow() || !window.Pi.Ads || typeof window.Pi.Ads.showAd !== 'function') {
        onResult('ADS_NOT_SUPPORTED');
        return;
      }

      Promise.resolve()
        .then(function () {
          return window.Pi.Ads.isAdReady('rewarded').catch(function () { return null; });
        })
        .then(function (st) {
          if (st && st.ready === true) return null;
          if (typeof window.Pi.Ads.requestAd === 'function') {
            return window.Pi.Ads.requestAd('rewarded').catch(function () { return null; });
          }
        })
        .then(function () {
          return window.Pi.Ads.showAd('rewarded');
        })
        .then(function (res) {
          onResult((res && res.result) || 'AD_CLOSED');
        })
        .catch(function () {
          onResult('ERROR');
        });
    },

    statusText: function () {
      if (!PiNama.pi.inPiBrowser) return 'برای نمایش تبلیغات، اپ را داخل Pi Browser باز کنید';
      if (!this.supported) return 'Ad Network روی این نصب فعال نیست — پس از تأیید اپ در Ecosystem فعال می‌شود';
      if (!PiNama.pi.user) return 'برای دیدن تبلیغ، ابتدا با Pi وارد شوید';
      return 'تبلیغات فعال است — از حمایت شما متشکریم 🙏';
    }
  };
})();
