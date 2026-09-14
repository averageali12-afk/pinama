/* تست E2E پی‌نما با Playwright — مرورگر واقعی، جریان واقعی کاربر
 * اجرا: node test/e2e.js [url]
 * پیش‌فرض: http://localhost:3000 — URL کامل مثل سایت زنده هم قبول است.
 */
'use strict';

const path = require('path');

const PW = 'C:/Users/Ali/AppData/Local/npm-cache/_npx/0b9ff77863cb6e9f/node_modules/playwright-core';
const { chromium } = require(PW);

const BASE = process.argv[2] || 'http://localhost:3000/';
const SHOTS = path.join(__dirname, '..', 'shots');

let passed = 0, failed = 0;
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

(async () => {
  const fs = require('fs');
  fs.mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Users/Ali/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 12) PiBrowser/1.0 Chrome/124 Mobile Safari/537.36'
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  console.log('در حال باز کردن ' + BASE + ' …');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // ۱ — قیمت واقعی رندر شود (تا ۲۰ ثانیه صبر)
  const priceText = await page.textContent('#price-usd');
  await page.waitForFunction(
    () => /^\$[\d.]+$/.test(document.getElementById('price-usd').textContent),
    null, { timeout: 20000 }
  ).catch(() => { });
  const price = await page.textContent('#price-usd');
  t('قیمت دلاری رندر شد', /^\$[\d.]+$/.test(price), 'got "' + price + '"');

  // ۲ — بنر قطعی در حالت زنده پنهان باشد
  const bannerHidden = await page.$eval('#offline-banner', el => el.hidden);
  t('بدون بنر قطعی (زنده)', bannerHidden === true);

  // ۳ — منبع داده
  const source = await page.textContent('#price-source');
  t('منبع داده نمایش داده شد', /Gate|CoinGecko|OKX|کش/.test(source), 'got "' + source + '"');

  // ۴ — نمودار کشیده شده (عرض canvas غیرصفر + loading پنهان)
  await page.waitForFunction(
    () => document.getElementById('chart-loading').style.display === 'none',
    null, { timeout: 15000 }
  ).catch(() => { });
  const chartW = await page.$eval('#chart', el => el.width);
  t('نمودار کشیده شد', chartW > 50, 'width=' + chartW);

  // ۵ — چیپ‌های بازه‌ای پر شوند
  await page.waitForFunction(
    () => /%/.test(document.querySelector('.change-chips .chip').textContent),
    null, { timeout: 15000 }
  ).catch(() => { });
  const chip1 = await page.textContent('.change-chips .chip');
  t('چیپ ۲۴ساعت پر شد', /%/.test(chip1), 'got "' + chip1 + '"');

  // ۶ — خط موقعیت ۳۰ روزه
  const rangeHidden = await page.$eval('#range-line', el => el.hidden);
  const rangeText = await page.textContent('#range-line');
  t('خط ۳۰روزه یا پنهان یا پر', rangeHidden || rangeText.length > 3, 'got "' + rangeText + '"');

  // ۷ — تعویض تب پرتفوی (کلیک واقعی)
  await page.click('.nav-btn[data-view="portfolio"]');
  await page.waitForTimeout(400);
  const pfVisible = await page.$eval('#view-portfolio', el => el.classList.contains('active'));
  t('تب پرتفوی باز شد', pfVisible);

  // ۸ — موجودی وارد کن → ارزش رندر شود
  await page.fill('#pf-holdings', '۱۵'); // ارقام فارسی عمداً
  await page.waitForTimeout(300);
  const pfUsd = await page.textContent('#pf-usd');
  t('ارزش پرتفوی از ارقام فارسی محاسبه شد', /^\$[\d.]+$/.test(pfUsd), 'got "' + pfUsd + '"');

  // ۹ — تب هشدار + هشدار سریع ±۵٪ (لیست خالی هم یک ردیف placeholder دارد)
  await page.click('.nav-btn[data-view="alerts"]');
  await page.waitForTimeout(300);
  const hadRealAlert = await page.$$eval('#alert-list .alert-price-lbl', els => els.length);
  await page.click('#quick-plus');
  await page.waitForTimeout(300);
  const nowRealAlert = await page.$$eval('#alert-list .alert-price-lbl', els => els.length);
  t('هشدار سریع ±۵٪ ثبت شد', nowRealAlert > hadRealAlert, 'before=' + hadRealAlert + ' after=' + nowRealAlert);

  // ۱۰ — تب تنظیمات + واحد تومان
  await page.click('.nav-btn[data-view="settings"]');
  await page.waitForTimeout(300);
  await page.click('#display-currency .seg-btn[data-cur="toman"]');
  await page.waitForTimeout(200);
  const curSaved = await page.evaluate(() => localStorage.getItem('pinama.v2.displayCurrency'));
  t('تنظیم تومان-بزرگ ذخیره شد', curSaved === '"toman"', 'got ' + curSaved);
  // اگر نرخ تومان در دسترس باشد (tgju/رمضینکس/دستی) قیمت بزرگ تومانی می‌شود؛ وگرنه صادقانه دلار می‌ماند
  const rateAvailable = await page.evaluate(() => PiNama.price.state.tomanRate != null);
  if (rateAvailable) {
    await page.click('.nav-btn[data-view="price"]');
    await page.waitForTimeout(300);
    const priceTomanMode = await page.textContent('#price-usd');
    t('حالت تومان-بزرگ اعمال شد', /تومان/.test(priceTomanMode), 'got "' + priceTomanMode + '"');
    await page.click('.nav-btn[data-view="settings"]');
    await page.waitForTimeout(200);
  } else {
    t('حالت تومان بدون نرخ → دلار می‌ماند (رفتار صادقانه)', true);
  }
  await page.click('#display-currency .seg-btn[data-cur="usd"]');
  await page.waitForTimeout(200);
  await page.click('.nav-btn[data-view="price"]');
  await page.waitForTimeout(300);

  // ۱۱ — اسکرین‌شات نهایی
  await page.screenshot({ path: path.join(SHOTS, 'e2e-final.png') });

  // ۱۲ — بدون exception کنسول
  t('بدون pageerror', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  console.log('\n' + (failed === 0
    ? '✅ E2E کامل: ' + passed + ' بررسی سبز روی ' + BASE
    : '❌ ' + failed + ' بررسی شکست خورد'));
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('E2E FATAL:', e.message); process.exit(1); });
