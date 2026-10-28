// Comparador: dos fichas lado a lado (datos clave, relaciones en común y lo que es exclusivo de cada una).
import { IDX, IMGS, imgUrl, REL_LABEL, TYPE_LABEL, avatarHtml, valueHtml, ensureIndex, ensureImgs, esc, findByTitle, getDetail, impOf, nameOf, richText, rootOf, typeOf, Detail } from '../data';
import { go, parseHash, setParams } from '../nav';
import { itemHtml, keyData } from '../panel';
import { attachSearch } from '../search';
import type { View } from './view';

const relMap = (d: Detail) => { const m = new Map<number, string[]>(); for (const [r, j, dir] of d.rl) { const rel = IDX!.rels[r]!; if (rel === 'categorizado_en') continue; const lab = (REL_LABEL[rel] ?? [rel, rel])[dir]!; const k = rootOf(j); const a = m.get(k) ?? []; if (!a.includes(lab)) a.push(lab); m.set(k, a); } return m; };

export class CompareView implements View {
  private root!: HTMLElement; private disposers: (() => void)[] = []; private token = 0;
  async mount(host: HTMLElement) {
    const box = document.createElement('div'); box.className = 'compare'; host.append(box); this.root = box;
    await ensureIndex(); void ensureImgs();
    box.innerHTML = `<div class="page wide"><nav class="crumbs" aria-label="Migas de pan"><a href="#/">Inicio</a><span>›</span><span aria-current="page">Comparar</span></nav>
      <header class="page-head"><h1>Frente a frente</h1><p>Elige dos personajes, tripulaciones, frutas, barcos o lugares y míralos cara a cara: retratos, datos clave, combates en común y lo que los une o los distingue.</p></header>
      <div class="cmp-pick">${['a', 'b'].map((k) => `<div class="cmp-col"><label for="p${k}">${k === 'a' ? 'Primera ficha' : 'Segunda ficha'}</label><div class="picker"><input id="p${k}" type="search" placeholder="Busca por nombre…" autocomplete="off"><div id="r${k}" class="results" role="listbox" hidden></div></div><div class="cmp-chosen" id="c${k}"></div></div>`).join('')}</div>
      <p class="cmp-tools"><button class="linkish" id="swap">⇄ Intercambiar</button> · <button class="linkish" id="clear">Empezar de nuevo</button></p>
      <div id="cmp-out"></div></div>`;
    for (const k of ['a', 'b'] as const) this.disposers.push(await attachSearch(box.querySelector('#p' + k) as HTMLInputElement, box.querySelector('#r' + k) as HTMLElement, { onChoose: (i) => { setParams({ [k]: nameOf(rootOf(i)) }); void this.refresh(); } }));
    box.querySelector('#swap')!.addEventListener('click', () => { const q = parseHash().q; setParams({ a: q.get('b'), b: q.get('a') }); void this.refresh(); });
    box.querySelector('#clear')!.addEventListener('click', () => { go('comparar'); });
    box.addEventListener('click', (e) => { const x = (e.target as HTMLElement).closest<HTMLElement>('[data-clear]'); if (x) { setParams({ [x.dataset.clear!]: null }); void this.refresh(); } });
    await this.refresh();
  }
  unmount() { this.disposers.forEach((d) => d()); this.root.remove(); }
  focus() { void this.refresh(); }

