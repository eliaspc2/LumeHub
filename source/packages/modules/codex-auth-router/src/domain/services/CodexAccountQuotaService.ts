import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';

import type {
  CodexAccount,
  CodexQuotaCreditsSnapshot,
  CodexQuotaSnapshot,
  CodexQuotaWindowSnapshot,
} from '../entities/CodexAuthRouter.js';

interface CodexAuthJson {
  readonly tokens?: {
    readonly access_token?: unknown;
    readonly account_id?: unknown;
  };
}

interface UsageApiResponse {
  readonly plan_type?: unknown;
  readonly credits?: {
    readonly has_credits?: unknown;
    readonly unlimited?: unknown;
    readonly balance?: unknown;
    readonly approx_local_messages?: unknown;
    readonly approx_cloud_messages?: unknown;
  };
  readonly rate_limit?: {
    readonly allowed?: unknown;
    readonly limit_reached?: unknown;
    readonly primary_window?: UsageApiWindow | null;
    readonly secondary_window?: UsageApiWindow | null;
  } | null;
}

interface UsageApiWindow {
  readonly limit_window_seconds?: unknown;
  readonly used_percent?: unknown;
  readonly reset_after_seconds?: unknown;
  readonly reset_at?: unknown;
}

interface FetchResponseLike {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

type FetchLike = (
  url: string,
  init?: {
    readonly headers?: Record<string, string>;
  },
) => Promise<FetchResponseLike>;

export interface CodexAccountQuotaServiceConfig {
  readonly enabled?: boolean;
  readonly cacheTtlMs?: number;
  readonly fetcher?: FetchLike;
  readonly historyDirectoryPath?: string | null;
}

export class CodexAccountQuotaService {
  private readonly enabled: boolean;
  private readonly cacheTtlMs: number;
  private readonly fetcher: FetchLike | null;
  private readonly historyDirectoryPath: string | null;
  private readonly cache = new Map<
    string,
    {
      readonly expiresAt: number;
      readonly quota: CodexQuotaSnapshot;
    }
  >();

  constructor(config: CodexAccountQuotaServiceConfig = {}) {
    this.enabled = config.enabled === true;
    this.cacheTtlMs = normaliseCacheTtlMs(config.cacheTtlMs);
    this.fetcher = config.fetcher ?? readGlobalFetch();
    this.historyDirectoryPath = normaliseOptionalPath(config.historyDirectoryPath);
  }

  async enrichAccounts(accounts: readonly CodexAccount[], now: Date = new Date()): Promise<readonly CodexAccount[]> {
    return this.enrichAccountsWithAuthPath(accounts, now);
  }

