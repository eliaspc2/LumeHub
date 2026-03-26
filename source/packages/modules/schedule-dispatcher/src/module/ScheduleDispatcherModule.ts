import { BaseModule } from '@lume-hub/kernel';
import {
  CalendarBackedDeliveryAttemptRepository,
  DeliveryResolutionPolicy,
  DeliveryTrackerService,
  OutboundSignalReconciler,
} from '@lume-hub/delivery-tracker';
import {
  CalendarBackedNotificationJobRepository,
} from '@lume-hub/notification-jobs';
import {
  CalendarBackedScheduleEventRepository,
  ScheduleEventFactory,
  ScheduleEventMutator,
  ScheduleEventService,
} from '@lume-hub/schedule-events';
import { WeekCalculator } from '@lume-hub/schedule-weeks';
import { BaileysWhatsAppGateway } from '@lume-hub/whatsapp-baileys';
import { GroupCalendarFileRepository, GroupPathResolver } from '@lume-hub/persistence-group-files';

import { ScheduleDispatcherService } from '../application/services/ScheduleDispatcherService.js';
import { DispatchMessageFormatter } from '../domain/services/DispatchMessageFormatter.js';
import { TickSerialiser } from '../domain/services/TickSerialiser.js';
import type { ScheduleDispatcherModuleContract } from '../public/contracts/index.js';
import type { ScheduleDispatcherModuleConfig } from './ScheduleDispatcherModuleConfig.js';

export class ScheduleDispatcherModule extends BaseModule implements ScheduleDispatcherModuleContract {
  readonly moduleName = 'schedule-dispatcher' as const;
  readonly service: ScheduleDispatcherService;

  constructor(readonly config: ScheduleDispatcherModuleConfig = {}) {
    super({
      name: 'schedule-dispatcher',
      version: '0.1.0',
      dependencies: ['notification-jobs', 'delivery-tracker'],
    });

    const weekCalculator = new WeekCalculator();
    const calendarRepository = new GroupCalendarFileRepository(
      new GroupPathResolver({
        dataRootPath: config.dataRootPath,
      }),
    );
    const scheduleEventRepository = new CalendarBackedScheduleEventRepository(calendarRepository, weekCalculator);
    const scheduleEventService = new ScheduleEventService(
      scheduleEventRepository,
      new ScheduleEventFactory(weekCalculator),
      new ScheduleEventMutator(weekCalculator),
    );
    const notificationJobRepository =
      config.notificationJobRepository ??
      new CalendarBackedNotificationJobRepository(scheduleEventService, scheduleEventRepository);

    const deliveryTrackerService =
      config.deliveryTrackerService ??
      new DeliveryTrackerService(
        new CalendarBackedDeliveryAttemptRepository(calendarRepository, weekCalculator),
        notificationJobRepository,
        new OutboundSignalReconciler(),
        new DeliveryResolutionPolicy(),
        config.clock,
      );
    const gateway = config.gateway ?? new BaileysWhatsAppGateway();

    this.service =
      config.service ??
      new ScheduleDispatcherService(
        notificationJobRepository,
        deliveryTrackerService,
        gateway,
        config.formatter ?? new DispatchMessageFormatter(),
        config.clock,
        config.tickSerialiser ?? new TickSerialiser(),
      );
  }

  async tick(input = {}) {
    return this.service.tick(input);
  }
}
