import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

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
  readonly sourcesEnvironmentFilePath?: string;
  readonly managedAccountsDirectoryPath?: string;
  readonly sourceAccounts?: readonly CodexAuthSourceConfig[];
}

export class CodexAccountRepository {
  private readonly canonicalAuthFilePath: string;
  private readonly stateFilePath: string;
  private readonly backupDirectoryPath: string;
  private readonly sourcesEnvironmentFilePath: string | null;
  private readonly managedAccountsDirectoryPath: string | null;
  private readonly sourceAccounts: readonly CodexAuthSourceConfig[];

  constructor(
    config: CodexAccountRepositoryConfig = {},
    private readonly writer = new AtomicJsonWriter(),
  ) {
    this.canonicalAuthFilePath = config.canonicalAuthFilePath ?? '/home/eliaspc/.codex/auth.json';
    this.stateFilePath = config.stateFilePath ?? resolve(process.cwd(), 'data/runtime/codex-auth-router.state.json');
    this.backupDirectoryPath =
      config.backupDirectoryPath ?? resolve(process.cwd(), 'data/runtime/codex-auth-router-backups');
    this.sourcesEnvironmentFilePath = config.sourcesEnvironmentFilePath ?? null;
    this.managedAccountsDirectoryPath = config.managedAccountsDirectoryPath ?? null;
    this.sourceAccounts = config.sourceAccounts ?? [];
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

  getSourcesEnvironmentFilePath(): string | null {
    return this.sourcesEnvironmentFilePath;
  }

  getManagedAccountsDirectoryPath(): string | null {
    return this.managedAccountsDirectoryPath;
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
    const sourceAccounts = await this.listDiscoveredSources();
    const discoveredAccounts = await Promise.all(
      sourceAccounts.map(async (source) => {
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
            quota: null,
          } satisfies CodexAccount,
          tokenIdentityKey: snapshot.tokenIdentityKey,
        };
      }),
    );
    const accounts = hideCanonicalLiveDuplicate(discoveredAccounts);

