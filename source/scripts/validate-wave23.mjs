import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { rm, readFile } from 'node:fs/promises';

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
} from '../tests/helpers/live-runtime-fixtures.mjs';

const { AppBootstrap } = await import('../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/AppBootstrap.js');
const { HostBootstrap } = await import('../apps/lume-hub-host/dist/apps/lume-hub-host/src/bootstrap/HostBootstrap.js');
const { HostModuleLoader } = await import('../apps/lume-hub-host/dist/apps/lume-hub-host/src/bootstrap/HostModuleLoader.js');

async function runWave23Validation() {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave23-');
  const webDistRootPath = fileURLToPath(new URL('../apps/lume-hub-web/dist/', import.meta.url));
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const socketCoordinator = new FakeSocketCoordinator();
  const fetchMock = createLiveFetchMock();
  const runtimeConfig = await seedLiveRuntimeSandbox({
    sandboxPath,
    httpPort,
    webDistRootPath,
    socketCoordinator,
    fetchMock,
  });
  const backend = new AppBootstrap({
    runtimeConfig,
  });
  const host = new HostBootstrap(
    new HostModuleLoader({
      rootPath: sandboxPath,
      codexAuthFile: runtimeConfig.codexAuthFile,
      canonicalCodexAuthFile: runtimeConfig.canonicalCodexAuthFile,
      hostStateFilePath: runtimeConfig.hostStateFilePath,
      backendStateFilePath: runtimeConfig.backendStateFilePath,
      powerStateFilePath: runtimeConfig.powerStateFilePath,
      inhibitorStatePath: runtimeConfig.inhibitorStatePath,
      systemdUserPath: runtimeConfig.systemdUserPath,
      publishHeartbeatOnStart: true,
    }),
  );

  try {
    await backend.start();
    await host.start();
    await host.heartbeat();
    await waitUntilReady(`${baseUrl}/api/dashboard`);
    await waitUntil(() => socketCoordinator.sockets.length >= 1);
    socketCoordinator.latestSocket.publishQr();
    socketCoordinator.latestSocket.openSession();

    await waitUntil(async () => {
      const diagnostics = await readJson(`${baseUrl}/api/runtime/diagnostics`);
      return diagnostics.phase === 'running' && diagnostics.whatsapp.session.phase === 'open';
    });

    const firstDiagnostics = await readJson(`${baseUrl}/api/runtime/diagnostics`);
    assert.equal(firstDiagnostics.readiness.ready, true);
    assert.equal(firstDiagnostics.health.status, 'healthy');
    assert.equal(firstDiagnostics.whatsapp.discoveredGroups >= 1, true);
    assert.equal(firstDiagnostics.moduleGraph.loadOrder.length > 0, true);

    const createdSchedule = await requestJson(`${baseUrl}/api/schedules`, {
      method: 'POST',
      body: {
        groupJid: socketCoordinator.latestSocket.groupJid,
        title: 'Wave 23 cutover',
        dayLabel: 'sexta-feira',
        startTime: '18:30',
        durationMinutes: 60,
        notes: 'Agendamento criado pelo validador da Wave 23.',
        timeZone: 'Europe/Lisbon',
      },
    });
    assert.ok(createdSchedule.eventId);

    socketCoordinator.latestSocket.closeWithReason(500, 'Reconnect validation for Wave 23');
    await waitUntil(() => socketCoordinator.sockets.length >= 2);
    socketCoordinator.latestSocket.openSession();

    await waitUntil(async () => {
      const diagnostics = await readJson(`${baseUrl}/api/runtime/diagnostics`);
      return diagnostics.whatsapp.session.phase === 'open' && diagnostics.operational.lastError === null;
    });

    await host.stop();
    await host.start();
    await host.heartbeat();

    const hostAwareStatus = await readJson(`${baseUrl}/api/status`);
    assert.ok(hostAwareStatus.hostCompanion.lastHeartbeatAt);

    await backend.stop();

    const stoppedDiagnostics = JSON.parse(await readFile(runtimeConfig.backendRuntimeStateFilePath, 'utf8'));
    assert.equal(stoppedDiagnostics.phase, 'stopped');

    await backend.start();
    await waitUntilReady(`${baseUrl}/api/dashboard`);
    await waitUntil(() => socketCoordinator.sockets.length >= 3);
    socketCoordinator.latestSocket.openSession();

    await waitUntil(async () => {
      const diagnostics = await readJson(`${baseUrl}/api/runtime/diagnostics`);
      return diagnostics.phase === 'running' && diagnostics.whatsapp.session.phase === 'open';
    });

    const restoredSchedules = await readJson(
      `${baseUrl}/api/schedules?groupJid=${encodeURIComponent(socketCoordinator.latestSocket.groupJid)}`,
    );
    assert.equal(restoredSchedules.events.length, 1);
    assert.equal(restoredSchedules.events[0].title, 'Wave 23 cutover');

    for (const scenario of [
      {
        route: '/today?mode=live',
        expectedTexts: ['Hoje', 'WhatsApp pronto', 'Host companion'],
      },
      {
        route: '/week?mode=live',
        expectedTexts: ['Criar agendamento', 'Wave 23 cutover', 'Agenda live desta semana'],
      },
      {
        route: '/whatsapp?mode=live&details=advanced',
        expectedTexts: ['WhatsApp', socketCoordinator.latestSocket.groupLabel, socketCoordinator.latestSocket.privateChatLabel],
      },
    ]) {
      const { stdout, stderr } = await runChromeDump(`${baseUrl}${scenario.route}`);

      for (const expectedText of scenario.expectedTexts) {
        assert.match(stdout, new RegExp(escapeForRegExp(expectedText), 'u'));
      }

      assert.doesNotMatch(stderr, /(TypeError|ReferenceError|Uncaught|SEVERE)/u);
      assert.doesNotMatch(stdout, /Algo falhou ao carregar esta pagina/u);
    }

    console.log(`Wave 23 validation passed on ${baseUrl}/today?mode=live`);
  } finally {
    await host.stop().catch(() => undefined);
    await backend.stop().catch(() => undefined);
    await rm(sandboxPath, { recursive: true, force: true });
  }
}

await runWave23Validation();
