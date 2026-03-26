import type { ModuleHealth } from '@lume-hub/contracts';

export interface HealthSnapshot {
  readonly status: ModuleHealth['status'];
  readonly ready: boolean;
  readonly modules: readonly ModuleHealth[];
  readonly jobs: {
    readonly pending: number;
    readonly waitingConfirmation: number;
    readonly sent: number;
  };
  readonly watchdog: {
    readonly openIssues: number;
  };
}
