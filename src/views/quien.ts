// «Quién es quién»: un gran buscador de entrada y, al elegir una ficha, su grafo con ella en el centro y todas sus relaciones
// por capas agrupadas por tipo. Al pulsar un nodo se recentra (el historial del navegador permite volver). También traza el camino
// más corto entre dos fichas («¿cómo se relaciona X con Y?»).
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { select } from 'd3-selection';
import { IDX, IMGS, REL_LABEL, REL_ORDER, TYPE_COLOR, TYPE_LABEL, avatarHtml, relLabel, shownName, evText, GREY_RELS, ensureImgs, ensureIndex, esc, fmtN, findByTitle, getDetail, imgUrl, impOf, initials, isFace, loadData, nameOf, relStyle, rootOf, typeOf, type Detail } from '../data';
import { go, navigateToFicha, parseHash } from '../nav';
import { KIN_RELS, closeQuiet, kinSubLabel, showFicha } from '../panel';
import { attachSearch, searchIndex } from '../search';
import type { View } from './view';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag: string, attrs: Record<string, string | number> = {}, parent?: Element) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); parent?.append(e); return e; };
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ex = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
interface Group { key: string; label: string; color: string; rel: string; dir?: number; ids: number[]; weak: boolean; hidden: boolean; subs?: Group[] }
interface PlacedNode { i: number; x: number; y: number; r: number; g: Group | null; more?: Group; extra?: number }
interface EdgesData { rels: string[]; e: number[] }
const WEAKREL = new Set(['primera_aparicion', 'aparece_en', 'es_de_raza', 'clase', 'relacionado', 'doblado_por']);
const BASE_SHOWN = 8, STEP = 24, SP = 128;
const EXAMPLES = ['Monkey D. Luffy', 'Gomu Gomu no Mi', 'Marineford', 'Piratas de Sombrero de Paja', 'Thousand Sunny', 'Edward Newgate', 'Wano', 'Roronoa Zoro'];
const SEAS = ['East Blue', 'West Blue', 'North Blue', 'South Blue', 'Paradise', 'Nuevo Mundo', 'Grand Line', 'Red Line', 'Calm Belt'];
const ORGS = ['Piratas de Sombrero de Paja', 'Marina', 'Ejército Revolucionario', 'Gobierno Mundial', 'Piratas de Barbablanca', 'Piratas de Big Mom', 'Piratas de las Bestias', 'Piratas del Pelirrojo', 'Cuatro Emperadores', 'Piratas de Barbanegra', 'Shichibukai', 'Piratas Heart'];

