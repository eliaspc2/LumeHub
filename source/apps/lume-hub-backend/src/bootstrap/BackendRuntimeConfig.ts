import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { Clock } from '@lume-hub/clock';
import type { CodexAuthSourceConfig } from '@lume-hub/codex-auth-router';
import type { ModuleEnvironment } from '@lume-hub/kernel';
import type { BaileysSocketFactory, BaileysVersionResolver } from '@lume-hub/whatsapp-baileys';
import type { WorkspaceAgentExecutor } from '@lume-hub/workspace-agent';

export type BackendFrontendMode = 'demo' | 'live';

export interface BackendRuntimeConfig {
  readonly rootPath?: string;
  readonly environment?: ModuleEnvironment;
  readonly clock?: Clock;
  readonly dataRootPath?: string;
  readonly configRootPath?: string;
  readonly runtimeRootPath?: string;
  readonly groupSeedFilePath?: string;
  readonly catalogFilePath?: string;
  readonly peopleFilePath?: string;
  readonly rulesFilePath?: string;
  readonly settingsFilePath?: string;
  readonly queueFilePath?: string;
  readonly powerStateFilePath?: string;
  readonly inhibitorStatePath?: string;
  readonly hostStateFilePath?: string;
  readonly backendStateFilePath?: string;
  readonly backendRuntimeStateFilePath?: string;
  readonly systemdUserPath?: string;
  readonly hostServiceName?: string;
  readonly hostWorkingDirectory?: string;
  readonly hostExecStart?: string;
  readonly hostPublishHeartbeatOnStart?: boolean;
  readonly codexAuthFile?: string;
  readonly canonicalCodexAuthFile?: string;
  readonly codexAuthRouterStateFilePath?: string;
  readonly codexAuthRouterBackupDirectoryPath?: string;
  readonly codexAuthSourcesEnvironmentFilePath?: string;
  readonly codexAuthManagedAccountsDirectoryPath?: string;
  readonly codexAuthSources?: readonly CodexAuthSourceConfig[];
  readonly startByPreparingCodexAuth?: boolean;
  readonly operationalTickIntervalMs?: number;
  readonly httpHost?: string;
  readonly httpPort?: number;
  readonly webSocketPath?: string;
  readonly webDistRootPath?: string;
  readonly frontendDefaultMode?: BackendFrontendMode;
  readonly whatsappAuthRootPath?: string;
  readonly whatsappEnabled?: boolean;
  readonly whatsappAutoConnect?: boolean;
  readonly whatsappSocketFactory?: BaileysSocketFactory;
  readonly whatsappVersionResolver?: BaileysVersionResolver;
  readonly conversationMaxInboundAgeMs?: number;
  readonly llmFetch?: typeof fetch;
  readonly llmCodexClientVersion?: string;
  readonly openAiCompatBaseUrl?: string;
  readonly openAiCompatApiKey?: string;
  readonly openAiCompatDefaultModel?: string;
  readonly workspaceAgentRootPath?: string;
  readonly workspaceAgentRunLogFilePath?: string;
  readonly workspaceAgentExecutor?: WorkspaceAgentExecutor;
  readonly waNotifySchedulesRootPath?: string;
  readonly waNotifyAlertsFilePath?: string;
  readonly waNotifyAutomationsFilePath?: string;
}

export interface BackendRuntimePaths {
  readonly projectRoot: string;
  readonly sourceRoot: string;
  readonly dataRootPath: string;
  readonly configRootPath: string;
  readonly runtimeRootPath: string;
  readonly groupSeedFilePath: string;
  readonly catalogFilePath: string;
  readonly peopleFilePath: string;
  readonly rulesFilePath: string;
  readonly settingsFilePath: string;
  readonly queueFilePath: string;
  readonly powerStateFilePath: string;
  readonly inhibitorStatePath: string;
  readonly hostStateFilePath: string;
  readonly backendStateFilePath: string;
  readonly backendRuntimeStateFilePath: string;
  readonly systemdUserPath: string;
  readonly codexAuthFile: string;
  readonly canonicalCodexAuthFile: string;
  readonly codexAuthRouterStateFilePath: string;
  readonly codexAuthRouterBackupDirectoryPath: string;
  readonly codexAuthSourcesEnvironmentFilePath: string;
  readonly codexAuthManagedAccountsDirectoryPath: string;
  readonly hostWorkingDirectory: string;
  readonly hostExecStart: string;
  readonly hostServiceName: string;
  readonly httpHost: string;
  readonly httpPort: number;
  readonly httpOrigin: string;
  readonly webSocketPath: string;
  readonly webDistRootPath: string;
  readonly frontendDefaultMode: BackendFrontendMode;
  readonly whatsappAuthRootPath: string;
  readonly workspaceAgentRootPath: string;
  readonly workspaceAgentRunLogFilePath: string;
  readonly waNotifySchedulesRootPath: string;
  readonly waNotifyAlertsFilePath: string;
  readonly waNotifyAutomationsFilePath: string;
  readonly messageAlertsLogFilePath: string;
  readonly automationsRunLogFilePath: string;
  readonly automationsFiredStateFilePath: string;
}

