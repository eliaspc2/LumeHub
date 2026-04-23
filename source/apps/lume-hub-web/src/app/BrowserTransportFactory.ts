import type { AutomationDefinition, MessageAlertRule } from '@lume-hub/admin-config';
import type {
  AdminSettings,
  AutomationRunSnapshot,
  AssistantScheduleApplySnapshot,
  AssistantSchedulePreviewSnapshot,
  CommandsPolicySettings,
  ConversationAuditRecord,
  DashboardSnapshot,
  DistributionExecutionResult,
  DistributionPlan,
  DistributionSummary,
  FrontendApiRequest,
  FrontendApiResponse,
  FrontendApiTransport,
  FrontendUiEvent,
  Group,
  GroupFirstContractSnapshot,
  GroupContextPreviewSnapshot,
  GroupCalendarAccessPolicy,
  GroupIntelligenceSnapshot,
  GroupKnowledgeDocumentSnapshot,
  GroupOperationalSettings,
  GroupOwnerAssignmentInput,
  GroupReminderPolicySnapshot,
  Instruction,
  LegacyAlertImportReportSnapshot,
  LegacyAutomationImportReportSnapshot,
  LegacyScheduleImportFileSnapshot,
  LegacyScheduleImportReportSnapshot,
  LlmChatInput,
  LlmChatResult,
  LlmModelDescriptor,
  LlmRunLogEntry,
  MediaAssetSnapshot,
  MessageAlertMatchSnapshot,
  MigrationReadinessSnapshot,
  Person,
  PersonRole,
  SettingsSnapshot,
  SenderAudienceRule,
  StatusSnapshot,
  WhatsAppWorkspaceSnapshot,
  WhatsAppConversationSummary,
  WhatsAppGroupSummary,
  WatchdogIssue,
  WeeklyPlannerEventSummary,
  WeeklyPlannerSnapshot,
  WorkspaceAgentRunSnapshot,
  WorkspaceAgentStatusSnapshot,
  WorkspaceFileContentSnapshot,
  WorkspaceFileSnapshot,
} from '@lume-hub/frontend-api-client';

export type FrontendTransportMode = 'demo' | 'live';

export interface FrontendBootConfig {
  readonly defaultMode?: FrontendTransportMode;
  readonly apiBaseUrl?: string;
  readonly webSocketPath?: string;
}

declare global {
  interface Window {
    __LUMEHUB_BOOT_CONFIG__?: FrontendBootConfig;
  }
}

const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
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
  alerts: {
    enabled: true,
    rules: [],
  },
  automations: {
    enabled: true,
    fireWindowMinutes: 5,
    definitions: [],
  },
  updatedAt: null,
};

const DEFAULT_DEMO_GROUP_OPERATIONAL_SETTINGS: GroupOperationalSettings = {
  mode: 'com_agendamento',
  schedulingEnabled: true,
  allowLlmScheduling: true,
  memberTagPolicy: 'members_can_tag',
};

const GROUP_FIRST_CONTRACT_SNAPSHOT: GroupFirstContractSnapshot = {
  schemaVersion: 1,
  pages: {
    calendar: {
      pageId: 'calendar',
      currentRoute: '/week',
      scope: 'weekly_notifications',
      groupQueryParam: 'groupJid',
    },
    groups: {
      pageId: 'groups',
      collectionRoute: '/groups',
      itemRoutePattern: '/groups/:groupJid',
      switcherEnabled: true,
      switcherSource: '/api/groups',
    },
    whatsapp: {
      pageId: 'whatsapp',
      currentRoute: '/whatsapp',
    },
    lumeHub: {
      pageId: 'lumehub',
      currentRoute: '/settings',
    },
    llm: {
      pageId: 'llm',
      currentRoute: '/assistant',
    },
    migration: {
      pageId: 'migration',
      currentRoute: '/migration',
    },
  },
};

export function createInitialTransportMode(
  locationLike: Pick<Location, 'search'> = window.location,
  bootConfig: FrontendBootConfig = readFrontendBootConfig(),
): FrontendTransportMode {
  const params = new URLSearchParams(locationLike.search);

  if (params.get('mode') === 'live') {
    return 'live';
  }

  if (params.get('mode') === 'demo') {
    return 'demo';
  }

  return bootConfig.defaultMode === 'live' ? 'live' : 'demo';
}

export function createFrontendTransport(
  mode: FrontendTransportMode,
  options: {
    readonly baseUrl?: string;
    readonly webSocketPath?: string;
  } = {},
): FrontendApiTransport {
  if (mode === 'live') {
    const bootConfig = readFrontendBootConfig();

    return new BrowserFetchFrontendApiTransport(options.baseUrl ?? bootConfig.apiBaseUrl, {
      webSocketPath: options.webSocketPath ?? bootConfig.webSocketPath,
    });
  }

  return new DemoFrontendApiTransport();
}

class BrowserFetchFrontendApiTransport implements FrontendApiTransport {
  private readonly listeners = new Set<(event: FrontendUiEvent) => void>();
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;

  constructor(
    private readonly baseUrl = window.location.origin,
    private readonly options: {
      readonly webSocketPath?: string;
    } = {},
  ) {}

