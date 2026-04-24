import assert from 'node:assert/strict';
import { access, copyFile, mkdir, readFile, rm } from 'node:fs/promises';
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
  waitUntil,
  waitUntilReady,
  writeJson,
} from '../tests/helpers/live-runtime-fixtures.mjs';

const { AppBootstrap } = await import(
  '../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/AppBootstrap.js'
);

const WEB_DIST_ROOT = fileURLToPath(new URL('../apps/lume-hub-web/dist/', import.meta.url));
const LEGACY_SCHEDULES_SOURCE_FILE = '/home/eliaspc/Containers/wa-notify/data/schedules/w14y2026.json';
const LEGACY_ALERTS_SOURCE_FILE = '/home/eliaspc/Containers/wa-notify/data/alerts.json';
const LEGACY_AUTOMATIONS_SOURCE_FILE = '/home/eliaspc/Containers/wa-notify/data/automations.json';
const OBSOLETE_VALIDATORS = [
  '/home/eliaspc/Documentos/Git/lume-hub/source/scripts/validate-wave43.mjs',
  '/home/eliaspc/Documentos/Git/lume-hub/source/scripts/validate-wave44.mjs',
  '/home/eliaspc/Documentos/Git/lume-hub/source/scripts/validate-wave45.mjs',
  '/home/eliaspc/Documentos/Git/lume-hub/source/scripts/validate-wave46.mjs',
  '/home/eliaspc/Documentos/Git/lume-hub/source/scripts/validate-wave47.mjs',
  '/home/eliaspc/Documentos/Git/lume-hub/source/scripts/validate-wave48.mjs',
];

