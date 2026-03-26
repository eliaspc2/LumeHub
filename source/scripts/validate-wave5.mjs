import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const { FakeClock } = await import('../packages/foundation/clock/dist/index.js');
const { HostBootstrap } = await import('../apps/lume-hub-host/dist/apps/lume-hub-host/src/bootstrap/HostBootstrap.js');
const { HostModuleLoader } = await import('../apps/lume-hub-host/dist/apps/lume-hub-host/src/bootstrap/HostModuleLoader.js');

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave5-'));
let bootstrap;

try {
  const clock = new FakeClock(new Date('2026-03-26T18:30:00.000Z'));
  const codexAuthFile = join(sandboxPath, 'codex', 'auth.json');
  const hostStateFilePath = join(sandboxPath, 'runtime', 'host', 'state', 'host-runtime-state.json');
  const backendStateFilePath = join(sandboxPath, 'runtime', 'lxd', 'host-mounts', 'data', 'runtime', 'host-state.json');
  const powerStateFilePath = join(sandboxPath, 'runtime', 'host', 'state', 'power-policy-state.json');
  const inhibitorStatePath = join(sandboxPath, 'runtime', 'host', 'state', 'sleep-inhibitor.json');
  const systemdUserPath = join(sandboxPath, 'runtime', 'host', 'systemd-user');
  const appEntryPath = join(sandboxPath, 'bin', 'lume-hub-host.js');
  const workingDirectory = join(sandboxPath, 'source');

  await mkdir(dirname(codexAuthFile), { recursive: true });
  await writeFile(codexAuthFile, '{"token":"test"}\n', 'utf8');

  bootstrap = new HostBootstrap(
    new HostModuleLoader({
      rootPath: sandboxPath,
      clock,
      codexAuthFile,
      canonicalCodexAuthFile: codexAuthFile,
      hostStateFilePath,
      backendStateFilePath,
      powerStateFilePath,
      inhibitorStatePath,
      systemdUserPath,
      workingDirectory,
      execStart: `/usr/bin/env node ${appEntryPath}`,
    }),
  );
  await bootstrap.start();

  const runtime = bootstrap.getRuntime();
  assert.ok(runtime);

  let backendStatus = JSON.parse(await readFile(backendStateFilePath, 'utf8'));
  assert.equal(backendStatus.auth.filePath, codexAuthFile);
  assert.equal(backendStatus.auth.exists, true);
  assert.equal(backendStatus.auth.sameAsCodexCanonical, true);
  assert.equal(backendStatus.autostart.enabled, false);
  assert.equal(typeof backendStatus.runtime.lastHeartbeatAt, 'string');

  const policy = await runtime.systemPowerModule.updatePowerPolicy({
    mode: 'always_inhibit',
    preferredReasons: ['host_companion'],
  });
  assert.equal(policy.mode, 'always_inhibit');

  const powerStatus = await runtime.systemPowerModule.evaluatePowerPolicy({
    now: clock.now(),
  });
  assert.equal(powerStatus.inhibitorActive, true);
  assert.equal(powerStatus.desiredState, 'inhibited');
  assert.equal(powerStatus.activeLease?.reasons.includes('host_companion'), true);
  await access(inhibitorStatePath);

  const autostartPolicy = await runtime.hostLifecycleModule.enableStartWithSystem();
  assert.equal(autostartPolicy.enabled, true);
  await access(autostartPolicy.manifestPath);

  const manifestContents = await readFile(autostartPolicy.manifestPath, 'utf8');
  assert.equal(manifestContents.includes(`Environment=CODEX_AUTH_FILE=${codexAuthFile}`), true);
  assert.equal(manifestContents.includes(`ExecStart=/usr/bin/env node ${appEntryPath}`), true);

  clock.set(new Date('2026-03-26T18:31:00.000Z'));
  await bootstrap.heartbeat({
    now: clock.now(),
  });

  backendStatus = JSON.parse(await readFile(backendStateFilePath, 'utf8'));
  assert.equal(backendStatus.autostart.enabled, true);
  assert.equal(backendStatus.power.policyMode, 'always_inhibit');
  assert.equal(backendStatus.power.inhibitorActive, true);
  assert.equal(backendStatus.runtime.lastHeartbeatAt, '2026-03-26T18:31:00.000Z');

  const repaired = await runtime.hostLifecycleModule.repairHostIntegration();
  assert.equal(repaired.codexAuthExists, true);
  assert.equal(repaired.autostartPolicy.enabled, true);

  const disabledAutostart = await runtime.hostLifecycleModule.disableStartWithSystem();
  assert.equal(disabledAutostart.enabled, false);
  await assert.rejects(() => access(disabledAutostart.manifestPath));

  await runtime.systemPowerModule.updatePowerPolicy({
    mode: 'allow_sleep',
  });
  await runtime.systemPowerModule.evaluatePowerPolicy({
    now: clock.now(),
  });
  await assert.rejects(() => access(inhibitorStatePath));

  console.log(`Wave 5 validation passed in ${sandboxPath}`);
} finally {
  if (bootstrap) {
    await bootstrap.stop();
  }

  await rm(sandboxPath, { recursive: true, force: true });
}
