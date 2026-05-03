import test from 'node:test';
import assert from 'node:assert/strict';

const { FastifyHttpServer } = await import(
  '../../packages/adapters/http-fastify/dist/adapters/http-fastify/src/public/index.js'
);

test('codex router exposes models and surfaces quota failures clearly', async () => {
  const refreshedProviderIds = [];
  const server = new FastifyHttpServer({
    modules: {
      adminConfig: {
        async getSettings() {
          return {
            commands: {
              assistantEnabled: true,
              schedulingEnabled: true,
              ownerTerminalEnabled: true,
              autoReplyEnabled: true,
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
              enabled: true,
              provider: 'codex-openai',
              model: 'gpt-5.4',
              streamingEnabled: true,
              openAiApiKey: 'test-openai-key',
            },
            ui: {
              codexRouterVisible: true,
              defaultNotificationRules: [],
            },
            alerts: {
              enabled: true,
              rules: [],
            },
            automations: {
              enabled: true,
              fireWindowMinutes: 5,
              definitions: [],
            },
            updatedAt: '2026-05-03T08:00:00.000Z',
          };
        },
      },
      llmOrchestrator: {
        listModels() {
          return [
            {
              providerId: 'codex-openai',
              modelId: 'gpt-5.5',
              label: 'gpt-5.5',
              capabilities: {
                chat: true,
                scheduling: true,
                weeklyPlanning: true,
                streaming: true,
              },
            },
            {
              providerId: 'codex-openai',
              modelId: 'gpt-5.4',
              label: 'gpt-5.4',
              capabilities: {
                chat: true,
                scheduling: true,
                weeklyPlanning: true,
                streaming: true,
              },
            },
            {
              providerId: 'codex-openai',
              modelId: 'gpt-5.4-mini',
              label: 'gpt-5.4-mini',
              capabilities: {
                chat: true,
                scheduling: true,
                weeklyPlanning: true,
                streaming: true,
              },
            },
            {
              providerId: 'codex-openai',
              modelId: 'gpt-5.3-codex',
              label: 'gpt-5.3-codex',
              capabilities: {
                chat: true,
                scheduling: true,
                weeklyPlanning: true,
                streaming: true,
              },
            },
            {
              providerId: 'codex-openai',
              modelId: 'gpt-5.2',
              label: 'gpt-5.2',
              capabilities: {
                chat: true,
                scheduling: true,
                weeklyPlanning: true,
                streaming: true,
              },
            },
            {
              providerId: 'codex-openai',
              modelId: 'gpt-oss-120b',
              label: 'gpt-oss-120b',
              capabilities: {
                chat: true,
                scheduling: true,
                weeklyPlanning: true,
                streaming: true,
              },
            },
            {
              providerId: 'codex-openai',
              modelId: 'gpt-oss-20b',
              label: 'gpt-oss-20b',
              capabilities: {
                chat: true,
                scheduling: true,
                weeklyPlanning: true,
                streaming: true,
              },
            },
            {
              providerId: 'codex-openai',
              modelId: 'codex-auto-review',
              label: 'codex-auto-review',
              capabilities: {
                chat: true,
                scheduling: true,
                weeklyPlanning: true,
                streaming: true,
              },
            },
            {
              providerId: 'openai-compat',
              modelId: 'gpt-4o-mini',
              label: 'gpt-4o-mini',
              capabilities: {
                chat: true,
                scheduling: true,
                weeklyPlanning: true,
                streaming: false,
              },
            },
          ];
        },
        async refreshModels(providerId) {
          refreshedProviderIds.push(providerId ?? null);
        },
        async chat() {
          throw new Error('OPENAI_CODEX_OAUTH error 429: The usage limit has been reached');
        },
      },
    },
  });

  const headers = {
    authorization: 'Bearer test-openai-key',
  };

  const models = await server.inject({
    method: 'GET',
    path: '/api/openai/v1/models',
    headers,
  });

  assert.equal(models.statusCode, 200);
  assert.equal(models.body.object, 'list');
  assert.deepEqual(
    models.body.data.map((entry) => entry.id),
    ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.2', 'gpt-oss-120b', 'gpt-oss-20b', 'codex-auto-review'],
  );
  assert.deepEqual(refreshedProviderIds, ['codex-openai']);

  const chat = await server.inject({
    method: 'POST',
    path: '/api/openai/v1/chat/completions',
    headers,
    body: {
      model: 'gpt-5.4-mini',
      messages: [
        {
          role: 'user',
          content: 'Olá',
        },
      ],
    },
  });

  assert.equal(chat.statusCode, 429);
  assert.match(chat.body.error, /quota/i);
});

test('codex router streams openai chat completions when requested', async () => {
  const server = new FastifyHttpServer({
    modules: {
      adminConfig: {
        async getSettings() {
          return {
            commands: {
              assistantEnabled: true,
              schedulingEnabled: true,
              ownerTerminalEnabled: true,
              autoReplyEnabled: true,
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
              enabled: true,
              provider: 'codex-openai',
              model: 'gpt-5.4',
              streamingEnabled: true,
              openAiApiKey: 'test-openai-key',
            },
            ui: {
              codexRouterVisible: true,
              defaultNotificationRules: [],
            },
            alerts: {
              enabled: true,
              rules: [],
            },
            automations: {
              enabled: true,
              fireWindowMinutes: 5,
              definitions: [],
            },
            updatedAt: '2026-05-03T08:00:00.000Z',
          };
        },
      },
      llmOrchestrator: {
        listModels() {
          return [
            {
              providerId: 'codex-openai',
              modelId: 'gpt-5.4-mini',
              label: 'gpt-5.4-mini',
              capabilities: {
                chat: true,
                scheduling: true,
                weeklyPlanning: true,
                streaming: true,
              },
            },
          ];
        },
        async refreshModels() {},
        async chat() {
          return {
            runId: 'run-stream-ok',
            providerId: 'codex-openai',
            modelId: 'gpt-5.4-mini',
            text: 'OK',
          };
        },
      },
    },
  });

  const address = await server.listen({
    host: '127.0.0.1',
    port: 0,
  });

  try {
    const response = await fetch(`${address.origin}/api/openai/v1/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-openai-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        stream: true,
        messages: [
          {
            role: 'user',
            content: 'Olá',
          },
        ],
      }),
    });

    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
    assert.match(body, /data: .*"chat\.completion\.chunk"/);
    assert.match(body, /"content":"OK"/);
    assert.match(body, /\[DONE\]/);
  } finally {
    await server.close();
  }
});
