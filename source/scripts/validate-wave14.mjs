import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const appRoot = new URL('../apps/lume-hub-web/', import.meta.url);
const distRootPath = join(appRoot.pathname, 'dist');
const previewPort = 41732;
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

  for (const [route, expectedText] of [
    ['/', 'Criar agendamento'],
    ['/week', 'Passo 1. Dados base do agendamento'],
    ['/distributions', 'Passo 1. Preparar a distribuicao'],
    ['/whatsapp', 'Fluxo guiado para ligar ou reparar WhatsApp'],
    ['/watchdog', 'Fluxo guiado para resolver problema'],
  ]) {
    const response = await fetch(`http://127.0.0.1:${previewPort}${route}`);
    assert.equal(response.status, 200, `preview should answer 200 for ${route}`);

    const body = await response.text();
    assert.match(body, /<div id="app"><\/div>/u, `preview should serve the SPA entrypoint for ${route}`);

    const { stdout, stderr } = await runChromeDump(`http://127.0.0.1:${previewPort}${route}`);
    assert.match(stdout, new RegExp(escapeForRegExp(expectedText), 'u'), `DOM for ${route} should include guided flow text`);
    assert.doesNotMatch(stdout, /Algo falhou ao carregar esta pagina/u, `DOM for ${route} should not render the generic error card`);
    assert.doesNotMatch(stderr, /(TypeError|ReferenceError|Uncaught|SEVERE)/u, `headless browser should not report runtime errors for ${route}`);
  }

  console.log(`Wave 14 validation passed on http://127.0.0.1:${previewPort}/`);
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

  throw new Error('Timed out while waiting for the Wave 14 preview server.');
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
        '--virtual-time-budget=4000',
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
