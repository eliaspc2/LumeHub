import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isCodexCreditLimitErrorMessage, resolveCodexAuthFile } from "./llm_codex_oauth.js";

type CodexAuthJson = {
  auth_mode?: string | null;
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    account_id?: string;
  };
  last_refresh?: string | null;
};

type RouterConfigFile = {
  enabled?: boolean;
  canonicalAuthFile?: string;
  sourceFiles?: string[];
  backupFiles?: string[];
  refreshIntervalMs?: number;
  switchCooldownMs?: number;
  loadBalanceMarginPercent?: number;
};

type RouterStateFile = {
  activeAccountId?: string | null;
  lastSwitchAt?: string | null;
  accounts?: Record<
    string,
    {
      label?: string;
      backupFiles?: string[];
      cooldownUntil?: string | null;
      lastSelectedAt?: string | null;
      lastUsage?: CodexUsageSnapshot | null;
    }
  >;
};

type UsageWindow = {
  windowSeconds?: number;
  usedPercent?: number;
  remainingPercent?: number;
  resetAfterSeconds?: number;
  resetAt?: string | null;
};

type CreditsSnapshot = {
  hasCredits: boolean;
  unlimited: boolean;
  balance: string | null;
  approxLocalMessages: number[];
  approxCloudMessages: number[];
};

export type CodexUsageSnapshot = {
  checkedAt: string;
  allowed: boolean;
  limitReached: boolean;
  planType?: string;
  credits: CreditsSnapshot;
  primaryWindow?: UsageWindow;
  secondaryWindow?: UsageWindow;
  fetchError?: string | null;
};

type SourceCandidate = {
  authFile: string;
  accountId: string;
  freshnessMs: number;
};

type RouterAccountRecord = {
  accountId: string;
  label: string;
  storeAuthFile: string;
  sourceFiles: string[];
  backupFiles: string[];
  cooldownUntil: string | null;
  lastSelectedAt: string | null;
  usage: CodexUsageSnapshot | null;
};

type RouterRuntimeConfig = {
  enabled: boolean;
  canonicalAuthFile: string;
  sourceFiles: string[];
  backupFiles: string[];
  refreshIntervalMs: number;
  switchCooldownMs: number;
  loadBalanceMarginPercent: number;
  storeDir: string;
};

export type CodexAuthRouterSelection = {
  accountId: string;
  label: string;
  authFile: string;
  canonicalAuthFile: string;
  switched: boolean;
  reason: string;
};

export type CodexAuthRouterAccountStatus = {
  accountId: string;
  label: string;
  storeAuthFile: string;
  sourceFiles: string[];
  backupFiles: string[];
  available: boolean;
  cooldownUntil: string | null;
  score: number | null;
  usage: CodexUsageSnapshot | null;
};

export type CodexAuthRouterStatus = {
  enabled: boolean;
  canonicalAuthFile: string;
  storeDir: string;
  activeAccountId: string | null;
  lastSwitchAt: string | null;
  refreshIntervalMs: number;
  switchCooldownMs: number;
  loadBalanceMarginPercent: number;
  accounts: CodexAuthRouterAccountStatus[];
};

export type CodexAuthRouter = {
  start(): Promise<void>;
  getStatus(): Promise<CodexAuthRouterStatus>;
  refreshNow(reason?: string): Promise<CodexAuthRouterStatus>;
  prepareAuthForRequest(reason?: string): Promise<CodexAuthRouterSelection | null>;
  reportRequestSuccess(selection: CodexAuthRouterSelection): Promise<void>;
  reportRequestFailure(
    selection: CodexAuthRouterSelection,
    errorMessage: string
  ): Promise<{ retrySelection: CodexAuthRouterSelection | null }>;
  forceSwitch(accountId: string, reason?: string): Promise<CodexAuthRouterSelection>;
};

type CreateCodexAuthRouterInput = {
  configFile: string;
  stateFile: string;
};

