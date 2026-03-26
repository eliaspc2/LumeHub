import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { GroupDirectoryModule } = await import(
  '../packages/modules/group-directory/dist/modules/group-directory/src/public/index.js'
);
const { PeopleMemoryModule } = await import(
  '../packages/modules/people-memory/dist/modules/people-memory/src/public/index.js'
);
const { AudienceRoutingModule } = await import(
  '../packages/modules/audience-routing/dist/modules/audience-routing/src/public/index.js'
);
const { CommandPolicyModule } = await import(
  '../packages/modules/command-policy/dist/modules/command-policy/src/public/index.js'
);
const { InstructionQueueModule } = await import(
  '../packages/modules/instruction-queue/dist/modules/instruction-queue/src/public/index.js'
);
const { OwnerControlModule } = await import(
  '../packages/modules/owner-control/dist/modules/owner-control/src/public/index.js'
);
const { IntentClassifierModule } = await import(
  '../packages/modules/intent-classifier/dist/modules/intent-classifier/src/public/index.js'
);
const { AssistantContextModule } = await import(
  '../packages/modules/assistant-context/dist/modules/assistant-context/src/public/index.js'
);
const { LlmOrchestratorModule } = await import(
  '../packages/modules/llm-orchestrator/dist/modules/llm-orchestrator/src/public/index.js'
);
const { AgentRuntimeModule } = await import(
  '../packages/modules/agent-runtime/dist/modules/agent-runtime/src/public/index.js'
);
const { ConversationModule } = await import(
  '../packages/modules/conversation/dist/modules/conversation/src/public/index.js'
);

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave9-'));

