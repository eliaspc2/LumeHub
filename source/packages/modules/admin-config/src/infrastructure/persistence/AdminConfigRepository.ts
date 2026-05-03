import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type {
  AdminSettings,
  AutomationAction,
  AutomationDefinition,
  AutomationSchedule,
  AutomationsSettings,
  CommandsPolicySettings,
  MessageAlertAction,
  MessageAlertMatch,
  MessageAlertRule,
  MessageAlertScope,
  MessageAlertsSettings,
  WhatsAppSettings,
} from '../../domain/entities/AdminConfig.js';
import { DEFAULT_ADMIN_SETTINGS } from '../../domain/entities/AdminConfig.js';

export interface AdminConfigRepositoryConfig {
  readonly settingsFilePath?: string;
}

export class AdminConfigRepository {
  private readonly settingsFilePath: string;

  constructor(
    config: AdminConfigRepositoryConfig = {},
    private readonly writer = new AtomicJsonWriter(),
  ) {
    this.settingsFilePath = config.settingsFilePath ?? resolve(process.cwd(), 'runtime/system/system-settings.json');
  }

  getSettingsFilePath(): string {
    return this.settingsFilePath;
  }

  async readSettings(): Promise<AdminSettings> {
    try {
      const raw = JSON.parse(await readFile(this.settingsFilePath, 'utf8')) as Partial<AdminSettings>;
      const normalised = normaliseSettings(raw);

      if (!hasOpenAiApiKey(raw.llm?.openAiApiKey)) {
        await this.writer.write(this.settingsFilePath, normalised);
      }

      return normalised;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        const initial = normaliseSettings(DEFAULT_ADMIN_SETTINGS);
        await this.writer.write(this.settingsFilePath, initial);
        return initial;
      }

      throw error;
    }
  }

  async saveSettings(settings: AdminSettings): Promise<AdminSettings> {
    const normalised = normaliseSettings(settings);
    await this.writer.write(this.settingsFilePath, normalised);
    return normalised;
  }
}

function normaliseSettings(input: Partial<AdminSettings>): AdminSettings {
  return {
    schemaVersion: 1,
    commands: normaliseCommandsSettings(input.commands),
    whatsapp: normaliseWhatsAppSettings(input.whatsapp),
    llm: {
      ...DEFAULT_ADMIN_SETTINGS.llm,
      ...(input.llm ?? {}),
      openAiApiKey: hasOpenAiApiKey(input.llm?.openAiApiKey)
        ? input.llm!.openAiApiKey.trim()
        : generateOpenAiApiKey(),
    },
    alerts: normaliseAlertSettings(input.alerts),
    automations: normaliseAutomationSettings(input.automations),
    ui: {
      ...DEFAULT_ADMIN_SETTINGS.ui,
      ...(input.ui ?? {}),
      codexRouterVisible: input.ui?.codexRouterVisible ?? DEFAULT_ADMIN_SETTINGS.ui.codexRouterVisible,
      defaultNotificationRules: Array.isArray(input.ui?.defaultNotificationRules)
        ? input.ui.defaultNotificationRules
        : DEFAULT_ADMIN_SETTINGS.ui.defaultNotificationRules,
    },
    updatedAt: input.updatedAt ?? DEFAULT_ADMIN_SETTINGS.updatedAt,
  };
}

