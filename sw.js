/* پی‌نما — Service Worker: کش آفلاین app shell + به‌روزرسانی در پس‌زمینه */
'use strict';

const CACHE = 'pinama-v10';

/* app shell — همه با نسخه‌بندی implicit در CACHE name */
const ASSETS = [
  './',
  './index.html',
  './terms.html',
  './privacy.html',
  './manifest.webmanifest',
  './robots.txt',
  './css/style.css',
  './css/fonts.css',
  './css/fonts/Vazirmatn-Regular.woff2',
  './css/fonts/Vazirmatn-Medium.woff2',
  './css/fonts/Vazirmatn-SemiBold.woff2',
  './css/fonts/Vazirmatn-Bold.woff2',
  './js/config.js',
  './js/storage.js',
  './js/price.js',
  './js/chart.js',
  './js/pi.js',
  './js/ads.js',
  './js/alerts.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/favicon-64.png'
];

/* نصب: پیش‌کش app shell */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // addAll تمام‌یا‌هیچ است؛ یک 404 موقت نباید نصب را بشکند
      return Promise.all(ASSETS.map(function (url) {
        return cache.add(url).catch(function () { /* بعداً دوباره تلاش می‌شود */ });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* فعال‌سازی: کش‌های قدیمی را پاک کن */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* fetch: استراتژی‌ها بر اساس نوع درخواست */
self.addEventListener('fetch', function (event) {
  const req = event.request;
  const url = new URL(req.url);

  /* فقط GET */
  if (req.method !== 'GET') return;

  /* APIهای قیمت/نرخ: فقط network — پاسخ کش‌شده نباید به‌عنوان «زنده» جا بزند.
   * نمایش آفلاین خودِ اپ با snapshot ذخیره‌شده و برچسب «کش» مدیریت می‌شود. */
  const isApi = /api\.coingecko\.com|okx\.com|gateio\.ws|ramzinex\.com|wallex\.ir|tgju\.org/.test(url.hostname);
  if (isApi) {
    event.respondWith(
      fetch(req).catch(function () {
        return new Response(JSON.stringify({ offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  /* سایر منابع (هم‌مبدأ و sdk.minepi.com): stale-while-revalidate */
  const isMine = url.origin === self.location.origin || url.hostname === 'sdk.minepi.com';
  if (!isMine) return;

  event.respondWith(
    caches.match(req).then(function (hit) {
      const fetching = fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || fetching;
    })
  );
});
