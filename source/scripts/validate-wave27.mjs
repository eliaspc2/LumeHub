import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runChromeDump } from '../tests/helpers/live-runtime-fixtures.mjs';

const { AssistantContextModule } = await import(
  '../packages/modules/assistant-context/dist/modules/assistant-context/src/public/index.js'
);
const { GroupDirectoryModule } = await import(
  '../packages/modules/group-directory/dist/modules/group-directory/src/public/index.js'
);
const { GroupKnowledgeModule } = await import(
  '../packages/modules/group-knowledge/dist/modules/group-knowledge/src/public/index.js'
);
const { FastifyHttpServer } = await import(
  '../packages/adapters/http-fastify/dist/adapters/http-fastify/src/public/index.js'
);

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIST_ROOT = resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'dist');
const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave27-'));
const dataRootPath = join(sandboxPath, 'data');
const groupSeedFilePath = join(sandboxPath, 'group-seed.json');

let server = null;

try {
  const groupA = '120363400000000201@g.us';
  const groupB = '120363400000000202@g.us';
  await writeFile(
    groupSeedFilePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        groups: [
          {
            groupJid: groupA,
            preferredSubject: 'Turma Ballet A',
            aliases: ['Ballet Iniciacao'],
            courseId: 'ballet-a',
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
            preferredSubject: 'Turma Contemporaneo B',
            aliases: ['Contemporaneo'],
            courseId: 'contemp-b',
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
  const groupKnowledge = new GroupKnowledgeModule({
    dataRootPath,
    groupDirectory,
  });
  const assistantContext = new AssistantContextModule({
    dataRootPath,
    groupDirectory,
    groupKnowledge,
  });

  server = new FastifyHttpServer({
    modules: {
      adminConfig: {
        async getSettings() {
          return {
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
              enabled: true,
              provider: 'codex-oauth',
              model: 'gpt-5.4',
              streamingEnabled: true,
            },
            ui: {
              defaultNotificationRules: [],
            },
            updatedAt: null,
          };
        },
        async updateUiSettings(update) {
          return update;
        },
      },
      assistantContext,
      audienceRouting: {
        async listSenderAudienceRules() {
          return [];
        },
        async upsertSenderAudienceRule() {
          throw new Error('Not used in wave27 validation.');
        },
        async previewDistributionPlan() {
          throw new Error('Not used in wave27 validation.');
        },
      },
      groupDirectory,
      groupKnowledge,
      healthMonitor: {
        async getHealthSnapshot() {
          return {};
        },
        async getReadiness() {
          return { ready: true, status: 'healthy' };
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
          return {};
        },
      },
      instructionQueue: {
        async enqueueDistributionPlan() {
          throw new Error('Not used in wave27 validation.');
        },
        async listInstructions() {
          return [];
        },
        async retryInstruction() {
          throw new Error('Not used in wave27 validation.');
        },
      },
      systemPower: {
        async getPowerStatus() {
          return {};
        },
        async updatePowerPolicy() {
          return {};
        },
      },
      watchdog: {
        async listIssues() {
          return [];
        },
        async resolveIssue() {
          return null;
        },
      },
    },
  });

  const groups = await expectOk(server.inject({ method: 'GET', path: '/api/groups' }));
  assert.equal(groups.length, 2);

  const instructions = await expectOk(
    server.inject({
      method: 'PUT',
      path: `/api/groups/${encodeURIComponent(groupA)}/llm-instructions`,
      body: {
        content: '# Instrucoes\n\nNesta turma, Aula 1 refere-se ao bloco tecnico base.\n',
      },
    }),
  );
  assert.equal(instructions.source, 'llm_instructions');
  assert.match(instructions.content, /Aula 1 refere-se ao bloco tecnico base/i);

  const knowledgeA = await expectOk(
    server.inject({
      method: 'POST',
      path: `/api/groups/${encodeURIComponent(groupA)}/knowledge/documents`,
      body: {
        documentId: 'aula-1-ballet',
        filePath: 'aulas/aula-1.md',
        title: 'Aula 1 de Ballet',
        summary: 'Nesta turma, Aula 1 e a parte tecnica base.',
        aliases: ['Aula 1'],
        tags: ['ballet', 'aula'],
        enabled: true,
        content: '# Aula 1\n\nA Aula 1 desta turma e a parte tecnica base e usa a sala 2.\n',
      },
    }),
  );
  assert.equal(knowledgeA.documentId, 'aula-1-ballet');

  await expectOk(
    server.inject({
      method: 'POST',
      path: `/api/groups/${encodeURIComponent(groupB)}/knowledge/documents`,
      body: {
        documentId: 'aula-1-contemporaneo',
        filePath: 'aulas/aula-1.md',
        title: 'Aula 1 de Contemporaneo',
        summary: 'Nesta turma, Aula 1 e o ensaio coreografico inicial.',
        aliases: ['Aula 1'],
        tags: ['contemporaneo', 'ensaio'],
        enabled: true,
        content: '# Aula 1\n\nA Aula 1 desta turma e o ensaio coreografico inicial e pede chegada antecipada.\n',
      },
    }),
  );

  const intelligence = await expectOk(
    server.inject({
      method: 'GET',
      path: `/api/groups/${encodeURIComponent(groupA)}/intelligence`,
    }),
  );
  assert.equal(intelligence.instructions.source, 'llm_instructions');
  assert.equal(intelligence.knowledge.documents.length, 1);
  assert.match(intelligence.knowledge.documents[0].absoluteFilePath, /knowledge\/aulas\/aula-1\.md$/u);

  const previewA = await expectOk(
    server.inject({
      method: 'POST',
      path: `/api/groups/${encodeURIComponent(groupA)}/context-preview`,
      body: {
        text: 'A Aula 1 mudou?',
      },
    }),
  );
  const previewB = await expectOk(
    server.inject({
      method: 'POST',
      path: `/api/groups/${encodeURIComponent(groupB)}/context-preview`,
      body: {
        text: 'A Aula 1 mudou?',
      },
    }),
  );

  assert.equal(previewA.groupInstructionsSource, 'llm_instructions');
  assert.equal(previewA.groupKnowledgeSnippets.length, 1);
  assert.equal(previewB.groupKnowledgeSnippets.length, 1);
  assert.equal(previewA.groupKnowledgeSnippets[0].title, 'Aula 1 de Ballet');
  assert.equal(previewB.groupKnowledgeSnippets[0].title, 'Aula 1 de Contemporaneo');
  assert.notEqual(previewA.groupKnowledgeSnippets[0].documentId, previewB.groupKnowledgeSnippets[0].documentId);

  const deletion = await expectOk(
    server.inject({
      method: 'DELETE',
      path: `/api/groups/${encodeURIComponent(groupA)}/knowledge/documents/${encodeURIComponent('aula-1-ballet')}`,
    }),
  );
  assert.equal(deletion.deleted, true);

  const postDelete = await expectOk(
    server.inject({
      method: 'GET',
      path: `/api/groups/${encodeURIComponent(groupA)}/intelligence`,
    }),
  );
  assert.equal(postDelete.knowledge.documents.length, 0);

  const address = await server.listen({
    host: '127.0.0.1',
    port: 0,
    staticSite: {
      rootPath: WEB_DIST_ROOT,
    },
  });
  const dump = await runChromeDump(`${address.origin}/groups`);

  assert.match(dump.stdout, /Instrucoes LLM do grupo/u);
  assert.match(dump.stdout, /Knowledge base deste grupo/u);
  assert.match(dump.stdout, /Preview do contexto que a LLM receberia/u);
  assert.match(dump.stdout, /Ballet Iniciacao/u);
  assert.doesNotMatch(dump.stdout, /Algo falhou ao carregar esta pagina/u);
  assert.doesNotMatch(dump.stderr, /(TypeError|ReferenceError|Uncaught)/u);

  console.log('Wave 27 validation passed: group intelligence API and UI management are operational.');
} finally {
  if (server) {
    await server.close().catch(() => undefined);
  }

  await rm(sandboxPath, { recursive: true, force: true });
}

async function expectOk(responsePromise) {
  const response = await responsePromise;

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  return response.body;
}
