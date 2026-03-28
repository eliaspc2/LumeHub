import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import { runChromeDump } from '../tests/helpers/live-runtime-fixtures.mjs';

const { AgentRuntimeModule } = await import(
  '../packages/modules/agent-runtime/dist/modules/agent-runtime/src/public/index.js'
);
const { AssistantContextModule } = await import(
  '../packages/modules/assistant-context/dist/modules/assistant-context/src/public/index.js'
);
const { CommandPolicyModule } = await import(
  '../packages/modules/command-policy/dist/modules/command-policy/src/public/index.js'
);
const { ConversationModule, ConversationAuditRepository } = await import(
  '../packages/modules/conversation/dist/modules/conversation/src/public/index.js'
);
const { FrontendApiClient } = await import(
  '../packages/adapters/frontend-api-client/dist/adapters/frontend-api-client/src/public/index.js'
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
const { IntentClassifierModule } = await import(
  '../packages/modules/intent-classifier/dist/modules/intent-classifier/src/public/index.js'
);
const { LlmOrchestratorModule, LlmRunLogRepository } = await import(
  '../packages/modules/llm-orchestrator/dist/modules/llm-orchestrator/src/public/index.js'
);
const { PeopleMemoryModule } = await import(
  '../packages/modules/people-memory/dist/modules/people-memory/src/public/index.js'
);

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIST_ROOT = resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'dist');
const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave29-'));
const dataRootPath = join(sandboxPath, 'data');
const groupSeedFilePath = join(sandboxPath, 'group-seed.json');

let server = null;

