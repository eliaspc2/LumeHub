import type { ModuleContext } from '@lume-hub/kernel';
import { ConversationModule } from './ConversationModule.js';
import type { ConversationModuleConfig } from './ConversationModuleConfig.js';

export class ConversationModuleFactory {
  create(_context: ModuleContext, config: ConversationModuleConfig = {}): ConversationModule {
    return new ConversationModule(config);
  }
}
