import type { CodexAuthBackupSyncService } from '../application/services/CodexAuthBackupSyncService.js';
import type { GitCommandExecutor } from '../infrastructure/git/GitCommandExecutor.js';

export interface CodexAuthBackupSyncModuleConfig {
  readonly enabled?: boolean;
  readonly repositoryPath?: string;
  readonly sourceHistoryDirectoryPath?: string;
  readonly mirrorSubdirectory?: string;
  readonly branch?: string;
  readonly remoteName?: string | null;
  readonly commitMessagePrefix?: string;
  readonly authorName?: string;
  readonly authorEmail?: string;
  readonly pushEnabled?: boolean;
  readonly autoSyncOnStart?: boolean;
  readonly git?: GitCommandExecutor;
  readonly service?: CodexAuthBackupSyncService;
}