try {
  const dataRootPath = join(sandboxPath, 'data');
  const configRootPath = join(sandboxPath, 'config');
  const runtimeRootPath = join(sandboxPath, 'runtime');
  const groupSeedFilePath = join(configRootPath, 'groups.json');
  const catalogFilePath = join(configRootPath, 'discipline_catalog.json');
  const peopleFilePath = join(configRootPath, 'people.json');
  const rulesFilePath = join(configRootPath, 'audience_rules.json');
  const queueFilePath = join(runtimeRootPath, 'instruction-queue.json');
  const historyFilePath = join(runtimeRootPath, 'conversation-history.json');
  const auditFilePath = join(runtimeRootPath, 'conversation-audit.json');
  const runLogFilePath = join(runtimeRootPath, 'llm-run-log.json');
  const groupProgrammingA = '120363402446203704@g.us';
  const groupProgrammingB = '120363402446203705@g.us';
  const anaPrivate = '351910000001@s.whatsapp.net';
  const studentPrivate = '351910000050@s.whatsapp.net';

  await mkdir(configRootPath, { recursive: true });
  await mkdir(runtimeRootPath, { recursive: true });

  await writeFile(
    groupSeedFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        groups: [
          {
            groupJid: groupProgrammingA,
            preferredSubject: 'EFA Programacao A',
            aliases: ['Programacao A', 'turma A'],
            courseId: 'course-programming',
            groupOwners: [
              {
                personId: 'person-ana',
                assignedAt: '2026-03-26T23:00:00.000Z',
                assignedBy: 'person-app-owner',
              },
            ],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-26T23:00:00.000Z',
          },
          {
            groupJid: groupProgrammingB,
            preferredSubject: 'EFA Programacao B',
            aliases: ['Programacao B', 'turma B'],
            courseId: 'course-programming',
            groupOwners: [],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-26T23:00:00.000Z',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    catalogFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        courses: [
          {
            courseId: 'course-programming',
            title: 'UFCD - Programacao',
            groupJid: groupProgrammingA,
            preferredSubject: 'EFA Programacao A',
            aliases: ['Programacao A'],
          },
          {
            courseId: 'course-programming',
            title: 'UFCD - Programacao',
            groupJid: groupProgrammingB,
            preferredSubject: 'EFA Programacao B',
            aliases: ['Programacao B'],
          },
        ],
        disciplines: [
          {
            code: 'UFCD-0777',
            title: 'Programacao Base',
            courseId: 'course-programming',
            aliases: ['0777'],
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    peopleFilePath,
    JSON.stringify(
      {
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
            createdAt: '2026-03-26T23:00:00.000Z',
            updatedAt: '2026-03-26T23:00:00.000Z',
          },
          {
            personId: 'person-ana',
            displayName: 'Ana Formadora',
            identifiers: [
              {
                kind: 'whatsapp_jid',
                value: anaPrivate,
              },
            ],
            globalRoles: ['member'],
            createdAt: '2026-03-26T23:00:00.000Z',
            updatedAt: '2026-03-26T23:00:00.000Z',
          },
          {
            personId: 'person-student',
            displayName: 'Aluno Teste',
            identifiers: [
              {
                kind: 'whatsapp_jid',
                value: studentPrivate,
              },
            ],
            globalRoles: ['member'],
            createdAt: '2026-03-26T23:00:00.000Z',
            updatedAt: '2026-03-26T23:00:00.000Z',
          },
        ],
        notes: [],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    rulesFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        rules: [
          {
            ruleId: 'rule-programming-course',
            personId: 'person-ana',
            identifiers: [],
            targetGroupJids: [],
            targetCourseIds: ['course-programming'],
            targetDisciplineCodes: [],
            enabled: true,
            requiresConfirmation: false,
            notes: 'Fan-out base das turmas de programacao.',
            createdAt: '2026-03-26T23:00:00.000Z',
            updatedAt: '2026-03-26T23:00:00.000Z',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const groupDirectory = new GroupDirectoryModule({
    dataRootPath,
    groupSeedFilePath,
  });
  const peopleMemory = new PeopleMemoryModule({
    peopleFilePath,
  });
  await peopleMemory.appendImportantNote('person-ana', 'Responsavel pelas turmas de programacao.');

  const audienceRouting = new AudienceRoutingModule({
    dataRootPath,
    groupSeedFilePath,
    catalogFilePath,
    peopleFilePath,
    rulesFilePath,
  });
  const commandPolicy = new CommandPolicyModule({
    groupDirectory,
    peopleMemory,
    settings: {
      assistantEnabled: true,
      schedulingEnabled: true,
      ownerTerminalEnabled: true,
      autoReplyEnabled: true,
      directRepliesEnabled: false,
      allowPrivateAssistant: true,
      authorizedGroupJids: [],
      authorizedPrivateJids: [],
    },
  });
  const instructionQueue = new InstructionQueueModule({
    queueFilePath,
  });
  const ownerControl = new OwnerControlModule({
    commandPolicy,
    peopleMemory,
    groupDirectory,
    instructionQueue,
  });
  const intentClassifier = new IntentClassifierModule();
  const assistantContext = new AssistantContextModule({
    dataRootPath,
    historyFilePath,
    groupDirectory,
    peopleMemory,
  });
  const llmOrchestrator = new LlmOrchestratorModule({
    dataRootPath,
    runLogFilePath,
  });
  const agentRuntime = new AgentRuntimeModule({
    assistantContext,
    audienceRouting,
    commandPolicy,
    instructionQueue,
    intentClassifier,
    llmOrchestrator,
    ownerControl,
  });
  const conversation = new ConversationModule({
    dataRootPath,
    auditFilePath,
    agentRuntime,
    assistantContext,
    commandPolicy,
  });

  const tools = agentRuntime.listTools().map((tool) => tool.name);
  assert.deepEqual(tools, ['owner_command', 'fanout_preview', 'fanout_execute', 'schedule_parse', 'chat_reply']);

  const privateSummaryReply = await conversation.handleIncomingMessage({
    messageId: 'msg-private-1',
    chatJid: anaPrivate,
    chatType: 'private',
    personId: 'person-ana',
    senderDisplayName: 'Ana Formadora',
    identifiers: [
      {
        kind: 'whatsapp_jid',
        value: anaPrivate,
      },
    ],
    privateReplyJid: anaPrivate,
    text: 'Resume o que se passa na EFA Programacao A',
  });
  assert.equal(privateSummaryReply.shouldReply, true);
  assert.equal(privateSummaryReply.targetChatType, 'private');
  assert.match(privateSummaryReply.replyText ?? '', /EFA Programacao A/);

  const privateFollowUpReply = await conversation.handleIncomingMessage({
    messageId: 'msg-private-2',
    chatJid: anaPrivate,
    chatType: 'private',
    personId: 'person-ana',
    senderDisplayName: 'Ana Formadora',
    identifiers: [
      {
        kind: 'whatsapp_jid',
        value: anaPrivate,
      },
    ],
    privateReplyJid: anaPrivate,
    text: 'E a de hoje?',
  });
  assert.equal(privateFollowUpReply.shouldReply, true);
  assert.equal(privateFollowUpReply.targetChatType, 'private');
  assert.match(privateFollowUpReply.replyText ?? '', /EFA Programacao A/);

  const groupReply = await conversation.handleIncomingMessage({
    messageId: 'msg-group-1',
    chatJid: groupProgrammingA,
    chatType: 'group',
    groupJid: groupProgrammingA,
    personId: 'person-ana',
    senderDisplayName: 'Ana Formadora',
    identifiers: [
      {
        kind: 'whatsapp_jid',
        value: anaPrivate,
      },
    ],
    privateReplyJid: anaPrivate,
    wasTagged: true,
    text: 'E a de hoje?',
  });
  assert.equal(groupReply.shouldReply, true);
  assert.equal(groupReply.targetChatType, 'group');
  assert.equal(groupReply.targetChatJid, groupProgrammingA);
  assert.match(groupReply.replyText ?? '', /EFA Programacao A/);

  const fanoutPreviewReply = await conversation.handleIncomingMessage({
    messageId: 'msg-fanout-preview',
    chatJid: anaPrivate,
    chatType: 'private',
    personId: 'person-ana',
    senderDisplayName: 'Ana Formadora',
    identifiers: [
      {
        kind: 'whatsapp_jid',
        value: anaPrivate,
      },
    ],
    privateReplyJid: anaPrivate,
    allowActions: false,
    text: 'distribui este aviso para as turmas de programacao',
  });
  assert.equal(fanoutPreviewReply.agentResult.distributionPlan?.targetCount, 2);
  assert.equal(fanoutPreviewReply.agentResult.enqueuedInstruction, null);
  assert.match(fanoutPreviewReply.replyText ?? '', /EFA Programacao A/);
  assert.match(fanoutPreviewReply.replyText ?? '', /EFA Programacao B/);

  const fanoutExecuteReply = await conversation.handleIncomingMessage({
    messageId: 'msg-fanout-execute',
    chatJid: anaPrivate,
    chatType: 'private',
    personId: 'person-ana',
    senderDisplayName: 'Ana Formadora',
    identifiers: [
      {
        kind: 'whatsapp_jid',
        value: anaPrivate,
      },
    ],
    privateReplyJid: anaPrivate,
    allowActions: true,
    text: 'distribui agora este aviso para as turmas de programacao',
  });
  assert.ok(fanoutExecuteReply.agentResult.enqueuedInstruction);
  assert.match(fanoutExecuteReply.replyText ?? '', /fanout_enqueued=/);

  const queuedInstructions = await instructionQueue.listInstructions();
  assert.equal(queuedInstructions.length, 1);
  assert.equal(queuedInstructions[0].actions.length, 2);

  const blockedSchedulingReply = await conversation.handleIncomingMessage({
    messageId: 'msg-group-blocked-schedule',
    chatJid: groupProgrammingB,
    chatType: 'group',
    groupJid: groupProgrammingB,
    personId: 'person-student',
    senderDisplayName: 'Aluno Teste',
    identifiers: [
      {
        kind: 'whatsapp_jid',
        value: studentPrivate,
      },
    ],
    privateReplyJid: studentPrivate,
    wasTagged: true,
    text: 'marca aula extra amanhã às 18:00',
  });
  assert.equal(blockedSchedulingReply.shouldReply, true);
  assert.equal(blockedSchedulingReply.targetChatType, 'group');
  assert.equal(blockedSchedulingReply.agentResult.scheduleParseResult, null);
  assert.match(blockedSchedulingReply.replyText ?? '', /Nao posso tratar alteracoes de calendario/i);

  const history = await assistantContext.listChatHistory(anaPrivate, 20);
  assert.ok(history.length >= 6);
  assert.ok(history.some((entry) => entry.role === 'assistant'));

  const models = llmOrchestrator.listModels();
  assert.equal(models.length, 1);
  assert.equal(models[0].providerId, 'local-deterministic');

  console.log(`Wave 9 validation passed in ${sandboxPath}`);
} finally {
  await rm(sandboxPath, {
    recursive: true,
    force: true,
  });
}
