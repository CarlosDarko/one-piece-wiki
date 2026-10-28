// Capturas de todas las vistas con Edge real (escritorio y móvil):  node scripts/capturas.mjs [reales|fixtures|recorte]
//  reales   -> capturas\NN-nombre.png (sin fotos: Cloudflare da 403 a los navegadores automatizados)
//  fixtures -> capturas\fx-NN-nombre.png con imágenes SINTÉTICAS de proporciones distintas, solo para validar maquetación y recortes
//  recorte  -> capturas\recorte-caras.png: banco de pruebas de recortes (alto, estrecho, apaisado, cuadrado)
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const INDEX = pathToFileURL(resolve(ROOT, 'dist/index.html')).href;
const OUT = resolve(ROOT, 'capturas'); mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] ?? 'reales';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--disable-gpu', '--no-first-run'] });
const enc = encodeURIComponent;

// imagen sintética: cabeza en el tercio superior (alta), a la izquierda (apaisada) o centrada (cuadrada) para comprobar que el recorte no la corta
const shapes = [[200, 420, 0.5, 0.2], [420, 200, 0.4, 0.45], [300, 300, 0.5, 0.35], [160, 440, 0.5, 0.15], [380, 240, 0.6, 0.4]];
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
let PNGS = [];
async function makePngs() {
  const p = await browser.newPage(); await p.goto('about:blank');
  const out = await p.evaluate((shapes) => shapes.map(([w, hh, fx, fy], k) => {
    const c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d'); const hue = (k * 67) % 360;
    const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, 'hsl(' + hue + ' 60% 55%)'); gr.addColorStop(1, 'hsl(' + ((hue + 60) % 360) + ' 55% 30%)'); g.fillStyle = gr; g.fillRect(0, 0, w, hh);
    const cx = w * fx, cy = hh * fy, r = Math.min(w, hh) * 0.16;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(cx - r * 1.5, cy + r * 0.9, r * 3, hh - cy); g.fillStyle = '#ffd9b0'; g.strokeStyle = '#5a3a1a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#222'; for (const dx of [-0.35, 0.35]) { g.beginPath(); g.arc(cx + r * dx, cy - r * 0.1, r * 0.1, 0, 7); g.fill(); }
    g.strokeStyle = '#7a2a1a'; g.beginPath(); g.arc(cx, cy + r * 0.15, r * 0.45, 0.2, 2.9); g.stroke();
    g.fillStyle = '#f0c44c'; g.strokeStyle = '#a87414'; g.beginPath(); g.moveTo(cx - r * 1.3, cy - r * 0.7); g.lineTo(cx + r * 1.3, cy - r * 0.7); g.lineTo(cx + r, cy - r * 1.6); g.lineTo(cx - r, cy - r * 1.6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(w + 'x' + hh, 6, hh - 8);
    return c.toDataURL('image/png').split(',')[1];
  }), shapes);
  await p.close(); PNGS = out.map((x) => Buffer.from(x, 'base64'));
}
async function open(w, h, url, fx, mobile = false) {
  const p = await browser.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  if (fx) { await p.setRequestInterception(true); p.on('request', (r) => { if (r.url().includes('static.wikia.nocookie.net')) r.respond({ status: 200, contentType: 'image/png', body: PNGS[hash(r.url()) % PNGS.length] }); else r.continue(); }); }
  p.on('pageerror', (e) => console.log('  [pageerror]', e.message)); await p.goto(url, { waitUntil: 'domcontentloaded' }); return p;
}

