// Jerarquía de categorías (padres) para las categorías de las fichas rastreadas. <=1 req/s, mismo UA y backoff que el rastreo.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const UA = 'personal-research-script/0.1';
const API = 'https://onepiece.fandom.com/es/api.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, last = 0;
async function api(params) {
  for (;;) {
    const w = last + 1100 - Date.now(); if (w > 0) await sleep(w); last = Date.now();
    try {
      const res = await fetch(API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params }), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000) });
      if (res.ok) { const j = await res.json(); if (!j.error) { fails = 0; return j; } }
      fails++; const ra = Number(res.headers.get('retry-after')) || 0;
      await sleep(Math.max(ra * 1000, Math.min(3 * 3600e3, 5000 * 2 ** Math.min(fails, 12)) * (0.6 + Math.random() * 0.8)));
    } catch { fails++; await sleep(Math.min(3 * 3600e3, 5000 * 2 ** Math.min(fails, 12))); }
  }
}
const parents = existsSync('data/catparents.json') ? JSON.parse(readFileSync('data/catparents.json', 'utf8')) : {};
let todo = new Set();
for (const f of readdirSync('data/pages')) for (const c of JSON.parse(gunzipSync(readFileSync('data/pages/' + f))).categories) todo.add(c.category.replace(/_/g, ' '));
for (let depth = 0; depth < 3; depth++) {
  const names = [...todo].filter((c) => !(c in parents)); todo = new Set();
  console.log(`nivel ${depth}: ${names.length} categorías`);
  for (let i = 0; i < names.length; i += 50) {
    const chunk = names.slice(i, i + 50);
    let cont = {};
    do {
      const j = await api({ action: 'query', prop: 'categories', cllimit: 'max', titles: chunk.map((c) => 'Categoría:' + c).join('|'), ...cont });
      for (const p of j.query?.pages ?? []) {
        const name = p.title.replace(/^Categoría:/, ''); parents[name] ??= [];
        for (const c of p.categories ?? []) { const pn = c.title.replace(/^Categoría:/, ''); if (!parents[name].includes(pn)) parents[name].push(pn); todo.add(pn); }
      }
      cont = j.continue ?? null;
    } while (cont);
    for (const c of chunk) parents[c] ??= [];
    writeFileSync('data/catparents.json', JSON.stringify(parents));
  }
}
console.log('categorías con jerarquía:', Object.keys(parents).length);
