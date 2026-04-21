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
  waitUntil,
  waitUntilReady,
  writeJson,
} from '../tests/helpers/live-runtime-fixtures.mjs';

const { AppBootstrap } = await import(
  '../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/AppBootstrap.js'
);

const WEB_DIST_ROOT = fileURLToPath(new URL('../apps/lume-hub-web/dist/', import.meta.url));

async function withLiveRuntime(run) {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave70-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const groupJid = '120363407000000070@g.us';
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid,
    groupLabel: 'Wave 70 Operacao',
    privateChatJid: '351920000070@s.whatsapp.net',
    privateChatLabel: 'Validator Wave70',
  });
  const runtimeConfig = await seedLiveRuntimeSandbox({
    sandboxPath,
    httpPort,
    webDistRootPath: WEB_DIST_ROOT,
    socketCoordinator,
    fetchMock,
  });
  const reserveAFilePath = `${runtimeConfig.runtimeRootPath}/auth-wave70-reserve-a.json`;
  const reserveBFilePath = `${runtimeConfig.runtimeRootPath}/auth-wave70-reserve-b.json`;

  await writeJson(runtimeConfig.groupSeedFilePath, {
    schemaVersion: 1,
    groups: [
      {
        groupJid,
        preferredSubject: 'Wave 70 Operacao',
        aliases: ['Wave70'],
        courseId: 'wave70-course',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-04-21T10:00:00.000Z',
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
        lastRefreshedAt: '2026-04-21T10:00:00.000Z',
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
        createdAt: '2026-04-21T10:00:00.000Z',
        updatedAt: '2026-04-21T10:00:00.000Z',
      },
      {
        personId: 'person-private',
        displayName: 'Contacto Wave70',
        identifiers: [
          {
            kind: 'whatsapp_jid',
            value: '351920000070@s.whatsapp.net',
          },
        ],
        globalRoles: [],
        createdAt: '2026-04-21T10:00:00.000Z',
        updatedAt: '2026-04-21T10:00:00.000Z',
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
      authorizedPrivateJids: ['351920000070@s.whatsapp.net'],
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
    updatedAt: '2026-04-21T10:00:00.000Z',
  });

  await writeJson(reserveAFilePath, {
    auth_mode: 'chatgpt',
    tokens: {
      access_token: 'wave70-reserve-a-token',
      account_id: 'wave70-reserve-a',
    },
  });
  await writeJson(reserveBFilePath, {
    auth_mode: 'chatgpt',
    tokens: {
      access_token: 'wave70-reserve-b-token',
      account_id: 'wave70-reserve-b',
    },
  });

  const bootstrap = new AppBootstrap({
    runtimeConfig: {
      ...runtimeConfig,
      codexAuthSources: [
        {
          accountId: 'wave70-reserve-a',
          label: 'Token Wave70 reserva A',
          filePath: reserveAFilePath,
          priority: 1,
          kind: 'secondary',
        },
        {
          accountId: 'wave70-reserve-b',
          label: 'Token Wave70 reserva B',
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
    socketCoordinator.latestSocket.publishQr('wave70-live-qr');
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
  let stdout = '';
  let stderr = '';

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    ({ stdout, stderr } = await runChromeDump(url));

    const missingTexts = expectedTexts.filter((expectedText) => !new RegExp(escapeForRegExp(expectedText), 'u').test(stdout));
    const hasRuntimeError = /(TypeError|ReferenceError|Uncaught|SEVERE)/u.test(stderr);
    const hasErrorUi = /Algo falhou ao carregar esta pagina/u.test(stdout);
    const looksUnhydrated = /<div id="app"><\/div>/u.test(stdout) && !/app-shell/u.test(stdout);

    if (missingTexts.length === 0 && !hasRuntimeError && !hasErrorUi) {
      return stdout;
    }

    if (!looksUnhydrated || attempt === 4) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  for (const expectedText of expectedTexts) {
    assert.match(stdout, new RegExp(escapeForRegExp(expectedText), 'u'));
  }

  assert.doesNotMatch(stderr, /(TypeError|ReferenceError|Uncaught|SEVERE)/u);
  assert.doesNotMatch(stdout, /Algo falhou ao carregar esta pagina/u);

  return stdout;
}

await withLiveRuntime(async ({ baseUrl }) => {
  const authRouterStatus = await requestJson(`${baseUrl}/api/settings/codex-auth-router`);
  assert.equal(authRouterStatus.enabled, true);
  assert.equal(authRouterStatus.accountCount, 3);

  const disabledAuthRouterStatus = await requestJson(`${baseUrl}/api/settings/codex-auth-router`, {
    method: 'PATCH',
    body: {
      enabled: false,
    },
  });
  assert.equal(disabledAuthRouterStatus.enabled, false);

  const reenabledAuthRouterStatus = await requestJson(`${baseUrl}/api/settings/codex-auth-router`, {
    method: 'PATCH',
    body: {
      enabled: true,
    },
  });
  assert.equal(reenabledAuthRouterStatus.enabled, true);

  const settingsDom = await assertHeadlessRoute(`${baseUrl}/settings?mode=live`, [
    'Painel base do produto',
    'Basico: leitura rapida',
    'Saude operacional',
    'Avancado: LLM, energia, tokens, avisos e governanca',
    'Codex Router nesta instalacao',
    'Desligar troca de token',
  ]);
  assert.match(settingsDom, /<details class="surface content-card settings-advanced-details">/u);
  assert.doesNotMatch(settingsDom, /Ferramentas de migracao legacy/u);
  assert.doesNotMatch(settingsDom, /Migracao de schedules do WA-notify/u);

  const codexRouterDom = await assertHeadlessRoute(`${baseUrl}/codex-router?mode=live`, [
    'Backup antes de trocar',
    'Operacao segura',
    'Contrato de seguranca',
    'Escolha manual de token',
    'Ver todos os tokens e escolher manualmente',
    'Token Wave70 reserva A',
  ]);
  assert.match(codexRouterDom, /class="ui-details codex-router-token-details"/u);

  const migrationDom = await assertHeadlessRoute(`${baseUrl}/migration?mode=live`, [
    'Consola de operador',
    'Esta pagina nao e a homepage normal do produto',
    'Wizard de operador',
    'Passo 1. Confirmar que o LumeHub esta acordado',
    'Passo 4. Decidir semana paralela ou corte',
    'Tokens do Codex vivem noutra pagina',
    'Ferramentas de operador',
  ]);
  assert.match(migrationDom, /<details class="ui-details">\s*<summary>Comparacao curta WA-notify vs LumeHub/u);
  assert.match(migrationDom, /<details class="ui-details">\s*<summary>Migracao de schedules do WA-notify/u);
  assert.doesNotMatch(migrationDom, /Operacao segura/u);
  assert.doesNotMatch(migrationDom, /Escolha manual de token/u);

  const diagnostics = await readJson(`${baseUrl}/api/runtime/diagnostics`);
  assert.equal(diagnostics.phase, 'running');
  assert.equal(diagnostics.readiness.status, 'healthy');
});
