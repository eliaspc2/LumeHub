export type CodexFailureKind = 'quota' | 'auth' | 'network' | 'unknown';

export interface CodexUsageSnapshot {
  readonly successCount: number;
  readonly failureCount: number;
  readonly consecutiveFailures: number;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly lastFailureKind: CodexFailureKind | null;
  readonly lastFailureReason: string | null;
  readonly cooldownUntil: string | null;
}

export interface CodexQuotaWindowSnapshot {
  readonly windowSeconds: number | null;
  readonly usedPercent: number | null;
  readonly remainingPercent: number | null;
  readonly resetAfterSeconds: number | null;
  readonly resetAt: string | null;
}

export interface CodexQuotaCreditsSnapshot {
  readonly hasCredits: boolean;
  readonly unlimited: boolean;
  readonly balance: string | null;
  readonly approxLocalMessages: readonly number[];
  readonly approxCloudMessages: readonly number[];
}

export interface CodexQuotaSnapshot {
  readonly checkedAt: string;
  readonly allowed: boolean;
  readonly limitReached: boolean;
  readonly planType: string | null;
  readonly credits: CodexQuotaCreditsSnapshot;
  readonly primaryWindow: CodexQuotaWindowSnapshot | null;
  readonly secondaryWindow: CodexQuotaWindowSnapshot | null;
  readonly fetchError: string | null;
}

export interface CodexAccount {
  readonly accountId: string;
  readonly label: string;
  readonly sourceFilePath: string;
  readonly priority: number;
  readonly kind: 'canonical_live' | 'secondary';
  readonly exists: boolean;
  readonly contentHash: string | null;
  readonly bytes: number | null;
  readonly lastModifiedAt: string | null;
  readonly usage: CodexUsageSnapshot;
  readonly quota: CodexQuotaSnapshot | null;
}

export interface CodexAccountSelection {
  readonly accountId: string;
  readonly label: string;
  readonly sourceFilePath: string;
  readonly canonicalAuthFilePath: string;
  readonly selectedAt: string;
  readonly switchPerformed: boolean;
  readonly backupFilePath: string | null;
  readonly reason: string | null;
  readonly contentHash: string | null;
}

export interface CodexAuthSwitchRecord {
  readonly auditId: string;
  readonly event: 'prepared' | 'force_switch' | 'success_reported' | 'failure_reported';
  readonly accountId: string | null;
  readonly label: string | null;
  readonly sourceFilePath: string | null;
  readonly canonicalAuthFilePath: string;
  readonly createdAt: string;
  readonly switchPerformed: boolean;
  readonly backupFilePath: string | null;
  readonly reason: string | null;
  readonly failureKind: CodexFailureKind | null;
}

export interface CodexAccountState {
  readonly successCount: number;
  readonly failureCount: number;
  readonly consecutiveFailures: number;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly lastFailureKind: CodexFailureKind | null;
  readonly lastFailureReason: string | null;
  readonly cooldownUntil: string | null;
}

export interface CodexAuthRouterState {
  readonly schemaVersion: 1;
  readonly enabled: boolean;
  readonly currentSelection: CodexAccountSelection | null;
  readonly accountStates: Readonly<Record<string, CodexAccountState>>;
  readonly switchHistory: readonly CodexAuthSwitchRecord[];
  readonly lastPreparedAt: string | null;
  readonly lastSwitchAt: string | null;
  readonly lastError: string | null;
  readonly updatedAt: string | null;
}

export interface CodexAuthRouterStatus {
  readonly schemaVersion: 1;
  readonly enabled: boolean;
  readonly canonicalAuthFilePath: string;
  readonly canonicalExists: boolean;
  readonly stateFilePath: string;
  readonly backupDirectoryPath: string;
  readonly currentSelection: CodexAccountSelection | null;
  readonly accounts: readonly CodexAccount[];
  readonly switchHistory: readonly CodexAuthSwitchRecord[];
  readonly lastPreparedAt: string | null;
  readonly lastSwitchAt: string | null;
  readonly lastError: string | null;
  readonly accountCount: number;
}

export interface PrepareAuthForRequestInput {
  readonly preferredAccountId?: string;
  readonly reason?: string | null;
  readonly now?: Date;
}

export interface ReportCodexAuthSuccessInput {
  readonly accountId?: string | null;
  readonly reason?: string | null;
  readonly now?: Date;
}

export interface ReportCodexAuthFailureInput {
  readonly accountId?: string | null;
  readonly reason: string;
  readonly failureKind?: CodexFailureKind;
  readonly now?: Date;
}

export interface ForceCodexAuthSwitchInput {
  readonly reason?: string | null;
  readonly now?: Date;
}

export interface ImportCodexAuthAccountInput {
  readonly authJson: string;
  readonly label?: string | null;
  readonly now?: Date;
}

export interface ImportedCodexAuthAccount {
  readonly accountId: string;
  readonly label: string;
  readonly sourceFilePath: string;
  readonly created: boolean;
}

export interface DiscoveredCodexAccountSource {
  readonly accountId: string;
  readonly label: string;
  readonly filePath: string;
  readonly priority: number;
  readonly kind: 'canonical_live' | 'secondary';
}

export const DEFAULT_CODEX_USAGE_SNAPSHOT: CodexUsageSnapshot = {
  successCount: 0,
  failureCount: 0,
  consecutiveFailures: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailureKind: null,
  lastFailureReason: null,
  cooldownUntil: null,
};

export const DEFAULT_CODEX_ACCOUNT_STATE: CodexAccountState = {
  successCount: 0,
  failureCount: 0,
  consecutiveFailures: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailureKind: null,
  lastFailureReason: null,
  cooldownUntil: null,
};

export const DEFAULT_CODEX_AUTH_ROUTER_STATE: CodexAuthRouterState = {
  schemaVersion: 1,
  enabled: true,
  currentSelection: null,
  accountStates: {},
  switchHistory: [],
  lastPreparedAt: null,
  lastSwitchAt: null,
  lastError: null,
  updatedAt: null,
};
