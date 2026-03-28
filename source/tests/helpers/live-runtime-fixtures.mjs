import { EventEmitter } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { WebSocket } from 'ws';

export const chromeCommand = 'google-chrome';

export class FakeBaileysSocket {
  constructor(config = {}) {
    this.ev = new EventEmitter();
    this.user = undefined;
    this.selfJid = config.selfJid ?? '351910000099@s.whatsapp.net';
    this.groupJid = config.groupJid ?? '120363402446203704@g.us';
    this.groupLabel = config.groupLabel ?? 'EFA Programacao A';
    this.privateChatJid = config.privateChatJid ?? '351910000001@s.whatsapp.net';
    this.privateChatLabel = config.privateChatLabel ?? 'Ana Formadora';
    this.sentMessages = [];
    this.messageSequence = 0;
  }

  ev;
  user;
  selfJid;
  groupJid;
  groupLabel;
  privateChatJid;
  privateChatLabel;
  sentMessages;
  messageSequence;

  publishQr(value = 'lumehub-live-qr') {
    this.ev.emit('connection.update', {
      connection: 'connecting',
    });
    this.ev.emit('connection.update', {
      qr: value,
    });
  }

  openSession() {
    this.user = {
      id: this.selfJid,
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
        unreadCount: 1,
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
          {
            id: this.selfJid,
          },
        ],
      },
    ]);
  }

  closeWithReason(statusCode = 500, message = 'Simulated transient disconnect') {
    this.ev.emit('connection.update', {
      connection: 'close',
      lastDisconnect: {
        error: {
          statusCode,
          message,
        },
      },
    });
  }

  publishPrivateIncoming(text) {
    this.ev.emit('messages.upsert', {
      messages: [
        {
          key: {
            id: `wamid.in.private.${String(++this.messageSequence).padStart(4, '0')}`,
            remoteJid: this.privateChatJid,
            participant: this.privateChatJid,
            fromMe: false,
          },
          messageTimestamp: Math.floor(Date.now() / 1000),
          pushName: this.privateChatLabel,
          message: {
            conversation: text,
          },
        },
      ],
    });
  }

  async sendMessage(jid, content, options = {}) {
    const messageId = options.messageId ?? `wamid.fake.${String(++this.messageSequence).padStart(4, '0')}`;

    this.sentMessages.push({
      messageId,
      chatJid: jid,
      text: content.text,
    });

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
          {
            id: this.selfJid,
          },
        ],
      },
    };
  }

  async logout() {}

  end() {}
}

export class FakeSocketCoordinator {
  constructor(config = {}) {
    this.config = config;
    this.sockets = [];
  }

  config;
  sockets;

  createSocket() {
    const socket = new FakeBaileysSocket(this.config);
    this.sockets.push(socket);
    return socket;
  }

  get latestSocket() {
    return this.sockets.at(-1) ?? null;
  }
}

export function createLiveFetchMock() {
  const state = {
    codexChatCalls: [],
    openAiChatCalls: [],
    codexModelCalls: 0,
    openAiModelCalls: 0,
  };

  return {
    state,
    fetchImpl: async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.startsWith('https://chatgpt.com/backend-api/codex/models')) {
        state.codexModelCalls += 1;
        return jsonResponse({
          models: [
            {
              slug: 'gpt-5.4',
              priority: 1,
              supported_in_api: true,
            },
            {
              slug: 'gpt-5.4-mini',
              priority: 2,
              supported_in_api: true,
            },
          ],
        });
      }

      if (url === 'https://chatgpt.com/backend-api/codex/responses') {
        const body = JSON.parse(String(init.body ?? '{}'));
        state.codexChatCalls.push(body);
        const userText = String(body.input?.[0]?.content?.[0]?.text ?? '');
        const instructions = String(body.instructions ?? '');

        if (/Formato exato/u.test(instructions)) {
          return sseResponse(
            JSON.stringify({
              candidates: [
                {
                  title: 'Aula validada',
                  dateHint: '2026-03-27',
                  timeHint: '18:30',
                  confidence: 'high',
                  notes: ['extraido do mock'],
                },
              ],
              notes: ['mock'],
            }),
          );
        }

        return sseResponse(`Resposta Codex live: ${userText.slice(0, 80)}`);
      }

      if (url.endsWith('/v1/models')) {
        state.openAiModelCalls += 1;
        return jsonResponse({
          data: [
            { id: 'gpt-4o-mini' },
            { id: 'gpt-4.1-mini' },
          ],
        });
      }

      if (url.endsWith('/v1/chat/completions')) {
        const body = JSON.parse(String(init.body ?? '{}'));
        state.openAiChatCalls.push(body);
        const userMessage = (body.messages ?? []).findLast?.((message) => message.role === 'user')
          ?? [...(body.messages ?? [])].reverse().find((message) => message.role === 'user');
        const systemMessage = (body.messages ?? []).find?.((message) => message.role === 'system');
        const userText = String(userMessage?.content ?? '');
        const systemText = String(systemMessage?.content ?? '');

        if (/Formato exato/u.test(systemText)) {
          return jsonResponse({
            id: `chatcmpl-${state.openAiChatCalls.length}`,
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    prompts: ['Resumo semanal pronto', 'Confirma os grupos para esta semana'],
                    weekId: '2026-W13',
                  }),
                },
              },
            ],
          });
        }

        return jsonResponse({
          id: `chatcmpl-${state.openAiChatCalls.length}`,
          choices: [
            {
              message: {
                content: `Resposta OpenAI compat: ${userText.slice(0, 80)}`,
              },
            },
          ],
        });
      }

      return jsonResponse(
        {
          error: {
            message: `Unhandled mock fetch URL: ${url}`,
          },
        },
        404,
      );
    },
  };
}

