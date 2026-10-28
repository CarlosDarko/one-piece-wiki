// Vuelca las fichas dudosas con evidencia (primera frase, categorías) para revisión: node scripts/dump-dudosos.mjs [umbral]
import { readFileSync } from 'node:fs';
const th = Number(process.argv[2] ?? 0.5);
const readData = (f) => { const t = readFileSync(f, 'utf8'); return JSON.parse(t.slice(t.indexOf(',') + 1, t.lastIndexOf(')'))); };
const nodes = readData('public/data/nodes.js');
const out = [];
for (let k = 0; k < 64; k++) { const sh = readData(`public/data/detail/${k}.js`); for (const [i, d] of Object.entries(sh)) { const n = nodes.n[i]; if (n.c < th) out.push([n.n, nodes.types[n.t], n.c, d.r.slice(0, 90), d.cats.filter((c) => !/spoiler|Referenciar|errores|Páginas|Artículos/.test(c)).slice(0, 3).join(' · ')]); } }
out.sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
console.log(out.length); for (const o of out) console.log(o.join(' | '));
