import type { WorkspaceAgentExecutor } from '../domain/entities/WorkspaceAgent.js';
import type { WorkspaceAgentRunRepository } from '../infrastructure/persistence/WorkspaceAgentRunRepository.js';
import type { WorkspaceAgentService } from '../application/services/WorkspaceAgentService.js';

export interface WorkspaceAgentModuleConfig {
  readonly workspaceRootPath: string;
  readonly runLogFilePath?: string;
  readonly service?: WorkspaceAgentService;
  readonly repository?: WorkspaceAgentRunRepository;
  readonly executor?: WorkspaceAgentExecutor;
}
