import type {
  AdminSettings,
  CommandsPolicySettings,
  LlmRuntimeStatusSnapshot,
  UiSettings,
  WhatsAppSettings,
} from '@lume-hub/admin-config';
import type {
  DistributionPlan,
  SenderAudienceRule,
  SenderAudienceRuleUpsertInput,
} from '@lume-hub/audience-routing';
import type { CodexAuthRouterStatus } from '@lume-hub/codex-auth-router';
import type { ConversationAuditRecord } from '@lume-hub/conversation';
import type { HealthSnapshot } from '@lume-hub/health-monitor';
import type { HostCompanionStatus } from '@lume-hub/host-lifecycle';
import type { DistributionContentInput, Instruction } from '@lume-hub/instruction-queue';
import type {
  CalendarAccessMode,
  Group,
  GroupCalendarAccessPolicy,
  GroupOwnerAssignment,
  GroupOwnerAssignmentInput,
} from '@lume-hub/group-directory';
import type { LlmChatInput, LlmChatResult, LlmModelDescriptor, LlmRunLogEntry } from '@lume-hub/llm-orchestrator';
import type { MediaAsset } from '@lume-hub/media-library';
import type { Person, PersonRole, PersonUpsertInput } from '@lume-hub/people-memory';
import type { PowerPolicyUpdate, PowerStatus } from '@lume-hub/system-power';
import type { WatchdogIssue } from '@lume-hub/watchdog';
import type {
  WeeklyPlannerEventSummary,
  WeeklyPlannerQuery,
  WeeklyPlannerSnapshot,
  WeeklyPlannerUpsertInput,
} from '@lume-hub/weekly-planner';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface FrontendApiRequest {
  readonly method: HttpMethod;
  readonly path: string;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
}

export interface FrontendApiResponse<T = unknown> {
  readonly statusCode: number;
  readonly body: T;
}

export interface FrontendUiEvent {
  readonly eventId: string;
  readonly topic: string;
  readonly emittedAt: string;
  readonly payload: unknown;
}

export interface FrontendEventSource {
  subscribe(listener: (event: FrontendUiEvent) => void): () => void;
}

export interface FrontendApiServerLike {
  inject<T = unknown>(request: FrontendApiRequest): Promise<FrontendApiResponse<T>>;
}

export interface FrontendApiTransport {
  request<T = unknown>(request: FrontendApiRequest): Promise<FrontendApiResponse<T>>;
  subscribe?(listener: (event: FrontendUiEvent) => void): () => void;
}

