import './style.css';
import { ensureIndex, findByTitle, loadData } from './data';
import { interceptLinks, navigateToFicha, parseHash, type ViewId } from './nav';
import { closeQuiet, initPanel, showFicha } from './panel';
import { attachSearch } from './search';
import type { View } from './views/view';
import { CompareView } from './views/compare';
import { FichaView } from './views/ficha';
import { QuienView } from './views/quien';
import { HomeView } from './views/home';
import { LibraryView } from './views/library';
import { NewsView } from './views/news';
import { MethodView } from './views/method';
import { CartaView } from './views/carta';
import { SagasView } from './views/sagas';

const perf = ((window as unknown as { __perf?: Record<string, number> }).__perf ??= {});
document.addEventListener('DOMContentLoaded', () => { perf.dcl = Math.round(performance.now()); });

const TITLES: Record<ViewId, string> = { home: 'One Piece Atlas', quien: 'Quién es quién', sagas: 'Sagas', lugares: 'Los lugares', carta: 'Los lugares', biblioteca: 'La biblioteca', comparar: 'Comparar', metodologia: 'Metodología', ficha: 'Ficha', novedades: 'Novedades' };
const FACTORIES: Record<ViewId, () => View> = { home: () => new HomeView(), quien: () => new QuienView(), sagas: () => new SagasView(), lugares: () => new CartaView(), carta: () => new CartaView(), biblioteca: () => new LibraryView(), comparar: () => new CompareView(), metodologia: () => new MethodView(), ficha: () => new FichaView(), novedades: () => new NewsView() };
const TAB_OF: Record<ViewId, string> = { home: '', quien: 'quien', sagas: 'sagas', lugares: 'lugares', carta: 'lugares', biblioteca: 'biblioteca', comparar: 'comparar', metodologia: 'metodologia', ficha: 'biblioteca', novedades: '' };
let cur: { id: ViewId; view: View } | null = null;
let token = 0;

async function route() {
  const my = ++token, r = parseHash(), root = document.getElementById('view')!;
  if (!cur || cur.id !== r.view) {
    cur?.view.unmount(); cur = null; closeQuiet();
    root.className = `v-${r.view}`; root.innerHTML = ''; root.scrollTop = 0;
    const view = FACTORIES[r.view](); cur = { id: r.view, view };
    document.querySelectorAll<HTMLElement>('#tabs a').forEach((a) => { if (a.dataset.v === TAB_OF[r.view] && TAB_OF[r.view]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.body.classList.remove('nav-open'); document.getElementById('burger')!.setAttribute('aria-expanded', 'false');
    await view.mount(root); if (my !== token) return;
    perf.viewReady = Math.round(performance.now());
  }
  document.title = `${r.ficha ? r.ficha + ' · ' : ''}${TITLES[r.view]} · One Piece Atlas`;
  const view = cur.view;
  if (r.ficha) {
    await ensureIndex(); if (my !== token) return;
    const i = findByTitle(r.ficha);
    if (r.view === 'ficha') { closeQuiet(); view.focus(i ?? null); }
    else if (i !== undefined) { view.focus(i); if (view.noAutoPanel?.() && document.getElementById('panel')!.hidden) closeQuiet(); else await showFicha(i, { canExpand: !!view.canExpand }); } else closeQuiet();
  } else { view.focus(null); closeQuiet(); }
  document.getElementById('view')!.setAttribute('aria-busy', 'false');
}

void loadData<{ actualizado?: string }>('meta').then((m) => { const u = document.getElementById('upd'); if (u && m.actualizado) u.textContent = 'Actualizado el ' + new Date(m.actualizado).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }); });
initPanel();
interceptLinks(document.body);
window.addEventListener('hashchange', () => void route());
document.getElementById('burger')!.addEventListener('click', () => { const o = document.body.classList.toggle('nav-open'); document.getElementById('burger')!.setAttribute('aria-expanded', String(o)); });
void route();
void attachSearch(document.getElementById('q') as HTMLInputElement, document.getElementById('results')!, { onChoose: (i) => navigateToFicha(i), primary: true });

// selector de tema: automático (sigue al sistema) → claro (pergamino) → oscuro (noche)
{
  const btn = document.getElementById('theme'); const names: Record<string, string> = { auto: 'Tema: automático', light: 'Tema: pergamino', dark: 'Tema: noche' };
  const cur = () => document.documentElement.dataset.theme ?? 'auto'; const paint = () => { if (btn) btn.textContent = names[cur()]!; };
  btn?.addEventListener('click', () => { const nx = cur() === 'auto' ? 'light' : cur() === 'light' ? 'dark' : 'auto'; if (nx === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = nx; try { if (nx === 'auto') localStorage.removeItem('opa-theme'); else localStorage.setItem('opa-theme', nx); } catch { /* sin almacenamiento */ } paint(); });
  paint();
}

// en pantallas estrechas el marcador del buscador es más corto para que no se corte
{ const q = document.getElementById('q') as HTMLInputElement | null; const fit = () => { if (q) q.placeholder = window.innerWidth < 720 ? 'Busca personajes, lugares, frutas…' : 'Busca cualquier personaje, lugar, fruta, barco…   ( / o Ctrl+K )'; }; fit(); window.addEventListener('resize', fit); }