try {
  const groupA = '120363400000000301@g.us';
  const groupB = '120363400000000302@g.us';

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
            aliases: ['Contemporaneo Intermedio'],
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
  const peopleMemory = new PeopleMemoryModule({
    peopleFilePath: join(dataRootPath, 'runtime', 'people.json'),
  });
  const groupKnowledge = new GroupKnowledgeModule({
    dataRootPath,
    groupDirectory,
  });
  const assistantContext = new AssistantContextModule({
    dataRootPath,
    groupDirectory,
    groupKnowledge,
    peopleMemory,
  });
  const commandPolicy = new CommandPolicyModule({
    groupDirectory,
    peopleMemory,
    settings: {
      assistantEnabled: true,
      schedulingEnabled: true,
      autoReplyEnabled: true,
      directRepliesEnabled: true,
      allowPrivateAssistant: true,
      authorizedGroupJids: [groupA, groupB],
      authorizedPrivateJids: [],
    },
  });
  const llmOrchestrator = new LlmOrchestratorModule({
    dataRootPath,
  });
  const agentRuntime = new AgentRuntimeModule({
    assistantContext,
    audienceRouting: {
      async previewDistributionPlan() {
        throw new Error('Not used in wave29 validation.');
      },
    },
    commandPolicy,
    instructionQueue: {
      async enqueueDistributionPlan() {
        throw new Error('Not used in wave29 validation.');
      },
    },
    intentClassifier: new IntentClassifierModule(),
    llmOrchestrator,
    ownerControl: {
      detectOwnerCommand() {
        return false;
      },
      async executeOwnerCommand() {
        throw new Error('Not used in wave29 validation.');
      },
    },
  });
  const conversation = new ConversationModule({
    dataRootPath,
    agentRuntime,
    assistantContext,
    commandPolicy,
  });
  const llmRunLogRepository = new LlmRunLogRepository({
    dataRootPath,
  });
  const conversationAuditRepository = new ConversationAuditRepository({
    dataRootPath,
  });

  await groupDirectory.updateGroupLlmInstructions(groupA, {
    content: '# Instrucoes\n\nNesta turma, Aula 1 refere-se sempre ao bloco tecnico base.\n',
  });
  await groupDirectory.updateGroupLlmInstructions(groupB, {
    content: '# Instrucoes\n\nNesta turma, Aula 1 refere-se sempre ao ensaio coreografico inicial.\n',
  });

  await groupKnowledge.upsertDocument({
    groupJid: groupA,
    documentId: 'aula-1-ballet',
    filePath: 'aulas/aula-1.md',
    title: 'Aula 1 de Ballet',
    summary: 'Bloco tecnico base da turma de ballet.',
    aliases: ['Aula 1'],
    tags: ['ballet', 'aula'],
    enabled: true,
    content: '# Aula 1\n\nA Aula 1 desta turma e o bloco tecnico base e usa a sala 2.\n',
  });
  await groupKnowledge.upsertDocument({
    groupJid: groupB,
    documentId: 'aula-1-contemporaneo',
    filePath: 'aulas/aula-1.md',
    title: 'Aula 1 de Contemporaneo',
    summary: 'Ensaio coreografico inicial da turma de contemporaneo.',
    aliases: ['Aula 1'],
    tags: ['contemporaneo', 'ensaio'],
    enabled: true,
    content: '# Aula 1\n\nA Aula 1 desta turma e o ensaio coreografico inicial e pede chegada antecipada.\n',
  });

  const replyA = await conversation.handleIncomingMessage({
    messageId: 'wamid.wave28.group.a',
    chatJid: groupA,
    chatType: 'group',
    groupJid: groupA,
    personId: null,
    senderDisplayName: 'Ana Costa',
    text: 'Agendar Aula 1 amanha as 18:30',
    wasTagged: true,
    isReplyToBot: false,
    allowActions: true,
  });
  const replyB = await conversation.handleIncomingMessage({
    messageId: 'wamid.wave28.group.b',
    chatJid: groupB,
    chatType: 'group',
    groupJid: groupB,
    personId: null,
    senderDisplayName: 'Ana Costa',
    text: 'Agendar Aula 1 amanha as 18:30',
    wasTagged: true,
    isReplyToBot: false,
    allowActions: true,
  });

  assert.equal(replyA.agentResult.memoryUsage.groupJid, groupA);
  assert.equal(replyB.agentResult.memoryUsage.groupJid, groupB);
  assert.equal(replyA.agentResult.memoryUsage.knowledgeDocuments[0]?.documentId, 'aula-1-ballet');
  assert.equal(replyB.agentResult.memoryUsage.knowledgeDocuments[0]?.documentId, 'aula-1-contemporaneo');
  assert.equal(replyA.agentResult.scheduleParseResult?.candidates[0]?.title, 'Aula 1 de Ballet');
  assert.equal(replyB.agentResult.scheduleParseResult?.candidates[0]?.title, 'Aula 1 de Contemporaneo');
  assert.equal(replyA.agentResult.schedulingInsight?.resolvedGroupJids[0], groupA);
  assert.equal(replyB.agentResult.schedulingInsight?.resolvedGroupJids[0], groupB);

  const llmLog = await llmRunLogRepository.read();
  const llmParseEntries = llmLog.entries.filter((entry) => entry.operation === 'parse_schedules');
  assert.equal(llmParseEntries.length, 2);
  const llmParseA = llmParseEntries.find((entry) => entry.memoryScope?.groupJid === groupA);
  const llmParseB = llmParseEntries.find((entry) => entry.memoryScope?.groupJid === groupB);
  assert.equal(llmParseA?.memoryScope?.knowledgeDocuments[0]?.documentId, 'aula-1-ballet');
  assert.equal(llmParseB?.memoryScope?.knowledgeDocuments[0]?.documentId, 'aula-1-contemporaneo');
  assert.equal(llmParseA?.memoryScope?.instructionsSource, 'llm_instructions');
  assert.equal(llmParseB?.memoryScope?.instructionsSource, 'llm_instructions');

  const conversationAudit = await conversationAuditRepository.read();
  assert.equal(conversationAudit.entries.length, 2);
  const auditA = conversationAudit.entries.find((entry) => entry.chatJid === groupA);
  const auditB = conversationAudit.entries.find((entry) => entry.chatJid === groupB);
  assert.equal(auditA?.memoryUsage.groupJid, groupA);
  assert.equal(auditB?.memoryUsage.groupJid, groupB);
  assert.equal(auditA?.memoryUsage.knowledgeDocuments[0]?.documentId, 'aula-1-ballet');
  assert.equal(auditB?.memoryUsage.knowledgeDocuments[0]?.documentId, 'aula-1-contemporaneo');
  assert.equal(auditA?.schedulingInsight?.resolvedGroupJids[0], groupA);
  assert.equal(auditB?.schedulingInsight?.resolvedGroupJids[0], groupB);

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
              autoReplyEnabled: true,
              directRepliesEnabled: true,
              allowPrivateAssistant: true,
              authorizedGroupJids: [groupA, groupB],
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
              provider: 'local-deterministic',
              model: 'lume-context-v1',
              streamingEnabled: false,
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
        throw new Error('Not used in wave29 validation.');
        },
        async previewDistributionPlan() {
        throw new Error('Not used in wave29 validation.');
        },
      },
      conversationLogs: {
        async readRecent(limit = 20) {
          const audit = await conversationAuditRepository.read();
          return audit.entries.slice(Math.max(0, audit.entries.length - limit)).reverse();
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
        throw new Error('Not used in wave29 validation.');
        },
        async listInstructions() {
          return [];
        },
        async retryInstruction() {
        throw new Error('Not used in wave29 validation.');
        },
      },
      llmLogs: {
        async readRecent(limit = 20) {
          const log = await llmRunLogRepository.read();
          return log.entries.slice(Math.max(0, log.entries.length - limit)).reverse();
        },
      },
      llmOrchestrator,
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

  const client = new FrontendApiClient({
    async request(request) {
      return server.inject(request);
    },
  });

  const llmLogs = await client.listLlmLogs(4);
  const conversationLogs = await client.listConversationLogs(4);
  assert.equal(llmLogs[0].memoryScope?.scope, 'group');
  assert.equal(conversationLogs[0].memoryUsage.scope, 'group');

  const address = await server.listen({
    host: '127.0.0.1',
    port: 0,
    staticSite: {
      rootPath: WEB_DIST_ROOT,
    },
  });
  const dump = await runChromeDump(`${address.origin}/assistant?mode=live`);

  assert.match(dump.stdout, /Runs LLM recentes/u);
  assert.match(dump.stdout, /Auditoria conversacional/u);
  assert.match(dump.stdout, /Turma Ballet A/u);
  assert.match(dump.stdout, /Turma Contemporaneo B/u);
  assert.match(dump.stdout, /Aula 1 de Ballet/u);
  assert.match(dump.stdout, /Aula 1 de Contemporaneo/u);
  assert.doesNotMatch(dump.stdout, /Algo falhou ao carregar esta pagina/u);
  assert.doesNotMatch(dump.stderr, /(TypeError|ReferenceError|Uncaught)/u);

  for (const relativePath of [
    'README.md',
    'source/README.md',
    'docs/architecture/lume_hub_modular_implementation_spec.md',
    'docs/architecture/lume_hub_rewrite_master_prompt.md',
    'docs/deployment/lume_hub_lxd_runtime_plan.md',
  ]) {
    const content = readFileSync(join(SOURCE_ROOT, '..', relativePath), 'utf8');
    assert.doesNotMatch(
      content,
      /(?:^|[\s`"'/(])prompt\.md\b/u,
      `${relativePath} should no longer reference prompt.md as active runtime storage.`,
    );
    assert.doesNotMatch(content, /legacy_prompt/u, `${relativePath} should no longer reference legacy_prompt.`);
  }

  console.log('Wave 29 validation passed: group intelligence cleanup removed legacy prompt fallback without regressions.');
} finally {
  if (server) {
    await server.close().catch(() => undefined);
  }

  await rm(sandboxPath, { recursive: true, force: true });
}
