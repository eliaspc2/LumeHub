import { resolve } from 'node:path';

import { SystemClock } from '@lume-hub/clock';
import { BaseModule } from '@lume-hub/kernel';

import { HostCompanionCoordinator } from '../application/services/HostCompanionCoordinator.js';
import { HostLifecycleService } from '../application/services/HostLifecycleService.js';
import { HostRuntimeStateRepository } from '../infrastructure/persistence/HostRuntimeStateRepository.js';
import { AutostartInstaller } from '../infrastructure/system/AutostartInstaller.js';
import type { HostLifecycleModuleContract } from '../public/contracts/index.js';
import type { HostLifecycleModuleConfig } from './HostLifecycleModuleConfig.js';

export class HostLifecycleModule extends BaseModule implements HostLifecycleModuleContract {
  readonly moduleName = 'host-lifecycle' as const;
  readonly service: HostLifecycleService;
  readonly coordinator: HostCompanionCoordinator;

  constructor(readonly config: HostLifecycleModuleConfig = {}) {
    super({
      name: 'host-lifecycle',
      version: '0.1.0',
      dependencies: ['system-power'],
    });

    const clock = config.clock ?? new SystemClock();
    const serviceName = config.serviceName ?? 'lume-hub-host.service';
    const systemdUserPath = config.systemdUserPath ?? resolve(process.cwd(), 'runtime/host/systemd-user');
    const manifestPath = resolve(systemdUserPath, serviceName);
    const workingDirectory = config.workingDirectory ?? resolve(process.cwd(), 'source');
    const backendStateFilePath =
      config.backendStateFilePath ?? resolve(process.cwd(), 'runtime/lxd/host-mounts/data/runtime/host-state.json');
    const codexAuthFile = config.codexAuthFile ?? '/home/eliaspc/.codex/auth.json';

    const repository =
      config.repository ??
      new HostRuntimeStateRepository({
        stateFilePath: config.stateFilePath ?? resolve(process.cwd(), 'runtime/host/state/host-runtime-state.json'),
        serviceName,
        manifestPath,
        workingDirectory,
        execStart:
          config.execStart ??
          `/usr/bin/env node ${resolve(process.cwd(), 'apps/lume-hub-host/dist/apps/lume-hub-host/src/main.js')}`,
        codexAuthFile,
        hostId: config.hostId,
      });
    const installer =
      config.installer ??
      new AutostartInstaller({
        systemdUserPath,
      });

    this.service =
      config.service ??
      new HostLifecycleService(
        repository,
        installer,
        {
          backendStateFilePath,
          canonicalCodexAuthFile: config.canonicalCodexAuthFile ?? codexAuthFile,
        },
        clock,
      );
    this.coordinator =
      config.coordinator ??
      new HostCompanionCoordinator(this.service, {
        backendStateFilePath,
        powerStatusProvider: config.powerStatusProvider,
        authRouterStatusProvider: config.authRouterStatusProvider,
      });
  }

  async start(): Promise<void> {
    if (this.config.enabled === false) {
      return;
    }

    await this.service.repairHostIntegration();

    if (this.config.publishHeartbeatOnStart !== false) {
      await this.coordinator.publishHeartbeat();
    }
  }

  async enableStartWithSystem(input = {}) {
    return this.service.enableStartWithSystem(input);
  }

  async disableStartWithSystem() {
    return this.service.disableStartWithSystem();
  }

  async getAutostartStatus() {
    return this.service.getAutostartStatus();
  }

  async repairHostIntegration() {
    return this.service.repairHostIntegration();
  }

  async getHostCompanionStatus() {
    return this.service.getHostCompanionStatus();
  }

  async publishHeartbeat(input = {}) {
    return this.coordinator.publishHeartbeat(input);
  }

  async health() {
    const status = await this.service.getHostCompanionStatus();

    return {
      status: status.auth.exists ? ('healthy' as const) : ('degraded' as const),
      details: {
        module: this.name,
        authExists: status.auth.exists,
        autostartEnabled: status.autostart.enabled,
      },
    };
  }
}