    return [...accounts].sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label));
  }

  async listSecondarySources(): Promise<readonly DiscoveredCodexAccountSource[]> {
    const sources = await this.listDiscoveredSources();
    return sources.filter((source) => source.kind !== 'canonical_live');
  }

  async upsertManagedSource(input: {
    readonly accountId: string;
    readonly label: string;
    readonly authJson: string;
    readonly preferredFilePath?: string | null;
  }): Promise<DiscoveredCodexAccountSource> {
    const existingSources = await this.listSecondarySources();
    const existingSource = existingSources.find((source) => source.accountId === input.accountId) ?? null;
    const sourceFilePath = this.resolveManagedSourceFilePath(input.accountId, input.preferredFilePath ?? existingSource?.filePath ?? null);

    await writeFileAtomically(sourceFilePath, input.authJson);
    await this.writeManagedSourceMetadata(sourceFilePath, {
      accountId: input.accountId,
      label: input.label,
    });

    const nextPriority =
      existingSource?.priority ??
      Math.max(0, ...existingSources.map((source) => source.priority)) + 1;
    const updatedSource: DiscoveredCodexAccountSource = {
      accountId: input.accountId,
      label: input.label,
      filePath: sourceFilePath,
      priority: nextPriority,
      kind: 'secondary',
    };

    await this.persistDynamicSources([
      ...existingSources.filter((source) => source.accountId !== input.accountId),
      updatedSource,
    ]);

    return updatedSource;
  }

  async renameSource(accountId: string, label: string): Promise<DiscoveredCodexAccountSource> {
    const nextLabel = label.trim();

    if (!nextLabel) {
      throw new Error('Codex auth router rename requires a non-empty label.');
    }

    const existingSources = await this.listSecondarySources();
    const existingSource = existingSources.find((source) => source.accountId === accountId) ?? null;

    if (!existingSource) {
      throw new Error(`Codex auth router could not rename account '${accountId}' because it is unavailable.`);
    }

    const updatedSource: DiscoveredCodexAccountSource = {
      ...existingSource,
      label: nextLabel,
    };

    if (this.isManagedSourceFilePath(existingSource.filePath)) {
      await this.writeManagedSourceMetadata(existingSource.filePath, {
        accountId: existingSource.accountId,
        label: nextLabel,
      });
    }

    await this.persistDynamicSources([
      ...existingSources.filter((source) => source.accountId !== accountId),
      updatedSource,
    ]);

    return updatedSource;
  }

  async removeSource(accountId: string): Promise<{
    readonly accountId: string;
    readonly label: string;
    readonly sourceFilePath: string;
    readonly removedStoredFile: boolean;
  }> {
    const existingSources = await this.listSecondarySources();
    const existingSource = existingSources.find((source) => source.accountId === accountId) ?? null;

    if (!existingSource) {
      throw new Error(`Codex auth router could not remove account '${accountId}' because it is unavailable.`);
    }

    const dynamicSources = await this.readDynamicSources();
    const isDynamicSource = dynamicSources.some((source) => source.accountId === accountId);
    const removedStoredFile = this.isManagedSourceFilePath(existingSource.filePath);

    if (!isDynamicSource && !removedStoredFile) {
      throw new Error(`Codex auth router could not remove account '${accountId}' because this source is fixed in code.`);
    }

    await this.persistDynamicSources(existingSources.filter((source) => source.accountId !== accountId));

    if (removedStoredFile) {
      await rm(dirname(existingSource.filePath), { recursive: true, force: true });
    }

    return {
      accountId: existingSource.accountId,
      label: existingSource.label,
      sourceFilePath: existingSource.filePath,
      removedStoredFile,
    };
  }

  private async listDiscoveredSources(): Promise<readonly DiscoveredCodexAccountSource[]> {
    return buildSourceAccounts(
      this.canonicalAuthFilePath,
      this.sourceAccounts,
      await this.readDynamicSources(),
    );
  }

  private async readDynamicSources(): Promise<readonly CodexAuthSourceConfig[]> {
    const [directorySources, environmentSources] = await Promise.all([
      this.readManagedSourcesFromDirectory(),
      this.readSourcesFromEnvironmentFile(),
    ]);
    const deduped = new Map<string, CodexAuthSourceConfig>();

    for (const source of directorySources) {
      deduped.set(source.accountId, source);
    }

    for (const source of environmentSources) {
      deduped.set(source.accountId, source);
    }

    return [...deduped.values()];
  }

  private async readSourcesFromEnvironmentFile(): Promise<readonly CodexAuthSourceConfig[]> {
    if (!this.sourcesEnvironmentFilePath) {
      return [];
    }

    try {
      const rawContents = await readFile(this.sourcesEnvironmentFilePath, 'utf8');
      return parseSourcesEnvironmentFile(rawContents);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  private async readManagedSourcesFromDirectory(): Promise<readonly CodexAuthSourceConfig[]> {
    if (!this.managedAccountsDirectoryPath) {
      return [];
    }

    let entries;

    try {
      entries = await readdir(this.managedAccountsDirectoryPath, { withFileTypes: true });
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return [];
      }

      throw error;
    }

    const sources = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .sort((left, right) => String(left.name).localeCompare(String(right.name)))
        .map(async (entry, index) => {
          const entryName = String(entry.name);
          const sourceFilePath = resolve(this.managedAccountsDirectoryPath as string, entryName, 'auth.json');

          try {
            const authContents = await readFile(sourceFilePath, 'utf8');
            const identity = deriveCodexAuthIdentity(authContents);
            const accountId = identity?.accountId?.trim() || entryName;

            return {
              accountId,
              label: await this.readManagedSourceLabel(sourceFilePath, accountId),
              filePath: sourceFilePath,
              priority: index + 1,
              kind: 'secondary' as const,
            };
          } catch (error) {
            if (isNodeError(error) && error.code === 'ENOENT') {
              return null;
            }

            throw error;
          }
        }),
    );

    return sources.filter((source): source is Exclude<(typeof sources)[number], null> => source !== null);
  }

  private async persistDynamicSources(sources: readonly DiscoveredCodexAccountSource[]): Promise<void> {
    if (!this.sourcesEnvironmentFilePath) {
      return;
    }

    const normalizedSources = [...sources]
      .sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label))
      .map((source, index) => ({
        accountId: source.accountId,
        label: source.label,
        filePath: source.filePath,
        priority: Number.isInteger(source.priority) ? source.priority : index + 1,
        kind: source.kind,
      }));

    await writeFileAtomically(this.sourcesEnvironmentFilePath, serialiseSourcesEnvironmentFile(normalizedSources));
  }

  private resolveManagedSourceFilePath(accountId: string, preferredFilePath: string | null): string {
    if (preferredFilePath?.trim()) {
      return resolve(preferredFilePath);
    }

    const managedDirectoryPath =
      this.managedAccountsDirectoryPath ?? resolve(dirname(this.backupDirectoryPath), 'secondary');

    return resolve(managedDirectoryPath, sanitisePathSegment(accountId), 'auth.json');
  }

  private async writeManagedSourceMetadata(
    sourceFilePath: string,
    metadata: {
      readonly accountId: string;
      readonly label: string;
    },
  ): Promise<void> {
    const metadataFilePath = join(dirname(sourceFilePath), 'meta.json');
    await writeFileAtomically(metadataFilePath, JSON.stringify(metadata, null, 2));
  }

  private isManagedSourceFilePath(filePath: string): boolean {
    if (!this.managedAccountsDirectoryPath) {
      return false;
    }

    const managedDirectoryPath = resolve(this.managedAccountsDirectoryPath);
    const managedRoot = `${managedDirectoryPath}${managedDirectoryPath.endsWith('/') ? '' : '/'}`;
    return resolve(filePath).startsWith(managedRoot);
  }

  private async readManagedSourceLabel(sourceFilePath: string, fallbackAccountId: string): Promise<string> {
    const metadataFilePath = join(dirname(sourceFilePath), 'meta.json');

    try {
      const raw = JSON.parse(await readFile(metadataFilePath, 'utf8')) as { readonly label?: unknown };
      return typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : `account-${fallbackAccountId.slice(0, 8)}`;
    } catch (error) {
      if (isNodeError(error) && error.code !== 'ENOENT') {
        throw error;
      }
    }

    return `account-${fallbackAccountId.slice(0, 8)}`;
  }
}

