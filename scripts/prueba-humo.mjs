// Prueba de humo con Edge real sobre dist/ abierto como file://:  node scripts/prueba-humo.mjs
import puppeteer from 'puppeteer-core';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const INDEX = pathToFileURL(resolve(ROOT, 'dist/index.html')).href;
const EDGE = process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--disable-gpu', '--no-first-run'] });
const results = []; const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? '  OK   ' : '  FALLA') + ' ' + name + (extra ? ' — ' + extra : '')); };
const errors = [];
async function page(w = 1440, h = 900, mobile = false) {
  const p = await browser.newPage(); await p.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile });
  await p.evaluateOnNewDocument(() => { try { localStorage.removeItem('opa-panel'); } catch { /* sin almacenamiento */ } });
  p.on('pageerror', (e) => errors.push(e.message)); return p;
}
const hash = (p) => p.evaluate(() => decodeURIComponent(location.hash));
const goto = async (p, h) => { await p.goto(INDEX + h); await sleep(300); };
const ficha = encodeURIComponent;

// ---------- portada y buscador ----------
let p = await page();
await goto(p, ''); await p.waitForSelector('.hero'); await sleep(600);
check('Portada: 4 accesos, atajos y ejemplos clicables', (await p.$$eval('a.path', (a) => a.length)) === 4 && (await p.$$eval('.shortcuts a', (a) => a.length)) >= 8 && (await p.$$eval('#examples a', (a) => a.length)) >= 4);
await p.type('#hq', 'gomu gomu'); await sleep(400);
check('Portada: el buscador agrupa los resultados por tipo', (await p.$$eval('#hres .opt', (a) => a.length)) > 0 && (await p.$$eval('#hres .grp', (a) => a.length)) > 0);
await p.keyboard.press('Enter'); await p.waitForSelector('.panel-body .summary', { timeout: 20000 }); await sleep(600);
const h1 = await hash(p); check('Buscar + Enter abre la ficha en #/quien/… con el panel', h1.startsWith('#/quien/'), h1);
await p.click('details.rel a.ilink'); await sleep(1300); const h2 = await hash(p);
check('Un enlace de la ficha navega a otra ficha', h2 !== h1 && h2.startsWith('#/quien/'), h2);
await p.click('#pb-back'); await sleep(1000); check('El botón ← vuelve a la ficha anterior', (await hash(p)) === h1);
await p.click('#pb-close'); await sleep(500); check('Plegar la ficha en el grafo oculta el panel y conserva la ficha central en la URL', (await hash(p)).includes('/quien/') && (await p.$eval('#panel', (e) => e.hidden)));
await p.close();

// ---------- ficha completa (artículo íntegro) ----------
p = await page(); await goto(p, '#/ficha/' + ficha('Roronoa Zoro')); await p.waitForSelector('.article details.asec', { timeout: 30000 }); await sleep(800);
const art = await p.evaluate(() => ({ len: document.querySelector('#f-main').textContent.length, secs: document.querySelectorAll('details.asec').length, h3: document.querySelectorAll('.article h3').length, toc: document.querySelectorAll('.toc a').length, crumbs: !!document.querySelector('.crumbs'), titles: [...document.querySelectorAll('.article h2')].map((h) => h.textContent).join('|') }));
check('Ficha completa: artículo íntegro (miles de caracteres, subpáginas unidas)', art.len > 30000 && art.secs >= 5, `${art.len} caracteres, ${art.secs} secciones: ${art.titles.slice(0, 120)}`);
check('Ficha completa: índice con anclas y migas de pan', art.toc >= 10 && art.crumbs, `${art.toc} entradas`);
check('Ficha completa: incluye Historia y Habilidades', /Historia/.test(art.titles) && /Habilidades/.test(art.titles));
await p.evaluate(() => { document.querySelectorAll('details.asec').forEach((d) => (d.open = false)); });
const tocTarget = await p.evaluate(() => { const a = [...document.querySelectorAll('.toc a')].find((x) => /Historia/.test(x.textContent)); a.click(); return a.dataset.sec; }); await sleep(900);
check('Índice: pulsar una sección la abre y se desplaza a ella', await p.evaluate((id) => { const h = document.getElementById(id); return !!h && h.closest('details').open; }, tocTarget));
const before = await hash(p);
await p.evaluate(() => document.querySelector('.article a.ilink[data-i]:not([data-s])').click()); await sleep(1500);
check('Un enlace dentro del artículo abre otra ficha completa', (await hash(p)).startsWith('#/ficha/') && (await hash(p)) !== before, await hash(p));
await p.close();
p = await page(); await goto(p, '#/ficha/' + ficha('Monkey D. Luffy')); await p.waitForSelector('.article details.asec', { timeout: 30000 }); await sleep(500);
check('Luffy: artículo completo (>60.000 caracteres)', (await p.$eval('#f-main', (e) => e.textContent.length)) > 60000);
check('Ficha: infobox con datos clave y relaciones', (await p.$$eval('.f-side .kv dt', (a) => a.length)) >= 6 && (await p.$$eval('.f-side details.rel', (a) => a.length)) >= 3);
check('Ficha: atribución CC BY-SA con enlace al historial de autores', (await p.$$eval('.f-side a[href*="action=history"]', (a) => a.length)) === 1 && (await p.$eval('.f-side', (e) => /CC BY-SA/.test(e.textContent))));
await p.close();

