import assert from 'node:assert/strict';
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

async function withLiveRuntime(run) {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave50-');
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
      access_token: 'wave50-secondary-token',
      account_id: 'wave50-secondary-account',
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
    socketCoordinator.latestSocket.publishQr('wave50-shadow-qr');
    socketCoordinator.latestSocket.openSession();
    await waitUntil(async () => {
      const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
      return workspace.runtime.session.phase === 'open';
    });
    await run({ baseUrl });
  } finally {
    await bootstrap.stop().catch(() => undefined);
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
});

console.log('validate-wave50: ok');
