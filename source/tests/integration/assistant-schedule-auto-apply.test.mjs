import test from 'node:test';
import assert from 'node:assert/strict';

const { AgentRuntime } = await import(
  '../../packages/modules/agent-runtime/dist/modules/agent-runtime/src/application/services/AgentRuntime.js'
);
const { RuleBasedIntentClassifier } = await import(
  '../../packages/modules/intent-classifier/dist/modules/intent-classifier/src/public/index.js'
);

const group = {
  groupJid: '120363400000000301@g.us',
  preferredSubject: 'CET Ciberseguranca',
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
  lastRefreshedAt: '2026-04-28T12:00:00.000Z',
};

function createChatContext(input) {
  return {
    chatJid: input.chatJid,
    chatType: input.chatType,
    currentText: input.text,
    personId: input.personId,
    senderDisplayName: input.senderDisplayName,
    groupJid: input.groupJid ?? null,
    group: {
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
      aliases: group.aliases,
      courseId: group.courseId,
    },
    recentMessages: [],
    relevantMessages: [],
    activeReference: null,
    personNotes: [],
    groupInstructions: 'Agenda sem confirmacoes quando o pedido for claro.',
    groupInstructionsSource: 'llm_instructions',
    groupKnowledgeSnippets: [],
    groupPolicy: null,
    generatedAt: '2026-04-28T12:00:00.000Z',
  };
}

function createWeekSnapshot() {
  return {
    timezone: 'Europe/Lisbon',
    focusWeekLabel: '2026-W15',
    focusWeekRangeLabel: '06 abr - 12 abr',
    groupsKnown: 1,
    groups: [
      {
        groupJid: group.groupJid,
        preferredSubject: group.preferredSubject,
        courseId: group.courseId,
        ownerLabels: [],
        operationalSettings: group.operationalSettings,
      },
    ],
    defaultNotificationRuleLabels: ['24h antes', '30 min antes'],
    events: [],
    diagnostics: {
      eventCount: 0,
      pendingNotifications: 0,
      waitingConfirmationNotifications: 0,
      sentNotifications: 0,
    },
  };
}

function createCompletedInstruction(instruction, payload) {
  const sequence = instruction.instructionId.replace('instruction-auto-apply-', '');
  const appliedEvent = {
    eventId: `event-auto-apply-${sequence}`,
    weekId: payload.weekId,
    groupJid: payload.groupJid,
    groupLabel: group.preferredSubject,
    title: payload.upsert.title,
    eventAt: '2026-04-10T17:30:00.000Z',
    localDate: payload.upsert.localDate,
    dayLabel: 'sexta-feira',
    startTime: payload.upsert.startTime,
    durationMinutes: payload.upsert.durationMinutes,
    notes: payload.upsert.notes ?? '',
    notificationRuleLabels: (payload.upsert.notificationRules ?? []).map((rule) => rule.label ?? rule.kind),
    notifications: {
      pending: 3,
      waitingConfirmation: 0,
      sent: 0,
      total: 3,
    },
    nextReminderAt: null,
    nextReminderLabel: null,
    reminderLifecycle: {
      generated: 3,
      prepared: 0,
      sent: 0,
    },
  };

  return {
    ...instruction,
    status: 'completed',
    actions: instruction.actions.map((action) => ({
      ...action,
      status: 'completed',
      result: {
        note: 'schedule_created',
        metadata: {
          appliedEvent,
        },
      },
      completedAt: '2026-04-28T12:00:01.000Z',
    })),
  };
}

