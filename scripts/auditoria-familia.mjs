// Auditoría de parentescos de los personajes principales (lee public/data tras la reconstrucción): node scripts/auditoria-familia.mjs -> data/auditoria-familia.md
import { readFileSync, writeFileSync } from 'node:fs';
const load = (n) => JSON.parse(readFileSync(`public/data/${n}.js`, 'utf8').replace(/^__od\("[^"]+",/, '').replace(/\);?\s*$/, ''));
const idx = load('index'), ed = load('edges'); const id = (n) => idx.n.indexOf(n);
const K = { progenitor_de: ['Hijos', 'Padres'], progenitor_adoptivo_de: ['Hijos adoptivos', 'Padres adoptivos'], hermano_de: ['Hermanos', 'Hermanos'], hermano_adoptivo_de: ['Hermanos adoptivos o jurados', 'Hermanos adoptivos o jurados'], abuelo_de: ['Nietos', 'Abuelos'], tio_de: ['Sobrinos', 'Tíos'], conyuge_de: ['Cónyuges', 'Cónyuges'], familiar_de: ['Otros familiares', 'Otros familiares'] };
const PRINCIPALES = ['Monkey D. Luffy', 'Portgas D. Ace', 'Sabo', 'Monkey D. Dragon', 'Monkey D. Garp', 'Gol D. Roger', 'Portgas D. Rouge', 'Edward Newgate', 'Shanks', 'Trafalgar D. Water Law', 'Eustass Kid', 'Nami', 'Nojiko', 'Bell-mère', 'Vinsmoke Sanji', 'Sanji', 'Vinsmoke Judge', 'Roronoa Zoro', 'Usopp', 'Yasopp', 'Tony Tony Chopper', 'Nico Robin', 'Franky', 'Brook', 'Jinbe', 'Charlotte Linlin', 'Kaidou', 'Yamato', 'Boa Hancock', 'Boa Sandersonia', 'Dracule Mihawk', 'Perona', 'Buggy', 'Donquixote Doflamingo', 'Donquixote Rocinante', 'Vegapunk'];
let md = `# Auditoría de parentescos\n\nGenerada ${new Date().toISOString()}. Cada vínculo se orienta desde cada ficha (si A es padre de B: A ve «Hijos: B» y B ve «Padres: A»). Fuente: campo «Familia» de la infobox (\`Nombre (Rol)\`, donde Rol es lo que esa persona es respecto a la ficha). Sin heurísticas sobre párrafos: dieron falsos parientes.\n\n`;
const cuenta = {}; for (let k = 0; k < ed.e.length; k += 3) { const r = ed.rels[ed.e[k + 2]]; if (K[r]) cuenta[r] = (cuenta[r] ?? 0) + 1; }
md += `Vínculos de familia publicados: ${Object.entries(cuenta).map(([r, n]) => `${r} ${n}`).join(', ')}.\n\n## Personajes principales\n\n`;
for (const nm of PRINCIPALES) {
  const i = id(nm); if (i < 0) { md += `- **${nm}**: sin ficha con ese nombre.\n`; continue; } const by = {};
  for (let k = 0; k < ed.e.length; k += 3) { const a = ed.e[k], b = ed.e[k + 1], r = ed.rels[ed.e[k + 2]]; if (!K[r] || (a !== i && b !== i)) continue; const dir = a === i ? 0 : 1; const lab = K[r][dir]; (by[lab] ??= new Set()).add(idx.n[a === i ? b : a]); }
  md += `- **${nm}**: ${Object.keys(by).length ? Object.entries(by).map(([l, s]) => `${l}: ${[...s].join(', ')}`).join(' · ') : 'sin parentescos registrados en la wiki'}\n`;
}
writeFileSync('data/auditoria-familia.md', md); console.log(md.split('## Personajes')[0]);
