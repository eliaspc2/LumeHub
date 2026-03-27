import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type { AdminSettings, CommandsPolicySettings, WhatsAppSettings } from '../../domain/entities/AdminConfig.js';
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
      return normaliseSettings(raw);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return DEFAULT_ADMIN_SETTINGS;
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
    },
    ui: {
      ...DEFAULT_ADMIN_SETTINGS.ui,
      ...(input.ui ?? {}),
      defaultNotificationRules: Array.isArray(input.ui?.defaultNotificationRules)
        ? input.ui.defaultNotificationRules
        : DEFAULT_ADMIN_SETTINGS.ui.defaultNotificationRules,
    },
    updatedAt: input.updatedAt ?? DEFAULT_ADMIN_SETTINGS.updatedAt,
  };
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

function normaliseStringList(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