type UsageApiResponse = {
  plan_type?: string;
  credits?: {
    has_credits?: boolean;
    unlimited?: boolean;
    balance?: string | number | null;
    approx_local_messages?: unknown;
    approx_cloud_messages?: unknown;
  };
  rate_limit?: {
    allowed?: boolean;
    limit_reached?: boolean;
    primary_window?: {
      limit_window_seconds?: number;
      used_percent?: number;
      reset_after_seconds?: number;
      reset_at?: number | string | null;
    } | null;
    secondary_window?: {
      limit_window_seconds?: number;
      used_percent?: number;
      reset_after_seconds?: number;
      reset_at?: number | string | null;
    } | null;
  } | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function expandHome(inputPath: string | undefined | null): string {
  const trimmed = String(inputPath ?? "").trim();
  if (!trimmed) return trimmed;
  if (trimmed === "~") return os.homedir();
  if (trimmed.startsWith("~/")) return path.join(os.homedir(), trimmed.slice(2));
  return trimmed;
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = String(raw ?? "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function asInt(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function asPercent(raw: unknown): number | undefined {
  const n = asInt(raw);
  if (n == null) return undefined;
  return Math.max(0, Math.min(100, n));
}

function parseTimestamp(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw * 1000).toISOString();
  }
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    const n = Number(value);
    if (Number.isFinite(n)) return new Date(n * 1000).toISOString();
  }
  const ms = Date.parse(value);
  if (Number.isFinite(ms)) return new Date(ms).toISOString();
  return null;
}

function toMs(raw: string | null | undefined): number {
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, filePath);
}

function copyFileAtomic(src: string, dst: string) {
  ensureDir(path.dirname(dst));
  const tmp = `${dst}.tmp`;
  fs.copyFileSync(src, tmp);
  fs.renameSync(tmp, dst);
}

function fileTextOrEmpty(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function filesDiffer(a: string, b: string): boolean {
  return fileTextOrEmpty(a) !== fileTextOrEmpty(b);
}

function readValidAuth(filePath: string): { auth: CodexAuthJson; accountId: string; freshnessMs: number } | null {
  const auth = readJsonFile<CodexAuthJson>(filePath);
  const accessToken = String(auth?.tokens?.access_token ?? "").trim();
  const accountId = String(auth?.tokens?.account_id ?? "").trim();
  if (!auth || !accessToken || !accountId) return null;
  let freshnessMs = 0;
  const lastRefresh = String(auth?.last_refresh ?? "").trim();
  if (lastRefresh) {
    const parsed = Date.parse(lastRefresh);
    if (Number.isFinite(parsed)) freshnessMs = parsed;
  }
  if (!freshnessMs) {
    try {
      freshnessMs = fs.statSync(filePath).mtimeMs;
    } catch {
      freshnessMs = 0;
    }
  }
  return { auth, accountId, freshnessMs };
}

type UsageApiWindow = NonNullable<NonNullable<UsageApiResponse["rate_limit"]>["primary_window"]>;

function normalizeWindow(raw: UsageApiWindow | null | undefined): UsageWindow | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const usedPercent = asPercent(raw.used_percent);
  return {
    windowSeconds: asInt(raw.limit_window_seconds) ?? undefined,
    usedPercent,
    remainingPercent: usedPercent == null ? undefined : Math.max(0, 100 - usedPercent),
    resetAfterSeconds: asInt(raw.reset_after_seconds) ?? undefined,
    resetAt: parseTimestamp(raw.reset_at)
  };
}

function emptyCredits(): CreditsSnapshot {
  return {
    hasCredits: false,
    unlimited: false,
    balance: null,
    approxLocalMessages: [],
    approxCloudMessages: []
  };
}

function isGenericLabel(value: string): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return !normalized || normalized === "auth" || normalized === "auth.json" || normalized === "codex";
}

