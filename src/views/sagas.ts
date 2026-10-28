// «Sagas»: el viaje de los Sombreros de Paja saga a saga y arco a arco, con portada de cada tramo y lo que aparece en él.
// Eje = capítulos del manga (no se inventan fechas): se muestran los rangos y los años de publicación que da la wiki.
import { IMGS, shipSvg, avatarHtml, ensureImgs, ensureIndex, esc, imgUrl, loadData, nameOf, richText, typeOf } from '../data';
import type { View } from './view';

interface Arc { i: number; n: string; ca: string | null; ep: string | null; fe: string | null; r: string; tot: Record<string, number>; g: Record<string, number[]>; saga: number | null; enf?: number }
interface Saga { i: number; n: string; ca: string | null; ep: string | null; fe: string | null; r: string; arcs: Arc[] }
interface Timeline { sagas: Saga[]; noCanon: Arc[]; sueltos: Arc[]; pelis: { i: number; n: string; y: number; r: string }[]; eventos: number[] }

const GROUPS: [string, string][] = [['lugares', 'Lugares'], ['personajes', 'Personajes'], ['antagonistas', 'Antagonistas'], ['frutas', 'Frutas del Diablo'], ['barcos', 'Barcos'], ['organizaciones', 'Organizaciones y tripulaciones'], ['tecnicas', 'Técnicas']];
const rng = (s: string | null) => { const m = (s ?? '').match(/(\d+)\s*[-–]\s*(\d+)/); return m ? `${m[1]}–${m[2]}` : (s ?? '').match(/(\d+)/)?.[1] ?? ''; };
const years = (s: string | null) => { const m = (s ?? '').match(/(\d{4})\s*[-–]\s*(\d{4})|(\d{4})/); return m ? (m[1] ? `${m[1]}–${m[2]}` : m[3]!) : ''; };
const short = (n: string) => n.replace(/^(Saga|Arco) (de la |de los |de las |del |de )?/i, '').replace(/^(la|el|los|las) /i, (m) => m.toLowerCase() === m ? '' : m).replace(/^./, (c) => c.toUpperCase());
const cover = (i: number, w = 700) => (IMGS?.[i] ? imgUrl(IMGS[i]!, w) : '');
const tile = (i: number) => `<a class="tile ilink" href="#/ficha/${encodeURIComponent(nameOf(i))}" data-i="${i}" title="${esc(nameOf(i))}">${avatarHtml(i, 54)}<span>${esc(nameOf(i))}</span></a>`;
const coverHtml = (i: number, cls: string, label: string) => `<div class="${cls}" ${cover(i) ? '' : 'data-empty'}>${cover(i) ? `<img src="${esc(cover(i))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<span class="cv-ini" aria-hidden="true">${esc(short(label).slice(0, 2).toUpperCase())}</span></div>`;

function arcHtml(a: Arc, n: number, nc = false) {
  const strip = [...(a.g.lugares ?? []).slice(0, 4), ...(a.g.personajes ?? []).slice(0, 4), ...(a.g.frutas ?? []).slice(0, 2)].slice(0, 9);
  const groups = GROUPS.filter(([k]) => (a.g[k]?.length ?? 0) > 0).map(([k, label]) => {
    const ids = a.g[k]!, extra = (a.tot[k] ?? ids.length) - ids.length;
    return `<section class="grp2"><h4>${label} <b>${a.tot[k] ?? ids.length}</b></h4><div class="tiles">${ids.map(tile).join('')}${extra > 0 ? `<a class="tile more ilink" href="#/ficha/${encodeURIComponent(a.n)}" data-i="${a.i}" data-full><span class="plus">+${extra}</span><span>en la ficha del arco</span></a>` : ''}</div></section>`;
  }).join('');
  const meta = [a.ca ? `Caps. ${rng(a.ca)}` : '', a.ep ? `Episodios ${rng(a.ep)}` : '', years(a.fe)].filter(Boolean);
  return `<li class="arc-card reveal" data-arc="${a.i}">${coverHtml(a.i, 'arc-cv', a.n)}
    <div class="arc-body"><p class="arc-num">${nc ? 'No canon' : `Arco ${n + 1}`}</p><h3>${esc(a.n)}</h3><p class="when2">${meta.join(' · ')}</p>
    <p class="sum">${richText(a.r) || '<em>Sin resumen.</em>'}</p>
    ${strip.length ? `<div class="strip" aria-label="Algunos de los que aparecen">${strip.map((i) => `<a class="ilink" href="#/ficha/${encodeURIComponent(nameOf(i))}" data-i="${i}" title="${esc(nameOf(i))}">${avatarHtml(i, 38)}</a>`).join('')}</div>` : ''}
    <div class="acts"><button class="btn small ghost" data-expand="arc-${a.i}" aria-expanded="false" aria-controls="arc-${a.i}">Qué aparece en este arco ▾</button><button class="btn small" data-open="${a.i}" data-full>Ficha del arco</button>${a.enf !== undefined ? `<button class="btn small ghost" data-open="${a.enf}">Enfrentamientos</button>` : ''}</div>
    <div class="fold" id="arc-${a.i}" hidden><div class="fold-in">${groups || '<p class="hint">La wiki no enlaza aún personajes ni lugares a este arco.</p>'}</div></div></div></li>`;
}

