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
  const mediaDom = await runChromeDump(`${origin}/media`);
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8'));

  assert.match(todayDom.stdout, /LumeHub \| Hoje/u);
  assert.match(whatsappDom.stdout, /LumeHub \| WhatsApp/u);
  assert.match(groupsDom.stdout, /LumeHub \| Grupos/u);
  assert.match(mediaDom.stdout, /LumeHub \| Media/u);

  assert.match(todayDom.stdout, /O que merece atencao agora/u);
  assert.match(todayDom.stdout, /Atalhos principais/u);
  assert.doesNotMatch(todayDom.stdout, /Distribuicoes e ritmo de trabalho/u);
  assert.doesNotMatch(todayDom.stdout, /Host companion/u);
  assert.doesNotMatch(todayDom.stdout, /Saude do sistema/u);

  assert.match(whatsappDom.stdout, /Sessao e emparelhamento/u);
  assert.match(whatsappDom.stdout, /Pessoas com controlo/u);
  assert.match(whatsappDom.stdout, /Grupos do WhatsApp/u);
  assert.doesNotMatch(whatsappDom.stdout, /Fluxo guiado para ligar ou reparar WhatsApp/u);
  assert.doesNotMatch(whatsappDom.stdout, /Leitura rapida do estado/u);
  assert.doesNotMatch(whatsappDom.stdout, /<h3>Conversas privadas<\/h3>/u);
  assert.doesNotMatch(whatsappDom.stdout, /Descobertos live/u);

  assert.match(groupsDom.stdout, /Instrucoes e preview/u);
  assert.match(groupsDom.stdout, /Documentos deste grupo/u);
  assert.doesNotMatch(groupsDom.stdout, /Grupos visiveis/u);
  assert.doesNotMatch(groupsDom.stdout, /Docs deste grupo/u);
  assert.doesNotMatch(groupsDom.stdout, /Snippets no preview/u);
  assert.doesNotMatch(groupsDom.stdout, /Instrucoes ativas/u);
  assert.doesNotMatch(groupsDom.stdout, /Grupos WA autorizados/u);

  assert.match(mediaDom.stdout, /Escolher video recebido/u);
  assert.match(mediaDom.stdout, /Destino e envio/u);
  assert.match(mediaDom.stdout, /Ultimos envios de media/u);
  assert.doesNotMatch(mediaDom.stdout, /Assets guardados/u);
  assert.doesNotMatch(mediaDom.stdout, /Grupos selecionados/u);
  assert.doesNotMatch(mediaDom.stdout, /Distribuicoes media/u);
  assert.doesNotMatch(mediaDom.stdout, /Falhas por grupo/u);
  assert.doesNotMatch(mediaDom.stdout, /Estado de entrega por grupo/u);

  assert.equal(typeof packageJson.scripts['validate:wave36'], 'string');

  console.log('validate-wave36: ok');
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
