import { resolve } from 'node:path';

import { BaseModule } from '@lume-hub/kernel';

import { CodexAuthBackupSyncService } from '../application/services/CodexAuthBackupSyncService.js';
import type { CodexAuthBackupSyncModuleContract } from '../public/contracts/index.js';
import type { CodexAuthBackupSyncModuleConfig } from './CodexAuthBackupSyncModuleConfig.js';

export class CodexAuthBackupSyncModule extends BaseModule implements CodexAuthBackupSyncModuleContract {
  readonly moduleName = 'codex-auth-backup-sync' as const;
  readonly service: CodexAuthBackupSyncService;

  constructor(readonly config: CodexAuthBackupSyncModuleConfig = {}) {
    super({
      name: 'codex-auth-backup-sync',
      version: '0.1.0',
      dependencies: ['codex-auth-router'],
    });

    this.service =
      config.service ??
      new CodexAuthBackupSyncService({
        enabled: config.enabled ?? Boolean(config.repositoryPath),
        repositoryPath: config.repositoryPath,
        sourceHistoryDirectoryPath:
          config.sourceHistoryDirectoryPath ?? resolve(process.cwd(), 'runtime/host/state/codex-auth-router-backups/history'),
        mirrorSubdirectory: config.mirrorSubdirectory,
        branch: config.branch,
        remoteName: config.remoteName,
        commitMessagePrefix: config.commitMessagePrefix,
        authorName: config.authorName,
        authorEmail: config.authorEmail,
        pushEnabled: config.pushEnabled,
        git: config.git,
      });
  }

  async start(): Promise<void> {
    if (this.config.enabled === false) {
      return;
    }

    if (this.config.autoSyncOnStart === false) {
      this.service.getStatus();
      return;
    }

    await this.service.syncNow();
  }

  async syncNow() {
    return this.service.syncNow();
  }

  async getStatus() {
    return this.service.getStatus();
  }

  async health() {
    const status = this.service.getStatus();

    return {
      status: status.enabled && status.lastError ? ('degraded' as const) : ('healthy' as const),
      details: {
        module: this.name,
        enabled: status.enabled,
        repositoryPath: status.repositoryPath,
        lastOutcome: status.lastOutcome,
        lastSyncedAt: status.lastSyncedAt,
      },
    };
  }
}
