import test from 'node:test';
import assert from 'node:assert/strict';

const { AgentRuntime } = await import(
  '../../packages/modules/agent-runtime/dist/modules/agent-runtime/src/application/services/AgentRuntime.js'
);
const { RuleBasedIntentClassifier } = await import(
  '../../packages/modules/intent-classifier/dist/modules/intent-classifier/src/public/index.js'
);

const group = {
  groupJid: '120363402446203704@g.us',
  preferredSubject: 'Turma Contexto',
  aliases: [],
  courseId: null,
  groupOwners: [],
  calendarAccessPolicy: {
    group: 'read',
    groupOwner: 'read_write',
    appOwner: 'read_write',
  },
  operationalSettings: {
    mode: 'com_agendamento',
    schedulingEnabled: true,
    allowLlmScheduling: true,
    memberTagPolicy: 'members_can_tag',
  },
  lastRefreshedAt: '2026-04-28T15:30:00.000Z',
};

function createRecentMessages(count, options = {}) {
  const gapAfter = options.gapAfter ?? null;

  return Array.from({ length: count }, (_value, index) => {
    const number = index + 1;
    const minute = gapAfter && number > gapAfter ? number + 60 : number;

    return {
      messageId: `history-${number}`,
      chatJid: group.groupJid,
      chatType: 'group',
      groupJid: group.groupJid,
      personId: `person-${number}`,
      senderDisplayName: `Pessoa ${number}`,
      role: number % 5 === 0 ? 'assistant' : 'user',
      text: `mensagem ${number}`,
      createdAt: `2026-04-28T${String(15 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00.000Z`,
      relevanceScore: 1,
    };
  });
}

test('tagged assistant turns send the last 30 chat messages to the LLM context summary', async () => {
  const classifier = new RuleBasedIntentClassifier();
  let capturedContextSummary = null;
  const recentMessages = createRecentMessages(35);

  const runtime = new AgentRuntime(
    {
      async buildChatContext(input) {
        return {
          chatJid: input.chatJid,
          chatType: input.chatType,
          currentText: input.text,
          personId: input.personId,
          senderDisplayName: input.senderDisplayName,
          groupJid: group.groupJid,
          group: {
            groupJid: group.groupJid,
            preferredSubject: group.preferredSubject,
            aliases: group.aliases,
            courseId: group.courseId,
          },
          recentMessages,
          relevantMessages: recentMessages.slice(-8),
          activeReference: null,
          personNotes: [],
          groupInstructions: 'Instrucoes curtas.',
          groupInstructionsSource: 'llm_instructions',
          groupKnowledgeSnippets: [],
          groupPolicy: null,
          generatedAt: '2026-04-28T15:40:00.000Z',
        };
      },
      async buildSchedulingContext() {
        throw new Error('scheduling context should not run in this test');
      },
    },
    {
      async previewDistributionPlan() {
        throw new Error('fan-out preview should not run in this test');
      },
    },
    {
      async explainAssistantAccess(context) {
        return {
          allowed: true,
          actorRole: 'member',
          chatType: context.chatType,
          groupJid: context.groupJid ?? null,
          interactionPolicy: 'members_can_tag',
          reasonCode: 'group_member_allowed',
          summary: 'allowed by tag',
        };
      },
      async canManageCalendar() {
        return true;
      },
    },
    {
      async findByJid(groupJid) {
        return groupJid === group.groupJid ? group : undefined;
      },
    },
    {
      async enqueueDistributionPlan() {
        throw new Error('distribution queue should not run in this test');
      },
      async enqueueScheduleApply() {
        throw new Error('schedule apply should not run in this test');
      },
      async listInstructions() {
        return [];
      },
      async tickWorker() {
        return undefined;
      },
    },
    {
      classifyMessage(input) {
        return classifier.classify(input);
      },
    },
    {
      async parseSchedules() {
        throw new Error('schedule parser should not run in this test');
      },
      async chat(input) {
        capturedContextSummary = input.contextSummary;
        return {
          runId: 'context-30-run',
          providerId: 'deterministic',
          modelId: 'test-model',
          text: 'ok',
          outputSummary: 'ok',
        };
      },
    },
    {
      detectOwnerCommand() {
        return false;
      },
      async executeOwnerCommand() {
        throw new Error('owner command should not run in this test');
      },
    },
    {
      async getWeekSnapshot() {
        throw new Error('weekly planner should not run in this test');
      },
    },
  );

  await runtime.executeConversationTurn({
    messageId: 'message-context-30',
    chatJid: group.groupJid,
    chatType: 'group',
    groupJid: group.groupJid,
    personId: 'person-current',
    senderDisplayName: 'Andre',
    text: '@Lume responde so ok',
    wasTagged: true,
    isReplyToBot: false,
    allowActions: true,
  });

  assert.ok(capturedContextSummary);
  const historyLines = capturedContextSummary.filter((line) => /^historico_recente_\d{2}\b/u.test(line));

  assert.equal(capturedContextSummary.includes('historico_recente_disponivel=35'), true);
  assert.equal(capturedContextSummary.includes('historico_recente_enviado=35'), true);
  assert.equal(capturedContextSummary.includes('historico_recente_politica=min30_max50_gap15min_margem2'), true);
  assert.equal(historyLines.length, 35);
  assert.match(historyLines[0], /timestamp=2026-04-28T15:01:00.000Z/u);
  assert.match(historyLines[0], /mensagem 1/u);
  assert.match(historyLines.at(-1), /mensagem 35/u);
});

