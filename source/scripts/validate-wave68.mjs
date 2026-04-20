import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  FakeSocketCoordinator,
  createLiveFetchMock,
  createLiveSandboxPath,
  escapeForRegExp,
  readJson,
  requestJson,
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
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave68-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const groupJid = '120363406000000068@g.us';
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid,
    groupLabel: 'Wave 68 Grupo Reminder',
    privateChatJid: '351920000068@s.whatsapp.net',
    privateChatLabel: 'Validator Wave68',
  });
  const runtimeConfig = await seedLiveRuntimeSandbox({
    sandboxPath,
    httpPort,
    webDistRootPath: WEB_DIST_ROOT,
    socketCoordinator,
    fetchMock,
  });
  runtimeConfig.operationalTickIntervalMs = 2_000;

  await writeJson(runtimeConfig.groupSeedFilePath, {
    schemaVersion: 1,
    groups: [
      {
        groupJid,
        preferredSubject: 'Wave 68 Grupo Reminder',
        aliases: ['Wave68'],
        courseId: 'wave68-course',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-04-20T09:00:00.000Z',
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
          memberTagPolicy: 'members_can_tag',
        },
        lastRefreshedAt: '2026-04-20T09:00:00.000Z',
      },
    ],
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
      authorizedGroupJids: [groupJid],
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
    updatedAt: '2026-04-20T09:00:00.000Z',
  });

  const bootstrap = new AppBootstrap({
    runtimeConfig,
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await waitUntil(() => socketCoordinator.latestSocket !== null);
    socketCoordinator.latestSocket.publishQr('wave68-live-qr');
    socketCoordinator.latestSocket.openSession();
    await waitUntil(async () => {
      const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
      return workspace.runtime.session.phase === 'open';
    });
    await run({ baseUrl, groupJid, socketCoordinator });
  } finally {
    await bootstrap.stop().catch(() => undefined);
    await rm(sandboxPath, { recursive: true, force: true });
  }
}

async function assertHeadlessRoute(url, expectedTexts) {
  let stdout = '';
  let stderr = '';

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    ({ stdout, stderr } = await runChromeDump(url));

    const missingTexts = expectedTexts.filter((expectedText) => !new RegExp(escapeForRegExp(expectedText), 'u').test(stdout));
    const hasRuntimeError = /(TypeError|ReferenceError|Uncaught|SEVERE)/u.test(stderr);
    const hasErrorUi = /Algo falhou ao carregar esta pagina/u.test(stdout);
    const looksUnhydrated = /<div id="app"><\/div>/u.test(stdout) && !/app-shell/u.test(stdout);

    if (missingTexts.length === 0 && !hasRuntimeError && !hasErrorUi) {
      return stdout;
    }

    if (!looksUnhydrated || attempt === 4) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  for (const expectedText of expectedTexts) {
    assert.match(stdout, new RegExp(escapeForRegExp(expectedText), 'u'));
  }

  assert.doesNotMatch(stderr, /(TypeError|ReferenceError|Uncaught|SEVERE)/u);
  assert.doesNotMatch(stdout, /Algo falhou ao carregar esta pagina/u);

  return stdout;
}

