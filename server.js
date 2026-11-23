// MEHER Admin — zero-dependency static server. Serves only this folder.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const START_PORT = Number(process.argv[2]) || 8082;
const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.txt':'text/plain; charset=utf-8','.ico':'image/x-icon','.csv':'text/csv; charset=utf-8','.gs':'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let filePath = path.normalize(path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch { res.writeHead(400); res.end('Bad Request'); }
});
function listen(port, attemptsLeft) {
  server.once('error', err => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) listen(port + 1, attemptsLeft - 1);
    else { console.error('Server error:', err.message); process.exit(1); }
  });
  server.listen(port, () => console.log(`MEHER Admin → http://localhost:${port}/`));
}
listen(START_PORT, 10);
