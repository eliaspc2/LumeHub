import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const appRoot = new URL('../apps/lume-hub-web/', import.meta.url);
const distRootPath = join(appRoot.pathname, 'dist');
const previewPort = 41733;
const chromeCommand = 'google-chrome';

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

  for (const scenario of [
    {
      route: '/',
      expectedTexts: ['Criar agendamento'],
      forbiddenTexts: ['Algo falhou ao carregar esta pagina'],
    },
    {
      route: '/whatsapp',
      expectedTexts: [
        'Onboarding e controlos da sessao',
        'Pessoas, app owners e acesso privado',
        'Grupos, group owners e ACL do calendario',
        'Conversas privadas',
        'data-whatsapp-acl-scope="groupOwner"',
      ],
      forbiddenTexts: ['JSON.parse: unexpected character', 'Algo falhou ao carregar esta pagina'],
    },
    {
      route: '/whatsapp?mode=live',
      expectedTexts: [
        'A ligacao live abriu a pagina web, mas nao encontrou a API do LumeHub nesta porta.',
        'Usar demo',
      ],
      forbiddenTexts: ['JSON.parse: unexpected character'],
    },
  ]) {
    const response = await fetch(`http://127.0.0.1:${previewPort}${scenario.route}`);
    assert.equal(response.status, 200, `preview should answer 200 for ${scenario.route}`);

    const body = await response.text();
    assert.match(body, /<div id="app"><\/div>/u, `preview should serve the SPA entrypoint for ${scenario.route}`);

    const { stdout, stderr } = await runChromeDump(`http://127.0.0.1:${previewPort}${scenario.route}`);

    for (const expectedText of scenario.expectedTexts) {
      assert.match(
        stdout,
        new RegExp(escapeForRegExp(expectedText), 'u'),
        `DOM for ${scenario.route} should include ${expectedText}`,
      );
    }

    for (const forbiddenText of scenario.forbiddenTexts) {
      assert.doesNotMatch(
        stdout,
        new RegExp(escapeForRegExp(forbiddenText), 'u'),
        `DOM for ${scenario.route} should not include ${forbiddenText}`,
      );
    }

    assert.doesNotMatch(
      stderr,
      /(TypeError|ReferenceError|Uncaught|SEVERE)/u,
      `headless browser should not report runtime errors for ${scenario.route}`,
    );
  }

  console.log(`Wave 15 validation passed on http://127.0.0.1:${previewPort}/`);
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

  throw new Error('Timed out while waiting for the Wave 15 preview server.');
}

async function runChromeDump(url) {
  return new Promise((resolve, reject) => {
    const chrome = spawn(
      chromeCommand,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=4500',
        '--dump-dom',
        url,
      ],
      {
        cwd: appRoot.pathname,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stdout = '';
    let stderr = '';

    chrome.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    chrome.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    chrome.once('error', reject);
    chrome.once('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Headless Chrome exited with code ${code}: ${stderr}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
