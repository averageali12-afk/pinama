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
    appendChild: function () { },
    removeChild: function () { },
    setAttribute: function (k) { this['attr_' + k] = true; },
    removeAttribute: function (k) { delete this['attr_' + k]; },
    getAttribute: function (k) {
      if (k === 'data-view') return id.replace('nav-', '');
      if (k === 'data-days') return '7';
      if (k === 'data-dir') return 'pi2usd';
      if (k === 'data-mode') return 'auto';
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
global.fetch = function (url) {
  url = String(url);
  if (url.includes('gateio') && url.includes('tickers')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve([{ last: '0.0955', change_percentage: '-1.2', high_24h: '0.097', low_24h: '0.093', base_volume: '7000000' }]) });
  }
  if (url.includes('gateio') && url.includes('candlesticks')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve([
      ['1788552000', '1', '0.0940', '0.095', '0.093', '0.0941', '1', 'true'],
      ['1788566400', '1', '0.0941', '0.096', '0.094', '0.0948', '1', 'true']
    ]) });
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
  querySelectorAll: function (sel) {
    if (sel === '.nav-btn') return navIds.map(getEl);
    if (sel === '#tf-selector .seg-btn') return [getEl('tf-1'), getEl('tf-7'), getEl('tf-30')];
    if (sel === '#calc-dir .seg-btn') return [getEl('cd-1'), getEl('cd-2')];
    if (sel === '#rate-mode .seg-btn') return [getEl('rm-1'), getEl('rm-2')];
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

/* اجرای DOMContentLoaded */
(listeners.DOMContentLoaded || []).forEach(function (fn) {
  try { fn(); } catch (e) { console.error('STARTUP CRASH:', e.message, '\n', e.stack.split('\n')[1]); failed++; }
});

setTimeout(function () {
  const st = PiNama.price.state;
  t('startup without crash', true);
  t('price populated from gate', st.usd === 0.0955, 'got ' + st.usd);
  t('toman from ramzinex', st.tomanRate === 235800, 'got ' + st.tomanRate);
  t('price usd rendered', getEl('price-usd').textContent === '$0.0955', 'got "' + getEl('price-usd').textContent + '"');
  t('toman rendered', String(getEl('price-toman').textContent).includes('22,519'), 'got "' + getEl('price-toman').textContent + '"');
  t('source label gate', String(getEl('price-source').textContent).includes('Gate'), 'got "' + getEl('price-source').textContent + '"');
  t('no error banner', getEl('offline-banner').hidden === true);
  t('holdings prefilled 15', String(getEl('pf-holdings').value) === '15', 'got "' + getEl('pf-holdings').value + '"');

  /* تعویض تب نباید crash کند */
  try {
    getEl('nav-portfolio').listeners.click.forEach(function (fn) { fn(); });
    t('tab switch without crash', true);
  } catch (e) { t('tab switch without crash', false, e.message); }

  console.log(failed === 0 ? '\n✅ راه‌اندازی کامل اپ بدون خطا' : '\n❌ ' + failed + ' مشکل در راه‌اندازی');
  process.exit(failed === 0 ? 0 : 1);
}, 300);
