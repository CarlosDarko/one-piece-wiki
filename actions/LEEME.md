# Actualización automática con GitHub Actions (preparada, NO activada)

Estos ficheros no hacen nada hasta que se copian al repositorio. Orden recomendado:

1. **Prueba de acceso** (reversible): copiar `probar-api.yml` a `.github/workflows/` de CarlosDarko/one-piece-wiki y ejecutarlo a mano
   (`gh workflow run "Probar acceso a la API de la wiki"`). Hace 2 peticiones. Si falla, Cloudflare bloquea a GitHub: no seguir con Actions
   y usar el Programador de tareas del PC (`programar-actualizacion.bat`).
2. Solo si la prueba va bien: crear la rama `fuente` con el código (scripts, src, package*.json, tsconfig, vite.config.ts, index.html,
   data/tipos-manual.json, tipos-revisados.txt y el estado pequeño) **sin** `data/pages`, y subir la caché inicial como release:
   `tar -czf pages.tar.gz -C data pages` y `gh release create cache pages.tar.gz -t "Caché de fichas" -n "No borrar"`.
3. Copiar `actualizar.yml` a `.github/workflows/` de la rama `fuente`, ejecutar una vez a mano y, si todo va bien, descomentar el `schedule`.

Límites a tener en cuenta: minutos gratis de Actions (ilimitados en repositorios públicos), 10 GB de caché, 2 GB por asset de release.
