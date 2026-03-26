import type { NotificationJobRepository } from '@lume-hub/notification-jobs';
import type { WatchdogIssueRepository } from '@lume-hub/watchdog';

import type { HealthCheckService, ModuleHealthProvider } from '../application/services/HealthCheckService.js';
import type { ModuleHealthAggregator } from '../domain/services/ModuleHealthAggregator.js';

export interface HealthMonitorModuleConfig {
  readonly dataRootPath?: string;
  readonly notificationJobRepository?: NotificationJobRepository;
  readonly watchdogIssueRepository?: WatchdogIssueRepository;
  readonly aggregator?: ModuleHealthAggregator;
  readonly moduleHealthProvider?: ModuleHealthProvider;
  readonly service?: HealthCheckService;
}
