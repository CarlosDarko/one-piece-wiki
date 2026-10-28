// Capturas del README (escritorio y móvil) en docs/capturas/*.webp, hechas con un navegador real sobre el sitio compilado.
//   node scripts/capturas-readme.mjs [carpeta-del-sitio]     (por defecto dist/; BROWSER = ruta del Chrome/Edge)
// Es lo que mantiene las imágenes del README al día: lo ejecuta el workflow semanal tras reconstruir.
// Si el CDN de Fandom bloquea las imágenes, las fichas salen con iniciales de colores; no es un fallo.
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { mkdirSync, readFile, existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SITE = resolve(process.argv[2] ?? join(ROOT, 'dist'));
const OUT = join(ROOT, 'docs/capturas'); mkdirSync(OUT, { recursive: true });
const BROWSER = process.env.BROWSER ?? ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!BROWSER) { console.error('Define BROWSER con la ruta de Chrome o Edge'); process.exit(1); }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer((q, r) => { let f = join(SITE, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/') || f.endsWith('\\')) f += 'index.html'; readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', MIME[extname(f)] ?? 'application/octet-stream'); r.end(d); }); });
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox', '--disable-gpu', '--no-first-run'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const enc = encodeURIComponent;
const D = { width: 1440, height: 900 }, M = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
let fallos = 0;

async function captura(nombre, vista, hash, esperar, { espera = 1500, antes, tema, ...vp } = {}) {
  const p = await browser.newPage();
  try {
    await p.setViewport({ ...D, ...vp });
    if (tema) await p.evaluateOnNewDocument((t) => { try { localStorage.setItem('opa-theme', t); } catch { /* sin almacenamiento */ } }, tema);
    await p.evaluateOnNewDocument(() => { try { localStorage.removeItem('opa-panel'); } catch { /* sin almacenamiento */ } });
    await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector(esperar, { timeout: 45000 }); await sleep(espera);
    if (antes) await antes(p);
    await p.screenshot({ path: join(OUT, nombre + '.webp'), type: 'webp', quality: 80 });
    console.log('  captura', nombre);
  } catch (e) { fallos++; console.error(`  FALLA ${nombre}: ${e.message}`); } finally { await p.close(); }
}

const grafo = '.panel-body .summary';
await captura('01-portada', 'home', '#/', '.hero');
await captura('02-grafo-luffy', 'quien', '#/quien/' + enc('Monkey D. Luffy'), '.panel-body .summary', { espera: 4500 });
await captura('03-grafo-relaciones', 'quien', '#/quien/' + enc('Monkey D. Luffy'), '#q-filt', { espera: 4000, antes: async (p) => { await p.click('#q-filt summary'); await sleep(900); } });
await captura('04-grafo-fruta', 'quien', '#/quien/' + enc('Fruta Gomu Gomu'), grafo, { espera: 4500 });
await captura('05-ficha-usopp', 'ficha', '#/ficha/' + enc('Usopp'), '.article details.asec', { espera: 3000 });
await captura('06-sagas', 'sagas', '#/sagas', '.saga', { espera: 2500 });
await captura('07-mapa-ruta', 'lugares', '#/lugares', 'svg.msvg', { espera: 2000, antes: async (p) => { await p.click('#r-play'); await sleep(5200); } });
await captura('08-buscador', 'home', '#/', '#q', { antes: async (p) => { await p.type('#q', 'Zoro', { delay: 60 }); await p.waitForSelector('#results [role=option]', { timeout: 15000 }); await sleep(600); } });
await captura('09-biblioteca', 'biblioteca', '#/biblioteca', '.lib-card', { espera: 2500 });
await captura('10-comparar', 'comparar', '#/comparar?a=' + enc('Monkey D. Luffy') + '&b=' + enc('Roronoa Zoro'), '#cmp-out h2', { espera: 2500 });
await captura('11-tema-pergamino', 'quien', '#/quien/' + enc('Nami'), '.panel-body .summary', { espera: 4000, tema: 'light' });
await captura('12-tema-noche', 'quien', '#/quien/' + enc('Nami'), '.panel-body .summary', { espera: 6000, tema: 'dark' });
await captura('m1-grafo', 'quien', '#/quien/' + enc('Monkey D. Luffy'), grafo, { ...M, espera: 4500 });
await captura('m2-ficha', 'ficha', '#/ficha/' + enc('Usopp'), '.article details.asec', { ...M, espera: 3000 });
await captura('m3-mapa', 'lugares', '#/lugares', 'svg.msvg', { ...M, espera: 2000 });

await browser.close(); server.close();
if (fallos) { console.error(`${fallos} captura(s) fallidas`); process.exit(1); }
