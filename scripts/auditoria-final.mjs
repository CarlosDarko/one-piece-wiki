// Auditoría de datos publicados (sin red): node scripts/auditoria-final.mjs  ->  data/auditoria-final.md
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const load = (n) => JSON.parse(readFileSync(`public/data/${n}.js`, 'utf8').replace(/^__od\("[^"]+",/, '').replace(/\);?\s*$/, ''));
const idx = load('index'), imgs = load('imgs'), edges = load('edges'), places = load('places');
const N = idx.n.length, T = (i) => idx.types[idx.t[i]];
const roots = []; for (let i = 0; i < N; i++) if (!idx.sub.some && true) roots.push(i);
const subs = new Set(idx.sub.map(([s]) => s)); const isRoot = (i) => !subs.has(i) && T(i) !== 'meta';
const por = {}; const add = (t, k) => { por[t] ??= { fichas: 0, sinImagen: 0, sinResumen: 0, sinRelacion: 0 }; por[t][k]++; };
const conRel = new Set(); for (let k = 0; k < edges.e.length; k += 3) { conRel.add(edges.e[k]); conRel.add(edges.e[k + 1]); }
const resumen = new Set(); for (let s = 0; s < 64; s++) { const f = `public/data/detail/${s}.js`; if (!existsSync(f)) continue; const t = readFileSync(f, 'utf8'); const o = JSON.parse(t.slice(t.indexOf(',') + 1, t.lastIndexOf(')'))); for (const k in o) if (o[k].r && o[k].r.length > 40) resumen.add(+k); }
for (let i = 0; i < N; i++) { if (!isRoot(i)) continue; const t = T(i); add(t, 'fichas'); if (!imgs[i]) add(t, 'sinImagen'); if (!resumen.has(i)) add(t, 'sinResumen'); if (!conRel.has(i)) add(t, 'sinRelacion'); }
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); const seen = new Map(), dup = []; for (let i = 0; i < N; i++) { if (!isRoot(i)) continue; const k = norm(idx.n[i]); if (seen.has(k)) dup.push(idx.n[i] + ' / ' + idx.n[seen.get(k)]); else seen.set(k, i); }
const bad = []; for (let k = 0; k < edges.e.length; k += 3) if (edges.e[k] >= N || edges.e[k + 1] >= N) bad.push(k);
const rows = Object.entries(por).sort((a, b) => b[1].fichas - a[1].fichas);
const md = `# Auditoría final de datos

Generada ${new Date().toISOString()}. Fichas raíz (sin subpáginas ni páginas meta): ${rows.reduce((a, [, v]) => a + v.fichas, 0)}. Relaciones tipadas publicadas: ${edges.e.length / 3}. Lugares en la carta: ${places.p.length}.

| Tipo | Fichas | Sin imagen | Sin resumen | Sin ninguna relación estructurada |
|---|---:|---:|---:|---:|
${rows.map(([t, v]) => `| ${t} | ${v.fichas} | ${v.sinImagen} | ${v.sinResumen} | ${v.sinRelacion} |`).join('\n')}

- Relaciones con extremos fuera de rango: ${bad.length}.
- Nombres duplicados tras normalizar tildes y mayúsculas: ${dup.length}${dup.length ? ' (' + dup.slice(0, 8).join('; ') + ')' : ''}.
- Las imágenes proceden de Fandom: a navegadores automatizados les responde 403, por lo que las pruebas usan retratos sintéticos; en un navegador normal cargan. Cuando falla una imagen se muestran iniciales con el color del tipo.

## Revisión de interfaz y datos (escritorio y móvil)
Hallado y corregido en esta tanda:
- Etiquetas absurdas («Doblado por» → película, «Clase» → página genérica, «Come», «Miembro de» desde lugares y barcos): matriz de tipos origen/destino, reclasificación (sede/base, barco usado) y descarte (2.346 enlaces), con regresión sobre todos los datos.
- Relaciones ausentes (familia, compañeros, enfrentamientos) y «Combatientes» con Haki/frutas.
- Concordancia de género y número en etiquetas; «Epíteto» → «Alias».
- Textos cortados (puntos suspensivos y recortes) en 6 tamaños × 10 vistas; título de ficha partido en móvil («Marinefor-d»).
- Lienzo del grafo: del ~50 % al 70–87 % del viewport (filtros en popover, franja única, ficha plegable, pantalla completa).
- Marcador del buscador cortado en móvil; cifra de fichas coherente entre portada y biblioteca (7.343).
- Aviso de spoilers destacado; galerías en mosaico con visor; datos clave con viñetas y enlaces; tema pergamino/noche con selector.
Pendiente o limitado (honesto):
- 854 personajes (37 %) sin primera aparición registrada por la wiki; ~262 personajes sin relación estructurada.
- Enfrentamientos solo donde la wiki describe bandos (infobox o títulos «A vs. B»); faltan combates como Luffy–Kaidou o Zoro–Mihawk.
- Imágenes: dependen de Fandom (403 a navegadores automatizados); no se ha podido validar con fotos reales en las pruebas automáticas.
- Tarea programada de Windows y workflows de GitHub Actions a la espera de la decisión directa del propietario.
- Cobertura de artículos: ver data/informe-cobertura.md. Relaciones: data/auditoria-relaciones.md. Género: data/auditoria-genero.md. Agrupaciones: data/auditoria-agrupaciones.md.
`;
writeFileSync('data/auditoria-final.md', md); console.log(md);