export async function seedLiveRuntimeSandbox({
  sandboxPath,
  httpPort,
  webDistRootPath,
  socketCoordinator,
  fetchMock,
}) {
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
  const backendRuntimeStateFilePath = join(runtimeRootPath, 'backend-runtime-state.json');
  const codexAuthFile = join(runtimeRootPath, 'auth.json');
  const versionFilePath = join(runtimeRootPath, 'version.json');
  const systemdUserPath = join(runtimeRootPath, 'systemd-user');

  await mkdir(configRootPath, { recursive: true });
  await mkdir(runtimeRootPath, { recursive: true });

  await writeJson(groupSeedFilePath, {
    schemaVersion: 1,
    groups: [],
  });
  await writeJson(catalogFilePath, {
    schemaVersion: 1,
    courses: [],
    disciplines: [],
  });
  await writeJson(peopleFilePath, {
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
        createdAt: '2026-03-28T10:00:00.000Z',
        updatedAt: '2026-03-28T10:00:00.000Z',
      },
    ],
    notes: [],
  });
  await writeJson(rulesFilePath, {
    schemaVersion: 1,
    rules: [],
  });
  await writeJson(queueFilePath, {
    schemaVersion: 1,
    instructions: [],
  });
  await writeJson(settingsFilePath, {
    schemaVersion: 1,
    commands: {
      assistantEnabled: true,
      schedulingEnabled: true,
      ownerTerminalEnabled: true,
      autoReplyEnabled: true,
      directRepliesEnabled: false,
      allowPrivateAssistant: true,
      authorizedGroupJids: ['120363402446203704@g.us'],
      authorizedPrivateJids: [],
    },
    whatsapp: {
      enabled: true,
      sharedAuthWithCodex: true,
      groupDiscoveryEnabled: true,
      conversationDiscoveryEnabled: true,
    },
    llm: {
      enabled: true,
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
    updatedAt: '2026-03-28T10:00:00.000Z',
  });
  await writeJson(codexAuthFile, {
    auth_mode: 'chatgpt',
    tokens: {
      access_token: 'wave23-access-token',
      account_id: 'wave23-account-id',
    },
  });
  await writeJson(versionFilePath, {
    version: '0.116.0',
  });

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
    backendRuntimeStateFilePath,
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
    whatsappSocketFactory: async () => socketCoordinator.createSocket(),
    llmFetch: fetchMock.fetchImpl,
    openAiCompatBaseUrl: 'https://mock-openai.local',
    openAiCompatApiKey: 'mock-openai-key',
    openAiCompatDefaultModel: 'gpt-4o-mini',
  };
}

export async function createLiveSandboxPath(prefix = 'lume-hub-live-') {
  const { mkdtemp } = await import('node:fs/promises');
  return mkdtemp(join(tmpdir(), prefix));
}

export async function reservePort() {
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

export async function writeJson(filePath, value) {
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

export async function waitUntilReady(url) {
  await waitUntil(async () => {
    try {
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  });
}

export async function waitUntil(check, timeoutMs = 10_000, intervalMs = 120) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await check()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timed out while waiting for validation condition.');
}

export async function readJson(url) {
  const response = await fetch(url);
  if (response.status !== 200) {
    throw new Error(`Unexpected status ${response.status} for GET ${url}: ${await response.text()}`);
  }
  return response.json();
}

export async function requestJson(url, options = {}) {
  const response = await writeJsonRequest(url, options.method ?? 'GET', options.body);
  if (response.status !== 200) {
    throw new Error(
      `Unexpected status ${response.status} for ${options.method ?? 'GET'} ${url}: ${await response.text()}`,
    );
  }
  return response.json();
}

export async function writeJsonRequest(url, method, body) {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : {
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function waitForWsEvent(wsUrl, topic, trigger) {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out while waiting for WebSocket event '${topic}'.`));
    }, 10_000);

    socket.on('message', (data) => {
      try {
        const parsed = JSON.parse(String(data));

        if (parsed?.topic === topic) {
          clearTimeout(timeout);
          socket.close();
          resolve(parsed);
        }
      } catch {}
    });

    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    socket.once('open', () => {
      Promise.resolve(trigger()).catch((error) => {
        clearTimeout(timeout);
        socket.close();
        reject(error);
      });
    });
  });
}

export async function runChromeDump(url) {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      chromeCommand,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--virtual-time-budget=12000',
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
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Chrome headless exited with code ${code}: ${stderr}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

export function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function sseResponse(text) {
  return new Response(`data: ${JSON.stringify({ type: 'response.output_text.done', text })}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
    },
  });
}
