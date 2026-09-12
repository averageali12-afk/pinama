/* پی‌نما — نمودار خطی Canvas سبک‌وزن با تولتیپ لمسی */
(function () {
  'use strict';

  var fmt = PiNama.fmt;

  var COLORS = {
    line: '#8a4fff',
    lineBright: '#c084fc',
    fillTop: 'rgba(138, 79, 255, 0.30)',
    fillBottom: 'rgba(138, 79, 255, 0.00)',
    grid: 'rgba(169, 158, 199, 0.12)',
    text: '#7a6f9b',
    gold: '#f7c948',
    red: '#f87171'
  };

  function Chart(canvas, tooltipEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tooltip = tooltipEl;
    this.series = null;      // [[ts, price], ...]
    this.geometry = null;    // برای تولتیپ
    this.refPrice = null;    // خط مرجع قیمت لحظه‌ای
    this._rafPending = false;

    var self = this;
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () { self.scheduleDraw(); }).observe(canvas.parentElement);
    } else {
      window.addEventListener('resize', function () { self.scheduleDraw(); });
    }

    canvas.addEventListener('pointermove', function (e) { self.onPointer(e); });
    canvas.addEventListener('pointerdown', function (e) { self.onPointer(e); });
    canvas.addEventListener('pointerleave', function () { self.hideTooltip(); });
    // لمس: با رهاکردن انگشت یا اسکرول، تولتیپ بمانَد نگیرد
    canvas.addEventListener('pointerup', function () { self.hideTooltip(); });
    canvas.addEventListener('pointercancel', function () { self.hideTooltip(); });
    window.addEventListener('scroll', function () { self.hideTooltip(); }, { passive: true });
  }

  Chart.prototype.setData = function (series) {
    this.series = series;
    this.draw();
  };

  Chart.prototype.scheduleDraw = function () {
    if (this._rafPending) return;
    this._rafPending = true;
    var self = this;
    requestAnimationFrame(function () {
      self._rafPending = false;
      self.draw();
    });
  };

  Chart.prototype.setReference = function (usd) {
    if (this.refPrice === usd) return;
    this.refPrice = usd;
    this.scheduleDraw();
  };

  Chart.prototype.draw = function () {
    var canvas = this.canvas;
    var wrap = canvas.parentElement;
    if (!wrap) return;
    var dpr = window.devicePixelRatio || 1;
    var w = wrap.clientWidth;
    var h = wrap.clientHeight;
    if (w < 10 || h < 10 || !this.series || this.series.length < 2) return;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    var ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var s = this.series;
    var pad = { top: 14, right: 10, bottom: 20, left: 10 };
    var plotW = w - pad.left - pad.right;
    var plotH = h - pad.top - pad.bottom;

    var min = Infinity, max = -Infinity;
    for (var i = 0; i < s.length; i++) {
      var v = s[i][1];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min === max) { min -= 0.001; max += 0.001; }
    var span = max - min;
    min -= span * 0.07;
    max += span * 0.07;

    var t0 = s[0][0], t1 = s[s.length - 1][0] || 1;
    function X(t) { return pad.left + ((t - t0) / Math.max(1, t1 - t0)) * plotW; }
    function Y(v) { return pad.top + (1 - (v - min) / (max - min)) * plotH; }

    // شبکه افقی + برچسب قیمت
    ctx.font = '10px sans-serif';
    ctx.textBaseline = 'middle';
    for (var g = 0; g <= 2; g++) {
      var gv = min + ((max - min) * g) / 2;
      var gy = Y(gv);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(w - pad.right, gy);
      ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = 'left';
      ctx.fillText('$' + gv.toFixed(4), pad.left + 4, gy - 7);
    }

    // مسیر خط
    var linePath = new Path2D();
    for (var k = 0; k < s.length; k++) {
      var lx = X(s[k][0]), ly = Y(s[k][1]);
      if (k === 0) linePath.moveTo(lx, ly);
      else linePath.lineTo(lx, ly);
    }
    var fill = new Path2D(linePath);
    fill.lineTo(X(t1), pad.top + plotH);
    fill.lineTo(X(t0), pad.top + plotH);
    fill.closePath();
    var grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    grad.addColorStop(0, COLORS.fillTop);
    grad.addColorStop(1, COLORS.fillBottom);
    ctx.fillStyle = grad;
    ctx.fill(fill);

    // خودِ خط
    var rising = s[s.length - 1][1] >= s[0][1];
    ctx.strokeStyle = rising ? COLORS.lineBright : COLORS.red;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke(linePath);

    // خط مرجع قیمت لحظه‌ای (خط‌چین طلایی)
    if (this.refPrice != null && isFinite(this.refPrice) && this.refPrice >= min && this.refPrice <= max) {
      var ry = Y(this.refPrice);
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, ry);
      ctx.lineTo(w - pad.right, ry);
      ctx.stroke();
      ctx.restore();
    }

    // نقطه آخر (قیمت الان)
    var lastX = X(t1), lastY = Y(s[s.length - 1][1]);
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // برچسب تاریخ ابتدا/انتها
    ctx.fillStyle = COLORS.text;
    ctx.font = '9px sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(fmt.dateShort.format(new Date(t0)), pad.left + 2, h - 6);
    ctx.textAlign = 'right';
    ctx.fillText(fmt.dateShort.format(new Date(t1)), w - pad.right - 2, h - 6);

    this.geometry = { X: X, t0: t0, t1: t1, series: s, pad: pad, w: w };
  };

  Chart.prototype.onPointer = function (e) {
    if (!this.geometry || !this.series) return;
    var rect = this.canvas.getBoundingClientRect();
    var cx = e.clientX - rect.left;
    var g = this.geometry;

    // چون نمودار LTR است ولی صفحه RTL، مختصات CSS از چپ اندازه‌گیری می‌شود و همین cx درست است
    var ratio = (cx - g.pad.left) / Math.max(1, g.w - g.pad.left - 10);
    ratio = Math.max(0, Math.min(1, ratio));
    var targetT = g.t0 + ratio * (g.t1 - g.t0);

    // نزدیک‌ترین نقطه
    var best = null, bestDist = Infinity;
    for (var i = 0; i < this.series.length; i++) {
      var d = Math.abs(this.series[i][0] - targetT);
      if (d < bestDist) { bestDist = d; best = this.series[i]; }
    }
    if (!best) return;

    var tip = this.tooltip;
    tip.hidden = false;
    tip.textContent = fmt.usd(best[1]) + '  —  ' + fmt.dateShort.format(new Date(best[0]));

    // جای تولتیپ: نزدیک نقطه، ولی داخل کادر
    var tipX = g.X(best[0]);
    var half = tip.offsetWidth / 2;
    var left = Math.max(half + 4, Math.min(g.w - half - 4, tipX));
    tip.style.left = left + 'px';
  };

  Chart.prototype.hideTooltip = function () {
    if (this.tooltip) this.tooltip.hidden = true;
  };

  PiNama.Chart = Chart;
})();
