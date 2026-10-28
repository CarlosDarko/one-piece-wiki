// Genera public/data/* a partir de data/pages/*.json.gz (rastreo) + data/redirects.json (+ data/catparents.json opcional).
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as cheerio from 'cheerio';
import { emitWeb } from './emit-web.mjs';
import { sanitizeArticle } from './article.mjs';

const OUT = 'public/data';
const clean = (s) => s.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
const norm = (s) => decodeURIComponent(s).replace(/_/g, ' ').trim();
const key = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Primer párrafo con los enlaces internos marcados como [[Título|texto]] (se limita a ~620 caracteres visibles)
function markedIntro($, p0) {
  if (!p0.length) return '';
  const LIM = 620; let out = '', plain = 0, done = false;
  const walk = (nodes) => {
    for (const c of nodes) {
      if (done) return;
      if (c.type === 'text') {
        const t = c.data.replace(/\s+/g, ' ');
        if (plain + t.length > LIM) { out += t.slice(0, LIM - plain).replace(/\s+\S*$/, '') + '…'; done = true; return; }
        out += t; plain += t.length;
      } else if (c.type === 'tag') {
        if (['sup', 'style', 'script', 'small'].includes(c.name)) continue;
        const href = c.attribs?.href ?? '';
        if (c.name === 'a' && href.startsWith('/es/wiki/') && !href.includes(':')) {
          const t = $(c).text().replace(/\s+/g, ' ');
          if (plain + t.length > LIM) { out += '…'; done = true; return; }
          out += `[[${norm(href.slice(9).split('#')[0])}|${t}]]`; plain += t.length;
        } else walk(c.children ?? []);
      }
    }
  };
  walk(p0.get(0).children ?? []);
  return out.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
}

// ---------- 1. carga ----------
const redirects = existsSync('data/redirects.json') ? JSON.parse(readFileSync('data/redirects.json', 'utf8')) : {};
const catParents = existsSync('data/catparents.json') ? JSON.parse(readFileSync('data/catparents.json', 'utf8')) : {};
const ents = new Map();
const alias = new Map(); // clave normalizada -> id canónico
for (const f of readdirSync('data/pages')) {
  const p = JSON.parse(gunzipSync(readFileSync('data/pages/' + f)));
  if (ents.has(p.title)) { alias.set(key(p.solicitado), p.title); continue; }
  const $ = cheerio.load(p.text);
  const aside = $('aside.portable-infobox').first();
  const fields = [];
  aside.find('[data-source]').each((_, e) => {
    const k = $(e).attr('data-source');
    const val = $(e).is('.pi-data-value') ? $(e) : $(e).find('.pi-data-value');
    if (!val.length) return;
    // varios valores en un mismo campo (saltos de línea o listas): se separan con « · » en vez de pegarse
    const vc = val.clone(); vc.find('br').replaceWith(' · '); vc.find('li').each((_, li) => { $(li).append(' · '); });
    const value = clean(vc.text()).replace(/(\s*·\s*)+/g, ' · ').replace(/^ · | · $/g, '');
    const hrefs = val.find('a[href^="/es/wiki/"]').map((_, a) => norm($(a).attr('href').slice(9).split('#')[0])).get();
    if (value || hrefs.length) fields.push({ k: k.toLowerCase(), label: clean($(e).find('.pi-data-label').text()) || k, value, hrefs });
  });
  const img = aside.find('img').first();
  const firstP = $('p').filter((_, e) => !$(e).closest('aside, table').length && clean($(e).text()).length > 60).first();
  const full = clean(firstP.text());
  ents.set(p.title, {
    id: p.title, cats: p.categories.map((c) => c.category.replace(/_/g, ' ')), tpl: p.templates.map((t) => t.title.replace(/^Plantilla:/, '')),
    summaryMarked: markedIntro($, firstP),
    art: sanitizeArticle($),
    introMarked: (() => { const p0 = $('p').filter((_, e) => !$(e).closest('aside, table').length && clean($(e).text()).length > 60).first().clone(); p0.find('a[href^="/es/wiki/"]').each((_, a) => { $(a).replaceWith('[[' + norm($(a).attr('href').slice(9).split('#')[0]) + '|' + $(a).text() + ']]'); }); return clean(p0.text()).slice(0, 700); })(),
    fields, summary: full.length > 500 ? full.slice(0, 500).replace(/\s+\S*$/, '') + '…' : full, first: full.slice(0, 260),
    img: img.attr('data-src') || img.attr('src') || null,
    links: [...new Set(p.links.filter((l) => l.ns === 0 && l.exists !== false).map((l) => l.title))],
    bodyLinks: $('p a[href^="/es/wiki/"]').slice(0, 12).map((_, a) => norm($(a).attr('href').slice(9).split('#')[0])).get(),
  });
  alias.set(key(p.title), p.title); alias.set(key(p.solicitado), p.title);
}
for (const [from, to] of Object.entries(redirects)) { const t = alias.get(key(to)); if (t && !alias.has(key(from))) alias.set(key(from), t); }
const resolve = (title) => alias.get(key(title));
console.log('fichas cargadas:', ents.size, 'alias:', alias.size);

