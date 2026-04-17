export type CodexAuthBackupSyncOutcome = 'idle' | 'disabled' | 'noop' | 'synced' | 'error';

export interface CodexAuthBackupSyncStatus {
  readonly enabled: boolean;
  readonly repositoryPath: string | null;
  readonly sourceHistoryDirectoryPath: string;
  readonly mirrorSubdirectory: string;
  readonly branch: string | null;
  readonly remoteName: string | null;
  readonly lastOutcome: CodexAuthBackupSyncOutcome;
  readonly lastSyncedAt: string | null;
  readonly lastCommitSha: string | null;
  readonly lastError: string | null;
}

export interface CodexAuthBackupSyncResult {
  readonly outcome: CodexAuthBackupSyncOutcome;
  readonly changed: boolean;
  readonly pushed: boolean;
  readonly mirroredFileCount: number;
  readonly removedFileCount: number;
  readonly commitSha: string | null;
  readonly syncedAt: string;
}
