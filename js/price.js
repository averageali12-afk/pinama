/* پی‌نما — سرویس قیمت: CoinGecko (اصلی) → OKX (پشتیبان) → کش آفلاین + نرخ تومان */
(function () {
  'use strict';

  var C = PiNama.config;
  var S = PiNama.storage;

  /* ─── قالب‌بندی اعداد ─── */
  PiNama.fmt = {
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
    tomanSource: null,  // 'auto' | 'manual' | 'default'
    tomanAt: null
  };

  var listeners = [];
  var seriesCache = {}; // days -> { data, fetchedAt }

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

  /* ─── منبع ۱: CoinGecko ─── */
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

  /* ─── منبع ۲: OKX ─── */
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

  /* ─── دریافت قیمت ─── */
  function refresh() {
    return fromCoinGecko()
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

  /* ─── سری زمانی نمودار ─── */
  function loadSeries(days) {
    var key = String(days);
    var cached = seriesCache[key] || S.get(C.KEYS.SERIES + key, null);
    var fresh = cached && cached.data && cached.data.length > 1 &&
      (Date.now() - cached.fetchedAt) < C.SERIES_TTL_MS;
    if (fresh) {
      seriesCache[key] = cached;
      return Promise.resolve(cached.data);
    }
    return fetchJson(C.COINGECKO_CHART + days).then(function (json) {
      if (!json || !json.prices || json.prices.length < 2) throw new Error('empty');
      var entry = { data: json.prices, fetchedAt: Date.now() };
      seriesCache[key] = entry;
      S.set(C.KEYS.SERIES + key, entry);
      return entry.data;
    });
  }

  /* ─── نرخ دلار/تومان ─── */
  function parseTomanFromTgju(json) {
    var cur = json && json.current && (json.current.price_dollar_rl || json.current.price_usd);
    var p = cur && cur.p;
    if (!p) return null;
    var v = parseFloat(String(p).replace(/,/g, ''));
    if (isNaN(v) || v <= 0) return null;
    if (v > 1000000) v = v / 10; // اگر به ریال بود به تومان تبدیل کن
    return v;
  }

  function refreshTomanRate() {
    var mode = S.get(C.KEYS.RATE_MODE, 'auto');
    var manual = S.get(C.KEYS.RATE_MANUAL, null);

    if (mode === 'manual') {
      state.tomanRate = manual != null ? manual : C.DEFAULT_TOMAN_RATE;
      state.tomanSource = 'manual';
      state.tomanAt = Date.now();
      emit();
      return Promise.resolve(state.tomanRate);
    }

    return fetchJson(C.TJGU_URL).then(function (json) {
      var v = parseTomanFromTgju(json);
      if (v == null) throw new Error('parse');
      state.tomanRate = v;
      state.tomanSource = 'auto';
      state.tomanAt = Date.now();
      S.set(C.KEYS.RATE_AUTO, v);
      emit();
      return v;
    }).catch(function () {
      state.tomanRate = S.get(C.KEYS.RATE_AUTO, null) || manual || C.DEFAULT_TOMAN_RATE;
      state.tomanSource = state.tomanRate === C.DEFAULT_TOMAN_RATE ? 'default' : 'fallback';
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
    state.tomanRate = S.get(C.KEYS.RATE_AUTO, null) ||
      S.get(C.KEYS.RATE_MANUAL, null) ||
      C.DEFAULT_TOMAN_RATE;
    state.tomanSource = S.get(C.KEYS.RATE_AUTO, null) ? 'fallback' : 'default';
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
