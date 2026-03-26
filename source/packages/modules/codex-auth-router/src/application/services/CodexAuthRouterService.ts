import { randomUUID } from 'node:crypto';

import type {
  CodexAccount,
  CodexAccountSelection,
  CodexAuthRouterState,
  CodexAuthRouterStatus,
  CodexAuthSwitchRecord,
  CodexFailureKind,
  ForceCodexAuthSwitchInput,
  PrepareAuthForRequestInput,
  ReportCodexAuthFailureInput,
  ReportCodexAuthSuccessInput,
} from '../../domain/entities/CodexAuthRouter.js';
import { CodexAccountSwitchPolicy } from '../../domain/services/CodexAccountSwitchPolicy.js';
import { CodexAccountUsageService } from '../../domain/services/CodexAccountUsageService.js';
import { CodexAuthCanonicalWriter } from '../../domain/services/CodexAuthCanonicalWriter.js';
import { CodexAccountRepository } from '../../infrastructure/persistence/CodexAccountRepository.js';

const MAX_SWITCH_HISTORY = 25;

export class CodexAuthRouterService {
  constructor(
    private readonly repository: CodexAccountRepository,
    private readonly canonicalWriter: CodexAuthCanonicalWriter,
    private readonly switchPolicy: CodexAccountSwitchPolicy = new CodexAccountSwitchPolicy(),
    private readonly usageService: CodexAccountUsageService = new CodexAccountUsageService(),
  ) {}

  async prepareAuthForRequest(input: PrepareAuthForRequestInput = {}): Promise<CodexAccountSelection> {
    const now = input.now ?? new Date();
    const state = await this.repository.readState();
    const accounts = await this.repository.listAccounts(state);
    const selectedAccount =
      this.switchPolicy.selectAccount(accounts, state, {
        preferredAccountId: input.preferredAccountId,
        now,
      }) ?? failNoAccount(input.preferredAccountId ?? null);

    const writeResult = await this.canonicalWriter.writeFromSource(selectedAccount.sourceFilePath, now);
    const selection = buildSelection(selectedAccount, this.repository.getCanonicalAuthFilePath(), now, writeResult, input.reason ?? null);
    const nextState = appendAuditRecord(
      {
        ...state,
        currentSelection: selection,
        lastPreparedAt: now.toISOString(),
        lastSwitchAt: writeResult.switched ? now.toISOString() : state.lastSwitchAt,
        lastError: null,
        updatedAt: now.toISOString(),
      },
      {
        auditId: `codex-auth-${randomUUID()}`,
        event: input.preferredAccountId ? 'force_switch' : 'prepared',
        accountId: selectedAccount.accountId,
        label: selectedAccount.label,
        sourceFilePath: selectedAccount.sourceFilePath,
        canonicalAuthFilePath: this.repository.getCanonicalAuthFilePath(),
        createdAt: now.toISOString(),
        switchPerformed: writeResult.switched,
        backupFilePath: writeResult.backupFilePath,
        reason: input.reason ?? null,
        failureKind: null,
      },
    );

    await this.repository.saveState(nextState);
    return selection;
  }

  async forceSwitch(accountId: string, input: ForceCodexAuthSwitchInput = {}): Promise<CodexAccountSelection> {
    const now = input.now ?? new Date();
    const state = await this.repository.readState();
    const accounts = await this.repository.listAccounts(state);
    const selectedAccount =
      this.switchPolicy.selectAccount(accounts, state, {
        preferredAccountId: accountId,
        now,
        ignoreCooldown: true,
      }) ?? failMissingAccount(accountId);
    const writeResult = await this.canonicalWriter.writeFromSource(selectedAccount.sourceFilePath, now);
    const selection = buildSelection(selectedAccount, this.repository.getCanonicalAuthFilePath(), now, writeResult, input.reason ?? null);
    const recoveredState = this.usageService.recordSuccess(state, selectedAccount.accountId, now);
    const nextState = appendAuditRecord(
      {
        ...recoveredState,
        currentSelection: selection,
        lastPreparedAt: now.toISOString(),
        lastSwitchAt: writeResult.switched ? now.toISOString() : recoveredState.lastSwitchAt,
        lastError: null,
        updatedAt: now.toISOString(),
      },
      {
        auditId: `codex-auth-${randomUUID()}`,
        event: 'force_switch',
        accountId: selectedAccount.accountId,
        label: selectedAccount.label,
        sourceFilePath: selectedAccount.sourceFilePath,
        canonicalAuthFilePath: this.repository.getCanonicalAuthFilePath(),
        createdAt: now.toISOString(),
        switchPerformed: writeResult.switched,
        backupFilePath: writeResult.backupFilePath,
        reason: input.reason ?? null,
        failureKind: null,
      },
    );

    await this.repository.saveState(nextState);
    return selection;
  }