if (mode === 'recorte') {
  await makePngs(); const p = await open(1100, 760, INDEX, true); await p.waitForSelector('.hero');
  await p.evaluate((svgs) => {
    document.body.innerHTML = `<div style="padding:20px;background:#0b1d38;color:#fff;font:13px sans-serif;display:grid;gap:18px"><h2 style="margin:0">Banco de pruebas de recorte de caras (imágenes sintéticas: alta, apaisada, cuadrada, estrecha, panorámica)</h2>` + svgs.map((s, k) => `<div style="display:flex;gap:26px;align-items:center"><div style="width:90px"><b>${k + 1}</b></div><span class="av face" style="--c:#f2b84b;width:52px;height:52px;position:relative;display:inline-grid;border-radius:50%;overflow:hidden"><img src="${s}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 0%"></span><span class="av face" style="--c:#f2b84b;width:110px;height:110px;position:relative;display:inline-grid;border-radius:50%;overflow:hidden"><img src="${s}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 0%"></span><div style="width:300px;border-radius:12px;overflow:hidden;border:3px solid #fff;background:#102a4c"><img src="${s}" style="display:block;width:100%;height:auto;max-height:420px;object-fit:contain"></div><svg width="150" height="150" viewBox="-75 -75 150 150"><defs><clipPath id="h${k}" clipPathUnits="objectBoundingBox"><path d="M.5 0L1 .25L1 .75L.5 1L0 .75L0 .25Z"/></clipPath><clipPath id="c${k}" clipPathUnits="objectBoundingBox"><path d="M.5 0A.5.5 0 1 1 .5 1A.5.5 0 1 1 .5 0Z"/></clipPath></defs><image href="${s}" x="-60" y="-60" width="120" height="120" clip-path="url(#c${k})" preserveAspectRatio="xMidYMin slice"/></svg><svg width="150" height="150" viewBox="-75 -75 150 150"><image href="${s}" x="-60" y="-60" width="120" height="120" clip-path="url(#h${k})" preserveAspectRatio="xMidYMin slice"/></svg></div>`).join('') + '</div>';
  }, PNGS.map((b) => 'data:image/png;base64,' + b.toString('base64')));
  await sleep(500); await p.screenshot({ path: resolve(OUT, 'recorte-caras.png') }); console.log('captura recorte-caras.png'); await p.close(); await browser.close(); process.exit(0);
}

const fx = mode === 'fixtures'; const pre = fx ? 'fx-' : ''; if (fx) await makePngs();
const shot = async (p, name) => { await p.screenshot({ path: resolve(OUT, pre + name + '.png') }); console.log('  captura', pre + name + '.png'); };
const D = [1440, 900], M = [390, 844];
const steps = [
  ['01-portada', '', '.hero', 1500], ['02-grafo-todo', '#/quien', 'svg.gsvg g.node', 3500], ['03-grafo-ficha-luffy', '#/quien/' + enc('Monkey D. Luffy'), '.panel-body .summary', 5000],
  ['04-grafo-frutas', '#/quien?v=frutas', 'svg.gsvg g.node', 3500], ['05-grafo-organizaciones', '#/quien?v=organizaciones', 'svg.gsvg g.node', 3500],
  ['06-sagas', '#/sagas', '.saga', 2500], ['08-mapa', '#/lugares', 'svg.msvg .cluster', 2000], ['10-biblioteca', '#/biblioteca', '.lib-card', 2500],
  ['11-biblioteca-recompensas', '#/biblioteca?t=rank:bounty', '.lib-card .rk', 2000], ['12-ficha-completa-zoro', '#/ficha/' + enc('Roronoa Zoro'), '.article details.asec', 3500],
  ['13-ficha-completa-lugar', '#/ficha/' + enc('Water 7'), '.article', 2500], ['14-comparar', '#/comparar?a=' + enc('Monkey D. Luffy') + '&b=' + enc('Roronoa Zoro'), '#cmp-out h2', 2500], ['15-metodologia', '#/metodologia', '.doc h2', 800],
];
console.log(`Escritorio ${D.join('x')}${fx ? ' (con imágenes sintéticas)' : ''}`);
for (const [name, hash, sel, wait] of steps) { const p = await open(...D, INDEX + hash, fx); await p.waitForSelector(sel, { timeout: 30000 }); await sleep(wait); await shot(p, name); if (name === '06-sagas') { await p.click('[data-expand^="arcs-"]'); await sleep(900); await p.evaluate(() => document.querySelector('.fold:not([hidden])').scrollIntoView({ block: 'start' })); await sleep(700); await shot(p, '07-sagas-arcos'); await p.click('.fold:not([hidden]) .arc-card [data-expand]'); await sleep(700); await shot(p, '07b-sagas-arco-detalle'); }
  if (name === '08-mapa') { await p.click('#r-play'); await sleep(5200); await shot(p, '09-mapa-ruta-viaje'); } await p.close(); }
console.log(`Móvil ${M.join('x')}`);
for (const [name, hash, sel, wait] of [['m01-portada', '', '.hero', 1200], ['m02-grafo', '#/quien', 'svg.gsvg g.node', 3500], ['m03-ficha-hoja', '#/quien/' + enc('Roronoa Zoro'), '.panel-body .summary', 4500], ['m04-sagas', '#/sagas', '.saga', 2000], ['m05-mapa', '#/lugares', 'svg.msvg .cluster', 2000], ['m06-biblioteca', '#/biblioteca', '.lib-card', 2000], ['m07-ficha-completa', '#/ficha/' + enc('Roronoa Zoro'), '.article details.asec', 3500]]) {
  const p = await open(...M, INDEX + hash, fx, true); await p.waitForSelector(sel, { timeout: 30000 }); await sleep(wait); await shot(p, name); await p.close();
}
await browser.close();
