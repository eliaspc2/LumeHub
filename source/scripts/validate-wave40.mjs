import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runChromeDump } from '../tests/helpers/live-runtime-fixtures.mjs';

const { FrontendApiClient } = await import(
  '../packages/adapters/frontend-api-client/dist/adapters/frontend-api-client/src/public/index.js'
);
const { FastifyHttpServer } = await import(
  '../packages/adapters/http-fastify/dist/adapters/http-fastify/src/public/index.js'
);
const { WorkspaceAgentService } = await import(
  '../packages/modules/workspace-agent/dist/modules/workspace-agent/src/application/services/WorkspaceAgentService.js'
);

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIST_ROOT = resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'dist');
const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave40-'));
const workspaceRootPath = join(sandboxPath, 'repo');

let server = null;

try {
  await mkdir(join(workspaceRootPath, 'source', 'apps', 'lume-hub-web', 'src'), {
    recursive: true,
  });

  await writeFile(join(workspaceRootPath, 'README.md'), '# Demo workspace\n\nEstado inicial para validar o diff guiado.\n');
  await writeFile(
    join(workspaceRootPath, 'source', 'apps', 'lume-hub-web', 'src', 'AppShell.ts'),
    'export const workspaceDemo = "LumeHub workspace route";\n',
  );

  const runLog = {
    schemaVersion: 1,
    runs: [],
  };
  const fakeExecutor = {
    async run(input) {
      if (input.mode === 'plan') {
        return {
          stdout: 'Plano: rever README.md e AppShell.ts antes de propor alteracoes.',
          stderr: '',
          exitCode: 0,
          timedOut: false,
          outputSummary: 'Plano guiado preparado.',
          changedFiles: [],
          structuredSummary: {
            summary: 'Plano guiado preparado.',
            suggestedFiles: input.filePaths,
            readFiles: ['README.md', 'source/apps/lume-hub-web/src/AppShell.ts'],
            notes: ['Comeca por revisar a copy antes de tocar no layout.'],
          },
          fileDiffs: [],
        };
      }

      const targetPath = input.filePaths[0] ?? 'README.md';
      const absoluteTargetPath = resolve(input.workspaceRootPath, targetPath);
      const currentContent = await readFile(absoluteTargetPath, 'utf8').catch(() => '');
      await writeFile(
        absoluteTargetPath,
        `${currentContent.trimEnd()}\n\n<!-- workspace-agent-wave40: touched -->\n`,
      );

      return {
        stdout: `Alterado ${targetPath}.`,
        stderr: '',
        exitCode: 0,
        timedOut: false,
        outputSummary: `Alterei ${targetPath}.`,
        changedFiles: [targetPath],
        structuredSummary: {
          summary: `Alterei ${targetPath} com diff guiado.`,
          suggestedFiles: input.filePaths,
          readFiles: [targetPath, 'README.md'],
          notes: ['Diff por ficheiro disponivel na interface.'],
        },
        fileDiffs: [
          {
            relativePath: targetPath,
            changeType: 'modified',
            beforeStatus: null,
            afterStatus: ' M',
            diffText: [
              `diff --git a/${targetPath} b/${targetPath}`,
              `--- a/${targetPath}`,
              `+++ b/${targetPath}`,
              '@@',
              '+<!-- workspace-agent-wave40: touched -->',
            ].join('\n'),
          },
        ],
      };
    },
  };
  const workspaceAgent = new WorkspaceAgentService({
    workspaceRootPath,
    repository: {
      async read() {
        return runLog;
      },
      async append(run) {
        runLog.runs = [...runLog.runs, run];
      },
    },
    executor: fakeExecutor,
  });

  server = new FastifyHttpServer({
    modules: {
      adminConfig: {
        async getSettings() {
          return {
            schemaVersion: 1,
            commands: {
              assistantEnabled: true,
              schedulingEnabled: true,
              ownerTerminalEnabled: true,
              autoReplyEnabled: false,
              directRepliesEnabled: false,
              allowPrivateAssistant: true,
              authorizedGroupJids: [],
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
              defaultNotificationRules: [],
            },
            updatedAt: null,
          };
        },
        async updateUiSettings(update) {
          return {
            defaultNotificationRules: update.defaultNotificationRules ?? [],
          };
        },
      },
      audienceRouting: {
        async listSenderAudienceRules() {
          return [];
        },
        async upsertSenderAudienceRule() {
          throw new Error('Not used in wave40 validation.');
        },
        async previewDistributionPlan() {
          throw new Error('Not used in wave40 validation.');
        },
      },
      groupDirectory: {
        async listGroups() {
          return [
            {
              groupJid: '120363400000000901@g.us',
              preferredSubject: 'Turma Demo',
              aliases: ['Grupo demo'],
              courseId: 'curso-demo',
              groupOwners: [],
              calendarAccessPolicy: {
                group: 'read',
                groupOwner: 'read_write',
                appOwner: 'read_write',
              },
              lastRefreshedAt: null,
            },
          ];
        },
        async replaceGroupOwners() {
          return [];
        },
        async updateCalendarAccessPolicy() {
          return {
            group: 'read',
            groupOwner: 'read_write',
            appOwner: 'read_write',
          };
        },
        async getGroupLlmInstructions() {
          return {
            primaryFilePath: join(workspaceRootPath, 'data', 'groups', 'demo', 'llm', 'instructions.md'),
            resolvedFilePath: null,
            exists: false,
            source: 'missing',
            content: null,
          };
        },
        async updateGroupLlmInstructions() {
          return {
            primaryFilePath: join(workspaceRootPath, 'data', 'groups', 'demo', 'llm', 'instructions.md'),
            resolvedFilePath: join(workspaceRootPath, 'data', 'groups', 'demo', 'llm', 'instructions.md'),
            exists: true,
            source: 'llm_instructions',
            content: 'Instrucoes demo.',
          };
        },
      },
      healthMonitor: {
        async getHealthSnapshot() {
          return {};
        },
        async getReadiness() {
          return {
            ready: true,
            status: 'healthy',
          };
        },
      },
      hostLifecycle: {
        async enableStartWithSystem() {
          return undefined;
        },
        async disableStartWithSystem() {
          return undefined;
        },
        async getHostCompanionStatus() {
          return {};
        },
      },
      instructionQueue: {
        async enqueueDistributionPlan() {
          throw new Error('Not used in wave40 validation.');
        },
        async listInstructions() {
          return [];
        },
        async retryInstruction() {
          throw new Error('Not used in wave40 validation.');
        },
      },
      systemPower: {
        async getPowerStatus() {
          return {};
        },
        async updatePowerPolicy() {
          return {};
        },
      },
      watchdog: {
        async listIssues() {
          return [];
        },
        async resolveIssue() {
          return null;
        },
      },
      workspaceAgent,
    },
  });

  const client = new FrontendApiClient({
    async request(request) {
      return server.inject(request);
    },
  });

  const planRun = await client.runWorkspaceAgent({
    prompt: 'Analisa o repo e prepara um plano curto.',
    mode: 'plan',
    filePaths: ['README.md'],
  });
  assert.equal(planRun.status, 'completed');
  assert.equal(planRun.changedFiles.length, 0);
  assert.deepEqual(planRun.structuredSummary.suggestedFiles, ['README.md']);
  assert.ok(planRun.structuredSummary.readFiles.includes('source/apps/lume-hub-web/src/AppShell.ts'));

  const applyRun = await client.runWorkspaceAgent({
    prompt: 'Atualiza o README para registar esta validacao.',
    mode: 'apply',
    filePaths: ['README.md'],
  });
  assert.equal(applyRun.status, 'completed');
  assert.deepEqual(applyRun.changedFiles, ['README.md']);
  assert.equal(applyRun.fileDiffs.length, 1);
  assert.match(applyRun.fileDiffs[0].diffText, /workspace-agent-wave40: touched/u);

  const recentRuns = await client.listWorkspaceAgentRuns(5);
  assert.equal(recentRuns.length, 2);
  assert.equal(recentRuns[0].runId, applyRun.runId);
  assert.equal(recentRuns[0].fileDiffs.length, 1);

  const address = await server.listen({
    host: '127.0.0.1',
    port: 0,
    staticSite: {
      rootPath: WEB_DIST_ROOT,
      bootConfig: {
        defaultMode: 'live',
      },
    },
  });
  const dump = await runChromeDump(`${address.origin}/workspace?mode=live`);

  assert.match(dump.stdout, /LumeHub \| Projeto/u);
  assert.match(dump.stdout, /Contexto antes de correr/u);
  assert.match(dump.stdout, /Rever sem alterar/u);
  assert.match(dump.stdout, /Ficheiros lidos/u);
  assert.match(dump.stdout, /Ver diff por ficheiro/u);
  assert.doesNotMatch(dump.stdout, /Algo falhou ao carregar esta pagina/u);
  assert.doesNotMatch(dump.stderr, /(TypeError|ReferenceError|Uncaught)/u);

  console.log('validate-wave40: ok');
} finally {
  if (server) {
    await server.close().catch(() => undefined);
  }

  await rm(sandboxPath, {
    recursive: true,
    force: true,
  });
}