export function resolveBackendRuntimePaths(config: BackendRuntimeConfig = {}): BackendRuntimePaths {
  const projectRoot = resolveProjectRoot(config.rootPath);
  const sourceRoot = resolveSourceRoot(projectRoot);
  const dataRootPath =
    config.dataRootPath ??
    readPathFromEnv('LUME_HUB_DATA_DIR', 'LUME_HUB_DATA_ROOT') ??
    resolve(projectRoot, 'runtime', 'lxd', 'host-mounts', 'data');
  const configRootPath =
    config.configRootPath ??
    readPathFromEnv('LUME_HUB_CONFIG_DIR') ??
    resolve(dataRootPath, 'config');
  const runtimeRootPath =
    config.runtimeRootPath ??
    readPathFromEnv('LUME_HUB_RUNTIME_DIR') ??
    resolve(dataRootPath, 'runtime');
  const codexAuthFile =
    config.codexAuthFile ??
    readPathFromEnv('LUME_HUB_CODEX_AUTH_FILE', 'CODEX_AUTH_FILE') ??
    '/home/eliaspc/.codex/auth.json';
  const canonicalCodexAuthFile =
    config.canonicalCodexAuthFile ??
    readPathFromEnv('LUME_HUB_CANONICAL_CODEX_AUTH_FILE') ??
    codexAuthFile;
  const hostServiceName = config.hostServiceName ?? process.env.LUME_HUB_HOST_SERVICE_NAME ?? 'lume-hub-host.service';
  const hostWorkingDirectory =
    config.hostWorkingDirectory ??
    readPathFromEnv('LUME_HUB_HOST_WORKING_DIRECTORY') ??
    sourceRoot;
  const httpHost = config.httpHost ?? process.env.LUME_HUB_HTTP_HOST ?? process.env.LUMEHUB_HOST ?? '127.0.0.1';
  const httpPort =
    config.httpPort ??
    readPortFromEnv(process.env.LUME_HUB_HTTP_PORT) ??
    readPortFromEnv(process.env.LUMEHUB_PORT) ??
    18420;
  const webSocketPath = normaliseWebSocketPath(config.webSocketPath ?? process.env.LUME_HUB_WS_PATH ?? '/ws');
  const webDistRootPath =
    config.webDistRootPath ??
    readPathFromEnv('LUME_HUB_WEB_DIST_ROOT') ??
    resolve(sourceRoot, 'apps', 'lume-hub-web', 'dist');
  const frontendDefaultMode = config.frontendDefaultMode ?? 'live';
  const whatsappAuthRootPath =
    config.whatsappAuthRootPath ??
    readPathFromEnv('LUME_HUB_WHATSAPP_AUTH_ROOT') ??
    resolve(runtimeRootPath, 'whatsapp-auth');
  const workspaceAgentRootPath =
    config.workspaceAgentRootPath ??
    readPathFromEnv('LUME_HUB_WORKSPACE_AGENT_ROOT') ??
    projectRoot;
  const workspaceAgentRunLogFilePath =
    config.workspaceAgentRunLogFilePath ??
    readPathFromEnv('LUME_HUB_WORKSPACE_AGENT_RUN_LOG') ??
    resolve(runtimeRootPath, 'workspace-agent-runs.json');
  const waNotifySchedulesRootPath =
    config.waNotifySchedulesRootPath ?? '/home/eliaspc/Containers/wa-notify/data/schedules';
  const waNotifyAlertsFilePath = config.waNotifyAlertsFilePath ?? '/home/eliaspc/Containers/wa-notify/data/alerts.json';
  const waNotifyAutomationsFilePath =
    config.waNotifyAutomationsFilePath ?? '/home/eliaspc/Containers/wa-notify/data/automations.json';

  return {
    projectRoot,
    sourceRoot,
    dataRootPath,
    configRootPath,
    runtimeRootPath,
    groupSeedFilePath: config.groupSeedFilePath ?? resolve(configRootPath, 'groups.json'),
    catalogFilePath: config.catalogFilePath ?? resolve(configRootPath, 'discipline_catalog.json'),
    peopleFilePath: config.peopleFilePath ?? resolve(configRootPath, 'people.json'),
    rulesFilePath: config.rulesFilePath ?? resolve(configRootPath, 'audience_rules.json'),
    settingsFilePath: config.settingsFilePath ?? resolve(runtimeRootPath, 'system-settings.json'),
    queueFilePath: config.queueFilePath ?? resolve(runtimeRootPath, 'instruction-queue.json'),
    powerStateFilePath:
      config.powerStateFilePath ??
      readPathFromEnv('LUME_HUB_POWER_STATE_FILE') ??
      resolve(projectRoot, 'runtime', 'host', 'state', 'power-policy-state.json'),
    inhibitorStatePath:
      config.inhibitorStatePath ??
      readPathFromEnv('LUME_HUB_INHIBITOR_STATE_FILE') ??
      resolve(projectRoot, 'runtime', 'host', 'state', 'sleep-inhibitor.json'),
    hostStateFilePath:
      config.hostStateFilePath ??
      readPathFromEnv('LUME_HUB_HOST_STATE_FILE') ??
      resolve(projectRoot, 'runtime', 'host', 'state', 'host-runtime-state.json'),
    backendStateFilePath:
      config.backendStateFilePath ??
      readPathFromEnv('LUME_HUB_BACKEND_STATE_FILE') ??
      resolve(runtimeRootPath, 'host-state.json'),
    backendRuntimeStateFilePath:
      config.backendRuntimeStateFilePath ??
      readPathFromEnv('LUME_HUB_BACKEND_RUNTIME_STATE_FILE') ??
      resolve(runtimeRootPath, 'backend-runtime-state.json'),
    systemdUserPath:
      config.systemdUserPath ??
      readPathFromEnv('LUME_HUB_SYSTEMD_USER_PATH') ??
      resolve(projectRoot, 'runtime', 'host', 'systemd-user'),
    codexAuthFile,
    canonicalCodexAuthFile,
    codexAuthRouterStateFilePath:
      config.codexAuthRouterStateFilePath ?? resolve(runtimeRootPath, 'codex-auth-router.state.json'),
    codexAuthRouterBackupDirectoryPath:
      config.codexAuthRouterBackupDirectoryPath ?? resolve(runtimeRootPath, 'codex-auth-router-backups'),
    codexAuthSourcesEnvironmentFilePath:
      config.codexAuthSourcesEnvironmentFilePath ?? resolve(projectRoot, 'runtime', 'host', 'codex-auth-sources.env'),
    codexAuthManagedAccountsDirectoryPath:
      config.codexAuthManagedAccountsDirectoryPath ?? resolveDefaultCodexAuthManagedAccountsDirectory(projectRoot),
    hostWorkingDirectory,
    hostExecStart:
      config.hostExecStart ??
      readPathFromEnv('LUME_HUB_HOST_EXEC_START') ??
      `/usr/bin/env node ${resolve(sourceRoot, 'apps', 'lume-hub-host', 'dist', 'apps', 'lume-hub-host', 'src', 'main.js')}`,
    hostServiceName,
    httpHost,
    httpPort,
    httpOrigin: `http://${httpHost}:${httpPort}`,
    webSocketPath,
    webDistRootPath,
    frontendDefaultMode,
    whatsappAuthRootPath,
    workspaceAgentRootPath,
    workspaceAgentRunLogFilePath,
    waNotifySchedulesRootPath,
    waNotifyAlertsFilePath,
    waNotifyAutomationsFilePath,
    messageAlertsLogFilePath: resolve(runtimeRootPath, 'message-alerts-log.json'),
    automationsRunLogFilePath: resolve(runtimeRootPath, 'automations-run-log.json'),
    automationsFiredStateFilePath: resolve(runtimeRootPath, 'automations-fired-state.json'),
  };
}

