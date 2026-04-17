import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

import type { CodexAuthBackupSyncResult, CodexAuthBackupSyncStatus } from '../../domain/entities/CodexAuthBackupSync.js';
import { GitCommandExecutor } from '../../infrastructure/git/GitCommandExecutor.js';

export interface CodexAuthBackupSyncServiceConfig {
  readonly enabled: boolean;
  readonly repositoryPath?: string;
  readonly sourceHistoryDirectoryPath: string;
  readonly mirrorSubdirectory?: string;
  readonly branch?: string;
  readonly remoteName?: string | null;
  readonly commitMessagePrefix?: string;
  readonly authorName?: string;
  readonly authorEmail?: string;
  readonly pushEnabled?: boolean;
  readonly git?: GitCommandExecutor;
}

export class CodexAuthBackupSyncService {
  private readonly git: GitCommandExecutor;
  private readonly mirrorSubdirectory: string;
  private readonly branch: string;
  private readonly remoteName: string | null;
  private readonly commitMessagePrefix: string;
  private readonly authorName: string;
  private readonly authorEmail: string;
  private readonly pushEnabled: boolean;
  private activeSync: Promise<CodexAuthBackupSyncResult> | null = null;
  private status: CodexAuthBackupSyncStatus;

  constructor(private readonly config: CodexAuthBackupSyncServiceConfig) {
    this.git = config.git ?? new GitCommandExecutor();
    this.mirrorSubdirectory = config.mirrorSubdirectory ?? 'history/lume-hub';
    this.branch = config.branch ?? 'main';
    this.remoteName = config.remoteName ?? 'origin';
    this.commitMessagePrefix = config.commitMessagePrefix ?? 'chore: sync lume-hub codex auth backups';
    this.authorName = config.authorName ?? 'LumeHub';
    this.authorEmail = config.authorEmail ?? 'lume-hub@localhost';
    this.pushEnabled = config.pushEnabled ?? true;
    this.status = {
      enabled: config.enabled,
      repositoryPath: config.repositoryPath ?? null,
      sourceHistoryDirectoryPath: config.sourceHistoryDirectoryPath,
      mirrorSubdirectory: this.mirrorSubdirectory,
      branch: config.repositoryPath ? this.branch : null,
      remoteName: config.repositoryPath ? this.remoteName : null,
      lastOutcome: config.enabled ? 'idle' : 'disabled',
      lastSyncedAt: null,
      lastCommitSha: null,
      lastError: null,
    };
  }

  getStatus(): CodexAuthBackupSyncStatus {
    return this.status;
  }

  async syncNow(now = new Date()): Promise<CodexAuthBackupSyncResult> {
    if (this.activeSync) {
      return this.activeSync;
    }

    this.activeSync = this.performSync(now).finally(() => {
      this.activeSync = null;
    });

    return this.activeSync;
  }

  private async performSync(now: Date): Promise<CodexAuthBackupSyncResult> {
    const syncedAt = now.toISOString();

    if (!this.config.enabled || !this.config.repositoryPath) {
      const result = {
        outcome: 'disabled' as const,
        changed: false,
        pushed: false,
        mirroredFileCount: 0,
        removedFileCount: 0,
        commitSha: null,
        syncedAt,
      };
      this.status = {
        ...this.status,
        enabled: false,
        lastOutcome: result.outcome,
        lastSyncedAt: syncedAt,
        lastError: null,
      };
      return result;
    }

    try {
      await this.ensureGitRepository(this.config.repositoryPath);

      const mirrorDirectoryPath = join(this.config.repositoryPath, this.mirrorSubdirectory);
      const mirrorResult = await mirrorDirectory(this.config.sourceHistoryDirectoryPath, mirrorDirectoryPath);
      const statusResult = await this.git.execute(
        this.config.repositoryPath,
        ['status', '--porcelain', '--', this.mirrorSubdirectory],
      );

      if (!statusResult.stdout.trim()) {
        const result = {
          outcome: 'noop' as const,
          changed: false,
          pushed: false,
          mirroredFileCount: mirrorResult.mirroredFileCount,
          removedFileCount: mirrorResult.removedFileCount,
          commitSha: this.status.lastCommitSha,
          syncedAt,
        };
        this.status = {
          ...this.status,
          enabled: true,
          lastOutcome: result.outcome,
          lastSyncedAt: syncedAt,
          lastError: null,
        };
        return result;
      }

      await this.git.execute(this.config.repositoryPath, ['add', '--all', '--', this.mirrorSubdirectory]);
      await this.git.execute(
        this.config.repositoryPath,
        ['commit', '-m', `${this.commitMessagePrefix} ${syncedAt}`],
        {
          additionalConfig: {
            'user.name': this.authorName,
            'user.email': this.authorEmail,
          },
        },
      );

      const headResult = await this.git.execute(this.config.repositoryPath, ['rev-parse', 'HEAD']);
      const commitSha = headResult.stdout.trim() || null;

      let pushed = false;

      if (this.pushEnabled && this.remoteName && (await this.hasRemote(this.config.repositoryPath, this.remoteName))) {
        await this.git.execute(this.config.repositoryPath, ['push', this.remoteName, `HEAD:${this.branch}`]);
        pushed = true;
      }

      const result = {
        outcome: 'synced' as const,
        changed: true,
        pushed,
        mirroredFileCount: mirrorResult.mirroredFileCount,
        removedFileCount: mirrorResult.removedFileCount,
        commitSha,
        syncedAt,
      };
      this.status = {
        ...this.status,
        enabled: true,
        lastOutcome: result.outcome,
        lastSyncedAt: syncedAt,
        lastCommitSha: commitSha,
        lastError: null,
      };
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.status = {
        ...this.status,
        enabled: true,
        lastOutcome: 'error',
        lastSyncedAt: syncedAt,
        lastError: message,
      };
      return {
        outcome: 'error',
        changed: false,
        pushed: false,
        mirroredFileCount: 0,
        removedFileCount: 0,
        commitSha: this.status.lastCommitSha,
        syncedAt,
      };
    }
  }

