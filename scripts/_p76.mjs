import { readFileSync, writeFileSync } from 'node:fs';
let s = readFileSync('scripts/emit-web.mjs', 'utf8'); const rep = (a, b) => { if (!s.includes(a)) throw new Error('no: ' + a.slice(0, 60)); s = s.replace(a, () => b); };
rep("const relNames = [...new Set(typed.map((x) => x[2]))];", "const relNames = [...new Set([...typed.map((x) => x[2]), 'enfrenta_a'])];");
rep("if (!bad && m && !list[s].id.includes('/') && !list[t].id.includes('/')) { if (m[0] && !m[0].has(ts)) bad = true; if (m[1] && !m[1].has(tt)) bad = true; }", "if (!bad && m) { if (m[0] && !list[s].id.includes('/') && !m[0].has(ts)) bad = true; if (m[1] && !list[t].id.includes('/') && !m[1].has(tt)) bad = true; }");
rep("combatiente_en: [TS('personaje', 'organizacion', 'animal'), ANY],", "combatiente_en: [TS('personaje', 'organizacion', 'animal'), ANY], companero_de: [TS('personaje', 'organizacion'), TS('personaje', 'organizacion')], enemigo_de: [TS('personaje', 'organizacion'), TS('personaje', 'organizacion')], lado1: [TS('personaje', 'organizacion'), ANY], lado2: [TS('personaje', 'organizacion'), ANY],");
rep("  edges = kept;\n", `  edges = kept;
  // enfrentamientos: A y B son combatientes de bandos opuestos en el mismo combate o arco (campos combatientes1/2 de la infobox)
  { const sides = new Map(); for (const [s, t, r] of edges) { const rn = relNames[r]; if (rn === 'lado1' || rn === 'lado2') { const m = sides.get(t) ?? [new Set(), new Set()]; m[rn === 'lado1' ? 0 : 1].add(s); sides.set(t, m); } }
    const EF = relNames.indexOf('enfrenta_a'); const seen = new Set(); let nEf = 0; const chars = new Set(); const casos = [];
    for (const [ev, [A, B]] of sides) { let n = 0; for (const a of A) for (const b of B) { if (a === b || A.has(b) && B.has(a)) continue; const k = a < b ? a + '|' + b : b + '|' + a; if (seen.has(k) || n++ > 600) continue; seen.add(k); edges.push([a, b, EF]); chars.add(a); chars.add(b); nEf++; } if (casos.length < 5 && A.size && B.size) casos.push(list[ev].id + ': ' + [...A].slice(0, 2).map((i) => list[i].id).join(', ') + ' vs ' + [...B].slice(0, 2).map((i) => list[i].id).join(', ')); }
    edges = edges.filter(([, , r]) => relNames[r] !== 'lado1' && relNames[r] !== 'lado2');
    writeFileSync('data/auditoria-enfrentamientos.md', '# Enfrentamientos derivados\n\nPares de combatientes de bandos opuestos en el mismo combate/arco: ' + nEf + '. Fichas con al menos un enfrentamiento: ' + chars.size + '. Combates con dos bandos: ' + sides.size + '.\n\nSolo se usan los campos combatientes1/combatientes2 de la infobox de cada combate o arco; si una ficha no los tiene, no se inventan bandos.\n\nEjemplos: ' + casos.join(' · ') + '\n'); }
`);
writeFileSync('scripts/emit-web.mjs', s);
