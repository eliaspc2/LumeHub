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
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave54-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid: '120363402446203704@g.us',
    groupLabel: 'EFA Programacao A',
    privateChatJid: '351910000001@s.whatsapp.net',
    privateChatLabel: 'Validator Wave54',
  });
  const runtimeConfig = await seedLiveRuntimeSandbox({
    sandboxPath,
    httpPort,
    webDistRootPath: WEB_DIST_ROOT,
    socketCoordinator,
    fetchMock,
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
        createdAt: '2026-04-06T08:00:00.000Z',
        updatedAt: '2026-04-06T08:00:00.000Z',
      },
      {
        personId: 'person-maria',
        displayName: 'Maria Operadora',
        identifiers: [
          {
            kind: 'whatsapp_jid',
            value: '351910000010@s.whatsapp.net',
          },
        ],
        globalRoles: ['member'],
        createdAt: '2026-04-06T08:00:00.000Z',
        updatedAt: '2026-04-06T08:00:00.000Z',
      },
      {
        personId: 'person-joao',
        displayName: 'Joao Owner',
        identifiers: [
          {
            kind: 'whatsapp_jid',
            value: '351910000011@s.whatsapp.net',
          },
        ],
        globalRoles: ['member'],
        createdAt: '2026-04-06T08:00:00.000Z',
        updatedAt: '2026-04-06T08:00:00.000Z',
      },
    ],
    notes: [],
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
    socketCoordinator.latestSocket.publishQr('wave54-live-qr');
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

async function requestJson(baseUrl, path, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  assert.equal(response.status, 200, `Expected 200 for ${method} ${path} but got ${response.status}.`);
  return payload;
}

await withLiveRuntime(async ({ baseUrl, socketCoordinator }) => {
  const encodedGroupJid = encodeURIComponent(socketCoordinator.config.groupJid);

  const groupDom = await assertHeadlessRoute(`${baseUrl}/groups/${encodedGroupJid}?mode=live`, [
    'Configuracao operacional',
    'Trocar grupo nesta pagina',
    'Responsavel do grupo',
    'Quem pode tagar o bot',
    'Agendamento ativo',
    'LLM pode decidir agendamentos',
  ]);
  assert.match(groupDom, /data-group-page-switcher/u);
  assert.match(groupDom, /data-group-owner-select/u);
  assert.match(groupDom, /data-group-operational-setting="mode"/u);
  assert.match(groupDom, /data-group-operational-setting="memberTagPolicy"/u);
  assert.match(groupDom, /data-group-action="toggle-scheduling-enabled"/u);
  assert.match(groupDom, /data-group-action="toggle-llm-scheduling"/u);

  const secondGroupDom = await assertHeadlessRoute(
    `${baseUrl}/groups/${encodeURIComponent('120363409999999999@g.us')}?mode=live`,
    ['Distribuicao Geral', 'Trocar grupo nesta pagina', 'Configuracao operacional'],
  );
  assert.match(secondGroupDom, /data-group-page-switcher/u);

  await requestJson(baseUrl, `/api/groups/${encodedGroupJid}/owners`, {
    method: 'PUT',
    body: {
      owners: [
        {
          personId: 'person-maria',
        },
      ],
    },
  });

  await requestJson(baseUrl, `/api/groups/${encodedGroupJid}/operational-settings`, {
    method: 'PATCH',
    body: {
      mode: 'distribuicao_apenas',
      schedulingEnabled: false,
      allowLlmScheduling: false,
      memberTagPolicy: 'owner_only',
    },
  });

  const groups = await readJson(`${baseUrl}/api/groups`);
  const updatedGroup = groups.find((group) => group.groupJid === socketCoordinator.config.groupJid);
  assert.ok(updatedGroup, 'Expected updated group to exist.');
  assert.deepEqual(updatedGroup.groupOwners.map((owner) => owner.personId), ['person-maria']);
  assert.equal(updatedGroup.operationalSettings.mode, 'distribuicao_apenas');
  assert.equal(updatedGroup.operationalSettings.schedulingEnabled, false);
  assert.equal(updatedGroup.operationalSettings.allowLlmScheduling, false);
  assert.equal(updatedGroup.operationalSettings.memberTagPolicy, 'owner_only');

  const updatedDom = await assertHeadlessRoute(`${baseUrl}/groups/${encodedGroupJid}?mode=live`, [
    'O owner atual e Maria Operadora',
    'So o owner do grupo pode dirigir o bot neste grupo por tag.',
    'Distribuicao apenas',
  ]);
  assert.match(updatedDom, /data-group-owner-select/u);

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

  assert.match(implementationWavesDoc, /A `Wave 54` ja fechou a pagina operacional por grupo/u);
  assert.match(implementationWavesDoc, /### Wave 55 - Calendario semanal de notificacoes/u);
  assert.doesNotMatch(implementationWavesDoc, /### Wave 54/u);

  assert.match(gapAuditDoc, /a `Wave 54` ja fechou a pagina de grupo como unidade operacional explicita/u);
  assert.doesNotMatch(gapAuditDoc, /cada grupo ainda nao e uma unidade operacional explicita/u);

  assert.match(rootReadme, /Wave 0` a `Wave 54/u);
  assert.match(rootReadme, /validate:wave54/u);
  assert.match(rootReadme, /pagina operacional de grupo/u);

  assert.match(sourceReadme, /Wave 0` a `Wave 54/u);
  assert.match(sourceReadme, /validate:wave54/u);
  assert.match(sourceReadme, /pagina operacional de grupo/u);

  assert.equal(typeof packageJson.scripts['validate:wave54'], 'string');
});

console.log('validate-wave54: ok');
