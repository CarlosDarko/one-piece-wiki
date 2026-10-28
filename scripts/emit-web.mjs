// Genera los ficheros de datos del sitio web (public/data/*.js) a partir de las entidades ya tipadas.
// Cada fichero llama a __od(nombre, datos) para poder cargarse con <script> (funciona desde file://).
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';

const OUT = 'public/data';
const SHARDS = 64;
const WEAK = new Set(['categorizado_en', 'primera_aparicion', 'aparece_en', 'es_de_raza', 'clase', 'relacionado', 'doblado_por']);
const SEAS = ['East Blue', 'West Blue', 'North Blue', 'South Blue', 'Paradise', 'Nuevo Mundo', 'Red Line', 'Calm Belt', 'Cielo', 'Grand Line', 'Sin ubicar'];
const SEA_RULES = [
  [/Red Line/i, 6], [/Calm Belt/i, 7], [/Skypiea|Isla del Cielo|\bcielo\b|Isla de los Dioses/i, 8], [/East Blue/i, 0], [/West Blue/i, 1], [/North Blue/i, 2], [/South Blue/i, 3],
  [/Nuevo Mundo|Totto Land|Wano|Dressrosa|Whole Cake|Punk Hazard|Zou\b|Egghead|Elbaph|Fish-?Man|Gyojin/i, 5], [/Paradise|Arabasta|Water 7|Drum|Little Garden|Jaya|Alabasta|Sabaody|Enies Lobby/i, 4], [/Grand Line/i, 9],
];
const key = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// "…/images/f/fc/Nombre.png/revision/latest/scale-to-width-down/268?cb=2021…&path-prefix=es" -> "f/fc/Nombre.png|2021…"
export function imgRef(url) {
  if (!url) return '';
  const m = url.match(/\/images\/(.+?)\/revision\/latest(?:\/scale-to-width-down\/\d+)?\?cb=(\d+)/);
  return m ? `${m[1]}|${m[2]}` : '!' + url;
}
const rangeOf = (v) => { const m = (v ?? '').match(/(\d+)\s*[-–]\s*(\d+)/); return m ? [+m[1], +m[2]] : null; };
const field = (e, ...ks) => { for (const k of ks) { const f = e.fields.find((x) => x.k === k); if (f && f.value) return f.value; } return null; };

