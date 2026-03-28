import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave32-'));
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

class FakeWave32Socket {
  constructor(config = {}) {
    this.ev = new EventEmitter();
    this.user = undefined;
    this.groupA = config.groupA ?? '120363500000000401@g.us';
    this.groupB = config.groupB ?? '120363500000000402@g.us';
    this.selfJid = config.selfJid ?? '351910009999@s.whatsapp.net';
    this.failedGroups = new Set(config.failOnceForGroups ?? []);
    this.sendAttempts = [];
  }

  ev;
  user;
  groupA;
  groupB;
  selfJid;
  failedGroups;
  sendAttempts;

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
    const attempt = {
      jid,
      kind:
        'video' in content
          ? 'video'
          : 'image' in content
            ? 'image'
            : 'document' in content
              ? 'document'
              : 'audio' in content
                ? 'audio'
                : 'text',
      mimetype: 'mimetype' in content ? content.mimetype ?? null : null,
      caption: 'caption' in content ? content.caption ?? null : null,
      binaryLength:
        'video' in content
          ? Buffer.from(content.video ?? []).byteLength
          : 'image' in content
            ? Buffer.from(content.image ?? []).byteLength
            : 'document' in content
              ? Buffer.from(content.document ?? []).byteLength
              : 'audio' in content
                ? Buffer.from(content.audio ?? []).byteLength
                : Buffer.from(content.text ?? '', 'utf8').byteLength,
    };
    this.sendAttempts.push(attempt);

    if (this.failedGroups.has(jid)) {
      this.failedGroups.delete(jid);
      throw new Error(`Simulated send failure for ${jid}.`);
    }

