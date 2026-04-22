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
    const discoveredAccounts = await Promise.all(
      this.sourceAccounts.map(async (source) => {
        const snapshot = await readAccountSnapshot(source.filePath);

        return {
          account: {
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
          } satisfies CodexAccount,
          tokenIdentityKey: snapshot.tokenIdentityKey,
        };
      }),
    );
    const accounts = hideCanonicalLiveDuplicate(discoveredAccounts);

    return [...accounts].sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label));
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
  readonly tokenIdentityKey: string | null;
}> {
  try {
    const [contents, metadata] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)]);

    return {
      exists: true,
      contentHash: createHash('sha256').update(contents).digest('hex'),
      bytes: Buffer.byteLength(contents),
      lastModifiedAt: metadata.mtime.toISOString(),
      tokenIdentityKey: deriveTokenIdentityKey(contents),
    };
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return {
        exists: false,
        contentHash: null,
        bytes: null,
        lastModifiedAt: null,
        tokenIdentityKey: null,
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

function hideCanonicalLiveDuplicate(
  discoveredAccounts: readonly {
    readonly account: CodexAccount;
    readonly tokenIdentityKey: string | null;
  }[],
): readonly CodexAccount[] {
  const canonicalAccount = discoveredAccounts.find((entry) => entry.account.kind === 'canonical_live');

  if (!canonicalAccount?.tokenIdentityKey) {
    return discoveredAccounts.map((entry) => entry.account);
  }

  const canonicalIsKnownSecondary = discoveredAccounts.some(
    (entry) =>
      entry.account.kind !== 'canonical_live' &&
      entry.tokenIdentityKey === canonicalAccount.tokenIdentityKey,
  );

  return discoveredAccounts
    .filter((entry) => entry.account.kind !== 'canonical_live' || !canonicalIsKnownSecondary)
    .map((entry) => entry.account);
}

function deriveTokenIdentityKey(contents: string): string | null {
  try {
    const raw = JSON.parse(contents) as {
      readonly tokens?: {
        readonly account_id?: unknown;
        readonly id_token?: unknown;
      };
    };
    const accountId = typeof raw.tokens?.account_id === 'string' ? raw.tokens.account_id.trim() : '';

    if (accountId.length > 0) {
      return `chatgpt_account_id:${accountId}`;
    }

    const payload = typeof raw.tokens?.id_token === 'string' ? decodeJwtPayload(raw.tokens.id_token) : null;
    const authClaims = payload?.['https://api.openai.com/auth'];
    const authAccountId =
      isRecord(authClaims) && typeof authClaims.chatgpt_account_id === 'string'
        ? authClaims.chatgpt_account_id.trim()
        : '';

    if (authAccountId.length > 0) {
      return `chatgpt_account_id:${authAccountId}`;
    }

    const subject = typeof payload?.sub === 'string' ? payload.sub.trim() : '';

    return subject.length > 0 ? `subject:${subject}` : null;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split('.');

  if (!payload) {
    return null;
  }

  try {
    const json = Buffer.from(payload.replaceAll('-', '+').replaceAll('_', '/'), 'base64').toString('utf8');
    const decoded = JSON.parse(json) as unknown;
    return isRecord(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