  async enrichAccountsWithAuthPath(
    accounts: readonly CodexAccount[],
    now: Date = new Date(),
    options: {
      readonly activeAccountId?: string | null;
      readonly canonicalAuthFilePath?: string | null;
    } = {},
  ): Promise<readonly CodexAccount[]> {
    if (!this.enabled) {
      return accounts;
    }

    return Promise.all(
      accounts.map(async (account) => ({
        ...account,
        quota: await this.readQuota(account, now, resolveQuotaFilePath(account, options)),
      })),
    );
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearCacheForPath(sourceFilePath: string): void {
    const cachePrefix = `${sourceFilePath}:`;

    for (const cacheKey of this.cache.keys()) {
      if (cacheKey.startsWith(cachePrefix)) {
        this.cache.delete(cacheKey);
      }
    }
  }

  clearAccountCache(account: Pick<CodexAccount, 'sourceFilePath' | 'contentHash'>): void {
    this.clearCacheForPath(account.sourceFilePath);
  }

  async refreshAccount(
    account: CodexAccount,
    now: Date = new Date(),
    options: {
      readonly activeAccountId?: string | null;
      readonly canonicalAuthFilePath?: string | null;
    } = {},
  ): Promise<CodexQuotaSnapshot> {
    const authFilePath = resolveQuotaFilePath(account, options);
    this.clearCacheForPath(authFilePath);
    return this.readQuota(account, now, authFilePath);
  }

  async readQuota(
    account: CodexAccount,
    now: Date = new Date(),
    authFilePath: string = account.sourceFilePath,
  ): Promise<CodexQuotaSnapshot> {
    if (!this.enabled) {
      return buildUnavailableQuota(now, 'Leitura de limites desativada neste runtime.');
    }

    if (!account.exists) {
      return buildUnavailableQuota(now, 'Ficheiro OAuth em falta.');
    }

    const loaded = await readValidAuth(authFilePath, now);

    if (!loaded.valid) {
      const historicalQuota = await this.tryReadHistoricalQuota(account, now, authFilePath);
      return historicalQuota ?? loaded.quota;
    }

    const cacheKey = buildCacheKey(authFilePath, loaded.contentHash);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > now.getTime()) {
      if (!shouldTryHistoricalFallback(account, cached.quota)) {
        return cached.quota;
      }

      const cachedFallback = await this.tryReadHistoricalQuota(account, now, authFilePath, {
        primaryCacheKey: cacheKey,
        primaryContentHash: loaded.contentHash,
      });

      return cachedFallback ?? cached.quota;
    }

    const quota = await this.fetchQuota(loaded, now, false);
    this.cache.set(cacheKey, {
      expiresAt: now.getTime() + this.cacheTtlMs,
      quota,
    });

    if (shouldTryHistoricalFallback(account, quota)) {
      const fallbackQuota = await this.tryReadHistoricalQuota(account, now, authFilePath, {
        primaryCacheKey: cacheKey,
        primaryContentHash: loaded.contentHash,
      });

      if (fallbackQuota) {
        return fallbackQuota;
      }
    }

    return quota;
  }

  private async tryReadHistoricalQuota(
    account: CodexAccount,
    now: Date,
    authFilePath: string,
    options: {
      readonly primaryCacheKey?: string | null;
      readonly primaryContentHash?: string | null;
    } = {},
  ): Promise<CodexQuotaSnapshot | null> {
    if (account.kind === 'canonical_live' || !this.historyDirectoryPath) {
      return null;
    }

    const historyFilePath = await findLatestHistoricalAuthFilePath(this.historyDirectoryPath, account.accountId);

    if (!historyFilePath || resolve(historyFilePath) === resolve(authFilePath)) {
      return null;
    }

    const loaded = await readValidAuth(historyFilePath, now);

    if (!loaded.valid) {
      return null;
    }

    const cacheKey = buildCacheKey(historyFilePath, loaded.contentHash);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > now.getTime()) {
      if (options.primaryCacheKey && options.primaryContentHash) {
        this.cache.set(options.primaryCacheKey, cached);
      }

      return cached.quota;
    }

    const quota = await this.fetchQuota(loaded, now, true);
    this.cache.set(cacheKey, {
      expiresAt: now.getTime() + this.cacheTtlMs,
      quota,
    });

    if (options.primaryCacheKey && options.primaryContentHash) {
      this.cache.set(options.primaryCacheKey, {
        expiresAt: now.getTime() + this.cacheTtlMs,
        quota,
      });
    }

    return quota;
  }