function normalizeCredits(raw: UsageApiResponse["credits"]): CreditsSnapshot {
  const local =
    Array.isArray(raw?.approx_local_messages) ? raw?.approx_local_messages.map((v) => asInt(v) ?? 0) : [];
  const cloud =
    Array.isArray(raw?.approx_cloud_messages) ? raw?.approx_cloud_messages.map((v) => asInt(v) ?? 0) : [];
  return {
    hasCredits: Boolean(raw?.has_credits),
    unlimited: Boolean(raw?.unlimited),
    balance: raw?.balance == null ? null : String(raw.balance),
    approxLocalMessages: local,
    approxCloudMessages: cloud
  };
}

function deriveLabel(accountId: string, sourceFiles: string[], priorLabel: string | undefined): string {
  const preserved = String(priorLabel ?? "").trim();
  if (preserved && !isGenericLabel(preserved)) return preserved;

  for (const filePath of sourceFiles) {
    const dir = path.basename(path.dirname(filePath));
    const value = String(dir ?? "").trim();
    if (
      value &&
      value !== "." &&
      value !== path.basename(path.dirname(resolveCodexAuthFile())) &&
      !isGenericLabel(value)
    ) {
      return value;
    }
  }

  return `account-${accountId.slice(0, 8)}`;
}

function readStateFile(filePath: string): RouterStateFile {
  return readJsonFile<RouterStateFile>(filePath) ?? {};
}

function loadRuntimeConfig(configFile: string, stateFile: string): RouterRuntimeConfig {
  const fileCfg = readJsonFile<RouterConfigFile>(configFile) ?? {};
  const enabledRaw = process.env.CODEX_AUTH_ROUTER_ENABLED ?? fileCfg.enabled;
  const enabled = String(enabledRaw ?? "1") !== "0" && enabledRaw !== false;
  const canonicalAuthFile = path.resolve(
    expandHome(process.env.LLM_CODEX_AUTH_FILE ?? fileCfg.canonicalAuthFile ?? resolveCodexAuthFile())
  );
  const sourceFiles = uniqueStrings([
    ...(String(process.env.CODEX_AUTH_ROUTER_SOURCE_FILES ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)),
    ...((fileCfg.sourceFiles ?? []).map((value) => String(value ?? "").trim()).filter(Boolean) as string[])
  ]).map((value) => path.resolve(expandHome(value)));
  const backupFiles = uniqueStrings([
    ...(String(process.env.CODEX_AUTH_ROUTER_BACKUP_FILES ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)),
    ...((fileCfg.backupFiles ?? []).map((value) => String(value ?? "").trim()).filter(Boolean) as string[])
  ]).map((value) => path.resolve(expandHome(value)));
  const refreshIntervalMs = Math.max(
    15_000,
    asInt(process.env.CODEX_AUTH_ROUTER_REFRESH_INTERVAL_MS) ??
      asInt(fileCfg.refreshIntervalMs) ??
      60_000
  );
  const switchCooldownMs = Math.max(
    60_000,
    asInt(process.env.CODEX_AUTH_ROUTER_SWITCH_COOLDOWN_MS) ??
      asInt(fileCfg.switchCooldownMs) ??
      15 * 60_000
  );
  const loadBalanceMarginPercent = Math.max(
    0,
    Math.min(
      40,
      asInt(process.env.CODEX_AUTH_ROUTER_LOAD_MARGIN_PERCENT) ??
        asInt(fileCfg.loadBalanceMarginPercent) ??
        8
    )
  );
  const storeDir = path.resolve(
    expandHome(process.env.CODEX_AUTH_ROUTER_STORE_DIR) ||
      path.join(path.dirname(stateFile), "codex-auth-router", "accounts")
  );
  return {
    enabled,
    canonicalAuthFile,
    sourceFiles,
    backupFiles,
    refreshIntervalMs,
    switchCooldownMs,
    loadBalanceMarginPercent,
    storeDir
  };
}

