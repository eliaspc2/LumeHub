import type { ModuleContext } from '@lume-hub/kernel';
import { AdminConfigModule } from './AdminConfigModule.js';
import type { AdminConfigModuleConfig } from './AdminConfigModuleConfig.js';

export class AdminConfigModuleFactory {
  create(_context: ModuleContext, config: AdminConfigModuleConfig = {}): AdminConfigModule {
    return new AdminConfigModule(config);
  }
}