  async reportSuccess(input: ReportCodexAuthSuccessInput = {}): Promise<CodexAuthRouterStatus> {
    const now = input.now ?? new Date();
    const state = await this.repository.readState();
    const accountId = input.accountId ?? state.currentSelection?.accountId ?? failNoCurrentSelection();
    const currentSelection = state.currentSelection;
    const nextState = appendAuditRecord(
      this.usageService.recordSuccess(state, accountId, now),
      {
        auditId: `codex-auth-${randomUUID()}`,
        event: 'success_reported',
        accountId,
        label: currentSelection?.accountId === accountId ? currentSelection.label : null,
        sourceFilePath: currentSelection?.accountId === accountId ? currentSelection.sourceFilePath : null,
        canonicalAuthFilePath: this.repository.getCanonicalAuthFilePath(),
        createdAt: now.toISOString(),
        switchPerformed: false,
        backupFilePath: null,
        reason: input.reason ?? null,
        failureKind: null,
      },
    );

    await this.repository.saveState(nextState);
    return this.getStatus();
  }

  async reportFailure(input: ReportCodexAuthFailureInput): Promise<CodexAuthRouterStatus> {
    const now = input.now ?? new Date();
    const state = await this.repository.readState();
    const accountId = input.accountId ?? state.currentSelection?.accountId ?? failNoCurrentSelection();
    const currentSelection = state.currentSelection;
    const failureKind = input.failureKind ?? inferFailureKind(input.reason);
    const nextState = appendAuditRecord(
      this.usageService.recordFailure(state, accountId, input.reason, failureKind, now),
      {
        auditId: `codex-auth-${randomUUID()}`,
        event: 'failure_reported',
        accountId,
        label: currentSelection?.accountId === accountId ? currentSelection.label : null,
        sourceFilePath: currentSelection?.accountId === accountId ? currentSelection.sourceFilePath : null,
        canonicalAuthFilePath: this.repository.getCanonicalAuthFilePath(),
        createdAt: now.toISOString(),
        switchPerformed: false,
        backupFilePath: null,
        reason: input.reason,
        failureKind,
      },
    );

    await this.repository.saveState(nextState);
    return this.getStatus();
  }

  async getStatus(): Promise<CodexAuthRouterStatus> {
    const state = await this.repository.readState();
    const accounts = await this.repository.listAccounts(state);

    return {
      schemaVersion: 1,
      canonicalAuthFilePath: this.repository.getCanonicalAuthFilePath(),
      canonicalExists: accounts.some((account) => account.accountId === 'canonical-live' && account.exists),
      stateFilePath: this.repository.getStateFilePath(),
      backupDirectoryPath: this.repository.getBackupDirectoryPath(),
      currentSelection: state.currentSelection,
      accounts,
      switchHistory: state.switchHistory,
      lastPreparedAt: state.lastPreparedAt,
      lastSwitchAt: state.lastSwitchAt,
      lastError: state.lastError,
      accountCount: accounts.filter((account) => account.exists).length,
    };
  }
}

function buildSelection(
  account: CodexAccount,
  canonicalAuthFilePath: string,
  now: Date,
  writeResult: {
    readonly switched: boolean;
    readonly backupFilePath: string | null;
    readonly contentHash: string;
  },
  reason: string | null,
): CodexAccountSelection {
  return {
    accountId: account.accountId,
    label: account.label,
    sourceFilePath: account.sourceFilePath,
    canonicalAuthFilePath,
    selectedAt: now.toISOString(),
    switchPerformed: writeResult.switched,
    backupFilePath: writeResult.backupFilePath,
    reason,
    contentHash: writeResult.contentHash,
  };
}

function appendAuditRecord(state: CodexAuthRouterState, record: CodexAuthSwitchRecord): CodexAuthRouterState {
  return {
    ...state,
    switchHistory: [...state.switchHistory, record].slice(-MAX_SWITCH_HISTORY),
  };
}

function inferFailureKind(reason: string): CodexFailureKind {
  const lowerReason = reason.toLowerCase();

  if (lowerReason.includes('quota') || lowerReason.includes('rate')) {
    return 'quota';
  }

  if (lowerReason.includes('auth') || lowerReason.includes('token') || lowerReason.includes('oauth')) {
    return 'auth';
  }

  if (lowerReason.includes('network') || lowerReason.includes('timeout')) {
    return 'network';
  }

  return 'unknown';
}

function failNoAccount(preferredAccountId: string | null): never {
  if (preferredAccountId) {
    throw new Error(`Codex auth router could not prepare auth because account '${preferredAccountId}' is unavailable.`);
  }

  throw new Error('Codex auth router could not prepare auth because no account source is available.');
}

function failMissingAccount(accountId: string): never {
  throw new Error(`Codex auth router could not force switch because account '${accountId}' is unavailable.`);
}

function failNoCurrentSelection(): never {
  throw new Error('Codex auth router has no current account selection to report.');
}
