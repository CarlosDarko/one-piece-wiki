import { readFileSync, writeFileSync } from 'node:fs';
let L = readFileSync('scripts/prueba-humo.mjs', 'utf8').split('\n');
const k = L.findIndex((l) => l.includes("Filtros: todas las relaciones están activas por defecto")); if (k < 0) throw new Error('k');
L[k] = "check('Filtros: las categorías coloreadas se ven y las grises empiezan ocultas, con contador de ocultas', (await p.$$eval('.q-lg:not(.off)', (a) => a.length)) >= 3 && (await p.$$eval('.q-lg.off', (a) => a.length)) >= 1 && /ocultas/.test(await p.$eval('#q-fn', (e) => e.textContent)) && (await p.$eval('.fs-t', (e) => e.textContent)).includes('Mostrar / ocultar'));";
let s = L.join('\n');
const a = "// ---------- ninguna ficha repite etiqueta"; if (!s.includes(a)) throw new Error('a');
s = s.replace(a, () => `// ---------- relaciones concretas: familia, compañeros, combatientes y enfrentamientos ----------
{
  p = await page(); await goto(p, '#/quien'); await p.waitForSelector('#qs'); await sleep(500);
  const R = await p.evaluate(async () => { const g = async (n) => { const i = window.__qFind(n); const gs = await window.__qGroups(i); return Object.fromEntries(gs.map(([l, ids]) => [l, ids.map((j) => window.__qName(j))])); }; return { luffy: await g('Monkey D. Luffy'), zoro: await g('Roronoa Zoro'), amazon: (await window.__qGroups(window.__qFind('Arco de Amazon Lily/Enfrentamientos'))).map(([l, ids]) => [l, ids.map((j) => window.__qType(j))]) }; });
  check('Luffy: Ace, Sabo y Dragon en Familia', ['Portgas D. Ace', 'Sabo', 'Monkey D. Dragon'].every((n) => (R.luffy['Familia'] ?? []).includes(n)), (R.luffy['Familia'] ?? []).join(', '));
  check('Luffy: su tripulación (Zoro, Nami, Usopp, Sanji…) en Compañeros', ['Roronoa Zoro', 'Nami', 'Usopp', 'Sanji', 'Tony Tony Chopper', 'Nico Robin', 'Franky', 'Brook', 'Jinbe'].every((n) => (R.luffy['Compañeros'] ?? []).includes(n)), String((R.luffy['Compañeros'] ?? []).length));
  check('Enfrentamientos: Luffy con Crocodile, Rob Lucci y Kaidou; Zoro con Mihawk; sin aliados', ['Crocodile', 'Rob Lucci', 'Kaidou'].every((n) => (R.luffy['Enfrentamientos'] ?? []).includes(n)) && (R.zoro['Enfrentamientos'] ?? []).includes('Dracule Mihawk') && !(R.luffy['Enfrentamientos'] ?? []).includes('Roronoa Zoro'), (R.luffy['Enfrentamientos'] ?? []).length + ' rivales de Luffy');
  check('Amazon Lily: «Combatientes» solo con personajes u organizaciones (ni Haki ni frutas)', R.amazon.every(([l, tys]) => !/Combatiente/.test(l) || tys.every((t) => ['personaje', 'organizacion', 'animal'].includes(t))), JSON.stringify(R.amazon.filter(([l]) => /Combatiente/.test(l))));
  await p.close();
}
` + a);
writeFileSync('scripts/prueba-humo.mjs', s);