export function emitWeb({ list, idx, result, typed, mentions, mentionedBy, resolve, catParents, redirects, TYPES, quality }) {
  rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT + '/detail', { recursive: true }); mkdirSync(OUT + '/art', { recursive: true });
  const emit = (name, data) => writeFileSync(`${OUT}/${name}.js`, `__od(${JSON.stringify(name)},${JSON.stringify(data)});`);
  const typeIdx = Object.fromEntries(TYPES.map((t, i) => [t, i]));
  const relNames = [...new Set([...typed.map((x) => x[2]), 'enfrenta_a', 'companero_de', 'enemigo_de', 'tripulacion_de', 'aliado_de', 'amigo_de', 'coincidido_con', 'mascota_de', 'progenitor_de', 'progenitor_adoptivo_de', 'hermano_de', 'hermano_adoptivo_de', 'abuelo_de', 'tio_de', 'conyuge_de', 'afiliado_a'])];
  const evTable = [], evMap = new Map(); const EVID = (k) => { let i = evMap.get(k); if (i === undefined) { i = evTable.length; evTable.push(k); evMap.set(k, i); } return i; }; const EV_NONE = EVID('?'); const flipEv = (id) => { const k = evTable[id]; return EVID(k.endsWith(':s') ? k.slice(0, -2) + ':t' : k.endsWith(':t') ? k.slice(0, -2) + ':s' : k); };
  let edges = typed.filter((x) => idx.has(x[0]) && idx.has(x[1])).map(([s, t, r, ev]) => [idx.get(s), idx.get(t), relNames.indexOf(r), EVID(ev ?? '?')]);
  const tipo = (i) => result.get(list[i].id).tipo;
  // ---- matriz de tipos por relación: descarta enlaces cuyo origen o destino no tiene sentido (p. ej. «doblado por» apuntando a una película)
  const ANY = null; const TS = (...a) => new Set(a);
  const MATRIX = {
    miembro_de: [TS('personaje', 'animal', 'organizacion', 'raza'), TS('organizacion')], capitan_de: [TS('personaje'), TS('organizacion', 'barco')], usa_barco: [TS('personaje', 'organizacion'), TS('barco')],
    come: [TS('personaje', 'animal'), TS('fruta_del_diablo')], es_de_raza: [ANY, TS('raza')], doblado_por: [TS('personaje', 'animal'), TS('persona_real')],
    primera_aparicion: [ANY, TS('capitulo', 'episodio', 'arco', 'saga', 'medio', 'volumen')], aparece_en: [ANY, TS('saga', 'arco', 'medio', 'capitulo', 'episodio', 'evento')],
    reside_en: [ANY, TS('lugar', 'naturaleza')], originario_de: [ANY, TS('lugar', 'naturaleza')], base_en: [ANY, TS('lugar', 'naturaleza')], en_region: [TS('lugar'), TS('lugar')],
    familiar_de: [TS('personaje', 'organizacion'), TS('personaje', 'organizacion')], propiedad_de: [TS('personaje', 'organizacion'), TS('arma', 'objeto', 'barco', 'tecnica', 'animal')],
    combatiente_en: [TS('personaje', 'organizacion', 'animal'), ANY], enfrenta_a: [TS('personaje', 'organizacion'), TS('personaje', 'organizacion')], companero_de: [TS('personaje', 'organizacion'), TS('personaje', 'organizacion')], tripulacion_de: [TS('personaje'), TS('personaje')], aliado_de: [TS('personaje', 'organizacion'), TS('personaje', 'organizacion')], amigo_de: [TS('personaje', 'organizacion'), TS('personaje', 'organizacion')], coincidido_con: [TS('personaje'), TS('personaje')], mascota_de: [TS('personaje'), TS('personaje')], afiliado_a: [TS('lugar'), TS('organizacion')], progenitor_de: [TS('personaje'), TS('personaje')], progenitor_adoptivo_de: [TS('personaje'), TS('personaje')], hermano_de: [TS('personaje'), TS('personaje')], hermano_adoptivo_de: [TS('personaje'), TS('personaje')], abuelo_de: [TS('personaje'), TS('personaje')], tio_de: [TS('personaje'), TS('personaje')], conyuge_de: [TS('personaje'), TS('personaje')], enemigo_de: [TS('personaje', 'organizacion'), TS('personaje', 'organizacion')], lado1: [TS('personaje', 'organizacion'), ANY], lado2: [TS('personaje', 'organizacion'), ANY], ocurre_en: [ANY, TS('lugar', 'naturaleza')], dirigido_por: [TS('organizacion', 'lugar'), TS('personaje')], de_nacion: [ANY, TS('lugar')],
  };
  const DROP = new Set(['clase']); // «clase» de fruta o persona es un dato de la ficha (Paramecia, Zoan, Logia…), no una relación con una página genérica
  const viol = new Map(); const kept = [];
  const RN = (n) => relNames.indexOf(n); const reclass = [];
  for (let e of edges) { let [s, t, r] = e, rel = relNames[r]; const ts0 = tipo(s), tt0 = tipo(t);
    // «miembro de» solo vale de persona a grupo: según el tipo de origen se convierte en la relación correcta (sede/base, barco, residencia)
    if (rel === 'miembro_de' && !list[s].id.includes('/') && !list[t].id.includes('/')) { if (ts0 === 'lugar' && tt0 === 'organizacion') { e = [s, t, RN('afiliado_a'), e[3]]; reclass.push('lugar→org: afiliado_a'); } else if (ts0 === 'barco' && tt0 === 'organizacion') { e = [t, s, RN('usa_barco'), flipEv(e[3])]; reclass.push('barco→org: usa_barco'); } else if (ts0 === 'personaje' && tt0 === 'lugar') { e = [s, t, RN('reside_en'), e[3]]; reclass.push('personaje→lugar: reside_en'); } else if (ts0 === 'organizacion' && tt0 === 'lugar') { e = [t, s, RN('afiliado_a'), flipEv(e[3])]; reclass.push('org→lugar: afiliado_a'); } [s, t, r] = e; rel = relNames[r]; }
     const ts = tipo(s), tt = tipo(t); let bad = DROP.has(rel); const m = MATRIX[rel]; if (!bad && m) { if (m[0] && !list[s].id.includes('/') && !m[0].has(ts)) bad = true; if (m[1] && !list[t].id.includes('/') && !m[1].has(tt)) bad = true; } if (bad) { const k = `${rel}|${ts}→${tt}`; const v = viol.get(k) ?? { n: 0, ex: [] }; v.n++; if (v.ex.length < 3) v.ex.push(`${list[s].id} → ${list[t].id}`); viol.set(k, v); } else kept.push(e); }
  edges = kept;
  // enfrentamientos: A y B son combatientes de bandos opuestos en el mismo combate o arco (campos combatientes1/2 de la infobox)
  { const sides = new Map(); for (const [s, t, r] of edges) { const rn = relNames[r]; if (rn === 'lado1' || rn === 'lado2') { const m = sides.get(t) ?? [new Set(), new Set()]; m[rn === 'lado1' ? 0 : 1].add(s); sides.set(t, m); } }
    const EF = relNames.indexOf('enfrenta_a'); const seen = new Set(edges.filter((x) => x[2] === EF).map(([a, b]) => (a < b ? a + '|' + b : b + '|' + a))); let nEf = 0; const chars = new Set(); const casos = [];
    for (const [ev, [A, B]] of sides) { let n = 0; for (const a of A) for (const b of B) { if (a === b || A.has(b) && B.has(a)) continue; const k = a < b ? a + '|' + b : b + '|' + a; if (seen.has(k) || n++ > 600) continue; seen.add(k); edges.push([a, b, EF, EVID('regla:enfrentamiento')]); chars.add(a); chars.add(b); nEf++; } if (casos.length < 5 && A.size && B.size) casos.push(list[ev].id + ': ' + [...A].slice(0, 2).map((i) => list[i].id).join(', ') + ' vs ' + [...B].slice(0, 2).map((i) => list[i].id).join(', ')); }
    // vínculos entre personas que comparten organización, clasificados por el tipo de organización (reglas en data/auditoria-relaciones.md):
    //  · Tripulación: misma banda pirata (nombre «Piratas…»/«Tripulación…» o con capitán), ≤ 60 miembros
    //  · Aliados: misma alianza, coalición o flota (nombre «Alianza/Coalición/Flota/Fuerzas aliadas…»), ≤ 60
    //  · Han coincidido: cualquier otra organización pequeña (2-45) compartida (rangos como «Los Cuatro Emperadores», cuerpos, etc.)
    // Cada par recibe solo su categoría más cercana (tripulación > aliados > amigos > han coincidido).
    { const PET = new RegExp('^(Mascotas|Homies|Animales|Armas vivientes)'); const NOT_PET = new Set(['Tony Tony Chopper', 'Carrot', 'Bepo', 'Pekoms', 'Pedro', 'Wanda']); const pets = new Set(list.map((_, i) => i).filter((i) => tipo(i) === 'personaje' && !NOT_PET.has(list[i].id) && list[i].cats.some((c) => PET.test(c)))); const R = { pet: relNames.indexOf('mascota_de'), crew: relNames.indexOf('tripulacion_de'), ally: relNames.indexOf('aliado_de'), friend: relNames.indexOf('amigo_de'), meet: relNames.indexOf('coincidido_con') }; const rank = new Map([[R.pet, 0], [R.crew, 0], [R.ally, 1], [R.friend, 2], [R.meet, 3]]);
      const captained = new Set(edges.filter(([, , r]) => relNames[r] === 'capitan_de').map(([, y]) => y)); const mem = new Map();
      for (const [x, y, r] of edges) if (relNames[r] === 'miembro_de' && tipo(x) === 'personaje' && tipo(y) === 'organizacion') { if (!mem.has(y)) mem.set(y, new Set()); mem.get(y).add(x); }
      const best = new Map(); const put = (p, q, cat, ev) => { if (pets.has(p) || pets.has(q)) { if (pets.has(p) && pets.has(q)) return; if (cat !== R.crew) return; cat = R.pet; if (pets.has(p)) [p, q] = [q, p]; } const k = p < q ? p + '|' + q : q + '|' + p; const cur = best.get(k); if (!cur || rank.get(cat) < rank.get(cur.cat)) best.set(k, { p, q, cat, ev }); };
      for (const e of edges) if ([R.ally, R.friend].includes(e[2])) put(e[0], e[1], e[2], e[3]);
      const stat = { crew: 0, ally: 0, meet: 0 };
      for (const [o, ms] of mem) { const name = list[o].id; const n = ms.size; if (n < 2) continue; const isCrew = /^(Piratas|Tripulaci)/i.test(name) || captained.has(o), isAlly = /^(Alianza|Coalici|Gran Flota|Flota|Fuerzas Aliadas|Aliados)/i.test(name); let cat = null; if (isAlly && n <= 60) cat = R.ally; else if (isCrew && n <= 60) cat = R.crew; else if (n <= 45) cat = R.meet; if (cat === null) continue; const arr = [...ms]; for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) put(arr[i], arr[j], cat); stat[cat === R.crew ? 'crew' : cat === R.ally ? 'ally' : 'meet']++; }
      edges = edges.filter((e) => ![R.crew, R.ally, R.friend, R.meet, R.pet].includes(e[2])); const cnt = [0, 0, 0, 0]; const EVC = new Map([[R.crew, 'regla:tripulacion'], [R.pet, 'regla:mascota'], [R.ally, 'regla:alianza'], [R.friend, 'regla:amistad'], [R.meet, 'regla:coincidencia']]); for (const { p, q, cat, ev } of best.values()) { edges.push([p, q, cat, ev ?? EVID(EVC.get(cat))]); cnt[cat === R.pet ? 0 : rank.get(cat)]++; }
      writeFileSync('data/auditoria-companeros.md', `# Reglas de los vínculos entre personas

Cada par de personas recibe solo su categoría más cercana:

| Categoría | Regla | Pares |
|---|---|---:|
| Tripulación | comparten una banda pirata (nombre «Piratas…»/«Tripulación…» o con capitán), ≤ 60 miembros | ${cnt[0]} |
| Mascotas y compañeros animales | miembro con categoría Mascotas, Homies o Armas vivientes de la misma banda (el dueño ve a la mascota) | (incluidas en la anterior) |
| Aliados | comparten una alianza, coalición o flota (nombre «Alianza/Coalición/Flota…»), o lo dicen los textos de «Relaciones» | ${cnt[1]} |
| Amigos | solo si el párrafo de su subsección en «Relaciones» lo dice (sin evidencia, no hay vínculo) | ${cnt[2]} |
| Han coincidido | comparten cualquier otra organización pequeña (2-45), como rangos o cuerpos | ${cnt[3]} |

Excepciones manuales: Chopper, Carrot, Bepo, Pekoms, Pedro y Wanda no cuentan como mascotas. Los enemigos y enfrentamientos salen de los textos y de los bandos de cada combate (data/auditoria-enfrentamientos.md). Orden dentro de cada grupo: importancia de la ficha. Estas reglas viven en scripts/emit-web.mjs y se aplican en cada actualización.
`); console.log('vínculos entre personas — tripulación:', cnt[0], 'aliados:', cnt[1], 'amigos:', cnt[2], 'han coincidido:', cnt[3]); globalThis.__compStat = { cnt, orgs: stat }; }
    // familia: un parentesco tipado sustituye al genérico «familiar_de» de la misma pareja; comprobaciones de coherencia y informe
    { const K = ['progenitor_de', 'progenitor_adoptivo_de', 'hermano_de', 'hermano_adoptivo_de', 'abuelo_de', 'tio_de', 'conyuge_de'].map((n) => relNames.indexOf(n)); const GEN = relNames.indexOf('familiar_de'); const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
      const tipadas = new Set(edges.filter((e) => K.includes(e[2])).map(([a, b]) => key(a, b))); const antesGen = edges.filter((e) => e[2] === GEN).length;
      edges = edges.filter((e) => e[2] !== GEN || !tipadas.has(key(e[0], e[1]))); const despuesGen = edges.filter((e) => e[2] === GEN).length;
      const P = relNames.indexOf('progenitor_de'); const hijos = new Map(), padres = new Map(); for (const [a, b, r] of edges) if (r === P) { (hijos.get(a) ?? hijos.set(a, []).get(a)).push(b); (padres.get(b) ?? padres.set(b, new Set()).get(b)).add(a); }
      const demasiados = [...padres].filter(([, s]) => s.size > 2).map(([h, s]) => `${list[h].id} (${[...s].map((x) => list[x].id).join(', ')})`);
      const ciclos = []; const estado = new Map(); const dfs = (n, pila) => { estado.set(n, 1); for (const c of hijos.get(n) ?? []) { if (estado.get(c) === 1) { ciclos.push([...pila, n, c].map((x) => list[x].id).join(' → ')); } else if (!estado.has(c)) dfs(c, [...pila, n]); } estado.set(n, 2); }; for (const n of hijos.keys()) if (!estado.has(n)) dfs(n, []);
      const propios = edges.filter((e) => K.includes(e[2]) && e[0] === e[1]).length; const cnt = Object.fromEntries(K.map((r) => [relNames[r], edges.filter((e) => e[2] === r).length]));
      globalThis.__fam = { cnt, antesGen, despuesGen, demasiados, ciclos, propios }; console.log('parentescos tipados:', JSON.stringify(cnt), '· genéricos', antesGen, '→', despuesGen, '· >2 progenitores:', demasiados.length, '· ciclos:', ciclos.length); }
    // contradicciones: un vínculo positivo fuerte (misma tripulación, alianza, familia, amistad o la misma organización) anula «Enemigos»
    { const POS = new Set(['tripulacion_de', 'aliado_de', 'familiar_de', 'amigo_de', 'mascota_de', 'progenitor_de', 'progenitor_adoptivo_de', 'hermano_de', 'hermano_adoptivo_de', 'abuelo_de', 'tio_de', 'conyuge_de'].map((n) => relNames.indexOf(n))); const EN = relNames.indexOf('enemigo_de');
      const orgsOf = new Map(); for (const [x, y, r] of edges) if (relNames[r] === 'miembro_de' && tipo(x) === 'personaje' && tipo(y) === 'organizacion') { if (!orgsOf.has(x)) orgsOf.set(x, new Set()); orgsOf.get(x).add(y); }
      const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a); const pos = new Set(edges.filter((e) => POS.has(e[2])).map(([a, b]) => key(a, b)));
      const sameOrg = (a, b) => { const A = orgsOf.get(a), B = orgsOf.get(b); if (!A || !B) return false; for (const o of A) if (B.has(o)) return true; return false; };
      const ejemplos = []; let antes = 0, quitadas = 0; const out = [];
      for (const e of edges) { if (e[2] !== EN) { out.push(e); continue; } antes++; if (pos.has(key(e[0], e[1])) || sameOrg(e[0], e[1])) { quitadas++; if (ejemplos.length < 12) ejemplos.push(list[e[0]].id + ' – ' + list[e[1]].id); continue; } out.push(e); }
      edges = out; globalThis.__contra = { antes, quitadas, ejemplos }; console.log('contradicciones «Enemigos» con vínculo positivo o misma organización:', quitadas, 'de', antes); }
    edges = edges.filter(([, , r]) => relNames[r] !== 'lado1' && relNames[r] !== 'lado2');
    writeFileSync('data/auditoria-enfrentamientos.md', `# Enfrentamientos derivados\n\nPares de combatientes de bandos opuestos en el mismo combate/arco: ${nEf}. Fichas con al menos un enfrentamiento: ${chars.size}. Combates con dos bandos: ${sides.size}.\n\nSolo se usan los campos combatientes1/combatientes2 de la infobox de cada combate o arco; si una ficha no los tiene, no se inventan bandos.\n\nEjemplos: ${casos.join(' · ')}\n`); }
  writeFileSync('data/auditoria-relaciones.md', `# Auditoría de relaciones\n\nSe descartan los enlaces cuyo tipo de origen o destino no encaja con la relación. Total descartado: ${[...viol.values()].reduce((a, v) => a + v.n, 0)}. Reclasificadas por tipo de origen: ${[...new Set(reclass)].map((k) => `${k} (${reclass.filter((x) => x === k).length})`).join(', ')}.\n\n| Relación y tipos (origen→destino) | Descartadas | Ejemplos |\n|---|---:|---|\n${[...viol].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `| ${k} | ${v.n} | ${v.ex.join(' · ')} |\n`).join('')}\nCausas: «doblado_por» salía de la lista de reparto en plantillas de películas y episodios (la persona real casi nunca tiene ficha: el actor queda como dato clave); «clase» enlazaba con páginas genéricas («Fruta del diablo/Zoan»), ahora es dato clave; «es_de_raza», «reside_en», etc. se validan por tipo de destino.\n`);
  { const c = globalThis.__contra ?? { antes: 0, quitadas: 0, ejemplos: [] }; writeFileSync('data/auditoria-contradicciones.md', `# Contradicciones entre relaciones

Regla: un vínculo positivo fuerte (misma tripulación, alianza, familia, amistad, mascota) o pertenecer a la misma organización anula «Enemigos». Los duelos y entrenamientos entre compañeros solo pueden aparecer como «Enfrentamientos». «Enemigos» exige evidencia explícita (la palabra «enemigo/antagonista/némesis» en el primer párrafo de su subsección de «Relaciones»).

| | Antes | Después |
|---|---:|---:|
| Parejas «Enemigos» | ${c.antes} | ${c.antes - c.quitadas} |
| Contradictorias (con vínculo positivo o misma organización) | ${c.quitadas} | 0 |

Ejemplos corregidos: ${c.ejemplos.join('; ')}.
`); }
  const violAfter = edges.filter(([s, t, r]) => { const m = MATRIX[relNames[r]]; if (!m || list[s].id.includes('/') || list[t].id.includes('/')) return false; return (m[0] && !m[0].has(tipo(s))) || (m[1] && !m[1].has(tipo(t))); }).length;
  writeFileSync('data/auditoria-relaciones.json', JSON.stringify({ descartadas: Object.fromEntries([...viol].map(([k, v]) => [k, v.n])), violacionesRestantes: violAfter, clase: edges.filter((x) => relNames[x[2]] === 'clase').length }, null, 1));
  // ---- género de las fichas de personaje (categorías «Masculinos/Femeninos»; si faltan, primera frase del resumen)
  const gen = list.map((e, i) => { if (tipo(i) !== 'personaje' || list[i].id.includes('/')) return ''; if (e.cats.some((c) => /^Femeninos/.test(c))) return 'f'; if (e.cats.some((c) => /^Masculinos/.test(c))) return 'm'; const t = (e.summary ?? '').slice(0, 260).toLowerCase(); const st = (e.summary ?? '').replace(/^[«"“]/, ''); if (/^(La|Las)[ ]/.test(st)) return 'f'; if (/^(El|Los)[ ]/.test(st)) return 'm'; if (/\b(es|era|fue|son|eran)\s+(una|la)\b|\bella\b|\bcapitana\b|\bprincesa\b|\breina\b|\bhermana\b|\bmadre\b/.test(t) && !/\b(es|era|fue)\s+(un|el)\b/.test(t)) return 'f'; if (/\b(es|era|fue)\s+(un|el)\b|\bél\b/.test(t)) return 'm'; return ''; });
  { const pj = list.map((_, i) => i).filter((i) => tipo(i) === 'personaje' && !list[i].id.includes('/')); const sin = pj.filter((i) => !gen[i]); const porCat = pj.filter((i) => list[i].cats.some((c) => /^(Femeninos|Masculinos)/.test(c))).length; writeFileSync('data/auditoria-genero.md', `# Auditoría de género\n\nPersonajes: ${pj.length}. Género por categoría (Masculinos/Femeninos): ${porCat}. Por la primera frase del resumen: ${pj.length - porCat - sin.length}. Sin género fiable: ${sin.length} (${(100 * sin.length / pj.length).toFixed(1)} %): se usa el masculino genérico.\n\nMuestra sin género: ${sin.slice(0, 15).map((i) => list[i].id).join(', ')}.\n`); }

  // importancia y relaciones por entidad
  const imp = new Array(list.length).fill(0);
  const relsOf = list.map(() => []);
  { const antes = edges.length; edges = edges.filter((e) => e[3] !== EV_NONE); globalThis.__sinRespaldo = antes - edges.length; }
  for (const [s, t, r, ev] of edges) { if (!WEAK.has(relNames[r])) { imp[s]++; imp[t]++; } relsOf[s].push([r, t, 0, ev]); relsOf[t].push([r, s, 1, ev]); }
  list.forEach((_, i) => { imp[i] += mentionedBy[i].length * 0.01; });
  // orden de las relaciones de cada ficha: las estructuradas primero (por tipo e importancia del otro extremo), las débiles al final; así el recorte a 400 nunca pierde familia, compañeros o rivales
  { const PRI = ['miembro_de', 'capitan_de', 'familiar_de', 'progenitor_de', 'progenitor_adoptivo_de', 'hermano_de', 'hermano_adoptivo_de', 'abuelo_de', 'tio_de', 'conyuge_de', 'tripulacion_de', 'mascota_de', 'aliado_de', 'amigo_de', 'enemigo_de', 'enfrenta_a', 'coincidido_con', 'usa_barco', 'come', 'originario_de', 'reside_en', 'base_en', 'dirigido_por', 'parte_de', 'evoluciona_en', 'propiedad_de', 'combatiente_en']; const pr = (r) => (WEAK.has(relNames[r]) ? 99 : PRI.indexOf(relNames[r]) < 0 ? 50 : PRI.indexOf(relNames[r])); for (const arr of relsOf) arr.sort((x, y) => pr(x[0]) - pr(y[0]) || imp[y[1]] - imp[x[1]]); }

  // resumen con enlaces internos: [[Título|texto]] -> ⟦idx|texto⟧
  const mark = (s) => (s ?? '').replace(/\[\[([^|\]]+)\|([^\]]*)\]\]/g, (_m, t, txt) => { const id = resolve(t); return id !== undefined && idx.has(id) ? `⟦${idx.get(id)}|${txt}⟧` : txt; });
  const plain = (s) => s.replace(/⟦\d+\|([^⟧]*)⟧/g, '$1');
  const shortMark = (s, n) => { const full = mark(s); if (plain(full).length <= n) return full; let out = '', len = 0; for (const part of full.split(/(⟦\d+\|[^⟧]*⟧)/)) { const p = plain(part); if (len + p.length > n) { out += part.startsWith('⟦') ? '' : part.slice(0, n - len).replace(/\s+\S*$/, ''); return out + '…'; } out += part; len += p.length; } return out; };

  // ---- índice de búsqueda (nombres, tipos, importancia, alias) y miniaturas
  const aliasOf = list.map(() => []);
  for (const [from, to] of Object.entries(redirects ?? {})) { const t = resolve(to); if (t !== undefined && idx.has(t) && from !== t) aliasOf[idx.get(t)].push(from); }
  // subpáginas (Historia, Personalidad, Galería…) que se integran como secciones de su ficha principal
  const parentOf = (id) => id.slice(0, id.lastIndexOf('/'));
  const kidsOf = new Map(); const childSet = new Set();
  for (let i = 0; i < list.length; i++) { const id = list[i].id; if (tipo(i) === 'meta' && id.includes('/') && idx.has(parentOf(id))) { const p = idx.get(parentOf(id)); (kidsOf.get(p) ?? kidsOf.set(p, []).get(p)).push(i); childSet.add(i); } }
  const rootOf = new Map();
  const markRoot = (i, root) => { for (const c of kidsOf.get(i) ?? []) { rootOf.set(c, root); markRoot(c, root); } };
  for (const p of kidsOf.keys()) if (!childSet.has(p)) markRoot(p, p);
  emit('index', {
    ev: evTable,
    sub: [...rootOf],
    types: TYPES, rels: relNames, n: list.map((e) => e.id), t: list.map((_, i) => typeIdx[tipo(i)]), s: imp.map((v) => Math.round(v * 10) / 10),
    g: gen,
    a: aliasOf.map((a, i) => (a.length ? [i, a.slice(0, 6).join('|')] : null)).filter(Boolean),
  });
  emit('imgs', list.map((e) => imgRef(e.img)));

  // ---- entidades destacadas para el grafo inicial (personajes y organizaciones principales)
  const bad = (i) => list[i].id.includes('/');
  const cand = (ty, k) => list.map((_, i) => i).filter((i) => tipo(i) === ty && !bad(i)).sort((a, b) => imp[b] - imp[a]).slice(0, k);
  const PIN = ['Monkey D. Luffy', 'Piratas de Sombrero de Paja', 'Marina', 'Los Cuatro Emperadores', 'Ejército Revolucionario', 'Los Siete Señores de la Guerra del Mar', 'Gobierno Mundial'];
  const featured = new Set([...PIN.map((p) => { const id = resolve(p); return id !== undefined ? idx.get(id) : undefined; }).filter((x) => x !== undefined), ...cand('personaje', 40), ...cand('organizacion', 12)]);
  for (const i of [...featured]) { // que ningún destacado quede suelto: añade su organización más relevante
    if (tipo(i) !== 'personaje') continue;
    if (relsOf[i].some(([r, j]) => featured.has(j) && !WEAK.has(relNames[r]))) continue;
    const org = relsOf[i].filter(([r, j]) => relNames[r] === 'miembro_de' && tipo(j) === 'organizacion').sort((a, b) => imp[b[1]] - imp[a[1]])[0];
    if (org && featured.size < 70) featured.add(org[1]);
  }
  const fl = [...featured];
  // conjuntos de arranque de «Quién es quién»: relaciones tipadas entre ellos + menciones mutuas (las más importantes) como relación débil
  const MENC = relNames.length;
  const mset = list.map((e) => new Set(mentions.get(e.id)));
  const mutual = (a, b) => mset[a].has(list[b].id) && mset[b].has(list[a].id);
  const buildSet = (seeds, add = [], maxM = 150) => {
    const S = new Set(seeds);
    for (const [rel, dir, ty, k] of add) for (const i of seeds) relsOf[i].filter(([r, j, d]) => relNames[r] === rel && d === dir && tipo(j) === ty && !list[j].id.includes('/')).sort((a, b) => imp[b[1]] - imp[a[1]]).slice(0, k).forEach(([, j]) => S.add(j));
    const ids = [...S]; const typedE = edges.filter(([s, t, r]) => S.has(s) && S.has(t) && !WEAK.has(relNames[r]));
    const linked = new Set(typedE.map(([s, t]) => `${Math.min(s, t)}-${Math.max(s, t)}`));
    const ment = [];
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) { const a = ids[x], b = ids[y]; if (!linked.has(`${Math.min(a, b)}-${Math.max(a, b)}`) && mutual(a, b)) ment.push([a, b, MENC, imp[a] + imp[b]]); }
    ment.sort((p, q) => q[3] - p[3]);
    return { n: ids.map((i) => ({ i, n: list[i].id, t: typeIdx[tipo(i)], s: imp[i], m: imgRef(list[i].img) })), e: [...typedE, ...ment.slice(0, maxM).map(([a, b, r]) => [a, b, r])] };
  };
  const relsAll = [...relNames, 'menciona'];
  emit('featured', { types: TYPES, rels: relsAll, ...buildSet(fl, [], 120) });
  emit('sets', { types: TYPES, rels: relsAll, sets: {
    personajes: buildSet(cand('personaje', 60), [], 170),
    organizaciones: buildSet(cand('organizacion', 34), [['miembro_de', 1, 'personaje', 2], ['capitan_de', 1, 'personaje', 1]], 90),
    frutas: buildSet(cand('fruta_del_diablo', 40), [['come', 1, 'personaje', 1]], 40),
    barcos: buildSet(cand('barco', 24), [['usa_barco', 1, 'organizacion', 1]], 40),
    lugares: buildSet(cand('lugar', 50), [['originario_de', 1, 'personaje', 1]], 120),
  } });

  // ---- fichas por lotes
  const shards = Array.from({ length: SHARDS }, () => ({}));
  list.forEach((e, i) => {
    const r = result.get(e.id);
    shards[i % SHARDS][i] = {
      r: mark(e.summaryMarked) || e.summary, url: 'https://onepiece.fandom.com/es/wiki/' + encodeURIComponent(e.id.replace(/ /g, '_')).replace(/%2C/g, ','),
      ib: e.fields.filter((f) => f.value && !['name', 'image', 'imagen', 'bandera'].includes(f.k)).slice(0, 24).map((f) => [f.label, f.value.slice(0, 220), f.k]),
      cats: e.cats.slice(0, 20), conf: r.conf, why: r.motivo, rl: relsOf[i].slice(0, 400),
      m: mentions.get(e.id).map((t) => idx.get(t)).filter((x) => x !== undefined), mb: mentionedBy[i],
    };
  });
  shards.forEach((s, k) => emit(`detail/${k}`, s));

  // ---- artículos completos: cada ficha principal incluye las secciones de sus subpáginas, con índice y anclas
  const ART_SHARDS = 320;
  const escH = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escT = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const lastSeg = (id) => id.slice(id.lastIndexOf('/') + 1);
  const shiftH = (html, delta, pref) => html.replace(/<h([2-5]) id="s(\d+)">/g, (_m, l, n) => `<h${Math.min(5, +l + delta)} id="${pref}${n}">`).replace(/<\/h([2-5])>/g, (_m, l) => `</h${Math.min(5, +l + delta)}>`);
  const matchEnd = (html, from) => { let depth = 0; const re = /<(\/?)ul>/g; re.lastIndex = from; let m; while ((m = re.exec(html))) { depth += m[1] ? -1 : 1; if (depth === 0) return re.lastIndex; } return -1; };
  const dropNav = (html, rootId) => { // lista de navegación a las subpáginas (Introducción · Galería · Historia…)
    const k1 = `data-t="${escT(rootId)}/`; let from = html.indexOf('<ul>');
    while (from >= 0 && from < 5000) { const end = matchEnd(html, from); if (end > 0 && html.slice(from, end).includes(k1)) return html.slice(0, from) + html.slice(end); from = html.indexOf('<ul>', from + 4); }
    return html;
  };
  const FEATURED_TABLE = /<table>(?:(?!<\/table>)[\s\S])*?art[ií]culo destacado(?:(?!<\/table>)[\s\S])*<\/table>/i;
  const cleanPart = (html) => dropNav(html, list[rootCur].id).replace(FEATURED_TABLE, '');
  const minLevel = (h) => { let m = 9; for (const x of h.matchAll(/<h([2-5]) id="s/g)) m = Math.min(m, +x[1]); return m === 9 ? 2 : m; };
  // k = profundidad (0 = ficha principal): sus secciones pasan a h2; las de una subpágina a h3, etc.; el título de cada subpágina es una sección
  const build = (i, k) => {
    const raw = list[i].art?.html ?? ''; const own = cleanPart(raw);
    let html = shiftH(own, 2 + k - minLevel(own), i === rootCur ? 'r' : `p${i}-`);
    const ks = (kidsOf.get(i) ?? []).map((c) => ({ c, pos: raw.indexOf(`data-t="${escT(list[c].id)}"`) })).sort((x, y) => (x.pos < 0 ? 1e9 : x.pos) - (y.pos < 0 ? 1e9 : y.pos) || list[x.c].id.localeCompare(list[y.c].id, 'es'));
    for (const { c } of ks) { const d = Math.min(5, 2 + k); html += `<h${d} id="x${c}">${escH(lastSeg(list[c].id))}</h${d}>` + build(c, k + 1); }
    return html;
  };
  let rootCur = -1;
  const artShards = Array.from({ length: ART_SHARDS }, () => ({}));
  let artBytes = 0, artCount = 0;
  list.forEach((e, i) => {
    if (rootOf.has(i)) return; // subpágina absorbida por su ficha principal
    rootCur = i; let html = build(i, 0);
    html = html.replace(/<a data-t="([^"]*)">([\s\S]*?)<\/a>/g, (_m, t, inner) => {
      const id = resolve(t.replace(/&quot;/g, '"').replace(/&amp;/g, '&')); if (id === undefined || !idx.has(id)) return inner;
      const j = idx.get(id), r = rootOf.get(j); return r !== undefined ? `<a data-i="${r}" data-s="x${j}">${inner}</a>` : `<a data-i="${j}">${inner}</a>`;
    });
    const toc = [...html.matchAll(/<h([2-4]) id="([^"]+)">([^<]*)<\/h\1>/g)].map((m) => [m[2], +m[1], m[3].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')]);
    if (!html && !e.fields.length) return;
    artShards[i % ART_SHARDS][i] = { h: html, t: toc, x: e.fields.filter((f) => f.value && !['name', 'image', 'imagen', 'bandera'].includes(f.k)).map((f) => [f.label, f.value.slice(0, 700), f.k]) };
    artBytes += html.length; artCount++;
  });
  artShards.forEach((s, k) => emit(`art/${k}`, s));
  console.log(`artículos: ${artCount} fichas con contenido completo, ${(artBytes / 1048576).toFixed(1)} MB de HTML limpio en ${ART_SHARDS} lotes; ${rootOf.size} subpáginas integradas`);

  // ---- sagas y arcos con lo que aparece en cada tramo (capítulo de primera aparición dentro del rango del arco)
  const firstCh = new Map(); // idx entidad -> nº de capítulo de primera aparición
  const relPA = relNames.indexOf('primera_aparicion');
  for (const [s, t, r] of edges) if (r === relPA && tipo(t) === 'capitulo') { const n = +list[t].id.match(/\d+/)?.[0]; if (n && (!firstCh.has(s) || n < firstCh.get(s))) firstCh.set(s, n); }
  const mk = (i) => { const e = list[i]; return { i, n: e.id, ca: field(e, 'capítulo', 'cap', 'capitulo'), ep: field(e, 'episodio', 'epi'), fe: field(e, 'fecha'), r: shortMark(e.summaryMarked, 330) }; };
  const sagas = list.map((_, i) => i).filter((i) => tipo(i) === 'saga' && !list[i].id.includes('/')).map((i) => ({ ...mk(i), rg: rangeOf(field(list[i], 'capítulo', 'cap', 'capitulo')) })).filter((s) => s.rg).sort((a, b) => a.rg[0] - b.rg[0]);
  const arcsAll = list.map((_, i) => i).filter((i) => tipo(i) === 'arco' && !list[i].id.includes('/')).map((i) => ({ ...mk(i), rg: rangeOf(field(list[i], 'cap', 'capítulo', 'capitulo')), nc: list[i].cats.some((c) => /no canon/i.test(c)) }));
  const antagCat = (e) => e.cats.filter((c) => /^Antagonistas de /i.test(c)).map((c) => key(c.replace(/^Antagonistas de (la |el )?/i, '')));
  const GROUPS = { personaje: 'personajes', lugar: 'lugares', fruta_del_diablo: 'frutas', barco: 'barcos', organizacion: 'organizaciones', tecnica: 'tecnicas' };
  const appearsRel = relNames.indexOf('aparece_en');
  const enfOf = new Map(list.map((e, i) => [e.id, i]));
  for (const a of arcsAll) {
    const g = { personajes: [], antagonistas: [], lugares: [], frutas: [], barcos: [], organizaciones: [], tecnicas: [] };
    const sagaOf = a.rg ? sagas.find((s) => a.rg[0] >= s.rg[0] && a.rg[1] <= s.rg[1] + 6) : null;
    const names = [key(a.n), sagaOf ? key(sagaOf.n) : ''];
    const members = new Set();
    if (a.rg) for (const [i, c] of firstCh) if (c >= a.rg[0] && c <= a.rg[1]) members.add(i);
    for (const [s, t, r] of edges) if (r === appearsRel && t === a.i) members.add(s);
    for (const i of members) {
      const gr = GROUPS[tipo(i)]; if (!gr || list[i].id.includes('/')) continue;
      if (gr === 'personajes' && antagCat(list[i]).some((c) => names.includes(c))) g.antagonistas.push(i); else g[gr].push(i);
    }
    a.tot = {}; for (const k of Object.keys(g)) { g[k].sort((x, y) => imp[y] - imp[x]); a.tot[k] = g[k].length; g[k] = g[k].slice(0, 14); }
    a.g = g; a.saga = sagaOf ? sagaOf.i : null;
    const enf = enfOf.get(a.n + '/Enfrentamientos'); if (enf !== undefined) a.enf = enf;
  }
  const strip = ({ rg, ...o }) => o;
  const timeline = {
    sagas: sagas.map((s) => ({ ...strip(s), arcs: arcsAll.filter((a) => a.saga === s.i && !a.nc).sort((x, y) => x.rg[0] - y.rg[0]).map(strip) })),
    noCanon: arcsAll.filter((a) => a.nc).map(strip),
    sueltos: arcsAll.filter((a) => !a.nc && a.saga === null).map(strip),
    pelis: list.map((_, i) => i).filter((i) => list[i].cats.some((c) => /^Películas de One Piece$/.test(c)) && !list[i].id.includes('/')).map((i) => ({ i, n: list[i].id, y: +(field(list[i], 'estreno') ?? '').match(/(19|20)\d\d/)?.[0] || 0, r: shortMark(list[i].summaryMarked, 240) })).sort((a, b) => a.y - b.y),
    eventos: list.map((_, i) => i).filter((i) => tipo(i) === 'evento' && !list[i].id.includes('/')).sort((a, b) => imp[b] - imp[a]).slice(0, 60),
  };
  emit('timeline', timeline);
  // ---- más señales para la primera aparición: las sagas y arcos empiezan en su primer capítulo, los capítulos son su propio número
  const inferred = { saga: 0, arco: 0, capitulo: 0 };
  for (const s of sagas) if (s.rg && !firstCh.has(s.i)) { firstCh.set(s.i, s.rg[0]); inferred.saga++; }
  for (const a of arcsAll) if (a.rg && !firstCh.has(a.i)) { firstCh.set(a.i, a.rg[0]); inferred.arco++; }
  for (let i = 0; i < list.length; i++) if (tipo(i) === 'capitulo' && !firstCh.has(i)) { const n = +list[i].id.match(/\d+/)?.[0]; if (n) { firstCh.set(i, n); inferred.capitulo++; } }
  // ---- auditoría de agrupaciones y relaciones (data/auditoria-agrupaciones.json y .md)
  {
    const roots = list.map((_, i) => i).filter((i) => !list[i].id.includes('/') && tipo(i) !== 'meta');
    const byType = new Map(); for (const i of roots) { const t = tipo(i); if (!byType.has(t)) byType.set(t, []); byType.get(t).push(i); }
    const rows = [...byType].map(([t, is]) => { const sinCap = is.filter((i) => !firstCh.has(i)), sinRel = is.filter((i) => !(relsOf[i] ?? []).some(([r]) => !WEAK.has(relNames[r]))); return { tipo: t, fichas: is.length, sinPrimeraAparicion: sinCap.length, sinRelacionEstructurada: sinRel.length, muestraSinAparicion: sinCap.slice(0, 6).map((i) => list[i].id), muestraSinRelacion: sinRel.slice(0, 6).map((i) => list[i].id) }; }).sort((a, b) => b.fichas - a.fichas);
    const sagaArcSin = [...sagas, ...arcsAll].filter((x) => !firstCh.has(x.i)).map((x) => list[x.i].id);
    const aud = { generado: new Date().toISOString(), inferidas: inferred, sagasOArcosSinAparicion: sagaArcSin, porTipo: rows, notas: ['La primera aparición sale de la relación primera_aparicion con un capítulo; sagas y arcos usan su primer capítulo y los capítulos su número.', 'Los personajes sin organización son los que la wiki no vincula a ninguna con miembro_de/capitan_de.', 'Episodios, volúmenes y obras no tienen capítulo propio: es esperable que no tengan primera aparición.'] };
    writeFileSync('data/auditoria-agrupaciones.json', JSON.stringify(aud, null, 1));
    writeFileSync('data/auditoria-agrupaciones.md', `# Auditoría de agrupaciones y relaciones\n\nGenerada ${aud.generado}. Inferidas por rango: ${JSON.stringify(inferred)}. Sagas o arcos sin aparición: ${sagaArcSin.length}.\n\n| Tipo | Fichas | Sin primera aparición | Sin relación estructurada |\n|---|---:|---:|---:|\n${rows.map((r) => `| ${r.tipo} | ${r.fichas} | ${r.sinPrimeraAparicion} | ${r.sinRelacionEstructurada} |`).join('\n')}\n\n${aud.notas.map((n) => `- ${n}`).join('\n')}\n`);
  }
  // ---- auditoría de etiquetas de relación (data/auditoria-etiquetas.md)
  {
    const cnt = relNames.map(() => ({ n: 0, ex: [] }));
    for (const [s, t, r] of edges) { cnt[r].n++; if (cnt[r].ex.length < 3 && imp[s] > 8) cnt[r].ex.push(`${list[s].id} → ${list[t].id}`); }
    writeFileSync('data/auditoria-etiquetas.md', `# Auditoría de etiquetas de relación\n\n| Relación (interna) | Nº | Débil | Ejemplos |\n|---|---:|:-:|---|\n${relNames.map((r, k) => ({ r, k })).sort((a, b) => cnt[b.k].n - cnt[a.k].n).map(({ r, k }) => `| ${r} | ${cnt[k].n} | ${WEAK.has(r) ? 'sí' : ''} | ${cnt[k].ex.join(' · ')} |`).join('\n')}\n`);
  }
  const lastEnd = sagas.length ? sagas[sagas.length - 1].rg[1] : 0;
  emit('chap', { ch: list.map((_, i) => firstCh.get(i) ?? 0), sg: [...sagas.map((s) => ({ n: s.n, a: s.rg[0], b: s.rg[1] })), { n: 'Arcos más recientes (Egghead, Elbaph…)', a: lastEnd + 1, b: 99999 }] });

  // ---- lugares: cada lugar a su mar por las categorías reales de la wiki (y sus padres) o su región de infobox
  const seaOfCats = (cats) => {
    for (let depth = 0, level = cats, seen = new Set(); depth < 4 && level.length; depth++) {
      const next = [];
      for (const c of level) { if (seen.has(c)) continue; seen.add(c); for (const [re, s] of SEA_RULES) if (re.test(c)) return s; next.push(...(catParents[c] ?? [])); }
      level = next;
    }
    return -1;
  };
  const relRegion = relNames.indexOf('en_region');
  const places = list.map((_, i) => i).filter((i) => tipo(i) === 'lugar' && !list[i].id.includes('/')).map((i) => {
    let s = seaOfCats(list[i].cats);
    if (s < 0) for (const [r, j] of relsOf[i]) if (r === relRegion) { s = SEA_RULES.find(([re]) => re.test(list[j].id))?.[1] ?? -1; if (s >= 0) break; }
    if (s < 0) for (const [re, k] of SEA_RULES) if (re.test(list[i].id)) { s = k; break; }
    return [i, s < 0 ? 10 : s];
  });
  // orden de los arcos (canon) y asignación de cada lugar al arco donde aparece por primera vez
  const orderedArcs = [...sagas.flatMap((s) => arcsAll.filter((a) => a.saga === s.i && !a.nc).sort((x, y) => x.rg[0] - y.rg[0])), ...arcsAll.filter((a) => !a.nc && a.saga === null && a.rg).sort((x, y) => x.rg[0] - y.rg[0])];
  const sagaPos = (a) => sagas.findIndex((s) => s.i === a.saga);
  const KINDS = ['Isla', 'Ciudad o pueblo', 'Reino o país', 'Mar o región', 'Otro lugar'];
  const kindOf = (e) => (e.cats.some((c) => /^(Islas|Archipiélagos)/.test(c)) ? 0 : e.cats.some((c) => /^(Ciudades|Pueblos|Villas|Aldeas)/.test(c)) ? 1 : e.cats.some((c) => /^(Reinos|Países)/.test(c)) ? 2 : e.cats.some((c) => /^(Mares|Océanos|Corrientes|Regiones)/.test(c)) ? 3 : 4);
  const GENERIC = /^(East Blue|West Blue|North Blue|South Blue|Grand Line|Paradise|Nuevo Mundo|Red Line|Calm Belt|Mar Azul)$/;
  const placeRows = places.map(([i, s]) => { const ch = firstCh.get(i) ?? 0; const ap = ch ? orderedArcs.findIndex((a) => a.rg && ch >= a.rg[0] && ch <= a.rg[1]) : -1; return [i, s, kindOf(list[i]), ch, ap]; });
  const seaOf = new Map(places.map(([i, s]) => [i, s]));
  const route = []; // un lugar representativo por arco, en orden: la ruta del viaje sobre el mapa
  orderedArcs.forEach((a, p) => {
    const arcKey = key(a.n.replace(/^Arco (de la |de los |de las |del |de |)/i, ''));
    const cands = placeRows.filter((r) => r[4] === p && r[1] !== 10 && r[2] !== 3 && !GENERIC.test(list[r[0]].id)).map((r) => ({ i: r[0], sc: (arcKey && (key(list[r[0]].id) === arcKey || key(list[r[0]].id).includes(arcKey) || arcKey.includes(key(list[r[0]].id))) ? 1000 : 0) + (r[2] === 0 ? 40 : 0) + Math.min(imp[r[0]], 60) }));
    const pick = cands.sort((x, y) => y.sc - x.sc)[0]?.i;
    if (pick !== undefined && route[route.length - 1]?.p !== pick) route.push({ a: p, p: pick });
  });
  emit('places', { seas: SEAS, kinds: KINDS, p: placeRows, arcs: orderedArcs.map((a) => ({ i: a.i, n: a.n, s: sagaPos(a) })), sagas: sagas.map((s) => ({ i: s.i, n: s.n })), route });
  // recompensas: ranking de personajes por la mayor recompensa que indica su infobox
  const bounty = list.map((e, i) => [i, e]).filter(([i]) => tipo(i) === 'personaje' && !list[i].id.includes('/')).map(([i, e]) => { const v = field(e, 'recompensa'); if (!v) return null; const nums = [...v.matchAll(/\d{1,3}(?:\.\d{3})+/g)].map((m) => +m[0].replace(/\./g, '')).filter((n) => n >= 1e6); return nums.length ? [i, Math.max(...nums)] : null; }).filter(Boolean).sort((a, b) => b[1] - a[1]).slice(0, 300);
  emit('rank', { bounty });

  // ---- personajes: grupo principal (organización), mar de origen y rol, para filtrar, agrupar y mostrar subconjuntos
  const ROLES = ['Yonkou y su círculo', 'Shichibukai', 'Marina', 'Revolucionarios', 'Gobierno Mundial', 'Cazarrecompensas', 'Samuráis y ninjas', 'Piratas', 'Realeza y nobles', 'Civiles y otros'];
  const ROLE_RULES = [[0, /Cuatro Emperadores|Yonkou/i], [1, /Señores de la Guerra del Mar|Shichibukai/i], [2, /\bMarina\b|Marines|almirante|Comodoro|Oficiales de la Marina/i], [3, /Revolucionari/i], [4, /Gobierno Mundial|Cipher Pol|\bCP\d|Gorousei|Dragones? Celestiales|Cinco Ancianos/i], [5, /Cazarrecompensas/i], [6, /Samur[aá]is?|Ninjas?/i], [7, /Piratas|Supernovas|Capitanes pirata/], [8, /Realeza|Reyes|Reinas|Príncipes|Princesas|Nobles/i]];
  const roleOf = (e) => { const txt = e.cats.join(' | ') + ' | ' + (field(e, 'posicion') ?? '') + ' | ' + (field(e, 'organizacion') ?? ''); for (const [k, re] of ROLE_RULES) if (re.test(txt)) return k; return 9; };
  const charRows = list.map((_, i) => i).filter((i) => tipo(i) === 'personaje' && !list[i].id.includes('/'));
  const primaryOrg = (i) => relsOf[i].filter(([r, j, d]) => (relNames[r] === 'miembro_de' || relNames[r] === 'capitan_de') && d === 0 && tipo(j) === 'organizacion').sort((a, b) => imp[b[1]] - imp[a[1]])[0]?.[1] ?? -1;
  const originSea = (i) => { for (const rel of ['originario_de', 'reside_en']) for (const [r, j, d] of relsOf[i]) if (relNames[r] === rel && d === 0 && seaOf.has(j) && seaOf.get(j) !== 10) return seaOf.get(j); return -1; };
  const orgOfChar = new Map(charRows.map((i) => [i, primaryOrg(i)]));
  const orgCount = new Map(); for (const o of orgOfChar.values()) if (o >= 0) orgCount.set(o, (orgCount.get(o) ?? 0) + 1);
  const orgsKept = [...orgCount].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 160); const keptSet = new Set(orgsKept.map(([o]) => o));
  const omap = new Map(); for (const c of charRows) for (const [r, j, d] of relsOf[c]) if ((relNames[r] === 'miembro_de' || relNames[r] === 'capitan_de') && d === 0 && tipo(j) === 'organizacion') { if (!omap.has(j)) omap.set(j, new Set()); omap.get(j).add(c); }
  const om = [...omap].map(([o, set]) => [o, [...set]]);
  emit('chars', { roles: ROLES, seas: SEAS, orgs: orgsKept, om, c: charRows.map((i) => [i, keptSet.has(orgOfChar.get(i)) ? orgOfChar.get(i) : -1, originSea(i), roleOf(list[i])]) });
  console.log(`personajes: ${charRows.length} con grupo/mar/rol; ${orgsKept.length} organizaciones con ≥3 miembros; ${charRows.filter((i) => keptSet.has(orgOfChar.get(i))).length} con organización`);

  const placed = places.filter((p) => p[1] !== 10).length;
  const stats = { fichas: list.filter((_, i) => !rootOf.has(i)).length, relaciones: edges.length, tipos: Object.fromEntries(TYPES.map((t) => [t, list.filter((_, i) => tipo(i) === t).length])), generado: new Date().toISOString(), calidad: quality };
  // novedades de la wiki (creado / editado / movido / eliminado) y fecha de la última sincronización
  const sync = existsSync('data/sync.json') ? JSON.parse(readFileSync('data/sync.json', 'utf8')) : {};
  const novedades = existsSync('data/novedades.json') ? JSON.parse(readFileSync('data/novedades.json', 'utf8')) : [];
  const actualizado = sync.ultimaActualizacion ?? sync.ultima ?? stats.generado;
  stats.actualizado = actualizado; stats.sincronizado = sync.ultima ?? null;
  const entradas = novedades.slice().reverse().map((x) => { const id = x.t === 'x' ? undefined : resolve(x.n); const i = id !== undefined && idx.has(id) ? idx.get(id) : undefined; return { d: x.d, t: x.t, n: x.n, ...(i !== undefined ? { i } : {}), ...(x.m ? { m: x.m } : {}) }; });
  // aristas tipadas (sin las débiles) para el buscador de caminos «¿cómo se relaciona X con Y?»
  { const clase = (k) => (k.startsWith('regla:') ? 'regla' : /^(ib:|sec|titulo:|tpl|texto:)/.test(k) ? 'directa' : 'debil'); const por = {}; for (const [, , r, ev] of edges) { const c = WEAK.has(relNames[r]) ? 'debil' : clase(evTable[ev]); (por[relNames[r]] ??= { total: 0, directa: 0, regla: 0, debil: 0 }); por[relNames[r]].total++; por[relNames[r]][c]++; } writeFileSync('data/relaciones-stats.json', JSON.stringify({ total: edges.length, sinRespaldoRetiradas: globalThis.__sinRespaldo ?? 0, evidencias: evTable, porRelacion: por }, null, 1)); }
  emit('edges', { rels: relNames, e: edges.filter((x) => !WEAK.has(relNames[x[2]])).flatMap((x) => [x[0], x[1], x[2], x[3] ?? 0]) });
  emit('news', { actualizado, n: entradas });
  emit('meta', stats);
  console.log(`web: ruta ${route.length} arcos, índice ${list.length}, destacados ${fl.length}, sagas ${timeline.sagas.length}, arcos ${timeline.sagas.reduce((a, s) => a + s.arcs.length, 0)} (+${timeline.sueltos.length} sueltos, ${timeline.noCanon.length} no canon), películas ${timeline.pelis.length}, lugares ${places.length} (${placed} ubicados en un mar)`);
  return { edges, relNames, imp };
}
