/* افزودن data-i18n به عناصر استاتیک index.html — هر جایگزینی باید دقیقاً ۱ بار رخ دهد */
'use strict';
const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const pairs = [
  // هدر و بنر
  ['<small>ردیاب قیمت Pi</small>', '<small data-i18n="brand_sub">ردیاب قیمت Pi</small>'],
  ['<button id="auth-btn" class="btn btn-ghost btn-sm" type="button">ورود با Pi</button>', '<button id="auth-btn" class="btn btn-ghost btn-sm" type="button" data-i18n="login">ورود با Pi</button>'],
  ['اتصال برقرار نشد — آخرین قیمت ذخیره‌شده نمایش داده می‌شود\n  </div>', 'اتصال برقرار نشد — آخرین قیمت ذخیره‌شده نمایش داده می‌شود\n  </div>'],
  // بازه‌ها و آمار
  ['<button class="seg-btn" data-days="1" type="button">۲۴ ساعت</button>', '<button class="seg-btn" data-days="1" type="button" data-i18n="tf_1">۲۴ ساعت</button>'],
  ['<button class="seg-btn active" data-days="7" type="button">۷ روز</button>', '<button class="seg-btn active" data-days="7" type="button" data-i18n="tf_7">۷ روز</button>'],
  ['<button class="seg-btn" data-days="30" type="button">۳۰ روز</button>', '<button class="seg-btn" data-days="30" type="button" data-i18n="tf_30">۳۰ روز</button>'],
  ['<small>سقف ۲۴ ساعت</small>', '<small data-i18n="stat_high">سقف ۲۴ ساعت</small>'],
  ['<small>کف ۲۴ ساعت</small>', '<small data-i18n="stat_low">کف ۲۴ ساعت</small>'],
  ['<small>ارزش بازار</small>', '<small data-i18n="stat_mcap">ارزش بازار</small>'],
  ['<small>حجم ۲۴ ساعت</small>', '<small data-i18n="stat_vol">حجم ۲۴ ساعت</small>'],
  // ماشین‌حساب
  ['<h3 class="card-title"> ماشین‌حساب </h3>', '<h3 class="card-title" data-i18n="calc_title"> ماشین‌حساب </h3>'],
  ['<button class="seg-btn active" data-dir="pi2usd" type="button">Pi ← تومان/دلار</button>', '<button class="seg-btn active" data-dir="pi2usd" type="button" data-i18n="calc_dir_pi2">Pi ← تومان/دلار</button>'],
  ['<button class="seg-btn" data-dir="usd2pi" type="button">تومان/دلار ← Pi</button>', '<button class="seg-btn" data-dir="usd2pi" type="button" data-i18n="calc_dir_usd2">تومان/دلار ← Pi</button>'],
  ['<button class="seg-btn" data-dir="target" type="button">سود هدف 🎯</button>', '<button class="seg-btn" data-dir="target" type="button" data-i18n="calc_dir_target">سود هدف 🎯</button>'],
  ['<span>میانگین خرید دلاری (اختیاری)</span>', '<span data-i18n="calc_avg_label">میانگین خرید دلاری (اختیاری)</span>'],
  // پرتفوی
  ['<h3 class="card-title">پرتفوی من</h3>', '<h3 class="card-title" data-i18n="pf_title">پرتفوی من</h3>'],
  ['<span>موجودی Pi</span>', '<span data-i18n="pf_holdings">موجودی Pi</span>'],
  ['<span>میانگین قیمت خرید (دلار — اختیاری)</span>', '<span data-i18n="pf_avg">میانگین قیمت خرید (دلار — اختیاری)</span>'],
  ['<small>ارزش دلاری</small>', '<small data-i18n="pf_usd">ارزش دلاری</small>'],
  ['<small>ارزش تومانی</small>', '<small data-i18n="pf_toman">ارزش تومانی</small>'],
  ['<small>سود / زیان</small>', '<small data-i18n="pf_pl">سود / زیان</small>'],
  ['<small>ارزش پرتفوی</small>', '<small data-i18n="pf_day">ارزش پرتفوی</small>'],
  ['<small>روند هفتگی</small>', '<small data-i18n="pf_week">روند هفتگی</small>'],
  ['<button class="btn btn-ghost btn-sm" id="pf-share" type="button">اشتراک وضعیت من 📊</button>', '<button class="btn btn-ghost btn-sm" id="pf-share" type="button" data-i18n="pf_share">اشتراک وضعیت من 📊</button>'],
  ['<p class="hint">داده‌ها فقط روی همین دستگاه ذخیره می‌شوند.</p>', '<p class="hint" data-i18n="pf_hint">داده‌ها فقط روی همین دستگاه ذخیره می‌شوند.</p>'],
  // هشدارها
  ['<h3 class="card-title">آنچه از دست دادی</h3>', '<h3 class="card-title" data-i18n="missed_title">آنچه از دست دادی</h3>'],
  ['<button class="btn btn-ghost btn-sm" id="missed-clear" type="button">پاک‌کردن</button>', '<button class="btn btn-ghost btn-sm" id="missed-clear" type="button" data-i18n="missed_clear">پاک‌کردن</button>'],
  ['<h3 class="card-title">هشدار قیمت</h3>', '<h3 class="card-title" data-i18n="alerts_title">هشدار قیمت</h3>'],
  ['<option value="above">وقتی Pi رفت بالای</option>', '<option value="above" data-i18n="alert_above">وقتی Pi رفت بالای</option>'],
  ['<option value="below">وقتی Pi افتاد زیر</option>', '<option value="below" data-i18n="alert_below">وقتی Pi افتاد زیر</option>'],
  ['<button class="btn btn-primary" id="alert-add" type="button">افزودن</button>', '<button class="btn btn-primary" id="alert-add" type="button" data-i18n="alert_add">افزودن</button>'],
  ['\n          فعال‌سازی نوتیفیکیشن مرورگر\n        </button>', '\n          <span data-i18n="alert_notif">فعال‌سازی نوتیفیکیشن مرورگر</span>\n        </button>'],
  // تنظیمات
  ['<h3 class="card-title">حساب Pi</h3>', '<h3 class="card-title" data-i18n="set_account">حساب Pi</h3>'],
  ['<span id="account-status" class="muted">وارد نشده‌اید</span>', '<span id="account-status" class="muted" data-i18n="set_logged_out">وارد نشده‌اید</span>'],
  ['<button class="btn btn-ghost btn-sm" id="logout-btn" type="button" hidden>خروج</button>', '<button class="btn btn-ghost btn-sm" id="logout-btn" type="button" hidden data-i18n="set_logout">خروج</button>'],
  ['<p class="hint">ورود فقط برای احراز هویت درون‌برنامه‌ای است؛ بدون آن هم همه امکانات کار می‌کند.</p>', '<p class="hint" data-i18n="set_login_hint">ورود فقط برای احراز هویت درون‌برنامه‌ای است؛ بدون آن هم همه امکانات کار می‌کند.</p>'],
  ['<h3 class="card-title">نرخ دلار (تومان)</h3>', '<h3 class="card-title" data-i18n="set_rate">نرخ دلار (تومان)</h3>'],
  ['<button class="seg-btn active" data-mode="auto" type="button">خودکار</button>', '<button class="seg-btn active" data-mode="auto" type="button" data-i18n="set_rate_auto">خودکار</button>'],
  ['<button class="seg-btn" data-mode="manual" type="button">دستی</button>', '<button class="seg-btn" data-mode="manual" type="button" data-i18n="set_rate_manual">دستی</button>'],
  ['<span>نرخ هر دلار به تومان</span>', '<span data-i18n="set_rate_manual_label">نرخ هر دلار به تومان</span>'],
  ['<h3 class="card-title">واحد نمایش</h3>', '<h3 class="card-title" data-i18n="set_currency">واحد نمایش</h3>'],
  ['<button class="seg-btn active" data-cur="usd" type="button">دلار بزرگ</button>', '<button class="seg-btn active" data-cur="usd" type="button" data-i18n="set_cur_usd">دلار بزرگ</button>'],
  ['<button class="seg-btn" data-cur="toman" type="button">تومان بزرگ</button>', '<button class="seg-btn" data-cur="toman" type="button" data-i18n="set_cur_toman">تومان بزرگ</button>'],
  ['<p class="hint">قیمت اصلی صفحه با کدام واحد بزرگ نمایش داده شود.</p>', '<p class="hint" data-i18n="set_currency_hint">قیمت اصلی صفحه با کدام واحد بزرگ نمایش داده شود.</p>'],
  ['<h3 class="card-title">حمایت از توسعه</h3>', '<h3 class="card-title" data-i18n="set_support">حمایت از توسعه</h3>'],
  ['<p class="hint">با تماشای یک تبلیغ کوتاه، از این اپ حمایت کنید (فقط داخل Pi Browser و پس از تایید Ad Network).</p>', '<p class="hint" data-i18n="set_support_hint">با تماشای یک تبلیغ کوتاه، از این اپ حمایت کنید (فقط داخل Pi Browser و پس از تایید Ad Network).</p>'],
  ['<button class="btn btn-primary" id="watch-ad-btn" type="button">تماشای تبلیغ حمایتی</button>', '<button class="btn btn-primary" id="watch-ad-btn" type="button" data-i18n="set_watch_ad">تماشای تبلیغ حمایتی</button>'],
  ['<h3 class="card-title">معرفی به دوستان</h3>', '<h3 class="card-title" data-i18n="set_share">معرفی به دوستان</h3>'],
  ['<button class="btn btn-ghost" id="share-btn" type="button">اشتراک‌گذاری پی‌نما</button>', '<button class="btn btn-ghost" id="share-btn" type="button" data-i18n="set_share_btn">اشتراک‌گذاری پی‌نما</button>'],
  ['<h3 class="card-title">درباره پی‌نما</h3>', '<h3 class="card-title" data-i18n="set_about">درباره پی‌نما</h3>'],
  ['<p class="hint">\n          پی‌نما یک اپ جامعه‌محور برای اکوسیستم Pi Network است — قیمت لحظه‌ای، نمودار، ماشین‌حساب تومانی، پرتفوی و هشدار.\n        </p>', '<p class="hint" data-i18n="set_about_hint">\n          پی‌نما یک اپ جامعه‌محور برای اکوسیستم Pi Network است — قیمت لحظه‌ای، نمودار، ماشین‌حساب تومانی، پرتفوی و هشدار.\n        </p>'],
  ['<button class="btn btn-danger btn-sm" id="reset-btn" type="button">پاک‌کردن همه داده‌ها</button>', '<button class="btn btn-danger btn-sm" id="reset-btn" type="button" data-i18n="set_reset">پاک‌کردن همه داده‌ها</button>'],
  ['<p class="hint">⚠️ این اپ توصیه مالی نیست. مسئولیت معامله با شماست.</p>', '<p class="hint" data-i18n="set_disclaimer">⚠️ این اپ توصیه مالی نیست. مسئولیت معامله با شماست.</p>'],
  ['<summary>For Ecosystem reviewers (English)</summary>', '<summary data-i18n="reviewers">For Ecosystem reviewers (English)</summary>'],
  // آن‌بوردینگ
  ['<h3 class="card-title">👋 به پی‌نما خوش آمدی</h3>', '<h3 class="card-title" data-i18n="onb_title">👋 به پی‌نما خوش آمدی</h3>'],
  ['<p class="ob-line">۱️⃣ قیمت زنده، نمودار و ماشین‌حساب تومانی همین‌جاست</p>', '<p class="ob-line" data-i18n="onb_1">۱️⃣ قیمت زنده، نمودار و ماشین‌حساب تومانی همین‌جاست</p>'],
  ['<p class="ob-line">۲️⃣ از تب «هشدار» با یک لمس (+۵٪ / −۵٪) آلارم قیمت بگذار</p>', '<p class="ob-line" data-i18n="onb_2">۲️⃣ از تب «هشدار» با یک لمس (+۵٪ / −۵٪) آلارم قیمت بگذار</p>'],
  ['<p class="ob-line">۳️⃣ اگر نرخ دلار خودکار نیامد، از تنظیمات نرخ دستی بگذار</p>', '<p class="ob-line" data-i18n="onb_3">۳️⃣ اگر نرخ دلار خودکار نیامد، از تنظیمات نرخ دستی بگذار</p>'],
  ['<p class="ob-line">۴️⃣ از منوی گوشی، «نصب روی گوشی» را بزن تا مثل اپ اصلی شود</p>', '<p class="ob-line" data-i18n="onb_4">۴️⃣ از منوی گوشی، «نصب روی گوشی» را بزن تا مثل اپ اصلی شود</p>'],
  ['<button class="btn btn-primary" id="onboarding-ok" type="button">فهمیدم، بریم 🚀</button>', '<button class="btn btn-primary" id="onboarding-ok" type="button" data-i18n="onb_ok">فهمیدم، بریم 🚀</button>']
];

let applied = 0, failed = [];
for (const [from, to] of pairs) {
  if (from === to) continue; // مواردی که فقط در آینده تغییر می‌کنند
  const count = html.split(from).length - 1;
  if (count !== 1) { failed.push(from.slice(0, 60) + ' (x' + count + ')'); continue; }
  html = html.replace(from, to);
  applied++;
}
fs.writeFileSync(file, html);
console.log('applied:', applied, '/', pairs.length);
if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  -', f)); process.exit(1); }
console.log('data-i18n total:', (html.match(/data-i18n=/g) || []).length);
