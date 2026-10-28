// Capa de datos: los ficheros data/<nombre>.js llaman a __od(nombre, datos); así se cargan con <script> también desde file://.
export interface Index { g?: string[]; sub: [number, number][]; types: string[]; rels: string[]; n: string[]; t: number[]; s: number[]; a: [number, string][] }
export interface Detail { r: string; url: string; ib: [string, string, string][]; cats: string[]; conf: number; why: string; rl: [number, number, number][]; m: number[]; mb: number[] }
export interface Article { h: string; t: [string, number, string][]; x: [string, string, string][] }
export interface FeaturedNode { i: number; n: string; t: number; s: number; m: string }
export interface Featured { types: string[]; rels: string[]; n: FeaturedNode[]; e: [number, number, number][] }

const pending = new Map<string, (d: unknown) => void>();
(window as unknown as { __od: (n: string, d: unknown) => void }).__od = (n, d) => pending.get(n)?.(d);
const cache = new Map<string, Promise<unknown>>();
export function loadData<T>(name: string): Promise<T> {
  let p = cache.get(name) as Promise<T> | undefined;
  if (!p) {
    p = new Promise<T>((res, rej) => {
      pending.set(name, res as (d: unknown) => void);
      const sc = document.createElement('script'); sc.src = `data/${name}.js`; sc.onerror = () => { cache.delete(name); rej(new Error('No se pudo cargar ' + name)); };
      document.head.append(sc);
    });
    cache.set(name, p);
  }
  return p;
}

