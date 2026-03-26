import type { Clock } from '@lume-hub/clock';
import type { DeliveryTrackerService } from '@lume-hub/delivery-tracker';
import type { NotificationJobRepository } from '@lume-hub/notification-jobs';
import type { IWhatsAppGateway } from '@lume-hub/whatsapp-baileys';

import type { ScheduleDispatcherService } from '../application/services/ScheduleDispatcherService.js';
import type { DispatchMessageFormatter } from '../domain/services/DispatchMessageFormatter.js';
import type { TickSerialiser } from '../domain/services/TickSerialiser.js';

export interface ScheduleDispatcherModuleConfig {
  readonly dataRootPath?: string;
  readonly clock?: Clock;
  readonly gateway?: IWhatsAppGateway;
  readonly notificationJobRepository?: NotificationJobRepository;
  readonly deliveryTrackerService?: DeliveryTrackerService;
  readonly formatter?: DispatchMessageFormatter;
  readonly tickSerialiser?: TickSerialiser;
  readonly service?: ScheduleDispatcherService;
}
