/* پی‌نما — سرویس قیمت: CoinGecko (اصلی) → OKX (پشتیبان) → کش آفلاین + نرخ تومان */
(function () {
  'use strict';

  var C = PiNama.config;
  var S = PiNama.storage;

  /* ─── قالب‌بندی اعداد ─── */
  PiNama.fmt = {
    /** تبدیل ارقام فارسی/عربی به لاتین برای parseFloat (کیبورد فارسی) */
    latinDigits: function (s) {
      return String(s)
        .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
        .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); });
    },
    /** parseFloat مقاوم به ارقام فارسی، ممیز فارسی و جداکننده هزارگان */
    parse: function (s) {
      if (s == null) return NaN;
      var v = parseFloat(
        PiNama.fmt.latinDigits(String(s))
          .replace(/٫/g, '.') // ممیز فارسی/عربی → نقطه
          .replace(/,/g, '')  // جداکننده هزارگان
      );
      return isFinite(v) ? v : NaN;
    },
    num: function (v, maxFrac) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      return Number(v).toLocaleString('en-US', { maximumFractionDigits: maxFrac == null ? 2 : maxFrac });
    },
    usd: function (v, digits) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      var d = digits == null ? 4 : digits;
      return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    },
    pct: function (v) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      return (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%';
    },
    compactUsd: function (v) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      var abs = Math.abs(v);
      if (abs >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
      if (abs >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
      if (abs >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
      return '$' + v.toFixed(0);
    },
    clock: new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    dateShort: new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  };

  /* ─── وضعیت ─── */
  var state = {
    usd: null,
    change24h: null,
    high24h: null,
    low24h: null,
    marketCap: null,
    volume24h: null,
    source: null,
    fetchedAt: null,
    error: false,       // آخرین دریافت کامل شکست خورد
    tomanRate: null,    // نرخ فعلی
    tomanSource: null,  // 'auto' | 'manual' | 'fallback' | 'none'
    tomanAt: null
  };

  var listeners = [];
  var seriesCache = {}; // days -> { data, fetchedAt }
  var seriesInflight = {}; // days -> Promise (هم‌زمانی درخواست‌ها را ادغام می‌کند)

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { /* یک شنونده نباید بقیه را بشکند */ }
    });
  }

  function fetchJson(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, C.FETCH_TIMEOUT_MS) : null;
    var opts = { cache: 'no-store' };
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(url, opts).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }

  /* ─── منبع ۱: Gate.io (در ایران قابل دسترس) ─── */
  function fromGate() {
    return fetchJson(C.GATE_TICKER).then(function (rows) {
      var r = rows && rows[0];
      if (!r || !r.last) throw new Error('empty');
      var last = parseFloat(r.last);
      return {
        usd: last,
        change24h: r.change_percentage != null ? parseFloat(r.change_percentage) : null,
        high24h: parseFloat(r.high_24h || 'NaN'),
        low24h: parseFloat(r.low_24h || 'NaN'),
        marketCap: null,
        volume24h: parseFloat(r.base_volume || 'NaN'),
        source: 'Gate.io'
      };
    });
  }

  /* ─── منبع ۲: CoinGecko ─── */
  function fromCoinGecko() {
    return fetchJson(C.COINGECKO_MARKETS).then(function (rows) {
      if (!rows || !rows.length) throw new Error('empty');
      var r = rows[0];
      return {
        usd: r.current_price,
        change24h: r.price_change_percentage_24h,
        high24h: r.high_24h,
        low24h: r.low_24h,
        marketCap: r.market_cap,
        volume24h: r.total_volume,
        source: 'CoinGecko'
      };
    });
  }

  /* ─── منبع ۳: OKX ─── */
  function fromOkx() {
    return fetchJson(C.OKX_TICKER).then(function (json) {
      var d = json && json.data && json.data[0];
      if (!d || !d.last) throw new Error('empty');
      var last = parseFloat(d.last);
      var open = parseFloat(d.open24h || '0');
      return {
        usd: last,
        change24h: open > 0 ? ((last - open) / open) * 100 : null,
        high24h: parseFloat(d.high24h || 'NaN'),
        low24h: parseFloat(d.low24h || 'NaN'),
        marketCap: null,
        volume24h: null,
        source: 'OKX'
      };
    });
  }

  /* ─── دریافت قیمت: اولین منبع موفق برنده ─── */
  function refresh() {
    return fromGate()
      .catch(function () { return fromCoinGecko(); })
      .catch(function () { return fromOkx(); })
      .then(function (snap) {
        state.usd = snap.usd;
        state.change24h = snap.change24h;
        state.high24h = snap.high24h;
        state.low24h = snap.low24h;
        state.marketCap = snap.marketCap;
        state.volume24h = snap.volume24h;
        state.source = snap.source;
        state.fetchedAt = Date.now();
        state.error = false;
        S.set(C.KEYS.LAST_PRICE, snap);
        emit();
        return state;
      })
      .catch(function () {
        // هر دو منبع شکست خوردند — snapshot ذخیره‌شده (اگر هست) را «کهنه» نشان بده
        var cached = S.get(C.KEYS.LAST_PRICE, null);
        state.error = true;
        if (cached && cached.usd) {
          state.usd = cached.usd;
          state.change24h = cached.change24h;
          state.high24h = cached.high24h;
          state.low24h = cached.low24h;
          state.marketCap = cached.marketCap;
          state.volume24h = cached.volume24h;
          state.source = cached.source + ' (کش)';
          if (!state.fetchedAt) state.fetchedAt = Date.now();
        }
        emit();
        return state;
      });
  }

  /* ─── سری زمانی نمودار: CoinGecko، سپس Gate.io ─── */
  function seriesFromGate(days) {
    var tf = C.GATE_TF[days] || C.GATE_TF[7];
    return fetchJson(C.GATE_CANDLES + tf.interval + '&limit=' + tf.count)
      .then(function (rows) {
        if (!rows || rows.length < 2) throw new Error('empty');
        // کندل: [timestamp, quote_volume, open, high, low, close, base_volume, complete]
        // close می‌گیریم تا آخرین نقطه ≈ قیمت فعلی باشد
        return rows.map(function (r) { return [r[0] * 1000, parseFloat(r[5])]; });
      });
  }

  function loadSeries(days) {
    var key = String(days);
    var cached = seriesCache[key] || S.get(C.KEYS.SERIES + key, null);
    var ttl = days === 1 ? C.SERIES_TTL_MS : C.CHART_TTL_MS;
    var fresh = cached && cached.data && cached.data.length > 1 &&
      (Date.now() - cached.fetchedAt) < ttl;
    if (fresh) {
      seriesCache[key] = cached;
      return Promise.resolve(cached.data);
    }
    if (seriesInflight[key]) return seriesInflight[key];

    seriesInflight[key] = seriesFromGate(days)
      .catch(function () {
        return fetchJson(C.COINGECKO_CHART + days).then(function (json) {
          if (!json || !json.prices || json.prices.length < 2) throw new Error('empty');
          return json.prices;
        });
      })
      .then(function (data) {
        var entry = { data: data, fetchedAt: Date.now() };
        seriesCache[key] = entry;
        S.set(C.KEYS.SERIES + key, entry);
        return entry.data;
      })
      .finally(function () {
        delete seriesInflight[key];
      });

    return seriesInflight[key];
  }

  /* ─── نرخ دلار/تومان: Wallex (رایگان و در دسترس) → tgju ─── */
  function parseTomanFromTgju(json) {
    var cur = json && json.current && (json.current.price_dollar_rl || json.current.price_usd);
    var p = cur && cur.p;
    if (!p) return null;
    var v = parseFloat(String(p).replace(/,/g, ''));
    if (isNaN(v) || v <= 0) return null;
    if (v > 1000000) v = v / 10; // اگر به ریال بود به تومان تبدیل کن
    return v;
  }

  function plausibleRate(v) {
    return isFinite(v) && v >= C.TOMAN_MIN && v <= C.TOMAN_MAX;
  }

  function fromWallex() {
    // رمضینکس: usdt/irr، جفت ۱۱ — قیمت‌ها به ریال
    return fetchJson(C.RAMZINEX_USDTIRR).then(function (json) {
      var p = json && json.data;
      if (!p) throw new Error('empty');
      var rial = parseFloat(p.sell != null ? p.sell : p.buy);
      if (!isFinite(rial) || rial <= 0) {
        var f = p.financial && p.financial.last24h && p.financial.last24h.close;
        rial = parseFloat(f);
      }
      if (!isFinite(rial) || rial <= 0) throw new Error('empty');
      return rial / 10; // ریال → تومان
    });
  }

  function refreshTomanRate() {
    var mode = S.get(C.KEYS.RATE_MODE, 'auto');
    var manual = S.get(C.KEYS.RATE_MANUAL, null);

    if (mode === 'manual') {
      var m = manual != null && plausibleRate(manual) ? manual : null;
      state.tomanRate = m;
      state.tomanSource = m != null ? 'manual' : 'none';
      state.tomanAt = Date.now();
      emit();
      return Promise.resolve(state.tomanRate);
    }

    return fromWallex()
      .catch(function () {
        return fetchJson(C.TJGU_URL).then(function (json) {
          var v = parseTomanFromTgju(json);
          if (v == null) throw new Error('parse');
          return v;
        });
      })
      .then(function (v) {
        var toman = plausibleRate(v) ? v : null;
        if (toman == null) throw new Error('implausible rate: ' + v);
        state.tomanRate = toman;
        state.tomanSource = 'auto';
        state.tomanAt = Date.now();
        S.set(C.KEYS.RATE_AUTO, toman);
        emit();
        return toman;
      })
      .catch(function () {
        // کش آخرین نرخ معتبر؛ بدون آن null → UI درخواست ورود دستی می‌کند
        var cached = S.get(C.KEYS.RATE_AUTO, null);
        var manual = S.get(C.KEYS.RATE_MANUAL, null);
        state.tomanRate = (cached != null && plausibleRate(cached)) ? cached
          : (manual != null && plausibleRate(manual)) ? manual
            : null;
        state.tomanSource = state.tomanRate != null ? 'fallback' : 'none';
        state.tomanAt = Date.now();
        emit();
        return state.tomanRate;
      });
  }

  function setManualRate(v) {
    S.set(C.KEYS.RATE_MANUAL, v);
    if (S.get(C.KEYS.RATE_MODE, 'auto') === 'manual') {
      state.tomanRate = v;
      state.tomanSource = 'manual';
      emit();
    }
  }

  function setRateMode(mode) {
    S.set(C.KEYS.RATE_MODE, mode);
    return refreshTomanRate();
  }

  /* ─── راه‌اندازی اولیه با کش ─── */
  function hydrateFromCache() {
    var cached = S.get(C.KEYS.LAST_PRICE, null);
    if (cached && cached.usd) {
      state.usd = cached.usd;
      state.change24h = cached.change24h;
      state.high24h = cached.high24h;
      state.low24h = cached.low24h;
      state.marketCap = cached.marketCap;
      state.volume24h = cached.volume24h;
      state.source = cached.source + ' (کش)';
      state.error = true; // تا رسیدن پاسخ زنده، وضعیت «کهنه» است
    }
    var rateCached = S.get(C.KEYS.RATE_AUTO, null);
    var rateManual = S.get(C.KEYS.RATE_MANUAL, null);
    if (S.get(C.KEYS.RATE_MODE, 'auto') === 'manual' && rateManual != null && plausibleRate(rateManual)) {
      state.tomanRate = rateManual;
      state.tomanSource = 'manual';
    } else if (rateCached != null && plausibleRate(rateCached)) {
      state.tomanRate = rateCached;
      state.tomanSource = 'fallback';
    } else if (rateManual != null && plausibleRate(rateManual)) {
      state.tomanRate = rateManual;
      state.tomanSource = 'manual';
    } else {
      state.tomanRate = null;
      state.tomanSource = 'none';
    }
    emit();
  }

  PiNama.price = {
    state: state,
    onChange: function (fn) { listeners.push(fn); },
    refresh: refresh,
    loadSeries: loadSeries,
    refreshTomanRate: refreshTomanRate,
    setManualRate: setManualRate,
    setRateMode: setRateMode,
    hydrateFromCache: hydrateFromCache
  };
})();
