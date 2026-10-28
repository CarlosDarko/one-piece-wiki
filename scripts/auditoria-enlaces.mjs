// Auditoría de los enlaces del contenido de las fichas (sin red): node scripts/auditoria-enlaces.mjs -> data/auditoria-enlaces.md
import { readFileSync, writeFileSync } from 'node:fs';
const idx = JSON.parse(readFileSync('public/data/index.js', 'utf8').replace(/^__od\("index",/, '').replace(/\);?\s*$/, '')); const N = idx.n.length;
let total = 0, interno = 0, externo = 0, roto = 0, otro = 0; const hosts = {};
for (let s = 0; s < 320; s++) { const t = readFileSync(`public/data/art/${s}.js`, 'utf8'); const o = JSON.parse(t.slice(t.indexOf(',') + 1, t.lastIndexOf(')'))); for (const k in o) for (const m of o[k].h.matchAll(/<a ([^>]*)>/g)) { total++; const a = m[1]; const di = a.match(/data-i="(\d+)"/); if (di) { interno++; if (+di[1] >= N) roto++; } else if (a.includes('class="ext"')) { externo++; const hh = a.split('href="')[1] ?? ''; const h = hh.split('/')[2]; hosts[h] = (hosts[h] || 0) + 1; } else otro++; } }
const antes = { total: 382518, interno: 360961, 'en.wikipedia.org (casi todo el «?» tras textos japoneses)': 19294, 'es.wikipedia.org': 319, 'onepiece.fandom.com / es.onepiece.wikia.com (la propia wiki en absoluto)': 881, 'otras wikis de Fandom (dragonball, naruto, toriko…)': 600, 'otros externos': 'resto' };
const md = `# Auditoría de enlaces del contenido

Generada ${new Date().toISOString()}.

## Reglas
- **Interno**: enlace a una ficha que existe (se resuelven redirecciones, alias, mayúsculas y parámetros). Si el enlace de la wiki apunta a una página que no existe (enlace rojo) queda como texto normal.
- **La propia wiki con URL absoluta** (onepiece.fandom.com, es.onepiece.wikia.com) → se convierte en interno.
- **Wikipedia y otras wikis**: se enlaza solo si el texto coincide con una ficha interna; si no, texto normal (nunca un enlace a Wikipedia disfrazado de interno). El «?» tras los textos japoneses se elimina.
- **Externo**: solo fuentes y referencias (IMDb, eldoblaje, Bandai, Toei, Shueisha, Viz, Crunchyroll, Netflix, YouTube, redes oficiales…), con icono ↗, \`target="_blank"\` y \`rel="noopener noreferrer nofollow"\`.
- Archivo:, Categoría:, Especial:, Ayuda:, Plantilla:, Usuario:, Blog: y anclas de la propia página → sin enlace.

## Cifras
| | Antes | Después |
|---|---:|---:|
| Enlaces en el contenido | ${antes.total.toLocaleString('es')} | ${total.toLocaleString('es')} |
| Internos | ${antes.interno.toLocaleString('es')} | ${interno.toLocaleString('es')} |
| Externos (fuentes con icono) | ~21.000 de todo tipo | ${externo} |
| Internos que apuntan a una ficha inexistente | — | ${roto} |
| Otros enlaces sin clasificar | — | ${otro} |

Quitados o convertidos: ${(antes.total - total).toLocaleString('es')} (de ellos, ~19.300 eran el «?» de ayuda del idioma japonés).

Servidores de los externos que se conservan: ${Object.entries(hosts).sort((a, b) => b[1] - a[1]).map(([h, n]) => `${h} (${n})`).join(', ')}.

Caso de referencia: en «Fruta Gomu Gomu», «melón Yubari» apuntaba a es.wikipedia.org/wiki/Yubari_King; ahora es texto normal (no hay ficha interna equivalente). Lógica en \`scripts/article.mjs\`; se aplica en cada actualización.
`;
writeFileSync('data/auditoria-enlaces.md', md); console.log(md.split('## Cifras')[1]);
