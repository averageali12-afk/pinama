/* سرور استاتیک ساده برای اجرای محلی پی‌نما:  node serve.js  */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.md': 'text/plain; charset=utf-8'
};

http.createServer(function (req, res) {
  var p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  var file = path.normalize(path.join(ROOT, p));
  if (file.indexOf(ROOT) !== 0) { res.writeHead(403); res.end('403'); return; }

  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, function () {
  console.log('پی‌نما روی  http://localhost:' + PORT + '  سرو می‌شود');
});
