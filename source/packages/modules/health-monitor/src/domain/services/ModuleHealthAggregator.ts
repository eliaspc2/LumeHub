import type { ModuleHealth } from '@lume-hub/contracts';

import type { HealthSnapshot } from '../entities/HealthSnapshot.js';

export class ModuleHealthAggregator {
  aggregate(input: {
    readonly modules: readonly ModuleHealth[];
    readonly jobs: HealthSnapshot['jobs'];
    readonly openIssues: number;
  }): HealthSnapshot {
    const moduleStatuses = input.modules.map((module) => module.status);
    const hasStopped = moduleStatuses.includes('stopped');
    const hasDegraded = moduleStatuses.includes('degraded');
    const status =
      hasStopped
        ? 'stopped'
        : hasDegraded || input.openIssues > 0
          ? 'degraded'
          : 'healthy';

    return {
      status,
      ready: status === 'healthy',
      modules: input.modules,
      jobs: input.jobs,
      watchdog: {
        openIssues: input.openIssues,
      },
    };
  }
}
