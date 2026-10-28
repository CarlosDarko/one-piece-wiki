// Servidor estático mínimo con gzip, solo para medir tiempos de carga:  node scripts/serve-test.mjs <carpeta> <puerto>
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist'), port = Number(process.argv[3] ?? 4180);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.ico': 'image/x-icon' };
const cache = new Map();
createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(root, p)); if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    let e = cache.get(file); if (!e) { const raw = readFileSync(file); e = { raw, gz: gzipSync(raw, { level: 6 }) }; if (statSync(file).size < 5e6) cache.set(file, e); }
    const ok = /gzip/.test(req.headers['accept-encoding'] ?? '');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...(ok ? { 'Content-Encoding': 'gzip' } : {}), 'Cache-Control': 'no-store' }).end(ok ? e.gz : e.raw);
  } catch { res.writeHead(404).end('no encontrado'); }
}).listen(port, () => console.log('sirviendo', root, 'en http://localhost:' + port));
