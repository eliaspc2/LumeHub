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
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave58-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const groupJid = '120363408888888881@g.us';
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid,
    groupLabel: 'Wave 58 Grupo Principal',
    privateChatJid: '351910000001@s.whatsapp.net',
    privateChatLabel: 'Validator Wave58',
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
        preferredSubject: 'Wave 58 Grupo Principal',
        aliases: ['Wave58'],
        courseId: 'wave58-course',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-04-06T12:00:00.000Z',
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
        lastRefreshedAt: '2026-04-06T12:00:00.000Z',
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
        createdAt: '2026-04-06T12:00:00.000Z',
        updatedAt: '2026-04-06T12:00:00.000Z',
      },
      {
        personId: 'person-private',
        displayName: 'Contacto Privado',
        identifiers: [
          {
            kind: 'whatsapp_jid',
            value: '351910000001@s.whatsapp.net',
          },
        ],
        globalRoles: [],
        createdAt: '2026-04-06T12:00:00.000Z',
        updatedAt: '2026-04-06T12:00:00.000Z',
      },
      {
        personId: 'person-second',
        displayName: 'Segundo Contacto',
        identifiers: [
          {
            kind: 'whatsapp_jid',
            value: '351910000002@s.whatsapp.net',
          },
        ],
        globalRoles: [],
        createdAt: '2026-04-06T12:00:00.000Z',
        updatedAt: '2026-04-06T12:00:00.000Z',
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
    updatedAt: '2026-04-06T12:00:00.000Z',
  });

  const bootstrap = new AppBootstrap({
    runtimeConfig,
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await waitUntil(() => socketCoordinator.latestSocket !== null);
    socketCoordinator.latestSocket.publishQr('wave58-live-qr');
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

await withLiveRuntime(async ({ baseUrl }) => {
  const whatsAppDom = await assertHeadlessRoute(`${baseUrl}/whatsapp?mode=live`, [
    'Sessao e emparelhamento',
    'Controlos do canal',
    'Identidades vistas no canal',
    'Grupos do WhatsApp',
  ]);
  assert.doesNotMatch(whatsAppDom, /Migracao de schedules do WA-notify/u);
  assert.doesNotMatch(whatsAppDom, /Remover app owner/u);
  assert.doesNotMatch(whatsAppDom, /Editar responsaveis e acessos/u);

  const settingsDom = await assertHeadlessRoute(`${baseUrl}/settings?mode=live`, [
    'Comportamento global do produto',
    'LLM, energia e host companion',
    'Defaults canonicos',
    'Governanca global',
  ]);
  assert.doesNotMatch(settingsDom, /Migracao de schedules do WA-notify/u);
  assert.doesNotMatch(settingsDom, /Ferramentas de migracao legacy/u);

  const migrationDom = await assertHeadlessRoute(`${baseUrl}/migration?mode=live`, [
    'Ferramentas de migracao legacy',
    'Migracao de schedules do WA-notify',
    'Migracao de alerts do WA-notify',
    'Migracao de automations do WA-notify',
  ]);
  assert.doesNotMatch(migrationDom, /Comportamento global do produto/u);

  await requestJson(baseUrl, '/api/settings/commands', {
    method: 'PATCH',
    body: {
      assistantEnabled: false,
      allowPrivateAssistant: false,
      directRepliesEnabled: true,
    },
  });
  await requestJson(baseUrl, '/api/settings/llm', {
    method: 'PATCH',
    body: {
      enabled: false,
      streamingEnabled: false,
    },
  });
  await requestJson(baseUrl, '/api/settings/power-policy', {
    method: 'PATCH',
    body: {
      enabled: true,
      mode: 'always_inhibit',
    },
  });
  await requestJson(baseUrl, '/api/settings/autostart', {
    method: 'PATCH',
    body: {
      enabled: false,
    },
  });
  await requestJson(baseUrl, '/api/settings/ui', {
    method: 'PATCH',
    body: {
      defaultNotificationRules: [
        {
          kind: 'fixed_local_time',
          localTime: '16:00',
          enabled: true,
          label: 'No proprio dia as 16:00',
        },
      ],
    },
  });

  const settings = await requestJson(baseUrl, '/api/settings');
  assert.equal(settings.adminSettings.commands.assistantEnabled, false);
  assert.equal(settings.adminSettings.commands.allowPrivateAssistant, false);
  assert.equal(settings.adminSettings.commands.directRepliesEnabled, true);
  assert.equal(settings.adminSettings.llm.enabled, false);
  assert.equal(settings.adminSettings.llm.streamingEnabled, false);
  assert.equal(settings.powerStatus.policy.mode, 'always_inhibit');
  assert.equal(settings.hostStatus.autostart.enabled, false);
  assert.equal(settings.adminSettings.ui.defaultNotificationRules[0].label, 'No proprio dia as 16:00');

  const updatedSettingsDom = await assertHeadlessRoute(`${baseUrl}/settings?mode=live`, [
    'O assistente fica bloqueado em toda a app.',
    'A LLM live fica desligada e o runtime cai para fallback.',
    'Inibir sempre',
    'Autostart desligado',
    'No proprio dia as 16:00',
    'Privado bloqueado',
  ]);
  assert.doesNotMatch(updatedSettingsDom, /Migracao de alerts do WA-notify/u);

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
    /A `Wave 58` ja fechou a separacao entre `WhatsApp`, `LumeHub` e `Migracao`/u,
  );
  assert.doesNotMatch(implementationWavesDoc, /^### Wave 58 - /mu);
  assert.match(implementationWavesDoc, /### Wave 59 - Pagina de chat direto com a LLM/u);

  assert.match(
    gapAuditDoc,
    /a `Wave 58` ja fechou a separacao entre configuracao de canal, configuracao do produto e ferramentas de migracao/u,
  );
  assert.match(gapAuditDoc, /a proxima frente ativa desta ronda passa a ser a `Wave 59`/u);

  assert.match(rootReadme, /As `Wave 0` a `Wave 58` ja foram executadas e validadas\./u);
  assert.match(rootReadme, /a pagina `LumeHub` passou a concentrar settings globais, defaults, host companion e governanca da app/u);

  assert.match(sourceReadme, /a `Wave 58` separou a pagina `WhatsApp` da pagina `LumeHub` e empurrou imports legacy para `Migracao`/u);
  assert.equal(packageJson.scripts['validate:wave58'], 'corepack pnpm run typecheck && corepack pnpm run build && node ./scripts/validate-wave58.mjs');
});
