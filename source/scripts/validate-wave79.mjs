import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { reservePort, runChromeDump } from '../tests/helpers/live-runtime-fixtures.mjs';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIST_ROOT = resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'dist');
const REPO_ROOT = resolve(SOURCE_ROOT, '..');
const PACKAGE_JSON_PATH = resolve(SOURCE_ROOT, 'package.json');
const IMPLEMENTATION_WAVES_PATH = resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_implementation_waves.md');
const README_PATH = resolve(REPO_ROOT, 'README.md');
const GAP_AUDIT_PATH = resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_gap_audit.md');

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
]);

const port = await reservePort();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    const assetPath = pathname === '/' ? '/index.html' : pathname;
    const absoluteAssetPath = resolve(WEB_DIST_ROOT, `.${assetPath}`);

    if (absoluteAssetPath.startsWith(WEB_DIST_ROOT)) {
      try {
        const body = await readFile(absoluteAssetPath);
        response.writeHead(200, {
          'content-type': mimeTypes.get(extname(absoluteAssetPath)) ?? 'application/octet-stream',
        });
        response.end(body);
        return;
      } catch {}
    }

    const indexHtml = await readFile(join(WEB_DIST_ROOT, 'index.html'));
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
    });
    response.end(indexHtml);
  } catch (error) {
    response.writeHead(500, {
      'content-type': 'text/plain; charset=utf-8',
    });
    response.end(String(error));
  }
});

await new Promise((resolvePromise) => {
  server.listen(port, '127.0.0.1', resolvePromise);
});

try {
  const origin = `http://127.0.0.1:${port}`;
  const todayDom = await runChromeDump(`${origin}/today`);
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8'));
  const implementationWaves = await readFile(IMPLEMENTATION_WAVES_PATH, 'utf8');
  const readme = await readFile(README_PATH, 'utf8');
  const gapAudit = await readFile(GAP_AUDIT_PATH, 'utf8');

  assert.match(todayDom.stdout, /LumeHub \| Hoje/u);
  assert.match(todayDom.stdout, /Radar live/u);
  assert.match(todayDom.stdout, /O que merece atencao agora/u);
  assert.doesNotMatch(todayDom.stdout, /Atalhos principais/u);
  assert.match(todayDom.stdout, /Sem problemas confirmados neste momento\./u);
  assert.match(packageJson.scripts['validate:wave79'], /validate-wave79\.mjs/u);
  assert.ok(
    implementationWaves.includes(
      'A `Wave 79` abriu a ronda `gui-simplification-pass-2` e fechou o fix de alertas falsos e o radar live em `Hoje`.',
    ),
  );
  assert.ok(implementationWaves.includes('A `Wave 79` abriu a ronda `gui-simplification-pass-2`'));
  assert.ok(implementationWaves.includes('Wave 80 - Shell e hierarquia com menos carga simultanea'));
  assert.ok(!implementationWaves.includes('### Wave 79 - Alertas falsos e Hoje com radar live'));
  assert.ok(readme.includes('abriu a ronda `gui-simplification-pass-2` e fechou o fix de alertas falsos'));
  assert.ok(readme.includes('validate:wave79'));
  assert.ok(gapAudit.includes('fechou o fix de alertas falsos e o radar live em `Hoje`'));
  assert.ok(gapAudit.includes('## Gaps ativos da ronda `gui-simplification-pass-2`'));
  assert.ok(gapAudit.includes('validate:wave79'));

  console.log('Wave 79 today radar validation passed');
} finally {
  await new Promise((resolvePromise, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolvePromise(undefined);
    });
  });
}