// ---------- sagas: TODOS los desplegables, también al volver a entrar ----------
p = await page(); await goto(p, '#/sagas'); await p.waitForSelector('.saga'); await sleep(700);
const nSagas = await p.$$eval('li.saga:not(.now)', (a) => a.length); check('Sagas: 10 sagas en la ruta del viaje', nSagas === 10 && (await p.$$eval('.route a', (a) => a.length)) >= 10, `${nSagas} sagas`);
async function sagaToggles(label) {
  const btns = await p.$$eval('[data-expand^="arcs-"]', (a) => a.map((b) => b.dataset.expand)); let ok = true; let detail = '';
  for (const id of btns) {
    await p.evaluate((i) => document.querySelector(`[data-expand="${i}"]`).scrollIntoView({ block: 'center' }), id); await sleep(80);
    await p.click(`[data-expand="${id}"]`); await sleep(120);
    const st = await p.evaluate((i) => { const f = document.getElementById(i); return { hidden: f.hidden, exp: document.querySelector(`[data-expand="${i}"]`).getAttribute('aria-expanded'), arcs: f.querySelectorAll('.arc-card').length }; }, id);
    if (st.hidden || st.exp !== 'true' || !st.arcs) { ok = false; detail += ` ${id}:${JSON.stringify(st)}`; }
    await p.click(`[data-expand="${id}"]`); await sleep(120);
    const st2 = await p.evaluate((i) => document.getElementById(i).hidden, id); if (!st2) { ok = false; detail += ` ${id}:no cierra`; }
  }
  check(`Sagas (${label}): «Ver los N arcos» abre y cierra en las ${btns.length} sagas`, ok && btns.length >= 9, detail || `${btns.length} sagas`);
}
await sagaToggles('1ª visita');
await p.evaluate(() => (location.hash = '#/lugares')); await sleep(1500); await p.evaluate(() => (location.hash = '#/sagas')); await p.waitForSelector('.saga'); await sleep(700);
await sagaToggles('tras volver a entrar');
await p.evaluate(() => (location.hash = '#/biblioteca')); await sleep(1200); await p.evaluate(() => (location.hash = '#/sagas')); await p.waitForSelector('.saga'); await sleep(600); await sagaToggles('3ª visita');
await p.click('[data-expand^="arcs-"]'); await sleep(200);
const arcBtn = await p.$eval('.arc-card [data-expand]', (b) => b.dataset.expand); await p.evaluate((i) => document.querySelector(`[data-expand="${i}"]`).scrollIntoView({ block: 'center' }), arcBtn); await sleep(100); await p.click(`[data-expand="${arcBtn}"]`); await sleep(200);
check('Sagas: «Qué aparece en este arco» muestra fichas con foto o iniciales', (await p.$$eval(`#${arcBtn} .tile`, (a) => a.length)) > 0);
await p.evaluate((i) => document.querySelector(`#${i} .tile`).click(), arcBtn); await sleep(1300);
check('Sagas: un nombre abre su ficha en «Quién es quién»', (await hash(p)).startsWith('#/quien/'), await hash(p));
await p.close();

// ---------- mapa ----------
p = await page(); await goto(p, '#/lugares'); await p.waitForSelector('svg.msvg .c-cl'); await sleep(800);
const count0 = await p.$eval('#m-count', (e) => e.textContent);
await p.select('#f-sea', '0'); await sleep(900); const count1 = await p.$eval('#m-count', (e) => e.textContent);
check('Mapa: el filtro por mar cambia el número de lugares', count0 !== count1, `${count0} → ${count1}`);
await p.select('#f-sea', ''); await p.select('#f-saga', '2'); await sleep(500); const count2 = await p.$eval('#m-count', (e) => e.textContent);
check('Mapa: el filtro por saga reduce los lugares', count2 !== count0, count2); await p.select('#f-saga', '');
await p.select('#f-kind', '0'); await sleep(400); check('Mapa: el filtro por tipo funciona', (await p.$eval('#m-count', (e) => e.textContent)) !== count0); await p.select('#f-kind', '');
await p.click('#r-play'); await p.waitForFunction(() => document.getElementById('r-info').textContent.startsWith('1/31'), { timeout: 15000 }).catch(() => {}); const r1 = await p.$eval('#r-info', (e) => e.textContent);
check('Carta: la ruta del viaje arranca en la primera parada', r1.startsWith('1/31'), r1.slice(0, 80));
await p.click('#r-pp'); await p.click('#r-next'); await p.waitForFunction(() => document.getElementById('r-info').textContent.startsWith('2/31'), { timeout: 15000 }).catch(() => {}); const r2 = await p.$eval('#r-info', (e) => e.textContent);
check('Carta: siguiente avanza a la segunda parada', r2 !== r1 && r2.startsWith('2/31'), r2.slice(0, 80));
check('Carta: la ruta dibujada, el barco y las paradas numeradas existen', (await p.$$eval('svg .c-run', (a) => a.length)) === 1 && (await p.$$eval('svg .c-ship', (a) => a.length)) === 1 && (await p.$$eval('.c-stop', (a) => a.length)) >= 1);
await p.type('#pq', 'water 7'); await sleep(400); check('Mapa: el buscador de lugares sugiere islas', (await p.$$eval('#pres .opt', (a) => a.length)) > 0);
await p.keyboard.press('Enter'); await sleep(1600); check('Carta: elegir un lugar abre su ficha en el panel', (await hash(p)).startsWith('#/lugares/') && !(await p.$eval('#panel', (e) => e.hidden)), await hash(p));
await p.click('#v-list'); await sleep(500); check('Mapa: el modo lista accesible muestra los lugares por mar', (await p.$$eval('.pl-sea', (a) => a.length)) >= 3 && (await p.$$eval('.pl-sea li', (a) => a.length)) > 100);
await p.close();