  async request<T = unknown>(request: FrontendApiRequest): Promise<FrontendApiResponse<T>> {
    const response = await fetch(new URL(request.path, this.baseUrl), {
      method: request.method,
      headers: {
        ...(request.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(request.headers ?? {}),
      },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    const rawBody = await response.text();
    const body = parseHttpBody<T>(rawBody, response.headers.get('content-type'));

    return {
      statusCode: response.status,
      body,
    };
  }

  subscribe(listener: (event: FrontendUiEvent) => void): () => void {
    this.listeners.add(listener);
    this.ensureSocket();

    return () => {
      this.listeners.delete(listener);

      if (this.listeners.size === 0) {
        this.disposeSocket();
      }
    };
  }

  private ensureSocket(): void {
    if (this.socket || this.listeners.size === 0) {
      return;
    }

    const socket = new WebSocket(this.resolveWebSocketUrl());
    this.socket = socket;

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as FrontendUiEvent;
        this.listeners.forEach((listener) => listener(payload));
      } catch {}
    });

    socket.addEventListener('close', () => {
      this.socket = null;

      if (this.listeners.size === 0 || this.reconnectTimer !== null) {
        return;
      }

      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        this.ensureSocket();
      }, 800);
    });

    socket.addEventListener('error', () => {
      try {
        socket.close();
      } catch {}
    });
  }

  private disposeSocket(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.socket) {
      return;
    }

    try {
      this.socket.close();
    } catch {}

    this.socket = null;
  }

  private resolveWebSocketUrl(): string {
    const wsPath = normaliseWebSocketPath(this.options.webSocketPath ?? '/ws');
    const baseUrl = new URL(this.baseUrl, window.location.origin);
    const protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${baseUrl.host}${wsPath}`;
  }
}

class DemoFrontendApiTransport implements FrontendApiTransport {
  private readonly listeners = new Set<(event: FrontendUiEvent) => void>();
  private readonly state = createDemoState();

  constructor() {
    setTimeout(() => {
      this.emit('preview.ready', {
        mode: 'demo',
        message: 'Preview demo pronta para validar a nova shell do frontend.',
      });
    }, 300);
  }

  async request<T = unknown>(request: FrontendApiRequest): Promise<FrontendApiResponse<T>> {
    await delay(140);

    const pathname = new URL(request.path, 'http://lumehub.preview').pathname;

    if (request.method === 'GET' && pathname === '/api/dashboard') {
      return this.ok(buildDashboardSnapshot(this.state));
    }

    if (request.method === 'GET' && pathname === '/api/status') {
      return this.ok(buildStatusSnapshot(this.state));
    }

    if (request.method === 'GET' && pathname === '/api/schedules') {
      return this.ok(buildWeeklyPlannerSnapshot(this.state));
    }

    if (request.method === 'POST' && pathname === '/api/schedules') {
      const payload = request.body as Record<string, unknown>;
      const groupJid =
        typeof payload.groupJid === 'string' && payload.groupJid.trim().length > 0
          ? payload.groupJid.trim()
          : this.state.groups[0]?.groupJid ?? '';
      const group = this.state.groups.find((candidate) => candidate.groupJid === groupJid) ?? null;
      const blockingReason = readDemoScheduleRouteBlockingReason(group, 'manual');

      if (blockingReason) {
        return this.error(400, blockingReason);
      }

      const schedule = upsertDemoSchedule(this.state, payload);
      this.emit('schedules.updated', {
        eventId: schedule.eventId,
        groupJid: schedule.groupJid,
        weekId: schedule.weekId,
      });
      return this.ok(schedule);
    }

    if (request.method === 'GET' && pathname === '/api/migrations/wa-notify/schedules/files') {
      return this.ok(this.state.legacyScheduleFiles);
    }

    if (request.method === 'POST' && pathname === '/api/migrations/wa-notify/schedules/preview') {
      return this.ok(buildDemoLegacyScheduleImportReport(this.state, request.body as Record<string, unknown>, false));
    }

    if (request.method === 'POST' && pathname === '/api/migrations/wa-notify/schedules/apply') {
      const report = buildDemoLegacyScheduleImportReport(this.state, request.body as Record<string, unknown>, true);
      applyDemoLegacyScheduleImport(this.state, report);
      this.emit('schedules.import.completed', {
        fileName: report.sourceFile.fileName,
        created: report.totals.created,
        updated: report.totals.updated,
        unchanged: report.totals.unchanged,
        ambiguous: report.totals.ambiguous,
      });
      return this.ok(report);
    }

    if (request.method === 'GET' && pathname === '/api/groups') {
      return this.ok(this.state.groups);
    }

    if (request.method === 'GET' && pathname === '/api/group-first/contract') {
      return this.ok(GROUP_FIRST_CONTRACT_SNAPSHOT);
    }

    if (request.method === 'GET' && pathname === '/api/media/assets') {
      return this.ok(this.state.mediaAssets);
    }

    if (request.method === 'GET' && pathname === '/api/workspace/files') {
      const query = new URL(request.path, 'http://lumehub.preview').searchParams.get('query') ?? '';
      const limit = Number.parseInt(
        new URL(request.path, 'http://lumehub.preview').searchParams.get('limit') ?? '80',
        10,
      );
      return this.ok(searchDemoWorkspaceFiles(this.state, query, Number.isFinite(limit) ? limit : 80));
    }

    if (request.method === 'GET' && pathname === '/api/workspace/file') {
      const relativePath = new URL(request.path, 'http://lumehub.preview').searchParams.get('path');

      if (!relativePath) {
        return this.error(400, 'Demo workspace file path is required.');
      }

      const file = this.state.workspaceFiles.find((candidate) => candidate.relativePath === relativePath);
      return file ? this.ok(file) : this.error(404, `Demo workspace file ${relativePath} not found.`);
    }

    if (request.method === 'GET' && pathname === '/api/workspace/runs') {
      const limit = Number.parseInt(
        new URL(request.path, 'http://lumehub.preview').searchParams.get('limit') ?? '12',
        10,
      );
      return this.ok(this.state.workspaceRuns.slice(0, Number.isFinite(limit) ? Math.max(1, limit) : 12));
    }

    if (request.method === 'GET' && pathname === '/api/workspace/status') {
      return this.ok(this.state.workspaceStatus);
    }

    if (request.method === 'POST' && pathname === '/api/workspace/agent/runs') {
      const result = createDemoWorkspaceRun(this.state, request.body as Record<string, unknown>);
      this.emit('workspace.agent.run.completed', {
        runId: result.runId,
        mode: result.mode,
        status: result.status,
        executionState: result.executionState,
        approvalState: result.approvalState,
        guardrailReason: result.guardrailReason,
        changedFiles: result.changedFiles,
      });
      return this.ok(result);
    }

    const mediaAssetMatch = matchParameterizedPath(pathname, '/api/media/assets/:assetId');

    if (request.method === 'GET' && mediaAssetMatch) {
      const asset = this.state.mediaAssets.find((candidate) => candidate.assetId === mediaAssetMatch.assetId);
      return asset
        ? this.ok(asset)
        : this.error(404, `Demo media asset ${mediaAssetMatch.assetId} not found.`);
    }

    const groupIntelligenceMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/intelligence');
    const groupReminderPolicyMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/reminder-policy');
    const groupInstructionsMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/llm-instructions');
    const groupKnowledgeUpsertMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/knowledge/documents');
    const groupKnowledgeDeleteMatch = matchParameterizedPath(
      pathname,
      '/api/groups/:groupJid/knowledge/documents/:documentId',
    );
    const groupContextPreviewMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/context-preview');

    if (request.method === 'GET' && groupIntelligenceMatch) {
      return this.ok(buildDemoGroupIntelligenceSnapshot(this.state, groupIntelligenceMatch.groupJid));
    }

    if (request.method === 'GET' && groupReminderPolicyMatch) {
      const entry = this.state.groupIntelligenceByGroupJid[groupReminderPolicyMatch.groupJid];
      return this.ok(entry?.reminderPolicy ?? createDemoReminderPolicy(groupReminderPolicyMatch.groupJid));
    }

    if (request.method === 'PUT' && groupReminderPolicyMatch) {
      const entry = this.state.groupIntelligenceByGroupJid[groupReminderPolicyMatch.groupJid];

      if (!entry) {
        return this.error(404, `Demo group intelligence for ${groupReminderPolicyMatch.groupJid} not found.`);
      }

      const body = request.body as Partial<GroupReminderPolicySnapshot>;
      const nextPolicy: GroupReminderPolicySnapshot = {
        ...entry.reminderPolicy,
        enabled: typeof body.enabled === 'boolean' ? body.enabled : entry.reminderPolicy.enabled,
        reminders: Array.isArray(body.reminders) ? (body.reminders as GroupReminderPolicySnapshot['reminders']) : entry.reminderPolicy.reminders,
      };
      this.state.groupIntelligenceByGroupJid[groupReminderPolicyMatch.groupJid] = {
        ...entry,
        reminderPolicy: nextPolicy,
      };
      this.emit('groups.reminders.updated', {
        groupJid: groupReminderPolicyMatch.groupJid,
        enabled: nextPolicy.enabled,
        reminderCount: nextPolicy.reminders.length,
      });
      return this.ok(nextPolicy);
    }

    if (request.method === 'PUT' && groupInstructionsMatch) {
      const body = request.body as { readonly content?: string };
      const entry = this.state.groupIntelligenceByGroupJid[groupInstructionsMatch.groupJid];

      if (!entry) {
        return this.error(404, `Demo group intelligence for ${groupInstructionsMatch.groupJid} not found.`);
      }

      this.state.groupIntelligenceByGroupJid[groupInstructionsMatch.groupJid] = {
        ...entry,
        instructions: typeof body.content === 'string' ? body.content : entry.instructions,
      };
      const snapshot = buildDemoGroupIntelligenceSnapshot(this.state, groupInstructionsMatch.groupJid);
      this.emit('groups.intelligence.instructions.updated', {
        groupJid: groupInstructionsMatch.groupJid,
        source: snapshot.instructions.source,
      });
      return this.ok(snapshot.instructions);
    }

    if (request.method === 'POST' && groupKnowledgeUpsertMatch) {
      const nextDocument = upsertDemoGroupKnowledgeDocument(
        this.state,
        groupKnowledgeUpsertMatch.groupJid,
        request.body as Record<string, unknown>,
      );
      this.emit('groups.knowledge.document.updated', {
        groupJid: groupKnowledgeUpsertMatch.groupJid,
        documentId: nextDocument.documentId,
        filePath: nextDocument.filePath,
      });
      return this.ok(nextDocument);
    }

    if (request.method === 'DELETE' && groupKnowledgeDeleteMatch) {
      const deleted = deleteDemoGroupKnowledgeDocument(
        this.state,
        groupKnowledgeDeleteMatch.groupJid,
        groupKnowledgeDeleteMatch.documentId,
      );
      this.emit('groups.knowledge.document.deleted', deleted);
      return this.ok(deleted);
    }

    if (request.method === 'POST' && groupContextPreviewMatch) {
      return this.ok(
        buildDemoGroupContextPreview(
          this.state,
          groupContextPreviewMatch.groupJid,
          request.body as {
            readonly text?: string;
            readonly personId?: string | null;
            readonly senderDisplayName?: string | null;
          },
        ),
      );
    }

    if (request.method === 'GET' && pathname === '/api/people') {
      return this.ok(this.state.people);
    }

    if (request.method === 'GET' && pathname === '/api/routing/rules') {
      return this.ok(this.state.routingRules);
    }

    if (request.method === 'POST' && pathname === '/api/routing/preview') {
      return this.ok(buildDemoDistributionPlan(this.state, request.body as Record<string, unknown>));
    }

    if (request.method === 'GET' && pathname === '/api/routing/distributions') {
      return this.ok(this.state.distributions);
    }

    if (request.method === 'POST' && pathname === '/api/routing/distributions') {
      const result = createDemoDistribution(this.state, request.body as Record<string, unknown>);
      this.emit('routing.distribution.created', result.instruction);
      return this.ok(result);
    }

    if (request.method === 'GET' && pathname === '/api/instruction-queue') {
      return this.ok(this.state.instructionQueue);
    }

    if (request.method === 'GET' && pathname === '/api/whatsapp/workspace') {
      return this.ok(buildWhatsAppWorkspaceSnapshot(this.state));
    }

    if (request.method === 'GET' && pathname === '/api/qr') {
      return this.ok(buildWhatsAppWorkspaceSnapshot(this.state).runtime.qr);
    }

    if (request.method === 'GET' && pathname === '/api/qr.svg') {
      return this.ok({
        svg: buildWhatsAppWorkspaceSnapshot(this.state).runtime.qr.svg,
      });
    }

    if (request.method === 'POST' && pathname === '/api/whatsapp/refresh') {
      this.emit('whatsapp.workspace.refreshed', {
        mode: 'demo',
      });
      return this.ok(buildWhatsAppWorkspaceSnapshot(this.state));
    }

    if (request.method === 'GET' && pathname === '/api/watchdog/issues') {
      return this.ok(this.state.watchdogIssues);
    }

    if (request.method === 'GET' && pathname === '/api/settings') {
      return this.ok(this.state.settings);
    }

    if (request.method === 'GET' && pathname === '/api/migrations/readiness') {
      return this.ok(buildDemoMigrationReadinessSnapshot(this.state));
    }

    if (request.method === 'GET' && pathname === '/api/settings/codex-auth-router') {
      return this.ok(this.state.settings.authRouterStatus);
    }

    if (request.method === 'PATCH' && pathname === '/api/settings/codex-auth-router') {
      const body = request.body as { readonly enabled?: boolean };

      if (typeof body?.enabled !== 'boolean') {
        return this.error(400, 'Demo codex auth router update requires enabled boolean.');
      }

      const status = setDemoCodexAuthRouterEnabled(this.state, body.enabled);
      this.emit('settings.codex_auth_router.updated', {
        mode: 'demo',
        enabled: status.enabled,
        accountId: status.currentSelection?.accountId ?? null,
      });
      return this.ok(status);
    }

    if (request.method === 'POST' && pathname === '/api/settings/codex-auth-router/prepare') {
      if (this.state.settings.authRouterStatus && !this.state.settings.authRouterStatus.enabled) {
        return this.error(409, 'Demo codex auth router switching is disabled.');
      }

      const status = prepareDemoCodexAuthRouter(this.state);
      this.emit('settings.codex_auth_router.updated', {
        mode: 'demo',
        accountId: status.currentSelection?.accountId ?? null,
      });
      return this.ok(status);
    }

    if (request.method === 'POST' && pathname === '/api/settings/codex-auth-router/switch') {
      const body = request.body as { readonly accountId?: string };
      const accountId = typeof body?.accountId === 'string' ? body.accountId : '';

      if (!accountId) {
        return this.error(400, 'Demo codex auth router switch requires accountId.');
      }

      if (this.state.settings.authRouterStatus && !this.state.settings.authRouterStatus.enabled) {
        return this.error(409, 'Demo codex auth router switching is disabled.');
      }

      const status = forceDemoCodexAuthRouterSwitch(this.state, accountId);

      if (!status) {
        return this.error(404, `Demo codex auth account ${accountId} not found.`);
      }

      this.emit('settings.codex_auth_router.updated', {
        mode: 'demo',
        accountId: status.currentSelection?.accountId ?? null,
      });
      return this.ok(status);
    }

    if (request.method === 'POST' && pathname === '/api/settings/codex-auth-router/accounts') {
      const body = request.body as { readonly authJson?: string; readonly label?: string };
      const authJson = typeof body?.authJson === 'string' ? body.authJson : '';

      if (!authJson.trim()) {
        return this.error(400, 'Demo codex auth router import requires authJson.');
      }

      const importedAccount = importDemoCodexAuthAccount(this.state, {
        authJson,
        label: typeof body?.label === 'string' ? body.label : '',
      });
      const status = this.state.settings.authRouterStatus ?? failMissingDemoAuthRouter();

      this.emit('settings.codex_auth_router.updated', {
        mode: 'demo',
        importedAccount,
        status,
      });
      return this.ok({
        importedAccount,
        status,
      });
    }

    if (request.method === 'GET' && pathname === '/api/alerts/rules') {
      return this.ok(this.state.settings.adminSettings.alerts.rules);
    }

    if (request.method === 'GET' && pathname === '/api/alerts/matches') {
      return this.ok(readRecentDemoEntries(this.state.alertMatches, request.path, 20));
    }

    if (request.method === 'POST' && pathname === '/api/migrations/wa-notify/alerts/preview') {
      return this.ok(buildDemoLegacyAlertImportReport(this.state, false));
    }

    if (request.method === 'POST' && pathname === '/api/migrations/wa-notify/alerts/apply') {
      const report = buildDemoLegacyAlertImportReport(this.state, true);
      this.state.settings = {
        ...this.state.settings,
        adminSettings: {
          ...this.state.settings.adminSettings,
          alerts: {
            ...this.state.settings.adminSettings.alerts,
            enabled: true,
            rules: report.importedRulesSnapshot,
          },
          updatedAt: new Date().toISOString(),
        },
      };
      this.emit('alerts.import.completed', {
        importedRules: report.totals.importedRules,
      });
      return this.ok(report);
    }

    if (request.method === 'GET' && pathname === '/api/automations/definitions') {
      return this.ok(this.state.settings.adminSettings.automations.definitions);
    }

    if (request.method === 'GET' && pathname === '/api/automations/runs') {
      return this.ok(readRecentDemoEntries(this.state.automationRuns, request.path, 20));
    }

    if (request.method === 'POST' && pathname === '/api/migrations/wa-notify/automations/preview') {
      return this.ok(buildDemoLegacyAutomationImportReport(this.state, false));
    }

    if (request.method === 'POST' && pathname === '/api/migrations/wa-notify/automations/apply') {
      const report = buildDemoLegacyAutomationImportReport(this.state, true);
      this.state.settings = {
        ...this.state.settings,
        adminSettings: {
          ...this.state.settings.adminSettings,
          automations: {
            ...this.state.settings.adminSettings.automations,
            enabled: true,
            definitions: report.importedDefinitionsSnapshot,
          },
          updatedAt: new Date().toISOString(),
        },
      };
      this.emit('automations.import.completed', {
        importedDefinitions: report.totals.importedDefinitions,
      });
      return this.ok(report);
    }

    if (request.method === 'GET' && pathname === '/api/llm/models') {
      return this.ok(this.state.llmModels);
    }

    if (request.method === 'POST' && pathname === '/api/llm/chat') {
      const result = createDemoLlmChatResult(this.state, request.body as LlmChatInput);
      this.emit('llm.chat.completed', {
        runId: result.runId,
        providerId: result.providerId,
        modelId: result.modelId,
      });
      return this.ok(result);
    }

    if (request.method === 'POST' && pathname === '/api/assistant/schedules/preview') {
      return this.ok(buildDemoAssistantSchedulePreview(this.state, request.body as Record<string, unknown>));
    }

    if (request.method === 'POST' && pathname === '/api/assistant/schedules/apply') {
      const preview = buildDemoAssistantSchedulePreview(this.state, request.body as Record<string, unknown>);

      if (!preview.canApply || !preview.previewFingerprint) {
        return this.error(400, preview.blockingReason ?? 'Demo preview is not ready to apply.');
      }

      const result = applyDemoAssistantSchedule(this.state, request.body as Record<string, unknown>, preview);
      this.emit('assistant.schedule.apply.completed', {
        instructionId: result.instruction.instructionId,
        groupJid: result.preview.groupJid,
        groupLabel: result.preview.groupLabel,
        operation: result.preview.operation,
        appliedEventId: result.appliedEvent?.eventId ?? null,
      });
      if (result.appliedEvent) {
        this.emit('schedules.updated', {
          eventId: result.appliedEvent.eventId,
          groupJid: result.appliedEvent.groupJid,
          weekId: result.appliedEvent.weekId,
        });
      } else if (preview.targetEvent) {
        this.emit('schedules.deleted', {
          eventId: preview.targetEvent.eventId,
          deleted: true,
        });
      }
      return this.ok(result);
    }

    if (request.method === 'GET' && pathname === '/api/logs/llm') {
      return this.ok(readRecentDemoEntries(this.state.llmRuns, request.path, 20));
    }

    if (request.method === 'GET' && pathname === '/api/logs/conversations') {
      return this.ok(readRecentDemoEntries(this.state.conversationAudit, request.path, 20));
    }

    if (request.method === 'PATCH' && pathname === '/api/settings/whatsapp') {
      this.state.settings = {
        ...this.state.settings,
        adminSettings: {
          ...this.state.settings.adminSettings,
          whatsapp: {
            ...this.state.settings.adminSettings.whatsapp,
            ...(request.body as Partial<AdminSettings['whatsapp']>),
          },
          updatedAt: new Date().toISOString(),
        },
      };
      const next = this.state.settings.adminSettings;
      this.emit('settings.whatsapp.updated', next.whatsapp);
      return this.ok(next);
    }

    if (request.method === 'PATCH' && pathname === '/api/settings/commands') {
      this.state.settings = {
        ...this.state.settings,
        adminSettings: {
          ...this.state.settings.adminSettings,
          commands: {
            ...this.state.settings.adminSettings.commands,
            ...(request.body as Partial<CommandsPolicySettings>),
          },
          updatedAt: new Date().toISOString(),
        },
      };
      const next = this.state.settings.adminSettings;
      this.emit('settings.commands.updated', next.commands);
      return this.ok(next);
    }

    if (request.method === 'PATCH' && pathname === '/api/settings/llm') {
      const nextAdminSettings: AdminSettings = {
        ...this.state.settings.adminSettings,
        llm: {
          ...this.state.settings.adminSettings.llm,
          ...(request.body as Partial<AdminSettings['llm']>),
        },
        updatedAt: new Date().toISOString(),
      };

      this.state.settings = {
        ...this.state.settings,
        adminSettings: nextAdminSettings,
        llmRuntime: createDemoLlmRuntimeStatus(nextAdminSettings, this.state.settings.authRouterStatus),
      };

      this.emit('settings.llm.updated', nextAdminSettings.llm);
      return this.ok(nextAdminSettings);
    }

    if (request.method === 'PATCH' && pathname === '/api/settings/ui') {
      const nextAdminSettings: AdminSettings = {
        ...this.state.settings.adminSettings,
        ui: {
          ...this.state.settings.adminSettings.ui,
          ...(request.body as Partial<AdminSettings['ui']>),
        },
        updatedAt: new Date().toISOString(),
      };

      this.state.settings = {
        ...this.state.settings,
        adminSettings: nextAdminSettings,
      };

      this.emit('settings.ui.updated', nextAdminSettings.ui);
      return this.ok(nextAdminSettings);
    }

    if (request.method === 'PATCH' && pathname === '/api/settings/power-policy') {
      const update = request.body as Partial<SettingsSnapshot['powerStatus']['policy']>;
      const nextPolicy = {
        ...this.state.settings.powerStatus.policy,
        ...update,
        updatedAt: new Date().toISOString(),
      };
      const nextPowerStatus: SettingsSnapshot['powerStatus'] = {
        ...this.state.settings.powerStatus,
        policy: nextPolicy,
        inhibitorActive: nextPolicy.enabled && nextPolicy.mode !== 'allow_sleep',
        desiredState: nextPolicy.enabled && nextPolicy.mode !== 'allow_sleep' ? 'inhibited' : 'released',
        explanation:
          nextPolicy.enabled && nextPolicy.mode !== 'allow_sleep'
            ? 'O sistema continuaria a manter o PC acordado com esta politica.'
            : 'O sistema deixa de pedir inibicao permanente com esta politica.',
        updatedAt: new Date().toISOString(),
      };

      this.state.settings = {
        ...this.state.settings,
        powerStatus: nextPowerStatus,
        hostStatus: {
          ...this.state.settings.hostStatus,
          power: {
            ...this.state.settings.hostStatus.power,
            leaseId: this.state.settings.hostStatus.power?.leaseId ?? null,
            policyMode: nextPolicy.mode,
            inhibitorActive: nextPowerStatus.inhibitorActive,
            explanation: nextPowerStatus.explanation,
          },
        },
      };

      this.emit('settings.power.updated', nextPowerStatus);
      return this.ok(nextPowerStatus);
    }

    if (request.method === 'PATCH' && pathname === '/api/settings/autostart') {
      const body = request.body as { readonly enabled?: boolean };
      const nextEnabled = body.enabled === true;
      const nextHostStatus: SettingsSnapshot['hostStatus'] = {
        ...this.state.settings.hostStatus,
        autostart: {
          ...this.state.settings.hostStatus.autostart,
          enabled: nextEnabled,
          installedAt: new Date().toISOString(),
        },
      };

      this.state.settings = {
        ...this.state.settings,
        hostStatus: nextHostStatus,
      };

      this.emit('settings.autostart.updated', nextHostStatus.autostart);
      return this.ok(nextHostStatus);
    }

    const personRolesMatch = matchParameterizedPath(pathname, '/api/people/:personId/roles');

    if (request.method === 'PUT' && personRolesMatch) {
      const body = request.body as { readonly globalRoles?: readonly PersonRole[] };
      const personIndex = this.state.people.findIndex((person) => person.personId === personRolesMatch.personId);

      if (personIndex < 0) {
        return this.error(404, `Demo person ${personRolesMatch.personId} not found.`);
      }

      const person = this.state.people[personIndex];
      const updatedPerson: Person = {
        ...person,
        globalRoles: [...(body.globalRoles ?? [])],
        updatedAt: new Date().toISOString(),
      };
      this.state.people.splice(personIndex, 1, updatedPerson);
      this.emit('people.roles.updated', updatedPerson);
      return this.ok(updatedPerson);
    }

    const groupOwnersMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/owners');

    if (request.method === 'PUT' && groupOwnersMatch) {
      const groupIndex = this.state.groups.findIndex((group) => group.groupJid === groupOwnersMatch.groupJid);

      if (groupIndex < 0) {
        return this.error(404, `Demo group ${groupOwnersMatch.groupJid} not found.`);
      }

      const body = request.body as { readonly owners?: readonly GroupOwnerAssignmentInput[] };
      const owners = (body.owners ?? []).map((owner) => ({
        personId: owner.personId,
        assignedAt: owner.assignedAt ?? new Date().toISOString(),
        assignedBy: owner.assignedBy ?? 'person-marta',
      }));
      this.state.groups[groupIndex] = {
        ...this.state.groups[groupIndex],
        groupOwners: owners,
      };
      this.emit('groups.owners.updated', {
        groupJid: groupOwnersMatch.groupJid,
        owners,
      });
      return this.ok(owners);
    }

    const groupAccessMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/calendar-access');
    const groupOperationalSettingsMatch = matchParameterizedPath(pathname, '/api/groups/:groupJid/operational-settings');
    const scheduleMatch = matchParameterizedPath(pathname, '/api/schedules/:eventId');
    const instructionRetryMatch = matchParameterizedPath(pathname, '/api/instruction-queue/:instructionId/retry');

    if (request.method === 'PATCH' && groupAccessMatch) {
      const groupIndex = this.state.groups.findIndex((group) => group.groupJid === groupAccessMatch.groupJid);

      if (groupIndex < 0) {
        return this.error(404, `Demo group ${groupAccessMatch.groupJid} not found.`);
      }

      const body = request.body as Partial<GroupCalendarAccessPolicy>;
      const nextPolicy: GroupCalendarAccessPolicy = {
        ...this.state.groups[groupIndex].calendarAccessPolicy,
        ...body,
      };
      this.state.groups[groupIndex] = {
        ...this.state.groups[groupIndex],
        calendarAccessPolicy: nextPolicy,
      };
      this.emit('groups.calendar_access.updated', {
        groupJid: groupAccessMatch.groupJid,
        calendarAccessPolicy: nextPolicy,
      });
      return this.ok(nextPolicy);
    }

    if (request.method === 'PATCH' && groupOperationalSettingsMatch) {
      const groupIndex = this.state.groups.findIndex((group) => group.groupJid === groupOperationalSettingsMatch.groupJid);

      if (groupIndex < 0) {
        return this.error(404, `Demo group ${groupOperationalSettingsMatch.groupJid} not found.`);
      }

      const body = request.body as Partial<GroupOperationalSettings>;
      const nextSettings = normaliseDemoGroupOperationalSettings({
        ...this.state.groups[groupIndex].operationalSettings,
        ...body,
      });
      this.state.groups[groupIndex] = {
        ...this.state.groups[groupIndex],
        operationalSettings: nextSettings,
      };
      this.emit('groups.operational_settings.updated', {
        groupJid: groupOperationalSettingsMatch.groupJid,
        operationalSettings: nextSettings,
      });
      return this.ok(nextSettings);
    }

    if (request.method === 'PATCH' && scheduleMatch) {
      const payload: Record<string, unknown> = {
        ...(request.body as Record<string, unknown>),
        eventId: scheduleMatch.eventId,
      };
      const groupJid =
        typeof payload.groupJid === 'string' && payload.groupJid.trim().length > 0
          ? payload.groupJid.trim()
          : this.state.groups[0]?.groupJid ?? '';
      const group = this.state.groups.find((candidate) => candidate.groupJid === groupJid) ?? null;
      const blockingReason = readDemoScheduleRouteBlockingReason(group, 'manual');

      if (blockingReason) {
        return this.error(400, blockingReason);
      }

      const schedule = upsertDemoSchedule(this.state, payload);
      this.emit('schedules.updated', {
        eventId: schedule.eventId,
        groupJid: schedule.groupJid,
        weekId: schedule.weekId,
      });
      return this.ok(schedule);
    }

    if (request.method === 'DELETE' && scheduleMatch) {
      const index = this.state.scheduleEvents.findIndex((event) => event.eventId === scheduleMatch.eventId);
      const deleted = index >= 0;

      if (deleted) {
        this.state.scheduleEvents.splice(index, 1);
      }

      this.emit('schedules.deleted', {
        eventId: scheduleMatch.eventId,
        deleted,
      });
      return this.ok({ deleted });
    }

    if (request.method === 'POST' && instructionRetryMatch) {
      const index = this.state.instructionQueue.findIndex(
        (instruction) => instruction.instructionId === instructionRetryMatch.instructionId,
      );

      if (index < 0) {
        return this.error(404, `Demo instruction ${instructionRetryMatch.instructionId} not found.`);
      }

      const instruction = this.state.instructionQueue[index];
      const retriedInstruction: Instruction = {
        ...instruction,
        status: 'queued',
        actions: instruction.actions.map((action) =>
          action.status === 'failed'
            ? {
                ...action,
                status: 'pending',
                lastError: null,
                result: null,
                completedAt: null,
              }
            : action,
        ),
        updatedAt: new Date().toISOString(),
      };
      this.state.instructionQueue.splice(index, 1, retriedInstruction);
      this.emit('instruction.retry.accepted', {
        instructionId: retriedInstruction.instructionId,
        status: retriedInstruction.status,
      });
      return this.ok(retriedInstruction);
    }

    if (request.method === 'POST' && pathname === '/api/send') {
      const payload = request.body as Record<string, unknown>;
      const sendResult = {
        messageId: `demo-send-${Date.now()}`,
        chatJid: String(payload.chatJid ?? ''),
        acceptedAt: new Date().toISOString(),
        ...(typeof payload.idempotencyKey === 'string' ? { idempotencyKey: payload.idempotencyKey } : {}),
      };
      this.emit('send.accepted', sendResult);
      return this.ok(sendResult);
    }

    return this.error(404, `Demo transport has no handler for ${request.method} ${pathname}.`);
  }

  subscribe(listener: (event: FrontendUiEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(topic: string, payload: unknown): void {
    const event: FrontendUiEvent = {
      eventId: `demo-${topic}-${Math.random().toString(16).slice(2)}`,
      topic,
      emittedAt: new Date().toISOString(),
      payload,
    };

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private ok<T>(body: unknown): FrontendApiResponse<T> {
    return {
      statusCode: 200,
      body: structuredClone(body) as T,
    };
  }

  private error<T>(statusCode: number, error: string): FrontendApiResponse<T> {
    return {
      statusCode,
      body: {
        error,
      } as T,
    };
  }
}

interface DemoState {
  groups: Group[];
  groupIntelligenceByGroupJid: Record<string, DemoGroupIntelligenceEntry>;
  mediaAssets: MediaAssetSnapshot[];
  workspaceFiles: WorkspaceFileContentSnapshot[];
  workspaceRuns: WorkspaceAgentRunSnapshot[];
  workspaceStatus: WorkspaceAgentStatusSnapshot;
  people: Person[];
  routingRules: SenderAudienceRule[];
  distributions: DistributionSummary[];
  instructionQueue: Instruction[];
  scheduleEvents: WeeklyPlannerEventSummary[];
  legacyScheduleFiles: LegacyScheduleImportFileSnapshot[];
  watchdogIssues: WatchdogIssue[];
  llmModels: readonly LlmModelDescriptor[];
  llmRuns: LlmRunLogEntry[];
  conversationAudit: ConversationAuditRecord[];
  alertMatches: MessageAlertMatchSnapshot[];
  automationRuns: AutomationRunSnapshot[];
  readonly externalPrivateConversations: readonly WhatsAppConversationSummary[];
  settings: SettingsSnapshot;
}

interface DemoGroupIntelligenceEntry {
  readonly instructions: string;
  readonly knowledgeDocuments: GroupKnowledgeDocumentSnapshot[];
  readonly reminderPolicy: GroupReminderPolicySnapshot;
}

function createDemoState(): DemoState {
  const now = new Date();
  const iso = (minutesOffset = 0) => new Date(now.getTime() + minutesOffset * 60_000).toISOString();

  const groups: Group[] = [
    {
      groupJid: '120363407086801381@g.us',
      preferredSubject: 'Ballet Iniciacao',
      aliases: ['Ballet Basico'],
      courseId: 'ballet-init',
      groupOwners: [{ personId: 'person-ana', assignedAt: iso(-1_200), assignedBy: 'person-marta' }],
      calendarAccessPolicy: { group: 'read', groupOwner: 'read_write', appOwner: 'read_write' },
      operationalSettings: DEFAULT_DEMO_GROUP_OPERATIONAL_SETTINGS,
      lastRefreshedAt: iso(-18),
    },
    {
      groupJid: '120363407086801382@g.us',
      preferredSubject: 'Contemporaneo Jovens',
      aliases: ['Contemporaneo'],
      courseId: 'contemp-jovens',
      groupOwners: [{ personId: 'person-tiago', assignedAt: iso(-980), assignedBy: 'person-marta' }],
      calendarAccessPolicy: { group: 'read', groupOwner: 'read_write', appOwner: 'read_write' },
      operationalSettings: DEFAULT_DEMO_GROUP_OPERATIONAL_SETTINGS,
      lastRefreshedAt: iso(-14),
    },
    {
      groupJid: '120363407086801383@g.us',
      preferredSubject: 'Pilates Adultos',
      aliases: ['Pilates 18h'],
      courseId: 'pilates-adultos',
      groupOwners: [{ personId: 'person-lucia', assignedAt: iso(-720), assignedBy: 'person-marta' }],
      calendarAccessPolicy: { group: 'read', groupOwner: 'read_write', appOwner: 'read_write' },
      operationalSettings: {
        mode: 'distribuicao_apenas',
        schedulingEnabled: false,
        allowLlmScheduling: false,
        memberTagPolicy: 'owner_only',
      },
      lastRefreshedAt: iso(-22),
    },
    {
      groupJid: '120363407086801384@g.us',
      preferredSubject: 'Barra de Chao',
      aliases: ['Barra'],
      courseId: 'barra-chao',
      groupOwners: [],
      calendarAccessPolicy: { group: 'read', groupOwner: 'read_write', appOwner: 'read_write' },
      operationalSettings: DEFAULT_DEMO_GROUP_OPERATIONAL_SETTINGS,
      lastRefreshedAt: iso(-35),
    },
    {
      groupJid: '120363407086801385@g.us',
      preferredSubject: 'Jazz Teens',
      aliases: ['Jazz'],
      courseId: 'jazz-teens',
      groupOwners: [{ personId: 'person-rita', assignedAt: iso(-630), assignedBy: 'person-marta' }],
      calendarAccessPolicy: { group: 'read', groupOwner: 'read_write', appOwner: 'read_write' },
      operationalSettings: DEFAULT_DEMO_GROUP_OPERATIONAL_SETTINGS,
      lastRefreshedAt: iso(-9),
    },
    {
      groupJid: '120363407086801386@g.us',
      preferredSubject: 'Teatro Musical',
      aliases: ['Musical'],
      courseId: 'teatro-musical',
      groupOwners: [{ personId: 'person-joao', assignedAt: iso(-580), assignedBy: 'person-marta' }],
      calendarAccessPolicy: { group: 'read', groupOwner: 'read_write', appOwner: 'read_write' },
      operationalSettings: DEFAULT_DEMO_GROUP_OPERATIONAL_SETTINGS,
      lastRefreshedAt: iso(-27),
    },
  ];

  const routingRules: SenderAudienceRule[] = [
    {
      ruleId: 'rule-ana-ballet',
      personId: 'person-ana',
      identifiers: [{ kind: 'whatsapp_jid', value: '351910000001@s.whatsapp.net' }],
      targetGroupJids: [groups[0].groupJid, groups[1].groupJid],
      targetCourseIds: [],
      targetDisciplineCodes: ['BALLET'],
      enabled: true,
      requiresConfirmation: true,
      notes: 'Distribui avisos para iniciacao e contemporaneo.',
      createdAt: iso(-4_000),
      updatedAt: iso(-240),
    },
    {
      ruleId: 'rule-lucia-pilates',
      personId: 'person-lucia',
      identifiers: [{ kind: 'whatsapp_jid', value: '351910000002@s.whatsapp.net' }],
      targetGroupJids: [groups[2].groupJid],
      targetCourseIds: ['pilates-adultos'],
      targetDisciplineCodes: ['PILATES'],
      enabled: true,
      requiresConfirmation: false,
      notes: 'Rotina de distribuicao direta para aulas de pilates.',
      createdAt: iso(-3_400),
      updatedAt: iso(-95),
    },
    {
      ruleId: 'rule-rita-jazz',
      personId: 'person-rita',
      identifiers: [{ kind: 'whatsapp_jid', value: '351910000003@s.whatsapp.net' }],
      targetGroupJids: [groups[4].groupJid, groups[5].groupJid],
      targetCourseIds: ['jazz-teens'],
      targetDisciplineCodes: ['JAZZ', 'MUSICAL'],
      enabled: true,
      requiresConfirmation: true,
      notes: 'Usada para comunicados de ensaios e ajustes de horario.',
      createdAt: iso(-2_900),
      updatedAt: iso(-65),
    },
  ];

  const distributions: DistributionSummary[] = [
    {
      instructionId: 'instruction-20260327-001',
      sourceType: 'incoming_message',
      sourceMessageId: 'wamid.demo.001',
      mode: 'confirmed',
      status: 'completed',
      targetGroupJids: [groups[0].groupJid, groups[1].groupJid],
      actionCounts: {
        pending: 0,
        running: 0,
        completed: 2,
        failed: 0,
        skipped: 0,
      },
      createdAt: iso(-160),
      updatedAt: iso(-150),
    },
    {
      instructionId: 'instruction-20260327-002',
      sourceType: 'incoming_message',
      sourceMessageId: 'wamid.demo.002',
      mode: 'confirmed',
      status: 'running',
      targetGroupJids: [groups[2].groupJid],
      actionCounts: {
        pending: 0,
        running: 1,
        completed: 0,
        failed: 0,
        skipped: 0,
      },
      createdAt: iso(-48),
      updatedAt: iso(-8),
    },
    {
      instructionId: 'instruction-20260327-003',
      sourceType: 'manual_distribution',
      sourceMessageId: null,
      mode: 'dry_run',
      status: 'queued',
      targetGroupJids: [groups[4].groupJid, groups[5].groupJid],
      actionCounts: {
        pending: 2,
        running: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      },
      createdAt: iso(-22),
      updatedAt: iso(-22),
    },
    {
      instructionId: 'instruction-20260327-004',
      sourceType: 'incoming_message',
      sourceMessageId: 'wamid.demo.004',
      mode: 'confirmed',
      status: 'partial_failed',
      targetGroupJids: [groups[0].groupJid, groups[3].groupJid],
      actionCounts: {
        pending: 0,
        running: 0,
        completed: 1,
        failed: 1,
        skipped: 0,
      },
      createdAt: iso(-90),
      updatedAt: iso(-66),
    },
  ];

  const watchdogIssues: WatchdogIssue[] = [
    {
      issueId: 'issue-overdue-001',
      kind: 'job_overdue',
      jobId: 'job-ballet-001',
      weekId: '2026-W13',
      groupJid: groups[0].groupJid,
      groupLabel: groups[0].preferredSubject,
      openedAt: iso(-42),
      status: 'open',
      summary: 'Aviso importante ultrapassou a hora prevista sem confirmacao.',
      resolvedAt: null,
    },
    {
      issueId: 'issue-confirmation-002',
      kind: 'waiting_confirmation_timeout',
      jobId: 'job-pilates-007',
      weekId: '2026-W13',
      groupJid: groups[2].groupJid,
      groupLabel: groups[2].preferredSubject,
      openedAt: iso(-130),
      status: 'open',
      summary: 'Mensagem observada mas sem confirmacao forte dentro da janela esperada.',
      resolvedAt: null,
    },
  ];

  const demoAlertRules: readonly MessageAlertRule[] = [
    {
      ruleId: 'alert-group-ajuda',
      enabled: true,
      label: 'Pedido de ajuda no grupo',
      scope: { type: 'group', groupJid: groups[0].groupJid },
      match: { type: 'includes', value: 'ajuda', caseInsensitive: true },
      actions: [{ type: 'log' }],
    },
    {
      ruleId: 'alert-chat-urgente',
      enabled: true,
      label: 'Urgente em privado',
      scope: { type: 'chat', chatJid: '351910000004@s.whatsapp.net' },
      match: { type: 'regex', pattern: '\\burgente\\b' },
      actions: [{ type: 'webhook', url: 'https://example.invalid/hooks/alerts', method: 'POST' }],
    },
  ];

  const demoAutomationDefinitions: readonly AutomationDefinition[] = [
    {
      automationId: `${groups[0].groupJid}:warmup-reminder`,
      entryId: 'warmup-reminder',
      enabled: true,
      groupJid: groups[0].groupJid,
      groupLabel: groups[0].preferredSubject,
      schedule: { type: 'weekly', daysOfWeek: ['mon', 'wed'], time: '17:00' },
      notifyBeforeMinutes: [60, 15],
      messageTemplate: 'Lembrar aquecimento para {{group}} dentro de {{minutesLeft}} min.',
      actions: [{ type: 'wa_send' }, { type: 'log' }],
      importedFrom: '/home/eliaspc/Containers/wa-notify/data/automations.json',
    },
    {
      automationId: `${groups[2].groupJid}:pilates-checkin`,
      entryId: 'pilates-checkin',
      enabled: true,
      groupJid: groups[2].groupJid,
      groupLabel: groups[2].preferredSubject,
      schedule: { type: 'weekly', daysOfWeek: ['tue', 'thu'], time: '18:00' },
      notifyBeforeMinutes: [30],
      messageTemplate: 'Check-in rapido de {{group}} em {{minutesLeft}} min.',
      actions: [{ type: 'webhook', url: 'https://example.invalid/hooks/automations', method: 'POST' }],
      importedFrom: '/home/eliaspc/Containers/wa-notify/data/automations.json',
    },
  ];

  const alertMatches: MessageAlertMatchSnapshot[] = [
    {
      matchId: 'alert-group-ajuda:wamid.demo.alert.1',
      ruleId: 'alert-group-ajuda',
      chatJid: groups[0].groupJid,
      participantJid: '351910000001@s.whatsapp.net',
      groupJid: groups[0].groupJid,
      text: 'Preciso de ajuda com a Aula 1.',
      matchedAt: iso(-32),
      actionTypes: ['log'],
      webhookDeliveries: 0,
    },
    {
      matchId: 'alert-chat-urgente:wamid.demo.alert.2',
      ruleId: 'alert-chat-urgente',
      chatJid: '351910000004@s.whatsapp.net',
      participantJid: '351910000004@s.whatsapp.net',
      groupJid: null,
      text: 'Isto e urgente, liga-me assim que puderes.',
      matchedAt: iso(-11),
      actionTypes: ['webhook'],
      webhookDeliveries: 1,
    },
  ];

  const automationRuns: AutomationRunSnapshot[] = [
    {
      runId: `${groups[0].groupJid}:warmup-reminder:${iso(-70)}:60`,
      automationId: `${groups[0].groupJid}:warmup-reminder`,
      entryId: 'warmup-reminder',
      groupJid: groups[0].groupJid,
      groupLabel: groups[0].preferredSubject,
      offsetMinutes: 60,
      scheduledFor: iso(-10),
      firedAt: iso(-70),
      text: 'Lembrar aquecimento para Ballet Iniciacao dentro de 60 min.',
      actionTypes: ['wa_send', 'log'],
      waMessageId: 'wamid.demo.automation.1',
      webhookDeliveries: 0,
      status: 'executed',
      error: null,
    },
    {
      runId: `${groups[2].groupJid}:pilates-checkin:${iso(-45)}:30`,
      automationId: `${groups[2].groupJid}:pilates-checkin`,
      entryId: 'pilates-checkin',
      groupJid: groups[2].groupJid,
      groupLabel: groups[2].preferredSubject,
      offsetMinutes: 30,
      scheduledFor: iso(-15),
      firedAt: iso(-45),
      text: 'Check-in rapido de Pilates Adultos em 30 min.',
      actionTypes: ['webhook'],
      waMessageId: null,
      webhookDeliveries: 1,
      status: 'executed',
      error: null,
    },
  ];

  const demoAdminSettings: SettingsSnapshot['adminSettings'] = {
    ...DEFAULT_ADMIN_SETTINGS,
    llm: {
      enabled: true,
      provider: 'codex-oauth',
      model: 'gpt-5.4',
      streamingEnabled: true,
    },
    alerts: {
      enabled: true,
      rules: demoAlertRules,
    },
    automations: {
      enabled: true,
      fireWindowMinutes: 5,
      definitions: demoAutomationDefinitions,
    },
    updatedAt: iso(-110),
  };
  const demoAuthRouterStatus: SettingsSnapshot['authRouterStatus'] = {
    schemaVersion: 1,
    enabled: true,
    canonicalAuthFilePath: '/home/eliaspc/.codex/auth.json',
    canonicalExists: true,
    stateFilePath: '/home/eliaspc/.local/state/lume-hub/codex-auth-router.json',
    backupDirectoryPath: '/home/eliaspc/.local/state/lume-hub/codex-auth-backups',
    currentSelection: {
      accountId: 'acct-main',
      label: 'Token principal',
      sourceFilePath: '/home/eliaspc/.codex/auth.json',
      canonicalAuthFilePath: '/home/eliaspc/.codex/auth.json',
      selectedAt: iso(-510),
      switchPerformed: false,
      backupFilePath: null,
      reason: 'preview_bootstrap',
      contentHash: 'demo-hash-main',
    },
    accounts: [
      {
        accountId: 'acct-main',
        label: 'Token principal',
        sourceFilePath: '/home/eliaspc/.codex/auth.json',
        priority: 100,
        kind: 'canonical_live',
        exists: true,
        contentHash: 'demo-hash-main',
        bytes: 1_824,
        lastModifiedAt: iso(-180),
        usage: {
          successCount: 38,
          failureCount: 2,
          consecutiveFailures: 0,
          lastSuccessAt: iso(-16),
          lastFailureAt: iso(-980),
          lastFailureKind: 'quota',
          lastFailureReason: 'Limite temporario do provider.',
          cooldownUntil: null,
        },
        quota: {
          checkedAt: iso(-20),
          allowed: true,
          limitReached: false,
          planType: 'plus',
          credits: {
            hasCredits: false,
            unlimited: false,
            balance: null,
            approxLocalMessages: [],
            approxCloudMessages: [],
          },
          primaryWindow: {
            windowSeconds: 18_000,
            usedPercent: 38,
            remainingPercent: 62,
            resetAfterSeconds: 7_200,
            resetAt: iso(7_200),
          },
          secondaryWindow: {
            windowSeconds: 604_800,
            usedPercent: 42,
            remainingPercent: 58,
            resetAfterSeconds: 86_400,
            resetAt: iso(86_400),
          },
          fetchError: null,
        },
      },
      {
        accountId: 'acct-backup',
        label: 'Token reserva A',
        sourceFilePath: '/home/eliaspc/.codex/auth-reserva-a.json',
        priority: 80,
        kind: 'secondary',
        exists: true,
        contentHash: 'demo-hash-secondary',
        bytes: 1_790,
        lastModifiedAt: iso(-320),
        usage: {
          successCount: 11,
          failureCount: 1,
          consecutiveFailures: 0,
          lastSuccessAt: iso(-430),
          lastFailureAt: iso(-1_800),
          lastFailureKind: 'network',
          lastFailureReason: 'Timeout breve durante troca de conta.',
          cooldownUntil: null,
        },
        quota: {
          checkedAt: iso(-25),
          allowed: true,
          limitReached: false,
          planType: 'plus',
          credits: {
            hasCredits: true,
            unlimited: false,
            balance: null,
            approxLocalMessages: [24],
            approxCloudMessages: [18],
          },
          primaryWindow: {
            windowSeconds: 18_000,
            usedPercent: 14,
            remainingPercent: 86,
            resetAfterSeconds: 9_600,
            resetAt: iso(9_600),
          },
          secondaryWindow: {
            windowSeconds: 604_800,
            usedPercent: 25,
            remainingPercent: 75,
            resetAfterSeconds: 172_800,
            resetAt: iso(172_800),
          },
          fetchError: null,
        },
      },
      {
        accountId: 'acct-backup-2',
        label: 'Token reserva B',
        sourceFilePath: '/home/eliaspc/.codex/auth-reserva-b.json',
        priority: 60,
        kind: 'secondary',
        exists: true,
        contentHash: 'demo-hash-tertiary',
        bytes: 1_764,
        lastModifiedAt: iso(-420),
        usage: {
          successCount: 7,
          failureCount: 2,
          consecutiveFailures: 1,
          lastSuccessAt: iso(-860),
          lastFailureAt: iso(-190),
          lastFailureKind: 'quota',
          lastFailureReason: 'Em pausa curta por limite temporario do provider.',
          cooldownUntil: iso(35),
        },
        quota: {
          checkedAt: iso(-40),
          allowed: false,
          limitReached: true,
          planType: 'plus',
          credits: {
            hasCredits: false,
            unlimited: false,
            balance: null,
            approxLocalMessages: [],
            approxCloudMessages: [],
          },
          primaryWindow: {
            windowSeconds: 18_000,
            usedPercent: 100,
            remainingPercent: 0,
            resetAfterSeconds: 1_800,
            resetAt: iso(1_800),
          },
          secondaryWindow: {
            windowSeconds: 604_800,
            usedPercent: 82,
            remainingPercent: 18,
            resetAfterSeconds: 86_400,
            resetAt: iso(86_400),
          },
          fetchError: null,
        },
      },
    ],
    switchHistory: [],
    lastPreparedAt: iso(-12),
    lastSwitchAt: iso(-510),
    lastError: null,
    accountCount: 3,
  };

  const settings: SettingsSnapshot = {
    adminSettings: demoAdminSettings,
    llmRuntime: createDemoLlmRuntimeStatus(demoAdminSettings, demoAuthRouterStatus),
    powerStatus: {
      policy: {
        schemaVersion: 1,
        enabled: true,
        mode: 'on_demand',
        preferredReasons: ['whatsapp_connected', 'pending_jobs', 'watchdog_issue'],
        updatedAt: iso(-360),
      },
      activeLease: {
        leaseId: 'lease-preview-001',
        reasons: ['whatsapp_connected', 'pending_jobs'],
        explanation: 'O host fica acordado porque ha ligacao WhatsApp e entregas pendentes.',
        acquiredAt: iso(-50),
        releasedAt: null,
      },
      desiredState: 'inhibited',
      inhibitorActive: true,
      inhibitorStatePath: '/tmp/lumehub-demo-power-state.json',
      reasons: ['whatsapp_connected', 'pending_jobs'],
      explanation: 'O sistema manteve o PC acordado para evitar atrasos nas entregas.',
      updatedAt: iso(-5),
    },
    hostStatus: {
      schemaVersion: 1,
      hostId: 'host-kubuntu-demo',
      auth: {
        filePath: '/home/eliaspc/.codex/auth.json',
        exists: true,
        sameAsCodexCanonical: true,
      },
      autostart: {
        enabled: true,
        serviceName: 'lume-hub-host.service',
        manifestPath: '/home/eliaspc/.config/systemd/user/lume-hub-host.service',
        workingDirectory: '/home/eliaspc/Documentos/lume-hub/runtime/host/current',
        execStart: '/opt/node-v20.20.1-linux-x64/bin/node ./dist/main.js',
        installedAt: iso(-1_440),
      },
      runtime: {
        stateFilePath: '/home/eliaspc/.local/state/lume-hub/host-status.json',
        backendStateFilePath: '/home/eliaspc/.local/state/lume-hub/backend-status.json',
        lastRepairAt: iso(-360),
        lastHeartbeatAt: iso(-2),
        updatedAt: iso(-2),
        lastError: null,
      },
      power: {
        policyMode: 'on_demand',
        inhibitorActive: true,
        leaseId: 'lease-preview-001',
        explanation: 'Sem risco de suspensão enquanto o sistema estiver ativo.',
      },
      authRouter: {
        canonicalAuthFilePath: '/home/eliaspc/.codex/auth.json',
        currentAccountId: 'acct-main',
        currentSourceFilePath: '/home/eliaspc/.codex/auth.json',
        accountCount: 2,
        lastSwitchAt: iso(-510),
      },
    },
    authRouterStatus: demoAuthRouterStatus,
  };

  const scheduleEvents: WeeklyPlannerEventSummary[] = [
    {
      eventId: 'event-ballet-001',
      weekId: '2026-W13',
      groupJid: groups[0].groupJid,
      groupLabel: groups[0].preferredSubject,
      title: 'Aula regular de sexta',
      eventAt: iso(60 * 24),
      localDate: '2026-03-27',
      dayLabel: 'sexta-feira',
      startTime: '18:30',
      durationMinutes: 60,
      notes: 'Levar musica e confirmar sala 2.',
      notificationRuleLabels: ['24h antes', '30 min antes'],
      notifications: {
        pending: 1,
        waitingConfirmation: 1,
        sent: 0,
        total: 2,
      },
      nextReminderAt: iso(0),
      nextReminderLabel: '24h antes',
      reminderLifecycle: {
        generated: 2,
        prepared: 1,
        sent: 0,
      },
    },
    {
      eventId: 'event-pilates-001',
      weekId: '2026-W13',
      groupJid: groups[2].groupJid,
      groupLabel: groups[2].preferredSubject,
      title: 'Pilates reforco',
      eventAt: iso(60 * 48),
      localDate: '2026-03-28',
      dayLabel: 'sabado',
      startTime: '10:00',
      durationMinutes: 75,
      notes: 'Reforcar material de apoio e confirmar presencas.',
      notificationRuleLabels: ['24h antes'],
      notifications: {
        pending: 1,
        waitingConfirmation: 0,
        sent: 1,
        total: 2,
      },
      nextReminderAt: iso(60 * 24),
      nextReminderLabel: '24h antes',
      reminderLifecycle: {
        generated: 1,
        prepared: 0,
        sent: 1,
      },
    },
  ];

  const legacyScheduleFiles: LegacyScheduleImportFileSnapshot[] = [
    {
      fileName: 'w14y2026.json',
      absolutePath: '/home/eliaspc/Containers/wa-notify/data/schedules/w14y2026.json',
      legacyWeekId: 'w14y2026',
      isoWeekId: '2026-W14',
      weekStart: '2026-03-30',
      weekEnd: '2026-04-05',
      itemCount: 10,
      baseEventCount: 5,
      groupJids: [groups[0].groupJid, groups[2].groupJid],
    },
  ];

  const instructionQueue = distributions.map((distribution, index): Instruction => ({
    instructionId: distribution.instructionId,
    sourceType: distribution.sourceType,
    sourceMessageId: distribution.sourceMessageId,
    mode: distribution.mode,
    status: distribution.status,
    metadata: {
      preview: 'demo',
      order: index + 1,
    },
    actions: distribution.targetGroupJids.map((groupJid, actionIndex) => ({
      actionId: `${distribution.instructionId}-action-${actionIndex + 1}`,
      type: 'distribution_delivery',
      dedupeKey: `${distribution.sourceMessageId ?? distribution.instructionId}:${groupJid}`,
      targetGroupJid: groupJid,
      payload: {
        targetGroupJid: groupJid,
      },
      status:
        distribution.status === 'queued'
          ? 'pending'
          : distribution.status === 'running'
            ? 'running'
            : distribution.status === 'partial_failed' && actionIndex === distribution.targetGroupJids.length - 1
              ? 'failed'
              : 'completed',
      attemptCount: distribution.status === 'queued' ? 0 : 1,
      lastError:
        distribution.status === 'partial_failed' && actionIndex === distribution.targetGroupJids.length - 1
          ? 'falha simulada de entrega'
          : null,
      result:
        distribution.status === 'queued'
          ? null
          : {
              note: distribution.mode === 'dry_run' ? 'dry-run' : 'demo-send',
              externalMessageId: distribution.sourceMessageId,
              metadata: {},
            },
      lastAttemptAt: distribution.updatedAt,
      completedAt: distribution.status === 'queued' || distribution.status === 'running' ? null : distribution.updatedAt,
    })),
    createdAt: distribution.createdAt,
    updatedAt: distribution.updatedAt,
  }));

  const llmModels: readonly LlmModelDescriptor[] = [
    {
      providerId: 'codex-oauth',
      modelId: 'gpt-5.4',
      label: 'Codex GPT-5.4',
      capabilities: {
        chat: true,
        scheduling: true,
        weeklyPlanning: true,
        streaming: true,
      },
    },
    {
      providerId: 'openai-compat',
      modelId: 'gpt-4o-mini',
      label: 'OpenAI compat GPT-4o mini',
      capabilities: {
        chat: true,
        scheduling: true,
        weeklyPlanning: false,
        streaming: true,
      },
    },
  ];

  const llmRuns: LlmRunLogEntry[] = [
    {
      runId: 'run-demo-001',
      operation: 'chat',
      providerId: 'codex-oauth',
      modelId: 'gpt-5.4',
      inputSummary: 'pedido de resumo para turma',
      outputSummary: 'resposta curta preparada para o operador',
      memoryScope: {
        scope: 'group',
        groupJid: groups[0].groupJid,
        groupLabel: groups[0].preferredSubject,
        instructionsSource: 'llm_instructions',
        instructionsApplied: true,
        knowledgeSnippetCount: 1,
        knowledgeDocuments: [
          {
            documentId: 'aula-1-ballet',
            title: 'Aula 1 de Ballet',
            filePath: 'aulas/aula-1.md',
            score: 0.92,
            matchedTerms: ['aula 1'],
          },
        ],
      },
      createdAt: iso(-14),
    },
    {
      runId: 'run-demo-002',
      operation: 'plan_weekly_prompts',
      providerId: 'codex-oauth',
      modelId: 'gpt-5.4',
      inputSummary: 'planeamento semanal com 2 eventos',
      outputSummary: '3 prompts sugeridos para esta semana',
      memoryScope: {
        scope: 'none',
        groupJid: null,
        groupLabel: null,
        instructionsSource: null,
        instructionsApplied: false,
        knowledgeSnippetCount: 0,
        knowledgeDocuments: [],
      },
      createdAt: iso(-55),
    },
  ];

  const conversationAudit: ConversationAuditRecord[] = [
    {
      auditId: 'audit-demo-001',
      messageId: 'wamid.demo.private.001',
      chatJid: '351910000001@s.whatsapp.net',
      chatType: 'private',
      personId: 'person-ana',
      intent: 'casual_chat',
      selectedTools: ['chat_reply'],
      replyMode: 'private',
      replyText: 'Resposta demo preparada para a operadora.',
      targetChatType: 'private',
      targetChatJid: '351910000001@s.whatsapp.net',
      memoryUsage: {
        scope: 'group',
        groupJid: groups[0].groupJid,
        groupLabel: groups[0].preferredSubject,
        instructionsSource: 'llm_instructions',
        instructionsApplied: true,
        knowledgeSnippetCount: 1,
        knowledgeDocuments: [
          {
            documentId: 'aula-1-ballet',
            title: 'Aula 1 de Ballet',
            filePath: 'aulas/aula-1.md',
          },
        ],
      },
      schedulingInsight: null,
      permissionInsight: {
        allowed: true,
        actorRole: 'member',
        chatType: 'private',
        groupJid: null,
        interactionPolicy: null,
        reasonCode: 'private_chat_authorized',
        summary: 'Este contacto pode falar com o assistente em privado.',
      },
      createdAt: iso(-16),
    },
    {
      auditId: 'audit-demo-002',
      messageId: 'wamid.demo.group.002',
      chatJid: groups[0].groupJid,
      chatType: 'group',
      personId: 'person-ana',
      intent: 'scheduling_request',
      selectedTools: ['schedule_parse', 'chat_reply'],
      replyMode: 'private',
      replyText: 'Mudei para privado para evitar ruido no grupo.',
      targetChatType: 'private',
      targetChatJid: '351910000001@s.whatsapp.net',
      memoryUsage: {
        scope: 'group',
        groupJid: groups[0].groupJid,
        groupLabel: groups[0].preferredSubject,
        instructionsSource: 'llm_instructions',
        instructionsApplied: true,
        knowledgeSnippetCount: 1,
        knowledgeDocuments: [
          {
            documentId: 'aula-1-ballet',
            title: 'Aula 1 de Ballet',
            filePath: 'aulas/aula-1.md',
          },
        ],
      },
      schedulingInsight: {
        requestedAccessMode: 'read',
        resolvedGroupJids: [groups[0].groupJid],
        memoryScope: 'group',
        memoryGroupJid: groups[0].groupJid,
        memoryGroupLabel: groups[0].preferredSubject,
      },
      permissionInsight: {
        allowed: false,
        actorRole: 'member',
        chatType: 'group',
        groupJid: groups[0].groupJid,
        interactionPolicy: 'owner_only',
        reasonCode: 'group_member_blocked_by_owner_policy',
        summary: 'Este grupo reserva o bot ao owner; membros nao podem dirigi-lo por tag.',
      },
      createdAt: iso(-44),
    },
  ];

  const workspaceFiles: WorkspaceFileContentSnapshot[] = [
    createDemoWorkspaceFile('README.md', '# LumeHub\n\nProjeto live para operar WhatsApp, agendamentos e assistente.\n'),
    createDemoWorkspaceFile(
      'source/apps/lume-hub-web/src/shell/AppShell.ts',
      [
        'export class AppShell {',
        '  // Demo do editor agentic do projeto.',
        '  mount(root: HTMLElement): void {',
        '    root.dataset.demo = "workspace";',
        '  }',
        '}',
        '',
      ].join('\n'),
    ),
    createDemoWorkspaceFile(
      'source/packages/modules/workspace-agent/src/application/services/WorkspaceAgentService.ts',
      [
        'export class WorkspaceAgentService {',
        '  async run() {',
        "    return 'demo';",
        '  }',
        '}',
        '',
      ].join('\n'),
    ),
    createDemoWorkspaceFile(
      'docs/architecture/lume_hub_implementation_waves.md',
      [
        '# Lume Hub Implementation Waves',
        '',
        '### Wave 39 - Interface agentic do projeto',
        '- pagina nova',
        '- API real',
        '- historico de runs',
        '',
      ].join('\n'),
    ),
  ];

  const workspaceRuns: WorkspaceAgentRunSnapshot[] = [
    {
      runId: 'workspace-demo-run-002',
      mode: 'apply',
      prompt: 'Ajusta a copy do hero da homepage e melhora o CTA principal.',
      filePaths: ['source/apps/lume-hub-web/src/shell/AppShell.ts'],
      requestedBy: 'workspace-ui',
      approvalState: 'confirmed',
      executionState: 'executed',
      startedAt: iso(-40),
      completedAt: iso(-38),
      status: 'completed',
      outputSummary: 'Atualizei a hero da homepage e o CTA principal.',
      guardrailReason: null,
      stdout: 'Atualizei o hero e o CTA na homepage.',
      stderr: '',
      exitCode: 0,
      timedOut: false,
      changedFiles: ['source/apps/lume-hub-web/src/shell/AppShell.ts'],
      structuredSummary: {
        summary: 'Atualizei a hero da homepage e o CTA principal.',
        suggestedFiles: ['source/apps/lume-hub-web/src/shell/AppShell.ts'],
        readFiles: ['source/apps/lume-hub-web/src/shell/AppShell.ts', 'README.md'],
        notes: ['A copy do hero ficou mais curta.'],
      },
      fileDiffs: [
        {
          relativePath: 'source/apps/lume-hub-web/src/shell/AppShell.ts',
          changeType: 'modified',
          beforeStatus: null,
          afterStatus: ' M',
          diffText: [
            'diff --git a/source/apps/lume-hub-web/src/shell/AppShell.ts b/source/apps/lume-hub-web/src/shell/AppShell.ts',
            '--- a/source/apps/lume-hub-web/src/shell/AppShell.ts',
            '+++ b/source/apps/lume-hub-web/src/shell/AppShell.ts',
            '@@',
            "-  <h2>Pedir a uma LLM para ler o repo, escolher ficheiros e alterar codigo do LumeHub.</h2>",
            "+  <h2>Pedir a uma LLM para rever o repo e ajustar o LumeHub com contexto guiado.</h2>",
          ].join('\n'),
        },
      ],
    },
    {
      runId: 'workspace-demo-run-001',
      mode: 'plan',
      prompt: 'Mapeia o que precisas de mexer para introduzir uma pagina nova no frontend.',
      filePaths: ['source/apps/lume-hub-web/src/app/AppRouter.ts', 'source/apps/lume-hub-web/src/shell/AppShell.ts'],
      requestedBy: 'workspace-ui',
      approvalState: 'not_required',
      executionState: 'executed',
      startedAt: iso(-92),
      completedAt: iso(-90),
      status: 'completed',
      outputSummary: 'Plano curto gerado para frontend, API e validacao.',
      guardrailReason: null,
      stdout: 'Plano: AppRouter, AppShell, frontend-api-client, validacao final.',
      stderr: '',
      exitCode: 0,
      timedOut: false,
      changedFiles: [],
      structuredSummary: {
        summary: 'Plano curto gerado para frontend, API e validacao.',
        suggestedFiles: [
          'source/apps/lume-hub-web/src/app/AppRouter.ts',
          'source/apps/lume-hub-web/src/shell/AppShell.ts',
        ],
        readFiles: [
          'source/apps/lume-hub-web/src/app/AppRouter.ts',
          'source/apps/lume-hub-web/src/shell/AppShell.ts',
          'source/packages/adapters/frontend-api-client/src/public/index.ts',
        ],
        notes: ['Comecar pela UI e so depois alinhar o backend.'],
      },
      fileDiffs: [],
    },
  ];

  const workspaceStatus: WorkspaceAgentStatusSnapshot = {
    busy: false,
    activeRunId: null,
    activeMode: null,
    activePromptSummary: null,
    activeStartedAt: null,
    lastCompletedAt: workspaceRuns[0]?.completedAt ?? null,
    lastRejectedAt: null,
    lastRejectedReason: null,
    requiresApplyConfirmation: true,
    maxFocusedFiles: 12,
  };

  const mediaAssets: MediaAssetSnapshot[] = [
    {
      assetId: '9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1001',
      mediaType: 'video',
      mimeType: 'video/mp4',
      sha256: '9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1001',
      fileSize: 18_452_221,
      sourceChatJid: groups[0]!.groupJid,
      sourceMessageId: 'wamid.demo.media.0001',
      caption: 'Video de demonstracao para a aula de sexta.',
      storedAt: iso(-12),
      assetRootPath: '/demo/runtime/media/assets/9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1001',
      binaryPath: '/demo/runtime/media/assets/9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1001/binary',
      metadataPath: '/demo/runtime/media/assets/9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1001/metadata.json',
      exists: true,
      retentionPolicy: {
        mode: 'manual',
        deleteAfterDays: null,
        description: 'Demo sem expiracao automatica.',
      },
    },
    {
      assetId: '9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1002',
      mediaType: 'document',
      mimeType: 'application/pdf',
      sha256: '9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1002',
      fileSize: 284_112,
      sourceChatJid: '351910000001@s.whatsapp.net',
      sourceMessageId: 'wamid.demo.media.0002',
      caption: 'Plano da apresentacao final.',
      storedAt: iso(-95),
      assetRootPath: '/demo/runtime/media/assets/9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1002',
      binaryPath: '/demo/runtime/media/assets/9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1002/binary',
      metadataPath: '/demo/runtime/media/assets/9f8b36b6c4b55f3d3d0830f6e4c85e90fa41cf0c33de5f6d6f1c73a9d0ec1002/metadata.json',
      exists: true,
      retentionPolicy: {
        mode: 'manual',
        deleteAfterDays: null,
        description: 'Demo sem expiracao automatica.',
      },
    },
  ];

  const groupIntelligenceByGroupJid = createDemoGroupIntelligence(groups);

  return {
    groups,
    groupIntelligenceByGroupJid,
    mediaAssets,
    workspaceFiles,
    workspaceRuns,
    workspaceStatus,
    people: [
      {
        personId: 'person-ana',
        displayName: 'Ana Costa',
        identifiers: [{ kind: 'whatsapp_jid', value: '351910000001@s.whatsapp.net' }],
        globalRoles: ['member'],
        createdAt: iso(-4_300),
        updatedAt: iso(-240),
      },
      {
        personId: 'person-lucia',
        displayName: 'Lucia Matos',
        identifiers: [{ kind: 'whatsapp_jid', value: '351910000002@s.whatsapp.net' }],
        globalRoles: ['member'],
        createdAt: iso(-4_000),
        updatedAt: iso(-95),
      },
      {
        personId: 'person-rita',
        displayName: 'Rita Gomes',
        identifiers: [{ kind: 'whatsapp_jid', value: '351910000003@s.whatsapp.net' }],
        globalRoles: ['member'],
        createdAt: iso(-3_600),
        updatedAt: iso(-65),
      },
      {
        personId: 'person-marta',
        displayName: 'Marta Silva',
        identifiers: [{ kind: 'whatsapp_jid', value: '351910000010@s.whatsapp.net' }],
        globalRoles: ['app_owner'],
        createdAt: iso(-5_800),
        updatedAt: iso(-12),
      },
      {
        personId: 'person-tiago',
        displayName: 'Tiago Ferreira',
        identifiers: [{ kind: 'whatsapp_jid', value: '351910000011@s.whatsapp.net' }],
        globalRoles: ['member'],
        createdAt: iso(-3_900),
        updatedAt: iso(-18),
      },
      {
        personId: 'person-joao',
        displayName: 'Joao Martins',
        identifiers: [{ kind: 'whatsapp_jid', value: '351910000012@s.whatsapp.net' }],
        globalRoles: ['member'],
        createdAt: iso(-3_700),
        updatedAt: iso(-27),
      },
    ],
    routingRules,
    distributions,
    instructionQueue,
    scheduleEvents,
    legacyScheduleFiles,
    watchdogIssues,
    llmModels,
    llmRuns,
    conversationAudit,
    alertMatches,
    automationRuns,
    settings,
    externalPrivateConversations: [
      {
        personId: null,
        displayName: 'Contacto externo sem mapeamento',
        whatsappJids: ['351910000099@s.whatsapp.net'],
        globalRoles: ['member'],
        privateAssistantAuthorized: false,
        ownedGroupJids: [],
        knownToBot: false,
      },
    ],
  };
}

function createDemoGroupIntelligence(groups: readonly Group[]): Record<string, DemoGroupIntelligenceEntry> {
  const byGroupJid: Record<string, DemoGroupIntelligenceEntry> = {};

  for (const group of groups) {
    byGroupJid[group.groupJid] = {
      instructions: buildDemoInstructionsText(group),
      knowledgeDocuments: buildDemoKnowledgeDocuments(group),
      reminderPolicy: createDemoReminderPolicy(group.groupJid),
    };
  }

  return byGroupJid;
}

function createDemoReminderPolicy(groupJid: string): GroupReminderPolicySnapshot {
  return {
    filePath: `${buildDemoGroupRootPath(groupJid)}/policy.json`,
    exists: true,
    enabled: true,
    reminders: [
      {
        reminderId: 'group-reminder-24h',
        enabled: true,
        label: '24h antes',
        kind: 'relative_before_event',
        daysBeforeEvent: 1,
        offsetMinutesBeforeEvent: 0,
        offsetMinutesAfterEvent: null,
        localTime: null,
        summaryLabel: '24h antes',
        messageTemplate:
          'Daqui a {{hours_until_event}} horas temos {{event_title}} no grupo {{group_label}}.',
        llmPromptTemplate:
          'Reescreve este lembrete para WhatsApp, em portugues de Portugal, curto e caloroso. Mantem o facto de que faltam {{hours_until_event}} horas para {{event_title}} no grupo {{group_label}}.',
        llmAssisted: true,
      },
      {
        reminderId: 'group-reminder-eve-18',
        enabled: true,
        label: 'Dia anterior as 18:00',
        kind: 'fixed_local_time',
        daysBeforeEvent: 1,
        offsetMinutesBeforeEvent: null,
        offsetMinutesAfterEvent: null,
        localTime: '18:00',
        summaryLabel: 'Dia anterior as 18:00',
        messageTemplate:
          'Amanhã temos {{event_title}}. Confirma se precisas de alguma coisa antes da aula.',
        llmPromptTemplate:
          'Transforma este lembrete num aviso simples para o dia anterior, em portugues de Portugal, sem jargao tecnico. Evento: {{event_title}}. Grupo: {{group_label}}.',
        llmAssisted: true,
      },
      {
        reminderId: 'group-reminder-30m',
        enabled: true,
        label: '30 min antes',
        kind: 'relative_before_event',
        daysBeforeEvent: 0,
        offsetMinutesBeforeEvent: 30,
        offsetMinutesAfterEvent: null,
        localTime: null,
        summaryLabel: '30 min antes',
        messageTemplate:
          'Daqui a {{minutes_until_event}} minutos começa {{event_title}}. Última chamada para te preparares.',
        llmPromptTemplate:
          'Escreve um lembrete curto e direto, pronto para WhatsApp, a dizer que faltam {{minutes_until_event}} minutos para {{event_title}} no grupo {{group_label}}.',
        llmAssisted: true,
      },
    ],
    canonicalVariables: [
      {
        key: 'group_label',
        label: 'Nome do grupo',
        description: 'Nome canonico do grupo em que o lembrete vai ser enviado.',
        example: 'Ballet Iniciacao',
      },
      {
        key: 'event_title',
        label: 'Titulo do evento',
        description: 'Nome do evento ou da aula.',
        example: 'VC4 - Programacao avancada com Python',
      },
      {
        key: 'event_date',
        label: 'Data do evento',
        description: 'Data local do evento em formato humano.',
        example: '20/04/2026',
      },
      {
        key: 'event_time',
        label: 'Hora do evento',
        description: 'Hora local do evento.',
        example: '12:00',
      },
      {
        key: 'hours_until_event',
        label: 'Horas ate ao evento',
        description: 'Numero redondo de horas restantes ate ao evento.',
        example: '24',
      },
      {
        key: 'minutes_until_event',
        label: 'Minutos ate ao evento',
        description: 'Numero de minutos restantes ate ao evento.',
        example: '30',
      },
    ],
  };
}

function createDemoWorkspaceFile(relativePath: string, content: string): WorkspaceFileContentSnapshot {
  return {
    relativePath,
    absolutePath: `/home/eliaspc/Documentos/lume-hub/${relativePath}`,
    content,
    sizeBytes: new TextEncoder().encode(content).byteLength,
    truncated: false,
  };
}

function searchDemoWorkspaceFiles(
  state: DemoState,
  query: string,
  limit: number,
): readonly WorkspaceFileSnapshot[] {
  const normalizedQuery = query.trim().toLowerCase();
  return state.workspaceFiles
    .filter((file) => normalizedQuery.length === 0 || file.relativePath.toLowerCase().includes(normalizedQuery))
    .slice(0, Math.max(1, Math.min(80, limit)))
    .map((file) => ({
      relativePath: file.relativePath,
      absolutePath: file.absolutePath,
      extension: file.relativePath.includes('.') ? `.${file.relativePath.split('.').at(-1)}` : '',
    }));
}

function createDemoWorkspaceRun(
  state: DemoState,
  body: Record<string, unknown>,
): WorkspaceAgentRunSnapshot {
  const prompt = readDemoRequiredString(body.prompt, 'prompt');
  const mode = body.mode === 'plan' ? 'plan' : 'apply';
  const confirmedApply = body.confirmedApply === true;
  const filePaths = Array.isArray(body.filePaths)
    ? body.filePaths
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
    : [];
  const requestedBy =
    typeof body.requestedBy === 'string' && body.requestedBy.trim().length > 0 ? body.requestedBy.trim() : 'workspace-ui';
  const createdAt = new Date().toISOString();
  const rejectionReason =
    mode === 'apply' && !confirmedApply
      ? 'A aplicacao de alteracoes exige confirmacao explicita antes de editar ficheiros.'
      : mode === 'apply' && filePaths.length === 0
        ? 'Escolhe pelo menos um ficheiro em foco antes de aplicar alteracoes reais.'
        : filePaths.length > state.workspaceStatus.maxFocusedFiles
          ? `Escolhe no maximo ${state.workspaceStatus.maxFocusedFiles} ficheiro(s) em foco antes de correr o agente.`
          : null;
  const run: WorkspaceAgentRunSnapshot = {
    runId: `workspace-demo-run-${Date.now()}`,
    mode,
    prompt,
    filePaths,
    requestedBy,
    approvalState: mode === 'apply' ? (confirmedApply ? 'confirmed' : 'missing_confirmation') : 'not_required',
    executionState: rejectionReason ? 'rejected' : 'executed',
    startedAt: createdAt,
    completedAt: createdAt,
    status: rejectionReason ? 'failed' : 'completed',
    outputSummary:
      rejectionReason ??
      (mode === 'plan'
        ? 'Plano demo criado para os ficheiros selecionados.'
        : 'Demo aplicou uma alteracao simulada dentro do LumeHub.'),
    guardrailReason: rejectionReason,
    stdout:
      rejectionReason
        ? ''
        : mode === 'plan'
          ? `Plano demo para: ${filePaths.join(', ') || 'repo inteiro'}`
          : `Alteracao demo aplicada em: ${filePaths.join(', ') || 'source/apps/lume-hub-web/src/shell/AppShell.ts'}`,
    stderr: rejectionReason ?? '',
    exitCode: rejectionReason ? null : 0,
    timedOut: false,
    changedFiles:
      rejectionReason || mode === 'plan'
        ? []
        : filePaths.length > 0
          ? filePaths
          : ['source/apps/lume-hub-web/src/shell/AppShell.ts'],
    structuredSummary: {
      summary:
        rejectionReason ??
        (mode === 'plan'
          ? 'Plano demo criado para os ficheiros selecionados.'
          : 'Demo aplicou uma alteracao simulada dentro do LumeHub.'),
      suggestedFiles: filePaths,
      readFiles:
        rejectionReason
          ? []
          : mode === 'plan'
          ? filePaths.length > 0
            ? filePaths
            : ['source/apps/lume-hub-web/src/shell/AppShell.ts']
          : filePaths.length > 0
            ? [...new Set([...filePaths, 'README.md'])]
            : ['source/apps/lume-hub-web/src/shell/AppShell.ts', 'README.md'],
      notes:
        rejectionReason
          ? ['Demo rejeitou a run antes de executar para mostrar os guardrails desta interface.']
          : mode === 'plan'
          ? ['Demo sem alteracoes reais.']
          : ['Demo mostra o diff como se a alteracao tivesse sido aplicada.'],
    },
    fileDiffs:
      rejectionReason || mode === 'plan'
        ? []
        : [
            {
              relativePath:
                filePaths[0] ?? 'source/apps/lume-hub-web/src/shell/AppShell.ts',
              changeType: 'modified',
              beforeStatus: null,
              afterStatus: ' M',
              diffText: [
                `diff --git a/${filePaths[0] ?? 'source/apps/lume-hub-web/src/shell/AppShell.ts'} b/${filePaths[0] ?? 'source/apps/lume-hub-web/src/shell/AppShell.ts'}`,
                `--- a/${filePaths[0] ?? 'source/apps/lume-hub-web/src/shell/AppShell.ts'}`,
                `+++ b/${filePaths[0] ?? 'source/apps/lume-hub-web/src/shell/AppShell.ts'}`,
                '@@',
                '-// demo before',
                '+// demo after',
              ].join('\n'),
            },
          ],
  };
  state.workspaceRuns.unshift(run);
  state.workspaceRuns.splice(12);
  state.workspaceStatus = {
    ...state.workspaceStatus,
    busy: false,
    activeRunId: null,
    activeMode: null,
    activePromptSummary: null,
    activeStartedAt: null,
    lastCompletedAt: rejectionReason ? state.workspaceStatus.lastCompletedAt : createdAt,
    lastRejectedAt: rejectionReason ? createdAt : state.workspaceStatus.lastRejectedAt,
    lastRejectedReason: rejectionReason ?? state.workspaceStatus.lastRejectedReason,
  };
  return run;
}

function buildDemoInstructionsText(group: Group): string {
  return [
    `# Instrucoes LLM para ${group.preferredSubject}`,
    '',
    `- Usa ${group.preferredSubject} como nome canonico deste grupo.`,
    `- Trata ${group.aliases.join(', ') || 'os aliases conhecidos'} como referencias locais ao mesmo grupo.`,
    '- Responde com linguagem humana, curta e orientada a proximo passo.',
    '- Se a referencia a uma aula for ambigua, usa primeiro a knowledge base deste grupo antes de responder.',
    '- Nunca assumes que Aulas com o mesmo nome noutros grupos significam a mesma coisa aqui.',
    '',
  ].join('\n');
}

