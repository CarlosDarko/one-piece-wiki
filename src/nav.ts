// Enrutado por hash (#/vista/Título?clave=valor): funciona con file:// y permite compartir enlaces por ficha, filtros y comparaciones.
import { nameOf, rootOf } from './data';

export type ViewId = 'home' | 'quien' | 'sagas' | 'lugares' | 'carta' | 'biblioteca' | 'comparar' | 'metodologia' | 'ficha' | 'novedades';
export const VIEW_IDS: ViewId[] = ['home', 'quien', 'sagas', 'lugares', 'carta', 'biblioteca', 'comparar', 'metodologia', 'ficha', 'novedades'];
export interface RouteState { view: ViewId; ficha: string | null; q: URLSearchParams }

import { FEATURES } from './config';
export function parseHash(h = location.hash): RouteState {
  const [path, qs] = h.replace(/^#\/?/, '').split('?');
  const parts = (path ?? '').split('/');
  const first = parts[0] === 'atlas' ? 'quien' : parts[0] === 'carta' ? 'lugares' : parts[0] ?? '';
  const rest = parts.slice(1).join('/');
  let ficha: string | null = null; try { ficha = rest ? decodeURIComponent(rest) : null; } catch { ficha = rest || null; }
  const known = (VIEW_IDS as string[]).includes(first) && (FEATURES.lugares || (first !== 'lugares' && first !== 'carta'));
  return known ? { view: first as ViewId, ficha, q: new URLSearchParams(qs ?? '') } : { view: 'home', ficha: null, q: new URLSearchParams() };
}
export const hashFor = (view: ViewId, ficha?: string | null, q?: URLSearchParams | Record<string, string> | null) => {
  const qs = q ? new URLSearchParams(q as Record<string, string>).toString() : '';
  return `#/${view === 'home' ? '' : view}${ficha ? '/' + encodeURIComponent(ficha) : ''}${qs ? '?' + qs : ''}`;
};
export function go(view: ViewId, ficha?: string | null, q?: URLSearchParams | Record<string, string> | null) {
  const h = hashFor(view, ficha, q);
  if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h;
}
// cambia solo los parámetros de la vista actual, sin añadir entradas al historial
export function setParams(params: Record<string, string | null>) {
  const r = parseHash(); const q = new URLSearchParams(r.q);
  for (const [k, v] of Object.entries(params)) { if (v === null || v === '') q.delete(k); else q.set(k, v); }
  history.replaceState(null, '', hashFor(r.view, r.ficha, q));
}

// abre una ficha: en el grafo, el mapa o la biblioteca se queda donde está (panel lateral); en la ficha completa abre otra ficha completa; desde el resto pasa a «Quién es quién»
export function navigateToFicha(i: number) {
  const cur = parseHash().view; const r = rootOf(i);
  const target: ViewId = cur === 'quien' || cur === 'lugares' || cur === 'carta' || cur === 'biblioteca' || cur === 'ficha' ? cur : 'quien';
  go(target, nameOf(r));
}
export const openFull = (i: number, section?: string | null) => go('ficha', nameOf(rootOf(i)), section ? { s: section } : null);

// los enlaces internos (a.ilink[data-i], [data-open]) navegan sin recargar; los que apuntan a una sección de otra ficha abren la ficha completa
export function interceptLinks(root: HTMLElement) {
  root.addEventListener('click', (ev) => {
    const me = ev as MouseEvent; if (me.ctrlKey || me.metaKey || me.shiftKey || me.button === 1) return;
    const a = (ev.target as HTMLElement).closest<HTMLElement>('a.ilink[data-i], [data-open]');
    if (!a) return;
    ev.preventDefault();
    const i = +(a.dataset.i ?? a.dataset.open ?? -1); if (i < 0) return;
    if (a.dataset.s) openFull(i, a.dataset.s); else if (a.dataset.full !== undefined) openFull(i); else navigateToFicha(i);
  });
}
