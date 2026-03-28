import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { WebSocket } from 'ws';

const chromeCommand = 'google-chrome';
const { AppBootstrap } = await import('../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/AppBootstrap.js');

async function runWave20Validation() {
  const fakeSocketRef = {
    current: null,
  };
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave20-'));
  const webDistRootPath = fileURLToPath(new URL('../apps/lume-hub-web/dist/', import.meta.url));
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;

  try {
    const runtimeConfig = await seedWave20Sandbox(sandboxPath, httpPort, webDistRootPath, fakeSocketRef);
    const bootstrap = new AppBootstrap({
      runtimeConfig,
    });

    await bootstrap.start();

    try {
      await waitUntilReady(`${baseUrl}/api/dashboard`);
      await waitUntil(() => Boolean(fakeSocketRef.current));

      const fakeSocket = fakeSocketRef.current;
      assert.ok(fakeSocket);
      fakeSocket.publishQr();

      await waitUntil(async () => {
        const qrSnapshot = await readJson(`${baseUrl}/api/whatsapp/qr`);
        return qrSnapshot.available === true;
      });

      const qr = await readJson(`${baseUrl}/api/whatsapp/qr`);
      assert.equal(qr.available, true);
      assert.match(qr.svg, /<svg/u);

      fakeSocket.openSession();

      await waitUntil(async () => {
        const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
        return workspace.runtime.session.phase === 'open' && workspace.runtime.discoveredGroups >= 1;
      });

      const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
      assert.equal(workspace.runtime.session.connected, true);
      assert.equal(workspace.runtime.session.phase, 'open');
      assert.equal(workspace.runtime.qr.available, false);
      assert.ok(workspace.groups.some((group) => group.groupJid === fakeSocket.groupJid && group.knownToBot));
      assert.ok(
        workspace.conversations.some(
          (conversation) => conversation.whatsappJids.includes(fakeSocket.privateChatJid) && conversation.knownToBot,
        ),
      );

      const groups = await readJson(`${baseUrl}/api/groups`);
      assert.ok(groups.some((group) => group.groupJid === fakeSocket.groupJid));

      const people = await readJson(`${baseUrl}/api/people`);
      assert.ok(
        people.some((person) =>
          person.identifiers.some(
            (identifier) => identifier.kind === 'whatsapp_jid' && identifier.value === fakeSocket.privateChatJid,
          ),
        ),
      );

      const refreshEvent = await waitForWsEvent(
        `ws://127.0.0.1:${httpPort}/ws`,
        'whatsapp.workspace.refreshed',
        async () => {
          const response = await fetch(`${baseUrl}/api/whatsapp/refresh`, {
            method: 'POST',
          });
          assert.equal(response.status, 200);
        },
      );
      assert.equal(refreshEvent.topic, 'whatsapp.workspace.refreshed');

      const gateway = bootstrap
        .getRuntime()
        .getContext()
        .container.resolve('adapter:whatsapp-gateway');
      const observationPromise = waitForSignal(gateway.subscribeOutboundObservation.bind(gateway));
      const confirmationPromise = waitForSignal(gateway.subscribeOutboundConfirmation.bind(gateway));

      const sendResponse = await fetch(`${baseUrl}/api/whatsapp/send-test`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          chatJid: fakeSocket.privateChatJid,
          text: 'Mensagem de teste live da Wave 20.',
        }),
      });
      assert.equal(sendResponse.status, 200);
      const sendResult = await sendResponse.json();
      assert.match(sendResult.messageId, /^wamid\.fake\./u);

      const observation = await observationPromise;
      const confirmation = await confirmationPromise;
      assert.equal(observation.chatJid, fakeSocket.privateChatJid);
      assert.equal(confirmation.chatJid, fakeSocket.privateChatJid);
      assert.equal(confirmation.ack, 2);

      for (const scenario of [
        {
          route: '/today?mode=live',
          expectedTexts: ['Hoje', 'WhatsApp pronto', 'Ligado'],
        },
        {
          route: '/whatsapp?mode=live&details=advanced',
          expectedTexts: ['WhatsApp', 'Ligado', fakeSocket.groupLabel, fakeSocket.privateChatLabel],
        },
      ]) {
        const { stdout, stderr } = await runChromeDump(`${baseUrl}${scenario.route}`);

        for (const expectedText of scenario.expectedTexts) {
          assert.match(stdout, new RegExp(escapeForRegExp(expectedText), 'u'));
        }

        assert.doesNotMatch(stderr, /(TypeError|ReferenceError|Uncaught|SEVERE)/u);
        assert.doesNotMatch(stdout, /Algo falhou ao carregar esta pagina/u);
      }

      console.log(`Wave 20 validation passed on ${baseUrl}/whatsapp?mode=live`);
    } finally {
      await bootstrap.stop();
    }
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
}

class FakeBaileysSocket {
  constructor() {
    this.ev = new EventEmitter();
    this.user = undefined;
    this.groupJid = '120363402446203704@g.us';
    this.groupLabel = 'EFA Programacao A';
    this.privateChatJid = '351910000001@s.whatsapp.net';
    this.privateChatLabel = 'Ana Formadora';
    this.messageSequence = 0;
  }

  ev;
  user;
  groupJid;
  groupLabel;
  privateChatJid;
  privateChatLabel;
  messageSequence;

  publishQr() {
    this.ev.emit('connection.update', {
      connection: 'connecting',
    });
    this.ev.emit('connection.update', {
      qr: 'wave20-fake-qr',
    });
  }

