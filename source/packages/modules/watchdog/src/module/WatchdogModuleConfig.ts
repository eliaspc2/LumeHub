import type { Clock } from '@lume-hub/clock';
import type { NotificationJobRepository } from '@lume-hub/notification-jobs';

import type { WatchdogService } from '../application/services/WatchdogService.js';
import type { WatchdogIssueRepository } from '../domain/repositories/WatchdogIssueRepository.js';
import type { IssueCollector } from '../domain/services/IssueCollector.js';
import type { IssueNotifier } from '../domain/services/IssueNotifier.js';

export interface WatchdogModuleConfig {
  readonly dataRootPath?: string;
  readonly clock?: Clock;
  readonly overdueGraceMinutes?: number;
  readonly waitingConfirmationGraceMinutes?: number;
  readonly notificationJobRepository?: NotificationJobRepository;
  readonly repository?: WatchdogIssueRepository;
  readonly collector?: IssueCollector;
  readonly notifier?: IssueNotifier;
  readonly service?: WatchdogService;
}
