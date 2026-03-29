import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

import type {
  WorkspaceAgentExecutionResult,
  WorkspaceAgentExecutor,
  WorkspaceAgentRunInput,
  WorkspaceAgentRunRecord,
  WorkspaceAgentStructuredSummary,
  WorkspaceFileContent,
  WorkspaceFileEntry,
} from '../../domain/entities/WorkspaceAgent.js';
import type { WorkspaceAgentRunRepository } from '../../infrastructure/persistence/WorkspaceAgentRunRepository.js';

const execFileAsync = promisify(execFile);
const DEFAULT_FILE_SEARCH_LIMIT = 80;
const FILE_PREVIEW_LIMIT_BYTES = 32_000;

export interface WorkspaceAgentServiceConfig {
  readonly workspaceRootPath: string;
  readonly executor: WorkspaceAgentExecutor;
  readonly repository: WorkspaceAgentRunRepository;
}

export class WorkspaceAgentService {
  constructor(private readonly config: WorkspaceAgentServiceConfig) {}

  get workspaceRootPath(): string {
    return this.config.workspaceRootPath;
  }

  async searchFiles(query?: string, limit = DEFAULT_FILE_SEARCH_LIMIT): Promise<readonly WorkspaceFileEntry[]> {
    const allFiles = await this.readWorkspaceFileList();
    const normalizedQuery = query?.trim().toLowerCase() ?? '';
    const normalizedLimit = clampLimit(limit);
    const filtered = normalizedQuery
      ? allFiles.filter((relativePath) => relativePath.toLowerCase().includes(normalizedQuery))
      : allFiles;

    return filtered.slice(0, normalizedLimit).map((relativePath) => this.mapFileEntry(relativePath));
  }

  async readFile(relativePath: string): Promise<WorkspaceFileContent> {
    const absolutePath = this.resolveWorkspacePath(relativePath);
    const buffer = await readFile(absolutePath);
    const truncated = buffer.byteLength > FILE_PREVIEW_LIMIT_BYTES;
    const content = buffer.toString('utf8', 0, truncated ? FILE_PREVIEW_LIMIT_BYTES : buffer.byteLength);

    return {
      relativePath: this.normalizeRelativePath(relativePath),
      absolutePath,
      content,
      sizeBytes: buffer.byteLength,
      truncated,
    };
  }

  async listRuns(limit = 12): Promise<readonly WorkspaceAgentRunRecord[]> {
    const log = await this.config.repository.read();
    const normalizedLimit = clampLimit(limit, 1, 40);
    return log.runs.slice(Math.max(0, log.runs.length - normalizedLimit)).reverse();
  }

  async run(input: WorkspaceAgentRunInput): Promise<WorkspaceAgentRunRecord> {
    const prompt = input.prompt.trim();

    if (!prompt) {
      throw new Error('Workspace agent prompt must not be empty.');
    }

    const mode = input.mode === 'plan' ? 'plan' : 'apply';
    const filePaths = dedupeStringList((input.filePaths ?? []).map((filePath) => this.normalizeRelativePath(filePath)));
    const startedAt = new Date().toISOString();
    const executionResult = await this.config.executor.run({
      workspaceRootPath: this.config.workspaceRootPath,
      prompt,
      mode,
      filePaths,
    });
    const completedAt = new Date().toISOString();
    const runRecord: WorkspaceAgentRunRecord = {
      runId: `workspace-run-${randomUUID()}`,
      mode,
      prompt,
      filePaths,
      startedAt,
      completedAt,
      status: executionResult.exitCode === 0 && !executionResult.timedOut ? 'completed' : 'failed',
      outputSummary: executionResult.outputSummary,
      stdout: executionResult.stdout,
      stderr: executionResult.stderr,
      exitCode: executionResult.exitCode,
      timedOut: executionResult.timedOut,
      changedFiles: executionResult.changedFiles,
      structuredSummary: normalizeStructuredSummary(
        executionResult.structuredSummary,
        filePaths,
        executionResult.changedFiles,
        executionResult.outputSummary,
      ),
      fileDiffs: executionResult.fileDiffs,
    };

    await this.config.repository.append(runRecord);
    return runRecord;
  }

  private async readWorkspaceFileList(): Promise<readonly string[]> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['-C', this.config.workspaceRootPath, 'ls-files', '--cached', '--others', '--exclude-standard'],
        {
          cwd: this.config.workspaceRootPath,
          encoding: 'utf8',
          maxBuffer: 2_000_000,
        },
      );
      const files = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.endsWith('/'));

      if (files.length > 0) {
        return files.sort((left, right) => left.localeCompare(right));
      }
    } catch {}

    return await listFilesRecursively(this.config.workspaceRootPath, this.config.workspaceRootPath);
  }

  private mapFileEntry(relativePath: string): WorkspaceFileEntry {
    return {
      relativePath,
      absolutePath: this.resolveWorkspacePath(relativePath),
      extension: extname(relativePath),
    };
  }

  private resolveWorkspacePath(relativePath: string): string {
    const normalizedRelativePath = this.normalizeRelativePath(relativePath);
    const absolutePath = resolve(this.config.workspaceRootPath, normalizedRelativePath);
    const workspaceRootWithSeparator = `${this.config.workspaceRootPath.replace(/\/+$/u, '')}/`;

    if (absolutePath !== this.config.workspaceRootPath && !absolutePath.startsWith(workspaceRootWithSeparator)) {
      throw new Error(`File path '${relativePath}' is outside the LumeHub workspace root.`);
    }

    return absolutePath;
  }

  private normalizeRelativePath(relativePath: string): string {
    const trimmed = relativePath.trim();

    if (!trimmed) {
      throw new Error('Workspace file path must not be empty.');
    }

    const absoluteCandidate = resolve(this.config.workspaceRootPath, trimmed);
    const normalized = relative(this.config.workspaceRootPath, absoluteCandidate).replace(/\\/gu, '/');

    if (!normalized || normalized.startsWith('../') || normalized === '..') {
      throw new Error(`File path '${relativePath}' is outside the LumeHub workspace root.`);
    }

    return normalized;
  }
}

function normalizeStructuredSummary(
  summary: WorkspaceAgentExecutionResult['structuredSummary'] | undefined,
  filePaths: readonly string[],
  changedFiles: readonly string[],
  outputSummary: string,
): WorkspaceAgentStructuredSummary {
  const suggestedFiles = dedupeStringList([...(summary?.suggestedFiles ?? []), ...filePaths]);
  const readFiles = dedupeStringList([...(summary?.readFiles ?? []), ...changedFiles]);
  const notes = dedupeStringList(summary?.notes ?? []);

  return {
    summary: summary?.summary?.trim().length ? summary.summary.trim() : outputSummary.trim(),
    suggestedFiles,
    readFiles,
    notes,
  };
}

async function listFilesRecursively(rootPath: string, currentPath: string): Promise<readonly string[]> {
  const entries = await readdir(currentPath, {
    withFileTypes: true,
  });
  const results: string[] = [];

  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }

    const absolutePath = resolve(currentPath, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await listFilesRecursively(rootPath, absolutePath)));
      continue;
    }

    if (entry.isFile()) {
      results.push(relative(rootPath, absolutePath).replace(/\\/gu, '/'));
    }
  }

  return results.sort((left, right) => left.localeCompare(right));
}

function clampLimit(value: number, min = 1, max = DEFAULT_FILE_SEARCH_LIMIT): number {
  if (!Number.isFinite(value)) {
    return max;
  }

  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function dedupeStringList(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