// ---------- 2. tipado ----------
export const TYPES = ['personaje', 'organizacion', 'fruta_del_diablo', 'barco', 'lugar', 'saga', 'arco', 'capitulo', 'episodio', 'volumen', 'tecnica', 'arma', 'animal', 'raza', 'concepto', 'evento', 'medio', 'persona_real', 'combate', 'meta', 'objeto', 'naturaleza'];
// [regex sobre la señal, tipo, peso]; la señal puede ser nombre de categoría, plantilla, campo de infobox o primera frase
const CAT_RULES = [
  [/^(One Piece Magazine|Color walks|Databooks|Volúmenes especiales|Spin-offs|Contenido inédito|One Piece Internacional|Mercancías|Revistas|Artbooks|Guías de|Fanbooks|Películas)/, 'medio', 4],
  [/^(Historia|Realeza|Términos)$/, 'concepto', 3],
  [/^Episodios (dirigidos|escritos)/, 'meta', 0],
  [/^(One Piece Film|Películas|Peliculas)/, 'medio', 4],
  [/^(Actuaciones en vivo|Álbumes|One Piece Nippon Judan|Mercancías|One Piece Cover Comic Project|Manga$|Música|Anime$|Especiales de TV|Videojuegos|Juguetes|Figuras)/, 'medio', 3],
  [/^(Operaciones|Competiciones y torneos|Eventos|Misiones)/, 'evento', 3],
  [/^(Munición|Bazookas|Cañones|Municiones|Explosivos)/, 'arma', 3],
  [/^(Plantas y árboles|Minerales|Corrientes|Sustancias químicas|Fenómenos|Clima|Rocas|Hongos|Flores|Frutas y verduras)/, 'naturaleza', 3],
  [/^(Enfermedades|Dolencias|Venenos)/, 'concepto', 3],
  [/^(Estilos de combate|Estilos de lucha)/, 'tecnica', 3],
  [/^(Antiguos? grupos|Antiguas organizaciones|Gruposb|Organizacionesb|Territoriosb|Divisionesb|Bandasb)/, 'organizacion', 3],
  [/^(Openings?|Endings?|Omakes?|Minihistorias|One-Shots?|Crossover|Eyecatchers?|Canciones|Banda sonora|Literatura|Libros|Novelas)$/, 'medio', 3],
  [/^(Listas?|Guía de|Historiab|One Piece Wiki|Wikib|Errores)/, 'meta', 3],
  [/^(Armas|Espadas|Cuchillas|Armas de fuego|Escudos|Objetos dialeros|Dial)\b/, 'arma', 3],
  [/^(Términos|Tecnología|Artefactos|Brújulas|Fármacos|Drogas|Sustancias|Marcas|Alimentos|Bebidas|Objetos|Elementos|Instrumentos|Vehículos|Medicinas|Venenos|Herramientas)\b/, 'objeto', 3],
  [/^(Ocupaciones|Rangos|Sociedad y cultura|Conceptos|Idiomas?|Cultura)\b/, 'concepto', 3],
  [/^Arcos argumentales/, 'arco', 6], [/^Sagas$/, 'saga', 6], [/^Capítulos?\b|^Capitulos?\b/, 'capitulo', 4], [/^Episodios?\b/, 'episodio', 4], [/^Volúmenes?\b|^Tomos\b/, 'volumen', 4],
  [/^Enfrentamientos/, 'combate', 4],
  [/^(Frutas del diablo|Zoan|Paramecia|Logia)\b|^Frutas\b/, 'fruta_del_diablo', 3],
  [/^Barcos\b|^Navíos\b|^Naves\b/, 'barco', 4],
  [/^(Islas|Lugares|Mares|Países|Reinos|Ciudades|Pueblos|Localizaciones|Regiones|Ubicaciones|Océanos|Calles|Edificios|Torres|Cárceles|Prisiones|Fortalezas)\b/, 'lugar', 3],
  [/^(Técnicas|Ataques|Habilidades|Movimientos|Estilos de|Artes marciales)\b/, 'tecnica', 3],
  [/^(Armas|Espadas|Katanas|Pistolas|Armas dialeras)\b|^Armas\b/, 'arma', 3],
  [/^(Animales|Bestias|Criaturas|Mascotas)\b/, 'animal', 3], [/^(Razas|Especies)\b/, 'raza', 3],
  [/^(Bandas|Organizaciones|Tripulaciones|Familias|Grupos|Ejércitos|Gobiernos|Facciones|Alianzas|Escuadrones|Flotas)\b/, 'organizacion', 3],
  [/^(Películas|Especiales|OVAs?|Videojuegos|Juegos|Libros|Canciones|Música|Novelas|Series|Musicales|Cortos|Artbooks|Revistas|Merchandising|Anime|Manga)\b/, 'medio', 3],
  [/^(Seiyuus?|Actores|Actrices|Mangakas?|Directores|Compositores|Cantantes|Dobladores|Personal|Autores|Productores|Estudios)\b/, 'persona_real', 3],
  [/^(Eventos|Guerras|Batallas|Incidentes|Sucesos|Eras|Períodos)\b/, 'evento', 3],
  [/^(Humanos|Masculinos|Femeninos|Personajes|Antiguos|Usuarios del|Usuarios de|Consumidores|Espadachines|Recompensas|Piratas\b|Marines|Almirantes|Capitanes|Vicealmirantes|Antagonistas|Protagonistas|Fallecidos|Gigantes|Gyojin|Minks|Sirenas|Hombres-pez|Revolucionarios|Cazarrecompensas|Médicos|Cocineros|Doctores|Reyes|Reinas|Príncipes|Princesas|Nobles|Dragones Celestiales|Supernovas|Los Once Supernovas|Shichibukai|Almirantes de la Flota|Yonkou|Cuatro Emperadores)\b/, 'personaje', 2],
  [/^Wikia|^Ayuda|^Wiki\b|^Mantenimiento|^Plantillas\b|^Artículos\b|^Páginas\b/, 'meta', 0.3],
  [/^(Haki|Poneglyphs?|Conceptos|Términos|Tecnología|Objetos|Dinero|Idiomas?|Cultura|Gastronomía|Comida|Ciencia)\b/, 'concepto', 2],
];
const TPL_RULES = [
  [/^Personaje$|Infobox$/, 'personaje', 6, /Barco|Arco|combate|Bounty|Marina|Sombrero|Piratas|Organi|Fruta|Isla|Capítulo|Episodio|Saga|Libro|Pelicula|Película|Videojuego|Pelic/i],
  [/^Frutadeldiablo$|Fruta.*Infobox/i, 'fruta_del_diablo', 8], [/^Infobox Barco|^Barco$/i, 'barco', 8], [/^InfoboxArco$/i, 'arco', 8], [/^Saga$/i, 'saga', 8],
  [/^Infobox combate/i, 'combate', 6], [/^Infobox (Isla|Lugar|País)|^Isla$/i, 'lugar', 6],
  [/Capitanes Pirata Navibox|^Personajes (del|de la|de los)/i, 'personaje', 3], [/^Frutas del diablo Navibox/i, 'fruta_del_diablo', 3], [/Barcos Navibox/i, 'barco', 2],
  [/^Islas?\b.*Navibox|^Islas\b|Navibox.*Isla/i, 'lugar', 1.5], [/Tripulaci|Bandas.*Navibox|Organizaciones.*Navibox/i, 'organizacion', 3],
  [/^Infobox (Capítulo|Capitulo)/i, 'capitulo', 8], [/^Infobox Episodio/i, 'episodio', 8], [/^Infobox (Volumen|Tomo)/i, 'volumen', 8],
  [/^Infobox (Técnica|Tecnica|Ataque)/i, 'tecnica', 8], [/^Infobox (Arma|Espada)/i, 'arma', 8], [/^Infobox (Animal|Bestia)/i, 'animal', 8], [/^Infobox (Raza|Especie)/i, 'raza', 8],
  [/^Infobox (Pel|Video|Libro|Canci|Especial|Anime|Juego)/i, 'medio', 8], [/^Infobox (Organi|Banda|Tripul|Marina|Grupo)/i, 'organizacion', 8], [/^Infobox (Persona real|Seiyuu|Mangaka)/i, 'persona_real', 8],
];
const KEY_RULES = [
  [/^(capitan|miembros|tripulacion|bandera jolly)$/, 'organizacion', 3], [/^(nacimiento|edad|altura|sangre|epiteto|recompensa|raza|nombrefruta|actor)$/, 'personaje', 1.5],
  [/^(consumidor|consumidorantes|usoprimera|frutaprimera)$/, 'fruta_del_diablo', 3], [/^(fecha de lanzamiento|director|estudio)$/, 'medio', 2],
];
const SENT_RULES = [
  [/\b(es|fue|era) (un|una|el|la|uno de los|una de las) (\w+ )?(isla|ciudad|pueblo|reino|país|mar|océano|archipiélago|región|aldea|villa)\b/i, 'lugar', 2],
  [/\b(es|fue) (un|una|el|la) (\w+ )?(barco|navío|buque|nave|submarino)\b/i, 'barco', 2],
  [/\b(es|fue) (una?|la) (\w+ )?(fruta del diablo|fruta [A-Z])/i, 'fruta_del_diablo', 3],
  [/\b(es|fue) (una?|el|la) (\w+ )?(técnica|ataque|movimiento|habilidad|estilo)\b/i, 'tecnica', 2],
  [/\b(es|fue) (una?|el|la) (\w+ )?(espada|arma|pistola|katana|lanza|cañón)\b/i, 'arma', 2],
  [/\b(es|era|fue) (una?|el|la) (\w+ )?(banda|tripulación|organización|grupo|ejército|familia|alianza)\b/i, 'organizacion', 2],
  [/\b(es|era|fue) (una?|el|la) (\w+ )?(especie|raza|animal|criatura|bestia)\b/i, 'animal', 1.5],
  [/\b(es|fue) (un|una|el|la) (\w+ )?(personaje|pirata|marine|capitán|almirante|miembro|soldado|científico|rey|reina|príncipe|princesa)\b/i, 'personaje', 1.5],
  [/\b(es|fue) (un|una|el) (\w+ )?(capítulo|episodio|volumen|arco|saga)\b/i, 'evento', 0.5],
  [/\b(es|fue) (un|una|el|la) (\w+ )?(película|videojuego|juego|especial|libro|canción|serie|manga)\b/i, 'medio', 2],
  [/\b(es|fue|era) (un|una|el|la) (\w+ )?(evento|guerra|batalla|incidente|suceso|conflicto|torneo)\b/i, 'evento', 2],
];
// el rol de un campo de infobox que apunta a una ficha dice qué es la ficha apuntada
const FIELD_TARGET = { navio: 'barco', barco: 'barco', nombrefruta: 'fruta_del_diablo', fruta: 'fruta_del_diablo', capitan: 'personaje', consumidor: 'personaje', consumidorantes: 'personaje', origen: 'lugar', residencia: 'lugar', organizacion: 'organizacion' };