function readPathFromEnv(...names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

export function resolveBackendEnvironment(config: BackendRuntimeConfig = {}): ModuleEnvironment {
  if (config.environment) {
    return config.environment;
  }

  switch (process.env.NODE_ENV) {
    case 'production':
      return 'production';
    case 'test':
      return 'test';
    default:
      return 'development';
  }
}

export function resolveCodexAuthSources(
  configuredSources?: readonly CodexAuthSourceConfig[],
): readonly CodexAuthSourceConfig[] | undefined {
  return configuredSources ?? readCodexAuthSourcesFromEnv(process.env.LUME_HUB_CODEX_AUTH_SOURCES);
}

export function resolveConversationMaxInboundAgeMs(config: BackendRuntimeConfig = {}): number | undefined {
  return config.conversationMaxInboundAgeMs ?? readPositiveIntegerFromEnv(process.env.LUME_HUB_CONVERSATION_MAX_INBOUND_AGE_MS);
}

export function resolveProjectRoot(rootPath = process.cwd()): string {
  return rootPath.endsWith('/source') ? dirname(rootPath) : rootPath;
}

export function resolveSourceRoot(projectRoot: string): string {
  const directSourceRoot = projectRoot.endsWith('/source') ? projectRoot : resolve(projectRoot, 'source');
  return existsSync(directSourceRoot) ? directSourceRoot : projectRoot;
}

function readPortFromEnv(rawValue: string | undefined): number | undefined {
  if (!rawValue) {
    return undefined;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0 || value > 65_535) {
    return undefined;
  }

  return value;
}

function readPositiveIntegerFromEnv(rawValue: string | undefined): number | undefined {
  if (!rawValue) {
    return undefined;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function resolveDefaultCodexAuthManagedAccountsDirectory(projectRoot: string): string {
  const legacyDirectory = '/home/eliaspc/Documentos/codex-auth-backups/secondary';

  return existsSync(legacyDirectory)
    ? legacyDirectory
    : resolve(projectRoot, 'runtime', 'host', 'codex-auth-managed', 'secondary');
}

function normaliseWebSocketPath(path: string): string {
  const trimmed = path.trim();

  if (!trimmed) {
    return '/ws';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function readCodexAuthSourcesFromEnv(rawValue: string | undefined): readonly CodexAuthSourceConfig[] | undefined {
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
