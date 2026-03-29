import type {
  WorkspaceAgentRunInput,
  WorkspaceAgentRunRecord,
  WorkspaceAgentStatusSnapshot,
  WorkspaceFileContent,
  WorkspaceFileEntry,
} from '../../domain/entities/WorkspaceAgent.js';

export interface WorkspaceAgentModuleContract {
  searchFiles(query?: string, limit?: number): Promise<readonly WorkspaceFileEntry[]>;
  readFile(relativePath: string): Promise<WorkspaceFileContent>;
  listRuns(limit?: number): Promise<readonly WorkspaceAgentRunRecord[]>;
  getStatus(): WorkspaceAgentStatusSnapshot;
  run(input: WorkspaceAgentRunInput): Promise<WorkspaceAgentRunRecord>;
}