function buildDemoKnowledgeDocuments(group: Group): GroupKnowledgeDocumentSnapshot[] {
  const rootPath = buildDemoGroupKnowledgeRootPath(group.groupJid);

  const documentsByGroupJid: Record<string, GroupKnowledgeDocumentSnapshot[]> = {
    '120363407086801381@g.us': [
      createDemoKnowledgeDocument(group.groupJid, rootPath, {
        documentId: 'ballet-aula-1',
        filePath: 'aulas/aula-1.md',
        title: 'Aula 1 de Ballet Iniciacao',
        summary: 'Nesta turma, Aula 1 refere-se ao bloco tecnico base.',
        aliases: ['Aula 1', 'Ballet Basico'],
        tags: ['ballet', 'iniciacao'],
        content:
          '# Aula 1\n\nA Aula 1 desta turma e o bloco tecnico base. Confirmar sala 2 e levar musica de aquecimento.\n',
      }),
      createDemoKnowledgeDocument(group.groupJid, rootPath, {
        documentId: 'ballet-recados',
        filePath: 'operacao/recados.md',
        title: 'Recados frequentes',
        summary: 'Padroes para faltas, troca de sala e material.',
        aliases: ['recados'],
        tags: ['operacao'],
        content:
          '# Recados\n\nQuando houver troca de sala, responder de forma curta e pedir confirmacao de leitura.\n',
      }),
    ],
    '120363407086801382@g.us': [
      createDemoKnowledgeDocument(group.groupJid, rootPath, {
        documentId: 'contemporaneo-aula-1',
        filePath: 'aulas/aula-1.md',
        title: 'Aula 1 de Contemporaneo Jovens',
        summary: 'Aqui, Aula 1 refere-se ao ensaio coreografico inicial.',
        aliases: ['Aula 1', 'Contemporaneo'],
        tags: ['contemporaneo', 'jovens'],
        content:
          '# Aula 1\n\nA Aula 1 deste grupo e o ensaio coreografico inicial. Confirmar figurino leve e chegada 10 minutos antes.\n',
      }),
    ],
    '120363407086801383@g.us': [
      createDemoKnowledgeDocument(group.groupJid, rootPath, {
        documentId: 'pilates-material',
        filePath: 'operacao/material.md',
        title: 'Material de Pilates Adultos',
        summary: 'Check-list operacional para aulas com reforco.',
        aliases: ['material'],
        tags: ['pilates', 'operacao'],
        content:
          '# Material\n\nLevar tapetes extra, reforcar toalha e lembrar os participantes de confirmar presenca.\n',
      }),
    ],
  };

  return documentsByGroupJid[group.groupJid] ?? [];
}

