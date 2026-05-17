import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CodexOrchestratorPaths } from '../../domain/entities/CodexOrchestrator.js';

export interface ResolveCodexOrchestratorPathsInput {
  readonly projectRoot?: string;
  readonly dataRootPath?: string;
  readonly adminPhoneFilePath?: string;
}

export function resolveCodexOrchestratorPaths(
  input: ResolveCodexOrchestratorPathsInput = {},
): CodexOrchestratorPaths {
  const projectRoot = input.projectRoot ? resolve(input.projectRoot) : discoverProjectRoot();
  const sourceRoot = resolve(projectRoot, 'source');
  const dataRootPath =
    input.dataRootPath ??
    readPathFromEnv('LUME_HUB_DATA_DIR', 'LUME_HUB_DATA_ROOT') ??
    resolve(projectRoot, 'runtime', 'lxd', 'host-mounts', 'data');
  const configRootPath = readPathFromEnv('LUME_HUB_CONFIG_DIR') ?? resolve(dataRootPath, 'config');
  const runtimeRootPath = readPathFromEnv('LUME_HUB_RUNTIME_DIR') ?? resolve(dataRootPath, 'runtime');

  return {
    projectRoot,
    sourceRoot,
    dataRootPath,
    configRootPath,
    runtimeRootPath,
    adminPhoneFilePath: input.adminPhoneFilePath ?? resolve(configRootPath, 'admin-phone.txt'),
    peopleFilePath: resolve(configRootPath, 'people.json'),
    groupSeedFilePath: resolve(configRootPath, 'groups.json'),
    settingsFilePath: resolve(runtimeRootPath, 'system-settings.json'),
  };
}

function discoverProjectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const packageRoot = resolve(dirname(currentFile), '..', '..', '..');
  return resolve(packageRoot, '..', '..', '..', '..');
}

function readPathFromEnv(...names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return resolve(value);
    }
  }

  return undefined;
}