export const TYPE_LABEL: Record<string, string> = {
  personaje: 'Personaje', organizacion: 'Organización', fruta_del_diablo: 'Fruta del Diablo', barco: 'Barco', lugar: 'Lugar', saga: 'Saga', arco: 'Arco', capitulo: 'Capítulo', episodio: 'Episodio', volumen: 'Volumen',
  tecnica: 'Técnica', arma: 'Arma', animal: 'Animal', raza: 'Raza', concepto: 'Concepto', evento: 'Evento', medio: 'Obra / medio', persona_real: 'Persona real', combate: 'Combate', meta: 'Página de la wiki', objeto: 'Objeto', naturaleza: 'Naturaleza',
};
export const TYPE_PLURAL: Record<string, string> = {
  personaje: 'Personajes', organizacion: 'Organizaciones', fruta_del_diablo: 'Frutas del Diablo', barco: 'Barcos', lugar: 'Lugares', saga: 'Sagas', arco: 'Arcos', capitulo: 'Capítulos', episodio: 'Episodios', volumen: 'Volúmenes',
  tecnica: 'Técnicas', arma: 'Armas', animal: 'Animales', raza: 'Razas', concepto: 'Conceptos', evento: 'Eventos', medio: 'Obras y medios', persona_real: 'Personas reales', combate: 'Combates', meta: 'Páginas de la wiki', objeto: 'Objetos', naturaleza: 'Naturaleza',
};
export const TYPE_COLOR: Record<string, string> = {
  personaje: '#f2b84b', organizacion: '#59c98b', fruta_del_diablo: '#e8566c', barco: '#4bb3f2', lugar: '#b48cf2', saga: '#ff8a3d', arco: '#ffb27a', capitulo: '#8793ad', episodio: '#8793ad', volumen: '#8793ad',
  tecnica: '#ff7ac0', arma: '#c9d1d9', animal: '#9bd84f', raza: '#4fd1c5', concepto: '#a6b0c3', evento: '#f0e442', medio: '#9aa7ff', persona_real: '#d4a5a5', combate: '#e57373', meta: '#6d7893', objeto: '#d6a16b', naturaleza: '#6fbf73',
};
// forma del nodo por tipo (coordenadas en caja unidad) y recorte de cara para las fotos de personas
export const SHAPE_PATH: Record<string, string> = {
  circle: 'M.5 0A.5.5 0 1 1 .5 1A.5.5 0 1 1 .5 0Z', hex: 'M.5 0L1 .25L1 .75L.5 1L0 .75L0 .25Z', diamond: 'M.5 0L1 .5L.5 1L0 .5Z', shield: 'M0 0H1V.55Q1 .85 .5 1Q0 .85 0 .55Z',
  hull: 'M0 .12H1L.86 .92H.14Z', tri: 'M.5 0L1 .95H0Z', star: 'M.5 0L.62 .38L1 .5L.62 .62L.5 1L.38 .62L0 .5L.38 .38Z', square: 'M.18 0H.82Q1 0 1 .18V.82Q1 1 .82 1H.18Q0 1 0 .82V.18Q0 0 .18 0Z',
};
export const TYPE_SHAPE: Record<string, string> = { personaje: 'circle', animal: 'circle', persona_real: 'circle', raza: 'circle', organizacion: 'hex', fruta_del_diablo: 'diamond', lugar: 'shield', barco: 'hull', tecnica: 'star', arma: 'tri', evento: 'star' };
export const shapeOf = (ty: string) => TYPE_SHAPE[ty] ?? 'square';
// insignias (iconos 16x16) por tipo
export const TYPE_ICON: Record<string, string> = {
  personaje: 'M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 6c0-3 2-4.5 5-4.5s5 1.5 5 4.5z', organizacion: 'M3 2h1.5v12H3zM4.5 2.5h8l-2.2 3 2.2 3h-8z', fruta_del_diablo: 'M8 4c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5zM8 4c0-1 .5-2 2-2.5l.3 1c-1 .3-1.4.9-1.5 1.5z',
  barco: 'M2 10h12l-2 4H4zM8 2v7.5M8 2.5l4.5 6H8z', lugar: 'M8 1.5A4.5 4.5 0 0 0 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5A4.5 4.5 0 0 0 8 1.5zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4z', tecnica: 'M9 1L3 9h4l-1 6 7-9H9z',
  arma: 'M13 2L7 8l1 1 6-6zM6 9l-3 3 1 1 3-3z', evento: 'M8 1l2 4.5 5 .5-3.7 3.3 1.1 4.9L8 11.7 3.6 14.2l1.1-4.9L1 6l5-.5z', concepto: 'M8 3a5 5 0 1 0 0 10A5 5 0 0 0 8 3z', saga: 'M2 3h12v10H2z', arco: 'M2 11a6 6 0 0 1 12 0z',
};
export const FACE_TYPES = new Set(['personaje', 'animal', 'persona_real', 'raza']);
// aristas: color, grosor y trazo por relación
export const REL_STYLE: Record<string, { c: string; w: number; d?: string }> = {
  miembro_de: { c: '#59c98b', w: 1.8 }, progenitor_de: { c: '#ff7ac0', w: 2.4 }, progenitor_adoptivo_de: { c: '#ff9bd2', w: 2.2 }, hermano_de: { c: '#f472b6', w: 2.2 }, hermano_adoptivo_de: { c: '#f9a8d4', w: 2.2 }, abuelo_de: { c: '#e879a9', w: 2 }, tio_de: { c: '#fb7185', w: 2 }, conyuge_de: { c: '#fb5f8d', w: 2.4 }, companero_de: { c: '#2dd4bf', w: 2 }, tripulacion_de: { c: '#2dd4bf', w: 2.4 }, aliado_de: { c: '#38bdf8', w: 2 }, amigo_de: { c: '#a3e635', w: 2 }, coincidido_con: { c: '#8aa0bd', w: 1.2 }, mascota_de: { c: '#f59e0b', w: 2 }, enemigo_de: { c: '#ef4444', w: 2.2 }, enfrenta_a: { c: '#ff9f43', w: 2.2 }, capitan_de: { c: '#f2b84b', w: 2.8 }, usa_barco: { c: '#4bb3f2', w: 2 }, come: { c: '#e8566c', w: 2 }, evoluciona_en: { c: '#ff8a3d', w: 2.6, d: '7 4' }, familiar_de: { c: '#ff7ac0', w: 1.8 },
  originario_de: { c: '#b48cf2', w: 1.5, d: '5 4' }, reside_en: { c: '#b48cf2', w: 1.5, d: '5 4' }, en_region: { c: '#b48cf2', w: 1.5, d: '5 4' }, base_en: { c: '#b48cf2', w: 1.5, d: '5 4' },
  parte_de: { c: '#ffb27a', w: 1.8 }, anterior: { c: '#ffb27a', w: 1.8 }, siguiente: { c: '#ffb27a', w: 1.8 }, dirigido_por: { c: '#9aa7ff', w: 1.8 }, menciona: { c: '#c5d6ee', w: 1.1, d: '2 4' },
};
export const relStyle = (r: string) => REL_STYLE[r] ?? { c: '#aac0de', w: 1.3 };
// [etiqueta si la ficha es el origen de la relación, etiqueta si es el destino]
export const REL_LABEL: Record<string, [string, string]> = {
  miembro_de: ['Miembro de', 'Miembros'], capitan_de: ['Capitán de', 'Capitán'], usa_barco: ['Usa el barco', 'Usado por'], come: ['Come', 'Comida por'], evoluciona_en: ['Evoluciona en', 'Evoluciona de'],
  originario_de: ['Originario de', 'Originarios de aquí'], reside_en: ['Reside en', 'Residentes'], familiar_de: ['Familia', 'Familia'], parte_de: ['Parte de', 'Incluye'], anterior: ['Anterior', 'Siguiente'], siguiente: ['Siguiente', 'Anterior'],
  aparece_en: ['Aparece en', 'Aparecen aquí'], primera_aparicion: ['Primera aparición', 'Primera aparición de'], es_de_raza: ['Raza', 'Miembros de la raza'], ocurre_en: ['Ocurre en', 'Ocurre aquí'], combatiente_en: ['Combate en', 'Combatientes'],
  doblado_por: ['Doblado por', 'Dobla a'], en_region: ['Región', 'Contiene'], dirigido_por: ['Dirigido por', 'Dirige'], clase: ['Clase', 'Incluye'], base_en: ['Base en', 'Base de'], de_nacion: ['Nación', 'Naciones'],
  propiedad_de: ['Propiedad de', 'Propietario'], relacionado: ['Relacionado con', 'Relacionado con'], categorizado_en: ['Categoría', 'En esta categoría'], menciona: ['Se mencionan', 'Se mencionan'],
};
export const REL_ORDER = ['miembro_de', 'capitan_de', 'familiar_de', 'progenitor_de', 'progenitor_adoptivo_de', 'hermano_de', 'hermano_adoptivo_de', 'abuelo_de', 'tio_de', 'conyuge_de', 'tripulacion_de', 'mascota_de', 'aliado_de', 'amigo_de', 'enemigo_de', 'enfrenta_a', 'coincidido_con', 'usa_barco', 'come', 'evoluciona_en', 'familiar_de', 'originario_de', 'reside_en', 'parte_de', 'combatiente_en', 'ocurre_en', 'base_en', 'dirigido_por', 'es_de_raza', 'anterior', 'siguiente', 'aparece_en', 'primera_aparicion', 'clase', 'doblado_por', 'en_region', 'de_nacion', 'propiedad_de', 'relacionado'];
export const WEAK = new Set(['categorizado_en', 'primera_aparicion', 'aparece_en', 'es_de_raza', 'clase', 'relacionado', 'doblado_por']);

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const fmtN = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // 7509 -> 7.509
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const initials = (n: string) => n.replace(/\(.*?\)/g, '').split(/[\s/:'-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

// miniaturas de Fandom (hotlink): "ruta|cb" -> URL con ancho w
const IMG_BASE = 'https://static.wikia.nocookie.net/onepiece/images/';
export const imgUrl = (ref: string, w = 120): string => {
  if (!ref) return '';
  if (ref.startsWith('!')) return ref.slice(1);
  const [path, cb] = ref.split('|');
  return `${IMG_BASE}${path}/revision/latest/scale-to-width-down/${w}?cb=${cb}&path-prefix=es`;
};

export let IDX: Index | null = null;
export let IMGS: string[] | null = null;
const byName = new Map<string, number>();
const SUBS = new Map<number, number>(); // subpágina -> ficha principal que la integra
const indexP = () => loadData<Index>('index').then((d) => { IDX = d; d.n.forEach((n, i) => byName.set(norm(n), i)); d.sub.forEach(([s, r]) => SUBS.set(s, r)); return d; });
const imgsP = () => loadData<string[]>('imgs').then((d) => (IMGS = d));
export const ensureIndex = indexP; export const ensureImgs = imgsP;
export const rootOf = (i: number) => SUBS.get(i) ?? i;
export const isSub = (i: number) => SUBS.has(i);
export const findByTitle = (t: string) => { const i = byName.get(norm(t)); return i === undefined ? undefined : rootOf(i); };
export const nameOf = (i: number) => IDX?.n[i] ?? '';
export const typeOf = (i: number) => (IDX ? IDX.types[IDX.t[i]!]! : '');
export const impOf = (i: number) => IDX?.s[i] ?? 0;
export const isFace = (i: number) => FACE_TYPES.has(typeOf(i));
export const thumb = (i: number, w = 96) => (IMGS ? imgUrl(IMGS[i] ?? '', w) : '');

const SHARDS = 64, ART_SHARDS = 320;
export const getDetail = async (i: number): Promise<Detail> => (await loadData<Record<string, Detail>>(`detail/${i % SHARDS}`))[i]!;
export const getArticle = async (i: number): Promise<Article | undefined> => { const r = rootOf(i); return (await loadData<Record<string, Article>>(`art/${r % ART_SHARDS}`))[r]; };

// avatar: foto si hay (recortada hacia la cara en personas), iniciales con el color del tipo si no
export function avatarHtml(i: number, size = 28): string {
  const ty = typeOf(i), url = thumb(i, size * 3);
  return `<span class="av ${FACE_TYPES.has(ty) ? 'face' : ''}" style="--c:${TYPE_COLOR[ty] ?? '#888'};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px">${esc(initials(nameOf(i)))}${url ? `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
}
// icono de tipo (insignia) en SVG en línea
export const typeIcon = (ty: string, size = 14, color = 'currentColor') => `<svg viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true" focusable="false"><path d="${TYPE_ICON[ty] ?? TYPE_ICON.concepto}" fill="${color}" stroke="${color}" stroke-width=".6" stroke-linejoin="round"/></svg>`;
export const shapeIcon = (ty: string, size = 16) => `<svg viewBox="-.05 -.05 1.1 1.1" width="${size}" height="${size}" aria-hidden="true" focusable="false"><path d="${SHAPE_PATH[shapeOf(ty)]}" fill="${TYPE_COLOR[ty] ?? '#888'}" stroke="#fff" stroke-opacity=".55" stroke-width=".06"/></svg>`;
// texto del resumen con enlaces internos ⟦idx|texto⟧
export const richText = (s: string) => esc(s).replace(/⟦(\d+)\|([^⟧]*)⟧/g, (_m, i, t) => `<a class="ilink" href="#/ficha/${encodeURIComponent(nameOf(+i))}" data-i="${i}">${t}</a>`);
export const plainText = (s: string) => s.replace(/⟦\d+\|([^⟧]*)⟧/g, '$1');
// alias o epíteto de la ficha (infobox), para el subtítulo de la cabecera
export const epithetOf = (d: { ib: [string, string, string][] }): string => { const f = d.ib.find((x) => /^(epiteto|alias|apodo)$/i.test(x[2]) && x[1]); return f ? f[1].replace(/\s*\(.*$/, '').split(/ · |;|,/)[0]!.trim().slice(0, 60) : ''; };
export const berries = (n: number) => `${fmtN(n)} ฿`;

// Barcos de la ruta: Going Merry hasta la saga de Water 7, Thousand Sunny desde Thriller Bark (dibujos propios).
export type ShipKind = 'merry' | 'sunny';
const HULL = (c1: string, c2: string) => `<path d="M6 34 Q30 52 54 34 L50 28 L10 28 Z" fill="${c1}" stroke="#2a1a0c" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 28 H50" stroke="${c2}" stroke-width="2.4"/>`;
const SHIP_ART: Record<ShipKind, string> = {
  merry: `<svg viewBox="0 0 60 56" aria-hidden="true">${HULL('#b5824a', '#8a5a2c')}<path d="M30 28 V6" stroke="#4a2f16" stroke-width="2.4"/><path d="M30 8 Q42 14 30 25 Z" fill="#f4ecd6" stroke="#4a2f16" stroke-width="1.2"/><circle cx="23" cy="14" r="0" fill="none"/><path d="M12 28 q-7-2 -8 -8 q6 1 11 5 z" fill="#d9a441" stroke="#2a1a0c" stroke-width="1.2"/><circle cx="31" cy="11" r="3.3" fill="#1b1b1b"/><path d="M28 10 l6 2 M28 12 l6 -2" stroke="#fff" stroke-width=".9"/><circle cx="21" cy="33" r="1.6" fill="#2a1a0c"/><circle cx="39" cy="33" r="1.6" fill="#2a1a0c"/></svg>`,
  sunny: `<svg viewBox="0 0 60 56" aria-hidden="true">${HULL('#e8b53d', '#c0392b')}<path d="M24 28 V8 M38 28 V12" stroke="#4a2f16" stroke-width="2.2"/><path d="M24 9 Q14 15 24 25 Z" fill="#f7f1df" stroke="#4a2f16" stroke-width="1.1"/><path d="M38 13 Q48 18 38 25 Z" fill="#f7f1df" stroke="#4a2f16" stroke-width="1.1"/><circle cx="23" cy="14" r="2.8" fill="#1b1b1b"/><circle cx="12" cy="24" r="6" fill="#e8b53d" stroke="#2a1a0c" stroke-width="1.4"/><circle cx="10.5" cy="23" r="1.1" fill="#2a1a0c"/><circle cx="13.7" cy="23" r="1.1" fill="#2a1a0c"/><path d="M9.5 26.5 q3 2.2 6 0" stroke="#2a1a0c" stroke-width="1" fill="none"/><circle cx="31" cy="33" r="2" fill="#2a1a0c"/></svg>`,
};
export const shipSvg = (k: ShipKind): string => SHIP_ART[k];

// ---- etiquetas de relación con concordancia de género y número ----
// [m, f, plural] cuando la forma depende de quién es la ficha central (dir 0); [uno, varios] cuando depende de cuántas fichas hay en el grupo (dir 1)
type Forms = [string, string, string];
const SELF: Record<string, Forms> = {
  miembro_de: ['Miembro de', 'Miembro de', 'Miembros de'], capitan_de: ['Capitán de', 'Capitana de', 'Capitanes de'], propiedad_de: ['Propietario de', 'Propietaria de', 'Propietarios de'],
  originario_de: ['Originario de', 'Originaria de', 'Originarios de'], reside_en: ['Reside en', 'Reside en', 'Residen en'], combatiente_en: ['Combate en', 'Combate en', 'Combaten en'],
  aparece_en: ['Aparece en', 'Aparece en', 'Aparecen en'], doblado_por: ['Doblado por', 'Doblada por', 'Doblados por'], dirigido_por: ['Dirigido por', 'Dirigida por', 'Dirigidos por'],
  usa_barco: ['Barco', 'Barco', 'Barcos'], come: ['Fruta del Diablo', 'Fruta del Diablo', 'Frutas del Diablo'], familiar_de: ['Familia', 'Familia', 'Familia'], es_de_raza: ['Raza', 'Raza', 'Raza'],
  base_en: ['Base en', 'Base en', 'Bases en'], ocurre_en: ['Ocurre en', 'Ocurre en', 'Ocurre en'], en_region: ['Región', 'Región', 'Región'], de_nacion: ['Nación', 'Nación', 'Nación'],
  parte_de: ['Parte de', 'Parte de', 'Parte de'], evoluciona_en: ['Evoluciona en', 'Evoluciona en', 'Evoluciona en'], primera_aparicion: ['Primera aparición', 'Primera aparición', 'Primera aparición'],
  anterior: ['Anterior', 'Anterior', 'Anterior'], siguiente: ['Siguiente', 'Siguiente', 'Siguiente'], relacionado: ['Otras fichas relacionadas', 'Otras fichas relacionadas', 'Otras fichas relacionadas'], menciona: ['Menciona', 'Menciona', 'Mencionan'], mascota_de: ['Mascotas y compañeros animales', 'Mascotas y compañeros animales', 'Mascotas y compañeros animales'],
};
const OTHER: Record<string, [string, string]> = {
  miembro_de: ['Miembro', 'Miembros'], capitan_de: ['Capitán', 'Capitanes'], propiedad_de: ['Pertenece a', 'Pertenece a'], originario_de: ['Natural de aquí', 'Naturales de aquí'], reside_en: ['Residente', 'Residentes'],
  combatiente_en: ['Combatiente', 'Combatientes'], aparece_en: ['Aparece aquí', 'Aparecen aquí'], doblado_por: ['Doblaje de', 'Doblaje de'], dirigido_por: ['Dirige', 'Dirige'], usa_barco: ['Usado por', 'Usado por'],
  come: ['Usuario', 'Usuarios'], familiar_de: ['Familia', 'Familia'], es_de_raza: ['Miembro de la raza', 'Miembros de la raza'], base_en: ['Sede de', 'Sede de'], ocurre_en: ['Escenario de', 'Escenario de'],
  en_region: ['Incluye', 'Incluye'], de_nacion: ['Incluye', 'Incluye'], parte_de: ['Incluye', 'Incluye'], evoluciona_en: ['Evoluciona de', 'Evoluciona de'], primera_aparicion: ['Primera aparición de', 'Primera aparición de'],
  anterior: ['Siguiente', 'Siguiente'], siguiente: ['Anterior', 'Anterior'], relacionado: ['Otras fichas relacionadas', 'Otras fichas relacionadas'], menciona: ['Mencionado en', 'Mencionados en'], mascota_de: ['Compañero de', 'Compañeros de'],
};
const PLURAL_NAME = /^(Piratas|Los |Las |Marines|Cazadores|Revolucionarios|Samuráis|Ninjas|Gigantes|Hermanos|Tribu|Clan|Escuadrón)/;
const FEM_ORG = /^(Alianza|Marina|Familia|Banda|Tripulación|Flota|Armada|Organización|Tribu|Compañía)/;
// concordancia de la ficha central: género (m/f/n) y número (plural para razas, pueblos y grupos de personas)
export function subjOf(i: number): { g: 'm' | 'f'; pl: boolean } {
  const ty = typeOf(i), n = nameOf(i); const pl = ty === 'raza' || (ty === 'personaje' && PLURAL_NAME.test(n));
  return { g: ty === 'organizacion' ? (FEM_ORG.test(n) ? 'f' : 'm') : IDX?.g?.[i] === 'f' ? 'f' : 'm', pl };
}
/** Etiqueta natural de una relación vista desde la ficha `self`; `dir` 0 = la ficha es el origen; `count` = nº de fichas del grupo */
const KINL: Record<string, [string[], string[]]> = {
  progenitor_de: [['Hijo', 'Hija', 'Hijos', 'Hijas'], ['Padre', 'Madre', 'Padres', 'Madres']], progenitor_adoptivo_de: [['Hijo adoptivo', 'Hija adoptiva', 'Hijos adoptivos', 'Hijas adoptivas'], ['Padre adoptivo', 'Madre adoptiva', 'Padres adoptivos', 'Madres adoptivas']],
  hermano_de: [['Hermano', 'Hermana', 'Hermanos', 'Hermanas'], ['Hermano', 'Hermana', 'Hermanos', 'Hermanas']], hermano_adoptivo_de: [['Hermano adoptivo', 'Hermana adoptiva', 'Hermanos adoptivos', 'Hermanas adoptivas'], ['Hermano adoptivo', 'Hermana adoptiva', 'Hermanos adoptivos', 'Hermanas adoptivas']],
  abuelo_de: [['Nieto', 'Nieta', 'Nietos', 'Nietas'], ['Abuelo', 'Abuela', 'Abuelos', 'Abuelas']], tio_de: [['Sobrino', 'Sobrina', 'Sobrinos', 'Sobrinas'], ['Tío', 'Tía', 'Tíos', 'Tías']], conyuge_de: [['Cónyuge', 'Cónyuge', 'Cónyuges', 'Cónyuges'], ['Cónyuge', 'Cónyuge', 'Cónyuges', 'Cónyuges']],
};
const genOf = (j: number) => (IDX?.g?.[j] === 'f' ? 'f' : 'm');
export function relLabel(rel: string, dir: number, self: number, count = 1, ids: number[] = []): string {
  const kin = KINL[rel]; if (kin) { const f = kin[dir === 0 ? 0 : 1]; const gs = new Set(ids.map(genOf)); const n = Math.max(count, ids.length); if (n <= 1) return gs.has('f') ? f[1]! : f[0]!; return gs.size === 1 && gs.has('f') ? f[3]! : f[2]!; }
  const SYM: Record<string, string> = { familiar_de: 'Familia', companero_de: 'Compañeros', tripulacion_de: 'Tripulación', aliado_de: 'Aliados', amigo_de: 'Amigos', coincidido_con: 'Han coincidido', enemigo_de: 'Enemigos', enfrenta_a: 'Enfrentamientos' }; if (SYM[rel]) return SYM[rel]!;
  if (dir === 0) { const f = SELF[rel]; if (!f) return rel.replace(/_/g, ' '); const s = subjOf(self); return s.pl ? f[2] : s.g === 'f' ? f[1] : f[0]; }
  if (rel === 'menciona') { const s = subjOf(self); return s.pl ? 'Mencionados en' : s.g === 'f' ? 'Mencionada en' : 'Mencionado en'; }
  const o = OTHER[rel]; if (!o) return rel.replace(/_/g, ' '); return count > 1 ? o[1] : o[0];
}
// nombre legible de las subpáginas («Arco de X/Enfrentamientos» → «Enfrentamientos: Arco de X»)
export const shownName = (i: number): string => { const n = nameOf(i), k = n.indexOf('/'); return k < 0 ? n : `${n.slice(k + 1)}: ${n.slice(0, k)}`; };
// categorías secundarias (tono gris): ocultas por defecto en el grafo
export const GREY_RELS = new Set(['combatiente_en', 'propiedad_de', 'es_de_raza', 'primera_aparicion', 'aparece_en', 'doblado_por', 'relacionado', 'menciona', 'categorizado_en', 'clase', 'coincidido_con']);
export const plural = (n: number, uno: string, varios: string) => `${fmtN(n)} ${n === 1 ? uno : varios}`;
// «Epíteto» se muestra como «Alias» en todos los datos de ficha (el texto de los artículos de la wiki no se toca)
export const fieldLabel = (l: string) => l.replace(/^Epítetos?(?=\W|$)/i, 'Alias');

// ---- valores de la infobox: listas con viñetas y enlaces a toda ficha que exista ----
let ALIAS: Map<string, number> | null = null;
const aliasMap = () => { if (!ALIAS) { ALIAS = new Map(); for (const [i, a] of IDX!.a) for (const x of a.split('|')) { const k = norm(x); if (!ALIAS.has(k)) ALIAS.set(k, i); } } return ALIAS; };
export const resolveName = (t: string): number | undefined => {
  const k0 = t.trim().replace(/[.,;:]+$/, ''); if (k0.length < 2) return undefined;
  for (const x of [k0, k0.replace(/^(el|la|los|las)\s+/i, ''), 'Fruta ' + k0, k0.replace(/^Fruta\s+/i, '')]) { const i = findByTitle(x); if (i !== undefined) return i; const a = aliasMap().get(norm(x)); if (a !== undefined) return rootOf(a); }
  return undefined;
};
const linkOne = (p: string): string => {
  const m = p.match(/^(.*?)\s*(?:\(([^)]*)\))?\s*$/); const main = (m?.[1] ?? p).trim(), q = m?.[2]; const i = resolveName(main);
  const body = i !== undefined ? `<a class="ilink" href="#/ficha/${encodeURIComponent(nameOf(i))}" data-i="${i}">${esc(main)}</a>` : esc(main);
  return body + (q ? ` <small class="q">${esc(q)}</small>` : '');
};
export function valueHtml(v: string): string {
  const parts = v.split(/ · |;\s*|\n/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? `<ul class="kv-list">${parts.map((p) => `<li>${linkOne(p)}</li>`).join('')}</ul>` : linkOne(parts[0] ?? v);
}
