/* تست راه‌اندازی کامل پی‌نما — اجرای app.js با DOM شبیه‌سازی‌شده در Node
 * هدف: اطمینان از اینکه مسیر استارت‌آپ (bind عناصر، سرویس‌ها، رندر اولیه) بدون exception کامل می‌شود.
 * اجرا: node test/render.js
 */
'use strict';

/* ─── ابزار stub ─── */
function stubEl(id) {
  return {
    id: id,
    style: {},
    hidden: false,
    value: '',
    textContent: '',
    innerHTML: '',
    title: '',
    className: '',
    _classes: new Set(['seg-btn']),
    classList: {
      add: function (c) { this._s.add(c); },
      remove: function (c) { this._s.delete(c); },
      toggle: function (c, force) {
        if (force === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
        else force ? this._s.add(c) : this._s.delete(c);
      },
      contains: function (c) { return this._s.has(c); },
      _s: new Set()
    },
    listeners: {},
    addEventListener: function (ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
    removeEventListener: function () { },
    appendChild: function (child) { this.children.push(child); },
    removeChild: function (c) { this.children = this.children.filter(function (x) { return x !== c; }); },
    setAttribute: function (k) { this['attr_' + k] = true; },
    removeAttribute: function (k) { delete this['attr_' + k]; },
    getAttribute: function (k) {
      if (k === 'data-view') return id.replace('nav-', '');
      if (k === 'data-days') {
        var m = { 'tf-1': '1', 'tf-7': '7', 'tf-30': '30', 'chip-1': '1', 'chip-7': '7', 'chip-30': '30' };
        return m[id] || '7';
      }
      if (k === 'data-dir') return id === 'cd-target' ? 'target' : id === 'cd-2' ? 'usd2pi' : 'pi2usd';
      if (k === 'data-amount') return id.replace('amt-', '');
      if (k === 'data-mode') return 'auto';
      if (k === 'data-cur') return id === 'cur-toman' ? 'toman' : 'usd';
      return null;
    },
    disabled: false,
    offsetWidth: 100,
    children: [],
    firstChild: null
  };
}

const els = {};
function getEl(id) { if (!els[id]) els[id] = stubEl(id); return els[id]; }

const navIds = ['nav-price', 'nav-portfolio', 'nav-alerts', 'nav-settings'];

global.window = global;
global.name = 'node';
Object.defineProperty(global, 'navigator', {
  value: { userAgent: 'NodeRender/1.0' }, configurable: true
});
global.location = { origin: 'http://localhost:3000', pathname: '/' };

const memStore = {};
global.localStorage = {
  getItem: k => (k in memStore ? memStore[k] : null),
  setItem: (k, v) => { memStore[k] = String(v); },
  removeItem: k => { delete memStore[k]; },
  get length() { return Object.keys(memStore).length; },
  key: i => Object.keys(memStore)[i] || null
};

/* fetch stub: gate ticker + candles + ramzinex موفق؛ بقیه fail */
/* سری کندل: [ts, quote, open, high, low, close, vol, complete] — بازه بالا و پایین واضح */
const CANDLE_ROWS = [
  ['1788500000', '1', '0.0920', '0.0990', '0.0910', '0.0990', '1', 'true'],
  ['1788600000', '1', '0.0990', '0.1000', '0.0980', '0.1000', '1', 'true'],
  ['1788700000', '1', '0.1000', '0.1010', '0.0930', '0.0930', '1', 'true'],
  ['1788800000', '1', '0.0930', '0.0960', '0.0925', '0.0955', '1', 'true']
];
global.fetch = function (url) {
  url = String(url);
  if (url.includes('gateio') && url.includes('tickers')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve([{ last: '0.0955', change_percentage: '-1.2', high_24h: '0.097', low_24h: '0.093', base_volume: '7000000' }]) });
  }
  if (url.includes('gateio') && url.includes('candlesticks')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(CANDLE_ROWS) });
  }
  if (url.includes('ramzinex')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { sell: 2358000, buy: 2354000 } }) });
  }
  return Promise.reject(new Error('blocked: ' + url.slice(0, 40)));
};

