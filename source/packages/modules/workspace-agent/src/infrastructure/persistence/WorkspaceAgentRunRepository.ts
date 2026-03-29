import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type {
  WorkspaceAgentFileDiff,
  WorkspaceAgentRunLog,
  WorkspaceAgentRunRecord,
  WorkspaceAgentStructuredSummary,
} from '../../domain/entities/WorkspaceAgent.js';

const EMPTY_WORKSPACE_AGENT_RUN_LOG: WorkspaceAgentRunLog = {
  schemaVersion: 1,
  runs: [],
};

export interface WorkspaceAgentRunRepositoryConfig {
  readonly dataRootPath?: string;
  readonly runLogFilePath?: string;
}

export class WorkspaceAgentRunRepository {
  constructor(
    private readonly config: WorkspaceAgentRunRepositoryConfig = {},
    private readonly writer = new AtomicJsonWriter(),
  ) {}

  resolveRunLogFilePath(): string {
    return this.config.runLogFilePath ?? join(this.config.dataRootPath ?? 'data', 'runtime', 'workspace-agent-runs.json');
  }

  async read(): Promise<WorkspaceAgentRunLog> {
    try {
      return normalizeRunLog(JSON.parse(await readFile(this.resolveRunLogFilePath(), 'utf8')) as WorkspaceAgentRunLog);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return EMPTY_WORKSPACE_AGENT_RUN_LOG;
      }

      throw error;
    }
  }

  async append(run: WorkspaceAgentRunRecord): Promise<WorkspaceAgentRunLog> {
    const current = await this.read();
    const nextValue = normalizeRunLog({
      schemaVersion: 1,
      runs: [...current.runs, run].slice(-40),
    });
    await this.writer.write(this.resolveRunLogFilePath(), nextValue);
    return nextValue;
  }
}

function normalizeRunLog(value: WorkspaceAgentRunLog): WorkspaceAgentRunLog {
  return {
    schemaVersion: 1,
    runs: value.runs.map(normalizeRun),
  };
}

function normalizeRun(run: WorkspaceAgentRunRecord): WorkspaceAgentRunRecord {
  return {
    runId: run.runId.trim(),
    mode: run.mode,
    prompt: run.prompt.trim(),
    filePaths: [...new Set(run.filePaths.map((filePath) => filePath.trim()).filter(Boolean))],
    requestedBy:
      typeof run.requestedBy === 'string' && run.requestedBy.trim().length > 0 ? run.requestedBy.trim() : 'workspace-ui',
    approvalState: normalizeApprovalState(run),
    executionState: run.executionState === 'rejected' ? 'rejected' : 'executed',
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    status: run.status,
    outputSummary: run.outputSummary.trim(),
    guardrailReason:
      typeof run.guardrailReason === 'string' && run.guardrailReason.trim().length > 0 ? run.guardrailReason.trim() : null,
    stdout: truncateText(run.stdout),
    stderr: truncateText(run.stderr),
    exitCode: typeof run.exitCode === 'number' ? run.exitCode : null,
    timedOut: Boolean(run.timedOut),
    changedFiles: [...new Set(run.changedFiles.map((filePath) => filePath.trim()).filter(Boolean))],
    structuredSummary: normalizeStructuredSummary(run),
    fileDiffs: normalizeFileDiffs(run.fileDiffs),
  };
}

function normalizeStructuredSummary(run: WorkspaceAgentRunRecord): WorkspaceAgentStructuredSummary {
  const summary = run.structuredSummary;

  return {
    summary:
      typeof summary?.summary === 'string' && summary.summary.trim().length > 0
        ? summary.summary.trim()
        : run.outputSummary.trim(),
    suggestedFiles: uniqueFileList(summary?.suggestedFiles ?? run.filePaths),
    readFiles: uniqueFileList(summary?.readFiles ?? [...run.filePaths, ...run.changedFiles]),
    notes: uniqueTextList(summary?.notes ?? []),
  };
}

function normalizeApprovalState(run: WorkspaceAgentRunRecord): WorkspaceAgentRunRecord['approvalState'] {
  if (
    run.approvalState === 'not_required' ||
    run.approvalState === 'confirmed' ||
    run.approvalState === 'missing_confirmation'
  ) {
    return run.approvalState;
  }

  return run.mode === 'apply' ? 'confirmed' : 'not_required';
}

function normalizeFileDiffs(fileDiffs: readonly WorkspaceAgentRunRecord['fileDiffs'][number][] | undefined): readonly WorkspaceAgentFileDiff[] {
  return (fileDiffs ?? []).map((fileDiff) => ({
    relativePath: fileDiff.relativePath.trim(),
    changeType: fileDiff.changeType,
    beforeStatus: typeof fileDiff.beforeStatus === 'string' && fileDiff.beforeStatus.trim().length > 0 ? fileDiff.beforeStatus.trim() : null,
    afterStatus: typeof fileDiff.afterStatus === 'string' && fileDiff.afterStatus.trim().length > 0 ? fileDiff.afterStatus.trim() : null,
    diffText: truncateText(fileDiff.diffText, 40_000),
  }));
}

function uniqueFileList(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueTextList(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function truncateText(value: string, maxLength = 20_000): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n\n...[truncated]` : value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
