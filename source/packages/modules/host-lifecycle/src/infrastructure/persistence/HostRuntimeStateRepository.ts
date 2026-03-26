import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { basename, dirname, join } from 'node:path';

import type { AutostartPolicy } from '../../domain/entities/AutostartPolicy.js';
import type { HostIntegrationState } from '../../domain/entities/HostIntegrationState.js';

export interface HostRuntimeStateRepositoryConfig {
  readonly stateFilePath: string;
  readonly serviceName: string;
  readonly manifestPath: string;
  readonly workingDirectory: string;
  readonly execStart: string;
  readonly codexAuthFile: string;
  readonly hostId?: string;
}

export class HostRuntimeStateRepository {
  constructor(private readonly config: HostRuntimeStateRepositoryConfig) {}

  getStateFilePath(): string {
    return this.config.stateFilePath;
  }

  async readState(now = new Date()): Promise<HostIntegrationState> {
    try {
      const contents = await readFile(this.config.stateFilePath, 'utf8');
      return JSON.parse(contents) as HostIntegrationState;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        const state = createDefaultState(this.config, now);
        await this.saveState(state);
        return state;
      }

      throw error;
    }
  }

  async saveState(state: HostIntegrationState): Promise<HostIntegrationState> {
    await writeJsonFileAtomically(this.config.stateFilePath, state);
    return state;
  }
}

function createDefaultState(config: HostRuntimeStateRepositoryConfig, now: Date): HostIntegrationState {
  const autostartPolicy: AutostartPolicy = {
    enabled: false,
    serviceName: config.serviceName,
    manifestPath: config.manifestPath,
    workingDirectory: config.workingDirectory,
    execStart: config.execStart,
    codexAuthFile: config.codexAuthFile,
    installedAt: null,
    updatedAt: now.toISOString(),
  };

  return {
    schemaVersion: 1,
    hostId: config.hostId ?? hostname(),
    codexAuthFile: config.codexAuthFile,
    codexAuthExists: false,
    autostartPolicy,
    lastRepairAt: null,
    lastHeartbeatAt: null,
    updatedAt: now.toISOString(),
    lastError: null,
  };
}

async function writeJsonFileAtomically(filePath: string, value: unknown): Promise<void> {
  const directoryPath = dirname(filePath);
  await mkdir(directoryPath, { recursive: true });

  const temporaryPath = join(directoryPath, `${basename(filePath)}.${randomUUID()}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
