// Publica dist/ en GitHub Pages (https://github.com/CarlosDarko/one-piece-wiki).
//   node scripts/publicar.mjs --preparar   solo prepara la carpeta publicar/sitio (NO sube nada)
//   node scripts/publicar.mjs              compila, pasa las pruebas, prepara, sube y comprueba el enlace
//   opciones: --sin-pruebas (salta la prueba de humo)
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REPO = 'CarlosDarko/one-piece-wiki', URL_SITIO = 'https://carlosdarko.github.io/one-piece-wiki/';
const STAGE = join(ROOT, 'publicar'), SITE = join(STAGE, 'sitio');
const args = new Set(process.argv.slice(2)); const soloPreparar = args.has('--preparar');
const run = (cmd, a, o = {}) => { const r = spawnSync(cmd, a, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32', ...o }); if (r.status !== 0) throw new Error(`${cmd} ${a.join(' ')} falló (código ${r.status})`); };
const out = (cmd, a, cwd = ROOT) => execFileSync(cmd, a, { cwd, encoding: 'utf8' }).trim();
const dirSize = (d) => readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? dirSize(join(d, e.name)) : statSync(join(d, e.name)).size), 0);
const biggest = (d, m = { f: '', s: 0 }) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) biggest(p, m); else { const s = statSync(p).size; if (s > m.s) { m.s = s; m.f = p; } } } return m; };

const README = `# One Piece Atlas

Atlas interactivo de One Piece: personajes, tripulaciones, frutas del Diablo, barcos, islas y sagas de la One Piece Wiki en español, con sus artículos completos y unidos por sus relaciones.

**Web:** ${URL_SITIO}

## Atribución y licencia

El texto procede de la [One Piece Wiki en español (Fandom)](https://onepiece.fandom.com/es/), © sus colaboradores, y se reutiliza bajo la licencia [Creative Commons Atribución-CompartirIgual 3.0 (CC BY-SA 3.0)](https://creativecommons.org/licenses/by-sa/3.0/). Cada ficha enlaza con su página original y su historial de autores. Las imágenes se cargan desde el servidor de Fandom y pertenecen a sus titulares.

Proyecto de aficionados, no oficial: sin relación con Eiichiro Oda, Shueisha ni Toei Animation.

Este repositorio contiene solo la web ya compilada. El contenido derivado se comparte bajo la misma licencia CC BY-SA 3.0.
`;

console.log('1/6 Compilando la web…'); run('npm', ['run', 'build']);
if (!soloPreparar && !args.has('--sin-pruebas')) { console.log('2/6 Pasando la prueba de humo con Edge…'); run('node', ['scripts/prueba-humo.mjs']); } else console.log('2/6 Pruebas omitidas.');

console.log('3/6 Preparando la carpeta de publicación…');
mkdirSync(STAGE, { recursive: true });
if (!existsSync(join(SITE, '.git'))) { rmSync(SITE, { recursive: true, force: true }); if (soloPreparar) mkdirSync(SITE, { recursive: true }); else run('git', ['clone', `https://github.com/${REPO}.git`, SITE]); }
for (const e of readdirSync(SITE)) if (e !== '.git' && e !== '.github') rmSync(join(SITE, e), { recursive: true, force: true });
cpSync(join(ROOT, 'dist'), SITE, { recursive: true }); writeFileSync(join(SITE, 'README.md'), README); writeFileSync(join(SITE, '.nojekyll'), '');
const size = dirSize(SITE), big = biggest(SITE);
console.log(`   Tamaño del sitio: ${(size / 1048576).toFixed(1)} MB (límite de GitHub Pages: 1 GB). Fichero mayor: ${(big.s / 1048576).toFixed(2)} MB (límite 100 MB).`);
if (size > 900 * 1048576 || big.s > 90 * 1048576) throw new Error('El sitio supera los límites seguros de GitHub Pages.');
if (soloPreparar) { console.log(`\nLista la carpeta ${SITE}. No se ha subido nada.`); process.exit(0); }

console.log('4/6 Subiendo a GitHub…');
const git = (...a) => out('git', ['-C', SITE, ...a]);
try { git('checkout', '-B', 'main'); } catch { /* repositorio vacío */ }
git('add', '-A'); const cambios = git('status', '--porcelain');
if (cambios) { git('commit', '-m', `Actualización del sitio (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`); }
else console.log('   Sin cambios respecto a lo ya publicado.');
for (let k = 0, wait = 2000; ; k++) { try { run('git', ['-C', SITE, 'push', '-u', 'origin', 'main']); break; } catch (e) { if (k >= 4) throw e; console.log(`   Reintentando en ${wait / 1000} s…`); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait); wait *= 2; } }

console.log('5/6 Activando GitHub Pages…');
try { out('gh', ['api', `repos/${REPO}/pages`]); console.log('   Pages ya estaba activado.'); }
catch { try { out('gh', ['api', '-X', 'POST', `repos/${REPO}/pages`, '-f', 'source[branch]=main', '-f', 'source[path]=/']); console.log('   Pages activado (rama main, raíz).'); } catch (e) { console.log('   No se pudo activar Pages automáticamente: actívalo en Settings > Pages (rama main, carpeta raíz).'); } }

console.log('6/6 Comprobando el enlace (puede tardar unos minutos en estar disponible)…');
let ok = false;
for (let k = 0; k < 30 && !ok; k++) { try { const r = await fetch(URL_SITIO + 'index.html', { cache: 'no-store' }); if (r.ok && (await r.text()).includes('One Piece Atlas')) ok = true; } catch { /* aún no */ } if (!ok) await new Promise((r) => setTimeout(r, 10000)); }
console.log(ok ? `\n✔ Publicado y comprobado: ${URL_SITIO}` : `\nSubido, pero el enlace aún no responde. Espera unos minutos y abre: ${URL_SITIO}`);
