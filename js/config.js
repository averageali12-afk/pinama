/* پی‌نما — تنظیمات و کلیدهای ذخیره‌سازی */
window.PiNama = window.PiNama || {};

PiNama.config = {
  // منابع قیمت
  COINGECKO_MARKETS:
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=pi-network',
  COINGECKO_CHART:
    'https://api.coingecko.com/api/v3/coins/pi-network/market_chart?vs_currency=usd&days=',
  OKX_TICKER: 'https://www.okx.com/api/v5/market/ticker?instId=PI-USDT',
  // نرخ دلار/تومان
  TJGU_URL: 'https://call1.tgju.org/ajax.json',

  // زمان‌بندی‌ها
  PRICE_REFRESH_MS: 60 * 1000,
  RATE_REFRESH_MS: 10 * 60 * 1000,
  FETCH_TIMEOUT_MS: 12 * 1000,
  SERIES_TTL_MS: 5 * 60 * 1000,

  // پیش‌فرض‌ها
  DEFAULT_TOMAN_RATE: 100000,
  DEFAULT_HOLDINGS: 15,
  INTERSTITIAL_MIN_GAP_MS: 3 * 60 * 1000,

  // ذخیره‌سازی
  PREFIX: 'pinama.v1.',
  KEYS: {
    HOLDINGS: 'holdings',
    AVG_BUY: 'avgBuy',
    ALERTS: 'alerts',
    RATE_MODE: 'rateMode',
    RATE_MANUAL: 'rateManual',
    RATE_AUTO: 'rateAuto',
    USER: 'user',
    LAST_PRICE: 'lastPrice',
    SERIES: 'series.',
    LAST_INTERSTITIAL: 'lastInterstitial',
    CALC_DIR: 'calcDir',
    CALC_INPUT: 'calcInput'
  }
};
