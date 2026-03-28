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
  const groupsDom = await runChromeDump(`${origin}/groups`);
  const settingsDom = await runChromeDump(`${origin}/settings`);
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8'));

  assert.match(todayDom.stdout, /LumeHub \| Hoje/u);
  assert.match(whatsappDom.stdout, /LumeHub \| WhatsApp/u);
  assert.match(groupsDom.stdout, /LumeHub \| Grupos/u);
  assert.match(settingsDom.stdout, /LumeHub \| Configuracao/u);

  assert.match(whatsappDom.stdout, /Mais controlos do canal/u);
  assert.match(whatsappDom.stdout, /Gerir esta pessoa/u);
  assert.doesNotMatch(whatsappDom.stdout, /Ajustes menos frequentes/u);

  assert.match(groupsDom.stdout, /Metadados do documento/u);
  assert.match(groupsDom.stdout, /Conteudo markdown/u);

  assert.match(settingsDom.stdout, /Configuracao avancada/u);
  assert.match(settingsDom.stdout, /Resumo rapido/u);
  assert.match(settingsDom.stdout, /Ajustes avancados/u);
  assert.match(settingsDom.stdout, /Area secundaria para defaults, energia, host companion e auth\./u);
  assert.doesNotMatch(settingsDom.stdout, /Centro de configuracao para defaults, energia, host e auth do Codex\./u);
  assert.doesNotMatch(settingsDom.stdout, /<h3>Avisos default<\/h3>/u);
  assert.doesNotMatch(settingsDom.stdout, /<h3>Energia<\/h3>/u);
  assert.doesNotMatch(settingsDom.stdout, /<h3>Host e auth<\/h3>/u);

  assert.equal(typeof packageJson.scripts['validate:wave37'], 'string');

  console.log('validate-wave37: ok');
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
