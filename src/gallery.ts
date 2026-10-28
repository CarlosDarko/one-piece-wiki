// Galerías del artículo: las imágenes sueltas consecutivas y las galerías de la wiki pasan a UN mosaico responsive con visor a pantalla completa
// (flechas, teclado, deslizar en móvil, zoom y cierre claro). Sin dependencias: funciona también abierto como file://.
import { esc, imgUrl } from './data';

const isFig = (n: Element | null): n is HTMLElement => !!n && n.tagName === 'FIGURE';

export function buildGalleries(root: HTMLElement): void {
  const parents = new Set<Element>(); root.querySelectorAll('figure').forEach((f) => f.parentElement && parents.add(f.parentElement));
  for (const par of parents) {
    const kids = [...par.children]; let run: HTMLElement[] = [];
    const flush = () => { if (run.length >= 2 || (run.length === 1 && run[0]!.closest('.gal'))) wrap(run); run = []; };
    const vacio = (n: Element) => n.tagName === 'P' && !n.textContent?.trim() && !n.querySelector('img,figure');
    for (const k of kids) { if (isFig(k)) run.push(k); else if (vacio(k)) { if (run.length) (k as HTMLElement).hidden = true; } else flush(); }
    flush();
  }
  root.querySelectorAll('.gal').forEach((g) => { if (!g.querySelector('.mosaic') && g.querySelectorAll('figure').length) wrap([...g.querySelectorAll<HTMLElement>('figure')]); });
}
function wrap(figs: HTMLElement[]) {
  const first = figs[0]!; const box = document.createElement('div'); box.className = 'mosaic'; box.setAttribute('role', 'list'); first.before(box);
  figs.forEach((f) => { f.setAttribute('role', 'listitem'); box.append(f); const im = f.querySelector('img'); if (im) { im.loading = 'lazy'; im.tabIndex = 0; im.setAttribute('role', 'button'); } });
  box.addEventListener('click', (e) => { const im = (e.target as HTMLElement).closest('img[data-r]') as HTMLImageElement | null; if (im) openViewer(box, im); });
  box.addEventListener('keydown', (e) => { const im = (e.target as HTMLElement).closest('img[data-r]') as HTMLImageElement | null; if (im && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openViewer(box, im); } });
}

let viewer: HTMLElement | null = null;
function openViewer(box: HTMLElement, start: HTMLImageElement) {
  const imgs = [...box.querySelectorAll<HTMLImageElement>('img[data-r]')]; let k = imgs.indexOf(start); let zoomed = false; const opener = document.activeElement as HTMLElement | null;
  viewer?.remove(); const v = document.createElement('div'); v.className = 'lb'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', 'Visor de imágenes'); viewer = v;
  v.innerHTML = `<button class="lb-x" aria-label="Cerrar el visor (Esc)">✕</button><button class="lb-p" aria-label="Imagen anterior">‹</button><button class="lb-n" aria-label="Imagen siguiente">›</button><figure class="lb-f"><img alt=""><figcaption></figcaption></figure><p class="lb-c" aria-live="polite"></p>`;
  const im = v.querySelector('img')!, cap = v.querySelector('figcaption')!, cnt = v.querySelector('.lb-c')!;
  const show = (n: number) => { k = (n + imgs.length) % imgs.length; const s = imgs[k]!; zoomed = false; v.classList.remove('zoom'); im.src = imgUrl(s.dataset.r!, 1200); im.alt = s.alt; cap.innerHTML = esc(s.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ?? s.alt ?? ''); cnt.textContent = `${k + 1} de ${imgs.length}`; };
  const close = () => { v.remove(); viewer = null; document.removeEventListener('keydown', key); document.body.classList.remove('lb-open'); opener?.focus(); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') show(k + 1); else if (e.key === 'ArrowLeft') show(k - 1); else if (e.key === 'Tab') { e.preventDefault(); (v.querySelector('.lb-x') as HTMLElement).focus(); } };
  v.addEventListener('click', (e) => { const t = e.target as HTMLElement; if (t.closest('.lb-x') || t === v) close(); else if (t.closest('.lb-p')) show(k - 1); else if (t.closest('.lb-n')) show(k + 1); else if (t === im) { zoomed = !zoomed; v.classList.toggle('zoom', zoomed); } });
  let x0 = 0; v.addEventListener('touchstart', (e) => { x0 = e.touches[0]!.clientX; }, { passive: true }); v.addEventListener('touchend', (e) => { const dx = e.changedTouches[0]!.clientX - x0; if (Math.abs(dx) > 50 && !zoomed) show(k + (dx < 0 ? 1 : -1)); }, { passive: true });
  document.addEventListener('keydown', key); document.body.classList.add('lb-open'); document.body.append(v); show(k); (v.querySelector('.lb-x') as HTMLElement).focus();
}
