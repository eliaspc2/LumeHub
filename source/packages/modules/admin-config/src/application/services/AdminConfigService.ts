import type {
  AdminSettings,
  CommandsPolicySettings,
  LlmRuntimeSettings,
  UiSettings,
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
      commands: {
        ...current.commands,
        ...update,
      },
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
