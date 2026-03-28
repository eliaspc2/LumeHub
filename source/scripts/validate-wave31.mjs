import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { runChromeDump } from '../tests/helpers/live-runtime-fixtures.mjs';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIST_ROOT = resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'dist');
const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave31-'));
const dataRootPath = join(sandboxPath, 'data');
const groupSeedFilePath = join(sandboxPath, 'group-seed.json');

const { DEFAULT_ADMIN_SETTINGS } = await import(
  '../packages/modules/admin-config/dist/modules/admin-config/src/public/index.js'
);
const { InMemoryFrontendApiTransport, FrontendApiClient } = await import(
  '../packages/adapters/frontend-api-client/dist/adapters/frontend-api-client/src/public/index.js'
);
const { GroupDirectoryModule } = await import(
  '../packages/modules/group-directory/dist/modules/group-directory/src/public/index.js'
);
const { FastifyHttpServer } = await import(
  '../packages/adapters/http-fastify/dist/adapters/http-fastify/src/public/index.js'
);
const { MediaLibraryModule } = await import(
  '../packages/modules/media-library/dist/modules/media-library/src/public/index.js'
);
const { PeopleMemoryModule } = await import(
  '../packages/modules/people-memory/dist/modules/people-memory/src/public/index.js'
);
const { BaileysWhatsAppGateway } = await import(
  '../packages/adapters/whatsapp-baileys/dist/index.js'
);
const { WebSocketGateway } = await import(
  '../packages/adapters/ws-fastify/dist/index.js'
);
const { WhatsAppWorkspaceRuntime } = await import(
  '../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/WhatsAppWorkspaceRuntime.js'
);

class FakeWave31Socket {
  constructor(config = {}) {
    this.ev = new EventEmitter();
    this.user = undefined;
    this.groupJid = config.groupJid ?? '120363499999999901@g.us';
    this.groupLabel = config.groupLabel ?? 'Turma Video Wave 31';
    this.participantJid = config.participantJid ?? '351910000321@s.whatsapp.net';
    this.participantLabel = config.participantLabel ?? 'Ana Operadora';
    this.selfJid = config.selfJid ?? '351910009999@s.whatsapp.net';
  }

  ev;
  user;
  groupJid;
  groupLabel;
  participantJid;
  participantLabel;
  selfJid;

  openSession() {
    this.user = {
      id: this.selfJid,
      name: 'Conta LumeHub',
    };
    this.ev.emit('connection.update', {
      connection: 'open',
    });
  }

  publishInboundVideo(binary) {
    this.ev.emit('messages.upsert', {
      messages: [
        {
          key: {
            id: 'wamid.wave31.media.0001',
            remoteJid: this.groupJid,
            participant: this.participantJid,
            fromMe: false,
          },
          messageTimestamp: Math.floor(Date.now() / 1000),
          pushName: this.participantLabel,
          message: {
            videoMessage: {
              caption: 'Video de teste para a wave 31.',
              mimetype: 'video/mp4',
              fileLength: binary.byteLength,
              binary,
            },
          },
        },
      ],
    });
  }

  async sendMessage() {
    throw new Error('Not used in wave31 validation.');
  }

  async groupFetchAllParticipating() {
    return {
      [this.groupJid]: {
        id: this.groupJid,
        subject: this.groupLabel,
        size: 8,
        participants: [
          { id: this.participantJid },
          { id: this.selfJid },
        ],
      },
    };
  }

  async updateMediaMessage(message) {
    return message;
  }

  async logout() {}

  end() {}
}

let httpServer = null;
let webSocketGateway = null;
let whatsAppWorkspaceRuntime = null;