export interface DistributionSummary {
  readonly instructionId: string;
  readonly sourceType: string;
  readonly sourceMessageId: string | null;
  readonly mode: Instruction['mode'];
  readonly status: Instruction['status'];
  readonly targetGroupJids: readonly string[];
  readonly contentKind?: DistributionContentInput['kind'] | null;
  readonly mediaAssetId?: string | null;
  readonly caption?: string | null;
  readonly messagePreview?: string | null;
  readonly actionCounts: Record<Instruction['actions'][number]['status'], number>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DashboardSnapshot {
  readonly health: HealthSnapshot;
  readonly readiness: {
    readonly ready: boolean;
    readonly status: HealthSnapshot['status'];
  };
  readonly groups: {
    readonly total: number;
    readonly withOwners: number;
    readonly readWriteGroupOwnerAccess: number;
  };
  readonly routing: {
    readonly totalRules: number;
    readonly confirmationRules: number;
    readonly totalPlannedTargets: number;
  };
  readonly distributions: {
    readonly total: number;
    readonly queued: number;
    readonly running: number;
    readonly completed: number;
    readonly partialFailed: number;
    readonly failed: number;
  };
  readonly watchdog: {
    readonly openIssues: number;
    readonly recentIssues: readonly Pick<WatchdogIssue, 'issueId' | 'kind' | 'groupLabel' | 'summary' | 'openedAt'>[];
  };
  readonly hostCompanion: {
    readonly hostId: string;
    readonly authExists: boolean;
    readonly sameAsCodexCanonical: boolean;
    readonly autostartEnabled: boolean;
    readonly lastHeartbeatAt: string | null;
    readonly lastError: string | null;
  };
  readonly whatsapp: {
    readonly phase: 'disabled' | 'idle' | 'connecting' | 'qr_pending' | 'open' | 'closed' | 'error';
    readonly connected: boolean;
    readonly loginRequired: boolean;
    readonly discoveredGroups: number;
    readonly discoveredConversations: number;
  };
}

export interface StatusSnapshot {
  readonly readiness: DashboardSnapshot['readiness'];
  readonly health: DashboardSnapshot['health'];
  readonly groups: DashboardSnapshot['groups'];
  readonly routing: DashboardSnapshot['routing'];
  readonly distributions: DashboardSnapshot['distributions'];
  readonly watchdog: DashboardSnapshot['watchdog'];
  readonly hostCompanion: DashboardSnapshot['hostCompanion'];
  readonly whatsapp: DashboardSnapshot['whatsapp'];
  readonly generatedAt: string;
}

export interface SettingsSnapshot {
  readonly adminSettings: AdminSettings;
  readonly llmRuntime: LlmRuntimeStatusSnapshot;
  readonly powerStatus: PowerStatus;
  readonly hostStatus: HostCompanionStatus;
  readonly authRouterStatus: CodexAuthRouterStatus | null;
}

export interface WhatsAppConversationSummary {
  readonly personId: string | null;
  readonly displayName: string;
  readonly whatsappJids: readonly string[];
  readonly globalRoles: readonly PersonRole[];
  readonly privateAssistantAuthorized: boolean;
  readonly ownedGroupJids: readonly string[];
  readonly knownToBot: boolean;
}

export interface WhatsAppGroupSummary {
  readonly groupJid: string;
  readonly preferredSubject: string;
  readonly aliases: readonly string[];
  readonly courseId: string | null;
  readonly ownerPersonIds: readonly string[];
  readonly ownerLabels: readonly string[];
  readonly assistantAuthorized: boolean;
  readonly calendarAccessPolicy: GroupCalendarAccessPolicy;
  readonly lastRefreshedAt: string | null;
  readonly knownToBot: boolean;
}

export interface WhatsAppWorkspaceSnapshot {
  readonly settings: {
    readonly commands: CommandsPolicySettings;
    readonly whatsapp: WhatsAppSettings;
  };
  readonly runtime: {
    readonly session: {
      readonly phase: 'disabled' | 'idle' | 'connecting' | 'qr_pending' | 'open' | 'closed' | 'error';
      readonly connected: boolean;
      readonly loginRequired: boolean;
      readonly sessionPresent: boolean;
      readonly lastQrAt: string | null;
      readonly lastConnectedAt: string | null;
      readonly lastDisconnectAt: string | null;
      readonly lastDisconnectReason: string | null;
      readonly lastError: string | null;
      readonly selfJid: string | null;
      readonly pushName: string | null;
    };
    readonly qr: {
      readonly available: boolean;
      readonly value: string | null;
      readonly svg: string | null;
      readonly updatedAt: string | null;
      readonly expiresAt: string | null;
    };
    readonly discoveredGroups: number;
    readonly discoveredConversations: number;
    readonly lastDiscoveryAt: string | null;
  };
  readonly host: {
    readonly authFilePath: string;
    readonly canonicalAuthFilePath: string | null;
    readonly authExists: boolean;
    readonly sameAsCodexCanonical: boolean;
    readonly autostartEnabled: boolean;
    readonly lastHeartbeatAt: string | null;
  };
  readonly groups: readonly WhatsAppGroupSummary[];
  readonly conversations: readonly WhatsAppConversationSummary[];
  readonly appOwners: readonly WhatsAppConversationSummary[];
  readonly permissionSummary: {
    readonly knownGroups: number;
    readonly authorizedGroups: number;
    readonly knownPrivateConversations: number;
    readonly authorizedPrivateConversations: number;
    readonly appOwners: number;
  };
}

export interface GroupKnowledgeDocumentSnapshot {
  readonly groupJid: string;
  readonly documentId: string;
  readonly filePath: string;
  readonly absoluteFilePath: string;
  readonly title: string;
  readonly summary: string | null;
  readonly aliases: readonly string[];
  readonly tags: readonly string[];
  readonly enabled: boolean;
  readonly exists: boolean;
  readonly content: string | null;
}

export interface GroupIntelligenceSnapshot {
  readonly groupJid: string;
  readonly instructions: {
    readonly primaryFilePath: string;
    readonly resolvedFilePath: string | null;
    readonly exists: boolean;
    readonly source: 'llm_instructions' | 'missing';
    readonly content: string | null;
  };
  readonly knowledge: {
    readonly indexFilePath: string;
    readonly exists: boolean;
    readonly documents: readonly GroupKnowledgeDocumentSnapshot[];
  };
}

export interface GroupKnowledgeDocumentUpsertPayload {
  readonly documentId: string;
  readonly filePath: string;
  readonly title: string;
  readonly summary?: string | null;
  readonly aliases?: readonly string[];
  readonly tags?: readonly string[];
  readonly enabled?: boolean;
  readonly content: string;
}

export interface GroupContextPreviewSnapshot {
  readonly chatJid: string;
  readonly chatType: 'group' | 'private';
  readonly currentText: string;
  readonly personId: string | null;
  readonly senderDisplayName: string | null;
  readonly groupJid: string | null;
  readonly group: {
    readonly groupJid: string;
    readonly preferredSubject: string;
    readonly aliases: readonly string[];
    readonly courseId: string | null;
  } | null;
  readonly groupInstructions: string | null;
  readonly groupInstructionsSource: 'llm_instructions' | 'missing';
  readonly groupKnowledgeSnippets: readonly {
    readonly groupJid: string;
    readonly documentId: string;
    readonly title: string;
    readonly filePath: string;
    readonly absoluteFilePath: string;
    readonly score: number;
    readonly excerpt: string;
    readonly matchedTerms: readonly string[];
    readonly source: 'group_knowledge';
  }[];
  readonly groupPolicy: Record<string, unknown> | null;
  readonly generatedAt: string;
}

export type MediaAssetSnapshot = MediaAsset;

export interface WorkspaceFileSnapshot {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly extension: string;
}

export interface WorkspaceFileContentSnapshot {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly content: string;
  readonly sizeBytes: number;
  readonly truncated: boolean;
}

export interface WorkspaceAgentRunSnapshot {
  readonly runId: string;
  readonly mode: 'plan' | 'apply';
  readonly prompt: string;
  readonly filePaths: readonly string[];
  readonly requestedBy: string;
  readonly approvalState: 'not_required' | 'confirmed' | 'missing_confirmation';
  readonly executionState: 'executed' | 'rejected';
  readonly startedAt: string;
  readonly completedAt: string;
  readonly status: 'completed' | 'failed';
  readonly outputSummary: string;
  readonly guardrailReason: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly changedFiles: readonly string[];
  readonly structuredSummary: {
    readonly summary: string;
    readonly suggestedFiles: readonly string[];
    readonly readFiles: readonly string[];
    readonly notes: readonly string[];
  };
  readonly fileDiffs: readonly {
    readonly relativePath: string;
    readonly changeType: 'added' | 'modified' | 'deleted';
    readonly beforeStatus: string | null;
    readonly afterStatus: string | null;
    readonly diffText: string;
  }[];
}

export interface WorkspaceAgentStatusSnapshot {
  readonly busy: boolean;
  readonly activeRunId: string | null;
  readonly activeMode: 'plan' | 'apply' | null;
  readonly activePromptSummary: string | null;
  readonly activeStartedAt: string | null;
  readonly lastCompletedAt: string | null;
  readonly lastRejectedAt: string | null;
  readonly lastRejectedReason: string | null;
  readonly requiresApplyConfirmation: boolean;
  readonly maxFocusedFiles: number;
}

export interface DistributionExecutionResult {
  readonly plan: DistributionPlan;
  readonly instruction: DistributionSummary;
}

export class InMemoryFrontendApiTransport implements FrontendApiTransport {
  constructor(
    private readonly server: FrontendApiServerLike,
    private readonly eventSource?: FrontendEventSource,
  ) {}