function classify(e) {
  const sc = {}, why = {};
  const vote = (t, w, src) => { if (w <= 0) return; sc[t] = (sc[t] ?? 0) + w; (why[t] ??= []).push(`${src}(+${+w.toFixed(1)})`); };
  const cats = new Set(e.cats);
  for (const c of e.cats) { // categoría y ancestros con decaimiento
    let level = [c], d = 1; const seen = new Set();
    for (let depth = 0; depth < 3 && level.length; depth++, d *= 0.5) {
      const next = [];
      for (const name of level) { if (seen.has(name)) continue; seen.add(name);
        for (const [re, t, w] of CAT_RULES) if (re.test(name)) { vote(t, w * d * (depth ? 0.6 : 1), `${depth ? 'cat-padre' : 'cat'}:${name}`); break; }
        next.push(...(catParents[name] ?? [])); }
      level = next;
    }
  }
  for (const tp of e.tpl) for (const [re, t, w, excl] of TPL_RULES) if (re.test(tp) && !(excl && excl.test(tp))) { vote(t, w, 'plantilla:' + tp); break; }
  for (const f of e.fields) for (const [re, t, w] of KEY_RULES) if (re.test(f.k)) { vote(t, w, 'infobox:' + f.k); break; }
  if (/\(desambiguación\)$/.test(e.id) || /puede referirse|puede hacer referencia/i.test(e.first)) vote('meta', 5, 'título/frase de desambiguación');
  else if (e.id.includes('/') && !/\/Enfrentamientos$/.test(e.id)) vote('meta', 1.5, 'subpágina (título con /)');
  if (/^SBS\b/.test(e.id)) vote('medio', 3, 'título SBS');
  for (const [re, t, w] of SENT_RULES) if (re.test(e.first)) { vote(t, w, 'primera-frase'); break; }
  const ranked = Object.entries(sc).sort((a, b) => b[1] - a[1]);
  if (process.env.DEBUG_T === e.id) console.log('DEBUG', e.id, JSON.stringify(e.cats), JSON.stringify(sc), JSON.stringify(e.tpl.slice(0,5)));
  e.scores = sc; e.why = why; e.cat = cats;
  return ranked;
}

