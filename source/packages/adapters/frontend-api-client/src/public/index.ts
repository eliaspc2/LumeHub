import type { AdminSettings, CommandsPolicySettings, UiSettings, WhatsAppSettings } from '@lume-hub/admin-config';
import type {
  DistributionPlan,
  SenderAudienceRule,
  SenderAudienceRuleUpsertInput,
} from '@lume-hub/audience-routing';
import type { CodexAuthRouterStatus } from '@lume-hub/codex-auth-router';
import type { HealthSnapshot } from '@lume-hub/health-monitor';
import type { HostCompanionStatus } from '@lume-hub/host-lifecycle';
import type { Instruction } from '@lume-hub/instruction-queue';
import type {
  CalendarAccessMode,
  Group,
  GroupCalendarAccessPolicy,
  GroupOwnerAssignment,
  GroupOwnerAssignmentInput,
} from '@lume-hub/group-directory';
import type { Person, PersonRole, PersonUpsertInput } from '@lume-hub/people-memory';
import type { PowerPolicyUpdate, PowerStatus } from '@lume-hub/system-power';
import type { WatchdogIssue } from '@lume-hub/watchdog';

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

export interface SettingsSnapshot {
  readonly adminSettings: AdminSettings;
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

  async listGroups(): Promise<readonly Group[]> {
    return this.expectOk(await this.transport.request<readonly Group[]>({ method: 'GET', path: '/api/groups' }));
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
  CommandsPolicySettings,
  CalendarAccessMode,
  DistributionPlan,
  Group,
  GroupCalendarAccessPolicy,
  GroupOwnerAssignment,
  GroupOwnerAssignmentInput,
  HostCompanionStatus,
  Person,
  PersonRole,
  PersonUpsertInput,
  PowerStatus,
  SenderAudienceRule,
  SenderAudienceRuleUpsertInput,
  WhatsAppSettings,
  WatchdogIssue,
};