function createDemoKnowledgeDocument(
  groupJid: string,
  rootPath: string,
  input: {
    readonly documentId: string;
    readonly filePath: string;
    readonly title: string;
    readonly summary: string | null;
    readonly aliases: readonly string[];
    readonly tags: readonly string[];
    readonly content: string;
  },
): GroupKnowledgeDocumentSnapshot {
  return {
    groupJid,
    documentId: input.documentId,
    filePath: input.filePath,
    absoluteFilePath: `${rootPath}/${input.filePath}`,
    title: input.title,
    summary: input.summary,
    aliases: input.aliases,
    tags: input.tags,
    enabled: true,
    exists: true,
    content: input.content,
  };
}

function buildDemoGroupIntelligenceSnapshot(state: DemoState, groupJid: string): GroupIntelligenceSnapshot {
  const entry = state.groupIntelligenceByGroupJid[groupJid] ?? {
    instructions: '',
    knowledgeDocuments: [],
    reminderPolicy: createDemoReminderPolicy(groupJid),
  };
  const instructions = entry.instructions.trim();
  const primaryFilePath = buildDemoGroupInstructionsPath(groupJid);

  return {
    groupJid,
    instructions: {
      primaryFilePath,
      resolvedFilePath: instructions.length > 0 ? primaryFilePath : null,
      exists: instructions.length > 0,
      source: instructions.length > 0 ? 'llm_instructions' : 'missing',
      content: instructions.length > 0 ? entry.instructions : null,
    },
    policy: entry.reminderPolicy,
    knowledge: {
      indexFilePath: buildDemoGroupKnowledgeIndexPath(groupJid),
      exists: entry.knowledgeDocuments.length > 0,
      documents: [...entry.knowledgeDocuments].sort((left, right) => left.title.localeCompare(right.title, 'pt-PT')),
    },
  };
}

