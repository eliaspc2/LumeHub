import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';

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
  waitForWsEvent,
  waitUntil,
  waitUntilReady,
} from '../helpers/live-runtime-fixtures.mjs';

const { AppBootstrap } = await import(
  '../../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/AppBootstrap.js'
);

test('live cutover pages mount cleanly with real backend data', async () => {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave23-e2e-');
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
    socketCoordinator.latestSocket.publishQr();
    socketCoordinator.latestSocket.openSession();

    await waitUntil(async () => {
      const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
      return workspace.runtime.session.phase === 'open' && workspace.runtime.discoveredGroups >= 1;
    });

    const scheduleEvent = await waitForWsEvent(
      `ws://127.0.0.1:${httpPort}/ws`,
      'schedules.updated',
      async () =>
        requestJson(`${baseUrl}/api/schedules`, {
          method: 'POST',
          body: {
            groupJid: socketCoordinator.latestSocket.groupJid,
            title: 'Sessao live de cutover',
            dayLabel: 'sexta-feira',
            startTime: '18:30',
            durationMinutes: 75,
            notes: 'Sessao criada no teste e2e de cutover live.',
            timeZone: 'Europe/Lisbon',
          },
        }),
    );
    assert.equal(scheduleEvent.payload.groupJid, socketCoordinator.latestSocket.groupJid);

    await requestJson(`${baseUrl}/api/routing/rules`, {
      method: 'POST',
      body: {
        ruleId: 'rule-wave23-cutover',
        personId: 'person-app-owner',
        identifiers: [],
        targetGroupJids: [socketCoordinator.latestSocket.groupJid],
        targetCourseIds: [],
        targetDisciplineCodes: [],
        enabled: true,
        requiresConfirmation: true,
        notes: 'Regra live para validar cutover.',
      },
    });

    await requestJson(`${baseUrl}/api/routing/distributions`, {
      method: 'POST',
      body: {
        sourceMessageId: 'wamid.wave23.cutover.001',
        personId: 'person-app-owner',
        messageText: 'Mensagem live para validar cutover.',
        mode: 'confirmed',
      },
    });

    await requestJson(`${baseUrl}/api/llm/chat`, {
      method: 'POST',
      body: {
        text: 'Resume o estado live atual.',
        intent: 'local_summary_request',
        contextSummary: ['Backend live pronto para cutover.'],
        domainFacts: ['Existe pelo menos um agendamento real.', 'Existe uma distribuicao na fila.'],
      },
    });

    for (const scenario of [
      {
        route: '/today?mode=live',
        expectedTexts: ['Hoje', 'WhatsApp pronto', 'Host companion'],
      },
      {
        route: '/week?mode=live',
        expectedTexts: ['Criar agendamento', 'Sessao live de cutover', 'Agenda live desta semana'],
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
  } finally {
    await bootstrap.stop();
    await rm(sandboxPath, { recursive: true, force: true });
  }
});