export class QuienView implements View {
  private root!: HTMLElement; private home!: HTMLElement; private stage!: HTMLElement; private pathBox!: HTMLElement; private svg!: SVGSVGElement; private vp!: SVGGElement; private disposers: (() => void)[] = [];
  private zb!: ZoomBehavior<SVGSVGElement, unknown>; private t: ZoomTransform = zoomIdentity; private ro?: ResizeObserver; private token = 0; private cur = -1; private bbox = { x0: -300, y0: -300, x1: 300, y1: 300 };
  private groups: Group[] = []; private shown = new Map<string, number>(); private center = -1; private listMode = false; private edges: { adj: Map<number, [number, number, number][]>; rels: string[] } | null = null; private chosen: [number, number] = [-1, -1];
  private why = new Map<number, string>(); private nativeFs = false; private maxPanel = false; canExpand = false;
  // «maximizado»: oculta cabecera y pie (la cabecera baja al enfocar el buscador), la franja del grafo flota sobre el lienzo y la ficha lateral se pliega; al salir se recupera el estado exacto
  private setMax(on: boolean, native = true) {
    const body = document.body; if (on === body.classList.contains('q-max')) return; const btn = this.stage.querySelector('#q-full') as HTMLElement;
    if (on) { this.maxPanel = !(document.getElementById('panel') as HTMLElement).hidden; body.classList.add('q-max'); closeQuiet(); btn.setAttribute('aria-pressed', 'true'); btn.setAttribute('aria-label', 'Salir de la pantalla completa'); btn.textContent = '✕'; this.nativeFs = false; const r = native ? document.documentElement.requestFullscreen?.() : undefined; if (r) r.then(() => { this.nativeFs = true; }, () => { this.nativeFs = false; }); }
    else { body.classList.remove('q-max'); btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', 'Pantalla completa del grafo'); btn.textContent = '⛶'; const was = this.nativeFs; this.nativeFs = false; if (was && document.fullscreenElement) void document.exitFullscreen().catch(() => {}); if (this.maxPanel && this.center >= 0) void showFicha(this.center, { canExpand: false }); this.maxPanel = false; }
    for (const ms of [60, 250, 600]) window.setTimeout(() => this.fit(false), ms);
  } noAutoPanel = () => { if (document.body.classList.contains('q-max')) return true; try { return localStorage.getItem('opa-panel') === 'cerrado'; } catch { return false; } }; // la ficha lateral se abre sola salvo que el usuario la haya plegado (se recuerda)

  async mount(host: HTMLElement) {
    const box = document.createElement('div'); box.className = 'quien'; host.append(box); this.root = box;
    await Promise.all([ensureIndex(), ensureImgs()]);
    box.innerHTML = `<h1 class="sr">Quién es quién: busca cualquier ficha y mira su red de relaciones</h1><section class="q-home" id="q-home" aria-label="Buscar una ficha"></section><section class="q-path" id="q-path" hidden aria-live="polite"></section><section class="q-stage" id="q-stage" hidden aria-label="Grafo de relaciones"></section>`;
    this.home = box.querySelector('#q-home') as HTMLElement; this.pathBox = box.querySelector('#q-path') as HTMLElement; this.stage = box.querySelector('#q-stage') as HTMLElement;
    (window as unknown as { __qCount: number; __qFind: (n: string) => number | undefined }).__qCount = IDX!.n.length; (window as unknown as { __qFind: (n: string) => number | undefined; __qType: (i: number) => string }).__qFind = (n) => findByTitle(n); (window as unknown as { __qType: (i: number) => string }).__qType = (i) => typeOf(i); (window as unknown as { __qName: (i: number) => string }).__qName = (i) => nameOf(i); (window as unknown as { __qGroups: (i: number) => Promise<[string, number[]][]> }).__qGroups = async (i) => (this.buildGroups(i, await getDetail(i))).flatMap((g) => (g.subs ? [g, ...g.subs] : [g])).map((g) => [g.label, g.ids]);
    await this.renderHome();
    this.buildStage();
  }
  unmount() { document.body.classList.remove('q-graph', 'q-max'); this.token++; this.ro?.disconnect(); this.disposers.forEach((d) => d()); this.root.remove(); }
  focus(i: number | null) { const q = parseHash().q; const de = q.get('de'), a = q.get('a'); if (i === null && de && a) { void this.showPath(de, a); return; } if (i === null) { this.show('home'); return; } void this.showGraph(rootOf(i)); }
  private show(w: 'home' | 'path' | 'graph') { if (w !== 'graph') document.body.classList.remove('q-graph', 'q-max'); this.home.hidden = w !== 'home'; this.pathBox.hidden = w !== 'path'; this.stage.hidden = w !== 'graph'; this.root.dataset.mode = w; if (w === 'home') this.cur = -1; }

  // ---------- portada: gran buscador y descubrimiento ----------
  private async renderHome() {
    const news = await loadData<{ n: { d: string; t: string; n: string; i?: number }[] }>('news').catch(() => ({ n: [] }));
    const feat = IDX!.n.map((_, i) => i).filter((i) => typeOf(i) === 'personaje' && !!IMGS?.[i] && rootOf(i) === i).sort((a, b) => impOf(b) - impOf(a)).slice(0, 14);
    const chip = (n: string) => { const i = findByTitle(n); return i === undefined ? '' : `<a class="q-chip" href="#/quien/${encodeURIComponent(nameOf(i))}">${esc(nameOf(i))}</a>`; };
    const sagas = (await loadData<{ sg: { n: string }[] }>('chap')).sg.map((s) => s.n).filter((n) => !/^Arcos/.test(n));
    const newsHtml = news.n.filter((x) => x.i !== undefined && x.t !== 'x').slice(0, 8).map((x) => `<li><a class="q-new" href="#/quien/${encodeURIComponent(nameOf(x.i!))}">${avatarHtml(x.i!, 34)}<span><b>${esc(nameOf(x.i!))}</b><small>${esc(TYPE_LABEL[typeOf(x.i!)] ?? '')} · ${x.t === 'c' ? 'nueva' : 'actualizada'} el ${esc(x.d)}</small></span></a></li>`).join('');
    this.home.innerHTML = `<div class="q-hero"><p class="q-eyebrow">Quién es quién</p><h2>¿De quién o de qué quieres saber?</h2><p class="q-lead">Escribe cualquier personaje, lugar, fruta del Diablo, barco, organización, técnica u objeto y mira <b>su red de relaciones</b>, con la ficha en el centro.</p>
      <form class="bigsearch" id="q-form" role="search"><div class="bs-field"><span class="mag" aria-hidden="true">⌕</span><input id="qs" type="search" placeholder="Prueba con «Luffy», «Gomu Gomu», «Marineford»…" aria-label="Buscar una ficha para ver su grafo de relaciones" autocomplete="off" enterkeyhint="search"><div id="qres" class="results" role="listbox" hidden></div></div><button class="btn" type="submit">Buscar</button></form>
      <p class="q-ex"><span>Prueba con</span> ${EXAMPLES.map(chip).join('')} <button class="q-chip rnd" id="q-rnd" type="button">🎲 Al azar</button></p>
      <details class="q-pathform" id="q-pathform"><summary>¿Cómo se relaciona una ficha con otra?</summary><form id="q-pf" class="pf"><div class="pf-row"><label for="pa">Desde</label><div class="picker"><input id="pa" type="search" placeholder="Primera ficha" autocomplete="off"><div id="pra" class="results" role="listbox" hidden></div></div></div><div class="pf-row"><label for="pb">Hasta</label><div class="picker"><input id="pb" type="search" placeholder="Segunda ficha" autocomplete="off"><div id="prb" class="results" role="listbox" hidden></div></div></div><button class="btn" type="submit">Trazar el camino</button><p class="pf-msg" id="pf-msg" role="status"></p></form></details></div>
      <div class="q-disc"><section><h3>Personajes destacados</h3><ul class="q-feat">${feat.map((i) => `<li><a href="#/quien/${encodeURIComponent(nameOf(i))}">${avatarHtml(i, 54)}<span>${esc(nameOf(i))}</span></a></li>`).join('')}</ul></section>
      ${newsHtml ? `<section><h3>Últimas fichas actualizadas</h3><ul class="q-news">${newsHtml}</ul></section>` : ''}
      <section><h3>Explorar por saga</h3><p class="q-chips">${sagas.map(chip).join('')}</p><h3>por mar</h3><p class="q-chips">${SEAS.map(chip).join('')}</p><h3>por organización</h3><p class="q-chips">${ORGS.map(chip).join('')}</p></section></div>`;
    const input = this.home.querySelector('#qs') as HTMLInputElement, boxR = this.home.querySelector('#qres') as HTMLElement;
    this.disposers.push(await attachSearch(input, boxR, { onChoose: (i) => navigateToFicha(i) }));
    (this.home.querySelector('#q-form') as HTMLFormElement).addEventListener('submit', (e) => { e.preventDefault(); const h = searchIndex(input.value, 1)[0]; if (h !== undefined) navigateToFicha(h); else { boxR.innerHTML = '<div class="none" role="status">No encuentro esa ficha. Prueba con otro nombre.</div>'; boxR.hidden = false; } });
    (this.home.querySelector('#q-rnd') as HTMLElement).addEventListener('click', () => { const pool = IDX!.n.map((_, i) => i).filter((i) => rootOf(i) === i && ['personaje', 'lugar', 'fruta_del_diablo', 'barco', 'organizacion', 'tecnica'].includes(typeOf(i))).sort((a, b) => impOf(b) - impOf(a)).slice(0, 700); navigateToFicha(pool[Math.floor(Math.random() * pool.length)]!); });
    for (const [k, idn, bn] of [[0, 'pa', 'pra'], [1, 'pb', 'prb']] as const) this.disposers.push(await attachSearch(this.home.querySelector('#' + idn) as HTMLInputElement, this.home.querySelector('#' + bn) as HTMLElement, { clear: false, onChoose: (i) => { this.chosen[k] = rootOf(i); (this.home.querySelector('#' + idn) as HTMLInputElement).value = nameOf(rootOf(i)); } }));
    (this.home.querySelector('#q-pf') as HTMLFormElement).addEventListener('submit', (e) => { e.preventDefault(); const va = (this.home.querySelector('#pa') as HTMLInputElement).value, vb = (this.home.querySelector('#pb') as HTMLInputElement).value; const a = this.chosen[0] >= 0 && nameOf(this.chosen[0]) === va ? this.chosen[0] : searchIndex(va, 1)[0], b = this.chosen[1] >= 0 && nameOf(this.chosen[1]) === vb ? this.chosen[1] : searchIndex(vb, 1)[0]; const msg = this.home.querySelector('#pf-msg') as HTMLElement; if (a === undefined || b === undefined) { msg.textContent = 'Elige las dos fichas de la lista de sugerencias.'; return; } msg.textContent = ''; go('quien', null, { de: nameOf(rootOf(a)), a: nameOf(rootOf(b)) }); });
    const q = parseHash().q; if (q.get('de') && q.get('a')) (this.home.querySelector('#q-pathform') as HTMLDetailsElement).open = true;
  }

  // ---------- grafo con la ficha en el centro ----------
  private buildStage() {
    this.stage.innerHTML = `<div class="q-bar" id="q-bar"><div class="q-title"><h2 id="q-name"></h2><span class="q-type" id="q-type"></span><button class="btn small q-open" id="q-open">Ver la ficha</button></div><details class="q-filt" id="q-filt"><summary><span class="fs-t">Relaciones</span> <span class="fs-n" id="q-fn"></span></summary><div class="q-fbody"><p class="q-fhelp"><b>Mostrar / ocultar relaciones:</b> pulsa un tipo para ocultarlo o volver a mostrarlo (✓ = visible).</p><div class="q-ftools"><button class="btn small" data-g="*">Mostrar todo</button> <button class="btn ghost small" data-g="-">Ocultar todo</button></div><div class="q-legend" id="q-legend" role="group" aria-label="Tipos de relación: pulsa para mostrar u ocultar"></div></div></details><div class="seg" role="group" aria-label="Forma de ver las relaciones"><button id="q-vg" aria-pressed="true">Grafo</button><button id="q-vl" aria-pressed="false">Lista</button></div><button class="icon-btn q-find" id="q-find" aria-label="Buscar una ficha" title="Buscar ( / )">⌕</button><button class="icon-btn q-full" id="q-full" aria-label="Pantalla completa del grafo" aria-pressed="false" title="Pantalla completa (Esc para salir)">⛶</button></div>
      <div class="q-canvas" id="q-canvas"><svg class="qsvg" role="group" aria-label="Grafo de relaciones de la ficha elegida: pulsa un nodo para centrarlo"></svg><div class="gtools" role="toolbar" aria-label="Zoom del grafo"><button data-z="in" aria-label="Acercar">＋</button><button data-z="out" aria-label="Alejar">－</button><button data-z="fit" aria-label="Encajar el grafo" title="Encajar">⤢</button></div><p class="q-hint" id="q-hint">Pulsa un nodo para centrarlo · pellizca o usa la rueda para ampliar</p></div>
      <div class="q-list" id="q-list" hidden></div>`;
    this.svg = this.stage.querySelector('svg')!; this.vp = el('g', { class: 'vp' }, this.svg) as SVGGElement;
    this.zb = zoom<SVGSVGElement, unknown>().scaleExtent([0.25, 4]).on('zoom', (e) => { this.t = e.transform; this.vp.setAttribute('transform', String(e.transform)); const lf = Math.min(17, Math.max(12.5, 11.5 / e.transform.k)); this.svg.style.setProperty('--lf', lf.toFixed(1)); this.svg.classList.toggle('lf-big', lf > 14.5); }); select(this.svg).call(this.zb).on('dblclick.zoom', null);
    this.ro = new ResizeObserver(() => { if (!this.stage.hidden) this.fit(false); }); this.ro.observe(this.stage.querySelector('#q-canvas') as HTMLElement);
    this.stage.querySelector('.gtools')!.addEventListener('click', (e) => { const z = (e.target as HTMLElement).closest<HTMLElement>('[data-z]')?.dataset.z; if (z === 'in') select(this.svg).call(this.zb.scaleBy, 1.4); else if (z === 'out') select(this.svg).call(this.zb.scaleBy, 1 / 1.4); else if (z === 'fit') this.fit(true); });
    this.svg.addEventListener('click', (e) => { const n = (e.target as Element).closest<SVGElement>('[data-i]'); if (n) { navigateToFicha(+n.dataset.i!); return; } const m = (e.target as Element).closest<SVGElement>('[data-more]'); if (m) this.expand(m.dataset.more!); });
    this.svg.addEventListener('keydown', (e) => { if (e.key !== 'Enter' && e.key !== ' ') return; const n = (e.target as Element).closest<SVGElement>('[data-i],[data-more]'); if (n) { e.preventDefault(); (n as unknown as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
    (this.stage.querySelector('#q-full') as HTMLElement).addEventListener('click', () => this.setMax(!document.body.classList.contains('q-max')));
    (this.stage.querySelector('#q-find') as HTMLElement).addEventListener('click', () => (document.getElementById('q') as HTMLInputElement).focus());
    const onFs = () => { if (!document.fullscreenElement && this.nativeFs && document.body.classList.contains('q-max')) this.setMax(false, false); }; const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && document.body.classList.contains('q-max') && !(e.target as HTMLElement).closest('input')) this.setMax(false); };
    document.addEventListener('fullscreenchange', onFs); document.addEventListener('keydown', onEsc); this.disposers.push(() => { document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('keydown', onEsc); });
    (this.stage.querySelector('#q-open') as HTMLElement).addEventListener('click', () => { try { localStorage.removeItem('opa-panel'); } catch { /* sin almacenamiento */ } void showFicha(this.center, { canExpand: false }); });
    const onClose = (e: Event) => { if ((e.target as HTMLElement).closest('#pb-close')) { try { localStorage.setItem('opa-panel', 'cerrado'); } catch { /* sin almacenamiento */ } } }; document.addEventListener('click', onClose, true); this.disposers.push(() => document.removeEventListener('click', onClose, true));
    (this.stage.querySelector('#q-vg') as HTMLElement).addEventListener('click', () => this.setList(false)); (this.stage.querySelector('#q-vl') as HTMLElement).addEventListener('click', () => this.setList(true));
    (this.stage.querySelector('#q-filt') as HTMLElement).addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-g]'); if (!b) return; if (b.dataset.g === '*') this.groups.forEach((g) => { g.hidden = false; g.subs?.forEach((s) => (s.hidden = false)); }); else if (b.dataset.g === '-') this.groups.forEach((g) => { g.hidden = true; g.subs?.forEach((s) => (s.hidden = true)); }); else { const all = this.groups.flatMap((g) => (g.subs ? [g, ...g.subs] : [g])); const g = all.find((x) => x.key === b.dataset.g); if (g) { g.hidden = !g.hidden; if (g.subs) g.subs.forEach((s) => (s.hidden = g.hidden)); else { const par = this.groups.find((x) => x.subs?.includes(g)); if (par) par.hidden = par.subs!.every((s) => s.hidden); } if (g.subs === undefined && !g.hidden) { const par = this.groups.find((x) => x.subs?.includes(g)); if (par) par.hidden = false; } } } this.draw(false); });
    (this.stage.querySelector('#q-list') as HTMLElement).addEventListener('click', (e) => { const m = (e.target as HTMLElement).closest<HTMLElement>('[data-more]'); if (m) { this.expand(m.dataset.more!); } });
  }
  private setList(l: boolean) { this.listMode = l; (this.stage.querySelector('#q-canvas') as HTMLElement).hidden = l; (this.stage.querySelector('#q-list') as HTMLElement).hidden = !l; (this.stage.querySelector('#q-vg') as HTMLElement).setAttribute('aria-pressed', String(!l)); (this.stage.querySelector('#q-vl') as HTMLElement).setAttribute('aria-pressed', String(l)); if (l) this.renderList(); else this.fit(false); }
  private expand(key: string) { this.shown.set(key, (this.shown.get(key) ?? BASE_SHOWN) + STEP); this.draw(false); if (this.listMode) this.renderList(); }

  private async showGraph(i: number) {
    this.show('graph'); document.body.classList.add('q-graph'); const my = ++this.token; if (i === this.cur) return; const prev = this.cur; this.cur = i;
    const d = await getDetail(i); if (my !== this.token) return;
    this.center = i; this.shown.clear(); this.groups = this.buildGroups(i, d);
    // las categorías coloreadas (vínculos con sentido) se ven; las grises (menciones, raza, primera aparición…) empiezan ocultas y se activan en «Relaciones»
    this.groups.forEach((g) => { g.hidden = GREY_RELS.has(g.rel); });
    (this.stage.querySelector('#q-name') as HTMLElement).textContent = nameOf(i); const ty = typeOf(i); const tb = this.stage.querySelector('#q-type') as HTMLElement; tb.textContent = TYPE_LABEL[ty] ?? ty; tb.style.setProperty('--c', TYPE_COLOR[ty] ?? '#888');
    this.draw(true, prev >= 0);
    document.getElementById('view')!.setAttribute('aria-busy', 'false');
  }
  private buildGroups(self: number, d: Detail): Group[] {
    const seen = new Set<number>([self]); const gm = new Map<string, Group>(); const order = (rel: string) => { const k = REL_ORDER.indexOf(rel); return k < 0 ? 99 : k; };
    this.why = new Map(); const rows = d.rl.map(([r, j, dir, ev]) => ({ rel: IDX!.rels[r]!, j: rootOf(j), dir, why: ev === undefined ? '' : evText(IDX!.ev?.[ev], self, rootOf(j), dir) })).filter((x) => x.rel !== 'categorizado_en').sort((a, b) => order(a.rel) - order(b.rel) || a.dir - b.dir);
    const SOCIAL = new Set(['familiar_de', 'companero_de', 'tripulacion_de', 'aliado_de', 'amigo_de', 'coincidido_con', 'mascota_de', 'enemigo_de', 'enfrenta_a']); const inG = new Set<string>();
    for (const x of rows) { const soc = SOCIAL.has(x.rel); if (x.j < 0 || (!soc && seen.has(x.j))) continue; if (soc) { const kk = x.rel + '|' + x.j; if (inG.has(kk)) continue; inG.add(kk); } else seen.add(x.j); if (x.why && !this.why.has(x.j)) this.why.set(x.j, x.why); const lab = '§' + x.rel + '|' + x.dir; const key = lab; let g = gm.get(key); if (!g) { g = { key, label: lab, color: relStyle(x.rel).c, rel: x.rel, dir: x.dir, ids: [], weak: WEAKREL.has(x.rel), hidden: false }; gm.set(key, g); } g.ids.push(x.j); }
    const add = (key: string, label: string, ids: number[]) => { const u = [...new Set(ids.map(rootOf))].filter((j) => !seen.has(j)); u.forEach((j) => seen.add(j)); if (u.length) gm.set(key, { key, label, color: '#9fb4d0', rel: 'menciona', ids: u, weak: true, hidden: false }); };
    add('m|0', '§menciona|0', d.m); add('m|1', '§menciona|1', d.mb);
    const gs0 = [...gm.values()]; const byLab = new Map<string, Group>(); for (const g of gs0) { g.ids.sort((a, b) => impOf(b) - impOf(a)); const [rl, dr] = g.label.slice(1).split('|'); const lab = relLabel(rl!, +dr!, self, g.ids.length, g.ids); const ex = byLab.get(lab); if (ex) { ex.ids = [...new Set([...ex.ids, ...g.ids])].sort((a, b) => impOf(b) - impOf(a)); } else { g.label = lab; g.key = lab; byLab.set(lab, g); } } const gs = [...byLab.values()];
    // «Familia» es una categoría padre con subgrupos por parentesco (Padres, Hermanos, Abuelos…), ordenados por cercanía
    const kin = gs.filter((g) => KIN_RELS.includes(g.rel)); let res = gs;
    if (kin.length >= 2 || (kin.length === 1 && kin[0]!.rel !== 'familiar_de')) {
      const ord = (g: Group) => { const r = KIN_RELS.indexOf(g.rel); const dd = g.rel === 'progenitor_de' || g.rel === 'progenitor_adoptivo_de' ? (g.dir === 1 ? 0 : 1) : (g.dir ?? 0); return r * 2 + dd; };
      const subs = [...kin].sort((a, b) => ord(a) - ord(b)); subs.forEach((s) => { s.label = kinSubLabel(s); s.key = s.label; });
      const parent: Group = { key: 'Familia', label: 'Familia', color: relStyle('familiar_de').c, rel: 'familiar_de', ids: [...new Set(kin.flatMap((g) => g.ids))], weak: false, hidden: false, subs };
      res = []; let put = false; for (const g of gs) { if (KIN_RELS.includes(g.rel)) { if (!put) { res.push(parent); put = true; } } else res.push(g); }
    }
    return res.sort((a, b) => (a.weak ? 1 : 0) - (b.weak ? 1 : 0)); // las estructuradas primero; el orden interno ya sigue REL_ORDER
  }

  // ---------- disposición por capas: un sector por tipo de relación ----------
  private layout(): { nodes: PlacedNode[]; pills: { x: number; y: number; w: number; g: Group; rest: number; from?: { x: number; y: number } }[] } {
    type P = { x: number; y: number; w: number; g: Group; rest: number; from?: { x: number; y: number } };
    const gs = this.groups.filter((g) => !g.hidden); const nodes: PlacedNode[] = [{ i: this.center, x: 0, y: 0, r: 60, g: null }]; const pills: P[] = [];
    const many = this.groups.length > 6; const capOf = (g: Group) => this.shown.get(g.key) ?? (many ? (g.weak ? 3 : 6) : g.weak ? 6 : BASE_SHOWN);
    interface Item { g: Group; vis: number[]; rest: number; w: number; subs?: { g: Group; open: boolean; vis: number[]; rest: number; w: number }[] }
    const items: Item[] = gs.map((g) => {
      if (g.subs) { const vs = g.subs.filter((s) => !s.hidden); const expAll = g.ids.length <= 8; const subs = vs.map((s) => { const open = expAll || this.shown.has(s.key); const vis = open ? s.ids.slice(0, this.shown.get(s.key) ?? BASE_SHOWN) : []; const rest = s.ids.length - vis.length; return { g: s, open, vis, rest, w: vis.length + (rest > 0 ? 1 : 0) + 1.8 }; }); return { g, vis: [], rest: 0, subs, w: subs.reduce((a, b) => a + b.w, 0) + 1 }; }
      const vis = g.ids.slice(0, capOf(g)); const rest = g.ids.length - vis.length; return { g, vis, rest, w: vis.length + (rest > 0 ? 1 : 0) + 1.6 };
    });
    const tot = items.reduce((a, b) => a + b.w, 0) || 1; let a0 = -Math.PI / 2;
    const putNodes = (g: Group, vis: number[], rest: number, from: number, th: number, r0: number) => {
      const list: (number | 'more')[] = [...vis, ...(rest > 0 ? (['more'] as const) : [])]; let placed = 0, ring = 0;
      while (placed < list.length) { const r = r0 + ring * 118; const cap = Math.max(1, Math.floor((r * th) / SP)); const take = Math.min(cap, list.length - placed); for (let c = 0; c < take; c++) { const a = from + (th * (c + 0.5)) / take; const v = list[placed + c]!; if (v === 'more') nodes.push({ i: -1, x: Math.cos(a) * r, y: Math.sin(a) * r, r: 28, g, more: g, extra: rest }); else nodes.push({ i: v, x: Math.cos(a) * r, y: Math.sin(a) * r, r: 31, g }); } placed += take; ring++; }
    };
    items.forEach((it, k) => {
      const th = (it.w / tot) * Math.PI * 2; const am = a0 + th / 2; const label = `${it.g.label} · ${it.g.ids.length}`; const w = label.length * 7.4 + 44;
      // nivel 2: la pastilla del grupo, lo bastante lejos del centro para que quepa en su sector (y alternando radio con las vecinas)
      const pr = Math.min(230, Math.max(125 + (k % 3) * 38, (w + 12) / Math.max(th, 0.2)));
      const pp: P = { x: Math.cos(am) * pr, y: Math.sin(am) * pr, w, g: it.g, rest: 0 }; pills.push(pp);
      if (it.subs) {
        // nivel 3: subpastillas por parentesco colgando de «Familia»; nivel 4: los nodos de cada subgrupo (plegados con contador si son muchos)
        const tw = it.subs.reduce((a, b) => a + b.w, 0) || 1; let s0 = a0;
        it.subs.forEach((sb, q) => { const ths = th * (sb.w / tw); const ams = s0 + ths / 2; const sl = `${sb.g.label} · ${sb.g.ids.length}`; const sw = sl.length * 7 + 34; const ps = pr + 105 + (q % 2) * 26; const sp: P = { x: Math.cos(ams) * ps, y: Math.sin(ams) * ps, w: sw, g: sb.g, rest: sb.open ? sb.rest : sb.g.ids.length, from: { x: pp.x, y: pp.y } }; pills.push(sp); putNodes(sb.g, sb.vis, sb.open ? sb.rest : 0, s0, ths, Math.max(330, ps + 130)); s0 += ths; });
      } else { pp.rest = it.rest; putNodes(it.g, it.vis, it.rest, a0, th, Math.max(300, pr + 135)); }
      a0 += th;
    });
    return { nodes, pills };
  }
  private draw(animate: boolean, fromOther = false) {
    const { nodes, pills } = this.layout(); const vp = this.vp; vp.innerHTML = ''; const defs = el('defs', {}, vp); defs.innerHTML = '<radialGradient id="q-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd773" stop-opacity=".55"/><stop offset=".6" stop-color="#ffd773" stop-opacity=".12"/><stop offset="1" stop-color="#ffd773" stop-opacity="0"/></radialGradient>';
    const lg = el('g', { class: 'q-edges' }, vp), pg = el('g', { class: 'q-pills' }, vp), ng = el('g', { class: 'q-nodes' }, vp);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const pillOf = new Map(pills.map((p) => [p.g.key, p])); const anim = animate && !reduce();
    const curve = (ax: number, ay: number, bx: number, by: number, bend: number) => { const mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1; return `M${ax.toFixed(1)} ${ay.toFixed(1)} Q${(mx - (dy / len) * len * bend).toFixed(1)} ${(my + (dx / len) * len * bend).toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`; };
    nodes.forEach((n, k) => { x0 = Math.min(x0, n.x - n.r - 44); x1 = Math.max(x1, n.x + n.r + 44); y0 = Math.min(y0, n.y - n.r - 26); y1 = Math.max(y1, n.y + n.r + 54); if (n.g) { const p = pillOf.get(n.g.key)!; const d = relStyle(n.g.rel).d; el('path', { d: curve(p.x, p.y, n.x, n.y, 0.08), class: 'q-e', fill: 'none', stroke: n.g.color, 'stroke-width': 1.8, 'stroke-opacity': 0.7, 'stroke-linecap': 'round', pathLength: 1, ...(d ? { 'stroke-dasharray': d } : {}), style: anim ? `animation-delay:${Math.min(450, 180 + k * 14)}ms` : '' }, lg); } });
    pills.forEach((p, k) => el('path', { d: curve(p.from?.x ?? 0, p.from?.y ?? 0, p.x, p.y, 0.1), class: p.from ? 'q-e' : 'q-e core', fill: 'none', stroke: p.g.color, 'stroke-width': p.from ? 2.6 : 4, 'stroke-opacity': 0.85, 'stroke-linecap': 'round', pathLength: 1, style: anim ? `animation-delay:${60 + k * 40}ms` : '' }, lg));
    this.bbox = { x0, y0, x1, y1 };
    const ICON: Record<string, string> = { miembro_de: '⚑', capitan_de: '♛', dirige: '♛', dirigido_por: '♛', familiar_de: '♥', progenitor_de: '♥', progenitor_adoptivo_de: '♥', hermano_de: '♥', hermano_adoptivo_de: '♥', abuelo_de: '♥', tio_de: '♥', conyuge_de: '♥', usa_barco: '⚓', come: '◆', combatiente_en: '⚔', originario_de: '⌖', reside_en: '⌖', base_en: '⌖', en_region: '⌖', parte_de: '▣', evoluciona_en: '↻', menciona: '✎' };
    for (const p of pills) { const ic = ICON[p.g.rel] ?? '★'; const label = `${ic} ${p.g.label} · ${p.g.ids.length}`; const g = el('g', { class: `q-pill ${p.rest > 0 ? 'has-more' : ''} ${p.from ? 'sub' : ''}`, transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`, style: `--c:${p.g.color}`, ...(p.rest > 0 ? { 'data-more': p.g.key, tabindex: 0, role: 'button', 'aria-label': `${p.g.label}: ${p.g.ids.length} fichas. Pulsa para ver más` } : {}) }, pg); el('rect', { x: -p.w / 2, y: -15, width: p.w, height: 30, rx: 15 }, g); const t = el('text', { y: 5, 'text-anchor': 'middle' }, g); t.textContent = label; const tt = el('title', {}, g); tt.textContent = `${p.g.label}: ${p.g.ids.length}`; }
    const wrap = (s: string, n: number): string[] => { const w = s.split(/\s+/); const out: string[] = []; let cur = ''; for (const x of w) { if ((cur + ' ' + x).trim().length > n && cur) { out.push(cur); cur = x; } else cur = (cur + ' ' + x).trim(); } if (cur) out.push(cur); return out.length > 3 ? [out[0]!, out[1]!, ex(out.slice(2).join(' '), n * 2)] : out; };
    nodes.forEach((n, k) => {
      const delay = anim ? `animation-delay:${Math.min(500, 120 + k * 16)}ms;` : '';
      if (n.more) { const g = el('g', { class: 'qn more', 'data-more': n.more.key, transform: `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`, tabindex: 0, role: 'button', 'aria-label': `Ver más de «${n.more.label}»: ${n.extra} fichas`, style: `${delay}--c:${n.more.color}` }, ng); el('circle', { r: n.r + 2, class: 'qn-c' }, g); const t = el('text', { y: 5, 'text-anchor': 'middle', class: 'qn-plus' }, g); t.textContent = `+${n.extra}`; const l = el('text', { y: n.r + 18, 'text-anchor': 'middle', class: 'qn-l' }, g); l.textContent = 'ver más'; return; }
      const i = n.i, ty = typeOf(i), col = TYPE_COLOR[ty] ?? '#888', c = n.g === null; const g = el('g', { class: `qn ${c ? 'center' : ''}`, 'data-i': i, transform: `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`, tabindex: 0, role: 'button', 'aria-label': c ? `${nameOf(i)}, ficha central` : `${nameOf(i)}, ${n.g!.label}. Pulsa para centrar el grafo en esta ficha`, style: `${delay}--c:${col};--gc:${n.g?.color ?? '#ffe9a8'}` }, ng);
      if (c) { el('circle', { r: n.r * 2.6, fill: 'url(#q-glow)', 'pointer-events': 'none' }, g); el('circle', { r: n.r + 9, class: 'q-halo' }, g); } else el('circle', { r: n.r + 11, fill: 'transparent' }, g);
      el('circle', { r: n.r + 2, cy: 4, class: 'qn-sh' }, g); el('circle', { r: n.r, class: 'qn-c', fill: col }, g);
      const u = IMGS?.[i] ? imgUrl(IMGS[i]!, c ? 280 : 120) : ''; const ini = el('text', { y: c ? 12 : 7, 'text-anchor': 'middle', class: 'qn-i', 'font-size': c ? 34 : 20 }, g); ini.textContent = initials(nameOf(i));
      if (u) { const im = el('image', { href: u, x: -n.r, y: -n.r, width: n.r * 2, height: n.r * 2, preserveAspectRatio: isFace(i) ? 'xMidYMin slice' : 'xMidYMid slice', style: 'clip-path:circle(50%)', referrerpolicy: 'no-referrer' }, g); im.addEventListener('error', () => im.remove()); }
      const nm = shownName(i), lines = wrap(nm, c ? 26 : 16), lab = el('text', { 'text-anchor': 'middle', class: c ? 'qn-l big' : 'qn-l' }, g); lines.forEach((ln, q) => { const ts = el('tspan', { x: 0, y: n.r + (c ? 26 : 17) + q * (c ? 21 : 14) }, lab); ts.textContent = ln; }); const tt = el('title', {}, g); tt.textContent = nm + (this.why.get(i) ? ' — ¿Por qué? ' + this.why.get(i) : '');
    });
    this.renderLegend(); if (this.listMode) this.renderList();
    this.fit(false); if (animate && !reduce()) { vp.classList.remove('enter'); void (vp as unknown as HTMLElement).getBoundingClientRect; vp.classList.add('enter'); window.setTimeout(() => vp.classList.remove('enter'), 900); }
    const hint = this.stage.querySelector('#q-hint') as HTMLElement | null; if (hint && fromOther) hint.classList.add('off'); else if (hint) window.setTimeout(() => hint.classList.add('off'), 7000);
  }
  private renderLegend() {
    const lg = this.stage.querySelector('#q-legend') as HTMLElement; const chip = (g: Group, sub = false) => `<button class="q-lg ${sub ? 'sub' : ''} ${g.hidden ? 'off' : ''}" data-g="${esc(g.key)}" role="switch" aria-checked="${!g.hidden}" style="--c:${g.color}"><span class="chk" aria-hidden="true">${g.hidden ? '' : '✓'}</span>${esc(g.label)} <b>${fmtN(g.ids.length)}</b></button>`;
    const leaves = this.groups.flatMap((g) => (g.subs ? [g, ...g.subs] : [g])); const on = leaves.filter((g) => !g.hidden).length;
    lg.innerHTML = this.groups.map((g) => (g.subs ? `<span class="q-famgrp" role="group" aria-label="Familia y sus parentescos">${chip(g)}<span class="q-subs">${g.subs.map((s) => chip(s, true)).join('')}</span></span>` : chip(g))).join('') || '<span class="hint">Esta ficha no tiene relaciones registradas.</span>';
    (this.stage.querySelector('#q-fn') as HTMLElement).textContent = leaves.length ? `${on} de ${leaves.length} activas${on < leaves.length ? ` · ${leaves.length - on} ocultas` : ''}` : 'sin relaciones'; (this.stage.querySelector('#q-filt') as HTMLElement).hidden = !this.groups.length;
    if (!this.groups.length) this.svg.setAttribute('aria-label', 'Esta ficha no tiene relaciones registradas en la wiki.');
  }
  private fit(animate: boolean) {
    const cv = this.stage.querySelector('#q-canvas') as HTMLElement; const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return; const b = this.bbox; const bw = b.x1 - b.x0, bh = b.y1 - b.y0; const k = Math.min(1.1, Math.min(w / bw, h / bh) * 0.97);
    const to = zoomIdentity.translate(w / 2 - ((b.x0 + b.x1) / 2) * k, h / 2 - ((b.y0 + b.y1) / 2) * k).scale(k); const s = select(this.svg); this.zb.scaleExtent([Math.min(0.25, k * 0.6), 4]);
    if (animate && !reduce()) { const f = this.t, t0 = performance.now(); const step = (now: number) => { const p = Math.min(1, (now - t0) / 450), e = 1 - Math.pow(1 - p, 3); s.call(this.zb.transform, zoomIdentity.translate(f.x + (to.x - f.x) * e, f.y + (to.y - f.y) * e).scale(f.k + (to.k - f.k) * e)); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); } else s.call(this.zb.transform, to);
  }
  private renderList() {
    const l = this.stage.querySelector('#q-list') as HTMLElement;
    l.innerHTML = `<div class="page"><h3 class="sr-title">Relaciones de ${esc(nameOf(this.center))}</h3>${this.groups.map((g) => { const cap = this.shown.get(g.key) ?? 1e9; if (g.subs) return `<details class="pl-sea" open><summary><i class="dot" style="background:${g.color}"></i>Familia <b>${fmtN(g.ids.length)}</b></summary>${g.subs.map((s) => `<h4 class="rel-sub">${esc(s.label)} <b>${s.ids.length}</b></h4><ul>${s.ids.map((j) => `<li><a class="ilink" href="#/quien/${encodeURIComponent(nameOf(j))}" data-i="${j}">${avatarHtml(j, 26)} ${esc(nameOf(j))}</a><small>${esc(TYPE_LABEL[typeOf(j)] ?? '')}</small></li>`).join('')}</ul>`).join('')}</details>`; return `<details class="pl-sea" ${g.weak ? '' : 'open'}><summary><i class="dot" style="background:${g.color}"></i>${esc(g.label)} <b>${fmtN(g.ids.length)}</b></summary><ul>${g.ids.slice(0, Math.max(cap, 60)).map((j) => `<li><a class="ilink" href="#/quien/${encodeURIComponent(nameOf(j))}" data-i="${j}">${avatarHtml(j, 26)} ${esc(nameOf(j))}</a><small>${esc(TYPE_LABEL[typeOf(j)] ?? '')}</small></li>`).join('')}${g.ids.length > Math.max(cap, 60) ? `<li><button class="linkish" data-more="${esc(g.key)}">Ver más (${g.ids.length - Math.max(cap, 60)})</button></li>` : ''}</ul></details>`; }).join('') || '<p class="hint">Esta ficha no tiene relaciones registradas.</p>'}</div>`;
  }

  // ---------- camino más corto entre dos fichas ----------
  private async loadEdges() {
    if (this.edges) return this.edges; const d = await loadData<EdgesData>('edges'); const adj = new Map<number, [number, number, number][]>();
    const put = (a: number, b: number, r: number, dir: number) => { let l = adj.get(a); if (!l) adj.set(a, (l = [])); l.push([b, r, dir]); };
    for (let k = 0; k < d.e.length; k += 4) { const a = rootOf(d.e[k]!), b = rootOf(d.e[k + 1]!), r = d.e[k + 2]!; if (a === b) continue; put(a, b, r, 0); put(b, a, r, 1); }
    this.edges = { adj, rels: d.rels }; return this.edges;
  }
  private route(from: number, to: number, ban: Set<number>, E: { adj: Map<number, [number, number, number][]> }): { n: number; r: number; dir: number }[] | null {
    // Dijkstra: cada salto cuesta 1, y pasar por fichas muy conectadas (razas, conceptos…) cuesta más para no dar caminos triviales
    const dist = new Map<number, number>([[from, 0]]); const prev = new Map<number, { n: number; r: number; dir: number }>(); const heap: [number, number][] = [[0, from]]; const done = new Set<number>();
    const pop = () => { let b = 0; for (let k = 1; k < heap.length; k++) if (heap[k]![0] < heap[b]![0]) b = k; return heap.splice(b, 1)[0]!; };
    while (heap.length) { const [dd, u] = pop(); if (done.has(u)) continue; done.add(u); if (u === to) break; if (dd > 7) continue; const nb = E.adj.get(u) ?? []; const hub = nb.length > 160 && u !== from ? 1.8 : 0; for (const [v, r, dir] of nb) { if (ban.has(v) && v !== to) continue; const nd = dd + 1 + hub; if (nd < (dist.get(v) ?? 1e9)) { dist.set(v, nd); prev.set(v, { n: u, r, dir }); heap.push([nd, v]); } } }
    if (!prev.has(to)) return null; const out: { n: number; r: number; dir: number }[] = []; let c = to; while (c !== from) { const p = prev.get(c)!; out.unshift({ n: c, r: p.r, dir: p.dir }); c = p.n; } return out;
  }
  private async showPath(na: string, nb: string) {
    this.show('path'); const my = ++this.token; this.cur = -1; const a = findByTitle(na), b = findByTitle(nb); const box = this.pathBox;
    if (a === undefined || b === undefined) { box.innerHTML = this.pathShell(na, nb, '<p class="hint">No encuentro una de las dos fichas. <a href="#/quien">Volver al buscador</a>.</p>'); return; }
    box.innerHTML = this.pathShell(nameOf(a), nameOf(b), '<p class="loading">Buscando el camino…</p>'); const E = await this.loadEdges(); if (my !== this.token) return;
    const first = this.route(a, b, new Set(), E); const paths: { n: number; r: number; dir: number }[][] = []; if (first) { paths.push(first); const mids = first.slice(0, -1).map((x) => x.n); for (const m of mids) { if (paths.length >= 3) break; const alt = this.route(a, b, new Set([m]), E); if (alt && !paths.some((p) => p.map((x) => x.n).join() === alt.map((x) => x.n).join())) paths.push(alt); } }
    const hop = (from: number, h: { n: number; r: number; dir: number }) => { const rel = E.rels[h.r]!; const lab = relLabel(rel, h.dir, from, 1, [h.n]); return { lab, col: relStyle(rel).c, from, to: h.n }; };
    const card = (i: number, cls = '') => `<a class="pcard ${cls}" href="#/quien/${encodeURIComponent(nameOf(i))}">${avatarHtml(i, 56)}<b>${esc(nameOf(i))}</b><small>${esc(TYPE_LABEL[typeOf(i)] ?? '')}</small></a>`;
    const render = (p: { n: number; r: number; dir: number }[]) => { let cur = a; const parts: string[] = [card(a, 'end')]; const sentences: string[] = []; for (const h of p) { const x = hop(cur, h); parts.push(`<span class="parrow" style="--c:${x.col}"><em>${esc(x.lab)}</em><i aria-hidden="true">→</i></span>`, card(h.n, h.n === b ? 'end' : '')); sentences.push(`<b>${esc(nameOf(cur))}</b> — ${esc(x.lab.toLowerCase())} → <b>${esc(nameOf(h.n))}</b>`); cur = h.n; } return { chain: parts.join(''), text: sentences }; };
    if (!paths.length) { box.innerHTML = this.pathShell(nameOf(a), nameOf(b), `<div class="p-none"><h3>No hay un camino corto entre ellas</h3><p>La wiki no las une con ninguna cadena de relaciones de hasta seis saltos. Prueba a mirar cada una por separado, o elige una ficha intermedia (una organización, un lugar o un personaje conocido de ambas).</p><p><a class="btn" href="#/quien/${encodeURIComponent(nameOf(a))}">Grafo de ${esc(nameOf(a))}</a> <a class="btn ghost" href="#/quien/${encodeURIComponent(nameOf(b))}">Grafo de ${esc(nameOf(b))}</a></p></div>`); return; }
    const main = render(paths[0]!); const alts = paths.slice(1).map((p) => `<li>${render(p).text.join('<br>')}</li>`).join('');
    box.innerHTML = this.pathShell(nameOf(a), nameOf(b), `<p class="p-sum">Se conectan en <b>${paths[0]!.length} ${paths[0]!.length === 1 ? 'salto' : 'saltos'}</b>${paths[0]!.length === 1 ? ' directos' : ''}.</p><div class="pchain" role="list">${main.chain}</div><h3>Paso a paso</h3><ol class="ptext">${main.text.map((t) => `<li>${t}</li>`).join('')}</ol>${alts ? `<h3>Otros caminos</h3><ul class="palt">${alts}</ul>` : ''}`);
    document.getElementById('view')!.setAttribute('aria-busy', 'false');
  }
  private pathShell(a: string, b: string, inner: string) { return `<div class="page wide"><nav class="crumbs" aria-label="Migas de pan"><a href="#/">Inicio</a><span>›</span><a href="#/quien">Quién es quién</a><span>›</span><span aria-current="page">Cómo se relacionan</span></nav><header class="page-head"><h2>¿Cómo se relaciona <em>${esc(a)}</em> con <em>${esc(b)}</em>?</h2><p><a class="btn ghost small" href="#/quien?de=${encodeURIComponent(b)}&a=${encodeURIComponent(a)}">⇄ Invertir</a> <a class="btn ghost small" href="#/quien">Otra búsqueda</a></p></header>${inner}</div>`; }
}
