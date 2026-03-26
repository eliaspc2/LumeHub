import type { ModuleContext } from '@lume-hub/kernel';
import { AgentRuntimeModule } from './AgentRuntimeModule.js';
import type { AgentRuntimeModuleConfig } from './AgentRuntimeModuleConfig.js';

export class AgentRuntimeModuleFactory {
  create(_context: ModuleContext, config: AgentRuntimeModuleConfig = {}): AgentRuntimeModule {
    return new AgentRuntimeModule(config);
  }
}
