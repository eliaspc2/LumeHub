import type {
  AdminSettings,
  CommandsPolicySettings,
  LlmRuntimeSettings,
  UiSettings,
  WhatsAppSettings,
} from '../../domain/entities/AdminConfig.js';
import { AdminConfigRepository } from '../../infrastructure/persistence/AdminConfigRepository.js';

export class AdminConfigService {
  constructor(private readonly repository: AdminConfigRepository) {}

  async getSettings(): Promise<AdminSettings> {
    return this.repository.readSettings();
  }

  async updateCommandsSettings(
    update: Partial<CommandsPolicySettings>,
    now = new Date(),
  ): Promise<AdminSettings> {
    const current = await this.getSettings();
    return this.repository.saveSettings({
      ...current,
      commands: mergeDefined(current.commands, update),
      updatedAt: now.toISOString(),
    });
  }

  async updateLlmSettings(update: Partial<LlmRuntimeSettings>, now = new Date()): Promise<AdminSettings> {
    const current = await this.getSettings();
    return this.repository.saveSettings({
      ...current,
      llm: {
        ...current.llm,
        ...update,
      },
      updatedAt: now.toISOString(),
    });
  }

  async updateWhatsAppSettings(update: Partial<WhatsAppSettings>, now = new Date()): Promise<AdminSettings> {
    const current = await this.getSettings();
    return this.repository.saveSettings({
      ...current,
      whatsapp: mergeDefined(current.whatsapp, update),
      updatedAt: now.toISOString(),
    });
  }

  async updateUiSettings(update: Partial<UiSettings>, now = new Date()): Promise<AdminSettings> {
    const current = await this.getSettings();
    return this.repository.saveSettings({
      ...current,
      ui: {
        ...current.ui,
        ...update,
        defaultNotificationRules: update.defaultNotificationRules ?? current.ui.defaultNotificationRules,
      },
      updatedAt: now.toISOString(),
    });
  }
}

function mergeDefined<T extends object>(current: T, update: Partial<T>): T {
  const nextEntries = Object.entries(update).filter(([, value]) => value !== undefined);
  return {
    ...current,
    ...Object.fromEntries(nextEntries),
  } as T;
}
