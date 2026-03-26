import { BaseModule } from '@lume-hub/kernel';
import type { ConversationModuleConfig } from './ConversationModuleConfig.js';

export class ConversationModule extends BaseModule {
  constructor(readonly config: ConversationModuleConfig = {}) {
    super({
      name: 'conversation',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
