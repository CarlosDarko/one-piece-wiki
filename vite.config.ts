import { defineConfig, type Plugin } from 'vite';

// dist/index.html debe abrirse con doble clic (file://): rutas relativas, script clásico y sin crossorigin
// (los módulos ES y las peticiones CORS no funcionan desde file://).
const fileProtocolFriendly = (): Plugin => ({
  name: 'file-protocol-friendly',
  enforce: 'post',
  transformIndexHtml(html) {
    const scripts: string[] = [];
    const out = html
      .replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>\s*/g, (_m, src) => { scripts.push(src); return ''; })
      .replace(/ crossorigin(="[^"]*")?/g, '');
    return out.replace('</body>', scripts.map((s) => `<script defer src="${s}"></script>`).join('\n') + '\n</body>');
  },
});

export default defineConfig({
  base: './',
  plugins: [fileProtocolFriendly()],
  build: {
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: { output: { format: 'iife' } },
  },
});
