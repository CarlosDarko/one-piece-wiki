// Carta náutica de «Los lugares» (en preparación, no enlazada ni publicada): pergamino con rosa de los vientos, monstruos marinos,
// islas con icono propio, ruta numerada por sagas y el barco de la tripulación. Dibujo propio: no reutiliza ningún mapa de Oda.
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { select } from 'd3-selection';
import { IMGS, impOf, ensureImgs, ensureIndex, esc, fmtN, imgUrl, loadData, nameOf, shipSvg } from '../data';
import { navigateToFicha, parseHash, setParams } from '../nav';
import { attachSearch } from '../search';
import type { View } from './view';

interface PlacesData { seas: string[]; kinds: string[]; p: [number, number, number, number, number][]; arcs: { i: number; n: string; s: number }[]; sagas: { i: number; n: string }[]; route: { a: number; p: number }[] }
interface Region { x: number; y: number; w: number; h: number }
interface Marker { i: number; sea: number; kind: number; ch: number; ap: number; x: number; y: number }
const NS = 'http://www.w3.org/2000/svg', W = 1000, OY = 46, H = 782;
const REGIONS: Region[] = [
  { x: 540, y: 20, w: 440, h: 185 }, { x: 20, y: 434, w: 440, h: 191 }, { x: 20, y: 20, w: 290, h: 185 }, { x: 540, y: 434, w: 440, h: 191 }, { x: 20, y: 250, w: 380, h: 138 }, { x: 600, y: 250, w: 380, h: 138 },
  { x: 472, y: 30, w: 56, h: 175 }, { x: 20, y: 210, w: 960, h: 28 }, { x: 320, y: 20, w: 140, h: 185 }, { x: 408, y: 250, w: 184, h: 138 }, { x: 150, y: 640, w: 830, h: 65 },
];
const SEA_NAMES = ['East Blue', 'West Blue', 'North Blue', 'South Blue', 'Paradise', 'Nuevo Mundo', 'Red Line', 'Calm Belt', 'Islas del cielo', 'Grand Line', 'Mares sin ubicar'];
const NOTES = ['', '', '', '', 'Primera mitad de la Grand Line', 'Segunda mitad de la Grand Line', '', '', 'Sobre las nubes', 'Tramo sin precisar', 'La wiki no indica su mar'];
const SAGA_COL = ['#c0392b', '#d97a1f', '#c9a21c', '#5a9a3a', '#2f8f83', '#2f6fb3', '#6a56b8', '#a74f9c', '#b8486b', '#7a5a3a'];
const INK = '#3a2813', PAPER = '#efdcab', SEA = '#8fb3b0';
const SERIF = 'Georgia, "Palatino Linotype", "Book Antiqua", serif';
const el = (tag: string, attrs: Record<string, string | number> = {}, parent?: Element) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); parent?.append(e); return e; };
const hash = (n: number) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const short = (n: string) => n.replace(/^Arco (del? |de la |de los |de las )?/i, '');

// iconos de la carta (dibujados a mano en SVG, ±14 px en pantalla)
const ICON: Record<number, string> = {
  0: `<ellipse cy="5" rx="12" ry="4.5" fill="#e6cf8f" stroke="${INK}" stroke-width="1.3"/><path d="M-1 4 q1 -9 2 -13" stroke="${INK}" stroke-width="1.6" fill="none"/><path d="M1 -9 q-7 -2 -10 3 M1 -9 q7 -3 10 2 M1 -9 q-2 -7 -8 -6 M1 -9 q3 -6 9 -4" stroke="#3c6b2e" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  1: `<path d="M-11 6 V-1 L-6 -6 L-1 -1 V6 Z M0 6 V-5 L5 -10 L10 -5 V6 Z" fill="#f4e4b4" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M-4 6 v-4 h3 v4 M3 6 v-4 h3 v4" fill="${INK}"/>`,
  2: `<path d="M-11 7 V-3 h4 v3 h3 v-3 h4 v3 h3 v-3 h4 V7 Z" fill="#f4e4b4" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M0 -3 V-12 M0 -12 l7 2.5 l-7 2.5" fill="#b3402e" stroke="${INK}" stroke-width="1.2"/><path d="M-3 7 v-5 a3 3 0 0 1 6 0 v5" fill="${INK}"/>`,
  3: `<circle r="8" fill="none" stroke="${INK}" stroke-width="1.3" stroke-dasharray="2 2.5"/><path d="M-5 0 q2.5 -4 5 0 t5 0" fill="none" stroke="#2c5f78" stroke-width="1.6"/>`,
  4: `<circle r="7" fill="#f4e4b4" stroke="${INK}" stroke-width="1.3"/><path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="#b3402e" stroke-width="2" stroke-linecap="round"/>`,
};

const SH = '<ellipse cy="9" rx="14" ry="3.2" fill="#3a2813" fill-opacity=".22"/>';
const ST = `stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"`;
const PALM = (x: number, h: number) => `<path d="M${x} 5 q1 -${h / 2} 2 -${h}" stroke="${INK}" stroke-width="1.7" fill="none"/><path d="M${x + 2} -${h - 5} q-7 -2 -10 3 M${x + 2} -${h - 5} q7 -3 10 2 M${x + 2} -${h - 5} q-2 -7 -8 -6 M${x + 2} -${h - 5} q3 -6 9 -4" stroke="#3c6b2e" stroke-width="2.1" fill="none" stroke-linecap="round"/>`;
const SAND = `<ellipse cy="5" rx="12" ry="4.5" fill="#e6cf8f" ${ST}/><path d="M-8 6 q4 2 8 0 M-3 3.5 h6" stroke="#b8975a" stroke-width=".8" fill="none"/>`;
const ISLANDS: string[][] = [
  [SH + SAND + PALM(-1, 13), SH + SAND + PALM(-5, 11) + PALM(4, 9), `${SH}<path d="M-12 7 q2 -12 12 -13 q10 1 12 13 z" fill="#8fb06a" ${ST}/><path d="M-6 0 l3 -3 M2 -2 l3 -3 M-1 3 h5" stroke="#4d7a3c" stroke-width="1" fill="none"/><circle cx="3" cy="-6" r="2.4" fill="#4d7a3c" stroke="${INK}" stroke-width=".8"/>`],
  [SH + SAND + PALM(-4, 12) + PALM(5, 10), `${SH}<path d="M-12 7 L-5 -8 L-1 -2 L3 -11 L12 7 Z" fill="#b9a073" ${ST}/><path d="M-1 -2 l2 4 M3 -11 l-2 6" stroke="${INK}" stroke-width=".9" fill="none"/>`, `${SH}${SAND}<path d="M3 5 v-14 h5 v14 z" fill="#f4e4b4" ${ST}/><path d="M2 -9 h7 l-2 -4 h-3 z" fill="#b3402e" ${ST}/>`],
  [`${SH}<path d="M-13 7 L-6 -4 L-2 -2 L0 -12 L2 -2 L6 -4 L13 7 Z" fill="#6d5b4a" ${ST}/><path d="M0 -12 q-3 -5 1 -8 q3 -3 0 -6" stroke="#6b6b6b" stroke-width="2" fill="none" opacity=".7"/><path d="M-1 -8 l-2 5 M1 -6 l2 4" stroke="#d9472f" stroke-width="1.4"/>`, `${SH}<path d="M-12 7 q0 -10 6 -12 l3 4 l4 -8 l4 7 l5 -3 q4 4 4 12 z" fill="#4e4458" ${ST}/><path d="M-1 -12 l-3 7 h4 l-2 6" stroke="#f0d34a" stroke-width="1.5" fill="none"/>`],
  [`${SH}<path d="M-14 6 q-4 -8 4 -9 q2 -8 10 -5 q8 -4 11 4 q8 0 5 10 z" fill="#fbf3dc" ${ST}/>${PALM(1, 9)}`],
  [`${SH}<path d="M-12 7 L-8 -6 L-3 -3 L2 -9 L8 -2 L13 7 Z" fill="#c2623f" ${ST}/><path d="M-3 -3 l2 5 M2 -9 l-2 7" stroke="${INK}" stroke-width=".9" fill="none"/>`],
];
const ambient = (sea: number) => (sea === 4 || sea === 9 ? 1 : sea === 5 ? 2 : sea === 8 ? 3 : sea === 6 || sea === 7 || sea === 10 ? 4 : 0);
const iconFor = (kind: number, sea: number, i: number) => { if (kind === 0) { const v = ISLANDS[ambient(sea)]!; return v[Math.floor(hash(i * 31) * v.length)]!; } return SH + (ICON[kind] ?? ICON[0]!); };

