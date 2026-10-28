// Cliente de la API MediaWiki de la wiki, compartido por la actualización incremental.
// ≤1 petición/s, User-Agent neutro, espera exponencial con jitter ante 403/429/5xx/red (sin saltarse ningún reto), caché en disco.
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

export const UA = 'personal-research-script/0.1';
export const API = 'https://onepiece.fandom.com/es/api.php';
const MIN_GAP = 1100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastReq = 0, failStreak = 0;
export const stats = { peticiones: 0, reintentos: 0, esperaMs: 0 };
// En ejecuciones desatendidas (CI) conviene no esperar horas: MAX_ESPERA_TOTAL_MS corta el intento y falla con un mensaje claro.
const MAX_TOTAL_WAIT = Number(process.env.MAX_ESPERA_TOTAL_MS ?? Infinity);

export async function api(params, { maxAttempts = Infinity } = {}) {
  for (let attempt = 1; ; attempt++) {
    const wait = lastReq + MIN_GAP - Date.now(); if (wait > 0) await sleep(wait);
    lastReq = Date.now(); stats.peticiones++;
    let res, body, status = 0, err = null;
    try {
      res = await fetch(API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params }), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000) });
      status = res.status; body = await res.text();
    } catch (e) { err = String(e.cause?.code || e.message); }
    if (res && status === 200) {
      try { const j = JSON.parse(body); if (!j.error || j.error.code === 'missingtitle') { failStreak = 0; return j; } err = 'api:' + j.error.code; }
      catch { err = 'respuesta no JSON (¿reto anti-bot?)'; }
    }
    failStreak++; stats.reintentos++;
    if (status >= 400 && status < 500 && ![403, 429].includes(status) && attempt >= 3) throw new Error('HTTP ' + status);
    if (attempt >= maxAttempts) throw new Error(`sin respuesta tras ${attempt} intentos: ${status || err}`);
    const ra = Number(res?.headers.get('retry-after')) || 0;
    const delay = Math.max(ra * 1000, Math.min(3 * 3600e3, 5000 * 2 ** Math.min(failStreak, 12)) * (0.6 + Math.random() * 0.8));
    stats.esperaMs += delay;
    if (stats.esperaMs > MAX_TOTAL_WAIT) throw new Error(`La API sigue bloqueando (estado ${status || err}); se agotó la espera máxima. Reintenta más tarde.`);
    console.log(`   [espera] estado=${status} ${err ?? ''} racha=${failStreak} ${Math.round(delay / 1000)} s`);
    await sleep(delay);
  }
}

export const hash = (t) => createHash('sha1').update(t).digest('hex').slice(0, 16);
export const cacheFile = (t) => `data/pages/${hash(t)}.json.gz`;
export const PARSE_PROPS = 'text|links|categories|displaytitle|templates|images|sections|revid';

// descarga una ficha completa (HTML renderizado, enlaces, categorías…) o {error} si no existe
export async function fetchPage(title) {
  const j = await api({ action: 'parse', page: title, redirects: '1', prop: PARSE_PROPS });
  return j.error ? { error: j.error.code } : { parse: j.parse };
}
export function savePage(requested, parse) {
  const file = cacheFile(requested); writeFileSync(file + '.tmp', gzipSync(JSON.stringify({ solicitado: requested, ...parse }))); renameSync(file + '.tmp', file); return file;
}
export const removeFile = (file) => { try { unlinkSync(file); return true; } catch { return false; } };
export const readPage = (file) => JSON.parse(gunzipSync(readFileSync(file)));
export const readJson = (f, def) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : def);
export const writeJson = (f, o) => { writeFileSync(f + '.tmp', JSON.stringify(o)); renameSync(f + '.tmp', f); };
export const ensureDirs = () => { mkdirSync('data/pages', { recursive: true }); };
