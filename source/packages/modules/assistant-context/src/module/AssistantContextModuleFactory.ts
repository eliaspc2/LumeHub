import type { ModuleContext } from '@lume-hub/kernel';
import { AssistantContextModule } from './AssistantContextModule.js';
import type { AssistantContextModuleConfig } from './AssistantContextModuleConfig.js';

export class AssistantContextModuleFactory {
  create(_context: ModuleContext, config: AssistantContextModuleConfig = {}): AssistantContextModule {
    return new AssistantContextModule(config);
  }
}