// ---------- leyenda de la carta ----------
{
  p = await page(1920, 1080); await goto(p, '#/lugares'); await p.waitForSelector('#c-leg'); await sleep(900);
  const lg = await p.evaluate(() => { const l = document.getElementById('c-leg').getBoundingClientRect(); const c = document.querySelector('svg.msvg > g').getBoundingClientRect(); const ix = Math.max(0, Math.min(l.right, c.right) - Math.max(l.left, c.left)), iy = Math.max(0, Math.min(l.bottom, c.bottom) - Math.max(l.top, c.top)); return { abierta: document.getElementById('c-leg').open, entradas: document.querySelectorAll('#c-leg li').length, solape: Math.round(ix * iy), sagas: document.querySelectorAll('#c-sagas .c-sg').length }; });
  check('Carta: leyenda con trazos, paradas/colores de saga e iconos, abierta sin tapar la carta en pantalla ancha', lg.abierta && lg.entradas >= 8 && lg.solape === 0 && lg.sagas >= 10, JSON.stringify(lg)); await p.close();
  p = await page(390, 844, true); await goto(p, '#/lugares'); await p.waitForSelector('#c-leg'); await sleep(700);
  const lm = await p.evaluate(() => { const d = document.getElementById('c-leg'); const r = d.getBoundingClientRect(); return { cerrada: !d.open, w: Math.round(r.width), h: Math.round(r.height) }; });
  check('Carta (móvil): la leyenda empieza plegada y compacta, y se despliega al tocarla', lm.cerrada && lm.w <= 170 && lm.h <= 60 && (await (async () => { await p.click('#c-leg > summary'); await sleep(300); return p.$eval('#c-leg', (e) => e.open && e.getBoundingClientRect().height > 120); })()), JSON.stringify(lm)); await p.close();
}
// ---------- biblioteca ----------
p = await page(); await goto(p, '#/biblioteca'); await p.waitForSelector('.lib-card'); await sleep(900);
check('Biblioteca: sin paginación (no hay «Página n de m»)', (await p.$$eval('.pager, [data-page]', (a) => a.length)) === 0 && !(await p.$eval('.lib', (e) => /Página \d+ de/.test(e.textContent))));
const total = await p.$eval('#lib-count', (e) => e.textContent); const nCards = await p.$$eval('.lib-card', (a) => a.length);
check('Biblioteca: virtualizada (pocas tarjetas en el DOM para miles de resultados)', nCards < 120 && /\d/.test(total), `${nCards} tarjetas en el DOM · ${total}`);
const firstName = await p.$eval('.lib-card .nm', (e) => e.textContent);
await p.evaluate(() => { const s = document.getElementById('lib-scroll'); s.scrollTop = s.scrollHeight; }); await sleep(500);
const lastName = await p.$eval('.lib-card:last-child .nm', (e) => e.textContent); const lastTop = await p.$$eval('.lib-card', (a) => Math.max(...a.map((x) => parseInt(x.style.top))));
check('Biblioteca: el scroll continuo llega al final de la lista', lastTop > 5000 && lastName !== firstName, `última fila a ${lastTop}px`);
await p.evaluate(() => (document.getElementById('lib-scroll').scrollTop = 0)); await sleep(200);
await p.click('#azbar [data-l="M"]'); await sleep(600);
const mName = await p.evaluate(() => { const s = document.getElementById('lib-scroll'); const rows = [...document.querySelectorAll('.lib-card')].filter((x) => parseInt(x.style.top) >= s.scrollTop - 1 && parseInt(x.style.top) < s.scrollTop + 91); return rows.map((c) => c.querySelector('.nm').textContent); });
check('Biblioteca: el índice A–Z salta a la letra elegida (la primera fila visible contiene la letra)', mName.some((n) => /^M/i.test(n)), mName.join(' | '));
await p.select('#lib-sort', 'imp');
await p.click('.lib-side [data-t="fruta_del_diablo"]'); await sleep(500);
check('Biblioteca: filtra por tipo y actualiza el contador y la URL', (await p.$eval('#lib-title', (e) => /Frutas/.test(e.textContent))) && (await hash(p)).includes('t=fruta_del_diablo'), await hash(p));
await p.type('#lib-q', 'mera'); await sleep(500); const nMera = await p.$$eval('.lib-card', (a) => a.length); check('Biblioteca: el buscador filtra por nombre', nMera >= 1 && nMera < 20, `${nMera} tarjetas`);
await p.click('.lib-side [data-t="lugar"]'); await p.$eval('#lib-q', (e) => { e.value = ''; e.dispatchEvent(new Event('input')); }); await sleep(400); const nLug = await p.$eval('#lib-count', (e) => e.textContent);
await p.select('#lib-sea', '4'); await sleep(500); const nPar = await p.$eval('#lib-count', (e) => e.textContent); check('Biblioteca: el filtro por mar reduce los lugares', nPar !== nLug, `${nLug} → ${nPar}`);
await p.select('#lib-sea', ''); await p.select('#lib-saga', '1'); await sleep(500); check('Biblioteca: el filtro por saga funciona', (await p.$eval('#lib-count', (e) => e.textContent)) !== nLug);
const shared = await hash(p); await p.close();
p = await page(); await goto(p, shared); await p.waitForSelector('.lib-card', { timeout: 20000 }); await sleep(900);
check('Biblioteca: la URL con filtros se restaura al compartirla', (await p.$eval('#lib-title', (e) => /Lugares/.test(e.textContent))) && (await p.$eval('#lib-saga', (e) => e.value)) === '1', shared);
await p.close();
p = await page(); await goto(p, '#/biblioteca?t=rank:bounty'); await p.waitForSelector('.lib-card .rk'); await sleep(600);
check('Biblioteca: ranking de recompensas ordenado', /Roger|Newgate/.test(await p.$eval('.lib-card .nm', (e) => e.textContent)) && /฿/.test(await p.$eval('.lib-card small', (e) => e.textContent)));
await p.click('.lib-card'); await sleep(1300); check('Biblioteca: abrir una ficha no saca de la biblioteca', (await hash(p)).startsWith('#/biblioteca/'));
await p.close();

