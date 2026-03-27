import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { WebSocket } from 'ws';

const chromeCommand = 'google-chrome';
const { AppBootstrap } = await import('../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/AppBootstrap.js');

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave19-'));
const webDistRootPath = fileURLToPath(new URL('../apps/lume-hub-web/dist/', import.meta.url));
const httpPort = await reservePort();
const baseUrl = `http://127.0.0.1:${httpPort}`;

try {
  const runtimeConfig = await seedWave19Sandbox(sandboxPath, httpPort, webDistRootPath);
  const bootstrap = new AppBootstrap({
    runtimeConfig,
  });

  await bootstrap.start();

  try {
    await waitUntilReady(`${baseUrl}/api/dashboard`);

    const dashboard = await readJson(`${baseUrl}/api/dashboard`);
    assert.equal(dashboard.health.status, 'healthy');
    assert.equal(dashboard.groups.total, 1);
    assert.equal(dashboard.routing.totalRules, 1);

    const groups = await readJson(`${baseUrl}/api/groups`);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].preferredSubject, 'EFA Programacao A');

    const html = await fetchText(`${baseUrl}/today`);
    assert.match(html, /__LUMEHUB_BOOT_CONFIG__/u);
    assert.match(html, /"defaultMode":"live"/u);
    assert.match(html, /"webSocketPath":"\/ws"/u);

    const wsEvent = await waitForWsEvent(`ws://127.0.0.1:${httpPort}/ws`, 'settings.commands.updated', async () => {
      const settingsResponse = await fetch(`${baseUrl}/api/settings/commands`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          assistantEnabled: false,
        }),
      });
      assert.equal(settingsResponse.status, 200);
    });

    assert.equal(wsEvent.topic, 'settings.commands.updated');
    assert.equal(wsEvent.payload.assistantEnabled, false);

    for (const scenario of [
      {
        route: '/today',
        expectedTexts: ['Hoje', 'Modo ligacao live', 'Pronto para operar'],
        forbiddenTexts: ['Algo falhou ao carregar esta pagina', 'A ligacao live abriu a pagina web, mas nao encontrou a API'],
      },
      {
        route: '/whatsapp?details=advanced',
        expectedTexts: ['WhatsApp', 'EFA Programacao A', 'Dono da App'],
        forbiddenTexts: ['Algo falhou ao carregar esta pagina', 'JSON.parse: unexpected character'],
      },
      {
        route: '/settings?details=advanced',
        expectedTexts: ['Configuracao', 'Auth file:', 'Modo ligacao live'],
        forbiddenTexts: ['Algo falhou ao carregar esta pagina', 'A ligacao live respondeu dados invalidos'],
      },
    ]) {
      const response = await fetch(`${baseUrl}${scenario.route}`);
      assert.equal(response.status, 200, `server should answer 200 for ${scenario.route}`);

      const { stdout, stderr } = await runChromeDump(`${baseUrl}${scenario.route}`);

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

    console.log(`Wave 19 validation passed on ${baseUrl}/today`);
  } finally {
    await bootstrap.stop();
  }
} finally {
  await rm(sandboxPath, { recursive: true, force: true });
}

