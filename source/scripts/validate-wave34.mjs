import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { reservePort, runChromeDump } from '../tests/helpers/live-runtime-fixtures.mjs';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_ROOT = resolve(SOURCE_ROOT, '..');
const WEB_DIST_ROOT = resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'dist');
const PACKAGE_JSON_PATH = resolve(SOURCE_ROOT, 'package.json');
const WAVES_PATH = resolve(PROJECT_ROOT, 'docs', 'architecture', 'lume_hub_implementation_waves.md');
const README_PATH = resolve(PROJECT_ROOT, 'README.md');
const SOURCE_README_PATH = resolve(SOURCE_ROOT, 'README.md');
const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave34-'));
const dataRootPath = join(sandboxPath, 'data');
const configRootPath = join(dataRootPath, 'config');
const runtimeRootPath = join(dataRootPath, 'runtime');
const groupSeedFilePath = join(configRootPath, 'groups.json');
const peopleFilePath = join(configRootPath, 'people.json');
const rulesFilePath = join(configRootPath, 'audience_rules.json');
const settingsFilePath = join(runtimeRootPath, 'system-settings.json');

const { DEFAULT_ADMIN_SETTINGS } = await import(
  '../packages/modules/admin-config/dist/modules/admin-config/src/public/index.js'
);
const { KernelFactory } = await import(
  '../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/KernelFactory.js'
);

class FakeWave34Socket {
  constructor(config = {}) {
    this.ev = new EventEmitter();
    this.user = undefined;
    this.groupA = config.groupA ?? '120363500000002101@g.us';
    this.groupB = config.groupB ?? '120363500000002102@g.us';
    this.selfJid = config.selfJid ?? '351910009999@s.whatsapp.net';
    this.sentMessages = [];
  }

  ev;
  user;
  groupA;
  groupB;
  selfJid;
  sentMessages;

  openSession() {
    this.user = {
      id: this.selfJid,
      name: 'Conta LumeHub',
    };
    this.ev.emit('connection.update', {
      connection: 'open',
    });
  }

  async sendMessage(jid, content) {
    const messageId = `wamid.wave34.${jid.replace(/[^a-z0-9]/gi, '').toLowerCase()}.${this.sentMessages.length + 1}`;
    this.sentMessages.push({
      jid,
      content,
      messageId,
    });

    return {
      key: {
        id: messageId,
      },
      message: content,
    };
  }

  async groupFetchAllParticipating() {
    return {
      [this.groupA]: {
        id: this.groupA,
        subject: 'Turma Texto A',
        size: 10,
        participants: [{ id: this.selfJid }],
      },
      [this.groupB]: {
        id: this.groupB,
        subject: 'Turma Video B',
        size: 12,
        participants: [{ id: this.selfJid }],
      },
    };
  }

  async updateMediaMessage(message) {
    return message;
  }

  async logout() {}

  end() {}
}

let runtime = null;

