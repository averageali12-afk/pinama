# پی‌نما 🟣 — ردیاب قیمت Pi برای اکوسیستم Pi Network

**نسخه زنده:** [https://averageali12-afk.github.io/pinama/](https://averageali12-afk.github.io/pinama/) 🚀
**کد منبع:** [github.com/averageali12-afk/pinama](https://github.com/averageali12-afk/pinama)

اپ وب فارسی و راست‌به‌چپ برای نمایش **قیمت لحظه‌ای Pi**، نمودار، ماشین‌حساب تومانی، پرتفوی شخصی و هشدار قیمت — ساخته‌شده برای اجرا داخل **Pi Browser** و آمادهٔ اتصال به **Pi SDK** (ورود با Pi + تبلیغات Ad Network).

بدون ابزار build — فقط HTML/CSS/JS خالص. هر هاست استاتیکی (GitHub Pages، Cloudflare Pages، Netlify، هاست شخصی) کافی است.

---

## ✨ امکانات

| بخش | توضیح |
|---|---|
| قیمت لحظه‌ای | منبع اصلی CoinGecko، پشتیبان OKX، کش آفلاین در localStorage |
| قیمت تومانی | نرخ دلار به‌صورت خودکار (tgju) یا دستی |
| نمودار | Canvas سبک‌وزن — بازه‌های ۲۴ ساعت / ۷ روز / ۳۰ روز + تولتیپ لمسی |
| ماشین‌حساب | تبدیل دوطرفه Pi ↔ تومان/دلار |
| پرتفوی | موجودی + میانگین خرید ← ارزش و سود/زیان (فقط روی دستگاه ذخیره می‌شود) |
| هشدار قیمت | هشدار تک‌شارپ «بالای/زیر» با نوتیفیکیشن مرورگر + فعال‌سازی مجدد |
| ورود با Pi | `Pi.authenticate` با اسکوپ username |
| تبلیغات | interstitial هنگام جابه‌جایی تب‌ها (حداکثر هر ۳ دقیقه) + تبلیغ جایزه‌دار حمایتی |

## 🚀 اجرای محلی

```bash
cd "E:\pi coin"
node serve.js          # پیش‌فرض پورت 3000
# یا: PORT=8080 node serve.js
```

سپس [http://localhost:3000](http://localhost:3000) را باز کنید. (بدون سرور هم باز کردن مستقیم `index.html` کار می‌کند، اما سرور محلی رفتار واقعی‌تری دارد.)

## 📱 ثبت اپ در Pi Developer Portal (قدم‌به‌قدم)

1. **Pi Browser** را نصب کنید (از خود اپ ماینینگ Pi → منو).
2. در Pi Browser آدرس `develop.pi` را باز کنید و با حساب Pi وارد شوید.
3. **Register an app** را بزنید:
   - **App Name:** `PiNama` (پی‌نما)
   - **App URL:** `https://averageali12-afk.github.io/pinama/`
   - **Permission:** ابتدا `Pi Utilities` کافی است.
4. بعد از ثبت، **App ID** (با پیشوند `pi-app-...`) را بردارید.
5. اپ باید **Terms of Service** و **Privacy Policy** داشته باشد — ✅ آماده است: [terms.html](terms.html) و [privacy.html](privacy.html) (در تنظیمات اپ هم لینک شده‌اند).
6. برای تست داخل Pi Browser از آدرس [https://averageali12-afk.github.io/pinama/](https://averageali12-afk.github.io/pinama/) باز کنید — دکمه «ورود با Pi» فقط آنجا کار می‌کند.

> ⚠️ اسکریپت `pi-sdk.js` بدون App ID هم لود می‌شود، اما `Pi.authenticate` فقط برای اپ ثبت‌شده روی همان دامنه پاسخ می‌دهد.

## 🌍 دیپلوی (خودکار)

✅ انجام شده — ریپو [averageali12-afk/pinama](https://github.com/averageali12-afk/pinama) با GitHub Actions (`deploy.yml`) روی GitHub Pages سرو می‌شود. هر push به شاخه main به‌صورت خودکار منتشر می‌شود؛ نیازی به تنظیمات دستی نیست.

## 💰 مسیر درآمد (چک‌لیست)

1. ✅ دیپلوی HTTPS — [https://averageali12-afk.github.io/pinama/](https://averageali12-afk.github.io/pinama/) (هر push به main خودکار دیپلوی می‌شود)
2. ☐ ثبت در Developer Portal + App ID — **تنها قدم باقی‌مانده که نیاز به حسابت Pi دارد**
3. ✅ صفحات Terms / Privacy — [terms.html](terms.html) و [privacy.html](privacy.html)
4. ☐ ارسال برای **Ecosystem Directory** (از Developer Portal) — تأیید چند هفته طول می‌کشد
5. ☐ پس از تأیید Ecosystem → درخواست **Pi Ad Network** از Developer Portal (Develop → اپ → Ad Network)
6. ✅ کد تبلیغات از قبل داخل اپ هست (`js/ads.js`) — بعد از تأیید بدون تغییر کد فعال می‌شود
7. ☐ نسخه بعدی: پرداخت/حمایت با Pi (نیازمند بک‌اند برای تأیید پرداخت — `Pi.createPayment`)

## 🗂 ساختار پروژه

```
index.html          ← تک‌صفحه‌ای، RTL فارسی، ۴ تب
terms.html          ← شرایط استفاده (لازم برای تأیید Ecosystem)
privacy.html        ← سیاست حریم خصوصی
robots.txt          ← اجازه ایندکس
css/style.css       ← تم تیره بنفش/طلایی، موبایل‌محور
js/config.js        ← تنظیمات و کلیدها
js/storage.js       ← لایه امن localStorage
js/price.js         ← سرویس قیمت + نرخ تومان + قالب‌بندی اعداد
js/chart.js         ← نمودار Canvas
js/pi.js            ← لایه Pi SDK (ورود، اشتراک‌گذاری)
js/ads.js           ← تبلیغات Ad Network (interstitial + rewarded)
js/alerts.js        ← منطق هشدار قیمت
js/app.js           ← اتصال DOM، رویدادها، رندر
serve.js            ← سرور استاتیک محلی (node serve.js)
test/smoke.js       ← ۳۳ تست دود منطق (node test/smoke.js)
test/render.js      ← ۹ تست راه‌اندازی کامل با DOM stub (node test/render.js)
tools/gen-icons.js  ← تولید آیکون‌های PNG بدون وابستگی
```

## 🔒 نکته‌های فنی

- **زنجیره داده برای شبکه ایران طراحی شده:** قیمت از Gate.io (اولویت اول، CORS باز) → CoinGecko → OKX؛ نمودار از کندل‌های Gate.io؛ نرخ دلار/تومان از رمضینکس → tgju → آخرین نرخ ذخیره‌شده → ورود دستی (با بازه sanity برای رد نرخ‌های غیرمنطقی مثل نرخ رسمی).
- در شبکه‌های بدون محدودیت هم همه منابع کار می‌کنند (ترتیب fallback فقط برای پایداری است).
- قیمت‌ها هر ۶۰ ثانیه تازه‌سازی می‌شوند؛ با کشیدن به پایین (لمسی) یا لمس بنر قطعی هم تازه‌سازی می‌شود.
- ورودی‌های عددی با کیبورد فارسی (ارقام ۰-۹ و ممیز ٫) هم کار می‌کنند.
- همه داده‌های شخصی (پرتفوی، هشدارها) فقط در `localStorage` همان دستگاه است.
- پیام «کش» یعنی دادهٔ ذخیره‌شدهٔ قبلی نمایش داده شده (اینترنت قطع/فیلتر بوده).
- این اپ توصیه مالی نیست.

## 🧪 تست‌ها

```bash
node test/smoke.js   # ۳۳ تست منطق (storage، هشدارها، زنجیره نرخ، سری زمانی، فرمت)
node test/render.js  # ۹ تست راه‌اندازی کامل app.js با DOM شبیه‌سازی‌شده
```

## 🗺 نقشه راه (نسخه‌های بعد)

- [x] صفحات Terms of Service و Privacy Policy
- [ ] پشتیبانی چند ارز دیگر
- [ ] ویجت اندروید PWA + آفلاین کامل (Service Worker)
- [ ] پرداخت حمایتی با Pi (با بک‌اند تأیید)
- [ ] ماژول دوم: نیازمندی‌های فروش با Pi (ایده ۳)
