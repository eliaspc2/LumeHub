import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const { FakeClock } = await import('../packages/foundation/clock/dist/index.js');
const { CodexAuthRouterModule } = await import(
  '../packages/modules/codex-auth-router/dist/modules/codex-auth-router/src/public/index.js'
);
const { AdminConfigModule } = await import(
  '../packages/modules/admin-config/dist/modules/admin-config/src/public/index.js'
);
const { FastifyHttpServer } = await import(
  '../packages/adapters/http-fastify/dist/adapters/http-fastify/src/public/index.js'
);
const { FrontendApiClient, InMemoryFrontendApiTransport } = await import(
  '../packages/adapters/frontend-api-client/dist/adapters/frontend-api-client/src/public/index.js'
);
const { SettingsCenterUiModule } = await import(
  '../packages/ui-modules/settings-center/dist/ui-modules/settings-center/src/index.js'
);
const { HostBootstrap } = await import('../apps/lume-hub-host/dist/apps/lume-hub-host/src/bootstrap/HostBootstrap.js');
const { HostModuleLoader } = await import('../apps/lume-hub-host/dist/apps/lume-hub-host/src/bootstrap/HostModuleLoader.js');

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave10-'));
let bootstrap;

try {
  const clock = new FakeClock(new Date('2026-03-26T22:10:00.000Z'));
  const canonicalAuthFile = join(sandboxPath, 'codex', 'auth.json');
  const primaryMirrorFile = join(sandboxPath, 'router-sources', 'primary', 'auth.json');
  const secondaryMirrorFile = join(sandboxPath, 'router-sources', 'secondary', 'auth.json');
  const routerStateFilePath = join(sandboxPath, 'data', 'runtime', 'codex-auth-router.state.json');
  const routerBackupDirectoryPath = join(sandboxPath, 'data', 'runtime', 'codex-auth-router-backups');
  const hostStateFilePath = join(sandboxPath, 'runtime', 'host', 'state', 'host-runtime-state.json');
  const backendStateFilePath = join(sandboxPath, 'runtime', 'lxd', 'host-mounts', 'data', 'runtime', 'host-state.json');
  const powerStateFilePath = join(sandboxPath, 'runtime', 'host', 'state', 'power-policy-state.json');
  const inhibitorStatePath = join(sandboxPath, 'runtime', 'host', 'state', 'sleep-inhibitor.json');
  const systemdUserPath = join(sandboxPath, 'runtime', 'host', 'systemd-user');
  const workingDirectory = join(sandboxPath, 'source');
  const appEntryPath = join(sandboxPath, 'bin', 'lume-hub-host.js');
  const settingsFilePath = join(sandboxPath, 'runtime', 'system', 'system-settings.json');
  const sourceAccounts = [
    {
      accountId: 'account-primary',
      label: 'Primary mirror',
      filePath: primaryMirrorFile,
      priority: 1,
    },
    {
      accountId: 'account-secondary',
      label: 'Secondary failover',
      filePath: secondaryMirrorFile,
      priority: 2,
    },
  ];

  await mkdir(dirname(canonicalAuthFile), { recursive: true });
  await mkdir(dirname(primaryMirrorFile), { recursive: true });
  await mkdir(dirname(secondaryMirrorFile), { recursive: true });
  await writeFile(canonicalAuthFile, '{"account":"primary-live","token":"token-primary"}\n', 'utf8');
  await writeFile(primaryMirrorFile, '{"account":"primary-live","token":"token-primary"}\n', 'utf8');
  await writeFile(secondaryMirrorFile, '{"account":"secondary-live","token":"token-secondary"}\n', 'utf8');

  const router = new CodexAuthRouterModule({
    canonicalAuthFilePath: canonicalAuthFile,
    stateFilePath: routerStateFilePath,
    backupDirectoryPath: routerBackupDirectoryPath,
    sourceAccounts,
    startByPreparingAuth: false,
  });

  const initialSelection = await router.prepareAuthForRequest({
    preferredAccountId: 'account-primary',
    reason: 'initial_prepare',
    now: clock.now(),
  });
  assert.equal(initialSelection.accountId, 'account-primary');
  assert.equal(initialSelection.switchPerformed, false);

  let routerStatus = await router.getStatus();
  assert.equal(routerStatus.currentSelection?.accountId, 'account-primary');
  assert.equal(routerStatus.canonicalExists, true);
  assert.ok(routerStatus.accountCount >= 3);

  clock.set(new Date('2026-03-26T22:11:00.000Z'));
  await router.reportFailure({
    accountId: 'account-primary',
    reason: 'oauth auth quota exceeded',
    now: clock.now(),
  });

  const failoverSelection = await router.prepareAuthForRequest({
    reason: 'failover_after_quota',
    now: clock.now(),
  });
  assert.equal(failoverSelection.accountId, 'account-secondary');
  assert.equal(failoverSelection.switchPerformed, true);
  assert.equal((await readFile(canonicalAuthFile, 'utf8')).includes('token-secondary'), true);

  clock.set(new Date('2026-03-26T22:12:00.000Z'));
  const forcedBackSelection = await router.forceSwitch('account-primary', {
    reason: 'manual_recover',
    now: clock.now(),
  });
  assert.equal(forcedBackSelection.accountId, 'account-primary');
  assert.equal(forcedBackSelection.switchPerformed, true);
  assert.equal((await readFile(canonicalAuthFile, 'utf8')).includes('token-primary'), true);

  routerStatus = await router.getStatus();
  assert.ok(routerStatus.switchHistory.some((entry) => entry.event === 'failure_reported'));
  assert.ok(routerStatus.switchHistory.some((entry) => entry.event === 'force_switch'));
  assert.ok(routerStatus.switchHistory.some((entry) => entry.backupFilePath));

  bootstrap = new HostBootstrap(
    new HostModuleLoader({
      rootPath: sandboxPath,
      clock,
      codexAuthFile: canonicalAuthFile,
      canonicalCodexAuthFile: canonicalAuthFile,
      codexAuthRouterStateFilePath: routerStateFilePath,
      codexAuthRouterBackupDirectoryPath: routerBackupDirectoryPath,
      codexAuthSources: sourceAccounts,
      hostStateFilePath,
      backendStateFilePath,
      powerStateFilePath,
      inhibitorStatePath,
      systemdUserPath,
      workingDirectory,
      execStart: `/usr/bin/env node ${appEntryPath}`,
      publishHeartbeatOnStart: false,
    }),
  );
  await bootstrap.start();

  const runtime = bootstrap.getRuntime();
  assert.ok(runtime);
  assert.ok(runtime.codexAuthRouterModule);

  clock.set(new Date('2026-03-26T22:13:00.000Z'));
  await bootstrap.heartbeat({
    now: clock.now(),
  });

  let backendStatus = JSON.parse(await readFile(backendStateFilePath, 'utf8'));
  assert.equal(backendStatus.authRouter.currentAccountId, 'account-primary');
  assert.equal(backendStatus.authRouter.canonicalAuthFilePath, canonicalAuthFile);
  assert.ok(backendStatus.authRouter.accountCount >= 3);

  const adminConfig = new AdminConfigModule({
    settingsFilePath,
  });
  const server = new FastifyHttpServer({
    modules: {
      adminConfig,
      audienceRouting: {
        async listSenderAudienceRules() {
          return [];
        },
        async upsertSenderAudienceRule(input) {
          return input;
        },
      },
      codexAuthRouter: runtime.codexAuthRouterModule,
      groupDirectory: {
        async listGroups() {
          return [];
        },
        async replaceGroupOwners() {
          return [];
        },
        async updateCalendarAccessPolicy(_groupJid, update) {
          return {
            group: update.group ?? 'read',
            groupOwner: update.groupOwner ?? 'read',
            appOwner: update.appOwner ?? 'read_write',
          };
        },
      },
      healthMonitor: {
        async getHealthSnapshot() {
          return {
            status: 'healthy',
            details: {
              module: 'http',
            },
            generatedAt: clock.now().toISOString(),
            modules: [],
          };
        },
        async getReadiness() {
          return {
            ready: true,
            status: 'healthy',
          };
        },
      },
      hostLifecycle: runtime.hostLifecycleModule,
      instructionQueue: {
        async listInstructions() {
          return [];
        },
      },
      systemPower: runtime.systemPowerModule,
      watchdog: {
        async listIssues() {
          return [];
        },
        async resolveIssue() {
          return undefined;
        },
      },
    },
  });

  const client = new FrontendApiClient(new InMemoryFrontendApiTransport(server));
  let settingsSnapshot = await client.getSettings();
  assert.equal(settingsSnapshot.authRouterStatus?.currentSelection?.accountId, 'account-primary');

  const switchedStatus = await client.forceCodexAuthSwitch('account-secondary');
  assert.equal(switchedStatus.currentSelection?.accountId, 'account-secondary');
  assert.equal((await readFile(canonicalAuthFile, 'utf8')).includes('token-secondary'), true);

  clock.set(new Date('2026-03-26T22:14:00.000Z'));
  await bootstrap.heartbeat({
    now: clock.now(),
  });

  backendStatus = JSON.parse(await readFile(backendStateFilePath, 'utf8'));
  assert.equal(backendStatus.authRouter.currentAccountId, 'account-secondary');

  settingsSnapshot = await client.getSettings();
  const page = new SettingsCenterUiModule().render(settingsSnapshot);
  assert.equal(page.sections.some((section) => section.title === 'Codex Auth Router'), true);
  assert.equal(JSON.stringify(page).includes('current_account=account-secondary'), true);

  console.log(`Wave 10 validation passed in ${sandboxPath}`);
} finally {
  if (bootstrap) {
    await bootstrap.stop();
  }

  await rm(sandboxPath, {
    recursive: true,
    force: true,
  });
}
