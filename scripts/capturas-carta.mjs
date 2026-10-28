// Capturas y comprobaciones de la carta náutica en preparación (dist-carta):  CARTA=1 npx vite build --outDir dist-carta  y  node scripts/capturas-carta.mjs
import puppeteer from 'puppeteer-core';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const INDEX = pathToFileURL(resolve(ROOT, 'dist-carta/index.html')).href;
const OUT = resolve(ROOT, 'capturas');
const EDGE = process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-first-run'] });
const errors = [];
async function page(w, h, mobile = false) {
  const p = await browser.newPage(); await p.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  p.on('pageerror', (e) => errors.push(e.message)); await p.setRequestInterception(true);
  p.on('request', async (rq) => { if (rq.url().includes('static.wikia.nocookie.net')) { await rq.respond({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#7ab0c9"/><circle cx="60" cy="45" r="24" fill="#ffd9b0"/><rect x="30" y="75" width="60" height="45" fill="#6b3a1d"/></svg>' }); } else await rq.continue(); });
  return p;
}
const res = {};
const shot = async (p, name) => p.screenshot({ path: resolve(OUT, name) });
let p = await page(1440, 900); await p.goto(INDEX + '#/carta'); await p.waitForSelector('svg.msvg .c-pin, svg.msvg .c-cl', { timeout: 20000 }); await sleep(800);
res.general = { pines: await p.$$eval('.c-pin', (a) => a.length), cumulos: await p.$$eval('.c-cl', (a) => a.length), cuenta: await p.$eval('#m-count', (e) => e.textContent) }; await shot(p, 'carta-1-general.png');
{ await p.evaluate(() => { window.__f = { n: 0, worst: 0, last: performance.now(), on: true }; const loop = (t) => { if (!window.__f.on) return; window.__f.n++; window.__f.worst = Math.max(window.__f.worst, t - window.__f.last); window.__f.last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
  const t0 = Date.now(); await p.mouse.move(720, 450); for (let k = 0; k < 30; k++) { await p.mouse.wheel({ deltaY: -120 }); await sleep(16); } await p.mouse.down(); for (let k = 0; k < 40; k++) { await p.mouse.move(720 - k * 6, 450 - k * 3); await sleep(8); } await p.mouse.up(); for (let k = 0; k < 30; k++) { await p.mouse.wheel({ deltaY: 120 }); await sleep(16); }
  const ms = Date.now() - t0; const r = await p.evaluate(() => { window.__f.on = false; return window.__f; }); res.fps = { fps: Math.round((r.n * 1000) / ms), peorMs: Math.round(r.worst) }; }
await p.goto(INDEX + '#/carta?m=0'); await p.reload(); await p.waitForSelector('.c-pin, .c-cl'); await sleep(1500); await shot(p, 'carta-2-east-blue.png'); res.eastBlue = { pines: await p.$$eval('.c-pin', (a) => a.length), cuenta: await p.$eval('#m-count', (e) => e.textContent) };
await p.goto(INDEX + '#/carta?m=4'); await p.reload(); await p.waitForSelector('.c-pin, .c-cl'); await sleep(1500); await shot(p, 'carta-3-paradise.png');
// ruta
await p.goto(INDEX + '#/carta'); await p.reload(); await p.waitForSelector('#r-play'); await p.click('#r-play'); await sleep(4200); await shot(p, 'carta-4-ruta-merry.png'); res.ruta = { info: await p.$eval('#r-info', (e) => e.textContent), barco: await p.$eval('.c-ship', (e) => e.getAttribute('data-ship') ?? 'merry') };
for (let k = 0; k < 17; k++) { await p.click('#r-next'); await sleep(120); } await sleep(2200); await shot(p, 'carta-5-ruta-sunny.png'); res.ruta2 = { info: await p.$eval('#r-info', (e) => e.textContent), barco: await p.$eval('.c-ship', (e) => e.getAttribute('data-ship')) };
// búsqueda
await p.goto(INDEX + '#/carta'); await p.reload(); await p.waitForSelector('#pq'); await p.type('#pq', 'Loguetown'); await sleep(500); await p.keyboard.press('Enter'); await p.waitForSelector('.panel-body .summary', { timeout: 20000 }); await sleep(1800); await shot(p, 'carta-6-busqueda-loguetown.png'); res.busqueda = await p.evaluate(() => decodeURIComponent(location.hash));
await p.goto(INDEX + '#/carta?l=1'); await p.reload(); await sleep(800); res.lista = { secciones: await p.$$eval('.pl-sea', (a) => a.length) }; await shot(p, 'carta-7-lista.png');
await p.close();
p = await page(390, 844, true); await p.goto(INDEX + '#/carta'); await p.waitForSelector('.c-pin, .c-cl'); await sleep(1000); await shot(p, 'carta-8-movil.png'); res.movil = { desborda: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1) }; await p.close();
console.log(JSON.stringify(res, null, 1)); console.log('errores JS:', errors.length ? errors.slice(0, 6) : 'ninguno'); await browser.close(); setTimeout(() => process.exit(0), 300);