export class SagasView implements View {
  private root!: HTMLElement; private tl!: Timeline; private io?: IntersectionObserver; private onScroll?: () => void; private scroller: HTMLElement | null = null;
  async mount(host: HTMLElement) {
    const box = document.createElement('div'); box.className = 'sagas-wrap'; host.append(box); this.root = box;
    box.innerHTML = '<div class="page"><p class="loading">Cargando sagas…</p></div>';
    [this.tl] = await Promise.all([loadData<Timeline>('timeline'), ensureIndex(), ensureImgs()]);
    this.render();
    box.addEventListener('click', (e) => this.onClick(e));
    this.setupMotion();
  }
  unmount() { this.io?.disconnect(); if (this.scroller && this.onScroll) this.scroller.removeEventListener('scroll', this.onScroll); this.root.remove(); }

  // un único manejador por montaje: despliegues de sagas y arcos, interruptor de extras y ruta del viaje
  private onClick(e: Event) {
    const t = e.target as HTMLElement;
    const ex = t.closest<HTMLElement>('[data-expand]');
    if (ex) { e.preventDefault(); this.setOpen(ex, ex.getAttribute('aria-expanded') !== 'true'); return; }
    const jump = t.closest<HTMLElement>('[data-jump]');
    if (jump) { e.preventDefault(); const target = this.root.querySelector<HTMLElement>(`#${jump.dataset.jump}`); target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }
  }
  private setOpen(btn: HTMLElement, open: boolean) {
    const id = btn.dataset.expand!, box = this.root.querySelector<HTMLElement>(`#${id}`); if (!box) return;
    box.hidden = !open; box.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open));
    const label = btn.dataset.label; if (label) btn.textContent = open ? 'Ocultar los arcos ▴' : label; else btn.textContent = open ? 'Ocultar lo que aparece ▴' : 'Qué aparece en este arco ▾';
    if (open) box.querySelectorAll<HTMLElement>('.reveal').forEach((r) => r.classList.add('in'));
  }
  private render() {
    const { sagas, noCanon, sueltos, pelis, eventos } = this.tl;
    const recent = sueltos.filter((a) => a.ca);
    const sagaHtml = (s: Saga, n: number) => {
      const totals = s.arcs.reduce((acc, a) => { for (const [k, v] of Object.entries(a.tot)) acc[k] = (acc[k] ?? 0) + v; return acc; }, {} as Record<string, number>);
      const chips = [['arcos', s.arcs.length], ['lugares', totals.lugares], ['personajes', (totals.personajes ?? 0) + (totals.antagonistas ?? 0)], ['frutas', totals.frutas]].filter(([, v]) => v).map(([k, v]) => `<span class="stat"><b>${v}</b> ${k}</span>`).join('');
      return `<li class="saga reveal" id="saga-${s.i}" data-saga="${s.i}">
        <div class="saga-hero" ${cover(s.i) ? '' : 'data-empty'}>${cover(s.i, 1000) ? `<img src="${esc(cover(s.i, 1000))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<div class="saga-shade"></div>
          <div class="saga-txt"><span class="saga-n">Saga ${n + 1}</span><h2>${esc(s.n)}</h2><p class="when2">${[rng(s.ca) ? `Capítulos ${rng(s.ca)}` : '', years(s.fe)].filter(Boolean).join(' · ')}</p></div></div>
        <div class="saga-body"><p class="sum">${richText(s.r) || '<em>Sin resumen.</em>'}</p>${chips ? `<p class="stats">${chips}</p>` : ''}
          <p class="acts"><button class="btn" data-open="${s.i}" data-full>Ficha de la saga</button>${s.arcs.length ? `<button class="btn ghost" data-expand="arcs-${s.i}" data-label="Ver los ${s.arcs.length} arcos ▾" aria-expanded="false" aria-controls="arcs-${s.i}">Ver los ${s.arcs.length} arcos ▾</button>` : ''}</p>
          ${s.arcs.length ? `<div class="fold" id="arcs-${s.i}" hidden><div class="fold-in"><ol class="arc-grid">${s.arcs.map((a, k) => arcHtml(a, k)).join('')}</ol></div></div>` : ''}</div></li>`;
    };
    const routeHtml = `<nav class="route" aria-label="Ruta del viaje: ir a una saga"><div class="route-line" aria-hidden="true"><span class="ship" id="ship" role="img" aria-label="Barco de la tripulación"><span class="sh m on">${shipSvg('merry')}</span><span class="sh s">${shipSvg('sunny')}</span></span></div><ol>${sagas.map((s, n) => `<li><a href="#saga-${s.i}" data-jump="saga-${s.i}"><span class="stop">${n + 1}</span><span class="stop-n">${esc(short(s.n))}</span><small>${rng(s.ca) ? 'Cap. ' + rng(s.ca).split('–')[0] : ''}</small></a></li>`).join('')}${recent.length ? '<li><a href="#recent" data-jump="recent"><span class="stop">★</span><span class="stop-n">Ahora</span><small>en curso</small></a></li>' : ''}</ol></nav>`;
    const recentHtml = recent.length ? `<li class="saga now reveal" id="recent"><div class="saga-hero" data-empty><div class="saga-shade"></div><div class="saga-txt"><span class="saga-n">Ahora</span><h2>Arcos más recientes</h2><p class="when2">Aún sin saga asignada en la wiki</p></div></div><div class="saga-body"><div class="arc-grid-wrap"><ol class="arc-grid">${recent.map((a, k) => arcHtml(a, k)).join('')}</ol></div></div></li>` : '';
    this.root.innerHTML = `<div class="page sagas"><nav class="crumbs" aria-label="Migas de pan"><a href="#/">Inicio</a><span>›</span><span aria-current="page">Sagas</span></nav>
      <header class="page-head"><h1>Sagas: el viaje de los Sombreros de Paja</h1><p>Saga a saga y arco a arco, en el orden del manga. Abre una saga para ver sus arcos y, en cada arco, los lugares, personajes, frutas y barcos que aparecen. Cualquier nombre abre su ficha.</p>
      <label class="switch"><input type="checkbox" id="extra"><span class="knob"></span> Mostrar también películas, especiales y arcos no canon</label></header>
      ${routeHtml}
      <ol class="voyage">${sagas.map(sagaHtml).join('')}${recentHtml}</ol>
      <section id="extras" hidden><h2 class="sec">Películas y especiales</h2><ol class="film-grid">${pelis.filter((p) => p.y > 0).map((p) => `<li class="film reveal">${coverHtml(p.i, 'film-cv', p.n)}<div><b>${esc(p.n)}</b><small>${p.y}</small><p>${richText(p.r)}</p><button class="btn small ghost" data-open="${p.i}" data-full>Ver ficha</button></div></li>`).join('')}</ol>
      <h2 class="sec">Arcos no canon</h2><ol class="arc-grid">${noCanon.map((a, k) => arcHtml(a, k, true)).join('')}</ol></section>
      <section><h2 class="sec">Eventos y operaciones</h2><p class="hint">La wiki no les da fecha ni orden; se listan por importancia.</p><div class="tiles">${eventos.map(tile).join('')}</div></section>
      <p class="foot-p">Texto de One Piece Wiki (Fandom), CC BY-SA. Sagas y arcos ordenados por el capítulo de inicio.</p></div>`;
    (this.root.querySelector('#extra') as HTMLInputElement).addEventListener('change', (e) => { (this.root.querySelector('#extras') as HTMLElement).hidden = !(e.target as HTMLInputElement).checked; });
  }

  // animación de aparición al hacer scroll y barco que avanza por la ruta (se desactiva con prefers-reduced-motion)
  private setupMotion() {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveals = this.root.querySelectorAll<HTMLElement>('.reveal');
    if (still || !('IntersectionObserver' in window)) reveals.forEach((r) => r.classList.add('in'));
    else { this.io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); this.io?.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' }); reveals.forEach((r) => this.io!.observe(r)); }
    this.scroller = document.getElementById('view');
    const ship = this.root.querySelector<HTMLElement>('#ship'), line = this.root.querySelector<HTMLElement>('.route-line'), stops = [...this.root.querySelectorAll<HTMLElement>('.voyage > li')];
    if (!this.scroller || !ship || !line) return;
    const tbIdx = Math.max(0, this.tl.sagas.findIndex((s: { n: string }) => /Thriller Bark/i.test(s.n)));
    this.onScroll = () => {
      const top = this.scroller!.getBoundingClientRect().top; let idx = 0;
      stops.forEach((s, k) => { if (s.getBoundingClientRect().top - top < this.scroller!.clientHeight * 0.4) idx = k; });
      const pct = stops.length > 1 ? idx / (stops.length - 1) : 0; ship.style.left = `calc(${(pct * 100).toFixed(1)}% - 20px)`; const sunny = idx >= tbIdx; ship.querySelector('.m')!.classList.toggle('on', !sunny); ship.querySelector('.s')!.classList.toggle('on', sunny); ship.setAttribute('aria-label', sunny ? 'Thousand Sunny' : 'Going Merry');
      this.root.querySelectorAll('.route li a').forEach((a, k) => a.classList.toggle('on', k === idx));
    };
    this.scroller.addEventListener('scroll', this.onScroll, { passive: true }); this.onScroll();
  }
  focus(i: number | null) {
    if (i === null) return; const ty = typeOf(i); if (ty !== 'saga' && ty !== 'arco') return;
    const target = this.root.querySelector<HTMLElement>(ty === 'saga' ? `#saga-${i}` : `[data-arc="${i}"]`); target?.scrollIntoView({ block: 'start' });
  }
}