async function seedWave19Sandbox(sandboxPath, httpPort, webDistRootPath) {
  const dataRootPath = join(sandboxPath, 'data');
  const configRootPath = join(sandboxPath, 'config');
  const runtimeRootPath = join(sandboxPath, 'runtime');
  const groupSeedFilePath = join(configRootPath, 'groups.json');
  const catalogFilePath = join(configRootPath, 'discipline_catalog.json');
  const peopleFilePath = join(configRootPath, 'people.json');
  const rulesFilePath = join(configRootPath, 'audience_rules.json');
  const settingsFilePath = join(runtimeRootPath, 'system-settings.json');
  const queueFilePath = join(runtimeRootPath, 'instruction-queue.json');
  const powerStateFilePath = join(runtimeRootPath, 'power-policy-state.json');
  const inhibitorStatePath = join(runtimeRootPath, 'sleep-inhibitor.json');
  const hostStateFilePath = join(runtimeRootPath, 'host-runtime-state.json');
  const backendStateFilePath = join(runtimeRootPath, 'host-state.json');
  const codexAuthFile = join(runtimeRootPath, 'auth.json');
  const systemdUserPath = join(runtimeRootPath, 'systemd-user');
  const groupProgramming = '120363402446203704@g.us';

  await mkdir(configRootPath, { recursive: true });
  await mkdir(runtimeRootPath, { recursive: true });

  await writeFile(
    groupSeedFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        groups: [
          {
            groupJid: groupProgramming,
            preferredSubject: 'EFA Programacao A',
            aliases: ['Prog A'],
            courseId: 'course-programming',
            groupOwners: [
              {
                personId: 'person-ana',
                assignedAt: '2026-03-27T10:00:00.000Z',
                assignedBy: 'person-app-owner',
              },
            ],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-27T10:00:00.000Z',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    catalogFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        courses: [
          {
            courseId: 'course-programming',
            title: 'UFCD - Programacao',
            groupJid: groupProgramming,
            preferredSubject: 'EFA Programacao A',
            aliases: ['Prog A'],
          },
        ],
        disciplines: [
          {
            code: 'UFCD-0777',
            title: 'Programacao Base',
            courseId: 'course-programming',
            aliases: ['0777'],
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    peopleFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        people: [
          {
            personId: 'person-app-owner',
            displayName: 'Dono da App',
            identifiers: [
              {
                kind: 'whatsapp_jid',
                value: '351910000099@s.whatsapp.net',
              },
            ],
            globalRoles: ['app_owner'],
            createdAt: '2026-03-27T10:00:00.000Z',
            updatedAt: '2026-03-27T10:00:00.000Z',
          },
          {
            personId: 'person-ana',
            displayName: 'Ana Formadora',
            identifiers: [
              {
                kind: 'whatsapp_jid',
                value: '351910000001@s.whatsapp.net',
              },
            ],
            globalRoles: ['member'],
            createdAt: '2026-03-27T10:00:00.000Z',
            updatedAt: '2026-03-27T10:00:00.000Z',
          },
        ],
        notes: [],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    rulesFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        rules: [
          {
            ruleId: 'rule-programming',
            personId: 'person-ana',
            identifiers: [],
            targetGroupJids: [groupProgramming],
            targetCourseIds: [],
            targetDisciplineCodes: ['UFCD-0777'],
            enabled: true,
            requiresConfirmation: false,
            notes: 'Distribuicao base de programacao.',
            createdAt: '2026-03-27T10:00:00.000Z',
            updatedAt: '2026-03-27T10:00:00.000Z',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    queueFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        instructions: [],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    codexAuthFile,
    JSON.stringify(
      {
        schemaVersion: 1,
        accessToken: 'test-token',
      },
      null,
      2,
    ),
    'utf8',
  );

  return {
    rootPath: sandboxPath,
    dataRootPath,
    configRootPath,
    runtimeRootPath,
    groupSeedFilePath,
    catalogFilePath,
    peopleFilePath,
    rulesFilePath,
    settingsFilePath,
    queueFilePath,
    powerStateFilePath,
    inhibitorStatePath,
    hostStateFilePath,
    backendStateFilePath,
    systemdUserPath,
    codexAuthFile,
    canonicalCodexAuthFile: codexAuthFile,
    startByPreparingCodexAuth: true,
    hostWorkingDirectory: sandboxPath,
    hostExecStart: '/usr/bin/env node /tmp/lume-hub-host.js',
    operationalTickIntervalMs: 5_000,
    httpHost: '127.0.0.1',
    httpPort,
    webSocketPath: '/ws',
    webDistRootPath,
    frontendDefaultMode: 'live',
  };
}

async function reservePort() {
  const { createServer } = await import('node:net');

  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Could not reserve a TCP port for Wave 19 validation.'));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
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

  throw new Error(`Timed out while waiting for ${url}.`);
}

async function readJson(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200, `Expected 200 from ${url}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200, `Expected 200 from ${url}`);
  return response.text();
}

async function waitForWsEvent(url, expectedTopic, action) {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out while waiting for WebSocket event ${expectedTopic}.`));
    }, 8_000);

    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    socket.once('open', () => {
      Promise.resolve(action()).catch((error) => {
        clearTimeout(timeout);
        socket.close();
        reject(error);
      });
    });

    socket.once('message', (rawData) => {
      clearTimeout(timeout);
      socket.close();

      try {
        const event = JSON.parse(String(rawData));
        if (event.topic !== expectedTopic) {
          reject(new Error(`Expected WebSocket topic ${expectedTopic}, got ${event.topic}.`));
          return;
        }

        resolve(event);
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function runChromeDump(url) {
  return await new Promise((resolve, reject) => {
    const chrome = spawn(
      chromeCommand,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=5000',
        '--dump-dom',
        url,
      ],
      {
        cwd: webDistRootPath,
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
