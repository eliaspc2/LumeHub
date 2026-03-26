import { stat } from 'node:fs/promises';

import { SystemClock, type Clock } from '@lume-hub/clock';

import type { AutostartPolicy } from '../../domain/entities/AutostartPolicy.js';
import type { HostCompanionStatus } from '../../domain/entities/HostCompanionStatus.js';
import type { HostIntegrationState } from '../../domain/entities/HostIntegrationState.js';
import { HostRuntimeStateRepository } from '../../infrastructure/persistence/HostRuntimeStateRepository.js';
import { AutostartInstaller } from '../../infrastructure/system/AutostartInstaller.js';

export interface HostLifecycleServiceConfig {
  readonly backendStateFilePath: string;
  readonly canonicalCodexAuthFile: string;
}

export class HostLifecycleService {
  constructor(
    private readonly repository: HostRuntimeStateRepository,
    private readonly installer: AutostartInstaller,
    private readonly config: HostLifecycleServiceConfig,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async enableStartWithSystem(update: Partial<AutostartPolicy> = {}): Promise<AutostartPolicy> {
    const now = this.clock.now();
    const currentState = await this.repository.readState(now);
    const nextPolicy: AutostartPolicy = {
      ...currentState.autostartPolicy,
      ...update,
      enabled: true,
      codexAuthFile: update.codexAuthFile ?? currentState.codexAuthFile,
      installedAt: currentState.autostartPolicy.installedAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await this.installer.install(nextPolicy);

    const nextState: HostIntegrationState = {
      ...currentState,
      codexAuthFile: nextPolicy.codexAuthFile,
      codexAuthExists: await fileExists(nextPolicy.codexAuthFile),
      autostartPolicy: nextPolicy,
      lastRepairAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastError: null,
    };

    await this.repository.saveState(nextState);
    return nextPolicy;
  }

  async disableStartWithSystem(): Promise<AutostartPolicy> {
    const now = this.clock.now();
    const currentState = await this.repository.readState(now);
    await this.installer.remove(currentState.autostartPolicy);

    const nextPolicy: AutostartPolicy = {
      ...currentState.autostartPolicy,
      enabled: false,
      updatedAt: now.toISOString(),
    };
    const nextState: HostIntegrationState = {
      ...currentState,
      autostartPolicy: nextPolicy,
      lastRepairAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastError: null,
    };

    await this.repository.saveState(nextState);
    return nextPolicy;
  }

  async getAutostartStatus(): Promise<HostCompanionStatus['autostart']> {
    const state = await this.repository.readState(this.clock.now());
    const status = await this.installer.getStatus(state.autostartPolicy);

    return {
      enabled: status.enabled,
      serviceName: state.autostartPolicy.serviceName,
      manifestPath: state.autostartPolicy.manifestPath,
      workingDirectory: state.autostartPolicy.workingDirectory,
      execStart: state.autostartPolicy.execStart,
      installedAt: state.autostartPolicy.installedAt,
    };
  }

  async repairHostIntegration(): Promise<HostIntegrationState> {
    const now = this.clock.now();
    const currentState = await this.repository.readState(now);
    const authExists = await fileExists(currentState.codexAuthFile);
    const autostartStatus = await this.installer.getStatus(currentState.autostartPolicy);

    let nextPolicy: AutostartPolicy = {
      ...currentState.autostartPolicy,
      enabled: autostartStatus.enabled,
      updatedAt: now.toISOString(),
    };

    if (currentState.autostartPolicy.enabled && !autostartStatus.enabled) {
      await this.installer.install({
        ...currentState.autostartPolicy,
        enabled: true,
      });
      nextPolicy = {
        ...currentState.autostartPolicy,
        enabled: true,
        installedAt: currentState.autostartPolicy.installedAt ?? now.toISOString(),
        updatedAt: now.toISOString(),
      };
    }

    const nextState: HostIntegrationState = {
      ...currentState,
      codexAuthExists: authExists,
      autostartPolicy: nextPolicy,
      lastRepairAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastError: null,
    };

    await this.repository.saveState(nextState);
    return nextState;
  }

  async getHostCompanionStatus(): Promise<HostCompanionStatus> {
    const state = await this.repository.readState(this.clock.now());
    const autostart = await this.getAutostartStatus();

    return {
      schemaVersion: 1,
      hostId: state.hostId,
      auth: {
        filePath: state.codexAuthFile,
        exists: state.codexAuthExists,
        sameAsCodexCanonical: state.codexAuthFile === this.config.canonicalCodexAuthFile,
      },
      autostart,
      runtime: {
        stateFilePath: this.repository.getStateFilePath(),
        backendStateFilePath: this.config.backendStateFilePath,
        lastRepairAt: state.lastRepairAt,
        lastHeartbeatAt: state.lastHeartbeatAt,
        updatedAt: state.updatedAt,
        lastError: state.lastError,
      },
    };
  }

  async recordHeartbeat(input: { readonly now?: Date; readonly lastError?: string | null } = {}): Promise<HostIntegrationState> {
    const now = input.now ?? this.clock.now();
    const currentState = await this.repository.readState(now);
    const nextState: HostIntegrationState = {
      ...currentState,
      lastHeartbeatAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastError: input.lastError ?? currentState.lastError,
    };

    await this.repository.saveState(nextState);
    return nextState;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