try {
  const senderJid = '351910000321@s.whatsapp.net';
  const groupA = '120363500000002101@g.us';
  const groupB = '120363500000002102@g.us';
  const httpPort = await reservePort();

  await mkdir(configRootPath, { recursive: true });
  await mkdir(runtimeRootPath, { recursive: true });
  await mkdir(join(sandboxPath, 'systemd-user'), { recursive: true });

  await writeRuntimeFixtures({
    groupA,
    groupB,
    senderJid,
  });

  let latestSocket = null;
  runtime = new KernelFactory({
    runtimeConfig: {
      rootPath: sandboxPath,
      dataRootPath,
      configRootPath,
      runtimeRootPath,
      groupSeedFilePath,
      peopleFilePath,
      rulesFilePath,
      settingsFilePath,
      queueFilePath: join(runtimeRootPath, 'instruction-queue.json'),
      backendRuntimeStateFilePath: join(runtimeRootPath, 'backend-runtime-state.json'),
      backendStateFilePath: join(runtimeRootPath, 'host-state.json'),
      hostStateFilePath: join(sandboxPath, 'host-runtime-state.json'),
      powerStateFilePath: join(sandboxPath, 'power-policy-state.json'),
      inhibitorStatePath: join(sandboxPath, 'sleep-inhibitor.json'),
      systemdUserPath: join(sandboxPath, 'systemd-user'),
      codexAuthFile: join(sandboxPath, 'auth.json'),
      canonicalCodexAuthFile: join(sandboxPath, 'auth.json'),
      codexAuthRouterStateFilePath: join(runtimeRootPath, 'codex-auth-router.state.json'),
      codexAuthRouterBackupDirectoryPath: join(runtimeRootPath, 'codex-auth-router-backups'),
      whatsappAuthRootPath: join(runtimeRootPath, 'whatsapp-auth'),
      whatsappEnabled: true,
      whatsappAutoConnect: true,
      whatsappSocketFactory: async () => {
        const socket = new FakeWave34Socket({
          groupA,
          groupB,
        });
        latestSocket = socket;
        setTimeout(() => {
          socket.openSession();
        }, 0);
        return socket;
      },
      whatsappVersionResolver: async () => ({
        version: [1, 0, 0],
      }),
      webDistRootPath: WEB_DIST_ROOT,
      frontendDefaultMode: 'live',
      httpHost: '127.0.0.1',
      httpPort,
      operationalTickIntervalMs: 60_000,
    },
  }).create();

  await runtime.start();
  await delay(120);
  assert.ok(latestSocket, 'Expected fake WhatsApp socket to be created.');

  await runtime.modules.audienceRoutingModule.upsertSenderAudienceRule({
    identifiers: [
      {
        kind: 'whatsapp_jid',
        value: senderJid,
      },
    ],
    targetGroupJids: [groupA],
    enabled: true,
    requiresConfirmation: false,
    notes: 'Regra de regressao de texto da wave 34.',
  });

  const textDistributionResponse = await runtime.inject({
    method: 'POST',
    path: '/api/routing/distributions',
    headers: {
      'content-type': 'application/json',
    },
    body: {
      sourceMessageId: 'wamid.wave34.text.0001',
      identifiers: [
        {
          kind: 'whatsapp_jid',
          value: senderJid,
        },
      ],
      messageText: 'Aula de hoje passa para a sala 2.',
      mode: 'confirmed',
    },
  });

  assert.equal(textDistributionResponse.statusCode, 200);
  assert.equal(textDistributionResponse.body.instruction.contentKind, 'text');
  assert.equal(textDistributionResponse.body.plan.targetCount, 1);

  const mediaAsset = await runtime.modules.mediaLibraryModule.ingestAsset({
    mediaType: 'video',
    mimeType: 'video/mp4',
    binary: Uint8Array.from(Buffer.from('wave34-video-binary-sample-v1', 'utf8')),
    sourceChatJid: senderJid,
    sourceMessageId: 'wamid.wave34.media.source',
    caption: 'Video final para a ronda da wave 34.',
    storedAt: '2026-03-28T19:10:00.000Z',
  });

  const mediaDistributionResponse = await runtime.inject({
    method: 'POST',
    path: '/api/routing/distributions',
    headers: {
      'content-type': 'application/json',
    },
    body: {
      sourceMessageId: 'wamid.wave34.media.0001',
      assetId: mediaAsset.asset.assetId,
      caption: 'Video final distribuido para os grupos.',
      targetGroupJids: [groupA, groupB],
      mode: 'confirmed',
    },
  });

  assert.equal(mediaDistributionResponse.statusCode, 200);
  assert.equal(mediaDistributionResponse.body.instruction.contentKind, 'media');
  assert.equal(mediaDistributionResponse.body.instruction.mediaAssetId, mediaAsset.asset.assetId);
  assert.equal(mediaDistributionResponse.body.plan.targetCount, 2);

  const tick = await runtime.performOperationalTick(new Date('2026-03-28T19:12:00.000Z'));
  assert.equal(tick.instructionQueue.processedInstructions, 2);
  assert.equal(tick.instructionQueue.processedActions, 3);
  assert.equal(tick.instructionQueue.failedActions, 0);

  const instructions = await runtime.modules.instructionQueueModule.listInstructions();
  assert.equal(instructions.length, 2);
  assert.ok(instructions.every((instruction) => instruction.status === 'completed'));
  assert.ok(
    instructions.some((instruction) =>
      instruction.actions.some((action) => (action.payload?.kind ?? null) === 'text'),
    ),
  );
  assert.ok(
    instructions.some((instruction) =>
      instruction.actions.some((action) => (action.payload?.kind ?? null) === 'media'),
    ),
  );

  const address = await runtime.listen();
  const mediaDom = await runChromeDump(`${address.origin}/media?mode=live`);
  assert.match(mediaDom.stdout, /Passo 3\. Confirmar e distribuir/u);
  assert.match(mediaDom.stdout, /Video final distribuido para os grupos\./u);
  assert.match(mediaDom.stdout, /Turma Texto A/u);
  assert.match(mediaDom.stdout, /Turma Video B/u);
  assert.doesNotMatch(mediaDom.stdout, /Algo falhou ao carregar esta pagina/u);

  const distributionsDom = await runChromeDump(`${address.origin}/distributions?mode=live`);
  assert.match(distributionsDom.stdout, /Distribuicoes recentes/u);
  assert.match(distributionsDom.stdout, /2 distribuicoes/u);
  assert.match(distributionsDom.stdout, /Turma Texto A/u);
  assert.doesNotMatch(distributionsDom.stdout, /Algo falhou ao carregar esta pagina/u);

  await assertPathMissing(resolve(SOURCE_ROOT, 'scripts', 'validate-wave30.mjs'));
  await assertPathMissing(resolve(SOURCE_ROOT, 'scripts', 'validate-wave31.mjs'));
  await assertPathMissing(resolve(SOURCE_ROOT, 'scripts', 'validate-wave32.mjs'));
  await assertPathMissing(resolve(SOURCE_ROOT, 'scripts', 'validate-wave33.mjs'));

  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8'));
  assert.equal(typeof packageJson.scripts['validate:wave34'], 'string');
  assert.equal(packageJson.scripts['validate:wave30'], undefined);
  assert.equal(packageJson.scripts['validate:wave31'], undefined);
  assert.equal(packageJson.scripts['validate:wave32'], undefined);
  assert.equal(packageJson.scripts['validate:wave33'], undefined);

  const wavesFile = await readFile(WAVES_PATH, 'utf8');
  assert.match(wavesFile, /As `Wave 0` a `Wave 34` ja foram executadas e validadas\./u);
  assert.match(wavesFile, /Sem waves ativas neste momento\./u);
  assert.doesNotMatch(wavesFile, /^### Wave /mu);

  const rootReadme = await readFile(README_PATH, 'utf8');
  assert.match(rootReadme, /`Wave 30` a `Wave 34`/u);
  assert.doesNotMatch(rootReadme, /Wave 34` para limpeza final/u);

  const sourceReadme = await readFile(SOURCE_README_PATH, 'utf8');
  assert.match(sourceReadme, /validate:wave34/u);
  assert.doesNotMatch(sourceReadme, /validate:wave3[0-3]/u);

  console.log('validate-wave34: ok');
  console.log(`mediaRoute=${address.origin}/media?mode=live`);
  console.log(`distributionsRoute=${address.origin}/distributions?mode=live`);
} finally {
  await runtime?.stop().catch(() => undefined);
  await rm(sandboxPath, { recursive: true, force: true });
}

async function writeRuntimeFixtures({
  groupA,
  groupB,
  senderJid,
}) {
  await writeJsonFile(groupSeedFilePath, {
    schemaVersion: 1,
    groups: [
      {
        groupJid: groupA,
        preferredSubject: 'Turma Texto A',
        aliases: ['Texto A'],
        courseId: 'wave34-a',
        groupOwners: [],
        calendarAccessPolicy: {
          group: 'read',
          groupOwner: 'read_write',
          appOwner: 'read_write',
        },
        lastRefreshedAt: null,
      },
      {
        groupJid: groupB,
        preferredSubject: 'Turma Video B',
        aliases: ['Video B'],
        courseId: 'wave34-b',
        groupOwners: [],
        calendarAccessPolicy: {
          group: 'read',
          groupOwner: 'read_write',
          appOwner: 'read_write',
        },
        lastRefreshedAt: null,
      },
    ],
  });

  await writeJsonFile(peopleFilePath, {
    schemaVersion: 1,
    people: [
      {
        personId: 'person-wave34-sender',
        displayName: 'Operadora Wave 34',
        identifiers: [
          {
            kind: 'whatsapp_jid',
            value: senderJid,
          },
        ],
        globalRoles: ['member'],
        createdAt: '2026-03-28T19:00:00.000Z',
        updatedAt: '2026-03-28T19:00:00.000Z',
      },
    ],
    notes: [],
  });

  await writeJsonFile(rulesFilePath, {
    schemaVersion: 1,
    rules: [],
  });

  await writeJsonFile(settingsFilePath, {
    ...DEFAULT_ADMIN_SETTINGS,
    whatsapp: {
      ...DEFAULT_ADMIN_SETTINGS.whatsapp,
      enabled: true,
      groupDiscoveryEnabled: true,
      conversationDiscoveryEnabled: true,
    },
  });

  await writeJsonFile(join(runtimeRootPath, 'instruction-queue.json'), {
    schemaVersion: 1,
    instructions: [],
  });
}

async function writeJsonFile(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function assertPathMissing(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
  } catch {
    return;
  }

  throw new Error(`Expected path to be absent: ${filePath}`);
}
