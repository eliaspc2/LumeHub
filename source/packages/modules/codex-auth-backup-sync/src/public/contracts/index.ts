export interface CodexAuthBackupSyncModuleContract {
  readonly moduleName: 'codex-auth-backup-sync';

  syncNow(): Promise<import('../../domain/entities/CodexAuthBackupSync.js').CodexAuthBackupSyncResult>;
  getStatus(): Promise<import('../../domain/entities/CodexAuthBackupSync.js').CodexAuthBackupSyncStatus>;
}
