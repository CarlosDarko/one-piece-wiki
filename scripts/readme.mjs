// README del sitio (el que se ve en main) y comprobación de que los README no se quedan desfasados.
//   node scripts/readme.mjs            regenera las cifras de actions/README-sitio.md desde data/ (lo llama actualizar.mjs)
//   node scripts/readme.mjs --comprobar  falla si un README no menciona alguna sección de la web, perdió los marcadores o lleva cifras fijas
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const leer = (f) => readFileSync(resolve(ROOT, f), 'utf8');
const json = (f) => (existsSync(resolve(ROOT, f)) ? JSON.parse(leer(f)) : {});
const SITIO = 'actions/README-sitio.md', FUENTE = 'README.md';
const INI = '<!--auto:inicio-->', FIN = '<!--auto:fin-->';
const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function cifras() {
  const q = json('data/informe-calidad.json'), u = json('data/ultima-actualizacion.json');
  const partes = [];
  if (q.fichas) partes.push(`**${miles(q.fichas)}** fichas`);
  if (q.aristas_tipadas) partes.push(`**${miles(q.aristas_tipadas)}** relaciones entre ellas`);
  if (u.fecha) partes.push(`última actualización: **${u.fecha.slice(0, 10)}**`);
  return partes.length ? `${INI}\n${partes.join(' · ')}\n${FIN}` : null;
}

// Secciones de la web (pestañas de index.html) y la etiqueta que muestran
function secciones() {
  return [...leer('index.html').matchAll(/<a href="#\/[^"]*" data-v="[^"]+">([^<]+)<\/a>/g)].map((m) => m[1]);
}

export function generar() {
  const bloque = cifras(); if (!bloque) return false;
  const txt = leer(SITIO), re = new RegExp(`${INI}[\\s\\S]*?${FIN}`);
  if (!re.test(txt)) throw new Error(`${SITIO} no tiene los marcadores ${INI} … ${FIN}`);
  const nuevo = txt.replace(re, bloque);
  if (nuevo !== txt) writeFileSync(resolve(ROOT, SITIO), nuevo);
  return true;
}

function comprobar() {
  const errores = [];
  const sitio = leer(SITIO), fuente = leer(FUENTE);
  if (!sitio.includes(INI) || !sitio.includes(FIN)) errores.push(`${SITIO}: faltan los marcadores de cifras automáticas`);
  for (const s of secciones()) for (const [f, t] of [[SITIO, sitio], [FUENTE, fuente]]) if (!t.toLowerCase().includes(s.toLowerCase())) errores.push(`${f}: no menciona la sección «${s}» de la web`);
  // cifras fijas que se quedarían viejas: el README de la fuente no debe llevar recuentos escritos a mano
  for (const m of fuente.matchAll(/\b\d{1,3}(?:\.\d{3})+\b|\b\d+\s+(?:pruebas|comprobaciones|lotes|MB)\b/g)) errores.push(`${FUENTE}: cifra fija «${m[0]}» (usa ${SITIO}, que se regenera, o quítala)`);
  for (const f of ['scripts/actualizar.mjs', 'scripts/prueba-humo.mjs', 'scripts/publicar.mjs']) if (!fuente.includes(f.replace('scripts/', '')) && f === 'scripts/prueba-humo.mjs') errores.push(`${FUENTE}: no menciona ${f}`);
  if (errores.length) { for (const e of errores) console.error('::error::' + e); console.error(`\nREADME desfasado (${errores.length}). Actualízalo junto con el cambio que lo causa.`); process.exit(1); }
  console.log('README al día: marcadores, secciones y sin cifras fijas.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--comprobar')) comprobar(); else console.log(generar() ? 'Cifras del README del sitio actualizadas.' : 'Sin datos para las cifras.');
}
