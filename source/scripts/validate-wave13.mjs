import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const appRoot = new URL('../apps/lume-hub-web/', import.meta.url);
const distRootPath = join(appRoot.pathname, 'dist');
const previewPort = 41731;

const htmlPath = join(distRootPath, 'index.html');
const html = await readFile(htmlPath, 'utf8');

assert.match(html, /<div id="app"><\/div>/u, 'built index.html must include the #app mount node');
assert.match(html, /\/assets\/.*\.js/u, 'built index.html must reference a bundled JavaScript asset');

const previewServer = spawn(
  'corepack',
  ['pnpm', 'exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'],
  {
    cwd: appRoot.pathname,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

const shutdown = async () => {
  previewServer.kill('SIGTERM');
  await new Promise((resolve) => {
    previewServer.once('exit', resolve);
    setTimeout(resolve, 500);
  });
};

try {
  await waitUntilReady(`http://127.0.0.1:${previewPort}/`);

  const home = await fetch(`http://127.0.0.1:${previewPort}/`);
  const today = await fetch(`http://127.0.0.1:${previewPort}/today`);

  assert.equal(home.status, 200, 'preview home should answer with 200');
  assert.equal(today.status, 200, 'preview should serve the SPA entrypoint for /today');

  const homeHtml = await home.text();
  const todayHtml = await today.text();

  assert.match(homeHtml, /<div id="app"><\/div>/u);
  assert.match(todayHtml, /<div id="app"><\/div>/u);

  console.log(`Wave 13 validation passed on http://127.0.0.1:${previewPort}/`);
} finally {
  await shutdown();
}

async function waitUntilReady(url) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 15_000) {
    try {
      const response = await fetch(url);

      if (response.status === 200) {
        return;
      }
    } catch {}

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  throw new Error('Timed out while waiting for the Wave 13 preview server.');
}
