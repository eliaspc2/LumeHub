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
const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave39-'));
const workspaceRootPath = join(sandboxPath, 'repo');
const runtimeRootPath = join(sandboxPath, 'runtime');
const runLogFilePath = join(runtimeRootPath, 'workspace-agent-runs.json');

let server = null;

try {
  await mkdir(join(workspaceRootPath, 'source', 'apps', 'lume-hub-web', 'src'), {
    recursive: true,
  });
  await mkdir(runtimeRootPath, {
    recursive: true,
  });

  await writeFile(join(workspaceRootPath, 'README.md'), '# Demo workspace\n\nEstado inicial para validar o agente do projeto.\n');
  await writeFile(
    join(workspaceRootPath, 'source', 'apps', 'lume-hub-web', 'src', 'AppShell.ts'),
    'export const workspaceDemo = "LumeHub workspace route";\n',
  );
  await writeFile(join(workspaceRootPath, 'docs.md'), 'Documento auxiliar.\n');

  const fakeExecutor = {
    async run(input) {
      if (input.mode === 'plan') {
        return {
          stdout: 'Plano: rever AppShell.ts e README.md antes de editar.',
          stderr: '',
          exitCode: 0,
          timedOut: false,
          outputSummary: 'Plano gerado para o workspace.',
          changedFiles: [],
        };
      }

      const targetPath = input.filePaths[0] ?? 'README.md';
      const absoluteTargetPath = resolve(input.workspaceRootPath, targetPath);
      const currentContent = await readFile(absoluteTargetPath, 'utf8').catch(() => '');
      await writeFile(
        absoluteTargetPath,
        `${currentContent.trimEnd()}\n\n<!-- workspace-agent: touched -->\n`,
      );

      return {
        stdout: `Alterado ${targetPath}.`,
        stderr: '',
        exitCode: 0,
        timedOut: false,
        outputSummary: `Alterei ${targetPath}.`,
        changedFiles: [targetPath],
      };
    },
  };

  const runLog = {
    schemaVersion: 1,
    runs: [],
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
          throw new Error('Not used in wave39 validation.');
        },
        async previewDistributionPlan() {
          throw new Error('Not used in wave39 validation.');
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
          throw new Error('Not used in wave39 validation.');
        },
        async listInstructions() {
          return [];
        },
        async retryInstruction() {
          throw new Error('Not used in wave39 validation.');
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

  const files = await client.searchWorkspaceFiles('app', 10);
  assert.ok(files.some((entry) => entry.relativePath === 'source/apps/lume-hub-web/src/AppShell.ts'));

  const preview = await client.getWorkspaceFile('README.md');
  assert.match(preview.content, /Demo workspace/u);
  assert.equal(preview.relativePath, 'README.md');

  const planRun = await client.runWorkspaceAgent({
    prompt: 'Analisa o repo e diz por onde começarias.',
    mode: 'plan',
    filePaths: ['README.md'],
  });
  assert.equal(planRun.status, 'completed');
  assert.equal(planRun.changedFiles.length, 0);

  const applyRun = await client.runWorkspaceAgent({
    prompt: 'Atualiza o README para registar esta validação.',
    mode: 'apply',
    filePaths: ['README.md'],
  });
  assert.equal(applyRun.status, 'completed');
  assert.deepEqual(applyRun.changedFiles, ['README.md']);

  const updatedPreview = await client.getWorkspaceFile('README.md');
  assert.match(updatedPreview.content, /workspace-agent: touched/u);

  const recentRuns = await client.listWorkspaceAgentRuns(5);
  assert.equal(recentRuns.length, 2);
  assert.equal(recentRuns[0].runId, applyRun.runId);
  assert.equal(recentRuns[1].runId, planRun.runId);

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
  assert.match(dump.stdout, /Pedir trabalho ao agente/u);
  assert.match(dump.stdout, /Explorar ficheiros do repo/u);
  assert.match(dump.stdout, /Preview do ficheiro/u);
  assert.match(dump.stdout, /Runs recentes/u);
  assert.doesNotMatch(dump.stdout, /Algo falhou ao carregar esta pagina/u);
  assert.doesNotMatch(dump.stderr, /(TypeError|ReferenceError|Uncaught)/u);

  console.log('validate-wave39: ok');
} finally {
  if (server) {
    await server.close().catch(() => undefined);
  }

  await rm(sandboxPath, {
    recursive: true,
    force: true,
  });
}
