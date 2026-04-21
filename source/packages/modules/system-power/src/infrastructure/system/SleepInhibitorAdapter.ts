import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import type { PowerInhibitLease } from '../../domain/entities/PowerInhibitLease.js';

type PersistedInhibitorState = PersistedSystemdInhibitorState | LegacyRecordedInhibitorState;

interface PersistedSystemdInhibitorState {
  readonly schemaVersion: 1;
  readonly provider: 'systemd-inhibit-process';
  readonly lease: PowerInhibitLease;
  readonly pid: number;
  readonly command: readonly string[];
  readonly acquiredAt: string;
}

interface LegacyRecordedInhibitorState {
  readonly schemaVersion: 1;
  readonly provider: 'recorded-systemd-logind-request';
  readonly lease: PowerInhibitLease;
}

interface SpawnedInhibitorProcess {
  readonly pid?: number;
  kill(signal?: NodeJS.Signals): boolean;
  unref(): void;
  once(event: 'exit' | 'error', listener: (...args: readonly unknown[]) => void): unknown;
}

export interface SleepInhibitorAdapterConfig {
  readonly inhibitorStatePath: string;
  readonly commandPath?: string;
  readonly what?: string;
  readonly mode?: string;
  readonly why?: string;
  readonly keepAliveCommand?: readonly string[];
  readonly spawnProcess?: (command: string, args: readonly string[]) => SpawnedInhibitorProcess;
  readonly isProcessAlive?: (pid: number) => boolean;
  readonly killProcess?: (pid: number, signal?: NodeJS.Signals) => void;
}

export class SleepInhibitorAdapter {
  private currentProcess?: SpawnedInhibitorProcess;

  constructor(private readonly config: SleepInhibitorAdapterConfig) {}

  getInhibitorStatePath(): string {
    return this.config.inhibitorStatePath;
  }

  async acquire(lease: PowerInhibitLease): Promise<void> {
    const existingState = await this.readState();

    if (existingState?.provider === 'systemd-inhibit-process' && this.isPidAlive(existingState.pid)) {
      await writeJsonFileAtomically(this.config.inhibitorStatePath, {
        ...existingState,
        lease,
      } satisfies PersistedSystemdInhibitorState);
      return;
    }

    await this.terminatePersistedProcess(existingState);

    const command = this.buildInhibitorCommand();
    const spawned = this.spawnProcess(command.executable, command.args);

    if (!spawned.pid || !Number.isFinite(spawned.pid)) {
      spawned.kill('SIGTERM');
      throw new Error('Failed to acquire sleep inhibitor: systemd-inhibit did not expose a process id.');
    }

    this.currentProcess = spawned;
    spawned.once('exit', () => {
      if (this.currentProcess?.pid === spawned.pid) {
        this.currentProcess = undefined;
      }
    });
    spawned.once('error', () => {
      if (this.currentProcess?.pid === spawned.pid) {
        this.currentProcess = undefined;
      }
    });
    spawned.unref();

    const payload: PersistedSystemdInhibitorState = {
      schemaVersion: 1,
      provider: 'systemd-inhibit-process',
      lease,
      pid: spawned.pid,
      command: [command.executable, ...command.args],
      acquiredAt: new Date().toISOString(),
    };

    await writeJsonFileAtomically(this.config.inhibitorStatePath, payload);
  }

  async release(): Promise<void> {
    const state = await this.readState();
    await this.terminatePersistedProcess(state);
    await rm(this.config.inhibitorStatePath, { force: true });
  }

  async isActive(): Promise<boolean> {
    const state = await this.readState();

    if (state?.provider !== 'systemd-inhibit-process') {
      return false;
    }

    const active = this.isPidAlive(state.pid);

    if (!active) {
      await rm(this.config.inhibitorStatePath, { force: true });
    }

    return active;
  }

  async readActiveLease(): Promise<PowerInhibitLease | undefined> {
    const state = await this.readState();

    if (state?.provider !== 'systemd-inhibit-process' || !this.isPidAlive(state.pid)) {
      return undefined;
    }

    return state.lease;
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

  private buildInhibitorCommand(): { readonly executable: string; readonly args: readonly string[] } {
    const keepAliveCommand = this.config.keepAliveCommand ?? ['/bin/sh', '-c', 'while :; do sleep 3600; done'];

    return {
      executable: this.config.commandPath ?? '/usr/bin/systemd-inhibit',
      args: [
        `--what=${this.config.what ?? 'sleep'}`,
        `--mode=${this.config.mode ?? 'block'}`,
        `--why=${this.config.why ?? 'Keep-LumeHub-online'}`,
        ...keepAliveCommand,
      ],
    };
  }

  private spawnProcess(command: string, args: readonly string[]): SpawnedInhibitorProcess {
    return (
      this.config.spawnProcess?.(command, args) ??
      spawn(command, [...args], {
        detached: true,
        stdio: 'ignore',
      })
    );
  }

  private isPidAlive(pid: number): boolean {
    if (!Number.isInteger(pid) || pid <= 0) {
      return false;
    }

    if (this.config.isProcessAlive) {
      return this.config.isProcessAlive(pid);
    }

    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private async terminatePersistedProcess(state: PersistedInhibitorState | undefined): Promise<void> {
    if (state?.provider !== 'systemd-inhibit-process') {
      return;
    }

    const processPid = this.currentProcess?.pid === state.pid ? this.currentProcess.pid : state.pid;

    if (!this.isPidAlive(processPid)) {
      this.currentProcess = undefined;
      return;
    }

    this.killProcess(processPid, 'SIGTERM');
    this.currentProcess = undefined;
  }

  private killProcess(pid: number, signal: NodeJS.Signals): void {
    if (this.config.killProcess) {
      this.config.killProcess(pid, signal);
      return;
    }

    try {
      process.kill(-pid, signal);
    } catch {
      process.kill(pid, signal);
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