async function withLiveRuntime(run) {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave49-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid: '120363402446203704@g.us',
    groupLabel: 'EFA Programacao A',
    privateChatJid: '351910000001@s.whatsapp.net',
    privateChatLabel: 'Validator Shadow',
  });
  const runtimeConfig = await seedLiveRuntimeSandbox({
    sandboxPath,
    httpPort,
    webDistRootPath: WEB_DIST_ROOT,
    socketCoordinator,
    fetchMock,
  });

  const legacySchedulesRootPath = join(sandboxPath, 'legacy-schedules');
  const legacyAlertsFilePath = join(sandboxPath, 'legacy-alerts.json');
  const legacyAutomationsFilePath = join(sandboxPath, 'legacy-automations.json');

  await mkdir(legacySchedulesRootPath, { recursive: true });
  await copyFile(LEGACY_SCHEDULES_SOURCE_FILE, join(legacySchedulesRootPath, 'w14y2026.json'));
  await copyFile(LEGACY_ALERTS_SOURCE_FILE, legacyAlertsFilePath);
  await copyFile(LEGACY_AUTOMATIONS_SOURCE_FILE, legacyAutomationsFilePath);

    await writeJson(runtimeConfig.groupSeedFilePath, {
    schemaVersion: 1,
    groups: [
      {
        groupJid: '120363402446203704@g.us',
        preferredSubject: 'EFA Programacao A',
        aliases: ['Programacao A', 'Grupo Aulas 1'],
        courseId: 'efa-prog-a',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-03-30T09:00:00.000Z',
            assignedBy: 'wave49-validator',
          },
        ],
        calendarAccessPolicy: {
          group: 'read',
          groupOwner: 'read_write',
          appOwner: 'read_write',
        },
        lastRefreshedAt: '2026-03-30T09:00:00.000Z',
      },
      {
        groupJid: '120363407086801381@g.us',
        preferredSubject: 'Animacao Videojogos FMC 01',
        aliases: ['AV FMC 01', 'Grupo Aulas 2'],
        courseId: 'av-fmc-01',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-03-30T09:00:00.000Z',
            assignedBy: 'wave49-validator',
          },
        ],
        calendarAccessPolicy: {
          group: 'read',
          groupOwner: 'read_write',
          appOwner: 'read_write',
        },
        lastRefreshedAt: '2026-03-30T09:00:00.000Z',
      },
    ],
  });

  const bootstrap = new AppBootstrap({
    runtimeConfig: {
      ...runtimeConfig,
      waNotifySchedulesRootPath: legacySchedulesRootPath,
      waNotifyAlertsFilePath: legacyAlertsFilePath,
      waNotifyAutomationsFilePath: legacyAutomationsFilePath,
    },
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await waitUntil(() => socketCoordinator.latestSocket !== null);
    socketCoordinator.latestSocket.publishQr('wave49-shadow-qr');
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
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

await withLiveRuntime(async ({ baseUrl }) => {
  const files = await readJson(`${baseUrl}/api/migrations/wa-notify/schedules/files`);
  assert.ok(files.some((entry) => entry.fileName === 'w14y2026.json'));

  const initialReadiness = await readJson(`${baseUrl}/api/migrations/readiness`);
  assert.equal(initialReadiness.recommendedPhase, 'blocked');
  assert.equal(initialReadiness.legacySources.scheduleFileCount >= 1, true);
  assert.equal(initialReadiness.whatsapp.phase, 'open');

  const scheduleImport = await requestJson(`${baseUrl}/api/migrations/wa-notify/schedules/apply`, {
    method: 'POST',
    body: {
      fileName: 'w14y2026.json',
      requestedBy: 'wave49-validator',
    },
  });
  assert.equal(scheduleImport.mode, 'apply');
  assert.ok(scheduleImport.totals.created + scheduleImport.totals.updated > 0);

  const alertsImport = await requestJson(`${baseUrl}/api/migrations/wa-notify/alerts/apply`, {
    method: 'POST',
  });
  assert.equal(alertsImport.mode, 'apply');
  assert.ok(alertsImport.totals.importedRules > 0);

  const automationsImport = await requestJson(`${baseUrl}/api/migrations/wa-notify/automations/apply`, {
    method: 'POST',
  });
  assert.equal(automationsImport.mode, 'apply');
  assert.ok(automationsImport.totals.importedDefinitions > 0);

  const llmChat = await requestJson(`${baseUrl}/api/llm/chat`, {
    method: 'POST',
    body: {
      text: 'Resume o readiness atual para migracao.',
      intent: 'migration_readiness_summary',
      contextSummary: ['Wave 49 em validacao.'],
      domainFacts: ['Os imports legacy ja foram aplicados neste sandbox.'],
    },
  });
  assert.equal(llmChat.providerId, 'codex-oauth');

  const readiness = await readJson(`${baseUrl}/api/migrations/readiness`);
  assert.equal(readiness.recommendedPhase, 'shadow_mode');
  assert.equal(readiness.blockers.length, 0);
  assert.equal(readiness.runtime.ready, true);
  assert.equal(readiness.whatsapp.phase, 'open');
  assert.equal(readiness.legacySources.scheduleFileCount >= 1, true);
  assert.equal(readiness.legacySources.alertsFilePresent, true);
  assert.equal(readiness.legacySources.automationsFilePresent, true);
  assert.equal(readiness.lumeHubState.importedScheduleEvents > 0, true);
  assert.equal(readiness.lumeHubState.alertRules > 0, true);
  assert.equal(readiness.lumeHubState.automationDefinitions > 0, true);
  assert.equal(readiness.lumeHubState.llmRunCount > 0, true);
  assert.ok(
    readiness.checklist.some((item) => item.itemId === 'parity' && item.status === 'ready'),
    'Expected the parity item to be ready after the imports.',
  );
  assert.ok(
    readiness.shadowModeChecks.length >= 3,
    'Expected concrete operator checks for the shadow week.',
  );
  assert.ok(
    readiness.cutoverChecks.length >= 3,
    'Expected concrete checks before deciding the final cutover.',
  );

  const cutoverDoc = await readFile(
    '/home/eliaspc/Documentos/Git/lume-hub/docs/deployment/lume_hub_live_cutover_checklist.md',
    'utf8',
  );
  const shadowModeDoc = await readFile(
    '/home/eliaspc/Documentos/Git/lume-hub/docs/deployment/lume_hub_shadow_mode_checklist.md',
    'utf8',
  );
  const implementationWavesDoc = await readFile(
    '/home/eliaspc/Documentos/Git/lume-hub/docs/architecture/lume_hub_implementation_waves.md',
    'utf8',
  );
  const gapAuditDoc = await readFile(
    '/home/eliaspc/Documentos/Git/lume-hub/docs/architecture/lume_hub_gap_audit.md',
    'utf8',
  );
  const rootReadme = await readFile('/home/eliaspc/Documentos/Git/lume-hub/README.md', 'utf8');
  const sourceReadme = await readFile('/home/eliaspc/Documentos/Git/lume-hub/source/README.md', 'utf8');
  const packageJson = JSON.parse(
    await readFile('/home/eliaspc/Documentos/Git/lume-hub/source/package.json', 'utf8'),
  );

  assert.match(cutoverDoc, /validate:wave49/u);
  assert.match(cutoverDoc, /shadow mode/u);
  assert.doesNotMatch(cutoverDoc, /validate:wave4[3-8]/u);
  assert.match(shadowModeDoc, /WA-notify/u);
  assert.match(shadowModeDoc, /LumeHub/u);
  assert.match(shadowModeDoc, /validate:wave49/u);
  assert.match(implementationWavesDoc, /Neste momento nao ha waves ativas/u);
  assert.doesNotMatch(implementationWavesDoc, /### Wave 49/u);
  assert.match(gapAuditDoc, /Nao restam gaps tecnicos ativos na ronda de paridade e cutover WA-notify/u);
  assert.match(rootReadme, /Wave 0` a `Wave 49/u);
  assert.match(rootReadme, /ronda de paridade e migracao ficou fechada/u);
  assert.match(sourceReadme, /validate:wave49/u);
  assert.doesNotMatch(sourceReadme, /validate:wave4[3-8]/u);

  assert.equal(typeof packageJson.scripts['validate:wave49'], 'string');

  for (const legacyScriptName of [
    'validate:wave43',
    'validate:wave44',
    'validate:wave45',
    'validate:wave46',
    'validate:wave47',
    'validate:wave48',
  ]) {
    assert.equal(packageJson.scripts[legacyScriptName], undefined);
  }

  for (const obsoleteValidatorPath of OBSOLETE_VALIDATORS) {
    assert.equal(await pathExists(obsoleteValidatorPath), false);
  }

  await assertHeadlessRoute(`${baseUrl}/settings?mode=live`, [
    'Shadow mode e readiness de migracao',
    'Fase recomendada',
    'Comparacao curta WA-notify vs LumeHub',
    'O que fazer durante a semana paralela',
  ]);
});

console.log('validate-wave49: ok');
