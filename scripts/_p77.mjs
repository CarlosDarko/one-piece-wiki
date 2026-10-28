import { readFileSync, writeFileSync } from 'node:fs';
const edit = (file, pairs, all = false) => { let s = readFileSync(file, 'utf8'); for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(file + ' no: ' + a.slice(0, 70)); s = all ? s.split(a).join(b) : s.replace(a, () => b); } writeFileSync(file, s); };
edit('src/data.ts', [
  ["miembro_de: { c: '#59c98b', w: 1.8 },", "miembro_de: { c: '#59c98b', w: 1.8 }, companero_de: { c: '#2dd4bf', w: 2 }, enemigo_de: { c: '#ef4444', w: 2.2 }, enfrenta_a: { c: '#ff9f43', w: 2.2 },"],
  ["export const REL_ORDER = ['miembro_de', 'capitan_de', 'usa_barco', 'come',", "export const REL_ORDER = ['miembro_de', 'capitan_de', 'familiar_de', 'companero_de', 'enemigo_de', 'enfrenta_a', 'usa_barco', 'come',"],
  ["export const plural = ", "// nombre legible de las subpáginas («Arco de X/Enfrentamientos» → «Enfrentamientos: Arco de X»)\nexport const shownName = (i: number): string => { const n = nameOf(i), k = n.indexOf('/'); return k < 0 ? n : `${n.slice(k + 1)}: ${n.slice(0, k)}`; };\n// categorías secundarias (tono gris): ocultas por defecto en el grafo\nexport const GREY_RELS = new Set(['combatiente_en', 'propiedad_de', 'es_de_raza', 'primera_aparicion', 'aparece_en', 'doblado_por', 'relacionado', 'menciona', 'categorizado_en', 'clase']);\nexport const plural = "],
  ["export function relLabel(rel: string, dir: number, self: number, count = 1): string {\n", "export function relLabel(rel: string, dir: number, self: number, count = 1): string {\n  const SYM: Record<string, string> = { familiar_de: 'Familia', companero_de: 'Compañeros', enemigo_de: 'Enemigos', enfrenta_a: 'Enfrentamientos' }; if (SYM[rel]) return SYM[rel]!;\n"],
]);
edit('src/panel.ts', [["<span class=\"nm\">${esc(nameOf(j))}", "<span class=\"nm\">${esc(shownName(j))}"], ["isFace, valueHtml,", "isFace, shownName, valueHtml,"]]);
edit('src/search.ts', [["<span class=\"nm\">${esc(nameOf(i))}</span>", "<span class=\"nm\">${esc(shownName(i))}</span>"], ["import { IDX, findByTitle,", "import { IDX, shownName, findByTitle,"]], true);
edit('src/views/quien.ts', [
  ["const nm = nameOf(i), lines = wrap(nm, c ? 26 : 16)", "const nm = shownName(i), lines = wrap(nm, c ? 26 : 16)"],
  ["relLabel, ensureImgs,", "relLabel, shownName, GREY_RELS, ensureImgs,"],
  ["    this.center = i; this.shown.clear(); this.groups = this.buildGroups(i, d);", "    this.center = i; this.shown.clear(); this.groups = this.buildGroups(i, d);\n    // las categorías coloreadas (vínculos con sentido) se ven; las grises (menciones, raza, primera aparición…) empiezan ocultas y se activan en «Relaciones»\n    this.groups.forEach((g) => { g.hidden = GREY_RELS.has(g.rel); });"],
  ["(this.stage.querySelector('#q-fn') as HTMLElement).textContent = this.groups.length ? `${on} de ${this.groups.length} activas` : 'sin relaciones';", "(this.stage.querySelector('#q-fn') as HTMLElement).textContent = this.groups.length ? `${on} de ${this.groups.length} activas${on < this.groups.length ? ` · ${this.groups.length - on} ocultas` : ''}` : 'sin relaciones';"],
]);
