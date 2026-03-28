import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  FakeSocketCoordinator,
  createLiveFetchMock,
  createLiveSandboxPath,
  readJson,
  requestJson,
  reservePort,
  seedLiveRuntimeSandbox,
  waitUntil,
  waitUntilReady,
} from '../helpers/live-runtime-fixtures.mjs';

const { AppBootstrap } = await import(
  '../../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/AppBootstrap.js'
);

test('live runtime persists diagnostics and recovers across reconnect and restart', async () => {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave23-recovery-');
  const webDistRootPath = fileURLToPath(new URL('../../apps/lume-hub-web/dist/', import.meta.url));
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

  const bootstrap = new AppBootstrap({
    runtimeConfig,
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/dashboard`);
    await waitUntil(() => socketCoordinator.sockets.length >= 1);
    socketCoordinator.latestSocket.openSession();

    await waitUntil(async () => {
      const diagnostics = await readJson(`${baseUrl}/api/runtime/diagnostics`);
      return diagnostics.phase === 'running' && diagnostics.whatsapp.session.phase === 'open';
    });

    const createdSchedule = await requestJson(`${baseUrl}/api/schedules`, {
      method: 'POST',
      body: {
        groupJid: socketCoordinator.latestSocket.groupJid,
        title: 'Sessao de recuperacao',
        dayLabel: 'sexta-feira',
        startTime: '18:30',
        durationMinutes: 60,
        notes: 'Validar persistencia do runtime live.',
        timeZone: 'Europe/Lisbon',
      },
    });
    assert.ok(createdSchedule.eventId);

    const diagnosticsBeforeReconnect = await readJson(`${baseUrl}/api/runtime/diagnostics`);
    assert.equal(diagnosticsBeforeReconnect.phase, 'running');
    assert.equal(diagnosticsBeforeReconnect.readiness.ready, true);
    assert.equal(diagnosticsBeforeReconnect.moduleGraph.loadOrder.length > 0, true);

    socketCoordinator.latestSocket.closeWithReason(500, 'Transient reconnect during runtime recovery validation');
    await waitUntil(() => socketCoordinator.sockets.length >= 2);
    socketCoordinator.latestSocket.openSession();

    await waitUntil(async () => {
      const diagnostics = await readJson(`${baseUrl}/api/runtime/diagnostics`);
      return diagnostics.whatsapp.session.phase === 'open' && diagnostics.operational.lastError === null;
    });

    await bootstrap.stop();

    const stoppedDiagnostics = JSON.parse(await readFile(runtimeConfig.backendRuntimeStateFilePath, 'utf8'));
    assert.equal(stoppedDiagnostics.phase, 'stopped');
    assert.ok(stoppedDiagnostics.updatedAt);

    const restartedBootstrap = new AppBootstrap({
      runtimeConfig,
    });

    try {
      await restartedBootstrap.start();
      await waitUntilReady(`${baseUrl}/api/dashboard`);
      await waitUntil(() => socketCoordinator.sockets.length >= 3);
      socketCoordinator.latestSocket.openSession();

      await waitUntil(async () => {
        const diagnostics = await readJson(`${baseUrl}/api/runtime/diagnostics`);
        return diagnostics.phase === 'running' && diagnostics.whatsapp.session.phase === 'open';
      });

      const schedules = await readJson(
        `${baseUrl}/api/schedules?groupJid=${encodeURIComponent(socketCoordinator.latestSocket.groupJid)}`,
      );
      assert.equal(schedules.events.length, 1);
      assert.equal(schedules.events[0].title, 'Sessao de recuperacao');

      const restartedDiagnostics = await readJson(`${baseUrl}/api/runtime/diagnostics`);
      assert.equal(['healthy', 'degraded'].includes(restartedDiagnostics.health.status), true);
      assert.equal(restartedDiagnostics.whatsapp.session.phase, 'open');
      assert.equal(restartedDiagnostics.webSocket.sessionCount >= 0, true);
      assert.ok(restartedDiagnostics.operational.lastTickAt);
    } finally {
      await restartedBootstrap.stop();
    }
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});
