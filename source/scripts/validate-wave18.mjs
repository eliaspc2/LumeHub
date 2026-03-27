import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { AppBootstrap } = await import('../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/AppBootstrap.js');

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave18-'));

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
  const codexAuthFile = join(runtimeRootPath, 'auth.json');
  const systemdUserPath = join(runtimeRootPath, 'systemd-user');
  const groupProgramming = '120363402446203704@g.us';

  await mkdir(configRootPath, { recursive: true });
  await mkdir(runtimeRootPath, { recursive: true });

  await writeFile(
    groupSeedFilePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        groups: [
          {
            groupJid: groupProgramming,
            preferredSubject: 'EFA Programacao A',
            aliases: ['Prog A'],
            courseId: 'course-programming',
            groupOwners: [
              {
                personId: 'person-ana',
                assignedAt: '2026-03-27T10:00:00.000Z',
                assignedBy: 'person-app-owner',
              },
            ],
            calendarAccessPolicy: {
              group: 'read',
              groupOwner: 'read_write',
              appOwner: 'read_write',
            },
            lastRefreshedAt: '2026-03-27T10:00:00.000Z',
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
            groupJid: groupProgramming,
            preferredSubject: 'EFA Programacao A',
            aliases: ['Prog A'],
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
            createdAt: '2026-03-27T10:00:00.000Z',
            updatedAt: '2026-03-27T10:00:00.000Z',
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
            createdAt: '2026-03-27T10:00:00.000Z',
            updatedAt: '2026-03-27T10:00:00.000Z',
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
            targetGroupJids: [groupProgramming],
            targetCourseIds: [],
            targetDisciplineCodes: ['UFCD-0777'],
            enabled: true,
            requiresConfirmation: false,
            notes: 'Distribuicao base de programacao.',
            createdAt: '2026-03-27T10:00:00.000Z',
            updatedAt: '2026-03-27T10:00:00.000Z',
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
        instructions: [],
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    codexAuthFile,
    JSON.stringify(
      {
        schemaVersion: 1,
        accessToken: 'test-token',
      },
      null,
      2,
    ),
    'utf8',
  );

  const bootstrap = new AppBootstrap({
    runtimeConfig: {
      rootPath: sandboxPath,
      dataRootPath,
      configRootPath,
      runtimeRootPath,
      groupSeedFilePath,
      catalogFilePath,
      peopleFilePath,
      rulesFilePath,
      settingsFilePath,
      queueFilePath,
      powerStateFilePath,
      inhibitorStatePath,
      hostStateFilePath,
      backendStateFilePath,
      systemdUserPath,
      codexAuthFile,
      canonicalCodexAuthFile: codexAuthFile,
      startByPreparingCodexAuth: true,
      hostWorkingDirectory: sandboxPath,
      hostExecStart: '/usr/bin/env node /tmp/lume-hub-host.js',
      operationalTickIntervalMs: 5_000,
    },
  });

  await bootstrap.start();

  try {
    const runtime = bootstrap.getRuntime();

    assert.equal(runtime.moduleGraph.loadOrder.length, 15);
    assert.deepEqual(runtime.moduleGraph.loadOrder.slice(0, 4), [
      'admin-config',
      'group-directory',
      'people-memory',
      'discipline-catalog',
    ]);
    assert(runtime.moduleGraph.loadOrder.indexOf('schedule-weeks') < runtime.moduleGraph.loadOrder.indexOf('schedule-events'));
    assert(
      runtime.moduleGraph.loadOrder.indexOf('notification-rules') <
        runtime.moduleGraph.loadOrder.indexOf('notification-jobs'),
    );
    assert(runtime.moduleGraph.loadOrder.indexOf('system-power') < runtime.moduleGraph.loadOrder.indexOf('host-lifecycle'));
    assert(runtime.moduleGraph.loadOrder.indexOf('watchdog') < runtime.moduleGraph.loadOrder.indexOf('health-monitor'));

    assert.equal(runtime.listModules().length, 15);
    assert.equal(runtime.getContext().container.resolve('module:admin-config'), runtime.modules.adminConfigModule);
    assert.equal(runtime.getContext().container.resolve('adapter:http-server'), runtime.httpServer);

    const dashboardResponse = await runtime.inject({
      method: 'GET',
      path: '/api/dashboard',
    });
    assert.equal(dashboardResponse.statusCode, 200);
    assert.equal(dashboardResponse.body.health.status, 'healthy');
    assert.equal(dashboardResponse.body.groups.total, 1);
    assert.equal(dashboardResponse.body.routing.totalRules, 1);
    assert.equal(dashboardResponse.body.hostCompanion.authExists, true);
    assert.ok(dashboardResponse.body.hostCompanion.lastHeartbeatAt);

    const settingsResponse = await runtime.inject({
      method: 'GET',
      path: '/api/settings',
    });
    assert.equal(settingsResponse.statusCode, 200);
    assert.equal(settingsResponse.body.hostStatus.auth.exists, true);
    assert.equal(settingsResponse.body.authRouterStatus.currentSelection.accountId, 'canonical-live');

    const groupsResponse = await runtime.inject({
      method: 'GET',
      path: '/api/groups',
    });
    assert.equal(groupsResponse.statusCode, 200);
    assert.equal(groupsResponse.body.length, 1);
    assert.equal(groupsResponse.body[0].groupOwners[0].personId, 'person-ana');

    const watchdogResponse = await runtime.inject({
      method: 'GET',
      path: '/api/watchdog/issues',
    });
    assert.equal(watchdogResponse.statusCode, 200);
    assert.deepEqual(watchdogResponse.body, []);

    const authRouterResponse = await runtime.inject({
      method: 'GET',
      path: '/api/settings/codex-auth-router',
    });
    assert.equal(authRouterResponse.statusCode, 200);
    assert.equal(authRouterResponse.body.canonicalExists, true);
    assert.equal(authRouterResponse.body.currentSelection.accountId, 'canonical-live');
  } finally {
    await bootstrap.stop();
  }
} finally {
  await rm(sandboxPath, { recursive: true, force: true });
}
