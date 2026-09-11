/* تست دود پی‌نما — اجرای منطق خالص در Node با شبیه‌سازی مرورگر و fetch */
'use strict';

/* ─── شبیه‌سازی محیط مرورگر ─── */
const memStore = {};
global.window = global;
Object.defineProperty(global, 'navigator', {
  value: { userAgent: 'NodeSmoke/1.0' },
  configurable: true
});
global.localStorage = {
  getItem: k => (k in memStore ? memStore[k] : null),
  setItem: (k, v) => { memStore[k] = String(v); },
  removeItem: k => { delete memStore[k]; },
  get length() { return Object.keys(memStore).length; },
  key: i => Object.keys(memStore)[i] || null
};
global.PiNama = { config: null };

/* ─── لود ماژول‌ها به ترتیب index.html ─── */
const fs = require('fs');
const path = require('path');
['config.js', 'storage.js', 'price.js', 'alerts.js'].forEach(f => {
  eval(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'));
});

let passed = 0, failed = 0;
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}
const ok = body => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const notOk = () => Promise.reject(new Error('network down'));
let fetchLog = [];
global.fetch = (url, opts) => { fetchLog.push(String(url)); return currentFetch(url, opts); };
let currentFetch = notOk;

async function main() {

  /* ─── storage ─── */
  console.log('\n[storage]');
  const S = PiNama.storage;
  S.set('foo', { a: 1 });
  t('set/get object', JSON.stringify(S.get('foo')) === '{"a":1}');
  t('get fallback', S.get('nope', 'fb') === 'fb');
  S.set('bar', 5); S.remove('bar');
  t('remove works', S.get('bar', null) === null);

  /* ─── alerts ─── */
  console.log('\n[alerts]');
  const A = PiNama.alerts;
  A.load();
  A.list = [];
  t('add valid', A.add('above', 0.12) !== null);
  t('add below', A.add('below', 0.05) !== null);
  t('reject bad dir', A.add('sideways', 1) === null);
  t('reject zero', A.add('above', 0) === null);
  t('reject NaN', A.add('above', 'abc') === null);
  const fired = A.check(0.13);
  t('above fires at 0.13', fired.length === 1 && fired[0].dir === 'above');
  t('single-shot', A.check(0.14).length === 0);
  t('below fires at 0.04', A.check(0.04).length === 1);
  A.rearm(A.list.find(a => a.dir === 'below').id);
  t('rearm refires', A.check(0.03).length === 1);
  A.load();
  t('persisted across load', A.list.length >= 2);

  /* ─── fmt (واقعی، از price.js) ─── */
  console.log('\n[fmt]');
  t('pct positive', PiNama.fmt.pct(3.456) === '+3.46%');
  t('pct negative', PiNama.fmt.pct(-2.5) === '-2.50%');
  t('usd 4 digits', PiNama.fmt.usd(0.0955) === '$0.0955');
  t('compact B', /^1\.0[67]B$/.test(PiNama.fmt.compactUsd(1.065e9)), 'got ' + PiNama.fmt.compactUsd(1.065e9));

  /* ─── زنجیره نرخ تومان ─── */
  console.log('\n[toman-rate chain]');
  const C = PiNama.config;
  const K = C.KEYS;

  // ۱: رمضینکس موفق (ریال → تومان)
  currentFetch = url => {
    if (String(url).includes('ramzinex')) return ok({ data: { sell: 2358000, buy: 2354000 } });
    if (String(url).includes('tgju')) return ok({ current: { price_dollar_rl: { p: '999' } } });
    return notOk();
  };
  let r = await PiNama.price.refreshTomanRate();
  t('ramzinex rial→toman', r === 235800, 'got ' + r);

  // ۲: رمضینکس خالی → tgju به تومان
  currentFetch = url => {
    if (String(url).includes('ramzinex')) return ok({ data: {} });
    if (String(url).includes('tgju')) return ok({ current: { price_dollar_rl: { p: '235,700' } } });
    return notOk();
  };
  r = await PiNama.price.refreshTomanRate();
  t('tgju toman format', r === 235700, 'got ' + r);

  // ۳: tgju به ریال (بزرگ‌تر از ۱M → تقسیم بر ۱۰)
  currentFetch = url => {
    if (String(url).includes('ramzinex')) return notOk();
    if (String(url).includes('tgju')) return ok({ current: { price_dollar_rl: { p: '2,357,000' } } });
    return notOk();
  };
  r = await PiNama.price.refreshTomanRate();
  t('tgju rial→toman', r === 235700, 'got ' + r);

  // ۴: همه قطع → کش آخرین نرخ معتبر
  S.set(K.RATE_AUTO, 220000);
  currentFetch = notOk;
  r = await PiNama.price.refreshTomanRate();
  t('all-down → cached', r === 220000, 'got ' + r);

  // ۵: کش غیرمنطقی (نرخ رسمی ۴۲هزار) رد می‌شود → null
  S.set(K.RATE_AUTO, 42000);
  r = await PiNama.price.refreshTomanRate();
  t('implausible official rate rejected', r === null, 'got ' + r);

  // ۶: حالت دستی معتبر
  S.set(K.RATE_MODE, 'manual');
  S.set(K.RATE_MANUAL, 240000);
  currentFetch = notOk;
  r = await PiNama.price.refreshTomanRate();
  t('manual mode applies', r === 240000, 'got ' + r);
  S.set(K.RATE_MODE, 'auto');
  S.set(K.RATE_MANUAL, null);
  S.set(K.RATE_AUTO, null);

  /* ─── سری زمانی: Gate اول، CoinGecko پشتیبان ─── */
  console.log('\n[series]');
  fetchLog = [];
  const candleRows = [
    [1788552000, '38149.18', '0.09412', '0.09456', '0.094', '0.0941', '405085.4', 'true'],
    [1788566400, '12011.5', '0.0941', '0.095', '0.093', '0.0948', '300000.1', 'true'],
    [1788580800, '9955.2', '0.0948', '0.096', '0.094', '0.0955', '123456.7', 'true']
  ];
  currentFetch = url => {
    if (String(url).includes('gateio')) return ok(candleRows);
    return notOk();
  };
  let series = await PiNama.price.loadSeries(7);
  t('series from gate', series.length === 3, 'len ' + series.length);
  t('series mapped (ts ms + open)', series[0][0] === 1788552000000 && Math.abs(series[0][1] - 0.09412) < 1e-9);
  t('gate is first source', fetchLog.length === 1 && fetchLog[0].includes('gateio'), fetchLog.join(' '));

  // CoinGecko پشتیبان وقتی Gate قطع است
  fetchLog = [];
  currentFetch = url => {
    if (String(url).includes('gateio')) return notOk();
    if (String(url).includes('coingecko')) return ok({ prices: [[1000, 0.1], [2000, 0.11]] });
    return notOk();
  };
  series = await PiNama.price.loadSeries(1); // بازه ۱ روز → کش ۷ روز معتبر نیست
  t('fallback to coingecko', series.length === 2 && series[1][1] === 0.11);
  t('gate tried before coingecko', fetchLog[0].includes('gateio') && fetchLog[1].includes('coingecko'));

  console.log('\n' + (failed === 0
    ? '✅ همه ' + passed + ' تست دود پاس شد'
    : '❌ ' + failed + ' تست از ' + (passed + failed) + ' شکست خورد'));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
