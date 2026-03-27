import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { Clock } from '@lume-hub/clock';
import type { CodexAuthSourceConfig } from '@lume-hub/codex-auth-router';
import type { ModuleEnvironment } from '@lume-hub/kernel';

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
  readonly systemdUserPath?: string;
  readonly hostServiceName?: string;
  readonly hostWorkingDirectory?: string;
  readonly hostExecStart?: string;
  readonly hostPublishHeartbeatOnStart?: boolean;
  readonly codexAuthFile?: string;
  readonly canonicalCodexAuthFile?: string;
  readonly codexAuthRouterStateFilePath?: string;
  readonly codexAuthRouterBackupDirectoryPath?: string;
  readonly codexAuthSources?: readonly CodexAuthSourceConfig[];
  readonly startByPreparingCodexAuth?: boolean;
  readonly operationalTickIntervalMs?: number;
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
  readonly systemdUserPath: string;
  readonly codexAuthFile: string;
  readonly canonicalCodexAuthFile: string;
  readonly codexAuthRouterStateFilePath: string;
  readonly codexAuthRouterBackupDirectoryPath: string;
  readonly hostWorkingDirectory: string;
  readonly hostExecStart: string;
  readonly hostServiceName: string;
}

export function resolveBackendRuntimePaths(config: BackendRuntimeConfig = {}): BackendRuntimePaths {
  const projectRoot = resolveProjectRoot(config.rootPath);
  const sourceRoot = resolveSourceRoot(projectRoot);
  const dataRootPath = config.dataRootPath ?? resolve(projectRoot, 'runtime', 'lxd', 'host-mounts', 'data');
  const configRootPath = config.configRootPath ?? resolve(dataRootPath, 'config');
  const runtimeRootPath = config.runtimeRootPath ?? resolve(dataRootPath, 'runtime');
  const codexAuthFile = config.codexAuthFile ?? '/home/eliaspc/.codex/auth.json';
  const canonicalCodexAuthFile = config.canonicalCodexAuthFile ?? codexAuthFile;
  const hostServiceName = config.hostServiceName ?? 'lume-hub-host.service';
  const hostWorkingDirectory = config.hostWorkingDirectory ?? sourceRoot;

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
      config.powerStateFilePath ?? resolve(projectRoot, 'runtime', 'host', 'state', 'power-policy-state.json'),
    inhibitorStatePath:
      config.inhibitorStatePath ?? resolve(projectRoot, 'runtime', 'host', 'state', 'sleep-inhibitor.json'),
    hostStateFilePath:
      config.hostStateFilePath ?? resolve(projectRoot, 'runtime', 'host', 'state', 'host-runtime-state.json'),
    backendStateFilePath: config.backendStateFilePath ?? resolve(runtimeRootPath, 'host-state.json'),
    systemdUserPath: config.systemdUserPath ?? resolve(projectRoot, 'runtime', 'host', 'systemd-user'),
    codexAuthFile,
    canonicalCodexAuthFile,
    codexAuthRouterStateFilePath:
      config.codexAuthRouterStateFilePath ?? resolve(runtimeRootPath, 'codex-auth-router.state.json'),
    codexAuthRouterBackupDirectoryPath:
      config.codexAuthRouterBackupDirectoryPath ?? resolve(runtimeRootPath, 'codex-auth-router-backups'),
    hostWorkingDirectory,
    hostExecStart:
      config.hostExecStart ??
      `/usr/bin/env node ${resolve(sourceRoot, 'apps', 'lume-hub-host', 'dist', 'apps', 'lume-hub-host', 'src', 'main.js')}`,
    hostServiceName,
  };
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

export function resolveProjectRoot(rootPath = process.cwd()): string {
  return rootPath.endsWith('/source') ? dirname(rootPath) : rootPath;
}

export function resolveSourceRoot(projectRoot: string): string {
  const directSourceRoot = projectRoot.endsWith('/source') ? projectRoot : resolve(projectRoot, 'source');
  return existsSync(directSourceRoot) ? directSourceRoot : projectRoot;
}
