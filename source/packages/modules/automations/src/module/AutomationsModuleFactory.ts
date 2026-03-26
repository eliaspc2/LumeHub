import type { ModuleContext } from '@lume-hub/kernel';
import { AutomationsModule } from './AutomationsModule.js';
import type { AutomationsModuleConfig } from './AutomationsModuleConfig.js';

export class AutomationsModuleFactory {
  create(_context: ModuleContext, config: AutomationsModuleConfig = {}): AutomationsModule {
    return new AutomationsModule(config);
  }
}
