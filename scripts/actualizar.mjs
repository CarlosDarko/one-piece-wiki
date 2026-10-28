// Actualización incremental: detecta lo que ha cambiado en la wiki, recarga solo eso, reconstruye, (opcional) prueba y publica.
//   node scripts/actualizar.mjs                 cambios desde la última sincronización (recentchanges + logevents)
//   node scripts/actualizar.mjs --barrido       detecta cambios comparando revisiones de TODAS las fichas (≈3 min; red de seguridad)
//   node scripts/actualizar.mjs --detectar      solo informa de lo que cambió, sin descargar ni modificar nada
//   node scripts/actualizar.mjs --sin-publicar  reconstruye dist/ pero no sube nada
//   node scripts/actualizar.mjs --forzar        reconstruye aunque no haya cambios
//   node scripts/actualizar.mjs --completa      recarga TODAS las fichas (≈2,5 h); para cambios en plantillas/categorías, que la detección por fichas no ve (conviene 1 vez al mes)
// Política de red: ≤1 petición/s, User-Agent neutro, espera exponencial con jitter, sin saltarse ningún reto (ver wiki-api.mjs).
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { basename } from 'node:path';
import { cobertura } from './cobertura.mjs';
import { api, cacheFile, ensureDirs, fetchPage, readJson, readPage, removeFile, savePage, stats, writeJson } from './wiki-api.mjs';

const args = new Set(process.argv.slice(2));
const BASELINE = '2026-10-26T21:09:00Z'; // inicio del rastreo completo inicial
const DAY = 86400e3, RETENCION_RC_DIAS = 80, MAX_HISTORICO_DIAS = 90, MAX_NOVEDADES = 3000;
const t0 = Date.now(), tiempos = {};
const lap = (k, since) => { tiempos[k] = Math.round((Date.now() - since) / 1000); };
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
ensureDirs();

// ---------- índice de revisiones (título canónico -> revid y ficheros de caché) ----------
function cargarRevs() {
  const f = 'data/revs.json'; let revs = readJson(f, null); if (revs) return revs;
  log('Creando el índice de revisiones a partir de la caché (una sola vez)…'); revs = {};
  for (const name of readdirSync('data/pages')) { if (!name.endsWith('.json.gz')) continue; const p = readPage('data/pages/' + name); const e = (revs[p.title] ??= { r: p.revid ?? 0, f: [] }); if (!e.f.includes(name)) e.f.push(name); e.r = Math.max(e.r, p.revid ?? 0); }
  writeJson(f, revs); return revs;
}