export class CartaView implements View {
  private root!: HTMLElement; private svg!: SVGSVGElement; private content!: SVGGElement; private layer!: SVGGElement; private routeG!: SVGGElement; private data!: PlacesData;
  private markers: Marker[] = []; private byI = new Map<number, Marker>(); private zoomB!: ZoomBehavior<SVGSVGElement, unknown>; private z: ZoomTransform = zoomIdentity; private s0 = 1; private bx = 0; private by = 0;
  private bg!: SVGElement; private bleed: SVGPathElement | null = null; private shipG!: SVGGElement; private selected: number | null = null; private raf = 0; private ro?: ResizeObserver; private f = { sea: '', saga: '', kind: '' }; private listMode = false; private disposeSearch: (() => void) | null = null;
  private routePath: SVGPathElement | null = null; private routeLen = 0; private cum: number[] = []; private step = -1; private playing = false; private timer = 0; private ship!: SVGGElement; private shipLen = 0;
  canExpand = false;

  async mount(host: HTMLElement) {
    document.body.classList.add('carta-on'); const root = document.createElement('div'); root.className = 'map-wrap carta'; host.append(root); this.root = root;
    root.innerHTML = '<p class="loading">Desplegando la carta…</p>';
    [this.data] = await Promise.all([loadData<PlacesData>('places'), ensureIndex(), ensureImgs()]);
    const q = parseHash().q; this.f = { sea: q.get('m') ?? '', saga: q.get('s') ?? '', kind: q.get('k') ?? '' }; this.listMode = q.get('l') === '1';
    this.layoutMarkers(); const D = this.data;
    root.innerHTML = `<h1 class="sr">Los lugares: carta náutica del mundo de One Piece</h1><div class="map-bar" id="map-bar" role="search"><div class="picker"><input id="pq" type="search" placeholder="Buscar una isla o región…" aria-label="Buscar un lugar" autocomplete="off"><div id="pres" class="results" role="listbox" hidden></div></div>
      <label class="sel"><span>Mar</span><select id="f-sea"><option value="">Todos</option>${D.seas.map((s, k) => `<option value="${k}">${esc(SEA_NAMES[k] ?? s)}</option>`).join('')}</select></label>
      <label class="sel"><span>Saga</span><select id="f-saga"><option value="">Todas</option>${D.sagas.map((s, k) => `<option value="${k}">${esc(s.n.replace(/^Saga /, ''))}</option>`).join('')}</select></label>
      <label class="sel"><span>Tipo</span><select id="f-kind"><option value="">Todos</option>${D.kinds.map((s, k) => `<option value="${k}">${esc(s)}</option>`).join('')}</select></label>
      <button class="filt-btn" id="filt-btn" aria-expanded="false" aria-controls="map-bar">Filtros ▾</button><span class="count" id="m-count" role="status" aria-live="polite"></span>
      <div class="seg" role="group" aria-label="Forma de ver los lugares"><button id="v-map" aria-pressed="true">Carta</button><button id="v-list" aria-pressed="false">Lista</button></div></div>
      <div class="map-stage"><svg class="msvg" role="img" aria-label="Carta náutica del mundo de One Piece con sus lugares. Hay un modo lista accesible."></svg>
        <div class="gtools" role="toolbar" aria-label="Zoom de la carta"><button data-z="in" aria-label="Acercar">＋</button><button data-z="out" aria-label="Alejar">－</button><button data-z="fit" aria-label="Ver toda la carta" title="Ver todo">⤢</button></div>
        <div class="route-bar" id="route-bar"><button class="btn" id="r-play" aria-label="Reproducir la ruta del viaje">▶ Ruta del viaje</button><div class="r-ctl" hidden><button id="r-prev" aria-label="Arco anterior">⏮</button><button id="r-pp" aria-label="Pausar o reproducir">⏸</button><button id="r-next" aria-label="Arco siguiente">⏭</button></div><div class="r-info" id="r-info" role="status" aria-live="polite">Sigue el rumbo de los Sombreros de Paja de isla en isla, arco a arco.</div></div>
        <details class="c-leg" id="c-leg"><summary title="Qué significa cada trazo y marcador">Leyenda</summary><div class="c-leg-b"><ul><li><svg viewBox="0 0 28 16" aria-hidden="true"><path d="M2 8 H26" stroke="#b3402e" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="2 5"/></svg><span><b>Ruta del viaje</b> (31 paradas)</span></li><li><svg viewBox="0 0 28 16" aria-hidden="true"><path d="M2 8 H26" stroke="#9c2f1f" stroke-width="3.4" stroke-linecap="round"/></svg><span><b>Tramo recorrido</b> por el barco</span></li><li><svg viewBox="0 0 28 16" aria-hidden="true"><circle cx="14" cy="8" r="7" fill="#c9a21c" stroke="#3a2813" stroke-width="1.4"/><text x="14" y="11.5" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">7</text></svg><span><b>Parada 1-31</b>; color = saga <span class="c-sagas" id="c-sagas"></span></span></li><li><svg viewBox="0 0 28 16" aria-hidden="true"><circle cx="14" cy="8" r="7.5" fill="#f3e4b4" stroke="#3a2813" stroke-width="1.6"/><text x="14" y="11.5" text-anchor="middle" font-size="9" font-weight="800" fill="#3a2813">12</text></svg><span><b>Varios lugares</b>: púlsalo para acercar</span></li><li><svg viewBox="0 0 28 16" aria-hidden="true"><rect x="1" y="3" width="26" height="10" rx="3" fill="#7fb3ad" fill-opacity=".5" stroke="#3a2813" stroke-width="1"/><path d="M5 13 L11 3 M11 13 L17 3 M17 13 L23 3" stroke="#3a2813" stroke-opacity=".4"/></svg><span><b>Calm Belt</b> (bandas rayadas)</span></li><li><svg viewBox="0 0 28 16" aria-hidden="true"><rect x="9" y="0" width="10" height="16" fill="#cf9a62" stroke="#3a2813" stroke-width="1.1"/><path d="M10 14 L14 5 L18 14Z" fill="#c2623f" stroke="#3a2813" stroke-width=".8"/></svg><span><b>Red Line</b> (con Mary Geoise)</span></li><li><svg viewBox="0 0 28 16" aria-hidden="true"><rect x="1" y="3" width="26" height="10" rx="4" fill="#4f93a8" fill-opacity=".4" stroke="#3a2813" stroke-width="1" stroke-dasharray="4 2"/></svg><span><b>Mares</b> (trazo discontinuo)</span></li><li><svg viewBox="0 0 28 16" aria-hidden="true"><path d="M2 11 q4 -8 8 0 M12 11 q4 -8 8 0" stroke="#5b3e8a" fill="none" stroke-width="1.4"/></svg><span><b>Tormentas</b> (Nuevo Mundo) y nubes</span></li><li><span class="c-ic" aria-hidden="true">🌴🏘🏰</span><span><b>Iconos</b>: isla, ciudad, reino…</span></li></ul></div></details>
        <div class="map-note"><b>Carta esquemática.</b> No es un mapa geográfico real: cada lugar se coloca en el mar que indican sus categorías en la wiki y, dentro de él, de izquierda a derecha según el capítulo en que aparece.</div></div>
      <div class="place-list" id="place-list" hidden></div>`;
    (root.querySelector('#f-sea') as HTMLSelectElement).value = this.f.sea; (root.querySelector('#f-saga') as HTMLSelectElement).value = this.f.saga; (root.querySelector('#f-kind') as HTMLSelectElement).value = this.f.kind;
    this.svg = root.querySelector('svg')!; this.content = el('g', {}, this.svg) as SVGGElement; this.drawChart(); this.routeG = el('g', { class: 'route' }, this.content) as SVGGElement; this.layer = el('g', { class: 'mk' }, this.content) as SVGGElement; this.shipG = el('g', { class: 'shipg' }, this.content) as SVGGElement;
    this.zoomB = zoom<SVGSVGElement, unknown>().scaleExtent([0.9, 24]).on('zoom', (e) => { this.z = e.transform; this.applyTransform(); this.schedule(); }); select(this.svg).call(this.zoomB).on('dblclick.zoom', null);
    this.ro = new ResizeObserver(() => { this.base(); this.applyTransform(); this.schedule(); }); this.ro.observe(this.svg);
    this.base(); this.applyTransform(); this.drawRoute(); this.draw(); this.updateCount();
    root.querySelector('.gtools')!.addEventListener('click', (e) => { const z = (e.target as HTMLElement).closest<HTMLElement>('[data-z]')?.dataset.z; if (z === 'in') this.zoomBy(1.5); else if (z === 'out') this.zoomBy(1 / 1.5); else if (z === 'fit') this.fitRect(0, 0, W, H); });
    for (const [id, key] of [['f-sea', 'sea'], ['f-saga', 'saga'], ['f-kind', 'kind']] as const) root.querySelector('#' + id)!.addEventListener('change', (e) => { this.f[key] = (e.target as HTMLSelectElement).value; setParams({ m: this.f.sea, s: this.f.saga, k: this.f.kind }); this.onFilter(key); });
    root.querySelector('#filt-btn')!.addEventListener('click', (e) => { const b = root.querySelector('#map-bar')!, o = !b.classList.contains('open'); b.classList.toggle('open', o); (e.currentTarget as HTMLElement).setAttribute('aria-expanded', String(o)); });
    root.querySelector('#v-map')!.addEventListener('click', () => this.setMode(false)); root.querySelector('#v-list')!.addEventListener('click', () => this.setMode(true));
    root.querySelector('#r-play')!.addEventListener('click', () => this.startRoute()); root.querySelector('#r-pp')!.addEventListener('click', () => this.toggleRoute());
    root.querySelector('#r-prev')!.addEventListener('click', () => { this.pause(); this.goStep(Math.max(0, this.step - 1)); }); root.querySelector('#r-next')!.addEventListener('click', () => { this.pause(); this.goStep(Math.min(this.data.route.length - 1, this.step + 1)); });
    this.svg.addEventListener('click', (e) => {
      const c = (e.target as Element).closest<SVGElement>('[data-cl]'); if (c) { const [x0, y0, x1, y1] = c.dataset.cl!.split(',').map(Number) as [number, number, number, number]; this.fitRect(x0 - 14, y0 - 14, x1 - x0 + 28, y1 - y0 + 28); return; }
      const m = (e.target as Element).closest<SVGElement>('[data-p]'); if (m) navigateToFicha(+m.dataset.p!);
    });
    this.svg.addEventListener('keydown', (e) => { const m = (e.target as Element).closest<SVGElement>('[data-p],[data-cl]'); if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); (m as unknown as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
    root.querySelector('#place-list')!.addEventListener('click', (e) => { const a = (e.target as HTMLElement).closest<HTMLElement>('[data-p]'); if (a) { e.preventDefault(); navigateToFicha(+a.dataset.p!); } });
    this.disposeSearch = await attachSearch(root.querySelector('#pq') as HTMLInputElement, root.querySelector('#pres') as HTMLElement, { onChoose: (i) => navigateToFicha(i), types: ['lugar'] });
    (root.querySelector('#c-leg') as HTMLDetailsElement).open = this.bx > 490; // con pantalla ancha sobra margen a los lados; en pantallas pequeñas queda plegada
    (root.querySelector('#c-sagas') as HTMLElement).innerHTML = D.sagas.map((sg, k) => `<i class="c-sg" style="--c:${SAGA_COL[k % SAGA_COL.length]}" title="${esc(sg.n)}"></i>`).join('') + ' (pasa el ratón por cada color)';
    if (this.listMode) this.setMode(true); else if (this.f.sea !== '') { const r = REGIONS[+this.f.sea]; if (r) this.fitRect(r.x - 10, OY + r.y - 10, r.w + 20, r.h + 20); }
  }
  unmount() { document.body.classList.remove('carta-on'); this.pause(); cancelAnimationFrame(this.raf); this.ro?.disconnect(); this.disposeSearch?.(); this.root.remove(); }

  // ---------- colocación determinista: por mar, de izquierda a derecha según el capítulo de primera aparición ----------
  private layoutMarkers() {
    const by = new Map<number, [number, number, number, number, number][]>(); for (const r of this.data.p) (by.get(r[1]) ?? by.set(r[1], []).get(r[1])!).push(r);
    for (const [s, rows] of by) {
      const r = REGIONS[s]!; const n = rows.length; rows.sort((a, b) => (a[3] || 1e6 + hash(a[0]) * 1e5) - (b[3] || 1e6 + hash(b[0]) * 1e5));
      const pad = 12, padTop = s === 7 ? 3 : s === 6 ? 16 : NOTES[s] ? 38 : 32, padLeft = s === 7 ? 150 : pad; const w = r.w - padLeft - pad, h = r.h - padTop - pad;
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * (w / Math.max(h, 1))))), nrows = Math.ceil(n / cols), cw = w / cols, ch = h / nrows;
      rows.forEach(([i, , kind, chap, ap], k) => { const cx = Math.floor(k / nrows), cy = k % nrows; this.markers.push({ i, sea: s, kind, ch: chap, ap, x: r.x + padLeft + (cx + 0.5 + (hash(i * 7) - 0.5) * 0.3) * cw, y: OY + r.y + padTop + (cy + 0.5 + (hash(i * 13) - 0.5) * 0.4) * ch }); });
    }
    for (const m of this.markers) this.byI.set(m.i, m);
  }

  // ---------- el pergamino ----------
  private drawChart() {
    const c = this.content; const defs = el('defs', {}, c);
    defs.innerHTML = `<pattern id="wv" width="26" height="12" patternUnits="userSpaceOnUse"><path d="M0 7 q6.5 -6 13 0 t13 0" fill="none" stroke="${INK}" stroke-opacity=".28" stroke-width="1"/></pattern>
      <pattern id="calm" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0 V8" stroke="${INK}" stroke-opacity=".4" stroke-width="1.1"/></pattern>
      <pattern id="storm" width="34" height="30" patternUnits="userSpaceOnUse"><path d="M3 9 q7 -8 14 0 M18 24 q7 -8 14 0 M20 7 l-4 7 h5 l-4 7" fill="none" stroke="#5b3e8a" stroke-opacity=".5" stroke-width="1.1"/></pattern>
      <pattern id="mts" width="20" height="16" patternUnits="userSpaceOnUse"><path d="M1 14 L8 3 L11 8 L14 5 L19 14 Z" fill="#c2623f" fill-opacity=".85" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/></pattern>`;
    el('rect', { width: W, height: H, fill: PAPER }, c); this.bg = el('image', { width: W, height: H, preserveAspectRatio: 'none' }, c); void this.bakePaper();
    const g = el('g', { transform: `translate(0 ${OY})` }, c);
    // aguas: manchas de acuarela teñidas por mar
    const wash = (r: Region, fill: string, op: number, rx = 18) => { el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx, fill, 'fill-opacity': op }, g); el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx, fill: 'url(#wv)' }, g); el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx, fill: 'none', stroke: INK, 'stroke-opacity': 0.55, 'stroke-width': 1.3, 'stroke-dasharray': '7 4 1.5 4' }, g); };
    wash(REGIONS[0]!, '#4f93a8', 0.38); wash(REGIONS[1]!, '#4a86a0', 0.4); wash(REGIONS[2]!, '#5a8fb0', 0.38); wash(REGIONS[3]!, '#4f9a94', 0.38); wash(REGIONS[4]!, '#3a7fa3', 0.45); wash(REGIONS[5]!, '#6b5aa6', 0.38); wash(REGIONS[9]!, '#2f6f98', 0.5, 10);
    el('rect', { x: 600, y: 250, width: 380, height: 138, rx: 18, fill: 'url(#storm)' }, g);
    wash(REGIONS[8]!, '#cfe3ee', 0.55); for (const [x, y, s] of [[345, 62, 1], [420, 140, 0.8], [372, 186, 0.9], [338, 130, 0.7], [440, 60, 0.7]] as const) el('path', { d: `M${x - 28 * s} ${y} q-8 -18 12 -20 q6 -16 26 -8 q22 -6 24 12 q16 2 10 16 z`, fill: '#fbf3dc', stroke: INK, 'stroke-width': 1, 'stroke-opacity': 0.7 }, g);
    wash(REGIONS[10]!, '#9a8d72', 0.4, 10);
    for (const y of [210, 400]) { el('rect', { x: 20, y, width: 960, height: 28, fill: '#7fb3ad', 'fill-opacity': 0.45 }, g); el('rect', { x: 20, y, width: 960, height: 28, fill: 'url(#calm)' }, g); el('rect', { x: 20, y, width: 960, height: 28, fill: 'none', stroke: INK, 'stroke-opacity': 0.55, 'stroke-width': 1.2 }, g); }
    // Red Line: cordillera con picos rojos, Mary Geoise coronándola
    el('rect', { x: 470, y: 20, width: 60, height: 600, fill: '#cf9a62', 'fill-opacity': 0.7, stroke: INK, 'stroke-width': 1.6 }, g); el('rect', { x: 470, y: 20, width: 60, height: 600, fill: 'url(#mts)' }, g);
    el('path', { d: 'M500 4 l-14 12 v10 h28 v-10 z M486 16 l6 -8 l8 7 l8 -7 l6 8', fill: '#f4e4b4', stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, g);
    const lab = (t: string, x: number, y: number, size: number, anchor = 'middle', rot = 0, fill = INK, ls = 0.2) => { const e = el('text', { x, y, 'font-size': size, 'text-anchor': anchor, fill, 'font-style': 'italic', 'font-family': SERIF, 'letter-spacing': `${ls}em`, transform: rot ? `rotate(${rot} ${x} ${y})` : '' }, g); e.textContent = t; return e; };
    lab('R E D   L I N E', 500, 330, 13, 'middle', -90, INK, 0.35).setAttribute('font-weight', '700');
    REGIONS.forEach((r, k) => { if (k === 6 || k === 7 || k === 10) return; const ax = k === 9 ? r.x + 38 : r.x + r.w / 2; lab((SEA_NAMES[k] ?? '').toUpperCase(), ax, r.y + (k === 9 ? 22 : 23), k === 4 || k === 5 ? 18 : k === 9 ? 12 : 15, 'middle', 0, '#2c4254', k === 9 ? 0.1 : 0.3).setAttribute('font-weight', '700'); if (NOTES[k] && k !== 9) lab(NOTES[k]!, r.x + r.w / 2, r.y + 38, 10, 'middle', 0, '#4a3b25', 0.05); });
    lab('CALM BELT', 120, 229, 11, 'middle', 0, '#274a46', 0.4); lab('CALM BELT', 120, 419, 11, 'middle', 0, '#274a46', 0.4); lab('M A R E S   S I N   U B I C A R', 565, 658, 11, 'middle', 0, '#4a3b25', 0.2);
    // monstruos marinos y barcos de adorno
    const art = (d: string, x: number, y: number, s: number, fill = 'none', sw = 1.6, op = 0.8) => el('path', { d, transform: `translate(${x} ${y}) scale(${s})`, fill, stroke: INK, 'stroke-width': sw / s, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: op }, g);
    art('M0 0 q12 -34 30 -18 q14 12 28 -6 q14 -14 26 4 M84 -20 q8 -6 14 2 M0 0 q10 14 26 8 q14 -6 26 6 q14 10 28 -2', 52, 232, 1.5);
    art('M0 0 q-8 -22 6 -34 q10 -8 16 4 q4 12 -4 22 M22 -30 q8 -8 16 -2 M0 0 q20 -4 40 6', 760, 312, 1.4, '#c9d9c4', 1.5, 0.6);
    art('M0 20 q-14 -30 -4 -50 q4 -10 14 -8 q6 16 0 32 M6 -38 q4 -14 12 -10 M20 -2 q-6 -26 8 -42 M30 -44 q10 -6 14 6 q-2 16 -10 30', 120, 590, 1.3, '#d2b28a', 1.5, 0.7);
    art('M0 0 q22 -26 50 -8 q18 10 36 -4 l-10 14 q-20 10 -40 6 q-22 -4 -36 -8 z M86 -12 l14 -8 l-4 14', 640, 570, 1.2, '#d9c08f', 1.4, 0.65);
    const ship = (x: number, y: number, s: number) => { const e = el('g', { transform: `translate(${x} ${y}) scale(${s})`, opacity: 0.7 }, g); e.innerHTML = `<path d="M-14 4 q14 12 28 0 l-3 -6 h-22 z" fill="#d8bd86" stroke="${INK}" stroke-width="1"/><path d="M0 -2 V-26 M0 -24 q10 6 0 18 M-1 -22 q-9 6 -1 16" fill="#f6ecd0" stroke="${INK}" stroke-width="1"/>`; };
    ship(300, 560, 1.5); ship(780, 90, 1.3); ship(90, 330, 1.2); ship(910, 500, 1.3); ship(640, 330, 1.1);
    // relieve de la Red Line: luz a la izquierda, sombra a la derecha, crestas grabadas y sombra proyectada sobre el mar
    const gd = el('defs', {}, c); gd.innerHTML = `<linearGradient id="relief" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#3a2813" stop-opacity=".5"/></linearGradient><linearGradient id="cast" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a2813" stop-opacity=".32"/><stop offset="1" stop-color="#3a2813" stop-opacity="0"/></linearGradient>`;
    el('rect', { x: 470, y: 20, width: 60, height: 600, fill: 'url(#relief)', 'pointer-events': 'none' }, g); el('rect', { x: 530, y: 20, width: 20, height: 600, fill: 'url(#cast)', 'pointer-events': 'none' }, g);
    let ridge = 'M474 30'; for (let y = 40; y < 620; y += 14) ridge += ` l${hash(y) > 0.5 ? 5 : -5} 14`; el('path', { d: ridge, fill: 'none', stroke: INK, 'stroke-width': 0.8, 'stroke-opacity': 0.55, transform: 'translate(22 0)' }, g);
    // ornamento de esquinas y cenefa
    const corner = (x: number, y: number, sx: number, sy: number) => { const e = el('g', { transform: `translate(${x} ${y}) scale(${sx} ${sy})` }, c); e.innerHTML = `<path d="M0 0 h46 M0 0 v46 M7 7 h30 q-14 3 -18 12 q-3 -9 -12 -12 z M7 7 v30 q3 -14 12 -18 q-9 -3 -12 -12z" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/><circle cx="7" cy="7" r="3.2" fill="#b3402e" stroke="${INK}" stroke-width="1"/><path d="M22 7 q6 -6 12 0 q-6 6 -12 0z M7 22 q-6 6 0 12 q6 -6 0 -12z" fill="#e8c46a" stroke="${INK}" stroke-width="1"/>`; };
    corner(10, 10, 1, 1); corner(W - 10, 10, -1, 1); corner(10, H - 10, 1, -1); corner(W - 10, H - 10, -1, -1);
    // monstruos: ojos, púas y ventosas grabadas
    const dots = (pts: number[][], r: number) => pts.forEach(([x, y]) => el('circle', { cx: x, cy: y, r, fill: INK, opacity: 0.55 }, g));
    dots([[78, 218], [96, 214], [114, 218]], 1.6); el('circle', { cx: 118, cy: 206, r: 3.2, fill: '#f6ecd0', stroke: INK, 'stroke-width': 1 }, g); el('circle', { cx: 118, cy: 206, r: 1.2, fill: INK }, g);
    dots([[130, 566], [138, 556], [146, 546], [154, 538], [152, 574], [160, 566]], 1.8); el('circle', { cx: 160, cy: 540, r: 3, fill: '#f6ecd0', stroke: INK, 'stroke-width': 1 }, g); el('circle', { cx: 160, cy: 540, r: 1.1, fill: INK }, g);
    for (let k = 0; k < 7; k++) el('path', { d: `M${700 + k * 9} ${338 - (k % 2) * 3} l2 -7`, stroke: INK, 'stroke-width': 1.2, opacity: 0.6 }, g);
    for (let k = 0; k < 9; k++) el('path', { d: `M${646 + k * 9} ${566 - (k % 3) * 2} l3 5`, stroke: INK, 'stroke-width': 1, opacity: 0.45 }, g);
    // marco, graduación, cartela y rosa de los vientos
    const fr = el('g', {}, c); el('rect', { x: 7, y: 7, width: W - 14, height: H - 14, fill: 'none', stroke: INK, 'stroke-width': 2.4 }, fr); el('rect', { x: 13, y: 13, width: W - 26, height: H - 26, fill: 'none', stroke: INK, 'stroke-width': 0.9 }, fr);
    for (let x = 20; x < W - 18; x += 20) el('path', { d: `M${x} 13 v${x % 100 === 0 ? 8 : 4} M${x} ${H - 13} v-${x % 100 === 0 ? 8 : 4}`, stroke: INK, 'stroke-width': 0.9 }, fr);
    for (let y = 20; y < H - 18; y += 20) el('path', { d: `M13 ${y} h${y % 100 === 0 ? 8 : 4} M${W - 13} ${y} h-${y % 100 === 0 ? 8 : 4}`, stroke: INK, 'stroke-width': 0.9 }, fr);
    const cart = el('g', { transform: 'translate(500 27)' }, fr); cart.innerHTML = `<path d="M-190 -12 h380 l10 12 l-10 12 h-380 l-10 -12 z" fill="#f3e4b4" stroke="${INK}" stroke-width="1.6"/><text y="6" text-anchor="middle" font-family='${SERIF}' font-style="italic" font-weight="700" font-size="20" letter-spacing=".16em" fill="${INK}">CARTA NÁUTICA DE LOS MARES</text>`;
    const rose = el('g', { transform: `translate(88 ${OY + 676})` }, c); const pts: string[] = [];
    for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8, long = k % 4 === 0 ? 50 : k % 2 === 0 ? 38 : 26; const b0 = a - Math.PI / 16, b1 = a + Math.PI / 16; pts.push(`<path d="M0 0 L${(Math.sin(b0) * 9).toFixed(1)} ${(-Math.cos(b0) * 9).toFixed(1)} L${(Math.sin(a) * long).toFixed(1)} ${(-Math.cos(a) * long).toFixed(1)} Z" fill="${k % 2 ? '#f4e4b4' : INK}" stroke="${INK}" stroke-width=".8"/><path d="M0 0 L${(Math.sin(a) * long).toFixed(1)} ${(-Math.cos(a) * long).toFixed(1)} L${(Math.sin(b1) * 9).toFixed(1)} ${(-Math.cos(b1) * 9).toFixed(1)} Z" fill="${k % 2 ? INK : '#f4e4b4'}" stroke="${INK}" stroke-width=".8"/>`); }
    rose.innerHTML = `<circle r="60" fill="none" stroke="${INK}" stroke-width="1.1"/>${Array.from({ length: 72 }, (_, k) => `<path d="M${(Math.sin((k * Math.PI) / 36) * 56).toFixed(1)} ${(-Math.cos((k * Math.PI) / 36) * 56).toFixed(1)} L${(Math.sin((k * Math.PI) / 36) * (k % 9 === 0 ? 63 : 60)).toFixed(1)} ${(-Math.cos((k * Math.PI) / 36) * (k % 9 === 0 ? 63 : 60)).toFixed(1)}" stroke="${INK}" stroke-width="${k % 9 === 0 ? 1.3 : 0.6}"/>`).join('')}<circle r="55" fill="#f3e4b4" fill-opacity=".7" stroke="${INK}" stroke-width="1.4"/><circle r="47" fill="none" stroke="${INK}" stroke-width=".8" stroke-dasharray="1.5 3"/>${pts.join('')}<circle r="4" fill="#b3402e" stroke="${INK}"/><path d="M-5 -52 l5 -9 l5 9 q-5 -3 -10 0z" fill="#b3402e" stroke="${INK}" stroke-width=".9"/><text y="-64" text-anchor="middle" font-family='${SERIF}' font-weight="700" font-size="13" fill="${INK}">N</text><text x="64" y="4" font-family='${SERIF}' font-weight="700" font-size="11" fill="${INK}">E</text><text x="-69" y="4" font-family='${SERIF}' font-weight="700" font-size="11" fill="${INK}">O</text><text y="72" text-anchor="middle" font-family='${SERIF}' font-weight="700" font-size="11" fill="${INK}">S</text>`;
  }

  // el papel (ruido, manchas y viñeta) usa filtros SVG caros: se rasteriza una vez y se dibuja como imagen
  private async bakePaper() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}"><defs><filter id="p" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 .45  0 0 0 0 .32  0 0 0 0 .14  0 0 0 .22 0"/></filter><filter id="s" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="3" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 .55  0 0 0 0 .38  0 0 0 0 .15  0 0 0 1.1 -.35"/></filter><radialGradient id="v" cx=".5" cy=".5" r=".75"><stop offset=".62" stop-color="#7a4f1d" stop-opacity="0"/><stop offset="1" stop-color="#5a3510" stop-opacity=".55"/></radialGradient></defs><rect width="${W}" height="${H}" fill="${PAPER}"/><rect width="${W}" height="${H}" filter="url(#s)" opacity=".55"/><rect width="${W}" height="${H}" filter="url(#p)"/><rect width="${W}" height="${H}" fill="url(#v)"/></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); const img = new Image();
    try { await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error('papel')); img.src = url; }); const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2; cv.getContext('2d')!.drawImage(img, 0, 0); this.bg.setAttribute('href', cv.toDataURL('image/jpeg', 0.88)); } catch { this.bg.setAttribute('href', url); }
  }

  // ---------- cámara ----------
  private base() { const w = this.svg.clientWidth || 900, h = this.svg.clientHeight || 600; const top = w < 820 ? 4 : 6, bottom = w < 820 ? 120 : 70; this.s0 = Math.min(w / W, Math.max(120, h - top - bottom) / H); this.bx = (w - W * this.s0) / 2; this.by = top + (h - top - bottom - H * this.s0) / 2; }
  private applyTransform() { this.content.setAttribute('transform', `translate(${this.z.x},${this.z.y}) scale(${this.z.k}) translate(${this.bx},${this.by}) scale(${this.s0})`); }
  private schedule() { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); }); }
  private zoomBy(f: number) { const w = this.svg.clientWidth / 2, h = this.svg.clientHeight / 2, k = Math.max(0.9, Math.min(24, this.z.k * f)); this.tween(zoomIdentity.translate(w - ((w - this.z.x) / this.z.k) * k, h - ((h - this.z.y) / this.z.k) * k).scale(k)); }
  private fitRect(x: number, y: number, w: number, h: number) { const vw = this.svg.clientWidth, vh = this.svg.clientHeight; const sx = x * this.s0 + this.bx, sy = y * this.s0 + this.by, sw = w * this.s0, sh = h * this.s0; const k = Math.max(0.9, Math.min(24, 0.94 * Math.min(vw / sw, vh / sh))); this.tween(zoomIdentity.translate(vw / 2 - (sx + sw / 2) * k, vh / 2 - (sy + sh / 2) * k).scale(k)); }
  private tween(to: ZoomTransform, ms = 550) { const from = this.z, t0 = performance.now(), quick = reduce(); const step = (now: number) => { const p = quick ? 1 : Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3); select(this.svg).call(this.zoomB.transform, zoomIdentity.translate(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e).scale(from.k + (to.k - from.k) * e)); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
  private centerOn(m: Marker, k = 6) { const vw = this.svg.clientWidth, vh = this.svg.clientHeight, sx = this.bx + m.x * this.s0, sy = this.by + m.y * this.s0, kk = Math.max(this.z.k, Math.min(24, (k / this.s0) * 0.5)); this.tween(zoomIdentity.translate(vw * 0.5 - sx * kk, vh * 0.5 - sy * kk).scale(kk), 600); }

  // ---------- filtros ----------
  private passes(m: Marker) { const { sea, saga, kind } = this.f; if (sea !== '' && m.sea !== +sea) return false; if (kind !== '' && m.kind !== +kind) return false; if (saga !== '' && !(m.ap >= 0 && this.data.arcs[m.ap]?.s === +saga)) return false; return true; }
  private visibleMarkers() { return this.markers.filter((m) => this.passes(m)); }
  private updateCount() { const n = this.visibleMarkers().length; const c = this.root.querySelector('#m-count'); if (c) c.textContent = `${fmtN(n)} de ${fmtN(this.markers.length)} lugares`; }
  private onFilter(key: string) { this.updateCount(); this.schedule(); if (this.listMode) this.renderList(); if (key === 'sea' && !this.listMode) { if (this.f.sea !== '') { const r = REGIONS[+this.f.sea]!; this.fitRect(r.x - 10, OY + r.y - 10, r.w + 20, r.h + 20); } else this.fitRect(0, 0, W, H); } }
  private setMode(list: boolean) { this.listMode = list; setParams({ l: list ? '1' : null }); (this.root.querySelector('.map-stage') as HTMLElement).hidden = list; (this.root.querySelector('#place-list') as HTMLElement).hidden = !list; this.root.querySelector('#v-map')!.setAttribute('aria-pressed', String(!list)); this.root.querySelector('#v-list')!.setAttribute('aria-pressed', String(list)); if (list) this.renderList(); else { this.base(); this.applyTransform(); this.schedule(); } }
  private renderList() {
    const by = new Map<number, Marker[]>(); for (const m of this.visibleMarkers()) (by.get(m.sea) ?? by.set(m.sea, []).get(m.sea)!).push(m); const D = this.data; const order = [4, 5, 0, 1, 2, 3, 9, 6, 7, 8, 10];
    (this.root.querySelector('#place-list') as HTMLElement).innerHTML = `<div class="page"><h2 class="sr-title">Lugares en forma de lista</h2>` + (order.filter((s) => by.has(s)).map((s) => `<section class="pl-sea"><h3>${esc(SEA_NAMES[s] ?? D.seas[s]!)} <b>${by.get(s)!.length}</b></h3><ul>${by.get(s)!.sort((a, b) => (a.ch || 1e9) - (b.ch || 1e9) || nameOf(a.i).localeCompare(nameOf(b.i), 'es')).map((m) => `<li><a href="#/ficha/${encodeURIComponent(nameOf(m.i))}" data-p="${m.i}">${esc(nameOf(m.i))}</a><small>${esc(D.kinds[m.kind]!)}${m.ap >= 0 ? ' · ' + esc(short(D.arcs[m.ap]!.n)) : ''}</small></li>`).join('')}</ul></section>`).join('') || '<p class="hint">Ningún lugar cumple los filtros.</p>') + '</div>';
  }

  // ---------- ruta del viaje: tinta roja de tesoro, paradas numeradas por saga y el barco ----------
  private pos(i: number) { const m = this.byI.get(i); return m ? ([m.x, m.y] as [number, number]) : null; }
  private drawRoute() {
    const pts = this.data.route.map((r) => this.pos(r.p)).filter((p): p is [number, number] => !!p); this.routeG.innerHTML = ''; if (pts.length < 2) return;
    let d = `M${pts[0]![0]} ${pts[0]![1]}`;
    for (let k = 0; k < pts.length - 1; k++) { const p0 = pts[Math.max(0, k - 1)]!, p1 = pts[k]!, p2 = pts[k + 1]!, p3 = pts[Math.min(pts.length - 1, k + 2)]!; d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]} ${p2[1]}`; }
    el('path', { d, class: 'c-ghost', fill: 'none' }, this.routeG); this.bleed = el('path', { d, class: 'c-bleed', fill: 'none' }, this.routeG) as SVGPathElement; this.routePath = el('path', { d, class: 'c-run', fill: 'none' }, this.routeG) as SVGPathElement; this.routeLen = this.routePath.getTotalLength();
    this.routePath.style.strokeDasharray = `${this.routeLen} ${this.routeLen}`; this.routePath.style.strokeDashoffset = String(this.routeLen);
    let acc = 0; this.cum = pts.map((p, k) => { if (k) acc += Math.hypot(p[0] - pts[k - 1]![0], p[1] - pts[k - 1]![1]); return acc; }); const tot = acc || 1; this.cum = this.cum.map((c) => (c / tot) * this.routeLen);
    this.shipG.innerHTML = ''; this.ship = el('g', { class: 'c-ship', visibility: 'hidden' }, this.shipG) as SVGGElement; const at = (s: string) => s.replace('<svg ', '<svg x="-20" y="-30" width="40" height="37" '); this.ship.innerHTML = `<g class="sh m">${at(shipSvg('merry'))}</g><g class="sh s">${at(shipSvg('sunny'))}</g>`;
  }
  private setShip(len: number) { if (!this.routePath) return; const p = this.routePath.getPointAtLength(Math.max(0, Math.min(this.routeLen, len))); this.shipLen = len; this.ship.setAttribute('visibility', 'visible'); this.ship.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${(1.7 / (this.z.k * this.s0)).toFixed(4)})`); this.routePath!.style.strokeDashoffset = String(this.routeLen - len); if (this.bleed) { this.bleed.style.strokeDasharray = `${this.routeLen} ${this.routeLen}`; this.bleed.style.strokeDashoffset = String(this.routeLen - len); } }
  private startRoute() { (this.root.querySelector('.r-ctl') as HTMLElement).hidden = false; (this.root.querySelector('#r-play') as HTMLElement).hidden = true; this.step = -1; this.playing = true; (this.root.querySelector('#r-pp') as HTMLElement).textContent = '⏸'; this.tick(); }
  private toggleRoute() { if (this.playing) this.pause(); else { this.playing = true; (this.root.querySelector('#r-pp') as HTMLElement).textContent = '⏸'; if (this.step >= this.data.route.length - 1) this.step = -1; this.tick(); } }
  private pause() { this.playing = false; clearTimeout(this.timer); const b = this.root?.querySelector('#r-pp'); if (b) b.textContent = '▶'; }
  private tick() { if (!this.playing) return; const next = this.step + 1; if (next >= this.data.route.length) { this.pause(); return; } this.goStep(next); this.timer = window.setTimeout(() => this.tick(), reduce() ? 1800 : 2600); }
  private get sunnyFrom() { const n = this.data.arcs.findIndex((a) => /Thriller Bark/i.test(a.n)); return n < 0 ? 1e9 : n; }
  private goStep(k: number) {
    this.step = k; const r = this.data.route[k]!, m = this.byI.get(r.p); if (!m) return; const arc = this.data.arcs[r.a]!;
    this.ship.classList.toggle('sunny', r.a >= this.sunnyFrom); this.ship.setAttribute('data-ship', r.a >= this.sunnyFrom ? 'sunny' : 'merry');
    const to = this.cum[k] ?? 0, from = this.shipLen, t0 = performance.now(), dur = reduce() ? 0 : 1500;
    const run = (now: number) => { const p = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - Math.pow(1 - p, 3); this.setShip(from + (to - from) * e); if (p < 1 && this.step === k) requestAnimationFrame(run); }; requestAnimationFrame(run); this.centerOn(m, 5);
    const info = this.root.querySelector('#r-info') as HTMLElement; info.classList.add('on');
    info.innerHTML = `<b>${k + 1}/${this.data.route.length} · ${esc(short(arc.n))}</b> · ${esc(nameOf(r.p))} <small>(${esc(SEA_NAMES[m.sea] ?? '')})</small> <button class="linkish" data-p="${r.p}">Abrir la ficha</button>`;
    info.onclick = (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-p]'); if (b) navigateToFicha(+b.dataset.p!); };
    this.selected = r.p; this.schedule();
  }

  // ---------- islas, nombres y agrupación al alejar ----------
  private draw() {
    const scale = this.z.k * this.s0, cell = (scale < 1.2 ? 92 : scale < 2 ? 58 : scale < 3.2 ? 38 : 26) / scale; const cells = new Map<string, Marker[]>(); const w = this.svg.clientWidth, h = this.svg.clientHeight;
    const stops = new Map(this.data.route.map((r, k) => [r.p, k + 1])); const sagaOfStop = new Map(this.data.route.map((r) => [r.p, this.data.arcs[r.a]?.s ?? 0]));
    for (const m of this.markers) { if (!this.passes(m)) continue; const sx = this.z.x + (this.bx + m.x * this.s0) * this.z.k, sy = this.z.y + (this.by + m.y * this.s0) * this.z.k; if (sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) continue; const key = `${Math.floor(m.x / cell)},${Math.floor(m.y / cell)}`; (cells.get(key) ?? cells.set(key, []).get(key)!).push(m); }
    const inv = (1 / scale).toFixed(4), boxes: [number, number, number, number][] = []; const photos = scale > 3.4; let html = '';
    const sx = (m: { x: number }) => (this.bx + m.x * this.s0) * this.z.k + this.z.x, sy = (m: { y: number }) => (this.by + m.y * this.s0) * this.z.k + this.z.y;
    const fits = (x: number, y: number, bw: number, bh: number) => { if (boxes.some((b) => x < b[0] + b[2] && x + bw > b[0] && y < b[1] + b[3] && y + bh > b[1])) return false; boxes.push([x, y, bw, bh]); return true; };
    const groups = [...cells.values()].sort((a, b) => (b.length === 1 ? 0 : b.length) - (a.length === 1 ? 0 : a.length));
    const singles = groups.filter((g) => g.length === 1).map((g) => g[0]!); const reserved = new Map(singles.map((m) => [m.i, [sx(m) - 15, sy(m) - 15, 30, 30] as [number, number, number, number]]));
    for (const m of singles) boxes.push([sx(m) - 14, sy(m) - 14, 28, 28]);
    for (const g of groups) {
      if (g.length === 1) continue;
      const cx = g.reduce((a, m) => a + m.x, 0) / g.length, cy = g.reduce((a, m) => a + m.y, 0) / g.length, x0 = Math.min(...g.map((m) => m.x)), x1 = Math.max(...g.map((m) => m.x)), y0 = Math.min(...g.map((m) => m.y)), y1 = Math.max(...g.map((m) => m.y));
      const samples = [...g].sort((a, b) => (a.ch || 1e9) - (b.ch || 1e9)).slice(0, 3); const hasStop = g.some((m) => stops.has(m.i)); const r = 15 + Math.min(10, Math.log2(g.length) * 2.4);
      const first = nameOf(samples[0]!.i); const label = (first.length > 20 ? first.slice(0, 19) + '…' : first) + ` y ${g.length - 1} más`; const lw = label.length * 7.3 + 12, px = sx({ x: cx }), py = sy({ y: cy }); const showL = px - lw / 2 > 4 && px + lw / 2 < w - 4 && fits(px - lw / 2, py + r + 3, lw, 17);
      const thumbs = samples.map((m, k) => { const u = IMGS?.[m.i] ? imgUrl(IMGS[m.i]!, 48) : ''; return `<g transform="translate(${(k - (samples.length - 1) / 2) * 15} ${-r - 2})"><circle r="8.5" fill="#f4e4b4" stroke="${INK}" stroke-width="1.2"/>${u ? `<image href="${esc(u)}" x="-8" y="-8" width="16" height="16" preserveAspectRatio="xMidYMin slice" style="clip-path:circle(50%)" onerror="this.remove()"/>` : `<g transform="scale(.55)">${ICON[m.kind] ?? ICON[0]}</g>`}</g>`; }).join('');
      html += `<g class="c-cl ${hasStop ? 'stop' : ''}" data-cl="${x0.toFixed(1)},${y0.toFixed(1)},${x1.toFixed(1)},${y1.toFixed(1)}" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${inv})" tabindex="0" role="button" aria-label="${g.length} lugares: ${esc(label)}. Pulsa para acercar"><circle r="${r}" class="c-disc"/><text y="5" text-anchor="middle" class="c-n">${g.length}</text>${scale > 1.2 && g.length >= 6 ? thumbs : ''}${showL ? `<text y="${r + 15}" text-anchor="middle" class="c-lb">${esc(label)}</text>` : ''}</g>`;
    }
    const order = [...singles].sort((p, q) => (q.i === this.selected ? 1e9 : 0) + (stops.has(q.i) ? 1e6 : 0) + impOf(q.i) - ((p.i === this.selected ? 1e9 : 0) + (stops.has(p.i) ? 1e6 : 0) + impOf(p.i)));
    const maxL = scale < 1.5 ? 0 : scale < 2.2 ? 16 : scale < 3 ? 40 : 1e9; let nl = 0; const place = new Map<number, { x: number; y: number; a: string; lead: number[] | null }>();
    for (const m of order) {
      const nm = nameOf(m.i), tw = nm.length * 7.2 + 8, px = sx(m), py = sy(m), forced = m.i === this.selected || stops.has(m.i); if (!forced && nl >= maxL) continue;
      const cand = [[17, 4, 'start', px + 15, py - 8], [-17, 4, 'end', px - 15 - tw, py - 8], [0, 27, 'middle', px - tw / 2, py + 12], [0, -15, 'middle', px - tw / 2, py - 30]] as const; let got: { x: number; y: number; a: string; lead: number[] | null } | null = null;
      for (const [dx, dy, an, bx0, by0] of cand) if (fits(bx0, by0, tw, 17)) { got = { x: dx, y: dy, a: an, lead: null }; break; }
      if (!got && forced) for (const [ox, oy] of [[30, -26], [-30, -26], [30, 30], [-30, 30], [0, -46], [0, 52]] as const) { const bx0 = px + ox - (ox < 0 ? tw : ox === 0 ? tw / 2 : 0), by0 = py + oy - 12; if (fits(bx0, by0, tw, 17)) { got = { x: ox + (ox < 0 ? -3 : ox === 0 ? 0 : 3), y: oy + 3, a: ox < 0 ? 'end' : ox === 0 ? 'middle' : 'start', lead: [ox * 0.5, oy * 0.5, ox, oy - 4] }; break; } }
      if (!got && forced) got = { x: 17, y: 4, a: 'start', lead: null };
      if (got) { place.set(m.i, got); if (!forced) nl++; }
    }
    for (const m of singles) {
      const sel = m.i === this.selected, st = stops.get(m.i), img = photos && IMGS?.[m.i] ? imgUrl(IMGS[m.i]!, 72) : ''; const nm = nameOf(m.i); const lb = place.get(m.i);
      const body = img ? `<circle r="13" fill="#f4e4b4" stroke="${INK}" stroke-width="1.6"/><image href="${esc(img)}" x="-12" y="-12" width="24" height="24" preserveAspectRatio="xMidYMin slice" style="clip-path:circle(50%)" onerror="this.remove()"/>` : iconFor(m.kind, m.sea, m.i);
      const text = lb ? `${lb.lead ? `<path d="M${lb.lead[0]} ${lb.lead[1]} L${lb.lead[2]} ${lb.lead[3]}" class="c-lead"/>` : ''}<text x="${lb.x}" y="${lb.y}" text-anchor="${lb.a}" class="c-label ${m.kind === 3 ? 'reg' : ''}">${esc(nm)}</text>` : '';
      html += `<g class="c-pin ${sel ? 'sel' : ''}" data-p="${m.i}" transform="translate(${m.x.toFixed(1)} ${m.y.toFixed(1)}) scale(${inv})" tabindex="0" role="button" aria-label="${esc(nm)}${st ? ', parada ' + st + ' del viaje' : ''}">${sel ? '<circle r="19" class="c-sel"/>' : ''}${body}${text}<title>${esc(nm)}</title></g>`;
    }
    // paradas del viaje: siempre visibles, numeradas y coloreadas por saga, aunque su isla esté dentro de un grupo
    for (const r of this.data.route) { const m = this.byI.get(r.p); if (!m || !this.passes(m)) continue; const px = sx(m), py = sy(m); if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue; const k = stops.get(r.p)!, col = SAGA_COL[(this.data.arcs[r.a]?.s ?? 0) % SAGA_COL.length]!; const tiny = scale < 1.1; html += `<g class="c-stop" data-p="${r.p}" transform="translate(${m.x.toFixed(1)} ${m.y.toFixed(1)}) scale(${inv}) ${tiny ? '' : 'translate(11 -13)'}" tabindex="0" role="button" aria-label="Parada ${k} del viaje: ${esc(nameOf(r.p))}"><circle r="${tiny ? 4.5 : 9}" fill="${col}" stroke="${INK}" stroke-width="1.5"/>${tiny ? '' : `<text y="3.5" text-anchor="middle" class="c-stopn">${k}</text>`}</g>`; }
    this.layer.innerHTML = html; if (this.routePath && this.shipLen > 0) this.setShip(this.shipLen);
  }
  focus(i: number | null) {
    this.selected = i; this.schedule(); if (i === null) return; const m = this.byI.get(i); if (!m) return;
    if (!this.passes(m)) { this.f = { sea: '', saga: '', kind: '' }; ['f-sea', 'f-saga', 'f-kind'].forEach((id) => ((this.root.querySelector('#' + id) as HTMLSelectElement).value = '')); setParams({ m: null, s: null, k: null }); this.updateCount(); }
    // el panel lateral se abre justo después de enfocar: se centra cuando el lienzo ya ha cambiado de tamaño
    if (!this.listMode) window.setTimeout(() => { if (this.selected === i) this.centerOn(m); }, 280);
  }
}
