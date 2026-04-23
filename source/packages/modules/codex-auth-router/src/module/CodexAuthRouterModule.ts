import { BaseModule } from '@lume-hub/kernel';

import { CodexAuthRouterService } from '../application/services/CodexAuthRouterService.js';
import { CodexAccountScorer } from '../domain/services/CodexAccountScorer.js';
import { CodexAccountSwitchPolicy } from '../domain/services/CodexAccountSwitchPolicy.js';
import { CodexAccountUsageService } from '../domain/services/CodexAccountUsageService.js';
import { CodexAccountQuotaService } from '../domain/services/CodexAccountQuotaService.js';
import { CodexAuthCanonicalWriter } from '../domain/services/CodexAuthCanonicalWriter.js';
import { CodexAccountRepository } from '../infrastructure/persistence/CodexAccountRepository.js';
import type { CodexAuthRouterModuleContract } from '../public/contracts/index.js';
import type { CodexAuthRouterModuleConfig } from './CodexAuthRouterModuleConfig.js';

export class CodexAuthRouterModule extends BaseModule implements CodexAuthRouterModuleContract {
  readonly moduleName = 'codex-auth-router' as const;
  readonly service: CodexAuthRouterService;

  constructor(readonly config: CodexAuthRouterModuleConfig = {}) {
    super({
      name: 'codex-auth-router',
      version: '0.1.0',
      dependencies: [],
    });

    const repository =
      config.repository ??
      new CodexAccountRepository({
        canonicalAuthFilePath: config.canonicalAuthFilePath,
        stateFilePath: config.stateFilePath,
        backupDirectoryPath: config.backupDirectoryPath,
        sourcesEnvironmentFilePath: config.sourcesEnvironmentFilePath,
        managedAccountsDirectoryPath: config.managedAccountsDirectoryPath,
        sourceAccounts: config.sourceAccounts,
      });
    const accountScorer = config.accountScorer ?? new CodexAccountScorer();
    const switchPolicy = config.switchPolicy ?? new CodexAccountSwitchPolicy(accountScorer);
    const usageService = config.usageService ?? new CodexAccountUsageService();
    const quotaService =
      config.quotaService ??
      new CodexAccountQuotaService({
        enabled: config.usageLimitsEnabled ?? true,
        cacheTtlMs: config.usageLimitCacheTtlMs,
      });
    const canonicalWriter =
      config.canonicalWriter ??
      new CodexAuthCanonicalWriter({
        canonicalAuthFilePath: repository.getCanonicalAuthFilePath(),
        backupDirectoryPath: repository.getBackupDirectoryPath(),
        historyDirectoryPath: config.backupHistoryDirectoryPath,
        historyRetentionLimit: config.backupHistoryRetentionLimit,
      });

    this.service =
      config.service ??
      new CodexAuthRouterService(repository, canonicalWriter, switchPolicy, usageService, quotaService);
  }

  async start(): Promise<void> {
    if (this.config.enabled === false) {
      return;
    }

    if (this.config.startByPreparingAuth === false) {
      await this.service.getStatus();
      return;
    }

    try {
      await this.service.prepareAuthForRequest({
        reason: 'module_start',
      });
    } catch {
      await this.service.getStatus();
    }
  }

  async prepareAuthForRequest(input?: Parameters<CodexAuthRouterService['prepareAuthForRequest']>[0]) {
    return this.service.prepareAuthForRequest(input);
  }

  async reportSuccess(input?: Parameters<CodexAuthRouterService['reportSuccess']>[0]) {
    return this.service.reportSuccess(input);
  }

  async reportFailure(input: Parameters<CodexAuthRouterService['reportFailure']>[0]) {
    return this.service.reportFailure(input);
  }

  async forceSwitch(accountId: string, input?: Parameters<CodexAuthRouterService['forceSwitch']>[1]) {
    return this.service.forceSwitch(accountId, input);
  }

  async importAccount(input: Parameters<CodexAuthRouterService['importAccount']>[0]) {
    return this.service.importAccount(input);
  }

  async setEnabled(enabled: boolean) {
    return this.service.setEnabled(enabled);
  }

  async getStatus() {
    return this.service.getStatus();
  }

  async refreshStatus() {
    return this.service.refreshStatus();
  }

  async health() {
    const status = await this.service.getStatus();

    return {
      status: status.canonicalExists ? ('healthy' as const) : ('degraded' as const),
      details: {
        module: this.name,
        enabled: status.enabled,
        canonicalAuthFilePath: status.canonicalAuthFilePath,
        currentAccountId: status.currentSelection?.accountId ?? null,
        accountCount: status.accountCount,
      },
    };
  }
}
