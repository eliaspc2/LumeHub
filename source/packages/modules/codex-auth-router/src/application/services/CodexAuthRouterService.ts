import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

    if (!state.enabled) {
      return buildDisabledSelection(state, accounts, this.repository.getCanonicalAuthFilePath(), now, input.reason ?? null);
    }

    const selectedAccount =
      this.switchPolicy.selectAccount(accounts, state, {
        preferredAccountId: input.preferredAccountId,
        now,
      }) ?? failNoAccount(input.preferredAccountId ?? null);
    const syncBackAccount = await resolveSyncBackAccount(
      state,
      accounts,
      this.repository.getCanonicalAuthFilePath(),
    );

    const writeResult = await this.canonicalWriter.writeFromSource(selectedAccount.sourceFilePath, {
      now,
      previousAccountId: syncBackAccount?.accountId ?? state.currentSelection?.accountId ?? 'canonical-live',
      syncBackFilePath: syncBackAccount?.sourceFilePath ?? null,
    });
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

    if (!state.enabled) {
      throw new Error('Codex auth router switching is disabled.');
    }

    const accounts = await this.repository.listAccounts(state);
    const selectedAccount =
      this.switchPolicy.selectAccount(accounts, state, {
        preferredAccountId: accountId,
        now,
        ignoreCooldown: true,
      }) ?? failMissingAccount(accountId);
    const syncBackAccount = await resolveSyncBackAccount(
      state,
      accounts,
      this.repository.getCanonicalAuthFilePath(),
    );
    const writeResult = await this.canonicalWriter.writeFromSource(selectedAccount.sourceFilePath, {
      now,
      previousAccountId: syncBackAccount?.accountId ?? state.currentSelection?.accountId ?? 'canonical-live',
      syncBackFilePath: syncBackAccount?.sourceFilePath ?? null,
    });
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

  async setEnabled(enabled: boolean): Promise<CodexAuthRouterStatus> {
    const state = await this.repository.readState();

    if (state.enabled === enabled) {
      return this.getStatus();
    }

    await this.repository.saveState({
      ...state,
      enabled,
      updatedAt: new Date().toISOString(),
    });

    return this.getStatus();
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
    const currentSelection = await resolveVisibleCurrentSelection(
      state,
      accounts,
      this.repository.getCanonicalAuthFilePath(),
    );

    return {
      schemaVersion: 1,
      enabled: state.enabled,
      canonicalAuthFilePath: this.repository.getCanonicalAuthFilePath(),
      canonicalExists: await fileExists(this.repository.getCanonicalAuthFilePath()),
      stateFilePath: this.repository.getStateFilePath(),
      backupDirectoryPath: this.repository.getBackupDirectoryPath(),
      currentSelection,
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

function buildDisabledSelection(
  state: CodexAuthRouterState,
  accounts: readonly CodexAccount[],
  canonicalAuthFilePath: string,
  now: Date,
  reason: string | null,
): CodexAccountSelection {
  if (state.currentSelection) {
    return {
      ...state.currentSelection,
      canonicalAuthFilePath,
      reason,
      switchPerformed: false,
      backupFilePath: null,
      selectedAt: now.toISOString(),
    };
  }

  const canonicalAccount = accounts.find((account) => account.kind === 'canonical_live') ?? accounts[0] ?? failNoAccount(null);

  return {
    accountId: canonicalAccount.accountId,
    label: canonicalAccount.label,
    sourceFilePath: canonicalAccount.sourceFilePath,
    canonicalAuthFilePath,
    selectedAt: now.toISOString(),
    switchPerformed: false,
    backupFilePath: null,
    reason,
    contentHash: canonicalAccount.contentHash,
  };
}

function appendAuditRecord(state: CodexAuthRouterState, record: CodexAuthSwitchRecord): CodexAuthRouterState {
  return {
    ...state,
    switchHistory: [...state.switchHistory, record].slice(-MAX_SWITCH_HISTORY),
  };
}

async function resolveSyncBackAccount(
  state: CodexAuthRouterState,
  accounts: readonly CodexAccount[],
  canonicalAuthFilePath: string,
): Promise<CodexAccount | null> {
  const canonicalAccountId = await readCanonicalAccountId(canonicalAuthFilePath);
  const accountFromCanonical = canonicalAccountId
    ? accounts.find((account) => account.accountId === canonicalAccountId)
    : null;
  const accountFromState = state.currentSelection?.accountId
    ? accounts.find((account) => account.accountId === state.currentSelection?.accountId)
    : null;
  const account = accountFromCanonical ?? accountFromState ?? null;

  if (
    !account ||
    account.kind === 'canonical_live' ||
    resolve(account.sourceFilePath) === resolve(canonicalAuthFilePath)
  ) {
    return null;
  }

  return account;
}

async function resolveVisibleCurrentSelection(
  state: CodexAuthRouterState,
  accounts: readonly CodexAccount[],
  canonicalAuthFilePath: string,
): Promise<CodexAccountSelection | null> {
  if (state.currentSelection && accounts.some((account) => account.accountId === state.currentSelection?.accountId)) {
    return state.currentSelection;
  }

  const canonicalAccountId = await readCanonicalAccountId(canonicalAuthFilePath);
  const accountFromCanonical = canonicalAccountId
    ? accounts.find((account) => account.accountId === canonicalAccountId)
    : null;

  if (!accountFromCanonical) {
    return state.currentSelection;
  }

  return {
    accountId: accountFromCanonical.accountId,
    label: accountFromCanonical.label,
    sourceFilePath: accountFromCanonical.sourceFilePath,
    canonicalAuthFilePath,
    selectedAt: state.currentSelection?.selectedAt ?? new Date().toISOString(),
    switchPerformed: false,
    backupFilePath: null,
    reason: state.currentSelection?.reason ?? null,
    contentHash: accountFromCanonical.contentHash,
  };
}

async function readCanonicalAccountId(canonicalAuthFilePath: string): Promise<string | null> {
  try {
    const raw = JSON.parse(await readFile(canonicalAuthFilePath, 'utf8')) as {
      readonly tokens?: { readonly account_id?: unknown };
    };
    const accountId = typeof raw.tokens?.account_id === 'string' ? raw.tokens.account_id.trim() : '';
    return accountId.length > 0 ? accountId : null;
  } catch {
    return null;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath, 'utf8');
    return true;
  } catch {
    return false;
  }
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