test('imperative WhatsApp scheduling applies directly and keeps explicit reminder rules', async () => {
  const classifier = new RuleBasedIntentClassifier();
  let parseCalls = 0;
  let chatCalls = 0;
  const enqueuedPayloads = [];
  const storedInstructions = [];

  const runtime = new AgentRuntime(
    {
      async buildChatContext(input) {
        return createChatContext(input);
      },
      async buildSchedulingContext(input) {
        return {
          chatContext: createChatContext(input),
          requestedAccessMode: input.requestedAccessMode ?? 'read_write',
          resolvedGroupJids: [group.groupJid],
        };
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
          actorRole: 'group_owner',
          chatType: context.chatType,
          groupJid: context.groupJid ?? null,
          interactionPolicy: 'members_can_tag',
          reasonCode: 'group_member_allowed',
          summary: 'allowed',
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
      async enqueueScheduleApply(input) {
        enqueuedPayloads.push(input.payload);
        const instruction = {
          instructionId: `instruction-auto-apply-${enqueuedPayloads.length}`,
          sourceType: 'assistant_schedule_apply',
          sourceMessageId: input.payload.sourceMessageId,
          mode: input.mode,
          status: 'queued',
          metadata: {},
          actions: [
            {
              actionId: 'action-auto-apply-1',
              type: 'schedule_apply',
              dedupeKey: input.dedupeKey ?? null,
              targetGroupJid: input.payload.groupJid,
              payload: input.payload,
              status: 'pending',
              attemptCount: 0,
              lastError: null,
              result: null,
              lastAttemptAt: null,
              completedAt: null,
            },
          ],
          createdAt: '2026-04-28T12:00:00.000Z',
          updatedAt: '2026-04-28T12:00:00.000Z',
        };
        storedInstructions.push(instruction);
        return instruction;
      },
      async listInstructions() {
        return storedInstructions;
      },
      async tickWorker() {
        for (const [index, instruction] of storedInstructions.entries()) {
          if (instruction.status === 'queued') {
            storedInstructions[index] = createCompletedInstruction(instruction, instruction.actions[0].payload);
          }
        }
      },
    },
    {
      classifyMessage(input) {
        return classifier.classify(input);
      },
    },
    {
      async parseSchedules() {
        parseCalls += 1;
        return {
          notes: ['parsed'],
          candidates: [
            {
              title: 'Aula Operacional',
              confidence: 'high',
              dateHint: '2026-04-10',
              timeHint: '18:30',
              notes: [],
            },
            {
              title: 'Aula Extra',
              confidence: 'high',
              dateHint: '2026-04-10',
              timeHint: '20:00',
              notes: [],
            },
            {
              title: 'Fecho do Teste',
              confidence: 'high',
              dateHint: '2026-04-11',
              timeHint: '18:30',
              notes: [],
            },
          ],
        };
      },
      async chat() {
        chatCalls += 1;
        throw new Error('chat should not run for direct schedule execution');
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
        return createWeekSnapshot();
      },
    },
  );

  const result = await runtime.executeConversationTurn({
    messageId: 'message-auto-apply-1',
    chatJid: group.groupJid,
    chatType: 'group',
    groupJid: group.groupJid,
    personId: 'person-owner',
    senderDisplayName: 'Andre',
    text:
      '@lume cria este agendamento sexta as 18:30. quero 3 lembretes: no proprio dia as 17:00, 30 min antes com o link https://meet.google.com/aep-ejqq-rbz e passado 24 horas a dizer que vai fechar o teste. agenda desta maneira ja',
    wasTagged: true,
    isReplyToBot: false,
    allowActions: true,
  });

  assert.equal(parseCalls, 1);
  assert.equal(chatCalls, 0);
  assert.equal(result.scheduleApplyResult?.appliedEvent?.title, 'Aula Operacional');
  assert.match(result.replyText ?? '', /^Feito:/u);
  assert.match(result.replyText ?? '', /apliquei 3 agendamento/u);
  assert.doesNotMatch(result.replyText ?? '', /confirma|posso tratar|nao consigo executar/iu);
  assert.equal(enqueuedPayloads.length, 3);

  for (const payload of enqueuedPayloads) {
    assert.equal(payload.upsert.notificationRules.length, 3);
    assert.deepEqual(
      payload.upsert.notificationRules.map((rule) => rule.label),
      ['No proprio dia as 17:00', '30 min antes', '24h depois'],
    );
    assert.match(payload.upsert.notificationRules[1].messageTemplate, /https:\/\/meet\.google\.com\/aep-ejqq-rbz/u);
  }
});
