# One Piece Atlas

Atlas interactivo de One Piece: fichas de la [One Piece Wiki en español](https://onepiece.fandom.com/es/) (personajes, tripulaciones, frutas del Diablo, barcos, islas, sagas…) con sus artículos completos, unidas por sus relaciones y navegables como un grafo. Inspirado en [ladonacion.es](https://ladonacion.es/).

**Web: https://carlosdarko.github.io/one-piece-wiki/**

<!--auto:inicio-->
**7.509** fichas · **35.728** relaciones entre ellas · última actualización: **2026-10-28**
<!--auto:fin-->

> ⚠️ Contiene **spoilers** de todo el manga y el anime.

![Portada del atlas](https://raw.githubusercontent.com/CarlosDarko/one-piece-wiki/fuente/docs/capturas/01-portada.webp)

## Qué puedes hacer

- **Buscar** cualquier ficha (atajo `/` o `Ctrl+K`), con resultados agrupados por tipo.
- **Quién es quién**: el grafo de relaciones de cualquier ficha, con categorías y subcategorías (familia, tripulación, aliados, enfrentamientos, fruta del Diablo, lugares…) que se pueden mostrar u ocultar; vista grafo y vista lista.
- **Ficha completa**: el artículo íntegro de la wiki con índice, secciones plegables, infobox y atribución.
- **Sagas**: el viaje saga a saga y arco a arco, con portadas y desplegables.
- **Los lugares**: carta náutica con la ruta del viaje animada, filtros por mar, saga y tipo, y leyenda.
- **La biblioteca**: todas las fichas con índice A–Z, filtros, orden y ranking de recompensas; y un **comparador** de dos fichas.
- Temas **pergamino** y **noche**, URL compartibles y diseño adaptado al móvil.

![Grafo de Monkey D. Luffy con su ficha](https://raw.githubusercontent.com/CarlosDarko/one-piece-wiki/fuente/docs/capturas/02-grafo-luffy.webp)

![Relaciones del grafo, por categorías](https://raw.githubusercontent.com/CarlosDarko/one-piece-wiki/fuente/docs/capturas/03-grafo-relaciones.webp)

![Ficha completa de Usopp](https://raw.githubusercontent.com/CarlosDarko/one-piece-wiki/fuente/docs/capturas/05-ficha-usopp.webp)

![Mapa de los lugares con la ruta animada](https://raw.githubusercontent.com/CarlosDarko/one-piece-wiki/fuente/docs/capturas/07-mapa-ruta.webp)

![Sagas](https://raw.githubusercontent.com/CarlosDarko/one-piece-wiki/fuente/docs/capturas/06-sagas.webp)

| Tema pergamino | Tema noche |
|---|---|
| ![Grafo en pergamino](https://raw.githubusercontent.com/CarlosDarko/one-piece-wiki/fuente/docs/capturas/11-tema-pergamino.webp) | ![Grafo en noche](https://raw.githubusercontent.com/CarlosDarko/one-piece-wiki/fuente/docs/capturas/12-tema-noche.webp) |

Documentación completa (cómo se construye, arquitectura, ejecutarlo en local) en el [README de la rama `fuente`](https://github.com/CarlosDarko/one-piece-wiki/blob/fuente/README.md).

## Cómo se mantiene

Esta rama (`main`) solo contiene el sitio ya compilado que sirve GitHub Pages. El código fuente, los scripts de rastreo y el workflow están en la rama [`fuente`](https://github.com/CarlosDarko/one-piece-wiki/tree/fuente). Cada lunes un workflow de GitHub Actions detecta los cambios de la wiki, reconstruye el atlas, regenera estas capturas y las cifras de arriba, pasa las pruebas con Chrome y lo publica aquí solo si todo va bien.

## Atribución y licencia

El texto procede de la [One Piece Wiki en español (Fandom)](https://onepiece.fandom.com/es/), © sus colaboradores, bajo licencia [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); el contenido derivado se comparte bajo la misma licencia. Cada ficha enlaza con su página original y su historial de autores. Las imágenes se cargan desde el servidor de Fandom y pertenecen a sus titulares.

Proyecto de aficionados, no oficial: sin relación con Eiichiro Oda, Shueisha ni Toei Animation.
