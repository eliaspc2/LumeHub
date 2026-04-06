import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
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
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave52-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid: '120363402446203704@g.us',
    groupLabel: 'EFA Programacao A',
    privateChatJid: '351910000001@s.whatsapp.net',
    privateChatLabel: 'Validator Wave52',
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
        groupJid: socketCoordinator.config.groupJid,
        preferredSubject: 'EFA Programacao A',
        aliases: ['Programacao A'],
        courseId: 'efa-programacao-a',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-04-06T08:00:00.000Z',
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
        lastRefreshedAt: '2026-04-06T08:00:00.000Z',
      },
      {
        groupJid: '120363409999999999@g.us',
        preferredSubject: 'Distribuicao Geral',
        aliases: ['Distribuicao'],
        courseId: null,
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
        lastRefreshedAt: null,
      },
    ],
  });

  const bootstrap = new AppBootstrap({
    runtimeConfig,
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await waitUntil(() => socketCoordinator.latestSocket !== null);
    socketCoordinator.latestSocket.publishQr('wave52-live-qr');
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

  return stdout;
}

await withLiveRuntime(async ({ baseUrl, socketCoordinator }) => {
  const groups = await readJson(`${baseUrl}/api/groups`);
  assert.equal(groups.length >= 2, true);
  assert.deepEqual(
    groups.map((group) => group.operationalSettings.mode).toSorted(),
    ['com_agendamento', 'distribuicao_apenas'],
  );

  const updatedScheduledGroup = await requestJson(
    `${baseUrl}/api/groups/${encodeURIComponent(socketCoordinator.config.groupJid)}/operational-settings`,
    {
      method: 'PATCH',
      body: {
        mode: 'distribuicao_apenas',
        schedulingEnabled: true,
        allowLlmScheduling: true,
        memberTagPolicy: 'owner_only',
      },
    },
  );
  assert.deepEqual(updatedScheduledGroup, {
    mode: 'distribuicao_apenas',
    schedulingEnabled: false,
    allowLlmScheduling: false,
    memberTagPolicy: 'owner_only',
  });

  const updatedGroups = await readJson(`${baseUrl}/api/groups`);
  const persistedScheduledGroup = updatedGroups.find((group) => group.groupJid === socketCoordinator.config.groupJid);
  assert.deepEqual(persistedScheduledGroup?.operationalSettings, updatedScheduledGroup);

  const contract = await readJson(`${baseUrl}/api/group-first/contract`);
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.pages.calendar.currentRoute, '/week');
  assert.equal(contract.pages.groups.itemRoutePattern, '/groups/:groupJid');
  assert.equal(contract.pages.groups.switcherEnabled, true);
  assert.equal(contract.pages.whatsapp.currentRoute, '/whatsapp');
  assert.equal(contract.pages.lumeHub.currentRoute, '/settings');
  assert.equal(contract.pages.llm.currentRoute, '/assistant');

  const workspace = await readJson(`${baseUrl}/api/whatsapp/workspace`);
  const knownGroup = workspace.groups.find((group) => group.groupJid === socketCoordinator.config.groupJid);
  const distributionOnlyGroup = workspace.groups.find((group) => group.groupJid === '120363409999999999@g.us');
  assert.equal(knownGroup?.knownToBot, true);
  assert.equal(knownGroup?.operationalSettings.mode, 'distribuicao_apenas');
  assert.equal(distributionOnlyGroup?.knownToBot, false);
  assert.equal(distributionOnlyGroup?.operationalSettings.mode, 'distribuicao_apenas');
  assert.equal(distributionOnlyGroup?.operationalSettings.allowLlmScheduling, false);

  await assertHeadlessRoute(`${baseUrl}/groups?mode=live`, [
    'Grupos',
    'Distribuicao Geral',
    'EFA Programacao A',
  ]);

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

  assert.match(implementationWavesDoc, /A `Wave 52` ja fechou a fundacao do modelo `group-first`/u);
  assert.match(implementationWavesDoc, /### Wave 53 - Shell `group-first` e navegacao nova/u);
  assert.doesNotMatch(implementationWavesDoc, /### Wave 52/u);

  assert.match(gapAuditDoc, /a `Wave 52` ja fechou a fundacao do modelo/u);
  assert.match(gapAuditDoc, /## Gaps ativos da ronda `group-first`/u);

  assert.match(rootReadme, /Wave 0` a `Wave 52/u);
  assert.match(rootReadme, /validate:wave52/u);
  assert.match(rootReadme, /fundacao do modelo `group-first`/u);

  assert.match(sourceReadme, /Wave 0` a `Wave 52/u);
  assert.match(sourceReadme, /validate:wave52/u);
  assert.match(sourceReadme, /Wave 52` fechou a fundacao/u);

  assert.equal(typeof packageJson.scripts['validate:wave52'], 'string');
});

console.log('validate-wave52: ok');
