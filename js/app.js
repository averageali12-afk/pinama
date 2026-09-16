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
  var deferredInstall = null;

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
    if (chart && st.usd != null) chart.setReference(st.usd);

    // قیمت زنده در عنوان تب — هماهنگ با واحد نمایش انتخابی
    if (st.usd != null && !st.error) {
      var titleVal = (S.get(K.DISPLAY_CURRENCY, 'usd') === 'toman' && st.tomanRate)
        ? fmt.num(st.usd * st.tomanRate, 0) + ' تومان'
        : fmt.usd(st.usd);
      document.title = 'پی‌نما | ' + titleVal;
    }

    // حالت نمایش: پیش‌فرض دلار-بزرگ؛ تومان-بزرگ برای کاربری که تومان فکر می‌کند
    var tomanVal = (st.usd != null && st.tomanRate) ? st.usd * st.tomanRate : null;
    if (S.get(K.DISPLAY_CURRENCY, 'usd') === 'toman' && tomanVal != null) {
      el.priceUsd.textContent = fmt.num(tomanVal, 0) + ' تومان';
      el.priceToman.textContent = fmt.usd(st.usd);
    } else {
      el.priceUsd.textContent = fmt.usd(st.usd);
      el.priceToman.textContent = tomanVal != null ? fmt.num(tomanVal, 0) + ' تومان' : '—';
    }

    var ch = st.change24h;
    el.priceChange.textContent = ch == null ? '—' : fmt.pct(ch);
    el.priceChange.className = 'price-change ' +
      (ch == null || (!isFinite(ch) || Math.abs(ch) <= 0.05) ? 'flat' : ch > 0 ? 'up' : 'down');

    el.priceUpdated.textContent = st.fetchedAt
      ? 'به‌روزرسانی ' + fmt.clock.format(new Date(st.fetchedAt))
      : 'در انتظار داده…';
    el.priceSource.textContent = 'منبع: ' + (st.source || '—');

    el.liveDot.className = 'live-dot ' +
      (st.usd == null ? '' : st.error ? 'stale' : 'ok');
    el.offlineBanner.hidden = !st.error || st.hydrating;

    el.statHigh.textContent = fmt.usd(st.high24h);
    el.statLow.textContent = fmt.usd(st.low24h);
    el.statMcap.textContent = fmt.compactUsd(st.marketCap);
    el.statVol.textContent = fmt.compactUsd(st.volume24h);
  }

  function renderCalc() {
    var dir = S.get(K.CALC_DIR, 'pi2usd');
    var st = price.state;
    var raw = fmt.parse(el.calcInput.value);

    el.calcInputLabel.textContent = dir === 'pi2usd' ? 'مقدار Pi' : dir === 'usd2pi' ? 'مقدار (تومان)' : 'مقدار Pi';
    el.calcProfitField.hidden = dir !== 'target';
    el.profitTable.hidden = dir !== 'target';

    if (!isFinite(raw) || raw <= 0 || st.usd == null) {
      el.calcResult.textContent = '—';
      el.profitTable.hidden = true;
      return;
    }
    if (dir === 'pi2usd') {
      var usd = raw * st.usd;
      el.calcResult.textContent = fmt.usd(usd, 2) +
        (st.tomanRate ? '   ≈   ' + fmt.num(usd * st.tomanRate, 0) + ' تومان' : '');
    } else if (dir === 'usd2pi') {
      if (!st.tomanRate) {
        el.calcResult.textContent = '—';
        return;
      }
      var piCount = raw / (st.usd * st.tomanRate);
      el.calcResult.textContent = '≈ ' + fmt.num(piCount, 4) + ' PI';
    } else {
      // سود هدف: قیمت فروش لازم برای +۱۰٪ تا +۱۰۰٪
      el.calcResult.textContent = fmt.usd(st.usd, 4) + ' الان';
      var avg = fmt.parse(el.calcProfitAvg.value);
      var base = (isFinite(avg) && avg > 0) ? avg : st.usd; // بدون میانگین، نسبت به الان
      var baseLabel = (isFinite(avg) && avg > 0) ? 'قیمت خرید شما' : 'قیمت الان';
      var table = el.profitTable;
      table.textContent = '';
      var head = document.createElement('div');
      head.className = 'profit-row profit-head';
      head.innerHTML = '';
      var h1 = document.createElement('span');
      h1.textContent = 'هدف';
      var h2 = document.createElement('span');
      h2.textContent = 'قیمت فروش';
      var h3 = document.createElement('span');
      h3.textContent = 'ارزش ' + fmt.num(raw, 2) + ' PI';
      head.appendChild(h1); head.appendChild(h2); head.appendChild(h3);
      table.appendChild(head);
      [10, 25, 50, 100].forEach(function (p) {
        var target = base * (1 + p / 100);
        var row = document.createElement('div');
        row.className = 'profit-row';
        var c1 = document.createElement('span');
        c1.textContent = '+' + p + '٪';
        var c2 = document.createElement('span');
        c2.className = 'ltr';
        c2.textContent = fmt.usd(target, 4) + (isFinite(avg) && avg > 0 ? '' : ' *');
        var c3 = document.createElement('span');
        c3.textContent = st.tomanRate ? fmt.num(target * raw * st.tomanRate, 0) + ' ت' : fmt.usd(target * raw, 0);
        row.appendChild(c1); row.appendChild(c2); row.appendChild(c3);
        table.appendChild(row);
      });
      var note = document.createElement('p');
      note.className = 'hint';
      note.textContent = isFinite(avg) && avg > 0
        ? 'بر مبنای ' + baseLabel + ': ' + fmt.usd(avg, 4)
        : '* برای محاسبه دقیق‌تر، میانگین خرید دلاری‌ات را وارد کن';
      table.appendChild(note);
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
      el.pfDayChange.hidden = true;
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

  /* ═══════ هشدارهای ازدست‌رفته (وقتی اپ باز نبوده) ═══════ */

  function renderMissed() {
    var missed = S.get(K.MISSED, []);
    if (!Array.isArray(missed) || !missed.length) {
      el.missedCard.hidden = true;
      return;
    }
    el.missedCard.hidden = false;
    el.missedList.textContent = '';
    missed.slice(0, 5).forEach(function (m) {
      var li = document.createElement('li');
      li.className = 'alert-item done';
      var span = document.createElement('span');
      span.textContent = m.msg;
      var spacer = document.createElement('span');
      spacer.className = 'spacer';
      var when = document.createElement('small');
      when.className = 'alert-status';
      when.textContent = fmt.clock.format(new Date(m.at));
      li.appendChild(span);
      li.appendChild(spacer);
      li.appendChild(when);
      el.missedList.appendChild(li);
    });
  }

  /* ═══════ استریک روزانه و اسنپ‌شات پرتفوی (با تاریخ محلی) ═══════ */

  function localDayKey() {
    try {
      return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD محلی
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function localYesterdayKey() {
    try {
      return new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
    } catch (e) {
      return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    }
  }

  function updateStreak() {
    try {
      var today = localDayKey();
      var last = S.get(K.LAST_OPEN, null);
      var streak = S.get(K.STREAK, 0);
      if (last !== today) {
        streak = (last === localYesterdayKey()) ? streak + 1 : 1;
        S.set(K.STREAK, streak);
        S.set(K.LAST_OPEN, today);
      }
      // فقط از روز دوم نمایش داده می‌شود — مزاحم کاربر جدید نیست
      if (streak >= 2) {
        el.streakLine.textContent = '🔥 ' + fmt.num(streak, 0) + ' روز پشت‌سرهم اینجا بودی';
        el.streakLine.hidden = false;
      }
    } catch (e) { /* تاریخ در دسترس نیست — بی‌خیال استریک */ }
  }

  /** یک‌بار در روز: ارزش فعلی پرتفوی را ثبت کن و تغییر نسبت به دیروز را برگردان */
  function snapshotPortfolio() {
    var st = price.state;
    if (st.error || st.usd == null) return;
    var h = fmt.parse(el.pfHoldings.value);
    if (!isFinite(h) || h <= 0) return;
    var today = localDayKey();
    var hist = S.get(K.PF_HISTORY, []);
    if (!Array.isArray(hist)) hist = [];
    if (!hist.length || hist[0].d !== today) {
      S.push(K.PF_HISTORY, { d: today, v: h * st.usd }, 60);
      hist = S.get(K.PF_HISTORY, []);
    }
    // نزدیک‌ترین رکورد قبل از امروز
    var prev = null;
    for (var i = 0; i < hist.length; i++) {
      if (hist[i].d !== today) { prev = hist[i]; break; }
    }
    if (prev && prev.v > 0) {
      // تغییر ارزش = تغییر قیمت (فرض موجودی ثابت بین دو روز)
      var todayV = h * st.usd;
      var pct = (todayV / prev.v - 1) * 100;
      el.pfDayChange.hidden = false;
      el.pfDayChange.className = 'pf-pl ' + (pct >= 0 ? 'gain' : 'loss');
      el.pfDayValue.textContent = (pct >= 0 ? '▲ ' : '▼ ') + fmt.pct(pct) + ' از دیروز';

      // هفتگی: نسبت به رکورد ~۷ روز قبل (اگر تاریخچه کافی باشد)
      if (hist.length >= 8) {
        var week = hist[hist.length - 8]; // قدیمی‌ترین رکورد با سقف ۶۰
        if (week && week.v > 0) {
          var wpct = (todayV / week.v - 1) * 100;
          el.pfWeekChange.hidden = false;
          el.pfWeekChange.className = 'pf-pl ' + (wpct >= 0 ? 'gain' : 'loss');
          el.pfWeekValue.textContent = (wpct >= 0 ? '▲ ' : '▼ ') + fmt.pct(wpct) + ' از ۷ روز قبل';
        }
      } else {
        el.pfWeekChange.hidden = true;
      }
    }
  }

  /* ═══════ چیپ‌های بازه‌ای ═══════ */

  function updateChangeChip(days) {
    price.loadSeries(days).then(function (data) {
      if (!data || data.length < 2) return;
      var first = data[0][1], last = data[data.length - 1][1];
      if (!isFinite(first) || first <= 0) return;
      var pct = (last / first - 1) * 100;
      var chip = null;
      for (var c = 0; c < el.changeChips.length; c++) {
        if (parseInt(el.changeChips[c].getAttribute('data-days'), 10) === days) {
          chip = el.changeChips[c];
          break;
        }
      }
      if (!chip) return;
      chip.textContent = (days === 1 ? '۲۴ ساعت ' : days === 7 ? '۷ روز ' : '۳۰ روز ') + fmt.pct(pct);
      chip.classList.remove('up', 'down');
      chip.classList.add(pct >= 0 ? 'up' : 'down');

      // موقعیت قیمت در بازه ۳۰ روزه — قلاب روزانه «چند مانده تا سقف/کف»
      if (days === 30) {
        var st = price.state;
        if (st.usd == null || st.error) return;
        var hi = -Infinity, lo = Infinity;
        for (var i = 0; i < data.length; i++) {
          if (data[i][1] > hi) hi = data[i][1];
          if (data[i][1] < lo) lo = data[i][1];
        }
        if (hi <= lo || hi <= 0) return;
        var toHi = (hi / st.usd - 1) * 100;
        var aboveLo = (st.usd / lo - 1) * 100;
        var msg;
        if (toHi <= 0.5) {
          msg = '📍 همین الان سقف ۳۰ روزه است — ' + fmt.usd(hi);
        } else if (aboveLo <= 0.5) {
          msg = '🩸 کف ۳۰ روزه است — ' + fmt.usd(lo);
        } else if (toHi < aboveLo) {
          msg = '🎯 ' + fmt.pct(-toHi).replace('-', '') + ' مانده تا سقف ۳۰ روزه';
        } else {
          msg = '🪂 ' + fmt.pct(aboveLo) + ' بالاتر از کف ۳۰ روزه';
        }
        el.rangeLine.textContent = msg;
        el.rangeLine.hidden = false;
      }
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
      // برچسب کهنه با همان TTL که loadSeries استفاده می‌کند (۲۴ساعت=۵دقیقه، بقیه=۱ساعت)
      var ttl = days === 1 ? C.SERIES_TTL_MS : C.CHART_TTL_MS;
      var entry = S.get(K.SERIES + days, null);
      if (entry && entry.fetchedAt && Date.now() - entry.fetchedAt > ttl) {
        el.chartLoading.textContent = 'نمودار کهنه — اتصال برقرار نشد';
        el.chartLoading.style.display = 'grid';
      } else {
        el.chartLoading.style.display = 'none';
      }
    }).catch(function () {
      el.chartLoading.textContent = 'نمودار موقتاً در دسترس نیست — برای تلاش مجدد لمس کنید';
    });  }

  /* ═══════ هشدارها ═══════ */

  function notify(body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var opts = { body: body, tag: tag || 'pinama-alert', icon: 'icons/icon-192.png' };
    // در PWA نصب‌شده سازنده Notification کار نمی‌کند — از registration استفاده کن
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(function (reg) {
        reg.showNotification('پی‌نما', opts).catch(function () { });
      }).catch(function () { });
    } else {
      try { new Notification('پی‌نما', opts); } catch (e) { /* بعضی WebView ها اجازه نمی‌دهند */ }
    }
  }

  function checkAlerts(usd) {
    // فقط با قیمت تازه؛ قیمت کش/کهنه نباید هشدار کاذب فعال کند
    if (price.state.error) return;
    var fired = alerts.check(usd);
    if (!fired.length) return;
    fired.forEach(function (a) {
      var msg = '🎯 Pi ' + (a.dir === 'above' ? 'رسید بالای' : 'افتاد زیر') + ' ' + fmt.usd(a.price);
      PiNama.toast(msg, 'gold');
      notify(msg, 'pinama-' + a.id);
      // بازخورد فیزیکی — نوتیفیکیشن ناپایدار است ولی ویبره در WebView قطعی است
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      S.push(K.MISSED, { msg: msg, at: Date.now(), id: a.id }, 30);
    });
    renderAlertsList();
    renderMissed();
  }

  function onPriceChange() {
    renderPrice();
    renderCalc();
    renderPortfolio();
    renderRate();
    renderAlertsList(); // فاصله‌های «چند ٪ مانده» زنده بمانند
    checkAlerts(price.state.usd);
    if (!price.state.error) {
      updateAllChangeChips();
      snapshotPortfolio();
    }
  }

  /* ═══════ ناوبری ═══════ */

  var currentView = 'price';

  function switchView(name, fromPop) {
    // تکراری: دکمه فعال/دوبل‌تپ نباید تاریخ dead-push کند یا تبلیغ بزند
    if (name === currentView && !fromPop) return;
    currentView = name;
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
    // دکمه back اندروید باید به تب قبلی برگردد نه خروج از اپ
    if (!fromPop && typeof history !== 'undefined' && history.pushState) {
      try { history.pushState({ view: name }, ''); } catch (e) { /* حالت ویژه */ }
    }
  }

  /* ═══════ رویدادها ═══════ */

  function wireEvents() {
    // ناوبری پایین
    el.navBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-view');
        if (target === currentView) return; // تب فعال — هیچ کاری نکن
        switchView(target);
        // تبلیغ فقط در ناوبری رو به جلو — دکمه back هرگز تبلیغ نشان نمی‌دهد
        ads.maybeShowInterstitial().catch(function () { });
      });
    });

    // دکمه back اندروید → تب قبلی (اولین back = قیمت، بعد خروج)
    if (typeof history !== 'undefined' && history.replaceState) {
      try { history.replaceState({ view: 'price' }, ''); } catch (e) { /* noop */ }
      window.addEventListener('popstate', function (e) {
        switchView((e.state && e.state.view) || 'price', true);
      });
    }

    // لمس «— تومان» وقتی نرخ در دسترس نیست → راهنمایی به نرخ دستی
    el.priceToman.addEventListener('click', function () {
      if (price.state.tomanRate != null) return; // فقط وقتی نرخ نداریم راهنمایی کن
      if (!price.state.tomanAt) {
        // هنوز هیچ تلاشی کامل نشده — چند ثانیه صبر، مدل دستی را قفل نکن
        PiNama.toast('در حال دریافت نرخ دلار…', 'gold');
        return;
      }
      S.set(K.RATE_MODE, 'manual');
      price.setRateMode('manual').then(function () {
        switchView('settings');
        setTimeout(function () {
          el.rateManual.focus();
          PiNama.toast('نرخ دلار را دستی وارد کن (مثلاً ۱۰۰٬۰۰۰)', 'gold');
        }, 350);
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
    // میانگین خرید ماشین‌حساب سود = همان AVG_BUY پرتفوی (یک منبع حقیقت)
    el.calcProfitAvg.addEventListener('input', function () {
      var v = fmt.parse(el.calcProfitAvg.value);
      S.set(K.AVG_BUY, isFinite(v) && v > 0 ? v : 0);
      if (el.pfAvg.value !== el.calcProfitAvg.value) el.pfAvg.value = el.calcProfitAvg.value;
      renderCalc();
      renderPortfolio();
    });

    // چیپ‌های مبلغ سریع ماشین‌حساب
    el.calcAmountBtns.forEach(function (chip) {
      chip.addEventListener('click', function () {
        el.calcInput.value = chip.getAttribute('data-amount');
        S.set(K.CALC_INPUT, el.calcInput.value);
        renderCalc();
      });
    });

    // پرتفوی: دکمه اشتراک وضعیت
    el.pfShare.addEventListener('click', function () {
      var st = price.state;
      var h = fmt.parse(el.pfHoldings.value);
      if (!isFinite(h) || h <= 0 || st.usd == null) {
        PiNama.toast('اول موجودی را وارد کن', 'red');
        return;
      }
      var usd = h * st.usd;
      var text = '💰 ' + fmt.num(h, 2) + ' PI ≈ ' + fmt.usd(usd, 2) +
        (st.tomanRate ? ' (' + fmt.num(usd * st.tomanRate, 0) + ' تومان)' : '') +
        '\nبا اپ پی‌نما دنبالش می‌کنم 📈\n' + (location.origin + location.pathname);
      if (navigator.share) {
        navigator.share({ text: text, url: location.origin + location.pathname }).catch(function () { });
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          PiNama.toast('متن وضعیت کپی شد 📋', 'gold');
        }).catch(function () { });
      }
    });

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
      var item = alerts.add(el.alertDir.value, fmt.parse(el.alertPrice.value), price.state.usd);
      if (!item) {
        PiNama.toast('قیمت معتبری وارد کنید', 'red');
        return;
      }
      el.alertPrice.value = '';
      renderAlertsList();
      if (item.duplicate) {
        PiNama.toast('این هشدار از قبل ثبت بود', 'gold');
      } else if (item.preMet) {
        PiNama.toast('این قیمت الان رد شده — به‌عنوان فعال‌شده ثبت شد', 'gold');
      } else {
        PiNama.toast('هشدار ثبت شد ✓');
      }
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

    el.missedClear.addEventListener('click', function () {
      S.remove(K.MISSED);
      renderMissed();
    });

    // هشدارهای سریع ±۵٪ نسبت به قیمت فعلی
    function addQuickAlert(dir, factor) {
      var st = price.state;
      if (st.usd == null || st.error) {
        PiNama.toast('قیمت فعلی در دسترس نیست', 'red');
        return;
      }
      var item = alerts.add(dir, st.usd * factor, st.usd);
      if (item) {
        renderAlertsList();
        if (item.preMet) {
          PiNama.toast('این قیمت الان رد شده — به‌عنوان فعال‌شده ثبت شد', 'gold');
        } else {
          PiNama.toast('هشدار روی ' + fmt.usd(item.price) + ' ثبت شد ✓', 'gold');
        }
      }
    }
    el.quickPlus.addEventListener('click', function () { addQuickAlert('above', 1.05); });
    el.quickMinus.addEventListener('click', function () { addQuickAlert('below', 0.95); });

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

    // واحد نمایش
    el.currencyBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        el.currencyBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        S.set(K.DISPLAY_CURRENCY, btn.getAttribute('data-cur'));
        renderPrice();
      });
    });

    // اشتراک‌گذاری
    el.shareBtn.addEventListener('click', function () { pi.share(); });

    // نصب PWA
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredInstall = e;
      el.installBtn.hidden = false;
    });
    el.installBtn.addEventListener('click', function () {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      deferredInstall.userChoice.then(function () {
        deferredInstall = null;
        el.installBtn.hidden = true;
      }).catch(function () { });
    });
    window.addEventListener('appinstalled', function () {
      el.installBtn.hidden = true;
      PiNama.toast('پی‌نما روی گوشی نصب شد 🎉', 'gold');
    });

    // ریست — تأیید دو مرحله‌ای (دیالوگ‌های native در WebView ناپایدارند)
    var resetArmed = null;
    el.resetBtn.addEventListener('click', function () {
      if (resetArmed) {
        clearTimeout(resetArmed);
        resetArmed = null;
        el.resetBtn.textContent = 'پاک‌کردن همه داده‌ها';
        S.clearAll();
        location.reload();
        return;
      }
      el.resetBtn.textContent = 'مطمئنی؟ دوباره بزن';
      resetArmed = setTimeout(function () {
        resetArmed = null;
        el.resetBtn.textContent = 'پاک‌کردن همه داده‌ها';
      }, 3000);
    });

    // تازگی داده + استریک هنگام بازگشت به اپ (بدون reload، DOMContentLoaded دیگر fire نمی‌شود)
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        price.refresh();
        price.refreshTomanRate();
        updateStreak();
      }
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
      calcProfitField: $('calc-profit-field'),
      calcProfitAvg: $('calc-profit-avg'),
      profitTable: $('profit-table'),
      calcAmountBtns: Array.prototype.slice.call(document.querySelectorAll('#calc-amounts .chip')),
      pfHoldings: $('pf-holdings'),
      pfAvg: $('pf-avg'),
      pfUsd: $('pf-usd'),
      pfToman: $('pf-toman'),
      pfPl: $('pf-pl'),
      pfPlValue: $('pf-pl-value'),
      pfDayChange: $('pf-day-change'),
      pfDayValue: $('pf-day-value'),
      pfWeekChange: $('pf-week-change'),
      pfWeekValue: $('pf-week-value'),
      pfShare: $('pf-share'),
      alertDir: $('alert-dir'),
      alertPrice: $('alert-price'),
      alertAdd: $('alert-add'),
      notifEnable: $('notif-enable'),
      quickPlus: $('quick-plus'),
      quickMinus: $('quick-minus'),
      alertList: $('alert-list'),
      alertHint: $('alert-hint'),
      missedCard: $('missed-card'),
      missedList: $('missed-list'),
      missedClear: $('missed-clear'),
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
      installBtn: $('install-btn'),
      streakLine: $('streak-line'),
      chartEl: $('chart'),
      chartTooltip: $('chart-tooltip'),
      chartLoading: $('chart-loading'),
      changeChips: Array.prototype.slice.call(document.querySelectorAll('.change-chips .chip')),
      rangeLine: $('range-line'),
      navBtns: Array.prototype.slice.call(document.querySelectorAll('.nav-btn')),
      tfBtns: Array.prototype.slice.call(document.querySelectorAll('#tf-selector .seg-btn')),
      calcDirBtns: Array.prototype.slice.call(document.querySelectorAll('#calc-dir .seg-btn')),
      rateModeBtns: Array.prototype.slice.call(document.querySelectorAll('#rate-mode .seg-btn')),
      currencyBtns: Array.prototype.slice.call(document.querySelectorAll('#display-currency .seg-btn')),
      views: Array.prototype.slice.call(document.querySelectorAll('.view'))
    };

    // مقدارهای اولیه فرم‌ها از حافظه
    el.pfHoldings.value = S.get(K.HOLDINGS, C.DEFAULT_HOLDINGS) || '';
    el.pfAvg.value = S.get(K.AVG_BUY, 0) > 0 ? S.get(K.AVG_BUY, 0) : '';
    el.calcProfitAvg.value = el.pfAvg.value; // یک منبع حقیقت: میانگین خرید مشترک
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

    // واحد نمایش ذخیره‌شده
    var cur = S.get(K.DISPLAY_CURRENCY, 'usd');
    el.currencyBtns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-cur') === cur);
    });

    // سرویس‌ها
    pi.init();
    ads.init().then(renderAdStatus);
    alerts.load();
    price.onChange(onPriceChange);
    price.hydrateFromCache(); // نمایش فوری از کش
    price.refresh();
    price.refreshTomanRate();
    setInterval(function () {
      if (!document.hidden) price.refresh(); // در بک‌گراند poll نکن — صرفه‌جویی دیتا و باتری
    }, C.PRICE_REFRESH_MS);
    setInterval(function () {
      if (!document.hidden) price.refreshTomanRate();
    }, C.RATE_REFRESH_MS);

    chart = new PiNama.Chart(el.chartEl, el.chartTooltip);
    loadChart(currentDays);
    updateAllChangeChips();
    updateStreak();

    el.appVersion.textContent = 'نسخه ' + C.VERSION + ' — سپتامبر ۲۰۲۶';

    wireEvents();
    renderPrice();
    renderCalc();
    renderPortfolio();
    renderRate();
    renderAccount();
    renderAlertsList();
    renderMissed();

    el.envBadge.hidden = pi.inPiBrowser;
    if ('Notification' in window) updateNotifUi(Notification.permission);

    // میان‌بُر PWA (لمس طولانی آیکون): #alerts / #portfolio / #settings
    var hash = (location.hash || '').replace('#', '');
    if (['portfolio', 'alerts', 'settings'].indexOf(hash) !== -1) {
      switchView(hash);
    }
  });
})();
