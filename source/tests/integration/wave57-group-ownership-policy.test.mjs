import test from 'node:test';
import assert from 'node:assert/strict';

const { AgentRuntime } = await import(
  '../../packages/modules/agent-runtime/dist/modules/agent-runtime/src/application/services/AgentRuntime.js'
);
const { GroupReplyPolicy } = await import(
  '../../packages/modules/conversation/dist/modules/conversation/src/public/index.js'
);
const { CommandPolicyService } = await import(
  '../../packages/modules/command-policy/dist/modules/command-policy/src/public/index.js'
);

function createGroup({
  groupJid = '120363400000000201@g.us',
  preferredSubject = 'Turma Wave 57',
  memberTagPolicy = 'owner_only',
  schedulingEnabled = true,
  allowLlmScheduling = true,
} = {}) {
  return {
    groupJid,
    preferredSubject,
    aliases: [],
    courseId: null,
    groupOwners: [
      {
        personId: 'person-owner',
        assignedAt: '2026-04-06T10:00:00.000Z',
        assignedBy: 'validator',
      },
    ],
    calendarAccessPolicy: {
      group: 'read',
      groupOwner: 'read_write',
      appOwner: 'read_write',
    },
    operationalSettings: {
      mode: 'com_agendamento',
      schedulingEnabled,
      allowLlmScheduling,
      memberTagPolicy,
    },
    lastRefreshedAt: '2026-04-06T10:00:00.000Z',
  };
}

function createHarness({
  group,
  appOwnerPersonIds = [],
  settings = {},
} = {}) {
  const selectedGroup = group ?? createGroup();
  const commandPolicy = new CommandPolicyService(
    {
      async listGroups() {
        return [selectedGroup];
      },
      async isGroupOwner(groupJid, personId) {
        return groupJid === selectedGroup.groupJid && personId === 'person-owner';
      },
      async getCalendarAccessPolicy() {
        return selectedGroup.calendarAccessPolicy;
      },
      async getOperationalSettings() {
        return selectedGroup.operationalSettings;
      },
    },
    {
      async isAppOwner(personId) {
        return Boolean(personId && appOwnerPersonIds.includes(personId));
      },
    },
    {
      assistantEnabled: true,
      schedulingEnabled: true,
      ownerTerminalEnabled: true,
      autoReplyEnabled: true,
      directRepliesEnabled: false,
      allowPrivateAssistant: true,
      authorizedGroupJids: [selectedGroup.groupJid],
      authorizedPrivateJids: [],
      ...settings,
    },
  );

  const runtime = new AgentRuntime(
    {
      async buildChatContext(input) {
        return {
          chatJid: input.chatJid,
          chatType: input.chatType,
          currentText: input.text,
          personId: input.personId,
          senderDisplayName: input.senderDisplayName,
          groupJid: input.groupJid ?? null,
          group: input.groupJid
            ? {
                groupJid: selectedGroup.groupJid,
                preferredSubject: selectedGroup.preferredSubject,
                aliases: selectedGroup.aliases,
                courseId: selectedGroup.courseId,
              }
            : null,
          recentMessages: [],
          relevantMessages: [],
          activeReference: null,
          personNotes: [],
          groupInstructions: 'Instrucoes da wave 57.',
          groupInstructionsSource: 'llm_instructions',
          groupKnowledgeSnippets: [],
          groupPolicy: null,
          generatedAt: '2026-04-06T10:00:00.000Z',
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
    commandPolicy,
    {
      async findByJid(groupJid) {
        return groupJid === selectedGroup.groupJid ? selectedGroup : undefined;
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
          intent: 'casual_chat',
        };
      },
    },
    {
      async parseSchedules() {
        throw new Error('schedule parser should not run in this test');
      },
      async chat() {
        return {
          runId: 'llm-wave57',
          providerId: 'deterministic',
          modelId: 'gpt-5.4',
          text: 'Resposta autorizada.',
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

  return {
    commandPolicy,
    groupReplyPolicy: new GroupReplyPolicy(commandPolicy),
    runtime,
    group: selectedGroup,
  };
}

function createTurnInput(group, personId) {
  return {
    messageId: `wave57-${personId}`,
    chatJid: group.groupJid,
    chatType: 'group',
    groupJid: group.groupJid,
    personId,
    senderDisplayName: personId,
    text: '@LumeHub confirma a aula.',
    wasTagged: true,
    isReplyToBot: false,
    allowActions: true,
  };
}

test('owner_only blocks tagged members who are not owners', async () => {
  const harness = createHarness({
    group: createGroup({
      memberTagPolicy: 'owner_only',
    }),
  });

  const input = createTurnInput(harness.group, 'person-member');
  const result = await harness.runtime.executeConversationTurn(input);
  const decision = await harness.groupReplyPolicy.decide(input, result);

  assert.equal(result.session.assistantAccess.allowed, false);
  assert.equal(result.session.assistantAccess.actorRole, 'member');
  assert.equal(result.session.assistantAccess.reasonCode, 'group_member_blocked_by_owner_policy');
  assert.match(result.session.assistantAccess.summary, /reserva o bot ao owner/u);
  assert.equal(result.replyText, null);
  assert.equal(decision.shouldReply, false);
  assert.equal(decision.reason, 'group_member_blocked_by_owner_policy');
});

test('owner_only still allows the group owner to talk to the bot and schedule through the assistant path', async () => {
  const harness = createHarness({
    group: createGroup({
      memberTagPolicy: 'owner_only',
    }),
  });

  const input = createTurnInput(harness.group, 'person-owner');
  const result = await harness.runtime.executeConversationTurn(input);
  const decision = await harness.groupReplyPolicy.decide(input, result);

  assert.equal(result.session.assistantAccess.allowed, true);
  assert.equal(result.session.assistantAccess.actorRole, 'group_owner');
  assert.equal(result.session.assistantAccess.reasonCode, 'group_owner_allowed');
  assert.equal(result.replyText, 'Resposta autorizada.');
  assert.equal(decision.shouldReply, true);
  assert.equal(decision.targetChatType, 'group');
  assert.equal(decision.targetChatJid, harness.group.groupJid);
});

test('members_can_tag keeps the group open to regular members', async () => {
  const harness = createHarness({
    group: createGroup({
      memberTagPolicy: 'members_can_tag',
    }),
  });

  const input = createTurnInput(harness.group, 'person-member');
  const result = await harness.runtime.executeConversationTurn(input);
  const decision = await harness.groupReplyPolicy.decide(input, result);

  assert.equal(result.session.assistantAccess.allowed, true);
  assert.equal(result.session.assistantAccess.actorRole, 'member');
  assert.equal(result.session.assistantAccess.reasonCode, 'group_member_allowed');
  assert.equal(result.replyText, 'Resposta autorizada.');
  assert.equal(decision.shouldReply, true);
});

test('app owner keeps an explicit override even when the group is blocked for members', async () => {
  const harness = createHarness({
    group: createGroup({
      memberTagPolicy: 'owner_only',
    }),
    appOwnerPersonIds: ['person-app-owner'],
    settings: {
      assistantEnabled: false,
      authorizedGroupJids: [],
    },
  });

  const input = createTurnInput(harness.group, 'person-app-owner');
  const result = await harness.runtime.executeConversationTurn(input);

  assert.equal(result.session.assistantAccess.allowed, true);
  assert.equal(result.session.assistantAccess.actorRole, 'app_owner');
  assert.equal(result.session.assistantAccess.reasonCode, 'app_owner_override');
  assert.equal(result.replyText, 'Resposta autorizada.');
});
