import test from 'node:test';
import assert from 'node:assert/strict';

const { AgentRuntime } = await import(
  '../../packages/modules/agent-runtime/dist/modules/agent-runtime/src/application/services/AgentRuntime.js'
);
const { WeeklyPlannerService } = await import(
  '../../packages/modules/weekly-planner/dist/modules/weekly-planner/src/application/services/WeeklyPlannerService.js'
);

function createGroup({
  groupJid,
  preferredSubject,
  mode = 'com_agendamento',
  schedulingEnabled = true,
  allowLlmScheduling = true,
}) {
  return {
    groupJid,
    preferredSubject,
    aliases: [],
    courseId: null,
    groupOwners: [],
    calendarAccessPolicy: {
      group: 'read',
      groupOwner: 'read_write',
      appOwner: 'read_write',
    },
    operationalSettings: {
      mode,
      schedulingEnabled,
      allowLlmScheduling,
      memberTagPolicy: 'members_can_tag',
    },
    lastRefreshedAt: '2026-04-06T08:00:00.000Z',
  };
}

function createChatContext(group) {
  return {
    chatJid: group?.groupJid ?? 'chat@example.test',
    chatType: 'group',
    currentText: 'Cria aula sexta as 18:30.',
    personId: 'person-owner',
    senderDisplayName: 'Wave 56 Validator',
    groupJid: group?.groupJid ?? null,
    group: group
      ? {
          groupJid: group.groupJid,
          preferredSubject: group.preferredSubject,
          aliases: group.aliases,
          courseId: group.courseId,
        }
      : null,
    recentMessages: [],
    relevantMessages: [],
    activeReference: null,
    personNotes: [],
    groupInstructions: 'Regras curtas do grupo.',
    groupInstructionsSource: 'llm_instructions',
    groupKnowledgeSnippets: [],
    groupPolicy: null,
    generatedAt: '2026-04-06T08:00:00.000Z',
  };
}

