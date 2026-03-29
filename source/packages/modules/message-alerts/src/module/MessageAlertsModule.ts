import { BaseModule } from '@lume-hub/kernel';

import { MessageAlertService } from '../application/services/MessageAlertService.js';
import { MessageAlertMatchRepository } from '../infrastructure/persistence/MessageAlertMatchRepository.js';
import type { MessageAlertsModuleContract } from '../public/contracts/index.js';
import type { MessageAlertsModuleConfig } from './MessageAlertsModuleConfig.js';

export class MessageAlertsModule extends BaseModule implements MessageAlertsModuleContract {
  readonly moduleName = 'message-alerts' as const;
  readonly service: MessageAlertService;

  constructor(readonly config: MessageAlertsModuleConfig) {
    super({
      name: 'message-alerts',
      version: '0.1.0',
      dependencies: ['admin-config'],
    });

    this.service =
      config.service ??
      new MessageAlertService({
        adminConfig: config.adminConfig,
        legacyAlertsFilePath: config.legacyAlertsFilePath,
        matchRepository: new MessageAlertMatchRepository(config.auditFilePath),
        fetchImpl: config.fetchImpl,
      });
  }

  async listRules() {
    return this.service.listRules();
  }

  async listRecentMatches(limit?: number) {
    return this.service.listRecentMatches(limit);
  }

  async previewLegacyImport() {
    return this.service.previewLegacyImport();
  }

  async applyLegacyImport() {
    return this.service.applyLegacyImport();
  }

  async handleInbound(message: Parameters<MessageAlertService['handleInbound']>[0]) {
    return this.service.handleInbound(message);
  }
}
