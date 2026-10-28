// Mide dist/: tamaño sin comprimir, gzip y brotli, por grupo, nº de ficheros y coste por visita.  node scripts/medir-dist.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk('dist').map((p) => p.replace(/\\/g, '/'));
const comp = (buf) => ({ raw: buf.length, gz: gzipSync(buf, { level: 9 }).length, br: brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: buf.length } }).length });
const group = (f) => (f.startsWith('dist/data/art/') ? 'artículos completos (320 lotes)' : f.startsWith('dist/data/detail/') ? 'detalle de fichas (64 lotes)' : f === 'dist/data/index.js' ? 'index.js (búsqueda)' : f === 'dist/data/imgs.js' ? 'imgs.js (miniaturas)' : /^dist\/data\/(featured|sets|timeline|places|meta|chap|rank)\.js$/.test(f) ? 'conjuntos del grafo, sagas, mapa…' : f.endsWith('.js') ? 'app JS' : f.endsWith('.css') ? 'CSS' : f.endsWith('.html') ? 'HTML' : 'otros');
const tot = {}; const per = {};
for (const f of files) { const c = comp(readFileSync(f)); const g = group(f); per[f] = c; const t = (tot[g] ??= { n: 0, raw: 0, gz: 0, br: 0 }); t.n++; for (const k of ['raw', 'gz', 'br']) t[k] += c[k]; }
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
const all = { n: files.length, raw: 0, gz: 0, br: 0 }; for (const t of Object.values(tot)) for (const k of ['raw', 'gz', 'br']) all[k] += t[k];
console.log('GRUPO'.padEnd(20), 'ficheros'.padStart(8), 'sin comprimir'.padStart(14), 'gzip'.padStart(10), 'brotli'.padStart(10));
for (const [g, t] of Object.entries(tot)) console.log(g.padEnd(20), String(t.n).padStart(8), mb(t.raw).padStart(14), mb(t.gz).padStart(10), mb(t.br).padStart(10));
console.log('TOTAL'.padEnd(20), String(all.n).padStart(8), mb(all.raw).padStart(14), mb(all.gz).padStart(10), mb(all.br).padStart(10));
const init = ['dist/index.html', ...files.filter((f) => /\.(css|js)$/.test(f) && f.startsWith('dist/assets/')), 'dist/data/featured.js'];
const sum = (k) => init.reduce((a, f) => a + per[f][k], 0);
console.log('\nPrimer payload hasta pintar el grafo (HTML+CSS+JS+featured):', 'sin comprimir', mb(sum('raw')), '| gzip', mb(sum('gz')), '| brotli', mb(sum('br')));
const shards = files.filter((f) => f.startsWith('dist/data/art/'));
const avg = (k) => shards.reduce((a, f) => a + per[f][k], 0) / shards.length;
const maxShard = (k) => Math.max(...shards.map((f) => per[f][k]));
console.log('Cada lote de artículo (al abrir una ficha completa):', 'medio sin comprimir', mb(avg('raw')), '| gzip', mb(avg('gz')), '| brotli', mb(avg('br')), '| máx brotli', mb(maxShard('br')));
console.log('Fichero más grande:', files.map((f) => [f, per[f].raw]).sort((a, b) => b[1] - a[1])[0].join(' '), 'bytes');
