// «La biblioteca»: explorador de todas las fichas con scroll continuo virtualizado (solo se pintan las filas visibles),
// índice A–Z, filtros por tipo, saga y mar, orden, contador y estado en la URL para compartir.
import { IDX, TYPE_COLOR, TYPE_LABEL, TYPE_PLURAL, avatarHtml, berries, ensureImgs, ensureIndex, esc, fmtN, impOf, isSub, loadData, nameOf, norm, shapeIcon, typeOf } from '../data';
import { parseHash, setParams } from '../nav';
import type { View } from './view';

interface Chap { ch: number[]; sg: { n: string; a: number; b: number }[] }
interface PlacesLite { seas: string[]; p: [number, number, number, number, number][] }
interface Rank { bounty: [number, number][] }
const ORDER = ['personaje', 'organizacion', 'fruta_del_diablo', 'barco', 'lugar', 'tecnica', 'arma', 'saga', 'arco', 'evento', 'raza', 'animal', 'objeto', 'naturaleza', 'concepto', 'medio', 'episodio', 'capitulo', 'volumen', 'combate', 'persona_real', 'meta'];
const ROW_H = 78, GAP = 12, MIN_W = 250;
const letterOf = (s: string) => { const c = norm(s).trim().charAt(0).toUpperCase(); return c >= 'A' && c <= 'Z' ? c : '#'; };
const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

export class LibraryView implements View {
  private root!: HTMLElement; private sc!: HTMLElement; private grid!: HTMLElement; private ro?: ResizeObserver; private raf = 0;
  private f = { t: 'personaje', q: '', o: 'imp', s: '', m: '' };
  private all: number[] = []; private amount = new Map<number, number>(); private chap: Chap | null = null; private places: PlacesLite | null = null; private seaOf = new Map<number, number>(); private rank: Rank | null = null;
  private cols = 1; private letterRow = new Map<string, number>(); private sel: number | null = null; private lastRange = '';