/* DOM stub */
const listeners = {};
global.document = {
  getElementById: getEl,
  _title: '',
  get title() { return this._title; },
  set title(v) { this._title = v; },
  querySelectorAll: function (sel) {
    if (sel === '.nav-btn') return navIds.map(getEl);
    if (sel === '#tf-selector .seg-btn') return [getEl('tf-1'), getEl('tf-7'), getEl('tf-30')];
    if (sel === '#calc-dir .seg-btn') return [getEl('cd-1'), getEl('cd-2'), getEl('cd-target')];
    if (sel === '#calc-amounts .chip') return [getEl('amt-1'), getEl('amt-10'), getEl('amt-100'), getEl('amt-1000')];
    if (sel === '#rate-mode .seg-btn') return [getEl('rm-1'), getEl('rm-2')];
    if (sel === '#display-currency .seg-btn') return [getEl('cur-usd'), getEl('cur-toman')];
    if (sel === '.change-chips .chip') return [getEl('chip-1'), getEl('chip-7'), getEl('chip-30')];
    if (sel === '.quick-alerts .btn') return [getEl('quick-plus'), getEl('quick-minus')];
    if (sel === '.view') return ['price', 'portfolio', 'alerts', 'settings'].map(function (v) { return getEl('view-' + v); });
    return [];
  },
  createElement: function (tag) { return stubEl('dyn-' + tag + '-' + Math.random().toString(36).slice(2, 6)); },
  addEventListener: function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  hidden: false
};

global.requestAnimationFrame = function (fn) { setTimeout(fn, 0); };
global.window.addEventListener = function () { };
global.setInterval = function () { return 0; }; // در تست تایمر نداریم
global.ResizeObserver = function () { return { observe: function () { } }; };
global.Path2D = function () {
  this.moveTo = function () { }; this.lineTo = function () { };
  this.closePath = function () { };
};
const ctxStub = {
  setTransform: function () { }, clearRect: function () { },
  beginPath: function () { }, stroke: function () { }, fill: function () { },
  arc: function () { }, fillText: function () { },
  moveTo: function () { }, lineTo: function () { },
  save: function () { }, restore: function () { },
  setLineDash: function () { },
  createLinearGradient: function () { return { addColorStop: function () { } }; },
  set fillStyle (v) { }, get fillStyle () { return ''; },
  set strokeStyle (v) { }, get strokeStyle () { return ''; },
  set lineWidth (v) { }, set lineJoin (v) { }, set lineCap (v) { },
  set font (v) { }, set textAlign (v) { }, set textBaseline (v) { }
};
getEl('chart').getContext = function () { return ctxStub; };
getEl('chart').parentElement = { clientWidth: 380, clientHeight: 190 };

/* Pi SDK stub (لود می‌شود ولی خارج Pi Browser غیرفعال است) */
global.window.Pi = undefined;

