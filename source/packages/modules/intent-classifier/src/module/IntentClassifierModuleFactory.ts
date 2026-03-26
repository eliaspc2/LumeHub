import type { ModuleContext } from '@lume-hub/kernel';
import { IntentClassifierModule } from './IntentClassifierModule.js';
import type { IntentClassifierModuleConfig } from './IntentClassifierModuleConfig.js';

export class IntentClassifierModuleFactory {
  create(_context: ModuleContext, config: IntentClassifierModuleConfig = {}): IntentClassifierModule {
    return new IntentClassifierModule(config);
  }
}