const ranked = new Map();
for (const e of ents.values()) ranked.set(e.id, classify(e));
// segunda pasada: señales contextuales (campos que apuntan a la ficha, tipo mayoritario de vecinos salientes)
const incoming = new Map();
for (const e of ents.values()) for (const f of e.fields) { const tt = FIELD_TARGET[f.k]; if (!tt) continue;
  for (const h of f.hrefs) { const id = resolve(h); if (id) (incoming.get(id) ?? incoming.set(id, []).get(id)).push([tt, `enlazada desde infobox:${f.k} de ${e.id}`]); } }
const result = new Map();
const pass = (final) => {
  for (const e of ents.values()) {
    const r = ranked.get(e.id); const sc = { ...e.scores };
    const why = { ...e.why };
    for (const [t, why1] of incoming.get(e.id) ?? []) { sc[t] = (sc[t] ?? 0) + 1.2; (why[t] ??= []).push(why1); }
    if (final) { // vecinos: tipo mayoritario entre fichas a las que enlaza el primer párrafo
      const cnt = {}; for (const b of e.bodyLinks.slice(0, 6)) { const t = result.get(resolve(b))?.tipo; if (t && t !== 'meta') cnt[t] = (cnt[t] ?? 0) + 0.1; }
      for (const [t, w] of Object.entries(cnt)) { if (w < 0.4) continue; sc[t] = (sc[t] ?? 0) + w; (why[t] ??= []).push('vecinos-primer-párrafo'); }
    }
    let top = Object.entries(sc).sort((a, b) => b[1] - a[1]);
    let tipo, conf, motivo;
    if (!top.length) { tipo = 'concepto'; conf = 0.15; motivo = 'sin señales: asignado por defecto (concepto, tipo más genérico)'; }
    else { const [t, s] = top[0]; const s2 = top[1]?.[1] ?? 0; tipo = t; conf = +Math.min(0.99, s / (s + s2 + 1.5)).toFixed(2); motivo = (why[t] ?? []).slice(0, 4).join(', '); }
    result.set(e.id, { tipo, conf, motivo });
  }
};
pass(false); pass(true);

// las subpáginas (p. ej. «Monkey D. Luffy/Historia») no son entidades propias: tipo meta, salvo técnicas y combates
for (const e of ents.values()) {
  const r = result.get(e.id);
  if (e.id.includes('/') && e.cats.includes('Subpáginas') && !['tecnica', 'combate', 'meta'].includes(r.tipo)) result.set(e.id, { tipo: 'meta', conf: 0.8, motivo: 'subpágina de ' + e.id.split('/')[0] + ' (categoría Subpáginas)' });
}

