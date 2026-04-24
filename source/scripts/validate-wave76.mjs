import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SOURCE_ROOT, '..');
const BASE_URL = 'http://127.0.0.1:18420';

const packageJson = JSON.parse(await readFile(resolve(SOURCE_ROOT, 'package.json'), 'utf8'));
assert.match(packageJson.scripts['validate:wave76'], /validate-wave76\.mjs/u);

const appShell = await readFile(
  resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'src', 'shell', 'AppShell.ts'),
  'utf8',
);
assert.match(appShell, /Resumo primeiro: estado, risco e proximo passo/u);
assert.match(appShell, /Calendario mensal/u);
assert.match(appShell, /buildMonthCalendarDays/u);
assert.match(appShell, /renderWeekNotificationBadges/u);
assert.match(appShell, /Pergunta segura: nao envia nada/u);
assert.match(appShell, /Alterar agenda: preview obrigatorio/u);

const appCss = await readFile(resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'src', 'styles', 'app.css'), 'utf8');
assert.match(appCss, /\.month-calendar/u);
assert.match(appCss, /\.month-calendar__day--focus-week/u);
assert.match(appCss, /@media \(max-width: 640px\)[\s\S]*\.month-calendar__weekday \{[\s\S]*display: none/u);

const implementationWaves = await readFile(
  resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_implementation_waves.md'),
  'utf8',
);
assert.doesNotMatch(implementationWaves, /### Wave 76 - Hoje, Calendario e LLM com resumo primeiro/u);
assert.match(implementationWaves, /### Wave 77 - LumeHub, Codex Router e rotas tecnicas por papel/u);
assert.match(implementationWaves, /validate:wave76/u);

const diagnostics = await fetchJson(`${BASE_URL}/api/runtime/diagnostics`);
assert.equal(diagnostics.readiness.ready, true);

for (const viewport of [
  { label: 'desktop', width: 1440, height: 2200 },
  { label: 'mobile', width: 390, height: 1800 },
]) {
  const todayHtml = await dumpDom(`${BASE_URL}/today`, viewport);
  assert.match(todayHtml, /Resumo primeiro: estado, risco e proximo passo/u, `[${viewport.label}] /today should open with status/risk/next step.`);
  assert.match(todayHtml, /Risco:/u, `[${viewport.label}] /today should expose a risk summary.`);
  assert.match(todayHtml, /Proximo passo/u, `[${viewport.label}] /today should expose the next step.`);
  assert.match(todayHtml, /Radar live/u, `[${viewport.label}] /today should keep the live radar.`);
  assert.doesNotMatch(todayHtml, /A abrir Hoje/u, `[${viewport.label}] /today should finish loading.`);

  const weekHtml = await dumpDom(`${BASE_URL}/week`, viewport);
  assert.match(weekHtml, /Calendario mensal/u, `[${viewport.label}] /week should render a monthly calendar first.`);
  assert.match(weekHtml, /data-month-calendar/u, `[${viewport.label}] /week should include the month calendar DOM contract.`);
  assert.match(weekHtml, /Ver grelha completa da semana/u, `[${viewport.label}] /week should keep the week as detail.`);
  assert.doesNotMatch(weekHtml, /Por enviar 0/u, `[${viewport.label}] /week should hide zero pending chips.`);
  assert.doesNotMatch(weekHtml, /A confirmar 0/u, `[${viewport.label}] /week should hide zero confirmation chips.`);
  assert.doesNotMatch(weekHtml, /Fechados 0/u, `[${viewport.label}] /week should hide zero closed chips.`);
  assert.doesNotMatch(weekHtml, /Gerados 0/u, `[${viewport.label}] /week should hide zero generated chips.`);
  assert.doesNotMatch(weekHtml, /Preparados 0/u, `[${viewport.label}] /week should hide zero prepared chips.`);
  assert.doesNotMatch(weekHtml, /Enviados 0/u, `[${viewport.label}] /week should hide zero sent chips.`);
  assert.doesNotMatch(weekHtml, /A abrir Calendario/u, `[${viewport.label}] /week should finish loading.`);

  const assistantHtml = await dumpDom(`${BASE_URL}/assistant`, viewport);
  assert.match(assistantHtml, /Pergunta segura: nao envia nada/u, `[${viewport.label}] /assistant should separate safe questions.`);
  assert.match(assistantHtml, /Alterar agenda: preview obrigatorio/u, `[${viewport.label}] /assistant should separate real schedule changes.`);
  assert.match(assistantHtml, /Nao envia nem mexe na agenda/u, `[${viewport.label}] /assistant should explain the safe path.`);
  assert.doesNotMatch(assistantHtml, /A abrir LLM/u, `[${viewport.label}] /assistant should finish loading.`);
}

await validateAssistantTypingFocus(`${BASE_URL}/assistant`);

console.log('Wave 76 summary-first validation passed');

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

async function validateAssistantTypingFocus(url) {
  const port = 19_000 + Math.floor(Math.random() * 1_000);
  const child = spawn(
    'google-chrome',
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${port}`,
      '--window-size=900,1400',
      'about:blank',
    ],
    {
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  try {
    const pageWebSocketUrl = await openPage(port, url);
    const cdp = await connectCdp(pageWebSocketUrl);

    try {
      await cdp.send('Page.enable');
      await cdp.send('Runtime.enable');
      await cdp.send('Page.bringToFront');
      await waitForExpression(
        cdp,
        "Boolean(document.querySelector('[data-rail-chat-input=\"true\"]'))",
        'assistant textarea should exist',
      );
      await cdp.send('Runtime.evaluate', {
        expression:
          "(() => { const input = document.querySelector('[data-rail-chat-input=\"true\"]'); input.focus(); return document.activeElement === input; })()",
        returnByValue: true,
      });
      await cdp.send('Input.insertText', {
        text: 'abcdef',
      });
      await delay(250);

      const result = await cdp.send('Runtime.evaluate', {
        expression:
          "(() => { const input = document.querySelector('[data-rail-chat-input=\"true\"]'); return { active: document.activeElement === input, value: input?.value ?? '' }; })()",
        returnByValue: true,
      });
      const value = result.result?.value;

      assert.equal(value.active, true, 'LLM input should keep focus after typing several characters.');
      assert.match(value.value, /abcdef/u, 'LLM input should receive the typed characters.');
    } finally {
      cdp.close();
    }
  } catch (error) {
    throw new Error(`Assistant typing focus validation failed: ${error instanceof Error ? error.message : String(error)}\n${stderr}`);
  } finally {
    child.kill('SIGTERM');
  }
}

async function openPage(port, url) {
  await waitForHttp(`http://127.0.0.1:${port}/json/version`);
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  });

  assert.equal(response.ok, true, `Chrome could not open ${url}: ${response.status}`);
  const target = await response.json();
  assert.equal(typeof target.webSocketDebuggerUrl, 'string');
  return target.webSocketDebuggerUrl;
}

async function waitForHttp(url) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}

    await delay(100);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForExpression(cdp, expression, label) {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });

    if (result.result?.value === true) {
      return;
    }

    await delay(150);
  }

  throw new Error(`Timed out waiting for ${label}`);
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolvePromise, rejectPromise) => {
    socket.once('open', resolvePromise);
    socket.once('error', rejectPromise);
  });

  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    if (!message.id) {
      return;
    }

    const callbacks = pending.get(message.id);
    if (!callbacks) {
      return;
    }

    pending.delete(message.id);
    if (message.error) {
      callbacks.reject(new Error(message.error.message ?? JSON.stringify(message.error)));
      return;
    }

    callbacks.resolve(message.result ?? {});
  });

  return {
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;

      return new Promise((resolvePromise, rejectPromise) => {
        pending.set(id, {
          resolve: resolvePromise,
          reject: rejectPromise,
        });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

function delay(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}