  private async fetchQuota(
    loaded: Extract<Awaited<ReturnType<typeof readValidAuth>>, { readonly valid: true }>,
    now: Date,
    estimated: boolean,
  ): Promise<CodexQuotaSnapshot> {
    if (!this.fetcher) {
      return buildUnavailableQuota(now, 'Cliente HTTP indisponivel para ler limites.');
    }

    const headers: Record<string, string> = {
      authorization: `Bearer ${loaded.accessToken}`,
      accept: 'application/json, text/plain, */*',
      'user-agent': 'LumeHub',
    };

    if (loaded.accountId) {
      headers['chatgpt-account-id'] = loaded.accountId;
    }

    try {
      const response = await this.fetcher('https://chatgpt.com/backend-api/codex/usage', { headers });
      const raw = await response.text();

      if (!response.ok) {
        return buildUnavailableQuota(now, `Leitura de limites falhou com HTTP ${response.status}.`);
      }

      const parsed = JSON.parse(raw) as UsageApiResponse;
      const rateLimit = parsed.rate_limit ?? {};

      return {
        checkedAt: now.toISOString(),
        estimated,
        allowed: Boolean(rateLimit.allowed ?? true),
        limitReached: Boolean(rateLimit.limit_reached),
        planType: asNonEmptyString(parsed.plan_type),
        credits: normaliseCredits(parsed.credits),
        primaryWindow: normaliseWindow(rateLimit.primary_window),
        secondaryWindow: normaliseWindow(rateLimit.secondary_window),
        fetchError: null,
      };
    } catch (error) {
      return buildUnavailableQuota(now, error instanceof Error ? error.message : 'Leitura de limites falhou.');
    }
  }
}

async function readValidAuth(
  authFilePath: string,
  now: Date,
): Promise<
  | {
      readonly valid: true;
      readonly accessToken: string;
      readonly accountId: string | null;
      readonly contentHash: string;
    }
  | {
      readonly valid: false;
      readonly quota: CodexQuotaSnapshot;
    }
> {
  try {
    const rawContents = await readFile(authFilePath, 'utf8');
    const parsed = JSON.parse(rawContents) as CodexAuthJson;
    const contentHash = createHash('sha256').update(rawContents).digest('hex');
    const accessToken = typeof parsed.tokens?.access_token === 'string' ? parsed.tokens.access_token.trim() : '';
    const accountId = typeof parsed.tokens?.account_id === 'string' ? parsed.tokens.account_id.trim() : '';

    if (!accessToken) {
      return {
        valid: false,
        quota: buildUnavailableQuota(now, 'Credenciais OAuth sem access_token.'),
      };
    }

    return {
      valid: true,
      accessToken,
      accountId: accountId || null,
      contentHash,
    };
  } catch {
    return {
      valid: false,
      quota: buildUnavailableQuota(now, 'Credenciais OAuth ilegíveis.'),
    };
  }
}

function buildUnavailableQuota(now: Date, fetchError: string): CodexQuotaSnapshot {
  return {
    checkedAt: now.toISOString(),
    estimated: false,
    allowed: false,
    limitReached: false,
    planType: null,
    credits: {
      hasCredits: false,
      unlimited: false,
      balance: null,
      approxLocalMessages: [],
      approxCloudMessages: [],
    },
    primaryWindow: null,
    secondaryWindow: null,
    fetchError,
  };
}

function normaliseWindow(raw: UsageApiWindow | null | undefined): CodexQuotaWindowSnapshot | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const usedPercent = asPercent(raw.used_percent);

  return {
    windowSeconds: asInteger(raw.limit_window_seconds),
    usedPercent,
    remainingPercent: usedPercent === null ? null : Math.max(0, 100 - usedPercent),
    resetAfterSeconds: asInteger(raw.reset_after_seconds),
    resetAt: parseTimestamp(raw.reset_at),
  };
}

function normaliseCredits(raw: UsageApiResponse['credits']): CodexQuotaCreditsSnapshot {
  return {
    hasCredits: Boolean(raw?.has_credits),
    unlimited: Boolean(raw?.unlimited),
    balance: raw?.balance == null ? null : String(raw.balance),
    approxLocalMessages: normaliseNumberList(raw?.approx_local_messages),
    approxCloudMessages: normaliseNumberList(raw?.approx_cloud_messages),
  };
}

function normaliseNumberList(raw: unknown): readonly number[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((value) => asInteger(value) ?? 0);
}

function asInteger(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }

  if (typeof raw === 'string' && raw.trim().length > 0) {
    const parsed = Number(raw);

    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
}

