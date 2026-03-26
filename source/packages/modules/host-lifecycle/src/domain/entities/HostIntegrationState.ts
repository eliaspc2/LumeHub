import type { AutostartPolicy } from './AutostartPolicy.js';

export interface HostIntegrationState {
  readonly schemaVersion: 1;
  readonly hostId: string;
  readonly codexAuthFile: string;
  readonly codexAuthExists: boolean;
  readonly autostartPolicy: AutostartPolicy;
  readonly lastRepairAt: string | null;
  readonly lastHeartbeatAt: string | null;
  readonly updatedAt: string;
  readonly lastError: string | null;
}
