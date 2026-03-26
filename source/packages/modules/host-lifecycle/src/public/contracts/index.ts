import type { HostCompanionStatus } from '../../domain/entities/HostCompanionStatus.js';
import type { HostIntegrationState } from '../../domain/entities/HostIntegrationState.js';
import type { AutostartPolicy } from '../../domain/entities/AutostartPolicy.js';

export interface HostLifecycleModuleContract {
  readonly moduleName: 'host-lifecycle';

  enableStartWithSystem(input?: Partial<AutostartPolicy>): Promise<AutostartPolicy>;
  disableStartWithSystem(): Promise<AutostartPolicy>;
  getAutostartStatus(): Promise<HostCompanionStatus['autostart']>;
  repairHostIntegration(): Promise<HostIntegrationState>;
  getHostCompanionStatus(): Promise<HostCompanionStatus>;
  publishHeartbeat(input?: { readonly now?: Date; readonly lastError?: string | null }): Promise<HostCompanionStatus>;
}
