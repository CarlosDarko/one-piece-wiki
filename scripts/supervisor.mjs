// Relanza el rastreo si se cae; termina cuando crawl.mjs sale con código 0.
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
for (;;) {
  const code = await new Promise((r) => spawn(process.execPath, ['scripts/crawl.mjs'], { stdio: 'inherit' }).on('exit', r));
  appendFileSync('data/crawl.log', `${new Date().toISOString()} crawl terminó con código ${code}\n`);
  if (code === 0) break;
  await new Promise((r) => setTimeout(r, 30000));
}
