import type { NotificationRuleDefinitionInput } from '@lume-hub/notification-rules';

export interface CommandsPolicySettings {
  readonly assistantEnabled: boolean;
  readonly ownerTerminalEnabled: boolean;
  readonly schedulingEnabled: boolean;
  readonly autoReplyInGroup: boolean;
}

export interface LlmRuntimeSettings {
  readonly enabled: boolean;
  readonly provider: string;
  readonly model: string;
  readonly streamingEnabled: boolean;
}

export interface UiSettings {
  readonly defaultNotificationRules: readonly NotificationRuleDefinitionInput[];
}

export interface AdminSettings {
  readonly schemaVersion: 1;
  readonly commands: CommandsPolicySettings;
  readonly llm: LlmRuntimeSettings;
  readonly ui: UiSettings;
  readonly updatedAt: string | null;
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  schemaVersion: 1,
  commands: {
    assistantEnabled: true,
    ownerTerminalEnabled: true,
    schedulingEnabled: true,
    autoReplyInGroup: false,
  },
  llm: {
    enabled: false,
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