test('conversation context expands by timestamp but caps at 50 and keeps two timeline margin messages', async () => {
  const classifier = new RuleBasedIntentClassifier();
  let capturedContextSummary = null;
  const recentMessages = createRecentMessages(60);

  const runtime = new AgentRuntime(
    {
      async buildChatContext(input) {
        return {
          chatJid: input.chatJid,
          chatType: input.chatType,
          currentText: input.text,
          personId: input.personId,
          senderDisplayName: input.senderDisplayName,
          groupJid: group.groupJid,
          group: {
            groupJid: group.groupJid,
            preferredSubject: group.preferredSubject,
            aliases: group.aliases,
            courseId: group.courseId,
          },
          recentMessages,
          relevantMessages: recentMessages.slice(-8),
          activeReference: null,
          personNotes: [],
          groupInstructions: 'Instrucoes curtas.',
          groupInstructionsSource: 'llm_instructions',
          groupKnowledgeSnippets: [],
          groupPolicy: null,
          generatedAt: '2026-04-28T16:40:00.000Z',
        };
      },
      async buildSchedulingContext() {
        throw new Error('scheduling context should not run in this test');
      },
    },
    {
      async previewDistributionPlan() {
        throw new Error('fan-out preview should not run in this test');
      },
    },
    {
      async explainAssistantAccess(context) {
        return {
          allowed: true,
          actorRole: 'member',
          chatType: context.chatType,
          groupJid: context.groupJid ?? null,
          interactionPolicy: 'members_can_tag',
          reasonCode: 'group_member_allowed',
          summary: 'allowed by tag',
        };
      },
      async canManageCalendar() {
        return true;
      },
    },
    {
      async findByJid(groupJid) {
        return groupJid === group.groupJid ? group : undefined;
      },
    },
    {
      async enqueueDistributionPlan() {
        throw new Error('distribution queue should not run in this test');
      },
      async enqueueScheduleApply() {
        throw new Error('schedule apply should not run in this test');
      },
      async listInstructions() {
        return [];
      },
      async tickWorker() {
        return undefined;
      },
    },
    {
      classifyMessage(input) {
        return classifier.classify(input);
      },
    },
    {
      async parseSchedules() {
        throw new Error('schedule parser should not run in this test');
      },
      async chat(input) {
        capturedContextSummary = input.contextSummary;
        return {
          runId: 'context-50-run',
          providerId: 'deterministic',
          modelId: 'test-model',
          text: 'ok',
          outputSummary: 'ok',
        };
      },
    },
    {
      detectOwnerCommand() {
        return false;
      },
      async executeOwnerCommand() {
        throw new Error('owner command should not run in this test');
      },
    },
    {
      async getWeekSnapshot() {
        throw new Error('weekly planner should not run in this test');
      },
    },
  );

  await runtime.executeConversationTurn({
    messageId: 'message-context-50',
    chatJid: group.groupJid,
    chatType: 'group',
    groupJid: group.groupJid,
    personId: 'person-current',
    senderDisplayName: 'Andre',
    text: '@Lume responde so ok',
    wasTagged: true,
    isReplyToBot: false,
    allowActions: true,
  });

  assert.ok(capturedContextSummary);
  const historyLines = capturedContextSummary.filter((line) => /^historico_recente_\d{2}\b/u.test(line));

  assert.equal(capturedContextSummary.includes('historico_recente_disponivel=60'), true);
  assert.equal(capturedContextSummary.includes('historico_recente_enviado=50'), true);
  assert.equal(historyLines.length, 50);
  assert.match(historyLines[0], /mensagem 11/u);
  assert.match(historyLines.at(-1), /mensagem 60/u);
});
