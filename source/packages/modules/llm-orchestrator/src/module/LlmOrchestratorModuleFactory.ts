import type { ModuleContext } from '@lume-hub/kernel';
import { LlmOrchestratorModule } from './LlmOrchestratorModule.js';
import type { LlmOrchestratorModuleConfig } from './LlmOrchestratorModuleConfig.js';

export class LlmOrchestratorModuleFactory {
  create(_context: ModuleContext, config: LlmOrchestratorModuleConfig = {}): LlmOrchestratorModule {
    return new LlmOrchestratorModule(config);
  }
}