  private async ensureGitRepository(repositoryPath: string): Promise<void> {
    const result = await this.git.execute(repositoryPath, ['rev-parse', '--is-inside-work-tree'], {
      allowFailure: true,
    });

    if (result.exitCode !== 0 || result.stdout.trim() !== 'true') {
      throw new Error(`Codex auth backup sync requires a git repository at '${repositoryPath}'.`);
    }
  }

  private async hasRemote(repositoryPath: string, remoteName: string): Promise<boolean> {
    const result = await this.git.execute(repositoryPath, ['remote', 'get-url', remoteName], {
      allowFailure: true,
    });

    return result.exitCode === 0 && result.stdout.trim().length > 0;
  }
}

async function mirrorDirectory(
  sourceRootPath: string,
  destinationRootPath: string,
): Promise<{
  readonly mirroredFileCount: number;
  readonly removedFileCount: number;
}> {
  await mkdir(destinationRootPath, { recursive: true });

  const sourceFiles = await listRelativeFiles(sourceRootPath);
  const destinationFiles = await listRelativeFiles(destinationRootPath);
  const sourceFileSet = new Set(sourceFiles);
  let mirroredFileCount = 0;
  let removedFileCount = 0;

  for (const relativePath of sourceFiles) {
    const sourceFilePath = join(sourceRootPath, relativePath);
    const destinationFilePath = join(destinationRootPath, relativePath);
    const [sourceContents, destinationContents] = await Promise.all([
      readFile(sourceFilePath),
      readFile(destinationFilePath).catch((error: unknown) => {
        if (isNodeError(error) && error.code === 'ENOENT') {
          return null;
        }

        throw error;
      }),
    ]);

    if (!destinationContents || !sourceContents.equals(destinationContents)) {
      await mkdir(dirname(destinationFilePath), { recursive: true });
      await writeFile(destinationFilePath, sourceContents);
      mirroredFileCount += 1;
    }
  }

  for (const relativePath of destinationFiles) {
    if (sourceFileSet.has(relativePath)) {
      continue;
    }

    await rm(join(destinationRootPath, relativePath), { force: true });
    removedFileCount += 1;
  }

  await pruneEmptyDirectories(destinationRootPath);

  return {
    mirroredFileCount,
    removedFileCount,
  };
}

async function listRelativeFiles(rootPath: string): Promise<readonly string[]> {
  const files: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    let entries;

    try {
      entries = await readdir(currentPath, { withFileTypes: true });
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return;
      }

      throw error;
    }

    for (const entry of entries) {
      const entryPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (entry.isFile()) {
        files.push(relative(rootPath, entryPath));
      }
    }
  }

  await walk(rootPath);

  return files.sort();
}

async function pruneEmptyDirectories(rootPath: string): Promise<boolean> {
  let entries;

  try {
    entries = await readdir(rootPath, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return true;
    }

    throw error;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      return false;
    }

    const empty = await pruneEmptyDirectories(join(rootPath, entry.name));

    if (!empty) {
      return false;
    }
  }

  await rm(rootPath, { recursive: true, force: true });
  return true;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
