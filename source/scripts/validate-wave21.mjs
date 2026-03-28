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

async function runWave21Validation() {
  const fakeSocketRef = {
    current: null,
  };
  const fetchMock = createWave21FetchMock();
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave21-'));
  const webDistRootPath = fileURLToPath(new URL('../apps/lume-hub-web/dist/', import.meta.url));
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;

  try {
    const runtimeConfig = await seedWave21Sandbox({
      sandboxPath,
      httpPort,
      webDistRootPath,
      fakeSocketRef,
      fetchMock,
    });
    const bootstrap = new AppBootstrap({
      runtimeConfig,
    });

    await bootstrap.start();

    try {
      await waitUntilReady(`${baseUrl}/api/dashboard`);
      await waitUntil(() => Boolean(fakeSocketRef.current));

      const fakeSocket = fakeSocketRef.current;
      assert.ok(fakeSocket);
      fakeSocket.openSession();

      await waitUntil(async () => {
        const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
        return workspace.runtime.session.phase === 'open' && workspace.groups.length >= 1;
      });

      const codexModels = await readJson(`${baseUrl}/api/llm/models?refresh=true&providerId=codex-oauth`);
      assert.ok(codexModels.some((model) => model.providerId === 'codex-oauth' && model.modelId === 'gpt-5.4'));
      assert.ok(codexModels.some((model) => model.providerId === 'local-deterministic'));

      const authRouterStatus = await readJson(`${baseUrl}/api/settings/codex-auth-router`);
      assert.equal(authRouterStatus.currentSelection.accountId, 'canonical-live');
      assert.ok(authRouterStatus.accounts.find((account) => account.accountId === 'canonical-live')?.usage.successCount >= 1);

      const privateReplyAccepted = waitForWsEvent(
        `ws://127.0.0.1:${httpPort}/ws`,
        'conversation.reply.accepted',
        async () => {
          fakeSocket.publishPrivateIncoming('Ola, ajuda-me a organizar a aula de hoje.');
        },
      );
      const privateReplyEvent = await privateReplyAccepted;
      assert.equal(privateReplyEvent.payload.targetChatJid, fakeSocket.privateChatJid);

      await waitUntil(() => fakeSocket.sentMessages.length >= 1);
      const firstPrivateReply = fakeSocket.sentMessages.at(-1);
      assert.ok(firstPrivateReply);
      assert.equal(firstPrivateReply.chatJid, fakeSocket.privateChatJid);
      assert.match(firstPrivateReply.text, /Resposta Codex live/u);
      assert.equal(fetchMock.state.codexChatCalls.length >= 1, true);
      assert.equal(fetchMock.state.codexChatCalls.at(-1)?.model, 'gpt-5.4');

      const assistantContext = bootstrap.getRuntime().getContext().container.resolve('module:assistant-context');
      const privateHistory = await assistantContext.listChatHistory(fakeSocket.privateChatJid, 6);
      assert.ok(privateHistory.some((entry) => entry.role === 'user' && /organizar a aula/u.test(entry.text)));
      assert.ok(privateHistory.some((entry) => entry.role === 'assistant' && /Resposta Codex live/u.test(entry.text)));

      const sentCountBeforeReroute = fakeSocket.sentMessages.length;
      fakeSocket.publishGroupIncoming({
        text: 'Bom dia, consegues responder aqui sem eu te chamar?',
      });
      await waitUntil(() => fakeSocket.sentMessages.length > sentCountBeforeReroute);
      const reroutedReply = fakeSocket.sentMessages.at(-1);
      assert.ok(reroutedReply);
      assert.equal(reroutedReply.chatJid, fakeSocket.privateChatJid);
      assert.match(reroutedReply.text, /Resposta Codex live/u);

      const sentCountBeforeGroupReply = fakeSocket.sentMessages.length;
      fakeSocket.publishGroupIncoming({
        text: '@LumeHub faz um resumo curto da turma.',
        mentionSelf: true,
      });
      await waitUntil(() => fakeSocket.sentMessages.length > sentCountBeforeGroupReply);
      const groupReply = fakeSocket.sentMessages.at(-1);
      assert.ok(groupReply);
      assert.equal(groupReply.chatJid, fakeSocket.groupJid);
      assert.match(groupReply.text, /Resposta Codex live/u);

      const llmSettingsResponse = await fetch(`${baseUrl}/api/settings/llm`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          enabled: true,
          provider: 'openai-compat',
          model: 'gpt-4o-mini',
          streamingEnabled: false,
        }),
      });
      assert.equal(llmSettingsResponse.status, 200);

      const openAiCompatModels = await readJson(`${baseUrl}/api/llm/models?refresh=true&providerId=openai-compat`);
      assert.ok(openAiCompatModels.some((model) => model.providerId === 'openai-compat' && model.modelId === 'gpt-4o-mini'));

      const sentCountBeforeOpenAiReply = fakeSocket.sentMessages.length;
      fakeSocket.publishPrivateIncoming('Confirma por favor que o provider mudou.');
      await waitUntil(() => fakeSocket.sentMessages.length > sentCountBeforeOpenAiReply);
      const openAiReply = fakeSocket.sentMessages.at(-1);
      assert.ok(openAiReply);
      assert.equal(openAiReply.chatJid, fakeSocket.privateChatJid);
      assert.match(openAiReply.text, /Resposta OpenAI compat/u);
      assert.equal(fetchMock.state.openAiChatCalls.at(-1)?.model, 'gpt-4o-mini');

      for (const scenario of [
        {
          route: '/today?mode=live',
          expectedTexts: ['Hoje', 'Modo ligacao live', 'WhatsApp pronto'],
        },
        {
          route: '/assistant?mode=live',
          expectedTexts: ['Assistente', 'Provider: openai-compat', 'Model: gpt-4o-mini'],
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

      console.log(`Wave 21 validation passed on ${baseUrl}/assistant?mode=live`);
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
    this.selfJid = '351910000099@s.whatsapp.net';
    this.groupJid = '120363402446203704@g.us';
    this.groupLabel = 'EFA Programacao A';
    this.privateChatJid = '351910000001@s.whatsapp.net';
    this.privateChatLabel = 'Ana Formadora';
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

  publishGroupIncoming({
    text,
    mentionSelf = false,
  }) {
    this.ev.emit('messages.upsert', {
      messages: [
        {
          key: {
            id: `wamid.in.group.${String(++this.messageSequence).padStart(4, '0')}`,
            remoteJid: this.groupJid,
            participant: this.privateChatJid,
            fromMe: false,
          },
          messageTimestamp: Math.floor(Date.now() / 1000),
          pushName: this.privateChatLabel,
          message: {
            extendedTextMessage: {
              text,
              contextInfo: {
                ...(mentionSelf ? { mentionedJid: [this.selfJid] } : {}),
              },
            },
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

function createWave21FetchMock() {
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
        const userText = extractCodexUserText(body);
        const instructions = String(body.instructions ?? '');

        if (/Formato exato/u.test(instructions)) {
          return sseResponse(
            JSON.stringify({
              candidates: [
                {
                  title: 'Aula validada',
                  dateHint: '2026-03-30',
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
        const userText = extractOpenAiUserText(body);
        const systemText = extractOpenAiSystemText(body);

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

async function seedWave21Sandbox({
  sandboxPath,
  httpPort,
  webDistRootPath,
  fakeSocketRef,
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
      access_token: 'wave21-access-token',
      account_id: 'wave21-account-id',
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
      fakeSocketRef.current = socket;
      return socket;
    },
    llmFetch: fetchMock.fetchImpl,
    openAiCompatBaseUrl: 'https://mock-openai.local',
    openAiCompatApiKey: 'mock-openai-key',
    openAiCompatDefaultModel: 'gpt-4o-mini',
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
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

function extractCodexUserText(body) {
  return String(body.input?.[0]?.content?.[0]?.text ?? '');
}

function extractOpenAiUserText(body) {
  const userMessage = (body.messages ?? []).findLast?.((message) => message.role === 'user')
    ?? [...(body.messages ?? [])].reverse().find((message) => message.role === 'user');
  return String(userMessage?.content ?? '');
}

function extractOpenAiSystemText(body) {
  const systemMessage = (body.messages ?? []).find?.((message) => message.role === 'system');
  return String(systemMessage?.content ?? '');
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

async function waitForWsEvent(wsUrl, topic, trigger) {
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

async function runChromeDump(url) {
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

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

await runWave21Validation();
