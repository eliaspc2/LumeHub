import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import type { PowerInhibitLease } from '../../domain/entities/PowerInhibitLease.js';
import type { PowerPolicy } from '../../domain/entities/PowerPolicy.js';

interface PersistedPowerState {
  readonly schemaVersion: 1;
  readonly policy: PowerPolicy;
  readonly activeLease: PowerInhibitLease | null;
  readonly updatedAt: string;
}

export interface PowerPolicyRepositoryConfig {
  readonly stateFilePath: string;
}

export class PowerPolicyRepository {
  constructor(private readonly config: PowerPolicyRepositoryConfig) {}

  getStateFilePath(): string {
    return this.config.stateFilePath;
  }

  async readState(now = new Date()): Promise<PersistedPowerState> {
    try {
      const contents = await readFile(this.config.stateFilePath, 'utf8');
      return JSON.parse(contents) as PersistedPowerState;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        const state = createDefaultState(now);
        await this.saveState(state);
        return state;
      }

      throw error;
    }
  }

  async saveState(state: PersistedPowerState): Promise<PersistedPowerState> {
    await writeJsonFileAtomically(this.config.stateFilePath, state);
    return state;
  }

  async savePolicy(policy: PowerPolicy, now = new Date()): Promise<PersistedPowerState> {
    const current = await this.readState(now);
    const nextState: PersistedPowerState = {
      ...current,
      policy,
      updatedAt: now.toISOString(),
    };

    return this.saveState(nextState);
  }

  async saveLease(activeLease: PowerInhibitLease | null, now = new Date()): Promise<PersistedPowerState> {
    const current = await this.readState(now);
    const nextState: PersistedPowerState = {
      ...current,
      activeLease,
      updatedAt: now.toISOString(),
    };

    return this.saveState(nextState);
  }
}

function createDefaultState(now: Date): PersistedPowerState {
  return {
    schemaVersion: 1,
    policy: {
      schemaVersion: 1,
      enabled: true,
      mode: 'on_demand',
      preferredReasons: [],
      updatedAt: now.toISOString(),
    },
    activeLease: null,
    updatedAt: now.toISOString(),
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
