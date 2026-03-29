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
  waitUntilReady,
  writeJson,
} from '../tests/helpers/live-runtime-fixtures.mjs';

const { AppBootstrap } = await import(
  '../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/AppBootstrap.js'
);

const WEB_DIST_ROOT = fileURLToPath(new URL('../apps/lume-hub-web/dist/', import.meta.url));

async function withLiveRuntime(run) {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave44-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const runtimeConfig = await seedLiveRuntimeSandbox({
    sandboxPath,
    httpPort,
    webDistRootPath: WEB_DIST_ROOT,
    socketCoordinator: new FakeSocketCoordinator(),
    fetchMock,
  });

  await writeJson(runtimeConfig.groupSeedFilePath, {
    schemaVersion: 1,
    groups: [
      {
        groupJid: '120363402446203704@g.us',
        preferredSubject: 'Turma Validacao Wave 44',
        aliases: ['Wave 44'],
        courseId: 'curso-wave44',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-03-29T11:30:00.000Z',
            assignedBy: 'system',
          },
        ],
        calendarAccessPolicy: {
          group: 'read',
          groupOwner: 'read_write',
          appOwner: 'read_write',
        },
        lastRefreshedAt: '2026-03-29T11:30:00.000Z',
      },
    ],
  });

  await rm(runtimeConfig.codexAuthFile, { force: true });

  const bootstrap = new AppBootstrap({
    runtimeConfig: {
      ...runtimeConfig,
      whatsappEnabled: false,
      whatsappAutoConnect: false,
    },
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await run({ baseUrl });
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
}

await withLiveRuntime(async ({ baseUrl }) => {
  const groups = await readJson(`${baseUrl}/api/groups`);
  const people = await readJson(`${baseUrl}/api/people`);
  const groupJid = groups[0]?.groupJid;
  const operator = people.find((person) => Array.isArray(person.globalRoles) && person.globalRoles.includes('app_owner')) ?? people[0];

  assert.ok(groupJid, 'Expected at least one live group in the sandbox runtime.');
  assert.ok(operator?.personId, 'Expected at least one operator person in the sandbox runtime.');

  const previewCreate = await requestJson(`${baseUrl}/api/assistant/schedules/preview`, {
    method: 'POST',
    body: {
      text: 'Marca Aula especial sabado às 10:00 com nota levar figurinos.',
      groupJid,
      personId: operator.personId,
      senderDisplayName: 'Wave 44 Validator',
    },
  });

  assert.equal(previewCreate.canApply, true);
  assert.equal(previewCreate.operation, 'create');
  assert.ok(previewCreate.previewFingerprint);
  assert.ok(previewCreate.diff.length > 0);

  const applyCreate = await requestJson(`${baseUrl}/api/assistant/schedules/apply`, {
    method: 'POST',
    body: {
      text: 'Marca Aula especial sabado às 10:00 com nota levar figurinos.',
      groupJid,
      personId: operator.personId,
      senderDisplayName: 'Wave 44 Validator',
      previewFingerprint: previewCreate.previewFingerprint,
    },
  });

  assert.equal(applyCreate.instruction.sourceType, 'assistant_schedule_apply');
  assert.equal(applyCreate.appliedInstruction?.status, 'completed');
  assert.ok(applyCreate.appliedEvent);
  assert.equal(applyCreate.appliedEvent.groupJid, groupJid);

  const schedulesAfterCreate = await readJson(
    `${baseUrl}/api/schedules?groupJid=${encodeURIComponent(groupJid)}`,
  );
  assert.ok(
    schedulesAfterCreate.events.some((event) => event.eventId === applyCreate.appliedEvent.eventId),
    'Expected the created event to be visible in the weekly planner snapshot.',
  );

  const previewUpdate = await requestJson(`${baseUrl}/api/assistant/schedules/preview`, {
    method: 'POST',
    body: {
      text: 'Muda a aula para sabado às 11:00 e atualiza a nota para levar figurinos e aquecimento.',
      groupJid,
      personId: operator.personId,
      senderDisplayName: 'Wave 44 Validator',
    },
  });

  assert.equal(previewUpdate.canApply, true);
  assert.equal(previewUpdate.operation, 'update');
  assert.ok(previewUpdate.previewFingerprint);

  const applyUpdate = await requestJson(`${baseUrl}/api/assistant/schedules/apply`, {
    method: 'POST',
    body: {
      text: 'Muda a aula para sabado às 11:00 e atualiza a nota para levar figurinos e aquecimento.',
      groupJid,
      personId: operator.personId,
      senderDisplayName: 'Wave 44 Validator',
      previewFingerprint: previewUpdate.previewFingerprint,
    },
  });

  assert.equal(applyUpdate.appliedInstruction?.status, 'completed');
  assert.ok(applyUpdate.appliedEvent);
  assert.equal(applyUpdate.appliedEvent.startTime, '11:00');

  const instructionQueue = await readJson(`${baseUrl}/api/instruction-queue`);
  const scheduleAuditEntries = instructionQueue.filter((instruction) => instruction.sourceType === 'assistant_schedule_apply');
  assert.ok(scheduleAuditEntries.length >= 2);
  assert.ok(scheduleAuditEntries.some((instruction) => instruction.status === 'completed'));

  await assertHeadlessRoute(`${baseUrl}/assistant?mode=live`, [
    'Assistente',
    'Pedir mudanca na agenda',
    'Preview antes de aplicar',
    'Auditoria recente do scheduling',
  ]);
});

console.log(
  'Wave 44 validation passed: assistant scheduling now supports live preview/apply with queue-backed audit and a working live page.',
);
