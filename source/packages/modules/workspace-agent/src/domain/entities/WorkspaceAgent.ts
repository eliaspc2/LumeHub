export type WorkspaceAgentRunMode = 'plan' | 'apply';
export type WorkspaceAgentRunStatus = 'completed' | 'failed';
export type WorkspaceAgentFileChangeType = 'added' | 'modified' | 'deleted';

export interface WorkspaceFileEntry {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly extension: string;
}

export interface WorkspaceFileContent {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly content: string;
  readonly sizeBytes: number;
  readonly truncated: boolean;
}

export interface WorkspaceAgentRunInput {
  readonly prompt: string;
  readonly mode: WorkspaceAgentRunMode;
  readonly filePaths?: readonly string[];
}

export interface WorkspaceAgentExecutionInput {
  readonly workspaceRootPath: string;
  readonly prompt: string;
  readonly mode: WorkspaceAgentRunMode;
  readonly filePaths: readonly string[];
}

export interface WorkspaceAgentExecutionResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly outputSummary: string;
  readonly changedFiles: readonly string[];
  readonly structuredSummary: WorkspaceAgentStructuredSummary;
  readonly fileDiffs: readonly WorkspaceAgentFileDiff[];
}

export interface WorkspaceAgentStructuredSummary {
  readonly summary: string;
  readonly suggestedFiles: readonly string[];
  readonly readFiles: readonly string[];
  readonly notes: readonly string[];
}

export interface WorkspaceAgentFileDiff {
  readonly relativePath: string;
  readonly changeType: WorkspaceAgentFileChangeType;
  readonly beforeStatus: string | null;
  readonly afterStatus: string | null;
  readonly diffText: string;
}

export interface WorkspaceAgentRunRecord {
  readonly runId: string;
  readonly mode: WorkspaceAgentRunMode;
  readonly prompt: string;
  readonly filePaths: readonly string[];
  readonly startedAt: string;
  readonly completedAt: string;
  readonly status: WorkspaceAgentRunStatus;
  readonly outputSummary: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly changedFiles: readonly string[];
  readonly structuredSummary: WorkspaceAgentStructuredSummary;
  readonly fileDiffs: readonly WorkspaceAgentFileDiff[];
}

export interface WorkspaceAgentRunLog {
  readonly schemaVersion: 1;
  readonly runs: readonly WorkspaceAgentRunRecord[];
}

export interface WorkspaceAgentExecutor {
  run(input: WorkspaceAgentExecutionInput): Promise<WorkspaceAgentExecutionResult>;
}
