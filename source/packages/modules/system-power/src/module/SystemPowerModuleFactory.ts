import type { ModuleContext } from '@lume-hub/kernel';
import { SystemPowerModule } from './SystemPowerModule.js';
import type { SystemPowerModuleConfig } from './SystemPowerModuleConfig.js';

export class SystemPowerModuleFactory {
  create(_context: ModuleContext, config: SystemPowerModuleConfig = {}): SystemPowerModule {
    return new SystemPowerModule(config);
  }
}