// revisión manual: correcciones (data/tipos-manual.json) y confirmaciones de fichas dudosas ya revisadas (data/tipos-revisados.txt)
const manual = existsSync('data/tipos-manual.json') ? JSON.parse(readFileSync('data/tipos-manual.json', 'utf8')) : {};
const revisados = new Set(existsSync('data/tipos-revisados.txt') ? readFileSync('data/tipos-revisados.txt', 'utf8').split('\n').filter(Boolean) : []);
const stats = { corregidas: 0, confirmadas: 0 };
for (const [id, [tipo, motivo]] of Object.entries(manual)) {
  if (!TYPES.includes(tipo)) throw new Error('tipo manual inválido: ' + id + ' ' + tipo);
  if (!result.has(id)) { console.warn('manual: ficha inexistente', id); continue; }
  result.set(id, { tipo, conf: 0.85, motivo: 'revisión manual: ' + motivo }); stats.corregidas++;
}
for (const id of revisados) {
  const r = result.get(id);
  if (r && r.conf < 0.5 && !manual[id]) { result.set(id, { tipo: r.tipo, conf: 0.7, motivo: 'revisada manualmente (primera frase y categorías confirman el tipo); señales automáticas: ' + r.motivo }); stats.confirmadas++; }
}
console.log('revisión manual:', stats);

// ---------- 3. relaciones ----------
const REL = {
  organizacion: ['miembro_de', 'out'], afiliacion: ['miembro_de', 'out'], afiliaciones: ['miembro_de', 'out'], capitan: ['capitan_de', 'in'], navio: ['usa_barco', 'out'], barco: ['usa_barco', 'out'],
  nombrefruta: ['come', 'out'], nombrefruta2: ['come', 'out'], fruta: ['come', 'out'], consumidor: ['come', 'in'], consumidorantes: ['come', 'in'],
  origen: ['originario_de', 'out'], residencia: ['reside_en', 'out'], region: ['en_region', 'out'], nacion: ['de_nacion', 'out'], base: ['base_en', 'out'],
  ant: ['anterior', 'out'], anterior: ['anterior', 'out'], sig: ['siguiente', 'out'], siguiente: ['siguiente', 'out'], 'sig anime': ['siguiente', 'out'], 'ant anime': ['anterior', 'out'],
  lugar: ['ocurre_en', 'out'], combatientes1: ['combatiente_en', 'in'], combatientes2: ['combatiente_en', 'in'], poder1: ['combatiente_en', 'in'], poder2: ['combatiente_en', 'in'],
  raza: ['es_de_raza', 'out'], familia: ['familiar_de', 'out'], actor: ['doblado_por', 'out'], lider: ['dirigido_por', 'out'], gobernador: ['dirigido_por', 'out'], presidente: ['dirigido_por', 'out'],
  primera: ['primera_aparicion', 'out'], episodio: ['aparece_en', 'out'], epi: ['aparece_en', 'out'], capitulo: ['aparece_en', 'out'], cap: ['aparece_en', 'out'], 'capítulo': ['aparece_en', 'out'], 'capítulos': ['aparece_en', 'out'], vol: ['aparece_en', 'out'],
  clase: ['clase', 'out'], tipo: ['clase', 'out'], propietario: ['propiedad_de', 'in'],
};
const IGNORE_FIELDS = new Set(['fecha', 'recompensa', 'edad', 'epiteto', 'sangre', 'altura', 'nacimiento', 'posicion', 'resultado', 'mencion', 'usoprimera', 'frutaprimera']);
const edgeSet = new Map();
// cada relación guarda su evidencia: «campo de la infobox», «categoría», «sección Relaciones», «título A vs. B»… y qué extremo es la ficha que lo declara (:s origen, :t destino)
const addEdge = (s, t, rel, ev = '?', page = '') => { if (s && t && s !== t) { const k = `${s}|${t}|${rel}`; if (!edgeSet.has(k)) edgeSet.set(k, [s, t, rel, ev + (page === s ? ':s' : page === t ? ':t' : '')]); } };
const idsByTitleKey = (title) => resolve(title);
// parentescos del campo «Familia» de la infobox: «Nombre (Rol)» donde Rol es lo que ese personaje es respecto a la ficha actual
const KIN_STATS = { tipados: 0, genericos: 0 };
const toRoot = (id) => (id && id.includes('/') ? resolve(id.split('/')[0]) ?? id : id);
function kinEdges(e, f) {
  const items = f.value.split(new RegExp(' · |;')).map((x) => x.trim()).filter(Boolean);
  const own = toRoot(e.id); const ownT = result.get(own)?.tipo;
  items.forEach((it, k) => {
    const m = it.match(new RegExp('^(.*?)\\s*(?:\\(([^)]*)\\))?\\s*$')); const name = (m?.[1] ?? it).trim(); const role = (m?.[2] ?? '').toLowerCase();
    const t0 = resolve(name) ?? (f.hrefs.length === items.length ? resolve(f.hrefs[k]) : undefined); const t = toRoot(t0); if (!t || t === own) return;
    const personas = ownT === 'personaje' && result.get(t)?.tipo === 'personaje';
    const adop = /adoptiv|jurad/.test(role), dudoso = /supuest|posible|presunt|clon|amante|rumor/.test(role);
    let rel = null, a = own, b = t; // a→b según la relación
    if (personas && !dudoso) {
      if (/^(padre|madre|progenitor)/.test(role)) { rel = adop ? 'progenitor_adoptivo_de' : 'progenitor_de'; a = t; b = own; }
      else if (/^(hij[oa]|retoño)/.test(role)) { rel = adop ? 'progenitor_adoptivo_de' : 'progenitor_de'; a = own; b = t; }
      else if (/herman[oa]|gemel/.test(role)) { rel = adop ? 'hermano_adoptivo_de' : 'hermano_de'; }
      else if (/^abuel[oa]/.test(role)) { rel = 'abuelo_de'; a = t; b = own; }
      else if (/^niet[oa]/.test(role)) { rel = 'abuelo_de'; a = own; b = t; }
      else if (/^t[ií][oa]/.test(role)) { rel = 'tio_de'; a = t; b = own; }
      else if (/^sobrin[oa]/.test(role)) { rel = 'tio_de'; a = own; b = t; }
      else if (/espos[oa]|marido|c[oó]nyuge|prometid[oa]/.test(role)) { rel = 'conyuge_de'; }
    }
    if (rel) { addEdge(a, b, rel, 'ib:familia', own); KIN_STATS.tipados++; } else { addEdge(own, t, 'familiar_de', 'ib:familia', own); KIN_STATS.genericos++; }
  });
}

