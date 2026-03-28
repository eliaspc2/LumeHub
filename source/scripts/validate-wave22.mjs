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

async function runWave22Validation() {
  const fakeSocketRef = {
    current: null,
  };
  const fetchMock = createWave22FetchMock();
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave22-'));
  const webDistRootPath = fileURLToPath(new URL('../apps/lume-hub-web/dist/', import.meta.url));
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;

  try {
    const runtimeConfig = await seedWave22Sandbox({
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
        const groups = await readJson(`${baseUrl}/api/groups`);
        return (
          workspace.runtime.session.phase === 'open'
          && workspace.groups.length >= 1
          && groups.some((group) => group.groupJid === fakeSocket.groupJid)
        );
      });

      const status = await readJson(`${baseUrl}/api/status`);
      assert.equal(status.readiness.ready, true);
      assert.ok(status.generatedAt);
      assert.equal(status.whatsapp.connected, true);
      assert.equal(status.whatsapp.discoveredGroups >= 1, true);

      const groupRuleResponse = await writeJsonRequest(`${baseUrl}/api/routing/rules`, 'POST', {
        ruleId: 'rule-app-owner-live',
        personId: 'person-app-owner',
        identifiers: [],
        targetGroupJids: [fakeSocket.groupJid],
        targetCourseIds: [],
        targetDisciplineCodes: [],
        enabled: true,
        requiresConfirmation: true,
        notes: 'Campanha live para testar a fila operacional.',
      });
      assert.equal(groupRuleResponse.status, 200);
      const createdRule = await groupRuleResponse.json();
      assert.equal(createdRule.ruleId, 'rule-app-owner-live');

      const scheduleCreatedEvent = await waitForWsEvent(
        `ws://127.0.0.1:${httpPort}/ws`,
        'schedules.updated',
        async () =>
          requestJson(`${baseUrl}/api/schedules`, {
            method: 'POST',
            body: {
              groupJid: fakeSocket.groupJid,
              title: 'Sessao de apoio live',
              dayLabel: 'sexta-feira',
              startTime: '18:30',
              durationMinutes: 60,
              notes: 'Levar projetor e confirmar sala 2.',
              timeZone: 'Europe/Lisbon',
            },
          }),
      );
      assert.equal(scheduleCreatedEvent.payload.groupJid, fakeSocket.groupJid);

      const createdSchedule = await readJson(`${baseUrl}/api/schedules?groupJid=${encodeURIComponent(fakeSocket.groupJid)}`);
      assert.equal(createdSchedule.events.length, 1);
      assert.equal(createdSchedule.diagnostics.eventCount, 1);
      assert.equal(createdSchedule.events[0].title, 'Sessao de apoio live');
      assert.equal(createdSchedule.events[0].durationMinutes, 60);
      assert.equal(createdSchedule.events[0].notificationRuleLabels.length >= 2, true);
      assert.equal(createdSchedule.events[0].notifications.total >= 2, true);

      const scheduleId = createdSchedule.events[0].eventId;
      const updatedSchedule = await requestJson(`${baseUrl}/api/schedules/${scheduleId}`, {
        method: 'PATCH',
        body: {
          groupJid: fakeSocket.groupJid,
          title: 'Sessao de apoio live atualizada',
          dayLabel: 'sexta-feira',
          startTime: '19:00',
          durationMinutes: 75,
          notes: 'Sala 3 confirmada e material testado.',
          timeZone: 'Europe/Lisbon',
        },
      });
      assert.equal(updatedSchedule.title, 'Sessao de apoio live atualizada');
      assert.equal(updatedSchedule.durationMinutes, 75);
      assert.equal(updatedSchedule.startTime, '19:00');

      const plannerSnapshot = await readJson(`${baseUrl}/api/schedules`);
      assert.equal(plannerSnapshot.events.some((event) => event.eventId === scheduleId), true);
      assert.equal(
        plannerSnapshot.events.some((event) => event.title === 'Sessao de apoio live atualizada'),
        true,
      );

      const preview = await requestJson(`${baseUrl}/api/routing/preview`, {
        method: 'POST',
        body: {
          sourceMessageId: 'wamid.wave22.preview.001',
          personId: 'person-app-owner',
          messageText: 'A aula de hoje passa para a sala 3.',
        },
      });
      assert.equal(preview.targetCount, 1);
      assert.deepEqual(preview.matchedRuleIds, ['rule-app-owner-live']);
      assert.equal(preview.targets[0].groupJid, fakeSocket.groupJid);

      const distributionCreatedEvent = await waitForWsEvent(
        `ws://127.0.0.1:${httpPort}/ws`,
        'routing.distribution.created',
        async () =>
          requestJson(`${baseUrl}/api/routing/distributions`, {
            method: 'POST',
            body: {
              sourceMessageId: 'wamid.wave22.execution.001',
              personId: 'person-app-owner',
              messageText: 'A aula de hoje passa para a sala 3.',
              mode: 'confirmed',
            },
          }),
      );
      assert.equal(distributionCreatedEvent.payload.status, 'queued');

      const queue = await readJson(`${baseUrl}/api/instruction-queue`);
      assert.equal(queue.length, 1);
      assert.equal(queue[0].status, 'queued');
      assert.equal(queue[0].actions.length, 1);
      assert.equal(queue[0].actions[0].targetGroupJid, fakeSocket.groupJid);

      const distributionSummaries = await readJson(`${baseUrl}/api/routing/distributions`);
      assert.equal(distributionSummaries.length, 1);
      assert.equal(distributionSummaries[0].targetGroupJids.includes(fakeSocket.groupJid), true);

      const manualChat = await requestJson(`${baseUrl}/api/llm/chat`, {
        method: 'POST',
        body: {
          text: 'Resume o estado atual do grupo.',
          intent: 'local_summary_request',
          contextSummary: ['Grupo descoberto e pronto para uso live.'],
          domainFacts: ['Existe um agendamento guardado para sexta-feira.', 'Ha uma distribuicao na fila.'],
        },
      });
      assert.equal(manualChat.providerId, 'codex-oauth');
      assert.match(manualChat.text, /Resposta Codex live/u);

      const replyAcceptedEvent = await waitForWsEvent(
        `ws://127.0.0.1:${httpPort}/ws`,
        'conversation.reply.accepted',
        async () => {
          fakeSocket.publishPrivateIncoming('Preciso de um resumo do que ficou marcado para esta semana.');
        },
      );
      assert.equal(replyAcceptedEvent.payload.targetChatJid, fakeSocket.privateChatJid);

      await waitUntil(() => fakeSocket.sentMessages.length >= 1);
      const conversationReply = fakeSocket.sentMessages.at(-1);
      assert.ok(conversationReply);
      assert.equal(conversationReply.chatJid, fakeSocket.privateChatJid);
      assert.match(conversationReply.text, /Resposta Codex live/u);

      const sentBeforeDirectSend = fakeSocket.sentMessages.length;
      const directSendAccepted = await waitForWsEvent(
        `ws://127.0.0.1:${httpPort}/ws`,
        'send.accepted',
        async () =>
          requestJson(`${baseUrl}/api/send`, {
            method: 'POST',
            body: {
              chatJid: fakeSocket.privateChatJid,
              text: 'Mensagem direta live para validar o endpoint send.',
            },
          }),
      );
      assert.equal(directSendAccepted.payload.chatJid, fakeSocket.privateChatJid);

      await waitUntil(() => fakeSocket.sentMessages.length > sentBeforeDirectSend);
      const lastSent = fakeSocket.sentMessages.at(-1);
      assert.ok(lastSent);
      assert.equal(lastSent.chatJid, fakeSocket.privateChatJid);
      assert.match(lastSent.text, /Mensagem direta live/u);

      const llmLogs = await readJson(`${baseUrl}/api/logs/llm?limit=10`);
      assert.equal(llmLogs.length >= 2, true);
      assert.equal(llmLogs.some((entry) => entry.operation === 'chat'), true);
      assert.equal(llmLogs.some((entry) => entry.providerId === 'codex-oauth'), true);

      const conversationLogs = await readJson(`${baseUrl}/api/logs/conversations?limit=10`);
      assert.equal(conversationLogs.length >= 1, true);
      assert.equal(conversationLogs.some((entry) => entry.chatJid === fakeSocket.privateChatJid), true);
      assert.equal(conversationLogs.some((entry) => entry.replyMode), true);

      for (const scenario of [
        {
          route: '/today?mode=live',
          expectedTexts: ['Hoje', 'Distribuicoes e ritmo de trabalho', 'Host companion'],
        },
        {
          route: '/week?mode=live',
          expectedTexts: ['Criar agendamento', 'Agenda live desta semana', 'Sessao de apoio live atualizada'],
        },
        {
          route: '/distributions?mode=live',
          expectedTexts: ['Passo 1. Preparar a distribuicao', 'Campanha live para testar a fila operacional', 'Distribuicoes recentes'],
        },
        {
          route: '/assistant?mode=live',
          expectedTexts: ['Assistente', 'Provider: codex-oauth', 'Runs LLM recentes', 'Auditoria conversacional'],
        },
      ]) {
        const { stdout, stderr } = await runChromeDump(`${baseUrl}${scenario.route}`);

        for (const expectedText of scenario.expectedTexts) {
          assert.match(stdout, new RegExp(escapeForRegExp(expectedText), 'u'));
        }

        assert.doesNotMatch(stderr, /(TypeError|ReferenceError|Uncaught|SEVERE)/u);
        assert.doesNotMatch(stdout, /Algo falhou ao carregar esta pagina/u);
      }

      const deletedSchedule = await requestJson(
        `${baseUrl}/api/schedules/${scheduleId}?groupJid=${encodeURIComponent(fakeSocket.groupJid)}`,
        {
          method: 'DELETE',
        },
      );
      assert.equal(deletedSchedule.deleted, true);

      const plannerAfterDelete = await readJson(`${baseUrl}/api/schedules?groupJid=${encodeURIComponent(fakeSocket.groupJid)}`);
      assert.equal(plannerAfterDelete.events.length, 0);

      console.log(`Wave 22 validation passed on ${baseUrl}/week?mode=live`);
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

function createWave22FetchMock() {
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

async function seedWave22Sandbox({
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
      access_token: 'wave22-access-token',
      account_id: 'wave22-account-id',
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
  if (response.status !== 200) {
    throw new Error(`Unexpected status ${response.status} for GET ${url}: ${await response.text()}`);
  }
  return response.json();
}

async function requestJson(url, options = {}) {
  const response = await writeJsonRequest(url, options.method ?? 'GET', options.body);
  if (response.status !== 200) {
    throw new Error(
      `Unexpected status ${response.status} for ${options.method ?? 'GET'} ${url}: ${await response.text()}`,
    );
  }
  return response.json();
}

async function writeJsonRequest(url, method, body) {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : {
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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

await runWave22Validation();