function upsertDemoGroupKnowledgeDocument(
  state: DemoState,
  groupJid: string,
  body: Record<string, unknown>,
): GroupKnowledgeDocumentSnapshot {
  const entry = state.groupIntelligenceByGroupJid[groupJid] ?? {
    instructions: '',
    knowledgeDocuments: [],
    reminderPolicy: createDemoReminderPolicy(groupJid),
  };
  const documentId = readDemoRequiredString(body.documentId, 'documentId');
  const filePath = readDemoRequiredString(body.filePath, 'filePath');
  const nextDocument: GroupKnowledgeDocumentSnapshot = {
    groupJid,
    documentId,
    filePath,
    absoluteFilePath: `${buildDemoGroupKnowledgeRootPath(groupJid)}/${filePath}`,
    title: readDemoRequiredString(body.title, 'title'),
    summary: body.summary === null ? null : readDemoOptionalString(body.summary),
    aliases: readDemoStringArray(body.aliases),
    tags: readDemoStringArray(body.tags),
    enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
    exists: true,
    content: ensureDemoTrailingNewline(readDemoRequiredString(body.content, 'content')),
  };
  const nextDocuments = entry.knowledgeDocuments.filter((document) => document.documentId !== nextDocument.documentId);
  nextDocuments.push(nextDocument);
  nextDocuments.sort((left, right) => left.title.localeCompare(right.title, 'pt-PT'));
  state.groupIntelligenceByGroupJid[groupJid] = {
    ...entry,
    knowledgeDocuments: nextDocuments,
  };
  return nextDocument;
}

function deleteDemoGroupKnowledgeDocument(
  state: DemoState,
  groupJid: string,
  documentId: string,
): {
  readonly groupJid: string;
  readonly documentId: string;
  readonly filePath: string | null;
  readonly deleted: boolean;
} {
  const entry = state.groupIntelligenceByGroupJid[groupJid] ?? {
    instructions: '',
    knowledgeDocuments: [],
    reminderPolicy: createDemoReminderPolicy(groupJid),
  };
  const target = entry.knowledgeDocuments.find((document) => document.documentId === documentId) ?? null;

  if (!target) {
    return {
      groupJid,
      documentId,
      filePath: null,
      deleted: false,
    };
  }

  state.groupIntelligenceByGroupJid[groupJid] = {
    ...entry,
    knowledgeDocuments: entry.knowledgeDocuments.filter((document) => document.documentId !== documentId),
  };

  return {
    groupJid,
    documentId,
    filePath: target.filePath,
    deleted: true,
  };
}

function buildDemoGroupContextPreview(
  state: DemoState,
  groupJid: string,
  body: {
    readonly text?: string;
    readonly personId?: string | null;
    readonly senderDisplayName?: string | null;
  },
): GroupContextPreviewSnapshot {
  const group = state.groups.find((candidate) => candidate.groupJid === groupJid);

  if (!group) {
    throw new Error(`Demo group ${groupJid} not found.`);
  }

  const intelligence = buildDemoGroupIntelligenceSnapshot(state, groupJid);
  const query = typeof body.text === 'string' ? body.text.trim() : '';
  const matchedTerms = tokenizeDemoQuery(query);
  const groupKnowledgeSnippets = intelligence.knowledge.documents
    .filter((document) => document.enabled && document.exists && document.content)
    .map((document) => {
      const haystack = `${document.title}\n${document.summary ?? ''}\n${document.aliases.join(' ')}\n${document.tags.join(' ')}\n${document.content ?? ''}`;
      const documentTerms = matchedTerms.filter((term) => haystack.toLowerCase().includes(term));
      return {
        document,
        score: documentTerms.length,
        matchedTerms: documentTerms,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.document.title.localeCompare(right.document.title, 'pt-PT'))
    .slice(0, 3)
    .map((candidate) => ({
      groupJid,
      documentId: candidate.document.documentId,
      title: candidate.document.title,
      filePath: candidate.document.filePath,
      absoluteFilePath: candidate.document.absoluteFilePath,
      score: candidate.score,
      excerpt: buildDemoExcerpt(candidate.document.content ?? '', candidate.matchedTerms[0] ?? null),
      matchedTerms: candidate.matchedTerms,
      source: 'group_knowledge' as const,
    }));
  const person = body.personId ? state.people.find((candidate) => candidate.personId === body.personId) ?? null : null;

  return {
    chatJid: groupJid,
    chatType: 'group',
    currentText: query,
    personId: person?.personId ?? body.personId ?? null,
    senderDisplayName:
      (typeof body.senderDisplayName === 'string' && body.senderDisplayName.trim().length > 0
        ? body.senderDisplayName.trim()
        : null) ?? person?.displayName ?? null,
    groupJid,
    group: {
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
      aliases: group.aliases,
      courseId: group.courseId,
    },
    groupInstructions: intelligence.instructions.content,
    groupInstructionsSource: intelligence.instructions.source,
    groupKnowledgeSnippets,
    groupPolicy: {
      aliases: group.aliases,
      calendarAccessPolicy: group.calendarAccessPolicy,
      ownerPersonIds: group.groupOwners.map((owner) => owner.personId),
    },
    generatedAt: new Date().toISOString(),
  };
}

function buildDemoExcerpt(content: string, focusTerm: string | null): string {
  const normalized = content.replace(/\s+/gu, ' ').trim();

  if (!focusTerm) {
    return normalized.slice(0, 180);
  }

  const lower = normalized.toLowerCase();
  const index = lower.indexOf(focusTerm.toLowerCase());

  if (index < 0) {
    return normalized.slice(0, 180);
  }

  const start = Math.max(0, index - 42);
  const end = Math.min(normalized.length, index + 138);
  return normalized.slice(start, end).trim();
}

function tokenizeDemoQuery(query: string): readonly string[] {
  return [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3))];
}

function buildDemoGroupRootPath(groupJid: string): string {
  return `/home/eliaspc/Documentos/lume-hub/runtime/demo-data/groups/${encodeURIComponent(groupJid)}`;
}