  async mount(host: HTMLElement) {
    const root = document.createElement('div'); root.className = 'lib'; host.append(root); this.root = root;
    root.innerHTML = '<p class="loading">Cargando la biblioteca…</p>';
    await ensureIndex(); void ensureImgs().then(() => { this.lastRange = ''; this.paint(); });
    const q = parseHash().q; this.f = { t: q.get('t') ?? 'personaje', q: q.get('q') ?? '', o: q.get('o') === 'az' ? 'az' : 'imp', s: q.get('s') ?? '', m: q.get('m') ?? '' };
    const counts = new Map<string, number>(); for (let i = 0; i < IDX!.n.length; i++) { if (isSub(i)) continue; const t = typeOf(i); counts.set(t, (counts.get(t) ?? 0) + 1); }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    root.innerHTML = `<aside class="lib-side" aria-label="Tipos de ficha"><h1>La biblioteca</h1><p class="hint">Todas las fichas, sin páginas: baja y verás más.</p>
      <nav><button data-t="*" class="${this.f.t === '*' ? 'on' : ''}"><i style="background:#c9d6ea"></i>Todas las fichas<em>${fmtN(total)}</em></button>${ORDER.filter((t) => counts.get(t)).map((t) => `<button data-t="${t}" class="${t === this.f.t ? 'on' : ''}"><span class="sw">${shapeIcon(t, 16)}</span>${esc(TYPE_PLURAL[t] ?? t)}<em>${fmtN(counts.get(t)!)}</em></button>`).join('')}</nav>
      <h2 class="side-h">Rankings</h2><nav><button data-t="rank:bounty" class="${this.f.t === 'rank:bounty' ? 'on' : ''}"><i style="background:#f2b84b"></i>Recompensas más altas<em>300</em></button></nav></aside>
      <section class="lib-main"><div class="lib-bar"><h2 id="lib-title" class="lib-h"></h2>
        <input id="lib-q" type="search" placeholder="Buscar en esta lista…" aria-label="Filtrar por nombre" autocomplete="off" value="${esc(this.f.q)}">
        <label class="sel"><span>Saga</span><select id="lib-saga" aria-label="Filtrar por saga de primera aparición"><option value="">Todas</option></select></label>
        <label class="sel" id="lib-sea-wrap"><span>Mar</span><select id="lib-sea" aria-label="Filtrar lugares por mar"><option value="">Todos</option></select></label>
        <label class="sel"><span>Orden</span><select id="lib-sort" aria-label="Orden"><option value="imp">Más relevantes primero</option><option value="az">A–Z</option></select></label>
        <span class="count" id="lib-count" role="status" aria-live="polite"></span></div>
      <div class="azbar" id="azbar" role="toolbar" aria-label="Ir a la letra">${LETTERS.map((l) => `<button data-l="${l}" aria-label="Letra ${l}">${l}</button>`).join('')}</div>
      <div class="lib-scroll" id="lib-scroll" tabindex="0" aria-label="Lista de fichas"><div class="vgrid" id="vgrid" role="list"></div></div></section>`;
    this.sc = root.querySelector('#lib-scroll')!; this.grid = root.querySelector('#vgrid')!;
    (root.querySelector('#lib-sort') as HTMLSelectElement).value = this.f.o;
    root.querySelector('.lib-side')!.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-t]'); if (b) { this.f.t = b.dataset.t!; root.querySelectorAll('.lib-side [data-t]').forEach((x) => x.classList.toggle('on', x === b)); this.apply(true); } });
    root.querySelector('#lib-q')!.addEventListener('input', (e) => { this.f.q = (e.target as HTMLInputElement).value; this.apply(true); });
    root.querySelector('#lib-saga')!.addEventListener('change', (e) => { this.f.s = (e.target as HTMLSelectElement).value; this.apply(true); });
    root.querySelector('#lib-sea')!.addEventListener('change', (e) => { this.f.m = (e.target as HTMLSelectElement).value; this.apply(true); });
    root.querySelector('#lib-sort')!.addEventListener('change', (e) => { this.f.o = (e.target as HTMLSelectElement).value; this.apply(true); });
    root.querySelector('#azbar')!.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-l]'); if (b && !(b as HTMLButtonElement).disabled) this.gotoLetter(b.dataset.l!); });
    this.sc.addEventListener('scroll', () => this.schedule(), { passive: true });
    this.ro = new ResizeObserver(() => { this.measure(); this.paint(true); }); this.ro.observe(this.sc);
    // datos auxiliares (saga y mar) sin bloquear el primer pintado
    void Promise.all([loadData<Chap>('chap'), loadData<PlacesLite>('places'), loadData<Rank>('rank')]).then(([c, p, r]) => {
      this.chap = c; this.places = p; this.rank = r; this.seaOf = new Map(p.p.map((x) => [x[0], x[1]]));
      (root.querySelector('#lib-saga') as HTMLSelectElement).innerHTML = '<option value="">Todas</option>' + c.sg.map((s, k) => `<option value="${k}">${esc(s.n.replace(/^Saga /, ''))}</option>`).join('');
      (root.querySelector('#lib-sea') as HTMLSelectElement).innerHTML = '<option value="">Todos</option>' + p.seas.map((s, k) => `<option value="${k}">${esc(s)}</option>`).join('');
      (root.querySelector('#lib-saga') as HTMLSelectElement).value = this.f.s; (root.querySelector('#lib-sea') as HTMLSelectElement).value = this.f.m; this.apply(false);
    });
    this.measure(); this.apply(false);
  }
  unmount() { cancelAnimationFrame(this.raf); this.ro?.disconnect(); this.root.remove(); }
  focus(i: number | null) { this.sel = i; this.lastRange = ''; this.paint(true); }

  // ---------- filtrado y orden ----------
  private apply(resetScroll: boolean) {
    const { t, q, o, s, m } = this.f; const nq = norm(q).trim(); const isRank = t === 'rank:bounty';
    setParams({ t: t === 'personaje' ? null : t, q: q || null, o: o === 'az' ? 'az' : null, s: s || null, m: m || null });
    (this.root.querySelector('#lib-sea-wrap') as HTMLElement).hidden = !(t === 'lugar' || t === '*');
    let ids: number[] = [];
    if (isRank) { this.amount.clear(); for (const [i, v] of this.rank?.bounty ?? []) { if (!nq || norm(nameOf(i)).includes(nq)) { ids.push(i); this.amount.set(i, v); } } }
    else {
      const sg = s !== '' && this.chap ? this.chap.sg[+s] : null;
      for (let i = 0; i < IDX!.n.length; i++) {
        if (isSub(i)) continue; if (t !== '*' && typeOf(i) !== t) continue; if (t === '*' && typeOf(i) === 'meta') continue;
        if (nq && !norm(nameOf(i)).includes(nq)) continue;
        if (sg) { const c = this.chap!.ch[i]!; if (!c || c < sg.a || c > sg.b) continue; }
        if (m !== '' && this.seaOf.get(i) !== +m) continue; ids.push(i);
      }
    }
    if (isRank) { /* ya viene ordenado por recompensa */ }
    else if (o === 'az') ids.sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'es'));
    else ids.sort((a, b) => impOf(b) - impOf(a) || nameOf(a).localeCompare(nameOf(b), 'es'));
    this.all = ids; this.measure();
    // letras disponibles (solo con orden A–Z; con otro orden, pulsar una letra cambia a A–Z)
    const present = new Set<string>(); const sorted = o === 'az' || isRank ? ids : [...ids].sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'es'));
    this.letterRow.clear(); sorted.forEach((i, k) => { const l = letterOf(nameOf(i)); present.add(l); if (!this.letterRow.has(l)) this.letterRow.set(l, k); });
    this.root.querySelectorAll<HTMLButtonElement>('#azbar button').forEach((b) => { b.disabled = !present.has(b.dataset.l!) || isRank; });
    (this.root.querySelector('#lib-title') as HTMLElement).innerHTML = `${isRank ? 'Recompensas más altas' : t === '*' ? 'Todas las fichas' : esc(TYPE_PLURAL[t] ?? t)}`;
    (this.root.querySelector('#lib-count') as HTMLElement).textContent = `${fmtN(ids.length)} resultado${ids.length === 1 ? '' : 's'}`;
    if (resetScroll) this.sc.scrollTop = 0; this.lastRange = ''; this.paint(true);
  }
  private gotoLetter(l: string) {
    if (this.f.o !== 'az') { this.f.o = 'az'; (this.root.querySelector('#lib-sort') as HTMLSelectElement).value = 'az'; this.apply(false); }
    const k = this.letterRow.get(l); if (k === undefined) return; this.sc.scrollTop = Math.floor(k / this.cols) * (ROW_H + GAP); this.paint(true);
  }

  // ---------- virtualización: solo las filas visibles ----------
  private measure() { const w = this.sc?.clientWidth || 900; this.cols = Math.max(1, Math.floor((w - 24 + GAP) / (MIN_W + GAP))); const rows = Math.ceil(this.all.length / this.cols); if (this.grid) this.grid.style.height = `${Math.max(0, rows * (ROW_H + GAP))}px`; }
  private schedule() { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.paint(); }); }
  private paint(force = false) {
    if (!this.sc) return; const top = this.sc.scrollTop, vh = this.sc.clientHeight || 700, rowH = ROW_H + GAP;
    const r0 = Math.max(0, Math.floor(top / rowH) - 3), r1 = Math.floor((top + vh) / rowH) + 3; const key = `${r0}-${r1}-${this.cols}-${this.all.length}`;
    if (!force && key === this.lastRange) return; this.lastRange = key;
    const colW = `calc((100% - ${(this.cols - 1) * GAP}px) / ${this.cols})`; let html = ''; const isRank = this.f.t === 'rank:bounty';
    for (let r = r0; r <= r1; r++) for (let c = 0; c < this.cols; c++) {
      const k = r * this.cols + c; if (k >= this.all.length) break; const i = this.all[k]!, ty = typeOf(i);
      html += `<a class="lib-card ilink ${i === this.sel ? 'sel' : ''}" role="listitem" href="#/ficha/${encodeURIComponent(nameOf(i))}" data-i="${i}" style="top:${r * rowH}px;left:calc(${c} * (${colW} + ${GAP}px));width:${colW};height:${ROW_H}px">${isRank ? `<span class="rk">${k + 1}</span>` : ''}${avatarHtml(i, 52)}<span class="nm">${esc(nameOf(i))}</span><small>${isRank ? esc(berries(this.amount.get(i)!)) : `<i style="background:${TYPE_COLOR[ty] ?? '#888'}"></i>${esc(TYPE_LABEL[ty] ?? '')}`}</small></a>`;
    }
    this.grid.innerHTML = html;
  }
}