function hasOpenAiApiKey(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function generateOpenAiApiKey(): string {
  return `lume-openai-${randomUUID().replace(/-/g, '')}`;
}

function normaliseCommandsSettings(input: Partial<CommandsPolicySettings> | undefined): CommandsPolicySettings {
  const legacy = (input ?? {}) as Partial<CommandsPolicySettings> & {
    readonly autoReplyInGroup?: boolean;
  };

  return {
    assistantEnabled: legacy.assistantEnabled ?? DEFAULT_ADMIN_SETTINGS.commands.assistantEnabled,
    schedulingEnabled: legacy.schedulingEnabled ?? DEFAULT_ADMIN_SETTINGS.commands.schedulingEnabled,
    ownerTerminalEnabled: legacy.ownerTerminalEnabled ?? DEFAULT_ADMIN_SETTINGS.commands.ownerTerminalEnabled,
    autoReplyEnabled:
      legacy.autoReplyEnabled ?? legacy.autoReplyInGroup ?? DEFAULT_ADMIN_SETTINGS.commands.autoReplyEnabled,
    directRepliesEnabled: legacy.directRepliesEnabled ?? DEFAULT_ADMIN_SETTINGS.commands.directRepliesEnabled,
    allowPrivateAssistant: legacy.allowPrivateAssistant ?? DEFAULT_ADMIN_SETTINGS.commands.allowPrivateAssistant,
    authorizedGroupJids: normaliseStringList(
      legacy.authorizedGroupJids ?? DEFAULT_ADMIN_SETTINGS.commands.authorizedGroupJids,
    ),
    authorizedPrivateJids: normaliseStringList(
      legacy.authorizedPrivateJids ?? DEFAULT_ADMIN_SETTINGS.commands.authorizedPrivateJids,
    ),
  };
}

function normaliseWhatsAppSettings(input: Partial<WhatsAppSettings> | undefined): WhatsAppSettings {
  return {
    enabled: input?.enabled ?? DEFAULT_ADMIN_SETTINGS.whatsapp.enabled,
    sharedAuthWithCodex: input?.sharedAuthWithCodex ?? DEFAULT_ADMIN_SETTINGS.whatsapp.sharedAuthWithCodex,
    groupDiscoveryEnabled: input?.groupDiscoveryEnabled ?? DEFAULT_ADMIN_SETTINGS.whatsapp.groupDiscoveryEnabled,
    conversationDiscoveryEnabled:
      input?.conversationDiscoveryEnabled ?? DEFAULT_ADMIN_SETTINGS.whatsapp.conversationDiscoveryEnabled,
  };
}

function normaliseAlertSettings(input: Partial<MessageAlertsSettings> | undefined): MessageAlertsSettings {
  return {
    enabled: input?.enabled ?? DEFAULT_ADMIN_SETTINGS.alerts.enabled,
    rules: Array.isArray(input?.rules) ? input!.rules.map(normaliseAlertRule) : DEFAULT_ADMIN_SETTINGS.alerts.rules,
  };
}

function normaliseAlertRule(input: MessageAlertRule): MessageAlertRule {
  return {
    ruleId: input.ruleId.trim(),
    enabled: input.enabled !== false,
    label: input.label?.trim() || null,
    scope: normaliseAlertScope(input.scope),
    match: normaliseAlertMatch(input.match),
    actions: Array.isArray(input.actions) && input.actions.length > 0 ? input.actions.map(normaliseAlertAction) : [{ type: 'log' }],
  };
}

function normaliseAlertScope(input: MessageAlertScope): MessageAlertScope {
  switch (input.type) {
    case 'group':
      return {
        type: 'group',
        groupJid: input.groupJid.trim(),
      };
    case 'group_subject':
      return {
        type: 'group_subject',
        subject: input.subject.trim(),
      };
    case 'chat':
      return {
        type: 'chat',
        chatJid: input.chatJid.trim(),
      };
    default:
      return { type: 'any' };
  }
}

function normaliseAlertMatch(input: MessageAlertMatch): MessageAlertMatch {
  if (input.type === 'includes') {
    return {
      type: 'includes',
      value: input.value.trim(),
      caseInsensitive: input.caseInsensitive ?? true,
    };
  }

  return {
    type: 'regex',
    pattern: input.pattern,
  };
}

function normaliseAlertAction(input: MessageAlertAction): MessageAlertAction {
  if (input.type === 'webhook') {
    return {
      type: 'webhook',
      url: input.url.trim(),
      method: input.method ?? 'POST',
      headers: input.headers ?? {},
    };
  }

  return {
    type: 'log',
  };
}

function normaliseAutomationSettings(input: Partial<AutomationsSettings> | undefined): AutomationsSettings {
  return {
    enabled: input?.enabled ?? DEFAULT_ADMIN_SETTINGS.automations.enabled,
    fireWindowMinutes:
      Number.isInteger(input?.fireWindowMinutes) && (input?.fireWindowMinutes ?? 0) > 0
        ? Number(input?.fireWindowMinutes)
        : DEFAULT_ADMIN_SETTINGS.automations.fireWindowMinutes,
    definitions: Array.isArray(input?.definitions)
      ? input!.definitions.map(normaliseAutomationDefinition)
      : DEFAULT_ADMIN_SETTINGS.automations.definitions,
  };
}

function normaliseAutomationDefinition(input: AutomationDefinition): AutomationDefinition {
  return {
    automationId: input.automationId.trim(),
    entryId: input.entryId.trim(),
    enabled: input.enabled !== false,
    groupJid: input.groupJid.trim(),
    groupLabel: input.groupLabel.trim(),
    schedule: normaliseAutomationSchedule(input.schedule),
    notifyBeforeMinutes: normaliseNumericList(input.notifyBeforeMinutes),
    messageTemplate: input.messageTemplate?.trim() || null,
    actions:
      Array.isArray(input.actions) && input.actions.length > 0 ? input.actions.map(normaliseAutomationAction) : [{ type: 'log' }],
    importedFrom: input.importedFrom?.trim() || null,
  };
}

function normaliseAutomationSchedule(input: AutomationSchedule): AutomationSchedule {
  if (input.type === 'weekly') {
    return {
      type: 'weekly',
      daysOfWeek: input.daysOfWeek.map((value) => value.trim().toLowerCase() as AutomationSchedule & string).filter(Boolean) as AutomationSchedule extends { readonly type: 'weekly'; readonly daysOfWeek: infer TValue } ? TValue : never,
      time: input.time.trim(),
    };
  }

  return {
    type: 'one_shot',
    startsAt: input.startsAt,
  };
}

function normaliseAutomationAction(input: AutomationAction): AutomationAction {
  if (input.type === 'webhook') {
    return {
      type: 'webhook',
      url: input.url.trim(),
      method: input.method ?? 'POST',
      headers: input.headers ?? {},
    };
  }

  if (input.type === 'wa_send') {
    return {
      type: 'wa_send',
      textTemplate: input.textTemplate?.trim() || null,
    };
  }

  return {
    type: 'log',
  };
}

function normaliseStringList(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normaliseNumericList(values: readonly number[]): readonly number[] {
  return [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0))].sort(
    (left, right) => left - right,
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
