# One Piece Atlas — atlas interactivo de la One Piece Wiki

Atlas navegable de las **7.509 fichas** de la [One Piece Wiki en español](https://onepiece.fandom.com/es/) (Fandom, licencia CC BY-SA), con sus **artículos completos**, unidas por sus relaciones. Modelo de [ladonacion.es](https://ladonacion.es/): portada, buscador, grafo que se expande al pulsar, sagas, mapa, biblioteca y fichas completas.

## Abrir la web

**Doble clic** en `One Piece Wiki.lnk` (acceso directo con icono) o en `Abrir One Piece Wiki.bat`. Abre `dist/index.html` en tu navegador; no hace falta servidor ni comandos. Si `dist/` no existe, el lanzador instala y compila solo (necesita Node.js).

Alternativa con servidor local: `npm start` (http://localhost:4173). Si cambias los datos o el código: `npm run all`.

## Publicar en GitHub Pages

**Doble clic en `publicar.bat`**: compila, pasa las 65 pruebas, sube `dist/` a <https://github.com/CarlosDarko/one-piece-wiki>, activa Pages y comprueba <https://carlosdarko.github.io/one-piece-wiki/>. Necesita Git y la CLI de GitHub con sesión iniciada (`gh auth login`, una sola vez). `node scripts/publicar.mjs --preparar` solo prepara la carpeta `publicar/sitio` sin subir nada.

## Secciones

| Sección | Qué hace |
|---|---|
| Portada | Qué es, buscador grande, ejemplos, accesos y atajos («¿Qué quieres consultar?») |
| Quién es quién | Grafo de entidades principales con forma, color e icono por tipo (círculo = personaje, hexágono = organización, rombo = fruta, escudo = lugar, casco = barco), capas por tipo y relación, y pestañas Todo · Personajes · Organizaciones · Frutas · Barcos · Lugares. Al pulsar un nodo se abre su ficha y se añaden sus relaciones |
| Sagas | Ruta del viaje saga a saga y arco a arco, con portadas, lo que aparece en cada tramo y despliegues animados |
| Los lugares | Mapa esquemático ilustrado con la ruta del viaje animada, filtros (mar, saga, tipo), buscador, ficha-resumen de isla y modo lista accesible |
| La biblioteca | Todas las fichas con scroll continuo virtualizado, índice A–Z, filtros por tipo, saga y mar, orden, contador y URL compartible; ranking de recompensas |
| Ficha completa | El artículo íntegro de la wiki con índice, secciones plegables, infobox, relaciones, migas de pan y atribución con enlace al historial de autores |
| Comparar | Dos fichas lado a lado: datos, relación directa, fichas en común y exclusivas |
| Metodología | Cómo se obtuvieron los datos, tipado, límites y atribución |

Las URL son compartibles (`#/ficha/Roronoa%20Zoro`, `#/biblioteca?t=lugar&m=4`, `#/comparar?a=…&b=…`) y también funcionan abriendo `dist/` con doble clic. Atajo: la tecla `/` enfoca el buscador.

## Datos

| Fase | Comando | Resultado |
|---|---|---|
| Rastreo por la API MediaWiki (≤1 req/s, reanudable, con backoff) | `npm run crawl` | `data/pages/*.json.gz`, `data/state.json`, `data/crawl.log` |
| Jerarquía de categorías | `npm run catparents` | `data/catparents.json` |
| Tipado, relaciones, artículos y ficheros de la web | `npm run build:data` | `public/data/` + `data/informe-calidad.json` |
| Compilar la web | `npm run build` | `dist/` (≈96 MB: 64 MB de artículos en 320 lotes, 30 MB de detalles en 64 lotes) |

Los artículos se limpian con lista blanca de etiquetas (sin scripts ni estilos). Los personajes largos, que la wiki reparte en subpáginas (Historia, Personalidad…), se unen en una sola ficha. La web carga lo mínimo para pintar el grafo (~0,19 MB sin comprimir, ~0,06 MB en gzip) y baja cada artículo bajo demanda.

## Calidad del tipado

- 7.509 fichas, **0 sin clasificar**, 0 con confianza < 0,5 y 0 asignadas por defecto (`data/informe-calidad.json`). Votos ponderados (categorías y padres, plantillas, infobox, primera frase, enlaces entrantes) y revisión manual: 94 corregidas (`data/tipos-manual.json`) y 65 confirmadas (`data/tipos-revisados.txt`).
- Evoluciones (`evoluciona_en`, 5 relaciones) solo con evidencia estructural: Gomu Gomu → Hito Hito, Gear 2 → 3 → 4 → 5 y Going Merry → Thousand Sunny.

## Pruebas y herramientas

- `node scripts/prueba-humo.mjs` — 65 comprobaciones con Edge real: buscador, grafo (formas, capas, pestañas), fichas completas, **todas las sagas y sus desplegables (también al volver a entrar)**, mapa y ruta, biblioteca sin paginación, comparador, móvil y accesibilidad básica.
- `node scripts/capturas.mjs reales|fixtures|recorte` — capturas en `capturas/` (las «fx-» usan imágenes sintéticas para validar maquetación y recortes de caras).
- `node scripts/captura.mjs tiempos` — tiempos de carga. `node scripts/medir-dist.mjs` — tamaños sin comprimir, gzip y brotli.

## Limitaciones conocidas

- Tipos y relaciones son automáticos: puede haber errores en fichas con poca información.
- Las imágenes se cargan desde el CDN de Fandom (hotlink); sin internet, o si Fandom las bloquea, se ven iniciales de colores en lugar de fotos.
- El mapa de lugares es esquemático; 41 lugares la wiki no los sitúa en ningún mar.
