// Auditoría de la ruta de los Sombreros de Paja (sin red): node scripts/auditoria-ruta.mjs [--check]  ->  data/auditoria-ruta.md
// Comprueba orden de capítulos, coherencia arco/saga, mares permitidos por tramo y barco; con --check sale con error si algo falla.
import { readFileSync, writeFileSync } from 'node:fs';
const load = (n) => JSON.parse(readFileSync(`public/data/${n}.js`, 'utf8').replace(/^__od\("[^"]+",/, '').replace(/\);?\s*$/, ''));
const idx = load('index'), pl = load('places'); const row = new Map(pl.p.map((r) => [r[0], r]));
const first = (t) => +(String(t ?? '').match(/\d+/)?.[0] ?? 0);
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
const SUNNY_FROM = pl.arcs.findIndex((a) => /regreso a Water 7/i.test(a.n));
const EAST = new Set([0, 1, 2, 3]); // mares que solo pisan en el East Blue (los otros Blues quedan fuera de la ruta)
const lines = []; let prevCh = 0, prevSea = null;
pl.route.forEach((r, k) => {
  const arc = pl.arcs[r.a], p = row.get(r.p), nm = idx.n[r.p], sea = pl.seas[p[1]], ch = first(arc.ca), saga = pl.sagas[arc.s]?.n ?? '(arco reciente, sin saga en la wiki)';
  ok(ch > prevCh, `parada ${k + 1}: el capítulo inicial ${ch} no sigue al anterior ${prevCh}`); prevCh = ch;
  ok(k < 6 ? p[1] === 0 : !EAST.has(p[1]), `parada ${k + 1} (${nm}): mar «${sea}» no permitido en este tramo`);
  ok(arc.s === -1 || pl.sagas[arc.s], `parada ${k + 1}: saga inexistente`);
  const ship = r.a >= SUNNY_FROM ? 'Thousand Sunny' : 'Going Merry';
  lines.push(`| ${k + 1} | ${arc.n} | ${arc.ca ?? '—'} | ${arc.ep ?? '—'} | ${saga} | ${nm} | ${sea} | ${ship} | [ficha del arco](https://onepiece.fandom.com/es/wiki/${encodeURIComponent(arc.n.replace(/ /g, '_'))}) |`);
  prevSea = p[1];
});
ok(pl.route.length >= 31, `solo ${pl.route.length} paradas`); ok(new Set(pl.route.map((r) => r.a)).size === pl.route.length, 'arcos repetidos');
ok(SUNNY_FROM > 0 && /Enies Lobby/.test(pl.arcs[SUNNY_FROM - 1].n), 'el Thousand Sunny debe empezar justo tras el arco de Enies Lobby');
const names = pl.route.map((r) => idx.n[r.p]);
for (const [a, b] of [['Reverse Mountain', 'Whisky Peak'], ['Water 7', 'Enies Lobby'], ['Amazon Lily', 'Impel Down'], ['Impel Down', 'Marineford'], ['Isla Gyojin', 'Punk Hazard'], ['Whole Cake Island', 'Mary Geoise'], ['Mary Geoise', 'País de Wano']]) ok(names.indexOf(a) >= 0 && names.indexOf(b) === names.indexOf(a) + 1, `«${a}» debe ir seguida de «${b}»`);
const md = `# Auditoría de la ruta de los Sombreros de Paja

Generada ${new Date().toISOString()}. Paradas: ${pl.route.length}. Comprobaciones: ${fails.length ? 'FALLAN ' + fails.length : 'todas superadas'}.

Cada parada es el lugar canónico del arco, fijado a mano en \`scripts/emit-web.mjs\` (tabla CANON_STOP) y contrastado con los datos de la propia wiki: capítulos y episodios del infobox de cada arco, saga a la que pertenece, y mar según las categorías del lugar. Fuente de cada fila: la ficha del arco en la One Piece Wiki en español (CC BY-SA).

| # | Arco | Capítulos | Episodios | Saga | Lugar de la parada | Mar | Barco | Fuente |
|---:|---|---|---|---|---|---|---|---|
${lines.join('\n')}

## Qué estaba mal (antes de esta revisión)
La parada de cada arco se elegía automáticamente como «el lugar que aparece por primera vez en el arco con más importancia», lo que daba paradas absurdas:
- Loguetown → *Marineford* (Paradise); Arabasta → *Spiders Cafe*; Little Garden → *Isla Kyuka*; Enies Lobby → *Ohara* (West Blue); regreso a Water 7 → *Baltigo*; 3D2Y y regreso a Sabaody → *G-1*; Dressrosa → *Onigashima*; Zou → *Isla Karai Bari*; Whole Cake Island → *Elbaph*; Levely → *Reino de Standing*; Wano → *Hachinosu*.
- Faltaba el arco de Marineford, y el barco cambiaba al Thousand Sunny en Thriller Bark, cuando el Sunny sale de Water 7 al terminar el arco de Enies Lobby (cap. 430; en la wiki empieza el arco del regreso a Water 7, cap. 431).
- *Thriller Bark* aparecía en el West Blue por una categoría de la wiki; los Sombreros de Paja nunca salieron de la Grand Line, así que se dibuja en Paradise (Triángulo Florian).

## Qué se ha corregido
- Tabla canónica arco → lugar (32 paradas, una por arco canónico incluido Marineford y Egghead).
- Cambio de barco: Going Merry hasta el arco de Enies Lobby; Thousand Sunny desde el regreso a Water 7.
- Cada parada muestra capítulos y episodios del arco; el recuadro de la ruta indica la saga (o «arcos recientes» si la wiki aún no la clasifica).
- Pruebas automáticas: orden creciente de capítulos, un arco por parada, mares permitidos (solo East Blue en los 6 primeros arcos, nunca los demás Blues después), pares consecutivos de la ruta, cambio de barco.

## Límites y dudas (honestas)
- Una parada por arco: los viajes dentro de un arco (p. ej. Sabaody ↔ Amazon Lily, Alabasta: Nanohana/Yuba/Alubarna) no se dibujan. El arco de 3D2Y se representa con Rusukaina (entrenamiento de Luffy): el resto de la tripulación estaba dispersa.
- El arco del Levely/Reverie se sitúa en Mary Geoise (sobre la Red Line); no hay arco de Elbaph en la lista de arcos de la wiki ni lugar propio en este recorrido (el arco de Elbaph existe en la wiki y se añadirá cuando tenga capítulos).
- El trazo entre paradas es una curva suave de adorno: no representa distancias ni corrientes. Los tramos «bajo el mar» (Isla Gyojin) y por la Red Line (Reverse Mountain, Sabaody) no se distinguen visualmente todavía.
- Posiciones: ver «confianza» de cada lugar; las 32 paradas tienen confianza alta en el orden, no en la distancia.
${fails.length ? '\n## FALLOS\n' + fails.map((f) => '- ' + f).join('\n') + '\n' : ''}`;
writeFileSync('data/auditoria-ruta.md', md); console.log(fails.length ? 'FALLOS:\n' + fails.join('\n') : `ruta OK (${pl.route.length} paradas)`);
if (process.argv.includes('--check') && fails.length) setTimeout(() => process.exit(1), 100);
