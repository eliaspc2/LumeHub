import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { reservePort, runChromeDump } from '../tests/helpers/live-runtime-fixtures.mjs';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIST_ROOT = resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'dist');
const PACKAGE_JSON_PATH = resolve(SOURCE_ROOT, 'package.json');
const SCRIPTS_DIR = resolve(SOURCE_ROOT, 'scripts');

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
  const weekDom = await runChromeDump(`${origin}/week`);
  const assistantDom = await runChromeDump(`${origin}/assistant`);
  const whatsappDom = await runChromeDump(`${origin}/whatsapp`);
  const groupsDom = await runChromeDump(`${origin}/groups`);
  const mediaDom = await runChromeDump(`${origin}/media`);
  const settingsDom = await runChromeDump(`${origin}/settings`);
  const deliveriesDom = await runChromeDump(`${origin}/deliveries`);
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8'));
  const scriptFiles = await readdir(SCRIPTS_DIR);

  assert.match(todayDom.stdout, /LumeHub \| Hoje/u);
  assert.match(weekDom.stdout, /LumeHub \| Semana/u);
  assert.match(assistantDom.stdout, /LumeHub \| Assistente/u);
  assert.match(whatsappDom.stdout, /LumeHub \| WhatsApp/u);
  assert.match(groupsDom.stdout, /LumeHub \| Grupos/u);
  assert.match(mediaDom.stdout, /LumeHub \| Media/u);
  assert.match(settingsDom.stdout, /LumeHub \| Configuracao/u);
  assert.match(deliveriesDom.stdout, /LumeHub \| Entregas/u);

  assert.doesNotMatch(todayDom.stdout, /href="\/settings"/u);
  assert.doesNotMatch(whatsappDom.stdout, /href="\/settings"/u);
  assert.doesNotMatch(todayDom.stdout, /Abrir configuracao/u);
  assert.doesNotMatch(whatsappDom.stdout, /Ver configuracao/u);
  assert.doesNotMatch(todayDom.stdout, /Timezone Europe\/Lisbon/u);
  assert.doesNotMatch(todayDom.stdout, /data-details-mode/u);
  assert.doesNotMatch(whatsappDom.stdout, /data-details-mode/u);
  assert.doesNotMatch(whatsappDom.stdout, /data-kind="mode"/u);

  assert.match(todayDom.stdout, /O que merece atencao agora/u);
  assert.match(todayDom.stdout, /Radar live/u);
  assert.doesNotMatch(todayDom.stdout, /Distribuicoes e ritmo de trabalho/u);
  assert.doesNotMatch(todayDom.stdout, /Host companion/u);
  assert.doesNotMatch(todayDom.stdout, /Saude do sistema/u);

  assert.match(assistantDom.stdout, /Entrada dedicada ao assistente/u);
  assert.doesNotMatch(assistantDom.stdout, /Perguntar sem sair da pagina/u);
  assert.doesNotMatch(assistantDom.stdout, /shell-rail/u);

  assert.match(weekDom.stdout, /Agenda semanal para criar e rever aulas e avisos\./u);
  assert.doesNotMatch(weekDom.stdout, /Area semanal preparada para crescer/u);

  assert.match(deliveriesDom.stdout, /Estado das entregas e confirmacoes mais recentes\./u);
  assert.doesNotMatch(deliveriesDom.stdout, /reservado para ganhar mais detalhe operacional/u);

  assert.match(whatsappDom.stdout, /Mais controlos do canal/u);
  assert.match(whatsappDom.stdout, /Gerir esta pessoa/u);
  assert.doesNotMatch(whatsappDom.stdout, /Ajustes menos frequentes/u);
  assert.doesNotMatch(whatsappDom.stdout, /Fluxo guiado para ligar ou reparar WhatsApp/u);
  assert.doesNotMatch(whatsappDom.stdout, /Leitura rapida do estado/u);
  assert.doesNotMatch(whatsappDom.stdout, /<h3>Conversas privadas<\/h3>/u);

  assert.match(groupsDom.stdout, /Metadados do documento/u);
  assert.match(groupsDom.stdout, /Conteudo markdown/u);
  assert.doesNotMatch(groupsDom.stdout, /Grupos visiveis/u);
  assert.doesNotMatch(groupsDom.stdout, /Docs deste grupo/u);
  assert.doesNotMatch(groupsDom.stdout, /Snippets no preview/u);

  assert.match(mediaDom.stdout, /Escolher video recebido/u);
  assert.match(mediaDom.stdout, /Destino e envio/u);
  assert.match(mediaDom.stdout, /Ultimos envios de media/u);
  assert.doesNotMatch(mediaDom.stdout, /Assets guardados/u);
  assert.doesNotMatch(mediaDom.stdout, /Grupos selecionados/u);
  assert.doesNotMatch(mediaDom.stdout, /Distribuicoes media/u);

  assert.match(settingsDom.stdout, /Configuracao avancada/u);
  assert.match(settingsDom.stdout, /Resumo rapido/u);
  assert.match(settingsDom.stdout, /Ajustes avancados/u);
  assert.match(settingsDom.stdout, /Area secundaria para defaults, energia, host companion e auth\./u);
  assert.doesNotMatch(settingsDom.stdout, /Centro de configuracao para defaults, energia, host e auth do Codex\./u);
  assert.doesNotMatch(settingsDom.stdout, /<h3>Avisos default<\/h3>/u);
  assert.doesNotMatch(settingsDom.stdout, /<h3>Energia<\/h3>/u);
  assert.doesNotMatch(settingsDom.stdout, /<h3>Host e auth<\/h3>/u);

  assert.equal(typeof packageJson.scripts['validate:wave38'], 'string');
  assert.equal(packageJson.scripts['validate:wave35'], undefined);
  assert.equal(packageJson.scripts['validate:wave36'], undefined);
  assert.equal(packageJson.scripts['validate:wave37'], undefined);
  assert.equal(scriptFiles.includes('validate-wave35.mjs'), false);
  assert.equal(scriptFiles.includes('validate-wave36.mjs'), false);
  assert.equal(scriptFiles.includes('validate-wave37.mjs'), false);

  console.log('validate-wave38: ok');
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
