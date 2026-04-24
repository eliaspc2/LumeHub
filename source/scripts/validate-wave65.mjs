import assert from 'node:assert/strict';
import { access, readdir, readFile, rm } from 'node:fs/promises';
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
const WEB_DIST_ASSETS_ROOT = fileURLToPath(new URL('../apps/lume-hub-web/dist/assets/', import.meta.url));
const GROUP_FIRST_VALIDATOR_WAVES = [52, 53, 54, 55, 56, 57, 58, 59];
const UI_CLARITY_VALIDATOR_WAVES = [61, 62, 63, 64];

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function withLiveRuntime(run) {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave65-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const groupJid = '120363406000000060@g.us';
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid,
    groupLabel: 'Wave 65 Grupo Final',
    privateChatJid: '351920000060@s.whatsapp.net',
    privateChatLabel: 'Validator Wave65',
  });
  const runtimeConfig = await seedLiveRuntimeSandbox({
    sandboxPath,
    httpPort,
    webDistRootPath: WEB_DIST_ROOT,
    socketCoordinator,
    fetchMock,
  });
  const reserveAFilePath = `${runtimeConfig.runtimeRootPath}/auth-reserve-a.json`;
  const reserveBFilePath = `${runtimeConfig.runtimeRootPath}/auth-reserve-b.json`;

  await writeJson(runtimeConfig.groupSeedFilePath, {
    schemaVersion: 1,
    groups: [
      {
        groupJid,
        preferredSubject: 'Wave 65 Grupo Final',
        aliases: ['Wave65'],
        courseId: 'wave65-course',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-04-06T14:00:00.000Z',
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
        lastRefreshedAt: '2026-04-06T14:00:00.000Z',
      },
    ],
  });

  await writeJson(runtimeConfig.peopleFilePath, {
    schemaVersion: 1,
    people: [
      {
        personId: 'person-app-owner',
        displayName: 'Dono da App',
        identifiers: [
          {
            kind: 'whatsapp_jid',
            value: '351910000099@s.whatsapp.net',
          },
        ],
        globalRoles: ['app_owner'],
        createdAt: '2026-04-06T14:00:00.000Z',
        updatedAt: '2026-04-06T14:00:00.000Z',
      },
      {
        personId: 'person-private',
        displayName: 'Contacto Wave65',
        identifiers: [
          {
            kind: 'whatsapp_jid',
            value: '351920000060@s.whatsapp.net',
          },
        ],
        globalRoles: [],
        createdAt: '2026-04-06T14:00:00.000Z',
        updatedAt: '2026-04-06T14:00:00.000Z',
      },
    ],
    notes: [],
  });

  await writeJson(runtimeConfig.settingsFilePath, {
    schemaVersion: 1,
    commands: {
      assistantEnabled: true,
      schedulingEnabled: true,
      ownerTerminalEnabled: true,
      autoReplyEnabled: true,
      directRepliesEnabled: false,
      allowPrivateAssistant: true,
      authorizedGroupJids: [groupJid],
      authorizedPrivateJids: [],
    },
    whatsapp: {
      enabled: true,
      sharedAuthWithCodex: true,
      groupDiscoveryEnabled: true,
      conversationDiscoveryEnabled: true,
    },
    llm: {
      enabled: true,
      provider: 'codex-oauth',
      model: 'gpt-5.4',
      streamingEnabled: true,
    },
    ui: {
      defaultNotificationRules: [
        {
          kind: 'relative_before_event',
          daysBeforeEvent: 1,
          offsetMinutesBeforeEvent: 0,
          enabled: true,
          label: '24h antes',
        },
        {
          kind: 'relative_before_event',
          daysBeforeEvent: 0,
          offsetMinutesBeforeEvent: 30,
          enabled: true,
          label: '30 min antes',
        },
      ],
    },
    updatedAt: '2026-04-06T14:00:00.000Z',
  });

  await writeJson(reserveAFilePath, {
    auth_mode: 'chatgpt',
    tokens: {
      access_token: 'wave65-reserve-a-token',
      account_id: 'wave65-reserve-a',
    },
  });
  await writeJson(reserveBFilePath, {
    auth_mode: 'chatgpt',
    tokens: {
      access_token: 'wave65-reserve-b-token',
      account_id: 'wave65-reserve-b',
    },
  });

  const bootstrap = new AppBootstrap({
    runtimeConfig: {
      ...runtimeConfig,
      codexAuthSources: [
        {
          accountId: 'reserve-a',
          label: 'Token reserva A',
          filePath: reserveAFilePath,
          priority: 1,
          kind: 'secondary',
        },
        {
          accountId: 'reserve-b',
          label: 'Token reserva B',
          filePath: reserveBFilePath,
          priority: 2,
          kind: 'secondary',
        },
      ],
    },
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await waitUntil(() => socketCoordinator.latestSocket !== null);
    socketCoordinator.latestSocket.publishQr('wave65-live-qr');
    socketCoordinator.latestSocket.openSession();
    await waitUntil(async () => {
      const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
      return workspace.runtime.session.phase === 'open';
    });
    await run({ baseUrl, groupJid, fetchMock, runtimeConfig });
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

async function readBuiltWebBundle() {
  const assets = await readdir(WEB_DIST_ASSETS_ROOT);
  const jsBundle = assets.find((asset) => asset.endsWith('.js'));

  assert.ok(jsBundle, 'Expected a built web JS bundle in dist/assets.');
  return readFile(new URL(`../apps/lume-hub-web/dist/assets/${jsBundle}`, import.meta.url), 'utf8');
}

await withLiveRuntime(async ({ baseUrl, groupJid, fetchMock, runtimeConfig }) => {
  const shellDom = await assertHeadlessRoute(`${baseUrl}/?mode=live`, [
    'Calendario',
    'Grupos',
    'WhatsApp',
    'LumeHub',
    'LLM',
    'Migracao',
    'Wave 65 Grupo Final',
  ]);
  assert.match(shellDom, /data-route="\/assistant"/u);

  await assertHeadlessRoute(`${baseUrl}/week?mode=live`, ['Calendario semanal', 'Wave 65 Grupo Final']);
  await assertHeadlessRoute(`${baseUrl}/groups/${encodeURIComponent(groupJid)}?mode=live`, [
    'Configuracao operacional',
    'Wave 65 Grupo Final',
    'Leitura rapida',
    'Escopo local',
  ]);
  await assertHeadlessRoute(`${baseUrl}/assistant?mode=live`, [
    'Perguntar',
    'Agir no calendario',
    'Atividade recente',
    'Pedir mudanca',
    'Ver detalhe tecnico',
  ]);
  await assertHeadlessRoute(`${baseUrl}/whatsapp?mode=live`, [
    'Leitura rapida do canal',
    'Sessao e emparelhamento',
    'Identidades vistas no canal',
  ]);
  await assertHeadlessRoute(`${baseUrl}/settings?mode=live`, [
    'Leitura rapida do produto',
    'Regras globais',
    'LLM, energia e arranque',
  ]);
  await assertHeadlessRoute(`${baseUrl}/migration?mode=live`, [
    'Prontidao da semana paralela',
    'Estado do router',
    'Tokens do Codex',
    'Tokens disponiveis',
    'Token reserva A',
    'Token reserva B',
  ]);

  const groupFirstContract = await requestJson(baseUrl, '/api/group-first/contract');
  assert.equal(groupFirstContract.pages.calendar.currentRoute, '/week');
  assert.equal(groupFirstContract.pages.groups.collectionRoute, '/groups');
  assert.equal(groupFirstContract.pages.groups.itemRoutePattern, '/groups/:groupJid');
  assert.equal(groupFirstContract.pages.whatsapp.currentRoute, '/whatsapp');
  assert.equal(groupFirstContract.pages.lumeHub.currentRoute, '/settings');
  assert.equal(groupFirstContract.pages.llm.currentRoute, '/assistant');
  assert.equal(groupFirstContract.pages.migration.currentRoute, '/migration');

  const initialAuthRouterStatus = await requestJson(baseUrl, '/api/settings/codex-auth-router');
  assert.equal(initialAuthRouterStatus.enabled, true);
  assert.equal(initialAuthRouterStatus.accountCount, 3);
  assert.equal(initialAuthRouterStatus.accounts.length, 3);

  const disabledAuthRouterStatus = await requestJson(baseUrl, '/api/settings/codex-auth-router', {
    method: 'PATCH',
    body: {
      enabled: false,
    },
  });
  assert.equal(disabledAuthRouterStatus.enabled, false);

  const reenabledAuthRouterStatus = await requestJson(baseUrl, '/api/settings/codex-auth-router', {
    method: 'PATCH',
    body: {
      enabled: true,
    },
  });
  assert.equal(reenabledAuthRouterStatus.enabled, true);

  const switchedAuthRouterStatus = await requestJson(baseUrl, '/api/settings/codex-auth-router/switch', {
    method: 'POST',
    body: {
      accountId: 'reserve-b',
    },
  });
  assert.equal(switchedAuthRouterStatus.currentSelection?.accountId, 'reserve-b');
  assert.equal(switchedAuthRouterStatus.accountCount, 3);
  assert.match(await readFile(runtimeConfig.canonicalCodexAuthFile, 'utf8'), /wave65-reserve-b-token/u);

  const groupChat = await requestJson(baseUrl, '/api/llm/chat', {
    method: 'POST',
    body: {
      text: 'Afina a linguagem da pagina LLM e mantem o detalhe tecnico em segundo plano.',
      intent: 'direct_group_chat',
      contextSummary: ['Resposta local da pagina LLM. Nao enviar nada para WhatsApp.'],
      domainFacts: ['Grupo ativo: Wave 65 Grupo Final.'],
      memoryScope: {
        scope: 'group',
        groupJid,
        groupLabel: 'Wave 65 Grupo Final',
        instructionsSource: 'missing',
        instructionsApplied: false,
        knowledgeDocuments: [],
      },
    },
  });
  assert.match(groupChat.text, /Resposta Codex live/u);

  const logs = await requestJson(baseUrl, '/api/logs/llm?limit=5');
  const groupLog = logs.find((entry) => entry.runId === groupChat.runId);
  assert.equal(groupLog?.memoryScope?.scope, 'group');
  assert.equal(groupLog?.memoryScope?.groupLabel, 'Wave 65 Grupo Final');
  assert.ok(fetchMock.state.codexChatCalls.length >= 1);

  const webBundle = await readBuiltWebBundle();
  assert.match(webBundle, /Calendario semanal/u);
  assert.match(webBundle, /Configuracao operacional/u);
  assert.match(webBundle, /Agir no calendario/u);
  assert.match(webBundle, /Leitura rapida do canal/u);
  assert.match(webBundle, /Leitura rapida do produto/u);
  assert.match(webBundle, /Tokens do Codex/u);
});

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
const packageJson = JSON.parse(await readFile('/home/eliaspc/Documentos/Git/lume-hub/source/package.json', 'utf8'));
const appRouterSource = await readFile(
  '/home/eliaspc/Documentos/Git/lume-hub/source/apps/lume-hub-web/src/app/AppRouter.ts',
  'utf8',
);
const appShellSource = await readFile(
  '/home/eliaspc/Documentos/Git/lume-hub/source/apps/lume-hub-web/src/shell/AppShell.ts',
  'utf8',
);

assert.match(implementationWavesDoc, /A `Wave 60` fechou a limpeza final da ronda `group-first`/u);
assert.match(implementationWavesDoc, /## Ronda `ui-clarity`/u);
assert.match(implementationWavesDoc, /A `Wave 62` ja fechou a simplificacao estrutural da pagina `LLM`/u);
assert.match(implementationWavesDoc, /A `Wave 63` ja fechou a linguagem canonica e a divulgacao progressiva desta ronda/u);
assert.match(implementationWavesDoc, /A `Wave 64` ja fechou a migracao da shell restante para os novos objetos/u);
assert.match(implementationWavesDoc, /A `Wave 65` ja fechou a limpeza final da ronda `ui-clarity`/u);
assert.match(implementationWavesDoc, /tratar o `codex auto router` como lista explicita de tokens/u);
assert.match(
  implementationWavesDoc,
  /bash \/home\/eliaspc\/Documentos\/Instruction\/KubuntuLTS\/scripts\/lumehub-launch\.sh restart/u,
);
assert.match(
  implementationWavesDoc,
  /setsid bash \/home\/eliaspc\/Documentos\/Instruction\/KubuntuLTS\/scripts\/lumehub-launch\.sh restart/u,
);
assert.match(
  implementationWavesDoc,
  /bash \/home\/eliaspc\/Documentos\/Instruction\/KubuntuLTS\/scripts\/lumehub-launch\.sh status/u,
);
assert.doesNotMatch(implementationWavesDoc, /### Wave 61 - Contratos de composicao e densidade base/u);
assert.doesNotMatch(implementationWavesDoc, /### Wave 62 - Pagina `LLM` mais clara, mais densa e com menos ruido/u);
assert.doesNotMatch(implementationWavesDoc, /### Wave 63 - Linguagem canonica e divulgacao progressiva/u);
assert.doesNotMatch(implementationWavesDoc, /### Wave 64 - Migracao da shell restante para os novos objetos/u);
assert.doesNotMatch(implementationWavesDoc, /### Wave 65 - Limpeza final da ronda `ui-clarity`/u);
assert.match(implementationWavesDoc, /Nao ha waves ativas neste momento\./u);

assert.match(gapAuditDoc, /## Gaps ativos da ronda `ui-clarity`/u);
assert.match(gapAuditDoc, /A `Wave 60` ja fechou a limpeza final da ronda `group-first`/u);
assert.match(gapAuditDoc, /A `Wave 61` ja fechou a base de composicao e densidade desta ronda/u);
assert.match(gapAuditDoc, /A `Wave 63` ja fechou a linguagem canonica, a divulgacao progressiva e a leitura do `codex auto router` como lista de `3\+` tokens/u);
assert.match(gapAuditDoc, /A `Wave 64` ja fechou a migracao da shell restante para os novos objetos/u);
assert.match(gapAuditDoc, /A `Wave 65` ja fechou a limpeza final desta ronda/u);
assert.match(gapAuditDoc, /Nao restam gaps funcionais ativos nesta ronda/u);

assert.match(rootReadme, /As `Wave 0` a `Wave 60` ja foram executadas e validadas\./u);
assert.match(rootReadme, /a ronda `ui-clarity` tambem ficou fechada com a `Wave 65`/u);
assert.match(rootReadme, /a validacao consolidada mais recente passou a ser `validate:wave65`/u);
assert.match(rootReadme, /a composicao visual deve assentar em poucos objetos internos, claros e repetiveis/u);
assert.match(sourceReadme, /as `Wave 0` a `Wave 60` foram executadas/u);
assert.match(sourceReadme, /a validacao consolidada mais recente passou a ser `validate:wave65`/u);
assert.match(sourceReadme, /`validate:wave65`/u);
assert.match(sourceReadme, /A ronda de simplificacao do GUI ficou fechada/u);
assert.match(sourceReadme, /a `Wave 65` removeu restos de transicao/u);
assert.doesNotMatch(sourceReadme, /`validate:wave64`/u);
assert.doesNotMatch(sourceReadme, /`validate:wave63`/u);
assert.doesNotMatch(sourceReadme, /`validate:wave62`/u);
assert.doesNotMatch(sourceReadme, /`validate:wave61`/u);

assert.equal(
  packageJson.scripts['validate:wave65'],
  'corepack pnpm run typecheck && corepack pnpm run build && node --test ./tests/unit/group-repository-owner-override.test.mjs ./tests/unit/codex-auth-router-enabled.test.mjs ./tests/unit/codex-auth-router-multi-account.test.mjs ./tests/integration/wave56-group-mode-routing.test.mjs ./tests/integration/wave57-group-ownership-policy.test.mjs && node --experimental-global-webcrypto ./scripts/validate-wave65.mjs',
);
assert.equal(
  packageJson.scripts['validate:wave60'],
  'corepack pnpm run typecheck && corepack pnpm run build && node --test ./tests/unit/group-repository-owner-override.test.mjs ./tests/integration/wave56-group-mode-routing.test.mjs ./tests/integration/wave57-group-ownership-policy.test.mjs && node ./scripts/validate-wave60.mjs',
);

for (const wave of GROUP_FIRST_VALIDATOR_WAVES) {
  assert.equal(packageJson.scripts[`validate:wave${wave}`], undefined);
  assert.equal(
    await fileExists(`/home/eliaspc/Documentos/Git/lume-hub/source/scripts/validate-wave${wave}.mjs`),
    false,
  );
}

for (const wave of UI_CLARITY_VALIDATOR_WAVES) {
  assert.equal(packageJson.scripts[`validate:wave${wave}`], undefined);
  assert.equal(
    await fileExists(`/home/eliaspc/Documentos/Git/lume-hub/source/scripts/validate-wave${wave}.mjs`),
    false,
  );
}

assert.doesNotMatch(appRouterSource, /assistant-console/u);
assert.doesNotMatch(appRouterSource, /\/llm/u);
assert.doesNotMatch(appShellSource, /chat lateral/u);
assert.match(appShellSource, /Agir no calendario/u);
assert.match(appShellSource, /Leitura rapida do canal/u);
assert.match(appShellSource, /Leitura rapida do produto/u);
assert.match(appShellSource, /Escopo local/u);
assert.match(appShellSource, /Estado do router/u);
assert.doesNotMatch(appShellSource, /Chat vs acao/u);
assert.doesNotMatch(appShellSource, /llm-status-item/u);
assert.doesNotMatch(appShellSource, /llm-inline-empty/u);
assert.doesNotMatch(appShellSource, /llm-detail-line/u);

console.log('validate-wave65: ok');
