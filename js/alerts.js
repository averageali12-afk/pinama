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

    /** خروجی: هشدارِ اضافه‌شده یا null (مقدار نامعتبر) */
    add: function (dir, price) {
      var p = parseFloat(price);
      if (!isFinite(p) || p <= 0) return null;
      if (dir !== 'above' && dir !== 'below') return null;
      var item = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        dir: dir,
        price: p,
        createdAt: Date.now(),
        triggeredAt: null
      };
      this.list.unshift(item);
      this.save();
      return item;
    },

    remove: function (id) {
      this.list = this.list.filter(function (a) { return a.id !== id; });
      this.save();
    },

    rearm: function (id) {
      this.list.forEach(function (a) {
        if (a.id === id) a.triggeredAt = null;
      });
      this.save();
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
            self.rearm(a.id);
            self.render(ul);
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
