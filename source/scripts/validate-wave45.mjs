import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
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
const LEGACY_SCHEDULE_SOURCE_FILE = '/home/eliaspc/Containers/wa-notify/data/schedules/w14y2026.json';
const LEGACY_SCHEDULE_FILE_NAME = 'w14y2026.json';

async function withLiveRuntime(run) {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave45-');
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
  const legacyScheduleRootPath = join(sandboxPath, 'wa-notify-schedules');

  await mkdir(legacyScheduleRootPath, { recursive: true });
  await copyFile(LEGACY_SCHEDULE_SOURCE_FILE, join(legacyScheduleRootPath, LEGACY_SCHEDULE_FILE_NAME));

  await writeJson(runtimeConfig.groupSeedFilePath, {
    schemaVersion: 1,
    groups: [
      {
        groupJid: '120363402446203704@g.us',
        preferredSubject: 'VC1 Programacao avancada',
        aliases: ['VC1 Python'],
        courseId: 'curso-wa-notify-vc1',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-03-29T12:15:00.000Z',
            assignedBy: 'wave45-validator',
          },
        ],
        calendarAccessPolicy: {
          group: 'read',
          groupOwner: 'read_write',
          appOwner: 'read_write',
        },
        lastRefreshedAt: '2026-03-29T12:15:00.000Z',
      },
      {
        groupJid: '120363407086801381@g.us',
        preferredSubject: 'VC2 Ingles e Estatistica',
        aliases: ['VC2 Ingles'],
        courseId: 'curso-wa-notify-vc2',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-03-29T12:15:00.000Z',
            assignedBy: 'wave45-validator',
          },
        ],
        calendarAccessPolicy: {
          group: 'read',
          groupOwner: 'read_write',
          appOwner: 'read_write',
        },
        lastRefreshedAt: '2026-03-29T12:15:00.000Z',
      },
    ],
  });

  const bootstrap = new AppBootstrap({
    runtimeConfig: {
      ...runtimeConfig,
      waNotifySchedulesRootPath: legacyScheduleRootPath,
      whatsappEnabled: false,
      whatsappAutoConnect: false,
    },
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await run({
      baseUrl,
      runtimeConfig,
      legacyScheduleRootPath,
    });
  } finally {
    await bootstrap.stop().catch(() => undefined);
    await rm(sandboxPath, { recursive: true, force: true });
  }
}

async function readLegacyExpectations(filePath) {
  const legacyFile = JSON.parse(await readFile(filePath, 'utf8'));
  const enabledItems = legacyFile.items.filter((item) => item.enabled !== false);
  const groupedByBaseEventId = new Map();

  for (const item of enabledItems) {
    const baseEventId = String(item.id).split('::')[0];
    const current = groupedByBaseEventId.get(baseEventId) ?? [];
    current.push(item);
    groupedByBaseEventId.set(baseEventId, current);
  }

  return {
    itemCount: legacyFile.items.length,
    baseEventCount: groupedByBaseEventId.size,
    baseEventIds: [...groupedByBaseEventId.keys()].sort(),
    groupJids: [...new Set(enabledItems.map((item) => item.jid))].sort(),
    titles: [...groupedByBaseEventId.entries()]
      .map(([baseEventId, items]) => {
        const canonicalItem = items.find((item) => item.id === baseEventId) ?? items[0];
        return String(canonicalItem.label ?? baseEventId).replace(/\s+\(lembrete.*\)$/iu, '').trim();
      })
      .sort(),
  };
}

async function assertHeadlessRoute(url, expectedTexts) {
  const { stdout, stderr } = await runChromeDump(url);

  for (const expectedText of expectedTexts) {
    assert.match(stdout, new RegExp(escapeForRegExp(expectedText), 'u'));
  }

  assert.doesNotMatch(stderr, /(TypeError|ReferenceError|Uncaught|SEVERE)/u);
  assert.doesNotMatch(stdout, /Algo falhou ao carregar esta pagina/u);
}

