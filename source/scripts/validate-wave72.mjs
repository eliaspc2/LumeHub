import assert from 'node:assert/strict';
import { readdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SOURCE_ROOT, '..');
const WEB_DIST_ROOT = fileURLToPath(new URL('../apps/lume-hub-web/dist/', import.meta.url));
const LEGACY_ROUND_WAVES = [66, 67, 68, 69, 70, 71];

await validateRepositoryCleanup();
await validateCommercialReadinessDocs();
await validateCommercialShell();

console.log('Wave 72 commercial-readiness cleanup validation passed');

async function validateRepositoryCleanup() {
  const packageJson = JSON.parse(await readFile(resolve(SOURCE_ROOT, 'package.json'), 'utf8'));
  assert.match(packageJson.scripts['validate:wave72'], /validate-wave72\.mjs/u);

  for (const waveNumber of LEGACY_ROUND_WAVES) {
    assert.equal(packageJson.scripts[`validate:wave${waveNumber}`], undefined);
  }

  const scriptFiles = await readdir(resolve(SOURCE_ROOT, 'scripts'));
  for (const waveNumber of LEGACY_ROUND_WAVES) {
    assert.equal(scriptFiles.includes(`validate-wave${waveNumber}.mjs`), false);
  }

  assert.equal(scriptFiles.includes('validate-wave72.mjs'), true);
}

