import { BaseModule } from '@lume-hub/kernel';
import { CalendarBackedNotificationJobRepository } from '@lume-hub/notification-jobs';
import {
  CalendarBackedScheduleEventRepository,
  ScheduleEventFactory,
  ScheduleEventMutator,
  ScheduleEventService,
} from '@lume-hub/schedule-events';
import { GroupCalendarFileRepository, GroupPathResolver } from '@lume-hub/persistence-group-files';
import { WeekCalculator } from '@lume-hub/schedule-weeks';

import { DeliveryTrackerService } from '../application/services/DeliveryTrackerService.js';
import { DeliveryResolutionPolicy } from '../domain/services/DeliveryResolutionPolicy.js';
import { OutboundSignalReconciler } from '../domain/services/OutboundSignalReconciler.js';
import { CalendarBackedDeliveryAttemptRepository } from '../infrastructure/persistence/CalendarBackedDeliveryAttemptRepository.js';
import type { DeliveryTrackerModuleContract } from '../public/contracts/index.js';
import type { DeliveryTrackerModuleConfig } from './DeliveryTrackerModuleConfig.js';

export class DeliveryTrackerModule extends BaseModule implements DeliveryTrackerModuleContract {
  readonly moduleName = 'delivery-tracker' as const;
  readonly service: DeliveryTrackerService;

  constructor(readonly config: DeliveryTrackerModuleConfig = {}) {
    super({
      name: 'delivery-tracker',
      version: '0.2.0',
      dependencies: ['notification-jobs'],
    });

    const weekCalculator = config.weekCalculator ?? new WeekCalculator();
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
    const repository =
      config.repository ??
      new CalendarBackedDeliveryAttemptRepository(calendarRepository, weekCalculator);
    const reconciler = config.reconciler ?? new OutboundSignalReconciler();
    const resolutionPolicy = config.resolutionPolicy ?? new DeliveryResolutionPolicy();

    this.service =
      config.service ??
      new DeliveryTrackerService(
        repository,
        notificationJobRepository,
        reconciler,
        resolutionPolicy,
        config.clock,
      );
  }

  async registerAttemptStarted(
    input: import('../domain/entities/DeliveryAttempt.js').RegisterAttemptStartedInput,
    query = {},
  ) {
    return this.service.registerAttemptStarted(input, query);
  }

  async registerObservation(
    observation: Omit<import('../domain/entities/DeliveryAttempt.js').OutboundObservation, 'observedAt'> & {
      readonly observedAt?: string;
    },
    query = {},
  ) {
    return this.service.registerObservation(observation, query);
  }

  async registerConfirmation(
    confirmation: Omit<import('../domain/entities/DeliveryAttempt.js').OutboundConfirmation, 'confirmedAt'> & {
      readonly confirmedAt?: string;
    },
    query = {},
  ) {
    return this.service.registerConfirmation(confirmation, query);
  }

  async resolvePendingAttempt(jobId: string, query = {}) {
    return this.service.resolvePendingAttempt(jobId, query);
  }
}
