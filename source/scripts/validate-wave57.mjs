import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FakeSocketCoordinator,
  createLiveFetchMock,
  createLiveSandboxPath,
  escapeForRegExp,
  readJson,
  reservePort,
  runChromeDump,
  seedLiveRuntimeSandbox,
  waitUntil,
  waitUntilReady,
  writeJson,
} from '../tests/helpers/live-runtime-fixtures.mjs';

const { AppBootstrap } = await import(
  '../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/AppBootstrap.js'
);

const WEB_DIST_ROOT = fileURLToPath(new URL('../apps/lume-hub-web/dist/', import.meta.url));

async function withLiveRuntime(run) {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave57-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const ownerOnlyGroupJid = '120363407777777771@g.us';
  const membersCanTagGroupJid = '120363407777777772@g.us';
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid: ownerOnlyGroupJid,
    groupLabel: 'Ballet Owner Only',
    privateChatJid: '351910000001@s.whatsapp.net',
    privateChatLabel: 'Validator Wave57',
  });
  const runtimeConfig = await seedLiveRuntimeSandbox({
    sandboxPath,
    httpPort,
    webDistRootPath: WEB_DIST_ROOT,
    socketCoordinator,
    fetchMock,
  });

  await writeJson(runtimeConfig.groupSeedFilePath, {
    schemaVersion: 1,
    groups: [
      {
        groupJid: ownerOnlyGroupJid,
        preferredSubject: 'Ballet Owner Only',
        aliases: ['Owner Only'],
        courseId: 'wave57-owner-only',
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
          schedulingEnabled: true,
          allowLlmScheduling: true,
          memberTagPolicy: 'owner_only',
        },
        lastRefreshedAt: '2026-04-06T10:00:00.000Z',
      },
      {
        groupJid: membersCanTagGroupJid,
        preferredSubject: 'Ballet Aberto',
        aliases: ['Members Can Tag'],
        courseId: 'wave57-open',
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
          schedulingEnabled: true,
          allowLlmScheduling: false,
          memberTagPolicy: 'members_can_tag',
        },
        lastRefreshedAt: '2026-04-06T10:05:00.000Z',
      },
    ],
  });

  await writeJson(runtimeConfig.peopleFilePath, {
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
        createdAt: '2026-04-06T10:00:00.000Z',
        updatedAt: '2026-04-06T10:00:00.000Z',
      },
      {
        personId: 'person-owner',
        displayName: 'Owner do Grupo',
        identifiers: [
          {
            kind: 'whatsapp_jid',
            value: '351910000002@s.whatsapp.net',
          },
        ],
        globalRoles: [],
        createdAt: '2026-04-06T10:00:00.000Z',
        updatedAt: '2026-04-06T10:00:00.000Z',
      },
      {
        personId: 'person-member',
        displayName: 'Membro Normal',
        identifiers: [
          {
            kind: 'whatsapp_jid',
            value: '351910000003@s.whatsapp.net',
          },
        ],
        globalRoles: [],
        createdAt: '2026-04-06T10:00:00.000Z',
        updatedAt: '2026-04-06T10:00:00.000Z',
      },
    ],
    notes: [],
  });

  await writeJson(runtimeConfig.settingsFilePath, {
    schemaVersion: 1,
    commands: {
      assistantEnabled: true,
      schedulingEnabled: true,
      ownerTerminalEnabled: true,
      autoReplyEnabled: true,
      directRepliesEnabled: false,
      allowPrivateAssistant: true,
      authorizedGroupJids: [ownerOnlyGroupJid, membersCanTagGroupJid],
      authorizedPrivateJids: ['351910000001@s.whatsapp.net'],
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
    updatedAt: '2026-04-06T10:00:00.000Z',
  });

  const conversationAuditFilePath = join(runtimeConfig.dataRootPath, 'runtime', 'conversation-audit.json');
  await mkdir(join(runtimeConfig.dataRootPath, 'runtime'), { recursive: true });
  await writeJson(conversationAuditFilePath, {
    schemaVersion: 1,
    entries: [
      {
        auditId: 'wave57-audit-blocked-member',
        messageId: 'wamid.wave57.blocked.001',
        chatJid: ownerOnlyGroupJid,
        chatType: 'group',
        personId: 'person-member',
        intent: 'casual_chat',
        selectedTools: ['chat_reply'],
        replyMode: 'silent',
        replyText: null,
        targetChatType: null,
        targetChatJid: null,
        memoryUsage: {
          scope: 'group',
          groupJid: ownerOnlyGroupJid,
          groupLabel: 'Ballet Owner Only',
          instructionsSource: 'llm_instructions',
          instructionsApplied: true,
          knowledgeSnippetCount: 1,
          knowledgeDocuments: [
            {
              documentId: 'owner-policy-doc',
              title: 'Politica de ownership',
              filePath: 'docs/owner-policy.md',
            },
          ],
        },
        schedulingInsight: null,
        permissionInsight: {
          allowed: false,
          actorRole: 'member',
          chatType: 'group',
          groupJid: ownerOnlyGroupJid,
          interactionPolicy: 'owner_only',
          reasonCode: 'group_member_blocked_by_owner_policy',
          summary: 'Este grupo reserva o bot ao owner; membros nao podem dirigi-lo por tag.',
        },
        createdAt: '2026-04-06T10:10:00.000Z',
      },
      {
        auditId: 'wave57-audit-owner',
        messageId: 'wamid.wave57.owner.002',
        chatJid: ownerOnlyGroupJid,
        chatType: 'group',
        personId: 'person-owner',
        intent: 'scheduling_request',
        selectedTools: ['schedule_parse', 'chat_reply'],
        replyMode: 'same_chat',
        replyText: 'Pedido aceite pelo owner.',
        targetChatType: 'group',
        targetChatJid: ownerOnlyGroupJid,
        memoryUsage: {
          scope: 'group',
          groupJid: ownerOnlyGroupJid,
          groupLabel: 'Ballet Owner Only',
          instructionsSource: 'llm_instructions',
          instructionsApplied: true,
          knowledgeSnippetCount: 1,
          knowledgeDocuments: [
            {
              documentId: 'calendar-policy-doc',
              title: 'Calendar policy',
              filePath: 'docs/calendar-policy.md',
            },
          ],
        },
        schedulingInsight: {
          requestedAccessMode: 'read_write',
          resolvedGroupJids: [ownerOnlyGroupJid],
          memoryScope: 'group',
          memoryGroupJid: ownerOnlyGroupJid,
          memoryGroupLabel: 'Ballet Owner Only',
        },
        permissionInsight: {
          allowed: true,
          actorRole: 'group_owner',
          chatType: 'group',
          groupJid: ownerOnlyGroupJid,
          interactionPolicy: 'owner_only',
          reasonCode: 'group_owner_allowed',
          summary: 'O owner do grupo pode dirigir o assistente aqui.',
        },
        createdAt: '2026-04-06T10:11:00.000Z',
      },
    ],
  });

  const bootstrap = new AppBootstrap({
    runtimeConfig,
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await waitUntil(() => socketCoordinator.latestSocket !== null);
    socketCoordinator.latestSocket.publishQr('wave57-live-qr');
    socketCoordinator.latestSocket.openSession();
    await waitUntil(async () => {
      const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
      return workspace.runtime.session.phase === 'open';
    });
    await run({
      baseUrl,
      ownerOnlyGroupJid,
    });
  } finally {
    await bootstrap.stop().catch(() => undefined);
    await rm(sandboxPath, { recursive: true, force: true });
  }
}

async function assertHeadlessRoute(url, expectedTexts) {
  const { stdout, stderr } = await runChromeDump(url);

  for (const expectedText of expectedTexts) {
    assert.match(stdout, new RegExp(escapeForRegExp(expectedText), 'u'));
  }

  assert.doesNotMatch(stderr, /(TypeError|ReferenceError|Uncaught|SEVERE)/u);
  assert.doesNotMatch(stdout, /Algo falhou ao carregar esta pagina/u);
  return stdout;
}

async function requestJson(baseUrl, path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`);
  const payload = await response.json();
  assert.equal(response.status, expectedStatus, `Expected ${expectedStatus} for GET ${path} but got ${response.status}.`);
  return payload;
}

await withLiveRuntime(async ({ baseUrl, ownerOnlyGroupJid }) => {
  const groupDom = await assertHeadlessRoute(`${baseUrl}/groups/${encodeURIComponent(ownerOnlyGroupJid)}?mode=live`, [
    'Permissoes efetivas',
    'App owner',
    'Owner do grupo',
    'Membro',
    'este grupo reserva o bot ao owner',
  ]);
  assert.match(groupDom, /Pode pedir scheduling assistido pela LLM/u);

  const whatsAppDom = await assertHeadlessRoute(`${baseUrl}/whatsapp?mode=live`, [
    'Grupos do WhatsApp',
    'Permissoes efetivas',
    'Ballet Owner Only',
    'App owner',
    'Membro',
  ]);
  assert.match(whatsAppDom, /Pode chamar o bot por tag ou reply/u);

  const assistantDom = await assertHeadlessRoute(`${baseUrl}/assistant?mode=live`, [
    'Contexto e runs recentes',
    'Este grupo reserva o bot ao owner; membros nao podem dirigi-lo por tag.',
    'O owner do grupo pode dirigir o assistente aqui.',
  ]);
  assert.match(assistantDom, /docs Politica de ownership/u);

  const logs = await requestJson(baseUrl, '/api/logs/conversations?limit=5');
  assert.equal(logs.length, 2);
  assert.equal(logs[0].permissionInsight.reasonCode, 'group_owner_allowed');
  assert.equal(logs[1].permissionInsight.reasonCode, 'group_member_blocked_by_owner_policy');
});
