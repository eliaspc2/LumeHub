import type { Clock } from '@lume-hub/clock';
import { CodexAuthBackupSyncModule } from '@lume-hub/codex-auth-backup-sync';
import { CodexAuthRouterModule, type CodexAuthSourceConfig } from '@lume-hub/codex-auth-router';
import { HostLifecycleModule } from '@lume-hub/host-lifecycle';
import { SystemPowerModule } from '@lume-hub/system-power';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface HostModuleLoaderOptions {
  readonly rootPath?: string;
  readonly clock?: Clock;
  readonly codexAuthFile?: string;
  readonly canonicalCodexAuthFile?: string;
  readonly codexAuthRouterStateFilePath?: string;
  readonly codexAuthRouterBackupDirectoryPath?: string;
  readonly codexAuthRouterBackupHistoryDirectoryPath?: string;
  readonly codexAuthRouterBackupHistoryRetentionLimit?: number;
  readonly codexAuthSources?: readonly CodexAuthSourceConfig[];
  readonly codexAuthBackupSyncEnabled?: boolean;
  readonly codexAuthBackupSyncRepoPath?: string;
  readonly codexAuthBackupSyncRemoteName?: string | null;
  readonly codexAuthBackupSyncBranch?: string;
  readonly codexAuthBackupSyncMirrorSubdirectory?: string;
  readonly hostStateFilePath?: string;
  readonly backendStateFilePath?: string;
  readonly powerStateFilePath?: string;
  readonly inhibitorStatePath?: string;
  readonly systemdUserPath?: string;
  readonly serviceName?: string;
  readonly workingDirectory?: string;
  readonly execStart?: string;
  readonly publishHeartbeatOnStart?: boolean;
}

export interface HostLoadedModules {
  readonly codexAuthRouterModule: CodexAuthRouterModule;
  readonly systemPowerModule: SystemPowerModule;
  readonly codexAuthBackupSyncModule: CodexAuthBackupSyncModule;
  readonly hostLifecycleModule: HostLifecycleModule;
  readonly modules: readonly [CodexAuthRouterModule, SystemPowerModule, CodexAuthBackupSyncModule, HostLifecycleModule];
}

export class HostModuleLoader {
  constructor(private readonly options: HostModuleLoaderOptions = {}) {}

