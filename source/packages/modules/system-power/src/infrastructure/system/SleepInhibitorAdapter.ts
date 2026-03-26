import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import type { PowerInhibitLease } from '../../domain/entities/PowerInhibitLease.js';

interface PersistedInhibitorState {
  readonly schemaVersion: 1;
  readonly provider: 'recorded-systemd-logind-request';
  readonly lease: PowerInhibitLease;
}

export interface SleepInhibitorAdapterConfig {
  readonly inhibitorStatePath: string;
}

export class SleepInhibitorAdapter {
  constructor(private readonly config: SleepInhibitorAdapterConfig) {}

  getInhibitorStatePath(): string {
    return this.config.inhibitorStatePath;
  }

  async acquire(lease: PowerInhibitLease): Promise<void> {
    const payload: PersistedInhibitorState = {
      schemaVersion: 1,
      provider: 'recorded-systemd-logind-request',
      lease,
    };

    await writeJsonFileAtomically(this.config.inhibitorStatePath, payload);
  }

  async release(): Promise<void> {
    await rm(this.config.inhibitorStatePath, { force: true });
  }

  async isActive(): Promise<boolean> {
    return (await this.readState()) !== undefined;
  }

  async readActiveLease(): Promise<PowerInhibitLease | undefined> {
    return (await this.readState())?.lease;
  }

  private async readState(): Promise<PersistedInhibitorState | undefined> {
    try {
      const contents = await readFile(this.config.inhibitorStatePath, 'utf8');
      return JSON.parse(contents) as PersistedInhibitorState;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return undefined;
      }

      throw error;
    }
  }
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
