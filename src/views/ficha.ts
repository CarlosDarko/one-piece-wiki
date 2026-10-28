// Ficha completa: el artículo íntegro de la wiki (todas sus secciones), índice con anclas, infobox, relaciones y atribución.
import { IMGS, TYPE_COLOR, TYPE_LABEL, TYPE_PLURAL, Article, Detail, ensureImgs, ensureIndex, esc, findByTitle, getArticle, getDetail, imgUrl, isFace, valueHtml, epithetOf, typeIcon, loadData, nameOf, richText, rootOf, shapeIcon, typeOf, fmtN, impOf } from '../data';
import { go, parseHash, setParams } from '../nav';
import { buildGalleries, dropBroken, galleryTables } from '../gallery';
import { blockHtml, itemHtml, relationBlocks, keyData } from '../panel';
import type { View } from './view';

interface Chap { ch: number[]; sg: { n: string; a: number; b: number }[] }
interface Timeline { sagas: { n: string; ca: string | null; arcs: { n: string; ca: string | null }[] }[] }
const mobile = () => window.matchMedia('(max-width: 820px)').matches;

// HTML del artículo ya saneado en el build: enlaces internos <a data-i>, imágenes <img data-r>; aquí se convierten en enlaces y se pliegan las secciones
function render(html: string): string {
  const linked = html.replace(/<a data-i="(\d+)"( data-s="(x\d+)")?>/g, (_m, i, _s, sec) => `<a class="ilink" href="#/ficha/${encodeURIComponent(nameOf(+i))}" data-i="${i}"${sec ? ` data-s="${sec}"` : ''}>`)
    .replace(/<b>¡Atención![^<]*<\/b>/, '<aside class="spoiler" role="note"><span class="sp-ic" aria-hidden="true">⚠</span><div><strong>¡Atención! Spoilers del manga</strong><p>Este artículo revela detalles del manga. Si solo sigues el anime, léelo con precaución.</p></div></aside>')
    .replace(/<a ([^>]*)>(\s+)/g, '$2<a $1>').replace(/(\s+)<\/a>/g, '</a>$1')
    .replace(/<table>/g, '<div class="tw"><table>').replace(/<\/table>/g, '</table></div>');
  const parts = linked.split(/(?=<h2 id=)/); const intro = parts[0]?.startsWith('<h2 id=') ? '' : parts.shift() ?? '';
  const open = (k: number) => (mobile() ? k < 2 : true);
  const gi = parts.findIndex((p) => /^<h2 id="[^"]+">Galer[ií]a<\/h2>/.test(p)); if (gi >= 0 && gi < parts.length - 1) parts.push(...parts.splice(gi, 1));
  const secs = parts.map((p, k) => { const m = p.match(/^<h2 id="([^"]+)">([^<]*)<\/h2>/); if (!m) return p; return `<details class="asec" ${open(k) ? 'open' : ''} data-sec="${m[1]}"><summary><h2 id="${m[1]}">${m[2]}</h2></summary><div class="asec-b">${p.slice(m[0].length)}</div></details>`; }).join('');
  return `<div class="a-intro">${intro}</div>${secs}`;
}

export class FichaView implements View {
  private root!: HTMLElement; private cur = -1; private io?: IntersectionObserver; private token = 0;
  async mount(host: HTMLElement) {
    const box = document.createElement('div'); box.className = 'ficha-wrap'; host.append(box); this.root = box;
    box.innerHTML = '<div class="page"><p class="loading">Cargando la ficha…</p></div>';
    box.addEventListener('click', (e) => this.onClick(e));
  }
  unmount() { this.io?.disconnect(); this.root.remove(); }

  focus(i: number | null) {
    if (i === null) { this.cur = -1; this.root.innerHTML = `<div class="page"><nav class="crumbs"><a href="#/">Inicio</a><span>›</span><span aria-current="page">Ficha no encontrada</span></nav><h1>No encontramos esa ficha</h1><p class="lead">Prueba a buscarla con el buscador de arriba o explora <a href="#/biblioteca">la biblioteca</a>.</p></div>`; return; }
    const r = rootOf(i); const sec = parseHash().q.get('s');
    if (r === this.cur) { if (sec) this.goSection(sec); return; }
    void this.load(r, sec);
  }

  private onClick(e: Event) {
    const t = e.target as HTMLElement;
    const toc = t.closest<HTMLElement>('[data-sec]');
    if (toc && toc.tagName === 'A') { e.preventDefault(); this.goSection(toc.dataset.sec!); setParams({ s: toc.dataset.sec! }); return; }
    const cp = t.closest<HTMLElement>('[data-copy]');
    if (cp) { void this.copyLink(cp); return; }
    const more = t.closest<HTMLElement>('[data-more]'); if (more) { more.parentElement!.querySelectorAll('li.hid').forEach((li) => li.classList.remove('hid')); more.remove(); }
    const act = t.closest<HTMLElement>('[data-go]'); if (act) { e.preventDefault(); const [v, n] = act.dataset.go!.split('|'); go(v as never, n); }
    if (t.closest('[data-expandall]')) { this.root.querySelectorAll<HTMLDetailsElement>('details.asec').forEach((d) => (d.open = true)); }
    if (t.closest('[data-collapseall]')) { this.root.querySelectorAll<HTMLDetailsElement>('details.asec').forEach((d) => (d.open = false)); }
  }
  private async copyLink(btn: HTMLElement) {
    const url = location.href; let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch { const ta = document.createElement('textarea'); ta.value = url; document.body.append(ta); ta.select(); try { ok = document.execCommand('copy'); } catch { /* sin portapapeles */ } ta.remove(); }
    const old = btn.textContent; btn.textContent = ok ? '✓ Enlace copiado' : 'Copia la dirección del navegador'; setTimeout(() => (btn.textContent = old), 2200);
  }
  private goSection(id: string) {
    const h = this.root.querySelector<HTMLElement>(`#${CSS.escape(id)}`); if (!h) return;
    const d = h.closest('details'); if (d) (d as HTMLDetailsElement).open = true; h.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    this.root.querySelectorAll('.toc a').forEach((a) => a.classList.toggle('on', (a as HTMLElement).dataset.sec === id));
  }

  private async load(i: number, sec: string | null) {
    const my = ++this.token; this.cur = i; await ensureIndex();
    const ty = typeOf(i), color = TYPE_COLOR[ty] ?? '#888', name = nameOf(i);
    this.root.innerHTML = `<div class="page"><nav class="crumbs"><a href="#/">Inicio</a><span>›</span><a href="#/biblioteca?t=${ty}">${esc(TYPE_PLURAL[ty] ?? ty)}</a><span>›</span><span aria-current="page">${esc(name)}</span></nav><h1 class="f-h1">${esc(name)}</h1><p class="loading">Cargando el artículo completo…</p></div>`;
    document.getElementById('view')!.scrollTop = 0;
    const [d, art] = await Promise.all([getDetail(i), getArticle(i), ensureImgs()]); if (my !== this.token) return;
    const photo = IMGS?.[i] ? imgUrl(IMGS[i]!, 560) : '';
    const infobox = (art?.x?.length ? art.x : d.ib).filter((r) => r[1]);
    const rows = keyData({ ib: infobox as Detail['ib'] }, 14); const keys = new Set(rows.map((r) => r[0]));
    const kvAll = [...rows, ...infobox.filter((r) => !/^(nombrejap|nombrerom|nesp|nlat|vol|cap|epi|primera|actor|liveaction|ant|sig)/i.test(r[2]) && !keys.has(r[0].replace(/:$/, ''))).map((r) => [r[0].replace(/:$/, ''), r[1]] as [string, string])].slice(0, 28);
    const groups = relationBlocks(d, i); const mb = [...new Set(d.mb.map(rootOf))].sort((a, b) => impOf(b) - impOf(a)).slice(0, 60);
    const toc0 = (art?.t ?? []).filter((t) => t[1] <= 3); const g0 = toc0.findIndex((t) => t[1] === 2 && /^Galer[ií]a$/.test(t[2])); let toc = toc0; if (g0 >= 0) { let g1 = g0 + 1; while (g1 < toc0.length && toc0[g1]![1] > 2) g1++; toc = [...toc0.slice(0, g0), ...toc0.slice(g1), ...toc0.slice(g0, g1)]; }
    const tocHtml = toc.length ? `<ol>${toc.map((t) => `<li class="l${t[1]}"><a href="#/ficha/${encodeURIComponent(name)}?s=${t[0]}" data-sec="${t[0]}">${esc(t[2])}</a></li>`).join('')}</ol>` : '<p class="hint">Esta ficha no tiene secciones.</p>';
    this.root.innerHTML = `<article class="ficha"><div class="page wide">
      <nav class="crumbs" aria-label="Migas de pan"><a href="#/">Inicio</a><span>›</span><a href="#/biblioteca?t=${ty}">${esc(TYPE_PLURAL[ty] ?? ty)}</a><span>›</span><span aria-current="page">${esc(name)}</span></nav>
      <header class="f-head">${photo ? `<div class="f-photo ${isFace(i) ? 'face' : 'fit'}" style="--c:${color}"><img src="${esc(photo)}" alt="${esc(name)}" referrerpolicy="no-referrer" onerror="this.parentElement.remove()"></div>` : ''}
        <div class="f-title"><span class="tagtype xl" style="--c:${color}">${typeIcon(ty, 20, '#0b1d38')} ${esc(TYPE_LABEL[ty] ?? ty)}</span><h1 class="f-h1">${esc(name)}</h1>${epithetOf(d) ? `<p class="f-sub">${esc(epithetOf(d))}</p>` : ''}
          <p class="f-lead">${richText(d.r) || ''}</p>
          <div class="f-actions"><a class="btn" href="#/quien/${encodeURIComponent(name)}" data-go="quien|${esc(name)}">Ver su grafo de relaciones</a>${ty === 'lugar' ? `<a class="btn ghost" href="#/lugares/${encodeURIComponent(name)}" data-go="lugares|${esc(name)}">Ver en el mapa</a>` : ''}<a class="btn ghost" href="#/comparar?a=${encodeURIComponent(name)}">Comparar con…</a><button class="btn ghost" data-copy>Copiar enlace</button></div>
          <p class="f-first" id="f-first" hidden></p></div></header>
      <div class="f-cols">
        <nav class="toc" aria-label="Índice de la ficha"><details open class="toc-d"><summary><h2>Contenido</h2></summary>${tocHtml}<p class="toc-act"><button class="linkish" data-expandall>Desplegar todo</button> · <button class="linkish" data-collapseall>Plegar todo</button></p></details></nav>
        <div class="f-main article" id="f-main">${art?.h ? render(art.h) : '<p class="hint">La wiki no tiene artículo para esta ficha.</p>'}</div>
        <aside class="f-side" aria-label="Datos de la ficha">
          ${kvAll.length ? `<section class="card-s"><h2>Datos clave</h2><dl class="kv">${kvAll.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${valueHtml(b)}</dd>`).join('')}</dl></section>` : ''}
          ${groups.length ? `<section class="card-s"><h2>Relaciones</h2>${groups.map((g, n) => blockHtml(g, n < 2, 8)).join('')}</section>` : ''}
          ${mb.length ? `<section class="card-s"><details class="rel"><summary><h2 class="inl">Mencionado por <b>${fmtN(d.mb.length)}</b></h2></summary><ul>${mb.map((j) => itemHtml(j)).join('')}</ul></details></section>` : ''}
          <section class="card-s src"><h2>Fuente y licencia</h2><p>Artículo de <a href="${esc(d.url)}" target="_blank" rel="noopener">One Piece Wiki en español (Fandom)</a>, © sus colaboradores, bajo licencia <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>. Puedes ver <a href="${esc(d.url)}?action=history" target="_blank" rel="noopener">el historial de autores</a> en Fandom. Las imágenes pertenecen a sus titulares.</p><p class="conf" title="${esc(d.why)}">Tipo asignado automáticamente · confianza ${Math.round(d.conf * 100)} %</p></section>
        </aside></div></div></article>`;
    document.title = `${name} · One Piece Atlas`;
    galleryTables(this.root.querySelector('.article') as HTMLElement);
    for (const im of this.root.querySelectorAll<HTMLImageElement>('.article img[data-r]')) { im.src = imgUrl(im.dataset.r!, 360); im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; im.onerror = () => dropBroken(im); }
    buildGalleries(this.root.querySelector('.article') as HTMLElement);
    if (sec) setTimeout(() => this.goSection(sec), 50);
    this.spy(); void this.firstAppearance(i);
  }

  // «Primera aparición»: capítulo, arco y saga a partir de los datos de capítulos
  private async firstAppearance(i: number) {
    try {
      const [chap, tl] = await Promise.all([loadData<Chap>('chap'), loadData<Timeline>('timeline')]); const c = chap.ch[i]; const el = this.root.querySelector<HTMLElement>('#f-first'); if (!c || !el || this.cur !== i) return;
      const saga = tl.sagas.find((s) => { const m = (s.ca ?? '').match(/(\d+)\s*[-–]\s*(\d+)/); return m && c >= +m[1]! && c <= +m[2]!; });
      const arc = saga?.arcs.find((a) => { const m = (a.ca ?? '').match(/(\d+)\s*[-–]\s*(\d+)/); return m && c >= +m[1]! && c <= +m[2]!; });
      el.textContent = `Primera aparición: capítulo ${c}${arc ? ` · ${arc.n}` : ''}${saga ? ` · ${saga.n}` : ''}.`; el.hidden = false;
    } catch { /* sin datos de capítulos */ }
  }
  // resalta en el índice la sección que se está leyendo
  private spy() {
    this.io?.disconnect(); const heads = [...this.root.querySelectorAll<HTMLElement>('.article h2[id], .article h3[id]')]; if (!heads.length || !('IntersectionObserver' in window)) return;
    this.io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { const id = (e.target as HTMLElement).id; this.root.querySelectorAll('.toc a').forEach((a) => a.classList.toggle('on', (a as HTMLElement).dataset.sec === id)); } }, { root: document.getElementById('view'), rootMargin: '0px 0px -75% 0px' });
    heads.forEach((h) => this.io!.observe(h));
  }
}
export const fichaByTitle = (t: string) => findByTitle(t);
export type { Article };
