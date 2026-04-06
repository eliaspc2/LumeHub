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
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave53-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid: '120363402446203704@g.us',
    groupLabel: 'EFA Programacao A',
    privateChatJid: '351910000001@s.whatsapp.net',
    privateChatLabel: 'Validator Wave53',
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
    socketCoordinator.latestSocket.publishQr('wave53-live-qr');
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
  const calendarDom = await assertHeadlessRoute(`${baseUrl}/week?mode=live`, [
    'Calendario',
    'Grupos',
    'WhatsApp',
    'LumeHub',
    'LLM',
    'Migracao',
    'Grupo em foco',
    'Abrir pagina de grupo',
    'Apoio',
  ]);
  assert.match(calendarDom, /data-shell-group-switcher/u);
  assert.doesNotMatch(calendarDom, /data-route="\/workspace"/u);
  assert.doesNotMatch(calendarDom, /data-route="\/distributions"/u);
  assert.doesNotMatch(calendarDom, /data-route="\/deliveries"/u);
  assert.doesNotMatch(calendarDom, /data-route="\/watchdog"/u);
  assert.doesNotMatch(calendarDom, /data-route="\/media"/u);

  const encodedGroupJid = encodeURIComponent(socketCoordinator.config.groupJid);
  const groupDom = await assertHeadlessRoute(`${baseUrl}/groups/${encodedGroupJid}?mode=live`, [
    'Grupos',
    'EFA Programacao A',
    'Estas a gerir EFA Programacao A',
  ]);
  assert.match(groupDom, /data-shell-group-switcher/u);

  const migrationDom = await assertHeadlessRoute(`${baseUrl}/migration?mode=live`, [
    'Migracao',
    'Calendario',
    'Apoio',
  ]);
  assert.match(migrationDom, /data-route="\/migration"/u);

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

  assert.match(implementationWavesDoc, /A `Wave 53` ja fechou a shell `group-first`/u);
  assert.match(implementationWavesDoc, /### Wave 54 - Pagina de grupo e configuracao operacional por grupo/u);
  assert.doesNotMatch(implementationWavesDoc, /### Wave 53/u);

  assert.match(gapAuditDoc, /a `Wave 53` ja fechou a shell e a navegacao principal/u);
  assert.match(gapAuditDoc, /rota base `\/groups\/:groupJid`/u);

  assert.match(rootReadme, /Wave 0` a `Wave 53/u);
  assert.match(rootReadme, /validate:wave53/u);
  assert.match(rootReadme, /shell `group-first`/u);

  assert.match(sourceReadme, /Wave 0` a `Wave 53/u);
  assert.match(sourceReadme, /validate:wave53/u);
  assert.match(sourceReadme, /switcher global de grupo/u);

  assert.equal(typeof packageJson.scripts['validate:wave53'], 'string');
});

console.log('validate-wave53: ok');
