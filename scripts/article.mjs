// Convierte el HTML renderizado de una ficha (parse.text de la API) en contenido limpio y seguro:
// lista blanca de etiquetas, sin scripts ni estilos, sin atributos salvo los permitidos y enlaces internos marcados como <a data-t="Título">.
// Las imágenes se guardan como referencia compacta (data-r="ruta|cb") y se reconstruyen en el cliente.
import { imgRef } from './emit-web.mjs';

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'aside', 'nav', 'form', 'iframe', 'video', 'audio', 'svg', 'canvas', 'button', 'input', 'select', 'textarea', 'object', 'embed', 'link', 'meta']);
const SKIP_CLASS = /(navbox|navibox|sidebar|infobox|noprint|mw-editsection|\btoc\b|\bmw-references|references|reference\b|printfooter|catlinks|mbox|ambox|dablink|hatnote|spoiler|portable-infobox|wds-|fandom-|mw-empty-elt|toccolours|mw-jump|visualClear|wikia-ad|ad-slot|rail-|page-header|notice|qref)/i;
const FLATTEN = new Set(['div', 'span', 'center', 'font', 'section', 'article', 'main', 'abbr', 'cite', 'bdi', 'bdo', 'time', 'label', 'article', 'header', 'footer', 'big', 'tt', 'code', 'kbd', 'samp', 'var', 'mark', 'ins', 'del', 's', 'strike', 'details', 'summary']);
const KEEP = new Set(['p', 'h2', 'h3', 'h4', 'h5', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'b', 'strong', 'i', 'em', 'u', 'sup', 'sub', 'small', 'blockquote', 'figure', 'figcaption', 'hr', 'br']);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
const norm = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

