// Panel lateral derecho con la ficha resumida (en móvil, hoja inferior). La ficha completa tiene su propia página.
import { Detail, REL_LABEL, REL_ORDER, TYPE_COLOR, TYPE_LABEL, avatarHtml, ensureImgs, esc, getDetail, IDX, IMGS, imgUrl, impOf, isFace, shownName, valueHtml, relLabel, fieldLabel, nameOf, epithetOf, typeIcon, richText, rootOf, typeOf, ensureIndex, shapeIcon } from './data';
import { go, parseHash } from './nav';

const KEY_ORDER = ['epiteto', 'posicion', 'ocupación', 'recompensa', 'origen', 'nombrefruta', 'clase', 'tipo', 'organizacion', 'raza', 'estado', 'residencia', 'edad', 'nacimiento', 'capitan', 'navio', 'fecha', 'lugar', 'resultado'];
export const KEY_LABELS: Record<string, string> = { epiteto: 'Alias', posicion: 'Ocupación', recompensa: 'Recompensa', origen: 'Origen', nombrefruta: 'Fruta del Diablo', clase: 'Clase', tipo: 'Tipo', organizacion: 'Organización', raza: 'Raza', estado: 'Estado', residencia: 'Residencia', edad: 'Edad', nacimiento: 'Cumpleaños', capitan: 'Capitán', navio: 'Barcos', fecha: 'Fecha', lugar: 'Lugar', resultado: 'Resultado' };

let current = -1;
let onExpand: ((i: number) => void) | null = null;
export const currentFicha = () => current;
export function setExpandHandler(fn: ((i: number) => void) | null) { onExpand = fn; }

const el = () => document.getElementById('panel') as HTMLElement;
const body = () => document.getElementById('panel-body') as HTMLElement;

export function initPanel() {
  document.getElementById('pb-close')!.addEventListener('click', hidePanel);
  document.getElementById('pb-back')!.addEventListener('click', () => history.back());
  document.getElementById('pb-fwd')!.addEventListener('click', () => history.forward());
  body().addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const more = t.closest<HTMLElement>('[data-more]');
    if (more) { more.parentElement!.querySelectorAll('li.hid').forEach((li) => li.classList.remove('hid')); more.remove(); return; }
    if (t.closest('[data-act="expand"]') && onExpand) onExpand(current);
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !el().hidden && !(ev.target as HTMLElement).closest('input,select')) hidePanel(); });
}

export function closeQuiet() { current = -1; el().hidden = true; document.body.classList.remove('panel-open'); }
export function hidePanel() {
  closeQuiet();
  const r = parseHash(); if (r.ficha && r.view !== 'ficha' && !document.body.classList.contains('q-graph')) go(r.view, null, r.q); // en el grafo, plegar la ficha no cambia de ficha central
}

