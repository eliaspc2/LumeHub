import assert from 'node:assert/strict';
import { readdir, readFile, rm } from 'node:fs/promises';
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

async function withLiveRuntime(run) {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave59-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const groupJid = '120363409999999991@g.us';
  const socketCoordinator = new FakeSocketCoordinator({
    groupJid,
    groupLabel: 'Wave 59 Grupo LLM',
    privateChatJid: '351920000001@s.whatsapp.net',
    privateChatLabel: 'Validator Wave59',
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
        preferredSubject: 'Wave 59 Grupo LLM',
        aliases: ['Wave59'],
        courseId: 'wave59-course',
        groupOwners: [
          {
            personId: 'person-app-owner',
            assignedAt: '2026-04-06T13:00:00.000Z',
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
        lastRefreshedAt: '2026-04-06T13:00:00.000Z',
      },
    ],
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
    updatedAt: '2026-04-06T13:00:00.000Z',
  });

  const bootstrap = new AppBootstrap({
    runtimeConfig,
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await waitUntil(() => socketCoordinator.latestSocket !== null);
    socketCoordinator.latestSocket.publishQr('wave59-live-qr');
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
    'LLM',
    'Wave 59 Grupo LLM',
  ]);

  assert.match(shellDom, /data-route="\/assistant"/u);
  const groupFirstContract = await requestJson(baseUrl, '/api/group-first/contract');
  assert.equal(groupFirstContract.pages.llm.currentRoute, '/assistant');

  const webBundle = await readBuiltWebBundle();
  assert.match(webBundle, /Chat direto com a LLM/u);
  assert.match(webBundle, /Responder com escopo/u);
  assert.match(webBundle, /Chat vs acao/u);
  assert.match(webBundle, /Modo acao: agenda com preview/u);

  const appShellSource = await readFile(
    '/home/eliaspc/Documentos/lume-hub/source/apps/lume-hub-web/src/shell/AppShell.ts',
    'utf8',
  );
  assert.match(appShellSource, /currentRoute\.canonicalRoute !== '\/assistant'/u);

  const globalChat = await requestJson(baseUrl, '/api/llm/chat', {
    method: 'POST',
    body: {
      text: 'Resume o estado global da app para a Wave 59.',
      intent: 'direct_ui_chat',
      contextSummary: ['Resposta local da pagina LLM. Nao enviar nada para WhatsApp.'],
      domainFacts: ['Contexto global do operador LumeHub.'],
      memoryScope: {
        scope: 'none',
        groupJid: null,
        groupLabel: null,
        instructionsSource: null,
        instructionsApplied: false,
        knowledgeSnippetCount: 0,
        knowledgeDocuments: [],
      },
    },
  });
  assert.match(globalChat.text, /Resposta Codex live/u);

  await requestJson(baseUrl, `/api/groups/${encodeURIComponent(groupJid)}/llm-instructions`, {
    method: 'PUT',
    body: {
      content: 'Responder de forma curta e focada no grupo Wave 59.',
    },
  });
  await requestJson(baseUrl, `/api/groups/${encodeURIComponent(groupJid)}/knowledge/documents`, {
    method: 'POST',
    body: {
      documentId: 'wave59-knowledge',
      filePath: 'knowledge/wave59.md',
      title: 'Nota operacional Wave 59',
      aliases: ['wave59'],
      tags: ['validation'],
      enabled: true,
      content: 'A Wave 59 valida chat direto com escopo de grupo e memoria local.',
    },
  });
  const groupContext = await requestJson(baseUrl, `/api/groups/${encodeURIComponent(groupJid)}/context-preview`, {
    method: 'POST',
    body: {
      text: 'Como devo explicar a Wave 59 ao grupo?',
      senderDisplayName: 'Validator Wave59',
    },
  });
  assert.equal(groupContext.group?.preferredSubject, 'Wave 59 Grupo LLM');
  assert.equal(groupContext.groupInstructionsSource, 'llm_instructions');
  assert.ok(groupContext.groupKnowledgeSnippets.length >= 1);

  const groupChat = await requestJson(baseUrl, '/api/llm/chat', {
    method: 'POST',
    body: {
      text: 'Explica a Wave 59 usando a memoria deste grupo.',
      intent: 'direct_group_chat',
      contextSummary: ['Resposta local da pagina LLM com escopo de grupo.'],
      domainFacts: ['Grupo ativo: Wave 59 Grupo LLM.'],
      memoryScope: {
        scope: 'group',
        groupJid,
        groupLabel: 'Wave 59 Grupo LLM',
        instructionsSource: groupContext.groupInstructionsSource,
        instructionsApplied: Boolean(groupContext.groupInstructions),
        knowledgeSnippetCount: groupContext.groupKnowledgeSnippets.length,
        knowledgeDocuments: groupContext.groupKnowledgeSnippets.slice(0, 2).map((snippet) => ({
          documentId: snippet.documentId,
          title: snippet.title,
          filePath: snippet.filePath,
          score: snippet.score,
          matchedTerms: snippet.matchedTerms,
        })),
      },
    },
  });
  assert.match(groupChat.text, /Resposta Codex live/u);

  const logs = await requestJson(baseUrl, '/api/logs/llm?limit=5');
  const groupLog = logs.find((entry) => entry.runId === groupChat.runId);
  assert.equal(groupLog?.memoryScope?.scope, 'group');
  assert.equal(groupLog?.memoryScope?.groupLabel, 'Wave 59 Grupo LLM');
  assert.ok(groupLog?.memoryScope?.knowledgeSnippetCount >= 1);
  assert.ok(fetchMock.state.codexChatCalls.length >= 2);

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
    /A `Wave 59` ja fechou a pagina dedicada `LLM` com chat direto/u,
  );
  assert.doesNotMatch(implementationWavesDoc, /^### Wave 59 - /mu);
  assert.match(implementationWavesDoc, /### Wave 60 - Limpeza final da ronda `group-first`/u);

  assert.match(gapAuditDoc, /a `Wave 59` ja fechou a pagina direta da LLM/u);
  assert.match(gapAuditDoc, /a proxima frente ativa desta ronda passa a ser a `Wave 60`/u);

  assert.match(rootReadme, /As `Wave 0` a `Wave 59` ja foram executadas e validadas\./u);
  assert.match(rootReadme, /a pagina `LLM` ja permite chat direto em escopo global ou de grupo/u);

  assert.match(sourceReadme, /a `Wave 59` fechou a pagina `LLM` como chat direto com escopo global ou de grupo/u);
  assert.equal(packageJson.scripts['validate:wave59'], 'corepack pnpm run typecheck && corepack pnpm run build && node ./scripts/validate-wave59.mjs');
});
