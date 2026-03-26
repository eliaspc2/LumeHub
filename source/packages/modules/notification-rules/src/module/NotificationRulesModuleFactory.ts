import type { ModuleContext } from '@lume-hub/kernel';
import { NotificationRulesModule } from './NotificationRulesModule.js';
import type { NotificationRulesModuleConfig } from './NotificationRulesModuleConfig.js';

export class NotificationRulesModuleFactory {
  create(_context: ModuleContext, config: NotificationRulesModuleConfig = {}): NotificationRulesModule {
    return new NotificationRulesModule(config);
  }
}
