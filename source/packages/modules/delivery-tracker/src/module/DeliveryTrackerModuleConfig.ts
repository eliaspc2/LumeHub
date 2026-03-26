import type { Clock } from '@lume-hub/clock';
import type { NotificationJobRepository } from '@lume-hub/notification-jobs';
import type { WeekCalculator } from '@lume-hub/schedule-weeks';

import type { DeliveryTrackerService } from '../application/services/DeliveryTrackerService.js';
import type { DeliveryAttemptRepository } from '../domain/repositories/DeliveryAttemptRepository.js';
import type { DeliveryResolutionPolicy } from '../domain/services/DeliveryResolutionPolicy.js';
import type { OutboundSignalReconciler } from '../domain/services/OutboundSignalReconciler.js';

export interface DeliveryTrackerModuleConfig {
  readonly dataRootPath?: string;
  readonly clock?: Clock;
  readonly weekCalculator?: WeekCalculator;
  readonly notificationJobRepository?: NotificationJobRepository;
  readonly repository?: DeliveryAttemptRepository;
  readonly reconciler?: OutboundSignalReconciler;
  readonly resolutionPolicy?: DeliveryResolutionPolicy;
  readonly service?: DeliveryTrackerService;
}