// ---------- detección ----------
async function recientes(desde, hasta) {
  const nuevos = new Set(), editados = new Set(), borrados = new Set(), movidos = []; let cont = {}, total = 0;
  do {
    const j = await api({ action: 'query', list: 'recentchanges', rcnamespace: '0', rcstart: hasta, rcend: desde, rcdir: 'older', rctype: 'edit|new|log', rcprop: 'title|ids|timestamp|loginfo', rclimit: '500', ...cont });
    for (const c of j.query?.recentchanges ?? []) {
      total++;
      if (c.type === 'log') {
        if (c.logtype === 'delete' && c.logaction === 'delete') borrados.add(c.title);
        else if (c.logtype === 'delete' && c.logaction === 'restore') editados.add(c.title);
        else if (c.logtype === 'move') movidos.push({ from: c.title, to: c.logparams?.target_title });
      } else (c.type === 'new' ? nuevos : editados).add(c.title);
    }
    cont = j.continue ?? null;
  } while (cont);
  log(`Cambios recientes: ${total} eventos (${nuevos.size} nuevas, ${editados.size} editadas, ${borrados.size} borradas, ${movidos.length} movidas).`);
  return { nuevos, editados, borrados, movidos };
}
async function revisiones(titulos) { // título -> revid (null si ya no existe)
  const out = new Map(); const lista = [...titulos];
  for (let i = 0; i < lista.length; i += 50) {
    const lote = lista.slice(i, i + 50); const j = await api({ action: 'query', prop: 'revisions', rvprop: 'ids', titles: lote.join('|') });
    const norm = new Map((j.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of j.query?.pages ?? []) { const t = p.title; const rev = p.missing ? null : p.revisions?.[0]?.revid ?? 0; out.set(t, rev); const orig = norm.get(t); if (orig) out.set(orig, rev); }
  }
  return out;
}
async function barrido(revs) {
  const vivos = new Set(); let cont = {};
  do { const j = await api({ action: 'query', list: 'allpages', apnamespace: '0', apfilterredir: 'nonredirects', aplimit: '500', ...cont }); for (const p of j.query?.allpages ?? []) vivos.add(p.title); cont = j.continue ?? null; } while (cont);
  const conocidos = new Set(Object.keys(revs)); const nuevos = new Set([...vivos].filter((t) => !conocidos.has(t))); const borrados = new Set([...conocidos].filter((t) => !vivos.has(t)));
  log(`Barrido: ${vivos.size} fichas vivas, ${nuevos.size} nuevas, ${borrados.size} desaparecidas; comparando revisiones…`);
  const comunes = [...conocidos].filter((t) => vivos.has(t)); const rev = await revisiones(comunes);
  const editados = new Set(comunes.filter((t) => revs[t].r && rev.get(t) !== undefined && rev.get(t) !== revs[t].r));
  return { nuevos, editados, borrados, movidos: [] };
}

// ---------- redirecciones ----------
async function actualizarRedirecciones() {
  const targets = new Map(); for (let cont = {}; ;) { const j = await api({ action: 'query', list: 'allredirects', arlimit: '500', arprop: 'ids|title', arnamespace: '0', ...cont }); for (const r of j.query.allredirects) targets.set(r.fromid, r.title); if (!j.continue) break; cont = j.continue; }
  const map = {}; for (let cont = {}; ;) { const j = await api({ action: 'query', list: 'allpages', apfilterredir: 'redirects', aplimit: '500', apnamespace: '0', ...cont }); for (const p of j.query.allpages) if (targets.has(p.pageid)) map[p.title] = targets.get(p.pageid); if (!j.continue) break; cont = j.continue; }
  const antes = Object.keys(readJson('data/redirects.json', {})).length; writeJson('data/redirects.json', map); log(`Redirecciones: ${Object.keys(map).length} (antes ${antes}).`);
}

// ---------- principal ----------
const sync = readJson('data/sync.json', { ultima: BASELINE });
const ahora = new Date(Date.now() - 60e3).toISOString().replace(/\.\d+Z$/, 'Z'); // 1 min de margen
const dias = (Date.now() - Date.parse(sync.ultima)) / DAY;
const revs = cargarRevs();
log(`Última sincronización: ${sync.ultima} (hace ${dias.toFixed(1)} días). Fichas en el índice: ${Object.keys(revs).length}.`);

let cambios, via = 'recentchanges';
const tDet = Date.now();
if (args.has('--barrido') || dias > RETENCION_RC_DIAS) { via = 'barrido'; if (dias > RETENCION_RC_DIAS) log(`Más de ${RETENCION_RC_DIAS} días sin sincronizar: se usa el barrido completo (la API solo conserva los cambios recientes).`); cambios = await barrido(revs); }
else cambios = await recientes(sync.ultima, ahora);
lap('deteccion', tDet);

// candidatos a descargar: nuevas + editadas + destino de movimientos; comprobamos la revisión antes de bajar la ficha completa
const candidatos = new Set([...cambios.nuevos, ...cambios.editados, ...cambios.movidos.map((m) => m.to).filter(Boolean)]);
for (const b of cambios.borrados) candidatos.delete(b);
const posibles = new Set([...candidatos, ...cambios.borrados, ...cambios.movidos.map((m) => m.from)]);
const rev = via === 'barrido' ? null : await revisiones(posibles);
const aBajar = [], aBorrar = new Set();
for (const t of candidatos) { const r = rev ? rev.get(t) : undefined; if (rev && r === null) { aBorrar.add(t); continue; } if (rev && revs[t] && r === revs[t].r) continue; aBajar.push(t); }
for (const t of cambios.borrados) { if (rev && rev.get(t) !== null && rev.get(t) !== undefined) { if (!candidatos.has(t) && !(revs[t] && rev.get(t) === revs[t].r)) aBajar.push(t); continue; } aBorrar.add(t); }
for (const m of cambios.movidos) { if (m.from && (!rev || rev.get(m.from) === null || revs[m.from])) { /* el origen suele quedar como redirección */ if (!rev || rev.get(m.from) === null || !revs[m.to]) aBorrar.add(m.from); } }
if (args.has('--completa')) { const ya = new Set(aBajar); for (const t of Object.keys(revs)) if (!ya.has(t)) aBajar.push(t); log(`Modo completo: se recargan las ${aBajar.length} fichas (≈${Math.ceil(aBajar.length * 1.1 / 60)} min).`); }
const movidoDesde = new Map(cambios.movidos.filter((m) => m.to).map((m) => [m.to, m.from]));
const aBorrarReal = [...aBorrar].filter((t) => revs[t]);
log(`A descargar: ${aBajar.length} · a eliminar: ${aBorrarReal.length} · movimientos: ${cambios.movidos.length}.`);
if (aBajar.length > 1500) log(`AVISO: cambio grande (${aBajar.length} fichas, unos ${Math.ceil(aBajar.length * 1.1 / 60)} min); se procesa por lotes y es reanudable.`);
if (args.has('--detectar')) { console.log(JSON.stringify({ via, aBajar: aBajar.slice(0, 50), aBorrar: aBorrarReal.slice(0, 50) }, null, 1)); await new Promise((r) => setTimeout(r, 300)).then(() => process.exit(0)); }

const novedades = readJson('data/novedades.json', []); const hoy = new Date().toISOString().slice(0, 10); const registrar = (t, n, m) => { if (!novedades.some((x) => x.d === hoy && x.t === t && x.n === n)) novedades.push({ d: hoy, t, n, ...(m ? { m } : {}) }); };
const tDesc = Date.now(); const catsNuevas = new Set(); const conocidasCats = readJson('data/catparents.json', {}); let hechas = 0, fallidas = 0;
for (const t of aBajar) {
  try {
    const r = await fetchPage(t);
    if (r.error) { if (revs[t]) aBorrar.add(t); continue; }
    const p = r.parse; const prev = revs[p.title]; const file = savePage(t, p); const name = basename(file);
    const e = (revs[p.title] ??= { r: 0, f: [] }); if (!e.f.includes(name)) e.f.push(name); const cambio = !prev || prev.r !== p.revid; e.r = p.revid;
    for (const c of p.categories ?? []) { const nm = c.category.replace(/_/g, ' '); if (!(nm in conocidasCats)) catsNuevas.add(nm); }
    if (cambio) { const from = movidoDesde.get(t); registrar(from ? 'm' : prev ? 'e' : 'n', p.title, from); }
    hechas++; if (hechas % 25 === 0) { writeJson('data/revs.json', revs); log(`  descargadas ${hechas}/${aBajar.length}`); }
  } catch (e) { fallidas++; log(`  no se pudo descargar «${t}»: ${e.message}`); }
}
// primera vez: la caché inicial no guardó la revisión; se completa con la API (las fichas editadas desde el rastreo ya se han recargado arriba)
const sinRev = Object.keys(revs).filter((t) => !revs[t].r);
if (sinRev.length && !args.has('--detectar')) { log(`Completando el número de revisión de ${sinRev.length} fichas (una sola vez)…`); const rv = await revisiones(sinRev); for (const t of sinRev) { const r = rv.get(t); if (r) revs[t].r = r; else if (r === null) aBorrar.add(t); } }
for (const t of aBorrar) { const e = revs[t]; if (!e) continue; for (const f of e.f) removeFile('data/pages/' + f); delete revs[t]; if (!novedades.some((x) => x.t === 'm' && x.m === t)) registrar('x', t); }
writeJson('data/revs.json', revs); lap('descarga', tDesc);

const hayCambios = hechas > 0 || aBorrarReal.length > 0;
if (hayCambios || args.has('--forzar') || via === 'barrido') { const tR = Date.now(); await actualizarRedirecciones(); lap('redirecciones', tR); }
if (catsNuevas.size) { log(`Categorías nuevas (${catsNuevas.size}): actualizando la jerarquía…`); const tC = Date.now(); spawnSync(process.execPath, ['scripts/fetch-catparents.mjs'], { stdio: 'inherit' }); lap('categorias', tC); }

// registro de novedades (se limita el histórico)
const corte = new Date(Date.now() - MAX_HISTORICO_DIAS * DAY).toISOString().slice(0, 10);
writeJson('data/novedades.json', novedades.filter((x) => x.d >= corte).slice(-MAX_NOVEDADES));
writeJson('data/sync.json', { ...sync, ultima: ahora, ultimaActualizacion: new Date().toISOString(), via, barrido: via === 'barrido' ? ahora : sync.barrido });

if (!hayCambios && !args.has('--forzar') && via !== 'barrido') { log('Sin cambios: no hace falta reconstruir ni publicar.'); writeJson('data/ultima-actualizacion.json', { fecha: new Date().toISOString(), via, cambios: 0, segundos: Math.round((Date.now() - t0) / 1000), peticiones: stats.peticiones }); await new Promise((r) => setTimeout(r, 300)).then(() => process.exit(0)); }

// reconstrucción (tipado, grafo, artículos y lotes) y publicación
const run = (cmd, a) => { const r = spawnSync(cmd, a, { stdio: 'inherit', shell: process.platform === 'win32' && cmd === 'npm' }); if (r.status !== 0) throw new Error(`${cmd} ${a.join(' ')} falló`); };
// cobertura: compara las cifras de la wiki con lo descargado y avisa si falta algo (informe en data/informe-cobertura.md)
try { const cv = await cobertura({ quiet: true }); log(`Cobertura: wiki ${cv.reales} páginas reales (${cv.articulos} «artículos» según Fandom), descargadas ${cv.descargadas}, faltan ${cv.falta.length}.`); if (cv.falta.length) { log('AVISO: faltan páginas; se descargan en esta pasada.'); for (const t of cv.falta.slice(0, 200)) { try { const r = await fetchPage(t); if (r.parse) { savePage(t, r.parse); hechas++; } else log('No se pudo descargar ' + t + ': ' + r.error); } catch (e) { log('No se pudo descargar ' + t + ': ' + e.message); } } } } catch (e) { log('AVISO: no se pudo comprobar la cobertura: ' + e.message); }
const tB = Date.now(); log('Reconstruyendo datos…'); run(process.execPath, ['scripts/build-data.mjs']); lap('reconstruccion', tB);
const tW = Date.now();
if (args.has('--sin-publicar')) { log('Compilando la web (sin publicar)…'); run('npm', ['run', 'build']); }
else { log('Compilando, probando y publicando…'); run(process.execPath, ['scripts/publicar.mjs']); }
lap('web_y_publicacion', tW);
const resumen = { fecha: new Date().toISOString(), via, descargadas: hechas, fallidas, eliminadas: aBorrarReal.length, segundos: Math.round((Date.now() - t0) / 1000), tiempos, peticiones: stats.peticiones, reintentos: stats.reintentos };
writeJson('data/ultima-actualizacion.json', resumen); log('Hecho: ' + JSON.stringify(resumen));
