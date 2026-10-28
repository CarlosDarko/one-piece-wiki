// Comprobación de cobertura: compara las cifras de la wiki (API: estadísticas y lista de páginas) con lo descargado en data/pages.
//   node scripts/cobertura.mjs        -> escribe data/informe-cobertura.md y termina con código 2 si falta algo
// ≤1 petición/s, User-Agent neutro (wiki-api.mjs). También se ejecuta al final de scripts/actualizar.mjs.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { api, cacheFile, readJson } from './wiki-api.mjs';

export async function cobertura({ quiet = false } = {}) {
  const info = await api({ action: 'query', meta: 'siteinfo', siprop: 'statistics' }); const st = info.query.statistics;
  const listar = async (filtro) => { const out = []; let cont = {}; for (;;) { const r = await api({ action: 'query', list: 'allpages', apnamespace: '0', apfilterredir: filtro, aplimit: '500', ...cont }); out.push(...r.query.allpages.map((p) => p.title)); if (r.continue) cont = r.continue; else break; } return out; };
  const reales = await listar('nonredirects'), redirs = await listar('redirects');
  const urls = existsSync('data/urls_ns0.txt') ? readFileSync('data/urls_ns0.txt', 'utf8').split('\n').filter(Boolean) : [];
  const state = readJson('data/state.json', {});
  const falta = reales.filter((t) => !existsSync(cacheFile(t)));
  const sobran = urls.length - reales.length;
  const rows = [
    ['Artículos según la wiki (statistics.articles)', st.articles], ['Páginas del espacio principal sin redirecciones (API allpages)', reales.length], ['Redirecciones del espacio principal (API allpages)', redirs.length],
    ['Páginas del espacio principal en total (con redirecciones)', reales.length + redirs.length], ['URLs de nuestro índice de rastreo (urls_ns0.txt)', urls.length], ['Páginas descargadas en data/pages', state.hechas ?? '?'],
    ['Faltan por descargar (reales sin caché)', falta.length], ['Páginas con error o aparcadas en el último rastreo', (state.errors ? Object.keys(state.errors).length : 0) + (state.aparcadas?.length ?? 0)],
  ];
  const md = `# Informe de cobertura\n\nGenerado ${new Date().toISOString()}.\n\n| Concepto | Cifra |\n|---|---:|\n${rows.map(([a, b]) => `| ${a} | ${b} |`).join('\n')}\n\n- La cifra «Artículos» de Fandom cuenta páginas de contenido (no redirecciones) y puede incluir páginas aún sin enlazar; nuestra lista sale de allpages sin redirecciones.\n- Diferencia entre el índice de rastreo y las páginas reales: ${sobran} (la portada «One Piece Wiki» y similares se descargan aunque no sean fichas).\n- Las fichas publicadas en la web son menos que las páginas descargadas: se excluyen páginas meta/técnicas, y las subpáginas (Historia, Apariencia…) se integran en la ficha principal.\n${falta.length ? `\n## Faltan\n\n${falta.slice(0, 80).map((t) => `- ${t}`).join('\n')}\n` : '\nNo falta ninguna página real por descargar.\n'}`;
  writeFileSync('data/informe-cobertura.md', md);
  if (!quiet) console.log(md);
  return { articulos: st.articles, reales: reales.length, redirs: redirs.length, descargadas: state.hechas, falta };
}
if (process.argv[1] && process.argv[1].endsWith('cobertura.mjs')) { const r = await cobertura(); setTimeout(() => process.exit(r.falta.length ? 2 : 0), 300); }
