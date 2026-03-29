import { WorkspaceAgentModule } from './WorkspaceAgentModule.js';
import type { WorkspaceAgentModuleConfig } from './WorkspaceAgentModuleConfig.js';

export function createWorkspaceAgentModule(config: WorkspaceAgentModuleConfig): WorkspaceAgentModule {
  return new WorkspaceAgentModule(config);
}