  openSession() {
    this.user = {
      id: '351910000099@s.whatsapp.net',
      name: 'Conta LumeHub',
    };
    this.ev.emit('connection.update', {
      connection: 'open',
    });
    this.ev.emit('contacts.upsert', [
      {
        id: this.privateChatJid,
        name: this.privateChatLabel,
      },
    ]);
    this.ev.emit('chats.upsert', [
      {
        id: this.privateChatJid,
        name: this.privateChatLabel,
        unreadCount: 2,
        conversationTimestamp: 1_774_592_400,
      },
    ]);
    this.ev.emit('groups.upsert', [
      {
        id: this.groupJid,
        subject: this.groupLabel,
        size: 12,
        participants: [
          {
            id: this.privateChatJid,
          },
        ],
      },
    ]);
  }

  async sendMessage(jid, content, options = {}) {
    const messageId = options.messageId ?? `wamid.fake.${String(++this.messageSequence).padStart(4, '0')}`;

    setTimeout(() => {
      this.ev.emit('messages.update', [
        {
          key: {
            id: messageId,
            remoteJid: jid,
          },
          update: {
            status: 1,
          },
        },
      ]);
    }, 20);

    setTimeout(() => {
      this.ev.emit('messages.update', [
        {
          key: {
            id: messageId,
            remoteJid: jid,
          },
          update: {
            status: 2,
          },
        },
      ]);
    }, 50);

    return {
      key: {
        id: messageId,
        remoteJid: jid,
        fromMe: true,
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      message: {
        conversation: content.text,
      },
    };
  }

  async groupFetchAllParticipating() {
    return {
      [this.groupJid]: {
        id: this.groupJid,
        subject: this.groupLabel,
        size: 12,
        participants: [
          {
            id: this.privateChatJid,
          },
        ],
      },
    };
  }

  async logout() {}

  end() {}
}

await runWave20Validation();

async function seedWave20Sandbox(sandboxPath, httpPort, webDistRootPath, fakeSocket) {
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

  await mkdir(configRootPath, { recursive: true });
  await mkdir(runtimeRootPath, { recursive: true });

  await writeFile(
    groupSeedFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        groups: [],
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
        courses: [],
        disciplines: [],
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
            createdAt: '2026-03-27T12:00:00.000Z',
            updatedAt: '2026-03-27T12:00:00.000Z',
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
        rules: [],
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
    settingsFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        commands: {
          assistantEnabled: true,
          schedulingEnabled: true,
          ownerTerminalEnabled: true,
          autoReplyEnabled: false,
          directRepliesEnabled: false,
          allowPrivateAssistant: true,
          authorizedGroupJids: [],
          authorizedPrivateJids: [],
        },
        whatsapp: {
          enabled: true,
          sharedAuthWithCodex: true,
          groupDiscoveryEnabled: true,
          conversationDiscoveryEnabled: true,
        },
        llm: {
          enabled: false,
          provider: 'codex-oauth',
          model: 'gpt-5.4',
          streamingEnabled: true,
        },
        ui: {
          defaultNotificationRules: [
            {
              kind: 'relative_before_event',
              daysBeforeEvent: 1,
              offsetMinutesBeforeEvent: 0,
              enabled: true,
              label: '24h antes',
            },
            {
              kind: 'relative_before_event',
              daysBeforeEvent: 0,
              offsetMinutesBeforeEvent: 30,
              enabled: true,
              label: '30 min antes',
            },
          ],
        },
        updatedAt: '2026-03-27T12:00:00.000Z',
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(codexAuthFile, JSON.stringify({ schemaVersion: 1, ok: true }, null, 2), 'utf8');

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
    codexAuthFile,
    canonicalCodexAuthFile: codexAuthFile,
    systemdUserPath,
    httpHost: '127.0.0.1',
    httpPort,
    webDistRootPath,
    frontendDefaultMode: 'live',
    whatsappEnabled: true,
    whatsappAutoConnect: true,
    whatsappAuthRootPath: join(runtimeRootPath, 'whatsapp-auth'),
    whatsappSocketFactory: async () => {
      const socket = new FakeBaileysSocket();
      fakeSocket.current = socket;
      return socket;
    },
  };
}

async function reservePort() {
  const { createServer } = await import('node:http');

  return await new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
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
  await waitUntil(async () => {
    try {
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  });
}

async function waitUntil(check, timeoutMs = 10_000, intervalMs = 120) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await check()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timed out while waiting for validation condition.');
}

async function readJson(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return response.json();
}

function waitForSignal(subscribe) {
  return new Promise((resolve) => {
    const unsubscribe = subscribe((value) => {
      unsubscribe();
      resolve(value);
    });
  });
}

async function waitForWsEvent(url, topic, action) {
  const socket = new WebSocket(url);

  try {
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });

    const eventPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out while waiting for '${topic}'.`));
      }, 5_000);

      socket.on('message', (chunk) => {
        const payload = JSON.parse(String(chunk));

        if (payload.topic !== topic) {
          return;
        }

        clearTimeout(timeout);
        resolve(payload);
      });
    });

    await action();
    return await eventPromise;
  } finally {
    socket.close();
  }
}

async function runChromeDump(url) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=3000',
    '--dump-dom',
    url,
  ];

  return await new Promise((resolve, reject) => {
    const child = spawn(chromeCommand, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Headless Chrome exited with code ${code}: ${stderr}`));
        return;
      }

      resolve({
        stdout,
        stderr,
      });
    });
  });
}

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