  async request<T = unknown>(request: FrontendApiRequest): Promise<FrontendApiResponse<T>> {
    return this.server.inject<T>(request);
  }

  subscribe(listener: (event: FrontendUiEvent) => void): () => void {
    return this.eventSource?.subscribe(listener) ?? (() => {});
  }
}

export class FrontendApiClient {
  constructor(private readonly transport: FrontendApiTransport) {}

  async getDashboard(): Promise<DashboardSnapshot> {
    return this.expectOk(await this.transport.request<DashboardSnapshot>({ method: 'GET', path: '/api/dashboard' }));
  }

  async getStatus(): Promise<StatusSnapshot> {
    return this.expectOk(await this.transport.request<StatusSnapshot>({ method: 'GET', path: '/api/status' }));
  }

  async getWeeklyPlanner(query: WeeklyPlannerQuery = {}): Promise<WeeklyPlannerSnapshot> {
    const params = new URLSearchParams();

    if (query.weekId) {
      params.set('weekId', query.weekId);
    }

    if (query.groupJid) {
      params.set('groupJid', query.groupJid);
    }

    if (query.timeZone) {
      params.set('timeZone', query.timeZone);
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return this.expectOk(
      await this.transport.request<WeeklyPlannerSnapshot>({
        method: 'GET',
        path: `/api/schedules${suffix}`,
      }),
    );
  }

  async saveWeeklySchedule(input: WeeklyPlannerUpsertInput): Promise<WeeklyPlannerEventSummary> {
    return this.expectOk(
      await this.transport.request<WeeklyPlannerEventSummary>({
        method: input.eventId ? 'PATCH' : 'POST',
        path: input.eventId ? `/api/schedules/${encodeURIComponent(input.eventId)}` : '/api/schedules',
        body: input,
      }),
    );
  }

  async deleteWeeklySchedule(eventId: string, groupJid?: string): Promise<{ readonly deleted: boolean }> {
    const suffix = groupJid ? `?groupJid=${encodeURIComponent(groupJid)}` : '';
    return this.expectOk(
      await this.transport.request<{ readonly deleted: boolean }>({
        method: 'DELETE',
        path: `/api/schedules/${encodeURIComponent(eventId)}${suffix}`,
      }),
    );
  }

  async listGroups(): Promise<readonly Group[]> {
    return this.expectOk(await this.transport.request<readonly Group[]>({ method: 'GET', path: '/api/groups' }));
  }

  async listMediaAssets(): Promise<readonly MediaAssetSnapshot[]> {
    return this.expectOk(
      await this.transport.request<readonly MediaAssetSnapshot[]>({
        method: 'GET',
        path: '/api/media/assets',
      }),
    );
  }

  async getMediaAsset(assetId: string): Promise<MediaAssetSnapshot> {
    return this.expectOk(
      await this.transport.request<MediaAssetSnapshot>({
        method: 'GET',
        path: `/api/media/assets/${encodeURIComponent(assetId)}`,
      }),
    );
  }

  async searchWorkspaceFiles(query?: string, limit = 80): Promise<readonly WorkspaceFileSnapshot[]> {
    const params = new URLSearchParams();

    if (query && query.trim().length > 0) {
      params.set('query', query.trim());
    }

    params.set('limit', String(limit));
    return this.expectOk(
      await this.transport.request<readonly WorkspaceFileSnapshot[]>({
        method: 'GET',
        path: `/api/workspace/files?${params.toString()}`,
      }),
    );
  }

  async getWorkspaceFile(relativePath: string): Promise<WorkspaceFileContentSnapshot> {
    return this.expectOk(
      await this.transport.request<WorkspaceFileContentSnapshot>({
        method: 'GET',
        path: `/api/workspace/file?path=${encodeURIComponent(relativePath)}`,
      }),
    );
  }

  async listWorkspaceAgentRuns(limit = 12): Promise<readonly WorkspaceAgentRunSnapshot[]> {
    return this.expectOk(
      await this.transport.request<readonly WorkspaceAgentRunSnapshot[]>({
        method: 'GET',
        path: `/api/workspace/runs?limit=${limit}`,
      }),
    );
  }

  async getWorkspaceAgentStatus(): Promise<WorkspaceAgentStatusSnapshot> {
    return this.expectOk(
      await this.transport.request<WorkspaceAgentStatusSnapshot>({
        method: 'GET',
        path: '/api/workspace/status',
      }),
    );
  }

  async runWorkspaceAgent(input: {
    readonly prompt: string;
    readonly mode?: 'plan' | 'apply';
    readonly filePaths?: readonly string[];
    readonly confirmedApply?: boolean;
    readonly requestedBy?: string | null;
  }): Promise<WorkspaceAgentRunSnapshot> {
    return this.expectOk(
      await this.transport.request<WorkspaceAgentRunSnapshot>({
        method: 'POST',
        path: '/api/workspace/agent/runs',
        body: input,
      }),
    );
  }

  async replaceGroupOwners(
    groupJid: string,
    owners: readonly GroupOwnerAssignmentInput[],
  ): Promise<readonly GroupOwnerAssignment[]> {
    return this.expectOk(
      await this.transport.request<readonly GroupOwnerAssignment[]>({
        method: 'PUT',
        path: `/api/groups/${encodeURIComponent(groupJid)}/owners`,
        body: {
          owners,
        },
      }),
    );
  }

  async updateGroupCalendarAccessPolicy(
    groupJid: string,
    update: Partial<GroupCalendarAccessPolicy>,
  ): Promise<GroupCalendarAccessPolicy> {
    return this.expectOk(
      await this.transport.request<GroupCalendarAccessPolicy>({
        method: 'PATCH',
        path: `/api/groups/${encodeURIComponent(groupJid)}/calendar-access`,
        body: update,
      }),
    );
  }

  async getGroupIntelligence(groupJid: string): Promise<GroupIntelligenceSnapshot> {
    return this.expectOk(
      await this.transport.request<GroupIntelligenceSnapshot>({
        method: 'GET',
        path: `/api/groups/${encodeURIComponent(groupJid)}/intelligence`,
      }),
    );
  }

  async updateGroupLlmInstructions(groupJid: string, content: string): Promise<GroupIntelligenceSnapshot['instructions']> {
    return this.expectOk(
      await this.transport.request<GroupIntelligenceSnapshot['instructions']>({
        method: 'PUT',
        path: `/api/groups/${encodeURIComponent(groupJid)}/llm-instructions`,
        body: {
          content,
        },
      }),
    );
  }

  async upsertGroupKnowledgeDocument(
    groupJid: string,
    input: GroupKnowledgeDocumentUpsertPayload,
  ): Promise<GroupKnowledgeDocumentSnapshot> {
    return this.expectOk(
      await this.transport.request<GroupKnowledgeDocumentSnapshot>({
        method: 'POST',
        path: `/api/groups/${encodeURIComponent(groupJid)}/knowledge/documents`,
        body: input,
      }),
    );
  }

  async deleteGroupKnowledgeDocument(
    groupJid: string,
    documentId: string,
  ): Promise<{ readonly deleted: boolean; readonly documentId: string; readonly filePath: string | null }> {
    return this.expectOk(
      await this.transport.request<{ readonly deleted: boolean; readonly documentId: string; readonly filePath: string | null }>({
        method: 'DELETE',
        path: `/api/groups/${encodeURIComponent(groupJid)}/knowledge/documents/${encodeURIComponent(documentId)}`,
      }),
    );
  }

  async previewGroupContext(
    groupJid: string,
    input: {
      readonly text: string;
      readonly personId?: string | null;
      readonly senderDisplayName?: string | null;
    },
  ): Promise<GroupContextPreviewSnapshot> {
    return this.expectOk(
      await this.transport.request<GroupContextPreviewSnapshot>({
        method: 'POST',
        path: `/api/groups/${encodeURIComponent(groupJid)}/context-preview`,
        body: input,
      }),
    );
  }

  async listRoutingRules(): Promise<readonly SenderAudienceRule[]> {
    return this.expectOk(
      await this.transport.request<readonly SenderAudienceRule[]>({
        method: 'GET',
        path: '/api/routing/rules',
      }),
    );
  }

  async upsertRoutingRule(input: SenderAudienceRuleUpsertInput): Promise<SenderAudienceRule> {
    return this.expectOk(
      await this.transport.request<SenderAudienceRule>({
        method: 'POST',
        path: '/api/routing/rules',
        body: input,
      }),
    );
  }

  async listDistributions(): Promise<readonly DistributionSummary[]> {
    return this.expectOk(
      await this.transport.request<readonly DistributionSummary[]>({
        method: 'GET',
        path: '/api/routing/distributions',
      }),
    );
  }

  async previewDistribution(input: {
    readonly sourceMessageId?: string;
    readonly personId?: string;
    readonly identifiers?: readonly { readonly kind: string; readonly value: string }[];
    readonly messageText?: string;
    readonly targetGroupJids?: readonly string[];
  }): Promise<DistributionPlan> {
    return this.expectOk(
      await this.transport.request<DistributionPlan>({
        method: 'POST',
        path: '/api/routing/preview',
        body: input,
      }),
    );
  }

  async createDistribution(input: {
    readonly sourceMessageId?: string;
    readonly personId?: string;
    readonly identifiers?: readonly { readonly kind: string; readonly value: string }[];
    readonly messageText?: string;
    readonly assetId?: string;
    readonly caption?: string | null;
    readonly targetGroupJids?: readonly string[];
    readonly mode: Instruction['mode'];
  }): Promise<DistributionExecutionResult> {
    return this.expectOk(
      await this.transport.request<DistributionExecutionResult>({
        method: 'POST',
        path: '/api/routing/distributions',
        body: input,
      }),
    );
  }

  async listInstructionQueue(): Promise<readonly Instruction[]> {
    return this.expectOk(
      await this.transport.request<readonly Instruction[]>({
        method: 'GET',
        path: '/api/instruction-queue',
      }),
    );
  }

  async retryInstruction(instructionId: string): Promise<Instruction> {
    return this.expectOk(
      await this.transport.request<Instruction>({
        method: 'POST',
        path: `/api/instruction-queue/${encodeURIComponent(instructionId)}/retry`,
      }),
    );
  }

  async getWatchdogIssues(): Promise<readonly WatchdogIssue[]> {
    return this.expectOk(
      await this.transport.request<readonly WatchdogIssue[]>({
        method: 'GET',
        path: '/api/watchdog/issues',
      }),
    );
  }

  async resolveWatchdogIssue(issueId: string): Promise<WatchdogIssue | undefined> {
    return this.expectOk(
      await this.transport.request<WatchdogIssue | undefined>({
        method: 'POST',
        path: `/api/watchdog/issues/${encodeURIComponent(issueId)}/resolve`,
      }),
    );
  }

  async getSettings(): Promise<SettingsSnapshot> {
    return this.expectOk(
      await this.transport.request<SettingsSnapshot>({
        method: 'GET',
        path: '/api/settings',
      }),
    );
  }

  async getWhatsAppWorkspace(): Promise<WhatsAppWorkspaceSnapshot> {
    return this.expectOk(
      await this.transport.request<WhatsAppWorkspaceSnapshot>({
        method: 'GET',
        path: '/api/whatsapp/workspace',
      }),
    );
  }

  async getQr(): Promise<WhatsAppWorkspaceSnapshot['runtime']['qr']> {
    return this.expectOk(
      await this.transport.request<WhatsAppWorkspaceSnapshot['runtime']['qr']>({
        method: 'GET',
        path: '/api/qr',
      }),
    );
  }

  async sendDirectMessage(input: {
    readonly chatJid: string;
    readonly text: string;
    readonly idempotencyKey?: string;
    readonly messageId?: string;
  }): Promise<{
    readonly messageId: string;
    readonly chatJid: string;
    readonly acceptedAt: string;
    readonly idempotencyKey?: string;
  }> {
    return this.expectOk(
      await this.transport.request<{
        readonly messageId: string;
        readonly chatJid: string;
        readonly acceptedAt: string;
        readonly idempotencyKey?: string;
      }>({
        method: 'POST',
        path: '/api/send',
        body: input,
      }),
    );
  }

  async refreshWhatsAppWorkspace(): Promise<WhatsAppWorkspaceSnapshot> {
    return this.expectOk(
      await this.transport.request<WhatsAppWorkspaceSnapshot>({
        method: 'POST',
        path: '/api/whatsapp/refresh',
      }),
    );
  }

  async listPeople(): Promise<readonly Person[]> {
    return this.expectOk(
      await this.transport.request<readonly Person[]>({
        method: 'GET',
        path: '/api/people',
      }),
    );
  }

  async upsertPerson(input: PersonUpsertInput): Promise<Person> {
    return this.expectOk(
      await this.transport.request<Person>({
        method: 'POST',
        path: '/api/people',
        body: input,
      }),
    );
  }

  async updatePersonRoles(personId: string, globalRoles: readonly PersonRole[]): Promise<Person> {
    return this.expectOk(
      await this.transport.request<Person>({
        method: 'PUT',
        path: `/api/people/${encodeURIComponent(personId)}/roles`,
        body: {
          globalRoles,
        },
      }),
    );
  }

  async updateCommandSettings(update: Partial<CommandsPolicySettings>): Promise<AdminSettings> {
    return this.expectOk(
      await this.transport.request<AdminSettings>({
        method: 'PATCH',
        path: '/api/settings/commands',
        body: update,
      }),
    );
  }

  async updateWhatsAppSettings(update: Partial<WhatsAppSettings>): Promise<AdminSettings> {
    return this.expectOk(
      await this.transport.request<AdminSettings>({
        method: 'PATCH',
        path: '/api/settings/whatsapp',
        body: update,
      }),
    );
  }

  async updateDefaultNotificationRules(defaultNotificationRules: UiSettings['defaultNotificationRules']): Promise<AdminSettings> {
    return this.expectOk(
      await this.transport.request<AdminSettings>({
        method: 'PATCH',
        path: '/api/settings/ui',
        body: {
          defaultNotificationRules,
        },
      }),
    );
  }

  async listLlmModels(options: {
    readonly refresh?: boolean;
    readonly providerId?: string;
  } = {}): Promise<readonly LlmModelDescriptor[]> {
    const params = new URLSearchParams();

    if (options.refresh !== undefined) {
      params.set('refresh', String(options.refresh));
    }

    if (options.providerId) {
      params.set('providerId', options.providerId);
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return this.expectOk(
      await this.transport.request<readonly LlmModelDescriptor[]>({
        method: 'GET',
        path: `/api/llm/models${suffix}`,
      }),
    );
  }

  async llmChat(input: LlmChatInput): Promise<LlmChatResult> {
    return this.expectOk(
      await this.transport.request<LlmChatResult>({
        method: 'POST',
        path: '/api/llm/chat',
        body: input,
      }),
    );
  }

  async listLlmLogs(limit = 20): Promise<readonly LlmRunLogEntry[]> {
    return this.expectOk(
      await this.transport.request<readonly LlmRunLogEntry[]>({
        method: 'GET',
        path: `/api/logs/llm?limit=${limit}`,
      }),
    );
  }

  async listConversationLogs(limit = 20): Promise<readonly ConversationAuditRecord[]> {
    return this.expectOk(
      await this.transport.request<readonly ConversationAuditRecord[]>({
        method: 'GET',
        path: `/api/logs/conversations?limit=${limit}`,
      }),
    );
  }

  async getCodexAuthRouterStatus(): Promise<CodexAuthRouterStatus | null> {
    return this.expectOk(
      await this.transport.request<CodexAuthRouterStatus | null>({
        method: 'GET',
        path: '/api/settings/codex-auth-router',
      }),
    );
  }

  async forceCodexAuthSwitch(accountId: string): Promise<CodexAuthRouterStatus> {
    return this.expectOk(
      await this.transport.request<CodexAuthRouterStatus>({
        method: 'POST',
        path: '/api/settings/codex-auth-router/switch',
        body: {
          accountId,
        },
      }),
    );
  }

  async updatePowerPolicy(update: PowerPolicyUpdate): Promise<PowerStatus> {
    return this.expectOk(
      await this.transport.request<PowerStatus>({
        method: 'PATCH',
        path: '/api/settings/power-policy',
        body: update,
      }),
    );
  }

  async setAutostartEnabled(enabled: boolean): Promise<HostCompanionStatus> {
    return this.expectOk(
      await this.transport.request<HostCompanionStatus>({
        method: 'PATCH',
        path: '/api/settings/autostart',
        body: {
          enabled,
        },
      }),
    );
  }

  subscribe(listener: (event: FrontendUiEvent) => void): (() => void) | undefined {
    return this.transport.subscribe?.(listener);
  }

  private expectOk<T>(response: FrontendApiResponse<T>): T {
    if (response.statusCode >= 400) {
      const reason =
        response.body && typeof response.body === 'object' && 'error' in (response.body as Record<string, unknown>)
          ? String((response.body as Record<string, unknown>).error)
          : `Request failed with status ${response.statusCode}.`;
      throw new Error(reason);
    }

    return response.body;
  }
}

export type {
  AdminSettings,
  ConversationAuditRecord,
  CommandsPolicySettings,
  CalendarAccessMode,
  DistributionPlan,
  Group,
  GroupCalendarAccessPolicy,
  GroupOwnerAssignment,
  GroupOwnerAssignmentInput,
  HostCompanionStatus,
  Instruction,
  LlmChatInput,
  LlmChatResult,
  LlmModelDescriptor,
  LlmRunLogEntry,
  Person,
  PersonRole,
  PersonUpsertInput,
  PowerStatus,
  SenderAudienceRule,
  SenderAudienceRuleUpsertInput,
  WhatsAppSettings,
  WatchdogIssue,
  WeeklyPlannerEventSummary,
  WeeklyPlannerQuery,
  WeeklyPlannerSnapshot,
  WeeklyPlannerUpsertInput,
};
