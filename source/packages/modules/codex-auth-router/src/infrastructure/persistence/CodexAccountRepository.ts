import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type {
  CodexAccount,
  CodexAccountState,
  CodexAuthRouterState,
  DiscoveredCodexAccountSource,
} from '../../domain/entities/CodexAuthRouter.js';
import {
  DEFAULT_CODEX_ACCOUNT_STATE,
  DEFAULT_CODEX_AUTH_ROUTER_STATE,
} from '../../domain/entities/CodexAuthRouter.js';
import type { CodexAuthSourceConfig } from '../../module/CodexAuthRouterModuleConfig.js';

export interface CodexAccountRepositoryConfig {
  readonly canonicalAuthFilePath?: string;
  readonly stateFilePath?: string;
  readonly backupDirectoryPath?: string;
  readonly sourceAccounts?: readonly CodexAuthSourceConfig[];
}

export class CodexAccountRepository {
  private readonly canonicalAuthFilePath: string;
  private readonly stateFilePath: string;
  private readonly backupDirectoryPath: string;
  private readonly sourceAccounts: readonly DiscoveredCodexAccountSource[];

  constructor(
    config: CodexAccountRepositoryConfig = {},
    private readonly writer = new AtomicJsonWriter(),
  ) {
    this.canonicalAuthFilePath = config.canonicalAuthFilePath ?? '/home/eliaspc/.codex/auth.json';
    this.stateFilePath = config.stateFilePath ?? resolve(process.cwd(), 'data/runtime/codex-auth-router.state.json');
    this.backupDirectoryPath =
      config.backupDirectoryPath ?? resolve(process.cwd(), 'data/runtime/codex-auth-router-backups');
    this.sourceAccounts = buildSourceAccounts(this.canonicalAuthFilePath, config.sourceAccounts ?? []);
  }

  getCanonicalAuthFilePath(): string {
    return this.canonicalAuthFilePath;
  }

  getStateFilePath(): string {
    return this.stateFilePath;
  }

  getBackupDirectoryPath(): string {
    return this.backupDirectoryPath;
  }

  async readState(): Promise<CodexAuthRouterState> {
    try {
      const raw = JSON.parse(await readFile(this.stateFilePath, 'utf8')) as Partial<CodexAuthRouterState>;
      return normaliseState(raw);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return DEFAULT_CODEX_AUTH_ROUTER_STATE;
      }

      throw error;
    }
  }

  async saveState(state: CodexAuthRouterState): Promise<CodexAuthRouterState> {
    const normalised = normaliseState(state);
    await this.writer.write(this.stateFilePath, normalised);
    return normalised;
  }

  async listAccounts(state: CodexAuthRouterState): Promise<readonly CodexAccount[]> {
    const accounts = await Promise.all(
      this.sourceAccounts.map(async (source) => {
        const snapshot = await readAccountSnapshot(source.filePath);

        return {
          accountId: source.accountId,
          label: source.label,
          sourceFilePath: source.filePath,
          priority: source.priority,
          kind: source.kind,
          exists: snapshot.exists,
          contentHash: snapshot.contentHash,
          bytes: snapshot.bytes,
          lastModifiedAt: snapshot.lastModifiedAt,
          usage: mapAccountStateToUsage(state.accountStates[source.accountId]),
        } satisfies CodexAccount;
      }),
    );

    return accounts.sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label));
  }
}

function buildSourceAccounts(
  canonicalAuthFilePath: string,
  configuredSources: readonly CodexAuthSourceConfig[],
): readonly DiscoveredCodexAccountSource[] {
  const deduped = new Map<string, DiscoveredCodexAccountSource>();

  deduped.set('canonical-live', {
    accountId: 'canonical-live',
    label: 'Canonical live',
    filePath: canonicalAuthFilePath,
    priority: 0,
    kind: 'canonical_live',
  });

  for (const [index, source] of configuredSources.entries()) {
    deduped.set(source.accountId, {
      accountId: source.accountId,
      label: source.label,
      filePath: source.filePath,
      priority: source.priority ?? index + 1,
      kind: source.kind ?? 'secondary',
    });
  }

  return [...deduped.values()];
}

async function readAccountSnapshot(filePath: string): Promise<{
  readonly exists: boolean;
  readonly contentHash: string | null;
  readonly bytes: number | null;
  readonly lastModifiedAt: string | null;
}> {
  try {
    const [contents, metadata] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)]);

    return {
      exists: true,
      contentHash: createHash('sha256').update(contents).digest('hex'),
      bytes: Buffer.byteLength(contents),
      lastModifiedAt: metadata.mtime.toISOString(),
    };
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return {
        exists: false,
        contentHash: null,
        bytes: null,
        lastModifiedAt: null,
      };
    }

    throw error;
  }
}

function mapAccountStateToUsage(state: CodexAccountState | undefined) {
  const normalised = state ? normaliseAccountState(state) : DEFAULT_CODEX_ACCOUNT_STATE;

  return {
    successCount: normalised.successCount,
    failureCount: normalised.failureCount,
    consecutiveFailures: normalised.consecutiveFailures,
    lastSuccessAt: normalised.lastSuccessAt,
    lastFailureAt: normalised.lastFailureAt,
    lastFailureKind: normalised.lastFailureKind,
    lastFailureReason: normalised.lastFailureReason,
    cooldownUntil: normalised.cooldownUntil,
  } as const;
}

function normaliseState(input: Partial<CodexAuthRouterState>): CodexAuthRouterState {
  return {
    schemaVersion: 1,
    enabled: input.enabled !== false,
    currentSelection: input.currentSelection ?? null,
    accountStates: Object.fromEntries(
      Object.entries(input.accountStates ?? {}).map(([accountId, state]) => [accountId, normaliseAccountState(state)]),
    ),
    switchHistory: Array.isArray(input.switchHistory) ? input.switchHistory.slice(-25) : [],
    lastPreparedAt: input.lastPreparedAt ?? null,
    lastSwitchAt: input.lastSwitchAt ?? null,
    lastError: input.lastError ?? null,
    updatedAt: input.updatedAt ?? null,
  };
}

function normaliseAccountState(input: Partial<CodexAccountState> | undefined): CodexAccountState {
  return {
    successCount: input?.successCount ?? DEFAULT_CODEX_ACCOUNT_STATE.successCount,
    failureCount: input?.failureCount ?? DEFAULT_CODEX_ACCOUNT_STATE.failureCount,
    consecutiveFailures: input?.consecutiveFailures ?? DEFAULT_CODEX_ACCOUNT_STATE.consecutiveFailures,
    lastSuccessAt: input?.lastSuccessAt ?? DEFAULT_CODEX_ACCOUNT_STATE.lastSuccessAt,
    lastFailureAt: input?.lastFailureAt ?? DEFAULT_CODEX_ACCOUNT_STATE.lastFailureAt,
    lastFailureKind: input?.lastFailureKind ?? DEFAULT_CODEX_ACCOUNT_STATE.lastFailureKind,
    lastFailureReason: input?.lastFailureReason ?? DEFAULT_CODEX_ACCOUNT_STATE.lastFailureReason,
    cooldownUntil: input?.cooldownUntil ?? DEFAULT_CODEX_ACCOUNT_STATE.cooldownUntil,
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
