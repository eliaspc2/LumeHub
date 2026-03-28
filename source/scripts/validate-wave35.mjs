import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { reservePort, runChromeDump } from '../tests/helpers/live-runtime-fixtures.mjs';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIST_ROOT = resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'dist');
const PACKAGE_JSON_PATH = resolve(SOURCE_ROOT, 'package.json');

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
  const whatsappDom = await runChromeDump(`${origin}/whatsapp`);
  const assistantDom = await runChromeDump(`${origin}/assistant`);
  const settingsDom = await runChromeDump(`${origin}/settings`);
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8'));

  assert.match(todayDom.stdout, /LumeHub \| Hoje/u);
  assert.match(whatsappDom.stdout, /LumeHub \| WhatsApp/u);
  assert.match(assistantDom.stdout, /LumeHub \| Assistente/u);

  assert.doesNotMatch(todayDom.stdout, /href="\/settings"/u);
  assert.doesNotMatch(whatsappDom.stdout, /href="\/settings"/u);
  assert.doesNotMatch(todayDom.stdout, /Abrir configuracao/u);
  assert.doesNotMatch(whatsappDom.stdout, /Ver configuracao/u);
  assert.doesNotMatch(todayDom.stdout, /Timezone Europe\/Lisbon/u);
  assert.doesNotMatch(todayDom.stdout, /data-details-mode/u);
  assert.doesNotMatch(whatsappDom.stdout, /data-details-mode/u);
  assert.doesNotMatch(whatsappDom.stdout, /data-kind="mode"/u);

  assert.match(todayDom.stdout, /Perguntar sem sair da pagina/u);
  assert.match(whatsappDom.stdout, /Perguntar sem sair da pagina/u);
  assert.doesNotMatch(assistantDom.stdout, /Perguntar sem sair da pagina/u);
  assert.doesNotMatch(assistantDom.stdout, /shell-rail/u);

  assert.match(settingsDom.stdout, /LumeHub \| Configuracao/u);
  assert.equal(typeof packageJson.scripts['validate:wave35'], 'string');

  console.log('validate-wave35: ok');
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
