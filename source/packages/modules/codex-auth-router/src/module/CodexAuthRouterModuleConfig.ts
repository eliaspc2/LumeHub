import type { CodexAccountRepository } from '../infrastructure/persistence/CodexAccountRepository.js';
import type { CodexAuthRouterService } from '../application/services/CodexAuthRouterService.js';
import type { CodexAuthCanonicalWriter } from '../domain/services/CodexAuthCanonicalWriter.js';
import type { CodexAccountScorer } from '../domain/services/CodexAccountScorer.js';
import type { CodexAccountSwitchPolicy } from '../domain/services/CodexAccountSwitchPolicy.js';
import type { CodexAccountUsageService } from '../domain/services/CodexAccountUsageService.js';
import type { CodexAccountQuotaService } from '../domain/services/CodexAccountQuotaService.js';

export interface CodexAuthSourceConfig {
  readonly accountId: string;
  readonly label: string;
  readonly filePath: string;
  readonly priority?: number;
  readonly kind?: 'canonical_live' | 'secondary';
}

export interface CodexAuthRouterModuleConfig {
  readonly enabled?: boolean;
  readonly canonicalAuthFilePath?: string;
  readonly stateFilePath?: string;
  readonly backupDirectoryPath?: string;
  readonly backupHistoryDirectoryPath?: string;
  readonly backupHistoryRetentionLimit?: number;
  readonly sourceAccounts?: readonly CodexAuthSourceConfig[];
  readonly startByPreparingAuth?: boolean;
  readonly usageLimitsEnabled?: boolean;
  readonly usageLimitCacheTtlMs?: number;
  readonly repository?: CodexAccountRepository;
  readonly canonicalWriter?: CodexAuthCanonicalWriter;
  readonly accountScorer?: CodexAccountScorer;
  readonly switchPolicy?: CodexAccountSwitchPolicy;
  readonly usageService?: CodexAccountUsageService;
  readonly quotaService?: CodexAccountQuotaService;
  readonly service?: CodexAuthRouterService;
}
