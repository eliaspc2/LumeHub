import { BaseModule } from '@lume-hub/kernel';

import { AdminConfigService } from '../application/services/AdminConfigService.js';
import { AdminConfigRepository } from '../infrastructure/persistence/AdminConfigRepository.js';
import type { AdminConfigModuleContract } from '../public/contracts/index.js';
import type { AdminConfigModuleConfig } from './AdminConfigModuleConfig.js';

export class AdminConfigModule extends BaseModule implements AdminConfigModuleContract {
  readonly moduleName = 'admin-config' as const;
  readonly service: AdminConfigService;

  constructor(readonly config: AdminConfigModuleConfig = {}) {
    super({
      name: 'admin-config',
      version: '0.1.0',
      dependencies: [],
    });

    const repository =
      config.repository ??
      new AdminConfigRepository({
        settingsFilePath: config.settingsFilePath,
      });

    this.service = config.service ?? new AdminConfigService(repository);
  }

  async getSettings() {
    return this.service.getSettings();
  }

  async updateCommandsSettings(update: Parameters<AdminConfigService['updateCommandsSettings']>[0]) {
    return this.service.updateCommandsSettings(update);
  }

  async updateLlmSettings(update: Parameters<AdminConfigService['updateLlmSettings']>[0]) {
    return this.service.updateLlmSettings(update);
  }

  async getLlmRuntimeStatus(input?: Parameters<AdminConfigService['getLlmRuntimeStatus']>[0]) {
    return this.service.getLlmRuntimeStatus(input);
  }

  async updateWhatsAppSettings(update: Parameters<AdminConfigService['updateWhatsAppSettings']>[0]) {
    return this.service.updateWhatsAppSettings(update);
  }

  async updateAlertsSettings(update: Parameters<AdminConfigService['updateAlertsSettings']>[0]) {
    return this.service.updateAlertsSettings(update);
  }

  async updateAutomationSettings(update: Parameters<AdminConfigService['updateAutomationSettings']>[0]) {
    return this.service.updateAutomationSettings(update);
  }

  async updateUiSettings(update: Parameters<AdminConfigService['updateUiSettings']>[0]) {
    return this.service.updateUiSettings(update);
  }
}
