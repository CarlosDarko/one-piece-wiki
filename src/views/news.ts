// «Novedades»: lo que ha cambiado en la wiki (fichas nuevas, editadas, movidas y eliminadas) en los últimos 90 días.
import { ensureIndex, esc, fmtN, loadData, nameOf } from '../data';
import type { View } from './view';

interface NewsEntry { d: string; t: 'n' | 'e' | 'm' | 'x'; n: string; i?: number; m?: string }
interface News { actualizado: string; n: NewsEntry[] }
const TIPOS: Record<string, [string, string]> = { n: ['Nuevas', 'Ficha nueva'], e: ['Editadas', 'Editada'], m: ['Movidas o renombradas', 'Renombrada'], x: ['Eliminadas', 'Eliminada'] };
const fechaLarga = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export class NewsView implements View {
  private root!: HTMLElement; private filtro = new Set(['n', 'e', 'm', 'x']); private data!: News;
  async mount(host: HTMLElement) {
    const box = document.createElement('div'); box.className = 'news'; host.append(box); this.root = box;
    box.innerHTML = '<div class="page"><p class="loading">Cargando novedades…</p></div>';
    [this.data] = await Promise.all([loadData<News>('news'), ensureIndex()]);
    this.render();
    box.addEventListener('click', (e) => { const c = (e.target as HTMLElement).closest<HTMLInputElement>('input[data-t]'); if (c) { c.checked ? this.filtro.add(c.dataset.t!) : this.filtro.delete(c.dataset.t!); this.list(); } });
  }
  unmount() { this.root.remove(); }
  focus() { /* sin fichas */ }
  private render() {
    const { actualizado, n } = this.data; const cuenta = { n: 0, e: 0, m: 0, x: 0 }; for (const x of n) cuenta[x.t]++;
    this.root.innerHTML = `<div class="page"><nav class="crumbs" aria-label="Migas de pan"><a href="#/">Inicio</a><span>›</span><span aria-current="page">Novedades</span></nav>
      <header class="page-head"><h1>Novedades de la wiki</h1><p>La One Piece Wiki cambia a diario. Esto es lo que se ha creado, editado, renombrado o eliminado desde que este atlas la sigue (se guardan los últimos 90 días). <b>Última actualización:</b> <time datetime="${esc(actualizado)}">${esc(new Date(actualizado).toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' }))}</time>.</p></header>
      <fieldset class="news-filters"><legend class="sr">Tipos de cambio</legend>${(['n', 'e', 'm', 'x'] as const).map((t) => `<label class="chk"><input type="checkbox" data-t="${t}" checked> ${TIPOS[t]![0]} <b>${fmtN(cuenta[t])}</b></label>`).join('')}</fieldset>
      <div id="news-list"></div>
      <p class="foot-p">Texto y cambios de One Piece Wiki en español (Fandom), CC BY-SA. Los cambios se detectan con la API pública de la wiki y se aplican al atlas en cada sincronización; una edición puede tardar en verse aquí hasta la siguiente.</p></div>`;
    this.list();
  }
  private list() {
    const rows = this.data.n.filter((x) => this.filtro.has(x.t)); const el = this.root.querySelector('#news-list')!;
    if (!rows.length) { el.innerHTML = `<p class="hint">${this.data.n.length ? 'Ningún cambio del tipo elegido.' : 'Todavía no hay cambios registrados desde la primera descarga. Aparecerán aquí tras la próxima sincronización.'}</p>`; return; }
    const by = new Map<string, NewsEntry[]>(); for (const r of rows) (by.get(r.d) ?? by.set(r.d, []).get(r.d)!).push(r);
    el.innerHTML = [...by.entries()].map(([d, items]) => `<section class="news-day"><h2>${esc(fechaLarga(d))} <small>${fmtN(items.length)} cambio${items.length === 1 ? '' : 's'}</small></h2><ul>${items.map((x) => `<li class="t-${x.t}"><span class="badge-t">${esc(TIPOS[x.t]![1])}</span> ${x.i !== undefined ? `<a class="ilink" href="#/ficha/${encodeURIComponent(nameOf(x.i))}" data-i="${x.i}" data-full>${esc(x.n)}</a>` : `<span class="gone">${esc(x.n)}</span>`}${x.m ? ` <small>antes «${esc(x.m)}»</small>` : ''}</li>`).join('')}</ul></section>`).join('');
  }
}