await withLiveRuntime(async ({ baseUrl, runtimeConfig, legacyScheduleRootPath }) => {
  const expectations = await readLegacyExpectations(join(legacyScheduleRootPath, LEGACY_SCHEDULE_FILE_NAME));

  const files = await readJson(`${baseUrl}/api/migrations/wa-notify/schedules/files`);
  const sourceFile = files.find((file) => file.fileName === LEGACY_SCHEDULE_FILE_NAME);

  assert.ok(sourceFile, 'Expected the legacy schedule file to be visible through the import API.');
  assert.equal(sourceFile.itemCount, expectations.itemCount);
  assert.equal(sourceFile.baseEventCount, expectations.baseEventCount);
  assert.deepEqual([...sourceFile.groupJids].sort(), expectations.groupJids);

  const preview = await requestJson(`${baseUrl}/api/migrations/wa-notify/schedules/preview`, {
    method: 'POST',
    body: {
      fileName: LEGACY_SCHEDULE_FILE_NAME,
      requestedBy: 'wave45-validator',
    },
  });

  assert.equal(preview.mode, 'preview');
  assert.equal(preview.sourceFile.fileName, LEGACY_SCHEDULE_FILE_NAME);
  assert.equal(preview.totals.legacyItems, expectations.itemCount);
  assert.equal(preview.totals.baseEvents, expectations.baseEventCount);
  assert.equal(preview.totals.created, expectations.baseEventCount);
  assert.equal(preview.totals.updated, 0);
  assert.equal(preview.totals.unchanged, 0);
  assert.equal(preview.totals.ambiguous, 0);
  assert.equal(preview.totals.missingGroups, 0);
  assert.equal(preview.missingGroups.length, 0);
  assert.equal(preview.events.length, expectations.baseEventCount);
  assert.deepEqual(
    [...preview.events.map((event) => event.legacyEventId)].sort(),
    expectations.baseEventIds,
  );
  assert.deepEqual(
    [...preview.events.map((event) => event.title)].sort(),
    expectations.titles,
  );
  assert.ok(preview.events.every((event) => event.status === 'created'));

  const apply = await requestJson(`${baseUrl}/api/migrations/wa-notify/schedules/apply`, {
    method: 'POST',
    body: {
      fileName: LEGACY_SCHEDULE_FILE_NAME,
      requestedBy: 'wave45-validator',
    },
  });

  assert.equal(apply.mode, 'apply');
  assert.equal(apply.totals.created, expectations.baseEventCount);
  assert.equal(apply.totals.updated, 0);
  assert.equal(apply.totals.unchanged, 0);
  assert.equal(apply.totals.ambiguous, 0);
  assert.equal(apply.totals.missingGroups, 0);

  const isoWeekId = preview.sourceFile.isoWeekId ?? '2026-W14';
  const schedulesAfterImport = await readJson(`${baseUrl}/api/schedules?weekId=${encodeURIComponent(isoWeekId)}`);

  assert.equal(schedulesAfterImport.events.length, expectations.baseEventCount);
  assert.deepEqual(
    [...schedulesAfterImport.events.map((event) => event.eventId)].sort(),
    expectations.baseEventIds,
  );
  assert.ok(
    schedulesAfterImport.events.every((event) => event.notificationRuleLabels.length >= 1),
    'Expected imported events to expose derived notification rules.',
  );

  const expectedCalendarPaths = [
    ...new Set(
      apply.events.map((event) =>
        join(
          runtimeConfig.dataRootPath,
          'groups',
          event.groupJid,
          'calendar',
          `${event.localDate.slice(0, 7)}.json`,
        ),
      ),
    ),
  ];

  for (const calendarPath of expectedCalendarPaths) {
    const calendarContent = await readFile(calendarPath, 'utf8');
    const matchingEvents = apply.events.filter((event) =>
      calendarPath.endsWith(`${event.localDate.slice(0, 7)}.json`) && calendarPath.includes(event.groupJid),
    );

    for (const event of matchingEvents) {
      assert.match(calendarContent, new RegExp(escapeForRegExp(event.legacyEventId), 'u'));
    }
  }

  const applyAgain = await requestJson(`${baseUrl}/api/migrations/wa-notify/schedules/apply`, {
    method: 'POST',
    body: {
      fileName: LEGACY_SCHEDULE_FILE_NAME,
      requestedBy: 'wave45-validator',
    },
  });

  assert.equal(applyAgain.totals.created, 0);
  assert.equal(applyAgain.totals.updated, 0);
  assert.equal(applyAgain.totals.unchanged, expectations.baseEventCount);
  assert.equal(applyAgain.totals.ambiguous, 0);
  assert.equal(applyAgain.totals.missingGroups, 0);
  assert.ok(applyAgain.events.every((event) => event.status === 'unchanged'));

  const schedulesAfterSecondImport = await readJson(
    `${baseUrl}/api/schedules?weekId=${encodeURIComponent(isoWeekId)}`,
  );
  assert.equal(schedulesAfterSecondImport.events.length, expectations.baseEventCount);
  assert.deepEqual(
    [...schedulesAfterSecondImport.events.map((event) => event.eventId)].sort(),
    expectations.baseEventIds,
  );

  await assertHeadlessRoute(`${baseUrl}/settings?mode=live`, [
    'Configuracao',
    'Migracao de schedules do WA-notify',
    'w14y2026.json',
  ]);
});

console.log(
  'Wave 45 validation passed: WA-notify weekly schedules import into the canonical monthly group storage with idempotent re-run behaviour.',
);
