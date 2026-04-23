import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SOURCE_ROOT, '..');
const BASE_URL = 'http://127.0.0.1:18420';

const packageJson = JSON.parse(await readFile(resolve(SOURCE_ROOT, 'package.json'), 'utf8'));
assert.match(packageJson.scripts['validate:wave75'], /validate-wave75\.mjs/u);

const appShell = await readFile(
  resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'src', 'shell', 'AppShell.ts'),
  'utf8',
);
assert.match(appShell, /Catalogo de grupos/u);
assert.match(appShell, /Catalogo curto de grupos/u);
assert.match(appShell, /Workspace do grupo/u);
assert.match(appShell, /Voltar ao catalogo/u);
assert.match(appShell, /O que o canal pode fazer agora/u);
assert.match(appShell, /Resumo humano das permissoes antes do detalhe tecnico e dos logs/u);
assert.doesNotMatch(appShell, /Ver permissoes deste grupo/u);
assert.match(appShell, /captureFocusedFieldSnapshot/u);
assert.match(appShell, /restoreFocusedFieldSnapshot/u);
assert.match(appShell, /options\.focusMainContent \?\? false/u);

const implementationWaves = await readFile(
  resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_implementation_waves.md'),
  'utf8',
);
assert.doesNotMatch(implementationWaves, /### Wave 75 - Grupos e WhatsApp sem repeticao operacional/u);
assert.match(implementationWaves, /### Wave 76 - Hoje, Calendario e LLM com resumo primeiro/u);
assert.match(implementationWaves, /validate:wave75/u);

const diagnostics = await fetchJson(`${BASE_URL}/api/runtime/diagnostics`);
assert.equal(diagnostics.readiness.ready, true);

const groups = await fetchJson(`${BASE_URL}/api/groups`);
assert.ok(Array.isArray(groups) && groups.length > 0, 'Expected at least one live group for Wave 75 validation.');
const detailGroup = groups[0];
const detailRoute = `${BASE_URL}/groups/${encodeURIComponent(detailGroup.groupJid)}`;

for (const viewport of [
  { label: 'desktop', width: 1440, height: 2200 },
  { label: 'mobile', width: 390, height: 1600 },
]) {
  const groupsHtml = await dumpDom(`${BASE_URL}/groups`, viewport);
  assert.match(groupsHtml, /Catalogo de grupos/u, `[${viewport.label}] /groups should render the catalog hero.`);
  assert.match(groupsHtml, /Como ler este catalogo/u, `[${viewport.label}] /groups should explain the catalog flow.`);
  assert.doesNotMatch(groupsHtml, /Passo 3\. Automacao e lembretes/u, `[${viewport.label}] /groups should not render reminder editing.`);
  assert.doesNotMatch(groupsHtml, /Passo 4\. Conhecimento do grupo/u, `[${viewport.label}] /groups should not render group knowledge editing.`);
  assert.doesNotMatch(groupsHtml, /A abrir Grupos/u, `[${viewport.label}] /groups should finish loading in headless mode.`);

  const groupHtml = await dumpDom(detailRoute, viewport);
  assert.match(groupHtml, /Workspace do grupo/u, `[${viewport.label}] group detail should render the workspace hero.`);
  assert.match(groupHtml, new RegExp(escapeForRegExp(detailGroup.preferredSubject), 'u'));
  assert.match(groupHtml, /Passo 3\. Automacao e lembretes/u, `[${viewport.label}] group detail should keep reminders.`);
  assert.match(groupHtml, /Passo 4\. Conhecimento do grupo/u, `[${viewport.label}] group detail should keep knowledge editing.`);
  assert.doesNotMatch(groupHtml, /Como ler este catalogo/u, `[${viewport.label}] group detail should not repeat the global catalog block.`);
  assert.doesNotMatch(groupHtml, /A abrir Grupos/u, `[${viewport.label}] group detail should finish loading in headless mode.`);

  const whatsappHtml = await dumpDom(`${BASE_URL}/whatsapp`, viewport);
  assert.match(whatsappHtml, /O que o canal pode fazer agora/u, `[${viewport.label}] /whatsapp should expose the human summary.`);
  assert.match(whatsappHtml, /Resumo humano das permissoes antes do detalhe tecnico e dos logs/u);
  assert.doesNotMatch(whatsappHtml, /Ver permissoes deste grupo/u, `[${viewport.label}] /whatsapp should not repeat group ACL detail cards.`);
  assert.doesNotMatch(whatsappHtml, /A abrir WhatsApp/u, `[${viewport.label}] /whatsapp should finish loading in headless mode.`);
}

console.log('Wave 75 groups/whatsapp validation passed');

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true, `Request failed for ${url}: ${response.status}`);
  return await response.json();
}

async function dumpDom(url, viewport) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      'google-chrome',
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--virtual-time-budget=20000',
        `--window-size=${viewport.width},${viewport.height}`,
        '--dump-dom',
        url,
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', rejectPromise);
    child.once('close', (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`Chrome dump failed for ${url} (${viewport.label}): ${stderr}`));
        return;
      }

      resolvePromise(stdout);
    });
  });
}

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
