# Sistema de diseño de One Piece Atlas

Todo vive en `src/style.css` como variables CSS en `:root`. Principio rector: **muy visual** (retratos, color y composición primero; el texto, como apoyo), con estética «océano, pergamino, dorado y rojo».

## Paleta
| Token | Valor | Uso |
|---|---|---|
| `--navy-950…500` | `#050f1f` → `#24508a` | Fondos oscuros, tarjetas, degradados del lienzo |
| `--gold`, `--gold-2`, `--gold-d` | `#e8b84a`, `#f6d27a`, `#a87414` | Acento principal, enlaces sobre oscuro, foco, botones primarios |
| `--red` | `#d9472f` | Avisos (spoilers), ruta de la carta, tinta de tesoro |
| `--sea` | `#3d8fd1` | Datos secundarios |
| `--fg`, `--mut`, `--line` | `#e9eef7`, `#a4b6d2`, `rgba(160,190,230,.2)` | Texto, texto atenuado, bordes sobre oscuro |
| `TYPE_COLOR` (data.ts) | un color por tipo de ficha | Insignias, halos, nodos del grafo, bordes de retrato |
| `REL_STYLE` (data.ts) | un color y trazo por relación | Pastillas, líneas y bordes de nodos del grafo |

### Temas de lectura (fichas, panel y tarjetas)
`--parch`, `--parch-2`, `--ink`, `--ink-2`, `--link-ink`, `--line-art`, `--art-soft`, `--art-shadow`.
- **Pergamino** (claro): valores por defecto de `:root` si el sistema pide tema claro.
- **Noche** (oscuro): con `prefers-color-scheme: dark`, o con `data-theme="dark"`.
- Selector manual en el pie («Tema: automático / pergamino / noche»), guardado en `localStorage` (`opa-theme`) y aplicado antes de pintar para evitar parpadeos.
- La cabecera, el grafo y la portada del buscador son siempre oscuros.

## Tipografía
- Display y títulos: `--serif` (Georgia, Palatino…). Títulos de ficha: `clamp(36px, 5.6vw, 66px)`, peso 800; subtítulo (alias) en cursiva dorada.
- Interfaz y cuerpo: `--sans` (Segoe UI, system-ui…), 15–16.5 px, interlineado 1.55–1.7, ancho de lectura ≤ 74 caracteres.
- Carta náutica: Georgia cursiva, rótulos de mares en versalitas con tracking.

## Espaciado, radios y sombras
- Radios: `--r: 14px` (tarjetas), 16–22 px (cabeceras y paneles), 999 px (pastillas y botones).
- Espaciado base de 4 px (huecos 8/10/14/18/24/32).
- Sombras: `0 6–12px 18–34px rgba(0,0,0,.3–.5)`; en temas de lectura `--art-shadow`.
- Áreas táctiles ≥ 44 px (pastillas de filtro y botones en móvil).

## Iconografía
- Insignias de tipo: `TYPE_ICON` (SVG propios 16×16) y `typeIcon()`.
- Iconos de relación en pastillas: ⚑ miembro, ♛ capitán/dirige, ♥ familia, ⚓ barco, ◆ fruta, ⚔ combate, ⌖ lugar, ▣ parte de, ↻ evolución, ✎ menciones.
- Barcos de la ruta: Going Merry y Thousand Sunny (SVG propios en `data.ts`). Favicon y manifest: sombrero de paja (`public/favicon.svg`).
- La carta náutica usa su propio juego de iconos (isla por ambiente, ciudad, castillo, región, otro).

## Estados
- **Foco**: contorno dorado de 3 px (`:focus-visible`); todos los controles son alcanzables con teclado.
- **Hover**: elevación de 2–3 px, borde dorado, brillo; **activo/seleccionado**: relleno dorado o ✓ en las casillas de filtro.
- **Vacío / carga / error**: mensajes breves en castellano con salida clara («No encuentro esa ficha…», «Cargando…», «Ninguna ficha cumple los filtros»).
- Imágenes que fallan: iniciales sobre el color del tipo, nunca un recuadro vacío.

## Movimiento
Transiciones de 150–700 ms (aparición del grafo, vuelo de cámara, visor de imágenes). Todo se desactiva con `prefers-reduced-motion: reduce`.

## Accesibilidad
Contraste AA en avisos y textos de tarjeta; `role`/`aria-*` en buscador (combobox), grafo (botones con nombre), filtros (`role="switch"`), visor (`dialog`), lista alternativa del grafo y del mapa; el atajo `/` y `Ctrl+K` enfocan el buscador; sin desbordes horizontales en 360–1920 px (probado en la suite de humo).

## Interruptor «Los lugares»
`src/config.ts` → `LUGARES`. Apagado (actual): sin pestaña, sin tarjeta en la portada, sin enlace «Ver en el mapa» en las fichas de lugar, `#/lugares` y `#/carta` redirigen a la portada. Ver README.
