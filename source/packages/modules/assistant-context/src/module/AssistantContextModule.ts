import { BaseModule } from '@lume-hub/kernel';
import type { AssistantContextModuleConfig } from './AssistantContextModuleConfig.js';

export class AssistantContextModule extends BaseModule {
  constructor(readonly config: AssistantContextModuleConfig = {}) {
    super({
      name: 'assistant-context',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
