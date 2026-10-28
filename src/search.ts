// Buscador reutilizable: sobre las 7.509 fichas, resultados agrupados por tipo, con teclado (flechas, Enter, Esc) y atajo «/».
import { IDX, shownName, findByTitle, rootOf, TYPE_LABEL, TYPE_PLURAL, avatarHtml, ensureIndex, ensureImgs, esc, impOf, isSub, norm, typeOf, nameOf } from './data';

const GROUP_ORDER = ['personaje', 'organizacion', 'fruta_del_diablo', 'barco', 'lugar', 'saga', 'arco', 'tecnica', 'arma', 'raza', 'animal', 'evento', 'objeto', 'naturaleza', 'concepto', 'medio', 'episodio', 'capitulo', 'volumen', 'combate', 'persona_real', 'meta'];
let NN: string[] = [];
let aliases = new Map<number, string>();
const prepare = () => { if (NN.length !== IDX!.n.length) { NN = IDX!.n.map(norm); aliases = new Map(IDX!.a.map(([i, a]) => [i, norm(a)])); } };

export function searchIndex(q: string, limit = 40, types: string[] | null = null): number[] {
  const nq = norm(q).trim(); if (!nq || !IDX) return [];
  prepare();
  const scored: [number, number][] = [];
  for (let i = 0; i < NN.length; i++) {
    const n = NN[i]!; let s = 0;
    if (n === nq) s = 100; else if (n.startsWith(nq)) s = 80; else if (n.includes(' ' + nq)) s = 60; else if (n.includes(nq)) s = 40; else { const a = aliases.get(i); if (a && a.includes(nq)) s = 30; }
    if (!s || isSub(i)) continue;
    const ty = typeOf(i); if (types && !types.includes(ty)) continue;
    if (ty === 'meta') s -= 25; if (ty === 'episodio' || ty === 'capitulo' || ty === 'volumen') s -= 15;
    scored.push([i, s + Math.min(impOf(i), 60) * 0.3 - n.length * 0.02]);
  }
  return scored.sort((a, b) => b[1] - a[1]).slice(0, limit).map((x) => x[0]);
}

export interface SearchOpts { onChoose: (i: number) => void; primary?: boolean; types?: string[] | null; clear?: boolean }
export async function attachSearch(input: HTMLInputElement, box: HTMLElement, opts: SearchOpts): Promise<() => void> {
  await ensureIndex(); prepare();
  let hits: number[] = [], sel = 0;
  const close = () => { box.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
  const POPULAR = ['Monkey D. Luffy', 'Gomu Gomu no Mi', 'Marineford', 'Thousand Sunny', 'Piratas de Sombrero de Paja', 'Edward Newgate', 'Wano'];
  const recents = (): number[] => { try { return (JSON.parse(localStorage.getItem('opa-recent') ?? '[]') as number[]).filter((i) => i < IDX!.n.length); } catch { return []; } };
  const remember = (i: number) => { try { localStorage.setItem('opa-recent', JSON.stringify([i, ...recents().filter((x) => x !== i)].slice(0, 6))); } catch { /* sin almacenamiento */ } };
  function drawEmpty() {
    const rec = recents(), pop = POPULAR.map((n) => findByTitle(n)).filter((i): i is number => i !== undefined && !rec.includes(i)).slice(0, 6); const flat: number[] = []; let html = '';
    const sect = (title: string, ids: number[]) => { if (!ids.length) return ''; return `<div class="grp" role="presentation">${title}</div>` + ids.map((i) => { flat.push(i); return `<div role="option" id="${box.id}-o${i}" class="opt" data-i="${i}">${avatarHtml(i, 34)}<span class="nm">${esc(shownName(i))}</span><small>${esc(TYPE_LABEL[typeOf(i)] ?? '')}</small></div>`; }).join(''); };
    html = sect('Búsquedas recientes', rec) + sect('Populares', pop); hits = flat; sel = 0; box.innerHTML = html; box.querySelectorAll('.opt')[0]?.classList.add('sel'); box.hidden = !html; input.setAttribute('aria-expanded', String(!!html));
  }
  function draw() {
    if (!input.value.trim()) { if (opts.primary) drawEmpty(); else close(); return; }
    const found = searchIndex(input.value, 40, opts.types ?? null);
    const by = new Map<string, number[]>(); for (const i of found) { const t = typeOf(i); (by.get(t) ?? by.set(t, []).get(t)!).push(i); }
    const order = [...by.keys()].sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));
    const flat: number[] = []; let html = '';
    for (const t of order) {
      const n = by.get(t)!.length; html += `<div class="grp" role="presentation">${esc(TYPE_PLURAL[t] ?? t)} <b class="gc">${n}${n >= 40 ? '+' : ''}</b>${n > 5 ? `<a class="grp-all" href="#/biblioteca?t=${t}&q=${encodeURIComponent(input.value.trim())}">ver todos →</a>` : ''}</div>` + by.get(t)!.slice(0, 5).map((i) => { flat.push(i); return `<div role="option" id="${box.id}-o${i}" class="opt" data-i="${i}">${avatarHtml(i, 28)}<span class="nm">${esc(shownName(i))}</span><small>${esc(TYPE_LABEL[t] ?? '')}</small></div>`; }).join('');
    }
    hits = flat; sel = Math.min(sel, Math.max(0, flat.length - 1));
    box.innerHTML = html || '<div class="none" role="status">Sin resultados. Prueba con otro nombre.</div>';
    const cur = box.querySelectorAll('.opt')[sel]; cur?.classList.add('sel'); cur?.setAttribute('aria-selected', 'true'); if (cur) input.setAttribute('aria-activedescendant', cur.id);
    box.hidden = false; input.setAttribute('aria-expanded', 'true');
  }
  void ensureImgs().then(() => { if (!box.hidden) draw(); });
  const choose = (i: number) => { remember(i); close(); if (opts.clear !== false) input.value = ''; input.blur(); opts.onChoose(i); };
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', box.id);
  const onInput = () => { sel = 0; draw(); }, onFocus = () => draw();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % Math.max(1, hits.length); draw(); box.querySelector('.sel')?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter' && hits[sel] !== undefined) { e.preventDefault(); choose(hits[sel]!); }
    else if (e.key === 'Escape') close();
  };
  const onDown = (e: MouseEvent) => { const o = (e.target as HTMLElement).closest<HTMLElement>('.opt'); if (o) { e.preventDefault(); choose(+o.dataset.i!); } };
  const outside = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.search, .bigsearch, .picker')) close(); };
  const slash = (e: KeyboardEvent) => { if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea,select'))) { e.preventDefault(); input.focus(); input.select(); } };
  input.addEventListener('input', onInput); input.addEventListener('focus', onFocus); input.addEventListener('keydown', onKey); box.addEventListener('mousedown', onDown);
  document.addEventListener('click', outside); if (opts.primary) document.addEventListener('keydown', slash);
  return () => { input.removeEventListener('input', onInput); input.removeEventListener('focus', onFocus); input.removeEventListener('keydown', onKey); box.removeEventListener('mousedown', onDown); document.removeEventListener('click', outside); document.removeEventListener('keydown', slash); };
}
