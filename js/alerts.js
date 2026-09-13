/* پی‌نما — هشدار قیمت (تک‌شارپ، ذخیره‌شده روی دستگاه) */
(function () {
  'use strict';

  var S = PiNama.storage;
  var K = PiNama.config.KEYS;

  PiNama.alerts = {
    list: [],

    load: function () {
      this.list = S.get(K.ALERTS, []);
      if (!Array.isArray(this.list)) this.list = [];
    },

    save: function () {
      S.set(K.ALERTS, this.list);
    },

    /** خروجی: هشدارِ اضافه‌شده یا null (مقدار نامعتبر)
     *  - قیمت از قبل رد شده → فوراً «فعال‌شده» ثبت می‌شود (هشدار کاذب نمی‌سازد)
     *  - تکراری (جهت و قیمت یکسان، هنوز فعال‌نشده) → همان مورد قبلی برگردانده می‌شود */
    add: function (dir, price, currentUsd) {
      var p = parseFloat(price);
      if (!isFinite(p) || p <= 0) return null;
      if (dir !== 'above' && dir !== 'below') return null;

      // dedupe: اپسایلون نسبی کوچک
      for (var i = 0; i < this.list.length; i++) {
        var ex = this.list[i];
        if (ex.dir === dir && !ex.triggeredAt && Math.abs(ex.price - p) / p < 0.001) {
          ex.duplicate = true;
          return ex;
        }
      }

      var preMet = isFinite(currentUsd) && currentUsd > 0 &&
        ((dir === 'above' && currentUsd >= p) || (dir === 'below' && currentUsd <= p));

      var item = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        dir: dir,
        price: p,
        createdAt: Date.now(),
        triggeredAt: preMet ? Date.now() : null,
        preMet: !!preMet
      };
      this.list.unshift(item);
      this.save();
      return item;
    },

    remove: function (id) {
      this.list = this.list.filter(function (a) { return a.id !== id; });
      this.save();
    },

    /** فعال‌سازی مجدد — اگر شرط همین الان برقرار است، بی‌صدا مسلح نشو (هشدار کاذب نده) */
    rearm: function (id, currentUsd) {
      var rearmed = false;
      this.list.forEach(function (a) {
        if (a.id !== id) return;
        var preMet = isFinite(currentUsd) && currentUsd > 0 &&
          ((a.dir === 'above' && currentUsd >= a.price) || (a.dir === 'below' && currentUsd <= a.price));
        if (preMet) {
          a.triggeredAt = Date.now(); // از قبل رد شده — فعال‌شده بمان
          a.preMet = true;
        } else {
          a.triggeredAt = null;
          a.preMet = false;
          rearmed = true;
        }
      });
      this.save();
      return rearmed;
    },

    /** قیمت جدید را با همه هشدارهای فعال مقایسه کن؛ موارد فعال‌شده را برگردان */
    check: function (priceUsd) {
      if (priceUsd == null || !isFinite(priceUsd)) return [];
      var fired = [];
      this.list.forEach(function (a) {
        if (a.triggeredAt) return;
        var hit = (a.dir === 'above' && priceUsd >= a.price) ||
          (a.dir === 'below' && priceUsd <= a.price);
        if (hit) {
          a.triggeredAt = Date.now();
          fired.push(a);
        }
      });
      if (fired.length) this.save();
      return fired;
    },

    /** ساخت لیست در DOM — بدون innerHTML برای جلوگیری از تزریق؛ currentUsd برای نمایش فاصله */
    render: function (ul, currentUsd) {
      ul.textContent = '';
      var self = this;

      if (!this.list.length) {
        var li = document.createElement('li');
        li.className = 'alert-item';
        li.style.justifyContent = 'center';
        li.style.color = 'var(--text-faint)';
        li.textContent = 'هنوز هشداری ثبت نشده است';
        ul.appendChild(li);
        return;
      }

      this.list.forEach(function (a) {
        var row = document.createElement('li');
        row.className = 'alert-item' + (a.triggeredAt ? ' done' : '');

        var icon = document.createElement('span');
        icon.className = 'dir-icon';
        icon.textContent = a.dir === 'above' ? '🔼' : '🔽';

        var lbl = document.createElement('span');
        lbl.className = 'alert-price-lbl';
        lbl.textContent = PiNama.fmt.usd(a.price);

        var status = document.createElement('span');
        status.className = 'alert-status';
        if (a.triggeredAt) {
          status.textContent = 'فعال شد ✓';
        } else if (isFinite(currentUsd) && currentUsd > 0) {
          // فاصله تا هدف: مثبت = باید بالا برود، منفی = باید پایین بیاید
          var away = (a.price / currentUsd - 1) * 100;
          status.textContent = (away >= 0 ? '▲ ' : '▼ ') + Math.abs(away).toFixed(1) + '٪ مانده';
        } else {
          status.textContent = 'در انتظار';
        }

        var spacer = document.createElement('span');
        spacer.className = 'spacer';

        row.appendChild(icon);
        row.appendChild(lbl);
        row.appendChild(status);
        row.appendChild(spacer);

        if (a.triggeredAt) {
          var rearm = document.createElement('button');
          rearm.className = 'del';
          rearm.type = 'button';
          rearm.title = 'فعال‌سازی مجدد';
          rearm.textContent = '↺';
          rearm.addEventListener('click', function () {
            var ok = self.rearm(a.id, currentUsd);
            self.render(ul, currentUsd);
            if (PiNama.toast) {
              PiNama.toast(ok ? 'هشدار دوباره مسلح شد ✓' : 'این قیمت الان رد شده — فعال‌شده ماند', ok ? '' : 'gold');
            }
          });
          row.appendChild(rearm);
        }

        var del = document.createElement('button');
        del.className = 'del';
        del.type = 'button';
        del.title = 'حذف';
        del.textContent = '✕';
        del.addEventListener('click', function () {
          self.remove(a.id);
          self.render(ul);
        });
        row.appendChild(del);

        ul.appendChild(row);
      });
    }
  };
})();
