/* پی‌نما — اتصال همه ماژول‌ها به DOM و رویدادها */
(function () {
  'use strict';

  var C = PiNama.config;
  var S = PiNama.storage;
  var K = C.KEYS;
  var fmt = PiNama.fmt;
  var price = PiNama.price;
  var pi = PiNama.pi;
  var ads = PiNama.ads;
  var alerts = PiNama.alerts;

  var el = {};
  var chart = null;
  var currentDays = 7;
  var toastRoot = null;

  function $(id) { return document.getElementById(id); }

  /* ─── توست ─── */
  PiNama.toast = function (msg, type) {
    if (!toastRoot) return;
    var t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    toastRoot.appendChild(t);
    while (toastRoot.children.length > 3) toastRoot.removeChild(toastRoot.firstChild);
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 3500);
  };

  /* ═══════ رندر ═══════ */

  var lastRenderedUsd = null;
  var flashTimer = null;

  function renderPrice() {
    var st = price.state;

    // فلش سبز/قرمز هنگام تغییر قیمت
    if (lastRenderedUsd != null && st.usd != null && st.usd !== lastRenderedUsd && !st.error) {
      el.priceUsd.classList.remove('flash-up', 'flash-down');
      // force reflow برای ری‌استارت انیمیشن
      void el.priceUsd.offsetWidth;
      el.priceUsd.classList.add(st.usd > lastRenderedUsd ? 'flash-up' : 'flash-down');
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(function () {
        el.priceUsd.classList.remove('flash-up', 'flash-down');
      }, 900);
    }
    if (st.usd != null && !st.error) lastRenderedUsd = st.usd;

    el.priceUsd.textContent = fmt.usd(st.usd);
    el.priceToman.textContent = (st.usd != null && st.tomanRate)
      ? fmt.num(st.usd * st.tomanRate, 0) + ' تومان'
      : '—';

    var ch = st.change24h;
    el.priceChange.textContent = ch == null ? '—' : fmt.pct(ch);
    el.priceChange.className = 'price-change ' +
      (ch == null || (!isFinite(ch) || Math.abs(ch) <= 0.05) ? 'flat' : ch > 0 ? 'up' : 'down');

    el.priceUpdated.textContent = st.fetchedAt
      ? 'به‌روزرسانی ' + fmt.clock.format(new Date(st.fetchedAt))
      : 'در انتظار داده…';
    el.priceSource.textContent = 'منبع: ' + (st.source || '—');

    el.liveDot.className = 'live-dot ' +
      (st.error ? (st.usd != null ? 'stale' : 'err') : 'ok');
    el.offlineBanner.hidden = !st.error;

    el.statHigh.textContent = fmt.usd(st.high24h);
    el.statLow.textContent = fmt.usd(st.low24h);
    el.statMcap.textContent = fmt.compactUsd(st.marketCap);
    el.statVol.textContent = fmt.compactUsd(st.volume24h);
  }

  function renderCalc() {
    var dir = S.get(K.CALC_DIR, 'pi2usd');
    var st = price.state;
    var raw = fmt.parse(el.calcInput.value);

    el.calcInputLabel.textContent = dir === 'pi2usd' ? 'مقدار Pi' : 'مقدار (تومان)';

    if (!isFinite(raw) || raw <= 0 || st.usd == null) {
      el.calcResult.textContent = '—';
      return;
    }
    if (dir === 'pi2usd') {
      var usd = raw * st.usd;
      el.calcResult.textContent = fmt.usd(usd, 2) +
        (st.tomanRate ? '   ≈   ' + fmt.num(usd * st.tomanRate, 0) + ' تومان' : '');
    } else {
      if (!st.tomanRate) {
        el.calcResult.textContent = '—';
        return;
      }
      var piCount = raw / (st.usd * st.tomanRate);
      el.calcResult.textContent = '≈ ' + fmt.num(piCount, 4) + ' PI';
    }
  }

  function renderPortfolio() {
    var st = price.state;
    var h = fmt.parse(el.pfHoldings.value);
    var avg = fmt.parse(el.pfAvg.value);

    if (!isFinite(h) || h <= 0 || st.usd == null) {
      el.pfUsd.textContent = '—';
      el.pfToman.textContent = '—';
      el.pfPl.hidden = true;
      return;
    }
    var usd = h * st.usd;
    el.pfUsd.textContent = fmt.usd(usd, 2);
    el.pfToman.textContent = st.tomanRate ? fmt.num(usd * st.tomanRate, 0) : '—';

    if (isFinite(avg) && avg > 0) {
      var pl = (st.usd - avg) * h;
      var pct = (st.usd / avg - 1) * 100;
      el.pfPl.hidden = false;
      el.pfPl.className = 'pf-pl ' + (pl >= 0 ? 'gain' : 'loss');
      el.pfPlValue.textContent = fmt.usd(pl, 2) + '  (' + fmt.pct(pct) + ')';
    } else {
      el.pfPl.hidden = true;
    }
  }

  function renderRate() {
    var mode = S.get(K.RATE_MODE, 'auto');
    var st = price.state;
    el.rateManualField.hidden = mode !== 'manual';

    var txt;
    if (st.tomanRate == null) {
      txt = mode === 'manual'
        ? 'نرخ دستی نامعتبر است — عددی بین ۵۰٬۰۰۰ تا ۹۰۰٬۰۰۰ وارد کنید'
        : 'نرخ دلار در دسترس نیست — از «دستی» نرخ را وارد کنید';
      if (mode === 'manual') el.rateManual.classList.add('input-error');
    } else {
      if (mode === 'manual') el.rateManual.classList.remove('input-error');
      var label = mode === 'manual' ? 'دستی' :
        (st.tomanSource === 'auto' ? 'خودکار' : 'آخرین نرخ ذخیره‌شده');
      txt = label + ' — هر دلار ' + fmt.num(st.tomanRate, 0) + ' تومان';
      if (mode === 'auto' && st.tomanSource !== 'auto') txt += ' (آنلاین در دسترس نیست)';
    }
    el.rateStatus.textContent = txt;

    var btns = el.rateModeBtns;
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-mode') === mode);
    }
  }

  function renderAccount() {
    if (pi.user) {
      el.accountStatus.textContent = 'وارد شده: @' + pi.user.username;
      el.accountStatus.classList.remove('muted');
      el.logoutBtn.hidden = false;
      el.authBtn.textContent = '@' + pi.user.username;
    } else {
      el.accountStatus.textContent = 'وارد نشده‌اید';
      el.accountStatus.classList.add('muted');
      el.logoutBtn.hidden = true;
      el.authBtn.textContent = 'ورود با Pi';
    }
  }

  function renderAdStatus() {
    el.adStatus.textContent = ads.statusText();
  }

  function renderAlertsList() {
    alerts.render(el.alertList, price.state.usd);
  }

  /* ═══════ چیپ‌های بازه‌ای ═══════ */

  function updateChangeChip(days) {
    price.loadSeries(days).then(function (data) {
      if (!data || data.length < 2) return;
      var first = data[0][1], last = data[data.length - 1][1];
      if (!isFinite(first) || first <= 0) return;
      var pct = (last / first - 1) * 100;
      var chip = el.changeChips[days];
      if (!chip) return;
      chip.textContent = (days === 1 ? '۲۴ ساعت ' : days === 7 ? '۷ روز ' : '۳۰ روز ') + fmt.pct(pct);
      chip.classList.remove('up', 'down');
      chip.classList.add(pct >= 0 ? 'up' : 'down');
    }).catch(function () { /* چیپ بدون داده می‌ماند */ });
  }

  function updateAllChangeChips() {
    [1, 7, 30].forEach(updateChangeChip);
  }

  /* ═══════ نمودار ═══════ */

  function loadChart(days) {
    currentDays = days;
    el.chartLoading.textContent = 'در حال بارگذاری نمودار…';
    el.chartLoading.style.display = 'grid';

    price.loadSeries(days).then(function (data) {
      if (currentDays !== days) return; // کاربر بازه دیگری انتخاب کرده
      chart.setData(data);
      el.chartLoading.style.display = 'none';
    }).catch(function () {
      el.chartLoading.textContent = 'نمودار موقتاً در دسترس نیست — برای تلاش مجدد لمس کنید';
    });  }

  /* ═══════ هشدارها ═══════ */

  function notify(body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      new Notification('پی‌نما', { body: body, tag: 'pinama-alert' });
    } catch (e) { /* بعضی WebView ها اجازه نمی‌دهند */ }
  }

  function checkAlerts(usd) {
    // فقط با قیمت تازه؛ قیمت کش/کهنه نباید هشدار کاذب فعال کند
    if (price.state.error) return;
    var fired = alerts.check(usd);
    if (!fired.length) return;
    fired.forEach(function (a) {
      var msg = '🎯 Pi ' + (a.dir === 'above' ? 'رسید بالای' : 'افتاد زیر') + ' ' + fmt.usd(a.price);
      PiNama.toast(msg, 'gold');
      notify(msg);
    });
    renderAlertsList();
  }

  function onPriceChange() {
    renderPrice();
    renderCalc();
    renderPortfolio();
    renderRate();
    checkAlerts(price.state.usd);
    if (!price.state.error) updateAllChangeChips();
  }

  /* ═══════ ناوبری ═══════ */

  function switchView(name) {
    var btns = el.navBtns;
    for (var i = 0; i < btns.length; i++) {
      var active = btns[i].getAttribute('data-view') === name;
      btns[i].classList.toggle('active', active);
      if (active) btns[i].setAttribute('aria-current', 'page');
      else btns[i].removeAttribute('aria-current');
    }
    var views = el.views;
    for (var j = 0; j < views.length; j++) {
      views[j].classList.toggle('active', views[j].id === 'view-' + name);
    }
    // تبلیغ بینابینی (داخلی throttled می‌شود و بی‌صدا رد می‌شود)
    ads.maybeShowInterstitial().catch(function () { });
  }

  /* ═══════ رویدادها ═══════ */

  function wireEvents() {
    // ناوبری پایین
    el.navBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchView(btn.getAttribute('data-view'));
      });
    });

    // تلاش مجدد نمودار با لمس پیام خطا
    el.chartLoading.addEventListener('click', function () {
      if (el.chartLoading.style.display !== 'none') loadChart(currentDays);
    });

    // بنر آفلاین: لمس = تازه‌سازی فوری
    el.offlineBanner.addEventListener('click', function () {
      price.refresh();
      price.refreshTomanRate();
      PiNama.toast('در حال تازه‌سازی…');
    });

    // بازه نمودار
    el.tfBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        el.tfBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        loadChart(parseInt(btn.getAttribute('data-days'), 10));
      });
    });

    // چیپ‌های بازه‌ای: کلیک = تعویض نمودار
    el.changeChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var days = parseInt(chip.getAttribute('data-days'), 10);
        el.tfBtns.forEach(function (b) {
          b.classList.toggle('active', parseInt(b.getAttribute('data-days'), 10) === days);
        });
        loadChart(days);
      });
    });

    // ماشین‌حساب
    el.calcDirBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        el.calcDirBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        S.set(K.CALC_DIR, btn.getAttribute('data-dir'));
        renderCalc();
      });
    });
    el.calcInput.addEventListener('input', function () {
      S.set(K.CALC_INPUT, el.calcInput.value);
      renderCalc();
    });

    // پرتفوی
    el.pfHoldings.addEventListener('input', function () {
      S.set(K.HOLDINGS, fmt.parse(el.pfHoldings.value) || 0);
      renderPortfolio();
    });
    el.pfAvg.addEventListener('input', function () {
      S.set(K.AVG_BUY, fmt.parse(el.pfAvg.value) || 0);
      renderPortfolio();
    });

    // هشدارها
    el.alertAdd.addEventListener('click', function () {
      var item = alerts.add(el.alertDir.value, fmt.parse(el.alertPrice.value));
      if (!item) {
        PiNama.toast('قیمت معتبری وارد کنید', 'red');
        return;
      }
      el.alertPrice.value = '';
      renderAlertsList();
      PiNama.toast('هشدار ثبت شد ✓');
    });
    el.notifEnable.addEventListener('click', function () {
      if (!('Notification' in window)) {
        PiNama.toast('این مرورگر نوتیفیکیشن ندارد', 'red');
        return;
      }
      Notification.requestPermission().then(function (p) {
        updateNotifUi(p);
        PiNama.toast(p === 'granted' ? 'نوتیفیکیشن فعال شد ✓' : 'نوتیفیکیشن فعال نشد', p === 'granted' ? 'gold' : 'red');
      });
    });

    // حساب
    el.authBtn.addEventListener('click', function () {
      if (pi.user) {
        switchView('settings');
        return;
      }
      pi.authenticate().then(function (r) {
        if (r.ok) PiNama.toast('خوش آمدی @' + r.user.username + ' 🙌', 'gold');
        else if (r.error === 'browser') PiNama.toast('برای ورود، اپ را داخل Pi Browser باز کنید', 'gold');
        else if (r.error === 'sdk') PiNama.toast('Pi SDK در دسترس نیست', 'red');
        else PiNama.toast('ورود ناموفق بود — دوباره تلاش کنید', 'red');
        renderAccount();
        renderAdStatus();
      });
    });
    el.logoutBtn.addEventListener('click', function () {
      pi.logout();
      renderAccount();
      renderAdStatus();
      PiNama.toast('خارج شدید');
    });

    // نرخ دلار
    el.rateModeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        el.rateModeBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        price.setRateMode(btn.getAttribute('data-mode')).then(renderRate);
      });
    });
    el.rateManual.addEventListener('input', function () {
      var v = fmt.parse(el.rateManual.value);
      if (isFinite(v) && v > 0) {
        price.setManualRate(v);
        renderRate();
        renderPrice();
        renderCalc();
        renderPortfolio();
      }
    });

    // تبلیغ حمایتی
    el.watchAdBtn.addEventListener('click', function () {
      el.watchAdBtn.disabled = true;
      ads.watchRewarded(function (res) {
        el.watchAdBtn.disabled = false;
        if (res === 'AD_REWARDED') PiNama.toast('از حمایت شما سپاسگزارم 🙏', 'gold');
        else if (res === 'AD_NOT_AVAILABLE') PiNama.toast('فعلاً تبلیغی موجود نیست — بعداً تلاش کنید');
        else if (res === 'USER_UNAUTHENTICATED') PiNama.toast('ابتدا با Pi وارد شوید', 'gold');
        else if (res === 'ADS_NOT_SUPPORTED') PiNama.toast('تبلیغات فقط داخل Pi Browser و پس از تأیید اپ فعال می‌شود', 'gold');
        else if (res !== 'AD_CLOSED') PiNama.toast('نمایش تبلیغ ناموفق بود', 'red');
      });
    });

    // اشتراک‌گذاری
    el.shareBtn.addEventListener('click', function () { pi.share(); });

    // ریست
    el.resetBtn.addEventListener('click', function () {
      if (window.confirm('همه داده‌های پی‌نما روی این دستگاه پاک شود؟')) {
        S.clearAll();
        location.reload();
      }
    });

    // تازگی داده هنگام بازگشت به تب
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) price.refresh();
    });

    // کشیدن به پایین برای تازه‌سازی (لمسی، در بالای صفحه)
    var touchStartY = null;
    document.addEventListener('touchstart', function (e) {
      if (window.scrollY <= 0 && e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
      } else {
        touchStartY = null;
      }
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (touchStartY == null) return;
      var dy = e.changedTouches[0].clientY - touchStartY;
      touchStartY = null;
      if (dy > 90 && window.scrollY <= 0) {
        price.refresh();
        price.refreshTomanRate();
        PiNama.toast('در حال تازه‌سازی قیمت…');
      }
    }, { passive: true });
  }

  function updateNotifUi(perm) {
    if (perm === 'granted') {
      el.notifEnable.textContent = 'نوتیفیکیشن فعال ✓';
      el.notifEnable.disabled = true;
      el.alertHint.textContent = 'هشدارها با نوتیفیکیشن مرورگر اعلام می‌شوند (وقتی اپ باز باشد).';
    } else if (perm === 'denied') {
      el.notifEnable.textContent = 'نوتیفیکیشن توسط شما رد شده';
      el.notifEnable.disabled = true;
    }
  }

  /* ═══════ راه‌اندازی ═══════ */

  document.addEventListener('DOMContentLoaded', function () {
    toastRoot = $('toast-root');

    el = {
      authBtn: $('auth-btn'),
      envBadge: $('env-badge'),
      offlineBanner: $('offline-banner'),
      liveDot: $('live-dot'),
      priceUsd: $('price-usd'),
      priceChange: $('price-change'),
      priceToman: $('price-toman'),
      priceUpdated: $('price-updated'),
      priceSource: $('price-source'),
      statHigh: $('stat-high'),
      statLow: $('stat-low'),
      statMcap: $('stat-mcap'),
      statVol: $('stat-vol'),
      calcInputLabel: $('calc-input-label'),
      calcInput: $('calc-input'),
      calcResult: $('calc-result'),
      pfHoldings: $('pf-holdings'),
      pfAvg: $('pf-avg'),
      pfUsd: $('pf-usd'),
      pfToman: $('pf-toman'),
      pfPl: $('pf-pl'),
      pfPlValue: $('pf-pl-value'),
      alertDir: $('alert-dir'),
      alertPrice: $('alert-price'),
      alertAdd: $('alert-add'),
      notifEnable: $('notif-enable'),
      alertList: $('alert-list'),
      alertHint: $('alert-hint'),
      accountStatus: $('account-status'),
      logoutBtn: $('logout-btn'),
      rateManualField: $('rate-manual-field'),
      rateManual: $('rate-manual'),
      rateStatus: $('rate-status'),
      watchAdBtn: $('watch-ad-btn'),
      adStatus: $('ad-status'),
      shareBtn: $('share-btn'),
      resetBtn: $('reset-btn'),
      appVersion: $('app-version'),
      chartEl: $('chart'),
      chartTooltip: $('chart-tooltip'),
      chartLoading: $('chart-loading'),
      changeChips: Array.prototype.slice.call(document.querySelectorAll('.change-chips .chip')),
      navBtns: Array.prototype.slice.call(document.querySelectorAll('.nav-btn')),
      tfBtns: Array.prototype.slice.call(document.querySelectorAll('#tf-selector .seg-btn')),
      calcDirBtns: Array.prototype.slice.call(document.querySelectorAll('#calc-dir .seg-btn')),
      rateModeBtns: Array.prototype.slice.call(document.querySelectorAll('#rate-mode .seg-btn')),
      views: Array.prototype.slice.call(document.querySelectorAll('.view'))
    };

    // مقدارهای اولیه فرم‌ها از حافظه
    el.pfHoldings.value = S.get(K.HOLDINGS, C.DEFAULT_HOLDINGS) || '';
    el.pfAvg.value = S.get(K.AVG_BUY, 0) > 0 ? S.get(K.AVG_BUY, 0) : '';
    el.calcInput.value = S.get(K.CALC_INPUT, null) != null
      ? S.get(K.CALC_INPUT, '')
      : (S.get(K.HOLDINGS, C.DEFAULT_HOLDINGS) || '');
    el.rateManual.value = (function () {
      var m = S.get(K.RATE_MANUAL, null);
      return m != null ? m : '';
    })();

    var calcDir = S.get(K.CALC_DIR, 'pi2usd');
    el.calcDirBtns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-dir') === calcDir);
    });

    // سرویس‌ها
    pi.init();
    ads.init().then(renderAdStatus);
    alerts.load();
    price.onChange(onPriceChange);
    price.hydrateFromCache(); // نمایش فوری از کش
    price.refresh();
    price.refreshTomanRate();
    setInterval(function () { price.refresh(); }, C.PRICE_REFRESH_MS);
    setInterval(function () { price.refreshTomanRate(); }, C.RATE_REFRESH_MS);

    chart = new PiNama.Chart(el.chartEl, el.chartTooltip);
    loadChart(currentDays);
    updateAllChangeChips();

    el.appVersion.textContent = 'نسخه ' + C.VERSION + ' — سپتامبر ۲۰۲۶';

    wireEvents();
    renderPrice();
    renderCalc();
    renderPortfolio();
    renderRate();
    renderAccount();
    renderAlertsList();

    el.envBadge.hidden = pi.inPiBrowser;
    if ('Notification' in window) updateNotifUi(Notification.permission);
  });
})();
