import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { AdminConfigModule } = await import(
  '../packages/modules/admin-config/dist/modules/admin-config/src/public/index.js'
);
const { GroupDirectoryModule } = await import(
  '../packages/modules/group-directory/dist/modules/group-directory/src/public/index.js'
);
const { AudienceRoutingModule } = await import(
  '../packages/modules/audience-routing/dist/modules/audience-routing/src/public/index.js'
);
const { InstructionQueueModule } = await import(
  '../packages/modules/instruction-queue/dist/modules/instruction-queue/src/public/index.js'
);
const { WatchdogModule, RuntimeWatchdogIssueRepository } = await import(
  '../packages/modules/watchdog/dist/modules/watchdog/src/public/index.js'
);
const { HealthMonitorModule } = await import(
  '../packages/modules/health-monitor/dist/modules/health-monitor/src/public/index.js'
);
const { SystemPowerModule } = await import(
  '../packages/modules/system-power/dist/modules/system-power/src/public/index.js'
);
const { HostLifecycleModule } = await import(
  '../packages/modules/host-lifecycle/dist/modules/host-lifecycle/src/public/index.js'
);
const { FastifyHttpServer } = await import(
  '../packages/adapters/http-fastify/dist/adapters/http-fastify/src/public/index.js'
);
const { WebSocketGateway } = await import('../packages/adapters/ws-fastify/dist/index.js');
const { InMemoryFrontendApiTransport } = await import(
  '../packages/adapters/frontend-api-client/dist/adapters/frontend-api-client/src/public/index.js'
);
const { WebAppBootstrap } = await import('../apps/lume-hub-web/dist/apps/lume-hub-web/src/app/WebAppBootstrap.js');
const { AppShell } = await import('../apps/lume-hub-web/dist/apps/lume-hub-web/src/shell/AppShell.js');

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave8-'));

