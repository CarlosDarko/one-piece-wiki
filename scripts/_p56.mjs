import { readFileSync, writeFileSync } from 'node:fs';
let s = readFileSync('src/views/quien.ts', 'utf8'); const rep = (a, b) => { if (!s.includes(a)) throw new Error('no: ' + a.slice(0, 60)); s = s.replace(a, () => b); };
rep("const key = `${x.rel}|${x.dir}`; let g = gm.get(key);", "const key = lab; let g = gm.get(key); // una pastilla por etiqueta visible: «Familia» por ambos sentidos de la relación es una sola");
rep("    await this.renderHome();", "    (window as unknown as { __qGroups: (i: number) => Promise<[string, number[]][]> }).__qGroups = async (i) => (this.buildGroups(i, await getDetail(i))).map((g) => [g.label, g.ids]);\n    await this.renderHome();");
writeFileSync('src/views/quien.ts', s);
let t = readFileSync('scripts/prueba-humo.mjs', 'utf8'); const k = t.indexOf("// ---------- regresión de agrupaciones y relaciones ----------"); if (k < 0) throw new Error('t');
t = t.slice(0, k) + `// ---------- ninguna ficha repite etiqueta de pastilla ni nodos dentro de un grupo ----------
{
  p = await page(); await goto(p, '#/quien'); await p.waitForSelector('#qs'); await sleep(600);
  const bad = await p.evaluate(async () => { const out = []; const n = window.__qCount; for (let i = 0; i < n; i++) { let gs; try { gs = await window.__qGroups(i); } catch { continue; } const seen = new Set(), labs = new Set(); for (const [lab, ids] of gs) { if (labs.has(lab)) out.push(i + ':etiqueta:' + lab); labs.add(lab); for (const j of ids) { if (seen.has(j)) out.push(i + ':nodo:' + j); seen.add(j); } } if (out.length > 20) break; } return out; });
  check('Datos: ninguna ficha tiene dos pastillas con la misma etiqueta ni nodos repetidos (todas las fichas)', bad.length === 0, bad.slice(0, 5).join(' · ')); await p.close();
}
` + t.slice(k); writeFileSync('scripts/prueba-humo.mjs', t);
