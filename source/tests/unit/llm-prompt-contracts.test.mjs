import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const {
  buildWaNotifyChatInstructions,
  buildWaNotifyScheduleInstructions,
  buildWaNotifyStorageReferenceInstructions,
  buildWaNotifyWeeklyPlanningInstructions,
} = await import('../../packages/modules/llm-orchestrator/dist/modules/llm-orchestrator/src/public/index.js');
const { CodexOauthLlmProvider } = await import(
  '../../packages/adapters/llm-codex-oauth/dist/adapters/llm-codex-oauth/src/public/index.js'
);
const { OpenAiCompatLlmProvider } = await import(
  '../../packages/adapters/llm-openai-compat/dist/adapters/llm-openai-compat/src/public/index.js'
);

test('WA-Notify LLM prompt contracts are available in LumeHub', () => {
  const chat = buildWaNotifyChatInstructions();
  const schedule = buildWaNotifyScheduleInstructions();
  const weekly = buildWaNotifyWeeklyPlanningInstructions();
  const storage = buildWaNotifyStorageReferenceInstructions();

  assert.match(chat, /humor leve/u);
  assert.match(chat, /Portugues de Portugal/u);
  assert.match(chat, /nunca deve ser impressa/u);

  assert.match(schedule, /Regras VC/u);
  assert.match(schedule, /AS -/u);
  assert.match(schedule, /Nao inventes JIDs/u);
  assert.match(schedule, /Plano estruturado desta semana/u);

  assert.match(weekly, /prompts semanais autonomos/u);
  assert.match(weekly, /datas absolutas/u);

  assert.match(storage, /eventAt determina a semana ISO/u);
  assert.match(storage, /nao deves tentar escrever ficheiros legacy/u);
});

test('Codex OAuth provider applies WA-Notify chat prompt and group instructions', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-llm-prompt-'));
  const authFilePath = join(sandboxPath, 'auth.json');
  const calls = [];

  try {
    await writeFile(
      authFilePath,
      JSON.stringify({
        tokens: {
          access_token: 'test-access-token',
          account_id: 'account-test',
        },
      }),
      'utf8',
    );

    const provider = new CodexOauthLlmProvider({
      authFilePath,
      fetchImpl: async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url !== 'https://chatgpt.com/backend-api/codex/responses') {
          return new Response(JSON.stringify({ error: { message: `Unexpected URL ${url}` } }), { status: 404 });
        }

        const body = JSON.parse(String(init.body ?? '{}'));
        calls.push(body);

        return new Response('data: {"type":"response.output_text.done","text":"ok"}\n\ndata: [DONE]\n\n', {
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
          },
        });
      },
    });

    await provider.chat({
      text: 'E a aula de hoje?',
      intent: 'casual_chat',
      memoryScope: {
        scope: 'group',
        groupJid: '120363@test',
        groupLabel: 'CET Ciberseguranca',
        instructionsSource: 'llm_instructions',
        instructionsApplied: true,
        instructionsContent: 'Responder curto e confirmar quando houver troca de sala.',
        knowledgeSnippetCount: 0,
        knowledgeDocuments: [],
      },
    });

    assert.equal(calls.length, 1);
    assert.match(String(calls[0].instructions ?? ''), /humor leve/u);
    assert.match(String(calls[0].instructions ?? ''), /Regra VC para aulas/u);
    assert.match(String(calls[0].input?.[0]?.content?.[0]?.text ?? ''), /Responder curto e confirmar/u);
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

test('OpenAI compatible provider applies WA-Notify schedule and weekly prompt contracts', async () => {
  const calls = [];
  const provider = new OpenAiCompatLlmProvider({
    apiKey: 'test-api-key',
    baseUrl: 'https://openai.example.test',
    fetchImpl: async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.toString();
      const body = JSON.parse(String(init.body ?? '{}'));
      calls.push({ url, body });

      if (String(body.messages?.[0]?.content ?? '').includes('"candidates"')) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    candidates: [
                      {
                        title: 'VC7',
                        dateHint: '2026-04-22',
                        timeHint: '16:00',
                        confidence: 'high',
                        notes: ['operation=create'],
                      },
                    ],
                    notes: ['ok'],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  weekId: '2026-W17',
                  prompts: ['Preparar so a semana 2026-W17 com datas absolutas.'],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  await provider.parseSchedules({
    text: 'Cria a VC7 amanha as 16:00.',
    memoryScope: {
      scope: 'group',
      groupJid: '120363@test',
      groupLabel: 'Familia GPC',
      instructionsSource: 'llm_instructions',
      instructionsApplied: true,
      instructionsContent: 'Nunca criar fecho de teste sem pedido explicito.',
      knowledgeSnippetCount: 0,
      knowledgeDocuments: [],
    },
  });
  await provider.planWeeklyPrompts({
    weekId: '2026-W17',
    requestedCount: 1,
    items: [{ title: 'VC7', dueAt: '2026-04-22T16:00:00+01:00', groupLabel: 'Familia GPC' }],
  });

  assert.equal(calls.length, 2);
  assert.match(String(calls[0].body.messages?.[0]?.content ?? ''), /Regras VC/u);
  assert.match(String(calls[0].body.messages?.[0]?.content ?? ''), /eventAt determina a semana ISO/u);
  assert.match(String(calls[0].body.messages?.[1]?.content ?? ''), /Nunca criar fecho/u);
  assert.match(String(calls[1].body.messages?.[0]?.content ?? ''), /prompts semanais autonomos/u);
});