try {
  const dataRootPath = join(sandboxPath, 'data');
  const configRootPath = join(sandboxPath, 'config');
  const runtimeRootPath = join(sandboxPath, 'runtime');
  const groupSeedFilePath = join(configRootPath, 'groups.json');
  const catalogFilePath = join(configRootPath, 'discipline_catalog.json');
  const peopleFilePath = join(configRootPath, 'people.json');
  const rulesFilePath = join(configRootPath, 'audience_rules.json');
  const settingsFilePath = join(runtimeRootPath, 'system-settings.json');
  const queueFilePath = join(runtimeRootPath, 'instruction-queue.json');
  const powerStateFilePath = join(runtimeRootPath, 'power-policy-state.json');
  const inhibitorStatePath = join(runtimeRootPath, 'sleep-inhibitor.json');
  const hostStateFilePath = join(runtimeRootPath, 'host-runtime-state.json');
  const backendStateFilePath = join(runtimeRootPath, 'host-state.json');
  const systemdUserPath = join(runtimeRootPath, 'systemd-user');
  const codexAuthFile = join(runtimeRootPath, 'auth.json');
  const groupProgrammingA = '120363402446203704@g.us';
  const groupProgrammingB = '120363402446203705@g.us';
  const groupCyber = '120363407086801381@g.us';

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
            aliases: ['Prog A'],
            courseId: 'course-programming',
            groupOwners: [
              {
                personId: 'person-ana',
                assignedAt: '2026-03-26T20:00:00.000Z',
                assignedBy: 'person-app-owner',
              },
            ],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-26T20:00:00.000Z',
          },
          {
            groupJid: groupProgrammingB,
            preferredSubject: 'EFA Programacao B',
            aliases: ['Prog B'],
            courseId: 'course-programming',
            groupOwners: [],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-26T20:00:00.000Z',
          },
          {
            groupJid: groupCyber,
            preferredSubject: 'CET Ciberseguranca',
            aliases: ['Cyber'],
            courseId: 'course-cyber',
            groupOwners: [],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-26T20:00:00.000Z',
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
            aliases: ['Prog A'],
          },
          {
            courseId: 'course-programming',
            title: 'UFCD - Programacao',
            groupJid: groupProgrammingB,
            preferredSubject: 'EFA Programacao B',
            aliases: ['Prog B'],
          },
          {
            courseId: 'course-cyber',
            title: 'UC - Ciberseguranca',
            groupJid: groupCyber,
            preferredSubject: 'CET Ciberseguranca',
            aliases: ['Cyber'],
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
            createdAt: '2026-03-26T20:00:00.000Z',
            updatedAt: '2026-03-26T20:00:00.000Z',
          },
          {
            personId: 'person-ana',
            displayName: 'Ana Formadora',
            identifiers: [
              {
                kind: 'whatsapp_jid',
                value: '351910000001@s.whatsapp.net',
              },
            ],
            globalRoles: ['member'],
            createdAt: '2026-03-26T20:00:00.000Z',
            updatedAt: '2026-03-26T20:00:00.000Z',
          },
          {
            personId: 'person-rui',
            displayName: 'Rui Coordenador',
            identifiers: [
              {
                kind: 'whatsapp_jid',
                value: '351910000002@s.whatsapp.net',
              },
            ],
            globalRoles: ['member'],
            createdAt: '2026-03-26T20:00:00.000Z',
            updatedAt: '2026-03-26T20:00:00.000Z',
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
            ruleId: 'rule-programming',
            personId: 'person-ana',
            identifiers: [],
            targetGroupJids: [groupProgrammingA],
            targetCourseIds: [],
            targetDisciplineCodes: ['UFCD-0777'],
            enabled: true,
            requiresConfirmation: false,
            notes: 'Distribuicao base de programacao.',
            createdAt: '2026-03-26T20:00:00.000Z',
            updatedAt: '2026-03-26T20:00:00.000Z',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    queueFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        instructions: [
          {
            instructionId: 'instruction-queued',
            sourceType: 'fanout_request',
            sourceMessageId: 'wamid.queued',
            mode: 'confirmed',
            status: 'queued',
            metadata: {
              preview: true,
            },
            actions: [
              {
                actionId: 'action-queued-1',
                type: 'fanout_send',
                dedupeKey: 'queued-1',
                targetGroupJid: groupProgrammingA,
                payload: {
                  messageText: 'Mensagem em fila',
                },
                status: 'pending',
                attemptCount: 0,
                lastError: null,
                result: null,
                lastAttemptAt: null,
                completedAt: null,
              },
            ],
            createdAt: '2026-03-26T20:00:00.000Z',
            updatedAt: '2026-03-26T20:00:00.000Z',
          },
          {
            instructionId: 'instruction-completed',
            sourceType: 'fanout_request',
            sourceMessageId: 'wamid.completed',
            mode: 'confirmed',
            status: 'completed',
            metadata: {},
            actions: [
              {
                actionId: 'action-completed-1',
                type: 'fanout_send',
                dedupeKey: 'completed-1',
                targetGroupJid: groupProgrammingA,
                payload: {
                  messageText: 'Mensagem concluida',
                },
                status: 'completed',
                attemptCount: 1,
                lastError: null,
                result: {
                  externalMessageId: 'wamid.external-1',
                },
                lastAttemptAt: '2026-03-26T20:01:00.000Z',
                completedAt: '2026-03-26T20:01:00.000Z',
              },
            ],
            createdAt: '2026-03-26T20:01:00.000Z',
            updatedAt: '2026-03-26T20:01:00.000Z',
          },
          {
            instructionId: 'instruction-partial',
            sourceType: 'fanout_request',
            sourceMessageId: 'wamid.partial',
            mode: 'confirmed',
            status: 'partial_failed',
            metadata: {},
            actions: [
              {
                actionId: 'action-partial-1',
                type: 'fanout_send',
                dedupeKey: 'partial-1',
                targetGroupJid: groupProgrammingA,
                payload: {
                  messageText: 'Mensagem parcial',
                },
                status: 'completed',
                attemptCount: 1,
                lastError: null,
                result: {
                  externalMessageId: 'wamid.external-2',
                },
                lastAttemptAt: '2026-03-26T20:02:00.000Z',
                completedAt: '2026-03-26T20:02:00.000Z',
              },
              {
                actionId: 'action-partial-2',
                type: 'fanout_send',
                dedupeKey: 'partial-2',
                targetGroupJid: groupProgrammingB,
                payload: {
                  messageText: 'Mensagem parcial',
                },
                status: 'failed',
                attemptCount: 2,
                lastError: 'temporary_failure',
                result: null,
                lastAttemptAt: '2026-03-26T20:02:30.000Z',
                completedAt: '2026-03-26T20:02:30.000Z',
              },
            ],
            createdAt: '2026-03-26T20:02:00.000Z',
            updatedAt: '2026-03-26T20:02:30.000Z',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(codexAuthFile, '{\"token\":\"test\"}\n', 'utf8');

  const fakeNotificationJobs = [
    {
      jobId: 'job-pending',
      status: 'pending',
      groupJid: groupProgrammingA,
      sendAt: '2026-03-26T20:10:00.000Z',
      disabledAt: null,
      suppressedAt: null,
    },
    {
      jobId: 'job-waiting',
      status: 'waiting_confirmation',
      groupJid: groupProgrammingB,
      sendAt: '2026-03-26T20:11:00.000Z',
      disabledAt: null,
      suppressedAt: null,
    },
    {
      jobId: 'job-sent',
      status: 'sent',
      groupJid: groupCyber,
      sendAt: '2026-03-26T20:12:00.000Z',
      disabledAt: null,
      suppressedAt: null,
    },
  ];

  const adminConfig = new AdminConfigModule({
    settingsFilePath,
  });
  const groupDirectory = new GroupDirectoryModule({
    dataRootPath,
    groupSeedFilePath,
  });
  const audienceRouting = new AudienceRoutingModule({
    dataRootPath,
    groupSeedFilePath,
    catalogFilePath,
    peopleFilePath,
    rulesFilePath,
  });
  const instructionQueue = new InstructionQueueModule({
    queueFilePath,
  });
  const issueRepository = new RuntimeWatchdogIssueRepository({
    dataRootPath,
  });

  await issueRepository.saveIssue({
    issueId: 'issue-watchdog-1',
    kind: 'waiting_confirmation_timeout',
    jobId: 'job-waiting',
    weekId: '2026-W13',
    groupJid: groupProgrammingB,
    groupLabel: 'EFA Programacao B',
    openedAt: '2026-03-26T20:15:00.000Z',
    resolvedAt: null,
    status: 'open',
    summary: 'Confirmacao em atraso para a turma B.',
  });

  const fakeNotificationJobRepository = {
    async listJobs() {
      return fakeNotificationJobs;
    },
  };

  const watchdog = new WatchdogModule({
    dataRootPath,
    repository: issueRepository,
    notificationJobRepository: fakeNotificationJobRepository,
  });
  const healthMonitor = new HealthMonitorModule({
    notificationJobRepository: fakeNotificationJobRepository,
    watchdogIssueRepository: issueRepository,
    moduleHealthProvider: async () => [
      {
        status: 'healthy',
        details: {
          module: 'http',
        },
      },
      {
        status: 'degraded',
        details: {
          module: 'whatsapp',
        },
      },
    ],
  });
  const systemPower = new SystemPowerModule({
    stateFilePath: powerStateFilePath,
    inhibitorStatePath,
  });

  await systemPower.updatePowerPolicy({
    enabled: true,
    mode: 'always_inhibit',
    preferredReasons: ['host_companion'],
  });
  await systemPower.evaluatePowerPolicy({
    activeReasons: ['host_companion'],
  });

  const hostLifecycle = new HostLifecycleModule({
    stateFilePath: hostStateFilePath,
    backendStateFilePath,
    systemdUserPath,
    workingDirectory: sandboxPath,
    execStart: '/usr/bin/env node fake-host.js',
    codexAuthFile,
    canonicalCodexAuthFile: codexAuthFile,
    publishHeartbeatOnStart: false,
    powerStatusProvider: async () => {
      const powerStatus = await systemPower.getPowerStatus();

      return {
        policyMode: powerStatus.policy.mode,
        inhibitorActive: powerStatus.inhibitorActive,
        leaseId: powerStatus.activeLease?.leaseId ?? null,
        explanation: powerStatus.explanation,
      };
    },
  });

  await hostLifecycle.enableStartWithSystem({
    codexAuthFile,
  });
  await hostLifecycle.publishHeartbeat({
    now: new Date('2026-03-26T20:20:00.000Z'),
  });

  const webSocketGateway = new WebSocketGateway();
  const observedEvents = [];
  const wsSession = webSocketGateway.connect((event) => {
    observedEvents.push(event);
  });

  const server = new FastifyHttpServer({
    modules: {
      adminConfig,
      audienceRouting,
      groupDirectory,
      healthMonitor,
      hostLifecycle,
      instructionQueue,
      systemPower,
      watchdog,
    },
    uiEventPublisher: webSocketGateway.publisher,
  });

  const transport = new InMemoryFrontendApiTransport(server, webSocketGateway);
  const bootstrap = new WebAppBootstrap({
    transport,
  });
  const client = bootstrap.apiClientProvider.getClient();

  const dashboard = await client.getDashboard();
  assert.equal(dashboard.groups.total, 3);
  assert.equal(dashboard.distributions.total, 3);
  assert.equal(dashboard.watchdog.openIssues, 1);

  const replacedOwners = await client.replaceGroupOwners(groupProgrammingB, [
    {
      personId: 'person-rui',
      assignedBy: 'person-app-owner',
    },
  ]);
  assert.deepEqual(
    replacedOwners.map((owner) => owner.personId),
    ['person-rui'],
  );

  const updatedCalendarAccess = await client.updateGroupCalendarAccessPolicy(groupProgrammingB, {
    groupOwner: 'read_write',
    group: 'read',
  });
  assert.equal(updatedCalendarAccess.groupOwner, 'read_write');

  const upsertedRule = await client.upsertRoutingRule({
    personId: 'person-rui',
    identifiers: [],
    targetGroupJids: [groupProgrammingB, groupCyber],
    targetCourseIds: [],
    targetDisciplineCodes: [],
    enabled: true,
    requiresConfirmation: true,
    notes: 'Fan-out experimental do Rui.',
  });
  assert.equal(upsertedRule.personId, 'person-rui');

  const updatedAdminSettings = await client.updateDefaultNotificationRules([
    {
      kind: 'relative_before_event',
      daysBeforeEvent: 1,
      offsetMinutesBeforeEvent: 0,
      enabled: true,
      label: '24h antes',
    },
    {
      kind: 'fixed_local_time',
      daysBeforeEvent: 0,
      localTime: '08:00',
      enabled: true,
      label: '08h local',
    },
  ]);
  assert.equal(updatedAdminSettings.ui.defaultNotificationRules.length, 2);
  assert.ok(updatedAdminSettings.ui.defaultNotificationRules.some((rule) => rule.kind === 'fixed_local_time'));

  const updatedPowerStatus = await client.updatePowerPolicy({
    enabled: true,
    mode: 'on_demand',
    preferredReasons: ['pending_jobs'],
  });
  assert.equal(updatedPowerStatus.policy.mode, 'on_demand');

  const disabledAutostart = await client.setAutostartEnabled(false);
  assert.equal(disabledAutostart.autostart.enabled, false);

  const enabledAutostart = await client.setAutostartEnabled(true);
  assert.equal(enabledAutostart.autostart.enabled, true);

  const routingRules = await client.listRoutingRules();
  assert.ok(routingRules.some((rule) => rule.personId === 'person-rui'));

  const distributions = await client.listDistributions();
  assert.ok(distributions.some((distribution) => distribution.status === 'queued'));
  assert.ok(distributions.some((distribution) => distribution.status === 'completed'));
  assert.ok(distributions.some((distribution) => distribution.status === 'partial_failed'));

  const listedIssues = await client.getWatchdogIssues();
  assert.equal(listedIssues.length, 1);
  assert.equal(listedIssues[0].status, 'open');

  const resolvedIssue = await client.resolveWatchdogIssue('issue-watchdog-1');
  assert.equal(resolvedIssue?.status, 'resolved');

  assert.ok(observedEvents.some((event) => event.topic === 'groups.owners.updated'));
  assert.ok(observedEvents.some((event) => event.topic === 'groups.calendar_access.updated'));
  assert.ok(observedEvents.some((event) => event.topic === 'routing.rule.updated'));
  assert.ok(observedEvents.some((event) => event.topic === 'settings.ui.updated'));
  assert.ok(observedEvents.some((event) => event.topic === 'settings.power.updated'));
  assert.ok(observedEvents.some((event) => event.topic === 'settings.autostart.updated'));
  assert.ok(observedEvents.some((event) => event.topic === 'watchdog.issue.resolved'));

  const shell = new AppShell(bootstrap.router, bootstrap.apiClientProvider.getBufferedEvents());
  const renderedShell = await shell.render();
  const groupsPage = renderedShell.pages.find((page) => page.route === '/groups');
  const routingPage = renderedShell.pages.find((page) => page.route === '/routing-fanout');
  const watchdogPage = renderedShell.pages.find((page) => page.route === '/watchdog');
  const settingsPage = renderedShell.pages.find((page) => page.route === '/settings');

  assert.ok(renderedShell.navigation.some((item) => item.route === '/groups'));
  assert.ok(renderedShell.navigation.some((item) => item.route === '/routing-fanout'));
  assert.ok(renderedShell.navigation.some((item) => item.route === '/watchdog'));
  assert.ok(renderedShell.navigation.some((item) => item.route === '/settings'));

  assert.ok(groupsPage);
  assert.match(groupsPage.sections[0].lines.join('\n'), /person-rui/);
  assert.match(groupsPage.sections[0].lines.join('\n'), /owner=read_write/);

  assert.ok(routingPage);
  assert.match(routingPage.sections[0].lines.join('\n'), /person-rui/);
  assert.match(routingPage.sections[1].lines.join('\n'), /status=queued/);
  assert.match(routingPage.sections[1].lines.join('\n'), /status=partial_failed/);

  assert.ok(watchdogPage);
  assert.match(watchdogPage.sections[0].lines.join('\n'), /resolved/);

  assert.ok(settingsPage);
  assert.equal(settingsPage.data.adminSettings.ui.defaultNotificationRules.length, 2);
  assert.equal(settingsPage.data.powerStatus.policy.mode, 'on_demand');
  assert.equal(settingsPage.data.hostStatus.autostart.enabled, true);

  assert.ok(renderedShell.contextPanel.some((line) => line.includes('settings.power.updated')));
  assert.ok(renderedShell.contextPanel.some((line) => line.includes('watchdog.issue.resolved')));

  wsSession.close();

  console.log(`Wave 8 validation passed in ${sandboxPath}`);
} finally {
  await rm(sandboxPath, {
    recursive: true,
    force: true,
  });
}
