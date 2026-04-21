import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
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
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave69-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const groupJid = '120363406000000069@g.us';
  const secondGroupJid = '120363406000000690@g.us';
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid,
    groupLabel: 'Wave 69 Grupo Guiado',
    privateChatJid: '351920000069@s.whatsapp.net',
    privateChatLabel: 'Validator Wave69',
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
        preferredSubject: 'Wave 69 Grupo Guiado',
        aliases: ['Wave69'],
        courseId: 'wave69-course',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-04-21T09:00:00.000Z',
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
        lastRefreshedAt: '2026-04-21T09:00:00.000Z',
      },
      {
        groupJid: secondGroupJid,
        preferredSubject: 'Wave 69 Grupo Distribuicao',
        aliases: ['Wave69B'],
        courseId: 'wave69-distribution',
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
        lastRefreshedAt: '2026-04-21T09:00:00.000Z',
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
        createdAt: '2026-04-21T09:00:00.000Z',
        updatedAt: '2026-04-21T09:00:00.000Z',
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
      authorizedPrivateJids: ['351920000069@s.whatsapp.net'],
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
    updatedAt: '2026-04-21T09:00:00.000Z',
  });

  const bootstrap = new AppBootstrap({
    runtimeConfig,
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await waitUntil(() => socketCoordinator.latestSocket !== null);
    socketCoordinator.latestSocket.publishQr('wave69-live-qr');
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
  const groupsDom = await assertHeadlessRoute(`${baseUrl}/groups?mode=live`, [
    'Fluxo guiado do grupo',
    'Passo 1. Escolher grupo',
    'Passo 2. Ver estado atual',
    'Permissoes',
    'Automacao',
    'Passo 3. Automacao e lembretes',
    'Passo 4. Conhecimento do grupo',
    'Gerir',
  ]);

  assert.match(groupsDom, /class="group-tile__summary"/u);
  assert.doesNotMatch(groupsDom, /class="group-tile__switch"/u);
  assert.doesNotMatch(groupsDom, /Configuracao operacional/u);

  const whatsappDom = await assertHeadlessRoute(`${baseUrl}/whatsapp?mode=live`, [
    'Fluxo guiado do WhatsApp',
    '1. Esta ligado?',
    '2. O que falta?',
    '3. Qual o proximo botao?',
    'Reparacao guiada',
    'Verificar auth',
    'Passo 1. Ligar ou reparar sessao',
    'Passo 2. Escolher grupos a operar',
    'Ver pessoas e conversas privadas',
  ]);

  assert.match(whatsappDom, /class="ui-details whatsapp-diagnostics-details"/u);
  assert.doesNotMatch(whatsappDom, /Identidades vistas no canal/u);

  const diagnostics = await readJson(`${baseUrl}/api/runtime/diagnostics`);
  assert.equal(diagnostics.phase, 'running');
  assert.equal(diagnostics.readiness.status, 'healthy');
});
