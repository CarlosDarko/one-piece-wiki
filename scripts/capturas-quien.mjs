// Capturas internas del nuevo «Quién es quién» (buscador, sugerencias, grafos, camino, móvil): node scripts/capturas-quien.mjs
import puppeteer from 'puppeteer-core';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const INDEX = pathToFileURL(resolve(ROOT, 'dist/index.html')).href, OUT = resolve(ROOT, 'capturas');
const EDGE = process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-first-run'] });
const errors = [];
async function page(w, h, mobile = false) {
  const p = await browser.newPage(); await p.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  p.on('pageerror', (e) => errors.push(e.message)); await p.setRequestInterception(true);
  p.on('request', async (rq) => { if (rq.url().includes('static.wikia.nocookie.net')) await rq.respond({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="#7ab0c9"/><circle cx="60" cy="40" r="22" fill="#ffd9b0"/><rect x="30" y="70" width="60" height="90" fill="#6b3a1d"/></svg>' }); else await rq.continue(); });
  return p;
}
const res = {}; const shot = (p, n) => p.screenshot({ path: resolve(OUT, n) });
let p = await page(1440, 900); await p.goto(INDEX + '#/quien'); await p.waitForSelector('#qs'); await sleep(800); await shot(p, 'quien-1-portada.png');
await p.type('#qs', 'luffy'); await sleep(500); await shot(p, 'quien-2-sugerencias.png'); res.sugerencias = await p.$$eval('#qres .opt', (a) => a.length);
await p.keyboard.press('Enter'); await p.waitForSelector('.qn.center', { timeout: 20000 }); await sleep(1800); await shot(p, 'quien-3-grafo-personaje.png'); res.luffy = { hash: await p.evaluate(() => decodeURIComponent(location.hash)), nodos: await p.$$eval('.qn', (a) => a.length), grupos: await p.$$eval('.q-lg', (a) => a.length) };
await p.goto(INDEX + '#/quien/Marineford'); await p.reload(); await p.waitForSelector('.qn.center'); await sleep(1800); await shot(p, 'quien-4-grafo-lugar.png'); res.marineford = { nodos: await p.$$eval('.qn', (a) => a.length) };
await p.goto(INDEX + '#/quien/' + encodeURIComponent('Piratas de Sombrero de Paja')); await p.reload(); await p.waitForSelector('.qn.center'); await sleep(1800); await shot(p, 'quien-5-grafo-organizacion.png'); res.sombrero = { nodos: await p.$$eval('.qn', (a) => a.length), mas: await p.$$eval('.qn.more', (a) => a.length) };
await p.goto(INDEX + '#/quien?de=' + encodeURIComponent('Monkey D. Luffy') + '&a=' + encodeURIComponent('Edward Newgate')); await p.reload(); await p.waitForSelector('.pchain', { timeout: 20000 }); await sleep(800); await shot(p, 'quien-6-camino.png'); res.camino = { saltos: await p.$$eval('.ptext li', (a) => a.length) };
await p.close();
for (const [w, h, n] of [[390, 844, 'movil'], [360, 640, 'movil-360']]) { p = await page(w, h, true); await p.goto(INDEX + '#/quien'); await p.waitForSelector('#qs'); await sleep(600); await shot(p, `quien-${n}-1-portada.png`); await p.goto(INDEX + '#/quien/' + encodeURIComponent('Monkey D. Luffy')); await p.reload(); await p.waitForSelector('.qn.center'); await sleep(1800); await shot(p, `quien-${n}-2-grafo.png`); res[n] = { desborda: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1) }; await p.close(); }
console.log(JSON.stringify(res, null, 1)); console.log('errores JS:', errors.length ? errors.slice(0, 6) : 'ninguno'); await browser.close(); setTimeout(() => process.exit(0), 300);
