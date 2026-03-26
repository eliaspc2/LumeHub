import type { Clock } from '@lume-hub/clock';
import type { NotificationRuleService } from '@lume-hub/notification-rules';
import type { ScheduleEventRepository, ScheduleEventService } from '@lume-hub/schedule-events';
import type { WeekCalculator } from '@lume-hub/schedule-weeks';

import type { NotificationJobCleanupService } from '../application/services/NotificationJobCleanupService.js';
import type { NotificationJobService } from '../application/services/NotificationJobService.js';
import type { NotificationJobRepository } from '../domain/repositories/NotificationJobRepository.js';
import type { NotificationJobMaterializer } from '../domain/services/NotificationJobMaterializer.js';
import type { PastEventCleanupPolicy } from '../domain/services/PastEventCleanupPolicy.js';

export interface NotificationJobsModuleConfig {
  readonly dataRootPath?: string;
  readonly clock?: Clock;
  readonly weekCalculator?: WeekCalculator;
  readonly scheduleEventRepository?: ScheduleEventRepository;
  readonly scheduleEventService?: ScheduleEventService;
  readonly notificationRuleService?: NotificationRuleService;
  readonly repository?: NotificationJobRepository;
  readonly materializer?: NotificationJobMaterializer;
  readonly cleanupPolicy?: PastEventCleanupPolicy;
  readonly cleanupService?: NotificationJobCleanupService;
  readonly service?: NotificationJobService;
}