export function sanitizeArticle($) {
  const root = $('div.mw-parser-output').first(); const top = root.length ? root.get(0) : $.root().get(0);
  const toc = []; let headN = 0;
  const hasClass = (n) => `${n.attribs?.class ?? ''} ${n.attribs?.id ?? ''}`;
  const imgHtml = (n) => {
    const src = n.attribs['data-src'] || n.attribs.src || ''; if (!src || src.startsWith('data:')) return '';
    const ref = imgRef(src); if (!ref.includes('|')) return '';
    const w = +(n.attribs.width ?? 0), h = +(n.attribs.height ?? 0); if ((w && w < 36) || (h && h < 36)) return '';
    const alt = (n.attribs.alt ?? n.attribs['data-image-name'] ?? '').replace(/\.(png|jpe?g|gif|webp)$/i, '');
    return `<img data-r="${escAttr(ref)}" alt="${escAttr(alt)}"${w && h ? ` width="${w}" height="${h}"` : ''}>`;
  };
  const kids = (n) => (n.children ?? []).map(walk).join('');
  function walk(n) {
    if (n.type === 'text') return esc(n.data.replace(/\s+/g, ' '));
    if (n.type !== 'tag') return '';
    const name = n.name;
    if (SKIP_TAGS.has(name)) return '';
    const cls = hasClass(n); if (SKIP_CLASS.test(cls)) return '';
    if (name === 'img') return imgHtml(n);
    if (name === 'a') {
      const href = n.attribs.href ?? ''; const inner = kids(n);
      const hasImg = (n.children ?? []).some((c) => c.type === 'tag' && (c.name === 'img' || c.name === 'noscript')) || inner.includes('<img');
      if (hasImg) return inner; // enlace de imagen: solo la imagen
      if (href.startsWith('/es/wiki/') && !/^\/es\/wiki\/(Archivo|Categor[ií]a|Especial|Ayuda|Plantilla|Usuario|File|Category|Special|Template|User|Blog|M[oó]dulo)[:_]/i.test(href) && !href.includes(':')) {
        const t = norm(href.slice(9).split('#')[0]).replace(/_/g, ' '); return t ? `<a data-t="${escAttr(t)}">${inner}</a>` : inner;
      }
      if (/^https?:\/\//i.test(href)) {
        let u; try { u = new URL(href); } catch { return inner; }
        const host = u.hostname.replace(/^www\./, ''), plain = $(n).text().replace(/\s+/g, ' ').trim();
        const NS = /^(Archivo|Categor[ií]a|Especial|Ayuda|Plantilla|Usuario|File|Category|Special|Template|User|Blog|M[oó]dulo)[:_]/i;
        // la propia wiki con URL absoluta (fandom o el dominio antiguo de wikia) → ficha interna
        if (/^(onepiece\.fandom\.com|es\.onepiece\.wikia\.com|onepiece\.wikia\.com)$/.test(host)) { const m = u.pathname.match(/^\/(?:es\/)?wiki\/(.+)$/); if (m && !NS.test(m[1]) && !m[1].includes(':')) { const t = norm(m[1]).replace(/_/g, ' '); return t ? `<a data-t="${escAttr(t)}">${inner}</a>` : inner; } return inner; }
        // el «?» tras los textos japoneses (ayuda del idioma): ruido
        if (/wikipedia\.org$/.test(host) && /Ayuda:Idioma/i.test(u.pathname)) return '';
        // Wikipedia y otras wikis: enlace «blando» por el texto; si existe una ficha equivalente se enlaza, si no queda como texto normal
        if (/(wikipedia|wiktionary)\.org$/.test(host) || /\.(fandom|wikia)\.com$/.test(host)) return plain.length >= 2 && plain.length <= 80 ? `<a data-t="${escAttr(plain)}">${inner}</a>` : inner;
        // fuentes y referencias que sí tienen sentido como enlace externo
        if (/(imdb\.com|eldoblaje\.com|bandai|toei-animation|shueisha|viz\.com|crunchyroll|netflix\.com|funimation|animenewsnetwork|myanimelist|youtube\.com|youtu\.be|twitter\.com|x\.com|mangaplus|planetacomic|panini)/i.test(host)) return `<a class="ext" href="${escAttr(href)}" target="_blank" rel="noopener noreferrer nofollow">${inner}</a>`;
        return inner;
      }
      return inner;
    }
    if (/^h[2-5]$/.test(name)) {
      const text = $(n).find('.mw-headline').first().text() || $(n).text(); const t = text.replace(/\[\s*editar[^\]]*\]/gi, '').replace(/\s+/g, ' ').trim();
      if (!t || /^(Referencias|Enlaces externos|Navegaci[oó]n|Galer[ií]a de im[aá]genes)$/i.test(t) && name !== 'h2' && false) return '';
      const id = `s${++headN}`; toc.push([id, +name[1], t]); return `<${name} id="${id}">${esc(t)}</${name}>`;
    }
    if (name === 'ul' && /gallery/i.test(cls)) return `<div class="gal">${kids(n)}</div>`;
    if (/gallerybox|wikia-gallery-item|lightbox-caption/.test(cls) && name !== 'figure') return `<figure>${kids(n)}</figure>`;
    if (name === 'td' || name === 'th') { const cs = n.attribs.colspan, rs = n.attribs.rowspan; return `<${name}${cs && +cs > 1 ? ` colspan="${+cs}"` : ''}${rs && +rs > 1 ? ` rowspan="${+rs}"` : ''}>${kids(n)}</${name}>`; }
    if (name === 'br' || name === 'hr') return `<${name}>`;
    if (KEEP.has(name)) { const inner = kids(n); if (!inner.trim() && !['td', 'th', 'tr'].includes(name)) return ''; return `<${name}>${inner}</${name}>`; }
    if (FLATTEN.has(name) || name) return kids(n);
    return '';
  }
  let html = kids(top);
  // limpieza: secciones vacías (encabezado seguido de otro encabezado o del final), párrafos vacíos, espacios
  html = html.replace(/<p>\s*(<br>)?\s*<\/p>/g, '').replace(/\s+/g, ' ');
  for (let k = 0; k < 4; k++) html = html.replace(/<h([2-5]) id="(s\d+)">[^<]*<\/h\1>\s*(?=<h[2-5] |$)/g, (m, _l, id) => { const i = toc.findIndex((x) => x[0] === id); if (i >= 0) toc.splice(i, 1); return ''; });
  return { html: html.trim(), toc };
}
