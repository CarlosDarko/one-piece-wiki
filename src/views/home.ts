// Portada: qué es esto y por dónde empezar, en cinco segundos, según lo que busque quien consulta One Piece.
import { ensureIndex, esc, findByTitle, fmtN, loadData } from '../data';
import { go, navigateToFicha } from '../nav';
import { attachSearch } from '../search';
import type { View } from './view';

const EXAMPLES = ['Monkey D. Luffy', 'Fruta Gomu Gomu', 'Marineford', 'Going Merry', 'Piratas de Sombrero de Paja', 'Saga de Arabasta'];
const SHORTCUTS: [string, string, string][] = [['Personajes', '#/biblioteca?t=personaje', '¿Quién es…?'], ['Tripulaciones y organizaciones', '#/quien/Piratas%20de%20Sombrero%20de%20Paja', 'Bandas pirata, Marina…'], ['Frutas del Diablo', '#/quien/Gomu%20Gomu%20no%20Mi', 'Y quién las come'], ['Barcos', '#/quien/Thousand%20Sunny', 'Y sus tripulaciones'], ['Islas y lugares', '#/lugares', 'En el mapa'], ['Recompensas', '#/biblioteca?t=rank:bounty', 'Las más altas'], ['Arcos y sagas', '#/sagas', 'En orden'], ['Frente a frente', '#/comparar', 'Compara dos fichas']];
interface Meta { fichas: number; relaciones: number; tipos: Record<string, number> }

export class HomeView implements View {
  private root!: HTMLElement; private dispose: (() => void) | null = null;
  async mount(host: HTMLElement) {
    const root = document.createElement('div'); root.className = 'home'; host.append(root); this.root = root;
    root.innerHTML = `
      <section class="hero"><div class="hero-in">
        <p class="eyebrow">Atlas interactivo de One Piece</p>
        <h1>Todo el mundo de One Piece, <span>conectado</span>.</h1>
        <p class="lead">Personajes, tripulaciones, frutas del Diablo, barcos, islas y sagas de la One Piece Wiki en español, con sus artículos completos y unidos por sus relaciones. Busca algo o elige por dónde empezar.</p>
        <div class="bigsearch"><span class="mag" aria-hidden="true">⌕</span><input id="hq" type="search" placeholder="Busca un personaje, una fruta, una isla…" autocomplete="off" aria-label="Buscar en las fichas"><div id="hres" class="results" role="listbox" hidden></div></div>
        <p class="try"><span>Prueba con</span><span id="examples"></span></p>
        <p class="stats" id="stats"></p>
      </div></section>
      <section class="paths" aria-label="Secciones">
        <a class="path" href="#/quien"><span class="ico">◉</span><h2>Quién es quién</h2><p>Busca cualquier personaje, lugar, fruta o barco y mira su red de relaciones, con la ficha en el centro.</p><b>Explorar →</b></a>
        <a class="path" href="#/sagas"><span class="ico">⚓</span><h2>Sagas</h2><p>El viaje de los Sombreros de Paja saga a saga y arco a arco, con lo que aparece en cada tramo.</p><b>Recorrer →</b></a>
        <a class="path" href="#/lugares"><span class="ico">✦</span><h2>Los lugares</h2><p>Un mapa esquemático con más de cuatrocientas islas y la ruta del viaje animada.</p><b>Navegar →</b></a>
        <a class="path" href="#/biblioteca"><span class="ico">❡</span><h2>La biblioteca</h2><p>Todas las fichas, con scroll continuo, índice A–Z y filtros por tipo, saga y mar.</p><b>Hojear →</b></a>
      </section>
      <section class="shortcuts"><h2>¿Qué quieres consultar?</h2><ul>${SHORTCUTS.map(([t, h, d]) => `<li><a href="${h}"><b>${esc(t)}</b><small>${esc(d)}</small></a></li>`).join('')}</ul></section>
      <section class="home-news" id="home-news" hidden><h2>Novedades de la wiki</h2><p class="hint" id="home-news-d"></p><ul id="home-news-l"></ul><p><a href="#/novedades">Ver todas las novedades →</a></p></section>
      <section class="steps"><h2>Cómo se usa</h2><ol><li><b>Busca</b> cualquier nombre arriba (también con la tecla <kbd>/</kbd>).</li><li><b>Pulsa un nodo</b> del grafo: se abre su ficha a la derecha y aparecen sus relaciones.</li><li><b>Abre la ficha completa</b> para leer el artículo entero con su índice, y sigue los enlaces de una a otra; los botones ← → recuerdan por dónde has pasado.</li></ol></section>
      <p class="attrib">Contenido de <a href="https://onepiece.fandom.com/es/" target="_blank" rel="noopener">One Piece Wiki en español (Fandom)</a>, licencia <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>. Proyecto no oficial, sin relación con Eiichiro Oda, Shueisha ni Toei. Cada ficha enlaza con su página original y su historial de autores.</p>`;
    void loadData<Meta>('meta').then((m) => { const s = root.querySelector('#stats'); if (s) s.innerHTML = `<b>${fmtN(m.fichas)}</b> fichas · <b>${fmtN(m.relaciones)}</b> relaciones · <b>${fmtN(m.tipos.lugar ?? 0)}</b> lugares · <b>${fmtN(m.tipos.fruta_del_diablo ?? 0)}</b> frutas del Diablo`; });
    this.dispose = await attachSearch(root.querySelector<HTMLInputElement>('#hq')!, root.querySelector('#hres')!, { onChoose: (i) => navigateToFicha(i) });
    await ensureIndex();
    void loadData<{ actualizado: string; n: { d: string; t: string; n: string; i?: number }[] }>('news').then((nw) => { const rows = nw.n.filter((x) => x.i !== undefined && (x.t === 'n' || x.t === 'e' || x.t === 'm')).slice(0, 8); const sec = root.querySelector<HTMLElement>('#home-news'); if (!sec || !rows.length) return; const tag: Record<string, string> = { n: 'Nueva', e: 'Editada', m: 'Renombrada' }; root.querySelector('#home-news-d')!.textContent = 'Última actualización: ' + new Date(nw.actualizado).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) + '.'; root.querySelector('#home-news-l')!.innerHTML = rows.map((x) => `<li><span class="badge-t">${tag[x.t]}</span> <a class="ilink" href="#/ficha/${encodeURIComponent(x.n)}" data-i="${x.i}" data-full>${esc(x.n)}</a></li>`).join(''); sec.hidden = false; });
    root.querySelector('#examples')!.innerHTML = EXAMPLES.map((t) => { const i = findByTitle(t); return i === undefined ? '' : `<a class="chip ilink" href="#/ficha/${encodeURIComponent(t)}" data-i="${i}">${esc(t)}</a>`; }).join('');
    root.querySelector('.paths')!.addEventListener('click', (e) => { const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a.path'); if (a) { e.preventDefault(); go(a.getAttribute('href')!.slice(2) as never); } });
  }
  unmount() { this.dispose?.(); this.root.remove(); }
  focus() { /* la portada no muestra fichas */ }
}
