import type { Clock } from '@lume-hub/clock';
import { HostLifecycleModule } from '@lume-hub/host-lifecycle';
import { SystemPowerModule } from '@lume-hub/system-power';
import { dirname, resolve } from 'node:path';

export interface HostModuleLoaderOptions {
  readonly rootPath?: string;
  readonly clock?: Clock;
  readonly codexAuthFile?: string;
  readonly canonicalCodexAuthFile?: string;
  readonly hostStateFilePath?: string;
  readonly backendStateFilePath?: string;
  readonly powerStateFilePath?: string;
  readonly inhibitorStatePath?: string;
  readonly systemdUserPath?: string;
  readonly serviceName?: string;
  readonly workingDirectory?: string;
  readonly execStart?: string;
  readonly publishHeartbeatOnStart?: boolean;
}

export interface HostLoadedModules {
  readonly systemPowerModule: SystemPowerModule;
  readonly hostLifecycleModule: HostLifecycleModule;
  readonly modules: readonly [SystemPowerModule, HostLifecycleModule];
}

export class HostModuleLoader {
  constructor(private readonly options: HostModuleLoaderOptions = {}) {}

  load(): HostLoadedModules {
    const rootPath = this.options.rootPath ?? resolveProjectRoot();
    const systemPowerModule = new SystemPowerModule({
      clock: this.options.clock,
      stateFilePath: this.options.powerStateFilePath ?? resolve(rootPath, 'runtime/host/state/power-policy-state.json'),
      inhibitorStatePath: this.options.inhibitorStatePath ?? resolve(rootPath, 'runtime/host/state/sleep-inhibitor.json'),
    });
    const hostLifecycleModule = new HostLifecycleModule({
      clock: this.options.clock,
      codexAuthFile: this.options.codexAuthFile ?? '/home/eliaspc/.codex/auth.json',
      canonicalCodexAuthFile: this.options.canonicalCodexAuthFile ?? this.options.codexAuthFile ?? '/home/eliaspc/.codex/auth.json',
      stateFilePath: this.options.hostStateFilePath ?? resolve(rootPath, 'runtime/host/state/host-runtime-state.json'),
      backendStateFilePath:
        this.options.backendStateFilePath ?? resolve(rootPath, 'runtime/lxd/host-mounts/data/runtime/host-state.json'),
      systemdUserPath: this.options.systemdUserPath ?? resolve(rootPath, 'runtime/host/systemd-user'),
      serviceName: this.options.serviceName ?? 'lume-hub-host.service',
      workingDirectory: this.options.workingDirectory ?? resolve(rootPath, 'source'),
      execStart:
        this.options.execStart ??
        `/usr/bin/env node ${resolve(rootPath, 'source/apps/lume-hub-host/dist/apps/lume-hub-host/src/main.js')}`,
      publishHeartbeatOnStart: this.options.publishHeartbeatOnStart,
      powerStatusProvider: async () => {
        const status = await systemPowerModule.getPowerStatus();

        return {
          policyMode: status.policy.mode,
          inhibitorActive: status.inhibitorActive,
          leaseId: status.activeLease?.leaseId ?? null,
          explanation: status.explanation,
        };
      },
    });

    return {
      systemPowerModule,
      hostLifecycleModule,
      modules: [systemPowerModule, hostLifecycleModule],
    };
  }
}

function resolveProjectRoot(): string {
  return process.cwd().endsWith('/source') ? dirname(process.cwd()) : process.cwd();
}
