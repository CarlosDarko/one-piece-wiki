// Capturas y tiempos de carga con Edge real (puppeteer-core).  node scripts/captura.mjs [capturas|tiempos|todo]
import puppeteer from 'puppeteer-core';
import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => { try { statSync(p); return true; } catch { return false; } });
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const INDEX = pathToFileURL(resolve(ROOT, 'dist/index.html')).href;
const OUT = resolve(ROOT, 'capturas');
const mode = process.argv[2] ?? 'todo';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run'] });

async function open(w, h, url, mobile = false) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 160)); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page;
}
const shot = async (page, name) => { await page.screenshot({ path: resolve(OUT, name + '.png') }); console.log('  captura', name + '.png'); };

if (mode === 'capturas' || mode === 'todo') {
  mkdirSync(OUT, { recursive: true });
  const D = [1440, 900];
  console.log('Escritorio 1440x900');
  let p = await open(...D, INDEX); await p.waitForSelector('.hero'); await sleep(1500); await shot(p, '01-portada');
  await p.type('#hq', 'luffy'); await sleep(500); await shot(p, '02-portada-busqueda'); await p.close();
  p = await open(...D, INDEX + '#/quien'); await p.waitForSelector('svg.gsvg g.node'); await sleep(3500); await shot(p, '03-quien-es-quien'); await p.close();
  p = await open(...D, INDEX + '#/quien/' + encodeURIComponent('Monkey D. Luffy')); await p.waitForSelector('.panel-body .summary', { timeout: 20000 }); await sleep(4500); await shot(p, '04-quien-es-quien-ficha-luffy'); await p.close();
  p = await open(...D, INDEX + '#/sagas'); await p.waitForSelector('.saga'); await sleep(2500); await shot(p, '05-sagas');
  await p.click('[data-toggle]'); await sleep(600); await p.evaluate(() => document.querySelector('.arcs:not([hidden])')?.scrollIntoView({ block: 'start' })); await sleep(900); await shot(p, '06-sagas-arcos-expandido'); await p.close();
  p = await open(...D, INDEX + '#/lugares'); await p.waitForSelector('svg.msvg .cluster, svg.msvg .pin'); await sleep(2000); await shot(p, '07-lugares-mapa');
  await p.click('[data-sea="4"]'); await sleep(1500); await shot(p, '08-lugares-paradise-zoom'); await p.close();
  p = await open(...D, INDEX + '#/biblioteca'); await p.waitForSelector('.lib-card'); await sleep(2500); await shot(p, '09-biblioteca'); await p.close();
  p = await open(...D, INDEX + '#/metodologia'); await p.waitForSelector('.doc h2'); await sleep(800); await shot(p, '10-metodologia'); await p.close();
  console.log('Móvil 390x844');
  const M = [390, 844];
  p = await open(...M, INDEX, true); await p.waitForSelector('.hero'); await sleep(1500); await shot(p, 'm01-portada'); await p.close();
  p = await open(...M, INDEX + '#/quien', true); await p.waitForSelector('svg.gsvg g.node'); await sleep(3500); await shot(p, 'm02-quien-es-quien'); await p.close();
  p = await open(...M, INDEX + '#/quien/' + encodeURIComponent('Roronoa Zoro'), true); await p.waitForSelector('.panel-body .summary', { timeout: 20000 }); await sleep(4000); await shot(p, 'm03-ficha-hoja-inferior'); await p.close();
  p = await open(...M, INDEX + '#/sagas', true); await p.waitForSelector('.tl-item'); await sleep(2000); await shot(p, 'm04-sagas'); await p.close();
  p = await open(...M, INDEX + '#/lugares', true); await p.waitForSelector('svg.msvg .cluster, svg.msvg .pin'); await sleep(2000); await shot(p, 'm05-lugares'); await p.close();
  p = await open(...M, INDEX + '#/biblioteca', true); await p.waitForSelector('.lib-card'); await sleep(2000); await shot(p, 'm06-biblioteca'); await p.close();
}

if (mode === 'tiempos' || mode === 'todo') {
  const target = process.argv[3] ? pathToFileURL(resolve(process.argv[3])).href : INDEX;
  const old = !!process.argv[3];
  const routes = old ? [['grafo (diseño anterior)', '', '#stats']] : [['portada', '', '.hero'], ['quien', '#/quien', 'svg.gsvg g.node'], ['sagas', '#/sagas', '.saga'], ['lugares', '#/lugares', 'svg.msvg .cluster, svg.msvg .pin'], ['biblioteca', '#/biblioteca', '.lib-card'], ['ficha completa (Zoro)', '#/ficha/Roronoa%20Zoro', '.article details.asec']];
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(`Tiempos (mediana de 5 cargas, sin caché) — ${old ? 'diseño anterior' : 'diseño nuevo'}`);
  for (const [name, hash, sel] of routes) {
    const dcl = [], ready = [], bytes = [], reqs = [];
    for (let k = 0; k < 5; k++) {
      const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
      const files = new Set(); page.on('request', (r) => { if (r.url().startsWith('file:')) files.add(r.url()); });
      const t0 = Date.now(); await page.goto(target + hash, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction((s) => { const e = document.querySelector(s); return old_ok(e); function old_ok(x) { return !!x && (s !== '#stats' || x.textContent.length > 0); } }, { timeout: 60000 }, sel);
      ready.push(Date.now() - t0);
      dcl.push(await page.evaluate(() => Math.round(performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart)));
      let sz = 0; for (const u of files) { try { sz += statSync(fileURLToPath(u)).size; } catch { /* ignorar */ } } bytes.push(sz); reqs.push(files.size);
      await page.close();
    }
    console.log(`  ${name.padEnd(26)} DOMContentLoaded ${String(med(dcl)).padStart(4)} ms · contenido listo ${String(med(ready)).padStart(5)} ms · ${med(reqs)} ficheros · ${(med(bytes) / 1024).toFixed(0)} KB sin comprimir`);
  }
}

if (mode === 'red') {
  // por HTTP con gzip y red/CPU limitadas (4G regular ~4 Mbps, 70 ms; CPU 4x más lenta, como un móvil medio)
  const [urlNew, urlOld] = [process.argv[3], process.argv[4]];
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  for (const [name, url, sel] of [['diseño nuevo · Quién es quién', urlNew + '#/quien', 'svg.gsvg g.node'], ['diseño nuevo · portada', urlNew + '#/', '.hero'], ['diseño anterior · grafo', urlOld, '#stats']]) {
    const t = [], bytes = [];
    for (let k = 0; k < 5; k++) {
      const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 }); await page.setCacheEnabled(false);
      const c = await page.createCDPSession(); await c.send('Network.enable'); await c.send('Network.emulateNetworkConditions', { offline: false, latency: 70, downloadThroughput: 500 * 1024, uploadThroughput: 250 * 1024 }); await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      let b = 0; const local = new Set(); c.on('Network.requestWillBeSent', (e) => { if (e.request.url.startsWith('http://localhost')) local.add(e.requestId); }); c.on('Network.loadingFinished', (e) => { if (local.has(e.requestId)) b += e.encodedDataLength; });
      const t0 = Date.now(); await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction((s) => { const e = document.querySelector(s); return !!e && (s !== '#stats' || e.textContent.length > 0); }, { timeout: 120000 }, sel);
      t.push(Date.now() - t0); b = Math.round(b / 1024); await sleep(300); bytes.push(b); await page.close();
    }
    console.log('  ' + name.padEnd(32) + ' listo en ' + String(med(t)).padStart(5) + ' ms · ~' + med(bytes) + ' KB transferidos (gzip) hasta ese momento');
  }
}
await browser.close();