async function fetchUsageSnapshot(authFile: string): Promise<CodexUsageSnapshot> {
  const loaded = readValidAuth(authFile);
  if (!loaded) {
    return {
      checkedAt: nowIso(),
      allowed: false,
      limitReached: false,
      credits: emptyCredits(),
      fetchError: `Credenciais invalidas em ${authFile}`
    };
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${loaded.auth.tokens?.access_token ?? ""}`,
    accept: "application/json, text/plain, */*",
    "user-agent": "WA-Notify"
  };
  if (loaded.auth.tokens?.account_id) {
    headers["chatgpt-account-id"] = loaded.auth.tokens.account_id;
  }

  try {
    const res = await fetch("https://chatgpt.com/backend-api/codex/usage", { headers });
    const raw = await res.text();
    if (!res.ok) {
      return {
        checkedAt: nowIso(),
        allowed: false,
        limitReached: false,
        credits: emptyCredits(),
        fetchError: `usage error ${res.status}: ${raw.slice(0, 300)}`
      };
    }
    const parsed = JSON.parse(raw) as UsageApiResponse;
    const rateLimit = parsed.rate_limit ?? {};
    return {
      checkedAt: nowIso(),
      allowed: Boolean(rateLimit.allowed ?? true),
      limitReached: Boolean(rateLimit.limit_reached),
      planType: String(parsed.plan_type ?? "").trim() || undefined,
      credits: normalizeCredits(parsed.credits),
      primaryWindow: normalizeWindow(rateLimit.primary_window),
      secondaryWindow: normalizeWindow(rateLimit.secondary_window)
    };
  } catch (err) {
    return {
      checkedAt: nowIso(),
      allowed: false,
      limitReached: false,
      credits: emptyCredits(),
      fetchError: err instanceof Error ? err.message : String(err)
    };
  }
}

function isAccountCoolingDown(account: RouterAccountRecord): boolean {
  return toMs(account.cooldownUntil) > Date.now();
}

function scoreAccount(account: RouterAccountRecord): number | null {
  if (!account.usage) return null;
  let score = 0;
  const primary = account.usage.primaryWindow?.usedPercent ?? 100;
  const secondary = account.usage.secondaryWindow?.usedPercent ?? primary;
  score += primary * 0.65 + secondary * 0.35;
  if (!account.usage.allowed || account.usage.limitReached) score += 1000;
  if (account.usage.fetchError) score += 250;
  if (account.usage.credits.unlimited) score -= 5;
  if (account.usage.credits.hasCredits) score -= 10;
  if (isAccountCoolingDown(account)) score += 500;
  return score;
}

function computeCooldownUntil(account: RouterAccountRecord, switchCooldownMs: number): string {
  const now = Date.now();
  const candidates = [account.usage?.primaryWindow?.resetAt, account.usage?.secondaryWindow?.resetAt]
    .map((raw) => toMs(raw))
    .filter((value) => value > now);
  const earliest = candidates.length > 0 ? Math.min(...candidates) : now + switchCooldownMs;
  return new Date(earliest).toISOString();
}

export function createCodexAuthRouter(input: CreateCodexAuthRouterInput): CodexAuthRouter {
  let config = loadRuntimeConfig(input.configFile, input.stateFile);
  let state = readStateFile(input.stateFile);
  let intervalHandle: NodeJS.Timeout | null = null;
  let accounts = new Map<string, RouterAccountRecord>();
  let queue: Promise<unknown> = Promise.resolve();
  let lastRefreshAt = 0;

  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.then(fn, fn);
    queue = next.catch(() => undefined);
    return next;
  }

  function persistState() {
    const next: RouterStateFile = {
      activeAccountId: state.activeAccountId ?? null,
      lastSwitchAt: state.lastSwitchAt ?? null,
      accounts: {}
    };
    for (const account of accounts.values()) {
      next.accounts![account.accountId] = {
        label: account.label,
        backupFiles: account.backupFiles.slice(),
        cooldownUntil: account.cooldownUntil,
        lastSelectedAt: account.lastSelectedAt,
        lastUsage: account.usage
      };
    }
    writeJsonAtomic(input.stateFile, next);
    state = next;
  }

  function discoverBootstrapFiles(runtime: RouterRuntimeConfig): string[] {
    const values: string[] = [runtime.canonicalAuthFile, ...runtime.sourceFiles];
    try {
      const dir = path.dirname(runtime.canonicalAuthFile);
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        if (!entry.name.toLowerCase().endsWith(".json")) continue;
        values.push(path.join(dir, entry.name));
      }
    } catch {
      // ignore missing canonical dir
    }
    try {
      for (const entry of fs.readdirSync(runtime.storeDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        values.push(path.join(runtime.storeDir, entry.name, "auth.json"));
      }
    } catch {
      // ignore missing store dir
    }
    return uniqueStrings(values).map((value) => path.resolve(value));
  }

  function buildStatus(): CodexAuthRouterStatus {
    const rows = Array.from(accounts.values())
      .map((account) => ({
        accountId: account.accountId,
        label: account.label,
        storeAuthFile: account.storeAuthFile,
        sourceFiles: account.sourceFiles.slice(),
        backupFiles: account.backupFiles.slice(),
        available: !isAccountCoolingDown(account) && Boolean(account.usage?.allowed ?? true),
        cooldownUntil: account.cooldownUntil,
        score: scoreAccount(account),
        usage: account.usage
      }))
      .sort((a, b) => {
        if (a.score == null && b.score == null) return a.label.localeCompare(b.label);
        if (a.score == null) return 1;
        if (b.score == null) return -1;
        return a.score - b.score;
      });
    return {
      enabled: config.enabled,
      canonicalAuthFile: config.canonicalAuthFile,
      storeDir: config.storeDir,
      activeAccountId: state.activeAccountId ?? null,
      lastSwitchAt: state.lastSwitchAt ?? null,
      refreshIntervalMs: config.refreshIntervalMs,
      switchCooldownMs: config.switchCooldownMs,
      loadBalanceMarginPercent: config.loadBalanceMarginPercent,
      accounts: rows
    };
  }

  function choosePreferredAccount(): RouterAccountRecord | null {
    const rows = Array.from(accounts.values());
    if (rows.length === 0) return null;
    let best: RouterAccountRecord | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const account of rows) {
      if (isAccountCoolingDown(account)) continue;
      const score = scoreAccount(account);
      if (score == null) continue;
      if (score < bestScore) {
        best = account;
        bestScore = score;
      }
    }
    if (!best) {
      return rows.find((account) => !isAccountCoolingDown(account)) ?? rows[0] ?? null;
    }
    const active = state.activeAccountId ? accounts.get(state.activeAccountId) ?? null : null;
    if (!active || active.accountId === best.accountId) return best;
    const activeScore = scoreAccount(active);
    if (activeScore == null) return best;
    if (activeScore <= bestScore + config.loadBalanceMarginPercent) {
      return active;
    }
    return best;
  }

  function currentCanonicalAccountId(): string | null {
    const loaded = readValidAuth(config.canonicalAuthFile);
    return loaded?.accountId ?? null;
  }

  function buildSelection(account: RouterAccountRecord, switched: boolean, reason: string): CodexAuthRouterSelection {
    return {
      accountId: account.accountId,
      label: account.label,
      authFile: config.canonicalAuthFile,
      canonicalAuthFile: config.canonicalAuthFile,
      switched,
      reason
    };
  }

  function syncAccountReplicas(account: RouterAccountRecord) {
    for (const filePath of uniqueStrings([...account.sourceFiles, ...account.backupFiles])) {
      if (!filePath || path.resolve(filePath) === path.resolve(account.storeAuthFile)) continue;
      if (!fs.existsSync(account.storeAuthFile) || !filesDiffer(account.storeAuthFile, filePath)) continue;
      copyFileAtomic(account.storeAuthFile, filePath);
    }
  }

  function rebuildAccountsTopology() {
    config = loadRuntimeConfig(input.configFile, input.stateFile);
    ensureDir(config.storeDir);

    const priorAccounts = state.accounts ?? {};
    const grouped = new Map<string, SourceCandidate[]>();
    const externalByAccount = new Map<string, string[]>();
    const backupByAccount = new Map<string, string[]>();
    const allowedBackupFiles = new Set(config.backupFiles.map((value) => path.resolve(value)));

    for (const filePath of discoverBootstrapFiles(config)) {
      const loaded = readValidAuth(filePath);
      if (!loaded) continue;
      const existing = grouped.get(loaded.accountId) ?? [];
      existing.push({ authFile: filePath, accountId: loaded.accountId, freshnessMs: loaded.freshnessMs });
      grouped.set(loaded.accountId, existing);
      const isStoreFile = path.resolve(filePath).startsWith(path.resolve(config.storeDir) + path.sep);
      if (!isStoreFile) {
        const rows = externalByAccount.get(loaded.accountId) ?? [];
        rows.push(filePath);
        externalByAccount.set(loaded.accountId, rows);
      }
    }

    for (const filePath of config.backupFiles) {
      const loaded = readValidAuth(filePath);
      if (!loaded) continue;
      const rows = backupByAccount.get(loaded.accountId) ?? [];
      rows.push(filePath);
      backupByAccount.set(loaded.accountId, rows);
    }

    const next = new Map<string, RouterAccountRecord>();
    for (const [accountId, candidates] of grouped.entries()) {
      const storeAuthFile = path.join(config.storeDir, accountId, "auth.json");
      const resolvedStore = readValidAuth(storeAuthFile);
      const all = candidates.slice();
      if (resolvedStore) {
        all.push({ authFile: storeAuthFile, accountId, freshnessMs: resolvedStore.freshnessMs });
      }
      all.sort((a, b) => b.freshnessMs - a.freshnessMs);
      const freshest = all[0];
      if (freshest && path.resolve(freshest.authFile) !== path.resolve(storeAuthFile)) {
        copyFileAtomic(freshest.authFile, storeAuthFile);
      }
      const prior = priorAccounts[accountId];
      const sourceFiles = uniqueStrings(externalByAccount.get(accountId) ?? []);
      const backupFiles = uniqueStrings([
        ...(backupByAccount.get(accountId) ?? []),
        ...((prior?.backupFiles ?? []).map((value) => String(value ?? "").trim()).filter(Boolean) as string[])
      ]).filter((value) => allowedBackupFiles.has(path.resolve(value)));
      const label = deriveLabel(accountId, sourceFiles, prior?.label);
      const usage = prior?.lastUsage ?? null;
      const cooldownUntil = prior?.cooldownUntil ?? null;
      const lastSelectedAt = prior?.lastSelectedAt ?? null;
      const record: RouterAccountRecord = {
        accountId,
        label,
        storeAuthFile,
        sourceFiles,
        backupFiles,
        cooldownUntil,
        lastSelectedAt,
        usage
      };
      syncAccountReplicas(record);
      next.set(accountId, record);
    }

    accounts = next;
    if (state.activeAccountId && !accounts.has(state.activeAccountId)) {
      state.activeAccountId = null;
    }
  }

  async function refreshUsage(reason: string) {
    rebuildAccountsTopology();
    for (const account of accounts.values()) {
      account.usage = await fetchUsageSnapshot(account.storeAuthFile);
      if (account.usage.fetchError) {
        // keep previous cooldown when usage fetch itself fails
      } else if (account.cooldownUntil && toMs(account.cooldownUntil) <= Date.now()) {
        account.cooldownUntil = null;
      }
      syncAccountReplicas(account);
    }
    lastRefreshAt = Date.now();
    persistState();
    if (reason === "startup" && !state.activeAccountId) {
      const best = choosePreferredAccount();
      if (best) {
        state.activeAccountId = best.accountId;
        persistState();
      }
    }
  }

  function switchCanonical(account: RouterAccountRecord, reason: string): CodexAuthRouterSelection {
    const canonicalMatches = currentCanonicalAccountId() === account.accountId;
    let switched = false;
    if (!canonicalMatches || filesDiffer(account.storeAuthFile, config.canonicalAuthFile)) {
      copyFileAtomic(account.storeAuthFile, config.canonicalAuthFile);
      switched = true;
    }
    state.activeAccountId = account.accountId;
    state.lastSwitchAt = nowIso();
    account.lastSelectedAt = state.lastSwitchAt;
    persistState();
    return buildSelection(account, switched, reason);
  }

  async function refreshIfStale(reason: string) {
    if (!config.enabled) return;
    if (Date.now() - lastRefreshAt < config.refreshIntervalMs && accounts.size > 0) return;
    await refreshUsage(reason);
  }

  return {
    start: () =>
      enqueue(async () => {
        config = loadRuntimeConfig(input.configFile, input.stateFile);
        state = readStateFile(input.stateFile);
        if (!config.enabled) {
          rebuildAccountsTopology();
          persistState();
          return;
        }
        await refreshUsage("startup");
        if (intervalHandle) clearInterval(intervalHandle);
        intervalHandle = setInterval(() => {
          void enqueue(async () => {
            if (!config.enabled) return;
            await refreshUsage("poll");
          });
        }, config.refreshIntervalMs);
      }),

    getStatus: () =>
      enqueue(async () => {
        rebuildAccountsTopology();
        return buildStatus();
      }),

    refreshNow: (reason = "manual") =>
      enqueue(async () => {
        await refreshUsage(reason);
        return buildStatus();
      }),

    prepareAuthForRequest: (reason = "oauth-request") =>
      enqueue(async () => {
        if (!config.enabled) return null;
        await refreshIfStale(reason);
        const best = choosePreferredAccount();
        if (!best) return null;
        return switchCanonical(best, reason);
      }),

    reportRequestSuccess: (selection) =>
      enqueue(async () => {
        const account = accounts.get(selection.accountId);
        if (!account) return;
        account.cooldownUntil = null;
        account.lastSelectedAt = nowIso();
        state.activeAccountId = account.accountId;
        persistState();
      }),

    reportRequestFailure: (selection, errorMessage) =>
      enqueue(async () => {
        const account = accounts.get(selection.accountId);
        if (!config.enabled || !account) return { retrySelection: null };

        const lower = String(errorMessage ?? "").toLowerCase();
        const shouldReroute =
          isCodexCreditLimitErrorMessage(errorMessage) ||
          /\b401\b/.test(lower) ||
          /\b403\b/.test(lower) ||
          lower.includes("unauthorized") ||
          lower.includes("invalid") && lower.includes("token");

        if (!shouldReroute) return { retrySelection: null };

        account.usage = await fetchUsageSnapshot(account.storeAuthFile);
        account.cooldownUntil = computeCooldownUntil(account, config.switchCooldownMs);
        persistState();

        const next = choosePreferredAccount();
        if (!next || next.accountId === account.accountId) {
          return { retrySelection: null };
        }
        return { retrySelection: switchCanonical(next, "oauth-reroute") };
      }),

    forceSwitch: (accountId, reason = "manual-switch") =>
      enqueue(async () => {
        await refreshIfStale(reason);
        const account = accounts.get(accountId);
        if (!account) throw new Error(`Conta Codex nao encontrada: ${accountId}`);
        account.cooldownUntil = null;
        return switchCanonical(account, reason);
      })
  };
}
