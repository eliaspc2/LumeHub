import { BaseModule } from '@lume-hub/kernel';

import { AutomationService, type AutomationSendRuntime } from '../application/services/AutomationService.js';
import { AutomationFiredStateRepository } from '../infrastructure/persistence/AutomationFiredStateRepository.js';
import { AutomationRunRepository } from '../infrastructure/persistence/AutomationRunRepository.js';
import type { AutomationsModuleContract } from '../public/contracts/index.js';
import type { AutomationsModuleConfig } from './AutomationsModuleConfig.js';

export class AutomationsModule extends BaseModule implements AutomationsModuleContract {
  readonly moduleName = 'automations' as const;
  readonly service: AutomationService;

  constructor(readonly config: AutomationsModuleConfig) {
    super({
      name: 'automations',
      version: '0.1.0',
      dependencies: ['admin-config', 'group-directory'],
    });

    this.service =
      config.service ??
      new AutomationService({
        adminConfig: config.adminConfig,
        groupDirectory: config.groupDirectory,
        legacyAutomationsFilePath: config.legacyAutomationsFilePath,
        runRepository: new AutomationRunRepository(config.runLogFilePath),
        firedStateRepository: new AutomationFiredStateRepository(config.firedStateFilePath),
        fetchImpl: config.fetchImpl,
      });
  }

  async listDefinitions() {
    return this.service.listDefinitions();
  }

  async listRecentRuns(limit?: number) {
    return this.service.listRecentRuns(limit);
  }

  async previewLegacyImport() {
    return this.service.previewLegacyImport();
  }

  async applyLegacyImport() {
    return this.service.applyLegacyImport();
  }

  async tick(sendRuntime: AutomationSendRuntime, now?: Date) {
    return this.service.tick(sendRuntime, now);
  }
}
