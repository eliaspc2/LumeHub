import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import type { BackendFrontendMode } from './BackendRuntimeConfig.js';

export type BackendRuntimePhase = 'starting' | 'running' | 'degraded' | 'stopped';

export interface BackendRuntimeDiagnosticsState {
  readonly schemaVersion: 1;
  readonly stateFilePath: string;
  readonly phase: BackendRuntimePhase;
  readonly startedAt: string | null;
  readonly listeningAt: string | null;
  readonly stoppedAt: string | null;
  readonly updatedAt: string;
  readonly baseUrl: string | null;
  readonly http: {
    readonly host: string;
    readonly port: number;
    readonly webSocketPath: string;
  };
  readonly frontend: {
    readonly defaultMode: BackendFrontendMode;
    readonly distRootPath: string;
  };
  readonly moduleGraph: {
    readonly moduleCount: number;
    readonly loadOrder: readonly string[];
  };
  readonly readiness: {
    readonly ready: boolean;
    readonly status: 'starting' | 'healthy' | 'degraded' | 'stopped';
  };
  readonly health: {
    readonly status: 'starting' | 'healthy' | 'degraded' | 'stopped';
    readonly jobs: {
      readonly pending: number;
      readonly waitingConfirmation: number;
      readonly sent: number;
    };
    readonly watchdog: {
      readonly openIssues: number;
    };
    readonly modules: readonly {
      readonly name: string;
      readonly status: 'starting' | 'healthy' | 'degraded' | 'stopped';
      readonly details: Record<string, unknown> | null;
    }[];
  };
  readonly operational: {
    readonly lastTickAt: string | null;
    readonly lastError: string | null;
    readonly watchdogRaised: number;
    readonly watchdogResolved: number;
  };
  readonly host: {
    readonly lastHeartbeatAt: string | null;
    readonly lastError: string | null;
  };
  readonly whatsapp: {
    readonly session: {
      readonly phase: 'disabled' | 'idle' | 'connecting' | 'qr_pending' | 'open' | 'closed' | 'error';
      readonly connected: boolean;
      readonly loginRequired: boolean;
      readonly lastConnectedAt: string | null;
      readonly lastDisconnectAt: string | null;
      readonly lastDisconnectReason: string | null;
      readonly lastError: string | null;
    };
    readonly discoveredGroups: number;
    readonly discoveredConversations: number;
  };
  readonly webSocket: {
    readonly sessionCount: number;
  };
}

export class BackendRuntimeStateRepository {
  constructor(private readonly stateFilePath: string) {}

  getStateFilePath(): string {
    return this.stateFilePath;
  }

  async readState(defaultValue?: BackendRuntimeDiagnosticsState): Promise<BackendRuntimeDiagnosticsState> {
    try {
      const raw = await readFile(this.stateFilePath, 'utf8');
      return JSON.parse(raw) as BackendRuntimeDiagnosticsState;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT' && defaultValue) {
        return defaultValue;
      }

      throw error;
    }
  }

  async saveState(state: BackendRuntimeDiagnosticsState): Promise<void> {
    const directoryPath = dirname(this.stateFilePath);
    await mkdir(directoryPath, { recursive: true });

    const temporaryPath = join(directoryPath, `${basename(this.stateFilePath)}.${randomUUID()}.tmp`);
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, this.stateFilePath);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
