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
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave67-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const groupJid = '120363406000000067@g.us';
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid,
    groupLabel: 'Wave 67 Grupo Operacional',
    privateChatJid: '351920000067@s.whatsapp.net',
    privateChatLabel: 'Validator Wave67',
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
        preferredSubject: 'Wave 67 Grupo Operacional',
        aliases: ['Wave67'],
        courseId: 'wave67-course',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-04-20T09:00:00.000Z',
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
        lastRefreshedAt: '2026-04-20T09:00:00.000Z',
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
        createdAt: '2026-04-20T09:00:00.000Z',
        updatedAt: '2026-04-20T09:00:00.000Z',
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
    updatedAt: '2026-04-20T09:00:00.000Z',
  });

  const bootstrap = new AppBootstrap({
    runtimeConfig,
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await waitUntil(() => socketCoordinator.latestSocket !== null);
    socketCoordinator.latestSocket.publishQr('wave67-live-qr');
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
  const homeDom = await assertHeadlessRoute(`${baseUrl}/?mode=live`, [
    'Hoje',
    'Entrada principal',
    'Ves em poucos segundos se esta tudo bem e o que fazer a seguir.',
    'Ver agenda',
    'Ver grupos',
  ]);

  assert.doesNotMatch(homeDom, /Perguntar sem sair da pagina/u);

  const weekDom = await assertHeadlessRoute(`${baseUrl}/week?mode=live`, [
    'Calendario',
    'Leitura rapida da semana',
    'Dia ou evento em foco',
    'Criar ou ajustar',
    'Ver grelha completa da semana',
    'Por enviar',
    'A confirmar',
  ]);

  assert.match(weekDom, /<details class="ui-details week-calendar-details">/u);
  assert.doesNotMatch(weekDom, /waiting_confirmation/u);
  assert.doesNotMatch(weekDom, /Perguntar sem sair da pagina/u);

  const assistantDom = await assertHeadlessRoute(`${baseUrl}/assistant?mode=live`, [
    'Assistente LLM',
    'Perguntar sem sair da pagina',
    'Responder como',
    'Quero mudar a agenda com a LLM',
    'Preview e confirmacao',
    'Ver atividade recente e auditoria',
  ]);

  assert.match(assistantDom, /<details class="ui-details llm-disclosure">/u);
  assert.doesNotMatch(assistantDom, /<details class="ui-details llm-disclosure" open>/u);
  assert.doesNotMatch(assistantDom, /Agir no calendario/u);
  assert.doesNotMatch(assistantDom, /Pedir mudanca/u);
  assert.doesNotMatch(assistantDom, /Preparar acao/u);

  await assertHeadlessRoute(`${baseUrl}/?mode=live&state=loading`, [
    'A abrir a homepage do LumeHub',
    'Estamos a carregar o estado mais recente do produto',
    'Tentar outra vez',
    'Abrir demo',
  ]);

  await assertHeadlessRoute(`${baseUrl}/week?mode=live&state=offline`, [
    'Nao conseguimos ligar a esta instalacao do LumeHub',
    'Tentar outra vez',
    'Abrir demo',
  ]);

  await assertHeadlessRoute(`${baseUrl}/week?mode=live&state=error`, [
    'Esta pagina nao abriu como era suposto',
    'Voltar a Hoje',
  ]);

  await assertHeadlessRoute(`${baseUrl}/week?mode=live&state=empty`, [
    'Calendario ainda nao tem dados para mostrar',
    'Voltar a Hoje',
  ]);

  const diagnostics = await readJson(`${baseUrl}/api/runtime/diagnostics`);
  assert.equal(diagnostics.phase, 'running');
  assert.equal(diagnostics.readiness.status, 'healthy');
});