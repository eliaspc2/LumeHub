import { BaseModule } from '@lume-hub/kernel';
import type { NotificationRulesModuleConfig } from './NotificationRulesModuleConfig.js';

export class NotificationRulesModule extends BaseModule {
  constructor(readonly config: NotificationRulesModuleConfig = {}) {
    super({
      name: 'notification-rules',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