async function validateCommercialReadinessDocs() {
  const docs = {
    rootReadme: await readFile(resolve(REPO_ROOT, 'README.md'), 'utf8'),
    sourceReadme: await readFile(resolve(SOURCE_ROOT, 'README.md'), 'utf8'),
    implementationWaves: await readFile(
      resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_implementation_waves.md'),
      'utf8',
    ),
    gapAudit: await readFile(resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_gap_audit.md'), 'utf8'),
    releaseGuide: await readFile(resolve(REPO_ROOT, 'docs', 'deployment', 'lume_hub_release_publish.md'), 'utf8'),
    deliveryKit: await readFile(
      resolve(REPO_ROOT, 'docs', 'deployment', 'lume_hub_commercial_delivery_kit.md'),
      'utf8',
    ),
  };

  assert.match(docs.rootReadme, /validacao consolidada mais recente passou a ser `validate:wave72`/u);
  assert.match(docs.sourceReadme, /validacao consolidada mais recente passou a ser `validate:wave72`/u);
  assert.match(docs.implementationWaves, /Nao existem waves ativas neste momento/u);
  assert.match(docs.implementationWaves, /`validate:wave72`/u);
  assert.doesNotMatch(docs.implementationWaves, /### Wave/u);
  assert.match(docs.gapAudit, /Nao restam gaps ativos na ronda `commercial-readiness`/u);
  assert.match(docs.gapAudit, /`validate:wave72`/u);

  for (const [docName, contents] of Object.entries(docs)) {
    assert.doesNotMatch(contents, /`validate:wave(?:6[6-9]|7[01])`/u, `${docName} still references an old validator`);
  }

  assert.match(docs.releaseGuide, /lume_hub_commercial_delivery_kit\.md/u);
  assert.match(docs.releaseGuide, /nao deve ser apresentado como produto de `um container unico`/u);
  assert.match(docs.deliveryKit, /nao deve ser vendido como `um container unico`/u);
  assert.match(docs.deliveryKit, /## Install curto/u);
  assert.match(docs.deliveryKit, /## Update curto/u);
  assert.match(docs.deliveryKit, /## Health check curto/u);
  assert.match(docs.deliveryKit, /## Recovery de token\/auth/u);
}

async function validateCommercialShell() {
  await withLiveRuntime(async ({ baseUrl, groupJid }) => {
    await assertHeadlessRoute(`${baseUrl}/?mode=live`, [
      'Hoje',
      'Entrada principal',
      'Ver agenda',
      'Ver grupos',
    ]);
    await assertHeadlessRoute(`${baseUrl}/week?mode=live`, [
      'Calendario',
      'Semana em foco',
      'Leitura rapida da semana',
    ]);
    await assertHeadlessRoute(`${baseUrl}/assistant?mode=live`, [
      'Perguntar sem sair da pagina',
      'Responder como',
      'Mudar a agenda com a LLM',
    ]);
    await assertHeadlessRoute(`${baseUrl}/groups?mode=live`, [
      'Fluxo guiado do grupo',
      'Passo 1. Escolher grupo',
      'Passo 2. Ver estado atual',
    ]);
    await assertHeadlessRoute(`${baseUrl}/groups/${encodeURIComponent(groupJid)}?mode=live`, [
      'Passo 3. Automacao e lembretes',
      'Preview da comunicacao',
      'Passo 4. Conhecimento do grupo',
    ]);
    await assertHeadlessRoute(`${baseUrl}/whatsapp?mode=live`, [
      'Fluxo guiado do WhatsApp',
      'Reparacao guiada',
      'Passo 2. Escolher grupos a operar',
    ]);
    await assertHeadlessRoute(`${baseUrl}/settings?mode=live`, [
      'Basico: leitura rapida',
      'Saude operacional',
      'Avancado: LLM, energia, tokens, avisos e governanca',
    ]);
    await assertHeadlessRoute(`${baseUrl}/codex-router?mode=live`, [
      'Backup antes de trocar',
      'Operacao segura',
      'Escolha manual de token',
    ]);
    await assertHeadlessRoute(`${baseUrl}/migration?mode=live`, [
      'Wizard de operador',
      'Passo 1. Confirmar que o LumeHub esta acordado',
      'Tokens do Codex vivem noutra pagina',
    ]);

    const diagnostics = await readJson(`${baseUrl}/api/runtime/diagnostics`);
    assert.equal(diagnostics.phase, 'running');
    assert.equal(diagnostics.readiness.status, 'healthy');
  });
}

async function withLiveRuntime(run) {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave72-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const groupJid = '120363407000000072@g.us';
  const privateChatJid = '351920000072@s.whatsapp.net';
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid,
    groupLabel: 'Wave 72 Grupo Comercial',
    privateChatJid,
    privateChatLabel: 'Validator Wave72',
  });
  const runtimeConfig = await seedLiveRuntimeSandbox({
    sandboxPath,
    httpPort,
    webDistRootPath: WEB_DIST_ROOT,
    socketCoordinator,
    fetchMock,
  });
  const reserveAFilePath = `${runtimeConfig.runtimeRootPath}/auth-wave72-reserve-a.json`;
  const reserveBFilePath = `${runtimeConfig.runtimeRootPath}/auth-wave72-reserve-b.json`;

  await writeJson(runtimeConfig.groupSeedFilePath, {
    schemaVersion: 1,
    groups: [
      {
        groupJid,
        preferredSubject: 'Wave 72 Grupo Comercial',
        aliases: ['Wave72'],
        courseId: 'wave72-course',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-04-21T12:00:00.000Z',
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
        notificationRules: [
          {
            ruleId: 'wave72-before',
            kind: 'relative_before_event',
            offsetMinutesBeforeEvent: 1440,
            label: '24h antes',
            enabled: true,
            llmInstruction: 'Explica em linguagem simples que o evento e amanha.',
          },
          {
            ruleId: 'wave72-after',
            kind: 'relative_after_event',
            offsetMinutesAfterEvent: 30,
            label: '30 min depois',
            enabled: true,
            llmInstruction: 'Pergunta se ainda ha duvidas depois do evento.',
          },
        ],
        lastRefreshedAt: '2026-04-21T12:00:00.000Z',
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
        createdAt: '2026-04-21T12:00:00.000Z',
        updatedAt: '2026-04-21T12:00:00.000Z',
      },
      {
        personId: 'person-private',
        displayName: 'Contacto Wave72',
        identifiers: [
          {
            kind: 'whatsapp_jid',
            value: privateChatJid,
          },
        ],
        globalRoles: [],
        createdAt: '2026-04-21T12:00:00.000Z',
        updatedAt: '2026-04-21T12:00:00.000Z',
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
      authorizedPrivateJids: [privateChatJid],
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
    updatedAt: '2026-04-21T12:00:00.000Z',
  });

  await writeJson(reserveAFilePath, {
    auth_mode: 'chatgpt',
    tokens: {
      access_token: 'wave72-reserve-a-token',
      account_id: 'wave72-reserve-a',
    },
  });
  await writeJson(reserveBFilePath, {
    auth_mode: 'chatgpt',
    tokens: {
      access_token: 'wave72-reserve-b-token',
      account_id: 'wave72-reserve-b',
    },
  });

  const bootstrap = new AppBootstrap({
    runtimeConfig: {
      ...runtimeConfig,
      codexAuthSources: [
        {
          accountId: 'wave72-reserve-a',
          label: 'Token Wave72 reserva A',
          filePath: reserveAFilePath,
          priority: 1,
        },
        {
          accountId: 'wave72-reserve-b',
          label: 'Token Wave72 reserva B',
          filePath: reserveBFilePath,
          priority: 2,
        },
      ],
    },
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await waitUntil(() => socketCoordinator.latestSocket !== null);
    socketCoordinator.latestSocket.publishQr('wave72-live-qr');
    socketCoordinator.latestSocket.openSession();
    await waitUntil(async () => {
      const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
      return workspace.runtime.session.phase === 'open';
    });

    await run({ baseUrl, groupJid });
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