  load(): HostLoadedModules {
    const rootPath = this.options.rootPath ?? resolveProjectRoot();
    const codexAuthFile = this.options.codexAuthFile ?? '/home/eliaspc/.codex/auth.json';
    const canonicalCodexAuthFile = this.options.canonicalCodexAuthFile ?? codexAuthFile;
    const codexAuthSources = this.options.codexAuthSources ?? readCodexAuthSourcesFromEnv();
    const codexAuthRouterBackupDirectoryPath =
      this.options.codexAuthRouterBackupDirectoryPath ??
      resolve(rootPath, 'runtime/host/state/codex-auth-router-backups');
    const codexAuthRouterBackupHistoryDirectoryPath =
      this.options.codexAuthRouterBackupHistoryDirectoryPath ?? resolve(codexAuthRouterBackupDirectoryPath, 'history');
    const codexAuthRouterModule = new CodexAuthRouterModule({
      canonicalAuthFilePath: canonicalCodexAuthFile,
      stateFilePath:
        this.options.codexAuthRouterStateFilePath ??
        resolve(rootPath, 'runtime/host/state/codex-auth-router.state.json'),
      backupDirectoryPath: codexAuthRouterBackupDirectoryPath,
      backupHistoryDirectoryPath: codexAuthRouterBackupHistoryDirectoryPath,
      backupHistoryRetentionLimit: this.options.codexAuthRouterBackupHistoryRetentionLimit ?? 5,
      sourceAccounts: codexAuthSources,
    });
    const systemPowerModule = new SystemPowerModule({
      clock: this.options.clock,
      stateFilePath: this.options.powerStateFilePath ?? resolve(rootPath, 'runtime/host/state/power-policy-state.json'),
      inhibitorStatePath: this.options.inhibitorStatePath ?? resolve(rootPath, 'runtime/host/state/sleep-inhibitor.json'),
    });
    const codexAuthBackupSyncRepoPath =
      this.options.codexAuthBackupSyncRepoPath ?? resolveDefaultCodexAuthBackupRepositoryPath();
    const codexAuthBackupSyncModule = new CodexAuthBackupSyncModule({
      enabled: this.options.codexAuthBackupSyncEnabled ?? codexAuthBackupSyncRepoPath !== undefined,
      repositoryPath: codexAuthBackupSyncRepoPath,
      sourceHistoryDirectoryPath: codexAuthRouterBackupHistoryDirectoryPath,
      mirrorSubdirectory: this.options.codexAuthBackupSyncMirrorSubdirectory ?? 'history/lume-hub',
      remoteName: this.options.codexAuthBackupSyncRemoteName ?? 'origin',
      branch: this.options.codexAuthBackupSyncBranch ?? 'main',
    });
    const hostLifecycleModule = new HostLifecycleModule({
      clock: this.options.clock,
      codexAuthFile,
      canonicalCodexAuthFile,
      stateFilePath: this.options.hostStateFilePath ?? resolve(rootPath, 'runtime/host/state/host-runtime-state.json'),
      backendStateFilePath:
        this.options.backendStateFilePath ?? resolve(rootPath, 'runtime/lxd/host-mounts/data/runtime/host-state.json'),
      systemdUserPath: this.options.systemdUserPath ?? resolve(rootPath, 'runtime/host/systemd-user'),
      serviceName: this.options.serviceName ?? 'lume-hub-host.service',
      workingDirectory: this.options.workingDirectory ?? resolve(rootPath, 'source'),
      execStart:
        this.options.execStart ??
        `/usr/bin/env node ${resolve(rootPath, 'source/apps/lume-hub-host/dist/apps/lume-hub-host/src/main.js')}`,
      publishHeartbeatOnStart: this.options.publishHeartbeatOnStart,
      powerStatusProvider: async () => {
        const status = await systemPowerModule.getPowerStatus();

        return {
          policyMode: status.policy.mode,
          inhibitorActive: status.inhibitorActive,
          leaseId: status.activeLease?.leaseId ?? null,
          explanation: status.explanation,
        };
      },
      authRouterStatusProvider: async () => {
        const status = await codexAuthRouterModule.getStatus();

        return {
          canonicalAuthFilePath: status.canonicalAuthFilePath,
          currentAccountId: status.currentSelection?.accountId ?? null,
          currentSourceFilePath: status.currentSelection?.sourceFilePath ?? null,
          accountCount: status.accountCount,
          lastSwitchAt: status.lastSwitchAt,
        };
      },
    });

    return {
      codexAuthRouterModule,
      systemPowerModule,
      codexAuthBackupSyncModule,
      hostLifecycleModule,
      modules: [codexAuthRouterModule, systemPowerModule, codexAuthBackupSyncModule, hostLifecycleModule],
    };
  }
}

function resolveProjectRoot(): string {
  return process.cwd().endsWith('/source') ? dirname(process.cwd()) : process.cwd();
}

function resolveDefaultCodexAuthBackupRepositoryPath(): string | undefined {
  const repositoryPath = '/home/eliaspc/Documentos/codex-auth-backups';

  return existsSync(join(repositoryPath, '.git')) ? repositoryPath : undefined;
}

function readCodexAuthSourcesFromEnv(): readonly CodexAuthSourceConfig[] | undefined {
  const rawValue = process.env.LUME_HUB_CODEX_AUTH_SOURCES;

  if (!rawValue?.trim()) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error('LUME_HUB_CODEX_AUTH_SOURCES must be a JSON array.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('LUME_HUB_CODEX_AUTH_SOURCES must be a JSON array.');
  }

  return parsed.map((entry, index) => normaliseCodexAuthSource(entry, index));
}

function normaliseCodexAuthSource(entry: unknown, index: number): CodexAuthSourceConfig {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`LUME_HUB_CODEX_AUTH_SOURCES[${index}] must be an object.`);
  }

  const value = entry as Record<string, unknown>;
  const accountId = readRequiredTrimmedSourceField(value, index, 'accountId');
  const label = readRequiredTrimmedSourceField(value, index, 'label');
  const filePath = readRequiredTrimmedSourceField(value, index, 'filePath');
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

function readRequiredTrimmedSourceField(
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