function createWeekSnapshot(group) {
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

function createPreviewInput(groupJid, text = 'Cria aula sexta as 18:30 com nota para levar figurinos.') {
  return {
    messageId: `wave56-preview-${groupJid}`,
    chatJid: groupJid,
    chatType: 'group',
    groupJid,
    personId: 'person-owner',
    senderDisplayName: 'Wave 56 Validator',
    text,
    allowActions: true,
    requestedAccessMode: 'read_write',
  };
}

function createAgentRuntime(groups) {
  const groupMap = new Map(groups.map((group) => [group.groupJid, group]));
  let parseCalls = 0;

  const runtime = new AgentRuntime(
    {
      async buildChatContext(input) {
        return createChatContext(groupMap.get(input.groupJid) ?? null);
      },
      async buildSchedulingContext(input) {
        const group = groupMap.get(input.groupJid) ?? null;
        return {
          chatContext: createChatContext(group),
          requestedAccessMode: input.requestedAccessMode ?? 'read_write',
          resolvedGroupJids: group ? [group.groupJid] : [],
        };
      },
    },
    {
      async previewDistributionPlan() {
        throw new Error('fan-out preview should not run in this test');
      },
    },
    {
      async canManageCalendar() {
        return true;
      },
      async canUseAssistant() {
        return true;
      },
    },
    {
      async findByJid(groupJid) {
        return groupMap.get(groupJid);
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
      classifyMessage() {
        return {
          intent: 'scheduling_request',
          requestedAccessMode: 'read_write',
        };
      },
    },
    {
      async parseSchedules() {
        parseCalls += 1;
        return {
          notes: ['parsed for wave56'],
          candidates: [
            {
              title: 'Aula Wave 56',
              confidence: 'high',
              dateHint: '2026-04-10',
              timeHint: '18:30',
              notes: [],
            },
          ],
        };
      },
      async chat() {
        return {
          runId: 'llm-run-wave56',
          providerId: 'deterministic',
          modelId: 'gpt-5.4',
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
      async getWeekSnapshot({ groupJid }) {
        return createWeekSnapshot(groupMap.get(groupJid));
      },
    },
  );

  return {
    runtime,
    getParseCalls() {
      return parseCalls;
    },
  };
}

test('weekly planner blocks local scheduling for distribution-only groups', async () => {
  const distributionGroup = createGroup({
    groupJid: '120363400000000101@g.us',
    preferredSubject: 'Distribuicao Geral',
    mode: 'distribuicao_apenas',
    schedulingEnabled: false,
    allowLlmScheduling: false,
  });
  const service = new WeeklyPlannerService({
    adminConfig: {
      async getSettings() {
        return {
          ui: {
            defaultNotificationRules: [],
          },
        };
      },
    },
    groupDirectory: {
      async listGroups() {
        return [distributionGroup];
      },
    },
    notificationJobs: {
      async materializeForEvent() {
        throw new Error('materializeForEvent should not run for blocked groups');
      },
    },
    notificationRules: {
      async replaceRulesForEvent() {
        throw new Error('replaceRulesForEvent should not run for blocked groups');
      },
    },
    scheduleEvents: {
      async createEvent() {
        throw new Error('createEvent should not run for blocked groups');
      },
      async updateEvent() {
        throw new Error('updateEvent should not run for blocked groups');
      },
      async deleteEvent() {
        return false;
      },
      async listEventsByWeek() {
        return [];
      },
      async findEventById() {
        return null;
      },
    },
    scheduleWeeks: {
      async getCurrentWeek() {
        return {
          weekId: '2026-W15',
        };
      },
    },
  });

  await assert.rejects(
    service.saveSchedule({
      groupJid: distributionGroup.groupJid,
      title: 'Nao devia ser criado',
      dayLabel: 'sexta-feira',
      startTime: '18:30',
      durationMinutes: 60,
      notes: 'blocked',
    }),
    /distribuicao apenas/u,
  );
});

test('assistant preview blocks distribution-only groups before calling the LLM parser', async () => {
  const distributionGroup = createGroup({
    groupJid: '120363400000000102@g.us',
    preferredSubject: 'Distribuicao Geral',
    mode: 'distribuicao_apenas',
    schedulingEnabled: false,
    allowLlmScheduling: false,
  });
  const { runtime, getParseCalls } = createAgentRuntime([distributionGroup]);

  const preview = await runtime.previewScheduleApply(createPreviewInput(distributionGroup.groupJid));

  assert.equal(preview.canApply, false);
  assert.match(preview.blockingReason ?? '', /fan-out\/distribuicao/u);
  assert.equal(getParseCalls(), 0);
});

test('assistant preview blocks groups with manual calendar only when LLM scheduling is disabled', async () => {
  const manualOnlyGroup = createGroup({
    groupJid: '120363400000000103@g.us',
    preferredSubject: 'Turma Manual',
    mode: 'com_agendamento',
    schedulingEnabled: true,
    allowLlmScheduling: false,
  });
  const { runtime, getParseCalls } = createAgentRuntime([manualOnlyGroup]);

  const preview = await runtime.previewScheduleApply(createPreviewInput(manualOnlyGroup.groupJid));

  assert.equal(preview.canApply, false);
  assert.match(preview.blockingReason ?? '', /calendario manual/u);
  assert.equal(getParseCalls(), 0);
});

test('assistant preview remains available for groups with full scheduling enabled', async () => {
  const schedulableGroup = createGroup({
    groupJid: '120363400000000104@g.us',
    preferredSubject: 'Turma com Agenda',
  });
  const { runtime, getParseCalls } = createAgentRuntime([schedulableGroup]);

  const preview = await runtime.previewScheduleApply(createPreviewInput(schedulableGroup.groupJid));

  assert.equal(preview.canApply, true);
  assert.equal(preview.operation, 'create');
  assert.equal(preview.groupJid, schedulableGroup.groupJid);
  assert.match(preview.summary, /Turma com Agenda/u);
  assert.equal(getParseCalls(), 1);
});
