import type { CodexOrchestratorModuleConfig } from './CodexOrchestratorModuleConfig.js';
import { CodexOrchestratorModule } from './CodexOrchestratorModule.js';

export class CodexOrchestratorModuleFactory {
  create(config: CodexOrchestratorModuleConfig = {}): CodexOrchestratorModule {
    return new CodexOrchestratorModule(config);
  }
}