for (const e of ents.values()) {
  for (const f of e.fields) {
    if (IGNORE_FIELDS.has(f.k)) continue;
    if (f.k === 'familia') { kinEdges(e, f); continue; }
    for (const h of f.hrefs) { const t = resolve(h); if (!t) continue;
      const r = REL[f.k]; if (r) (r[1] === 'out' ? addEdge(e.id, t, r[0], 'ib:' + f.k, e.id) : addEdge(t, e.id, r[0], 'ib:' + f.k, e.id)); else addEdge(e.id, t, 'relacionado', 'ib:' + f.k, e.id);
      if (/^(combatientes|poder)[12]$/.test(f.k)) addEdge(t, e.id, 'lado' + f.k.slice(-1), 'ib:' + f.k, e.id); // bando del combatiente, para derivar los enfrentamientos
    }
  }
  // plantillas "Personajes del Arco de X" -> aparece_en; categorías con nombre de otra ficha -> miembro_de / aparece_en
  for (const tp of e.tpl) { const m = tp.match(/^Personajes del (Arco .+)$/i); if (m) addEdge(e.id, resolve(m[1]), 'aparece_en', 'tpl', e.id); }
  for (const c of e.cats) { const t = resolve(c); if (t && t !== e.id) addEdge(e.id, t, result.get(t)?.tipo === 'organizacion' ? 'miembro_de' : 'categorizado_en', 'cat', e.id); }
  for (const c of e.cats) { const m = c.match(/saga de (.+)$/i); if (m && result.get(e.id)?.tipo !== 'saga') addEdge(e.id, resolve('Saga de ' + m[1]), 'aparece_en', 'cat', e.id); }
}
// relaciones sacadas de las secciones del artículo («Familia», «Tripulación», «Aliados», «Enemigos»…): enlaces a otros personajes u organizaciones, siempre en los dos sentidos
const SEC_REL = []; // la familia sale solo del campo «Familia» de la infobox (parentesco tipado): los títulos y párrafos daban falsos parientes
const HEADFULL = new RegExp('^<h([2-4]) id="[^"]*">(.*?)<' + '/h[2-4]>');
const HEAD = new RegExp('^<h([2-4]) id="[^"]*">([^<]*)<');
let secEdges = 0;
for (const e of ents.values()) {
  const own = e.id.includes('/') ? e.id.split('/')[0] : e.id; const ty = result.get(own)?.tipo; if (ty !== 'personaje' && ty !== 'organizacion') continue;
  const h = e.art?.html ?? ''; if (!h) continue; let cur = null, curLvl = 9;
  for (const p of h.split(/(?=<h[2-4] id=)/)) {
    const m = p.match(HEAD); if (m) { const lvl = +m[1]; const rel = SEC_REL.find(([re]) => re.test(m[2].replace(new RegExp('<[^>]+>', 'g'), '').trim()))?.[1]; if (rel) { cur = rel; curLvl = lvl; } else if (lvl <= curLvl) { cur = null; curLvl = 9; } }
    if (!cur) continue;
    for (const l of p.matchAll(/<a data-t="([^"]*)"/g)) { const t = resolve(l[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")); if (!t || t === own) continue; const tt = result.get(t)?.tipo; if (tt !== 'personaje' && tt !== 'organizacion') continue; addEdge(own, t, cur, 'sec', own); addEdge(t, own, cur, 'sec', own); secEdges++; }
  }
}
console.log('relaciones desde secciones del artículo:', secEdges, '· parentescos tipados:', KIN_STATS.tipados, 'genéricos:', KIN_STATS.genericos);
// sección «Relaciones» de personajes: cada subtítulo (h3/h4) es el nombre de otro personaje u organización; el tipo de vínculo sale de las palabras de su primer párrafo
const KIN = /\b(herman[oa]s?|abuel[oa]|padre|madre|hij[oa]s?|nieto|nieta|t[ií]o|prim[oa]|sobrin[oa]|esposa|esposo|cuñad[oa])\b/i, FOE = /\b(enemig[oa]s?|archienemig[oa]|antagonista|némesis|nemesis)\b/i, ALLY = /\b(aliad[oa]s?|alianza)\b/i, FRIEND = /\b(amig[oa]s?)\b/i;
const TAGS = new RegExp('<[^>]+>', 'g'); let relEdges = 0;
for (const e of ents.values()) {
  const own = e.id.includes('/') ? e.id.split('/')[0] : e.id; const ty = result.get(own)?.tipo; if (ty !== 'personaje' && ty !== 'organizacion') continue;
  const h = e.art?.html ?? ''; if (!h) continue; let inRel = false;
  for (const p of h.split(/(?=<h[2-4] id=)/)) {
    const m = p.match(HEADFULL); if (!m) continue; const lvl = +m[1], text = m[2].replace(TAGS, '').replace(/&amp;/g, '&').trim();
    if (lvl === 2) { inRel = /^relaciones/i.test(text); continue; } if (!inRel || lvl < 3) continue;
    const t = resolve(text.replace(/\([^)]*\)/g, '').trim()); if (!t || t === own) continue; const tt = result.get(t)?.tipo; if (tt !== 'personaje' && tt !== 'organizacion') continue;
    const body0 = p.slice(m[0].length).replace(TAGS, ' ').replace(/\s+/g, ' ').trim(); const dot = body0.indexOf('. '); const body = body0.slice(0, dot > 40 ? Math.min(dot, 260) : 220); const rel = FOE.test(body) ? 'enemigo_de' : ALLY.test(body) ? 'aliado_de' : FRIEND.test(body) ? 'amigo_de' : null; if (!rel) continue;
    addEdge(own, t, rel, 'sec:relaciones', own); addEdge(t, own, rel, 'sec:relaciones', own); relEdges++;
  }
}
console.log('relaciones desde la sección «Relaciones»:', relEdges);
// enfrentamientos desde los títulos «A y B vs. C» de las fichas de combates y arcos (bandos opuestos explícitos)
const STRIP = new RegExp('<[^>]+>', 'g');
let vsEdges = 0;
for (const e of ents.values()) {
  const h = e.art?.html ?? ''; if (!h) continue;
  for (const p of h.split(/(?=<h[2-4] id=)/)) {
    const m = p.match(HEADFULL); if (!m) continue; const text = m[2].replace(STRIP, '').replace(/&amp;/g, '&').trim(); const sp = text.split(/\s+vs\.?\s+/i); if (sp.length !== 2) continue;
    const side = (s) => s.replace(/\([^)]*\)/g, '').split(/,\s*|\s+y\s+|\s+e\s+/).map((x) => x.trim()).filter(Boolean).map((x) => resolve(x)).filter((t) => t && ['personaje', 'organizacion'].includes(result.get(t)?.tipo));
    const A = side(sp[0]), B = side(sp[1]); for (const a of A) for (const b of B) if (a !== b && !(A.includes(b) && B.includes(a))) { addEdge(a, b, 'enfrenta_a', 'titulo:vs', e.id); vsEdges++; }
  }
}
console.log('enfrentamientos desde títulos «A vs. B»:', vsEdges);
// arco -> saga: primer enlace de la introducción que sea una saga
for (const e of ents.values()) if (result.get(e.id).tipo === 'arco') for (const b of e.bodyLinks) { const t = resolve(b); if (t && result.get(t)?.tipo === 'saga') { addEdge(e.id, t, 'parte_de', 'texto:arco', e.id); break; } }
// evoluciones / sucesiones: patrones en la primera frase con enlace al predecesor o sucesor
const EVO_FROM = /(?:evoluci[oó]n|versi[oó]n (?:mejorada|avanzada|evolucionada)|forma (?:evolucionada|avanzada)|sucesora?|reemplazo|reconstrucci[oó]n|sucede a|sustituy[eó] a|reemplaz[oó] a|fue (?:construid[oa]|creado?|creada) para reemplazar)\D{0,50}?(?:de(?:l)?|a partir de|a)\s+(?:la |el |los |las )?\[\[([^\]|]+)/i;
const EVO_TYPES = new Set(['barco', 'tecnica', 'arma', 'fruta_del_diablo']);
const sameEvoType = (a, b) => result.get(a)?.tipo === result.get(b)?.tipo && EVO_TYPES.has(result.get(a)?.tipo);
const EVO_TO = /(?:evolucion[oó] (?:en|a|hasta)|fue (?:reemplazad[oa]|sustituid[oa]) por)\s+(?:la |el |los |las )?\[\[([^\]|]+)/i;
let evo = 0;
const dbgEvo = [];
for (const e of ents.values()) {
  let m = e.introMarked.match(EVO_FROM); if (m && process.env.DEBUG_EVO) dbgEvo.push(e.id + ' <= ' + m[1] + ' [' + result.get(e.id)?.tipo + '/' + result.get(resolve(m[1]))?.tipo + ']');
  if (m) { const t = resolve(m[1]); if (t && t !== e.id && sameEvoType(t, e.id)) { addEdge(t, e.id, 'evoluciona_en', 'texto:evolucion', e.id); evo++; } }
  m = e.introMarked.match(EVO_TO); if (m) { const t = resolve(m[1]); if (t && t !== e.id && sameEvoType(t, e.id)) { addEdge(e.id, t, 'evoluciona_en', 'texto:evolucion', e.id); evo++; } }
}
for (const e of ents.values()) { // fruta que cambia de naturaleza o modelo (p. ej. Gomu Gomu -> Hito Hito, modelo Nika)
  const f = e.fields.find((x) => x.k === 'nombrefruta');
  if (!f || !/modelo|reclasific|despert|verdader/i.test(f.value)) continue;
  const [a, b] = [...f.value.matchAll(/(Fruta [A-Za-zÀ-ú' ]+?)(?=s*[(:)]|$)/g)].map((m) => resolve(m[1].trim()));
  if (a && b && a !== b && result.get(a)?.tipo === 'fruta_del_diablo' && result.get(b)?.tipo === 'fruta_del_diablo') { addEdge(a, b, 'evoluciona_en', 'ib:nombrefruta', a); evo++; }
}
// (a) familias de subpáginas numeradas "<padre>/<nombre> N" con N consecutivos (p. ej. Fruta Gomu Gomu/Gear 2 -> 3 -> 4 -> 5)
const fam = new Map();
for (const e of ents.values()) { const m = e.id.match(/^(.+)\/(\D+?)\s+(\d+)$/); if (m) (fam.get(m[1] + '/' + m[2]) ?? fam.set(m[1] + '/' + m[2], []).get(m[1] + '/' + m[2])).push([+m[3], e.id]); }
for (const list of fam.values()) { list.sort((a, b) => a[0] - b[0]); for (let i = 1; i < list.length; i++) if (list[i][0] === list[i - 1][0] + 1) { addEdge(list[i - 1][1], list[i][1], 'evoluciona_en', 'regla:serie'); evo++; } }
// (b) barcos de una tripulación con rangos de capítulos sucesivos y sin solapamiento (Going Merry cap. 41-430 -> Thousand Sunny cap. 436-presente)
for (const e of ents.values()) {
  const f = e.fields.find((x) => x.k === 'navio'); if (!f) continue;
  const ranges = [...f.value.matchAll(/\(\s*cap\.?\s*(\d+)\s*[-–]\s*(\d+|pres\w*)/gi)].map((m) => [+m[1], m[2].match(/^\d+$/) ? +m[2] : Infinity]);
  const ships = f.hrefs.map(resolve);
  if (ranges.length < 2 || ranges.length !== ships.length || ships.some((s) => !s || result.get(s)?.tipo !== 'barco')) continue;
  if (ranges.every((r, i) => i === 0 || (r[0] > ranges[i - 1][0] && r[0] >= ranges[i - 1][1] - 10))) for (let i = 1; i < ships.length; i++) { addEdge(ships[i - 1], ships[i], 'evoluciona_en', 'regla:serie'); evo++; }
}
console.log('evoluciones detectadas:', evo);
if (process.env.DEBUG_EVO) console.log(dbgEvo.slice(0, 60).join('\n'));
// menciones
const mentions = new Map();
for (const e of ents.values()) mentions.set(e.id, [...new Set(e.links.map(resolve).filter((t) => t && t !== e.id))]);

// ---------- 4. ids numéricos, layout y salida ----------
const list = [...ents.values()].sort((a, b) => a.id.localeCompare(b.id, 'es'));
const idx = new Map(list.map((e, i) => [e.id, i]));
const typed = [...edgeSet.values()].filter((x) => idx.has(x[0]) && idx.has(x[1]));
const mentionedBy = list.map(() => []);
list.forEach((e, i) => mentions.get(e.id).forEach((t) => { const j = idx.get(t); if (j !== undefined) mentionedBy[j].push(i); }));

// ---------- 5. informe de calidad ----------
const byType = {}; let low = 0, sinSenal = 0;
for (const r of result.values()) { byType[r.tipo] = (byType[r.tipo] ?? 0) + 1; if (r.conf < 0.5) low++; if (r.conf <= 0.15) sinSenal++; }
const relCount = {}; typed.forEach((x) => (relCount[x[2]] = (relCount[x[2]] ?? 0) + 1));
const quality = { fichas: list.length, sin_clasificar: [...result.values()].filter((r) => !r.tipo).length, revision_manual: stats, evoluciones: relCountEvo(), por_tipo: byType, confianza_baja_menor_0_5: low, asignadas_por_defecto: sinSenal, aristas_tipadas: typed.length, por_relacion: relCount };
writeFileSync('data/informe-calidad.json', JSON.stringify(quality, null, 1));
writeFileSync('data/tipado-dudoso.tsv', ['id\ttipo\tconf\tmotivo', ...[...result].filter(([, r]) => r.conf < 0.5).map(([id, r]) => `${id}\t${r.tipo}\t${r.conf}\t${r.motivo}`)].join('\n'));
console.log(JSON.stringify(quality, null, 1));
function relCountEvo() { return typed.filter((x) => x[2] === 'evoluciona_en').length; }
emitWeb({ list, idx, result, typed, mentions, mentionedBy, resolve, catParents, redirects, TYPES, quality });

try { (await import('node:child_process')).execFileSync(process.execPath, ['scripts/auditoria-familia.mjs'], { stdio: 'ignore' }); } catch { /* el informe es opcional */ }
try { (await import('node:child_process')).execFileSync(process.execPath, ['scripts/verificar-relaciones.mjs'], { stdio: 'ignore' }); } catch (e) { console.log('AVISO: no se pudo ejecutar el verificador de relaciones:', String(e.message).slice(0, 120)); }
