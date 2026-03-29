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
} from '../tests/helpers/live-runtime-fixtures.mjs';

const { AppBootstrap } = await import(
  '../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/AppBootstrap.js'
);

const WEB_DIST_ROOT = fileURLToPath(new URL('../apps/lume-hub-web/dist/', import.meta.url));

async function withLiveRuntime(options, run) {
  const sandboxPath = await createLiveSandboxPath('lume-hub-wave43-');
  const httpPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${httpPort}`;
  const fetchMock = createLiveFetchMock();
  const runtimeConfig = await seedLiveRuntimeSandbox({
    sandboxPath,
    httpPort,
    webDistRootPath: WEB_DIST_ROOT,
    socketCoordinator: new FakeSocketCoordinator(),
    fetchMock,
  });

  if (options.authReady === false) {
    await rm(runtimeConfig.codexAuthFile, { force: true });
  }

  const bootstrap = new AppBootstrap({
    runtimeConfig: {
      ...runtimeConfig,
      whatsappEnabled: false,
      whatsappAutoConnect: false,
    },
  });

  try {
    await bootstrap.start();
    await waitUntilReady(`${baseUrl}/api/settings`);
    await run({
      baseUrl,
      fetchMock,
    });
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
}

await withLiveRuntime({ authReady: true }, async ({ baseUrl, fetchMock }) => {
  const settings = await readJson(`${baseUrl}/api/settings`);

  assert.equal(settings.adminSettings.llm.enabled, true);
  assert.equal(settings.llmRuntime.mode, 'live');
  assert.equal(settings.llmRuntime.effectiveProviderId, 'codex-oauth');
  assert.equal(settings.llmRuntime.effectiveModelId, 'gpt-5.4');
  assert.equal(settings.llmRuntime.fallbackReason, null);
  assert.equal(
    settings.llmRuntime.providerReadiness.find((provider) => provider.providerId === 'codex-oauth')?.ready,
    true,
  );

  const chat = await requestJson(`${baseUrl}/api/llm/chat`, {
    method: 'POST',
    body: {
      text: 'Resume o estado da LLM live nesta validacao.',
      intent: 'local_summary_request',
      contextSummary: ['Auth do Codex pronta.'],
      domainFacts: ['Wave 43 em validacao.', 'Provider real deve ficar ativo por defeito.'],
    },
  });

  assert.equal(chat.providerId, 'codex-oauth');
  assert.equal(chat.modelId, 'gpt-5.4');
  assert.ok(fetchMock.state.codexChatCalls.length >= 1);

  await waitUntil(async () => {
    const logs = await readJson(`${baseUrl}/api/logs/llm?limit=5`);
    return Array.isArray(logs) && logs.some((entry) => entry.providerId === 'codex-oauth' && entry.modelId === 'gpt-5.4');
  });

  await assertHeadlessRoute(`${baseUrl}/assistant?mode=live`, [
    'Assistente',
    'Em uso agora: codex-oauth / gpt-5.4',
    'Estado live: live',
  ]);
  await assertHeadlessRoute(`${baseUrl}/settings?mode=live`, [
    'LLM live',
    'Provider real ativo',
    'Configurado: codex-oauth / gpt-5.4',
    'Em uso agora: codex-oauth / gpt-5.4',
  ]);
});

await withLiveRuntime({ authReady: false }, async ({ baseUrl, fetchMock }) => {
  const settings = await readJson(`${baseUrl}/api/settings`);

  assert.equal(settings.adminSettings.llm.enabled, true);
  assert.equal(settings.llmRuntime.mode, 'fallback');
  assert.equal(settings.llmRuntime.effectiveProviderId, 'local-deterministic');
  assert.equal(settings.llmRuntime.effectiveModelId, 'lume-context-v1');
  assert.match(settings.llmRuntime.fallbackReason ?? '', /Codex/u);
  assert.equal(
    settings.llmRuntime.providerReadiness.find((provider) => provider.providerId === 'codex-oauth')?.ready,
    false,
  );

  const chat = await requestJson(`${baseUrl}/api/llm/chat`, {
    method: 'POST',
    body: {
      text: 'Confirma o fallback da LLM nesta validacao.',
      intent: 'local_summary_request',
      contextSummary: ['Auth do Codex em falta.'],
      domainFacts: ['Wave 43 valida fallback auditavel.'],
    },
  });

  assert.equal(chat.providerId, 'local-deterministic');
  assert.equal(chat.modelId, 'lume-context-v1');
  assert.equal(fetchMock.state.codexChatCalls.length, 0);

  await waitUntil(async () => {
    const logs = await readJson(`${baseUrl}/api/logs/llm?limit=5`);
    return (
      Array.isArray(logs) &&
      logs.some((entry) => entry.providerId === 'local-deterministic' && entry.modelId === 'lume-context-v1')
    );
  });

  await assertHeadlessRoute(`${baseUrl}/assistant?mode=live`, [
    'Assistente',
    'Estado live: fallback',
    'Motivo do fallback:',
  ]);
  await assertHeadlessRoute(`${baseUrl}/settings?mode=live`, [
    'LLM live',
    'Fallback deterministico',
    'Motivo atual:',
  ]);
});

console.log('Wave 43 validation passed: live runtime now prefers the real LLM provider and exposes auditable fallback.');
