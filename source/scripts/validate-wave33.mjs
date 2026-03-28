import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { reservePort, runChromeDump } from '../tests/helpers/live-runtime-fixtures.mjs';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIST_ROOT = resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'dist');
const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave33-'));
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

class FakeWave33Socket {
  constructor(config = {}) {
    this.ev = new EventEmitter();
    this.user = undefined;
    this.groupA = config.groupA ?? '120363500000001101@g.us';
    this.groupB = config.groupB ?? '120363500000001102@g.us';
    this.selfJid = config.selfJid ?? '351910009999@s.whatsapp.net';
    this.failedGroups = new Set(config.failOnceForGroups ?? []);
  }

  ev;
  user;
  groupA;
  groupB;
  selfJid;
  failedGroups;

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
    if (this.failedGroups.has(jid)) {
      this.failedGroups.delete(jid);
      throw new Error(`Simulated send failure for ${jid}.`);
    }

    return {
      key: {
        id: `wamid.wave33.${jid.replace(/[^a-z0-9]/gi, '').toLowerCase()}`,
      },
      message: content,
    };
  }

  async groupFetchAllParticipating() {
    return {
      [this.groupA]: {
        id: this.groupA,
        subject: 'Turma Video A',
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
  const groupA = '120363500000001101@g.us';
  const groupB = '120363500000001102@g.us';
  const httpPort = await reservePort();

  await mkdir(configRootPath, { recursive: true });
  await mkdir(runtimeRootPath, { recursive: true });
  await mkdir(join(sandboxPath, 'systemd-user'), { recursive: true });

  await writeFile(
    groupSeedFilePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        groups: [
          {
            groupJid: groupA,
            preferredSubject: 'Turma Video A',
            aliases: ['Video A'],
            courseId: 'wave33-a',
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
            courseId: 'wave33-b',
            groupOwners: [],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: null,
          },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  await writeFile(
    peopleFilePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        people: [],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    rulesFilePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        rules: [],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    settingsFilePath,
    `${JSON.stringify(
      {
        ...DEFAULT_ADMIN_SETTINGS,
        whatsapp: {
          ...DEFAULT_ADMIN_SETTINGS.whatsapp,
          enabled: true,
          groupDiscoveryEnabled: true,
          conversationDiscoveryEnabled: true,
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

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
        const socket = new FakeWave33Socket({
          groupA,
          groupB,
          failOnceForGroups: [groupB],
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

  const mediaAsset = await runtime.modules.mediaLibraryModule.ingestAsset({
    mediaType: 'video',
    mimeType: 'video/mp4',
    binary: Uint8Array.from(Buffer.from('wave33-video-binary-sample-v1', 'utf8')),
    sourceChatJid: '351910000321@s.whatsapp.net',
    sourceMessageId: 'wamid.wave33.media.source',
    caption: 'Video base para distribuicao guiada.',
    storedAt: '2026-03-28T18:10:00.000Z',
  });

  const previewResponse = await runtime.inject({
    method: 'POST',
    path: '/api/routing/preview',
    headers: {
      'content-type': 'application/json',
    },
    body: {
      sourceMessageId: 'wamid.wave33.preview.1',
      targetGroupJids: [groupA, groupB],
    },
  });

  assert.equal(previewResponse.statusCode, 200);
  assert.equal(previewResponse.body.targetCount, 2);
  assert.equal(previewResponse.body.matchedRuleIds.length, 0);
  assert.deepEqual(
    previewResponse.body.targets.map((target) => target.groupJid),
    [groupA, groupB],
  );

  const createResponse = await runtime.inject({
    method: 'POST',
    path: '/api/routing/distributions',
    headers: {
      'content-type': 'application/json',
    },
    body: {
      sourceMessageId: 'wamid.wave33.distribution.1',
      assetId: mediaAsset.asset.assetId,
      caption: 'Video distribuido pela wave 33.',
      targetGroupJids: [groupA, groupB],
      mode: 'confirmed',
    },
  });

  assert.equal(createResponse.statusCode, 200);
  assert.equal(createResponse.body.plan.targetCount, 2);
  assert.equal(createResponse.body.instruction.contentKind, 'media');
  assert.equal(createResponse.body.instruction.mediaAssetId, mediaAsset.asset.assetId);
  assert.deepEqual(createResponse.body.instruction.targetGroupJids, [groupA, groupB]);

  const firstTick = await runtime.performOperationalTick(new Date('2026-03-28T18:12:00.000Z'));
  assert.equal(firstTick.instructionQueue.processedInstructions, 1);
  assert.equal(firstTick.instructionQueue.processedActions, 1);
  assert.equal(firstTick.instructionQueue.failedActions, 1);

  const queueAfterTick = await runtime.modules.instructionQueueModule.listInstructions();
  assert.equal(queueAfterTick.length, 1);
  assert.equal(queueAfterTick[0]?.status, 'partial_failed');
  assert.equal(queueAfterTick[0]?.actions[0]?.status, 'completed');
  assert.equal(queueAfterTick[0]?.actions[1]?.status, 'failed');

  const address = await runtime.listen();

  const mediaDom = await runChromeDump(`${address.origin}/media?mode=live`);
  assert.match(mediaDom.stdout, /Passo 1\. Escolher video recebido/u);
  assert.match(mediaDom.stdout, /Passo 2\. Escolher grupos alvo/u);
  assert.match(mediaDom.stdout, /Passo 3\. Confirmar e distribuir/u);
  assert.match(mediaDom.stdout, /Video base para distribuicao guiada\./u);
  assert.match(mediaDom.stdout, /Turma Video A/u);
  assert.match(mediaDom.stdout, /Turma Video B/u);
  assert.match(mediaDom.stdout, /entregue/u);
  assert.match(mediaDom.stdout, /falhou/u);
  assert.doesNotMatch(mediaDom.stdout, /Algo falhou ao carregar esta pagina/u);

  const routingDom = await runChromeDump(`${address.origin}/distributions?mode=live`);
  assert.match(routingDom.stdout, /Distribuicoes recentes/u);
  assert.doesNotMatch(routingDom.stdout, /Algo falhou ao carregar esta pagina/u);

  console.log('validate-wave33: ok');
  console.log(`mediaRoute=${address.origin}/media?mode=live`);
  console.log(`assetId=${mediaAsset.asset.assetId}`);
} finally {
  await runtime?.stop().catch(() => undefined);
  await rm(sandboxPath, { recursive: true, force: true });
}
