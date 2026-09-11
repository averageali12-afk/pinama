/* پی‌نما — تنظیمات و کلیدهای ذخیره‌سازی */
window.PiNama = window.PiNama || {};

PiNama.config = {
  // منابع قیمت — به ترتیب امتحان می‌شوند (اولین موفق برنده)
  GATE_TICKER: 'https://api.gateio.ws/api/v4/spot/tickers?currency_pair=PI_USDT',
  GATE_CANDLES: 'https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=PI_USDT&interval=',
  COINGECKO_MARKETS:
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=pi-network',
  COINGECKO_CHART:
    'https://api.coingecko.com/api/v3/coins/pi-network/market_chart?vs_currency=usd&days=',
  OKX_TICKER: 'https://www.okx.com/api/v5/market/ticker?instId=PI-USDT',
  // نرخ دلار/تومان — به ترتیب (تمام Cors آزاد از مرورگر)
  RAMZINEX_USDTIRR: 'https://publicapi.ramzinex.com/exchange/api/v1.0/exchange/pairs/11',
  TJGU_URL: 'https://call1.tgju.org/ajax.json',
  // بازه باورپذیر نرخ دلار (تومان) — خارج از آن رد می‌شود
  TOMAN_MIN: 50000,
  TOMAN_MAX: 900000,

  // تایم‌فریم‌های نمودار → (gate interval, count)
  GATE_TF: {
    1: { interval: '30m', count: 48 },   // ۲۴ ساعت
    7: { interval: '4h', count: 42 },   // ۷ روز
    30: { interval: '12h', count: 60 }  // ۳۰ روز
  },

  // زمان‌بندی‌ها
  PRICE_REFRESH_MS: 60 * 1000,
  RATE_REFRESH_MS: 10 * 60 * 1000,
  FETCH_TIMEOUT_MS: 9 * 1000,
  SERIES_TTL_MS: 5 * 60 * 1000,
  CHART_TTL_MS: 60 * 60 * 1000,

  // پیش‌فرض‌ها
  DEFAULT_TOMAN_RATE: null, // نرخ واقعی باید از API بیاید؛ بدون آن نمایش «—» صادقانه‌تر است
  DEFAULT_HOLDINGS: 15,
  INTERSTITIAL_MIN_GAP_MS: 3 * 60 * 1000,

  // ذخیره‌سازی
  PREFIX: 'pinama.v2.',
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
