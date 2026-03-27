import test from 'node:test';
import assert from 'node:assert/strict';

const { FastifyHttpServer } = await import(
  '../../packages/adapters/http-fastify/dist/adapters/http-fastify/src/public/index.js'
);
const { InMemoryFrontendApiTransport } = await import(
  '../../packages/adapters/frontend-api-client/dist/adapters/frontend-api-client/src/public/index.js'
);
const { WebAppBootstrap } = await import('../../apps/lume-hub-web/dist/apps/lume-hub-web/src/app/WebAppBootstrap.js');

test('dashboard surfaces watchdog and host companion state clearly', async () => {
  const server = new FastifyHttpServer({
    modules: {
      adminConfig: {
        async getSettings() {
          return {
            commands: {
              assistantEnabled: true,
              schedulingEnabled: true,
              ownerTerminalEnabled: true,
              autoReplyEnabled: true,
              directRepliesEnabled: false,
              allowPrivateAssistant: true,
              authorizedGroupJids: ['120363400000000001@g.us'],
              authorizedPrivateJids: ['351910000099@s.whatsapp.net'],
            },
            whatsapp: {
              enabled: true,
              sharedAuthWithCodex: true,
              groupDiscoveryEnabled: true,
              conversationDiscoveryEnabled: true,
            },
            llm: {
              enabled: false,
              provider: 'codex-oauth',
              model: 'gpt-5.4',
              streamingEnabled: true,
            },
            ui: {
              defaultNotificationRules: [],
            },
            updatedAt: '2026-03-26T12:00:00.000Z',
          };
        },
        async updateUiSettings(update) {
          return {
            commands: {
              assistantEnabled: true,
              schedulingEnabled: true,
              ownerTerminalEnabled: true,
              autoReplyEnabled: true,
              directRepliesEnabled: false,
              allowPrivateAssistant: true,
              authorizedGroupJids: ['120363400000000001@g.us'],
              authorizedPrivateJids: ['351910000099@s.whatsapp.net'],
            },
            whatsapp: {
              enabled: true,
              sharedAuthWithCodex: true,
              groupDiscoveryEnabled: true,
              conversationDiscoveryEnabled: true,
            },
            llm: {
              enabled: false,
              provider: 'codex-oauth',
              model: 'gpt-5.4',
              streamingEnabled: true,
            },
            ui: {
              defaultNotificationRules: update.defaultNotificationRules ?? [],
            },
            updatedAt: '2026-03-26T12:00:00.000Z',
          };
        },
      },
      audienceRouting: {
        async listSenderAudienceRules() {
          return [
            {
              ruleId: 'rule-1',
              personId: 'person-1',
              identifiers: [],
              targetGroupJids: ['120363400000000001@g.us'],
              targetCourseIds: [],
              targetDisciplineCodes: [],
              enabled: true,
              requiresConfirmation: true,
              notes: null,
              createdAt: '2026-03-26T12:00:00.000Z',
              updatedAt: '2026-03-26T12:00:00.000Z',
            },
          ];
        },
        async upsertSenderAudienceRule(input) {
          return {
            ...input,
            ruleId: 'rule-updated',
            createdAt: '2026-03-26T12:00:00.000Z',
            updatedAt: '2026-03-26T12:00:00.000Z',
          };
        },
      },
      groupDirectory: {
        async listGroups() {
          return [
            {
              groupJid: '120363400000000001@g.us',
              preferredSubject: 'Turma A',
              aliases: [],
              courseId: 'course-a',
              groupOwners: [
                {
                  personId: 'person-owner',
                  assignedAt: '2026-03-26T10:00:00.000Z',
                  assignedBy: 'person-app-owner',
                },
              ],
              calendarAccessPolicy: {
                group: 'read',
                groupOwner: 'read_write',
                appOwner: 'read_write',
              },
              workspace: {
                rootPath: '/tmp/group-a',
                metadataFilePath: '/tmp/group-a/group.json',
                promptFilePath: '/tmp/group-a/prompt.md',
                policyFilePath: '/tmp/group-a/policy.json',
              },
              lastRefreshedAt: '2026-03-26T10:00:00.000Z',
            },
          ];
        },
        async replaceGroupOwners() {
          return [];
        },
        async updateCalendarAccessPolicy(_groupJid, update) {
          return {
            group: update.group ?? 'read',
            groupOwner: update.groupOwner ?? 'read_write',
            appOwner: update.appOwner ?? 'read_write',
          };
        },
      },
      healthMonitor: {
        async getHealthSnapshot() {
          return {
            status: 'degraded',
            ready: false,
            modules: [
              {
                name: 'host-lifecycle',
                version: '0.1.0',
                status: 'healthy',
                details: {
                  authExists: true,
                },
              },
            ],
            jobs: {
              pending: 0,
              waitingConfirmation: 1,
              sent: 5,
            },
            watchdog: {
              openIssues: 1,
            },
          };
        },
        async getReadiness() {
          return {
            ready: false,
            status: 'degraded',
          };
        },
      },
      hostLifecycle: {
        async enableStartWithSystem() {
          return {
            enabled: true,
          };
        },
        async disableStartWithSystem() {
          return {
            enabled: false,
          };
        },
        async getHostCompanionStatus() {
          return {
            schemaVersion: 1,
            hostId: 'host-kubuntu',
            auth: {
              filePath: '/home/eliaspc/.codex/auth.json',
              exists: true,
              sameAsCodexCanonical: true,
            },
            autostart: {
              enabled: true,
              serviceName: 'lume-hub-host.service',
              manifestPath: '/tmp/lume-hub-host.service',
              workingDirectory: '/tmp/source',
              execStart: '/usr/bin/env node /tmp/lume-hub-host.js',
              installedAt: '2026-03-26T09:00:00.000Z',
            },
            runtime: {
              stateFilePath: '/tmp/host-state.json',
              backendStateFilePath: '/tmp/backend-host-state.json',
              lastRepairAt: '2026-03-26T09:00:00.000Z',
              lastHeartbeatAt: '2026-03-26T12:05:00.000Z',
              updatedAt: '2026-03-26T12:05:00.000Z',
              lastError: null,
            },
          };
        },
      },
      instructionQueue: {
        async listInstructions() {
          return [
            {
              instructionId: 'instruction-1',
              sourceType: 'fanout_request',
              sourceMessageId: 'wamid.1',
              mode: 'confirmed',
              status: 'partial_failed',
              metadata: {},
              actions: [
                {
                  actionId: 'action-1',
                  type: 'send_message',
                  dedupeKey: 'wamid.1:120363400000000001@g.us',
                  targetGroupJid: '120363400000000001@g.us',
                  payload: {},
                  status: 'completed',
                  attemptCount: 1,
                  lastError: null,
                  result: null,
                  lastAttemptAt: '2026-03-26T12:00:00.000Z',
                  completedAt: '2026-03-26T12:00:02.000Z',
                },
                {
                  actionId: 'action-2',
                  type: 'send_message',
                  dedupeKey: 'wamid.1:120363400000000002@g.us',
                  targetGroupJid: '120363400000000002@g.us',
                  payload: {},
                  status: 'failed',
                  attemptCount: 1,
                  lastError: 'Timeout',
                  result: null,
                  lastAttemptAt: '2026-03-26T12:00:00.000Z',
                  completedAt: '2026-03-26T12:00:02.000Z',
                },
              ],
              createdAt: '2026-03-26T12:00:00.000Z',
              updatedAt: '2026-03-26T12:00:02.000Z',
            },
          ];
        },
      },
      peopleMemory: {
        async listPeople() {
          return [
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
              createdAt: '2026-03-26T09:00:00.000Z',
              updatedAt: '2026-03-26T09:00:00.000Z',
            },
            {
              personId: 'person-owner',
              displayName: 'Ana Formadora',
              identifiers: [
                {
                  kind: 'whatsapp_jid',
                  value: '351910000001@s.whatsapp.net',
                },
              ],
              globalRoles: ['member'],
              createdAt: '2026-03-26T09:00:00.000Z',
              updatedAt: '2026-03-26T09:00:00.000Z',
            },
          ];
        },
        async upsertByIdentifiers(input) {
          return {
            personId: input.personId ?? 'person-created',
            displayName: input.displayName,
            identifiers: input.identifiers,
            globalRoles: input.globalRoles ?? ['member'],
            createdAt: '2026-03-26T09:00:00.000Z',
            updatedAt: '2026-03-26T09:00:00.000Z',
          };
        },
        async updatePersonRoles(personId, globalRoles) {
          return {
            personId,
            displayName: 'Pessoa Atualizada',
            identifiers: [],
            globalRoles,
            createdAt: '2026-03-26T09:00:00.000Z',
            updatedAt: '2026-03-26T09:00:00.000Z',
          };
        },
      },
      systemPower: {
        async getPowerStatus() {
          return {
            policy: {
              enabled: true,
              mode: 'prevent_sleep',
            },
            inhibitorActive: true,
            reasons: ['watchdog_issue'],
            explanation: 'Watchdog issue active.',
          };
        },
        async updatePowerPolicy(update) {
          return {
            policy: {
              enabled: update.enabled ?? true,
              mode: update.mode ?? 'prevent_sleep',
            },
            inhibitorActive: update.enabled ?? true,
            reasons: ['watchdog_issue'],
            explanation: 'Watchdog issue active.',
          };
        },
      },
      watchdog: {
        async listIssues() {
          return [
            {
              issueId: 'issue-1',
              kind: 'job_overdue',
              jobId: 'job-1',
              weekId: '2026-W13',
              groupJid: '120363400000000001@g.us',
              groupLabel: 'Turma A',
              openedAt: '2026-03-26T11:59:00.000Z',
              resolvedAt: null,
              status: 'open',
              summary: 'Job atrasado ha 6 minutos.',
            },
          ];
        },
        async resolveIssue() {
          return undefined;
        },
      },
    },
  });

  const app = new WebAppBootstrap({
    transport: new InMemoryFrontendApiTransport(server),
  });
  const pages = await app.router.renderPages();
  const dashboardPage = pages.find((page) => page.route === '/dashboard');
  const whatsappPage = pages.find((page) => page.route === '/whatsapp');

  assert.ok(dashboardPage);
  assert.ok(whatsappPage);
  assert.equal(dashboardPage.sections.some((section) => section.title === 'Host Companion'), true);
  assert.equal(dashboardPage.sections.some((section) => section.title === 'Watchdog'), true);
  assert.equal(JSON.stringify(dashboardPage).includes('host_id=host-kubuntu'), true);
  assert.equal(JSON.stringify(dashboardPage).includes('Job atrasado ha 6 minutos.'), true);
  assert.equal(JSON.stringify(whatsappPage).includes('Dono da App'), true);
  assert.equal(JSON.stringify(whatsappPage).includes('assistant_access=allowed'), true);
  assert.equal(JSON.stringify(whatsappPage).includes('private_access=allowed'), true);
});
