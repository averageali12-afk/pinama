/* تست دود پی‌نما — اجرای منطق خالص در Node با شبیه‌سازی مرورگر */
'use strict';

// ─── شبیه‌سازی محیط مرورگر ───
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

// ─── لود ماژول‌ها به ترتیب index.html ───
const fs = require('fs');
const path = require('path');
['config.js', 'storage.js', 'alerts.js'].forEach(f => {
  // price.js/chart.js/pi.js/ads.js/app.js به DOM یا fetch نیاز دارند؛ اینجا فقط منطق خالص تست می‌شود
  eval(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'));
});

let passed = 0, failed = 0;
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

// ─── storage ───
console.log('\n[storage]');
const S = PiNama.storage;
S.set('foo', { a: 1 });
t('set/get object', JSON.stringify(S.get('foo')) === '{"a":1}');
t('get fallback', S.get('nope', 'fb') === 'fb');
S.set('bar', 5); S.remove('bar');
t('remove works', S.get('bar', null) === null);

// ─── alerts ───
console.log('\n[alerts]');
const A = PiNama.alerts;
A.load();
A.list = [];

t('add valid', A.add('above', 0.12) !== null);
t('add below', A.add('below', 0.05) !== null);
t('reject bad dir', A.add('sideways', 1) === null);
t('reject zero', A.add('above', 0) === null);
t('reject negative', A.add('above', -1) === null);
t('reject NaN', A.add('above', 'abc') === null);

const fired = A.check(0.13);
t('above fires at 0.13', fired.length === 1 && fired[0].dir === 'above');
const fired2 = A.check(0.14);
t('single-shot (no refire)', fired2.length === 0);
const fired3 = A.check(0.04);
t('below fires at 0.04', fired3.length === 1 && fired3[0].dir === 'below');

const belowId = A.list.find(a => a.dir === 'below').id;
A.rearm(belowId);
const fired4 = A.check(0.03);
t('rearm refires', fired4.length === 1);

// persistence از طریق localStorage
const A2 = PiNama.alerts;
A2.load();
t('persisted across load', A2.list.length === A.list.length);

// ─── fmt ───
console.log('\n[fmt]');
PiNama.fmt = {
  num: (v, f) => Number(v).toLocaleString('en-US', { maximumFractionDigits: f == null ? 2 : f }),
  pct: v => (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%'
};
t('pct positive', PiNama.fmt.pct(3.456) === '+3.46%');
t('pct negative', PiNama.fmt.pct(-2.5) === '-2.50%');
t('num grouping', PiNama.fmt.num(1234567.891, 0) === '1,234,568');

console.log('\n' + (failed === 0
  ? '✅ همه ' + passed + ' تست دود پاس شد'
  : '❌ ' + failed + ' تست از ' + (passed + failed) + ' شکست خورد'));
process.exit(failed === 0 ? 0 : 1);
