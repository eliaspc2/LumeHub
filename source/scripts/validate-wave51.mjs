import assert from 'node:assert/strict';
import { access, readFile, rm } from 'node:fs/promises';
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
const OBSOLETE_VALIDATOR_PATH = '/home/eliaspc/Documentos/Git/lume-hub/source/scripts/validate-wave50.mjs';

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function withLiveRuntime(run) {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave51-');
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
  const secondaryAuthFilePath = join(runtimeConfig.runtimeRootPath, 'auth-secondary.json');

  await writeJson(secondaryAuthFilePath, {
    auth_mode: 'chatgpt',
    tokens: {
      access_token: 'wave51-secondary-token',
      account_id: 'wave51-secondary-account',
    },
  });

  const bootstrap = new AppBootstrap({
    runtimeConfig: {
      ...runtimeConfig,
      codexAuthSources: [
        {
          accountId: 'secondary-shadow',
          label: 'Conta shadow secundaria',
          filePath: secondaryAuthFilePath,
          priority: 80,
          kind: 'secondary',
        },
      ],
    },
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await waitUntil(() => socketCoordinator.latestSocket !== null);
    socketCoordinator.latestSocket.publishQr('wave51-shadow-qr');
    socketCoordinator.latestSocket.openSession();
    await waitUntil(async () => {
      const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
      return workspace.runtime.session.phase === 'open';
    });
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

  return stdout;
}

await withLiveRuntime(async ({ baseUrl }) => {
  const initialStatus = await readJson(`${baseUrl}/api/settings/codex-auth-router`);
  assert.ok(initialStatus);
  assert.equal(initialStatus.accountCount >= 2, true);
  assert.equal(initialStatus.currentSelection == null || typeof initialStatus.currentSelection.accountId === 'string', true);

  const preparedStatus = await requestJson(`${baseUrl}/api/settings/codex-auth-router/prepare`, {
    method: 'POST',
  });
  assert.ok(preparedStatus.currentSelection);
  assert.equal(preparedStatus.accountCount >= 2, true);
  assert.equal(typeof preparedStatus.lastPreparedAt, 'string');

  const switchedStatus = await requestJson(`${baseUrl}/api/settings/codex-auth-router/switch`, {
    method: 'POST',
    body: {
      accountId: 'secondary-shadow',
    },
  });
  assert.equal(switchedStatus.currentSelection?.accountId, 'secondary-shadow');
  assert.equal(switchedStatus.switchHistory.some((entry) => entry.event === 'force_switch'), true);

  const readiness = await readJson(`${baseUrl}/api/migrations/readiness`);
  assert.ok(readiness.summary.length > 0);
  assert.equal(['blocked', 'shadow_mode'].includes(readiness.recommendedPhase), true);

  await assertHeadlessRoute(`${baseUrl}/migration?mode=live`, [
    'Readiness de migracao',
    'Codex auto router',
    'Contas conhecidas pelo router',
    'Comparacao curta WA-notify vs LumeHub',
  ]);

  const settingsDom = await assertHeadlessRoute(`${baseUrl}/settings?mode=live`, [
    'Configuracao avancada',
    'Ajustes avancados',
    'Migracao de schedules do WA-notify',
    'Migracao de alerts do WA-notify',
    'Migracao de automations do WA-notify',
  ]);
  assert.doesNotMatch(settingsDom, /Shadow mode e readiness de migracao/u);
  assert.doesNotMatch(settingsDom, /Comparacao curta WA-notify vs LumeHub/u);
  assert.doesNotMatch(settingsDom, /Contas conhecidas pelo router/u);

  const implementationWavesDoc = await readFile(
    '/home/eliaspc/Documentos/Git/lume-hub/docs/architecture/lume_hub_implementation_waves.md',
    'utf8',
  );
  const gapAuditDoc = await readFile(
    '/home/eliaspc/Documentos/Git/lume-hub/docs/architecture/lume_hub_gap_audit.md',
    'utf8',
  );
  const shadowModeDoc = await readFile(
    '/home/eliaspc/Documentos/Git/lume-hub/docs/deployment/lume_hub_shadow_mode_checklist.md',
    'utf8',
  );
  const cutoverDoc = await readFile(
    '/home/eliaspc/Documentos/Git/lume-hub/docs/deployment/lume_hub_live_cutover_checklist.md',
    'utf8',
  );
  const rootReadme = await readFile('/home/eliaspc/Documentos/Git/lume-hub/README.md', 'utf8');
  const sourceReadme = await readFile('/home/eliaspc/Documentos/Git/lume-hub/source/README.md', 'utf8');
  const packageJson = JSON.parse(await readFile('/home/eliaspc/Documentos/Git/lume-hub/source/package.json', 'utf8'));

  assert.match(implementationWavesDoc, /A `Wave 51` ja fechou a limpeza final curta dessa ronda/u);
  assert.match(implementationWavesDoc, /### Wave 52 - Fundacao do modelo `group-first`/u);
  assert.doesNotMatch(implementationWavesDoc, /### Wave 51/u);
  assert.doesNotMatch(implementationWavesDoc, /POEMAS DO EDUARDO 2\.pages/u);

  assert.match(gapAuditDoc, /A `Wave 51` ja fechou a limpeza final desta ronda curta/u);
  assert.match(gapAuditDoc, /## Gaps ativos da ronda `group-first`/u);
  assert.doesNotMatch(gapAuditDoc, /O que resta nesta serie e apenas a `Wave 51`/u);

  assert.match(shadowModeDoc, /validate:wave51/u);
  assert.match(cutoverDoc, /validate:wave51/u);
  assert.doesNotMatch(shadowModeDoc, /validate:wave49/u);
  assert.doesNotMatch(cutoverDoc, /validate:wave49/u);

  assert.match(rootReadme, /Wave 0` a `Wave 51/u);
  assert.match(rootReadme, /validate:wave51/u);
  assert.doesNotMatch(rootReadme, /resta apenas a `Wave 51`/u);

  assert.match(sourceReadme, /Wave 0` a `Wave 51/u);
  assert.match(sourceReadme, /validate:wave51/u);
  assert.doesNotMatch(sourceReadme, /validate:wave50/u);
  assert.doesNotMatch(sourceReadme, /resta apenas a `Wave 51`/u);

  assert.equal(typeof packageJson.scripts['validate:wave51'], 'string');
  assert.equal(packageJson.scripts['validate:wave50'], undefined);
  assert.equal(await pathExists(OBSOLETE_VALIDATOR_PATH), false);
});

console.log('validate-wave51: ok');