export function keyData(d: { ib: [string, string, string][] }, max = 9): [string, string][] {
  const seen = new Set<string>(); const rows: [string, string][] = [];
  for (const k of KEY_ORDER) { const f = d.ib.find((x) => x[2].toLowerCase() === k && x[1]); if (f && !seen.has(k)) { seen.add(k); rows.push([fieldLabel(KEY_LABELS[k] ?? f[0].replace(/:$/, '')), f[1]]); } }
  for (const f of d.ib) { if (rows.length >= max) break; const k = f[2].toLowerCase(); if (!seen.has(k) && f[1] && !/^(nombrejap|nombrerom|nesp|nlat|vol|cap|epi|primera|actor|liveaction|ant|sig|anterior|siguiente)/i.test(k)) { seen.add(k); rows.push([f[0].replace(/:$/, ''), f[1]]); } }
  return rows;
}
const kvHtml = (rows: [string, string][], lim = 170) => (rows.length ? `<dl class="kv">${rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${valueHtml(b)}</dd>`).join('')}</dl>` : '');

export function relationGroups(d: Detail, self = -1): { key: string; label: string; ids: number[]; rel: string; dir: number }[] {
  const groups = new Map<string, number[]>();
  for (const [r, j, dir] of d.rl) { const rel = IDX!.rels[r]!; if (rel === 'categorizado_en') continue; const k = `${rel}|${dir}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(rootOf(j)); }
  const order = (k: string) => { const [rel, dir] = k.split('|'); const o = REL_ORDER.indexOf(rel!); return (o < 0 ? 99 : o) * 2 + +dir!; };
  return [...groups.keys()].sort((a, b) => order(a) - order(b)).map((k) => { const [rel, dir] = k.split('|'); return { key: k, rel: rel!, dir: +dir!, label: '', ids: [...new Set(groups.get(k)!)].sort((a, b) => impOf(b) - impOf(a)) }; }).map((g) => ({ ...g, label: relLabel(g.rel, g.dir, self, g.ids.length) }));
}
export const itemHtml = (j: number, cls = '') => `<li class="${cls}"><a class="ilink item" href="#/ficha/${encodeURIComponent(nameOf(j))}" data-i="${j}">${avatarHtml(j, 30)}<span class="nm">${esc(shownName(j))}</span><small>${esc(TYPE_LABEL[typeOf(j)] ?? '')}</small></a></li>`;
function relations(d: Detail, self = -1): string {
  return relationGroups(d, self).map((g, n) => `<details class="rel" ${n < 3 ? 'open' : ''}><summary>${esc(g.label)} <b>${g.ids.length}</b></summary><ul>${g.ids.map((j, x) => itemHtml(j, x >= 12 ? 'hid' : '')).join('')}</ul>${g.ids.length > 12 ? `<button class="more" data-more>Ver las ${g.ids.length - 12} restantes</button>` : ''}</details>`).join('');
}

export async function showFicha(i0: number, opts: { canExpand: boolean }) {
  await ensureIndex(); const i = rootOf(i0);
  current = i;
  document.body.classList.add('panel-open'); el().hidden = false;
  const ty = typeOf(i), color = TYPE_COLOR[ty] ?? '#888';
  const headOf = (sub = '') => `<div class="ph" style="--c:${color}"><span class="tagtype xl" style="--c:${color}">${typeIcon(ty, 18, '#0b1d38')} ${esc(TYPE_LABEL[ty] ?? ty)}</span><h2>${esc(nameOf(i))}</h2>${sub ? `<p class="ph-sub">${esc(sub)}</p>` : ''}</div>`; const head = headOf();
  body().innerHTML = head + '<p class="loading">Cargando ficha…</p>'; body().scrollTop = 0;
  const [d] = await Promise.all([getDetail(i), ensureImgs()]);
  if (current !== i) return;
  const photo = IMGS?.[i] ? imgUrl(IMGS[i]!, 460) : '';
  const mb = [...new Set(d.mb)].map(rootOf).sort((a, b) => impOf(b) - impOf(a)).slice(0, 80);
  const full = `#/ficha/${encodeURIComponent(nameOf(i))}`;
  body().innerHTML = `${headOf(epithetOf(d))}
    ${photo ? `<img class="photo ${isFace(i) ? 'face' : 'fit'}" style="--c:${color}" src="${esc(photo)}" alt="${esc(nameOf(i))}" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
    <p class="summary">${richText(d.r) || '<em>Sin resumen en la wiki.</em>'}</p>
    <div class="btns"><a class="btn ilink" href="${full}" data-full data-i="${i}">Abrir ficha completa →</a>${opts.canExpand ? '<button class="btn ghost" data-act="expand">Expandir en el grafo</button>' : ''}<a class="btn ghost" href="#/comparar?a=${encodeURIComponent(nameOf(i))}">Comparar con…</a></div>
    ${kvHtml(keyData(d))}
    <div class="rels">${relations(d, i)}</div>
    ${mb.length ? `<details class="rel"><summary>Mencionado por <b>${d.mb.length}</b></summary><ul>${mb.map((j) => itemHtml(j)).join('')}</ul></details>` : ''}
    <p class="src"><a href="${esc(d.url)}" target="_blank" rel="noopener">Ver la ficha original en Fandom ↗</a> · <a href="${esc(d.url)}?action=history" target="_blank" rel="noopener">historial de autores</a><br><small>Texto © colaboradores de One Piece Wiki, licencia CC BY-SA.</small></p>
    <p class="conf" title="${esc(d.why)}">Tipo asignado automáticamente · confianza ${Math.round(d.conf * 100)} %</p>`;
}