try {
  const groupJid = '120363499999999901@g.us';
  await writeFile(
    groupSeedFilePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        groups: [
          {
            groupJid,
            preferredSubject: 'Turma Video Wave 31',
            aliases: ['Video Demo'],
            courseId: 'wave31-video',
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

  const groupDirectory = new GroupDirectoryModule({
    dataRootPath,
    groupSeedFilePath,
  });
  const peopleMemory = new PeopleMemoryModule({
    peopleFilePath: join(dataRootPath, 'config', 'people.json'),
  });
  const mediaLibrary = new MediaLibraryModule({
    dataRootPath,
  });

  let latestSocket = null;
  const gateway = new BaileysWhatsAppGateway({
    enabled: true,
    autoConnect: true,
    authRootPath: join(sandboxPath, 'whatsapp-auth'),
    socketFactory: async () => {
      const socket = new FakeWave31Socket({
        groupJid,
      });
      latestSocket = socket;
      setTimeout(() => {
        socket.openSession();
      }, 0);
      return socket;
    },
    versionResolver: async () => ({
      version: [1, 0, 0],
    }),
  });

  webSocketGateway = new WebSocketGateway();
  whatsAppWorkspaceRuntime = new WhatsAppWorkspaceRuntime({
    gateway,
    adminConfig: {
      async getSettings() {
        return {
          whatsapp: {
            ...DEFAULT_ADMIN_SETTINGS.whatsapp,
            enabled: true,
            groupDiscoveryEnabled: true,
            conversationDiscoveryEnabled: true,
          },
        };
      },
    },
    groupDirectory,
    mediaLibrary,
    peopleMemory,
    uiEventPublisher: webSocketGateway.publisher,
  });

  await whatsAppWorkspaceRuntime.start();
  await delay(80);
  assert.ok(latestSocket, 'Expected fake socket to be created.');

  const sampleBinary = Uint8Array.from(Buffer.from('wave31-video-binary-sample-v1', 'utf8'));
  latestSocket.publishInboundVideo(sampleBinary);
  await delay(180);

  const storedAssets = await mediaLibrary.listAssets();
  assert.equal(storedAssets.length, 1);
  assert.equal(storedAssets[0]?.mediaType, 'video');
  assert.equal(storedAssets[0]?.sourceChatJid, groupJid);
  assert.equal(storedAssets[0]?.sourceMessageId, 'wamid.wave31.media.0001');
  assert.equal(storedAssets[0]?.caption, 'Video de teste para a wave 31.');
  assert.equal(storedAssets[0]?.fileSize, sampleBinary.byteLength);
  assert.equal(storedAssets[0]?.exists, true);

  httpServer = new FastifyHttpServer({
    modules: {
      adminConfig: {
        async getSettings() {
          return {
            ...DEFAULT_ADMIN_SETTINGS,
            updatedAt: new Date().toISOString(),
          };
        },
        async updateUiSettings() {
          return {
            ...DEFAULT_ADMIN_SETTINGS,
            updatedAt: new Date().toISOString(),
          };
        },
      },
      audienceRouting: {
        async listSenderAudienceRules() {
          return [];
        },
        async upsertSenderAudienceRule() {
          throw new Error('Not used in wave31 validation.');
        },
        async previewDistributionPlan() {
          throw new Error('Not used in wave31 validation.');
        },
      },
      groupDirectory,
      healthMonitor: {
        async getHealthSnapshot() {
          return {
            status: 'ok',
            checks: [],
            generatedAt: new Date().toISOString(),
          };
        },
        async getReadiness() {
          return {
            ready: true,
            status: 'ok',
          };
        },
      },
      hostLifecycle: {
        async enableStartWithSystem() {
          return undefined;
        },
        async disableStartWithSystem() {
          return undefined;
        },
        async getHostCompanionStatus() {
          return {
            hostId: 'wave31-host',
            auth: {
              path: '/tmp/auth.json',
              canonicalPath: '/tmp/auth.json',
              exists: true,
              sameAsCodexCanonical: true,
            },
            autostart: {
              enabled: false,
              serviceName: 'lume-hub-host.service',
              unitFilePath: '/tmp/lume-hub-host.service',
            },
            runtime: {
              lastHeartbeatAt: new Date().toISOString(),
              lastError: null,
              power: null,
              authRouter: null,
            },
          };
        },
      },
      instructionQueue: {
        async enqueueDistributionPlan() {
          throw new Error('Not used in wave31 validation.');
        },
        async listInstructions() {
          return [];
        },
        async retryInstruction() {
          throw new Error('Not used in wave31 validation.');
        },
      },
      mediaLibrary,
      peopleMemory,
      systemPower: {
        async getPowerStatus() {
          return {
            policy: {
              mode: 'normal',
            },
            inhibitorActive: false,
            activeLease: null,
            explanation: 'wave31 validation',
          };
        },
        async updatePowerPolicy() {
          return {
            policy: {
              mode: 'normal',
            },
            inhibitorActive: false,
            activeLease: null,
            explanation: 'wave31 validation',
          };
        },
      },
      watchdog: {
        async listIssues() {
          return [];
        },
        async resolveIssue() {
          return undefined;
        },
      },
      whatsappRuntime: whatsAppWorkspaceRuntime,
    },
    uiEventPublisher: webSocketGateway.publisher,
  });

  const apiClient = new FrontendApiClient(new InMemoryFrontendApiTransport(httpServer, webSocketGateway.publisher));
  const assetsFromApi = await apiClient.listMediaAssets();
  const assetFromApi = await apiClient.getMediaAsset(storedAssets[0].assetId);

  assert.equal(assetsFromApi.length, 1);
  assert.equal(assetFromApi.assetId, storedAssets[0].assetId);
  assert.equal(assetFromApi.sourceMessageId, 'wamid.wave31.media.0001');

  const port = await getFreePort();
  const address = await httpServer.listen({
    host: '127.0.0.1',
    port,
    staticSite: {
      rootPath: WEB_DIST_ROOT,
      bootConfig: {
        defaultMode: 'live',
        webSocketPath: '/ws',
      },
    },
    onServerCreated: async (server) => {
      webSocketGateway.attach(server, {
        path: '/ws',
      });
    },
  });

  const dom = await runChromeDump(`${address.origin}/media?mode=live`);
  assert.match(dom.stdout, /Biblioteca operacional/u);
  assert.match(dom.stdout, /Assets recentes/u);
  assert.match(dom.stdout, /Video de teste para a wave 31\./u);
  assert.match(dom.stdout, /wamid\.wave31\.media\.0001/u);
  assert.doesNotMatch(dom.stdout, /Algo falhou ao carregar esta pagina/u);

  console.log('validate-wave31: ok');
  console.log(`assetId=${storedAssets[0].assetId}`);
  console.log(`mediaRoute=${address.origin}/media?mode=live`);
} finally {
  await whatsAppWorkspaceRuntime?.stop().catch(() => undefined);
  await httpServer?.close().catch(() => undefined);
  await webSocketGateway?.close().catch(() => undefined);
  await rm(sandboxPath, { recursive: true, force: true });
}

async function getFreePort() {
  const server = createServer();

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => resolve(undefined));
      server.once('error', reject);
    });

    const address = server.address();
    assert.ok(address && typeof address === 'object' && typeof address.port === 'number');
    return address.port;
  } finally {
    await new Promise((resolve) => server.close(() => resolve(undefined)));
  }
}
