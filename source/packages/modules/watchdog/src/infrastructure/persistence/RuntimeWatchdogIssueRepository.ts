import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { AtomicJsonWriter, GroupFileLockManager } from '@lume-hub/persistence-group-files';

import type { WatchdogIssue } from '../../domain/entities/WatchdogIssue.js';
import type {
  WatchdogIssueQuery,
  WatchdogIssueRepository,
} from '../../domain/repositories/WatchdogIssueRepository.js';

interface WatchdogStateFile {
  readonly schemaVersion: 1;
  readonly updatedAt: string;
  readonly issues: readonly WatchdogIssue[];
}

export interface RuntimeWatchdogIssueRepositoryOptions {
  readonly dataRootPath?: string;
}

export class RuntimeWatchdogIssueRepository implements WatchdogIssueRepository {
  private readonly statePath: string;

  constructor(
    options: RuntimeWatchdogIssueRepositoryOptions = {},
    private readonly lockManager = new GroupFileLockManager(),
    private readonly writer = new AtomicJsonWriter(),
  ) {
    this.statePath = join(options.dataRootPath ?? 'data', 'runtime', 'watchdog.json');
  }

  async listIssues(query: WatchdogIssueQuery = {}): Promise<readonly WatchdogIssue[]> {
    const state = await this.readState();

    return state.issues
      .filter((issue) => !query.groupJid || issue.groupJid === query.groupJid)
      .filter((issue) => !query.status || issue.status === query.status)
      .filter((issue) => !query.kind || issue.kind === query.kind)
      .filter((issue) => !query.jobId || issue.jobId === query.jobId);
  }

  async saveIssue(issue: WatchdogIssue): Promise<WatchdogIssue> {
    const state = await this.readState();
    const nextState: WatchdogStateFile = {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      issues: [
        ...state.issues.filter((current) => current.issueId !== issue.issueId),
        issue,
      ].sort((left, right) => left.openedAt.localeCompare(right.openedAt) || left.issueId.localeCompare(right.issueId)),
    };

    await this.lockManager.withLock(this.statePath, async () => {
      await mkdir(dirname(this.statePath), { recursive: true });
      await this.writer.write(this.statePath, nextState);
    });

    return issue;
  }

  async readOpenIssue(kind: WatchdogIssue['kind'], jobId: string, groupJid: string): Promise<WatchdogIssue | undefined> {
    return (await this.listIssues({
      groupJid,
      status: 'open',
      kind,
      jobId,
    }))[0];
  }

  private async readState(): Promise<WatchdogStateFile> {
    try {
      const raw = JSON.parse(await readFile(this.statePath, 'utf8')) as Partial<WatchdogStateFile>;
      return {
        schemaVersion: 1,
        updatedAt: raw.updatedAt ?? new Date().toISOString(),
        issues: Array.isArray(raw.issues) ? raw.issues : [],
      };
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        return {
          schemaVersion: 1,
          updatedAt: new Date().toISOString(),
          issues: [],
        };
      }

      throw error;
    }
  }
}