function buildSourceAccounts(
  canonicalAuthFilePath: string,
  configuredSources: readonly CodexAuthSourceConfig[],
  dynamicSources: readonly CodexAuthSourceConfig[],
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

  for (const [index, source] of dynamicSources.entries()) {
    deduped.set(source.accountId, {
      accountId: source.accountId,
      label: source.label,
      filePath: source.filePath,
      priority: source.priority ?? configuredSources.length + index + 1,
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
    return deriveCodexAuthIdentity(contents)?.tokenIdentityKey ?? null;
  } catch {
    return null;
  }
}

export function deriveCodexAuthIdentity(contents: string): {
  readonly accountId: string | null;
  readonly subject: string | null;
  readonly tokenIdentityKey: string | null;
} | null {
  try {
    const raw = JSON.parse(contents) as {
      readonly tokens?: {
        readonly account_id?: unknown;
        readonly id_token?: unknown;
      };
    };
    const accountId = typeof raw.tokens?.account_id === 'string' ? raw.tokens.account_id.trim() : '';

    if (accountId.length > 0) {
      return {
        accountId,
        subject: null,
        tokenIdentityKey: `chatgpt_account_id:${accountId}`,
      };
    }

    const payload = typeof raw.tokens?.id_token === 'string' ? decodeJwtPayload(raw.tokens.id_token) : null;
    const authClaims = payload?.['https://api.openai.com/auth'];
    const authAccountId =
      isRecord(authClaims) && typeof authClaims.chatgpt_account_id === 'string'
        ? authClaims.chatgpt_account_id.trim()
        : '';

    if (authAccountId.length > 0) {
      return {
        accountId: authAccountId,
        subject: typeof payload?.sub === 'string' ? payload.sub.trim() || null : null,
        tokenIdentityKey: `chatgpt_account_id:${authAccountId}`,
      };
    }

    const subject = typeof payload?.sub === 'string' ? payload.sub.trim() : '';

    return {
      accountId: subject || null,
      subject: subject || null,
      tokenIdentityKey: subject.length > 0 ? `subject:${subject}` : null,
    };
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

function parseSourcesEnvironmentFile(contents: string): readonly CodexAuthSourceConfig[] {
  const line = contents
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('LUME_HUB_CODEX_AUTH_SOURCES='));

  if (!line) {
    return [];
  }

  const rawValue = line.slice('LUME_HUB_CODEX_AUTH_SOURCES='.length).trim();

  if (!rawValue) {
    return [];
  }

  const jsonPayload = readEnvironmentValue(rawValue);
  const parsed = JSON.parse(jsonPayload) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('LUME_HUB_CODEX_AUTH_SOURCES must be a JSON array.');
  }

  return parsed.map((entry, index) => normaliseConfiguredSource(entry, index));
}

function readEnvironmentValue(rawValue: string): string {
  if (rawValue.startsWith('"')) {
    return JSON.parse(rawValue) as string;
  }

  if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}

function serialiseSourcesEnvironmentFile(sources: readonly CodexAuthSourceConfig[]): string {
  return `LUME_HUB_CODEX_AUTH_SOURCES=${JSON.stringify(JSON.stringify(sources))}\n`;
}

function normaliseConfiguredSource(entry: unknown, index: number): CodexAuthSourceConfig {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`LUME_HUB_CODEX_AUTH_SOURCES[${index}] must be an object.`);
  }

  const value = entry as Record<string, unknown>;
  const accountId = readRequiredString(value, index, 'accountId');
  const label = readRequiredString(value, index, 'label');
  const filePath = readRequiredString(value, index, 'filePath');
  const priority = value.priority === undefined ? undefined : Number(value.priority);
  const kind = value.kind === undefined ? undefined : String(value.kind);

  if (priority !== undefined && (!Number.isInteger(priority) || priority < 0)) {
    throw new Error(`LUME_HUB_CODEX_AUTH_SOURCES[${index}].priority must be a non-negative integer.`);
  }

  if (kind !== undefined && kind !== 'canonical_live' && kind !== 'secondary') {
    throw new Error(`LUME_HUB_CODEX_AUTH_SOURCES[${index}].kind must be canonical_live or secondary.`);
  }

  return {
    accountId,
    label,
    filePath,
    priority,
    kind,
  };
}

function readRequiredString(
  value: Readonly<Record<string, unknown>>,
  index: number,
  fieldName: 'accountId' | 'label' | 'filePath',
): string {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== 'string' || !fieldValue.trim()) {
    throw new Error(`LUME_HUB_CODEX_AUTH_SOURCES[${index}].${fieldName} must be a non-empty string.`);
  }

  return fieldValue.trim();
}

function sanitisePathSegment(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, '-');
}

async function writeFileAtomically(filePath: string, contents: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });

  const temporaryPath = join(dirname(filePath), `${basename(filePath)}.${Date.now()}.tmp`);
  await writeFile(temporaryPath, contents, 'utf8');
  await rename(temporaryPath, filePath);
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