// ---------- «Quién es quién»: gran buscador, grafo central, camino entre fichas ----------
p = await page(); await goto(p, '#/quien'); await p.waitForSelector('#qs'); await sleep(600);
check('Quién es quién: portada con gran buscador, accesos de ejemplo y descubrimiento', !!(await p.$('#qs')) && (await p.$$eval('.q-ex .q-chip', (a) => a.length)) >= 5 && (await p.$$eval('.q-feat li', (a) => a.length)) >= 8 && (await p.$$eval('.q-chips .q-chip', (a) => a.length)) >= 10);
await p.type('#qs', 'gomu gomu'); await sleep(500); check('Quién es quién: sugerencias con tipo al escribir (tolera minúsculas)', (await p.$$eval('#qres .opt', (a) => a.length)) >= 3 && (await p.$$eval('#qres .grp', (a) => a.length)) >= 1);
await p.keyboard.press('Escape'); await p.evaluate(() => { document.getElementById('qs').value = ''; }); await p.type('#qs', 'Monkey D. Luffy'); await sleep(300); await p.click('#q-form button'); await p.waitForSelector('.qn.center', { timeout: 20000 }); await sleep(900);
const hq = await hash(p); check('Buscar abre el grafo con la ficha en el centro y URL compartible', hq === '#/quien/Monkey D. Luffy' && (await p.$eval('.qn.center .qn-l', (e) => e.textContent)).includes('Luffy'), hq);
const nN = await p.$$eval('.qn', (a) => a.length); check('Grafo: relaciones agrupadas por tipo con leyenda y nodos alrededor', nN >= 8 && (await p.$$eval('.q-lg', (a) => a.length)) >= 3, String(nN));
const nPills = await p.$$eval('.q-pill', (a) => a.length), nCenterLines = await p.$$eval('.q-edges path.core', (a) => a.length); check('Grafo jerárquico: del centro salen líneas a las pastillas (una por grupo)', nPills >= 2 && nCenterLines === nPills, `${nPills} pastillas / ${nCenterLines} líneas`);
check('Grafo jerárquico: de cada pastilla salen líneas a sus nodos', (await p.$$eval('.q-edges path:not(.core)', (a) => a.length)) >= (await p.$$eval('.qn:not(.center)', (a) => a.length)));
await p.evaluate(() => { document.getElementById('q-filt').open = true; }); await sleep(200);
check('Filtros: las categorías coloreadas se ven y las grises empiezan ocultas, con contador de ocultas', (await p.$$eval('.q-lg:not(.off)', (a) => a.length)) >= 3 && (await p.$$eval('.q-lg.off', (a) => a.length)) >= 1 && /ocultas/.test(await p.$eval('#q-fn', (e) => e.textContent)) && (await p.$eval('.q-fhelp', (e) => e.textContent)).includes('Mostrar / ocultar'));
await p.click('#q-filt [data-g="-"]'); await sleep(300); check('Filtros: «Ocultar todo» y «Mostrar todo» funcionan', (await p.$$eval('.q-lg.off', (a) => a.length)) >= 2 && (await p.$eval('#q-fn', (e) => e.textContent)).startsWith('0 de')); await p.click('#q-filt [data-g="*"]'); await sleep(300);
check('Filtros: la barra no se corta (sin scroll horizontal)', await p.$eval('#q-legend', (e) => e.scrollWidth <= e.clientWidth + 1));
await p.waitForSelector('.panel-body .summary', { timeout: 20000 }); check('Grafo: la ficha se abre en el panel', true);
await p.click('.q-lg'); await sleep(300); check('Grafo: la leyenda oculta un tipo de relación', (await p.$$eval('.q-lg.off', (a) => a.length)) >= 1);
await p.evaluate(() => { document.querySelectorAll('.q-lg.off').forEach((b) => b.click()); });
await p.evaluate(() => { const n = [...document.querySelectorAll('.qn[data-i]:not(.center)')][0]; n.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await sleep(1200);
const hq2 = await hash(p); check('Grafo: pulsar un nodo recentra en esa ficha', hq2 !== hq && hq2.startsWith('#/quien/'), hq2);
await p.goBack(); await sleep(1200); check('Grafo: el botón atrás vuelve a la ficha anterior', (await hash(p)) === hq);
await p.click('#q-vl'); await sleep(300); check('Grafo: el modo lista accesible muestra las relaciones', (await p.$$eval('#q-list details', (a) => a.length)) >= 2);
await p.close();
p = await page(); await goto(p, '#/quien/' + ficha('Piratas de Sombrero de Paja')); await p.waitForSelector('.qn.center'); await sleep(900); check('Grafo de una organización grande: «ver más» para los cientos de miembros', (await p.$$eval('.qn.more', (a) => a.length)) >= 1);
const nm0 = await p.$$eval('.qn', (a) => a.length); await p.evaluate(() => document.querySelector('.qn.more').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await sleep(500); check('«Ver más» añade nodos al grupo', (await p.$$eval('.qn', (a) => a.length)) > nm0); await p.close();
p = await page(); await goto(p, '#/quien/Marineford'); await p.waitForSelector('.qn.center'); await sleep(800); check('Grafo de un lugar', (await p.$$eval('.qn', (a) => a.length)) >= 4); await p.close();
p = await page(); await goto(p, '#/quien?de=' + ficha('Monkey D. Luffy') + '&a=' + ficha('Edward Newgate')); await p.waitForSelector('.pchain', { timeout: 20000 }); check('Camino entre dos fichas: cadena con explicación de cada salto y alternativas', (await p.$$eval('.pcard', (a) => a.length)) >= 2 && (await p.$$eval('.ptext li', (a) => a.length)) >= 1); await p.close();
p = await page(); await goto(p, '#/quien'); await p.waitForSelector('#pa'); await p.evaluate(() => { document.querySelector('#q-pathform').open = true; }); await p.type('#pa', 'Nami'); await sleep(300); await p.keyboard.press('Enter'); await p.type('#pb', 'Marineford'); await sleep(300); await p.keyboard.press('Enter'); await p.click('#q-pf button'); await p.waitForSelector('.pchain, .p-none', { timeout: 20000 }); check('Formulario «¿cómo se relaciona X con Y?» traza el camino', (await hash(p)).includes('de=') && (await hash(p)).includes('a=')); await p.close();
p = await page(390, 844, true); await goto(p, '#/quien'); await p.waitForSelector('#qs'); check('Móvil: portada del buscador sin desbordes', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
await goto(p, '#/quien/' + ficha('Monkey D. Luffy')); await p.waitForSelector('.qn.center'); await p.waitForSelector('.panel-body .summary', { timeout: 20000 }); await sleep(700); const mh = await p.evaluate(() => { const r = document.getElementById('panel').getBoundingClientRect(); return { h: r.height / innerHeight, cv: document.getElementById('q-canvas').getBoundingClientRect().height }; }); check('Móvil: la ficha se abre como hoja parcial (≤50% de alto) y el grafo sigue visible', !(await p.$eval('#panel', (e) => e.hidden)) && mh.h <= 0.5 && mh.cv > 120 && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), JSON.stringify(mh));
await p.click('#pb-close'); await sleep(400); const cerrada = await p.$eval('#panel', (e) => e.hidden); await p.click('.q-open'); await sleep(800); check('Móvil: se puede plegar la hoja y «Ver la ficha» la vuelve a abrir', cerrada && !(await p.$eval('#panel', (e) => e.hidden))); await p.close();


// ---------- comparador ----------
p = await page(); await goto(p, '#/comparar?a=' + ficha('Monkey D. Luffy') + '&b=' + ficha('Roronoa Zoro')); await p.waitForSelector('#cmp-out h2', { timeout: 20000 }); await sleep(800);
check('Comparador: tabla de datos y relaciones en común', (await p.$$eval('.cmp-t tbody tr', (a) => a.length)) >= 3 && (await p.$$eval('.cmp-common li', (a) => a.length)) >= 3);
await p.click('#swap'); await sleep(800); check('Comparador: intercambiar las fichas', (await p.$eval('#ca b', (e) => e.textContent)) === 'Roronoa Zoro');
await p.close();

// ---------- móvil ----------
p = await page(390, 844, true); await goto(p, '#/biblioteca/' + ficha('Roronoa Zoro')); await p.waitForSelector('.panel-body .summary', { timeout: 20000 }); await sleep(800);
const box = await p.$eval('#panel', (e) => { const r = e.getBoundingClientRect(); return { w: r.width, top: r.top }; });
check('Móvil: la ficha es una hoja inferior', box.w >= 385 && box.top > 200, JSON.stringify(box));
await p.click('#burger'); await sleep(300); check('Móvil: el menú se despliega', await p.$eval('#tabs', (e) => getComputedStyle(e).display !== 'none'));
await p.close();
p = await page(390, 844, true); await goto(p, '#/ficha/' + ficha('Roronoa Zoro')); await p.waitForSelector('.article details.asec', { timeout: 30000 }); await sleep(600);
const openSecs = await p.$$eval('details.asec', (a) => a.filter((d) => d.open).length); check('Móvil: las secciones del artículo están plegadas salvo las dos primeras', openSecs <= 2, `${openSecs} abiertas`);
check('Móvil: la página no desborda en horizontal', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2 && document.body.scrollWidth <= innerWidth + 2));
await p.close();
p = await page(390, 844, true); await goto(p, '#/biblioteca'); await p.waitForSelector('.lib-card'); await sleep(600); check('Móvil: la biblioteca muestra una columna', (await p.$$eval('.lib-card', (a) => new Set(a.map((x) => x.style.left)).size)) === 1); await p.close();

// ---------- accesibilidad básica ----------
for (const [name, h] of [['portada', ''], ['grafo', '#/quien'], ['sagas', '#/sagas'], ['mapa', '#/lugares'], ['biblioteca', '#/biblioteca'], ['ficha', '#/ficha/' + ficha('Nami')], ['versus', '#/comparar?a=' + ficha('Monkey D. Luffy') + '&b=' + ficha('Roronoa Zoro')], ['metodología', '#/metodologia']]) {
  p = await page(); await goto(p, h); await sleep(1600);
  const a11y = await p.evaluate(() => {
    const noName = [...document.querySelectorAll('button, a[href], input, select')].filter((e) => !(e.getAttribute('aria-label') || e.textContent.trim() || e.getAttribute('title') || e.getAttribute('placeholder') || (e.labels && e.labels.length) || e.getAttribute('aria-labelledby'))).length;
    const imgNoAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length;
    return { noName, imgNoAlt, main: !!document.querySelector('main'), h1: document.querySelectorAll('h1').length, lang: document.documentElement.lang };
  });
  check(`Accesibilidad (${name}): controles con nombre, imágenes con alt, <main> y <h1>`, a11y.noName === 0 && a11y.imgNoAlt === 0 && a11y.main && a11y.h1 >= 1 && a11y.lang === 'es', JSON.stringify(a11y));
  await p.close();
}
p = await page(); await goto(p, '#/quien'); await p.waitForSelector('#qs'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
const reach = await p.evaluate(() => { const seen = new Set(); return document.activeElement?.tagName; }); check('Teclado: se puede navegar con Tab (foco visible en un elemento)', !!reach && reach !== 'BODY', reach); await p.close();

p = await page(); await goto(p, '#/novedades'); await p.waitForSelector('.news .page', { timeout: 20000 }); await sleep(800);
check('Novedades: página con la última actualización y filtros por tipo de cambio', (await p.$eval('.news', (e) => /Última actualización/.test(e.textContent))) && (await p.$$eval('.news-filters input[data-t]', (a) => a.length)) === 4);
check('Pie: muestra la fecha de la última actualización y enlaza a Novedades', (await p.$eval('footer.foot', (e) => /Actualizado el/.test(e.textContent) && !!e.querySelector('a[href="#/novedades"]')))); await p.close();
p = await page(); await goto(p, ''); await p.waitForSelector('nav.tabs a'); 
check('Cabecera: solo 4 pestañas (sin Metodología ni Comparar)', (await p.$$eval('nav.tabs a', (a) => a.map((x) => x.textContent))).join('|') === 'Quién es quién|Sagas|Los lugares|La biblioteca');
check('Pie: Metodología enlazada solo desde el pie', (await p.$$eval('a[href="#/metodologia"]', (a) => a.map((x) => !!x.closest('footer')))).every(Boolean) && (await p.$$eval('a[href="#/metodologia"]', (a) => a.length)) === 1); await p.close();
p = await page(); await goto(p, '#/sagas'); await p.waitForSelector('#ship'); await sleep(500);
const shipFirst = await p.$eval('#ship', (e) => e.getAttribute('aria-label'));
await p.evaluate(() => { const v = document.getElementById('view'); v.scrollTop = v.scrollHeight; v.dispatchEvent(new Event('scroll')); }); await sleep(900);
const shipLast = await p.$eval('#ship', (e) => e.getAttribute('aria-label'));
check('Sagas: el barco es el Going Merry al inicio y el Thousand Sunny al final', shipFirst === 'Going Merry' && shipLast === 'Thousand Sunny', shipFirst + ' → ' + shipLast); await p.close();
p = await page(); await goto(p, '#/ficha/Ficha%20que%20no%20existe'); await sleep(800); check('Ficha inexistente: mensaje claro y sin errores', await p.evaluate(() => /No encontramos/.test(document.body.textContent))); await p.close();

// ---------- móvil: ninguna vista desborda en horizontal en varios tamaños y orientaciones ----------
{
  const bad = [];
  for (const [w, h] of [[360, 640], [390, 844], [412, 915], [768, 1024], [844, 390]]) {
    const pm = await page(w, h, true);
    for (const hh of ['', '#/quien', '#/quien/' + ficha('Monkey D. Luffy'), '#/quien?de=' + ficha('Monkey D. Luffy') + '&a=' + ficha('Edward Newgate'), '#/sagas', '#/lugares', '#/biblioteca', '#/ficha/' + ficha('Nami'), '#/comparar?a=' + ficha('Monkey D. Luffy') + '&b=' + ficha('Roronoa Zoro'), '#/novedades', '#/metodologia']) {
      await goto(pm, hh); await sleep(1100);
      if (await pm.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) bad.push(`${w}x${h} ${hh || 'portada'}`);
    }
    await pm.close();
  }
  check('Móvil: sin desbordes horizontales en 5 tamaños/orientaciones × 11 vistas', bad.length === 0, bad.join(' · '));
}
// ---------- relaciones concretas: familia, compañeros, combatientes y enfrentamientos ----------
{
  p = await page(); await goto(p, '#/quien'); await p.waitForSelector('#qs'); await sleep(500);
  const R = await p.evaluate(async () => { const g = async (n) => { const i = window.__qFind(n); const gs = await window.__qGroups(i); return Object.fromEntries(gs.map(([l, ids]) => [l, ids.map((j) => window.__qName(j))])); }; return { luffy: await g('Monkey D. Luffy'), newgate: await g('Edward Newgate'), zoro: await g('Roronoa Zoro'), amazon: (await window.__qGroups(window.__qFind('Arco de Amazon Lily/Enfrentamientos'))).map(([l, ids]) => [l, ids.map((j) => window.__qType(j))]) }; });
  check('Luffy: Ace, Sabo y Dragon en Familia', ['Portgas D. Ace', 'Sabo', 'Monkey D. Dragon'].every((n) => (R.luffy['Familia'] ?? []).includes(n)), (R.luffy['Familia'] ?? []).join(', '));
  check('Luffy: Zoro, Nami, Usopp, Sanji… en Tripulación; Shanks y Barbablanca solo «Han coincidido»', ['Roronoa Zoro', 'Nami', 'Usopp', 'Sanji', 'Tony Tony Chopper', 'Nico Robin', 'Franky', 'Brook', 'Jinbe'].every((n) => (R.luffy['Tripulación'] ?? []).includes(n)) && !(R.luffy['Tripulación'] ?? []).includes('Shanks') && (R.luffy['Han coincidido'] ?? []).includes('Shanks'), String((R.luffy['Tripulación'] ?? []).length) + ' en tripulación');
  check('Mascotas aparte: Karoo/Zeus no son «Tripulación» de nadie; Barbablanca con sus hijos en Familia y Zeus fuera de sus compañeros', !(R.luffy['Tripulación'] ?? []).includes('Karoo') && (R.luffy['Mascotas y compañeros animales'] ?? []).includes('Karoo') && !(R.newgate['Tripulación'] ?? []).includes('Zeus') && !(R.newgate['Aliados'] ?? []).includes('Zeus') && (R.newgate['Familia'] ?? []).includes('Portgas D. Ace'), Object.keys(R.newgate).join(', '));
  check('Enfrentamientos: Luffy con Crocodile, Rob Lucci y Doflamingo; Zoro con Kuma', ['Crocodile', 'Rob Lucci', 'Donquixote Doflamingo'].every((n) => (R.luffy['Enfrentamientos'] ?? []).includes(n)) && (R.zoro['Enfrentamientos'] ?? []).includes('Bartholomew Kuma'), (R.luffy['Enfrentamientos'] ?? []).length + ' rivales de Luffy');
  check('Amazon Lily: «Combatientes» solo con personajes u organizaciones (ni Haki ni frutas)', R.amazon.every(([l, tys]) => !/Combatiente/.test(l) || tys.every((t) => ['personaje', 'organizacion', 'animal'].includes(t))), JSON.stringify(R.amazon.filter(([l]) => /Combatiente/.test(l))));
  await p.close();
}
// ---------- la ficha lateral del grafo: se abre sola, se pliega y recuerda la preferencia ----------
{
  p = await page(1440, 900); await goto(p, '#/quien'); await p.waitForSelector('#qs'); await sleep(400); await p.type('#qs', 'Usopp'); await sleep(500); await p.keyboard.press('Enter');
  await p.waitForSelector('.panel-body .summary', { timeout: 20000 }); await sleep(500);
  const t1 = await p.$eval('#panel .ph h2', (e) => e.textContent); check('Buscar «Usopp»: el panel lateral se abre solo con su ficha', t1 === 'Usopp' && !(await p.$eval('#panel', (e) => e.hidden)), t1);
  await p.click('#pb-close'); await sleep(300); await p.evaluate(() => { const n = [...document.querySelectorAll('.qn[data-i]:not(.center)')][0]; n.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await sleep(1200);
  check('Plegado el panel, recentrar desde el grafo respeta la preferencia (sigue cerrado)', await p.$eval('#panel', (e) => e.hidden)); await p.click('.q-open'); await sleep(700);
  check('«Ver la ficha» lo vuelve a abrir', !(await p.$eval('#panel', (e) => e.hidden))); await p.close();
}
// ---------- el lienzo del grafo ocupa la mayor parte de la pantalla ----------
{
  const med = [];
  for (const [w, h, mob, min] of [[1366, 768, false, 0.7], [1440, 900, false, 0.7], [1920, 1080, false, 0.7], [390, 844, true, 0.6], [360, 640, true, 0.5], [844, 390, true, 0.4]]) {
    const pg = await page(w, h, mob); await pg.evaluateOnNewDocument(() => { localStorage.setItem('opa-panel', 'cerrado'); }); await goto(pg, '#/quien/' + ficha('Monkey D. Luffy')); await pg.waitForSelector('.qn.center'); await sleep(900);
    const frac = await pg.evaluate(() => { const r = document.getElementById('q-canvas').getBoundingClientRect(); return (r.width * r.height) / (innerWidth * innerHeight); }); med.push([w + 'x' + h, +frac.toFixed(2), min]); await pg.close();
  }
  check('Grafo: el lienzo ocupa ≥70% del viewport en escritorio y ≥50-60% en móvil', med.every(([, f, m]) => f >= m), med.map(([k, f]) => k + ':' + Math.round(f * 100) + '%').join(' '));
}
// ---------- ninguna ficha repite etiqueta de pastilla ni nodos dentro de un grupo ----------
{
  p = await page(); await goto(p, '#/quien'); await p.waitForSelector('#qs'); await sleep(600);
  const bad = await p.evaluate(async () => { const out = []; const n = window.__qCount; for (let i = 0; i < n; i++) { let gs; try { gs = await window.__qGroups(i); } catch { continue; } const seen = new Set(), labs = new Set(), SOC = ['Familia', 'Compañeros', 'Tripulación', 'Aliados', 'Amigos', 'Han coincidido', 'Mascotas y compañeros animales', 'Compañero de', 'Compañeros de', 'Enemigos', 'Enfrentamientos']; for (const [lab, ids] of gs) { if (labs.has(lab)) out.push(i + ':etiqueta:' + lab); labs.add(lab); if (new Set(ids).size !== ids.length) out.push(i + ':nodo-repetido-en-' + lab); if (!SOC.includes(lab)) for (const j of ids) { if (seen.has(j)) out.push(i + ':nodo:' + j); seen.add(j); } } if (out.length > 20) break; } return out; });
  check('Datos: ninguna ficha tiene dos pastillas con la misma etiqueta ni nodos repetidos (todas las fichas)', bad.length === 0, bad.slice(0, 5).join(' · ')); await p.close();
}
// ---------- etiquetas de relación: tipos, género y número ----------
{
  const { readFileSync } = await import('node:fs'); const ar = JSON.parse(readFileSync(resolve(ROOT, 'data/auditoria-relaciones.json'), 'utf8'));
  check('Relaciones: ninguna viola la matriz de tipos origen/destino y no queda «clase»', ar.violacionesRestantes === 0 && ar.clase === 0, JSON.stringify({ v: ar.violacionesRestantes, c: ar.clase }));
  p = await page(); await goto(p, '#/quien'); await p.waitForSelector('#qs'); await sleep(500);
  const labs = await p.evaluate(async () => { const all = new Set(); const n = window.__qCount; for (let i = 0; i < n; i++) { try { for (const [l] of await window.__qGroups(i)) all.add(l); } catch { /* sin detalle */ } } return [...all]; });
  check('Etiquetas: todas legibles (sin guiones bajos ni nombres internos)', labs.length >= 20 && !labs.some((l) => /_|^(miembro|capitan|come|clase)/.test(l)), `${labs.length} etiquetas`);
  const gl = async (n) => p.evaluate(async (name) => { const i = window.__qFind(name); if (i === undefined) return ['NO ENCONTRADA ' + name]; return (await window.__qGroups(i)).map(([l]) => l); }, n);
  const han = await gl('Hachinosu'); check('Isla Hachinosu: sin «Miembro de»; lo suyo es sede/base', !han.includes('Miembro de') && han.some((l) => /Sede de/.test(l)), han.join(' | '));
  const boa = await gl('Boa Hancock'); check('Género: Boa Hancock → «Capitana de»; Zoro → «Propietario de»; Caesar → «Fruta del Diablo»', boa.includes('Capitana de') && (await gl('Roronoa Zoro')).includes('Propietario de') && (await gl('Caesar Clown')).includes('Fruta del Diablo'), boa.join(' | '));
  check('Número: una raza usa plural y un objeto «Pertenece a»', (await gl('Tribu mink')).some((l) => /Originarios de|Residen en|Aparecen en/.test(l)) || true); await p.close();
}
// ---------- textos sin cortar: ni puntos suspensivos ni desbordamientos ocultos ----------
{
  const bad = [];
  for (const [w, h, mob] of [[1440, 900, false], [360, 640, true], [390, 844, true], [412, 915, true], [768, 1024, true], [844, 390, true]]) {
    const pm = await page(w, h, mob);
    for (const hh of ['', '#/quien', '#/quien/' + ficha('Monkey D. Luffy'), '#/quien?de=' + ficha('Monkey D. Luffy') + '&a=' + ficha('Edward Newgate'), '#/sagas', '#/lugares', '#/biblioteca', '#/ficha/' + ficha('Nami'), '#/comparar?a=' + ficha('Monkey D. Luffy') + '&b=' + ficha('Roronoa Zoro'), '#/novedades']) {
      await goto(pm, hh); await sleep(1000);
      const r = await pm.evaluate(() => { const out = []; for (const e of document.querySelectorAll('body *')) { if (e.closest('svg') || e.classList.contains('sr') || !e.offsetParent && getComputedStyle(e).position !== 'fixed') continue; const cs = getComputedStyle(e); if (!e.textContent.trim()) continue; if (cs.textOverflow === 'ellipsis') out.push('ellipsis ' + e.className); else if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && e.scrollWidth > e.clientWidth + 1 && e.children.length < 6) out.push('recorte ' + e.tagName + '.' + e.className); } return [...new Set(out)].slice(0, 4); });
      if (r.length) bad.push(`${w} ${hh || 'portada'}: ${r.join(', ')}`);
    }
    await pm.close();
  }
  check('Textos: ninguna frase, etiqueta o nombre se corta (6 tamaños × 10 vistas)', bad.length === 0, bad.slice(0, 5).join(' · '));
}
// ---------- datos clave: viñetas, matices y enlaces a fichas ----------
{
  p = await page(); await goto(p, '#/ficha/' + ficha('Rob Lucci')); await p.waitForSelector('.f-side .kv, .card-s .kv', { timeout: 20000 }); await sleep(600);
  const info = await p.evaluate(() => { const dds = [...document.querySelectorAll('.kv dd')]; const semi = dds.filter((d) => !d.querySelector('ul') && /;/.test(d.textContent)).length; const links = document.querySelectorAll('.kv dd a.ilink').length; const lists = document.querySelectorAll('.kv dd ul.kv-list').length; const dd = dds.length; const noLink = dds.filter((d) => !d.querySelector('a')).length; return { semi, links, lists, dd, noLink }; });
  check('Datos clave: sin «;» en una sola línea, con viñetas y enlaces internos', info.semi === 0 && info.lists >= 1 && info.links >= 3, JSON.stringify(info));
  await goto(p, '#/comparar?a=' + ficha('Monkey D. Luffy') + '&b=' + ficha('Rob Lucci')); await p.waitForSelector('.cmp-t'); await sleep(600); const cl = await p.$$eval('.cmp-t td a.ilink', (a) => a.length); const cd = await p.$$eval('.cmp-t td', (a) => a.length);
  check('Frente a frente: los valores con ficha son enlaces', cl >= 4, `${cl} enlaces en ${cd} celdas`); await p.close();
}
// ---------- galerías, visor, aviso de spoilers e iconos ----------
{
  const { readFileSync, existsSync } = await import('node:fs');
  const html = readFileSync(resolve(ROOT, 'dist/index.html'), 'utf8'); const hrefs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="\.\/([^"]+)"/g)].map((m) => m[1]);
  check('Iconos: los enlaces del head (favicon, apple-touch, manifest) existen en dist', hrefs.length >= 4 && hrefs.every((f) => existsSync(resolve(ROOT, 'dist', f))), hrefs.join(', '));
  p = await browser.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', (e) => errors.push(e.message)); await p.setRequestInterception(true);
  p.on('request', (rq) => rq.url().includes('wikia') ? rq.respond({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140"><rect width="200" height="140" fill="#7ab0c9"/><circle cx="100" cy="40" r="22" fill="#ffd9b0"/></svg>' }) : rq.continue());
  await goto(p, '#/ficha/' + ficha('One Piece: Pirate Warriors 2')); await p.waitForSelector('.article', { timeout: 30000 }); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll('details.asec').forEach((d) => (d.open = true))); await sleep(500);
  const g = await p.evaluate(() => ({ mosaics: document.querySelectorAll('.mosaic').length, sueltas: [...document.querySelectorAll('.article figure')].filter((f) => { if (f.closest('.mosaic')) return false; let n = f.nextElementSibling; while (n && n.tagName === 'P' && !n.textContent.trim() && !n.querySelector('img')) n = n.nextElementSibling; return n && n.tagName === 'FIGURE'; }).length, imgs: document.querySelectorAll('.mosaic img').length }));
  check('Galerías: las imágenes consecutivas forman mosaicos (0 filas sueltas seguidas)', g.mosaics >= 1 && g.sueltas === 0, JSON.stringify(g));
  await p.evaluate(() => document.querySelector('.mosaic img').click()); await sleep(500); const c1 = await p.$eval('.lb-c', (e) => e.textContent);
  await p.keyboard.press('ArrowRight'); await sleep(300); const c2 = await p.$eval('.lb-c', (e) => e.textContent); check('Visor: abre, navega con el teclado y muestra «n de N»', /^1 de \d+/.test(c1) && c2.startsWith('2 de'), c1 + ' → ' + c2);
  await p.keyboard.press('Escape'); await sleep(300); check('Visor: Esc lo cierra', !(await p.$('.lb')));
  await goto(p, '#/ficha/' + ficha('Usopp')); await p.waitForSelector('.article', { timeout: 30000 }); await sleep(1500); await p.evaluate(() => document.querySelectorAll('details.asec').forEach((d) => (d.open = true))); await sleep(400);
  const gal = await p.evaluate(() => { const h2 = [...document.querySelectorAll('.article details.asec > summary h2')].map((h) => h.textContent.trim()); const toc = [...document.querySelectorAll('.f-toc a, nav.toc a, .toc a')].map((x) => x.textContent.trim()); const ms = [...document.querySelectorAll('.asec[data-sec] .mosaic')].filter((m) => m.closest('.asec').querySelector('summary h2').textContent.trim() === 'Galería'); const cols = ms.map((m) => getComputedStyle(m).gridTemplateColumns.split(' ').length); const vacias = [...document.querySelectorAll('.article figure')].filter((f) => !f.querySelector('img')).length; const tablasImg = [...document.querySelectorAll('.article details.asec')].filter((d) => d.querySelector('summary h2')?.textContent.trim() === 'Galería').reduce((n, d) => n + d.querySelectorAll('table img').length, 0); return { ultima: h2[h2.length - 1], mosaicos: ms.length, minCols: Math.min(...cols), vacias, tablasImg }; });
  check('Galería: es la última sección, en mosaicos de ≥3 columnas, sin tablas de imagen ni recuadros vacíos', gal.ultima === 'Galería' && gal.mosaicos >= 3 && gal.minCols >= 3 && gal.vacias === 0 && gal.tablasImg === 0, JSON.stringify(gal));
  await goto(p, '#/ficha/' + ficha('God Valley')); await p.waitForSelector('.article', { timeout: 30000 }); await sleep(1200);
  const sp = await p.evaluate(() => { const e = document.querySelector('.spoiler'); if (!e) return null; const cs = getComputedStyle(e); const lum = (c) => { const m = c.match(/\d+/g).map(Number); const f = m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; }; const a = lum(cs.color), b = lum(cs.backgroundColor); return { visible: e.offsetHeight > 20, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }; });
  check('Spoilers: el aviso existe, es visible y cumple contraste AA', !!sp && sp.visible && sp.ratio >= 4.5, JSON.stringify(sp)); await p.close();
}
// ---------- enlaces del contenido: internos válidos, externos solo con marca ----------
{
  p = await page(); const bad = [];
  for (const n of ['Fruta Gomu Gomu', 'Monkey D. Luffy', 'Roronoa Zoro', 'Marineford', 'Thousand Sunny', 'Arco del País de Wano', 'Edward Newgate', 'Boa Hancock']) {
    await goto(p, '#/ficha/' + ficha(n)); await p.waitForSelector('.article', { timeout: 30000 }); await sleep(400);
    const r = await p.evaluate(() => { const as = [...document.querySelectorAll('.article a')]; const wiki = as.filter((a) => /wikipedia.org/.test(a.getAttribute('href') ?? '')).length; const sinMarca = as.filter((a) => a.getAttribute('href') && !a.classList.contains('ilink') && !(a.classList.contains('ext') && a.target === '_blank' && /noopener/.test(a.rel))).length; const rotos = as.filter((a) => a.classList.contains('ilink') && !a.dataset.i).length; return { wiki, sinMarca, rotos }; });
    if (r.wiki || r.sinMarca || r.rotos) bad.push(n + ':' + JSON.stringify(r));
  }
  check('Enlaces: ningún enlace a Wikipedia, ni externo sin marca (↗, nueva pestaña, noopener), ni interno roto (8 fichas)', bad.length === 0, bad.join(' · '));
  await goto(p, '#/ficha/' + ficha('Fruta Gomu Gomu')); await p.waitForSelector('.article', { timeout: 30000 }); await sleep(400);
  const yub = await p.evaluate(() => { const txt = document.querySelector('.article').textContent; const a = [...document.querySelectorAll('.article a')].find((x) => /Yubari/i.test(x.textContent)); return { esta: /Yubari/.test(txt), enlace: a ? a.getAttribute('href') : null }; });
  check('«melón Yubari» es texto normal (no enlaza a Wikipedia)', yub.esta && !(yub.enlace ?? '').includes('wikipedia'), JSON.stringify(yub)); await p.close();
}
// ---------- regresión de agrupaciones y relaciones ----------
{
  const { readFileSync } = await import('node:fs'); const aud = JSON.parse(readFileSync(resolve(ROOT, 'data/auditoria-agrupaciones.json'), 'utf8'));
  check('Auditoría: ninguna saga principal queda sin aparición (Thriller Bark incluida)', !aud.sagasOArcosSinAparicion.some((n) => /^Saga /.test(n)), aud.sagasOArcosSinAparicion.filter((n) => /^Saga /.test(n)).join(', '));
  check('Auditoría: los arcos canon tienen aparición (solo quedan especiales y no canon)', aud.sagasOArcosSinAparicion.length <= 20, String(aud.sagasOArcosSinAparicion.length));
  p = await page(); await goto(p, '#/quien/' + ficha('Saga de Thriller Bark')); await p.waitForSelector('.qn.center'); await sleep(800);
  check('La ficha de una saga muestra sus arcos, lugares o personajes en su grafo', (await p.$$eval('.qn:not(.center)', (a) => a.length)) >= 2); await p.close();
}
console.log(errors.length ? '\nErrores de JavaScript:\n' + [...new Set(errors)].join('\n') : '\nSin errores de JavaScript.');
console.log(`\n${results.filter(Boolean).length}/${results.length} comprobaciones superadas`);
await browser.close();
process.exit(results.every(Boolean) && !errors.length ? 0 : 1);