  private async refresh() {
    const my = ++this.token; const q = parseHash().q; const ids: (number | undefined)[] = ['a', 'b'].map((k) => { const n = q.get(k); return n ? findByTitle(n) : undefined; });
    ['a', 'b'].forEach((k, n) => { const i = ids[n]; (this.root.querySelector('#c' + k) as HTMLElement).innerHTML = i === undefined ? '<p class="hint">Aún sin elegir.</p>' : `<a class="ilink cmp-card" href="#/ficha/${encodeURIComponent(nameOf(i))}" data-i="${i}" data-full>${avatarHtml(i, 56)}<span><b>${esc(nameOf(i))}</b><small>${esc(TYPE_LABEL[typeOf(i)] ?? '')}</small></span></a><button class="linkish" data-clear="${k}">Quitar</button>`; });
    const out = this.root.querySelector('#cmp-out') as HTMLElement;
    if (ids[0] === undefined || ids[1] === undefined) { out.innerHTML = '<p class="hint cmp-empty">Elige dos fichas para compararlas. Prueba con Monkey D. Luffy y Roronoa Zoro, o con dos tripulaciones.</p>'; return; }
    const [a, b] = ids as [number, number]; const [da, db] = await Promise.all([getDetail(a), getDetail(b)]); if (my !== this.token) return;
    const ka = new Map(keyData(da, 14)), kb = new Map(keyData(db, 14)); const labels = [...new Set([...ka.keys(), ...kb.keys()])];
    const ma = relMap(da), mb = relMap(db); const common = [...ma.keys()].filter((j) => mb.has(j) && j !== a && j !== b).sort((x, y) => impOf(y) - impOf(x));
    const onlyA = [...ma.keys()].filter((j) => !mb.has(j) && j !== b).sort((x, y) => impOf(y) - impOf(x)).slice(0, 10), onlyB = [...mb.keys()].filter((j) => !ma.has(j) && j !== a).sort((x, y) => impOf(y) - impOf(x)).slice(0, 10);
    const direct = ma.get(b), mentionAB = da.m.map(rootOf).includes(b), mentionBA = db.m.map(rootOf).includes(a);
    const portrait = (i: number) => { const u = IMGS?.[i] ? imgUrl(IMGS[i]!, 560) : ''; return `<a class="vs-card ilink" href="#/ficha/${encodeURIComponent(nameOf(i))}" data-i="${i}" data-full><span class="vs-img">${u ? `<img src="${esc(u)}" alt="${esc(nameOf(i))}" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<span class="vs-ini" aria-hidden="true">${esc(nameOf(i).split(/\s+/).map((w) => w[0]).slice(0, 2).join(''))}</span></span><b>${esc(nameOf(i))}</b><small>${esc(TYPE_LABEL[typeOf(i)] ?? '')}</small></a>`; };
    const stat = (l: string) => `<tr><th scope="row">${esc(l)}</th><td>${ka.has(l) ? valueHtml(ka.get(l)!) : '—'}</td><td>${kb.has(l) ? valueHtml(kb.get(l)!) : '—'}</td></tr>`;
    const fights = common.filter((j) => (ma.get(j) ?? []).some((x) => /Combate/.test(x)) && (mb.get(j) ?? []).some((x) => /Combate/.test(x)));
    const heads = ['Recompensa', 'Fruta del Diablo', 'Edad', 'Origen', 'Organización', 'Ocupación'].filter((l) => ka.has(l) || kb.has(l));
    out.innerHTML = `<section class="vs" aria-label="Frente a frente">${portrait(a)}<span class="vs-x" aria-hidden="true">VS</span>${portrait(b)}</section>
      ${heads.length ? `<section><h2>De un vistazo</h2><div class="tw"><table class="cmp-t vs-t"><thead><tr><th></th><th scope="col">${esc(nameOf(a))}</th><th scope="col">${esc(nameOf(b))}</th></tr></thead><tbody>${heads.map(stat).join('')}</tbody></table></div></section>` : ''}
      <section class="vs-fights"><h2>Combates y sucesos en común <b class="cnt">${fights.length}</b></h2>${fights.length ? `<ul class="cmp-common">${fights.slice(0, 20).map((j) => `<li>${itemHtml(j).replace(/^<li class="">|<\/li>$/g, '')}</li>`).join('')}</ul>` : '<p class="hint">La wiki no registra combates que enfrenten a ambos.</p>'}</section>
      <section class="cmp-sum"><div><h2>${esc(nameOf(a))}</h2><p>${richText(da.r)}</p></div><div><h2>${esc(nameOf(b))}</h2><p>${richText(db.r)}</p></div></section>
      <section class="cmp-rel"><h2>Cómo se relacionan</h2><p>${direct ? `Relación directa: <b>${esc(nameOf(a))}</b> → ${direct.map(esc).join(', ')} → <b>${esc(nameOf(b))}</b>.` : 'No hay una relación directa registrada entre ellos.'} ${mentionAB ? `La ficha de ${esc(nameOf(a))} menciona a ${esc(nameOf(b))}. ` : ''}${mentionBA ? `La ficha de ${esc(nameOf(b))} menciona a ${esc(nameOf(a))}.` : ''}</p></section>
      ${labels.length ? `<section><h2>Datos clave</h2><div class="tw"><table class="cmp-t"><thead><tr><th></th><th scope="col">${esc(nameOf(a))}</th><th scope="col">${esc(nameOf(b))}</th></tr></thead><tbody>${labels.map((l) => `<tr><th scope="row">${esc(l)}</th><td>${ka.has(l) ? valueHtml(ka.get(l)!) : '—'}</td><td>${esc(kb.get(l) ?? '—')}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
      <section><h2>En común <b class="cnt">${common.length}</b></h2>${common.length ? `<ul class="cmp-common">${common.slice(0, 40).map((j) => `<li>${itemHtml(j).replace(/^<li class="">|<\/li>$/g, '')}<span class="why"><em>${esc(nameOf(a))}:</em> ${ma.get(j)!.map(esc).join(', ')} · <em>${esc(nameOf(b))}:</em> ${mb.get(j)!.map(esc).join(', ')}</span></li>`).join('')}</ul>` : '<p class="hint">No comparten ninguna ficha relacionada.</p>'}</section>
      <section class="cmp-only"><div><h2>Solo con ${esc(nameOf(a))}</h2><ul>${onlyA.map((j) => itemHtml(j)).join('') || '<li class="hint">—</li>'}</ul></div><div><h2>Solo con ${esc(nameOf(b))}</h2><ul>${onlyB.map((j) => itemHtml(j)).join('') || '<li class="hint">—</li>'}</ul></div></section>`;
  }
}
export { go };