    return {
      key: {
        id: `wamid.wave32.${jid.replace(/[^a-z0-9]/gi, '').toLowerCase()}.${this.sendAttempts.length}`,
      },
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
  const senderJid = '351910000321@s.whatsapp.net';
  const groupA = '120363500000000401@g.us';
  const groupB = '120363500000000402@g.us';

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
            courseId: 'wave32-a',
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
            courseId: 'wave32-b',
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
        const socket = new FakeWave32Socket({
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
    targetGroupJids: [groupA, groupB],
    enabled: true,
    requiresConfirmation: false,
    notes: 'Regra de teste para distribuicao de media.',
  });

  const mediaAsset = await runtime.modules.mediaLibraryModule.ingestAsset({
    mediaType: 'video',
    mimeType: 'video/mp4',
    binary: Uint8Array.from(Buffer.from('wave32-video-binary-sample-v1', 'utf8')),
    sourceChatJid: senderJid,
    sourceMessageId: 'wamid.wave32.media.source',
    caption: 'Video base para distribuicao multi-grupo.',
    storedAt: '2026-03-28T17:10:00.000Z',
  });

  const createResponse = await runtime.inject({
    method: 'POST',
    path: '/api/routing/distributions',
    headers: {
      'content-type': 'application/json',
    },
    body: {
      sourceMessageId: 'wamid.wave32.distribution.1',
      identifiers: [
        {
          kind: 'whatsapp_jid',
          value: senderJid,
        },
      ],
      assetId: mediaAsset.asset.assetId,
      caption: 'Video distribuido pela queue.',
      mode: 'confirmed',
    },
  });

  assert.equal(createResponse.statusCode, 200);
  assert.equal(createResponse.body.instruction.contentKind, 'media');
  assert.equal(createResponse.body.instruction.mediaAssetId, mediaAsset.asset.assetId);

  const firstTick = await runtime.performOperationalTick(new Date('2026-03-28T17:11:00.000Z'));
  assert.equal(firstTick.instructionQueue.processedInstructions, 1);
  assert.equal(firstTick.instructionQueue.processedActions, 1);
  assert.equal(firstTick.instructionQueue.failedActions, 1);

  const queueAfterFirstTick = await runtime.modules.instructionQueueModule.listInstructions();
  assert.equal(queueAfterFirstTick.length, 1);
  assert.equal(queueAfterFirstTick[0]?.status, 'partial_failed');
  assert.equal(queueAfterFirstTick[0]?.actions[0]?.status, 'completed');
  assert.equal(queueAfterFirstTick[0]?.actions[1]?.status, 'failed');
  assert.equal(queueAfterFirstTick[0]?.actions[0]?.result?.metadata?.contentKind, 'media');
  assert.equal(queueAfterFirstTick[0]?.actions[0]?.result?.metadata?.assetId, mediaAsset.asset.assetId);
  assert.equal(queueAfterFirstTick[0]?.actions[0]?.result?.metadata?.caption, 'Video distribuido pela queue.');

  assert.equal(latestSocket.sendAttempts.length, 2);
  assert.equal(latestSocket.sendAttempts[0]?.jid, groupA);
  assert.equal(latestSocket.sendAttempts[0]?.kind, 'video');
  assert.equal(latestSocket.sendAttempts[0]?.binaryLength, Buffer.from('wave32-video-binary-sample-v1', 'utf8').byteLength);
  assert.equal(latestSocket.sendAttempts[1]?.jid, groupB);

  const retryResponse = await runtime.inject({
    method: 'POST',
    path: `/api/instruction-queue/${encodeURIComponent(queueAfterFirstTick[0].instructionId)}/retry`,
  });
  assert.equal(retryResponse.statusCode, 200);

  const secondTick = await runtime.performOperationalTick(new Date('2026-03-28T17:12:00.000Z'));
  assert.equal(secondTick.instructionQueue.processedInstructions, 1);
  assert.equal(secondTick.instructionQueue.processedActions, 1);
  assert.equal(secondTick.instructionQueue.failedActions, 0);

  const queueAfterRetry = await runtime.modules.instructionQueueModule.listInstructions();
  assert.equal(queueAfterRetry[0]?.status, 'completed');
  assert.equal(queueAfterRetry[0]?.actions[0]?.attemptCount, 1);
  assert.equal(queueAfterRetry[0]?.actions[1]?.attemptCount, 2);
  assert.equal(queueAfterRetry[0]?.actions[1]?.status, 'completed');
  assert.equal(latestSocket.sendAttempts.filter((attempt) => attempt.jid === groupA).length, 1);
  assert.equal(latestSocket.sendAttempts.filter((attempt) => attempt.jid === groupB).length, 2);

  const duplicateResponse = await runtime.inject({
    method: 'POST',
    path: '/api/routing/distributions',
    headers: {
      'content-type': 'application/json',
    },
    body: {
      sourceMessageId: 'wamid.wave32.distribution.1',
      identifiers: [
        {
          kind: 'whatsapp_jid',
          value: senderJid,
        },
      ],
      assetId: mediaAsset.asset.assetId,
      caption: 'Video distribuido pela queue.',
      mode: 'confirmed',
    },
  });

  assert.equal(duplicateResponse.statusCode, 200);
  assert.equal(duplicateResponse.body.instruction.status, 'completed');
  const queueAfterDuplicate = await runtime.modules.instructionQueueModule.listInstructions();
  assert.equal(queueAfterDuplicate.length, 2);
  assert.equal(queueAfterDuplicate[1]?.actions.every((action) => action.status === 'skipped'), true);

  const listResponse = await runtime.inject({
    method: 'GET',
    path: '/api/routing/distributions',
  });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.body[0]?.contentKind, 'media');
  assert.equal(listResponse.body[0]?.mediaAssetId, mediaAsset.asset.assetId);

  console.log('validate-wave32: ok');
  console.log(`instructionId=${queueAfterRetry[0]?.instructionId}`);
  console.log(`assetId=${mediaAsset.asset.assetId}`);
  console.log(`sendAttempts=${latestSocket.sendAttempts.length}`);
} finally {
  await runtime?.stop().catch(() => undefined);
  await rm(sandboxPath, { recursive: true, force: true });
}
