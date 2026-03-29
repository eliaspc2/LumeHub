import { BaseModule } from '@lume-hub/kernel';

import { WorkspaceAgentService } from '../application/services/WorkspaceAgentService.js';
import { CodexWorkspaceExecutor } from '../infrastructure/runtime/CodexWorkspaceExecutor.js';
import { WorkspaceAgentRunRepository } from '../infrastructure/persistence/WorkspaceAgentRunRepository.js';
import type { WorkspaceAgentModuleContract } from '../public/contracts/index.js';
import type { WorkspaceAgentModuleConfig } from './WorkspaceAgentModuleConfig.js';

export class WorkspaceAgentModule extends BaseModule implements WorkspaceAgentModuleContract {
  readonly moduleName = 'workspace-agent' as const;
  readonly service: WorkspaceAgentService;

  constructor(readonly config: WorkspaceAgentModuleConfig) {
    super({
      name: 'workspace-agent',
      version: '0.1.0',
      dependencies: [],
    });

    this.service =
      config.service ??
      new WorkspaceAgentService({
        workspaceRootPath: config.workspaceRootPath,
        executor: config.executor ?? new CodexWorkspaceExecutor(),
        repository:
          config.repository ??
          new WorkspaceAgentRunRepository({
            runLogFilePath: config.runLogFilePath,
          }),
      });
  }

  async searchFiles(query?: string, limit?: number) {
    return this.service.searchFiles(query, limit);
  }

  async readFile(relativePath: string) {
    return this.service.readFile(relativePath);
  }

  async listRuns(limit?: number) {
    return this.service.listRuns(limit);
  }

  async run(input: Parameters<WorkspaceAgentService['run']>[0]) {
    return this.service.run(input);
  }
}
