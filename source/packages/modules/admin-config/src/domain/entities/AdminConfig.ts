import type { NotificationRuleDefinitionInput } from '@lume-hub/notification-rules';

export interface CommandsPolicySettings {
  readonly assistantEnabled: boolean;
  readonly schedulingEnabled: boolean;
  readonly ownerTerminalEnabled: boolean;
  readonly autoReplyEnabled: boolean;
  readonly directRepliesEnabled: boolean;
  readonly allowPrivateAssistant: boolean;
  readonly authorizedGroupJids: readonly string[];
  readonly authorizedPrivateJids: readonly string[];
}

export interface WhatsAppSettings {
  readonly enabled: boolean;
  readonly sharedAuthWithCodex: boolean;
  readonly groupDiscoveryEnabled: boolean;
  readonly conversationDiscoveryEnabled: boolean;
}

export interface LlmRuntimeSettings {
  readonly enabled: boolean;
  readonly provider: string;
  readonly model: string;
  readonly streamingEnabled: boolean;
  readonly openAiApiKey: string;
}

export type MessageAlertScope =
  | {
      readonly type: 'any';
    }
  | {
      readonly type: 'group';
      readonly groupJid: string;
    }
  | {
      readonly type: 'group_subject';
      readonly subject: string;
    }
  | {
      readonly type: 'chat';
      readonly chatJid: string;
    };

export type MessageAlertMatch =
  | {
      readonly type: 'includes';
      readonly value: string;
      readonly caseInsensitive?: boolean;
    }
  | {
      readonly type: 'regex';
      readonly pattern: string;
    };

export type MessageAlertAction =
  | {
      readonly type: 'log';
    }
  | {
      readonly type: 'webhook';
      readonly url: string;
      readonly method?: 'POST' | 'PUT';
      readonly headers?: Readonly<Record<string, string>>;
    };

export interface MessageAlertRule {
  readonly ruleId: string;
  readonly enabled: boolean;
  readonly label: string | null;
  readonly scope: MessageAlertScope;
  readonly match: MessageAlertMatch;
  readonly actions: readonly MessageAlertAction[];
}

export interface MessageAlertsSettings {
  readonly enabled: boolean;
  readonly rules: readonly MessageAlertRule[];
}

export type AutomationWeekdayToken = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type AutomationAction =
  | {
      readonly type: 'log';
    }
  | {
      readonly type: 'webhook';
      readonly url: string;
      readonly method?: 'POST' | 'PUT';
      readonly headers?: Readonly<Record<string, string>>;
    }
  | {
      readonly type: 'wa_send';
      readonly textTemplate?: string | null;
    };

export type AutomationSchedule =
  | {
      readonly type: 'weekly';
      readonly daysOfWeek: readonly AutomationWeekdayToken[];
      readonly time: string;
    }
  | {
      readonly type: 'one_shot';
      readonly startsAt: string;
    };

export interface AutomationDefinition {
  readonly automationId: string;
  readonly entryId: string;
  readonly enabled: boolean;
  readonly groupJid: string;
  readonly groupLabel: string;
  readonly schedule: AutomationSchedule;
  readonly notifyBeforeMinutes: readonly number[];
  readonly messageTemplate: string | null;
  readonly actions: readonly AutomationAction[];
  readonly importedFrom: string | null;
}

export interface AutomationsSettings {
  readonly enabled: boolean;
  readonly fireWindowMinutes: number;
  readonly definitions: readonly AutomationDefinition[];
}

export type LlmRuntimeMode = 'live' | 'fallback' | 'disabled';

export interface LlmProviderReadinessSnapshot {
  readonly providerId: string;
  readonly label: string;
  readonly ready: boolean;
  readonly reason: string | null;
}

export interface LlmRuntimeStatusSnapshot {
  readonly configuredEnabled: boolean;
  readonly configuredProviderId: string;
  readonly configuredModelId: string;
  readonly effectiveProviderId: string;
  readonly effectiveModelId: string;
  readonly mode: LlmRuntimeMode;
  readonly fallbackActive: boolean;
  readonly fallbackReason: string | null;
  readonly providerReadiness: readonly LlmProviderReadinessSnapshot[];
}

export interface LlmRuntimeStatusInput {
  readonly codexAuthReady?: boolean;
  readonly openAiCompatReady?: boolean;
  readonly fallbackProviderId?: string;
  readonly fallbackModelId?: string;
}

export interface UiSettings {
  readonly defaultNotificationRules: readonly NotificationRuleDefinitionInput[];
  readonly codexRouterVisible: boolean;
}

export interface AdminSettings {
  readonly schemaVersion: 1;
  readonly commands: CommandsPolicySettings;
  readonly whatsapp: WhatsAppSettings;
  readonly llm: LlmRuntimeSettings;
  readonly alerts: MessageAlertsSettings;
  readonly automations: AutomationsSettings;
  readonly ui: UiSettings;
  readonly updatedAt: string | null;
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
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
    openAiApiKey: '',
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
  ui: {
    codexRouterVisible: true,
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
  updatedAt: null,
};