function formatLisbonLocalDate(date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatLisbonLocalTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function buildSoonEventSeed() {
  const soon = new Date(Date.now() - 60_000);
  soon.setSeconds(0, 0);

  return {
    localDate: formatLisbonLocalDate(soon),
    startTime: formatLisbonLocalTime(soon),
  };
}

await withLiveRuntime(async ({ baseUrl, groupJid, socketCoordinator }) => {
  const reminderPolicy = await requestJson(
    `${baseUrl}/api/groups/${encodeURIComponent(groupJid)}/reminder-policy`,
  );
  assert.equal(reminderPolicy.enabled, true);
  assert.ok(Array.isArray(reminderPolicy.canonicalVariables));

  const savedPolicy = await requestJson(
    `${baseUrl}/api/groups/${encodeURIComponent(groupJid)}/reminder-policy`,
    {
      method: 'PUT',
      body: {
        enabled: true,
        reminders: [
          {
            ruleId: 'wave68-before-1m',
            kind: 'relative_before_event',
            label: '1 min antes',
            enabled: true,
            daysBeforeEvent: 0,
            offsetMinutesBeforeEvent: 1,
            messageTemplate:
              'Daqui a {{minutes_until_event}} minuto(s) comeca {{event_title}} para {{group_label}}.',
            llmPromptTemplate:
              'Escreve um lembrete curto para WhatsApp. Contexto: falta {{minutes_until_event}} minuto para {{event_title}} no grupo {{group_label}}.',
          },
          {
            ruleId: 'wave68-day-before',
            kind: 'fixed_local_time',
            label: 'Dia anterior as 18:00',
            enabled: true,
            daysBeforeEvent: 1,
            localTime: '18:00',
            messageTemplate: 'Amanha tens {{event_title}} as {{event_time}}.',
            llmPromptTemplate:
              'Escreve um lembrete simples para o dia anterior sobre {{event_title}} no grupo {{group_label}}.',
          },
          {
            ruleId: 'wave68-after-30m',
            kind: 'relative_after_event',
            label: '30 min depois',
            enabled: true,
            offsetMinutesAfterEvent: 30,
            messageTemplate: 'Ja passaram {{minutes_since_event}} minutos desde {{event_title}}.',
            llmPromptTemplate:
              'Escreve um follow-up curto para WhatsApp, 30 minutos depois de {{event_title}} no grupo {{group_label}}.',
          },
        ],
      },
    },
  );

  assert.equal(savedPolicy.enabled, true);
  assert.equal(savedPolicy.reminders.length, 3);
  assert.deepEqual(
    savedPolicy.reminders.map((reminder) => reminder.summaryLabel),
    ['1 min antes', 'Dia anterior as 18:00', '30 min depois'],
  );
  assert.ok(savedPolicy.canonicalVariables.some((variable) => variable.key === 'event_title'));

  const intelligence = await requestJson(
    `${baseUrl}/api/groups/${encodeURIComponent(groupJid)}/intelligence`,
  );
  assert.equal(intelligence.policy.reminders.length, 3);

  const soonEvent = buildSoonEventSeed();
  const createdEvent = await requestJson(`${baseUrl}/api/schedules`, {
    method: 'POST',
    body: {
      groupJid,
      title: 'Wave 68 Aula de teste',
      localDate: soonEvent.localDate,
      startTime: soonEvent.startTime,
      durationMinutes: 45,
      notes: 'Evento criado pelo validador da Wave 68.',
      timeZone: 'Europe/Lisbon',
    },
  });

  assert.equal(createdEvent.notificationRuleLabels.length, 3);
  assert.equal(createdEvent.reminderLifecycle.generated, 3);
  assert.match(createdEvent.notificationRuleLabels.join(' | '), /1 min antes/u);
  assert.match(createdEvent.notificationRuleLabels.join(' | '), /30 min depois/u);
  assert.ok(createdEvent.nextReminderAt);

  await waitUntil(async () => {
    const queue = await readJson(`${baseUrl}/api/instruction-queue`);
    return queue.some(
      (instruction) =>
        instruction.sourceType === 'notification_reminder'
        && instruction.actions.some((action) => action.type === 'notification_reminder_delivery'),
    );
  }, 40_000, 300);

  await waitUntil(
    () =>
      (socketCoordinator.latestSocket?.sentMessages ?? []).some(
        (message) => message.chatJid === groupJid && typeof message.text === 'string' && message.text.length > 0,
      ),
    40_000,
    300,
  );

  const queue = await readJson(`${baseUrl}/api/instruction-queue`);
  const reminderInstruction = queue.find((instruction) => instruction.sourceType === 'notification_reminder') ?? null;
  assert.ok(reminderInstruction);
  assert.ok(
    reminderInstruction.actions.some(
      (action) =>
        action.type === 'notification_reminder_delivery'
        && (action.status === 'completed' || action.status === 'running'),
    ),
  );

  const planner = await readJson(
    `${baseUrl}/api/schedules?groupJid=${encodeURIComponent(groupJid)}&timeZone=${encodeURIComponent('Europe/Lisbon')}`,
  );
  const eventFromWeek = planner.events.find((event) => event.eventId === createdEvent.eventId);
  assert.ok(eventFromWeek);
  assert.equal(eventFromWeek.notificationRuleLabels.length, 3);
  assert.ok(eventFromWeek.reminderLifecycle.generated >= 1);
  assert.ok(eventFromWeek.reminderLifecycle.prepared + eventFromWeek.reminderLifecycle.sent >= 1);

  const groupsDom = await assertHeadlessRoute(`${baseUrl}/groups?mode=live`, [
    'Pagina do grupo',
    'Lembretes deste grupo',
    'Adicionar lembrete',
    'Guardar lembretes',
    'Preview da copy',
    'X tempo depois',
  ]);

  assert.doesNotMatch(groupsDom, /Algo falhou ao carregar esta pagina/u);

  const weekDom = await assertHeadlessRoute(`${baseUrl}/week?mode=live`, [
    'Calendario',
    'Proximo lembrete',
    'Gerados',
    'Preparados',
    'Enviados',
  ]);

  assert.match(weekDom, /Wave 68 Aula de teste/u);

  const diagnostics = await readJson(`${baseUrl}/api/runtime/diagnostics`);
  assert.equal(diagnostics.phase, 'running');
  assert.equal(diagnostics.readiness.status, 'healthy');
});
