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

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function withLiveRuntime(run) {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave60-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const groupJid = '120363406000000060@g.us';
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid,
    groupLabel: 'Wave 60 Grupo Final',
    privateChatJid: '351920000060@s.whatsapp.net',
    privateChatLabel: 'Validator Wave60',
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
        groupJid,
        preferredSubject: 'Wave 60 Grupo Final',
        aliases: ['Wave60'],
        courseId: 'wave60-course',
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
        displayName: 'Contacto Wave60',
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

  const bootstrap = new AppBootstrap({
    runtimeConfig,
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await waitUntil(() => socketCoordinator.latestSocket !== null);
    socketCoordinator.latestSocket.publishQr('wave60-live-qr');
    socketCoordinator.latestSocket.openSession();
    await waitUntil(async () => {
      const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
      return workspace.runtime.session.phase === 'open';
    });
    await run({ baseUrl, groupJid, fetchMock });
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

await withLiveRuntime(async ({ baseUrl, groupJid, fetchMock }) => {
  const shellDom = await assertHeadlessRoute(`${baseUrl}/?mode=live`, [
    'Calendario',
    'Grupos',
    'WhatsApp',
    'LumeHub',
    'LLM',
    'Migracao',
    'Wave 60 Grupo Final',
  ]);
  assert.match(shellDom, /data-route="\/assistant"/u);

  await assertHeadlessRoute(`${baseUrl}/week?mode=live`, ['Calendario semanal', 'Wave 60 Grupo Final']);
  await assertHeadlessRoute(`${baseUrl}/groups/${encodeURIComponent(groupJid)}?mode=live`, [
    'Configuracao operacional',
    'Wave 60 Grupo Final',
    'Com agendamento',
  ]);
  await assertHeadlessRoute(`${baseUrl}/assistant?mode=live`, [
    'Chat direto com a LLM',
    'Responder com escopo',
    'Chat vs acao',
  ]);
  await assertHeadlessRoute(`${baseUrl}/whatsapp?mode=live`, ['Sessao e emparelhamento']);
  await assertHeadlessRoute(`${baseUrl}/settings?mode=live`, ['Comportamento global do produto']);
  await assertHeadlessRoute(`${baseUrl}/migration?mode=live`, ['Ferramentas de migracao legacy']);

  const groupFirstContract = await requestJson(baseUrl, '/api/group-first/contract');
  assert.equal(groupFirstContract.pages.calendar.currentRoute, '/week');
  assert.equal(groupFirstContract.pages.groups.collectionRoute, '/groups');
  assert.equal(groupFirstContract.pages.groups.itemRoutePattern, '/groups/:groupJid');
  assert.equal(groupFirstContract.pages.whatsapp.currentRoute, '/whatsapp');
  assert.equal(groupFirstContract.pages.lumeHub.currentRoute, '/settings');
  assert.equal(groupFirstContract.pages.llm.currentRoute, '/assistant');
  assert.equal(groupFirstContract.pages.migration.currentRoute, '/migration');

  const groupChat = await requestJson(baseUrl, '/api/llm/chat', {
    method: 'POST',
    body: {
      text: 'Fecha a Wave 60 como limpeza final da ronda group-first.',
      intent: 'direct_group_chat',
      contextSummary: ['Resposta local da pagina LLM. Nao enviar nada para WhatsApp.'],
      domainFacts: ['Grupo ativo: Wave 60 Grupo Final.'],
      memoryScope: {
        scope: 'group',
        groupJid,
        groupLabel: 'Wave 60 Grupo Final',
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
  assert.equal(groupLog?.memoryScope?.groupLabel, 'Wave 60 Grupo Final');
  assert.ok(fetchMock.state.codexChatCalls.length >= 1);

  const webBundle = await readBuiltWebBundle();
  assert.match(webBundle, /Calendario semanal/u);
  assert.match(webBundle, /Configuracao operacional/u);
  assert.match(webBundle, /Chat direto com a LLM/u);
  assert.match(webBundle, /Sessao e emparelhamento/u);
  assert.match(webBundle, /Comportamento global do produto/u);
  assert.match(webBundle, /Ferramentas de migracao legacy/u);
});

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
const appRouterSource = await readFile(
  '/home/eliaspc/Documentos/lume-hub/source/apps/lume-hub-web/src/app/AppRouter.ts',
  'utf8',
);
const appShellSource = await readFile(
  '/home/eliaspc/Documentos/lume-hub/source/apps/lume-hub-web/src/shell/AppShell.ts',
  'utf8',
);

assert.match(implementationWavesDoc, /A `Wave 60` fechou a limpeza final da ronda `group-first`/u);
assert.doesNotMatch(implementationWavesDoc, /^### Wave 60 - /mu);
assert.match(implementationWavesDoc, /Nao ha waves ativas neste momento/u);

assert.match(gapAuditDoc, /Nao restam gaps funcionais ativos nesta ronda/u);
assert.match(gapAuditDoc, /A `Wave 60` ja fechou a limpeza final da ronda `group-first`/u);
assert.doesNotMatch(gapAuditDoc, /a proxima frente ativa desta ronda passa a ser a `Wave 60`/u);

assert.match(rootReadme, /As `Wave 0` a `Wave 60` ja foram executadas e validadas\./u);
assert.match(rootReadme, /a validacao consolidada mais recente passou a ser `validate:wave60`/u);
assert.match(sourceReadme, /as `Wave 0` a `Wave 60` foram executadas/u);
assert.match(sourceReadme, /a validacao consolidada mais recente passou a ser `validate:wave60`/u);

assert.equal(
  packageJson.scripts['validate:wave60'],
  'corepack pnpm run typecheck && corepack pnpm run build && node --test ./tests/unit/group-repository-owner-override.test.mjs ./tests/integration/wave56-group-mode-routing.test.mjs ./tests/integration/wave57-group-ownership-policy.test.mjs && node ./scripts/validate-wave60.mjs',
);

for (const wave of GROUP_FIRST_VALIDATOR_WAVES) {
  assert.equal(packageJson.scripts[`validate:wave${wave}`], undefined);
  assert.equal(
    await fileExists(`/home/eliaspc/Documentos/lume-hub/source/scripts/validate-wave${wave}.mjs`),
    false,
  );
}

assert.doesNotMatch(appRouterSource, /assistant-console/u);
assert.doesNotMatch(appRouterSource, /\/llm/u);
assert.doesNotMatch(appShellSource, /chat lateral/u);

console.log('validate-wave60: ok');
