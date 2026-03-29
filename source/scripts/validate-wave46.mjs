import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
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
  waitUntilReady,
  writeJson,
} from '../tests/helpers/live-runtime-fixtures.mjs';

const { AppBootstrap } = await import(
  '../apps/lume-hub-backend/dist/apps/lume-hub-backend/src/bootstrap/AppBootstrap.js'
);

const WEB_DIST_ROOT = fileURLToPath(new URL('../apps/lume-hub-web/dist/', import.meta.url));
const LEGACY_ALERTS_SOURCE_FILE = '/home/eliaspc/Containers/wa-notify/data/alerts.json';
const LEGACY_AUTOMATIONS_SOURCE_FILE = '/home/eliaspc/Containers/wa-notify/data/automations.json';

async function withWebhookCapture(run) {
  const requests = [];
  const port = await reservePort();
  const server = createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      requests.push({
        method: request.method ?? 'GET',
        url: request.url ?? '/',
        body: Buffer.concat(chunks).toString('utf8'),
      });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  try {
    await run({
      baseUrl: `http://127.0.0.1:${port}`,
      requests,
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function withLiveRuntime(run) {
  await withWebhookCapture(async ({ baseUrl: webhookBaseUrl, requests }) => {
    const sandboxPath = await createLiveSandboxPath('lume-hub-wave46-');
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

    const alertsFilePath = join(sandboxPath, 'wa-notify-alerts.json');
    const automationsFilePath = join(sandboxPath, 'wa-notify-automations.json');
    const rewrittenWebhookUrl = `${webhookBaseUrl}/wa-alert`;

    await mkdir(join(sandboxPath, 'legacy'), { recursive: true });
    await copyFile(LEGACY_ALERTS_SOURCE_FILE, join(sandboxPath, 'legacy', 'alerts.original.json'));
    await copyFile(LEGACY_AUTOMATIONS_SOURCE_FILE, join(sandboxPath, 'legacy', 'automations.original.json'));

    const alertsPayload = JSON.parse(await readFile(LEGACY_ALERTS_SOURCE_FILE, 'utf8'));
    const automationsPayload = JSON.parse(await readFile(LEGACY_AUTOMATIONS_SOURCE_FILE, 'utf8'));

    for (const rule of alertsPayload.rules ?? []) {
      for (const action of rule.actions ?? []) {
        if (action.type === 'webhook') {
          action.url = rewrittenWebhookUrl;
        }
      }
    }

    for (const group of automationsPayload.groups ?? []) {
      for (const entry of group.entries ?? []) {
        for (const action of entry.actions ?? []) {
          if (action.type === 'webhook') {
            action.url = rewrittenWebhookUrl;
          }
        }
      }
    }

    await writeFile(alertsFilePath, JSON.stringify(alertsPayload, null, 2), 'utf8');
    await writeFile(automationsFilePath, JSON.stringify(automationsPayload, null, 2), 'utf8');

    await writeJson(runtimeConfig.groupSeedFilePath, {
      schemaVersion: 1,
      groups: [
        {
          groupJid: '1203630xxxxxxxxx@g.us',
          preferredSubject: 'Grupo Aulas 1',
          aliases: ['Aulas 1'],
          courseId: 'curso-wa-notify-1',
          groupOwners: [
            {
              personId: 'person-app-owner',
              assignedAt: '2026-03-29T12:30:00.000Z',
              assignedBy: 'wave46-validator',
            },
          ],
          calendarAccessPolicy: {
            group: 'read',
            groupOwner: 'read_write',
            appOwner: 'read_write',
          },
          lastRefreshedAt: '2026-03-29T12:30:00.000Z',
        },
        {
          groupJid: '120363499999999999@g.us',
          preferredSubject: 'Grupo Aulas 2',
          aliases: ['Aulas 2'],
          courseId: 'curso-wa-notify-2',
          groupOwners: [
            {
              personId: 'person-app-owner',
              assignedAt: '2026-03-29T12:30:00.000Z',
              assignedBy: 'wave46-validator',
            },
          ],
          calendarAccessPolicy: {
            group: 'read',
            groupOwner: 'read_write',
            appOwner: 'read_write',
          },
          lastRefreshedAt: '2026-03-29T12:30:00.000Z',
        },
      ],
    });

    const bootstrap = new AppBootstrap({
      runtimeConfig: {
        ...runtimeConfig,
        whatsappEnabled: false,
        whatsappAutoConnect: false,
        waNotifyAlertsFilePath: alertsFilePath,
        waNotifyAutomationsFilePath: automationsFilePath,
        llmFetch: async (input, init) => {
          const url = typeof input === 'string' ? input : input.toString();

          if (url.startsWith(webhookBaseUrl)) {
            return fetch(input, init);
          }

          return fetchMock.fetchImpl(input, init);
        },
      },
    });

    try {
      await bootstrap.start();
      await waitUntilReady(`${baseUrl}/api/settings`);
      await run({
        baseUrl,
        bootstrap,
        webhookRequests: requests,
        rewrittenWebhookUrl,
      });
    } finally {
      await bootstrap.stop().catch(() => undefined);
      await rm(sandboxPath, { recursive: true, force: true });
    }
  });
}

async function assertHeadlessRoute(url, expectedTexts) {
  const { stdout, stderr } = await runChromeDump(url);

  for (const expectedText of expectedTexts) {
    assert.match(stdout, new RegExp(escapeForRegExp(expectedText), 'u'));
  }

  assert.doesNotMatch(stderr, /(TypeError|ReferenceError|Uncaught|SEVERE)/u);
  assert.doesNotMatch(stdout, /Algo falhou ao carregar esta pagina/u);
}

await withLiveRuntime(async ({ baseUrl, bootstrap, webhookRequests, rewrittenWebhookUrl }) => {
  const alertsPreview = await requestJson(`${baseUrl}/api/migrations/wa-notify/alerts/preview`, {
    method: 'POST',
  });
  assert.equal(alertsPreview.mode, 'preview');
  assert.equal(alertsPreview.sourceFilePath.includes('wa-notify-alerts.json'), true);
  assert.equal(alertsPreview.totals.legacyRules, 1);
  assert.equal(alertsPreview.totals.importedRules, 1);
  assert.equal(alertsPreview.rules.length, 1);

  const alertsApply = await requestJson(`${baseUrl}/api/migrations/wa-notify/alerts/apply`, {
    method: 'POST',
  });
  assert.equal(alertsApply.mode, 'apply');
  assert.equal(alertsApply.totals.importedRules, 1);

  const alertRules = await readJson(`${baseUrl}/api/alerts/rules`);
  assert.equal(alertRules.length, 1);
  assert.equal(alertRules[0].scope.groupJid, '1203630xxxxxxxxx@g.us');
  assert.equal(alertRules[0].actions[0].url, rewrittenWebhookUrl);

  const automationsPreview = await requestJson(`${baseUrl}/api/migrations/wa-notify/automations/preview`, {
    method: 'POST',
  });
  assert.equal(automationsPreview.mode, 'preview');
  assert.equal(automationsPreview.totals.legacyGroups, 2);
  assert.equal(automationsPreview.totals.legacyEntries, 3);
  assert.equal(automationsPreview.totals.importedDefinitions, 3);
  assert.equal(automationsPreview.totals.missingGroups, 0);
  assert.equal(automationsPreview.definitions.length, 3);

  const automationsApply = await requestJson(`${baseUrl}/api/migrations/wa-notify/automations/apply`, {
    method: 'POST',
  });
  assert.equal(automationsApply.mode, 'apply');
  assert.equal(automationsApply.totals.importedDefinitions, 3);

  const automationDefinitions = await readJson(`${baseUrl}/api/automations/definitions`);
  assert.equal(automationDefinitions.length, 3);
  assert.ok(
    automationDefinitions.some((definition) => definition.groupLabel === 'Grupo Aulas 1'),
    'Expected imported definitions for Grupo Aulas 1.',
  );
  assert.ok(
    automationDefinitions.some((definition) => definition.groupLabel === 'Grupo Aulas 2'),
    'Expected imported definitions for Grupo Aulas 2.',
  );

  const runtime = bootstrap.getRuntime();
  const matched = await runtime.modules.messageAlertsModule.handleInbound({
    messageId: 'wamid.wave46.alert.001',
    chatJid: '1203630xxxxxxxxx@g.us',
    participantJid: '351910000001@s.whatsapp.net',
    groupJid: '1203630xxxxxxxxx@g.us',
    text: 'Ja fiz o pagamento por mbway.',
    timestamp: '2026-03-29T18:10:00.000Z',
  });

  assert.equal(matched.length, 1);
  assert.equal(matched[0].ruleId, 'grupo-pagamentos');

  const tickResult = await runtime.modules.automationsModule.tick(
    {
      async sendText(input) {
        return {
          messageId: input.messageId ?? `wamid.wave46.automation.${Date.now()}`,
          acceptedAt: '2026-03-31T17:00:00.000Z',
        };
      },
    },
    new Date('2026-03-31T17:00:00.000Z'),
  );

  assert.equal(tickResult.executedCount, 1);
  assert.equal(tickResult.failedCount, 0);
  assert.equal(tickResult.runs.length, 1);
  assert.equal(tickResult.runs[0].entryId, 'proxima-aula');
  assert.equal(tickResult.runs[0].groupLabel, 'Grupo Aulas 1');
  assert.equal(tickResult.runs[0].waMessageId !== null, true);
  assert.equal(tickResult.runs[0].webhookDeliveries, 1);

  const recentAlertMatches = await readJson(`${baseUrl}/api/alerts/matches?limit=8`);
  assert.ok(recentAlertMatches.some((entry) => entry.ruleId === 'grupo-pagamentos'));

  const recentAutomationRuns = await readJson(`${baseUrl}/api/automations/runs?limit=8`);
  assert.ok(recentAutomationRuns.some((entry) => entry.entryId === 'proxima-aula'));

  const webhookBodies = webhookRequests.map((request) => request.body);
  assert.ok(
    webhookBodies.some((body) => body.includes('grupo-pagamentos')),
    'Expected alert webhook payload to be captured.',
  );
  assert.ok(
    webhookBodies.some((body) => body.includes('proxima-aula')),
    'Expected automation webhook payload to be captured.',
  );

  await assertHeadlessRoute(`${baseUrl}/settings?mode=live`, [
    'Configuracao',
    'Migracao de alerts do WA-notify',
    'Migracao de automations do WA-notify',
    'Matches recentes',
    'Execucoes recentes',
  ]);
});

console.log(
  'Wave 46 validation passed: WA-notify alerts and automations now support live preview/apply, runtime execution, audit and a working live settings page.',
);