function asPercent(raw: unknown): number | null {
  const value = asInteger(raw);

  if (value === null) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

function asNonEmptyString(raw: unknown): string | null {
  const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';
  return value.length > 0 ? value : null;
}

function parseTimestamp(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return new Date(raw * 1000).toISOString();
  }

  const value = String(raw ?? '').trim();

  if (!value) {
    return null;
  }

  if (/^\d+$/u.test(value)) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return new Date(parsed * 1000).toISOString();
    }
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normaliseCacheTtlMs(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return 60_000;
  }

  return Math.max(10_000, Math.min(10 * 60_000, Math.trunc(value as number)));
}

function buildCacheKey(sourceFilePath: string, contentHash: string | null): string {
  return `${sourceFilePath}:${contentHash ?? 'missing'}`;
}

function normaliseOptionalPath(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next ? resolve(next) : null;
}

function shouldTryHistoricalFallback(_account: CodexAccount, quota: CodexQuotaSnapshot): boolean {
  return typeof quota.fetchError === 'string' && /HTTP 401|HTTP 403/u.test(quota.fetchError);
}

async function findLatestHistoricalAuthFilePath(historyDirectoryPath: string, accountId: string): Promise<string | null> {
  try {
    const candidates = await listHistoryCandidates(historyDirectoryPath, accountId);

    if (candidates.length === 0) {
      return null;
    }

    const sortedCandidates = [...candidates].sort(
      (left, right) => right.mtimeMs - left.mtimeMs || right.filePath.localeCompare(left.filePath),
    );
    return sortedCandidates[0]?.filePath ?? null;
  } catch {
    return null;
  }
}

async function listHistoryCandidates(
  rootPath: string,
  accountId: string,
): Promise<readonly { readonly filePath: string; readonly mtimeMs: number }[]> {
  const files = await listRelativeFiles(rootPath);
  const accountSegment = sanitisePathSegment(accountId);
  const candidates: { filePath: string; mtimeMs: number }[] = [];

  for (const relativePath of files) {
    const filePath = join(rootPath, relativePath);

    if (!isHistoryCandidate(filePath, accountId, accountSegment)) {
      continue;
    }

    const fileStat = await stat(filePath).catch(() => null);

    if (!fileStat?.isFile()) {
      continue;
    }

    candidates.push({
      filePath,
      mtimeMs: fileStat.mtimeMs,
    });
  }

  return candidates;
}

async function listRelativeFiles(rootPath: string, currentRelativePath = ''): Promise<readonly string[]> {
  const entries = await readdir(join(rootPath, currentRelativePath), { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const nextRelativePath = currentRelativePath ? join(currentRelativePath, entry.name) : entry.name;

    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(rootPath, nextRelativePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(nextRelativePath);
    }
  }

  return files;
}

function isHistoryCandidate(filePath: string, accountId: string, accountSegment: string): boolean {
  const resolved = resolve(filePath);
  const resolvedSegments = resolved.split(sep);
  const fileName = basename(resolved);

  return (
    resolvedSegments.includes(accountSegment) ||
    fileName.startsWith(`${accountId}--`) ||
    fileName.startsWith(`${accountSegment}--`) ||
    fileName.includes(`-${accountSegment}-`)
  );
}

function sanitisePathSegment(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, '-');
}

function resolveQuotaFilePath(
  account: Pick<CodexAccount, 'accountId' | 'sourceFilePath' | 'kind'>,
  options: {
    readonly activeAccountId?: string | null;
    readonly canonicalAuthFilePath?: string | null;
  },
): string {
  if (
    options.activeAccountId &&
    account.accountId === options.activeAccountId &&
    options.canonicalAuthFilePath &&
    options.canonicalAuthFilePath.trim().length > 0
  ) {
    return options.canonicalAuthFilePath.trim();
  }

  return account.sourceFilePath;
}

function readGlobalFetch(): FetchLike | null {
  const candidate = (globalThis as { readonly fetch?: FetchLike }).fetch;
  return typeof candidate === 'function' ? candidate.bind(globalThis) : null;
}
