import { BaseModule } from '@lume-hub/kernel';
import type { LlmOrchestratorModuleConfig } from './LlmOrchestratorModuleConfig.js';

export class LlmOrchestratorModule extends BaseModule {
  constructor(readonly config: LlmOrchestratorModuleConfig = {}) {
    super({
      name: 'llm-orchestrator',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
