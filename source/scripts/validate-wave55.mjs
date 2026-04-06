import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
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
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave55-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid: '120363402446203704@g.us',
    groupLabel: 'EFA Programacao A',
    privateChatJid: '351910000001@s.whatsapp.net',
    privateChatLabel: 'Validator Wave55',
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
        groupJid: socketCoordinator.config.groupJid,
        preferredSubject: 'EFA Programacao A',
        aliases: ['Programacao A'],
        courseId: 'efa-programacao-a',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-04-06T08:00:00.000Z',
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
        lastRefreshedAt: '2026-04-06T08:00:00.000Z',
      },
      {
        groupJid: '120363409999999999@g.us',
        preferredSubject: 'Distribuicao Geral',
        aliases: ['Distribuicao'],
        courseId: null,
        groupOwners: [],
        calendarAccessPolicy: {
          group: 'read',
          groupOwner: 'read_write',
          appOwner: 'read_write',
        },
        operationalSettings: {
          mode: 'distribuicao_apenas',
          schedulingEnabled: false,
          allowLlmScheduling: false,
          memberTagPolicy: 'owner_only',
        },
        lastRefreshedAt: null,
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
    socketCoordinator.latestSocket.publishQr('wave55-live-qr');
    socketCoordinator.latestSocket.openSession();
    await waitUntil(async () => {
      const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
      return workspace.runtime.session.phase === 'open';
    });
    await run({ baseUrl, socketCoordinator });
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

async function requestJson(baseUrl, path, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  assert.equal(response.status, 200, `Expected 200 for ${method} ${path} but got ${response.status}.`);
  return payload;
}

await withLiveRuntime(async ({ baseUrl, socketCoordinator }) => {
  const weekDom = await assertHeadlessRoute(`${baseUrl}/week?mode=live`, [
    'Calendario semanal',
    'Semana operacional',
    'Novo neste dia',
    'pending',
    'waiting_confirmation',
    'Nova notificacao',
  ]);
  assert.match(weekDom, /data-week-calendar/u);
  assert.match(weekDom, /data-week-day="segunda-feira"/u);
  assert.match(weekDom, /data-week-day="domingo"/u);
  assert.match(weekDom, /data-week-editor/u);
  assert.match(weekDom, /data-flow-action="schedule-compose-day"/u);

  const before = await requestJson(baseUrl, '/api/schedules');
  assert.equal(before.diagnostics.eventCount, 0);

  const created = await requestJson(baseUrl, '/api/schedules', {
    method: 'POST',
    body: {
      groupJid: socketCoordinator.config.groupJid,
      title: 'Aula aberta Wave 55',
      dayLabel: 'sexta-feira',
      startTime: '18:30',
      durationMinutes: 60,
      notes: 'Levar caderno e confirmar sala.',
    },
  });
  assert.equal(created.title, 'Aula aberta Wave 55');

  const afterCreate = await requestJson(baseUrl, '/api/schedules');
  assert.ok(afterCreate.events.some((event) => event.eventId === created.eventId));

  const createdDom = await assertHeadlessRoute(`${baseUrl}/week?mode=live`, [
    'Aula aberta Wave 55',
    'Desativar',
    'pending 2',
  ]);
  assert.match(createdDom, /data-week-event-id=/u);

  const updated = await requestJson(baseUrl, `/api/schedules/${created.eventId}`, {
    method: 'PATCH',
    body: {
      groupJid: socketCoordinator.config.groupJid,
      title: 'Aula aberta Wave 55 ajustada',
      dayLabel: 'sabado',
      startTime: '10:00',
      durationMinutes: 75,
      notes: 'Levar tapete e rever lista.',
    },
  });
  assert.equal(updated.title, 'Aula aberta Wave 55 ajustada');
  assert.equal(updated.dayLabel, 'sabado');

  const afterUpdate = await requestJson(baseUrl, '/api/schedules');
  const updatedEvent = afterUpdate.events.find((event) => event.eventId === created.eventId);
  assert.ok(updatedEvent, 'Expected updated event to still exist.');
  assert.equal(updatedEvent.startTime, '10:00');
  assert.equal(updatedEvent.durationMinutes, 75);

  const updatedDom = await assertHeadlessRoute(`${baseUrl}/week?mode=live`, [
    'Aula aberta Wave 55 ajustada',
    'Sabado',
  ]);
  assert.doesNotMatch(updatedDom, /Aula aberta Wave 55<\/h4>/u);

  const deleted = await requestJson(
    baseUrl,
    `/api/schedules/${created.eventId}?groupJid=${encodeURIComponent(socketCoordinator.config.groupJid)}`,
    {
      method: 'DELETE',
    },
  );
  assert.equal(deleted.deleted, true);

  const afterDelete = await requestJson(baseUrl, '/api/schedules');
  assert.equal(afterDelete.diagnostics.eventCount, 0);

  const deletedDom = await assertHeadlessRoute(`${baseUrl}/week?mode=live`, [
    'Semana operacional',
    'Sem notificacoes planeadas neste dia.',
  ]);
  assert.doesNotMatch(deletedDom, new RegExp(escapeForRegExp('Aula aberta Wave 55 ajustada'), 'u'));

  const implementationWavesDoc = await readFile(
    '/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_implementation_waves.md',
    'utf8',
  );
  const gapAuditDoc = await readFile(
    '/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_gap_audit.md',
    'utf8',
  );
  const rootReadme = await readFile('/home/eliaspc/Documentos/lume-hub/README.md', 'utf8');
  const sourceReadme = await readFile('/home/eliaspc/Documentos/lume-hub/source/README.md', 'utf8');
  const packageJson = JSON.parse(await readFile('/home/eliaspc/Documentos/lume-hub/source/package.json', 'utf8'));

  assert.match(
    implementationWavesDoc,
    /A `Wave 55` ja fechou o calendario semanal de notificacoes como vista operacional principal/u,
  );
  assert.match(implementationWavesDoc, /### Wave 56 - Modos do grupo e roteamento `agendamento` vs `distribuicao`/u);
  assert.doesNotMatch(implementationWavesDoc, /### Wave 55 - Calendario semanal de notificacoes/u);

  assert.match(gapAuditDoc, /a `Wave 55` ja fechou a vista principal como calendario semanal de notificacoes/u);
  assert.match(gapAuditDoc, /criacao, edicao e desativacao inline sem sair da rota `\/week`/u);

  assert.match(rootReadme, /Wave 0` a `Wave 55/u);
  assert.match(rootReadme, /validate:wave55/u);
  assert.match(rootReadme, /calendario semanal como vista operacional principal/u);

  assert.match(sourceReadme, /Wave 0` a `Wave 55/u);
  assert.match(sourceReadme, /validate:wave55/u);
  assert.match(sourceReadme, /rota `\/week` como calendario semanal/u);

  assert.equal(typeof packageJson.scripts['validate:wave55'], 'string');
});

console.log('validate-wave55: ok');