/* ─── لود ماژول‌ها به ترتیب index.html ─── */
const fs = require('fs');
const path = require('path');
const files = ['config.js', 'storage.js', 'price.js', 'chart.js', 'pi.js', 'ads.js', 'alerts.js', 'app.js'];
files.forEach(function (f) {
  eval(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'));
});

let failed = 0;
function t(name, cond, extra) {
  if (cond) console.log('  ✓ ' + name);
  else { failed++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

/* seed رگرسیون: pfHistory با رکورد دیروز + ۸ رکورد (مسیر بحرانی todayV و چیپ هفتگی) */
(function seedYesterday() {
  const y = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
  memStore['pinama.v2.pfHistory'] = JSON.stringify([{ d: y, v: 15 * 0.0900 }]);
  // ۸ رکورد برای چیپ هفتگی: [0]=امروز (بعداً push می‌شود)، [1..7]=روزهای قبل با قیمت‌های متفاوت
  const seeds = [{ d: y, v: 1.35 }];
  for (let i = 2; i <= 7; i++) {
    const d = new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA');
    seeds.push({ d: d, v: 15 * (0.0800 + i * 0.001) }); // قدیمی‌ها ~0.082–0.087
  }
  memStore['pinama.v2.pfHistory'] = JSON.stringify(seeds); // ۷ رکورد قبل از امروز
})();

/* اجرای DOMContentLoaded */
(listeners.DOMContentLoaded || []).forEach(function (fn) {
  try { fn(); } catch (e) { console.error('STARTUP CRASH:', e.message, '\n', e.stack.split('\n')[1]); failed++; }
});

setTimeout(function () {
  setTimeout(function () {
    const chip7 = getEl('chip-7');
    t('7d chip updated with pct', String(chip7.textContent).indexOf('%') !== -1 || String(chip7.textContent).indexOf('٪') !== -1, 'got "' + chip7.textContent + '"');

    const st = PiNama.price.state;
    t('startup without crash', true);
    t('price populated from gate', st.usd === 0.0955, 'got ' + st.usd);
    t('toman from ramzinex', st.tomanRate === 235800, 'got ' + st.tomanRate);
    t('price usd rendered', getEl('price-usd').textContent === '$0.0955', 'got "' + getEl('price-usd').textContent + '"');
    t('toman rendered', String(getEl('price-toman').textContent).includes('22,519'), 'got "' + getEl('price-toman').textContent + '"');
    t('source label gate', String(getEl('price-source').textContent).includes('Gate'), 'got "' + getEl('price-source').textContent + '"');
    t('no error banner', getEl('offline-banner').hidden === true);
    t('holdings prefilled 15', String(getEl('pf-holdings').value) === '15', 'got "' + getEl('pf-holdings').value + '"');
    t('version rendered', String(getEl('app-version').textContent).indexOf('1.2.0') !== -1, 'got "' + getEl('app-version').textContent + '"');

    /* واحد نمایش تومان: قیمت بزرگ باید تومان شود */
    try {
      getEl('cur-toman').listeners.click.forEach(function (fn) { fn(); });
      var tomanBig = String(getEl('price-usd').textContent).includes('تومان');
      t('toman-first display toggles', tomanBig, 'got "' + getEl('price-usd').textContent + '"');
      getEl('cur-usd').listeners.click.forEach(function (fn) { fn(); });
      t('usd-first restores', String(getEl('price-usd').textContent).indexOf('$') === 0, 'got "' + getEl('price-usd').textContent + '"');
    } catch (e) { t('toman-first display toggles', false, e.message); }
    t('streak starts at 1 (not shown)', PiNama.storage.get('streak', 0) === 1 && getEl('streak-line').textContent === '', 'streak=' + PiNama.storage.get('streak', 0));
    t('live title set', String(document.title).indexOf('$0.0955') !== -1, 'got "' + document.title + '"');
    t('day change snapshot exists', PiNama.storage.get('pfHistory', []).length === 8, 'len=' + PiNama.storage.get('pfHistory', []).length);
    t('«از دیروز» renders (todayV fix)', String(getEl('pf-day-value').textContent).indexOf('از دیروز') !== -1, 'got "' + getEl('pf-day-value').textContent + '"');
    t('weekly chip uses hist[7] not oldest', String(getEl('pf-week-value').textContent).indexOf('از ۷ روز قبل') !== -1, 'got "' + getEl('pf-week-value').textContent + '"');
    t('30d range line renders', getEl('range-line').textContent.length > 3, 'got "' + getEl('range-line').textContent + '"');

    /* دکمه هشدار سریع +۵٪ */
    try {
      getEl('quick-plus').listeners.click.forEach(function (fn) { fn(); });
      t('quick +5% alert armed', PiNama.alerts.list.some(function (a) { return Math.abs(a.price - 0.0955 * 1.05) < 1e-9; }));
      getEl('nav-alerts').listeners.click.forEach(function (fn) { fn(); });
    } catch (e) { t('quick +5% alert armed', false, e.message); }

    /* ماشین‌حساب سود هدف */
    try {
      getEl('cd-target').listeners.click.forEach(function (fn) { fn(); });
      getEl('calc-input').value = '15';
      // رندر با input event
      getEl('calc-input').listeners.input.forEach(function (fn) { fn(); });
      t('profit table rows render', getEl('profit-table').children.length >= 5, 'rows=' + getEl('profit-table').children.length);
    } catch (e) { t('profit table rows render', false, e.message); }

    /* چیپ مبلغ ۱۰۰۰ */
    try {
      getEl('amt-1000').listeners.click.forEach(function (fn) { fn(); });
      t('amount chip sets input', getEl('calc-input').value === '1000', 'got "' + getEl('calc-input').value + '"');
    } catch (e) { t('amount chip sets input', false, e.message); }

    /* آن‌بوردینگ: بار اول نمایش، بعد از OK ذخیره شود */
    t('onboarding shows first run', getEl('onboarding').hidden === false);
    try {
      getEl('onboarding-ok').listeners.click.forEach(function (fn) { fn(); });
      t('onboarding dismiss persists', getEl('onboarding').hidden === true && PiNama.storage.get('onboarded', false) === true);
    } catch (e) { t('onboarding dismiss persists', false, e.message); }

    /* تعویض تب نباید crash کند */
    try {
      getEl('nav-portfolio').listeners.click.forEach(function (fn) { fn(); });
      t('tab switch without crash', true);
    } catch (e) { t('tab switch without crash', false, e.message); }

    /* کلیک چیپ نباید crash کند */
    try {
      getEl('chip-30').listeners.click.forEach(function (fn) { fn(); });
      t('chip click without crash', true);
    } catch (e) { t('chip click without crash', false, e.message); }

    console.log(failed === 0 ? '\n✅ راه‌اندازی کامل اپ بدون خطا' : '\n❌ ' + failed + ' مشکل در راه‌اندازی');
    process.exit(failed === 0 ? 0 : 1);
  }, 400);
}, 100);
