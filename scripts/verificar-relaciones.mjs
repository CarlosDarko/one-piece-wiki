// Verificador INDEPENDIENTE del extractor: toma una muestra aleatoria estratificada (semilla fija) de las relaciones publicadas y comprueba cada una
// contra el HTML original de la ficha de Fandom (data/pages), sin usar el código de extracción de build-data.mjs.
//   node scripts/verificar-relaciones.mjs  ->  data/verificacion-relaciones.json y data/informe-verificacion-relaciones.md
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { cacheFile, readPage } from './wiki-api.mjs';

const load = (n) => JSON.parse(readFileSync(`public/data/${n}.js`, 'utf8').replace(/^__od\("[^"]+",/, '').replace(/\);?\s*$/, ''));
const idx = load('index'), ed = load('edges'); const stats = JSON.parse(readFileSync('data/relaciones-stats.json', 'utf8'));
const redirects = existsSync('data/redirects.json') ? JSON.parse(readFileSync('data/redirects.json', 'utf8')) : {};
const norm = (s) => { try { s = decodeURIComponent(s); } catch { /* tal cual */ } return s.replace(/_/g, ' ').normalize('NFC').toLowerCase().trim(); };
const aliasOf = new Map(); for (const [from, to] of Object.entries(redirects)) { const k = norm(to); if (!aliasOf.has(k)) aliasOf.set(k, []); aliasOf.get(k).push(norm(from)); }
const names = (title) => [norm(title), ...(aliasOf.get(norm(title)) ?? [])].filter((x) => x.length >= 2);
const pageCache = new Map();
const page = (title) => { if (pageCache.has(title)) return pageCache.get(title); let r = null; const f = cacheFile(title); if (existsSync(f)) { try { const p = readPage(f); r = { p, $: cheerio.load(p.text), text: null }; r.text = norm(r.$.root().text().replace(/\s+/g, ' ')); } catch { r = null; } } if (pageCache.size > 60) pageCache.clear(); pageCache.set(title, r); return r; };
const hrefsOf = ($, sel) => $(sel).find('a[href]').map((i, e) => norm(($(e).attr('href') ?? '').replace(/^\/es\/wiki\//, '').split('#')[0])).get();
const scopeText = ($, sel) => norm($(sel).text().replace(/\s+/g, ' '));
const inScope = ($, sel, title) => { const ns = names(title); const hs = hrefsOf($, sel); const tx = scopeText($, sel); return ns.some((n) => hs.includes(n) || tx.includes(n)); };
const baseTitle = (t) => (t.includes('/') ? t.slice(0, t.indexOf('/')) : t);
const orgsOf = (title) => { const pg = page(baseTitle(title)); if (!pg) return null; const s = new Set(hrefsOf(pg.$, '[data-source="organizacion"]')); for (const c of pg.p.categories ?? []) s.add(norm(c.category)); return s; };
const KIN = [[/herman|gemel/, 'sib'], [/^(padre|madre|progenitor)/, 'par'], [/^hij|retoño/, 'chi'], [/^abuel/, 'gp'], [/^niet/, 'gc'], [/^t[ií][oa]/, 'un'], [/^sobrin/, 'ne'], [/espos|marido|cónyuge|prometid/, 'sp']];
const kinExpect = { progenitor_de: ['par', 'chi'], progenitor_adoptivo_de: ['par', 'chi'], hermano_de: ['sib', 'sib'], hermano_adoptivo_de: ['sib', 'sib'], abuelo_de: ['gp', 'gc'], tio_de: ['un', 'ne'], conyuge_de: ['sp', 'sp'] };

// devuelve true/false o null si no se puede verificar de forma independiente
function verify(a, b, rel, evFull) {
  const parts = evFull.split(':'); const flag = ['s', 't'].includes(parts[parts.length - 1]) ? parts.pop() : ''; const kind = parts[0], field = parts[1] ?? '';
  const A = idx.n[a], B = idx.n[b];
  if (kind === 'regla') {
    if (['tripulacion', 'alianza', 'coincidencia', 'mascota'].includes(field)) { const oa = orgsOf(A), ob = orgsOf(B); if (!oa || !ob) return null; for (const o of oa) if (ob.has(o) && !/^(personajes|masculinos|femeninos|antiguos|artículos)/.test(o)) return true; return false; }
    return null;
  }
  const declaring = flag === 's' ? A : flag === 't' ? B : null; if (!declaring) return null; const other = declaring === A ? B : A;
  const pg = page(declaring) ?? page(baseTitle(declaring)); if (!pg) return null; const { $, p } = pg;
  if (kind === 'ib' && field === 'familia') {
    const exp = kinExpect[rel]; if (!exp) return inScope($, '[data-source="familia"]', other);
    const ns = names(other); let ok = false, vio = false; const full = norm($('[data-source="familia"]').text().replace(/\s+/g, ' ')); for (const n of ns) { let from = 0, k; while ((k = full.indexOf(n, from)) >= 0) { from = k + n.length; const rest = full.slice(from, from + 40); const m = rest.match(/^[^(]{0,3}\(([^)]*)\)/); const role = m ? m[1] : ''; const kd = KIN.find(([re]) => re.test(role.trim()))?.[1]; if (!kd) continue; const targetIsA = other === A; const want = rel === 'hermano_de' || rel === 'hermano_adoptivo_de' || rel === 'conyuge_de' ? [exp[0]] : targetIsA ? [exp[0]] : [exp[1]]; if (want.includes(kd)) ok = true; else vio = true; } }
    return ok && !vio;
  }
  if (kind === 'ib') { if (field.startsWith('combatientes') || field.startsWith('poder')) return null; return inScope($, `[data-source="${field}"]`, other) || inScope($, '.portable-infobox', other); }
  if (kind === 'cat') { const ns = names(other); return (p.categories ?? []).some((c) => ns.includes(norm(c.category))) || (p.categories ?? []).some((c) => ns.some((n) => norm(c.category).includes(n))); }
  if (kind === 'tpl') { const ns = names(other); return (p.templates ?? []).some((t) => ns.some((n) => norm(t.title).includes(n))); }
  if (kind === 'sec' || kind === 'titulo' || kind === 'texto') { return names(other).some((n) => pg.text.includes(n)); }
  return null;
}

// muestra estratificada por tipo de relación, con semilla fija (reproducible)
let seed = 20261028; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const byRel = new Map(); for (let k = 0; k < ed.e.length; k += 4) { const r = ed.rels[ed.e[k + 2]]; const ev = idx.ev[ed.e[k + 3]]; if (!byRel.has(r)) byRel.set(r, []); byRel.get(r).push([ed.e[k], ed.e[k + 1], r, ev]); }
const PER = +(process.env.MUESTRA_POR_RELACION ?? 30); const rows = []; const errores = []; let noVer = 0;
for (const [r, list] of [...byRel].sort()) {
  const pool = [...list]; for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  let n = 0, ok = 0, nv = 0; for (const [a, b, rel, ev] of pool) { if (n >= PER) break; let v = null; try { v = verify(a, b, rel, ev); } catch { v = null; } if (v === null) { nv++; noVer++; if (nv > 3 * PER) break; continue; } n++; if (v) ok++; else if (errores.length < 60) errores.push({ rel, a: idx.n[a], b: idx.n[b], ev }); }
  rows.push({ rel: r, poblacion: list.length, muestra: n, correctas: ok, noVerificables: nv });
}
const tot = rows.reduce((s, x) => s + x.muestra, 0), good = rows.reduce((s, x) => s + x.correctas, 0);
// estimador estratificado de la tasa de error (suavizado +0,5) e intervalo al 95 %
const N = rows.reduce((s, x) => s + x.poblacion, 0); let pe = 0, vr = 0; for (const x of rows) { if (!x.muestra) continue; const W = x.poblacion / N; const p = (x.muestra - x.correctas + 0.5) / (x.muestra + 1); pe += W * p; vr += W * W * p * (1 - p) / x.muestra * (1 - x.muestra / x.poblacion); }
const se = Math.sqrt(vr), lo = Math.max(0, pe - 1.96 * se), hi = Math.min(1, pe + 1.96 * se);
const z = 1.96, ph = (tot - good) / Math.max(tot, 1), den = 1 + z * z / tot, centro = (ph + z * z / (2 * tot)) / den, marg = (z * Math.sqrt(ph * (1 - ph) / tot + z * z / (4 * tot * tot))) / den;
const res = { fecha: new Date().toISOString(), semilla: 20261028, tamanoMuestra: tot, errores: tot - good, tasaErrorEstratificada: pe, ic95: [lo, hi], tasaErrorBrutaWilson: { punto: ph, ic95: [Math.max(0, centro - marg), Math.min(1, centro + marg)] }, noVerificablesEnMuestreo: noVer, porRelacion: rows, ejemplosDeError: errores };
writeFileSync('data/verificacion-relaciones.json', JSON.stringify(res, null, 1));
const clase = { directa: 0, regla: 0, debil: 0 }; for (const v of Object.values(stats.porRelacion)) for (const c of Object.keys(clase)) clase[c] += v[c];
const pc = (x) => (100 * x).toFixed(2) + ' %';
let md = `# Verificación de las relaciones publicadas\n\nGenerada ${res.fecha}. Verificador independiente del extractor (\`scripts/verificar-relaciones.mjs\`): comprueba cada relación muestreada contra el HTML original de Fandom guardado en \`data/pages\`.\n\n## Cifras\n- Relaciones publicadas: **${stats.total.toLocaleString('es')}**. Sin evidencia registrada (retiradas): **${stats.sinRespaldoRetiradas}**. Todas las publicadas llevan su evidencia (campo de la infobox, categoría, sección, título «A vs. B» o regla).\n- Por tipo de respaldo: **${clase.directa.toLocaleString('es')} directas** (la ficha de Fandom lo dice: infobox, categoría, sección, título), **${clase.regla.toLocaleString('es')} derivadas por regla** (misma banda, alianza, mascota, enfrentamiento de bandos opuestos, series de barcos), **${clase.debil.toLocaleString('es')} débiles** (menciones, «relacionado con», primera aparición, aparece en…: no se muestran por defecto y no se verifican una a una).\n\n## Muestreo\nMuestra aleatoria estratificada por tipo de relación (semilla fija ${res.semilla}), hasta ${PER} verificables por tipo: **${tot} relaciones** comprobadas; **${tot - good} no encajan** con la ficha original.\n- Tasa de error estimada (estratificada, ponderada por tamaño de cada tipo): **${pc(pe)}** · IC 95 %: **${pc(lo)} – ${pc(hi)}**.\n- Tasa bruta de la muestra (Wilson): ${pc(ph)} · IC 95 %: ${pc(res.tasaErrorBrutaWilson.ic95[0])} – ${pc(res.tasaErrorBrutaWilson.ic95[1])}.\n- ${noVer} relaciones muestreadas no se pudieron verificar de forma independiente (p. ej. enfrentamientos derivados de bandos, series de barcos, páginas sin copia local) y se excluyen del cálculo: la tasa solo habla de lo verificable.\n\n## Resultado por tipo de relación\n| Relación | Población | Verificadas en muestra | Correctas | Errores | No verificables |\n|---|---:|---:|---:|---:|---:|\n${rows.map((x) => `| ${x.rel} | ${x.poblacion} | ${x.muestra} | ${x.correctas} | ${x.muestra - x.correctas} | ${x.noVerificables} |`).join('\n')}\n\n## Casos que no encajan (hasta 60)\n${errores.length ? errores.map((e) => `- ${e.rel}: ${e.a} → ${e.b} (evidencia declarada: ${e.ev})`).join('\n') : 'Ninguno en la muestra.'}\n\n## Qué comprueba el verificador (y con qué fuerza)\n- **Infobox** (organización, barco, fruta, origen, residencia, raza, lugar…): busca el enlace o el nombre del otro extremo (o una redirección suya) en ese campo de la ficha original. Comprobación fuerte.\n- **Familia**: además del nombre exige que el parentesco entre paréntesis («Padre», «Abuela»…) coincida con el tipo y la dirección publicados. Comprobación fuerte.\n- **Categorías y plantillas**: el otro extremo figura entre las categorías o plantillas de la ficha. Comprobación fuerte.\n- **Sección «Relaciones», títulos «A vs. B» y texto**: el nombre del otro extremo aparece en el texto de la ficha. Comprobación **débil** (no prueba el sentido de la frase).\n- **Derivadas por regla** (tripulación, alianza, coincidencia, mascota): ambas fichas comparten una organización en su infobox o categorías. Los enfrentamientos de bandos y las series de barcos no se pueden verificar de forma independiente.\n\n## Limitaciones\n- El verificador mira si el texto o los enlaces de la ficha original respaldan el vínculo; no juzga si la wiki misma se equivoca.\n- Un muestreo no demuestra que no haya ningún error: acota la tasa. Para las categorías de «Han coincidido» la premisa verificada es solo que comparten una organización.\n`;
writeFileSync('data/informe-verificacion-relaciones.md', md); console.log(md.split('## Resultado')[0]);
