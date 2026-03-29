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
}

export interface AdminSettings {
  readonly schemaVersion: 1;
  readonly commands: CommandsPolicySettings;
  readonly whatsapp: WhatsAppSettings;
  readonly llm: LlmRuntimeSettings;
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
  updatedAt: null,
};