function buildDemoGroupInstructionsPath(groupJid: string): string {
  return `${buildDemoGroupRootPath(groupJid)}/llm/instructions.md`;
}

function buildDemoGroupKnowledgeRootPath(groupJid: string): string {
  return `${buildDemoGroupRootPath(groupJid)}/knowledge`;
}

function buildDemoGroupKnowledgeIndexPath(groupJid: string): string {
  return `${buildDemoGroupKnowledgeRootPath(groupJid)}/index.json`;
}

function readDemoRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Demo field '${fieldName}' must be a non-empty string.`);
  }

  return value.trim();
}

function readDemoOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readDemoStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function ensureDemoTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}

function buildDashboardSnapshot(state: DemoState): DashboardSnapshot {
  return {
    health: {
      status: 'healthy',
      ready: true,
      modules: [
        { status: 'healthy', details: { module: 'backend', latencyMs: 38 } },
        { status: 'healthy', details: { module: 'whatsapp', lastSyncAt: state.settings.hostStatus.runtime.lastHeartbeatAt } },
        { status: 'healthy', details: { module: 'dispatcher', activeWorkers: 1 } },
      ],
      jobs: {
        pending: 6,
        waitingConfirmation: 2,
        sent: 18,
      },
      watchdog: {
        openIssues: state.watchdogIssues.length,
      },
    },
    readiness: {
      ready: true,
      status: 'healthy',
    },
    groups: {
      total: state.groups.length,
      withOwners: state.groups.filter((group) => group.groupOwners.length > 0).length,
      readWriteGroupOwnerAccess: state.groups.filter((group) => group.calendarAccessPolicy.groupOwner === 'read_write').length,
    },
    routing: {
      totalRules: state.routingRules.length,
      confirmationRules: state.routingRules.filter((rule) => rule.requiresConfirmation).length,
      totalPlannedTargets: state.routingRules.reduce(
        (total, rule) =>
          total + rule.targetGroupJids.length + rule.targetCourseIds.length + rule.targetDisciplineCodes.length,
        0,
      ),
    },
    distributions: {
      total: state.distributions.length,
      queued: state.distributions.filter((distribution) => distribution.status === 'queued').length,
      running: state.distributions.filter((distribution) => distribution.status === 'running').length,
      completed: state.distributions.filter((distribution) => distribution.status === 'completed').length,
      partialFailed: state.distributions.filter((distribution) => distribution.status === 'partial_failed').length,
      failed: state.distributions.filter((distribution) => distribution.status === 'failed').length,
    },
    watchdog: {
      openIssues: state.watchdogIssues.length,
      recentIssues: state.watchdogIssues.map((issue) => ({
        issueId: issue.issueId,
        kind: issue.kind,
        groupLabel: issue.groupLabel,
        summary: issue.summary,
        openedAt: issue.openedAt,
      })),
    },
    hostCompanion: {
      hostId: state.settings.hostStatus.hostId,
      authExists: state.settings.hostStatus.auth.exists,
      sameAsCodexCanonical: state.settings.hostStatus.auth.sameAsCodexCanonical,
      autostartEnabled: state.settings.hostStatus.autostart.enabled,
      lastHeartbeatAt: state.settings.hostStatus.runtime.lastHeartbeatAt,
      lastError: state.settings.hostStatus.runtime.lastError,
    },
    whatsapp: {
      phase: state.settings.adminSettings.whatsapp.enabled ? 'open' : 'disabled',
      connected: state.settings.adminSettings.whatsapp.enabled,
      loginRequired: !state.settings.adminSettings.whatsapp.enabled,
      discoveredGroups: state.groups.length,
      discoveredConversations:
        state.people.filter((person) => person.identifiers.some((identifier) => identifier.kind === 'whatsapp_jid')).length +
        state.externalPrivateConversations.length,
    },
  };
}

function buildStatusSnapshot(state: DemoState): StatusSnapshot {
  const dashboard = buildDashboardSnapshot(state);

  return {
    readiness: dashboard.readiness,
    health: dashboard.health,
    groups: dashboard.groups,
    routing: dashboard.routing,
    distributions: dashboard.distributions,
    watchdog: dashboard.watchdog,
    hostCompanion: dashboard.hostCompanion,
    whatsapp: dashboard.whatsapp,
    generatedAt: new Date().toISOString(),
  };
}

function buildDemoMigrationReadinessSnapshot(state: DemoState): MigrationReadinessSnapshot {
  const effectiveProvider = state.settings.llmRuntime.effectiveProviderId;
  const codexAuthReady = Boolean(
    state.settings.llmRuntime.providerReadiness.find((provider) => provider.providerId === 'codex-oauth')?.ready,
  );
  const checklist: MigrationReadinessSnapshot['checklist'] = [
    {
      itemId: 'runtime',
      label: 'Runtime live estavel',
      status: 'ready',
      summary: 'Backend e host estao saudaveis e o launcher ja consegue manter o processo vivo.',
    },
    {
      itemId: 'llm',
      label: 'LLM real ativa por defeito',
      status: state.settings.llmRuntime.mode === 'live' ? 'ready' : 'review',
      summary:
        state.settings.llmRuntime.mode === 'live'
          ? `Provider efetivo ${effectiveProvider}.`
          : state.settings.llmRuntime.fallbackReason ?? 'Ainda ha fallback para rever.',
    },
    {
      itemId: 'whatsapp',
      label: 'WhatsApp pronto para semana paralela',
      status: state.settings.adminSettings.whatsapp.enabled ? 'ready' : 'blocked',
      summary: state.settings.adminSettings.whatsapp.enabled
        ? `${state.groups.length} grupo(s) e ${state.externalPrivateConversations.length + state.people.length} conversa(s) visiveis.`
        : 'O canal WhatsApp ainda esta desligado neste preview.',
    },
    {
      itemId: 'legacy',
      label: 'Fontes WA-notify visiveis',
      status: 'ready',
      summary: `${state.legacyScheduleFiles.length} ficheiro(s) legacy conhecidos, com alerts e automations preparados para migracao.`,
    },
    {
      itemId: 'parity',
      label: 'Paridade basica carregada',
      status:
        state.scheduleEvents.length > 0 &&
        state.settings.adminSettings.alerts.rules.length > 0 &&
        state.settings.adminSettings.automations.definitions.length > 0
          ? 'ready'
          : 'review',
      summary:
        state.scheduleEvents.length > 0
          ? `${state.scheduleEvents.length} evento(s), ${state.settings.adminSettings.alerts.rules.length} alert(s) e ${state.settings.adminSettings.automations.definitions.length} automation(s) no runtime novo.`
          : 'Ainda faltam dados importados para aproximar o shadow mode da operacao real.',
    },
  ];
  const blockers = checklist.filter((item) => item.status === 'blocked').map((item) => item.label);
  const cutoverDecisionReady =
    blockers.length === 0 &&
    state.scheduleEvents.length > 0 &&
    state.settings.adminSettings.alerts.rules.length > 0 &&
    state.settings.adminSettings.automations.definitions.length > 0 &&
    state.llmRuns.length > 0 &&
    state.conversationAudit.length > 0;

  return {
    generatedAt: new Date().toISOString(),
    recommendedPhase: blockers.length > 0 ? 'blocked' : 'shadow_mode',
    cutoverDecisionReady,
    summary:
      blockers.length > 0
        ? 'Ainda ha bloqueadores tecnicos antes de entrares em shadow mode.'
        : cutoverDecisionReady
          ? 'A base automatica esta pronta. Faz a semana paralela e decide o cutover no fim.'
          : 'O runtime ja pode entrar em shadow mode, mas ainda convem recolher mais sinais reais antes de decidir o cutover.',
    runtime: {
      phase: 'running',
      ready: true,
      lastTickAt: state.settings.hostStatus.runtime.lastHeartbeatAt,
      lastError: null,
    },
    llm: {
      configuredProvider: state.settings.adminSettings.llm.provider,
      effectiveProvider,
      effectiveModel: state.settings.llmRuntime.effectiveModelId,
      mode: state.settings.llmRuntime.mode,
      codexAuthReady,
      fallbackReason: state.settings.llmRuntime.fallbackReason,
    },
    whatsapp: {
      phase: state.settings.adminSettings.whatsapp.enabled ? 'open' : 'disabled',
      connected: state.settings.adminSettings.whatsapp.enabled,
      loginRequired: !state.settings.adminSettings.whatsapp.enabled,
      discoveredGroups: state.groups.length,
      discoveredConversations: state.externalPrivateConversations.length + state.people.length,
    },
    legacySources: {
      schedulesRootPath: '/home/eliaspc/Containers/wa-notify/data/schedules',
      scheduleFileCount: state.legacyScheduleFiles.length,
      alertsFilePath: '/home/eliaspc/Containers/wa-notify/data/alerts.json',
      alertsFilePresent: true,
      automationsFilePath: '/home/eliaspc/Containers/wa-notify/data/automations.json',
      automationsFilePresent: true,
    },
    lumeHubState: {
      knownGroups: state.groups.length,
      importedScheduleEvents: state.scheduleEvents.length,
      alertRules: state.settings.adminSettings.alerts.rules.length,
      automationDefinitions: state.settings.adminSettings.automations.definitions.length,
      llmRunCount: state.llmRuns.length,
      conversationAuditCount: state.conversationAudit.length,
    },
    checklist,
    blockers,
    comparison: [
      {
        label: 'Schedules da semana',
        tone: state.scheduleEvents.length > 0 ? 'positive' : 'warning',
        waNotify: `${state.legacyScheduleFiles.length} ficheiro(s) legacy prontos para comparacao.`,
        lumeHub:
          state.scheduleEvents.length > 0
            ? `${state.scheduleEvents.length} evento(s) ja vivem no calendario mensal canonico.`
            : 'Ainda sem eventos importados no calendario mensal.',
      },
      {
        label: 'LLM e respostas',
        tone: state.settings.llmRuntime.mode === 'live' ? 'positive' : 'warning',
        waNotify: 'Provider real assumido como referencia produtiva.',
        lumeHub:
          state.settings.llmRuntime.mode === 'live'
            ? `Provider real ${effectiveProvider} ativo.`
            : state.settings.llmRuntime.fallbackReason ?? 'Fallback ainda presente.',
      },
      {
        label: 'WhatsApp e descoberta',
        tone: state.settings.adminSettings.whatsapp.enabled ? 'positive' : 'warning',
        waNotify: 'Canal produtivo com grupos e conversas conhecidos.',
        lumeHub: `${state.groups.length} grupo(s) e ${state.externalPrivateConversations.length + state.people.length} conversa(s) visiveis no snapshot atual.`,
      },
      {
        label: 'Alerts e automations',
        tone:
          state.settings.adminSettings.alerts.rules.length > 0 &&
          state.settings.adminSettings.automations.definitions.length > 0
            ? 'positive'
            : 'warning',
        waNotify: 'Ficheiros legacy continuam a servir de referencia durante a semana paralela.',
        lumeHub: `${state.settings.adminSettings.alerts.rules.length} alert(s) e ${state.settings.adminSettings.automations.definitions.length} automation(s) carregados no runtime novo.`,
      },
    ],
    shadowModeChecks: [
      'Operar uma semana real com WA-notify e LumeHub em paralelo, sem cortar o sistema antigo.',
      'Comparar eventos da semana, envios relevantes e respostas do assistente todos os dias.',
      'Registar divergencias antes de mexer no fluxo produtivo principal.',
    ],
    cutoverChecks: [
      'No fim da semana paralela, confirmar que nao houve regressao funcional evidente.',
      'Validar que o operador consegue criar schedules, distribuir mensagens e ler auditoria sem recorrer ao WA-notify.',
      'Guardar logs do launcher e snapshot de /api/runtime/diagnostics antes do corte final.',
    ],
  };
}

function buildWeeklyPlannerSnapshot(state: DemoState): WeeklyPlannerSnapshot {
  const events = [...state.scheduleEvents].sort(
    (left, right) => left.eventAt.localeCompare(right.eventAt) || left.eventId.localeCompare(right.eventId),
  );

  return {
    timezone: 'Europe/Lisbon',
    focusWeekLabel: '2026-W13',
    focusWeekRangeLabel: '2026-03-23 ate 2026-03-29',
    groupsKnown: state.groups.length,
    groups: state.groups.map((group) => ({
      groupJid: group.groupJid,
      preferredSubject: group.preferredSubject,
      courseId: group.courseId,
      ownerLabels: group.groupOwners.map((owner) => owner.personId),
      operationalSettings: group.operationalSettings,
    })),
    defaultNotificationRuleLabels: state.settings.adminSettings.ui.defaultNotificationRules.map(
      (rule) => rule.label ?? rule.kind,
    ),
    events,
    diagnostics: {
      eventCount: events.length,
      pendingNotifications: events.reduce((sum, event) => sum + event.notifications.pending, 0),
      waitingConfirmationNotifications: events.reduce(
        (sum, event) => sum + event.notifications.waitingConfirmation,
        0,
      ),
      sentNotifications: events.reduce((sum, event) => sum + event.notifications.sent, 0),
    },
  };
}

function normaliseDemoGroupOperationalSettings(
  input: Partial<GroupOperationalSettings> | undefined,
): GroupOperationalSettings {
  const mode = input?.mode ?? DEFAULT_DEMO_GROUP_OPERATIONAL_SETTINGS.mode;
  const schedulingEnabled = mode === 'distribuicao_apenas'
    ? false
    : (input?.schedulingEnabled ?? DEFAULT_DEMO_GROUP_OPERATIONAL_SETTINGS.schedulingEnabled);
  const allowLlmScheduling =
    mode === 'com_agendamento' &&
    schedulingEnabled &&
    (input?.allowLlmScheduling ?? DEFAULT_DEMO_GROUP_OPERATIONAL_SETTINGS.allowLlmScheduling);

  return {
    mode,
    schedulingEnabled,
    allowLlmScheduling,
    memberTagPolicy: input?.memberTagPolicy ?? DEFAULT_DEMO_GROUP_OPERATIONAL_SETTINGS.memberTagPolicy,
  };
}

function buildWhatsAppWorkspaceSnapshot(state: DemoState): WhatsAppWorkspaceSnapshot {
  const peopleById = new Map(state.people.map((person) => [person.personId, person]));
  const ownedGroupsByPersonId = new Map<string, string[]>();

  for (const group of state.groups) {
    for (const owner of group.groupOwners) {
      const groups = ownedGroupsByPersonId.get(owner.personId) ?? [];
      groups.push(group.groupJid);
      ownedGroupsByPersonId.set(owner.personId, groups);
    }
  }

  const commands = state.settings.adminSettings.commands;
  const whatsappEnabled = state.settings.adminSettings.whatsapp.enabled;
  const allowAllGroups = commands.authorizedGroupJids.length === 0;
  const allowAllPrivateChats = commands.authorizedPrivateJids.length === 0;

  const groupSummaries: WhatsAppGroupSummary[] = state.groups.map((group) => ({
    groupJid: group.groupJid,
    preferredSubject: group.preferredSubject,
    aliases: group.aliases,
    courseId: group.courseId,
    ownerPersonIds: group.groupOwners.map((owner) => owner.personId),
    ownerLabels: group.groupOwners.map((owner) => peopleById.get(owner.personId)?.displayName ?? owner.personId),
    assistantAuthorized:
      commands.assistantEnabled &&
      state.settings.adminSettings.whatsapp.enabled &&
      (allowAllGroups || commands.authorizedGroupJids.includes(group.groupJid)),
    calendarAccessPolicy: group.calendarAccessPolicy,
    operationalSettings: group.operationalSettings,
    lastRefreshedAt: group.lastRefreshedAt,
    knownToBot: true,
  }));

  const conversations = [
    ...state.people
    .filter((person) => person.identifiers.some((identifier) => identifier.kind === 'whatsapp_jid'))
      .map((person) =>
        mapPersonToConversationSummary(person, ownedGroupsByPersonId, commands, whatsappEnabled, allowAllPrivateChats),
      ),
    ...state.externalPrivateConversations.map((conversation) => ({
      ...conversation,
      privateAssistantAuthorized:
        commands.assistantEnabled &&
        whatsappEnabled &&
        commands.allowPrivateAssistant &&
        (allowAllPrivateChats ||
          conversation.whatsappJids.some((chatJid) => commands.authorizedPrivateJids.includes(chatJid))),
    })),
  ];

  const appOwners = state.people
    .filter((person) => person.globalRoles.includes('app_owner'))
    .map((person) =>
      mapPersonToConversationSummary(person, ownedGroupsByPersonId, commands, whatsappEnabled, allowAllPrivateChats),
    );

  return {
    settings: {
      commands,
      whatsapp: state.settings.adminSettings.whatsapp,
    },
    runtime: {
      session: {
        phase: whatsappEnabled ? 'open' : 'disabled',
        connected: whatsappEnabled,
        loginRequired: !whatsappEnabled,
        sessionPresent: state.settings.hostStatus.auth.exists,
        lastQrAt: whatsappEnabled ? null : state.settings.hostStatus.runtime.updatedAt,
        lastConnectedAt: whatsappEnabled ? state.settings.hostStatus.runtime.updatedAt : null,
        lastDisconnectAt: whatsappEnabled ? null : state.settings.hostStatus.runtime.updatedAt,
        lastDisconnectReason: whatsappEnabled ? null : 'disabled_for_preview',
        lastError: null,
        selfJid: '351910000099@s.whatsapp.net',
        pushName: 'Conta LumeHub Demo',
      },
      qr: {
        available: !whatsappEnabled,
        value: !whatsappEnabled ? 'lumehub-demo-qr' : null,
        svg: null,
        updatedAt: !whatsappEnabled ? state.settings.hostStatus.runtime.updatedAt : null,
        expiresAt: !whatsappEnabled ? state.settings.hostStatus.runtime.updatedAt : null,
      },
      discoveredGroups: groupSummaries.length,
      discoveredConversations: conversations.length,
      lastDiscoveryAt:
        [...groupSummaries.map((group) => group.lastRefreshedAt ?? ''), state.settings.hostStatus.runtime.updatedAt]
          .filter((value) => value.length > 0)
          .sort()
          .at(-1) ?? null,
    },
    host: {
      authFilePath: state.settings.hostStatus.auth.filePath,
      canonicalAuthFilePath:
        state.settings.authRouterStatus?.canonicalAuthFilePath ?? state.settings.hostStatus.auth.filePath,
      authExists: state.settings.hostStatus.auth.exists,
      sameAsCodexCanonical: state.settings.hostStatus.auth.sameAsCodexCanonical,
      autostartEnabled: state.settings.hostStatus.autostart.enabled,
      lastHeartbeatAt: state.settings.hostStatus.runtime.lastHeartbeatAt,
    },
    groups: groupSummaries.sort(compareByLabel),
    conversations: conversations.sort(compareByLabel),
    appOwners: appOwners.sort(compareByLabel),
    permissionSummary: {
      knownGroups: groupSummaries.filter((group) => group.knownToBot).length,
      authorizedGroups: groupSummaries.filter((group) => group.assistantAuthorized).length,
      knownPrivateConversations: conversations.filter((conversation) => conversation.knownToBot).length,
      authorizedPrivateConversations: conversations.filter((conversation) => conversation.privateAssistantAuthorized).length,
      appOwners: appOwners.length,
    },
  };
}

function upsertDemoSchedule(state: DemoState, payload: Record<string, unknown>): WeeklyPlannerEventSummary {
  const eventId = typeof payload.eventId === 'string' && payload.eventId.length > 0 ? payload.eventId : `event-demo-${Date.now()}`;
  const groupJid = String(payload.groupJid ?? '');
  const group = state.groups.find((candidate) => candidate.groupJid === groupJid) ?? state.groups[0];
  const title = String(payload.title ?? 'Novo agendamento');
  const dayLabel = String(payload.dayLabel ?? 'sexta-feira');
  const localDate = String(payload.localDate ?? resolveDemoLocalDate(dayLabel));
  const startTime = String(payload.startTime ?? '18:30');
  const durationMinutes =
    typeof payload.durationMinutes === 'number' && Number.isFinite(payload.durationMinutes)
      ? payload.durationMinutes
      : 60;
  const notes = typeof payload.notes === 'string' ? payload.notes : '';
  const notificationRuleLabels = Array.isArray(payload.notificationRules)
    ? payload.notificationRules
        .map((rule) => (rule && typeof rule === 'object' && 'label' in rule ? String((rule as { label?: unknown }).label ?? '') : ''))
        .filter((label) => label.length > 0)
    : state.settings.adminSettings.ui.defaultNotificationRules.map((rule) => rule.label ?? rule.kind);
  const eventAt = `${localDate}T${startTime}:00.000Z`;
  const reminderPreview = buildDemoReminderPreviewState(eventAt, notificationRuleLabels);
  const nextEvent: WeeklyPlannerEventSummary = {
    eventId,
    weekId: '2026-W13',
    groupJid: group.groupJid,
    groupLabel: group.preferredSubject,
    title,
    eventAt,
    localDate,
    dayLabel,
    startTime,
    durationMinutes,
    notes,
    notificationRuleLabels,
    notifications: {
      pending: notificationRuleLabels.length,
      waitingConfirmation: 0,
      sent: 0,
      total: notificationRuleLabels.length,
    },
    nextReminderAt: reminderPreview.nextReminderAt,
    nextReminderLabel: reminderPreview.nextReminderLabel,
    reminderLifecycle: reminderPreview.reminderLifecycle,
  };
  const existingIndex = state.scheduleEvents.findIndex((event) => event.eventId === eventId);

  if (existingIndex >= 0) {
    state.scheduleEvents.splice(existingIndex, 1, nextEvent);
  } else {
    state.scheduleEvents.unshift(nextEvent);
  }

  return nextEvent;
}

function buildDemoReminderPreviewState(
  eventAt: string,
  notificationRuleLabels: readonly string[],
): Pick<WeeklyPlannerEventSummary, 'nextReminderAt' | 'nextReminderLabel' | 'reminderLifecycle'> {
  const nextReminderLabel = notificationRuleLabels[0] ?? null;

  return {
    nextReminderAt: nextReminderLabel ? resolveDemoReminderAt(eventAt, nextReminderLabel) : null,
    nextReminderLabel,
    reminderLifecycle: {
      generated: notificationRuleLabels.length,
      prepared: 0,
      sent: 0,
    },
  };
}

function resolveDemoReminderAt(eventAt: string, label: string): string {
  const eventDate = new Date(eventAt);

  if (Number.isNaN(eventDate.getTime())) {
    return eventAt;
  }

  const normalized = label.trim().toLowerCase();

  if (normalized.includes('24h')) {
    return new Date(eventDate.getTime() - 24 * 60 * 60_000).toISOString();
  }

  if (normalized.includes('30 min')) {
    return new Date(eventDate.getTime() - 30 * 60_000).toISOString();
  }

  if (normalized.includes('dia anterior') && normalized.includes('18:00')) {
    const reminderDate = new Date(eventDate.getTime() - 24 * 60 * 60_000);
    reminderDate.setUTCHours(18, 0, 0, 0);
    return reminderDate.toISOString();
  }

  const afterMinutesMatch = normalized.match(/(\d+)\s*min.*depois/u);

  if (afterMinutesMatch) {
    const minutes = Number.parseInt(afterMinutesMatch[1] ?? '0', 10);
    return new Date(eventDate.getTime() + minutes * 60_000).toISOString();
  }

  return eventAt;
}

function readDemoScheduleRouteBlockingReason(
  group: Group | null,
  route: 'manual' | 'llm',
): string | null {
  if (!group) {
    return 'Escolhe primeiro um grupo valido.';
  }

  if (group.operationalSettings.mode === 'distribuicao_apenas') {
    return `O grupo ${group.preferredSubject} esta em distribuicao apenas e nao aceita scheduling local.`;
  }

  if (!group.operationalSettings.schedulingEnabled) {
    return `O grupo ${group.preferredSubject} tem o agendamento local desligado neste momento.`;
  }

  if (route === 'llm' && !group.operationalSettings.allowLlmScheduling) {
    return `O grupo ${group.preferredSubject} so aceita calendario manual neste momento; o LLM scheduling esta desligado.`;
  }

  return null;
}

function buildDemoLegacyScheduleImportReport(
  state: DemoState,
  payload: Record<string, unknown>,
  apply: boolean,
): LegacyScheduleImportReportSnapshot {
  const fileName =
    typeof payload.fileName === 'string' && payload.fileName.length > 0
      ? payload.fileName
      : state.legacyScheduleFiles[0]?.fileName ?? 'w14y2026.json';
  const sourceFile =
    state.legacyScheduleFiles.find((file) => file.fileName === fileName) ?? state.legacyScheduleFiles[0];
  const firstGroup = state.groups[0];
  const secondGroup = state.groups[2];
  const firstEventStatus: LegacyScheduleImportReportSnapshot['events'][number]['status'] =
    state.scheduleEvents.some((event) => event.eventId === 'legacy-ballet-001') ? 'updated' : 'created';
  const secondEventStatus: LegacyScheduleImportReportSnapshot['events'][number]['status'] =
    state.scheduleEvents.some((event) => event.eventId === 'legacy-pilates-001') ? 'updated' : 'created';
  const events: LegacyScheduleImportReportSnapshot['events'] = [
    {
      legacyEventId: 'legacy-ballet-001',
      groupJid: firstGroup.groupJid,
      groupLabel: firstGroup.preferredSubject,
      title: 'VC1 — Aula de Ballet',
      weekId: '2026-W14',
      localDate: '2026-03-31',
      startTime: '20:00',
      status: firstEventStatus,
      reason: null,
      notificationRuleLabels: ['No proprio dia as 16:00', 'Lembrete 30 min antes'],
    },
    {
      legacyEventId: 'legacy-pilates-001',
      groupJid: secondGroup.groupJid,
      groupLabel: secondGroup.preferredSubject,
      title: 'VC2 — Pilates reforco',
      weekId: '2026-W14',
      localDate: '2026-04-01',
      startTime: '20:00',
      status: secondEventStatus,
      reason: null,
      notificationRuleLabels: ['No proprio dia as 16:00', 'Lembrete 30 min antes'],
    },
  ];

  return {
    mode: apply ? 'apply' : 'preview',
    generatedAt: new Date().toISOString(),
    sourceFile: sourceFile ?? {
      fileName,
      absolutePath: `/demo/${fileName}`,
      legacyWeekId: basenameWithoutJson(fileName),
      isoWeekId: '2026-W14',
      weekStart: '2026-03-30',
      weekEnd: '2026-04-05',
      itemCount: 4,
      baseEventCount: 2,
      groupJids: [firstGroup.groupJid, secondGroup.groupJid],
    },
    totals: {
      legacyItems: 4,
      baseEvents: events.length,
      created: events.filter((event) => event.status === 'created').length,
      updated: events.filter((event) => event.status === 'updated').length,
      unchanged: events.filter((event) => event.status === 'unchanged').length,
      ignored: 0,
      ambiguous: 0,
      matchedGroups: 2,
      missingGroups: 0,
    },
    events,
    ignoredItems: [],
    missingGroups: [],
    notes: apply
      ? ['Demo: import aplicado no estado fake da preview.']
      : ['Demo: preview do import sem tocar no backend real.'],
  };
}

function applyDemoLegacyScheduleImport(
  state: DemoState,
  report: LegacyScheduleImportReportSnapshot,
): void {
  for (const event of report.events) {
    const existing = state.scheduleEvents.find((candidate) => candidate.eventId === event.legacyEventId);
    const nextSchedule = upsertDemoSchedule(state, {
      eventId: event.legacyEventId,
      groupJid: event.groupJid,
      title: event.title,
      localDate: event.localDate,
      dayLabel: existing?.dayLabel ?? 'terça-feira',
      startTime: event.startTime,
      durationMinutes: existing?.durationMinutes ?? 60,
      notes: 'Importado do WA-notify em preview demo.',
      notificationRules: event.notificationRuleLabels.map((label) => ({ label })),
    });
    nextSchedule.weekId;
  }
}

function buildDemoLegacyAlertImportReport(
  state: DemoState,
  apply: boolean,
): LegacyAlertImportReportSnapshot {
  const importedRulesSnapshot = state.settings.adminSettings.alerts.rules;

  return {
    mode: apply ? 'apply' : 'preview',
    sourceFilePath: '/home/eliaspc/Containers/wa-notify/data/alerts.json',
    totals: {
      legacyRules: importedRulesSnapshot.length,
      importedRules: importedRulesSnapshot.length,
    },
    rules: importedRulesSnapshot.map((rule) => ({
      ruleId: rule.ruleId,
      enabled: rule.enabled,
      scopeLabel:
        rule.scope.type === 'group'
          ? `grupo ${rule.scope.groupJid}`
          : rule.scope.type === 'group_subject'
            ? `grupo ${rule.scope.subject}`
            : rule.scope.type === 'chat'
              ? `chat ${rule.scope.chatJid}`
              : 'qualquer chat',
      matcherLabel:
        rule.match.type === 'regex'
          ? `regex ${rule.match.pattern}`
          : `contains ${rule.match.value}`,
      actionLabels: rule.actions.map((action) => (action.type === 'webhook' ? `webhook ${action.url}` : 'log')),
    })),
    importedRulesSnapshot,
  };
}

function buildDemoLegacyAutomationImportReport(
  state: DemoState,
  apply: boolean,
): LegacyAutomationImportReportSnapshot {
  const importedDefinitionsSnapshot = state.settings.adminSettings.automations.definitions;

  return {
    mode: apply ? 'apply' : 'preview',
    sourceFilePath: '/home/eliaspc/Containers/wa-notify/data/automations.json',
    totals: {
      legacyGroups: dedupeStringList(importedDefinitionsSnapshot.map((definition) => definition.groupLabel)).length,
      legacyEntries: importedDefinitionsSnapshot.length,
      importedDefinitions: importedDefinitionsSnapshot.length,
      missingGroups: 0,
    },
    missingGroups: [],
    definitions: importedDefinitionsSnapshot.map((definition) => ({
      automationId: definition.automationId,
      entryId: definition.entryId,
      groupJid: definition.groupJid,
      groupLabel: definition.groupLabel,
      scheduleLabel:
        definition.schedule.type === 'weekly'
          ? `${definition.schedule.daysOfWeek.join(', ')} @ ${definition.schedule.time}`
          : definition.schedule.startsAt,
      actionLabels: definition.actions.map((action) =>
        action.type === 'webhook' ? `webhook ${action.url}` : action.type,
      ),
    })),
    importedDefinitionsSnapshot,
  };
}

function buildDemoAssistantSchedulePreview(
  state: DemoState,
  payload: Record<string, unknown>,
): AssistantSchedulePreviewSnapshot {
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  const groupJid =
    typeof payload.groupJid === 'string' && payload.groupJid.length > 0
      ? payload.groupJid
      : state.groups[0]?.groupJid ?? null;
  const group = state.groups.find((candidate) => candidate.groupJid === groupJid) ?? null;
  const weekId = typeof payload.weekId === 'string' && payload.weekId.length > 0 ? payload.weekId : '2026-W13';
  const targetEvent = group
    ? state.scheduleEvents.find((event) => event.groupJid === group.groupJid) ?? null
    : null;
  const operation = resolveDemoAssistantScheduleOperation(text, targetEvent);
  const candidate = buildDemoAssistantCandidate(text, targetEvent);
  const routingBlock = readDemoScheduleRouteBlockingReason(group, 'llm');
  const canApply =
    text.length > 0 &&
    group !== null &&
    !routingBlock &&
    (operation === 'create' || targetEvent !== null) &&
    (operation !== null);
  const blockingReason = !text
    ? 'Escreve primeiro o pedido para a agenda.'
    : !group
      ? 'Escolhe primeiro um grupo.'
      : routingBlock
        ? routingBlock
      : operation !== 'create' && !targetEvent
        ? 'Nao encontramos um evento real para atualizar ou apagar neste grupo.'
        : null;
  const diff = buildDemoAssistantDiff(operation, targetEvent, candidate);

  return {
    requestText: text,
    requestedAccessMode: 'read_write',
    groupJid: group?.groupJid ?? null,
    groupLabel: group?.preferredSubject ?? null,
    weekId,
    previewFingerprint: canApply ? `demo-preview-${group?.groupJid ?? 'none'}-${normaliseTextForId(text)}` : null,
    operation,
    confidence: canApply ? 'medium' : null,
    summary: !canApply
      ? blockingReason ?? 'O preview nao ficou pronto.'
      : buildDemoAssistantPreviewSummary(operation, candidate?.title ?? null, group?.preferredSubject ?? null),
    canApply,
    blockingReason,
    targetEvent,
    candidate,
    diff,
    parserNotes: ['Preview demo simplificado para validar a interface sem depender do backend real.'],
  };
}

function applyDemoAssistantSchedule(
  state: DemoState,
  payload: Record<string, unknown>,
  preview: AssistantSchedulePreviewSnapshot,
): AssistantScheduleApplySnapshot {
  let appliedEvent: WeeklyPlannerEventSummary | null = null;

  if (preview.operation === 'delete' && preview.targetEvent) {
    state.scheduleEvents = state.scheduleEvents.filter((event) => event.eventId !== preview.targetEvent?.eventId);
  } else if (preview.candidate && preview.groupJid && preview.weekId) {
    appliedEvent = upsertDemoSchedule(state, {
      eventId: preview.targetEvent?.eventId ?? undefined,
      groupJid: preview.groupJid,
      title: preview.candidate.title ?? 'Evento atualizado pelo assistente',
      localDate: preview.candidate.localDate ?? resolveDemoLocalDate(preview.candidate.dayLabel ?? 'sexta-feira'),
      dayLabel: preview.candidate.dayLabel ?? 'sexta-feira',
      startTime: preview.candidate.startTime ?? '18:30',
      durationMinutes: preview.candidate.durationMinutes ?? 60,
      notes: preview.candidate.notes ?? '',
    });
  }

  const instruction: Instruction = {
    instructionId: `instruction-demo-schedule-${Date.now()}`,
    sourceType: 'assistant_schedule_apply',
    sourceMessageId:
      typeof payload.text === 'string' && payload.text.trim().length > 0
        ? `assistant-demo-${normaliseTextForId(payload.text)}`
        : null,
    mode: 'confirmed',
    status: 'completed',
    metadata: {
      contentKind: 'schedule_apply',
      operation: preview.operation,
      requestedText: preview.requestText,
      previewSummary: preview.summary,
      previewFingerprint: preview.previewFingerprint,
      groupJid: preview.groupJid,
      groupLabel: preview.groupLabel,
      weekId: preview.weekId,
      diff: preview.diff,
    },
    actions: [
      {
        actionId: `action-demo-schedule-${Date.now()}`,
        type: 'schedule_apply',
        dedupeKey: preview.previewFingerprint,
        targetGroupJid: preview.groupJid,
        payload: {
          kind: 'schedule_apply',
          operation: preview.operation,
        },
        status: 'completed',
        attemptCount: 1,
        lastError: null,
        result: {
          note:
            appliedEvent?.title ??
            (preview.operation === 'delete'
              ? 'Evento removido da agenda demo.'
              : 'Alteracao aplicada na agenda demo.'),
          metadata: {
            appliedEvent,
          },
        },
        lastAttemptAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.instructionQueue = [instruction, ...state.instructionQueue].slice(0, 16);

  return {
    preview,
    instruction,
    appliedInstruction: instruction,
    appliedEvent,
  };
}

function resolveDemoAssistantScheduleOperation(
  text: string,
  targetEvent: WeeklyPlannerEventSummary | null,
): AssistantSchedulePreviewSnapshot['operation'] {
  const normalized = text.toLowerCase();

  if (/(apaga|apagar|cancela|cancelar|remove|remover)/u.test(normalized)) {
    return 'delete';
  }

  if (/(move|muda|mudar|altera|alterar|troca|trocar|passa|adiar)/u.test(normalized) && targetEvent) {
    return 'update';
  }

  return 'create';
}

function buildDemoAssistantCandidate(
  text: string,
  targetEvent: WeeklyPlannerEventSummary | null,
): AssistantSchedulePreviewSnapshot['candidate'] {
  const normalized = text.toLowerCase();
  const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/u);
  const titleMatch = text.match(/aula\s+([a-z0-9 ]+)/iu);
  const dayLabel =
    ['segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sabado', 'domingo'].find(
      (label) => normalized.includes(label),
    ) ?? targetEvent?.dayLabel ?? 'sexta-feira';

  return {
    title:
      titleMatch?.[0]?.trim() ??
      targetEvent?.title ??
      'Aula criada pelo assistente',
    localDate: targetEvent?.localDate ?? resolveDemoLocalDate(dayLabel),
    dayLabel,
    startTime: timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : targetEvent?.startTime ?? '18:30',
    durationMinutes:
      typeof targetEvent?.durationMinutes === 'number' ? targetEvent.durationMinutes : 60,
    notes: text,
  };
}

function buildDemoAssistantDiff(
  operation: AssistantSchedulePreviewSnapshot['operation'],
  targetEvent: WeeklyPlannerEventSummary | null,
  candidate: AssistantSchedulePreviewSnapshot['candidate'],
): AssistantSchedulePreviewSnapshot['diff'] {
  if (!candidate) {
    return [];
  }

  if (operation === 'delete') {
    return [
      {
        label: 'Estado',
        before: targetEvent ? targetEvent.title : 'Sem evento encontrado',
        after: 'Removido da agenda',
        changed: true,
      },
    ];
  }

  return [
    {
      label: 'Titulo',
      before: targetEvent?.title ?? null,
      after: candidate.title ?? null,
      changed: (targetEvent?.title ?? null) !== (candidate.title ?? null),
    },
    {
      label: 'Dia',
      before: targetEvent?.dayLabel ?? null,
      after: candidate.dayLabel ?? null,
      changed: (targetEvent?.dayLabel ?? null) !== (candidate.dayLabel ?? null),
    },
    {
      label: 'Hora',
      before: targetEvent?.startTime ?? null,
      after: candidate.startTime ?? null,
      changed: (targetEvent?.startTime ?? null) !== (candidate.startTime ?? null),
    },
  ].filter((entry) => entry.before !== null || entry.after !== null);
}

function buildDemoAssistantPreviewSummary(
  operation: AssistantSchedulePreviewSnapshot['operation'],
  title: string | null,
  groupLabel: string | null,
): string {
  const label = title ?? 'evento';
  const group = groupLabel ?? 'grupo atual';

  switch (operation) {
    case 'create':
      return `Criar ${label} em ${group}.`;
    case 'update':
      return `Atualizar ${label} em ${group}.`;
    case 'delete':
      return `Apagar ${label} de ${group}.`;
    default:
      return 'Sem operacao reconhecida.';
  }
}

function normaliseTextForId(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 32);
}

function buildDemoDistributionPlan(state: DemoState, payload: Record<string, unknown>): DistributionPlan {
  const targetGroupJids = readDemoTargetGroupJids(payload);

  if (targetGroupJids.length > 0) {
    return {
      sourceMessageId:
        typeof payload.sourceMessageId === 'string' && payload.sourceMessageId.length > 0
          ? payload.sourceMessageId
          : `preview-${Date.now()}`,
      senderPersonId: typeof payload.personId === 'string' && payload.personId.trim() ? payload.personId.trim() : null,
      senderDisplayName: null,
      matchedRuleIds: [],
      matchedDisciplineCodes: [],
      requiresConfirmation: false,
      targetCount: targetGroupJids.length,
      targets: targetGroupJids.map((groupJid) => {
        const group = state.groups.find((candidate) => candidate.groupJid === groupJid);
        return {
          groupJid,
          preferredSubject: group?.preferredSubject ?? groupJid,
          courseId: group?.courseId ?? null,
          reasons: ['manual_group_selection'],
          dedupeKey: `${payload.sourceMessageId ?? 'preview'}:${groupJid}`,
        };
      }),
    };
  }

  const ruleId = typeof payload.ruleId === 'string' && payload.ruleId.length > 0 ? payload.ruleId : state.routingRules[0]?.ruleId;
  const rule = state.routingRules.find((candidate) => candidate.ruleId === ruleId) ?? state.routingRules[0];

  return {
    sourceMessageId:
      typeof payload.sourceMessageId === 'string' && payload.sourceMessageId.length > 0
        ? payload.sourceMessageId
        : `preview-${Date.now()}`,
    senderPersonId: rule?.personId ?? null,
    senderDisplayName: state.people.find((person) => person.personId === rule?.personId)?.displayName ?? null,
    matchedRuleIds: rule ? [rule.ruleId] : [],
    matchedDisciplineCodes: rule?.targetDisciplineCodes ?? [],
    requiresConfirmation: rule?.requiresConfirmation ?? true,
    targetCount: rule?.targetGroupJids.length ?? 0,
    targets:
      rule?.targetGroupJids.map((groupJid) => {
        const group = state.groups.find((candidate) => candidate.groupJid === groupJid);
        return {
          groupJid,
          preferredSubject: group?.preferredSubject ?? groupJid,
          courseId: group?.courseId ?? null,
          reasons: ['demo_rule_match'],
          dedupeKey: `${payload.sourceMessageId ?? 'preview'}:${groupJid}`,
        };
      }) ?? [],
  };
}

function createDemoDistribution(state: DemoState, payload: Record<string, unknown>): DistributionExecutionResult {
  const plan = buildDemoDistributionPlan(state, payload);
  const mode = payload.mode === 'confirmed' ? 'confirmed' : 'dry_run';
  const nowIso = new Date().toISOString();
  const assetId = typeof payload.assetId === 'string' && payload.assetId.trim() ? payload.assetId.trim() : null;
  const caption = typeof payload.caption === 'string' && payload.caption.trim() ? payload.caption.trim() : null;
  const messageText = typeof payload.messageText === 'string' ? payload.messageText : '';
  const summary: DistributionSummary = {
    instructionId: `instruction-demo-${Date.now()}`,
    sourceType: 'manual_distribution',
    sourceMessageId: plan.sourceMessageId,
    mode,
    status: mode === 'confirmed' ? 'queued' : 'queued',
    targetGroupJids: plan.targets.map((target) => target.groupJid),
    contentKind: assetId ? 'media' : 'text',
    mediaAssetId: assetId,
    caption,
    messagePreview: assetId ? null : messageText,
    actionCounts: {
      pending: plan.targets.length,
      running: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const instruction: Instruction = {
    instructionId: summary.instructionId,
    sourceType: summary.sourceType,
    sourceMessageId: summary.sourceMessageId,
    mode,
    status: 'queued',
    metadata: {
      targetCount: plan.targetCount,
      matchedRuleIds: plan.matchedRuleIds,
    },
    actions: plan.targets.map((target, index) => ({
      actionId: `${summary.instructionId}-action-${index + 1}`,
      type: 'distribution_delivery',
      dedupeKey: target.dedupeKey,
      targetGroupJid: target.groupJid,
      payload: assetId
        ? {
            kind: 'media',
            targetLabel: target.preferredSubject,
            assetId,
            caption,
          }
        : {
            kind: 'text',
            targetLabel: target.preferredSubject,
            messageText,
          },
      status: 'pending',
      attemptCount: 0,
      lastError: null,
      result: null,
      lastAttemptAt: null,
      completedAt: null,
    })),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  state.distributions.unshift(summary);
  state.instructionQueue.unshift(instruction);

  return {
    plan,
    instruction: summary,
  };
}

function createDemoLlmChatResult(state: DemoState, payload: LlmChatInput): LlmChatResult {
  const result: LlmChatResult = {
    runId: `run-demo-${Date.now()}`,
    providerId: state.settings.llmRuntime.effectiveProviderId,
    modelId: state.settings.llmRuntime.effectiveModelId,
    text: `Resposta demo: ${payload.text.slice(0, 80)}`,
  };

  state.llmRuns.unshift({
    runId: result.runId,
    operation: 'chat',
    providerId: result.providerId,
    modelId: result.modelId,
    inputSummary: payload.text.slice(0, 120),
    outputSummary: result.text,
    memoryScope: payload.memoryScope ?? null,
    createdAt: new Date().toISOString(),
  });

  return result;
}

function createDemoLlmRuntimeStatus(
  adminSettings: AdminSettings,
  authRouterStatus: SettingsSnapshot['authRouterStatus'],
): SettingsSnapshot['llmRuntime'] {
  const authReady = Boolean(authRouterStatus?.canonicalExists || (authRouterStatus?.accountCount ?? 0) > 0);

  if (!adminSettings.llm.enabled) {
    return {
      configuredEnabled: adminSettings.llm.enabled,
      mode: 'disabled',
      configuredProviderId: adminSettings.llm.provider,
      configuredModelId: adminSettings.llm.model,
      effectiveProviderId: 'local-deterministic',
      effectiveModelId: 'lume-context-v1',
      fallbackActive: true,
      fallbackReason: 'LLM live desativada na configuracao atual.',
      providerReadiness: [
        {
          providerId: 'codex-oauth',
          label: 'Codex OAuth',
          ready: authReady,
          reason: authReady ? null : 'Auth do Codex em falta neste preview.',
        },
        {
          providerId: 'openai-compat',
          label: 'OpenAI compat',
          ready: true,
          reason: null,
        },
      ],
    };
  }

  const configuredProviderReady =
    adminSettings.llm.provider === 'codex-oauth'
      ? authReady
      : adminSettings.llm.provider === 'openai-compat'
        ? true
        : false;

  if (configuredProviderReady) {
    return {
      configuredEnabled: adminSettings.llm.enabled,
      mode: 'live',
      configuredProviderId: adminSettings.llm.provider,
      configuredModelId: adminSettings.llm.model,
      effectiveProviderId: adminSettings.llm.provider,
      effectiveModelId: adminSettings.llm.model,
      fallbackActive: false,
      fallbackReason: null,
      providerReadiness: [
        {
          providerId: 'codex-oauth',
          label: 'Codex OAuth',
          ready: authReady,
          reason: authReady ? null : 'Auth do Codex em falta neste preview.',
        },
        {
          providerId: 'openai-compat',
          label: 'OpenAI compat',
          ready: true,
          reason: null,
        },
      ],
    };
  }

  return {
    configuredEnabled: adminSettings.llm.enabled,
    mode: 'fallback',
    configuredProviderId: adminSettings.llm.provider,
    configuredModelId: adminSettings.llm.model,
    effectiveProviderId: 'local-deterministic',
    effectiveModelId: 'lume-context-v1',
    fallbackActive: true,
    fallbackReason:
      adminSettings.llm.provider === 'codex-oauth'
        ? 'Auth do Codex em falta no preview, por isso o sistema caiu para fallback deterministico.'
        : 'O provider configurado nao esta pronto neste preview, por isso o sistema caiu para fallback deterministico.',
    providerReadiness: [
      {
        providerId: 'codex-oauth',
        label: 'Codex OAuth',
        ready: authReady,
        reason: authReady ? null : 'Auth do Codex em falta neste preview.',
      },
      {
        providerId: 'openai-compat',
        label: 'OpenAI compat',
        ready: true,
        reason: null,
      },
    ],
  };
}

function prepareDemoCodexAuthRouter(state: DemoState): NonNullable<SettingsSnapshot['authRouterStatus']> {
  return updateDemoCodexAuthRouterState(state, {
    reason: 'demo_manual_prepare',
  });
}

function setDemoCodexAuthRouterEnabled(
  state: DemoState,
  enabled: boolean,
): NonNullable<SettingsSnapshot['authRouterStatus']> {
  const currentStatus = state.settings.authRouterStatus ?? failMissingDemoAuthRouter();
  const nextStatus: NonNullable<SettingsSnapshot['authRouterStatus']> = {
    ...currentStatus,
    enabled,
    accountCount: currentStatus.accounts.filter((account) => account.exists).length,
  };

  state.settings = {
    ...state.settings,
    authRouterStatus: nextStatus,
    llmRuntime: createDemoLlmRuntimeStatus(state.settings.adminSettings, nextStatus),
  };

  return nextStatus;
}

function forceDemoCodexAuthRouterSwitch(
  state: DemoState,
  accountId: string,
): NonNullable<SettingsSnapshot['authRouterStatus']> | null {
  const target = state.settings.authRouterStatus?.accounts.find((account) => account.accountId === accountId);

  if (!target) {
    return null;
  }

  return updateDemoCodexAuthRouterState(state, {
    preferredAccountId: accountId,
    reason: 'demo_manual_force_switch',
    event: 'force_switch',
  });
}

function importDemoCodexAuthAccount(
  state: DemoState,
  input: {
    readonly authJson: string;
    readonly label: string;
  },
): {
  readonly accountId: string;
  readonly label: string;
  readonly sourceFilePath: string;
  readonly created: boolean;
} {
  const status = state.settings.authRouterStatus ?? failMissingDemoAuthRouter();
  const accountId = readDemoCodexAccountId(input.authJson);

  if (!accountId) {
    throw new Error('Nao foi possivel identificar a conta neste auth.json de preview.');
  }

  const existingAccount = status.accounts.find((account) => account.accountId === accountId) ?? null;
  const label = input.label.trim() || existingAccount?.label || `account-${accountId.slice(0, 8)}`;
  const sourceFilePath =
    existingAccount?.sourceFilePath ?? `/home/eliaspc/.codex/imported/${accountId}/auth.json`;
  const nextAccount = {
    ...(existingAccount ?? {
      priority: status.accounts.length + 1,
      kind: 'secondary' as const,
      exists: true,
      contentHash: `demo-hash-${accountId}`,
      bytes: input.authJson.length,
      lastModifiedAt: new Date().toISOString(),
      usage: {
        successCount: 0,
        failureCount: 0,
        consecutiveFailures: 0,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureKind: null,
        lastFailureReason: null,
        cooldownUntil: null,
      },
      quota: null,
    }),
    accountId,
    label,
    sourceFilePath,
    exists: true,
    bytes: input.authJson.length,
    lastModifiedAt: new Date().toISOString(),
  };

  state.settings = {
    ...state.settings,
    authRouterStatus: {
      ...status,
      accounts: [...status.accounts.filter((account) => account.accountId !== accountId), nextAccount],
      accountCount: [...status.accounts.filter((account) => account.accountId !== accountId), nextAccount].length,
    },
  };

  return {
    accountId,
    label,
    sourceFilePath,
    created: existingAccount === null,
  };
}

function updateDemoCodexAuthRouterState(
  state: DemoState,
  options: {
    readonly preferredAccountId?: string;
    readonly reason: string;
    readonly event?: 'prepared' | 'force_switch';
  },
): NonNullable<SettingsSnapshot['authRouterStatus']> {
  const currentStatus = state.settings.authRouterStatus ?? failMissingDemoAuthRouter();
  const existingAccounts = currentStatus.accounts.filter((account) => account.exists);
  const selectedAccount =
    (options.preferredAccountId
      ? existingAccounts.find((account) => account.accountId === options.preferredAccountId)
      : pickBestDemoCodexAccount(existingAccounts)) ?? existingAccounts[0] ?? failMissingDemoAuthRouter();
  const nowIso = new Date().toISOString();
  const previousSelection = currentStatus.currentSelection;
  const switchPerformed = previousSelection?.accountId !== selectedAccount.accountId;
  const backupFilePath = switchPerformed
    ? `${currentStatus.backupDirectoryPath}/${sanitizeTimestampForFile(nowIso)}.json`
    : null;
  const nextStatus: NonNullable<SettingsSnapshot['authRouterStatus']> = {
    ...currentStatus,
    currentSelection: {
      accountId: selectedAccount.accountId,
      label: selectedAccount.label,
      sourceFilePath: selectedAccount.sourceFilePath,
      canonicalAuthFilePath: currentStatus.canonicalAuthFilePath,
      selectedAt: nowIso,
      switchPerformed,
      backupFilePath,
      reason: options.reason,
      contentHash: selectedAccount.contentHash,
    },
    lastPreparedAt: nowIso,
    lastSwitchAt: switchPerformed ? nowIso : currentStatus.lastSwitchAt,
    lastError: null,
    accountCount: currentStatus.accounts.filter((account) => account.exists).length,
    switchHistory: [
      ...currentStatus.switchHistory,
      {
        auditId: `demo-codex-auth-${sanitizeTimestampForFile(nowIso)}`,
        event: options.event ?? 'prepared',
        accountId: selectedAccount.accountId,
        label: selectedAccount.label,
        sourceFilePath: selectedAccount.sourceFilePath,
        canonicalAuthFilePath: currentStatus.canonicalAuthFilePath,
        createdAt: nowIso,
        switchPerformed,
        backupFilePath,
        reason: options.reason,
        failureKind: null,
      },
    ].slice(-12),
  };

  state.settings = {
    ...state.settings,
    authRouterStatus: nextStatus,
    llmRuntime: createDemoLlmRuntimeStatus(state.settings.adminSettings, nextStatus),
    hostStatus: {
      ...state.settings.hostStatus,
      authRouter: {
        ...state.settings.hostStatus.authRouter,
        canonicalAuthFilePath: nextStatus.canonicalAuthFilePath,
        currentAccountId: selectedAccount.accountId,
        currentSourceFilePath: selectedAccount.sourceFilePath,
        accountCount: nextStatus.accountCount,
        lastSwitchAt: nextStatus.lastSwitchAt,
      },
    },
  };

  return nextStatus;
}

function pickBestDemoCodexAccount(
  accounts: NonNullable<SettingsSnapshot['authRouterStatus']>['accounts'],
): NonNullable<SettingsSnapshot['authRouterStatus']>['accounts'][number] | null {
  if (accounts.length === 0) {
    return null;
  }

  return (
    accounts
      .slice()
      .sort((left, right) => right.priority - left.priority)
      .find((account) => account.usage.cooldownUntil == null) ?? accounts[0]
  );
}

function sanitizeTimestampForFile(value: string): string {
  return value.replaceAll(':', '-').replaceAll('.', '-');
}

function failMissingDemoAuthRouter(): never {
  throw new Error('Demo codex auth router is not available.');
}

function readDemoCodexAccountId(authJson: string): string {
  try {
    const parsed = JSON.parse(authJson) as {
      readonly tokens?: {
        readonly account_id?: unknown;
      };
    };
    return typeof parsed.tokens?.account_id === 'string' ? parsed.tokens.account_id.trim() : '';
  } catch {
    return '';
  }
}

function readDemoTargetGroupJids(payload: Record<string, unknown>): string[] {
  const value = payload.targetGroupJids;

  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean))];
}

function readRecentDemoEntries<T>(entries: readonly T[], pathname: string, fallbackLimit: number): readonly T[] {
  const url = new URL(pathname, 'http://lumehub.preview');
  const limit = Number.parseInt(url.searchParams.get('limit') ?? String(fallbackLimit), 10);
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : fallbackLimit;
  return entries.slice(0, safeLimit);
}

function dedupeStringList(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function resolveDemoLocalDate(dayLabel: string): string {
  switch (dayLabel) {
    case 'segunda-feira':
      return '2026-03-23';
    case 'terca-feira':
    case 'terça-feira':
      return '2026-03-24';
    case 'quarta-feira':
      return '2026-03-25';
    case 'quinta-feira':
      return '2026-03-26';
    case 'sabado':
    case 'sábado':
      return '2026-03-28';
    case 'domingo':
      return '2026-03-29';
    case 'sexta-feira':
    default:
      return '2026-03-27';
  }
}

function mapPersonToConversationSummary(
  person: Person,
  ownedGroupsByPersonId: ReadonlyMap<string, readonly string[]>,
  commands: CommandsPolicySettings,
  whatsappEnabled: boolean,
  allowAllPrivateChats: boolean,
): WhatsAppConversationSummary {
  const whatsappJids = person.identifiers
    .filter((identifier) => identifier.kind === 'whatsapp_jid')
    .map((identifier) => identifier.value);

  return {
    personId: person.personId,
    displayName: person.displayName,
    whatsappJids,
    globalRoles: person.globalRoles,
    privateAssistantAuthorized:
      commands.assistantEnabled &&
      whatsappEnabled &&
      commands.allowPrivateAssistant &&
      whatsappJids.length > 0 &&
      (allowAllPrivateChats || whatsappJids.some((chatJid) => commands.authorizedPrivateJids.includes(chatJid))),
    ownedGroupJids: ownedGroupsByPersonId.get(person.personId) ?? [],
    knownToBot: whatsappJids.length > 0,
  };
}

function matchParameterizedPath(pathname: string, template: string): Record<string, string> | null {
  const pathSegments = pathname.split('/').filter(Boolean);
  const templateSegments = template.split('/').filter(Boolean);

  if (pathSegments.length !== templateSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < templateSegments.length; index += 1) {
    const templateSegment = templateSegments[index];
    const pathSegment = pathSegments[index];

    if (templateSegment.startsWith(':')) {
      params[templateSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }

    if (templateSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}

function compareByLabel(
  left: { readonly displayName?: string; readonly preferredSubject?: string },
  right: { readonly displayName?: string; readonly preferredSubject?: string },
): number {
  const leftLabel = left.displayName ?? left.preferredSubject ?? '';
  const rightLabel = right.displayName ?? right.preferredSubject ?? '';
  return leftLabel.localeCompare(rightLabel, 'pt-PT');
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function basenameWithoutJson(fileName: string): string {
  return fileName.replace(/\.json$/iu, '');
}

function readFrontendBootConfig(): FrontendBootConfig {
  return window.__LUMEHUB_BOOT_CONFIG__ ?? {};
}

function normaliseWebSocketPath(path = '/ws'): string {
  const trimmed = path.trim();

  if (!trimmed) {
    return '/ws';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function parseHttpBody<T>(rawBody: string, contentType: string | null): T {
  if (rawBody.length === 0) {
    return undefined as T;
  }

  const normalizedBody = rawBody.trimStart();
  const declaredJson = contentType?.includes('application/json') ?? false;
  const looksJson = normalizedBody.startsWith('{') || normalizedBody.startsWith('[');

  if (declaredJson || looksJson) {
    try {
      return JSON.parse(rawBody) as T;
    } catch {
      throw new Error(
        'A ligacao live respondeu dados invalidos. Confirma se a API HTTP do LumeHub esta mesmo ativa nesta porta.',
      );
    }
  }

  if (normalizedBody.startsWith('<')) {
    throw new Error(
      'A ligacao live abriu a pagina web, mas nao encontrou a API do LumeHub nesta porta. Usa Demo ou arranca o backend HTTP real.',
    );
  }

  throw new Error(
    'A ligacao live respondeu num formato inesperado. Confirma se o backend do LumeHub esta a expor JSON nesta porta.',
  );
}
