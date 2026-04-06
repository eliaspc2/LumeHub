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
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave56-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid: '120363402446203704@g.us',
    groupLabel: 'EFA Programacao A',
    privateChatJid: '351910000001@s.whatsapp.net',
    privateChatLabel: 'Validator Wave56',
  });
  const runtimeConfig = await seedLiveRuntimeSandbox({
    sandboxPath,
    httpPort,
    webDistRootPath: WEB_DIST_ROOT,
    socketCoordinator,
    fetchMock,
  });
  const manualOnlyGroupJid = '120363409999999998@g.us';
  const distributionOnlyGroupJid = '120363409999999999@g.us';

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
        groupJid: manualOnlyGroupJid,
        preferredSubject: 'Turma Manual',
        aliases: ['Manual'],
        courseId: null,
        groupOwners: [],
        calendarAccessPolicy: {
          group: 'read',
          groupOwner: 'read_write',
          appOwner: 'read_write',
        },
        operationalSettings: {
          mode: 'com_agendamento',
          schedulingEnabled: true,
          allowLlmScheduling: false,
          memberTagPolicy: 'owner_only',
        },
        lastRefreshedAt: null,
      },
      {
        groupJid: distributionOnlyGroupJid,
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
    socketCoordinator.latestSocket.publishQr('wave56-live-qr');
    socketCoordinator.latestSocket.openSession();
    await waitUntil(async () => {
      const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
      return workspace.runtime.session.phase === 'open';
    });
    await run({
      baseUrl,
      socketCoordinator,
      manualOnlyGroupJid,
      distributionOnlyGroupJid,
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

async function requestJson(baseUrl, path, { method = 'GET', body, expectedStatus = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  assert.equal(response.status, expectedStatus, `Expected ${expectedStatus} for ${method} ${path} but got ${response.status}.`);
  return payload;
}

await withLiveRuntime(async ({ baseUrl, socketCoordinator, manualOnlyGroupJid, distributionOnlyGroupJid }) => {
  const weekDom = await assertHeadlessRoute(`${baseUrl}/week?mode=live`, [
    'Calendario semanal',
    'Fan-out only',
    'Distribuicao/fan-out',
    'LLM scheduling desligado',
  ]);
  assert.match(weekDom, /Distribuicao Geral/u);

  const assistantDom = await assertHeadlessRoute(`${baseUrl}/assistant?mode=live`, [
    'Assistente live',
    'Roteamento do grupo',
    'Gerar preview',
    'EFA Programacao A',
  ]);
  assert.match(assistantDom, /LLM pode gerar preview e apply neste grupo/u);

  const createdSchedulable = await requestJson(baseUrl, '/api/schedules', {
    method: 'POST',
    body: {
      groupJid: socketCoordinator.config.groupJid,
      title: 'Aula Wave 56',
      dayLabel: 'sexta-feira',
      startTime: '18:30',
      durationMinutes: 60,
      notes: 'Grupo com LLM scheduling ativo.',
    },
  });
  assert.equal(createdSchedulable.title, 'Aula Wave 56');

  const createdManualOnly = await requestJson(baseUrl, '/api/schedules', {
    method: 'POST',
    body: {
      groupJid: manualOnlyGroupJid,
      title: 'Aula Manual Wave 56',
      dayLabel: 'sabado',
      startTime: '10:00',
      durationMinutes: 75,
      notes: 'Aqui o calendario continua manual.',
    },
  });
  assert.equal(createdManualOnly.title, 'Aula Manual Wave 56');

  const blockedDistribution = await requestJson(baseUrl, '/api/schedules', {
    method: 'POST',
    expectedStatus: 400,
    body: {
      groupJid: distributionOnlyGroupJid,
      title: 'Nao devia entrar',
      dayLabel: 'domingo',
      startTime: '09:00',
      durationMinutes: 45,
      notes: 'Bloqueado por modo.',
    },
  });
  assert.match(blockedDistribution.error, /distribuicao apenas/u);

  const schedulablePreview = await requestJson(baseUrl, '/api/assistant/schedules/preview', {
    method: 'POST',
    body: {
      groupJid: socketCoordinator.config.groupJid,
      text: 'Cria uma aula na sexta as 18:30 e deixa nota para levar figurinos.',
      requestedAccessMode: 'read_write',
    },
  });
  assert.equal(schedulablePreview.canApply, true);
  assert.equal(schedulablePreview.groupJid, socketCoordinator.config.groupJid);

  const manualOnlyPreview = await requestJson(baseUrl, '/api/assistant/schedules/preview', {
    method: 'POST',
    body: {
      groupJid: manualOnlyGroupJid,
      text: 'Cria uma aula no sabado as 10:00.',
      requestedAccessMode: 'read_write',
    },
  });
  assert.equal(manualOnlyPreview.canApply, false);
  assert.match(manualOnlyPreview.blockingReason ?? '', /calendario manual/u);

  const distributionPreview = await requestJson(baseUrl, '/api/assistant/schedules/preview', {
    method: 'POST',
    body: {
      groupJid: distributionOnlyGroupJid,
      text: 'Cria uma aula no domingo as 09:00.',
      requestedAccessMode: 'read_write',
    },
  });
  assert.equal(distributionPreview.canApply, false);
  assert.match(distributionPreview.blockingReason ?? '', /fan-out\/distribuicao/u);

  const weekAfterCreateDom = await assertHeadlessRoute(`${baseUrl}/week?mode=live`, [
    'Aula Wave 56',
    'Aula Manual Wave 56',
    'Agendamento local ativo',
  ]);
  assert.doesNotMatch(weekAfterCreateDom, /Nao devia entrar/u);

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
    /A `Wave 56` ja fechou o roteamento por modo de grupo entre calendario semanal, assistente e distribuicao/u,
  );
  assert.match(implementationWavesDoc, /### Wave 57 - Ownership por grupo e politica de interacao com o bot/u);
  assert.doesNotMatch(implementationWavesDoc, /### Wave 56 - Modos do grupo e roteamento `agendamento` vs `distribuicao`/u);

  assert.match(gapAuditDoc, /a `Wave 56` ja fechou o comportamento `com_agendamento` vs `distribuicao_apenas` ponta a ponta/u);
  assert.match(gapAuditDoc, /ownership e politica de interacao com o bot ainda seguem como proximo foco da ronda/u);

  assert.match(rootReadme, /Wave 0` a `Wave 56/u);
  assert.match(rootReadme, /validate:wave56/u);
  assert.match(rootReadme, /roteamento por modo de grupo entre calendario, assistente e distribuicao/u);

  assert.match(sourceReadme, /Wave 0` a `Wave 56/u);
  assert.match(sourceReadme, /validate:wave56/u);
  assert.match(sourceReadme, /grupos `distribuicao_apenas` saem do scheduling local e passam a fan-out\/distribuicao/u);

  assert.equal(typeof packageJson.scripts['validate:wave56'], 'string');
});

console.log('validate-wave56: ok');
