import type { Clock } from '@lume-hub/clock';
import type { DeliveryTrackerService } from '@lume-hub/delivery-tracker';
import type { InstructionQueueModuleContract } from '@lume-hub/instruction-queue';
import type { NotificationJobsModuleContract, NotificationJobRepository } from '@lume-hub/notification-jobs';

import type { ScheduleDispatcherService } from '../application/services/ScheduleDispatcherService.js';
import type { TickSerialiser } from '../domain/services/TickSerialiser.js';

export interface ScheduleDispatcherModuleConfig {
  readonly dataRootPath?: string;
  readonly clock?: Clock;
  readonly notificationJobRepository?: NotificationJobRepository;
  readonly notificationJobs?: Pick<NotificationJobsModuleContract, 'markPrepared' | 'listJobs'>;
  readonly deliveryTrackerService?: DeliveryTrackerService;
  readonly instructionQueue?: Pick<InstructionQueueModuleContract, 'enqueueInstruction'>;
  readonly tickSerialiser?: TickSerialiser;
  readonly service?: ScheduleDispatcherService;
}
