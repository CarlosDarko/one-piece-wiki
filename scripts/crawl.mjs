// Rastreo completo y reanudable de fichas por la API MediaWiki. <=1 req/s, UA fijo, caché gzip, backoff sin límite de tiempo.
import { readFileSync, writeFileSync, existsSync, appendFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const UA = 'personal-research-script/0.1';
const API = 'https://onepiece.fandom.com/es/api.php';
const MIN_GAP = 1100; // ms entre peticiones
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); appendFileSync('data/crawl.log', l + '\n'); };
const hash = (t) => createHash('sha1').update(t).digest('hex').slice(0, 16);

let lastReq = 0, failStreak = 0;
async function api(params, maxAttempts = Infinity) {
  for (let attempt = 1; ; attempt++) {
    const wait = lastReq + MIN_GAP - Date.now(); if (wait > 0) await sleep(wait);
    lastReq = Date.now();
    let res, body, status = 0, err = null;
    try {
      res = await fetch(API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params }), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000) });
      status = res.status; body = await res.text();
    } catch (e) { err = String(e.cause?.code || e.message); }
    if (res && status === 200) {
      try { const j = JSON.parse(body); if (!j.error || j.error.code === 'missingtitle') { failStreak = 0; return j; } err = 'api:' + j.error.code; }
      catch { err = 'respuesta no JSON'; }
    }
    if (status >= 400 && status < 500 && ![403, 429].includes(status) && attempt >= 3) throw new Error('HTTP ' + status);
    // 403/429/5xx/red: reto o limitación -> backoff exponencial con jitter, sin rendirse nunca
    failStreak++;
    if (attempt >= maxAttempts) { const e = new Error('aparcada tras ' + attempt + ' intentos: ' + (status || err)); e.parked = true; throw e; }
    const ra = Number(res?.headers.get('retry-after')) || 0;
    const delay = Math.max(ra * 1000, Math.min(3 * 3600e3, 5000 * 2 ** Math.min(failStreak, 12)) * (0.6 + Math.random() * 0.8));
    log(`BLOQUEO/ERROR status=${status} ${err ?? ''} racha=${failStreak} espera=${Math.round(delay / 1000)}s ${JSON.stringify(params.page ?? params.list ?? '')}`);
    state.blocked = { desde: state.blocked?.desde ?? new Date().toISOString(), racha: failStreak, proximo_intento: new Date(Date.now() + delay).toISOString(), status };
    saveState(); await sleep(delay);
  }
}

const state = existsSync('data/state.json') ? JSON.parse(readFileSync('data/state.json', 'utf8')) : { missing: [], errors: [], iniciado: new Date().toISOString() };
function saveState() { writeFileSync('data/state.tmp', JSON.stringify(state, null, 1)); renameSync('data/state.tmp', 'data/state.json'); }

// --- fase 0: redirecciones (para resolver enlaces/alias) ---
async function redirects() {
  if (existsSync('data/redirects.json')) return;
  log('fase 0: descargando redirecciones');
  const targets = new Map(); // fromid -> título destino
  for (let cont = {}; ;) {
    const j = await api({ action: 'query', list: 'allredirects', arlimit: '500', arprop: 'ids|title', arnamespace: '0', ...cont });
    for (const r of j.query.allredirects) targets.set(r.fromid, r.title);
    if (!j.continue) break; cont = j.continue;
  }
  const map = {};
  for (let cont = {}; ;) {
    const j = await api({ action: 'query', list: 'allpages', apfilterredir: 'redirects', aplimit: '500', apnamespace: '0', ...cont });
    for (const p of j.query.allpages) if (targets.has(p.pageid)) map[p.title] = targets.get(p.pageid);
    if (!j.continue) break; cont = j.continue;
  }
  writeFileSync('data/redirects.json', JSON.stringify(map));
  log(`redirecciones: ${Object.keys(map).length}`);
}

function order(titles) {
  const first = JSON.parse(readFileSync('scripts/titles.json', 'utf8'));
  const pri = (t) => (first.includes(t) ? 0 : /^(Saga|Arco)\b/.test(t) ? 1 : 2);
  return [...titles].sort((a, b) => pri(a) - pri(b));
}

await redirects();
const titles = order([...new Set(readFileSync('data/urls_ns0.txt', 'utf8').split('\n').filter(Boolean).map((u) => decodeURIComponent(u.split('/wiki/')[1]).replace(/_/g, ' ')))]);
state.total = titles.length;
const skip = new Set(state.missing);
let done = 0, sinceSave = 0;
const parked = [];
async function fetchOne(t, maxAttempts) {
  const file = `data/pages/${hash(t)}.json.gz`;
  if (existsSync(file) || skip.has(t)) return 'ok';
  let j;
  try { j = await api({ action: 'parse', page: t, redirects: '1', prop: 'text|links|categories|displaytitle|templates|images|sections' }, maxAttempts); }
  catch (e) { if (e.parked) return 'parked'; state.errors.push({ t, e: e.message }); log('ERROR definitivo ' + t + ' ' + e.message); return 'ok'; }
  if (j.error) { state.missing.push(t); log('inexistente: ' + t); } else { writeFileSync(file, gzipSync(JSON.stringify({ solicitado: t, ...j.parse }))); state.blocked = null; }
  state.ultima = t; return 'ok';
}
for (const t of titles) {
  const r = await fetchOne(t, 4);
  if (r === 'parked') { parked.push(t); log('aparcada: ' + t); } else done++;
  state.hechas = done; state.aparcadas = parked.length; state.pendientes = titles.length - done; state.actualizado = new Date().toISOString();
  if (++sinceSave >= 10) { saveState(); sinceSave = 0; if (done % 100 < 10) log(`progreso ${done}/${titles.length}`); }
}
// rondas de reintento de aparcadas con espera creciente (las fichas muy pesadas pueden dar 5xx a ratos)
for (let round = 1; parked.length && round <= 6; round++) {
  log(`ronda ${round} de aparcadas: ${parked.length}`); await sleep(Math.min(3600e3, 60e3 * 3 ** round));
  for (const t of [...parked]) { if ((await fetchOne(t, 4 + round)) === 'ok') { parked.splice(parked.indexOf(t), 1); done++; state.hechas = done; state.aparcadas = parked.length; saveState(); } }
}
for (const t of parked) state.errors.push({ t, e: 'aparcada definitiva' });
state.hechas = done; state.pendientes = 0; state.terminado = new Date().toISOString(); saveState();
log(`FIN: ${done}/${titles.length}, inexistentes=${state.missing.length}, errores=${state.errors.length}`);
