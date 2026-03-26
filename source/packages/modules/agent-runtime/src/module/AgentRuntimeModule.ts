import { BaseModule } from '@lume-hub/kernel';
import type { AgentRuntimeModuleConfig } from './AgentRuntimeModuleConfig.js';

export class AgentRuntimeModule extends BaseModule {
  constructor(readonly config: AgentRuntimeModuleConfig = {}) {
    super({
      name: 'agent-runtime',
      version: '0.1.0',
      dependencies: [],
    });
  }
}
