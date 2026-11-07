// Tiny static file server for testing: node tools/serve.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const port = Number(process.argv[2] || 8150);
// With a second argument of "strict", serves the published build under strict page rules.
const strict = process.argv[3] === 'strict';
const CSP = "default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; connect-src 'none'";
const SHELL = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/json' };
http.createServer((req, res) => {
  if (strict) {
    const page = SHELL + fs.readFileSync(path.join(root, 'dist/artifact/orbit-acres.html'), 'utf8') + '</body></html>';
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store' });
    res.end(page);
    return;
  }
  const url = decodeURIComponent(req.url.split('?')[0]);
  // Lets tools/cook/dump.js hand models from the page to Blender.
  if (req.method === 'POST' && url.startsWith('/__cook/') && !url.slice(8).includes('/')) {
    const dir = path.join(root, 'tools/cook/raw');
    fs.mkdirSync(dir, { recursive: true });
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => { fs.writeFileSync(path.join(dir, url.slice(8)), Buffer.concat(chunks)); res.writeHead(200); res.end('ok'); });
    return;
  }
  const file = path.join(root, url === '/' ? 'index.html' : url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('Orbit Acres on http://127.0.0.1:' + port));
