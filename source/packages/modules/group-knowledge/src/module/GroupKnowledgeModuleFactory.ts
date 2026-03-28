import type { ModuleContext } from '@lume-hub/kernel';

import { GroupKnowledgeModule } from './GroupKnowledgeModule.js';
import type { GroupKnowledgeModuleConfig } from './GroupKnowledgeModuleConfig.js';

export class GroupKnowledgeModuleFactory {
  create(_context: ModuleContext, config: GroupKnowledgeModuleConfig = {}): GroupKnowledgeModule {
    return new GroupKnowledgeModule(config);
  }
}
