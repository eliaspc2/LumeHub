import type { Clock } from '@lume-hub/clock';

import type { HostCompanionCoordinator } from '../application/services/HostCompanionCoordinator.js';
import type { HostLifecycleService } from '../application/services/HostLifecycleService.js';
import type { HostCodexAuthRouterSnapshot, HostPowerStatusSnapshot } from '../domain/entities/HostCompanionStatus.js';
import type { HostRuntimeStateRepository } from '../infrastructure/persistence/HostRuntimeStateRepository.js';
import type { AutostartInstaller } from '../infrastructure/system/AutostartInstaller.js';

export interface HostLifecycleModuleConfig {
  readonly enabled?: boolean;
  readonly stateFilePath?: string;
  readonly backendStateFilePath?: string;
  readonly systemdUserPath?: string;
  readonly serviceName?: string;
  readonly workingDirectory?: string;
  readonly execStart?: string;
  readonly codexAuthFile?: string;
  readonly canonicalCodexAuthFile?: string;
  readonly hostId?: string;
  readonly publishHeartbeatOnStart?: boolean;
  readonly powerStatusProvider?: () => Promise<HostPowerStatusSnapshot | undefined>;
  readonly authRouterStatusProvider?: () => Promise<HostCodexAuthRouterSnapshot | undefined>;
  readonly clock?: Clock;
  readonly repository?: HostRuntimeStateRepository;
  readonly installer?: AutostartInstaller;
  readonly service?: HostLifecycleService;
  readonly coordinator?: HostCompanionCoordinator;
}
